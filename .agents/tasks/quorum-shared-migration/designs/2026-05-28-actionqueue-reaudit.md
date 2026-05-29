---
type: design
title: "ActionQueueService re-audit: verdict is stays-per-app"
status: done
created: 2026-05-28
audience: future sessions reviewing the migration tracker's ActionQueueService row
related_docs:
  - .agents/tasks/quorum-shared-migration/designs/2026-05-18-services-design.md
  - .agents/tasks/quorum-shared-migration/designs/2026-05-28-hooks-audit-refresh.md
---

# ActionQueueService re-audit (2026-05-28)

> **Verdict: stays per-app.** Mobile's `services/offline/mutationQueue.ts` is NOT a parallel of desktop's `ActionQueueService` — different scope, different problem, zero active callers. The March 2026 audit's "Tier 1 — one small refactor required" classification is technically still true for the desktop side, but the migration would extract a service that mobile has no use for. **Update the status table row from `⏸️ Re-evaluate` to `❌ Stays per-app`.**

## Why this re-audit exists

The [2026-05-18 services design doc](2026-05-18-services-design.md) §4 classified `ActionQueueService` as **Tier 1 (migrate now)** with one small refactor (inject `showError` as a callback). The [2026-05-28 hooks audit refresh](2026-05-28-hooks-audit-refresh.md) flagged that mobile's `services/offline/mutationQueue.ts` might be a functional equivalent, requiring a re-evaluation against the post-2026-05-28-public-repo-dump mobile state.

This re-audit verifies the assumption with two parallel deep-dives (one on desktop, one on mobile `origin/master 98d59a4`) and produces a final verdict.

## What's on desktop today

`ActionQueueService.ts` (402 lines) is the **core messaging reliability layer** for desktop. The March audit's structural analysis still holds:

- **Persistence**: IndexedDB via injected `MessageDB`
- **Lifecycle**: started from `MessageDB.tsx` React effect, `setInterval` 1s processing loop, sequential `for...await` batch of 10
- **Retry/backoff**: exponential, 3 retries, 5-minute cap; auth errors short-circuit
- **Multi-tab safety**: `processingStartedAt` timestamp + 30s grace window for crash recovery
- **15 typed handlers** (up from 12 in March — new: `send-delivery-ack`, `send-read-ack`, `reaction-dm`)

Per-platform coupling points that would need adapting if it moved to shared:

| Coupling | Status | Migration impact |
|---|---|---|
| `MessageDB` constructor arg | ✅ injected | No change — `StorageAdapter`-style abstraction already in shared could take its place |
| `showError` import from `../utils/toast` | ⚠️ direct desktop import | Inject as `onError?: (msg: string) => void` callback (March audit's flagged change) |
| `window.dispatchEvent('quorum:queue-updated')` | ⚠️ DOM-guarded but desktop-designed | Inject as `onQueueUpdated?: () => void` callback OR keep window-only |
| `window.dispatchEvent('quorum:session-expired')` | ⚠️ DOM-guarded but desktop-designed | Same — second callback |
| `navigator.onLine` fallback | ✅ already DOM-guarded | No change |
| React Query (`QueryClient`) | ✅ only in `ActionQueueHandlers`, not the service | Handlers stay in desktop; service portable |
| `@lingui/core/macro` | ✅ only in `ActionQueueHandlers` `failureMessage` fields | Handlers stay in desktop |
| Crypto / SDK imports | ✅ only as types in service; runtime crypto in handlers | Service crypto-unaware |

**Bottom line on desktop side**: the March audit's "Tier 1 with one small refactor" stands, with one correction — it's actually **three** small refactors (`onError`, `onQueueUpdated`, `onSessionExpired` as injected callbacks), not one. The service itself is genuinely portable.

## What's on mobile today (verified against `origin/master 98d59a4`)

Mobile has `services/offline/mutationQueue.ts`. Initial scan suggested it was a parallel of desktop's queue. **It is not.**

### Surface

```ts
export interface QueuedMutation {
  id: string;
  type: 'like' | 'unlike' | 'post';   // ← Farcaster only
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

class MutationQueue {
  add(mutation: ...): string
  remove(id: string): void
  incrementRetry(id: string): void
  getAll(): QueuedMutation[]   // lazy-prunes expired/exhausted entries
  getCount(): number
  clear(): void
}

export const mutationQueue = new MutationQueue();   // module-level singleton
```

- **Persistence**: MMKV (`createMMKV({ id: 'quorum-mutations' })`), single JSON blob keyed `'MUTATION_QUEUE'`
- **Retry policy**: 5 retries, 24h expiration, lazy pruning. **No exponential backoff** — caller-driven.
- **Lifecycle**: none. No `start()`, no `stop()`, no processing loop, no network awareness.
- **Concurrency**: none. Synchronous MMKV reads/writes only.

### Scope: Farcaster only

The type union is `'like' | 'unlike' | 'post'`. Reading mobile's `SocialFeedModal.tsx`: it calls `likeCast` / `unlikeCast` from `@/services/farcasterClient` **directly**, with optimistic-revert-on-error. Zero `mutationQueue` calls.

### Decisive finding: zero active callers

Grep of mobile's full tree (origin/master):

```bash
git grep -lE "mutationQueue\\b" origin/master
# Returns only:
#   services/offline/mutationQueue.ts (definition)
#   services/offline/index.ts          (re-export)
#   services/offline/storage.ts        (storage dep)
```

**Nothing in `hooks/`, `components/`, `context/`, or other `services/` imports or calls `mutationQueue.add()`.** It was built as infrastructure for Farcaster offline resilience but **never wired up**. The MMKV partition `quorum-mutations` is instantiated as a side effect (because `storage.ts` is imported by other modules), but nothing ever writes to it.

### What mobile actually does for messaging reliability

Mobile's core message sending (`useSendDirectMessage`, `useSendSpaceMessage`, reactions, edits, etc.) relies on:
- TanStack Query mutations with `retry: 3` + exponential delay in `queryConfig`
- Live `WebSocketContext` for delivery
- Always-online assumption (no persistent queue for offline sends)

If a message fails to send while mobile is offline, it just fails. There is no architectural equivalent to desktop's queue.

## Side-by-side comparison

| Aspect | Desktop `ActionQueueService` | Mobile `mutationQueue` |
|---|---|---|
| Scope | 15 action types: full messaging + moderation + receipts | 3 action types: `like / unlike / post` (Farcaster) |
| Used? | Yes — 17 call sites across business hooks + services | **No active callers** |
| Persistence | IndexedDB (via `MessageDB`) | MMKV (never written) |
| Retry/backoff | Exponential, 3 retries | Manual increment, no backoff |
| Deduplication | Yes (by key) | No |
| Processing loop | Yes (`setInterval` 1s) | None |
| Network awareness | Yes (WebSocket + `navigator.onLine`) | None |
| Keyset gate | Yes — waits for `setUserKeyset()` | N/A |
| Multi-tab safety | Yes | N/A |
| Crypto integration | Deep (Double + Triple Ratchet, kick rekey, etc.) | N/A |

The two systems solve different problems at different scales.

## Verdict

**The migration is not viable.** Three reasons in priority order:

1. **No mobile consumer.** The "follow mobile patterns" workflow rule presupposes that mobile has a working pattern. Mobile doesn't — `mutationQueue` is a 100-line stub nobody calls. Migrating desktop's queue to shared would create a shared service that ZERO mobile code uses today.

2. **Scope mismatch.** Even if mobile started using something, what mobile would want (offline Farcaster like queue) is a tiny subset of what desktop's queue does (crypto-gated message reliability with multi-tab safety, keyset management, exponential backoff, etc.). The shared API would have to either:
   - Match desktop's complexity → mobile builds something it doesn't need
   - Match mobile's simplicity → desktop loses the reliability guarantees it depends on
   - Be configurable enough to do both → ceremony with no current beneficiary
   
   The workflow doc's "don't decide for the lead" rule fires here: speculating about mobile's future offline-action architecture in the absence of any current implementation is exactly that.

3. **Handler dependencies pin most of it to desktop anyway.** Even if the service itself moved, `ActionQueueHandlers` (15 typed handlers + `MessageService`/`SpaceService`/`ConfigService` deps + Lingui i18n strings + React Query cache writes) stays in desktop. The portable piece is small (~400 lines of pure queue mechanics) compared to the handler layer (~1080 lines + 3 service deps). The split looks clean on paper but the value of the split is low given (1) and (2).

## Action items

### Status table update

Change [README.md](../README.md) row from:

> | ActionQueueService | Service | ⏸️ Re-evaluate after mobile public-repo dump (2026-05-28); previously "no actionQueue folder on mobile" — verify still true | designs/2026-05-18-services-design.md §4 |

To:

> | ActionQueueService | Service | ❌ Stays per-app. Re-audited 2026-05-28: mobile's `mutationQueue.ts` is a Farcaster-only stub with zero active callers; the two systems solve different problems. | designs/2026-05-28-actionqueue-reaudit.md |

### Mobile-side observation (not actionable from here)

Mobile has a real architectural gap: **no persistent offline queue for core messaging.** If a user sends a message while offline, it currently fails. This is a mobile-side product decision (the lead-dev may consider this acceptable for a mostly-online mobile app). Worth noting but **not something to fix from the shared migration** — it's a mobile architecture choice.

### Cleanup we noticed (out of scope, but flagging)

- Desktop: `(window as any).__actionQueue = service;` in `MessageDB.tsx:942` — debug artifact left in production code. Untyped global, minor attack surface. Worth removing in a future cleanup PR.
- Mobile: `mutationQueue.ts` has zero callers and might be dead code worth deleting. Lead-dev's call.

Neither is part of this migration.

## What this means for the migration plan

- **No follow-up task file.** This is a "no-op" outcome — we documented why we're not migrating, that's it.
- **No shipped-log entry.** Shipped-log tracks completed migrations. This is a paused-track resolution, not a migration.
- **The audit's roadmap is unaffected.** The hooks track is still the active workstream. SearchService is the next obvious re-audit candidate (similar status row).

## Method (for transparency)

This re-audit was produced by two parallel subagents working from `origin/master` on both repos, with explicit instructions to read mobile files via `git show origin/master:<path>` (since the local mobile working tree is stuck on a Jan 14 commit). Reports were synthesized into this doc. The key claims (mobile mutationQueue has zero callers, type union is Farcaster-only, desktop `showError`+`window.dispatchEvent` couplings unchanged since March) were verified by direct grep and code reads, not inferred.

---

*Created 2026-05-28. Resolves the "⏸️ Re-evaluate" status on the ActionQueueService row. Verdict: stays per-app. No code changes. No PRs.*
