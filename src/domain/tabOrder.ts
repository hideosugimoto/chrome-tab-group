/**
 * Tab ordering inside a single group.
 *
 * Grouping decides *which* group a tab belongs to; this decides where
 * it sits inside that group. The goal is only that tabs from the same
 * site end up adjacent — a group holding six GitHub tabs and two Zenn
 * tabs should not interleave them.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

import { parseUrl, rootDomain } from '../utils/url';

/** A tab as the orderer sees it, in its current on-screen order. */
export interface OrderTab {
  tabId: number;
  url?: string;
}

/** One reorder step: put `tabId` at `offset` counted from the group start. */
export interface TabMove {
  tabId: number;
  offset: number;
}

/**
 * Cluster key. Root domain rather than full hostname, so that
 * `mail.google.com` and `docs.google.com` count as the same site —
 * within one category group that is what "同じサイト" means in
 * practice. Tabs with no usable URL share one bucket of their own.
 */
function siteKey(url: string | undefined): string {
  const parsed = parseUrl(url ?? '');
  if (!parsed.ok || !parsed.hostname) return '';
  return rootDomain(parsed.hostname);
}

/**
 * Desired order for one group's tabs.
 *
 * Sites appear in the order their first tab already appears, and tabs
 * within a site keep their relative order. Both choices are about
 * disruption: a strictly alphabetical sort would rearrange a group the
 * user has already read left-to-right every time a new site shows up.
 */
export function planDomainClusterOrder(tabs: readonly OrderTab[]): number[] {
  const clusters = new Map<string, number[]>();
  for (const tab of tabs) {
    const key = siteKey(tab.url);
    const bucket = clusters.get(key);
    if (bucket) bucket.push(tab.tabId);
    else clusters.set(key, [tab.tabId]);
  }
  // Map iteration is insertion-ordered, so first-seen site wins.
  return [...clusters.values()].flat();
}

/**
 * Turn a desired order into the sequence of moves that produces it.
 *
 * Each move is applied to the strip in turn, so the list is simulated
 * the same way Chrome will apply it: remove the tab from where it is,
 * insert it at the target offset. Tabs already in place emit nothing,
 * which is what keeps a tidy window from being churned on every run.
 */
export function planTabMoves(
  currentOrder: readonly number[],
  desiredOrder: readonly number[]
): TabMove[] {
  const working = [...currentOrder];
  const moves: TabMove[] = [];

  for (let offset = 0; offset < desiredOrder.length; offset++) {
    const tabId = desiredOrder[offset];
    if (tabId === undefined) continue;
    if (working[offset] === tabId) continue;

    const from = working.indexOf(tabId);
    // Not in this group any more (closed or moved out mid-run) — skip.
    if (from < 0) continue;

    working.splice(from, 1);
    working.splice(offset, 0, tabId);
    moves.push({ tabId, offset });
  }

  return moves;
}

/** Inputs for deciding whether the active tab should be nudged back. */
export interface ActiveRestoreInput {
  /** The tab's index before the organize run. */
  originalIndex: number;
  /** Tabs in the window now. */
  tabCount: number;
  /** The tab ended up inside a group this extension owns. */
  isInOurGroup: boolean;
}

/**
 * Where to nudge the active tab back to, or null to leave it alone.
 *
 * `keepActiveTabPosition` exists so organizing does not yank the tab
 * you are reading out from under you. But restoring a raw pre-organize
 * index is wrong once that tab has been *grouped*: the old index is
 * almost never inside the new group, so the move drags the tab back
 * out of the group we just put it in — and out of its site cluster.
 *
 * So the rule is: a tab sitting in one of our groups is positioned by
 * the grouping passes, and this one leaves it alone. The setting still
 * protects the case it was written for, an active tab that stayed
 * ungrouped while the rest of the window was rearranged.
 */
export function planActiveTabRestore(input: ActiveRestoreInput): number | null {
  if (input.isInOurGroup) return null;
  if (input.tabCount <= 0) return null;
  return Math.max(0, Math.min(input.originalIndex, input.tabCount - 1));
}
