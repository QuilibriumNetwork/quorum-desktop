---
type: bug
title: "Six name surfaces never reached the resolver (desktop parity items 6 and 7)"
status: in-progress
priority: high
created: 2026-08-10
updated: 2026-08-10
area: identity resolution / QNS / cross-client parity
repos: quorum-desktop (this), quorum-mobile (one matching defect filed)
source: desktop parity item (6), the audit for direct override reads, plus item (7)
related:
  - "quorum-mobile/.agents/issues/2026-08-06-qns-primary-name-work-and-desktop-parity.md (the parity index — READ THIS FIRST)"
  - "quorum-mobile/.agents/issues/.open/2026-08-10-invite-contact-picker-renders-an-unresolved-name.md (the matching mobile defect)"
  - ".agents/docs/features/qns-username-display.md"
  - ".agents/issues/.open/2026-08-05-mobile-identity-parity-after-the-desktop-phase-1-fix.md"
---

# Six name surfaces never reached the resolver

## Status

**Fixed on branch `fix/name-surfaces-bypassing-the-resolver` (`8d70aa9d5`), not
yet merged.** Suite green at 1235, lint unchanged at 0 errors, typecheck clean.
Every rule added was shown red with its fix reverted.

**Not yet visually verified in the running app.** The unit level is covered; what
is not is that the right string reaches the right pixels. See "What is still
unverified" below — that is the honest remaining gap, and it is the part a test
cannot close.

Part of this work is identity-resolution hardening whose detail is held
privately. This file is the public hub and deliberately does not restate it.

## What this closes

Two items from the cross-client parity index, both listed there as "ready to
implement straight from this document":

- **(6) the audit for direct override reads** — must precede any join change.
- **(7) the per-space name field's placeholder.**

## The audit

Method: enumerate every surface that turns an address into a rendered name, and
check each goes through `resolveMemberName` / `resolveSpaceMemberName` rather
than reading a roster or conversation row's `displayName` by hand.

The parity document warned that mobile's equivalent sweep found **seven**
surfaces, six of them not on any list beforehand, and told me to budget for that
rather than assume one or two. That was good advice: the first pass found four,
and an independent review found two more. Final count **six**.

| Surface | What it did | State |
|---|---|---|
| Message editor's mention pills (`MessageEditTextarea.tsx:187`) | Rebuilt pills from stored `@<address>` tokens via a second, private copy of the pill builder, reading the raw field | fixed |
| Moderation confirmations (`UserProfile.tsx:479,503,525`) | Passed the raw roster field into the Kick / Mute / Block modals, while the resolved name sat one scope away at `:134` | fixed |
| Invite contact picker (`useInviteManagement.ts:113`) | Rendered a conversation row's name raw | fixed |
| DM list search (`DirectMessageContactsList.tsx:147`) | Matched only the stored name, so a row the list displays under a QNS name could not be found by typing it | fixed |
| `MessagePreview` header (`MessagePreview.tsx:204`) | Hand-rolled its own fallback chain | fixed (latent — see below) |
| Per-space name placeholder (`SpaceSettingsModal/Account.tsx:217`) | Static `t\`Display Name\`` — item (7) | fixed |

### The two that are worth understanding, not just listing

**The editor's mention pills.** A pill's name was derived in two places: the
composer built one when you picked from autocomplete, the editor rebuilt every
pill from the stored tokens when you clicked edit. Only the composer resolved. So
the same pill read one name in the posted message and a different one in the
editor — a QNS name vanished on entering edit mode, and an unknown sender
rendered the literal `Unknown User` where the body beside it shows a truncated
address.

**The duplication was the defect and the raw read was its symptom.** Fixing only
the raw read would have left two derivations free to disagree again, so both now
call one `resolveMentionPillName`.

**`MessagePreview`'s header — latent, not live.** The render sits behind
`!hideHeader` and both current callers (`PinnedMessagesPanel`, `BookmarkItem`)
pass `hideHeader={true}`, so it was unreachable. Resolved rather than deleted,
because dead identity code next to a trust marker is a hole waiting for whoever
turns the header on. This is the same shape as the item the parity document
flags on mobile ("the user profile modal's dead `@handle` line ... leaving dead
identity code next to a trust marker is how the next person reintroduces the
inversion").

## What was NOT found, and why it matters

**No bare-address regression from the join change.** The parity document warned
that on mobile, shipping the join fix before the by-hand override reads left a
window where freshly-joined members rendered as bare addresses, and told me to
order (6) before (3) to avoid reproducing it. Desktop shipped its join fix on
2026-08-05 (PR #313), so that window would already be open if it applied.

It does not, for two independent reasons, both READ from source:

1. `useMembersWithPublicProfileFallback.ts:147` merges
   `displayName = per-space override || roster global slot || public profile`,
   so an empty override yields the global name rather than nothing.
2. `resolveSpaceMemberName` (`resolveMemberName.ts:125`) returns the global slot
   as a real tier before falling through to the address.

Recorded because it removes a sequencing constraint the parity document imposes,
and a future reader should not re-derive it.

## Structural changes, which are the part that stops this recurring

- **`resolveMentionPillName`** (`utils/mentionPillDom.ts`) — one rule for a
  mention pill's text, called by both builders.
- **`resolveNameForContext`** (`utils/resolveMemberName.ts`) — one answer to
  "space ladder or DM ladder?", which had been hand-written at three call sites
  (the message body, the mention pills, the message preview). Three copies of
  that choice is precisely how the two pill builders came to disagree.
- **`conversationMatchesSearch`** (`utils/conversationSearch.ts`) and
  **`selfNamePlaceholder`** (`utils/resolveSelfName.ts`) — extracted so the rules
  could be tested directly rather than asserted through a component.

## The mobile half

**Mobile has the invite-picker defect too**, at
`components/ShareInviteSheet.tsx:173`, from the identical cause (raw
`useConversations` rows) and with the same hand-rolled `truncateAddress`
fallback. Filed as
`quorum-mobile/.agents/issues/.open/2026-08-10-invite-contact-picker-renders-an-unresolved-name.md`.

Mobile's own sweep did not cover share/invite paths, so its share surfaces are
worth re-checking generally rather than only that file.

Per the parity document's standing lesson — "a fix that lands on one client and
leaves the other as a TODO is not a shipped fix" — this one should not be
considered closed on desktop alone.

## A note on cost reasoning, because I got it wrong once

The invite picker was first left half-fixed on the grounds that backfilling it
would cost N public-profile fetches on a rarely-opened dropdown. That was wrong.
The backfill keys on `publicProfileQueryKey` with a 1h `staleTime`, and the
addresses are the DM partners the sidebar has already fetched **under the same
key** — so it is a cache read, not a second round of requests. The fix is now
complete.

Worth keeping as a reminder that "this would cost N requests" deserves checking
against the actual cache key before it is allowed to shrink a fix.

## What is still unverified

- **Visual confirmation in the running app.** Use `/dev/fake-qns`
  (`src/dev/fake-qns/`, PR #315): give yourself a `.q`, then sweep the six
  surfaces. Pin a second address to a known different name as a **control arm** —
  with everyone named there is nothing to compare against, and if both rows
  change the instrument is wrong rather than the code.
- The editor pills and the DM header specifically **cannot** be checked by
  posting to yourself in every case; see the parity document's warning that the
  receive side needs two clients. The fake-QNS "give everyone a `.q`" switch
  covers the solo-testable ones.

## Definition of done

- [x] Audit complete, with every surface cited `file:line`
- [x] All six routed through a resolver
- [x] Item (7), the placeholder, ported from mobile
- [x] A test per rule, each shown red with its fix reverted
- [x] The matching mobile defect filed
- [ ] Visually confirmed via `/dev/fake-qns` with a control arm
- [ ] Merged
- [ ] Mobile's invite picker fixed, or explicitly deferred by the lead

---

*Last updated: 2026-08-10*
