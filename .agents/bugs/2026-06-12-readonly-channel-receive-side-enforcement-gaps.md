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

## Note

Mobile is being implemented WITHOUT these gaps (all content types, both live + batch receive paths, durable). This desktop bug should be brought to parity — ideally both consume the same shared `canManageReadOnlyChannel` check on receipt so the rule can't drift per-type or per-path.

---

*Last updated: 2026-06-12*
