import type { Category } from '../types';

/**
 * Chrome tabGroups supported colors:
 *   grey, blue, red, yellow, green, pink, purple, cyan, orange
 * `teal` is not supported -> fall back to cyan.
 */
export const CATEGORY_COLOR: Record<Category, chrome.tabGroups.ColorEnum> = {
  Chat: 'green',
  Review: 'red',
  Dev: 'blue',
  Local: 'cyan',
  Docs: 'yellow',
  Research: 'purple',
  Cloud: 'orange',
  Data: 'pink',
  Design: 'grey',
  AI: 'cyan', // teal fallback
  Misc: 'grey'
};
