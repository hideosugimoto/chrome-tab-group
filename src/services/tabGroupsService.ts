/**
 * Thin wrapper around chrome.tabGroups.
 */

export async function groupTabs(
  tabIds: number[],
  windowId: number,
  groupId?: number
): Promise<number> {
  if (tabIds.length === 0) return -1;
  if (groupId !== undefined && groupId !== -1) {
    return chrome.tabs.group({ tabIds, groupId });
  }
  return chrome.tabs.group({ tabIds, createProperties: { windowId } });
}

export async function updateGroup(
  groupId: number,
  updates: chrome.tabGroups.UpdateProperties
): Promise<void> {
  if (groupId === -1) return;
  await chrome.tabGroups.update(groupId, updates);
}

export async function moveGroup(groupId: number, index: number): Promise<void> {
  if (groupId === -1) return;
  await chrome.tabGroups.move(groupId, { index });
}

export async function getGroupsInWindow(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
  return chrome.tabGroups.query({ windowId });
}

/** Every group in every window. Used to prune the managed-group registry. */
export async function getAllGroups(): Promise<chrome.tabGroups.TabGroup[]> {
  return chrome.tabGroups.query({});
}
