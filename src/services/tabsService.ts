/**
 * Thin wrapper around chrome.tabs. Keeps the rest of the code free of
 * direct chrome.* calls so that domain logic stays testable / mockable.
 */

/**
 * Best-effort window resolver for callers without an explicit windowId
 * (e.g. keyboard shortcut handlers). Prefers the *last focused normal*
 * window — `chrome.windows.getCurrent()` from a service worker is
 * unreliable and often returns the wrong window when popups / multiple
 * windows are involved.
 *
 * UI callers (popup) should always pass the windowId explicitly
 * because the popup is the only context that *knows* which window the
 * user just clicked the action button in.
 */
export async function getFallbackWindowId(): Promise<number> {
  const win = await chrome.windows.getLastFocused({
    populate: false,
    windowTypes: ['normal']
  });
  if (typeof win.id !== 'number') {
    throw new Error('No focused window available.');
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
