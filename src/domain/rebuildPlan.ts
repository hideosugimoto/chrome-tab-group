/**
 * Which tabs a rebuild releases, and which ones it must snapshot.
 *
 * Rebuild dissolves the groups we own and regroups the window from
 * scratch. Getting this set wrong is the kind of bug that silently
 * breaks undo — a tab that moved but was never snapshotted cannot be
 * put back — so it lives here, pure and tested, rather than inline in
 * the Chrome-facing code.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

const UNGROUPED = -1;

export interface RebuildTab {
  tabId: number;
  /** -1 when ungrouped. */
  groupId: number;
  /** Passes the pinned / excluded-URL / excluded-domain filters. */
  organizable: boolean;
}

export interface RebuildSelection {
  /** Tabs to release from the groups we own. */
  toUngroup: number[];
  /** Everything the whole operation can move; the undo snapshot set. */
  touched: number[];
}

export function selectRebuildTabs(
  tabs: readonly RebuildTab[],
  ownedGroupIds: ReadonlySet<number>
): RebuildSelection {
  const toUngroup: number[] = [];
  const touched: number[] = [];

  for (const tab of tabs) {
    if (ownedGroupIds.has(tab.groupId)) {
      // Everything in our groups is released, organizable or not: a
      // tab excluded after it was grouped should come back out.
      toUngroup.push(tab.tabId);
      touched.push(tab.tabId);
      continue;
    }
    // Tabs in the user's own groups are never part of a rebuild.
    if (tab.groupId === UNGROUPED && tab.organizable) touched.push(tab.tabId);
  }

  return { toUngroup, touched };
}
