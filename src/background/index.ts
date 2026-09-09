/**
 * Background service worker.
 *
 * Thin router only: it validates messages, dispatches to the modules
 * that do the work, and serializes responses. No tab or group logic
 * lives here.
 *
 *   organize / undo / preview  -> background/organize.ts
 *   current tab + overrides    -> background/currentTab.ts
 *   automatic grouping         -> background/autoGroup.ts
 *   split-pair suggestions     -> scoring/splitPair.ts
 */

import type {
  Category,
  CategoryCount,
  OverrideScope,
  Settings,
  UndoFailureReason
} from '../types';
import type { ActiveTabInfo } from './currentTab';
import { getSettings, setSettings } from '../storage/store';
import { getFallbackWindowId, getTabsInWindow } from '../services/tabsService';
import { isExcludedUrl, isUserExcludedDomain } from '../domain/exclusion';
import { suggestSplitPairs } from '../scoring/splitPair';
import { organizeWindow, previewWindow, undoLast } from './organize';
import { registerAutoGroupListeners } from './autoGroup';
import { applyOverride, clearOverridesForUrl, describeActiveTab } from './currentTab';

/** The active-tab payload crosses the message boundary unchanged. */
export type { ActiveTabInfo, ActiveTabExclusion } from './currentTab';

// ─── Message protocol ────────────────────────────────────────────────

export type RequestMessage =
  | { kind: 'preview'; windowId: number }
  | { kind: 'organize'; windowId: number }
  | { kind: 'undo' }
  | { kind: 'suggestPairs'; windowId: number }
  | { kind: 'getSettings' }
  | { kind: 'setSettings'; patch: Partial<Settings> }
  | { kind: 'activeTab'; windowId: number }
  | { kind: 'setOverride'; windowId: number; url: string; scope: OverrideScope; category: Category }
  | { kind: 'clearOverride'; windowId: number; url: string };

export type ResponseMessage =
  | {
      kind: 'preview';
      totalTabs: number;
      counts: CategoryCount[];
      skippedUserGroupTabs: number;
    }
  | {
      kind: 'organize';
      movedTabs: number;
      createdGroups: number;
      skippedUserGroupTabs: number;
    }
  | { kind: 'undo'; ok: boolean; reason?: UndoFailureReason }
  | { kind: 'suggestPairs'; pairs: SerializedPair[] }
  | { kind: 'settings'; settings: Settings }
  | { kind: 'activeTab'; info: ActiveTabInfo | null }
  | { kind: 'overrideApplied'; key: string; affectedTabs: number; movedTabs: number }
  | { kind: 'error'; message: string };

export interface SerializedPair {
  aTitle: string;
  aUrl: string;
  bTitle: string;
  bUrl: string;
  reason: string;
  score: number;
}

// ─── Handlers ───────────────────────────────────────────────────────

async function handleSuggestPairs(windowId: number): Promise<ResponseMessage> {
  const settings = await getSettings();
  const tabs = await getTabsInWindow(windowId);
  const eligible = tabs.filter((t) => {
    if (settings.ignorePinnedTabs && t.pinned) return false;
    if (isExcludedUrl(t.url)) return false;
    if (isUserExcludedDomain(t.url ?? '', settings.userExcludedDomains)) return false;
    return true;
  });

  const pairs = suggestSplitPairs(
    eligible.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
      lastAccessed: (t as chrome.tabs.Tab & { lastAccessed?: number }).lastAccessed
    })),
    { topN: 5 }
  );

  return {
    kind: 'suggestPairs',
    pairs: pairs.map((p) => ({
      aTitle: p.a.title ?? '',
      aUrl: p.a.url ?? '',
      bTitle: p.b.title ?? '',
      bUrl: p.b.url ?? '',
      reason: p.reason,
      score: p.score
    }))
  };
}

async function route(msg: RequestMessage): Promise<ResponseMessage> {
  switch (msg.kind) {
    case 'preview': {
      const p = await previewWindow(msg.windowId);
      return { kind: 'preview', ...p };
    }
    case 'organize': {
      const r = await organizeWindow(msg.windowId);
      return { kind: 'organize', ...r };
    }
    case 'undo': {
      const r = await undoLast();
      return { kind: 'undo', ...r };
    }
    case 'suggestPairs':
      return handleSuggestPairs(msg.windowId);
    case 'getSettings':
      return { kind: 'settings', settings: await getSettings() };
    case 'setSettings':
      return { kind: 'settings', settings: await setSettings(msg.patch) };
    case 'activeTab':
      return { kind: 'activeTab', info: await describeActiveTab(msg.windowId) };
    case 'setOverride': {
      const r = await applyOverride(msg.windowId, msg.url, msg.scope, msg.category);
      return {
        kind: 'overrideApplied',
        key: r.key,
        affectedTabs: r.affectedTabs,
        movedTabs: r.movedTabs
      };
    }
    case 'clearOverride': {
      const r = await clearOverridesForUrl(msg.windowId, msg.url);
      return {
        kind: 'overrideApplied',
        key: r.key,
        affectedTabs: r.affectedTabs,
        movedTabs: r.movedTabs
      };
    }
    default:
      return { kind: 'error', message: 'Unknown message.' };
  }
}

// ─── Message router ─────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: RequestMessage, _sender, sendResponse: (r: ResponseMessage) => void) => {
    (async () => {
      try {
        sendResponse(await route(msg));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('background handler error:', e);
        sendResponse({ kind: 'error', message });
      }
    })();
    return true; // keep the message channel open for async sendResponse
  }
);

// ─── Automatic grouping ─────────────────────────────────────────────

registerAutoGroupListeners();

// ─── Keyboard commands ──────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    try {
      if (command === 'organize-now') {
        await organizeWindow(await getFallbackWindowId());
      }
      if (command === 'undo-organize') {
        await undoLast();
      }
    } catch (e) {
      console.error('command handler error:', e);
    }
  })();
});
