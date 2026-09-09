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
import {
  formatGroupTitle,
  needsTitleRefresh,
  recognizeGroupTitle
} from '../domain/groupTitle';
import { planUndoRegroup } from '../domain/undoPlan';
import { selectRebuildTabs } from '../domain/rebuildPlan';
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

export interface DissolveResult {
  dissolvedGroups: number;
  releasedTabs: number;
}

export interface RebuildResult extends OrganizeResult {
  dissolvedGroups: number;
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
 *
 * `allowAdoption` is false for the automatic pass. Taking ownership of
 * a group on a guess is a decision the user should be present for; it
 * happens when they press something, not while a background tab
 * finishes loading. After a restart the first manual Organize adopts,
 * and the automatic pass follows from there.
 */
async function resolveManagedGroups(
  windowId: number,
  settings: Settings,
  allowAdoption = true
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
    if (!allowAdoption || !settings.adoptMatchingGroups) continue;
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
 * Bring the titles of groups we own up to the current canonical form.
 *
 * This is how existing groups migrate when the labels change — English
 * titles from before the Japanese switch become Japanese on the next
 * organize, with no action from the user. A group whose title we no
 * longer recognize is left alone: that means the user renamed it, and
 * renaming it back would be a fight they did not ask for.
 */
async function refreshGroupTitles(
  managed: readonly ManagedGroup[],
  liveGroups: readonly chrome.tabGroups.TabGroup[],
  windowOrdinal: number | null
): Promise<void> {
  for (const entry of managed) {
    const group = liveGroups.find((g) => g.id === entry.groupId);
    if (!group) continue;
    if (!needsTitleRefresh(group.title, entry.category, windowOrdinal)) continue;
    try {
      await updateGroup(entry.groupId, {
        title: formatGroupTitle(entry.category, windowOrdinal)
      });
    } catch (e) {
      console.warn('title refresh failed:', entry.category, e);
    }
  }
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
  options: OrganizeOptions
): ReturnType<typeof planGrouping> {
  const restrict = options.restrictToTabIds;
  const scoped = restrict ? touchable.filter((c) => restrict.has(c.tab.id)) : touchable;
  const planTabs: PlanTab[] = scoped.map((c) => ({
    tabId: c.tab.id,
    category: c.result.category,
    currentGroupId: c.tab.groupId ?? UNGROUPED
  }));
  return planGrouping(planTabs, managed, { allowNewGroups: !options.assignOnly });
}

export interface OrganizeOptions {
  /**
   * Only these tabs are considered. Used to apply a single override,
   * and by the automatic pass, without reshuffling the window.
   */
  restrictToTabIds?: ReadonlySet<number>;
  /**
   * Never create a group; only add to groups we already own. The
   * automatic pass runs this way so it can absorb a stray tab without
   * inventing groups the user did not ask for.
   */
  assignOnly?: boolean;
  /**
   * Skip the undo snapshot. Automatic runs set this so that "undo the
   * last organize" keeps pointing at the user's own last action
   * instead of some tab that opened in the background.
   */
  skipSnapshot?: boolean;
  /** Skip the group reordering pass, which moves tabs. */
  skipSort?: boolean;
  /**
   * Do not take ownership of an unregistered group that merely looks
   * like ours. Set by the automatic pass — see resolveManagedGroups.
   */
  noAdopt?: boolean;
}

/** Organize the window. */
export async function organizeWindow(
  windowId: number,
  options: OrganizeOptions = {}
): Promise<OrganizeResult> {
  const settings = await getSettings();
  const { managed, liveGroups } = await resolveManagedGroups(
    windowId,
    settings,
    !options.noAdopt
  );
  // Prune against *all* windows: the registry is global, so pruning
  // with only this window's groups would evict entries for the groups
  // we own in every other window.
  await pruneManagedGroups(new Set((await getAllGroups()).map((g) => g.id)));

  const tabs = await getTabsInWindow(windowId);
  const activeTab = await getActiveTabInWindow(windowId);
  const managedIds = new Set(managed.map((m) => m.groupId));
  const { touchable, skippedUserGroupTabs } = selectTouchableTabs(tabs, settings, managedIds);

  const plan = buildPlan(touchable, managed, options);

  if (plan.touchedTabIds.length === 0) {
    return { movedTabs: 0, createdGroups: 0, skippedUserGroupTabs };
  }

  if (!options.skipSnapshot) {
    await setUndoSnapshot(buildSnapshot(windowId, plan.touchedTabIds, tabs, liveGroups));
  }

  const windowOrdinal = await getWindowOrdinal(windowId);
  await refreshGroupTitles(managed, liveGroups, windowOrdinal);
  const { movedTabs, createdGroups } = await applyPlan(plan, windowId, windowOrdinal);

  // Reordering moves tabs, so it is skipped for scoped runs — a single
  // override and the automatic pass must both stay surgical.
  const surgical = options.restrictToTabIds !== undefined || options.skipSort === true;
  if (settings.sortGroupsByCategory && !surgical) {
    await sortManagedGroups(windowId);
  }
  if (settings.keepActiveTabPosition && !surgical) {
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

// ─── Rebuild ────────────────────────────────────────────────────────

/**
 * Dissolve the groups we own, then group the window from scratch.
 *
 * For when the tab strip has drifted — order scrambled by automatic
 * additions, a stale group left behind by a restart, corrections
 * changed in bulk. Organize alone cannot fix those, because it is
 * differential by design and never dissolves anything.
 *
 * Scope is the registry and nothing else. Unlike the organize pass,
 * this deliberately does NOT consult `adoptMatchingGroups`: dissolving
 * is destructive enough that a title-and-color guess is the wrong
 * basis for it. A group we never recorded stays the user's.
 */
/**
 * Release every tab from the groups in the registry.
 *
 * @param snapshotStrays Also snapshot the ungrouped tabs that a
 *   following organize pass would move, so one undo covers both halves
 *   of a rebuild. Dissolve on its own does not need them.
 */
async function dissolveOwnedGroups(
  windowId: number,
  snapshotStrays: boolean
): Promise<DissolveResult> {
  const settings = await getSettings();
  const liveGroups = await getGroupsInWindow(windowId);
  const registry = await getManagedGroups();
  const ownedIds = new Set(liveGroups.map((g) => g.id).filter((id) => registry.has(id)));

  const tabs = await getTabsInWindow(windowId);
  const { toUngroup, touched } = selectRebuildTabs(
    tabs
      .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
      .map((t) => ({
        tabId: t.id,
        groupId: t.groupId ?? UNGROUPED,
        organizable: isOrganizableTab(t, settings)
      })),
    ownedIds
  );

  // One snapshot, taken before anything moves, so a single undo
  // restores the window. Skipped when there is nothing to do — pressing
  // the button on an already-tidy window must not throw away the undo
  // of the user's last real action.
  const snapshotSet = snapshotStrays ? touched : toUngroup;
  if (snapshotSet.length > 0) {
    await setUndoSnapshot(buildSnapshot(windowId, snapshotSet, tabs, liveGroups));
  }

  try {
    await ungroupTabs(toUngroup);
  } catch (e) {
    console.warn('dissolve ungroup partial failure:', e);
  }

  // Chrome removes a group once its last tab leaves; drop the dead IDs.
  const liveAfter = new Set((await getAllGroups()).map((g) => g.id));
  await pruneManagedGroups(liveAfter);

  return {
    // Report what actually went away, not what we intended to remove.
    dissolvedGroups: [...ownedIds].filter((id) => !liveAfter.has(id)).length,
    releasedTabs: toUngroup.length
  };
}

/**
 * Dissolve the groups we own and stop there, leaving the tabs
 * ungrouped. The way to hand the window back untouched — or to start
 * over by hand.
 */
export async function dissolveWindow(windowId: number): Promise<DissolveResult> {
  return dissolveOwnedGroups(windowId, false);
}

export async function rebuildWindow(windowId: number): Promise<RebuildResult> {
  const dissolved = await dissolveOwnedGroups(windowId, true);
  const result = await organizeWindow(windowId, { skipSnapshot: true });
  return { ...result, dissolvedGroups: dissolved.dissolvedGroups };
}

/**
 * Restore the window to the state captured by the last snapshot.
 *
 * Only the tabs that operation actually moved are restored, and every
 * one of them was ours, so undo can never dissolve a group the user
 * made. The snapshot is consumed either way — undo does not stack.
 */
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
