import type { Category } from '../types';
import { ALL_CATEGORIES } from './categories';

/**
 * Japanese display names.
 *
 * These are what the user sees everywhere: the tab group titles in the
 * strip, the popup chips and selects, the options table. `Category`
 * itself stays English because it is the code-level identifier and the
 * key format for overrides.
 *
 * Keep them short. A tab group title competes for horizontal space
 * with every open tab.
 */
export const CATEGORY_LABEL: Record<Category, string> = {
  Chat: 'チャット',
  Review: 'レビュー',
  Dev: '開発',
  Local: 'ローカル',
  Docs: 'ドキュメント',
  Research: '調査',
  Cloud: 'クラウド',
  Data: 'データ',
  Design: 'デザイン',
  AI: 'AI',
  Misc: 'その他'
};

/**
 * Every title string that has ever meant a given category, most
 * current first.
 *
 * Group titles created before the Japanese switch are still sitting in
 * people's windows and saved tab groups. `groupTitle.ts` matches
 * against this list so those groups keep being recognized as ours
 * instead of silently becoming "the user's" and getting stranded.
 */
export function titlesFor(category: Category): string[] {
  const label = CATEGORY_LABEL[category];
  return label === category ? [label] : [label, category];
}

/** Category whose canonical title is exactly `title`, ignoring ordinals. */
export function categoryForExactTitle(title: string): Category | null {
  for (const category of ALL_CATEGORIES) {
    if (titlesFor(category).includes(title)) return category;
  }
  return null;
}
