/**
 * Automatic grouping.
 *
 * Absorbs stray tabs into groups that already exist. It never creates
 * a group, never touches a group the user made, and never moves the
 * tab you are currently looking at.
 *
 * What it is actually for: Chrome already adds a link opened from
 * inside a group to that same group, so the tabs that need help are
 * the ones arriving from outside — Slack, mail, the terminal, the new
 * tab page. Those land ungrouped, or land in whichever group the
 * opener happened to be in (a GitHub PR opened from Slack lands in
 * Chat), and this pass moves them where they belong.
 *
 * Three rules keep it quiet:
 *   - Only tabs that are ungrouped or in a group we own are eligible.
 *   - The active tab is deferred until you switch away from it, so a
 *     tab never jumps out from under the cursor.
 *   - No new groups. If the right group does not exist yet, the tab
 *     is left exactly where it is.
 *
 * Automatic runs deliberately do not write the undo snapshot — "undo
 * the last organize" must keep pointing at the user's own last
 * action, not at a tab that opened in the background.
 */

import { isAutoGroupTrigger, type TabChangeInfo } from '../domain/autoGroupTrigger';
import { getSettings } from '../storage/store';
import {
  addPendingTabIds,
  getPendingTabIds,
  removePendingTabIds
} from '../storage/pendingAutoGroup';
import { organizeWindow } from './organize';

/** Collect rapid bursts (a folder of bookmarks, a batch of links). */
const DEBOUNCE_MS = 700;

let flushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush(): void {
  if (flushTimer !== undefined) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushPending();
  }, DEBOUNCE_MS);
}

/**
 * Resolve queued tab IDs to live tabs, dropping the ones that are
 * gone and deferring the ones that are currently active.
 */
async function partitionPending(
  tabIds: readonly number[]
): Promise<{ ready: chrome.tabs.Tab[]; gone: number[] }> {
  const ready: chrome.tabs.Tab[] = [];
  const gone: number[] = [];

  for (const tabId of tabIds) {
    let tab: chrome.tabs.Tab | undefined;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      gone.push(tabId); // closed between queueing and flushing
      continue;
    }
    // Leave the focused tab queued; onActivated will bring it back.
    if (tab.active) continue;
    ready.push(tab);
  }

  return { ready, gone };
}

async function flushPending(): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoGroupEnabled) return;

  const pending = await getPendingTabIds();
  if (pending.length === 0) return;

  const { ready, gone } = await partitionPending(pending);
  await removePendingTabIds(gone);
  if (ready.length === 0) return;

  // Group by window: organizeWindow works one window at a time.
  const byWindow = new Map<number, number[]>();
  for (const tab of ready) {
    if (typeof tab.id !== 'number') continue;
    const arr = byWindow.get(tab.windowId);
    if (arr) arr.push(tab.id);
    else byWindow.set(tab.windowId, [tab.id]);
  }

  for (const [windowId, tabIds] of byWindow) {
    try {
      await organizeWindow(windowId, {
        restrictToTabIds: new Set(tabIds),
        assignOnly: true,
        skipSnapshot: true,
        skipSort: true
      });
    } catch (e) {
      console.warn('auto-group pass failed for window', windowId, e);
    } finally {
      // Clear regardless: a tab that could not be placed this time
      // should not be retried forever.
      await removePendingTabIds(tabIds);
    }
  }
}

/** Wire the listeners. Call once from the service worker top level. */
export function registerAutoGroupListeners(): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo: TabChangeInfo, tab) => {
    if (!isAutoGroupTrigger(changeInfo, tab.url)) return;
    void (async () => {
      try {
        const settings = await getSettings();
        if (!settings.autoGroupEnabled) return;
        await addPendingTabIds([tabId]);
        scheduleFlush();
      } catch (e) {
        console.warn('auto-group queueing failed:', e);
      }
    })();
  });

  // Switching away from a tab releases it from the "don't move the
  // tab under the cursor" hold.
  chrome.tabs.onActivated.addListener(() => {
    void (async () => {
      try {
        const settings = await getSettings();
        if (!settings.autoGroupEnabled) return;
        if ((await getPendingTabIds()).length === 0) return;
        scheduleFlush();
      } catch (e) {
        console.warn('auto-group activation check failed:', e);
      }
    })();
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void removePendingTabIds([tabId]).catch(() => {
      // best-effort; a stale ID is dropped at the next flush anyway
    });
  });
}
