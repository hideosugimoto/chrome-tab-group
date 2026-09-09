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

## Never touch groups the user made

The extension modifies **only** the tab groups it created itself.

`chrome.tabGroups` gives no way to tell whether a group is one of
Chrome's *saved* tab groups — `TabGroup` exposes `id`, `windowId`,
`collapsed`, `color`, `title` and `shared`, and nothing else. So the
rule is ownership-based, not saved-state-based:

- `src/storage/managedGroups.ts` is the registry of groups we created.
  It lives in `chrome.storage.session` because Chrome tab group IDs are
  only valid for the current browser session — persisting them in
  `local` would risk a stale ID pointing at somebody else's group.
- A tab whose `groupId` is neither `-1` nor in the registry is **out of
  scope**. Do not group it, move it, or count it as organizable.
- `domain/groupTitle.ts#recognizeGroupTitle` is the only fallback for
  re-adopting our own groups once the registry is gone — it is cleared
  when the extension is disabled, reloaded or updated, and on browser
  restart. It requires title **and** color to match. Keep it strict.

Never reintroduce the old "ungroup everything, then rebuild" approach.
Grouping is differential: `domain/groupPlan.ts` computes the minimum
set of operations, and tabs already in the right place are not moved.

## Automatic grouping stays quiet

`background/autoGroup.ts` runs on tab events. It is off by default and
must stay conservative — an organizer that moves tabs unexpectedly is
worse than one you have to press.

Its three invariants:

- **Never creates a group.** It runs `organizeWindow` with
  `assignOnly: true`; if the right group does not exist, the tab stays
  where it is.
- **Never moves the active tab.** Tabs that are focused at flush time
  stay queued until `onActivated` releases them.
- **Never writes the undo snapshot** (`skipSnapshot: true`), so "undo
  the last organize" keeps pointing at the user's own last action.

`domain/autoGroupTrigger.ts` decides what counts as a real change.
A `groupId` change is deliberately NOT a trigger — that is what our
own writes look like from the outside, and reacting to it would
re-enter the grouping pass. Do not widen the trigger set without
working through that loop.

The pending queue lives in `chrome.storage.session`
(`storage/pendingAutoGroup.ts`), not a module variable: the MV3
service worker can be torn down between the tab event and the
debounce firing.

## Overrides are the user's word

`settings.categoryOverrides` (see `domain/overrides.ts`) records
one-click corrections from the popup. They are evaluated **before**
every built-in rule, including the local-environment heuristic. Do not
add a rule that can beat an override.

## Tests

`npm test` bundles `tests/**/*.test.ts` with esbuild and runs
`node --test`. No test framework dependency — keep it that way.

Only the pure layers (`domain`, `rules`, `scoring`, `utils`) are under
test, which is exactly why they must stay free of `chrome.*`. New pure
logic needs tests in the same commit.

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
