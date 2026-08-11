---
type: bug
title: "Six name surfaces never reached the resolver (desktop parity items 6 and 7)"
status: in-progress
priority: high
created: 2026-08-10
updated: 2026-08-11
shipped_in: "#325"
area: identity resolution / QNS / cross-client parity
repos: quorum-desktop (this), quorum-mobile (one matching defect filed)
source: desktop parity item (6), the audit for direct override reads, plus item (7)
related:
  - "quorum-mobile/.agents/issues/2026-08-06-qns-primary-name-work-and-desktop-parity.md (the parity index — READ THIS FIRST)"
  - "quorum-mobile/.agents/issues/.open/2026-08-10-invite-contact-picker-renders-an-unresolved-name.md (the matching mobile defect)"
  - ".agents/docs/features/qns-username-display.md"
  - ".agents/issues/.done/2026-08-05-mobile-identity-parity-after-the-desktop-phase-1-fix.md"
---

# Eight name surfaces never reached the resolver

## Status

**2026-08-10 — shipped in PR #325** (`fix(identity): resolve every name through
one ladder, including your own`).

What landed: eleven name surfaces routed through the resolver, the self tier
given a source on the two surfaces that lacked one, and the per-space name
placeholder made to promise the name the app actually renders. Three copies of
the space-versus-DM ladder choice collapsed into `resolveNameForContext`.

**Deliberately NOT moved to `.done/`, and this is the point of the standing
rule.** Suite green at 1248 with every rule shown red on revert, but the visual
pass has not happened — and on this exact issue, twice in one session, a fix that
was confidently reasoned about and unit-tested did not work in the running app.
A green suite here has already been demonstrated to be insufficient evidence.

Still open: the `/dev/fake-qns` sweep with a control arm, and the mobile
invite-picker defect.

Two distinct defects are covered here: **six surfaces that read a name by hand**
(the audit, parity item 6, plus item 7), and **two that special-case YOUR OWN
identity** and so never had a QNS name to render at all. The second pair was
found by the operator in the running app after the first six were fixed, and is
the reason the visual pass below is not optional.

**Partially verified visually.** The operator confirmed the two self-surface
defects with `/dev/fake-qns`; their fixes are not yet re-confirmed, and the other
six have not had a visual pass. See "What is still unverified".

Part of this work is identity-resolution hardening whose detail is held
privately. This file is the public hub and deliberately does not restate it.


**2026-08-11 — superseded by the architecture, shipped in PR #327**

The per-site fixes recorded here are gone: every surface now resolves from an address through
`src/identity`, and the two that were still wrong after #325 (bookmarks and notifications) were
fixed as the first migrations. A checked-in audit
(`src/dev/tests/identity/rawNameFieldAudit.test.ts`) now fails when a file starts rendering a raw
identity field, which is the class this list was tracking by hand.

Left in place rather than moved to `.done/`: this is a `type: bug`, and while the notification
surface was confirmed by the operator in the running app, the bookmark surface was verified only by
tests. Re-check bookmarks with a `.q` member and a non-`.q` control, then close.

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
| Profile card, YOUR OWN (`UserProfile.tsx:120`) | Skipped the public-profile fetch when the card was your own | fixed |
| DM messages, YOUR OWN (`DirectMessage.tsx:298`) | Built the self entry from `currentPasskeyInfo`, which has no QNS name | fixed |

**Eight, not six.** The last two were found by the operator testing the first
six in the running app with `/dev/fake-qns`, which is the argument for doing that
pass rather than trusting a green suite: both were invisible to the audit because
neither reads a roster row by hand. They are a different defect with a different
shape, described next.

## The self tier, which is the second defect this file covers

**Desktop has no self tier**, and the parity document already says so in its
shared-code section: *"The self tier. Mobile resolves its own row from a live
in-memory profile; desktop has no equivalent concept."* That was recorded as a
reason NOT to move code into `quorum-shared`. It is also, it turns out, a bug.

The rule: wherever the generic member path runs, self is fine — channel message
headers and the member sidebar both resolve, because
`useMembersWithPublicProfileFallback` fetches every visible sender including you.
Wherever self is **special-cased from `currentPasskeyInfo`**, it breaks, because
that record is the device-local auth profile and carries no `primary_username`.

Two instances, both reported from the running app:

**The profile card.** `needsUsernameFetch = !props.user.primaryUsername && !isOwnProfile`.
The exclusion reads as obviously safe — surely we know our own identity. One
fetch feeds TWO fields, so skipping it cost both: the QNS name, and the GLOBAL
name that the space resolver compares the roster name against. With the global
name absent, `roster !== global` holds trivially and the roster name is returned
as though deliberately chosen — **so the `.q` would have lost even had it been
fetched.** A narrower fix that only restored `primary_username` would have looked
right and stayed broken.

**DM own messages.** The members map gave the partner `primaryUsername` from the
public profile fetched immediately above, and built the self entry from
`currentPasskeyInfo` alone. Your own messages therefore showed your global name
next to a partner showing their `.q`, in the same thread.

Neither costs a request: both read the same 1h-cached `publicProfileQueryKey`
that other surfaces already populate. The "extra fetch" intuition was wrong here
for the third time in this work — see the cost note below.

### Where the guard had to go

`utils/profileCardIdentity` holds the card's two rules so they can be tested
without mounting a component with sixteen hooks. **The test asserts on the FETCH
DECISION, not on the resolved name.** The resolver was never the broken part, so
a test checking only that names come out right would neither have caught this nor
catch it returning.

### Still unfixed, same class

`NavRail.tsx:94` reads `currentPasskeyInfo.displayName` for your own avatar and
label. Same shape, not yet reported as visible; listed here so it is not
rediscovered from scratch. The search surfaces
(`useSearchResultDisplay*.ts`, `useBatchSearchResultsDisplay.ts:141`) also
special-case self, and remain a documented deferral.

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

The same wrong intuition is visible in the two self bugs: the profile card's
`!isOwnProfile` exclusion and the DM's `currentPasskeyInfo`-only self entry both
look like they are avoiding a redundant request, and both are reading a key that
is already warm.

**Three times in one piece of work, "this would cost N requests" was asserted
without checking the cache key, and was wrong every time.** In a codebase where
one query key is shared across every profile surface, that estimate is not
intuitable — it has to be checked.

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
