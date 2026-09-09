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
/**
 * Returns a 1-based stable ordinal of `windowId` among the user's
 * normal Chrome windows, or `null` if there is only one normal window.
 *
 * Used to disambiguate tab group titles across windows so Chrome's
 * "Saved Tab Groups" bar (which is shared across all windows) shows
 * distinct entries like "Misc 1" vs "Misc 2" instead of two
 * indistinguishable "Misc" buttons.
 *
 * The ordinal is by ascending window id (creation order). It is stable
 * within a Chrome session but may shift across sessions if windows
 * are closed/reopened — acceptable for visual disambiguation.
 */
export async function getWindowOrdinal(windowId: number): Promise<number | null> {
  const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
  if (wins.length <= 1) return null;
  const sorted = wins
    .filter((w): w is chrome.windows.Window & { id: number } => typeof w.id === 'number')
    .sort((a, b) => a.id - b.id);
  const idx = sorted.findIndex((w) => w.id === windowId);
  return idx === -1 ? null : idx + 1;
}

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

export async function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return chrome.tabs.get(tabId);
}

export async function getActiveTabInWindow(
  windowId: number
): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ windowId, active: true });
  return tab;
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
