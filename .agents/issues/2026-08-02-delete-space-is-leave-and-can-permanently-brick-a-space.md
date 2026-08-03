---
type: bug
title: "\"Delete Space\" is actually Leave, the dialog promises otherwise, and an owner clicking it permanently bricks the space"
status: in-progress
priority: medium
created: 2026-08-02
severity: 'medium — was high. The dangerous half is neutralised in release builds as of 2026-08-03 (see Update): the button is disabled, so an owner can no longer brick a Space with it, and no dialog claims a deletion that does not happen. What remains is the absence of real deletion, which is blocked on a backend endpoint.'
area: space management / space deletion + leaving / ownership
repo: quorum-desktop
related:
  - "quorum-mobile .agents/issues/2026-08-02-make-delete-space-actually-delete.md (the cross-repo tracker for the remaining work — read this one first)"
  - "quorum-mobile .agents/issues/.open/2026-08-02-config-key-rotation-on-kick-destroys-space-history.md (ownerless spaces can never receive that fix — see §4)"
  - "quorum-mobile .agents/issues/.open/2026-08-02-leaving-a-space-revokes-no-access.md (the leave path this button actually invokes)"
  - "issues/.done/user-kick-role-permission-non-functional.md (independently root-caused the owner-key constraint that makes §3 permanent)"
---

> ## Update 2026-08-03 — the lying is fixed, the deletion is not
>
> **Landed on desktop** (branch `fix/space-delete-stop-promising-what-it-does-not-do`):
> the Danger tab no longer claims permanent space-wide deletion, the type-to-confirm
> and its channel/member counts are gone, the button is **disabled in release builds**
> with copy explaining why, the tab is labelled "Danger" rather than "Delete Space",
> and the dead `isOwner = true` stub from §2 is deleted outright (nothing consumed it;
> `useSpaceOwner` was already the real predicate everywhere that mattered). Dev builds
> keep the action under the honest label "Leave this Space", because that is what
> `SpaceService.deleteSpace` actually does. Covered by
> `src/dev/tests/hooks/spaceOwnerPredicate.unit.test.ts`.
>
> **§1 and the §2 stub are therefore resolved. §3 is not reachable in a release build
> any more** — an owner cannot press the button, so they cannot brick a Space with it.
>
> **Still open, and why this stays a bug rather than moving to `.done/`:** there is no
> way to delete a Space. That needs a server-side purge endpoint that does not exist in
> any repo this team holds, plus a tombstone so a purged Space cannot be silently
> re-registered by the client self-heal. Both are specified in the cross-repo tracker
> above, §4. Do not close this until deletion actually works; the current state is an
> honest disabled button, not a fixed feature.
>
> Note also that §3's premise is narrower than written: the owner key is not confined
> to the creating device once cross-device sync is on. See §4B finding 2 of the tracker.

# "Delete Space" is Leave with a destructive-sounding label, and the owner must never click it

## 1. Symptom

The Space settings danger zone offers "Delete this Space", with the confirmation
text:

> *"This action cannot be undone and will permanently delete this Space and all of
> its channels and messages."*

That is false. For every other member the space, its channels and all its messages
persist untouched — they simply see the clicker as having left.

If the **owner** clicks it, the space enters a state from which it can never
recover: no one can ever kick a member or rotate keys in it again.

## 2. Verified mechanism

`handleDeleteSpace` ([hooks/business/spaces/useSpaceManagement.ts:126-158](../../src/hooks/business/spaces/useSpaceManagement.ts#L126))
and `leaveSpace` ([hooks/business/spaces/useSpaceLeaving.ts:50](../../src/hooks/business/spaces/useSpaceLeaving.ts#L50))
call the **same function**: `SpaceService.deleteSpace(spaceId)`
([src/services/SpaceService.ts:563-691](../../src/services/SpaceService.ts#L563)).

Despite the name, that function is the leave flow. It:

- builds and enqueues a `type: 'leave'` control envelope (line 590)
- calls `postHubDelete` for **the caller's own** hub/inbox registration (line 619)
- deletes the caller's local encryption states (654-659), space messages (660-663),
  member rows (664-667) and space keys (668-671)

It never generates a new config keypair, never calls `saveSpaceKey` for `config`,
never asks the server to purge anything, and does nothing to any other member's
copy of the space.

The confirmation copy lives at
[components/modals/SpaceSettingsModal/Danger.tsx:41-47](../../src/components/modals/SpaceSettingsModal/Danger.tsx#L41).

Corroborating signal that this area is known-incomplete —
[useSpaceManagement.ts:165](../../src/hooks/business/spaces/useSpaceManagement.ts#L165):

```ts
const isOwner = true; // For now, assume user is owner - would need proper implementation
```

## 3. Why owner use is unrecoverable

Rotating the space config key — the only revocation lever in the whole system —
requires the owner's Ed448 key. `kickUser`
([SpaceService.ts:696-780](../../src/services/SpaceService.ts#L696)) fetches
`getSpaceKey(spaceId, 'owner')` and signs the `postSpace` re-registration with it;
without that key the operation cannot proceed.

The owner key is written only at space creation, on the creating device. A
repo-wide search for `transferOwnership` / ownership succession found **no
mechanism** to hand it to anyone else.

`deleteSpace` wipes all local space keys, including `owner`. So once the owner
clicks this button:

- no one can ever kick a member from that space again
- no one can ever rotate the config key again
- no one can ever regain the ability to do either

This is independently corroborated by an already-solved bug in this repo,
`issues/.done/user-kick-role-permission-non-functional.md`, which root-caused the
same owner-key constraint from a different direction and responded by removing the
`user:kick` permission from the UI entirely, because non-owners could never use it.

## 4. Why this matters beyond the mislabelled button

Two space key-management bugs are filed in `quorum-mobile` (see `related`). Their
fix depends on an owner-driven key rotation and redistribution step. **An ownerless
space can never receive that fix.**

So every space whose owner has already clicked "Delete Space" believing they
destroyed it is not only un-moderatable today, it is permanently excluded from the
remediation for those bugs. That makes this worth quantifying: it would be useful
to know how many live spaces currently have no reachable owner.

It also compounds the leave bug directly: an owner-side "leave" disguised as
"Delete" is a very plausible real-world trigger, because the label actively invites
it. Someone winding down a space they created will click "Delete Space" precisely
*because* they believe it is destructive.

## 5. Recommended fix

1. **Relabel and re-copy immediately.** The button performs a leave; say so. The
   current text is the actively harmful part and is a one-line change.
2. **Warn hard when the owner is the one leaving**, and ideally block it outright
   until ownership succession exists. Losing the owner key is not recoverable and
   the user cannot possibly know that from the current dialog.
3. **Implement ownership transfer / succession.** Independently valuable, and the
   only real answer to §3. Without it, every space is one owner-device loss away
   from the same dead end — a lost or wiped phone reaches the same state as this
   button, just less deliberately.
4. **If genuine space deletion is wanted**, it needs a real design (server-side
   purge, authorised by the owner key) rather than a rename of leave.
5. Fix the `const isOwner = true` placeholder at
   [useSpaceManagement.ts:165](../../src/hooks/business/spaces/useSpaceManagement.ts#L165).

## 6. Open questions

1. Is there any server-side notion of space ownership that could authorise a real
   delete, or a recovery/succession path not exposed in the client?
2. How many existing spaces already have no reachable owner (see §4)? Answering
   this needs server-side data.
3. Was "Delete Space" ever intended to be a real deletion, or has it always been
   leave with an aspirational label?

## 7. Not yet done

- **No runtime reproduction.** Found by code reading during an adversarial
  verification pass on the sibling mobile bugs. Reproduce on a **throwaway test
  space only** — by construction this bug is not undoable.
- The claim that no ownership-transfer mechanism exists is from a repo-wide search
  that returned only i18n strings and unrelated permission checks; worth a second
  pair of eyes before treating "no recovery path" as final.

*Last updated: 2026-08-02*
