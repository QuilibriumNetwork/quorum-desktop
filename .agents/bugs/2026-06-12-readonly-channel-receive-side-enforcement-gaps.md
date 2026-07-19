---
type: bug
title: "Read-only channel receive-side enforcement is incomplete (sticker/embed bypass; cache-only for posts)"
status: open
created: 2026-06-12
ai_generated: true
related_bugs:
  - 2026-01-09-space-owner-privacy-limitation.md (#111 — owner can't be verified; managers enforce via roles)
  - 2026-06-12-everyone-mention-owner-bypass-send-side-only.md (sibling send/receive enforcement finding)
---

# Read-only channel receive-side enforcement is incomplete

> **⚠️ AI-assisted finding (2026-06-12). Verified against current desktop source.** Surfaced while building the equivalent read-only enforcement on mobile. Desktop DOES enforce read-only on receipt for `post`, but with two gaps that let non-manager content into a read-only channel.

## Summary

Read-only channels are meant to let only **manager-role** members post (owners must join a manager role too — they can't be verified, see #111). Desktop enforces this on receipt in `addMessage`, but the gate is incomplete:

1. **`sticker` and `embed` bypass the read-only check entirely.** The receive-side gate is guarded by `isPostMessage = decryptedContent.content.type === 'post'`, so a non-manager can post a **sticker or image/embed** into a read-only channel and every desktop recipient accepts and displays it.
2. **The `post` gate is cache-only, not durable.** The check lives in `addMessage` (React Query cache path) and drops the message there, but `saveMessage` (the IndexedDB persistence path) has **no** read-only check. So even a blocked `post` is still written to disk and **reappears on the next refetch from storage** (remount, invalidate, navigate away/back).

Net: read-only is enforced for `post` only at the cache layer, and not at all for `sticker`/`embed`. A determined or non-text sender can get content into a read-only channel that recipients will see.

## Evidence (current source)

### The receive-side gate (post-only, cache-only)
`src/services/MessageService.ts` `addMessage`:
```ts
const isPostMessage = decryptedContent.content.type === 'post';   // <-- sticker/embed excluded
if (!isDM && isPostMessage) {
  const space = await this.messageDB.getSpace(spaceId);
  if (!space) return;                       // fail-secure
  const channel = space.groups?.find(...)?.channels.find(c => c.channelId === channelId);
  if (!channel) return;
  if (channel.isReadOnly) {
    if (!channel.managerRoleIds?.length) return;
    const isChannelManager = space.roles?.some(
      (role) => channel.managerRoleIds?.includes(role.roleId) && role.members?.includes(senderId)
    ) ?? false;
    if (!isChannelManager) return;          // drop from cache
  }
}
```

### The disk path has no read-only check
`src/services/MessageService.ts` `saveMessage` — the catch-all `else` branch (handles `post`, `sticker`, `embed`) calls `messageDB.saveMessage(...)` with no `isReadOnly` validation. So a `post` rejected by `addMessage` is still persisted, and a `sticker`/`embed` is both persisted AND (since it's not `post`) never even hits the `addMessage` gate.

## Fix

1. **Cover all postable content types.** Change the receive-side guard from `type === 'post'` to include `'embed'` and `'sticker'` (any content that creates a visible message in the channel). Apply the same manager-role check.
2. **Enforce in BOTH paths.** Add the read-only validation to `saveMessage` (disk) as well as `addMessage` (cache), so a dropped message doesn't resurrect on refetch. Factor the check into a shared helper to avoid drift between the two paths — ideally reuse `quorum-shared`'s `canManageReadOnlyChannel` / `createChannelPermissionChecker(...).canPostMessage()` (no owner bypass, exactly this rule).
3. Keep fail-secure semantics (no space/channel data → drop).

## Hub-log migration impact (2026-06-13) — RAISES PRIORITY

The incoming desktop **hub log** (mobile's durable transport, replayed via `log-since` on
every reconnect/foreground; see
[2026-06-13-space-members-missing-no-join-row.md](2026-06-13-space-members-missing-no-join-row.md))
makes this bug **worse and more urgent**, not better. Today the "reappears on the next
refetch from storage" resurrection is intermittent (remount/invalidate/navigate). Under a
hub log that **replays every message on every reconnect**, the offending sticker/embed/post
is re-delivered and — because the durable `saveMessage` path has no read-only check — re-
persisted on each reconnect. The gap goes from occasional to reliably exercised.

This puts the bug in the same "make receive handlers replay-safe before the hub log lands"
category as the control-handler audit in
[2026-06-13-space-members-missing-no-join-row.md](2026-06-13-space-members-missing-no-join-row.md).
The fix (enforce in BOTH `addMessage` and `saveMessage`, cover all postable content types)
is effectively a **prerequisite** for the hub-log migration to be safe. Consider bumping
this above its current implicit priority and sequencing it with the migration prep.

## Attempted then reverted (2026-06-13) — defer to the hub-log migration

A first attempt added a shared `isReadOnlyViolation` helper enforcing read-only
on BOTH the cache and durable paths for `post`/`embed`/`sticker`. **Code review
caught a worse failure mode and it was reverted:** the durable-path fail-secure
reject could *permanently drop legitimate manager messages*. During sync replay
a message can arrive before its space/channel row is loaded; the check then sees
"no space → reject" and discards it from IndexedDB with no recovery — strictly
worse than the resurface-on-replay bug being fixed. It also created a
thread-reply asymmetry (`addMessage` short-circuits thread replies before the
check; the durable path did not).

**Conclusion:** the durable-path read-only enforcement must NOT fail-secure on
not-yet-loaded space data. It belongs with the hub-log migration (#32), where
sync/replay ordering is handled deterministically (you know when the log is
caught up), so "space absent" can be distinguished from "genuinely not a
manager." The cache-path enforcement remains as-is on `main` (unchanged). This
bug stays **open** for the durable-path + sticker/embed coverage, to be done as
part of #32.

## Note

Mobile is being implemented WITHOUT these gaps (all content types, both live + batch receive paths, durable). This desktop bug should be brought to parity — ideally both consume the same shared `canManageReadOnlyChannel` check on receipt so the rule can't drift per-type or per-path.

## 2026-07-19 — Partial related fix: sender identity now uses verified signer

**This bug remains open** (sticker/embed type-coverage gap and durable-path enforcement are unresolved). However, as part of the **control-message-auth fix** (see `.agents/tasks/2026-06-25-MASTER-RECAP-control-message-auth.md` and `.agents/docs/features/security.md`), the sender identity used when authorizing **control messages** on the receive side is now the **cryptographically verified ed448 signer** (via `resolveVerifiedSender` reverse-lookup), not the spoofable plaintext `senderId`.

This does NOT fix the read-only enforcement gaps described above (those involve `post`/`embed`/`sticker` content types in the `saveMessage` durable path, not control message authorization). But any code sample or prose in this bug that implies `senderId`-based authorization reflects **old behavior** — live control-message handling no longer relies on the plaintext field for identity decisions.

When the hub-log migration closes the durable-path and type-coverage gaps, the read-only check should also use `resolveVerifiedSender` (or `createChannelPermissionChecker` from `quorum-shared`) so that the identity chain is consistent with the control-message path.

---

*Last updated: 2026-07-19*
