/**
 * Active-tab inspection and one-click category correction.
 *
 * This is the self-healing half of the extension: when a rule gets a
 * tab wrong, the user says so once and every tab matching the same
 * key follows from then on. Corrections are stored as overrides and
 * beat every built-in rule.
 *
 * Applying a correction is deliberately surgical — only the tabs that
 * match the affected key move. Pressing "correct" must never reshuffle
 * the whole window.
 */

import type { Category, ClassifyResult, OverrideScope } from '../types';
import { classifyDetailed } from '../domain/classify';
import { isExcludedUrl, isUserExcludedDomain } from '../domain/exclusion';
import {
  lookupOverride,
  overrideKeyFor,
  overrideKeysFor,
  withOverride,
  withoutOverrides
} from '../domain/overrides';
import { parseUrl } from '../utils/url';
import { getSettings, setSettings } from '../storage/store';
import { getActiveTabInWindow, getTabsInWindow } from '../services/tabsService';
import { organizeWindow } from './organize';

/** Why this tab would be left where it is, if it would. */
export type ActiveTabExclusion = 'none' | 'unsupported-url' | 'pinned' | 'excluded-domain';

export interface ActiveTabInfo {
  tabId: number;
  title: string;
  url: string;
  hostKey: string | null;
  hostPathKey: string | null;
  /** Key of the override currently in effect, if any. */
  activeOverrideKey: string | null;
  /** The URL can carry an override key, so a correction is meaningful. */
  correctable: boolean;
  /**
   * Whether Organize would actually move this tab. A pinned or
   * user-excluded tab is still correctable — the rule the user teaches
   * applies to the other tabs on that site.
   */
  exclusion: ActiveTabExclusion;
  classification: ClassifyResult;
}

export async function describeActiveTab(windowId: number): Promise<ActiveTabInfo | null> {
  const tab = await getActiveTabInWindow(windowId);
  if (!tab || typeof tab.id !== 'number') return null;

  const settings = await getSettings();
  const url = tab.url ?? '';
  const parsed = parseUrl(url);
  const classification = classifyDetailed(
    { url, title: tab.title ?? '' },
    { customRules: settings.customRules ?? [], overrides: settings.categoryOverrides }
  );
  const hit = parsed.ok
    ? lookupOverride(parsed.hostname, parsed.pathname, settings.categoryOverrides)
    : null;
  const keys = parsed.ok ? overrideKeysFor(parsed.hostname, parsed.pathname) : [];

  return {
    tabId: tab.id,
    title: tab.title ?? '',
    url,
    hostKey: parsed.ok ? overrideKeyFor(parsed.hostname, parsed.pathname, 'host') : null,
    hostPathKey: parsed.ok ? overrideKeyFor(parsed.hostname, parsed.pathname, 'hostPath') : null,
    activeOverrideKey: hit?.key ?? null,
    correctable: parsed.ok && keys.length > 0,
    exclusion: exclusionFor(tab, url, settings),
    classification
  };
}

/** Mirrors the filters `organize.ts` applies, so the UI cannot promise
 *  a move that will not happen. */
function exclusionFor(
  tab: chrome.tabs.Tab,
  url: string,
  settings: Awaited<ReturnType<typeof getSettings>>
): ActiveTabExclusion {
  if (isExcludedUrl(url)) return 'unsupported-url';
  if (settings.ignorePinnedTabs && tab.pinned) return 'pinned';
  if (isUserExcludedDomain(url, settings.userExcludedDomains)) return 'excluded-domain';
  return 'none';
}

/** Tabs in the window whose override keys include any of `keys`. */
async function tabIdsMatchingKeys(
  windowId: number,
  keys: readonly string[]
): Promise<Set<number>> {
  const wanted = new Set(keys);
  const tabs = await getTabsInWindow(windowId);
  const out = new Set<number>();
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue;
    const parsed = parseUrl(tab.url ?? '');
    if (!parsed.ok) continue;
    if (overrideKeysFor(parsed.hostname, parsed.pathname).some((k) => wanted.has(k))) {
      out.add(tab.id);
    }
  }
  return out;
}

export interface OverrideChangeResult {
  key: string;
  affectedTabs: number;
  movedTabs: number;
  createdGroups: number;
}

export async function applyOverride(
  windowId: number,
  url: string,
  scope: OverrideScope,
  category: Category
): Promise<OverrideChangeResult> {
  const parsed = parseUrl(url);
  if (!parsed.ok) throw new Error('This tab has no addressable URL.');
  const key = overrideKeyFor(parsed.hostname, parsed.pathname, scope);
  if (key === null) {
    throw new Error(
      scope === 'hostPath'
        ? 'This URL has no path segment to scope to.'
        : 'This URL has no host to scope to.'
    );
  }

  const settings = await getSettings();
  await setSettings({
    categoryOverrides: withOverride(settings.categoryOverrides, key, category)
  });

  const affected = await tabIdsMatchingKeys(windowId, [key]);
  const result = await organizeWindow(windowId, affected);
  return {
    key,
    affectedTabs: affected.size,
    movedTabs: result.movedTabs,
    createdGroups: result.createdGroups
  };
}

/**
 * Drop every override that could apply to this URL (both scopes), then
 * re-place the affected tabs using the built-in rules again.
 */
export async function clearOverridesForUrl(
  windowId: number,
  url: string
): Promise<OverrideChangeResult> {
  const parsed = parseUrl(url);
  if (!parsed.ok) throw new Error('This tab has no addressable URL.');
  const keys = overrideKeysFor(parsed.hostname, parsed.pathname);
  if (keys.length === 0) throw new Error('Nothing to reset for this URL.');

  const affected = await tabIdsMatchingKeys(windowId, keys);

  const settings = await getSettings();
  await setSettings({
    categoryOverrides: withoutOverrides(settings.categoryOverrides, keys)
  });

  const result = await organizeWindow(windowId, affected);
  return {
    key: keys.join(', '),
    affectedTabs: affected.size,
    movedTabs: result.movedTabs,
    createdGroups: result.createdGroups
  };
}
