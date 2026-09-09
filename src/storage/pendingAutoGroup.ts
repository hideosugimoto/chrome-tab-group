/**
 * Tab IDs waiting for the automatic grouping pass.
 *
 * Held in `chrome.storage.session` rather than a module variable: the
 * MV3 service worker can be torn down between the tab event and the
 * debounce firing, and an in-memory set would take the queue with it.
 * Persisted, the next event picks up whatever was left behind.
 *
 * Same lifetime as the managed-group registry, and for the same
 * reason — tab IDs are only meaningful within a browser session.
 */

const KEY = 'pendingAutoGroup.v1';

export async function getPendingTabIds(): Promise<number[]> {
  const obj = await chrome.storage.session.get(KEY);
  const raw = obj[KEY];
  return Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n)) : [];
}

export async function addPendingTabIds(tabIds: readonly number[]): Promise<void> {
  if (tabIds.length === 0) return;
  const current = await getPendingTabIds();
  const merged = [...new Set([...current, ...tabIds])];
  await chrome.storage.session.set({ [KEY]: merged });
}

/** Remove the given IDs, leaving anything still deferred in place. */
export async function removePendingTabIds(tabIds: readonly number[]): Promise<void> {
  if (tabIds.length === 0) return;
  const drop = new Set(tabIds);
  const remaining = (await getPendingTabIds()).filter((id) => !drop.has(id));
  if (remaining.length === 0) {
    await chrome.storage.session.remove(KEY);
    return;
  }
  await chrome.storage.session.set({ [KEY]: remaining });
}
