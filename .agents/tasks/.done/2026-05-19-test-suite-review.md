---
type: report
title: "Test Suite Review — Cleanup Before Migration"
status: done
created: 2026-05-19
updated: 2026-05-19
completed: 2026-05-19
shipped_in: "PR #145 (df394cb0)"
related_tasks:
  - .agents/tasks/quorum-shared-migration/README.md
  - .agents/tasks/quorum-shared-migration/2026-05-18-typing-shared-migration.md
  - .agents/tasks/quorum-shared-migration/2026-05-19-receipts-shared-migration.md
  - .agents/tasks/quorum-shared-migration/2026-05-19-tests-migration.md
---

# Test Suite Review — Cleanup Before Migration

> **Sibling workstreams in flight (2026-05-19):** [quorum-shared migration](./quorum-shared-migration/README.md) and [MessageDB refactor](./messagedb/README.md). The ReceiptService cleanup and util-test expansion items below are prerequisites of the receipts and util-tests migration PRs in the shared-migration stream.

---

## Execution status (2026-05-19, branch `feat/test-cleanup-pre-migration`)

The recommendations below have been **fully executed** on a working branch. Six commits on top of `main` (excluding interleaved parallel-agent doc commits):

| Commit | Phase | What landed |
|---|---|---|
| `21390bb9` | 1 — Dead weight removal | -53 tests across 12 files, -733 lines |
| `3e8db4f5` | 2 — Service rewrites | +23 tests (MessageService, SpaceService, InvitationService) |
| `4f391d52` | 3a — Migration-bound gaps | +62 tests (ReceiptService DOM listeners + 3 util files) |
| `107bc052` | 3b — Per-app gaps (Config + Sync) | +17 tests (ConfigService decrypt path + SyncService 9 untested methods) |
| `91f52e23` | (docs) Record progress | Updated this report |
| `6c823f4f` | 4 — `mergeDeviceNames` extraction | First non-test source change; fixes prod/test drift bug; +2 tests |
| `a164af62` | 5 — Final nice-to-have gaps | +26 tests across 4 files (ActionQueueHandlers DM, ActionQueueService gaps, ThreadService actions, channelThreadHelpers edge cases) |

**Net effect**: 250 → 481 tests (+77 net after the -53 cleanup), 5178 → ~6300 lines. Suite still green: 24 files, 481 tests + 2 todo. **All 🔴 and 🟢 items are closed.**

### Per-file final state

| File | Tests then → now | Lines then → now | Status |
|---|---|---|---|
| MessageService.unit.test.tsx | 22 → 19 | 751 → 694 | Done. 7 always-passing tests removed, 10 behavior tests added. `handleNewMessage` inbox-match branch deferred (would need `UnsealInitializationEnvelope` + `NewDoubleRatchetRecipientSession` mocks — false-positive risk). |
| SpaceService.unit.test.tsx | 11 → 10 | 231 → 364 | Done. 10 theatre tests removed, 7 behavior tests added with WASM mock + Lingui activation. `kickUser` / `submitUpdateSpace` covered only at "enqueueOutbound was called" level (bodies run inside fire-and-forget callbacks). |
| InvitationService.unit.test.tsx | 13 → 12 | 296 → 456 | Done. 7 theatre tests removed, 6 behavior tests added. `constructInviteLink` non-cached path with ratchet.id formula pinning landed. `joinInviteLink` valid-link path deferred (would require deep multiformats + crypto utils mocking). |
| ReceiptService.unit.test.ts | 28 → 35 | 273 → 367 | Done. **Migration-bound.** DOM listeners (`visibilitychange`, `beforeunload`) and `destroy()` cleanup now tested. Edge cases on `flushAll`, `onMessageRead` equal-timestamp, `clearReadBuffer` covered. **Ready to migrate to shared.** |
| reservedNames.test.ts | 17 → 50 | 228 → 389 | Done. **Migration-bound.** Added `validateNameForXSS`, `sanitizeNameForXSS`, `validateMessageContent`, `validateMessage`, `isValidIPFSCID` coverage. **Ready to migrate to shared.** |
| mentionUtils.enhanced.test.ts | 13 → 19 | 238 → 251 | Done. **Migration-bound.** `hasWordBoundaries` covered indirectly, `@here` behavior documented, role case-insensitivity, empty input baseline. **Ready to migrate to shared.** |
| messageGrouping.unit.test.ts | 10 → 22 | 193 → 279 | Done. **Migration-bound.** `shouldShowCompactHeader` (was zero coverage) now has 9 tests covering all return-false conditions + the 5-minute threshold. **Ready to migrate to shared.** |
| ConfigService.unit.test.tsx | 8 → 10 | 239 → 389 | Done. The 60-line `getConfig` decrypt path is now covered using `vi.spyOn(global.crypto.subtle, 'decrypt')` with a TextEncoder-built buffer (NOT via WASM `js_decrypt_inbox_message` — that's only used for per-space manifests in the inner loop). Bookmark merge tested. `saveConfig` allowSync:true path tested. |
| SyncService.unit.test.tsx | 11 → 18 | 271 → 394 | Done. 4 of the 9 untested methods now have coverage. 3 happy-path tests use no-arg `enqueueOutbound.toHaveBeenCalled()` (weak — would catch "method never ran" but not "ran with wrong args") because the bodies run inside fire-and-forget callbacks. Documented. |
| ActionQueueService.unit.test.ts | 42 → 46 | 842 → 955 | Done. 3 dead-weight tests removed in Phase 1; 7 behavior tests added in Phase 5: enqueue-before-keyset, mid-flight logout safety, processQueue concurrency guard, transient-error max-retries onFailure, debounce on rapid enqueue, getQueueStats failure propagation, start/stop/start lifecycle. |
| ActionQueueHandlers.unit.test.ts | 67 → 67 | 1203 → 1252 | Done. 6 duplicate tests removed in Phase 1; 6 behavior tests added in Phase 5: pin/unpin isPermanentError, send-dm ForceSenderInit branch, reaction-dm + delete-dm happy paths, send-dm error sanitization. |
| ConfigService.deviceNames.unit.test.ts | 5 → 7 | 67 → 65 | Done. `mergeDeviceNames` extracted from `ConfigService.ts` to a new `configMergeHelpers.ts` module (first non-test source change in the branch). Test now imports the real function. Added dedup regression test + remote-only-tombstone test. |
| TypingService.unit.test.ts | 30 → 30 | 482 → 482 | Untouched — already strong, migration-ready. |
| ThreadService.unit.test.ts | 27 → 36 | 700 → 866 | Done. 9 behavior tests added: reopen and updateSettings actions, updateTitle in handleThreadSendPostBroadcast, targetMessage-null guards in handleThreadReceive/handleThreadSend, missing thread entry in handleThreadReplyReceive, replyCount floor-at-0 in handleThreadDeletedMessageCache. |
| channelThreadsWritePaths.test.ts | 4 → 10 | 76 → 140 | Done. 6 edge cases added: 100-char truncation, empty rootMessageText, markdown stripping, customTitle pass-through, lastActivityAt fallback to `now`, reply-timestamp rewind (pins current behavior; flagged as potentially unintended). |
| EncryptionService.unit.test.tsx | 8 → 4 | 213 → 183 | Phase 1 trim done. 4 dead-weight tests removed. `ensureKeyForSpace` migration path still untested (intentionally — `ownerKey!.publicKey` crash + 80-line key-rotation operation is high-effort to mock with high false-positive risk). |

### Deliberately deferred (with reasons)

These items are intentionally left for future work because the cost-benefit didn't favor doing them in this PR:

- **`MessageService.handleNewMessage` inbox-match branch** — would need mocks for `UnsealInitializationEnvelope` + `NewDoubleRatchetRecipientSession` returning deep, correctly-shaped objects. High risk of false-positive tests that document wrong behavior.
- **`SyncService` `handleSyncManifest`, `requestSync` happy path, `directSync` happy path** — require seeded IndexedDB cache to be testable. The bodies also run inside fire-and-forget callbacks that vi.fn() doesn't await.
- **`EncryptionService.ensureKeyForSpace` migration path** — the 80-line key-rotation operation needs very deep WASM-shape mocks. Risk of brittle tests.
- **`InvitationService.joinInviteLink` valid-link success path** — multiformats + base58 decoding plus deep `js_decrypt_inbox_message` shape mocking would make the test opaque and brittle.
- **`ConfigService.saveConfig` allowSync:true filter branch** — filters spaces without encryptionState. Worth testing but adds little signal over the existing allowSync:true happy-path test.
- **`SpaceService.kickUser` / `submitUpdateSpace` deep paths** — bodies run inside fire-and-forget enqueueOutbound callbacks. Covered only at "callback was enqueued" level.
- **`handleThreadRemoveCache` main-feed cache mutation** — `setQueriesData` uses prefix-match but `getQueryData` requires exact key; verification would require seeding the full `['Messages', spaceId, channelId, ...]` key.
- **Jitter in exponential backoff** — `calculateBackoff` is deterministic in the source; no jitter exists. A "variance" test would be a false assertion.
- **`mute-user` / `unmute-user` keyset gate** — the gate is at a layer below the handler boundary (inside `submitChannelMessage`), not at the handler. A handler-level test would be misleading.

### What's open

- **🔴 None.** All critical (migration-blocking) gaps are closed.
- **🟡 None.** All important items are closed.
- **🟢 None.** All nice-to-have items are either closed or explicitly deferred above with a documented reason.

### Branch state

7 commits ahead of `main`. The branch is feature-complete for its stated goal: clean up tests before the receipts/util-tests/typing migration PRs.

**Awaiting manual dev-environment testing before push** (the Phase 4 commit touches `src/services/ConfigService.ts` source, so an interactive smoke test on the running desktop app is warranted before opening a PR).

---

## Why this exists

Editing tests in `quorum-desktop` is cheap (one `yarn test` cycle). Editing tests in `quorum-shared` is expensive (build + publish + version bump + consumer update). So before migrating any tests to shared, clean them up here.

This review covers all 13 service tests (~5,300 lines) and the 3 util-test migration candidates (~660 lines). Components, DB, hooks tests are out of scope — they aren't migration-bound.

## TL;DR

Of ~6,000 lines reviewed:

- **~800 lines (~13%) are dead weight** — tests that can't fail, tests that re-check what TypeScript already enforces, tests where the only assertion is "the mock I just configured returned what I configured it to return."
- **MessageService and SpaceService/InvitationService are theatre.** They look like they cover the services but they don't. MessageService has 7 tests whose only assertion is `expect(true).toBe(true)`.
- **The two migration-bound service tests (TypingService, ReceiptService) are in the best shape of the lot.** TypingService is essentially ready to migrate as-is. ReceiptService needs ~20 minutes of work.
- **The three migration-bound util tests need light expansion**, not trimming.

## Severity legend

- 🔴 **Critical** — must fix before migration OR before relying on these tests
- 🟡 **Important** — clear win, should fix this round
- 🟢 **Nice-to-have** — improvement, can defer

---

## Migration-bound files (the priority three)

### TypingService.unit.test.ts (482 lines, 30 tests)

**Verdict:** Keep as-is. Strong file. Migrate verbatim.

🟢 **Optional small expansions:**
- Thread-scope receive routing (only channel-scope is tested)
- Multiple subscribers on the same scope (Set iteration not verified)
- `destroy()` clears pending TTL timers (memory leak guard)
- `sendDM/sendSpace` rejection handling (transport-failure smoke test)

The `vi.setSystemTime(0)` pattern in the receive-side suite is intentional (keeps synthetic timestamps inside the 30s freshness window) — preserve and document this when migrating.

---

### ReceiptService.unit.test.ts (273 lines, 22 tests)

**Verdict:** Trim 2 + expand 4–5. ~30 minutes of work.

🟡 **Trim:**
- `'does not throw when onReadAckProcessed is not provided'` (line 141) — pure null-check guard, tests nothing
- `'calls onAckProcessed for each messageId'` (line 109) — pure passthrough test

🔴 **Add before migration:**
- **`visibilitychange` event triggers `flushAll`** — the entire DOM-listener path is untested today. After migration to shared this path is critical because mobile won't have the listener and we need the cross-platform contract pinned.
- **`beforeunload` event** — same situation.
- **`destroy()` removes event listeners** — memory leak guard.

🟡 **Edge cases:**
- `flushAll` skips empty delivery buffers (the `if (buffer.size > 0)` branch)
- `onMessageRead` with equal timestamp (the `>=` boundary — is re-read intentionally ignored?)
- `clearReadBuffer` leaves delivery state untouched

🟢 Collapse the two top-level `describe` blocks into one shared `beforeEach` when migrating.

---

### Util test migration candidates

Combined: ~660 lines across three files. All test functions that already live in `@quilibrium/quorum-shared`.

#### reservedNames.test.ts (228 lines, 17 tests) — Expand

🟡 **Trim:**
- `'isReservedName should return true for any reserved name'` (line 215) — repeats individual function tests; `isReservedName` is a one-liner
- `'getReservedNameType should return mention for mention keyword matches'` (line 188) — 8 assertions that just re-test what `isMentionReserved` already covers

🔴 **Missing coverage** (the same source file in shared contains untested functions):
- `validateNameForXSS` / `sanitizeNameForXSS` — non-trivial XSS regex logic
- `validateMessageContent` / `validateMessage` / `sanitizeContent`
- `isValidIPFSCID`, `validateSpaceTagLetters`, `isValidSpaceTagUrl`

🟡 **Edge cases for already-tested functions:**
- `normalizeHomoglyphs` passthrough for non-homoglyph chars (`'2'`, `'6'`, `'#'`)
- Empty string + whitespace-only inputs
- Cyrillic `а` (U+0430) — looks like Latin `a` but not in `HOMOGLYPH_MAP`; document the limit

**Recommendation:** Either expand this file to cover the missing functions OR split into `reservedNames.test.ts` + `validation.test.ts` when moving to shared. Don't migrate as-is — the partial coverage will be misleading in the shared repo.

#### mentionUtils.enhanced.test.ts (238 lines, 13 tests + 2 `it.todo`) — Trim & expand

🟡 **Trim:**
- `'should maintain exact same behavior for old format mentions'` (line 130) — superset of preceding tests, adds no scenario
- `'should limit mixed mention types to 20 total'` (line 170) — labelled "Rate Limiting" but actually tests deduplication. Misleading; either fix the label or remove

🔴 **Missing coverage:**
- `hasWordBoundaries` — the most complex logic in the file, only tested indirectly. Direct tests needed for: mention at start/end of string, after `(`, after `)`, inside `**bold**`, inside backtick code
- `@here` mention behavior — source treats it as reserved but `extractMentionsFromText` only checks `@everyone\b`. Either a bug or intentional omission; either way it's untested
- Empty text input baseline
- Role mention case-insensitivity (`@Moderators` vs role tagged `moderators`)
- `parseMentions`, `extractMentions`, `isMentioned`, `getMentionType`, `isMentionedWithSettings`, `formatMention` — all exported, all untested in this file

🟡 The "invalid characters in display names" test at line 26 is actually exercising IPFS CID validation, not display-name validation. Rename or restructure.

#### messageGrouping.unit.test.ts (193 lines, 10 tests) — Expand

🟡 **Trim:**
- `getDateLabel` test (lines 86–97) — 3 of 4 assertions are `expect(() => fn(x)).not.toThrow()`. Dead weight; keep only the format-regex assertion.

🔴 **Missing coverage:**
- `shouldShowCompactHeader` — exported, zero tests. 5 distinct return-false conditions + a time threshold. Highest-complexity untested function in the file.

🟡 **Edge cases:**
- DST boundary handling in `getStartOfDay` / `shouldShowDateSeparator`
- Out-of-order messages in `groupMessagesByDay` (current behavior: groups fragment; documented test would pin this)
- `separator.id` field format (used as React key)
- `index` field on message items (used for virtualized scrolling)
- A timezone other than America/New_York (e.g. UTC+12) to verify generalisation
- `label` field on `MessageGroup` (currently never read in any test)

---

## Per-app service tests (not migration-bound, but actively running)

### ActionQueueService.unit.test.ts (842 lines, 42 tests) — Trim & expand

🟡 **Dead weight (3 tests):**
- `'should construct with messageDB dependency'` — pure constructor check
- `'should have all required public methods'` — 9 `typeof === 'function'` tautologies (TypeScript enforces)
- `'should stop processing interval'` — body is `expect(true).toBe(true)`, literally a no-op

🔴 **Critical gaps:**
- `enqueue()` without keyset set (silent accumulation after logout?)
- `clearUserKeyset()` while a batch is in-flight (concurrent-state safety)
- `processQueue()` concurrency guard (`isProcessing`) — the actual guard is never exercised
- `onFailure` on max-retries exhaustion (not just permanent error)

🟡 **Important:**
- Debounce on `queueUpdateTimer` (500ms batching, rapid enqueues should emit once)
- Exponential backoff jitter presence (current test only checks a range)
- `start() → stop() → start()` cycle resets state

🟢 The Section 11 "Context Integrity / Keyset Leakage" test documents a known unfixed issue rather than catching a regression. Remove or convert to a real strip-keyset assertion when the fix lands.

### ActionQueueHandlers.unit.test.ts (1,203 lines, 67 tests) — Trim & expand

Biggest test file. Mostly good but with redundancy.

🟡 **Dead weight (~5 tests, duplicates):**
- `'should be registered in getHandler'` (16b, 16c) — duplicate of Section 1's blanket registration check
- `'should NOT have toast messages (silent)'` (16b, 16c) — duplicate of Section 18's blanket contract
- `'send-channel-message requires correct context fields'` (19) — duplicate assertion already in Section 12
- `'send-dm requires correct context fields'` (19) — duplicate assertion already in Section 13
- `'should NOT have success messages'` (18) — 15-loop test could be collapsed to one

🔴 **Critical gaps:**
- **`reaction-dm` happy path** — only keyset-missing error is tested
- **`delete-dm` happy path** — only keyset-missing error is tested
- **`send-dm` with `DoubleRatchetInboxEncryptForceSenderInit`** — the forced-init branch is never exercised
- **`pin-message` / `unpin-message` `isPermanentError`** — without this, pin-on-deleted could loop forever

🟡 **Important:**
- `mute-user` / `unmute-user` keyset gates (if applicable)
- `kick-user` keyset-null path
- Error sanitization for DM handlers (`send-dm` `onFailure` output content)

🟢 Section 20 (SDK Call Parameter Verification) is the highest-value section. Use it as a template for expanding the DM-handler coverage.

🟢 Two `describe('16...')` blocks (one for edit-dm, one for send-delivery-ack) — re-number for clarity.

### MessageService.unit.test.tsx (751 lines, 22 tests) — REWRITE

This is the biggest problem in the suite.

🔴 **DEAD WEIGHT — ENTIRE BLOCKS:**
- **All 7 `handleNewMessage` type tests (Section 2)** — every assertion is `expect(true).toBe(true)`. These tests **cannot fail under any circumstances**. They are smoke tests masquerading as behavior tests.
- `'should execute deletion workflow without errors'` (Section 5) — `resolves.not.toThrow()` only, zero mock assertions
- `'should execute channel message submission without errors'` (Section 6) — same pattern
- Two near-duplicate `submitMessage` tests in Section 1 (both verify `enqueueOutbound` was called, nothing more)
- Duplicate `sendHubMessage` test in Section 7
- `'should expose helper via getEncryptAndSendToSpace()'` (Section 7) — asserts bound-function `.name`, which is implementation detail

🔴 **HUGE coverage gaps:**
- **`handleNewMessage` inbox-match branch** — all 7 type tests use `inboxAddress: 'other-inbox'` to deliberately skip inbox logic. The DM-decryption + inbox path is **completely untested**.
- **`updateMessageStatus`** — public method consumed by ActionQueueHandlers. Zero tests.
- **`encryptAndSendDm`** — public method consumed by ack handlers (delivery-ack, read-ack). Zero tests. Migration-relevant: this is what ReceiptService callbacks ultimately invoke.
- **`sendEphemeralDMControl` / `sendEphemeralSpaceControl`** — typing indicator send paths. Zero tests. Migration-relevant for TypingService.
- **`SimpleRateLimiter` integration** — the rate limiters in `receivingRateLimiters` are never exercised
- **`saveMessage` idempotency** on duplicate (network replay)
- **`addMessage` when space not found in DB**
- **`deleteConversation` actual effects** — DB calls never asserted

🟢 Section 7 (`encryptAndSendToSpace` helper) has the strongest tests in the file. Use as the template for a rewrite.

**Recommendation:** A focused rewrite of `handleNewMessage` + `saveMessage` + `updateMessageStatus` sections would *double real coverage while cutting line count*. The current 22-tests-for-3200-lines ratio is severely off.

### ThreadService.unit.test.ts (700 lines, 27 tests) — Keep as-is

**Strongest test file in the suite.** Every test exercises real branches, mutations, or auth decisions. Tests assert outcomes, not just mock calls.

🟢 **Optional expansions:**
- `'reopen'` thread action (only `close` is tested)
- `'updateSettings'` action (`customTitle` save path)
- `handleThreadSendPostBroadcast` for `updateTitle` (create and remove are covered, updateTitle is not)
- `handleThreadDeletedMessageCache` `replyCount` floor at 0 (`Math.max(0, ...)` guard)
- `handleThreadRemoveCache` main-feed cache mutation (the `setQueriesData` infinite-scroll path is invisible to current assertions)

### SyncService.unit.test.tsx (271 lines, 11 tests) — Trim 8 + expand

🟡 **Dead weight (8 of 11 tests):**
- `'should construct SyncService...'` (constructor tautology)
- `'should have all required methods'` (6 `typeof` checks)
- 6 `parameter count` tests (all `.length`, TypeScript already enforces)

🔴 **Critical gaps:**
Nine of twelve public methods have **zero coverage**: `handleSyncInitiateV2`, `handleSyncManifest`, `requestSync`, `directSync`, `synchronizeAll`, `updateCacheWithMessage`, `updateCacheWithMember`, `removeCacheMessage`, `getSharedSyncService`. Several have pure control-flow paths (early returns, null guards) testable without WASM.

🟡 **Important:**
- `sendVerifyKickedStatuses` with multiple kicked users (only 0 and 1 are tested)
- Kick-then-join ordering correctness (chronological `.sort()` behavior)
- `informSyncData` when `inboxKey` is null (the first early-return guard)

### ConfigService.unit.test.tsx (239 lines, 8 tests) — Trim 4 + expand

🟡 **Dead weight (4 of 8 tests):**
- `'should construct ConfigService...'`
- `'should have all required methods'`
- 2 parameter-count tests

🔴 **Critical gaps:**
- **`getConfig` newer-remote-timestamp branch** — the 60-line decrypt-and-verify path is the most complex in the service and completely untested
- `getConfig` equal-timestamp branch
- `getConfig` stale-remote branch (older timestamp)
- `getConfig` bookmark merge path
- `getConfig` user notes merge / tombstone application path

🟡 **Important:**
- `saveConfig` `allowSync: true` path — the filtering logic (lines 463–481) is pure data manipulation, testable with mocked `getSpaces` / `getSpaceKeys`
- `saveConfig` updates `queryClient.setQueryData` (cache cite in source comments as a known bug vector)

### ConfigService.deviceNames.unit.test.ts (67 lines, 5 tests) — Expand

🔴 **Critical:** The test file contains a **copy-pasted version of `mergeDeviceNames` that has diverged from production**. The test copy uses array spread (`[...local, ...remote]`); production uses `new Set` for deduplication. The current tests can't catch the divergence. **Extract `mergeDeviceNames` as a pure exported utility** so tests import the real function.

🟢 Otherwise good coverage. Worth adding:
- Tombstone deduplication test (would catch the divergence above)
- Multiple-key merge with mixed override/survive
- Tombstone from remote removing a remote-only name (current tombstone test only removes a local entry)

### SpaceService.unit.test.tsx (231 lines, 11 tests) — REWRITE

**Theatre. 10 of 11 tests are dead weight.**

🔴 **Dead weight (10 of 11):**
- Constructor tautology
- 7 method-existence + parameter-count tests
- `'should call getSpaceKey when sending hub message'` — body never calls `sendHubMessage`, only asserts `typeof` and `.length`

🔴 **Critical gaps:** `createSpace`, `updateSpace`, `submitUpdateSpace`, `createChannel`, `kickUser` (happy path), `deleteSpace` (happy path), `sendHubMessage` (actual invocation) — **none of these core mutations are tested.**

**The WASM objection in the test header is wrong.** `ch.js_generate_ed448()` can be mocked as `vi.fn().mockReturnValue('{"public_key":[1,2,3],"private_key":[4,5,6]}')` — the service doesn't validate key material. A rewrite using `vi.mock('@quilibrium/quilibrium-js-sdk-channels', ...)` would deliver real coverage for the most important mutations in the app.

### InvitationService.unit.test.tsx (296 lines, 13 tests) — REWRITE

**Same theatre verdict as SpaceService. 8 of 13 tests are dead weight.**

🔴 **Dead weight (8 of 13):**
- Constructor tautology + 5 method-existence tests + `'verify method exists'` body that only does `typeof`/`.length`

🔴 **Critical gaps:**
- `constructInviteLink` non-cached path — multi-step stateful crypto with mutable ratchet ID. An off-by-one would silently corrupt invite state. Completely untested.
- `constructInviteLink` error branches: "no encryption states", "missing template data", "no evals available"
- `sendInviteToUser` — `submitMessage` arguments not verified
- `joinInviteLink` valid-link path (only invalid-link rejection is tested)
- `generateNewInviteLink` — the 200+ one-time-invite generator + rekey + API post — zero tests

🟡 `processInviteLink` test wraps the call in `try/catch` that silently eats errors then asserts the mock was called (tautological).

### EncryptionService.unit.test.tsx (213 lines, 8 tests) — Trim & expand

🟡 **Dead weight (4 of 8):**
- Constructor + method-existence + 2 parameter-count tests

🔴 **Critical gaps:**
- **`ensureKeyForSpace` migration path** — the 80-line key-rotation operation (re-ID conversations, copy messages, migrate members, post API, update config) is **the most destructive operation in the service** and is completely untested
- `ensureKeyForSpace` when `ownerKey` is undefined (no `keyId == 'owner'` exists) — code does `ownerKey!.publicKey` with no guard; would crash
- `deleteEncryptionStates` mid-loop failure (does it continue or abort?)
- `getSpaceKey` throws vs returns null (different code paths, neither validated)

🟢 The `deleteEncryptionStates` tests are good — they verify real behavior including the `inboxId` conditional. Keep as-is.

### channelThreadsWritePaths.test.ts (76 lines, 4 tests) — Expand

🟢 Already good. Worth adding:
- `rootMessageText` longer than 100 chars (truncation via `.slice(0, 100)`)
- `rootMessageText` empty (`stripped || undefined` boundary)
- `rootMessageText` with markdown (verify `stripMarkdown` is wired in)
- `threadMeta.customTitle` non-undefined (pass-through)
- `threadMeta.lastActivityAt` undefined → fallback to `now`
- **Out-of-order reply timestamp** — source unconditionally sets `lastActivityAt: replyTimestamp`, so an older reply would rewind. Likely real bug; pin the expected behavior.

This file migrates to shared eventually (Tier 1B, blocked on mobile access). Expanding here costs nothing extra.

---

## Recommended order of cleanup

Priority sequence — independent of each other, all reversible:

1. **MessageService.unit.test.tsx rewrite** — biggest impact, biggest existing risk (7 always-passing tests). 1–2 days.
2. **SpaceService + InvitationService rewrites** — biggest theatre, most critical mutations untested. 1 day with WASM-mock pattern.
3. **ConfigService + SyncService trim & expand** — quick wins on dead weight, important coverage on getConfig newer-remote-timestamp path. Half a day.
4. **ReceiptService.unit.test.ts cleanup** — required before migration. 30 minutes.
5. **Util tests expansion** — required before migration. 1–2 hours.
6. **ActionQueueService + ActionQueueHandlers trim & expand** — moderate, but the suite is good enough to defer. 1 day.
7. **TypingService.unit.test.ts optional expansion** — already migrate-ready. Optional.
8. **ThreadService + channelThreadHelpers expansion** — both already strong. Optional.
9. **`mergeDeviceNames` extraction** — refactor to fix the prod/test drift. 30 minutes.

## What NOT to do

- **Don't add tests for WASM crypto without mocking it.** The four "stays per-app" services (SpaceService, InvitationService, EncryptionService, ConfigService) all need `vi.mock('@quilibrium/quilibrium-js-sdk-channels', ...)`. Don't try to integration-test against real WASM — that's the integration test suite's job (currently empty).
- **Don't migrate ReceiptService tests as-is.** The DOM-listener path needs coverage first since mobile won't have that listener.
- **Don't migrate reservedNames.test.ts without expanding it to cover the rest of `validation.ts`** — moving partial coverage to shared makes the gap less visible.
- **Don't rewrite ThreadService or TypingService tests.** They're already the standard everyone else should match.

## Comparison to README's stated philosophy

Project README states: *"We trust underlying implementations work correctly. We test that our services use them correctly."*

This is a reasonable philosophy. But across the suite it's been applied in two failure modes:

1. **Trivialized into "method exists" tests.** SpaceService, InvitationService, and SyncService each have ~half their suite testing TypeScript-enforced contracts. This is testing the type system, not behavior.
2. **Substituted "execution doesn't throw" for actual outcome verification.** MessageService Section 2 is the worst case — 7 tests literally do `expect(true).toBe(true)` after a method call. The README's "We test that services use dependencies correctly" requires *asserting which dependency calls happened with what arguments*, not just confirming the call site executes.

A useful concrete refinement to add to the README's "What We Test" section:

> **For every "service uses dependency correctly" test, the assertions must include at least one of:**
> - `expect(dep.method).toHaveBeenCalledWith(<specific value>)` (not `expect.anything()`)
> - Verification of state changes (DB writes, cache mutations, event emissions)
> - Branch outcome (return value, thrown error, side effect)
>
> **Tests whose only assertion is `expect(true).toBe(true)` or `resolves.not.toThrow()` without further assertions are not behavior tests and should be removed.**

---

*Created 2026-05-19 — parallel review of 16 test files across services + util migration candidates.*
