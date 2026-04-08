# Engineer Tab Organizer

A rule-based, **AI-free**, **zero-network** Chrome extension that groups your
tabs by *work context* — Chat, Review, Dev, Local, Docs, Research, Cloud,
Data, Design, AI, Misc.

Built for engineers whose tabs sprawl all day. Manifest V3, TypeScript,
no telemetry, no external API calls, no autoplay magic.

---

## Features (MVP)

- **Organize now** — groups tabs in the current window into 11 colored
  categories using a deterministic, data-driven rule table.
- **Suggest split pairs** — proposes the top 5 tab pairs you probably
  want to view side-by-side (e.g. PR ↔ localhost, Docs ↔ Local).
- **Undo last organize** — restores the previous tab order, group
  membership, group title and color (1-step undo).
- **Pinned tabs ignored by default**, special URLs (`chrome://`,
  `devtools://`, `chrome-extension://`, etc.) safely skipped.
- **Settings persisted** in `chrome.storage.local` (no cloud sync).
- **Keyboard shortcut**: `Cmd/Ctrl + Shift + O` to organize.

---

## Install

There are two paths depending on whether you just want to **use** the
extension or **develop** it.

### 👤 For users (no Node.js required)

You only need the prebuilt `dist/` folder. No `npm`, no build step.

1. Get the `dist/` folder
   - If you received a zip: unzip it somewhere stable (e.g.
     `~/chrome-extensions/engineer-tab-organizer/dist`).
     **Do not** delete it after loading — Chrome reads from this path.
   - If you cloned the repo: the `dist/` folder is already included.
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** ON (top right).
4. Click **Load unpacked**.
5. Select the `dist/` folder.
6. The Engineer Tab Organizer icon appears in the toolbar. Pin it for
   one-click access.

**Updating to a new version**
- Replace the `dist/` folder contents with the new ones (same path).
- Open `chrome://extensions` and click the ↻ reload icon on the
  Engineer Tab Organizer card.

**Uninstall**
- Open `chrome://extensions` → click **Remove** on the card.

---

### 🛠 For developers (modifying the code)

#### Prerequisites
- Node.js 18+

#### First-time setup
```bash
npm install
```

This installs dev dependencies **and** wires up a pre-commit hook
(`.githooks/pre-commit`) that automatically rebuilds `dist/` whenever
you commit changes under `src/`. The hook only runs the local
`npm run build` (esbuild bundling) — no network, no secrets, no
auto-installs. Do not bypass it with `--no-verify`; if it fails, fix
the underlying build error and recommit.

#### Build
```bash
npm run build       # one-shot build → dist/
npm run watch       # rebuild on file changes
npm run typecheck   # tsc --noEmit, no output
```

After building, load `dist/` into Chrome the same way as the user
flow above (`chrome://extensions` → Load unpacked → `dist/`). When you
rebuild, click the ↻ reload icon on the extension card to pick up
changes.

#### Distributing your build to teammates
1. `npm run build`
2. Zip the `dist/` folder (`zip -r dist.zip dist`) and share it, or
   commit `dist/` to the repo so teammates can `git pull` and reload.
3. Teammates follow the **For users** instructions above.

> ⚠️ **Always rebuild before sharing.** If you edit anything under
> `src/` and forget to run `npm run build`, the `dist/` you ship will
> be stale.

---

## Usage

1. Click the extension icon → popup shows current category preview.
2. **Organize now** — tabs in the current window get bucketed into
   groups in the canonical order: `Chat → Review → Dev → Local → Docs
   → Research → Cloud → Data → Design → AI → Misc`.
3. **Suggest split pairs** — top candidates appear in the popup. (MVP
   does not drive Chrome's split view directly; it just surfaces the
   pairs.)
4. **Undo last organize** — reverts the previous Organize call.
5. **Settings**:
   - *Ignore pinned tabs* — pinned tabs are not moved or grouped.
   - *Keep active tab position* — after grouping, the active tab is
     nudged back toward its original index when reasonable.

---

## Manual test checklist

| Case | Expected |
|------|----------|
| `github.com/owner/repo` | **Dev** |
| `github.com/owner/repo/pull/42` | **Review** |
| `github.com/owner/repo/issues/7` | **Review** |
| `github.com/owner/repo/actions` | **Cloud** |
| `docs.google.com/document/...` | **Docs** |
| `docs.google.com/spreadsheets/...` | **Data** |
| `drive.google.com/...` | **Docs** |
| `slack.com/...` | **Chat** |
| `teams.microsoft.com/...` | **Chat** |
| `localhost:3000` | **Local** |
| `staging.example.com` | **Local** |
| `figma.com/file/...` | **Design** |
| `chatgpt.com` / `claude.ai` | **AI** |
| `*.datadoghq.com` | **Cloud** |
| `metabase` / `looker` / `redash` | **Data** |
| `stackoverflow.com` / MDN | **Research** |
| Pinned tab | Not moved |
| `chrome://settings` | Untouched |
| Tab with empty title | Does not crash |
| Undo after Organize | Restores previous indexes / groups |

---

## Architecture

```
src/
├── background/        Service worker. Message router, organize/undo/suggest orchestration.
├── popup/             Popup UI (HTML/CSS/TS). No tab logic — only sends messages.
├── domain/
│   ├── classify.ts    Pure function: (url, title) -> Category. No Chrome API.
│   ├── categoryOrder.ts
│   └── exclusion.ts   Special URL detection.
├── rules/
│   ├── domainRules.ts Single source of truth for service → category mapping (data, not code).
│   ├── pathRules.ts   Domain-agnostic path heuristics.
│   ├── titleRules.ts  Title-keyword fallback.
│   └── localPatterns.ts  Local / staging / qa heuristics.
├── scoring/
│   └── splitPair.ts   Pure scoring of tab pairs.
├── services/
│   ├── tabsService.ts        Thin wrapper around chrome.tabs.
│   └── tabGroupsService.ts   Thin wrapper around chrome.tabGroups.
├── storage/store.ts   Settings + Undo snapshot persistence.
├── constants/         Categories, colors.
├── types/             Shared TypeScript types.
└── utils/             URL parsing, text similarity.
```

### Layering rules

- `domain/`, `rules/`, `scoring/`, `utils/`, `constants/`, `types/`
  contain **pure** code: no `chrome.*` imports, easy to unit test.
- `services/` is the only place that touches `chrome.tabs` /
  `chrome.tabGroups`.
- `storage/` is the only place that touches `chrome.storage`.
- `background/` and `popup/` orchestrate; they never duplicate domain
  logic.

### Adding a new service

Open `src/rules/domainRules.ts` and append a row, e.g.:

```ts
{ name: 'my-service', hostMatch: /(^|\.)my-service\.com$/, category: 'Cloud' }
```

For URL-context disambiguation (e.g. `/admin` vs `/docs` on the same
host), add a `pathInclude` regex. Place more specific rules above
broader ones — first match wins.

---

## Classification rule summary

**Order of evaluation**

1. Local / staging heuristics (`isLocalUrl`)
2. User custom rules (reserved — not yet UI-editable)
3. Built-in domain rules (host + optional path / title qualifiers)
4. Domain-agnostic path rules
5. Title keyword rules
6. → `Misc`

Rule data lives in `src/rules/*.ts` so you can scan it in 30 seconds
and tune without touching control flow.

Coverage out-of-the-box (non-exhaustive):

- **Chat** — Slack, Teams, Chatwork, Gmail, Google Chat, Outlook,
  Discord, Zoom, Meet, Webex, LINE WORKS, Mattermost, Messenger.
- **Review** — Jira, Backlog, Trello, Asana, Monday, ClickUp, Linear,
  Redmine, YouTrack, Azure DevOps Boards, GitHub PR/Issues, GitLab MR,
  Bitbucket PR, SharePoint approval/task pages.
- **Dev** — GitHub/GitLab/Bitbucket repository roots, Sourcegraph,
  npm/yarn/pnpm/Packagist/PyPI/RubyGems/crates.io, Docker Hub, Snyk,
  SonarCloud.
- **Local** — `localhost`, `127.0.0.1`, `*.local`, RFC1918 ranges,
  `staging`/`stage`/`stg`/`dev`/`qa`/`test`/`preview`/`sandbox` in
  hostname or path.
- **Docs** — Google Docs/Slides/Forms, Drive, Sites, Notion,
  Confluence, SharePoint (non-approval), OneDrive, Dropbox/Paper, Box,
  Coda, Scrapbox, esa, Kibela, Qiita Team.
- **Research** — Stack Overflow/Exchange, MDN, developer.chrome.com,
  DevDocs, Qiita, Zenn, Medium, HN, Reddit /r/programming-ish, framework
  docs (React, Vue, Next, Nuxt, Node, Python, PHP, Docker, K8s, AWS,
  GCP, Azure Learn, Laravel).
- **Cloud** — AWS Console, GCP Console, Azure Portal, Cloudflare,
  Vercel, Netlify, Render, Railway, Heroku, Firebase, Supabase
  dashboard, PlanetScale, Mongo Atlas, Datadog, New Relic, Grafana,
  Sentry, Elastic Cloud, GitHub Actions, GitLab Pipelines, Bitbucket
  Pipelines, CircleCI, Travis, Azure Pipelines.
- **Data** — Google Sheets, Excel Online, Airtable, BigQuery, Looker
  Studio, Looker, Tableau, Redash, Metabase, Superset.
- **Design** — Figma, FigJam, Miro, Excalidraw, Canva, Whimsical,
  Lucid, draw.io / diagrams.net.
- **AI** — ChatGPT, Claude, Gemini, Perplexity, OpenAI Platform,
  Anthropic Console, Google AI Studio, Azure OpenAI, Poe, NotebookLM,
  Hugging Face, LangSmith.

---

## Future extension points

- **Side Panel** — `chrome.sidePanel` can replace / augment the popup
  with no domain refactor (UI lives in `popup/` only).
- **Custom rules editor** — `Settings.customRules` field already exists
  and is wired through `classify()`. A future settings page can write
  to it.
- **Per-URL category overrides** — `Settings.categoryOverrides` is
  reserved.
- **Multi-window organize** — domain layer is pure; the orchestrator
  just needs to iterate windows.
- **Pluggable AI classifier** — `classify()` is a single pure function;
  swap or chain it without touching the rest.
- **Split-pair history learning** — `Settings.splitPairHistory` is
  reserved; the scoring module can read past acceptances to boost
  scores.

---

## Intentionally NOT in MVP

- AI / LLM classification.
- Any external HTTP request.
- Cross-window optimization.
- Real-time auto-organize on tab create.
- A custom rule editor UI.
- Account / cloud sync.
- Side Panel implementation (structure-ready, not built).
- Driving Chrome Split View directly.
- Heavy animations or theming.

---

## Privacy

- No network calls.
- No telemetry.
- All state lives in `chrome.storage.local` on your machine.
