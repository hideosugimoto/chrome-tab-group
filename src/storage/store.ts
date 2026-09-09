import type { Category, Settings, UndoSnapshot } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';

const KEY_SETTINGS = 'settings.v1';
const KEY_UNDO = 'lastSnapshotForUndo.v1';

export const DEFAULT_SETTINGS: Settings = {
  ignorePinnedTabs: true,
  keepActiveTabPosition: true,
  userExcludedDomains: [],
  sortGroupsByCategory: true,
  sortTabsByDomain: true,
  adoptMatchingGroups: true,
  // Off by default: moving the user's tabs without being asked is
  // exactly the surprise this extension is built to avoid.
  autoGroupEnabled: false
};

export async function getSettings(): Promise<Settings> {
  const obj = await chrome.storage.local.get(KEY_SETTINGS);
  const stored = obj[KEY_SETTINGS] as Partial<Settings> | undefined;
  return normalizeSettings(stored);
}

const CATEGORY_SET = new Set<string>(ALL_CATEGORIES);

/** Keep only entries whose value is a real Category. */
function normalizeOverrides(raw: unknown): Record<string, Category> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, Category> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && CATEGORY_SET.has(value)) {
      out[key] = value as Category;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Defensive merge with the defaults. Older / corrupted shapes are
 * coerced to safe values rather than thrown — settings should never
 * brick the extension.
 */
function normalizeSettings(stored: Partial<Settings> | undefined): Settings {
  const s = stored ?? {};
  return {
    ignorePinnedTabs: bool(s.ignorePinnedTabs, DEFAULT_SETTINGS.ignorePinnedTabs),
    keepActiveTabPosition: bool(s.keepActiveTabPosition, DEFAULT_SETTINGS.keepActiveTabPosition),
    userExcludedDomains: Array.isArray(s.userExcludedDomains)
      ? s.userExcludedDomains.filter((d): d is string => typeof d === 'string')
      : DEFAULT_SETTINGS.userExcludedDomains,
    sortGroupsByCategory: bool(s.sortGroupsByCategory, DEFAULT_SETTINGS.sortGroupsByCategory),
    sortTabsByDomain: bool(s.sortTabsByDomain, DEFAULT_SETTINGS.sortTabsByDomain),
    adoptMatchingGroups: bool(s.adoptMatchingGroups, DEFAULT_SETTINGS.adoptMatchingGroups),
    autoGroupEnabled: bool(s.autoGroupEnabled, DEFAULT_SETTINGS.autoGroupEnabled),
    categoryOverrides: normalizeOverrides(s.categoryOverrides),
    customRules: Array.isArray(s.customRules) ? s.customRules : undefined,
    splitPairHistory: Array.isArray(s.splitPairHistory) ? s.splitPairHistory : undefined
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: merged });
  return normalizeSettings(merged);
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
