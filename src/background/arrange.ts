/**
 * Post-pass arrangement: the operations that move tabs *after* the
 * grouping plan has been applied.
 *
 * Separated from organize.ts because they share the property that
 * makes them dangerous: they move tabs the plan itself never touched,
 * so the undo snapshot does not cover them. Each is gated by its own
 * setting and skipped on surgical runs. See CLAUDE.md, "The two passes
 * that move tabs on purpose".
 *
 * Chrome API coordination only — the decisions live in domain/tabOrder.
 */

import type { Category } from '../types';
import { CATEGORY_ORDER } from '../constants/categories';
import { UNGROUPED } from '../constants/tabs';
import { isExcludedUrl } from '../domain/exclusion';
import {
  planActiveTabRestore,
  planDomainClusterOrder,
  planTabMoves
} from '../domain/tabOrder';
import { getGroupsInWindow, groupTabs, moveGroup } from '../services/tabGroupsService';
import { getTabsInWindow, moveSingleTab } from '../services/tabsService';
import { getManagedGroups } from '../storage/managedGroups';

/**
 * Reorder the groups we own into CATEGORY_ORDER by moving each to the
 * right end in turn. Only our groups move; the user's groups keep
 * their positions relative to each other.
 */
export async function sortManagedGroups(windowId: number): Promise<void> {
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
 * Inside each group we own, pull tabs from the same site next to each
 * other. Only our groups are touched, and a group already clustered
 * emits no moves at all.
 *
 * chrome.tabs.move says nothing about tab groups — the API reference
 * does not mention them in move() at all — so we do not assume a tab
 * stays grouped just because it landed back inside the group's index
 * range. Every group is re-read afterwards and any tab that fell out
 * is put straight back — appended, so a repaired tab loses its place
 * in the clustering until the next run. Correct membership matters
 * more than correct order.
 */
export async function clusterTabsWithinManagedGroups(windowId: number): Promise<void> {
  const registry = await getManagedGroups();
  // chrome.tabs.query documents no ordering for its result — only that
  // Tab.index is the position in the window. This is the one pass that
  // cares about strip order, so it sorts rather than trusting the array.
  const tabs = [...(await getTabsInWindow(windowId))].sort((a, b) => a.index - b.index);

  const byGroup = new Map<number, chrome.tabs.Tab[]>();
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue;
    if ((tab.groupId ?? UNGROUPED) === UNGROUPED) continue;
    if (!registry.has(tab.groupId)) continue;
    const bucket = byGroup.get(tab.groupId);
    if (bucket) bucket.push(tab);
    else byGroup.set(tab.groupId, [tab]);
  }

  for (const [groupId, groupTabsInOrder] of byGroup) {
    // Chrome keeps a group's tabs contiguous, so the lowest index is
    // the offset every move in the plan is relative to.
    const start = Math.min(...groupTabsInOrder.map((t) => t.index));
    const current = groupTabsInOrder.map((t) => t.id as number);
    const desired = planDomainClusterOrder(
      groupTabsInOrder.map((t) => ({ tabId: t.id as number, url: t.url }))
    );
    const moves = planTabMoves(current, desired);
    if (moves.length === 0) continue;

    for (const move of moves) {
      try {
        await moveSingleTab(move.tabId, start + move.offset);
      } catch (e) {
        console.warn('tab cluster move failed:', move.tabId, e);
      }
    }

    await repairGroupMembership(groupId, windowId, current);
  }
}

/** Re-group any tab that the reorder knocked out of its group. */
async function repairGroupMembership(
  groupId: number,
  windowId: number,
  expectedTabIds: readonly number[]
): Promise<void> {
  try {
    const after = await getTabsInWindow(windowId);
    const byId = new Map(after.map((t) => [t.id, t]));
    const escaped = expectedTabIds.filter((id) => {
      const tab = byId.get(id);
      return tab !== undefined && tab.groupId !== groupId;
    });
    if (escaped.length === 0) return;
    console.warn('reorder ungrouped tabs, re-grouping:', escaped);
    await groupTabs(escaped, windowId, groupId);
  } catch (e) {
    console.warn('group membership repair failed:', groupId, e);
  }
}

/**
 * Best-effort: nudge the active tab back toward its pre-organize index.
 * Skipped for pinned / excluded tabs (they should never be moved), and
 * for a tab that now sits in one of our groups — see
 * domain/tabOrder.ts#planActiveTabRestore for why.
 */
export async function restoreActiveTabPosition(
  activeTab: chrome.tabs.Tab | undefined,
  windowId: number
): Promise<void> {
  if (!activeTab || typeof activeTab.id !== 'number' || typeof activeTab.index !== 'number') return;
  if (activeTab.pinned) return;
  if (isExcludedUrl(activeTab.url)) return;

  try {
    const registry = await getManagedGroups();
    const after = await getTabsInWindow(windowId);
    const now = after.find((t) => t.id === activeTab.id);
    const groupId = now?.groupId ?? UNGROUPED;

    const target = planActiveTabRestore({
      originalIndex: activeTab.index,
      tabCount: after.length,
      isInOurGroup: groupId !== UNGROUPED && registry.has(groupId)
    });
    if (target === null) return;

    await moveSingleTab(activeTab.id, target);
  } catch {
    // best-effort only
  }
}
