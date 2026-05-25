---
type: bug
title: Space Owner Privacy Limitation
status: open
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-01-09T00:00:00.000Z
related_issues:
  - '#111'
---

# Space Owner Privacy Limitation

https://github.com/QuilibriumNetwork/quorum-desktop/issues/111

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Summary

Space owner identity cannot be exposed in the `Space` type for privacy reasons. This prevents receiving-side clients from verifying space ownership, requiring space owners to manually assign themselves moderation roles. As a consequence, users with certain permissions can perform actions against the space owner that would otherwise be protected.

## Root Cause

In a privacy-focused decentralized system, exposing `Space.ownerAddress` would reveal the space owner's identity to all members. This limitation is an **design decision** for privacy.

Without `ownerAddress`, receiving-side validation cannot check:
```typescript
// IMPOSSIBLE - field doesn't exist for privacy
if (decryptedContent.content.senderId === space.ownerAddress) {
  // Protect space owner...
}
```

## Impact Table

| Issue | Criticality | Impact | Recovery |
|-------|-------------|--------|----------|
| **Users with `message:delete` can delete space owner's messages** | **CRITICAL** | Permanent message loss, destructive | ❌ None |
| **Users with `user:mute` can mute space owner** | MEDIUM | Owner temporarily silenced | ✅ Owner can unmute self |
| **Space owner must self-assign roles for moderation** | LOW | Owner needs manual role setup for delete/pin/mute | N/A |
| **Space owner must join manager roles for read-only channels** | LOW | Cannot post without role setup | N/A |
| **`user:kick` permission** | NONE | Protocol-level ED448 verification protects owner | N/A |

## Most Critical: `message:delete` Vulnerability

Users with `message:delete` role permission can delete **any** message including the space owner's messages. This is:
- **Destructive**: Deleted messages cannot be recovered
- **No protection possible**: Receiving-side cannot identify owner to protect
- **Trust-dependent**: Space owners must carefully vet who gets delete permission

## Current Workarounds

1. **Space owners must create and join roles** with the permissions they need (delete, pin, mute)
2. **Careful permission delegation**: Only assign `message:delete` to highly trusted users
3. **Owner self-unmute**: For `user:mute`, owner can unmute themselves if they have the permission

## Why `user:kick` is Unaffected

Kick is the **only** space owner action verified at the protocol level:
- Uses ED448 signature from `owner_public_keys`
- Cannot be delegated or spoofed
- Receiving clients verify cryptographically

## Potential Solutions (Privacy-Preserving)

### 1. Protected Addresses List
Space manifest includes optional `protectedAddresses: string[]`. Only owner-key signatures can delete messages from protected addresses. Owner adds themselves (and optionally others) to this list.
- **Privacy**: ⚠️ Reveals "special" addresses exist | **Protection**: ✅ Full | **Effort**: Medium

### 2. Owner-Signed Certificates
Owner issues blind certificates `{ address, spaceId, immunity: true }` signed with owner key. Receiving clients verify certificate before honoring destructive actions. Certificates don't reveal who issued them.
- **Privacy**: ✅ Good | **Protection**: ✅ Full | **Effort**: High
- **SDK**: ✅ Can use existing `js_sign_ed448`/`js_verify_ed448` functions

### 3. Zero-Knowledge Proofs
Owner generates ZK proof proving knowledge of owner private key without revealing identity. Attached to messages needing protection. Cryptographically perfect but requires ZK library integration.
- **Privacy**: ✅ Perfect | **Protection**: ✅ Perfect | **Effort**: Very High
- **SDK**: ⚠️ Requires SDK enhancement - ZK proofs exist at Quilibrium protocol level but not exposed in `quilibrium-js-sdk-channels`

## Related

- [space-owner-delete-permissions-bug.md](.archived/space-owner-delete-permissions-bug.md) - Proposes `ownerAddress` solution (rejected for privacy)
- [message-delete-owner-vulnerability.md](.archived/message-delete-owner-vulnerability.md) - Details the delete vulnerability (archived)
- [security.md](../docs/features/security.md) - Security architecture noting no `isSpaceOwner` bypass
- [space-roles-system.md](../docs/space-permissions/space-roles-system.md) - Documents owner must join roles

---


_Status: Design Limitation (accepted trade-off for privacy)_
