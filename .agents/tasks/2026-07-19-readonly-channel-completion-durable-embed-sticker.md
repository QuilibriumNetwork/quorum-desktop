---
type: task
title: "Complete read-only-channel enforcement: durable path + embed/sticker + always-sign read-only posts"
status: open — ready to implement (new session)
priority: medium-high
created: 2026-07-19
severity: HIGH (authorization bypass — same class as the merged control-message-auth fix)
spans-repos:
  - quorum-desktop
  - quorum-mobile
  - (quorum-shared: NO change needed — reuses existing exports)
closes-bug: .agents/bugs/2026-06-12-readonly-channel-receive-side-enforcement-gaps.md
builds-on: quorum-desktop#241, quorum-shared#61
---

# Complete read-only-channel enforcement

## Where we are (what's already done)

quorum-desktop#241 made read-only-channel **post acceptance** authorize the
**verified ed448 signer** as a channel manager — but only on the **live cache
path** (`addMessage` → `isReadOnlyPostAuthorized`), and only for `type: 'post'`.
Two gaps remain (they ARE the two gaps in the closes-bug doc):

1. **Durable path unguarded.** `saveMessage` (the IndexedDB write) has NO
   read-only check at all, so a forged read-only post still lands on disk and
   **reappears on the next refetch from storage** (remount / invalidate /
   navigate away and back). The live-path fix only hides it until reload.
2. **`embed` / `sticker` bypass.** The gate keys on `type === 'post'`, so a
   non-manager can put an **image or sticker** into a read-only channel and it's
   accepted (on both paths — it never even reaches the post-only live gate).

Net: a determined or non-text sender can still get content into a read-only
channel that recipients see. This is the same authorization-bypass class as the
control-message fix; finishing it fully closes the closes-bug.

## The design decision (confirmed with lead-dev intent 2026-07-19)

**Posts to a read-only channel must be SIGNED.** A read-only channel is
manager-only, and the only way to prove "this really came from a manager" is the
ed448 signature. So an unsigned post to a read-only channel is dropped —
including in a repudiable space (this is the one place where a repudiable space
does not get to be unsigned, because the channel's whole purpose is
manager-attributed content).

### Why this forces a 3-part change (the own-message gotcha)

A receive-side guard that drops *unsigned* read-only posts would also drop a
**legitimate manager's own post** if that post is unsigned — which can happen in
a repudiable space via the composer's "send unsigned" toggle. We cannot skip
"own messages" on the receive side, because every field we'd key on
(`senderId`, `sendStatus`) lives in the payload and is spoofable. So the fix
must ALSO guarantee legit read-only posts are always signed on send:

1. **Receive guard** (security) — drop unsigned/unverified/non-manager
   `post`/`embed`/`sticker` to a read-only channel, on BOTH the live and durable
   paths.
2. **Send-side force-sign** (so legit clients comply) — always sign a post to a
   read-only channel, overriding the unsigned toggle, so a manager's own post is
   never unsigned and never dropped.
3. **Composer UX** (honesty) — disable / hide the "send unsigned" toggle when the
   active channel is read-only, so a user isn't surprised their toggle had no
   effect. Recommended (cheap, good UX); the real enforcement is (1)+(2). Not a
   security control on its own — a modified client ignores the UI.

## Implementation — quorum-desktop

- **Receive guard, both paths.** Generalize the existing
  `isReadOnlyPostAuthorized` into a single guard used by BOTH `addMessage` (live)
  and `saveMessage` (durable), applied to `post` + `embed` + `sticker` for space
  channels. Simplest shape: an early guard at the top of each handler —
  `if (spaceId !== channelId && isReadOnlyGatedContent(type) && channelIsReadOnly
  && !authorized) return;` — so the intricate downstream branches don't need
  touching. `isReadOnlyPostAuthorized` already re-derives the fingerprint via
  `buildMessageFingerprint` and verifies ed448 self-containedly, and
  `canonicalize` already covers embed/sticker, so it works for those types as-is.
  - Replace the current post-only inline read-only block in `addMessage` with the
    generalized guard; add the guard to `saveMessage`'s catch-all `else` (where
    post/embed/sticker are persisted, `MessageService.ts` ~1508).
  - **Care:** `saveMessage` is shared by live + sync + offline replay. The guard
    is self-verifying so it holds on any path, but trace each caller to confirm a
    fail-closed drop can't lose a *legitimate* (signed) message. Legit signed
    manager posts pass on every path; only unsigned/forged ones drop.
- **Send-side force-sign.** In `submitChannelMessage`, when the target channel is
  read-only, force `skipSigning = false` (sign regardless of the repudiable
  toggle). The channel is already looked up on send.
- **Composer UX.** In `Channel.tsx` (composer wiring), disable/hide the signing
  lock when `channel.isReadOnly` (a manager posting there is always signed).

## Implementation — quorum-mobile (SAME change, mirror desktop)

- Bump `@quilibrium/quorum-shared` to **2.1.0-35** (published, includes the
  messageAuth primitives + `canManageReadOnlyChannel`). No shared change needed.
- Receive guard: `WebSocketContext.tsx` read-only post checks (live ~2280 and
  batch ~3816 use `canManageReadOnlyChannel(senderId, …)` on the payload
  senderId today) → switch to the verified signer (verify the post's ed448
  signature, resolve the signer, then `canManageReadOnlyChannel`), covering
  post/embed/sticker on both the live and durable/batch paths.
- Send-side force-sign for read-only channels (mobile send path in
  `services/space/spaceMessageService.ts` / `useSendSpaceMessage`).
- Composer UX: disable the signing lock in `MessageInput.tsx` when the channel is
  read-only (`signingOptional` already gates the lock on `isRepudiable`; add
  `&& !channel.isReadOnly`).
- iOS review pass (no runtime iOS testing available) + Android device test.

## Tests

Both platforms: signed manager post/embed/sticker to a read-only channel →
accepted; unsigned → dropped; signed non-manager → dropped; forged
`senderId`/`sendStatus` → dropped; and — crucially — a legit manager's OWN post
to a read-only channel is NEVER dropped (because it's force-signed). Durable:
confirm a forged read-only post does not survive a reload/refetch.

## Done = closes the bug

When both platforms enforce read-only for post/embed/sticker on live + durable
paths with force-signed sends, mark
`.agents/bugs/2026-06-12-readonly-channel-receive-side-enforcement-gaps.md`
resolved.

## References (for a cold review / full code check)

- **The bug this completes:** `.agents/bugs/2026-06-12-readonly-channel-receive-side-enforcement-gaps.md` (the two gaps = durable + embed/sticker).
- **The merged base this builds on:** quorum-desktop#241 (https://github.com/QuilibriumNetwork/quorum-desktop/pull/241). Desktop `src/services/MessageService.ts` — the existing `isReadOnlyPostAuthorized` (generalize it) and its use in `addMessage`; `saveMessage`'s catch-all `else` (~1508) is where durable enforcement goes. Tests: `src/dev/tests/services/MessageService.unit.test.tsx` §3e.
- **Shared primitives (published, consume as-is):** `@quilibrium/quorum-shared@2.1.0-35` — `buildMessageFingerprint`, `resolveVerifiedSender` (`D:/GitHub/Quilibrium/quorum-shared/src/utils/messageAuth.ts`), `canManageReadOnlyChannel` (`D:/GitHub/Quilibrium/quorum-shared/src/utils/channelPermissions.ts`).
- **Private tracking issue (the whole effort):** https://github.com/QuilibriumNetwork/quorum-app-prod/issues/1.
- **Mobile side:** the full mobile audit + reference list is in `D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/2026-06-25-space-control-msg-auth-signature-design.md` (gitignored/local) — mirror it for the mobile half of this task.
- **Cross-repo rules:** `D:/GitHub/Quilibrium/quorum-atlas.md` (esp. iOS-review-only, ship/PR conventions).

*Last updated: 2026-07-19*
