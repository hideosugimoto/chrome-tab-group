/**
 * Popup UI controller. Pure UI: it sends messages to the background
 * service worker and renders responses. No tab/group logic here.
 */
import type {
  ActiveTabInfo,
  RequestMessage,
  ResponseMessage,
  SerializedPair
} from '../background/index';
import type { Category, CategoryCount, OverrideScope, Settings } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';

/**
 * Resolve the windowId of the window the popup is anchored to.
 *
 * The popup script runs inside the window the user clicked the action
 * button in, so the active tab in that window tells us reliably which
 * window to operate on. We avoid `chrome.windows.getCurrent()` from the
 * background SW because that returns the *last focused* window which
 * may not be the popup's parent.
 */
async function resolvePopupWindowId(): Promise<number> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && typeof activeTab.windowId === 'number') return activeTab.windowId;
  // Fallback: ask windows API directly from the popup context.
  const win = await chrome.windows.getCurrent({ populate: false });
  if (typeof win.id !== 'number') {
    throw new Error('Could not resolve popup window id.');
  }
  return win.id;
}

let cachedWindowId: number | null = null;
async function getWindowId(): Promise<number> {
  if (cachedWindowId !== null) return cachedWindowId;
  cachedWindowId = await resolvePopupWindowId();
  return cachedWindowId;
}

function send(req: RequestMessage): Promise<ResponseMessage> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(req, (resp: ResponseMessage | undefined) => {
      // Surface SW unavailable / disconnected / invalid handler errors
      // instead of silently swallowing them.
      const lastErr = chrome.runtime.lastError;
      if (lastErr || !resp) {
        resolve({
          kind: 'error',
          message: lastErr?.message ?? 'No response from background service worker.'
        });
        return;
      }
      resolve(resp);
    });
  });
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}

function $select(id: string): HTMLSelectElement {
  return $(id) as HTMLSelectElement;
}

function $checkbox(id: string): HTMLInputElement {
  return $(id) as HTMLInputElement;
}

function setStatus(text: string): void {
  $('status').textContent = text;
}

// ─── Preview ────────────────────────────────────────────────────────

function renderCounts(total: number, counts: CategoryCount[], skipped: number): void {
  $('summary').textContent = `${total} tabs in current window`;
  const root = $('counts');
  root.replaceChildren();
  if (counts.length === 0) {
    const span = document.createElement('span');
    span.textContent = 'No organizable tabs';
    span.style.color = 'var(--muted)';
    span.style.fontSize = '11px';
    root.appendChild(span);
  } else {
    for (const c of counts) {
      const chip = document.createElement('span');
      chip.className = 'count-chip';
      const label = document.createElement('span');
      label.textContent = c.category;
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(c.count);
      chip.append(label, num);
      root.appendChild(chip);
    }
  }

  const note = $('skipped');
  if (skipped > 0) {
    note.textContent = `${skipped} tab(s) left alone — they are in your own groups.`;
    note.hidden = false;
  } else {
    note.hidden = true;
  }
}

function renderPairs(pairs: SerializedPair[]): void {
  const section = $('pairs');
  const list = $('pairs-list');
  list.replaceChildren();
  if (pairs.length === 0) {
    section.hidden = false;
    const li = document.createElement('li');
    li.textContent = 'No good pairs found.';
    list.appendChild(li);
    return;
  }
  for (const p of pairs) {
    const li = document.createElement('li');
    const reason = document.createElement('div');
    reason.className = 'reason';
    reason.textContent = `${p.reason} · score ${p.score}`;
    const a = document.createElement('span');
    a.className = 'pair-title';
    a.title = p.aUrl;
    a.textContent = '· ' + (p.aTitle || p.aUrl);
    const b = document.createElement('span');
    b.className = 'pair-title';
    b.title = p.bUrl;
    b.textContent = '· ' + (p.bTitle || p.bUrl);
    li.append(reason, a, b);
    list.appendChild(li);
  }
  section.hidden = false;
}

async function refreshPreview(): Promise<void> {
  const windowId = await getWindowId();
  const resp = await send({ kind: 'preview', windowId });
  if (resp.kind === 'preview') {
    renderCounts(resp.totalTabs, resp.counts, resp.skippedUserGroupTabs);
  } else if (resp.kind === 'error') {
    setStatus(`Error: ${resp.message}`);
  }
}

// ─── Current tab / overrides ────────────────────────────────────────

let currentTab: ActiveTabInfo | null = null;

function populateCategorySelect(): void {
  const select = $select('ct-category');
  select.replaceChildren();
  for (const category of ALL_CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    select.appendChild(opt);
  }
}

/** Human-readable explanation of why the tab landed in its category. */
function explainRule(info: ActiveTabInfo): string {
  const { source, ruleName } = info.classification;
  switch (source) {
    case 'override':
      return `Your correction · ${ruleName ?? ''}`;
    case 'local':
      return 'Rule: local environment';
    case 'fallback':
      return 'No rule matched — set a category to teach it.';
    default:
      return `Rule: ${ruleName ?? source}`;
  }
}

/** Why Organize would leave this particular tab alone, if it would. */
function explainExclusion(info: ActiveTabInfo): string | null {
  switch (info.exclusion) {
    case 'unsupported-url':
      return 'This tab is never organized (browser page).';
    case 'pinned':
      return 'Pinned — this tab stays put, but the rule applies to the site.';
    case 'excluded-domain':
      return 'Excluded domain — the rule applies, this tab stays put.';
    default:
      return null;
  }
}

function renderCurrentTab(info: ActiveTabInfo | null): void {
  currentTab = info;
  const categorySelect = $select('ct-category');
  const scopeSelect = $select('ct-scope');
  const resetBtn = $('ct-reset') as HTMLButtonElement;

  if (!info) {
    $('ct-title').textContent = 'No active tab';
    $('ct-reason').textContent = '';
    categorySelect.disabled = true;
    scopeSelect.disabled = true;
    resetBtn.hidden = true;
    return;
  }

  $('ct-title').textContent = info.title || info.url || '(untitled)';
  $('ct-title').title = info.url;
  categorySelect.value = info.classification.category;

  const hasPathScope = info.hostPathKey !== null;
  const pathOption = scopeSelect.querySelector<HTMLOptionElement>('option[value="hostPath"]');
  if (pathOption) {
    pathOption.disabled = !hasPathScope;
    pathOption.textContent = hasPathScope ? `This path (${info.hostPathKey})` : 'This path (n/a)';
  }
  const hostOption = scopeSelect.querySelector<HTMLOptionElement>('option[value="host"]');
  if (hostOption && info.hostKey) hostOption.textContent = `This site (${info.hostKey})`;

  // Default the scope to whichever an existing override already uses.
  if (info.activeOverrideKey !== null) {
    scopeSelect.value = info.activeOverrideKey.includes('/') ? 'hostPath' : 'host';
  }

  categorySelect.disabled = !info.correctable;
  scopeSelect.disabled = !info.correctable;
  resetBtn.hidden = info.activeOverrideKey === null;

  const exclusion = explainExclusion(info);
  $('ct-reason').textContent = !info.correctable
    ? 'This tab has no address to build a rule from.'
    : exclusion === null
      ? explainRule(info)
      : `${explainRule(info)} · ${exclusion}`;
}

async function refreshCurrentTab(): Promise<void> {
  const windowId = await getWindowId();
  const resp = await send({ kind: 'activeTab', windowId });
  if (resp.kind === 'activeTab') {
    renderCurrentTab(resp.info);
  } else if (resp.kind === 'error') {
    setStatus(`Error: ${resp.message}`);
  }
}

// ─── Settings ───────────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  const resp = await send({ kind: 'getSettings' });
  if (resp.kind !== 'settings') return;
  const s = resp.settings;
  $checkbox('set-ignore-pinned').checked = s.ignorePinnedTabs;
  $checkbox('set-keep-active').checked = s.keepActiveTabPosition;
  $checkbox('set-sort-groups').checked = s.sortGroupsByCategory;
  $checkbox('set-adopt-groups').checked = s.adoptMatchingGroups;
}

async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await send({ kind: 'setSettings', patch });
}

// ─── Wiring ─────────────────────────────────────────────────────────

function wireActions(): void {
  $('btn-organize').addEventListener('click', async () => {
    setStatus('Organizing…');
    const windowId = await getWindowId();
    const resp = await send({ kind: 'organize', windowId });
    if (resp.kind === 'organize') {
      setStatus(
        resp.movedTabs === 0
          ? 'Everything is already in place.'
          : `Grouped ${resp.movedTabs} tabs into ${resp.createdGroups} new group(s).`
      );
      await Promise.all([refreshPreview(), refreshCurrentTab()]);
    } else if (resp.kind === 'error') {
      setStatus(`Error: ${resp.message}`);
    }
  });

  $('btn-suggest').addEventListener('click', async () => {
    setStatus('Scoring pairs…');
    const windowId = await getWindowId();
    const resp = await send({ kind: 'suggestPairs', windowId });
    if (resp.kind === 'suggestPairs') {
      renderPairs(resp.pairs);
      setStatus(`${resp.pairs.length} suggestion(s).`);
    } else if (resp.kind === 'error') {
      setStatus(`Error: ${resp.message}`);
    }
  });

  $('btn-undo').addEventListener('click', async () => {
    setStatus('Undoing…');
    const resp = await send({ kind: 'undo' });
    if (resp.kind === 'undo') {
      setStatus(resp.ok ? 'Restored previous state.' : (resp.reason ?? 'Nothing to undo.'));
      await Promise.all([refreshPreview(), refreshCurrentTab()]);
    } else if (resp.kind === 'error') {
      setStatus(`Error: ${resp.message}`);
    }
  });
}

function wireCurrentTab(): void {
  $select('ct-category').addEventListener('change', async (e) => {
    if (!currentTab) return;
    const category = (e.target as HTMLSelectElement).value as Category;
    const scope = $select('ct-scope').value as OverrideScope;
    const windowId = await getWindowId();
    setStatus('Applying…');
    const resp = await send({
      kind: 'setOverride',
      windowId,
      url: currentTab.url,
      scope,
      category
    });
    if (resp.kind === 'overrideApplied') {
      setStatus(`${resp.key} → ${category} (${resp.affectedTabs} tab(s) in this window).`);
      await Promise.all([refreshPreview(), refreshCurrentTab()]);
    } else if (resp.kind === 'error') {
      setStatus(`Error: ${resp.message}`);
      await refreshCurrentTab();
    }
  });

  $('ct-reset').addEventListener('click', async () => {
    if (!currentTab) return;
    const windowId = await getWindowId();
    setStatus('Resetting…');
    const resp = await send({ kind: 'clearOverride', windowId, url: currentTab.url });
    if (resp.kind === 'overrideApplied') {
      setStatus(`Reset ${resp.key} to rule defaults.`);
      await Promise.all([refreshPreview(), refreshCurrentTab()]);
    } else if (resp.kind === 'error') {
      setStatus(`Error: ${resp.message}`);
    }
  });
}

function wireSettings(): void {
  const bind = (id: string, key: keyof Settings, reload: boolean): void => {
    $checkbox(id).addEventListener('change', async (e) => {
      await saveSettings({ [key]: (e.target as HTMLInputElement).checked });
      if (reload) await refreshPreview();
    });
  };
  bind('set-ignore-pinned', 'ignorePinnedTabs', true);
  bind('set-keep-active', 'keepActiveTabPosition', false);
  bind('set-sort-groups', 'sortGroupsByCategory', false);
  bind('set-adopt-groups', 'adoptMatchingGroups', true);
}

(async function main() {
  populateCategorySelect();
  wireActions();
  wireCurrentTab();
  wireSettings();
  await loadSettings();
  await Promise.all([refreshPreview(), refreshCurrentTab()]);
})();
