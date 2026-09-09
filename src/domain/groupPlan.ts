/**
 * Differential grouping planner.
 *
 * Given the tabs we are allowed to touch and the groups we already
 * own, produce the *minimum* set of Chrome operations needed to put
 * every tab in the group matching its category.
 *
 * This replaces the previous "ungroup everything, then rebuild"
 * approach, which destroyed the user's own (and saved) tab groups and
 * moved every tab on every run.
 *
 * Invariant enforced by the caller, not here: `tabs` must already be
 * filtered down to tabs that are ungrouped or in a group we manage.
 * The planner never emits an operation for a tab it was not given.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

import type { Category } from '../types';
import { CATEGORY_ORDER } from '../constants/categories';

/** A tab as the planner sees it. */
export interface PlanTab {
  tabId: number;
  category: Category;
  /** -1 when ungrouped. */
  currentGroupId: number;
}

/** A group this extension owns, in the target window. */
export interface ManagedGroup {
  groupId: number;
  category: Category;
}

/** Add these tabs to an existing group we own. */
export interface Assignment {
  groupId: number;
  category: Category;
  tabIds: number[];
}

/** Create a new group for these tabs. */
export interface Creation {
  category: Category;
  tabIds: number[];
}

export interface GroupPlan {
  assignments: Assignment[];
  creations: Creation[];
  /** Every tab the plan will actually move. Used for the undo snapshot. */
  touchedTabIds: number[];
}

/**
 * Build the plan.
 *
 * @param minTabsPerNewGroup Only create a *new* group once this many
 *   tabs share a category. Existing groups always accept new members
 *   regardless of the threshold. 1 means "always create".
 * @param skipCategories Categories that must never get a new group
 *   (e.g. 'Misc'). Tabs already in such a group are left where they
 *   are rather than being pulled out.
 * @param allowNewGroups When false, tabs whose category has no group
 *   yet are left exactly where they are. This is what makes automatic
 *   grouping quiet: it can absorb a tab into an existing group, but
 *   never invents one behind the user's back.
 */
export function planGrouping(
  tabs: readonly PlanTab[],
  managedGroups: readonly ManagedGroup[],
  options: {
    minTabsPerNewGroup?: number;
    skipCategories?: readonly Category[];
    allowNewGroups?: boolean;
  } = {}
): GroupPlan {
  const minTabs = Math.max(1, options.minTabsPerNewGroup ?? 1);
  const skip = new Set<Category>(options.skipCategories ?? []);
  const allowNewGroups = options.allowNewGroups ?? true;

  // First managed group per category wins; extras are ignored so we
  // never split a category across two groups in one window.
  const groupForCategory = new Map<Category, number>();
  for (const g of managedGroups) {
    if (!groupForCategory.has(g.category)) groupForCategory.set(g.category, g.groupId);
  }

  const byCategory = new Map<Category, PlanTab[]>();
  for (const t of tabs) {
    const arr = byCategory.get(t.category);
    if (arr) arr.push(t);
    else byCategory.set(t.category, [t]);
  }

  const assignments: Assignment[] = [];
  const creations: Creation[] = [];
  const touchedTabIds: number[] = [];

  // Iterate in canonical order so creations happen left-to-right.
  for (const category of CATEGORY_ORDER) {
    const members = byCategory.get(category);
    if (!members || members.length === 0) continue;

    const existingGroupId = groupForCategory.get(category);

    if (existingGroupId !== undefined) {
      // Only tabs not already in the right group need moving.
      const tabIds = members
        .filter((t) => t.currentGroupId !== existingGroupId)
        .map((t) => t.tabId);
      if (tabIds.length > 0) {
        assignments.push({ groupId: existingGroupId, category, tabIds });
        touchedTabIds.push(...tabIds);
      }
      continue;
    }

    if (!allowNewGroups) continue;
    if (skip.has(category)) continue;
    if (members.length < minTabs) continue;

    const tabIds = members.map((t) => t.tabId);
    creations.push({ category, tabIds });
    touchedTabIds.push(...tabIds);
  }

  return { assignments, creations, touchedTabIds };
}
