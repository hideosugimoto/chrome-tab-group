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

// src/storage/store.ts
var KEY_SETTINGS = "settings.v1";
var KEY_UNDO = "lastSnapshotForUndo.v1";
var DEFAULT_SETTINGS = {
  ignorePinnedTabs: true,
  keepActiveTabPosition: true,
  userExcludedDomains: [],
  sortGroupsByCategory: true,
  adoptMatchingGroups: true
};
async function getSettings() {
  const obj = await chrome.storage.local.get(KEY_SETTINGS);
  const stored = obj[KEY_SETTINGS];
  return normalizeSettings(stored);
}
var CATEGORY_SET = new Set(ALL_CATEGORIES);
function normalizeOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && CATEGORY_SET.has(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeSettings(stored) {
  const s = stored ?? {};
  return {
    ignorePinnedTabs: bool(s.ignorePinnedTabs, DEFAULT_SETTINGS.ignorePinnedTabs),
    keepActiveTabPosition: bool(s.keepActiveTabPosition, DEFAULT_SETTINGS.keepActiveTabPosition),
    userExcludedDomains: Array.isArray(s.userExcludedDomains) ? s.userExcludedDomains.filter((d) => typeof d === "string") : DEFAULT_SETTINGS.userExcludedDomains,
    sortGroupsByCategory: bool(s.sortGroupsByCategory, DEFAULT_SETTINGS.sortGroupsByCategory),
    adoptMatchingGroups: bool(s.adoptMatchingGroups, DEFAULT_SETTINGS.adoptMatchingGroups),
    categoryOverrides: normalizeOverrides(s.categoryOverrides),
    customRules: Array.isArray(s.customRules) ? s.customRules : void 0,
    splitPairHistory: Array.isArray(s.splitPairHistory) ? s.splitPairHistory : void 0
  };
}
async function setSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: merged });
  return normalizeSettings(merged);
}
async function getUndoSnapshot() {
  const obj = await chrome.storage.local.get(KEY_UNDO);
  return obj[KEY_UNDO] ?? null;
}
async function setUndoSnapshot(snap) {
  if (snap === null) {
    await chrome.storage.local.remove(KEY_UNDO);
    return;
  }
  await chrome.storage.local.set({ [KEY_UNDO]: snap });
}

// src/services/tabsService.ts
async function getWindowOrdinal(windowId) {
  const wins = await chrome.windows.getAll({ windowTypes: ["normal"] });
  if (wins.length <= 1) return null;
  const sorted = wins.filter((w) => typeof w.id === "number").sort((a, b) => a.id - b.id);
  const idx = sorted.findIndex((w) => w.id === windowId);
  return idx === -1 ? null : idx + 1;
}
async function getFallbackWindowId() {
  const win = await chrome.windows.getLastFocused({
    populate: false,
    windowTypes: ["normal"]
  });
  if (typeof win.id !== "number") {
    throw new Error("No focused window available.");
  }
  return win.id;
}
async function getTabsInWindow(windowId) {
  return chrome.tabs.query({ windowId });
}
async function getActiveTabInWindow(windowId) {
  const [tab] = await chrome.tabs.query({ windowId, active: true });
  return tab;
}
async function moveSingleTab(tabId, index) {
  await chrome.tabs.move(tabId, { index });
}
async function ungroupTabs(tabIds) {
  if (tabIds.length === 0) return;
  await chrome.tabs.ungroup(tabIds);
}

// src/utils/url.ts
function parseUrl(raw) {
  try {
    const u = new URL(raw);
    return {
      ok: true,
      protocol: u.protocol,
      hostname: u.hostname.toLowerCase(),
      pathname: u.pathname,
      search: u.search,
      full: u.toString()
    };
  } catch {
    return { ok: false, protocol: "", hostname: "", pathname: "", search: "", full: raw ?? "" };
  }
}
function rootDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

// src/domain/exclusion.ts
var SPECIAL_PROTOCOLS = /* @__PURE__ */ new Set([
  "chrome:",
  "chrome-extension:",
  "devtools:",
  "edge:",
  "about:",
  "view-source:",
  "file:"
]);
function isExcludedUrl(rawUrl) {
  if (!rawUrl) return true;
  const p = parseUrl(rawUrl);
  if (!p.ok) return true;
  if (SPECIAL_PROTOCOLS.has(p.protocol)) return true;
  return false;
}
function isUserExcludedDomain(rawUrl, excludedDomains) {
  if (!excludedDomains.length) return false;
  const p = parseUrl(rawUrl);
  if (!p.ok) return false;
  return excludedDomains.some((d) => {
    const norm = d.trim().toLowerCase();
    if (!norm) return false;
    return p.hostname === norm || p.hostname.endsWith("." + norm);
  });
}

// src/utils/text.ts
function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length >= 2);
}
function jaccard(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

// src/rules/localPatterns.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
var HOST_ENV_KEYWORDS = [
  "localhost",
  "staging",
  "stage",
  "stg",
  "qa",
  "uat",
  "preview",
  "sandbox",
  "preprod",
  "pre-prod"
];
var PATH_ENV_KEYWORDS = [...HOST_ENV_KEYWORDS, "dev", "develop", "test"];
var HOST_ENV_RE = new RegExp(
  "(^|[.\\-/_])(" + HOST_ENV_KEYWORDS.join("|") + ")([.\\-/_]|$)",
  "i"
);
var PATH_ENV_RE = new RegExp(
  "(^|[.\\-/_])(" + PATH_ENV_KEYWORDS.join("|") + ")([.\\-/_]|$)",
  "i"
);
function isLocalUrl(rawUrl) {
  const p = parseUrl(rawUrl);
  if (!p.ok) return false;
  if (LOCAL_HOSTS.has(p.hostname)) return true;
  if (p.hostname.endsWith(".local")) return true;
  if (p.hostname.endsWith(".localhost")) return true;
  if (/^10\./.test(p.hostname)) return true;
  if (/^192\.168\./.test(p.hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(p.hostname)) return true;
  if (HOST_ENV_RE.test(p.hostname)) return true;
  if (PATH_ENV_RE.test(p.pathname)) return true;
  return false;
}

// src/rules/domainRules.ts
var DOMAIN_RULES = [
  // ─── Review (path-qualified GitHub/GitLab/Bitbucket) ──────────────
  { name: "github-pr", hostMatch: /(^|\.)github\.com$/, pathInclude: /\/pulls?(\/|$)/, category: "Review" },
  { name: "github-issues", hostMatch: /(^|\.)github\.com$/, pathInclude: /\/issues(\/|$)/, category: "Review" },
  { name: "github-actions", hostMatch: /(^|\.)github\.com$/, pathInclude: /\/actions(\/|$)/, category: "Cloud" },
  { name: "github-projects", hostMatch: /(^|\.)github\.com$/, pathInclude: /\/projects(\/|$)/, category: "Review" },
  // GitLab
  { name: "gitlab-mr", hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/merge_requests(\/|$)/, category: "Review" },
  { name: "gitlab-issues", hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/issues(\/|$)/, category: "Review" },
  { name: "gitlab-pipelines", hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/pipelines(\/|$)/, category: "Cloud" },
  { name: "gitlab-jobs", hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/jobs(\/|$)/, category: "Cloud" },
  // Bitbucket
  { name: "bitbucket-pr", hostMatch: /(^|\.)bitbucket\.org$/, pathInclude: /\/pull-requests(\/|$)/, category: "Review" },
  { name: "bitbucket-pipelines", hostMatch: /(^|\.)bitbucket\.org$/, pathInclude: /\/addon\/pipelines/, category: "Cloud" },
  // ─── Review: ticket / project mgmt ────────────────────────────────
  { name: "jira", hostMatch: /\.atlassian\.net$/, pathInclude: /\/(jira|browse|projects|servicedesk)/, category: "Review" },
  { name: "jira-bare", hostMatch: /\.atlassian\.net$/, category: "Review" },
  { name: "backlog", hostMatch: /\.backlog\.(com|jp)$/, category: "Review" },
  { name: "trello", hostMatch: /(^|\.)trello\.com$/, category: "Review" },
  { name: "asana", hostMatch: /(^|\.)asana\.com$/, category: "Review" },
  { name: "monday", hostMatch: /(^|\.)monday\.com$/, category: "Review" },
  { name: "clickup", hostMatch: /(^|\.)clickup\.com$/, category: "Review" },
  { name: "linear", hostMatch: /(^|\.)linear\.app$/, category: "Review" },
  { name: "redmine", hostMatch: /(^|\.)redmine\.org$/, category: "Review" },
  { name: "youtrack", hostMatch: /\.youtrack\.cloud$/, category: "Review" },
  { name: "azure-boards", hostMatch: /(^|\.)dev\.azure\.com$/, pathInclude: /\/_(boards|workitems|backlogs)/, category: "Review" },
  { name: "azure-pipelines", hostMatch: /(^|\.)dev\.azure\.com$/, pathInclude: /\/_(build|release|pipelines)/, category: "Cloud" },
  // ─── Chat ─────────────────────────────────────────────────────────
  { name: "slack", hostMatch: /(^|\.)slack\.com$/, category: "Chat" },
  { name: "teams", hostMatch: /(^|\.)teams\.(microsoft|live)\.com$/, category: "Chat" },
  { name: "chatwork", hostMatch: /(^|\.)chatwork\.com$/, category: "Chat" },
  { name: "gmail", hostMatch: /(^|\.)mail\.google\.com$/, category: "Chat" },
  { name: "gchat", hostMatch: /(^|\.)chat\.google\.com$/, category: "Chat" },
  { name: "outlook", hostMatch: /(^|\.)outlook\.(office|live|office365)\.com$/, category: "Chat" },
  { name: "discord", hostMatch: /(^|\.)discord\.com$/, category: "Chat" },
  { name: "zoom", hostMatch: /(^|\.)zoom\.(us|com)$/, category: "Chat" },
  { name: "gmeet", hostMatch: /(^|\.)meet\.google\.com$/, category: "Chat" },
  { name: "webex", hostMatch: /(^|\.)webex\.com$/, category: "Chat" },
  { name: "lineworks", hostMatch: /(^|\.)worksmobile\.com$/, category: "Chat" },
  { name: "mattermost", hostMatch: /(^|\.)mattermost\.com$/, category: "Chat" },
  { name: "messenger", hostMatch: /(^|\.)messenger\.com$/, category: "Chat" },
  // ─── Data: docs.google.com sub-products (must come before Docs) ───
  { name: "gsheet", hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/spreadsheets\//, category: "Data" },
  // ─── Docs: docs.google.com docs/presentation/forms + drive ────────
  { name: "gdoc", hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/document\//, category: "Docs" },
  { name: "gslide", hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/presentation\//, category: "Docs" },
  { name: "gform", hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/forms\//, category: "Docs" },
  { name: "gdrive", hostMatch: /(^|\.)drive\.google\.com$/, category: "Docs" },
  { name: "gsites", hostMatch: /(^|\.)sites\.google\.com$/, category: "Docs" },
  { name: "notion", hostMatch: /(^|\.)notion\.(so|site)$/, category: "Docs" },
  { name: "confluence", hostMatch: /\.atlassian\.net$/, pathInclude: /\/wiki(\/|$)/, category: "Docs" },
  // SharePoint: split by path keywords.
  { name: "sharepoint-review", hostMatch: /\.sharepoint\.com$/, pathInclude: /\/(approval|approvals|task|tasks|review|form|forms)(\/|$)/i, category: "Review" },
  { name: "sharepoint-docs", hostMatch: /\.sharepoint\.com$/, category: "Docs" },
  { name: "onedrive", hostMatch: /(^|\.)onedrive\.live\.com$/, category: "Docs" },
  { name: "dropbox-paper", hostMatch: /(^|\.)paper\.dropbox\.com$/, category: "Docs" },
  { name: "dropbox", hostMatch: /(^|\.)dropbox\.com$/, category: "Docs" },
  { name: "box", hostMatch: /(^|\.)box\.com$/, category: "Docs" },
  { name: "coda", hostMatch: /(^|\.)coda\.io$/, category: "Docs" },
  { name: "scrapbox", hostMatch: /(^|\.)scrapbox\.io$/, category: "Docs" },
  { name: "esa", hostMatch: /(^|\.)esa\.io$/, category: "Docs" },
  { name: "kibela", hostMatch: /(^|\.)kibe\.la$/, category: "Docs" },
  { name: "qiita-team", hostMatch: /\.qiita\.com$/, pathInclude: /\/teams(\/|$)/, category: "Docs" },
  // ─── Research ─────────────────────────────────────────────────────
  { name: "stackoverflow", hostMatch: /(^|\.)stackoverflow\.com$/, category: "Research" },
  { name: "stackexchange", hostMatch: /\.stackexchange\.com$/, category: "Research" },
  { name: "mdn", hostMatch: /(^|\.)developer\.mozilla\.org$/, category: "Research" },
  { name: "devchrome", hostMatch: /(^|\.)developer\.chrome\.com$/, category: "Research" },
  { name: "devdocs", hostMatch: /(^|\.)devdocs\.io$/, category: "Research" },
  { name: "qiita", hostMatch: /(^|\.)qiita\.com$/, category: "Research" },
  { name: "zenn", hostMatch: /(^|\.)zenn\.dev$/, category: "Research" },
  { name: "medium", hostMatch: /(^|\.)medium\.com$/, category: "Research" },
  { name: "hn", hostMatch: /(^|\.)news\.ycombinator\.com$/, category: "Research" },
  { name: "reddit-prog", hostMatch: /(^|\.)reddit\.com$/, pathInclude: /\/r\/(programming|webdev|javascript|typescript|reactjs|node|golang|rust|python|devops|sre|kubernetes)/i, category: "Research" },
  { name: "laravel-docs", hostMatch: /(^|\.)laravel\.com$/, pathInclude: /\/docs/, category: "Research" },
  { name: "react-docs", hostMatch: /(^|\.)(react\.dev|reactjs\.org)$/, category: "Research" },
  { name: "vue-docs", hostMatch: /(^|\.)vuejs\.org$/, category: "Research" },
  { name: "next-docs", hostMatch: /(^|\.)nextjs\.org$/, category: "Research" },
  { name: "nuxt-docs", hostMatch: /(^|\.)nuxt\.com$/, category: "Research" },
  { name: "node-docs", hostMatch: /(^|\.)nodejs\.org$/, category: "Research" },
  { name: "python-docs", hostMatch: /(^|\.)docs\.python\.org$/, category: "Research" },
  { name: "php-docs", hostMatch: /(^|\.)php\.net$/, category: "Research" },
  { name: "docker-docs", hostMatch: /(^|\.)docs\.docker\.com$/, category: "Research" },
  { name: "k8s-docs", hostMatch: /(^|\.)kubernetes\.io$/, category: "Research" },
  { name: "aws-docs", hostMatch: /(^|\.)docs\.aws\.amazon\.com$/, category: "Research" },
  { name: "gcp-docs", hostMatch: /(^|\.)cloud\.google\.com$/, pathInclude: /\/docs(\/|$)/, category: "Research" },
  { name: "azure-docs", hostMatch: /(^|\.)learn\.microsoft\.com$/, category: "Research" },
  // ─── Cloud ────────────────────────────────────────────────────────
  { name: "aws-console", hostMatch: /(^|\.)console\.aws\.amazon\.com$/, category: "Cloud" },
  { name: "aws-signin", hostMatch: /(^|\.)signin\.aws\.amazon\.com$/, category: "Cloud" },
  { name: "gcp-console", hostMatch: /(^|\.)console\.cloud\.google\.com$/, category: "Cloud" },
  { name: "azure-portal", hostMatch: /(^|\.)portal\.azure\.com$/, category: "Cloud" },
  { name: "cloudflare", hostMatch: /(^|\.)(dash\.)?cloudflare\.com$/, category: "Cloud" },
  { name: "vercel", hostMatch: /(^|\.)vercel\.com$/, category: "Cloud" },
  { name: "netlify", hostMatch: /(^|\.)(app\.)?netlify\.(com|app)$/, category: "Cloud" },
  { name: "render", hostMatch: /(^|\.)dashboard\.render\.com$/, category: "Cloud" },
  { name: "railway", hostMatch: /(^|\.)railway\.app$/, category: "Cloud" },
  { name: "heroku", hostMatch: /(^|\.)dashboard\.heroku\.com$/, category: "Cloud" },
  { name: "firebase", hostMatch: /(^|\.)console\.firebase\.google\.com$/, category: "Cloud" },
  { name: "supabase", hostMatch: /(^|\.)supabase\.com$/, pathInclude: /\/dashboard/, category: "Cloud" },
  { name: "planetscale", hostMatch: /(^|\.)planetscale\.com$/, category: "Cloud" },
  { name: "mongo-atlas", hostMatch: /(^|\.)cloud\.mongodb\.com$/, category: "Cloud" },
  { name: "datadog", hostMatch: /\.datadoghq\.(com|eu)$/, category: "Cloud" },
  { name: "newrelic", hostMatch: /(^|\.)newrelic\.com$/, category: "Cloud" },
  { name: "grafana-cloud", hostMatch: /\.grafana\.net$/, category: "Cloud" },
  { name: "grafana-host", hostMatch: /(^|\.)grafana\.com$/, category: "Cloud" },
  { name: "sentry", hostMatch: /(^|\.)sentry\.io$/, category: "Cloud" },
  { name: "kibana-elastic", hostMatch: /\.elastic-cloud\.com$/, category: "Cloud" },
  { name: "elastic", hostMatch: /(^|\.)cloud\.elastic\.co$/, category: "Cloud" },
  { name: "circleci", hostMatch: /(^|\.)(app\.)?circleci\.com$/, category: "Cloud" },
  { name: "travis", hostMatch: /(^|\.)travis-ci\.(com|org)$/, category: "Cloud" },
  { name: "argocd", hostMatch: /(^|\.)argoproj\.github\.io$/, category: "Cloud" },
  // ─── Data ─────────────────────────────────────────────────────────
  { name: "sheets-bare", hostMatch: /(^|\.)sheets\.google\.com$/, category: "Data" },
  { name: "excel-online", hostMatch: /(^|\.)office\.com$/, pathInclude: /\/excel/, category: "Data" },
  { name: "airtable", hostMatch: /(^|\.)airtable\.com$/, category: "Data" },
  { name: "bigquery", hostMatch: /(^|\.)console\.cloud\.google\.com$/, pathInclude: /\/bigquery/, category: "Data" },
  { name: "looker-studio", hostMatch: /(^|\.)lookerstudio\.google\.com$/, category: "Data" },
  { name: "looker", hostMatch: /(^|\.)looker\.com$/, category: "Data" },
  { name: "tableau", hostMatch: /(^|\.)(online\.)?tableau\.com$/, category: "Data" },
  { name: "redash", hostMatch: /(^|\.)redash\.io$/, category: "Data" },
  { name: "metabase", hostMatch: /(^|\.)metabase\.com$/, category: "Data" },
  { name: "superset", hostMatch: /(^|\.)superset\.apache\.org$/, category: "Data" },
  // ─── Design ───────────────────────────────────────────────────────
  { name: "figma", hostMatch: /(^|\.)figma\.com$/, category: "Design" },
  { name: "figjam", hostMatch: /(^|\.)figjam\.com$/, category: "Design" },
  { name: "miro", hostMatch: /(^|\.)miro\.com$/, category: "Design" },
  { name: "excalidraw", hostMatch: /(^|\.)excalidraw\.com$/, category: "Design" },
  { name: "canva", hostMatch: /(^|\.)canva\.com$/, category: "Design" },
  { name: "whimsical", hostMatch: /(^|\.)whimsical\.com$/, category: "Design" },
  { name: "lucid", hostMatch: /(^|\.)lucid\.(app|chart)$/, category: "Design" },
  { name: "drawio", hostMatch: /(^|\.)(app\.diagrams\.net|draw\.io|diagrams\.net)$/, category: "Design" },
  // ─── AI ───────────────────────────────────────────────────────────
  { name: "chatgpt", hostMatch: /(^|\.)chatgpt\.com$/, category: "AI" },
  { name: "openai-chat", hostMatch: /(^|\.)chat\.openai\.com$/, category: "AI" },
  { name: "claude", hostMatch: /(^|\.)claude\.(ai|com)$/, category: "AI" },
  { name: "gemini", hostMatch: /(^|\.)gemini\.google\.com$/, category: "AI" },
  { name: "perplexity", hostMatch: /(^|\.)perplexity\.ai$/, category: "AI" },
  { name: "openai-platform", hostMatch: /(^|\.)platform\.openai\.com$/, category: "AI" },
  { name: "anthropic-console", hostMatch: /(^|\.)console\.anthropic\.com$/, category: "AI" },
  { name: "aistudio", hostMatch: /(^|\.)aistudio\.google\.com$/, category: "AI" },
  { name: "azure-openai", hostMatch: /(^|\.)oai\.azure\.com$/, category: "AI" },
  { name: "poe", hostMatch: /(^|\.)poe\.com$/, category: "AI" },
  { name: "notebooklm", hostMatch: /(^|\.)notebooklm\.google\.com$/, category: "AI" },
  { name: "huggingface", hostMatch: /(^|\.)huggingface\.co$/, category: "AI" },
  { name: "langsmith", hostMatch: /(^|\.)smith\.langchain\.com$/, category: "AI" },
  // ─── Dev (last among the named services so qualifiers above win) ──
  { name: "github-bare", hostMatch: /(^|\.)github\.com$/, category: "Dev" },
  { name: "gitlab-bare", hostMatch: /(^|\.)gitlab\.com$/, category: "Dev" },
  { name: "bitbucket-bare", hostMatch: /(^|\.)bitbucket\.org$/, category: "Dev" },
  { name: "sourcegraph", hostMatch: /(^|\.)sourcegraph\.com$/, category: "Dev" },
  { name: "npm", hostMatch: /(^|\.)(www\.)?npmjs\.com$/, category: "Dev" },
  { name: "yarn", hostMatch: /(^|\.)yarnpkg\.com$/, category: "Dev" },
  { name: "pnpm", hostMatch: /(^|\.)pnpm\.io$/, category: "Dev" },
  { name: "packagist", hostMatch: /(^|\.)packagist\.org$/, category: "Dev" },
  { name: "pypi", hostMatch: /(^|\.)pypi\.org$/, category: "Dev" },
  { name: "rubygems", hostMatch: /(^|\.)rubygems\.org$/, category: "Dev" },
  { name: "crates", hostMatch: /(^|\.)crates\.io$/, category: "Dev" },
  { name: "docker-hub", hostMatch: /(^|\.)hub\.docker\.com$/, category: "Dev" },
  { name: "snyk", hostMatch: /(^|\.)snyk\.io$/, category: "Dev" },
  { name: "sonarqube", hostMatch: /(^|\.)sonarcloud\.io$/, category: "Dev" }
];

// src/rules/pathRules.ts
var PATH_RULES = [
  { name: "path-pull", pathInclude: /\/(pull|pulls|pull-request|pull-requests|merge_requests?)(\/|$)/i, category: "Review" },
  { name: "path-issue", pathInclude: /\/(issues?|tickets?|tasks?)(\/|$)/i, category: "Review" },
  { name: "path-review", pathInclude: /\/(reviews?|approvals?)(\/|$)/i, category: "Review" },
  { name: "path-pipeline", pathInclude: /\/(actions|pipelines?|workflows?|builds?|deployments?)(\/|$)/i, category: "Cloud" },
  { name: "path-dashboard", pathInclude: /\/(dashboard|metrics|monitor|monitoring|alerts?)(\/|$)/i, category: "Cloud" },
  { name: "path-docs", pathInclude: /\/(docs?|wiki|spec|specs|specification)(\/|$)/i, category: "Docs" }
];

// src/rules/titleRules.ts
var TITLE_RULES = [
  { name: "title-pr", titleInclude: /\b(pull request|merge request|PR #)/i, category: "Review" },
  { name: "title-issue", titleInclude: /\b(issue|ticket|task) #?\d+/i, category: "Review" },
  { name: "title-build", titleInclude: /\b(build|deploy|deployment|pipeline|workflow run)\b/i, category: "Cloud" },
  { name: "title-spec", titleInclude: /\b(spec|specification|design doc|RFC)\b/i, category: "Docs" },
  { name: "title-docs", titleInclude: /\b(documentation|docs?)\b/i, category: "Research" }
];

// src/domain/overrides.ts
function hostKeyOf(hostname) {
  const h = hostname.trim().toLowerCase();
  return h.length > 0 ? h : null;
}
function firstPathSegment(pathname) {
  const seg = pathname.split("/").filter((s) => s.length > 0)[0];
  return seg ? seg.toLowerCase() : null;
}
function hostPathKeyOf(hostname, pathname) {
  const host = hostKeyOf(hostname);
  if (host === null) return null;
  const seg = firstPathSegment(pathname);
  if (seg === null) return null;
  return `${host}/${seg}`;
}
function overrideKeyFor(hostname, pathname, scope) {
  return scope === "host" ? hostKeyOf(hostname) : hostPathKeyOf(hostname, pathname);
}
function overrideKeysFor(hostname, pathname) {
  const keys = [];
  const hostPath = hostPathKeyOf(hostname, pathname);
  if (hostPath !== null) keys.push(hostPath);
  const host = hostKeyOf(hostname);
  if (host !== null) keys.push(host);
  return keys;
}
function lookupOverride(hostname, pathname, overrides) {
  if (!overrides) return null;
  for (const key of overrideKeysFor(hostname, pathname)) {
    const category = overrides[key];
    if (category !== void 0) {
      return { key, category, scope: key.includes("/") ? "hostPath" : "host" };
    }
  }
  return null;
}
function withOverride(overrides, key, category) {
  return { ...overrides ?? {}, [key]: category };
}
function withoutOverrides(overrides, keys) {
  const drop = new Set(keys);
  const out = {};
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (!drop.has(k)) out[k] = v;
  }
  return out;
}

// src/domain/classify.ts
function classifyDetailed(input, context = {}) {
  const url = input.url ?? "";
  const title = input.title ?? "";
  const parsed = parseUrl(url);
  if (!parsed.ok) return { category: "Misc", source: "fallback", ruleName: null };
  const override = lookupOverride(parsed.hostname, parsed.pathname, context.overrides);
  if (override) {
    return { category: override.category, source: "override", ruleName: override.key };
  }
  if (isLocalUrl(url)) return { category: "Local", source: "local", ruleName: "local-url" };
  const customRules = context.customRules ?? [];
  const customHit = sortByPriority(customRules).find((r) => matchRule(r, parsed, title, url));
  if (customHit) {
    return { category: customHit.category, source: "custom", ruleName: customHit.name ?? null };
  }
  const domainHit = sortByPriority(DOMAIN_RULES).find((r) => matchRule(r, parsed, title, url));
  if (domainHit) {
    return { category: domainHit.category, source: "domain", ruleName: domainHit.name ?? null };
  }
  const pathHit = PATH_RULES.find((r) => matchRule(r, parsed, title, url));
  if (pathHit) {
    return { category: pathHit.category, source: "path", ruleName: pathHit.name ?? null };
  }
  const titleHit = TITLE_RULES.find((r) => matchRule(r, parsed, title, url));
  if (titleHit) {
    return { category: titleHit.category, source: "title", ruleName: titleHit.name ?? null };
  }
  return { category: "Misc", source: "fallback", ruleName: null };
}
function classify(input, customRules = [], overrides) {
  return classifyDetailed(input, { customRules, overrides }).category;
}
function sortByPriority(rules) {
  return [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
function matchRule(rule, parsed, title, fullUrl) {
  if (rule.hostMatch && !rule.hostMatch.test(parsed.hostname)) return false;
  if (rule.pathExclude && rule.pathExclude.test(parsed.pathname)) return false;
  if (rule.pathInclude && !rule.pathInclude.test(parsed.pathname)) return false;
  if (rule.titleInclude && !rule.titleInclude.test(title)) return false;
  if (rule.urlInclude && !rule.urlInclude.test(fullUrl)) return false;
  const hasAnyMatcher = !!rule.hostMatch || !!rule.pathInclude || !!rule.titleInclude || !!rule.urlInclude;
  return hasAnyMatcher;
}

// src/scoring/splitPair.ts
var RECENCY_HALF_LIFE_SECONDS = 60;
var AFFINITY = [
  ["Review", "Local", 1],
  ["Review", "Dev", 0.9],
  ["Docs", "Local", 0.9],
  ["Research", "Dev", 0.9],
  ["Review", "Chat", 0.8],
  ["Cloud", "Dev", 0.7],
  ["Cloud", "Local", 0.7],
  ["Data", "Cloud", 0.7],
  ["Data", "Dev", 0.6],
  ["Design", "Local", 0.8],
  ["Design", "Dev", 0.7],
  ["AI", "Docs", 0.8],
  ["AI", "Dev", 0.8],
  ["AI", "Research", 0.8],
  ["Review", "Docs", 0.7],
  ["Chat", "Review", 0.8]
];
var CLASSIC_PAIRS = [
  ["Review", "Local"],
  ["Docs", "Local"],
  ["Research", "Dev"],
  ["Review", "Dev"],
  ["Cloud", "Local"],
  ["Data", "Cloud"],
  ["Design", "Local"],
  ["Chat", "Review"],
  ["AI", "Docs"],
  ["AI", "Dev"]
];
function affinityScore(a, b) {
  if (a === b) return 0;
  for (const [x, y, w] of AFFINITY) {
    if (x === a && y === b || x === b && y === a) return w;
  }
  return 0.1;
}
function classicBonus(a, b) {
  for (const [x, y] of CLASSIC_PAIRS) {
    if (x === a && y === b || x === b && y === a) return 0.5;
  }
  return 0;
}
function recencyProximity(a, b) {
  const ta = a.lastAccessed ?? 0;
  const tb = b.lastAccessed ?? 0;
  if (!ta || !tb) return 0.2;
  const diffSec = Math.abs(ta - tb) / 1e3;
  return 1 / (1 + diffSec / RECENCY_HALF_LIFE_SECONDS);
}
function domainSim(a, b) {
  const ha = parseUrl(a.url ?? "").hostname;
  const hb = parseUrl(b.url ?? "").hostname;
  if (!ha || !hb) return 0;
  if (ha === hb) return 1;
  if (rootDomain(ha) === rootDomain(hb)) return 0.5;
  return 0;
}
function titleSim(a, b) {
  return jaccard(a.title ?? "", b.title ?? "");
}
function suggestSplitPairs(tabs, opts = {}) {
  const topN = opts.topN ?? 5;
  if (tabs.length < 2) return [];
  const classified = tabs.map((t) => ({
    tab: t,
    category: classify({ url: t.url ?? "", title: t.title ?? "" })
  }));
  const candidates = [];
  for (let i = 0; i < classified.length; i += 1) {
    for (let j = i + 1; j < classified.length; j += 1) {
      const A = classified[i];
      const B = classified[j];
      const aff = affinityScore(A.category, B.category);
      if (aff <= 0.1) continue;
      const score = aff * 4 + recencyProximity(A.tab, B.tab) * 2 + titleSim(A.tab, B.tab) * 2 + domainSim(A.tab, B.tab) * 1 + classicBonus(A.category, B.category);
      candidates.push({
        a: A.tab,
        b: B.tab,
        score: Math.round(score * 100) / 100,
        reason: `${A.category} \xD7 ${B.category}`
      });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates.slice(0, topN);
}

// src/domain/groupPlan.ts
function planGrouping(tabs, managedGroups, options = {}) {
  const minTabs = Math.max(1, options.minTabsPerNewGroup ?? 1);
  const skip = new Set(options.skipCategories ?? []);
  const groupForCategory = /* @__PURE__ */ new Map();
  for (const g of managedGroups) {
    if (!groupForCategory.has(g.category)) groupForCategory.set(g.category, g.groupId);
  }
  const byCategory = /* @__PURE__ */ new Map();
  for (const t of tabs) {
    const arr = byCategory.get(t.category);
    if (arr) arr.push(t);
    else byCategory.set(t.category, [t]);
  }
  const assignments = [];
  const creations = [];
  const touchedTabIds = [];
  for (const category of CATEGORY_ORDER) {
    const members = byCategory.get(category);
    if (!members || members.length === 0) continue;
    const existingGroupId = groupForCategory.get(category);
    if (existingGroupId !== void 0) {
      const tabIds2 = members.filter((t) => t.currentGroupId !== existingGroupId).map((t) => t.tabId);
      if (tabIds2.length > 0) {
        assignments.push({ groupId: existingGroupId, category, tabIds: tabIds2 });
        touchedTabIds.push(...tabIds2);
      }
      continue;
    }
    if (skip.has(category)) continue;
    if (members.length < minTabs) continue;
    const tabIds = members.map((t) => t.tabId);
    creations.push({ category, tabIds });
    touchedTabIds.push(...tabIds);
  }
  return { assignments, creations, touchedTabIds };
}

// src/constants/colors.ts
var CATEGORY_COLOR = {
  Chat: "green",
  Review: "red",
  Dev: "blue",
  Local: "cyan",
  Docs: "yellow",
  Research: "purple",
  Cloud: "orange",
  Data: "pink",
  Design: "grey",
  AI: "cyan",
  // teal fallback
  Misc: "grey"
};

// src/domain/groupTitle.ts
function formatGroupTitle(category, windowOrdinal) {
  return windowOrdinal === null ? category : `${category} ${windowOrdinal}`;
}
function parseGroupTitle(title) {
  if (!title) return null;
  const trimmed = title.trim();
  for (const category of ALL_CATEGORIES) {
    if (trimmed === category) return category;
    if (trimmed.startsWith(category + " ")) {
      const rest = trimmed.slice(category.length + 1);
      if (/^[1-9][0-9]*$/.test(rest)) return category;
    }
  }
  return null;
}
function recognizeGroupTitle(title, color) {
  const category = parseGroupTitle(title);
  if (category === null) return null;
  if (color === void 0) return null;
  return CATEGORY_COLOR[category] === color ? category : null;
}

// src/domain/undoPlan.ts
var UNGROUPED = -1;
function planUndoRegroup(tabs, groups, liveGroupIds) {
  const byOldGroup = /* @__PURE__ */ new Map();
  for (const t of tabs) {
    if (t.groupId === UNGROUPED) continue;
    const arr = byOldGroup.get(t.groupId);
    if (arr) arr.push(t.tabId);
    else byOldGroup.set(t.groupId, [t.tabId]);
  }
  const steps = [];
  for (const [oldGroupId, tabIds] of byOldGroup) {
    const survived = liveGroupIds.has(oldGroupId);
    const meta = groups.find((g) => g.groupId === oldGroupId) ?? null;
    if (!survived && meta === null) continue;
    steps.push({ tabIds, reuseGroupId: survived ? oldGroupId : null, meta });
  }
  return steps;
}

// src/storage/managedGroups.ts
var KEY = "managedGroups.v1";
async function readMap() {
  const obj = await chrome.storage.session.get(KEY);
  const raw = obj[KEY];
  return raw && typeof raw === "object" ? raw : {};
}
async function writeMap(map) {
  await chrome.storage.session.set({ [KEY]: map });
}
async function getManagedGroups() {
  const map = await readMap();
  const out = /* @__PURE__ */ new Map();
  for (const [id, category] of Object.entries(map)) {
    const n = Number(id);
    if (Number.isInteger(n)) out.set(n, category);
  }
  return out;
}
async function registerManagedGroups(entries) {
  if (entries.length === 0) return;
  const map = await readMap();
  const next = { ...map };
  for (const e of entries) {
    if (e.groupId !== -1) next[String(e.groupId)] = e.category;
  }
  await writeMap(next);
}
async function pruneManagedGroups(liveGroupIds) {
  const map = await readMap();
  const next = {};
  let changed = false;
  for (const [id, category] of Object.entries(map)) {
    if (liveGroupIds.has(Number(id))) next[id] = category;
    else changed = true;
  }
  if (changed) await writeMap(next);
}

// src/services/tabGroupsService.ts
async function groupTabs(tabIds, windowId, groupId) {
  if (tabIds.length === 0) return -1;
  if (groupId !== void 0 && groupId !== -1) {
    return chrome.tabs.group({ tabIds, groupId });
  }
  return chrome.tabs.group({ tabIds, createProperties: { windowId } });
}
async function updateGroup(groupId, updates) {
  if (groupId === -1) return;
  await chrome.tabGroups.update(groupId, updates);
}
async function moveGroup(groupId, index) {
  if (groupId === -1) return;
  await chrome.tabGroups.move(groupId, { index });
}
async function getGroupsInWindow(windowId) {
  return chrome.tabGroups.query({ windowId });
}
async function getAllGroups() {
  return chrome.tabGroups.query({});
}

// src/background/organize.ts
var UNGROUPED2 = -1;
async function resolveManagedGroups(windowId, settings) {
  const liveGroups = await getGroupsInWindow(windowId);
  const registry = await getManagedGroups();
  const managed = [];
  const adopted = [];
  for (const g of liveGroups) {
    const registered = registry.get(g.id);
    if (registered !== void 0) {
      managed.push({ groupId: g.id, category: registered });
      continue;
    }
    if (!settings.adoptMatchingGroups) continue;
    const recognized = recognizeGroupTitle(g.title, g.color);
    if (recognized !== null) {
      const entry = { groupId: g.id, category: recognized };
      managed.push(entry);
      adopted.push(entry);
    }
  }
  if (adopted.length > 0) await registerManagedGroups(adopted);
  return { managed, liveGroups };
}
function isOrganizableTab(tab, settings) {
  if (typeof tab.id !== "number") return false;
  if (settings.ignorePinnedTabs && tab.pinned) return false;
  const url = tab.url ?? "";
  if (isExcludedUrl(url)) return false;
  if (isUserExcludedDomain(url, settings.userExcludedDomains)) return false;
  return true;
}
function classifyTab(tab, settings) {
  return classifyDetailed(
    { url: tab.url ?? "", title: tab.title ?? "" },
    { customRules: settings.customRules ?? [], overrides: settings.categoryOverrides }
  );
}
function selectTouchableTabs(tabs, settings, managedIds) {
  const touchable = [];
  let skippedUserGroupTabs = 0;
  for (const tab of tabs) {
    if (!isOrganizableTab(tab, settings)) continue;
    const groupId = tab.groupId ?? UNGROUPED2;
    if (groupId !== UNGROUPED2 && !managedIds.has(groupId)) {
      skippedUserGroupTabs += 1;
      continue;
    }
    touchable.push({ tab, result: classifyTab(tab, settings) });
  }
  return { touchable, skippedUserGroupTabs };
}
function buildSnapshot(windowId, touchedTabIds, tabs, liveGroups) {
  const touched = new Set(touchedTabIds);
  const tabSnaps = tabs.filter((t) => typeof t.id === "number" && touched.has(t.id)).map((t) => ({
    tabId: t.id,
    index: t.index,
    groupId: t.groupId ?? UNGROUPED2,
    pinned: t.pinned ?? false
  }));
  const neededGroupIds = new Set(
    tabSnaps.map((t) => t.groupId).filter((id) => id !== UNGROUPED2)
  );
  const groupSnaps = liveGroups.filter((g) => neededGroupIds.has(g.id)).map((g) => ({
    groupId: g.id,
    title: g.title ?? "",
    color: g.color,
    collapsed: g.collapsed ?? false
  }));
  return { windowId, takenAt: Date.now(), tabs: tabSnaps, groups: groupSnaps };
}
async function applyPlan(plan, windowId, windowOrdinal) {
  let movedTabs = 0;
  let createdGroups = 0;
  const newlyManaged = [];
  for (const a of plan.assignments) {
    try {
      await groupTabs(a.tabIds, windowId, a.groupId);
      movedTabs += a.tabIds.length;
    } catch (e) {
      console.warn("assign to existing group failed:", a.category, e);
    }
  }
  for (const c of plan.creations) {
    try {
      const groupId = await groupTabs(c.tabIds, windowId);
      if (groupId === UNGROUPED2) continue;
      await updateGroup(groupId, {
        title: formatGroupTitle(c.category, windowOrdinal),
        color: CATEGORY_COLOR[c.category]
      });
      newlyManaged.push({ groupId, category: c.category });
      createdGroups += 1;
      movedTabs += c.tabIds.length;
    } catch (e) {
      console.warn("group creation failed for", c.category, e);
    }
  }
  if (newlyManaged.length > 0) await registerManagedGroups(newlyManaged);
  return { movedTabs, createdGroups };
}
async function sortManagedGroups(windowId) {
  const registry = await getManagedGroups();
  const liveGroups = await getGroupsInWindow(windowId);
  const byCategory = /* @__PURE__ */ new Map();
  for (const g of liveGroups) {
    const category = registry.get(g.id);
    if (category !== void 0 && !byCategory.has(category)) byCategory.set(category, g.id);
  }
  for (const category of CATEGORY_ORDER) {
    const groupId = byCategory.get(category);
    if (groupId === void 0) continue;
    try {
      await moveGroup(groupId, -1);
    } catch (e) {
      console.warn("group move failed:", category, e);
    }
  }
}
async function restoreActiveTabPosition(activeTab, windowId) {
  if (!activeTab || typeof activeTab.id !== "number" || typeof activeTab.index !== "number") return;
  if (activeTab.pinned) return;
  if (isExcludedUrl(activeTab.url)) return;
  try {
    const after = await getTabsInWindow(windowId);
    const target = Math.max(0, Math.min(activeTab.index, after.length - 1));
    await moveSingleTab(activeTab.id, target);
  } catch {
  }
}
async function previewWindow(windowId) {
  const settings = await getSettings();
  const { managed } = await resolveManagedGroups(windowId, settings);
  const tabs = await getTabsInWindow(windowId);
  const managedIds = new Set(managed.map((m) => m.groupId));
  const { touchable, skippedUserGroupTabs } = selectTouchableTabs(tabs, settings, managedIds);
  const countsMap = /* @__PURE__ */ new Map();
  for (const c of touchable) {
    countsMap.set(c.result.category, (countsMap.get(c.result.category) ?? 0) + 1);
  }
  return {
    totalTabs: tabs.length,
    counts: CATEGORY_ORDER.map((category) => ({ category, count: countsMap.get(category) ?? 0 })).filter((x) => x.count > 0),
    skippedUserGroupTabs
  };
}
function buildPlan(touchable, managed, restrictToTabIds) {
  const scoped = restrictToTabIds ? touchable.filter((c) => restrictToTabIds.has(c.tab.id)) : touchable;
  const planTabs = scoped.map((c) => ({
    tabId: c.tab.id,
    category: c.result.category,
    currentGroupId: c.tab.groupId ?? UNGROUPED2
  }));
  return planGrouping(planTabs, managed);
}
async function organizeWindow(windowId, restrictToTabIds) {
  const settings = await getSettings();
  const { managed, liveGroups } = await resolveManagedGroups(windowId, settings);
  await pruneManagedGroups(new Set((await getAllGroups()).map((g) => g.id)));
  const tabs = await getTabsInWindow(windowId);
  const activeTab = await getActiveTabInWindow(windowId);
  const managedIds = new Set(managed.map((m) => m.groupId));
  const { touchable, skippedUserGroupTabs } = selectTouchableTabs(tabs, settings, managedIds);
  const plan = buildPlan(touchable, managed, restrictToTabIds);
  if (plan.touchedTabIds.length === 0) {
    return { movedTabs: 0, createdGroups: 0, skippedUserGroupTabs };
  }
  await setUndoSnapshot(buildSnapshot(windowId, plan.touchedTabIds, tabs, liveGroups));
  const windowOrdinal = await getWindowOrdinal(windowId);
  const { movedTabs, createdGroups } = await applyPlan(plan, windowId, windowOrdinal);
  if (settings.sortGroupsByCategory && !restrictToTabIds) {
    await sortManagedGroups(windowId);
  }
  if (settings.keepActiveTabPosition) {
    await restoreActiveTabPosition(activeTab, windowId);
  }
  return { movedTabs, createdGroups, skippedUserGroupTabs };
}
async function restoreTabPositions(tabs) {
  for (const t of [...tabs].sort((a, b) => a.index - b.index)) {
    try {
      await moveSingleTab(t.tabId, t.index);
    } catch {
    }
  }
}
async function restoreGroups(snap, alive) {
  const liveGroupIds = new Set((await getGroupsInWindow(snap.windowId)).map((g) => g.id));
  const steps = planUndoRegroup(alive, snap.groups, liveGroupIds);
  const restored = [];
  for (const step of steps) {
    try {
      const groupId = await groupTabs(
        step.tabIds,
        snap.windowId,
        step.reuseGroupId ?? void 0
      );
      if (groupId === UNGROUPED2) continue;
      if (step.meta) {
        await updateGroup(groupId, {
          title: step.meta.title,
          color: step.meta.color,
          collapsed: step.meta.collapsed
        });
        const category = recognizeGroupTitle(step.meta.title, step.meta.color);
        if (category !== null) restored.push({ groupId, category });
      }
    } catch (e) {
      console.warn("undo regroup failed:", e);
    }
  }
  if (restored.length > 0) await registerManagedGroups(restored);
}
async function undoLast() {
  const snap = await getUndoSnapshot();
  if (!snap) return { ok: false, reason: "Nothing to undo." };
  const liveTabs = await getTabsInWindow(snap.windowId);
  const liveIds = new Set(liveTabs.map((t) => t.id));
  const alive = snap.tabs.filter((t) => liveIds.has(t.tabId));
  if (alive.length === 0) {
    await setUndoSnapshot(null);
    return { ok: false, reason: "Snapshot tabs are gone." };
  }
  try {
    await ungroupTabs(alive.map((t) => t.tabId));
  } catch (e) {
    console.debug("undo ungroup partial failure:", e);
  }
  await restoreTabPositions(alive);
  await restoreGroups(snap, alive);
  await setUndoSnapshot(null);
  return { ok: true };
}

// src/background/currentTab.ts
async function describeActiveTab(windowId) {
  const tab = await getActiveTabInWindow(windowId);
  if (!tab || typeof tab.id !== "number") return null;
  const settings = await getSettings();
  const url = tab.url ?? "";
  const parsed = parseUrl(url);
  const classification = classifyDetailed(
    { url, title: tab.title ?? "" },
    { customRules: settings.customRules ?? [], overrides: settings.categoryOverrides }
  );
  const hit = parsed.ok ? lookupOverride(parsed.hostname, parsed.pathname, settings.categoryOverrides) : null;
  const keys = parsed.ok ? overrideKeysFor(parsed.hostname, parsed.pathname) : [];
  return {
    tabId: tab.id,
    title: tab.title ?? "",
    url,
    hostKey: parsed.ok ? overrideKeyFor(parsed.hostname, parsed.pathname, "host") : null,
    hostPathKey: parsed.ok ? overrideKeyFor(parsed.hostname, parsed.pathname, "hostPath") : null,
    activeOverrideKey: hit?.key ?? null,
    correctable: parsed.ok && keys.length > 0,
    exclusion: exclusionFor(tab, url, settings),
    classification
  };
}
function exclusionFor(tab, url, settings) {
  if (isExcludedUrl(url)) return "unsupported-url";
  if (settings.ignorePinnedTabs && tab.pinned) return "pinned";
  if (isUserExcludedDomain(url, settings.userExcludedDomains)) return "excluded-domain";
  return "none";
}
async function tabIdsMatchingKeys(windowId, keys) {
  const wanted = new Set(keys);
  const tabs = await getTabsInWindow(windowId);
  const out = /* @__PURE__ */ new Set();
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;
    const parsed = parseUrl(tab.url ?? "");
    if (!parsed.ok) continue;
    if (overrideKeysFor(parsed.hostname, parsed.pathname).some((k) => wanted.has(k))) {
      out.add(tab.id);
    }
  }
  return out;
}
async function applyOverride(windowId, url, scope, category) {
  const parsed = parseUrl(url);
  if (!parsed.ok) throw new Error("This tab has no addressable URL.");
  const key = overrideKeyFor(parsed.hostname, parsed.pathname, scope);
  if (key === null) {
    throw new Error(
      scope === "hostPath" ? "This URL has no path segment to scope to." : "This URL has no host to scope to."
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
async function clearOverridesForUrl(windowId, url) {
  const parsed = parseUrl(url);
  if (!parsed.ok) throw new Error("This tab has no addressable URL.");
  const keys = overrideKeysFor(parsed.hostname, parsed.pathname);
  if (keys.length === 0) throw new Error("Nothing to reset for this URL.");
  const affected = await tabIdsMatchingKeys(windowId, keys);
  const settings = await getSettings();
  await setSettings({
    categoryOverrides: withoutOverrides(settings.categoryOverrides, keys)
  });
  const result = await organizeWindow(windowId, affected);
  return {
    key: keys.join(", "),
    affectedTabs: affected.size,
    movedTabs: result.movedTabs,
    createdGroups: result.createdGroups
  };
}

// src/background/index.ts
async function handleSuggestPairs(windowId) {
  const settings = await getSettings();
  const tabs = await getTabsInWindow(windowId);
  const eligible = tabs.filter((t) => {
    if (settings.ignorePinnedTabs && t.pinned) return false;
    if (isExcludedUrl(t.url)) return false;
    if (isUserExcludedDomain(t.url ?? "", settings.userExcludedDomains)) return false;
    return true;
  });
  const pairs = suggestSplitPairs(
    eligible.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
      lastAccessed: t.lastAccessed
    })),
    { topN: 5 }
  );
  return {
    kind: "suggestPairs",
    pairs: pairs.map((p) => ({
      aTitle: p.a.title ?? "",
      aUrl: p.a.url ?? "",
      bTitle: p.b.title ?? "",
      bUrl: p.b.url ?? "",
      reason: p.reason,
      score: p.score
    }))
  };
}
async function route(msg) {
  switch (msg.kind) {
    case "preview": {
      const p = await previewWindow(msg.windowId);
      return { kind: "preview", ...p };
    }
    case "organize": {
      const r = await organizeWindow(msg.windowId);
      return { kind: "organize", ...r };
    }
    case "undo": {
      const r = await undoLast();
      return { kind: "undo", ...r };
    }
    case "suggestPairs":
      return handleSuggestPairs(msg.windowId);
    case "getSettings":
      return { kind: "settings", settings: await getSettings() };
    case "setSettings":
      return { kind: "settings", settings: await setSettings(msg.patch) };
    case "activeTab":
      return { kind: "activeTab", info: await describeActiveTab(msg.windowId) };
    case "setOverride": {
      const r = await applyOverride(msg.windowId, msg.url, msg.scope, msg.category);
      return {
        kind: "overrideApplied",
        key: r.key,
        affectedTabs: r.affectedTabs,
        movedTabs: r.movedTabs
      };
    }
    case "clearOverride": {
      const r = await clearOverridesForUrl(msg.windowId, msg.url);
      return {
        kind: "overrideApplied",
        key: r.key,
        affectedTabs: r.affectedTabs,
        movedTabs: r.movedTabs
      };
    }
    default:
      return { kind: "error", message: "Unknown message." };
  }
}
chrome.runtime.onMessage.addListener(
  (msg, _sender, sendResponse) => {
    (async () => {
      try {
        sendResponse(await route(msg));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("background handler error:", e);
        sendResponse({ kind: "error", message });
      }
    })();
    return true;
  }
);
chrome.commands.onCommand.addListener((command) => {
  void (async () => {
    try {
      if (command === "organize-now") {
        await organizeWindow(await getFallbackWindowId());
      }
      if (command === "undo-organize") {
        await undoLast();
      }
    } catch (e) {
      console.error("command handler error:", e);
    }
  })();
});
//# sourceMappingURL=background.js.map
