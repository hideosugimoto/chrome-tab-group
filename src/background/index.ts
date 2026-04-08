/**
 * Background service worker.
 *
 * Responsibilities:
 *   - Handle messages from popup (organize / undo / suggest / preview).
 *   - Handle keyboard commands.
 *   - Orchestrate the organize pipeline (classify -> group -> sort).
 *   - Snapshot state for Undo.
 *
 * Pure logic (classification, scoring) lives elsewhere; this file only
 * coordinates Chrome API calls.
 */

import type {
  Category,
  CategoryCount,
  ClassifyInput,
  Settings,
  SplitPairCandidate,
  UndoSnapshot
} from '../types';
import { classify } from '../domain/classify';
import { groupByCategoryOrdered } from '../domain/categoryOrder';
import { isExcludedUrl, isUserExcludedDomain } from '../domain/exclusion';
import { CATEGORY_COLOR } from '../constants/colors';
import { CATEGORY_ORDER } from '../constants/categories';
import { getSettings, getUndoSnapshot, setSettings, setUndoSnapshot } from '../storage/store';
import {
  getCurrentWindowId,
  getTabsInWindow,
  moveSingleTab,
  ungroupTabs
} from '../services/tabsService';
import {
  getGroupsInWindow,
  groupTabs,
  moveGroup,
  updateGroup
} from '../services/tabGroupsService';
import { suggestSplitPairs } from '../scoring/splitPair';

// ─── Message protocol ────────────────────────────────────────────────

export type RequestMessage =
  | { kind: 'preview' }
  | { kind: 'organize' }
  | { kind: 'undo' }
  | { kind: 'suggestPairs' }
  | { kind: 'getSettings' }
  | { kind: 'setSettings'; patch: Partial<Settings> };

export type ResponseMessage =
  | { kind: 'preview'; totalTabs: number; counts: CategoryCount[] }
  | { kind: 'organize'; movedTabs: number; createdGroups: number }
  | { kind: 'undo'; ok: boolean; reason?: string }
  | { kind: 'suggestPairs'; pairs: SerializedPair[] }
  | { kind: 'settings'; settings: Settings }
  | { kind: 'error'; message: string };

export interface SerializedPair {
  aTitle: string;
  aUrl: string;
  bTitle: string;
  bUrl: string;
  reason: string;
  score: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

interface OrganizableTab {
  tab: chrome.tabs.Tab;
  category: Category;
}

/** Filter & classify tabs in a window according to settings. */
function selectAndClassify(
  tabs: chrome.tabs.Tab[],
  settings: Settings
): OrganizableTab[] {
  const out: OrganizableTab[] = [];
  for (const t of tabs) {
    if (typeof t.id !== 'number') continue;
    if (settings.ignorePinnedTabs && t.pinned) continue;
    const url = t.url ?? '';
    if (isExcludedUrl(url)) continue;
    if (isUserExcludedDomain(url, settings.userExcludedDomains)) continue;

    const input: ClassifyInput = { url, title: t.title ?? '' };
    const category = classify(input, settings.customRules ?? []);
    out.push({ tab: t, category });
  }
  return out;
}

async function buildSnapshot(windowId: number): Promise<UndoSnapshot> {
  const [tabs, groups] = await Promise.all([
    getTabsInWindow(windowId),
    getGroupsInWindow(windowId)
  ]);
  return {
    windowId,
    takenAt: Date.now(),
    tabs: tabs
      .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
      .map((t) => ({
        tabId: t.id,
        index: t.index,
        groupId: t.groupId ?? -1,
        pinned: t.pinned ?? false
      })),
    groups: groups.map((g) => ({
      groupId: g.id,
      title: g.title ?? '',
      color: g.color,
      collapsed: g.collapsed ?? false
    }))
  };
}

// ─── Preview ────────────────────────────────────────────────────────

async function handlePreview(): Promise<ResponseMessage> {
  const settings = await getSettings();
  const windowId = await getCurrentWindowId();
  const tabs = await getTabsInWindow(windowId);
  const classified = selectAndClassify(tabs, settings);

  const countsMap = new Map<Category, number>();
  for (const c of CATEGORY_ORDER) countsMap.set(c, 0);
  for (const c of classified) countsMap.set(c.category, (countsMap.get(c.category) ?? 0) + 1);

  return {
    kind: 'preview',
    totalTabs: tabs.length,
    counts: CATEGORY_ORDER
      .map((cat) => ({ category: cat, count: countsMap.get(cat) ?? 0 }))
      .filter((x) => x.count > 0)
  };
}

// ─── Organize ───────────────────────────────────────────────────────

interface GroupingResult {
  movedTabs: number;
  createdGroups: number;
}

/**
 * Apply the bucketing plan: ungroup target tabs, recreate groups with
 * the canonical title/color, then move them to the right end in
 * order so the final left-to-right sequence matches CATEGORY_ORDER.
 */
async function applyGroupingPlan(
  buckets: { category: Category; tabs: chrome.tabs.Tab[] }[],
  targetTabIds: number[],
  windowId: number
): Promise<GroupingResult> {
  // Ungroup first so chrome.tabs.group creates fresh groups cleanly.
  // Failure here is benign (tabs may already be ungrouped).
  try {
    await ungroupTabs(targetTabIds);
  } catch (e) {
    console.debug('ungroup partial failure:', e);
  }

  let createdGroups = 0;
  let movedTabs = 0;
  const createdGroupIds: number[] = [];

  for (const bucket of buckets) {
    const ids = bucket.tabs
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number');
    if (ids.length === 0) continue;
    try {
      const groupId = await groupTabs(ids, windowId);
      await updateGroup(groupId, {
        title: bucket.category,
        color: CATEGORY_COLOR[bucket.category]
      });
      createdGroupIds.push(groupId);
      createdGroups += 1;
      movedTabs += ids.length;
    } catch (e) {
      console.warn('group creation failed for', bucket.category, e);
    }
  }

  // Move each created group to the right end in turn — the result is
  // CATEGORY_ORDER from left to right.
  for (const groupId of createdGroupIds) {
    try {
      await moveGroup(groupId, -1);
    } catch (e) {
      console.warn('group move failed:', e);
    }
  }

  return { movedTabs, createdGroups };
}

/**
 * Best-effort: nudge the active tab back toward its pre-organize index.
 * Skipped for pinned / excluded tabs (they should never be moved).
 */
async function restoreActiveTabPosition(
  activeTab: chrome.tabs.Tab | undefined,
  windowId: number
): Promise<void> {
  if (!activeTab || typeof activeTab.id !== 'number' || typeof activeTab.index !== 'number') return;
  if (activeTab.pinned) return;
  if (isExcludedUrl(activeTab.url)) return;

  try {
    const after = await getTabsInWindow(windowId);
    const target = Math.max(0, Math.min(activeTab.index, after.length - 1));
    await moveSingleTab(activeTab.id, target);
  } catch {
    // best-effort only
  }
}

async function handleOrganize(): Promise<ResponseMessage> {
  const settings = await getSettings();
  const windowId = await getCurrentWindowId();

  // Snapshot current state for Undo BEFORE we touch anything.
  await setUndoSnapshot(await buildSnapshot(windowId));

  const tabs = await getTabsInWindow(windowId);
  const activeTab = tabs.find((t) => t.active);

  const classified = selectAndClassify(tabs, settings);
  if (classified.length === 0) {
    return { kind: 'organize', movedTabs: 0, createdGroups: 0 };
  }

  const buckets = groupByCategoryOrdered(
    classified.map(({ tab, category }) => ({ tab, category }))
  );
  const targetIds = classified
    .map((c) => c.tab.id)
    .filter((id): id is number => typeof id === 'number');

  const { movedTabs, createdGroups } = await applyGroupingPlan(buckets, targetIds, windowId);

  if (settings.keepActiveTabPosition) {
    await restoreActiveTabPosition(activeTab, windowId);
  }

  return { kind: 'organize', movedTabs, createdGroups };
}

// ─── Undo ───────────────────────────────────────────────────────────

async function handleUndo(): Promise<ResponseMessage> {
  const snap = await getUndoSnapshot();
  if (!snap) return { kind: 'undo', ok: false, reason: 'No snapshot.' };

  const liveTabs = await getTabsInWindow(snap.windowId);
  const liveIds = new Set(liveTabs.map((t) => t.id));

  // 1. Ungroup all snapshot tabs first to escape current grouping.
  const idsAlive = snap.tabs
    .filter((t) => liveIds.has(t.tabId))
    .map((t) => t.tabId);
  try {
    if (idsAlive.length) await ungroupTabs(idsAlive);
  } catch (e) {
    console.debug('undo ungroup partial failure:', e);
  }

  // 2. Restore index order. Move tabs in ascending original index so
  //    each move targets a position the previous moves already filled.
  const sortedByIndex = [...snap.tabs]
    .filter((t) => liveIds.has(t.tabId))
    .sort((a, b) => a.index - b.index);
  for (const t of sortedByIndex) {
    try {
      await moveSingleTab(t.tabId, t.index);
    } catch {
      // ignored — tab may have moved or been closed
    }
  }

  // 3. Restore previous groupings. Bucket by old groupId.
  const groupsByOldId = new Map<number, number[]>();
  for (const t of snap.tabs) {
    if (t.groupId === -1) continue;
    if (!liveIds.has(t.tabId)) continue;
    const arr = groupsByOldId.get(t.groupId) ?? [];
    arr.push(t.tabId);
    groupsByOldId.set(t.groupId, arr);
  }

  for (const [oldGroupId, tabIds] of groupsByOldId) {
    if (!tabIds.length) continue;
    try {
      const newGroupId = await groupTabs(tabIds, snap.windowId);
      const meta = snap.groups.find((g) => g.groupId === oldGroupId);
      if (meta) {
        await updateGroup(newGroupId, {
          title: meta.title,
          color: meta.color,
          collapsed: meta.collapsed
        });
      }
    } catch (e) {
      console.warn('undo regroup failed:', e);
    }
  }

  // 4. Snapshot consumed.
  await setUndoSnapshot(null);
  return { kind: 'undo', ok: true };
}

// ─── Suggest pairs ──────────────────────────────────────────────────

async function handleSuggestPairs(): Promise<ResponseMessage> {
  const settings = await getSettings();
  const windowId = await getCurrentWindowId();
  const tabs = await getTabsInWindow(windowId);
  const eligible = tabs.filter((t) => {
    if (settings.ignorePinnedTabs && t.pinned) return false;
    if (isExcludedUrl(t.url)) return false;
    if (isUserExcludedDomain(t.url ?? '', settings.userExcludedDomains)) return false;
    return true;
  });

  const pairs = suggestSplitPairs(
    eligible.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
      lastAccessed: (t as chrome.tabs.Tab & { lastAccessed?: number }).lastAccessed
    })),
    { topN: 5 }
  );

  return {
    kind: 'suggestPairs',
    pairs: pairs.map((p) => ({
      aTitle: p.a.title ?? '',
      aUrl: p.a.url ?? '',
      bTitle: p.b.title ?? '',
      bUrl: p.b.url ?? '',
      reason: p.reason,
      score: p.score
    }))
  };
}

// ─── Message router ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: RequestMessage, _sender, sendResponse: (r: ResponseMessage) => void) => {
    (async () => {
      try {
        switch (msg.kind) {
          case 'preview':
            sendResponse(await handlePreview());
            break;
          case 'organize':
            sendResponse(await handleOrganize());
            break;
          case 'undo':
            sendResponse(await handleUndo());
            break;
          case 'suggestPairs':
            sendResponse(await handleSuggestPairs());
            break;
          case 'getSettings':
            sendResponse({ kind: 'settings', settings: await getSettings() });
            break;
          case 'setSettings': {
            const updated = await setSettings(msg.patch);
            sendResponse({ kind: 'settings', settings: updated });
            break;
          }
          default:
            sendResponse({ kind: 'error', message: 'Unknown message.' });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('background handler error:', e);
        sendResponse({ kind: 'error', message });
      }
    })();
    return true; // keep the message channel open for async sendResponse
  }
);

// ─── Keyboard commands ──────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    try {
      if (command === 'organize-now') await handleOrganize();
      if (command === 'undo-organize') await handleUndo();
    } catch (e) {
      console.error('command handler error:', e);
    }
  })();
});
