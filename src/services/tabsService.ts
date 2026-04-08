/**
 * Thin wrapper around chrome.tabs. Keeps the rest of the code free of
 * direct chrome.* calls so that domain logic stays testable / mockable.
 */

export async function getCurrentWindowId(): Promise<number> {
  const win = await chrome.windows.getCurrent({ populate: false });
  if (typeof win.id !== 'number') {
    throw new Error('No current window id available.');
  }
  return win.id;
}

export async function getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ windowId });
}

export async function moveTabs(tabIds: number[], index: number): Promise<void> {
  if (tabIds.length === 0) return;
  await chrome.tabs.move(tabIds, { index });
}

export async function moveSingleTab(tabId: number, index: number): Promise<void> {
  await chrome.tabs.move(tabId, { index });
}

export async function ungroupTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await chrome.tabs.ungroup(tabIds);
}
