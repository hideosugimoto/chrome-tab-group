/**
 * Undo regrouping planner.
 *
 * Undo first ungroups the snapshot tabs, which may or may not destroy
 * the group they came from — it survives if tabs outside the snapshot
 * are still in it. Recreating a group that still exists would leave
 * the user with two identical groups, so the plan distinguishes the
 * two cases explicitly.
 *
 * Callers must compute `liveGroupIds` *after* the ungroup step, since
 * that is what decides which groups actually survived.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

import type { UndoGroupSnapshot, UndoTabSnapshot } from '../types';

const UNGROUPED = -1;

export interface UndoRegroupStep {
  tabIds: number[];
  /** A surviving group to put the tabs back into, or null to recreate. */
  reuseGroupId: number | null;
  /** Title/color/collapsed to restore. Null when the group is unknown. */
  meta: UndoGroupSnapshot | null;
}

export function planUndoRegroup(
  tabs: readonly UndoTabSnapshot[],
  groups: readonly UndoGroupSnapshot[],
  liveGroupIds: ReadonlySet<number>
): UndoRegroupStep[] {
  const byOldGroup = new Map<number, number[]>();
  for (const t of tabs) {
    if (t.groupId === UNGROUPED) continue;
    const arr = byOldGroup.get(t.groupId);
    if (arr) arr.push(t.tabId);
    else byOldGroup.set(t.groupId, [t.tabId]);
  }

  const steps: UndoRegroupStep[] = [];
  for (const [oldGroupId, tabIds] of byOldGroup) {
    const survived = liveGroupIds.has(oldGroupId);
    const meta = groups.find((g) => g.groupId === oldGroupId) ?? null;
    // Nothing to restore into and nothing to recreate from: leave the
    // tabs ungrouped rather than inventing a group.
    if (!survived && meta === null) continue;
    steps.push({ tabIds, reuseGroupId: survived ? oldGroupId : null, meta });
  }
  return steps;
}
