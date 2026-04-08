// src/popup/popup.ts
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
function setStatus(text) {
  $("status").textContent = text;
}
function renderCounts(total, counts) {
  $("summary").textContent = `${total} tabs in current window`;
  const root = $("counts");
  root.replaceChildren();
  if (counts.length === 0) {
    const span = document.createElement("span");
    span.textContent = "No organizable tabs";
    span.style.color = "var(--muted)";
    span.style.fontSize = "11px";
    root.appendChild(span);
    return;
  }
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
function renderPairs(pairs) {
  const section = $("pairs");
  const list = $("pairs-list");
  list.replaceChildren();
  if (pairs.length === 0) {
    section.hidden = false;
    const li = document.createElement("li");
    li.textContent = "No good pairs found.";
    list.appendChild(li);
    return;
  }
  for (const p of pairs) {
    const li = document.createElement("li");
    const reason = document.createElement("div");
    reason.className = "reason";
    reason.textContent = `${p.reason} \xB7 score ${p.score}`;
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
  const resp = await send({ kind: "preview" });
  if (resp.kind === "preview") {
    renderCounts(resp.totalTabs, resp.counts);
  } else if (resp.kind === "error") {
    setStatus(`Error: ${resp.message}`);
  }
}
async function loadSettings() {
  const resp = await send({ kind: "getSettings" });
  if (resp.kind !== "settings") return;
  const s = resp.settings;
  $("set-ignore-pinned").checked = s.ignorePinnedTabs;
  $("set-keep-active").checked = s.keepActiveTabPosition;
}
async function saveSettings(patch) {
  await send({ kind: "setSettings", patch });
}
function wireEvents() {
  $("btn-organize").addEventListener("click", async () => {
    setStatus("Organizing\u2026");
    const resp = await send({ kind: "organize" });
    if (resp.kind === "organize") {
      setStatus(`Grouped ${resp.movedTabs} tabs into ${resp.createdGroups} groups.`);
      await refreshPreview();
    } else if (resp.kind === "error") {
      setStatus(`Error: ${resp.message}`);
    }
  });
  $("btn-suggest").addEventListener("click", async () => {
    setStatus("Scoring pairs\u2026");
    const resp = await send({ kind: "suggestPairs" });
    if (resp.kind === "suggestPairs") {
      renderPairs(resp.pairs);
      setStatus(`${resp.pairs.length} suggestion(s).`);
    } else if (resp.kind === "error") {
      setStatus(`Error: ${resp.message}`);
    }
  });
  $("btn-undo").addEventListener("click", async () => {
    setStatus("Undoing\u2026");
    const resp = await send({ kind: "undo" });
    if (resp.kind === "undo") {
      setStatus(resp.ok ? "Restored previous state." : resp.reason ?? "Nothing to undo.");
      await refreshPreview();
    } else if (resp.kind === "error") {
      setStatus(`Error: ${resp.message}`);
    }
  });
  $("set-ignore-pinned").addEventListener("change", async (e) => {
    await saveSettings({ ignorePinnedTabs: e.target.checked });
    await refreshPreview();
  });
  $("set-keep-active").addEventListener("change", async (e) => {
    await saveSettings({ keepActiveTabPosition: e.target.checked });
  });
}
(async function main() {
  wireEvents();
  await loadSettings();
  await refreshPreview();
})();
//# sourceMappingURL=popup.js.map
