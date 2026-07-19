---
type: bug
title: "@everyone mention: owner-bypass in shared hasPermission propagates (send-side-only enforcement)"
status: partially-fixed — root (owner bypass) fixed in shared; receive-side check pending
created: 2026-06-12
updated: 2026-07-19
ai_generated: true
spans-repos:
  - quorum-shared
  - quorum-desktop
  - quorum-mobile
related_bugs:
  - 2026-01-09-space-owner-privacy-limitation.md (#111 — the parent design limitation; this extends it to @everyone)
  - .archived/2025-09-11-space-owner-delete-permissions-bug.md (#68 — the delete local-illusion, same root cause, different enforcement model)
  - .archived/message-delete-owner-vulnerability.md
---

# @everyone owner-bypass is a real propagating bug (send-side-only enforcement)

> **STATUS UPDATE (2026-07-19):**
> - **Root fix LANDED**: shared `permissions.ts` no longer honors `isSpaceOwner` —
>   `hasPermission`/`getUserPermissions` are role-only (the param is retained but
>   deprecated/ignored). An honest owner-without-role client no longer sends
>   `@everyone`. The "Root fix (shared)" section below is therefore DONE.
> - **Remaining gap**: the receive side still honors `mentions.everyone` with no
>   sender-authorization check, so a modified client can still set the flag. This
>   defense-in-depth half is now folded into the broader receive-side
>   authorization mechanism work (verified-sender enforcement) tracked in
>   `.agents/tasks/2026-06-25-MASTER-RECAP-control-message-auth.md` — close this
>   bug when that Phase lands.

> **⚠️ AI-assisted finding (2026-06-12). Verified against current source in all three repos with file:line citations below.** Surfaced while scoping the mobile permission-enforcement work. The parent doc [2026-01-09-space-owner-privacy-limitation.md](2026-01-09-space-owner-privacy-limitation.md) (#111) documents the owner-can't-be-verified constraint and its impact on **delete/mute/read-only**, but does NOT cover `mention:everyone`. This doc fills that gap, because @everyone behaves differently from the actions #111 lists.

## TL;DR

A **space owner with no role granting `mention:everyone`** can send an `@everyone` that **notifies the entire space on every desktop client**. This is NOT a local illusion (unlike owner pin/delete). It propagates because **@everyone has no receive-side validation** — its only enforcement is the send-side `hasPermission(..., isSpaceOwner)` call, and that call's owner-bypass returns `true` for owners.

Root cause is the owner-bypass in shared `hasPermission`, which contradicts the documented design ("owners get no implicit permissions except kick") and the sibling `channelPermissions.ts` (which has no owner bypass).

## The architecture: three enforcement models, not one

Clients **cannot verify who the space owner is** (no `ownerAddress` transmitted — privacy requirement, see #111). So owner status is meaningless to a recipient. Each permission resolves this differently:

| Action | Enforcement model | Owner-without-role impact | Severity |
|---|---|---|---|
| **kick** | protocol-level (ED448 owner key, receiver-verifiable) | works correctly (owner-only) | OK by design |
| **delete / pin** | send-side gate **+ receive-side role validation** | **local illusion** — sender sees it, recipients reject it (`MessageService.ts` checks sender role on receipt, no owner bypass) | cosmetic (misleading button) |
| **`mention:everyone`** | **send-side gate ONLY** — no receive-side check | **REAL & PROPAGATING** — every recipient fires the @everyone notification | **HIGH** |

The first two rows are documented (#111, #68). **The third row is this bug** and was previously undocumented.

## Evidence (current source)

### 1. The root: shared `hasPermission` owner-bypass
`quorum-shared/src/utils/permissions.ts:15-24`
```ts
export function hasPermission(userAddress, permission, space, isSpaceOwner = false): boolean {
  // Space owners always have all permissions
  if (isSpaceOwner) {
    return true;          // <-- grants @everyone (and everything) to any owner
  }
  ...
}
```
This contradicts:
- The documented design — `space-permissions/space-roles-system.md`, `space-permissions-architecture.md`: "Space owners do NOT have automatic permissions for post/delete/pin... must join appropriate roles. Kick exception via protocol."
- Shared's own newer `channelPermissions.ts` (`UnifiedPermissionSystem`), whose every method has "NO isSpaceOwner bypass" and only `canKickUser()` returns owner. (Note: that file's **header comment line 16** — "Space Owner - Has ALL permissions everywhere" — is ALSO stale/wrong and contradicts its own method bodies; fix it too.)

### 2. Send-side: owner-bypass flows into the wire flag
- `quorum-desktop/src/services/MessageService.ts:4626` — `canUseEveryone = hasPermission(addr, 'mention:everyone', space, isSpaceOwner || false)` → passed as `allowEveryone` to `extractMentionsFromText`.
- `quorum-desktop/src/components/space/Channel.tsx:1129-1136` — same call, gates the composer @everyone UI.
- `quorum-shared/src/utils/mentions.ts:376-387` — `extractMentionsFromText` sets `mentions.everyone = true` iff `allowEveryone`.
- `quorum-shared/src/types/message.ts:290-296` — `Mentions.everyone?: boolean` travels on the wire in the encrypted payload.

So owner-without-role → `canUseEveryone = true` → `mentions.everyone = true` on the outgoing message.

### 3. Receive-side: NO @everyone authorization check
- `MessageService.ts` `saveMessage` and `addMessage`: post messages with `mentions.everyone = true` fall through the generic `else` branch. The only mention check is a **count** limit (`MAX_MENTIONS_PER_MESSAGE`), never a sender-authorization check.
- Notification path `MessageService.ts:4427-4495` → `isMentionedWithSettings` (`quorum-shared/src/utils/mentions.ts:303-306`):
  ```ts
  if (enabledTypes.includes('mention-everyone')) {
    if (mentions.everyone === true) { return true; }   // honored as-is, no sender check
  }
  ```
  → `addPendingNotification` → real OS notification "X mentioned @everyone in <space>".
- Contrast — delete/pin DO validate on receipt: `MessageService.ts` (remove-message) `space.roles.some(r => r.members.includes(senderId) && r.permissions.includes('message:delete'))`, no owner bypass; same for `message:pin`. That's why owner delete/pin is only a local illusion.

### 4. Mobile state (for completeness)
- Mobile **never sends** `everyone` (hardcodes empty `mentions` on all send paths — `services/space/spaceMessageService.ts:285/402/562/630`), so mobile can't *originate* this bug today.
- Mobile **never fires** an @everyone notification for space messages on receipt (no `isMentionedWithSettings` in its space receive path), so a desktop-originated improper @everyone doesn't notify on mobile.
- **However**, mobile has a separate, worse receive-side gap for delete: `context/WebSocketContext.tsx:1815-1841` applies ANY `remove-message` with zero sender-role validation. So while desktop rejects an improper delete, **mobile honors it** — meaning owner-without-role (and in fact ANY sender) can delete others' messages on mobile peers. Tracked in the mobile task; noted here for cross-repo completeness.

## Fix

**Root fix (shared):** remove `if (isSpaceOwner) return true` from `hasPermission`, and the owner shortlist from `getUserPermissions`, making them role-only (honest). Kick is unaffected (it never used `hasPermission`). Fix the stale `channelPermissions.ts:16` header comment.

**Caller impact of the shared fix (verified census):**
- Desktop pin (`useChannelMessages.ts:145`, `usePinnedMessages.ts:254`) already hardcode `isSpaceOwner: false` → **no change**.
- Desktop delete already avoids `hasPermission` (raw role check) → **no change**.
- Desktop mute already uses `channelPermissions` (no bypass) → **no change**.
- Desktop **@everyone** (`MessageService.ts:4626`, `Channel.tsx:1130`) pass real `isSpaceOwner` → **owner now needs a `mention:everyone` role. This is the fix.** (Intended behavior change: matches design.)
- Mobile pin/delete (`useHasPermission` in `[channelId].tsx:54-55`) pass real `isSpaceOwner` → owner pin/delete button disappears (correct; the button was a local illusion anyway).

**Defense-in-depth (recommended, separate):** add receive-side @everyone validation so a malicious/old client can't spam @everyone even with the flag set — bringing @everyone in line with how delete/pin are already protected on receipt. Note the same privacy constraint applies (can't verify owner), so the receive-side check is "sender has a role with `mention:everyone`", identical in shape to the delete/pin receive checks.

## Why this matters more than the delete case

#111 rates `message:delete` by roled-users as CRITICAL but it requires a *trusted role assignment* to exploit. This @everyone bug needs **no role at all** — any space owner triggers it just by being owner, and unlike delete it actually *propagates* (no receive-side catch). It's annoyance-grade (notification spam) not destructive, but it's a live, zero-setup, network-wide behavior on desktop today.

---

*Last updated: 2026-06-12*
