# chrome-tab-group — Notes for AI agents

This file is loaded automatically by Claude Code when working in this
repository. Read it before making changes.

## CRITICAL: dist/ must always be in sync with src/

End users install this extension by loading the prebuilt `dist/`
folder directly into Chrome — they do **not** run `npm run build`
themselves. If `src/` and `dist/` drift, every downstream user
gets stale code.

### The rule

**Whenever you change anything under `src/`, you MUST run `npm run
build` and include the resulting `dist/` updates in the same commit.**

### Enforcement

A pre-commit hook at `.githooks/pre-commit` enforces this:

1. Detects staged files under `src/`
2. Runs `npm run build`
3. Stages the resulting `dist/` updates
4. Aborts the commit on build failure

The hook is wired up by `npm install` via the `prepare` script
(`git config core.hooksPath .githooks`). If you cloned the repo and
have not run `npm install` yet, run it once.

### Forbidden

- **Never** use `git commit --no-verify` to bypass the hook.
- **Never** edit `dist/` by hand. It is generated output. Edit
  `src/` and let the build produce `dist/`.
- **Never** delete or disable `.githooks/pre-commit`.
- **Never** remove the `prepare` script from `package.json`.

If the hook fails, fix the underlying issue (build error, missing
`node_modules`, etc.) and re-commit. Do not work around it.

## Architecture rules

Layered, deliberately. Keep these boundaries intact:

| Layer | May import | May NOT import |
|---|---|---|
| `src/domain`, `src/rules`, `src/scoring`, `src/utils`, `src/constants`, `src/types` | Each other, pure JS only | `chrome.*` |
| `src/services/*` | `chrome.tabs`, `chrome.tabGroups`, `chrome.windows` | `chrome.storage` |
| `src/storage/*` | `chrome.storage` | `chrome.tabs` etc. |
| `src/background/*` | All of the above | — |
| `src/popup/*` | Sends messages to background only | `chrome.tabs` directly |

In short: classification logic must stay pure and Chrome-API-free.
Tab/group manipulation lives in `services/`. The popup never touches
tabs directly — it sends a message to the background SW.

## Classification rules are data, not code

When adding a new service to the classifier:

- Edit `src/rules/domainRules.ts` (or `pathRules.ts` / `titleRules.ts`).
- Add a row to the array. Do not add `if` branches inside `classify.ts`.
- Place more specific rules above broader ones (first match wins).
- For URL-context disambiguation (e.g. `/admin` vs `/docs` on the same
  host), use `pathInclude` / `titleInclude`.

## Zero-network is non-negotiable

This extension makes no external requests. Do not introduce:

- `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`
- Any external script tag, CDN import, or remote font
- The `host_permissions` manifest key
- Any analytics, telemetry, or error-reporting service
- AI / LLM API calls of any kind

If you think you need one of the above, the answer is no. Open an
issue first.

## Manifest permissions

Currently: `tabs`, `tabGroups`, `storage`. Adding any new permission
requires explicit user discussion in the PR / commit message.

## Distribution flow reminder

```
edit src/  →  git add src/...
            →  git commit         ← hook auto-builds and stages dist/
            →  git push            ← downstream users get fresh dist/
```

If you skip the hook or it gets disabled, downstream users get stale
code. Treat this as a correctness bug.
