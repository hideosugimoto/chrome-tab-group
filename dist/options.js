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

// src/domain/domainInput.ts
var HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
function normalizeDomainInput(raw) {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const host = withoutScheme.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
  const afterCredentials = host.includes("@") ? host.split("@").pop() ?? "" : host;
  const withoutPort = afterCredentials.split(":")[0] ?? "";
  const withoutTrailingDot = withoutPort.replace(/\.+$/, "");
  if (withoutTrailingDot.length === 0) return null;
  if (!HOSTNAME.test(withoutTrailingDot)) return null;
  return withoutTrailingDot;
}
function validateNewDomain(raw, existing) {
  if (raw.trim().length === 0) return { ok: false, error: "empty" };
  const domain = normalizeDomainInput(raw);
  if (domain === null) return { ok: false, error: "invalid" };
  if (existing.some((d) => d.trim().toLowerCase() === domain)) {
    return { ok: false, error: "duplicate" };
  }
  return { ok: true, domain };
}
function withDomain(existing, domain) {
  return [.../* @__PURE__ */ new Set([...existing, domain])].sort();
}
function withoutDomain(existing, domain) {
  return existing.filter((d) => d !== domain);
}

// src/constants/categoryLabels.ts
var CATEGORY_LABEL = {
  Chat: "\u30C1\u30E3\u30C3\u30C8",
  Review: "\u30EC\u30D3\u30E5\u30FC",
  Dev: "\u958B\u767A",
  Local: "\u30ED\u30FC\u30AB\u30EB",
  Docs: "\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8",
  Research: "\u8ABF\u67FB",
  Cloud: "\u30AF\u30E9\u30A6\u30C9",
  Data: "\u30C7\u30FC\u30BF",
  Design: "\u30C7\u30B6\u30A4\u30F3",
  AI: "AI",
  Misc: "\u305D\u306E\u4ED6"
};

// src/options/text.ts
var UI = {
  categoryLabel: (category) => CATEGORY_LABEL[category],
  overrideCount: (n) => `\u4FEE\u6B63 ${n} \u4EF6\u3092\u4FDD\u5B58\u3057\u3066\u3044\u307E\u3059`,
  overrideFiltered: (shown, total) => `${total} \u4EF6\u4E2D ${shown} \u4EF6\u3092\u8868\u793A`,
  overrideUpdated: (key, category) => `${key} \u2192 ${category} \u306B\u5909\u66F4\u3057\u307E\u3057\u305F`,
  overrideRemoved: (key) => `${key} \u306E\u4FEE\u6B63\u3092\u524A\u9664\u3057\u307E\u3057\u305F`,
  overridesCleared: (n) => `${n} \u4EF6\u306E\u4FEE\u6B63\u3092\u3059\u3079\u3066\u524A\u9664\u3057\u307E\u3057\u305F`,
  confirmClearAll: (n) => `\u4FDD\u5B58\u3055\u308C\u3066\u3044\u308B\u4FEE\u6B63 ${n} \u4EF6\u3092\u3059\u3079\u3066\u524A\u9664\u3057\u307E\u3059\u3002\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F`,
  scopeSite: "\u30B5\u30A4\u30C8\u5168\u4F53",
  scopePath: "\u30D1\u30B9\u914D\u4E0B",
  domainAdded: (domain) => `${domain} \u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F`,
  domainRemoved: (domain) => `${domain} \u3092\u524A\u9664\u3057\u307E\u3057\u305F`,
  loadFailed: "\u8A2D\u5B9A\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F",
  saveFailed: "\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F",
  error: (message) => `\u30A8\u30E9\u30FC: ${message}`
};
function domainErrorText(error) {
  switch (error) {
    case "empty":
      return "\u30C9\u30E1\u30A4\u30F3\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044";
    case "invalid":
      return "\u30C9\u30E1\u30A4\u30F3\u3068\u3057\u3066\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\uFF08\u4F8B: example.com\uFF09";
    case "duplicate":
      return "\u3059\u3067\u306B\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059";
    default:
      return "\u8FFD\u52A0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F";
  }
}

// src/options/options.ts
function send(req) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(req, (resp) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr || !resp) {
        resolve({
          kind: "error",
          message: lastErr?.message ?? UI.loadFailed
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
var settings = null;
function setStatus(text) {
  $("status").textContent = text;
}
async function currentSettings() {
  const resp = await send({ kind: "getSettings" });
  if (resp.kind !== "settings") {
    setStatus(UI.error(resp.kind === "error" ? resp.message : UI.loadFailed));
    return null;
  }
  settings = resp.settings;
  return settings;
}
async function patchSettings(patch) {
  const resp = await send({ kind: "setSettings", patch });
  if (resp.kind !== "settings") {
    setStatus(UI.error(resp.kind === "error" ? resp.message : UI.saveFailed));
    return false;
  }
  settings = resp.settings;
  return true;
}
function overrideEntries() {
  return Object.entries(settings?.categoryOverrides ?? {}).sort(
    ([a], [b]) => a.localeCompare(b)
  );
}
function buildCategorySelect(key, assigned) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", `${key} \u306E\u30AB\u30C6\u30B4\u30EA`);
  for (const category of ALL_CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = UI.categoryLabel(category);
    select.appendChild(opt);
  }
  select.value = assigned;
  select.addEventListener("change", () => {
    const next = select.value;
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const merged = { ...loaded.categoryOverrides ?? {}, [key]: next };
      if (await patchSettings({ categoryOverrides: merged })) {
        setStatus(UI.overrideUpdated(key, UI.categoryLabel(next)));
        renderOverrides();
      }
    })();
  });
  return select;
}
function buildRemoveButton(key) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "link";
  btn.textContent = "\u524A\u9664";
  btn.setAttribute("aria-label", `${key} \u306E\u4FEE\u6B63\u3092\u524A\u9664`);
  btn.addEventListener("click", () => {
    void (async () => {
      const loaded = await currentSettings();
      if (!loaded) return;
      const rest = { ...loaded.categoryOverrides ?? {} };
      delete rest[key];
      if (await patchSettings({ categoryOverrides: rest })) {
        setStatus(UI.overrideRemoved(key));
        renderOverrides();
      }
    })();
  });
  return btn;
}
function buildOverrideRow(key, category) {
  const tr = document.createElement("tr");
  const keyCell = document.createElement("td");
  keyCell.className = "key";
  keyCell.textContent = key;
  const scopeCell = document.createElement("td");
  scopeCell.className = "scope";
  scopeCell.textContent = key.includes("/") ? UI.scopePath : UI.scopeSite;
  const categoryCell = document.createElement("td");
  categoryCell.appendChild(buildCategorySelect(key, category));
  const actionCell = document.createElement("td");
  actionCell.className = "actions";
  actionCell.appendChild(buildRemoveButton(key));
  tr.append(keyCell, scopeCell, categoryCell, actionCell);
  return tr;
}
function renderOverrides() {
  const filter = $("ov-filter").value.trim().toLowerCase();
  const all = overrideEntries();
  const shown = filter ? all.filter(([key]) => key.includes(filter)) : all;
  const body = $("ov-body");
  body.replaceChildren();
  for (const [key, category] of shown) body.appendChild(buildOverrideRow(key, category));
  $("ov-table").hidden = shown.length === 0;
  $("ov-empty").hidden = all.length !== 0;
  $("ov-count").textContent = filter && all.length !== shown.length ? UI.overrideFiltered(shown.length, all.length) : all.length > 0 ? UI.overrideCount(all.length) : "";
  $("ov-clear-all").hidden = all.length === 0;
  resetClearAll();
}
var clearAllArmed = false;
function resetClearAll() {
  clearAllArmed = false;
  const btn = $("ov-clear-all");
  btn.textContent = "\u3059\u3079\u3066\u524A\u9664";
}
function wireClearAll() {
  const btn = $("ov-clear-all");
  btn.addEventListener("click", () => {
    const count = overrideEntries().length;
    if (count === 0) return;
    if (!clearAllArmed) {
      clearAllArmed = true;
      btn.textContent = `\u672C\u5F53\u306B ${count} \u4EF6\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`;
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
function buildDomainChip(domain) {
  const li = document.createElement("li");
  const label = document.createElement("span");
  label.textContent = domain;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "link";
  btn.textContent = "\xD7";
  btn.setAttribute("aria-label", `${domain} \u3092\u524A\u9664`);
  btn.addEventListener("click", () => {
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
function renderExcluded() {
  const domains = [...settings?.userExcludedDomains ?? []].sort();
  const list = $("ex-list");
  list.replaceChildren();
  for (const domain of domains) list.appendChild(buildDomainChip(domain));
  $("ex-empty").hidden = domains.length !== 0;
}
function showDomainError(text) {
  const el = $("ex-error");
  el.textContent = text ?? "";
  el.hidden = text === null;
}
function wireExcludedForm() {
  const form = $("ex-form");
  const input = $("ex-input");
  input.addEventListener("input", () => showDomainError(null));
  form.addEventListener("submit", (e) => {
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
        input.value = "";
        showDomainError(null);
        setStatus(UI.domainAdded(result.domain));
        renderExcluded();
      }
    })();
  });
}
(async function main() {
  wireClearAll();
  wireExcludedForm();
  $("ov-filter").addEventListener("input", () => renderOverrides());
  const resp = await send({ kind: "getSettings" });
  if (resp.kind !== "settings") {
    setStatus(UI.error(resp.kind === "error" ? resp.message : UI.loadFailed));
    return;
  }
  settings = resp.settings;
  renderOverrides();
  renderExcluded();
})();
//# sourceMappingURL=options.js.map
