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

// src/rules/localPatterns.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
var ENV_KEYWORDS = [
  "localhost",
  "staging",
  "stage",
  "stg",
  "dev",
  "develop",
  "qa",
  "test",
  "preview",
  "sandbox",
  "preprod",
  "pre-prod",
  "uat"
];
var ENV_LABEL_RE = new RegExp(
  "(^|[.\\-/_])(" + ENV_KEYWORDS.join("|") + ")([.\\-/_]|$)",
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
  if (ENV_LABEL_RE.test(p.hostname)) return true;
  if (ENV_LABEL_RE.test(p.pathname)) return true;
  return false;
}

// src/rules/domainRules.ts
var DOMAIN_RULES = [
  // ─── Review (path-qualified GitHub/GitLab/Bitbucket) ──────────────
  { name: "github-pr", hostMatch: /(^|\.)github\.com$/, pathInclude: /\/pull\/?/, category: "Review" },
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

// src/domain/classify.ts
function classify(input, customRules = []) {
  const url = input.url ?? "";
  const title = input.title ?? "";
  const parsed = parseUrl(url);
  if (!parsed.ok) return "Misc";
  if (isLocalUrl(url)) return "Local";
  const allRules = [...customRules, ...DOMAIN_RULES];
  const sorted = sortByPriority(allRules);
  const domainHit = sorted.find((r) => matchRule(r, parsed, title, url));
  if (domainHit) return domainHit.category;
  const pathHit = PATH_RULES.find((r) => matchRule(r, parsed, title, url));
  if (pathHit) return pathHit.category;
  const titleHit = TITLE_RULES.find((r) => matchRule(r, parsed, title, url));
  if (titleHit) return titleHit.category;
  return "Misc";
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

// src/domain/categoryOrder.ts
function groupByCategoryOrdered(classified) {
  const buckets = /* @__PURE__ */ new Map();
  for (const c of CATEGORY_ORDER) buckets.set(c, []);
  for (const item of classified) buckets.get(item.category).push(item.tab);
  return CATEGORY_ORDER.map((c) => ({ category: c, tabs: buckets.get(c) })).filter((b) => b.tabs.length > 0);
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

// src/storage/store.ts
var KEY_SETTINGS = "settings.v1";
var KEY_UNDO = "lastSnapshotForUndo.v1";
var DEFAULT_SETTINGS = {
  ignorePinnedTabs: true,
  keepActiveTabPosition: true,
  userExcludedDomains: []
};
async function getSettings() {
  const obj = await chrome.storage.local.get(KEY_SETTINGS);
  const stored = obj[KEY_SETTINGS];
  return { ...DEFAULT_SETTINGS, ...stored ?? {} };
}
async function setSettings(patch) {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY_SETTINGS]: merged });
  return merged;
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
async function getCurrentWindowId() {
  const win = await chrome.windows.getCurrent({ populate: false });
  if (typeof win.id !== "number") {
    throw new Error("No current window id available.");
  }
  return win.id;
}
async function getTabsInWindow(windowId) {
  return chrome.tabs.query({ windowId });
}
async function moveSingleTab(tabId, index) {
  await chrome.tabs.move(tabId, { index });
}
async function ungroupTabs(tabIds) {
  if (tabIds.length === 0) return;
  await chrome.tabs.ungroup(tabIds);
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

// src/background/index.ts
function selectAndClassify(tabs, settings) {
  const out = [];
  for (const t of tabs) {
    if (typeof t.id !== "number") continue;
    if (settings.ignorePinnedTabs && t.pinned) continue;
    const url = t.url ?? "";
    if (isExcludedUrl(url)) continue;
    if (isUserExcludedDomain(url, settings.userExcludedDomains)) continue;
    const input = { url, title: t.title ?? "" };
    const category = classify(input, settings.customRules ?? []);
    out.push({ tab: t, category });
  }
  return out;
}
async function buildSnapshot(windowId) {
  const [tabs, groups] = await Promise.all([
    getTabsInWindow(windowId),
    getGroupsInWindow(windowId)
  ]);
  return {
    windowId,
    takenAt: Date.now(),
    tabs: tabs.filter((t) => typeof t.id === "number").map((t) => ({
      tabId: t.id,
      index: t.index,
      groupId: t.groupId ?? -1,
      pinned: t.pinned ?? false
    })),
    groups: groups.map((g) => ({
      groupId: g.id,
      title: g.title ?? "",
      color: g.color,
      collapsed: g.collapsed ?? false
    }))
  };
}
async function handlePreview() {
  const settings = await getSettings();
  const windowId = await getCurrentWindowId();
  const tabs = await getTabsInWindow(windowId);
  const classified = selectAndClassify(tabs, settings);
  const countsMap = /* @__PURE__ */ new Map();
  for (const c of CATEGORY_ORDER) countsMap.set(c, 0);
  for (const c of classified) countsMap.set(c.category, (countsMap.get(c.category) ?? 0) + 1);
  return {
    kind: "preview",
    totalTabs: tabs.length,
    counts: CATEGORY_ORDER.map((cat) => ({ category: cat, count: countsMap.get(cat) ?? 0 })).filter((x) => x.count > 0)
  };
}
async function handleOrganize() {
  const settings = await getSettings();
  const windowId = await getCurrentWindowId();
  const snapshot = await buildSnapshot(windowId);
  await setUndoSnapshot(snapshot);
  const tabs = await getTabsInWindow(windowId);
  const activeTab = tabs.find((t) => t.active);
  const activeTabId = activeTab?.id;
  const activeOriginalIndex = activeTab?.index;
  const classified = selectAndClassify(tabs, settings);
  if (classified.length === 0) {
    return { kind: "organize", movedTabs: 0, createdGroups: 0 };
  }
  const buckets = groupByCategoryOrdered(
    classified.map(({ tab, category }) => ({ tab, category }))
  );
  const allTargetTabIds = classified.map((c) => c.tab.id).filter((id) => typeof id === "number");
  try {
    await ungroupTabs(allTargetTabIds);
  } catch (e) {
    console.debug("ungroup partial failure:", e);
  }
  let createdGroups = 0;
  let movedTabs = 0;
  const createdGroupIds = [];
  for (const bucket of buckets) {
    const ids = bucket.tabs.map((t) => t.id).filter((id) => typeof id === "number");
    if (ids.length === 0) continue;
    try {
      const groupId = await groupTabs(ids, windowId);
      await updateGroup(groupId, {
        title: bucket.category,
        color: CATEGORY_COLOR[bucket.category]
      });
      createdGroupIds.push(groupId);
      createdGroups += 1;
      movedTabs += ids.length;
    } catch (e) {
      console.warn("group creation failed for", bucket.category, e);
    }
  }
  for (const groupId of createdGroupIds) {
    try {
      await moveGroup(groupId, -1);
    } catch (e) {
      console.warn("group move failed:", e);
    }
  }
  if (settings.keepActiveTabPosition && typeof activeTabId === "number" && typeof activeOriginalIndex === "number") {
    try {
      const after = await getTabsInWindow(windowId);
      const target = Math.max(0, Math.min(activeOriginalIndex, after.length - 1));
      await moveSingleTab(activeTabId, target);
    } catch {
    }
  }
  return { kind: "organize", movedTabs, createdGroups };
}
async function handleUndo() {
  const snap = await getUndoSnapshot();
  if (!snap) return { kind: "undo", ok: false, reason: "No snapshot." };
  const liveTabs = await getTabsInWindow(snap.windowId);
  const liveIds = new Set(liveTabs.map((t) => t.id));
  const idsAlive = snap.tabs.filter((t) => liveIds.has(t.tabId)).map((t) => t.tabId);
  try {
    if (idsAlive.length) await ungroupTabs(idsAlive);
  } catch (e) {
    console.debug("undo ungroup partial failure:", e);
  }
  const sortedByIndex = [...snap.tabs].filter((t) => liveIds.has(t.tabId)).sort((a, b) => a.index - b.index);
  for (const t of sortedByIndex) {
    try {
      await moveSingleTab(t.tabId, t.index);
    } catch {
    }
  }
  const groupsByOldId = /* @__PURE__ */ new Map();
  for (const t of snap.tabs) {
    if (t.groupId === -1) continue;
    if (!liveIds.has(t.tabId)) continue;
    const arr = groupsByOldId.get(t.groupId) ?? [];
    arr.push(t.tabId);
    groupsByOldId.set(t.groupId, arr);
  }
  for (const [oldGroupId, tabIds] of groupsByOldId) {
    if (!tabIds.length) continue;
    try {
      const newGroupId = await groupTabs(tabIds, snap.windowId);
      const meta = snap.groups.find((g) => g.groupId === oldGroupId);
      if (meta) {
        await updateGroup(newGroupId, {
          title: meta.title,
          color: meta.color,
          collapsed: meta.collapsed
        });
      }
    } catch (e) {
      console.warn("undo regroup failed:", e);
    }
  }
  await setUndoSnapshot(null);
  return { kind: "undo", ok: true };
}
async function handleSuggestPairs() {
  const settings = await getSettings();
  const windowId = await getCurrentWindowId();
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
chrome.runtime.onMessage.addListener(
  (msg, _sender, sendResponse) => {
    (async () => {
      try {
        switch (msg.kind) {
          case "preview":
            sendResponse(await handlePreview());
            break;
          case "organize":
            sendResponse(await handleOrganize());
            break;
          case "undo":
            sendResponse(await handleUndo());
            break;
          case "suggestPairs":
            sendResponse(await handleSuggestPairs());
            break;
          case "getSettings":
            sendResponse({ kind: "settings", settings: await getSettings() });
            break;
          case "setSettings": {
            const updated = await setSettings(msg.patch);
            sendResponse({ kind: "settings", settings: updated });
            break;
          }
          default:
            sendResponse({ kind: "error", message: "Unknown message." });
        }
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
      if (command === "organize-now") await handleOrganize();
      if (command === "undo-organize") await handleUndo();
    } catch (e) {
      console.error("command handler error:", e);
    }
  })();
});
//# sourceMappingURL=background.js.map
