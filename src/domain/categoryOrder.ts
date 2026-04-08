import type { Category } from '../types';
import { CATEGORY_ORDER } from '../constants/categories';

/**
 * Pure helpers for ordering classified tabs into the canonical
 * left-to-right category sequence.
 */
export interface ClassifiedTab<T> {
  tab: T;
  category: Category;
}

/**
 * Group tabs by category, preserving each category's incoming order.
 * Returns an array following CATEGORY_ORDER, omitting empty categories.
 */
export function groupByCategoryOrdered<T>(
  classified: readonly ClassifiedTab<T>[]
): { category: Category; tabs: T[] }[] {
  const buckets = new Map<Category, T[]>();
  for (const c of CATEGORY_ORDER) buckets.set(c, []);
  for (const item of classified) buckets.get(item.category)!.push(item.tab);
  return CATEGORY_ORDER
    .map((c) => ({ category: c, tabs: buckets.get(c)! }))
    .filter((b) => b.tabs.length > 0);
}
