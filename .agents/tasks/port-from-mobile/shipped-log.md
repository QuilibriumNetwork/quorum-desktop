---
type: log
title: Port-from-mobile shipped log
status: living
created: 2026-06-01
updated: 2026-06-01
---

# Port-from-mobile shipped log

Chronological history of features ported from `quorum-mobile` to `quorum-desktop`, with lessons learned at the top.

## Top-level lessons

- **Symbol-grep is not capability-verification.** The same capability can exist on both apps under different names and different architectures. Two candidates were knocked off in one session this way: #2 Message search (different impl, same UX — desktop uses `<GlobalSearch>` embedded in DM/Channel headers) and #3 Reply tracking (mobile MMKV counter vs desktop's `useReplyNotificationCounts` derived from `MessageDB`). The workflow now requires stating the capability in plain terms and grepping desktop for the *concept*, not the mobile symbol.
- **Port the capability, not the mobile UX pattern.** Mobile UX choices reflect mobile chrome and constraints. Desktop has different chrome and a different UX model (Discord-style spaces + DMs split, not Telegram-style unified list). A feature being shipped on mobile means the *capability* is real; whether the *UX pattern* fits desktop is a separate judgment. Default to desktop's UX language; ask the user when in doubt.
- **The effort is a two-way diff, not a one-way port.** When desktop's implementation is better than mobile's, log it in [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md) as a future port-to-mobile candidate for the lead dev. We don't act on those directly (mobile is read-only), but recording them gives the lead a curated convergence list.

## 2026-06-01 — folder scaffolded + initial inventory + capability-verification pass

- Created `.agents/tasks/port-from-mobile/` with README, workflow, candidates, shipped-log, desktop-better-than-mobile.
- Pulled all three repos; confirmed mobile master at `0fa63d4` (2026-05-30), shared at `9d1c08f` (2026-05-30).
- Session branch: `session-2026-06-01`.
- Inventory pass identified 26 candidate features.
- Capability-verification rule introduced after two candidates (#2, #3) were initially ranked as "ready to pick" then knocked off when closer reading found desktop has them under different names.
- **Final status after this session:**
  - 🟢 **#1 Discover spaces** — user's first pick. Capability-verified missing on desktop (`JoinSpaceModal` + `AddSpaceModal` are invite-link-only). Next session: draft task file.
  - 🟢 **#6 Public profile UI** — capability-verified missing. Queued behind #1.
  - ⏸️ **#5 Reporting** — capability missing but deprioritized (user call: not a near-term product priority).
  - ❌ **#2 Message search** — desktop has it via `<GlobalSearch>` embedded in DM + Channel headers.
  - ❌ **#3 Reply tracking** — desktop has it under a different name (`useReplyNotificationCounts`), strictly better. Logged in `desktop-better-than-mobile.md` #1 as a future port-to-mobile candidate.
  - ❌ **#4 Last-message-preview / spaces sort** — UX-pattern conflict (Discord vs Telegram model).
  - ⚠️ **#8 OG metadata** — Farcaster-only on mobile; not a chat feature. Demoted.
  - ❔ Product-scope candidates (#9 Farcaster, #12 QNS, #13 Wallet, #14 Calling, #15 Audio spaces, #16 Miniapps, #17 Governance) — need product decisions before scoping.

---

*Last updated: 2026-06-01*
