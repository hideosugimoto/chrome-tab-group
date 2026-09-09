/**
 * Options page controller.
 *
 * Pure UI, same contract as the popup: it talks to the background
 * service worker and never touches chrome.tabs or chrome.storage
 * itself. Everything it edits lives in Settings, so getSettings /
 * setSettings is the whole protocol it needs.
 *
 * Changing something here does not move any tabs — it changes how
 * they will be classified next time. The page says so in its footer.
 */

import type { RequestMessage, ResponseMessage } from '../background/index';
import type { Category, Settings } from '../types';
import { ALL_CATEGORIES } from '../constants/categories';
import { validateNewDomain, withDomain, withoutDomain } from '../domain/domainInput';
import { domainErrorText, UI } from './text';

function send(req: RequestMessage): Promise<ResponseMessage> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(req, (resp: ResponseMessage | undefined) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr || !resp) {
        resolve({
          kind: 'error',
          message: lastErr?.message ?? UI.loadFailed
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

let settings: Settings | null = null;

function setStatus(text: string): void {
  $('status').textContent = text;
}

/**
 * Read the authoritative settings before every mutation.
 *
 * Two reasons this is not just the cached copy. If the initial load
 * failed, `settings` is null and treating that as "empty" would let
 * the next edit write an empty list over the user's real one. And
 * `categoryOverrides` is patched as a whole map, so an override added
 * from the popup while this page sat open would be erased by the next
 * edit here. Re-reading costs one message and removes both.
 */
async function currentSettings(): Promise<Settings | null> {
  const resp = await send({ kind: 'getSettings' });
  if (resp.kind !== 'settings') {
    setStatus(UI.error(resp.kind === 'error' ? resp.message : UI.loadFailed));
    return null;
  }
  settings = resp.settings;
  return settings;
}

/** Push a patch and refresh the local cache from the authoritative copy. */
async function patchSettings(patch: Partial<Settings>): Promise<boolean> {
  const resp = await send({ kind: 'setSettings', patch });
  if (resp.kind !== 'settings') {
    setStatus(UI.error(resp.kind === 'error' ? resp.message : UI.saveFailed));
    return false;
  }
  settings = resp.settings;
  return true;
}

// ─── Overrides ──────────────────────────────────────────────────────

function overrideEntries(): [string, Category][] {
  return Object.entries(settings?.categoryOverrides ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );
}

function buildCategorySelect(key: string, assigned: Category): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `${key} のカテゴリ`);
  for (const category of ALL_CATEGORIES) {
    const opt = document.createElement('option');
    // Value stays the Category identifier; only the label is localized.
    opt.value = category;
    opt.textContent = UI.categoryLabel(category);
    select.appendChild(opt);
  }
  select.value = assigned;
  select.addEventListener('change', () => {
    const next = select.value as Category;
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const merged = { ...(loaded.categoryOverrides ?? {}), [key]: next };
      if (await patchSettings({ categoryOverrides: merged })) {
        setStatus(UI.overrideUpdated(key, UI.categoryLabel(next)));
        renderOverrides();
      }
    })();
  });
  return select;
}

function buildRemoveButton(key: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'link';
  btn.textContent = '削除';
  btn.setAttribute('aria-label', `${key} の修正を削除`);
  btn.addEventListener('click', () => {
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const rest = { ...(loaded.categoryOverrides ?? {}) };
      delete rest[key];
      if (await patchSettings({ categoryOverrides: rest })) {
        setStatus(UI.overrideRemoved(key));
        renderOverrides();
      }
    })();
  });
  return btn;
}

function buildOverrideRow(key: string, category: Category): HTMLTableRowElement {
  const tr = document.createElement('tr');

  const keyCell = document.createElement('td');
  keyCell.className = 'key';
  keyCell.textContent = key;

  const scopeCell = document.createElement('td');
  scopeCell.className = 'scope';
  scopeCell.textContent = key.includes('/') ? UI.scopePath : UI.scopeSite;

  const categoryCell = document.createElement('td');
  categoryCell.appendChild(buildCategorySelect(key, category));

  const actionCell = document.createElement('td');
  actionCell.className = 'actions';
  actionCell.appendChild(buildRemoveButton(key));

  tr.append(keyCell, scopeCell, categoryCell, actionCell);
  return tr;
}

function renderOverrides(): void {
  const filter = ($('ov-filter') as HTMLInputElement).value.trim().toLowerCase();
  const all = overrideEntries();
  const shown = filter ? all.filter(([key]) => key.includes(filter)) : all;

  const body = $('ov-body');
  body.replaceChildren();
  for (const [key, category] of shown) body.appendChild(buildOverrideRow(key, category));

  $('ov-table').hidden = shown.length === 0;
  $('ov-empty').hidden = all.length !== 0;
  $('ov-count').textContent =
    filter && all.length !== shown.length
      ? UI.overrideFiltered(shown.length, all.length)
      : all.length > 0
        ? UI.overrideCount(all.length)
        : '';
  ($('ov-clear-all') as HTMLButtonElement).hidden = all.length === 0;
  resetClearAll();
}

// Two-step confirmation instead of window.confirm: a modal dialog in
// an extension page blocks everything behind it for no good reason.
let clearAllArmed = false;

function resetClearAll(): void {
  clearAllArmed = false;
  const btn = $('ov-clear-all') as HTMLButtonElement;
  btn.textContent = 'すべて削除';
}

function wireClearAll(): void {
  const btn = $('ov-clear-all') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    const count = overrideEntries().length;
    if (count === 0) return;
    if (!clearAllArmed) {
      clearAllArmed = true;
      btn.textContent = `本当に ${count} 件削除しますか？`;
      return;
    }
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const total = Object.keys(loaded.categoryOverrides ?? {}).length;
      if (await patchSettings({ categoryOverrides: {} })) {
        setStatus(UI.overridesCleared(total));
        renderOverrides();
      }
    })();
  });
}

// ─── Excluded domains ───────────────────────────────────────────────

function buildDomainChip(domain: string): HTMLLIElement {
  const li = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = domain;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'link';
  btn.textContent = '×';
  btn.setAttribute('aria-label', `${domain} を削除`);
  btn.addEventListener('click', () => {
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const next = withoutDomain(loaded.userExcludedDomains, domain);
      if (await patchSettings({ userExcludedDomains: next })) {
        setStatus(UI.domainRemoved(domain));
        renderExcluded();
      }
    })();
  });

  li.append(label, btn);
  return li;
}

function renderExcluded(): void {
  const domains = [...(settings?.userExcludedDomains ?? [])].sort();
  const list = $('ex-list');
  list.replaceChildren();
  for (const domain of domains) list.appendChild(buildDomainChip(domain));
  $('ex-empty').hidden = domains.length !== 0;
}

function showDomainError(text: string | null): void {
  const el = $('ex-error');
  el.textContent = text ?? '';
  el.hidden = text === null;
}

function wireExcludedForm(): void {
  const form = $('ex-form') as HTMLFormElement;
  const input = $('ex-input') as HTMLInputElement;

  input.addEventListener('input', () => showDomainError(null));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const existing = loaded.userExcludedDomains;
      const result = validateNewDomain(input.value, existing);
      if (!result.ok) {
        showDomainError(domainErrorText(result.error));
        return;
      }
      const next = withDomain(existing, result.domain);
      if (await patchSettings({ userExcludedDomains: next })) {
        input.value = '';
        showDomainError(null);
        setStatus(UI.domainAdded(result.domain));
        renderExcluded();
      }
    })();
  });
}

// ─── Boot ───────────────────────────────────────────────────────────

(async function main() {
  wireClearAll();
  wireExcludedForm();
  $('ov-filter').addEventListener('input', () => renderOverrides());

  const resp = await send({ kind: 'getSettings' });
  if (resp.kind !== 'settings') {
    setStatus(UI.error(resp.kind === 'error' ? resp.message : UI.loadFailed));
    return;
  }
  settings = resp.settings;
  renderOverrides();
  renderExcluded();
})();
