/**
 * Group title formatting and recognition.
 *
 * Titles are the Japanese display label plus an optional per-window
 * ordinal ("その他 2") so Chrome's saved-tab-group bar — which is
 * shared across all windows — shows distinguishable entries instead of
 * duplicate buttons.
 *
 * `recognizeGroupTitle` is the fallback used to re-adopt groups this
 * extension created once the registry is gone. It is deliberately
 * strict: title AND color must both match, otherwise the group is
 * treated as the user's and left alone.
 *
 * It also accepts the English titles used before the Japanese switch,
 * because those groups are still sitting in people's windows and saved
 * tab groups. Without that, upgrading would strand every existing
 * group as "not ours".
 *
 * Pure functions only. No Chrome API, no I/O.
 */

import type { Category } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';
import { CATEGORY_LABEL, titlesFor } from '../constants/categoryLabels';
import { CATEGORY_COLOR } from '../constants/colors';

/** Canonical visible title for a category. */
export function formatGroupTitle(category: Category, windowOrdinal: number | null): string {
  const label = CATEGORY_LABEL[category];
  return windowOrdinal === null ? label : `${label} ${windowOrdinal}`;
}

/** True when `title` is `label`, or `label` followed by an ordinal. */
function matchesLabel(title: string, label: string): boolean {
  if (title === label) return true;
  if (!title.startsWith(label + ' ')) return false;
  return /^[1-9][0-9]*$/.test(title.slice(label.length + 1));
}

/**
 * Reverse of `formatGroupTitle`. Returns the category when the title is
 * one of that category's canonical labels — current or legacy English —
 * optionally followed by a single space and a positive integer.
 */
export function parseGroupTitle(title: string | undefined): Category | null {
  if (!title) return null;
  const trimmed = title.trim();
  for (const category of ALL_CATEGORIES) {
    if (titlesFor(category).some((label) => matchesLabel(trimmed, label))) return category;
  }
  return null;
}

/**
 * Decide whether an existing group looks like one we created.
 *
 * Both the title and the color must match the canonical pair for the
 * category. A user group that merely happens to be named "開発" but
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

/**
 * Whether a group we own should be renamed to the current canonical
 * title — true only when its present title is still one of ours.
 *
 * This is what migrates existing English groups to Japanese without
 * fighting a user who renamed one of our groups to something of their
 * own: an unrecognized title is left exactly as it is.
 */
export function needsTitleRefresh(
  currentTitle: string | undefined,
  category: Category,
  windowOrdinal: number | null
): boolean {
  const wanted = formatGroupTitle(category, windowOrdinal);
  if (currentTitle === wanted) return false;
  return parseGroupTitle(currentTitle) === category;
}
