/**
 * Which tab updates are worth reacting to.
 *
 * `chrome.tabs.onUpdated` is noisy — it fires for favicons, titles,
 * audio state, and for our own grouping calls. Reacting to all of it
 * would mean reclassifying constantly and, worse, re-entering our own
 * group operations.
 *
 * Only two things mean "this tab is now something different":
 * the URL changed, or the load finished. A `groupId` change is
 * explicitly NOT a trigger, because that is what our own writes look
 * like from the outside.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

export interface TabChangeInfo {
  url?: string | undefined;
  status?: string | undefined;
  groupId?: number | undefined;
}

export function isAutoGroupTrigger(
  changeInfo: TabChangeInfo,
  tabUrl: string | undefined
): boolean {
  if (!tabUrl) return false;
  if (typeof changeInfo.url === 'string') return true;
  return changeInfo.status === 'complete';
}
