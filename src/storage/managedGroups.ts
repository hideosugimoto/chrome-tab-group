/**
 * Registry of tab groups this extension created.
 *
 * Everything not in this registry belongs to the user and must never
 * be modified, moved, renamed or dissolved — including Chrome's saved
 * tab groups, which the tabGroups API gives us no way to detect
 * (`TabGroup` exposes id / windowId / collapsed / color / title /
 * shared, and nothing about saved state).
 *
 * Stored in `chrome.storage.session` on purpose: Chrome tab group IDs
 * are only valid for the current browser session, so persisting them
 * in `local` would risk a stale ID pointing at somebody else's group
 * after a restart. Session storage is cleared when the extension is
 * disabled, reloaded or updated, and when the browser restarts —
 * roughly the same lifetime as the IDs it holds. `organize.ts`
 * handles re-adoption once it is gone.
 */

import type { Category } from '../types';

const KEY = 'managedGroups.v1';

/** groupId (as string, JSON object keys) -> category */
type StoredMap = Record<string, Category>;

async function readMap(): Promise<StoredMap> {
  const obj = await chrome.storage.session.get(KEY);
  const raw = obj[KEY];
  return raw && typeof raw === 'object' ? (raw as StoredMap) : {};
}

async function writeMap(map: StoredMap): Promise<void> {
  await chrome.storage.session.set({ [KEY]: map });
}

export async function getManagedGroups(): Promise<Map<number, Category>> {
  const map = await readMap();
  const out = new Map<number, Category>();
  for (const [id, category] of Object.entries(map)) {
    const n = Number(id);
    if (Number.isInteger(n)) out.set(n, category);
  }
  return out;
}

export async function registerManagedGroup(
  groupId: number,
  category: Category
): Promise<void> {
  if (groupId === -1) return;
  const map = await readMap();
  await writeMap({ ...map, [String(groupId)]: category });
}

export async function registerManagedGroups(
  entries: readonly { groupId: number; category: Category }[]
): Promise<void> {
  if (entries.length === 0) return;
  const map = await readMap();
  const next: StoredMap = { ...map };
  for (const e of entries) {
    if (e.groupId !== -1) next[String(e.groupId)] = e.category;
  }
  await writeMap(next);
}

/**
 * Drop registry entries whose group no longer exists. Chrome removes
 * a group automatically once its last tab leaves, so the registry
 * accumulates dead IDs without this.
 */
export async function pruneManagedGroups(liveGroupIds: ReadonlySet<number>): Promise<void> {
  const map = await readMap();
  const next: StoredMap = {};
  let changed = false;
  for (const [id, category] of Object.entries(map)) {
    if (liveGroupIds.has(Number(id))) next[id] = category;
    else changed = true;
  }
  if (changed) await writeMap(next);
}
