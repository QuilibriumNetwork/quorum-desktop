---
type: doc
title: DM Architecture and Debug Playbook
status: living
created: 2026-06-09
updated: 2026-06-10
audience: future agents debugging DM-related bugs (delivery, identity, sync)
---

# DM Architecture and Debug Playbook

> **Why this exists.** We keep re-discovering the same DM internals every session. This doc consolidates the moving parts, the data shape, the receive-vs-send asymmetries, the known sync gaps, and a step-by-step debug procedure. Read this before you touch DM code or open a fresh investigation.

## Cheat sheet — read this first

- DM identity (name, icon, bio) lives in `conversations` (IndexedDB). One row per partner, keyed by `conversationId = partnerAddress + '/' + partnerAddress`.
- DM identity is captured **at session-init time** from the encrypted envelope's `user_profile`. Established sessions (`DoubleRatchetInboxDecrypt`) do NOT carry profile data on subsequent messages.
- A change to a DM partner's pfp/name/bio is propagated by a **`dm-update-profile` control message** sent over the existing DM session whenever the partner saves their global profile in User Settings → General. This is intercepted on receive (never persisted as a chat post) and upserts the conversation row. This is the **push** path.
- There is also a **pull/back-fill** path for identity the push never delivered (older contacts, missed messages): `useConversationsWithProfileBackfill` fetches the partner's server-side public profile and **writes it through to the `conversations` row**. See "Identity sources & the three sync paths" below. This is what makes the sidebar and the no-flash conversation open work for legacy contacts (added 2026-06-10).
- Per-space profile saves (Space Settings → Account) are independent — they only touch `space_members`, never DMs.
- **Network sync between two clients is not reliable.** Regular DMs from B to A sometimes never arrive. This is an open issue, not a code bug we've identified.

## Identity sources & the three sync paths

A DM partner's name/avatar/bio can reach you three ways. Knowing which one a given symptom belongs to is the whole game.

**The durable source of truth is the local `conversations` row.** Every render surface (sidebar, header, per-message avatar) is *supposed* to read from it. A user has exactly **one** avatar/name; the routes below are just different ways that one value gets into your row. There is no separate "public-profile picture" distinct from the normal one.

| # | Path | When it fires | Writes to row? | Notes |
|---|------|---------------|----------------|-------|
| 1 | **Session-init capture** | First incoming DM from a partner (`NewDoubleRatchetRecipientSession`) | Yes | Captures `display_name` + `user_icon` from the envelope once. Frozen after that. |
| 2 | **`dm-update-profile` push** | Partner saves their global profile while you have an active session | Yes (upsert) | The privacy-preserving path — travels inside the encrypted DM channel, no server sees it. Only reaches active sessions, only going forward. |
| 3 | **Public-profile pull + write-back** | You render a contact whose row still holds the `"Unknown User"` / default-icon placeholder | Yes (back-fill, placeholder fields only) | `useConversationsWithProfileBackfill`. Centralized HTTP `GET /users/:addr/public-profile`. Only works if the partner opted into a public profile. Heals legacy contacts that predate path 2. |

**Read-after-write, never read-from-network-at-render.** Once any path has written the row, all surfaces read it locally — fast, offline, no flash. We do **not** poll the network on every conversation open. Path 3's fetch has a 1h React Query `staleTime` and only targets rows still on the placeholder, so it's effectively one-time-per-contact, then silent.

**Why path 3 exists (the bug it fixed, 2026-06-10).** The sidebar read the raw row with no fallback, while the conversation view fell back to the public profile *in memory only* (`DirectMessage.tsx` `members` memo) and never persisted it. Result: header/messages showed the avatar, sidebar showed the default, and the conversation view re-fetched on every open (the 1-2s flash). Path 3 gives the sidebar the same fallback **and writes it through**, so the row is correct everywhere and the flash disappears. Safety: it only overwrites a field still holding the placeholder, so a path-2 value is never clobbered by a (possibly stale) public profile.

**The honest gaps.** If a partner changes their avatar and you have no active session (or the message is missed), path 2 won't reach you; path 3 only helps if they also published a public profile. A contact with neither an active exchange nor a public profile (e.g. `@3` in testing) stays on the default until they actually send you data. That's a property of the model, not a bug.

## Architecture map

### Storage

- **`conversations`** — DM list rows. Fields used for identity: `displayName`, `icon`, `bio?`, `address` (partner). Composite key: `conversationId`. Type: `Conversation` from `@quilibrium/quorum-shared`.
- **`messages`** — chat messages. Snapshots sender name + icon at receive time into the row (used by message list header rendering).
- **`encryption_states`** — per-session Double Ratchet state. A row here means we have an active DM session with that partner. No row = no DM exists between us.
- **`space_members`** — per-space profile per user. Composite key `[spaceId, user_address]`. Has `bio` (per-space override).
- **`user_config`** — own user's config (includes own global `bio`, `name`, `profile_image`). Synced via server if `allowSync: true`.
- **`user_info`** — own passkey/identity metadata. Beware: on some builds the store name is `user_info`, on others (older) it was `passkey_info`. Always probe `objectStoreNames` first.

### Read paths (who shows DM identity)

1. **DM list sidebar** — reads `conversations` via React Query `useConversations`. Cache key: `buildConversationsKey({ type: 'direct' })`. Enriched by `useConversationsWithProfileBackfill` (path 3 above): placeholder rows get the public profile merged in for render AND written back to the row.
2. **DM chat header** — `useConversation` for the open conversation. Cache key: `buildConversationKey({ conversationId })`.
3. **DM UserProfile sidebar** (the inline profile panel in DM view) — reads `conversation.bio` first, then falls back to `recipientPublicProfile?.bio` (server-side public profile, only present if the partner opted in). See [`DirectMessage.tsx`](src/components/direct/DirectMessage.tsx) `otherUser` memo.
4. **DM message list per-message header** — reads `members` map produced by `useChannelData`-like logic; for DMs the map has one entry.
5. **Public-profile fallback** — two hooks, same endpoint (`GET /users/:addr/public-profile`), different consumers:
   - `useMembersWithPublicProfileFallback` — space message surfaces. Render-only fallback; fires only when a member has **neither** name **nor** icon (so it does NOT trigger for a row whose name is the literal `"Unknown User"`).
   - `useConversationsWithProfileBackfill` — DM sidebar (path 3). Per-field (`"Unknown User"` / default icon each count as empty), and **writes the result back** to the `conversations` row.
   - 404 (user opted out) → no fallback data; the field stays on its placeholder.

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
| Initials + truncated address everywhere | `conversations.displayName` / `icon` — was identity ever captured? If the partner has a public profile, path 3 (`useConversationsWithProfileBackfill`) should fill it; run `.agents/tools/dm-debug/05-profile-sources.js` to confirm a source exists. |
| Name shows, pfp missing | `conversations.icon` is the default / empty. Path 3 recovers it **if** the partner published a public-profile image; otherwise needs a `dm-update-profile` push. Use `05-profile-sources.js`: `storedIconIsDefault: true` + `pubHasImage: YES` = path 3 should fill it. |
| Shows in conversation header/messages but NOT sidebar | Classic path-3 gap (the 2026-06-10 bug). The conversation view fell back to the public profile in memory; the row was never written. Should be fixed now — if it recurs, check that `useConversationsWithProfileBackfill` is wired into `DirectMessageContactsList` and that the write-back isn't erroring (look for `[DMProfileBackfill]` warnings). |
| Pfp shows but bio doesn't | `conversations.bio` field. If null, the user never broadcast `dm-update-profile`, or the broadcast didn't arrive. (Bio is NOT back-filled to the row by path 3 — only name/icon are.) |
| Stale identity (old pfp shown after partner changed it) | Needs a `dm-update-profile` broadcast from partner. Path 3 won't overwrite a non-placeholder value, so a stale-but-real pfp is intentionally left alone until path 2 updates it. |

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

## The "fetch-once-at-startup" pattern and the hub-log migration (2026-06-13)

A recurring desktop architecture flaw underlies a whole cluster of bugs: **desktop
fetches state once at startup (or on a one-shot event) and never reconciles after.**
There is no durable, replay-on-reconnect catch-up. Whatever you miss while offline — or
whatever changes on another device after your startup fetch — stays stale until a
restart. Mobile does NOT have this problem: it uses a per-hub **durable log**, replayed
via `log-since` on every reconnect/foreground (`quorum-mobile`
`context/WebSocketContext.tsx:4121-4248`, `services/space/hubLogSync.ts`,
`hubLogCursor.ts`), so missed `join` / `update-profile` / config-sync messages are caught
up automatically.

Confirmed instances of the pattern (all desktop):

| Bug | What's fetched once and never reconciled |
|---|---|
| [space-members-missing-no-join-row](../../bugs/2026-06-13-space-members-missing-no-join-row.md) | Member roster — `join` is an ephemeral fire-and-forget broadcast; miss it and the row never appears (~52% missing in a live test). |
| [config-not-refetched-stale-until-restart](../../bugs/2026-06-13-config-not-refetched-stale-until-restart.md) | Synced `UserConfig` — only server-fetched at startup; cross-device changes invisible until restart. |
| [config-sync-space-loss-race-condition](../../bugs/2026-01-09-config-sync-space-loss-race-condition.md) | Space sync as a fragile one-shot startup loop (this also has a separate destructive `saveConfig` bug). |
| [user-settings-modal-stale-display-name](../../bugs/2026-05-30-user-settings-modal-stale-display-name.md) | Settings modal reads a cached source not invalidated on incoming sync (same family, modal-local). |

**The hub log is the general fix for this whole class.** The lead dev is bringing mobile's
hub log to desktop. Rather than build per-bug refetch triggers (window-focus, polling,
on-reconnect `requestSync`), the durable replay gives every one of these a single,
reliable catch-up path. Implication for anyone touching these bugs: **don't build a
bespoke refetch band-aid ahead of the migration** — sequence the fix WITH the hub log.

**Two prerequisites the hub log needs on the receive side** (replay re-runs every handler
on every reconnect, so any handler that bails or null-derefs on missing state silently
drops or resurrects content):
1. Control-message receive handlers must be upsert-safe / null-safe. Audit lives in
   [space-members-missing-no-join-row](../../bugs/2026-06-13-space-members-missing-no-join-row.md)
   ("Control-handler replay audit"). `update-profile` + non-repudiability fixed in PR #199;
   `verify-kicked`, `leave`, and several `space!` derefs still need it.
2. Durable-path enforcement must match cache-path enforcement, or replay resurrects blocked
   content — see [readonly-channel-receive-side-enforcement-gaps](../../bugs/2026-06-12-readonly-channel-receive-side-enforcement-gaps.md)
   (read-only check is cache-only; replay re-persists the offending message every reconnect).

## What still needs investigation

- The transport-level reason DMs sometimes don't deliver. We have no theory yet.
- The cause of asymmetric `conversations` tables between two clients in the same dev environment.
- Whether the action queue or websocket processQueue has a starvation / dropped-message mode for DM-control payloads specifically.
- ~~Should we ship a "request profile from partner" pull mechanism for stuck-missing cases?~~ **Partially done (2026-06-10):** `useConversationsWithProfileBackfill` pulls from the server-side *public profile* (not a P2P request to the partner) and writes it back to the row. A true peer-to-peer "request your profile" message is still unbuilt and would cover partners who never published a public profile.

## Files of interest

- [`src/services/MessageService.ts`](src/services/MessageService.ts) — `interceptControlMessages`, `handleDMProfileUpdate`, `broadcastProfileToAllDMs`, `encryptAndSendDm`, `handleNewMessage` (DM receive entry point around line 2800).
- [`src/components/context/MessageDB.tsx`](src/components/context/MessageDB.tsx) — `updateUserProfile` callback (line ~421).
- [`src/hooks/business/user/useUserSettings.ts`](src/hooks/business/user/useUserSettings.ts) — `saveChanges` (the global profile save).
- [`src/hooks/business/spaces/useSpaceProfile.ts`](src/hooks/business/spaces/useSpaceProfile.ts) — per-space profile save (does NOT touch DMs).
- [`src/components/direct/DirectMessage.tsx`](src/components/direct/DirectMessage.tsx) — DM render path, `members` + `otherUser` memos (the in-memory public-profile fallback that path 3 makes durable).
- [`src/hooks/business/conversations/useConversationsWithProfileBackfill.ts`](src/hooks/business/conversations/useConversationsWithProfileBackfill.ts) — path 3: sidebar public-profile pull + write-through to the `conversations` row.
- [`src/components/direct/DirectMessageContactsList.tsx`](src/components/direct/DirectMessageContactsList.tsx) — DM sidebar; wires in path 3 after `useConversationPreviews`.
- [`src/components/user/UserProfile.tsx`](src/components/user/UserProfile.tsx) — UserProfile modal used in spaces.
- [`@quilibrium/quorum-shared/src/types/message.ts`](../../../../quorum-shared/src/types/message.ts) — `UpdateProfileMessage`, `DMUpdateProfileMessage`.
- [`@quilibrium/quorum-shared/src/types/conversation.ts`](../../../../quorum-shared/src/types/conversation.ts) — `Conversation`.

## Related docs

- [Avatar & Initials System](../features/avatar-initials-system.md) — render-side fallback when identity is missing.
- [Per-Space Profile Data Flow](../../tasks/.done/per-space-profile-data-flow-analysis.md) — the space side's `update-profile` flow, mirror of DM logic.
- [Action Queue Summary](../../reports/action-queue/000-action-queue-summary.md) — outbound message queue we ride on.
- [DM Sync Non-Deterministic Failures](../../reports/action-queue/005-dm-sync-non-deterministic-failures.md) — known sync gap.

---
*Last updated: 2026-06-13*
