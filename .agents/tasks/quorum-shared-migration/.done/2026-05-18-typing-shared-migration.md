---
type: task
title: "Typing Indicators — Migration to quorum-shared"
status: ready
created: 2026-05-18
updated: 2026-05-19
related_docs:
  - .agents/docs/features/messages/typing-indicators.md
  - .agents/docs/quorum-shared-architecture.md
related_tasks:
  - .agents/tasks/.done/2026-05-18-typing-indicators-design.md
  - .agents/tasks/quorum-shared-migration/designs/2026-03-19-hooks-design.md
  - .agents/tasks/quorum-shared-migration/designs/2026-05-18-services-design.md
---

> **2026-05-19 status check.** Plan still valid. Line counts in this doc are slightly outdated (current actuals: `TypingService.ts` is 300 lines, `TypingService.unit.test.ts` is 482 lines — both grew during the typing-indicators feature work but the dependency profile and migration verdict are unchanged). Ready to execute.

# Typing Indicators — Migration to quorum-shared

## Context

The typing-indicators feature ([typing-indicators.md](../../docs/features/messages/typing-indicators.md), branch `feat/msg-typing-indicator`) was implemented entirely in `quorum-desktop`. Following the project's principle that data-protocol code must be identical across web and mobile to preserve P2P sync, parts of this feature belong in `@quilibrium/quorum-shared`.

This task captures a per-file audit of the typing feature against quorum-shared's existing patterns. The most relevant precedent is **SyncService**: a platform-agnostic service class that already lives in `quorum-shared/src/sync/` and follows the "platform supplies storage/transport callbacks, service contains the protocol logic" pattern. Receipts migrated their types only, but that may have been pragmatic scope-trimming rather than a principled judgment that ReceiptService couldn't be shared — don't take it as proof that services should stay in desktop.

## Per-file audit (first-principles, not by analogy to receipts)

I inspected each piece of the typing feature for actual platform dependencies, not assumed ones.

### `src/types/typing.ts` — SAFE TO MIGRATE NOW

53 lines. Contents:
- `TypingMessage` interface (wire type)
- `TypingMessageType` union
- `TypingScope` discriminated union (DM / space-channel / thread)
- `scopeKey(scope)` pure function
- `scopeFromMessage(msg)` pure function

Dependencies: none. No imports beyond `type` aliases used by callers. No DOM, no Node, no React, no platform APIs.

The wire format MUST be identical on web and mobile for the feature to work cross-platform once mobile implements typing. The helpers are pure and produce identical output for identical input across any JS environment.

**Verdict: Tier 1. Migrate as a focused PR. Lowest possible risk.**

### `src/services/TypingService.ts` — SAFE TO MIGRATE NOW

226 lines. I read it line-by-line. Dependencies:
- `logger` — already exported from quorum-shared
- Types from `./types/typing` — would move alongside (or be imported from shared after the types move)
- `Map`, `Set`, `setTimeout`, `clearTimeout`, `Date.now()` — universal JS
- `Array.from`, `.values()`, `.keys()` — standard

Zero references to:
- DOM (`window`, `document`)
- Node (`fs`, `crypto`)
- React (`useEffect`, `useState`)
- IndexedDB, MMKV, any storage
- Encryption SDK
- React Native APIs

The constructor takes `TypingServiceOptions` containing the only platform-specific things:
- `selfAddress: string` — caller passes their own address
- `sendDM(address, msg): Promise<void>` — caller wraps platform encryption + transport
- `sendSpace(spaceId, msg): Promise<void>` — same
- `isEnabledForScope(scope): boolean` — caller reads platform-specific user-config storage

This is the exact same pattern as `SyncService` already in `quorum-shared`: the service contains protocol logic, the platform supplies storage + transport adapters via the constructor.

**Migrating TypingService to shared is not pioneering. It follows the SyncService precedent precisely.**

The class also imports `scopeKey` and `scopeFromMessage` from `types/typing`, so the types module must move first (or together).

**Verdict: Tier 1. Migrate alongside types, in the same PR. Constructor surface is already platform-agnostic by design — no interface redesign required.**

### `src/dev/tests/services/TypingService.unit.test.ts` — MOVES WITH THE SERVICE

313 lines of vitest tests covering the service in isolation. Uses fake timers, mock callbacks, no platform-specific test setup. quorum-shared already has `src/sync/service.test.ts` (visible in its source tree), so testing services in shared is an established pattern.

**Verdict: Tier 1. Travels with the service.**

### React hooks (`useTypingNotifier`, `useTypingIndicator`) — DEFER

These hooks couple to React's API (`useEffect`, `useState`, `useRef`, `useCallback`) AND to desktop's `useMessageDB` context. React Native uses the same React API so the hook logic itself could work on mobile, but the context dependency would need parameterization.

Two reasons to defer:
1. **Hooks migration is the team's separately-tracked initiative** ([hooks-migration-design.md](designs/2026-03-19-hooks-design.md)), currently BLOCKED on mobile codebase access. Don't fragment that work by migrating typing hooks in isolation.
2. **Small surface, easy to duplicate if mobile needs it before the hooks migration unblocks.** Both hooks combined are ~110 lines.

**Verdict: Tier 2. Defer to the broader hooks migration.**

### `TypingIndicator.tsx` + `.scss` — STAYS PER-APP

Business component using Tailwind, Lingui, raw HTML. Per the architecture rule table, business components live in each app. Mobile builds its own version. The existing `TypingIndicator.native.tsx` stub already in desktop is correct cross-platform scaffolding.

**Verdict: Stays per-app. Not a migration candidate.**

### `MessageService` changes — STAYS PER-APP

Both the send paths (`sendEphemeralDMControl`, `sendEphemeralSpaceControl`) and the receive intercept depend on `messageDB`, `actionQueueService`, hub envelope handling, and other platform-specific machinery. The intercept code is small but inseparable from the platform's decrypt pipeline.

The receive intercept does check `raw.type === 'typing-start' || raw.type === 'typing-stop'`. That literal-string comparison could be a tiny helper exported from shared (`isTypingControlMessage(raw)`) to guarantee desktop and mobile use the same type strings — but the win is marginal since the strings already come from the shared `TypingMessageType` union.

**Verdict: Stays per-app. Optionally export an `isTypingControlMessage` helper in shared, but probably unnecessary.**

### `MessageDB.tsx` wiring — STAYS PER-APP

Desktop-specific React context. Mobile has its own equivalent. Not a migration candidate.

### `Privacy.tsx` (settings UI) — STAYS PER-APP

Per-app UI. Not a migration candidate.

### `typingIndicatorsDM` / `typingIndicatorsSpaces` on UserConfig — INTENTIONALLY DEFER

`UserConfig` exists in BOTH `quorum-desktop/src/db/messages.ts` (local) and `quorum-shared/src/types/user.ts`. They are DIFFERENT shapes today: desktop's local copy has `deliveryReceipts`, `readReceipts`, and now my additions `typingIndicatorsDM` and `typingIndicatorsSpaces`. Shared's version has NONE of these.

This divergence is a real cross-platform bug for UserConfig sync — but it predates typing-indicators and applies equally to receipts. Migrating typing fields alone (without the receipt fields) would create an awkward halfway state: shared knows about typing globals but not receipt globals.

The right fix is a consolidated UserConfig migration that lifts ALL the desktop-local privacy fields (`deliveryReceipts`, `readReceipts`, `typingIndicatorsDM`, `typingIndicatorsSpaces`) into shared's UserConfig together. That's its own task; it shouldn't be bundled with typing.

**Verdict: Flag the divergence in the broader "UserConfig consolidation" follow-up. Don't add ONLY the typing fields to shared.**

## Recommended Tier 1 PR

A single PR to `quorum-shared` that adds the types AND the service together. Larger than the receipts types-only PR, but more honest about what's actually portable.

### Files to add to quorum-shared

```
src/types/typing.ts                  (new, ~53 lines, copy from desktop)
src/typing/service.ts                (new, ~226 lines, copy from desktop)
src/typing/service.test.ts           (new, ~370 lines incl. freshness/onSettingDisabled, copy from desktop tests)
src/typing/index.ts                  (new, barrel re-export)
```

Folder layout matches `src/sync/` (service.ts + service.test.ts + types.ts + index.ts barrel).

### Updates to quorum-shared barrel

`src/types/index.ts` re-exports the typing types.
`src/index.ts` re-exports `TypingService` and types.

### Files to update in quorum-desktop (after the shared version publishes)

- Delete `src/types/typing.ts`
- Delete `src/services/TypingService.ts`
- Delete `src/dev/tests/services/TypingService.unit.test.ts` (the tests now live in shared)
- Update importers:
  - `src/services/MessageService.ts` — change `import type { TypingMessage } from '@/types/typing'` to `from '@quilibrium/quorum-shared'`
  - `src/components/context/MessageDB.tsx` — change `import { TypingService } from '@/services/TypingService'` to `from '@quilibrium/quorum-shared'`
  - `src/hooks/business/messages/useTypingNotifier.ts` — same for `TypingScope` type
  - `src/hooks/business/messages/useTypingIndicator.ts` — same
  - `src/components/message/TypingIndicator.tsx` — same
  - `src/components/direct/DirectMessage.tsx` — same
  - `src/components/space/Channel.tsx` — same
  - `src/components/thread/ThreadPanel.tsx` — same

### Verification

- quorum-shared: new service tests pass (`yarn test` in shared)
- quorum-desktop: after publishing new shared version, type-check clean, all 421 existing tests still pass
- Manual two-account QA: typing still works in DMs and spaces

### Estimated effort

One focused day. Most of the work is updating ~8 import paths in desktop after the shared PR merges and a new version is published. The service code itself moves verbatim — no rewrite.

## What this task explicitly does NOT migrate

- **React hooks** (`useTypingNotifier`, `useTypingIndicator`) — deferred to the broader hooks migration which is blocked on mobile codebase access.
- **UI components** (`TypingIndicator.tsx`, `.scss`) — per-app forever per the architecture rule.
- **MessageService intercept and send paths** — platform-specific by nature.
- **MessageDB wiring** — desktop-specific React context.
- **Privacy modal UI** — per-app.
- **UserConfig field additions** — deferred to a consolidated privacy-fields-to-shared task that also covers the existing receipt-globals divergence.

## Sequencing with other open migrations

- **Hooks migration (BLOCKED):** doesn't block this task. Types + service are independent of the hooks work.
- **UserConfig consolidation (not yet scoped):** also doesn't block this task. Typing's UserConfig fields stay desktop-local until that consolidation lands; the gate inside the shared service reads them via the platform-supplied `isEnabledForScope` callback, so the service doesn't care whether they live in shared or local.
- **Future receipts service migration:** the receipts work migrated types only. If the team later decides to migrate `ReceiptService` (the parallel service class) to shared, this typing migration is the precedent that confirms the pattern works.

## Done criteria

For the Tier 1 PR (types + service together):

- [ ] PR opened against `quorum-shared` adding types + service + tests
- [ ] Tests pass in quorum-shared (`yarn test` includes the new typing tests)
- [ ] New quorum-shared version published
- [ ] PR opened against `quorum-desktop` (this branch or a follow-up) updating import paths and deleting the local files
- [ ] Desktop type-check clean after the swap
- [ ] All 421 existing desktop tests still pass (the 32 typing tests now live in shared and run there)
- [ ] Manual two-account QA: typing still works end-to-end in DMs and spaces

For Tier 2 (deferred):

- [ ] When hooks migration unblocks, lift `useTypingNotifier` and `useTypingIndicator` along with the rest.
- [ ] When UserConfig consolidation happens, lift `typingIndicatorsDM` / `typingIndicatorsSpaces` (and receipt globals) together.

---

## What I changed in this analysis vs. my first draft

The earlier draft of this task (which the user pushed back on) over-relied on the receipts-shared PR as a template. I was treating "receipts only migrated types, so be conservative" as a principle. That was wrong:

- I hadn't actually checked whether `SyncService` was in shared (it is, plus its tests).
- I hadn't audited `TypingService` line-by-line — I'd assumed an "interface design with mobile in mind" hedge applied. It doesn't: the constructor surface is already the abstraction. There's nothing to redesign.
- "Receipts didn't migrate the service" turned out to be a pragmatic scope-trim, not a principled judgment.

The corrected analysis above is based on first-principles inspection of platform dependencies, not analogy. Service migrates with types because both are genuinely platform-agnostic, and the SyncService precedent confirms the pattern works.

---

*Created: 2026-05-18 — companion task to the typing-indicators feature; second draft after first-principles audit (initial draft was over-conservative).*
