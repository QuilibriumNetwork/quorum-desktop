---
type: task
title: "Services Layer — Migration Design for quorum-shared"
status: open
created: 2026-05-18
updated: 2026-05-18
related_docs:
  - .agents/docs/quorum-shared-architecture.md
  - .agents/docs/features/action-queue.md
  - .agents/docs/features/messages/dm-receipts.md
related_tasks:
  - .agents/tasks/quorum-shared-migration/2026-05-18-typing-shared-migration.md
  - .agents/tasks/quorum-shared-migration/2026-03-19-hooks-migration-design.md
  - .agents/tasks/quorum-shared-migration/2026-03-18-utils-migration-design.md
---

# Services Layer — Migration Design for quorum-shared

## Context

Thirteen service classes (plus one service-like helpers module) live in `src/services/` on quorum-desktop. The architecture principle is that data-protocol logic must be identical across web and mobile for P2P sync to work correctly. Services that contain pure protocol logic — buffering, timers, state machines, adapter-injected I/O — belong in `@quilibrium/quorum-shared`. Services that are tightly fused with desktop-specific runtimes or React Query/React state stay per-app.

Established precedents at the time of this writing:
- **`quorum-shared/src/sync/`** — `SyncService` (pure protocol, storage injected as `StorageAdapter`)
- **`quorum-shared/src/typing/`** (planned, per `2026-05-18-typing-shared-migration.md`) — `TypingService` (pure timers + callbacks, no platform imports)

The `ReceiptService` precedent is deliberately NOT treated as proof that service classes stay in desktop: that was pragmatic scope-trimming, not a principled judgment. This audit follows the same first-principles approach as the typing migration task.

This document intentionally does NOT include `MessageService.ts` in the per-service section below. At ~60 imports wide and 2000+ lines, it is the most complex file in the codebase. An initial scan of its header (lines 1–60) reveals deep coupling to `MessageDB`, `EncryptionState`, `QueryClient`, `secureChannel` SDK operations, `TypingService`, `ReceiptService`, `ActionQueueService`, the full message type tree, `@lingui`, and `DefaultImages`. It is architecturally per-app and is explicitly out of scope for this design task. Any future assessment of MessageService migration belongs in its own dedicated task after the more tractable services are resolved.

---

## Per-Service Audit

### 1. `ReceiptService.ts` — TIER 1: MIGRATE NOW

**218 lines.** I read it line-by-line.

Dependencies:
- `Map`, `Set`, `setTimeout`, `clearTimeout` — universal JS
- No imports at all at the top of the file (no `import` statements — zero external deps)

Platform surface:
- Lines 122–126: `destroy()` references `typeof document !== 'undefined'` and `window.removeEventListener` / `document.removeEventListener` — **guards are already present**.
- Lines 193–203: `setupVisibilityListener()` sets up `document.visibilitychange` and `window.beforeunload` — again guarded with `if (typeof document === 'undefined') return;`.

The constructor takes `ReceiptServiceOptions` containing callbacks only:
- `onFlush(address, messageIds)` — caller handles the actual encrypted send
- `onAckProcessed(messageIds)` — caller updates React Query cache
- `onReadFlush(address, hwm)` — caller enqueues read ack
- `onReadAckProcessed(upToMessageId, upToTimestamp, conversationAddress)` — caller updates cache

This is the exact SyncService/TypingService pattern. The service contains buffer management, timer logic, and high-water mark tracking; the platform supplies transport and cache update callbacks. The `typeof document` guards on the DOM listener already make the class safely no-op in environments without a DOM. On mobile, the caller would simply not register the `visibilitychange` listener (or supply an equivalent lifecycle hook for app backgrounding).

**Verdict: Tier 1. Verified portable. Zero platform imports, constructor surface is already all adapters/callbacks. Migrate alongside its types (`src/types/deliveryReceipt.ts`) in one PR.**

---

### 2. `TypingService.ts` — TIER 1: MIGRATE NOW

Already fully audited in `2026-05-18-typing-shared-migration.md`. Zero platform imports, constructor takes only adapter callbacks, moves verbatim.

**Verdict: Tier 1. See the dedicated migration task. This entry exists for completeness in the tier table.**

---

### 3. `SearchService.ts` — TIER 1: MIGRATE NOW (with one caveat)

**290 lines.** Dependencies:
- `MessageDB` (constructor, all methods delegate to it) — injected
- `NodeJS.Timeout` (line 26, `Map<string, NodeJS.Timeout>`) — type alias; `ReturnType<typeof setTimeout>` is the correct cross-platform form but the runtime behavior is identical
- `Map`, `Date.now()`, `setTimeout`, `clearTimeout`, `RegExp`, `Array` — universal JS
- `console.error` — universal
- No `window`, `document`, `navigator`, `fs`, `React`, `IndexedDB`, `@lingui`, `QueryClient`

The constructor takes `messageDB: MessageDB` and an optional config object (debounce/cache settings). All storage access goes through `messageDB`. The only coupling to desktop is that `MessageDB` is the desktop's concrete IndexedDB class. If the shared version accepted a `searchAdapter` interface instead of `MessageDB` directly, it would be fully portable.

One real issue: `SearchService` calls `messageDB.searchMessages()`, `messageDB.initializeSearchIndices()`, `messageDB.addMessageToIndex()`, and `messageDB.removeMessageFromIndex()`. These are full-text-search-specific DB methods. The shared `StorageAdapter` interface does not currently include them. They would need to be added to `StorageAdapter` (as optional methods) or a separate `SearchAdapter` interface would need to be defined.

**Verdict: Tier 1 — pending one prerequisite.** The logic is portable. The blocker is that `StorageAdapter` needs to grow search-specific methods, or a `SearchAdapter` interface needs to be added to quorum-shared. Adding a `SearchAdapter` interface (4-5 methods) is low-cost. The service logic itself moves verbatim after the interface exists.

---

### 4. `ActionQueueService.ts` — TIER 1: MIGRATE NOW (with DOM caveat)

**401 lines.** Dependencies:
- `logger` from `@quilibrium/quorum-shared` — already shared
- `MessageDB` from `../db/messages` — injected via constructor
- `type ActionQueueHandlers`, `type QueueTask`, `type ActionType`, `type QueueStats` from local types
- `showError` from `../utils/toast` — **single coupling; toast is DOM/platform-specific**
- `type { channel as secureChannel }` from `@quilibrium/quilibrium-js-sdk-channels` — for the keyset type only
- `setInterval`, `clearInterval`, `setTimeout`, `clearTimeout`, `Date.now()` — universal
- Lines 207–212: `navigator.onLine` accessed with `typeof navigator !== 'undefined'` guard — already guarded
- Lines 307–310: `window.dispatchEvent(new CustomEvent('quorum:session-expired'))` — DOM, guarded with `typeof window !== 'undefined'`
- Lines 358–365: `window.dispatchEvent(new CustomEvent('quorum:queue-updated'))` — DOM, guarded with `typeof window !== 'undefined'`

The `showError` import (line 17, from `../utils/toast`) is the one real coupling. `toast.ts` uses `window.dispatchEvent`. It is called in `processTask` at two points (lines 322–325, lines 327–329) to show failure toasts.

The fix: make `showError` injectable. Add an optional `onError?: (message: string) => void` to the constructor options, with a no-op default. On desktop, the caller passes `(msg) => showError(msg)`. On mobile, the caller passes a native toast function.

All `window.dispatchEvent` calls are already `typeof window` guarded — the event-bus coupling is already safe cross-platform (events simply don't fire in React Native; mobile provides its own mechanism).

**Verdict: Tier 1 — one small refactor required.** Change `showError(handler.failureMessage)` to `this.options.onError?.(handler.failureMessage)` (or similar injectable pattern). After that, the service is fully portable. The keyset type from `quilibrium-js-sdk-channels` is already a dependency of quorum-shared (same SDK), so that import does not block migration.

---

### 5. `channelThreadHelpers.ts` — TIER 1: MIGRATE NOW

**56 lines.** Two pure functions: `buildChannelThreadFromCreate` and `updateChannelThreadOnReply`.

Dependencies:
- `stripMarkdown` from `@quilibrium/quorum-shared` — already shared
- `type { ChannelThread, ThreadMeta }` from `@quilibrium/quorum-shared` — already shared
- No platform APIs, no storage, no React, no i18n

Both functions are pure transforms: given inputs, produce an output. No side effects.

**Verdict: Tier 1. Move verbatim to `quorum-shared/src/utils/threadUtils.ts` (or alongside `ThreadService` if that migrates). Lowest possible risk; no interface redesign needed.**

---

### 6. `ThreadService.ts` — TIER 2: DEFERRED (blocks on hooks migration)

**607 lines.** Dependencies:
- `type { QueryClient, InfiniteData }` from `@tanstack/react-query` — React Query coupled
- `type { MessageDB }` from `../db/messages` — injected, OK
- `type { Message, ThreadMessage, ChannelThread }` from `@quilibrium/quorum-shared` — shared, OK
- `buildChannelThreadFromCreate`, `updateChannelThreadOnReply` from `./channelThreadHelpers` — would move with it
- `buildMessagesKeyPrefix` from `../hooks/queries/messages/buildMessagesKey` — **desktop-local hook utility**

The `QueryClient` usage is substantial: `handleThreadCache`, `handleThreadRemoveCache`, `handleThreadReplyCache`, `handleThreadDeletedMessageCache`, `handleThreadSendPostBroadcast` all call `queryClient.setQueriesData`, `queryClient.setQueryData`, `queryClient.invalidateQueries`, `queryClient.removeQueries`. These are TanStack Query v5 APIs — cross-platform in principle (React Native can use TanStack Query), but they couple to the cache model.

The core issue: `buildMessagesKeyPrefix` comes from desktop's query key builders in `src/hooks/`. If those key builders move to shared (part of the hooks migration), `ThreadService` follows naturally. If they don't, the key builders need to be duplicated or the cache-update methods need to be extracted out.

The DB/persistence side of `ThreadService` (`handleThreadReceive`, `handleThreadReplyReceive`, `handleThreadSend`, `handleThreadSendPostBroadcast`) has no platform dependencies other than `MessageDB`. The cache side has TanStack Query + desktop query keys.

A possible intermediate step: split `ThreadService` into `ThreadServiceCore` (pure DB/persistence logic, shareable now) and `ThreadServiceCache` (React Query cache updates, stays per-app until hooks migration). But that's an architectural decision that should be made in the context of the hooks migration.

**Verdict: Tier 2. Blocked on hooks migration (specifically the query key builders moving to shared). `channelThreadHelpers.ts` migrates independently (Tier 1).**

---

### 7. `BackupService.ts` — TIER 2: DEFERRED (Web Crypto API dependency)

**225 lines.** Dependencies:
- `logger` from `@quilibrium/quorum-shared` — shared, OK
- `type { channel as secureChannel }` from `@quilibrium/quilibrium-js-sdk-channels` — keyset type, OK
- `MessageDB`, `EncryptionState` from `../db/messages` — injected via constructor, OK
- `type { Message, Conversation }` from `@quilibrium/quorum-shared` — shared, OK
- **`crypto.subtle.digest`** (line 47) — Web Crypto API
- **`window.crypto.subtle.importKey`** (line 54) — Web Crypto API, `window.` prefix
- **`window.crypto.subtle.encrypt`** (line 98) — Web Crypto API
- **`window.crypto.subtle.decrypt`** (line 172) — Web Crypto API
- **`new Blob(...)`** (line 114) — Web API (export returns a Blob)

The backup encryption/decryption uses `window.crypto.subtle` (AES-256-GCM). React Native does not have Web Crypto — it has `@noble/ciphers`, `react-native-quick-crypto`, or platform-specific crypto. The return type (`Promise<Blob>`) is also browser-specific; mobile would return a `Uint8Array` or `string`.

The platform-agnostic parts (key derivation algorithm, payload structure, domain separation prefix, import/export logic) are conceptually portable, but the actual crypto calls would need a `CryptoProvider` adapter abstraction — similar to how `WasmCryptoProvider` exists in quorum-shared already.

**Verdict: Tier 2. Blocked on a crypto abstraction layer for AES-GCM backup encryption that works on both Web Crypto and React Native. When quorum-shared's crypto module is extended to cover symmetric AES-GCM operations (currently it only has WASM-based E2E encryption), this unblocks.**

---

### 8. `NotificationService.ts` — STAYS PER-APP

**342 lines.** Inspected line-by-line.

Line 39: `'Notification' in window` — browser Notification API check
Line 39: `this.isSupported = 'Notification' in window` — sets `window` context
Line 40: `Notification.permission` — browser Notification constructor
Line 44: `NotificationService.instance` — singleton; `static instance`
Lines 76–95: `Notification.requestPermission(...)` — browser API
Lines 101–103: `isSafari()` — `navigator.userAgent` check
Lines 129, 143: `new Notification(...)` — browser Notification constructor
Lines 144–148: `window.focus()` — browser window
Lines 178–180: `window.focus()` — browser window
Lines 205–209: `document.visibilityState`, `document.hasFocus()` — browser DOM

React Native uses `PushNotificationIOS`, `@notifee/react-native`, or `expo-notifications`. None of these share an API with the Web Notification interface. A shared notification abstraction would be a `NotificationAdapter` interface (request permission, show notification, clear notification), but mobile would implement it with completely different native APIs.

The *business logic* here is very thin (batching, muted conversations). The real content is platform API calls. Unlike `ReceiptService` where the platform calls are callbacks injected from outside, here the platform APIs are invoked directly inside the class body at every method.

**Verdict: Stays per-app. Mobile will implement its own equivalent using native notification APIs. An adapter interface could be defined in shared if needed, but that's optional and forward-looking.**

---

### 9. `ConfigService.ts` — STAYS PER-APP

**609 lines.** Inspected first 100 lines and method signatures.

Line 18: `spaceInfo: React.MutableRefObject<...>` — **React ref in the constructor interface**
Lines 76–79: `await crypto.subtle.digest(...)` + `await window.crypto.subtle.importKey(...)` — Web Crypto
Lines 117–126: `await window.crypto.subtle.decrypt(...)` — Web Crypto
Lines 414–419: `await crypto.subtle.digest(...)` + `await window.crypto.subtle.importKey(...)` — Web Crypto
Lines 491–497: `await window.crypto.subtle.encrypt(...)` — Web Crypto

Also: `buildSpacesKey`, `buildConfigKey` from `../hooks` (desktop query key builders), `QueryClient` passed directly, `t` from `@lingui/core/macro`, and `validateItems` from `../utils/folderUtils` (which is desktop-specific per the utils migration design).

ConfigService is deeply fused with three desktop-specific systems at once: Web Crypto API, React Query key builders, and the React `MutableRefObject` API. Even if the crypto were abstracted, the React ref usage and i18n coupling would remain.

**Verdict: Stays per-app. Three independent coupling points (Web Crypto, React Query keys, React.MutableRefObject). Even migrating one doesn't unblock the others.**

---

### 10. `EncryptionService.ts` — STAYS PER-APP

**265 lines.** Dependencies:
- `sha256`, `base58btc`, `hexToSpreadArray` from `../utils/crypto` — desktop crypto utilities
- `QueryClient` from `@tanstack/react-query` — passed to `ensureKeyForSpace`
- `buildSpacesKey`, `buildConfigKey` from `../hooks` — desktop query key builders
- `channel as secureChannel`, `channel_raw as ch` from `@quilibrium/quilibrium-js-sdk-channels` — protocol SDK
- `t` from `@lingui/core/macro` — i18n
- `DefaultImages` from `../utils` — desktop-specific
- `MessageDB` — desktop-specific

`ensureKeyForSpace` (the main method, lines 71–264) calls `ch.js_generate_ed448()`, `ch.js_generate_x448()`, `ch.js_sign_ed448()`, and `this.apiClient.postSpace()` directly. It also calls `queryClient.setQueryData(buildSpacesKey(...))` — React Query cache update using desktop query keys.

The constructor requires `updateSpace: (space: Space) => Promise<void>` from the caller, but the method body also takes a `QueryClient` parameter — a mixed pattern where some platform coupling is injected and some is hardcoded.

**Verdict: Stays per-app. Coupled to desktop query key builders, React Query, `DefaultImages`, `@lingui`, and desktop crypto utilities simultaneously.**

---

### 11. `SpaceService.ts` — STAYS PER-APP

**1222 lines.** Dependencies (header inspection):
- `React.MutableRefObject` in constructor interface (line 26)
- `QueryClient` from `@tanstack/react-query`
- `buildSpacesKey`, `buildSpaceKey`, `buildSpaceMembersKey`, `buildConfigKey` from `../hooks`
- `channel as secureChannel`, `channel_raw as ch` from `@quilibrium/quilibrium-js-sdk-channels`
- `t` from `@lingui/core/macro`
- `NavItem` from `../db/messages` (desktop-specific type)
- `sha256`, `base58btc`, `hexToSpreadArray` from `../utils/crypto`

The constructor holds `spaceInfo: React.MutableRefObject<...>` (the same React ref pattern as ConfigService). Every major method (`createSpace`, `updateSpace`, `deleteSpace`, `kickUser`, `kickUser`) calls `queryClient.invalidateQueries` and `queryClient.setQueryData` with desktop-specific query keys.

`kickUser` alone is 490 lines of Triple Ratchet session manipulation, space rekey distribution, API calls, and cache invalidation — all interwoven. There is no seam where "protocol logic" ends and "platform code" begins.

**Verdict: Stays per-app. React.MutableRefObject, React Query keys, @lingui, and desktop-specific NavItem type all in the constructor interface. The protocol crypto operations are not separable from the cache operations without a major refactor.**

---

### 12. `InvitationService.ts` — STAYS PER-APP

**904 lines.** Dependencies:
- `React.MutableRefObject` in constructor (line 18: `spaceInfo: React.MutableRefObject<...>`)
- `QueryClient` from `@tanstack/react-query`
- `buildSpacesKey`, `buildConfigKey`, `buildSpaceKey` from `../hooks`
- `channel as secureChannel`, `channel_raw as ch` from SDK
- `t` from `@lingui/core/macro`
- `NavItem` from `../db/messages`
- `sha256`, `base58btc`, `hexToSpreadArray` from `../utils/crypto`

`joinInviteLink` (the critical shared-protocol method) calls `this.queryClient.invalidateQueries` four times and saves to query cache. The join handshake (hub registration, space key saving, encryption state setup) is correct candidate protocol logic — but it is inextricable from the React Query invalidations that happen after each step.

**Verdict: Stays per-app. Same coupling profile as SpaceService: React.MutableRefObject in constructor, desktop query keys throughout. The protocol logic cannot be extracted without a major refactor of the query cache update pattern.**

---

### 13. `SyncService.ts` (desktop wrapper) — STAYS PER-APP

**1003 lines.** This is already the correctly-layered architecture. At lines 58–63, the constructor initializes `SharedSyncService` from `@quilibrium/quorum-shared` and a `IndexedDBAdapter`. The desktop `SyncService` is an adapter that:
- Holds `React.MutableRefObject<syncInfo>` (line 30)
- Manages space-key lookups from `messageDB` (IndexedDB-specific)
- Calls `secureChannel.SealHubEnvelope`, `secureChannel.SealSyncEnvelope` (protocol SDK ops)
- Enqueues outbound WebSocket messages via `enqueueOutbound` callback
- Calls `showSyncToast` (desktop-specific toast)
- Delegates all manifest/delta/hash computation to `SharedSyncService`

The shared `SyncService` already exists in `quorum-shared/src/sync/`. The desktop file is the correct per-app adapter. There is nothing to migrate here — the migration already happened.

**Verdict: Stays per-app. The architecture is already correct: shared protocol logic lives in quorum-shared; desktop wrapper handles hub transport and key management.**

---

### 14. `ActionQueueHandlers.ts` — STAYS PER-APP

**1082 lines.** Dependencies (header):
- `t` from `@lingui/core/macro` — i18n (lines 19, 94, 120, 163, 188, etc.)
- `type MessageDB` — storage
- `type MessageService` — the full message service
- `type ConfigService`, `type SpaceService` — other desktop services
- `QueryClient`, `InfiniteData` from `@tanstack/react-query`
- `type ActionType` from `../types/actionQueue`
- `buildMessagesKeyPrefix` from `../hooks/queries/messages/buildMessagesKey`
- `channel as secureChannel` — SDK
- `type Message` from shared
- `DefaultImages` from `../utils`

Each handler is a thin execution layer that calls desktop services (`configService.saveConfig`, `spaceService.updateSpace`, `spaceService.kickUser`, `messageService.submitChannelMessage`, `messageService.encryptAndSendDm`) and updates the React Query cache (`queryClient.setQueriesData`, `queryClient.setQueryData`, `queryClient.invalidateQueries`). The handlers are glue code, not protocol logic.

Even if the underlying services migrated to shared, the handler class itself would still need to call them through their shared interfaces AND update platform-specific caches. The i18n strings for error messages add another coupling.

**Verdict: Stays per-app. Handler class is desktop-specific glue between desktop services and React Query cache. The protocol logic is in the services it calls, not here.**

---

## Tier Summary Table

| Service | Tier | Rationale |
|---------|------|-----------|
| `ReceiptService.ts` | 1 — Migrate now | Zero imports, constructor is all callbacks, `document` access is guarded |
| `TypingService.ts` | 1 — Migrate now | See `2026-05-18-typing-shared-migration.md` |
| `SearchService.ts` | 1 — Migrate now* | Pure logic, `MessageDB` injected; needs `SearchAdapter` interface in shared first |
| `ActionQueueService.ts` | 1 — Migrate now* | All `window` calls guarded; needs `onError` injection to replace `showError` |
| `channelThreadHelpers.ts` | 1 — Migrate now | Two pure functions, only imports from shared |
| `ThreadService.ts` | 2 — Deferred | Coupled to `buildMessagesKeyPrefix` from desktop hooks; unblocks when hooks migrate |
| `BackupService.ts` | 2 — Deferred | `window.crypto.subtle` AES-GCM; unblocks when shared crypto module covers symmetric ops |
| `NotificationService.ts` | Per-app | Web Notification API throughout; mobile needs entirely different implementation |
| `ConfigService.ts` | Per-app | Web Crypto, React.MutableRefObject, React Query keys, @lingui, folderUtils coupling |
| `EncryptionService.ts` | Per-app | Web Crypto, React Query keys, DefaultImages, @lingui coupling |
| `SpaceService.ts` | Per-app | React.MutableRefObject, React Query keys, @lingui, NavItem from desktop DB layer |
| `InvitationService.ts` | Per-app | Same coupling profile as SpaceService |
| `SyncService.ts` | Per-app | Already correctly structured; shared protocol logic lives in quorum-shared already |
| `ActionQueueHandlers.ts` | Per-app | Desktop-specific glue; calls desktop services and updates React Query cache |

\* Tier 1 with a small prerequisite (see per-service entry).

---

## Sequencing Notes

### Independent migrations (can ship in any order, no mutual dependencies)

- **`ReceiptService` + receipt types PR**: Standalone. `src/types/deliveryReceipt.ts` moves with it. No dependency on typing migration or hooks migration.
- **`channelThreadHelpers`**: Can be included in a `ThreadService`-related PR or as a standalone tiny addition to `quorum-shared/src/utils/`.
- **`TypingService` + typing types PR**: Standalone (see dedicated task). Can ship before or after ReceiptService.

### Prerequisite-gated migrations

- **`SearchService`**: Needs `SearchAdapter` interface in quorum-shared first. Once that interface is defined and `StorageAdapter` (or a separate `SearchAdapter`) exposes the four full-text-search methods, `SearchService` moves verbatim.
- **`ActionQueueService`**: Needs a single small constructor change (`onError` callback injection) before moving. The types it depends on (`QueueTask`, `ActionType`, `QueueStats`) would need to move to shared as well — these are currently in `src/types/actionQueue.ts`.
- **`ThreadService`**: Blocked on hooks migration (specifically `buildMessagesKeyPrefix` and the query key builders). When the hooks migration produces a shared set of query key builders, the cache-update methods of ThreadService unblock.
- **`BackupService`**: Blocked on symmetric crypto abstraction. No timeline currently.

### What would unlock the most Tier 2 work

The hooks migration (currently blocked on mobile codebase access) is the single highest-leverage unblocking action. It would unlock `ThreadService` and implicitly improve the migration story for `ActionQueueHandlers` (which depends on desktop services for now but would benefit from shared versions).

---

## Recommended Next PRs (after TypingService)

**PR A — ReceiptService + delivery receipt types**

Smallest footprint after typing. Files to add to quorum-shared:
```
src/types/deliveryReceipt.ts       (copy from desktop src/types/deliveryReceipt.ts)
src/receipts/service.ts            (copy from desktop src/services/ReceiptService.ts)
src/receipts/service.test.ts       (new — unit tests for buffer/timer/flush logic)
src/receipts/index.ts              (barrel)
```
Updates to quorum-shared barrel: `src/types/index.ts`, `src/index.ts`.
Updates to quorum-desktop: delete local files, update importers in `MessageDB.tsx`, `MessageService.ts`, `ActionQueueHandlers.ts`.

Effort: half a day. Service code moves verbatim; the `typeof document` guards are already present. Tests would need to be written from scratch (none exist in desktop for `ReceiptService`).

**PR B — channelThreadHelpers**

Two pure functions, can be bundled with PR A or shipped as a trivial standalone:
```
src/utils/threadUtils.ts           (copy from desktop src/services/channelThreadHelpers.ts)
```
Zero risk. Reexport from `src/utils/index.ts`.

**PR C — ActionQueueService + action queue types**

After the `onError` injection refactor:
```
src/types/actionQueue.ts           (copy from desktop src/types/actionQueue.ts)
src/queue/service.ts               (copy from desktop src/services/ActionQueueService.ts, with onError injection)
src/queue/service.test.ts          (copy from desktop src/dev/tests/services/ActionQueueService.unit.test.ts)
src/queue/index.ts                 (barrel)
```
The 42-test suite already exists and can move verbatim. `ActionQueueHandlers` stays in desktop — the service is the portable half, the handlers are the per-app half.

---

## What This Task Does NOT Cover

- **`MessageService.ts`** — out of scope explicitly; see Context section above.
- **React hooks** (`useSearchService`, `useActionQueue`, etc.) — deferred to the hooks migration.
- **UI components** — per-app by architecture rule.
- **`MessageDB.tsx` wiring** — desktop-specific React context.
- **`UserConfig` privacy field consolidation** (`deliveryReceipts`, `readReceipts`, etc.) — separate task, referenced in the typing migration task.
- **Mobile implementation work** — this document covers the shared package side only. After each migration, mobile would need to wire up the shared service with its own adapters.

---

*Created: 2026-05-18 — First-principles audit of all 13 service classes plus channelThreadHelpers for quorum-shared migration potential.*
