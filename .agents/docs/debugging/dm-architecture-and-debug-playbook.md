---
type: doc
title: DM Architecture and Debug Playbook
status: living
created: 2026-06-09
updated: 2026-06-09
audience: future agents debugging DM-related bugs (delivery, identity, sync)
---

# DM Architecture and Debug Playbook

> **Why this exists.** We keep re-discovering the same DM internals every session. This doc consolidates the moving parts, the data shape, the receive-vs-send asymmetries, the known sync gaps, and a step-by-step debug procedure. Read this before you touch DM code or open a fresh investigation.

## Cheat sheet — read this first

- DM identity (name, icon, bio) lives in `conversations` (IndexedDB). One row per partner, keyed by `conversationId = partnerAddress + '/' + partnerAddress`.
- DM identity is captured **at session-init time** from the encrypted envelope's `user_profile`. Established sessions (`DoubleRatchetInboxDecrypt`) do NOT carry profile data on subsequent messages.
- A change to a DM partner's pfp/name/bio is propagated by a **`dm-update-profile` control message** sent over the existing DM session whenever the partner saves their global profile in User Settings → General. This is intercepted on receive (never persisted as a chat post) and upserts the conversation row.
- Per-space profile saves (Space Settings → Account) are independent — they only touch `space_members`, never DMs.
- **Network sync between two clients is not reliable.** Regular DMs from B to A sometimes never arrive. This is an open issue, not a code bug we've identified.

## Architecture map

### Storage

- **`conversations`** — DM list rows. Fields used for identity: `displayName`, `icon`, `bio?`, `address` (partner). Composite key: `conversationId`. Type: `Conversation` from `@quilibrium/quorum-shared`.
- **`messages`** — chat messages. Snapshots sender name + icon at receive time into the row (used by message list header rendering).
- **`encryption_states`** — per-session Double Ratchet state. A row here means we have an active DM session with that partner. No row = no DM exists between us.
- **`space_members`** — per-space profile per user. Composite key `[spaceId, user_address]`. Has `bio` (per-space override).
- **`user_config`** — own user's config (includes own global `bio`, `name`, `profile_image`). Synced via server if `allowSync: true`.
- **`user_info`** — own passkey/identity metadata. Beware: on some builds the store name is `user_info`, on others (older) it was `passkey_info`. Always probe `objectStoreNames` first.

### Read paths (who shows DM identity)

1. **DM list sidebar** — reads `conversations` via React Query `useConversations`. Cache key: `buildConversationsKey({ type: 'direct' })`.
2. **DM chat header** — `useConversation` for the open conversation. Cache key: `buildConversationKey({ conversationId })`.
3. **DM UserProfile sidebar** (the inline profile panel in DM view) — reads `conversation.bio` first, then falls back to `recipientPublicProfile?.bio` (server-side public profile, only present if the partner opted in). See [`DirectMessage.tsx`](src/components/direct/DirectMessage.tsx) `otherUser` memo.
4. **DM message list per-message header** — reads `members` map produced by `useChannelData`-like logic; for DMs the map has one entry.
5. **Public-profile fallback** — `useMembersWithPublicProfileFallback` fills missing/empty fields from `GET /users/:addr/public-profile`. 404 (user opted out) → no fallback data, the UI stays empty.

### Receive paths (where identity gets written)

| Trigger | Path | Writes |
|---|---|---|
| First incoming DM message (session init) | `NewDoubleRatchetRecipientSession` → `envelope.user_icon` / `envelope.display_name` | `conversations` row with both fields |
| Subsequent DM messages (established session) | `DoubleRatchetInboxDecrypt` → returns NO `user_profile` for established sessions | nothing about identity |
| `dm-update-profile` control message | `interceptControlMessages` → `handleDMProfileUpdate` | upserts `displayName`, `icon`, `bio` |

**Key asymmetry to remember:** the "first message" path captures identity only once. After that, identity is frozen until the partner sends a `dm-update-profile` (or until you blow away the session and re-establish it).

### Send paths (who broadcasts identity)

1. **Global profile save** — User Settings → General → save:
   - `useUserSettings.saveChanges()` → `useMessageDB.updateUserProfile()` →
     - For each space: `submitChannelMessage` with `update-profile` (space-side).
     - **For each DM partner: `messageService.broadcastProfileToAllDMs()` (DM-side, since 2026-06-09).**
2. **Per-space profile save** — Space Settings → Account → save:
   - `useSpaceProfile.onSave()` → `submitChannelMessage` to ONE space only. **Never touches DMs.** This is the user-facing override and is intentional.
3. **DM message send** — never carries identity for established sessions. Don't bake it in here; that's the historical mistake the existing code already avoids.

## Field semantics — "upsert-aware merge"

This is the rule both the space and DM receive sides use, copied from mobile's hard-won lessons:

- **Non-empty value on the wire** → overwrite receiver's stored value.
- **Field absent or `undefined`** → preserve receiver's stored value ("no change").
- **Empty string** → for `displayName` / `userIcon`: same as absent (preserve). For `bio`: deliberate clear (matches user clearing their bio in the editor).

The `?...:` ternaries in `handleDMProfileUpdate` and the space `update-profile` handler implement this. **Do not "simplify" them to plain assignment** — empty-string clobbers were the original bug that pushed mobile to invent this semantic.

## Cross-app contract

DM `update-profile` is on the wire between desktop and mobile. The type is shared:

- `DMUpdateProfileMessage` in `@quilibrium/quorum-shared` (added 2026-06-09 in shared PR #33).
- `Conversation.bio?: string` in `@quilibrium/quorum-shared` (added in shared PR #34).

The control message is intercepted **before** persistence on both ends. If you ship the send side before the receive side is in older clients, those clients render it as a JSON-blob chat post. Stage rollouts so receive ships first, especially on mobile where users update on their own pace.

## Known sync issues (NOT yet fixed)

These are pre-existing and affect ALL DM traffic, not just profile broadcasts:

- **Asymmetric conversation rows.** A↔B can have one side seeing the conversation and the other not. Means: B's broadcast loop won't iterate A. Confirmed 2026-06-09 in live test (User A had 3 DM partners including B; User B's table had only 2, with A absent). Root cause not yet identified.
- **Regular text DMs occasionally don't arrive.** Reported by user repeatedly. Same root cause cluster.
- **The fix in this branch does not address either issue** — once delivery works, the profile sync rides on the same transport and just works.

## Debug procedure — DM identity bug

When user reports "I don't see X's name/pfp/bio in DMs," walk this ladder. Don't skip steps.

### Step 0: ensure both clients run current code

- Restart the dev server. Vite HMR on Context providers (`MessageDB.tsx`) frequently fails — the user's `updateUserProfile` callback can be a stale closure from a prior build even after refresh.
- Hard-reload both browser clients (Ctrl+Shift+R).
- **Check the DevTools console filter level.** If "Info" / "Verbose" is filtered out, you won't see normal `console.log`. (Genuinely happened 2026-06-09 — wasted 30 minutes.)

### Step 1: take a snapshot of both sides

Run the diagnostic scripts (`.agents/tools/dm-debug/`). Get both clients' `conversations` tables and confirm:

- Both clients have a row for each other in `conversations` with matching `address`.
- Both clients have an `encryption_states` row for the conversation.

**If the rows aren't symmetric, the test is broken — no client-side code can fix that.** Move to investigating WHY the rows aren't symmetric (e.g. one side never finalized the session, an init envelope got dropped).

### Step 2: classify the symptom

| Symptom | Look at |
|---|---|
| Initials + truncated address everywhere | `conversations.displayName` / `icon` — was identity ever captured? |
| Name shows, pfp missing | `conversations.icon` is `null` or empty string. The init envelope arrived with no icon. |
| Pfp shows but bio doesn't | `conversations.bio` field. If null, the user never broadcast `dm-update-profile`, or the broadcast didn't arrive. |
| Stale identity (old pfp shown after partner changed it) | Same as bio — needs a `dm-update-profile` broadcast from partner. |

### Step 3: add debug logs at three layers

If logs are needed (e.g. validating a code change), add them at:

- **Send call site** — top of `useUserSettings.saveChanges()` right before `updateUserProfile` call.
- **MessageDB callback** — top of `updateUserProfile` in `MessageDB.tsx` and inside the DM block.
- **MessageService broadcast** — start of `broadcastProfileToAllDMs` and per-partner inside the loop (`sent` / `FAILED` for each).
- **Receive handler** — top of the `dm-update-profile` branch in `interceptControlMessages`.

Don't ship those — strip before commit. There's an example diff in `.agents/tools/dm-debug/log-points.md`.

### Step 4: confirm transport

If the send fires but receive is silent:

- Send a regular text DM between the same two accounts.
- If text also doesn't arrive → it's the transport issue, not code.
- If text arrives but profile broadcast doesn't → bug in the control-message intercept or the `dm-update-profile` type registration on the receiver. Check shared package version match.

## Anti-patterns we've already burned on

- **"Just embed the pfp in every DM message envelope."** Bandwidth blows up; old clients break; doesn't fix the stuck-missing case for sessions established without profile data. Considered and rejected 2026-06-09.
- **"Just call `requestSync`."** That's a space-level sync mechanism. DMs don't have one. Don't try.
- **Defining DM control message types locally in `MessageService.ts`.** The wire type must live in `@quilibrium/quorum-shared` so mobile and desktop can't drift. Caught this 2026-06-09 mid-session.
- **Using `?? fallback` against possibly-empty-string envelope fields.** `??` only catches null/undefined. Use `||` or explicit `value && value.length > 0` when you're guarding against empty string.
- **`React.useCallback([])` for the broadcast trigger.** Stale closures via HMR look exactly like "my new log isn't printing" and waste hours.

## What still needs investigation

- The transport-level reason DMs sometimes don't deliver. We have no theory yet.
- The cause of asymmetric `conversations` tables between two clients in the same dev environment.
- Whether the action queue or websocket processQueue has a starvation / dropped-message mode for DM-control payloads specifically.
- Should we ship a "request profile from partner" pull mechanism for stuck-missing cases? Open design question.

## Files of interest

- [`src/services/MessageService.ts`](src/services/MessageService.ts) — `interceptControlMessages`, `handleDMProfileUpdate`, `broadcastProfileToAllDMs`, `encryptAndSendDm`, `handleNewMessage` (DM receive entry point around line 2800).
- [`src/components/context/MessageDB.tsx`](src/components/context/MessageDB.tsx) — `updateUserProfile` callback (line ~421).
- [`src/hooks/business/user/useUserSettings.ts`](src/hooks/business/user/useUserSettings.ts) — `saveChanges` (the global profile save).
- [`src/hooks/business/spaces/useSpaceProfile.ts`](src/hooks/business/spaces/useSpaceProfile.ts) — per-space profile save (does NOT touch DMs).
- [`src/components/direct/DirectMessage.tsx`](src/components/direct/DirectMessage.tsx) — DM render path, `otherUser` memo for sidebar identity.
- [`src/components/user/UserProfile.tsx`](src/components/user/UserProfile.tsx) — UserProfile modal used in spaces.
- [`@quilibrium/quorum-shared/src/types/message.ts`](../../../../quorum-shared/src/types/message.ts) — `UpdateProfileMessage`, `DMUpdateProfileMessage`.
- [`@quilibrium/quorum-shared/src/types/conversation.ts`](../../../../quorum-shared/src/types/conversation.ts) — `Conversation`.

## Related docs

- [Avatar & Initials System](../features/avatar-initials-system.md) — render-side fallback when identity is missing.
- [Per-Space Profile Data Flow](../../tasks/.done/per-space-profile-data-flow-analysis.md) — the space side's `update-profile` flow, mirror of DM logic.
- [Action Queue Summary](../../reports/action-queue/000-action-queue-summary.md) — outbound message queue we ride on.
- [DM Sync Non-Deterministic Failures](../../reports/action-queue/005-dm-sync-non-deterministic-failures.md) — known sync gap.

---
*Last updated: 2026-06-09*
