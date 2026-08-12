---
type: task
title: "Unshipped security branches from the key-material audit (local, not pushed)"
status: in-progress
priority: medium
created: 2026-08-12
updated: 2026-08-12
area: key handling / release tracking
related:
  - .agents/issues/.secret/local-data-protection/2026-08-12-key-material-exposure-audit.md
  - .agents/issues/.open/2026-08-12-download-key-button-has-no-confirmation.md
  - .agents/issues/.open/2026-08-12-clipboard-auto-clear-promise-ignores-clipboard-managers.md
---

# Unshipped security branches (local, not pushed)

Work from the key-material egress audit is finished and **committed on local
branches in the `.worktrees/secondary` worktree**. Nothing is pushed. This file
exists so those branches are not forgotten — without it they are invisible until
someone runs `git branch`.

## The branches

| Branch | What it is | Verified | Next action |
|---|---|---|---|
| **`fix/account-key-confirmations`** | Download-key confirmation (F4), clipboard-promise wording (F8), and all three Account Key actions redesigned to confirm through a modal (Download / Copy / Show QR), QR in its own modal. | ✅ Tests + typecheck + lint green. Modals visually confirmed by Kyn. | **Ready to ship.** Push, PR, merge. |
| **`fix/tighten-csp-v2`** | Tightens the Content Security Policy so the app can only send data to its own API (was `default-src *`). Stacked on the branch above. | ⚠️ Tests green, but **not run against a real page load.** | **Soak first.** See below, then push/merge. |

The CSP is deliberately a **separate** branch: it is the one change whose failure
is felt by users (a blocked resource), and it had two real breaks caught in
review, so it must not ride in with the low-risk UX fixes. It was NOT removed —
it is complete and committed, just quarantined until soaked.

## How to soak the CSP before shipping it

On `fix/tighten-csp-v2`:

1. `yarn build:preview` (serves the built app with the real enforcing policy), or
   `yarn dev` (serves a relaxed policy and logs violations against the strict one).
2. With the browser console open, exercise: a YouTube link + click to play, a
   custom emoji, a sticker, a remote avatar (e.g. a member with a Farcaster
   image), an invite link, a backup export.
3. **Pass** = nothing works differently and no `Refused to…` (build:preview) or
   `[Report Only] Refused to…` (dev) lines appear.
   **Known exception:** `yarn dev` prints exactly one report-only refusal per page
   load for Vite's inline React Refresh preamble. That one is expected and
   dev-only.
4. Any other `Refused to…` line names the exact directive and URL to add to
   `web/csp.ts`. Fix, re-soak, then ship.

## Not in this file

A third, security-sensitive branch from the same audit is tracked privately in
the `.secret/` epic and must **not** be pushed. It is intentionally omitted here.

## Status

Filed 2026-08-12. Two branches complete and local. `fix/account-key-confirmations`
is ready to push; `fix/tighten-csp-v2` waits on the manual soak above. Delete this
file once both have merged.

*Last updated: 2026-08-12*
