import type { Category } from '../types';

/** Display order from left to right. */
export const CATEGORY_ORDER: readonly Category[] = [
  'Chat',
  'Review',
  'Dev',
  'Local',
  'Docs',
  'Research',
  'Cloud',
  'Data',
  'Design',
  'AI',
  'Misc'
] as const;

export const ALL_CATEGORIES: readonly Category[] = CATEGORY_ORDER;

export function categoryIndex(c: Category): number {
  return CATEGORY_ORDER.indexOf(c);
}
