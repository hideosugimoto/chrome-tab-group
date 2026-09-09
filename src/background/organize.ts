/**
 * Organize / undo orchestration.
 *
 * Differential by design: it only ever touches tabs that are
 * ungrouped or already inside a group this extension owns. Groups the
 * user made — including Chrome's saved tab groups, which the
 * tabGroups API gives us no way to identify — are never regrouped,
 * renamed, reordered or dissolved.
 *
 * Pure logic (classification, planning) lives in src/domain. This
 * file coordinates Chrome API calls only.
 */

import type {
  Category,
  ClassifyResult,
  Settings,
  UndoGroupSnapshot,
  UndoFailureReason,
  UndoSnapshot,
  UndoTabSnapshot
} from '../types';
import { classifyDetailed } from '../domain/classify';
import { isExcludedUrl, isUserExcludedDomain } from '../domain/exclusion';
import { planGrouping, type ManagedGroup, type PlanTab } from '../domain/groupPlan';
import { formatGroupTitle, recognizeGroupTitle } from '../domain/groupTitle';
import { planUndoRegroup } from '../domain/undoPlan';
import { CATEGORY_COLOR } from '../constants/colors';
import { CATEGORY_ORDER } from '../constants/categories';
import { getSettings, getUndoSnapshot, setUndoSnapshot } from '../storage/store';
import {
  getManagedGroups,
  pruneManagedGroups,
  registerManagedGroups
} from '../storage/managedGroups';
import {
  getActiveTabInWindow,
  getTabsInWindow,
  getWindowOrdinal,
  moveSingleTab,
  ungroupTabs
} from '../services/tabsService';
import {
  getAllGroups,
  getGroupsInWindow,
  groupTabs,
  moveGroup,
  updateGroup
} from '../services/tabGroupsService';

const UNGROUPED = -1;

export interface OrganizeResult {
  movedTabs: number;
  createdGroups: number;
  skippedUserGroupTabs: number;
}

export interface ClassifiedTab {
  tab: chrome.tabs.Tab & { id: number };
  result: ClassifyResult;
}

// ─── Managed-group resolution ────────────────────────────────────────

/**
 * The groups we are allowed to modify in this window.
 *
 * Primary source is the session registry. When `adoptMatchingGroups`
 * is on, a live group also qualifies if its title AND color both
 * match our canonical pair for a category.
 *
 * That fallback exists because the registry is cleared whenever the
 * extension is disabled, reloaded or updated, and when the browser
 * restarts. Without it, a browser restart that brings back our saved
 * groups would make Organize build a second "Dev" next to the
 * restored one. The cost is that a user group named exactly "Dev" in
 * exactly our blue would be adopted — hence the setting.
 */
async function resolveManagedGroups(
  windowId: number,
  settings: Settings
): Promise<{ managed: ManagedGroup[]; liveGroups: chrome.tabGroups.TabGroup[] }> {
  const liveGroups = await getGroupsInWindow(windowId);
  const registry = await getManagedGroups();

  const managed: ManagedGroup[] = [];
  const adopted: ManagedGroup[] = [];

  for (const g of liveGroups) {
    const registered = registry.get(g.id);
    if (registered !== undefined) {
      managed.push({ groupId: g.id, category: registered });
      continue;
    }
    if (!settings.adoptMatchingGroups) continue;
    const recognized = recognizeGroupTitle(g.title, g.color);
    if (recognized !== null) {
      const entry = { groupId: g.id, category: recognized };
      managed.push(entry);
      adopted.push(entry);
    }
  }

  if (adopted.length > 0) await registerManagedGroups(adopted);
  return { managed, liveGroups };
}

// ─── Tab selection ──────────────────────────────────────────────────

function isOrganizableTab(
  tab: chrome.tabs.Tab,
  settings: Settings
): tab is chrome.tabs.Tab & { id: number } {
  if (typeof tab.id !== 'number') return false;
  if (settings.ignorePinnedTabs && tab.pinned) return false;
  const url = tab.url ?? '';
  if (isExcludedUrl(url)) return false;
  if (isUserExcludedDomain(url, settings.userExcludedDomains)) return false;
  return true;
}

function classifyTab(tab: chrome.tabs.Tab, settings: Settings): ClassifyResult {
  return classifyDetailed(
    { url: tab.url ?? '', title: tab.title ?? '' },
    { customRules: settings.customRules ?? [], overrides: settings.categoryOverrides }
  );
}

/**
 * Split the window's tabs into the ones we may touch and a count of
 * the ones parked in the user's own groups (reported back so the UI
 * can say why they were left alone).
 */
function selectTouchableTabs(
  tabs: readonly chrome.tabs.Tab[],
  settings: Settings,
  managedIds: ReadonlySet<number>
): { touchable: ClassifiedTab[]; skippedUserGroupTabs: number } {
  const touchable: ClassifiedTab[] = [];
  let skippedUserGroupTabs = 0;

  for (const tab of tabs) {
    if (!isOrganizableTab(tab, settings)) continue;
    const groupId = tab.groupId ?? UNGROUPED;
    if (groupId !== UNGROUPED && !managedIds.has(groupId)) {
      skippedUserGroupTabs += 1;
      continue;
    }
    touchable.push({ tab, result: classifyTab(tab, settings) });
  }

  return { touchable, skippedUserGroupTabs };
}

// ─── Undo snapshot ──────────────────────────────────────────────────

/** Snapshot only the tabs the plan will actually move. */
function buildSnapshot(
  windowId: number,
  touchedTabIds: readonly number[],
  tabs: readonly chrome.tabs.Tab[],
  liveGroups: readonly chrome.tabGroups.TabGroup[]
): UndoSnapshot {
  const touched = new Set(touchedTabIds);
  const tabSnaps = tabs
    .filter((t): t is chrome.tabs.Tab & { id: number } =>
      typeof t.id === 'number' && touched.has(t.id))
    .map((t) => ({
      tabId: t.id,
      index: t.index,
      groupId: t.groupId ?? UNGROUPED,
      pinned: t.pinned ?? false
    }));

  const neededGroupIds = new Set(
    tabSnaps.map((t) => t.groupId).filter((id) => id !== UNGROUPED)
  );
  const groupSnaps: UndoGroupSnapshot[] = liveGroups
    .filter((g) => neededGroupIds.has(g.id))
    .map((g) => ({
      groupId: g.id,
      title: g.title ?? '',
      color: g.color,
      collapsed: g.collapsed ?? false
    }));

  return { windowId, takenAt: Date.now(), tabs: tabSnaps, groups: groupSnaps };
}

// ─── Plan application ───────────────────────────────────────────────

async function applyPlan(
  plan: ReturnType<typeof planGrouping>,
  windowId: number,
  windowOrdinal: number | null
): Promise<{ movedTabs: number; createdGroups: number }> {
  let movedTabs = 0;
  let createdGroups = 0;
  const newlyManaged: ManagedGroup[] = [];

  for (const a of plan.assignments) {
    try {
      await groupTabs(a.tabIds, windowId, a.groupId);
      movedTabs += a.tabIds.length;
    } catch (e) {
      console.warn('assign to existing group failed:', a.category, e);
    }
  }

  for (const c of plan.creations) {
    try {
      const groupId = await groupTabs(c.tabIds, windowId);
      if (groupId === UNGROUPED) continue;
      await updateGroup(groupId, {
        title: formatGroupTitle(c.category, windowOrdinal),
        color: CATEGORY_COLOR[c.category]
      });
      newlyManaged.push({ groupId, category: c.category });
      createdGroups += 1;
      movedTabs += c.tabIds.length;
    } catch (e) {
      console.warn('group creation failed for', c.category, e);
    }
  }

  if (newlyManaged.length > 0) await registerManagedGroups(newlyManaged);
  return { movedTabs, createdGroups };
}

/**
 * Reorder the groups we own into CATEGORY_ORDER by moving each to the
 * right end in turn. Only our groups move; the user's groups keep
 * their positions relative to each other.
 */
async function sortManagedGroups(windowId: number): Promise<void> {
  const registry = await getManagedGroups();
  const liveGroups = await getGroupsInWindow(windowId);
  const byCategory = new Map<Category, number>();
  for (const g of liveGroups) {
    const category = registry.get(g.id);
    if (category !== undefined && !byCategory.has(category)) byCategory.set(category, g.id);
  }
  for (const category of CATEGORY_ORDER) {
    const groupId = byCategory.get(category);
    if (groupId === undefined) continue;
    try {
      await moveGroup(groupId, -1);
    } catch (e) {
      console.warn('group move failed:', category, e);
    }
  }
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

// ─── Public operations ──────────────────────────────────────────────

export async function previewWindow(windowId: number): Promise<{
  totalTabs: number;
  counts: { category: Category; count: number }[];
  skippedUserGroupTabs: number;
}> {
  const settings = await getSettings();
  const { managed } = await resolveManagedGroups(windowId, settings);
  const tabs = await getTabsInWindow(windowId);
  const managedIds = new Set(managed.map((m) => m.groupId));
  const { touchable, skippedUserGroupTabs } = selectTouchableTabs(tabs, settings, managedIds);

  const countsMap = new Map<Category, number>();
  for (const c of touchable) {
    countsMap.set(c.result.category, (countsMap.get(c.result.category) ?? 0) + 1);
  }

  return {
    totalTabs: tabs.length,
    counts: CATEGORY_ORDER
      .map((category) => ({ category, count: countsMap.get(category) ?? 0 }))
      .filter((x) => x.count > 0),
    skippedUserGroupTabs
  };
}

/** Narrow the touchable tabs to the requested scope and plan them. */
function buildPlan(
  touchable: readonly ClassifiedTab[],
  managed: readonly ManagedGroup[],
  restrictToTabIds: ReadonlySet<number> | undefined
): ReturnType<typeof planGrouping> {
  const scoped = restrictToTabIds
    ? touchable.filter((c) => restrictToTabIds.has(c.tab.id))
    : touchable;
  const planTabs: PlanTab[] = scoped.map((c) => ({
    tabId: c.tab.id,
    category: c.result.category,
    currentGroupId: c.tab.groupId ?? UNGROUPED
  }));
  return planGrouping(planTabs, managed);
}

/**
 * Organize the window.
 *
 * @param restrictToTabIds When given, only these tabs are considered.
 *   Used to apply a single override without reshuffling the window.
 */
export async function organizeWindow(
  windowId: number,
  restrictToTabIds?: ReadonlySet<number>
): Promise<OrganizeResult> {
  const settings = await getSettings();
  const { managed, liveGroups } = await resolveManagedGroups(windowId, settings);
  // Prune against *all* windows: the registry is global, so pruning
  // with only this window's groups would evict entries for the groups
  // we own in every other window.
  await pruneManagedGroups(new Set((await getAllGroups()).map((g) => g.id)));

  const tabs = await getTabsInWindow(windowId);
  const activeTab = await getActiveTabInWindow(windowId);
  const managedIds = new Set(managed.map((m) => m.groupId));
  const { touchable, skippedUserGroupTabs } = selectTouchableTabs(tabs, settings, managedIds);

  const plan = buildPlan(touchable, managed, restrictToTabIds);

  if (plan.touchedTabIds.length === 0) {
    return { movedTabs: 0, createdGroups: 0, skippedUserGroupTabs };
  }

  await setUndoSnapshot(buildSnapshot(windowId, plan.touchedTabIds, tabs, liveGroups));

  const windowOrdinal = await getWindowOrdinal(windowId);
  const { movedTabs, createdGroups } = await applyPlan(plan, windowId, windowOrdinal);

  // Reordering moves tabs, so it is skipped for scoped (single
  // override) runs — those must stay surgical.
  if (settings.sortGroupsByCategory && !restrictToTabIds) {
    await sortManagedGroups(windowId);
  }
  if (settings.keepActiveTabPosition) {
    await restoreActiveTabPosition(activeTab, windowId);
  }

  return { movedTabs, createdGroups, skippedUserGroupTabs };
}

/** Move tabs back to their recorded indices, ascending. */
async function restoreTabPositions(tabs: readonly UndoTabSnapshot[]): Promise<void> {
  for (const t of [...tabs].sort((a, b) => a.index - b.index)) {
    try {
      await moveSingleTab(t.tabId, t.index);
    } catch {
      // tab may have moved or been closed
    }
  }
}

/**
 * Put the tabs back into the groups they came from, reusing any group
 * that survived the ungroup step so undo cannot leave the user with
 * two identically named groups.
 */
async function restoreGroups(
  snap: UndoSnapshot,
  alive: readonly UndoTabSnapshot[]
): Promise<void> {
  const liveGroupIds = new Set((await getGroupsInWindow(snap.windowId)).map((g) => g.id));
  const steps = planUndoRegroup(alive, snap.groups, liveGroupIds);
  const restored: ManagedGroup[] = [];

  for (const step of steps) {
    try {
      const groupId = await groupTabs(
        step.tabIds,
        snap.windowId,
        step.reuseGroupId ?? undefined
      );
      if (groupId === UNGROUPED) continue;
      if (step.meta) {
        await updateGroup(groupId, {
          title: step.meta.title,
          color: step.meta.color,
          collapsed: step.meta.collapsed
        });
        const category = recognizeGroupTitle(step.meta.title, step.meta.color);
        if (category !== null) restored.push({ groupId, category });
      }
    } catch (e) {
      console.warn('undo regroup failed:', e);
    }
  }

  if (restored.length > 0) await registerManagedGroups(restored);
}

export async function undoLast(): Promise<{ ok: boolean; reason?: UndoFailureReason }> {
  const snap = await getUndoSnapshot();
  if (!snap) return { ok: false, reason: 'no-snapshot' };

  const liveTabs = await getTabsInWindow(snap.windowId);
  const liveIds = new Set(liveTabs.map((t) => t.id));
  const alive = snap.tabs.filter((t) => liveIds.has(t.tabId));

  if (alive.length === 0) {
    await setUndoSnapshot(null);
    return { ok: false, reason: 'tabs-gone' };
  }

  // Ungroup first. Safe: every snapshot tab was one of ours.
  try {
    await ungroupTabs(alive.map((t) => t.tabId));
  } catch (e) {
    console.debug('undo ungroup partial failure:', e);
  }

  await restoreTabPositions(alive);
  await restoreGroups(snap, alive);

  await setUndoSnapshot(null);
  return { ok: true };
}
