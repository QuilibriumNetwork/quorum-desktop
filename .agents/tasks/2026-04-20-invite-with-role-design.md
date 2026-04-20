---
type: task
title: Invite with Role (Pre-assign Role to Non-Members)
status: design
issue: https://github.com/QuilibriumNetwork/quorum-desktop/issues/81
created: 2026-04-20T00:00:00.000Z
updated: 2026-04-20T00:00:00.000Z
---

# Invite with Role — Design

## 1. Summary

Today, a space owner can only assign a role to a user who is **already a member** of the space. This feature extends role assignment to cover **non-members**: the owner can pre-assign one or more roles to a user's address, and when that user later joins the space (by any means), the role(s) are applied automatically.

The primary UX entry point is the existing "send invite to user" flow: when the owner picks a recipient, they can optionally pick a role to attach. On send, the invite is dispatched as today and a pending role entry is written to the space's manifest.

## 2. Scope and Non-Goals

### In scope
- Add a new `pendingRoleInvites` field to the `Space` type in `@quilibrium/quorum-shared`
- Role picker in the existing "send invite via DM" flow on desktop (owner-only)
- Automatic role application when a pre-assigned user joins (via any invite mode — private or public)
- "Pending invites" management panel in Space Settings → Roles, with cancel action
- Cleanup of pending entries when the corresponding user is kicked
- Cleanup of pending entries on space rekey (`generateNewInviteLink`)

### Out of scope
- Multiple roles per invite (data shape is forward-compatible; UI ships single-select)
- Expiration/time-based pruning of pending entries
- Mobile implementation of the send-side UI (data shape is forward-compatible so mobile sync preserves entries)
- Bulk pre-assignment, scripted onboarding, or any non-invite UI surface
- Permission gating of this action behind anything other than "is space owner"

## 3. User Story

1. Alice owns Space S and has created a role "Mod"
2. Alice opens "send invite" and picks Bob as the recipient
3. Alice picks "Mod" from the new role dropdown (optional — she can still send without a role)
4. Alice clicks send
5. Bob receives the invite in his DMs with Alice, exactly as today
6. Bob clicks the invite and joins
7. Immediately on join, Bob has the "Mod" role in Space S — no manual assignment by Alice needed
8. If Bob leaves or is kicked and later rejoins, he rejoins with no role (pre-assignment consumed)

## 4. Why This Design

The critical insight: **the feature is not really about invites.** It's about allowing the owner to assign a role to a user who has not yet joined. The invite flow is just the natural UX to reach that capability (the owner already has the recipient's address in hand at that point).

This framing produces a clean, decoupled design:
- The invite system (URLs, crypto, `constructInviteLink`, `joinInviteLink`, public-link generation) is **not touched**
- The feature works identically in private and public invite modes because it's decoupled from the invite mechanism entirely
- The security invariant is simple: **roles never materialize from URLs or messages; they only materialize from owner-signed data in the space manifest**

## 5. Architecture

### 5.1 Data model change (`@quilibrium/quorum-shared`)

Extend the `Space` type with one new optional field:

```typescript
export type PendingRoleInvite = {
  address: string;          // user address being pre-assigned
  roleIds: string[];        // role IDs to apply on join (length 1 today)
  createdAt: number;        // ms timestamp, for display and ordering
};

export type Space = {
  // ...existing fields...
  pendingRoleInvites?: PendingRoleInvite[];
};
```

Design choices:
- **Optional field.** Old clients and missing data are handled by treating it as `[]`.
- **`roleIds: string[]`, not `roleId: string`.** Ships with length 1 today, but avoids a future migration if we expand to multi-role invites later.
- **Space-level, not role-level.** The atom of the feature is "this user is pre-assigned to these roles," which is one record per address. Colocating this with the `Space` (alongside `roles`, `emojis`, etc.) matches how we reason about it and makes the management UI trivial (one row per pending invite, not one per (address, role) pair).
- **Address-keyed (no invite-id).** The pending entry is keyed on the recipient's address alone. This is what makes the feature work in both private and public invite modes: we never need to tie the role grant to a specific invite URL or cryptographic ticket.

### 5.2 Owner-side: extending the send-invite flow

The existing "send invite via DM" UI (in the space's member invite modal) gains one new optional field: a role picker.

On send, the owner's client does two sequential operations:

1. **Send the invite** — calls `InvitationService.sendInviteToUser()` exactly as today. The invite URL, the DM message, and the crypto are all unchanged.
2. **Write the pending entry** (only if a role was picked, owner only):
   - Guard: verify `currentPasskeyInfo.address === space.ownerAddress` before writing. The UI already restricts this action to owners, but the hook-level code must enforce it too since `useInviteManagement` currently types `space` as `any`.
   - As part of this work, type the `space` parameter in `useInviteManagement.ts` as `Space` (from `@quilibrium/quorum-shared`) to prevent the write from silently bypassing TypeScript checks.
   - Read local `space.pendingRoleInvites` (or `[]` if undefined)
   - If an entry already exists for `recipientAddress`, replace it (D1 overwrite semantics)
   - Otherwise append `{address: recipientAddress, roleIds: [selectedRoleId], createdAt: Date.now()}`
   - Call `messageDB.saveSpace(updatedSpace)` and enqueue `actionQueueService.enqueue('update-space', { spaceId, space: updatedSpace }, 'space:${spaceId}')` — the same dedup-keyed path used by `useSpaceManagement.saveChanges()`

These two steps are independent. If step 2 fails after step 1 succeeds, the invite is still valid — the recipient joins without a role. The owner will see no visual failure indicator in the current architecture (the invite-send path does not surface async errors from the manifest update). The owner can add the pending role via the management panel as a fallback. This is a known limitation, acceptable for a "nice to have" feature.

### 5.3 Joiner-side: no changes

`joinInviteLink()` is untouched. The joining client doesn't need to know about pending role entries.

### 5.4 Role application on `join` event — owner-client only

**Important timing constraint:** when the join control message fires, the joiner's client (and most other clients) hold a locally-cached manifest that predates the pending-entry write. The owner is the only client guaranteed to have the updated manifest at join time (because the owner wrote the pending entry before enqueuing the manifest re-post).

Therefore role application runs **only on the owner's client** in the join handler. Other clients will receive the correct state when the owner publishes the next manifest update (which happens on any subsequent role edit or rekey). This is a weaker consistency guarantee — other clients temporarily show Bob without the role — but it is honest about what the distributed system can deliver without a forced manifest re-post on every join.

To minimise the visibility window, the owner's client should **immediately re-post the manifest** after applying the role locally. This way, other clients converge quickly.

Implementation in `MessageService.ts` join handler (around line 2876, inside the `if (result === 'true')` block), **guarded by an owner check**:

```typescript
// After saveSpaceMember(...) succeeds, owner-client only:
const isOwner = space?.ownerAddress === self_address;
if (isOwner && space?.pendingRoleInvites?.length) {
  const pendingIdx = space.pendingRoleInvites.findIndex(
    p => p.address === participant.address
  );
  if (pendingIdx !== -1) {
    const pending = space.pendingRoleInvites[pendingIdx];
    const updatedRoles = space.roles.map(role => {
      if (!pending.roleIds.includes(role.roleId)) return role;
      if (role.members.includes(participant.address)) return role;
      return { ...role, members: [...role.members, participant.address] };
    });
    const updatedPending = space.pendingRoleInvites.filter(
      (_, i) => i !== pendingIdx
    );
    const updatedSpace = {
      ...space,
      roles: updatedRoles,
      pendingRoleInvites: updatedPending,
    };
    await this.messageDB.saveSpace(updatedSpace);
    queryClient.setQueryData(buildSpaceKey({ spaceId }), updatedSpace);
    // Re-post manifest so other clients converge promptly
    await actionQueueService.enqueue(
      'update-space',
      { spaceId, space: updatedSpace },
      `space:${spaceId}`
    );
  }
}

### 5.5 Kick path: pending-entry cleanup

When the owner kicks a user via `SpaceService.kickUser()`, extend the role-stripping block (currently at `SpaceService.ts:785`) to also remove any pending entry for the kicked address:

```typescript
space.roles = space.roles.map(role => ({
  ...role,
  members: role.members.filter(m => m !== userAddress)
}));
space.pendingRoleInvites = (space.pendingRoleInvites ?? []).filter(
  p => p.address !== userAddress
);
```

**Note on local persistence:** the existing kick code at line 785 does not call `messageDB.saveSpace()` — it serializes the mutated `space` object directly into the outgoing ciphertext at line 791 (`JSON.stringify(space)`). The pending-entry mutation follows the same pattern: it will be included in the outgoing manifest (so other clients see it correctly) but the owner's local IndexedDB record will remain stale until the `manifest-update` comes back around or the next explicit `saveSpace`. This is an existing inconsistency in the kick path, not introduced by this feature. If a `saveSpace` call is added to fix this for the owner's local view, it should be a separate cleanup. For now, the mutation is placed alongside the existing `space.roles` mutation and follows the same conventions.

### 5.6 Space rekey: pending-entry cleanup

`InvitationService.generateNewInviteLink()` is called when the owner generates or regenerates the public invite link. This operation rekeys the space. At the same time, clear all pending entries.

**Placement is critical:** the mutation must happen before line 434 where `space` is serialized into the manifest ciphertext (`JSON.stringify(space)`). Specifically, it must be placed alongside the `space!.inviteUrl = ...` assignment at line 433 — both mutations happen to the `space` object before it is encrypted:

```typescript
// Line 433 area in generateNewInviteLink:
space!.inviteUrl = `...`;
space!.pendingRoleInvites = [];  // ← add here, before JSON.stringify(space)
const ciphertext = ch.js_encrypt_inbox_message(
  JSON.stringify({ ..., plaintext: [...Buffer.from(JSON.stringify(space), 'utf-8')] })
);
```

Placing it after the `saveSpace` call at line 485 would update local storage but not the posted manifest.

Rationale: rekeying is a destructive reset of the invite state. Pending entries that were created under the old regime should not silently carry over — the owner can re-create them if still desired.

### 5.7 Management UI: Space Settings → Roles → Pending Invites

A new collapsible section at the top or bottom of the existing Roles screen (`src/components/modals/SpaceSettingsModal/Roles.tsx`), visible only to the space owner.

Layout: one row per pending entry, showing:
- User address (or display name if resolvable via profile cache)
- Role badge(s) (1 today, ready for N)
- Relative time ("invited 2 days ago") derived from `createdAt`
- A "Cancel" button (trash icon) that removes the entry and re-posts the manifest

Empty state: section hidden entirely if `pendingRoleInvites` is empty, to avoid noise.

Cancel action: implemented as a new `cancelPendingRoleInvite(address: string)` function (in a new `usePendingRoleInvites` hook or inline in the Roles settings component). It filters the entry from `space.pendingRoleInvites`, calls `messageDB.saveSpace(updatedSpace)`, and enqueues `actionQueueService.enqueue('update-space', { spaceId, space: updatedSpace }, 'space:${spaceId}')` — the same path used by `useSpaceManagement.saveChanges()` and the pending-entry write in 5.2.

## 6. Security and Trust Model

The core invariant:

> **A user gets role R only if the space owner explicitly pre-assigned R to that user's address in the owner-signed space manifest.**

All pending entries live inside `space.pendingRoleInvites`, which is part of the encrypted space manifest signed by the owner. Receiving clients verify the owner signature before accepting a manifest update (existing behavior, unchanged).

Attack surface analysis:
- **Forged invite URL** → worthless; role grant doesn't come from the URL
- **Forwarded private invite URL** → the forwardee can join (existing behavior) but gets no role because their address isn't in `pendingRoleInvites`
- **Forwarded public invite URL** → same as above
- **Replayed manifest** → signature check unchanged
- **Tampered pending entries** → would require forging the owner's signature on the manifest

The feature adds no new trust assumptions and no new cryptographic surface.

## 7. Data Flow Walkthrough

### Private invite with role

1. Alice (owner) opens send-invite, picks Bob, picks role "Mod", clicks send
2. Alice's client: `constructInviteLink()` consumes one `eval` and builds the URL. Sends DM to Bob with the URL. (Unchanged from today.)
3. Alice's client: appends `{address: Bob, roleIds: ["mod-uuid"], createdAt: now}` to `space.pendingRoleInvites`. Saves space locally. Enqueues `update-space` manifest re-post.
4. Server receives the updated manifest. Other members (including Bob once he joins) receive it via `manifest-update` envelope.
5. Bob clicks the URL, calls `joinInviteLink()`. Joins successfully. Sends `join` control message to the hub.
6. All members' clients receive the `join` envelope and save Bob as a member (existing behavior).
7. **On Alice's client only** (owner): the join handler finds Bob's pending entry, moves Bob into `roles[mod-uuid].members`, removes the pending entry, saves space locally, and immediately enqueues a manifest re-post.
8. Alice's manifest re-post propagates to the server. Other clients receive it as a `manifest-update` envelope and update their local space — now showing Bob with the "Mod" badge.
9. UI shows Bob as a member with the "Mod" badge on all clients once the manifest update propagates.

### Public invite with role

Identical to the private flow except step 2 returns the shared public URL instead of generating a new private URL. Everything else is unchanged, because the role grant is decoupled from the invite crypto.

### Kick-and-rejoin (role does not re-apply)

1. Bob has "Mod" role (applied via step 6 above). Pending entry has already been consumed.
2. Alice kicks Bob. `SpaceService.kickUser()`: strips Bob from all `role.members`, filters out any pending entries for Bob (none exist — already consumed). Re-posts manifest with rekey.
3. If Alice wants Bob re-invited with a role, she sends a new invite and picks a role again — creating a fresh pending entry for Bob.
4. Bob accepts, joins, gets the role via the same flow.

### Leave-and-rejoin (role does not re-apply)

1. Bob has "Mod" role (applied previously). Pending entry consumed.
2. Bob leaves voluntarily. `leave` envelope processed on all clients; Bob removed from `role.members` (existing behavior).
3. Bob somehow rejoins (e.g., if Alice sends him a new invite, or if there's a valid public link).
4. If Alice sent a new invite without a role, pending entry is empty for Bob → Bob joins without role. ✓
5. If Alice sent a new invite with a role, pending entry exists → Bob gets the role.

## 8. Cross-Repo Coordination

Per the project's `quorum-shared` workflow rule:

1. **Branch in `quorum-shared`** and add the `PendingRoleInvite` type + optional field on `Space`. No behavior changes, pure type addition. This is a **minor semver bump** (new exported type + new optional field on existing exported type).
2. Open the PR in `quorum-shared`. **User reviews and merges manually.**
3. Bump the `@quilibrium/quorum-shared` minor version in this repo and proceed with desktop implementation against the new types.

Mobile (`quorum-mobile`) does not need any change to preserve sync — the field is optional and mobile will pass it through its `StorageAdapter` unchanged. When mobile later implements the send-side UI, the data will already be flowing through.

The mobile join handler does not currently need to implement the pending-entry check. During the rollout window, roles applied via this feature will appear on desktop clients (once the owner's manifest re-post propagates) but may not apply immediately on mobile clients. This is acceptable given the "nice to have" priority and the uncertainty around mobile's current role system implementation depth. Mobile parity is a follow-up task once the desktop implementation is stable.

## 9. Edge Cases and Open Questions

### Covered
- **Forwarded invite to wrong recipient:** role not applied (address doesn't match any pending entry)
- **User already has the role** (manually assigned by owner after pending entry was created): role-application step is a no-op (check `role.members.includes(address)`), pending entry still removed
- **Owner re-invites same user with different role:** D1 overwrite — old pending entry replaced with new one
- **Owner sends invite without role:** no pending entry written; normal join behavior
- **Pending entry exists but user never joins:** stays until owner cancels (via panel) or rekeys space
- **Public-mode space with pending entries:** works identically to private mode

### Acknowledged but not addressed
- **Temporary inconsistency on non-owner clients:** Between the moment Bob joins and the moment Alice's manifest re-post propagates, other clients show Bob without the role. This is acceptable — the manifest re-post is enqueued immediately after role application and propagates within seconds under normal network conditions.
- **Owner offline at join time:** If Alice is offline when Bob joins, no client applies the role. When Alice comes back online, her client will have received the join event (queued by the hub) and will process it then, applying the role and re-posting the manifest. The delay may be hours, but the role will eventually apply without any manual action.
- **Privacy: pending invitee addresses in the manifest:** `pendingRoleInvites` is visible to all space members who decrypt the manifest. Existing members can see that Alice is expecting Bob to join. This is consistent with the existing trust model — all role data is visible to members — but is worth noting.
- **Two joins sharing a pending entry:** Cannot happen — address-keyed pending entries + join handler removes the entry on first apply + joins are signed with the joiner's key. A second join by the same address would be a rejoin (pending already consumed) or a signature-verification failure.

## 10. File-by-File Impact

**`@quilibrium/quorum-shared`** (separate PR, merged first)
- `src/types/space.ts` (or equivalent) — add `PendingRoleInvite` type, add optional field on `Space`
- Version bump

**`quorum-desktop`**
- `package.json` — bump `@quilibrium/quorum-shared` to the new version
- `src/components/modals/...` — invite-send UI: add role dropdown to the existing modal
- `src/hooks/business/spaces/useInviteManagement.ts` — extend the invite action to optionally write a pending entry after sending
- `src/services/MessageService.ts` — add pending-entry check + role application to the `join` handler (around line 2848)
- `src/services/SpaceService.ts` — extend kick path (around line 785) to filter out pending entries for the kicked user
- `src/services/InvitationService.ts` — in `generateNewInviteLink`, clear `space.pendingRoleInvites` before rekey
- `src/components/modals/SpaceSettingsModal/Roles.tsx` — new "Pending Invites" section with list + cancel action
- Lingui strings for new UI copy

## 11. Testing Plan

Unit / integration:
- Send invite with role → pending entry present in space manifest
- Send invite without role → no pending entry added
- Re-invite same address with different role → pending entry overwritten (only one entry for that address)
- Join handler with matching pending entry → user added to role members, pending entry removed
- Join handler without matching entry → no role changes, no errors
- Kick with existing pending entry → pending entry cleared alongside role members
- `generateNewInviteLink` → pending entries cleared
- Cancel action in the panel → pending entry removed, manifest re-posted

Manual:
- Full loop: owner on client A sends invite with role to user B. B joins on client A → B has role
- Same as above but B joins on a different device → confirm role applied there too (sync correctness)
- Public-mode space: same tests as private mode should all pass identically
- Forwarded link: send link to B, B forwards to C, C joins → C has no role
- Multi-device owner: Alice sends invite from device 1; Alice sees pending entry on device 2 (via config/manifest sync); cancel from device 2 works

## 12. Related Documentation

- [.agents/docs/features/invite-system-analysis.md](../docs/features/invite-system-analysis.md) — existing invite system deep-dive
- [.agents/docs/space-permissions/space-roles-system.md](../docs/space-permissions/space-roles-system.md) — role architecture and permissions
- [.agents/docs/quorum-shared-architecture.md](../docs/quorum-shared-architecture.md) — shared package structure and cross-repo workflow
- Issue: https://github.com/QuilibriumNetwork/quorum-desktop/issues/81

---

*Last updated: 2026-04-20 (revised after peer review — timing fix in 5.4, kick/rekey placement notes, owner guard, cancel action spec, mobile stance)*
