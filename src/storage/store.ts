import type { Settings, UndoSnapshot } from '../types';

const KEY_SETTINGS = 'settings.v1';
const KEY_UNDO = 'lastSnapshotForUndo.v1';

export const DEFAULT_SETTINGS: Settings = {
  ignorePinnedTabs: true,
  keepActiveTabPosition: true,
  userExcludedDomains: []
};

export async function getSettings(): Promise<Settings> {
  const obj = await chrome.storage.local.get(KEY_SETTINGS);
  const stored = obj[KEY_SETTINGS] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: merged });
  return merged;
}

export async function getUndoSnapshot(): Promise<UndoSnapshot | null> {
  const obj = await chrome.storage.local.get(KEY_UNDO);
  return (obj[KEY_UNDO] as UndoSnapshot | undefined) ?? null;
}

export async function setUndoSnapshot(snap: UndoSnapshot | null): Promise<void> {
  if (snap === null) {
    await chrome.storage.local.remove(KEY_UNDO);
    return;
  }
  await chrome.storage.local.set({ [KEY_UNDO]: snap });
}
