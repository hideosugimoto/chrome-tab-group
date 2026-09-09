// src/constants/categories.ts
var CATEGORY_ORDER = [
  "Chat",
  "Review",
  "Dev",
  "Local",
  "Docs",
  "Research",
  "Cloud",
  "Data",
  "Design",
  "AI",
  "Misc"
];
var ALL_CATEGORIES = CATEGORY_ORDER;

// src/popup/text.ts
var UI = {
  loading: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026",
  noActiveTab: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30BF\u30D6\u304C\u3042\u308A\u307E\u305B\u3093",
  untitled: "(\u30BF\u30A4\u30C8\u30EB\u306A\u3057)",
  tabCount: (total) => `\u3053\u306E\u30A6\u30A3\u30F3\u30C9\u30A6\u306E\u30BF\u30D6: ${total} \u4EF6`,
  noOrganizableTabs: "\u6574\u7406\u5BFE\u8C61\u306E\u30BF\u30D6\u304C\u3042\u308A\u307E\u305B\u3093",
  skippedNote: (n) => `${n} \u4EF6\u306F\u81EA\u5206\u3067\u4F5C\u3063\u305F\u30B0\u30EB\u30FC\u30D7\u5185\u306E\u305F\u3081\u5BFE\u8C61\u5916\u3067\u3059`,
  scopeHost: (key) => `\u3053\u306E\u30B5\u30A4\u30C8\uFF08${key}\uFF09`,
  scopePath: (key) => `\u3053\u306E\u30D1\u30B9\uFF08${key}\uFF09`,
  scopePathUnavailable: "\u3053\u306E\u30D1\u30B9\uFF08\u6307\u5B9A\u4E0D\u53EF\uFF09",
  organizing: "\u6574\u7406\u4E2D\u2026",
  organizeNoop: "\u3059\u3079\u3066\u6574\u7406\u6E08\u307F\u3067\u3059",
  organizeDone: (moved, created) => `${moved} \u4EF6\u306E\u30BF\u30D6\u3092\u6574\u7406\u3057\u307E\u3057\u305F\uFF08\u65B0\u898F\u30B0\u30EB\u30FC\u30D7 ${created} \u4EF6\uFF09`,
  scoring: "\u5019\u88DC\u3092\u8A08\u7B97\u4E2D\u2026",
  suggestionCount: (n) => `\u5019\u88DC ${n} \u4EF6`,
  noPairs: "\u9069\u5207\u306A\u5019\u88DC\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F",
  pairScore: (reason, score) => `${reason} \xB7 \u30B9\u30B3\u30A2 ${score}`,
  rebuilding: "\u4F5C\u308A\u76F4\u3057\u3066\u3044\u307E\u3059\u2026",
  rebuildDone: (dissolved, moved, created) => `${dissolved} \u4EF6\u306E\u30B0\u30EB\u30FC\u30D7\u3092\u89E3\u9664\u3057\u3001${moved} \u4EF6\u306E\u30BF\u30D6\u3092 ${created} \u4EF6\u306E\u30B0\u30EB\u30FC\u30D7\u306B\u307E\u3068\u3081\u307E\u3057\u305F`,
  rebuildNothing: "\u6574\u7406\u3067\u304D\u308B\u30BF\u30D6\u304C\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F",
  undoing: "\u53D6\u308A\u6D88\u3057\u4E2D\u2026",
  undoDone: "\u6574\u7406\u524D\u306E\u72B6\u614B\u306B\u623B\u3057\u307E\u3057\u305F",
  applying: "\u9069\u7528\u4E2D\u2026",
  overrideApplied: (key, category, affected) => `${key} \u2192 ${category}\uFF08\u3053\u306E\u30A6\u30A3\u30F3\u30C9\u30A6\u306E ${affected} \u4EF6\u306B\u9069\u7528\uFF09`,
  resetting: "\u623B\u3057\u3066\u3044\u307E\u3059\u2026",
  overrideReset: (key) => `${key} \u3092\u30EB\u30FC\u30EB\u306E\u5224\u5B9A\u306B\u623B\u3057\u307E\u3057\u305F`,
  error: (message) => `\u30A8\u30E9\u30FC: ${message}`
};
function explainRule(source, ruleName) {
  switch (source) {
    case "override":
      return `\u3042\u306A\u305F\u306E\u4FEE\u6B63 \xB7 ${ruleName ?? ""}`;
    case "local":
      return "\u30EB\u30FC\u30EB: \u30ED\u30FC\u30AB\u30EB\u74B0\u5883";
    case "fallback":
      return "\u30EB\u30FC\u30EB\u672A\u4E00\u81F4 \u2014 \u30AB\u30C6\u30B4\u30EA\u3092\u9078\u3076\u3068\u8A18\u61B6\u3057\u307E\u3059";
    default:
      return `\u30EB\u30FC\u30EB: ${ruleName ?? source}`;
  }
}
function explainExclusion(exclusion) {
  switch (exclusion) {
    case "unsupported-url":
      return "\u30D6\u30E9\u30A6\u30B6\u5185\u90E8\u30DA\u30FC\u30B8\u306E\u305F\u3081\u6574\u7406\u5BFE\u8C61\u5916\u3067\u3059";
    case "pinned":
      return "\u30D4\u30F3\u7559\u3081\u4E2D\u306E\u305F\u3081\u3053\u306E\u30BF\u30D6\u306F\u52D5\u304D\u307E\u305B\u3093\uFF08\u30EB\u30FC\u30EB\u306F\u30B5\u30A4\u30C8\u306B\u9069\u7528\uFF09";
    case "excluded-domain":
      return "\u9664\u5916\u30C9\u30E1\u30A4\u30F3\u306E\u305F\u3081\u3053\u306E\u30BF\u30D6\u306F\u52D5\u304D\u307E\u305B\u3093\uFF08\u30EB\u30FC\u30EB\u306F\u9069\u7528\uFF09";
    default:
      return null;
  }
}
var NOT_CORRECTABLE = "\u30EB\u30FC\u30EB\u3092\u4F5C\u308C\u308B URL \u304C\u3042\u308A\u307E\u305B\u3093";
function undoFailure(reason) {
  switch (reason) {
    case "no-snapshot":
      return "\u53D6\u308A\u6D88\u305B\u308B\u64CD\u4F5C\u304C\u3042\u308A\u307E\u305B\u3093";
    case "tabs-gone":
      return "\u5BFE\u8C61\u306E\u30BF\u30D6\u304C\u6B8B\u3063\u3066\u3044\u306A\u3044\u305F\u3081\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093";
    default:
      return "\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3067\u3057\u305F";
  }
}
function errorText(message) {
  switch (message) {
    case "no-url":
      return "\u3053\u306E\u30BF\u30D6\u306B\u306F\u5BFE\u8C61\u3068\u306A\u308B URL \u304C\u3042\u308A\u307E\u305B\u3093";
    case "no-host-scope":
      return "\u3053\u306EURL\u306B\u306F\u30B5\u30A4\u30C8\u5358\u4F4D\u306E\u30EB\u30FC\u30EB\u3092\u4F5C\u308C\u307E\u305B\u3093";
    case "no-path-scope":
      return "\u3053\u306EURL\u306B\u306F\u30D1\u30B9\u5358\u4F4D\u306E\u30EB\u30FC\u30EB\u3092\u4F5C\u308C\u307E\u305B\u3093";
    case "nothing-to-reset":
      return "\u3053\u306EURL\u306B\u623B\u305B\u308B\u8A2D\u5B9A\u306F\u3042\u308A\u307E\u305B\u3093";
    default:
      return message;
  }
}

// src/popup/popup.ts
async function resolvePopupWindowId() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && typeof activeTab.windowId === "number") return activeTab.windowId;
  const win = await chrome.windows.getCurrent({ populate: false });
  if (typeof win.id !== "number") {
    throw new Error("Could not resolve popup window id.");
  }
  return win.id;
}
var cachedWindowId = null;
async function getWindowId() {
  if (cachedWindowId !== null) return cachedWindowId;
  cachedWindowId = await resolvePopupWindowId();
  return cachedWindowId;
}
function send(req) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(req, (resp) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr || !resp) {
        resolve({
          kind: "error",
          message: lastErr?.message ?? "No response from background service worker."
        });
        return;
      }
      resolve(resp);
    });
  });
}
function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}
function $select(id) {
  return $(id);
}
function $checkbox(id) {
  return $(id);
}
function setStatus(text) {
  $("status").textContent = text;
}
function setError(message) {
  setStatus(UI.error(errorText(message)));
}
function renderCounts(total, counts, skipped) {
  $("summary").textContent = UI.tabCount(total);
  const root = $("counts");
  root.replaceChildren();
  if (counts.length === 0) {
    const span = document.createElement("span");
    span.textContent = UI.noOrganizableTabs;
    span.style.color = "var(--muted)";
    span.style.fontSize = "11px";
    root.appendChild(span);
  } else {
    for (const c of counts) {
      const chip = document.createElement("span");
      chip.className = "count-chip";
      const label = document.createElement("span");
      label.textContent = c.category;
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(c.count);
      chip.append(label, num);
      root.appendChild(chip);
    }
  }
  const note = $("skipped");
  if (skipped > 0) {
    note.textContent = UI.skippedNote(skipped);
    note.hidden = false;
  } else {
    note.hidden = true;
  }
}
function renderPairs(pairs) {
  const section = $("pairs");
  const list = $("pairs-list");
  list.replaceChildren();
  if (pairs.length === 0) {
    section.hidden = false;
    const li = document.createElement("li");
    li.textContent = UI.noPairs;
    list.appendChild(li);
    return;
  }
  for (const p of pairs) {
    const li = document.createElement("li");
    const reason = document.createElement("div");
    reason.className = "reason";
    reason.textContent = UI.pairScore(p.reason, p.score);
    const a = document.createElement("span");
    a.className = "pair-title";
    a.title = p.aUrl;
    a.textContent = "\xB7 " + (p.aTitle || p.aUrl);
    const b = document.createElement("span");
    b.className = "pair-title";
    b.title = p.bUrl;
    b.textContent = "\xB7 " + (p.bTitle || p.bUrl);
    li.append(reason, a, b);
    list.appendChild(li);
  }
  section.hidden = false;
}
async function refreshPreview() {
  const windowId = await getWindowId();
  const resp = await send({ kind: "preview", windowId });
  if (resp.kind === "preview") {
    renderCounts(resp.totalTabs, resp.counts, resp.skippedUserGroupTabs);
  } else if (resp.kind === "error") {
    setError(resp.message);
  }
}
var currentTab = null;
function populateCategorySelect() {
  const select = $select("ct-category");
  select.replaceChildren();
  for (const category of ALL_CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    select.appendChild(opt);
  }
}
function renderCurrentTab(info) {
  currentTab = info;
  const categorySelect = $select("ct-category");
  const scopeSelect = $select("ct-scope");
  const resetBtn = $("ct-reset");
  if (!info) {
    $("ct-title").textContent = UI.noActiveTab;
    $("ct-reason").textContent = "";
    categorySelect.disabled = true;
    scopeSelect.disabled = true;
    resetBtn.hidden = true;
    return;
  }
  $("ct-title").textContent = info.title || info.url || UI.untitled;
  $("ct-title").title = info.url;
  categorySelect.value = info.classification.category;
  const hasPathScope = info.hostPathKey !== null;
  const pathOption = scopeSelect.querySelector('option[value="hostPath"]');
  if (pathOption) {
    pathOption.disabled = !hasPathScope;
    pathOption.textContent = hasPathScope ? UI.scopePath(info.hostPathKey ?? "") : UI.scopePathUnavailable;
  }
  const hostOption = scopeSelect.querySelector('option[value="host"]');
  if (hostOption && info.hostKey) hostOption.textContent = UI.scopeHost(info.hostKey);
  if (info.activeOverrideKey !== null) {
    scopeSelect.value = info.activeOverrideKey.includes("/") ? "hostPath" : "host";
  }
  categorySelect.disabled = !info.correctable;
  scopeSelect.disabled = !info.correctable;
  resetBtn.hidden = info.activeOverrideKey === null;
  const rule = explainRule(info.classification.source, info.classification.ruleName);
  const exclusion = explainExclusion(info.exclusion);
  $("ct-reason").textContent = !info.correctable ? NOT_CORRECTABLE : exclusion === null ? rule : `${rule} \xB7 ${exclusion}`;
}
async function refreshAll() {
  await Promise.all([refreshPreview(), refreshCurrentTab()]);
}
async function refreshCurrentTab() {
  const windowId = await getWindowId();
  const resp = await send({ kind: "activeTab", windowId });
  if (resp.kind === "activeTab") {
    renderCurrentTab(resp.info);
  } else if (resp.kind === "error") {
    setError(resp.message);
  }
}
async function loadSettings() {
  const resp = await send({ kind: "getSettings" });
  if (resp.kind !== "settings") return;
  const s = resp.settings;
  $checkbox("set-auto-group").checked = s.autoGroupEnabled;
  $checkbox("set-ignore-pinned").checked = s.ignorePinnedTabs;
  $checkbox("set-keep-active").checked = s.keepActiveTabPosition;
  $checkbox("set-sort-groups").checked = s.sortGroupsByCategory;
  $checkbox("set-adopt-groups").checked = s.adoptMatchingGroups;
}
async function saveSettings(patch) {
  await send({ kind: "setSettings", patch });
}
function wireOrganize() {
  $("btn-organize").addEventListener("click", async () => {
    setStatus(UI.organizing);
    const windowId = await getWindowId();
    const resp = await send({ kind: "organize", windowId });
    if (resp.kind === "organize") {
      setStatus(
        resp.movedTabs === 0 ? UI.organizeNoop : UI.organizeDone(resp.movedTabs, resp.createdGroups)
      );
      await refreshAll();
    } else if (resp.kind === "error") {
      setError(resp.message);
    }
  });
}
function wireRebuild() {
  $("btn-rebuild").addEventListener("click", async () => {
    setStatus(UI.rebuilding);
    const windowId = await getWindowId();
    const resp = await send({ kind: "rebuild", windowId });
    if (resp.kind === "rebuild") {
      setStatus(
        resp.dissolvedGroups === 0 && resp.movedTabs === 0 ? UI.rebuildNothing : UI.rebuildDone(resp.dissolvedGroups, resp.movedTabs, resp.createdGroups)
      );
      await refreshAll();
    } else if (resp.kind === "error") {
      setError(resp.message);
    }
  });
}
function wireSuggest() {
  $("btn-suggest").addEventListener("click", async () => {
    setStatus(UI.scoring);
    const windowId = await getWindowId();
    const resp = await send({ kind: "suggestPairs", windowId });
    if (resp.kind === "suggestPairs") {
      renderPairs(resp.pairs);
      setStatus(UI.suggestionCount(resp.pairs.length));
    } else if (resp.kind === "error") {
      setError(resp.message);
    }
  });
}
function wireUndo() {
  $("btn-undo").addEventListener("click", async () => {
    setStatus(UI.undoing);
    const resp = await send({ kind: "undo" });
    if (resp.kind === "undo") {
      setStatus(resp.ok ? UI.undoDone : undoFailure(resp.reason));
      await refreshAll();
    } else if (resp.kind === "error") {
      setError(resp.message);
    }
  });
}
function wireCurrentTab() {
  $select("ct-category").addEventListener("change", async (e) => {
    if (!currentTab) return;
    const category = e.target.value;
    const scope = $select("ct-scope").value;
    const windowId = await getWindowId();
    setStatus(UI.applying);
    const resp = await send({
      kind: "setOverride",
      windowId,
      url: currentTab.url,
      scope,
      category
    });
    if (resp.kind === "overrideApplied") {
      setStatus(UI.overrideApplied(resp.key, category, resp.affectedTabs));
      await refreshAll();
    } else if (resp.kind === "error") {
      setError(resp.message);
      await refreshCurrentTab();
    }
  });
  $("ct-reset").addEventListener("click", async () => {
    if (!currentTab) return;
    const windowId = await getWindowId();
    setStatus(UI.resetting);
    const resp = await send({ kind: "clearOverride", windowId, url: currentTab.url });
    if (resp.kind === "overrideApplied") {
      setStatus(UI.overrideReset(resp.key));
      await refreshAll();
    } else if (resp.kind === "error") {
      setError(resp.message);
    }
  });
}
function wireSettings() {
  const bind = (id, key, reload) => {
    $checkbox(id).addEventListener("change", async (e) => {
      await saveSettings({ [key]: e.target.checked });
      if (reload) await refreshPreview();
    });
  };
  $("btn-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  bind("set-auto-group", "autoGroupEnabled", false);
  bind("set-ignore-pinned", "ignorePinnedTabs", true);
  bind("set-keep-active", "keepActiveTabPosition", false);
  bind("set-sort-groups", "sortGroupsByCategory", false);
  bind("set-adopt-groups", "adoptMatchingGroups", true);
}
(async function main() {
  populateCategorySelect();
  wireOrganize();
  wireRebuild();
  wireSuggest();
  wireUndo();
  wireCurrentTab();
  wireSettings();
  await loadSettings();
  await refreshAll();
})();
//# sourceMappingURL=popup.js.map
