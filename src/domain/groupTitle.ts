/**
 * Group title formatting and recognition.
 *
 * Titles carry an optional per-window ordinal suffix ("Misc 2") so
 * Chrome's saved-tab-group bar — which is shared across all windows —
 * shows distinguishable entries instead of duplicate "Misc" buttons.
 *
 * `recognizeGroupTitle` is the fallback used to re-adopt groups this
 * extension created in a previous service-worker lifetime, when the
 * in-memory registry is gone. It is deliberately strict: title AND
 * color must both match, otherwise the group is treated as the
 * user's and left alone.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

import type { Category } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';
import { CATEGORY_COLOR } from '../constants/colors';

/** Canonical visible title for a category group. */
export function formatGroupTitle(category: Category, windowOrdinal: number | null): string {
  return windowOrdinal === null ? category : `${category} ${windowOrdinal}`;
}

/**
 * Reverse of `formatGroupTitle`. Returns the category when the title
 * is exactly a category name, optionally followed by a single space
 * and a positive integer. Anything else returns null.
 */
export function parseGroupTitle(title: string | undefined): Category | null {
  if (!title) return null;
  const trimmed = title.trim();
  for (const category of ALL_CATEGORIES) {
    if (trimmed === category) return category;
    if (trimmed.startsWith(category + ' ')) {
      const rest = trimmed.slice(category.length + 1);
      if (/^[1-9][0-9]*$/.test(rest)) return category;
    }
  }
  return null;
}

/**
 * Decide whether an existing group looks like one we created.
 *
 * Both the title and the color must match the canonical pair for the
 * category. A user group that merely happens to be named "Dev" but
 * carries a different color is NOT adopted.
 */
export function recognizeGroupTitle(
  title: string | undefined,
  color: chrome.tabGroups.ColorEnum | undefined
): Category | null {
  const category = parseGroupTitle(title);
  if (category === null) return null;
  if (color === undefined) return null;
  return CATEGORY_COLOR[category] === color ? category : null;
}
