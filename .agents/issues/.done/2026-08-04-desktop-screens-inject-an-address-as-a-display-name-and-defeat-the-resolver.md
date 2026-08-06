---
type: bug
title: "Several desktop surfaces inject a truncated address AS the display name before calling the resolver, so it outranks the global name and the .q name"
status: done
priority: medium
created: 2026-08-04
updated: 2026-08-04
area: identity resolution / mention rendering / desktop-mobile parity
source: found 2026-08-04 while adopting the shared resolver on mobile (quorum-mobile branch `one-identity-rule`); every mobile defect fixed there was then checked against desktop, per the standing rule that a bug found in one client is checked in the other
related:
  - ".agents/docs/features/identity-resolution-and-profile-sync.md (the canonical model — read §'The precedence ladder' and §'Why a name goes missing')"
  - ".agents/docs/features/qns-username-display.md"
  - "quorum-mobile .agents/issues/.open/2026-08-04-one-identity-resolver-so-names-and-avatars-match-everywhere.md (the mobile side of the same work)"
---

# A fallback string is fed INTO the resolver, so the resolver returns it

## Status

**Done and merged.** `quorum-desktop` **PR #310**, squash-merged to `main` as
`537328f8`. It shared the branch `fix/identity-resolver-and-mention-cleanup` with
the shared-package mention cleanup, whose `quorum-shared` **PR #74** merged first
(desktop's call site would not compile against the old signature).

Every §3 site is addressed, plus one the original write-up missed (§3-A). Two of
the original three findings did not survive verification and are corrected in
§3-B — read that section before trusting the original table.

Verification is behavioural, not by reading: a new component test renders the
reaction list and asserts the `.q` name appears. It was confirmed to go RED with
the defect reintroduced and GREEN with the fix, so it could genuinely have
failed. Re-run on the merged base: 953 tests pass, typecheck and lint clean.

Two Definition-of-Done items were **not** closed here and moved to their own
item, `.open/2026-08-04-desktop-avatar-resolver-and-cross-client-name-tier-drift.md`:
the missing desktop avatar resolver (§5) and the cross-client tier divergences
measured in §9. Neither is part of this defect; both are cross-client decisions.

## 1. The defect in one sentence

Several desktop call sites compute `member.displayName || <some truncated address>`
and pass the **result** into `resolveSpaceMemberName` / `resolveMemberName`. When
a member has no per-space override, the resolver therefore receives an address
string in the `displayName` slot, treats it as a deliberate per-space name, and
returns it — outranking both the member's global name and their QNS `.q` name,
which are sitting in the very same object.

This is not "a tier was skipped". The fallback **defeats** the resolver. Adding
more tiers upstream cannot fix it, because the poisoned value wins at the top of
the ladder.

## 2. Why it matters more than it looks

An empty per-space override is the **default** state. Since the follow-global
work (2026-07-16) the override slot is deliberately not stamped at join, so most
members legitimately have an empty `displayName` and a populated
`globalDisplayName`. Every one of them hits this path.

## 3. Sites named in the original write-up

| Where | The line | Original verdict | Held up? |
|---|---|---|---|
| `src/components/modals/ReactionsModal.tsx:53` | `displayName: member?.displayName \|\| memberId.slice(0, 8) + '...'` | Live; a follow-global member renders as `QmXoypiz...` in the reaction list | **Yes.** Confirmed by a failing test before the fix |
| `src/hooks/business/channels/useChannelMessages.ts:162-174` | `displayName: member.displayName \|\| formatAddress(senderId)` | Live, same shape | **No** — unreachable, see §3-B |
| `src/components/message/MessageList.tsx:306-318` | `displayName: member.displayName \|\| formatAddress(senderId)` | "Lower severity, if that path is ever taken" | **Understated** — it was the live, full-severity one, see §3-A |

Trace `resolveSpaceMemberName` with `displayName = "QmXoypiz..."`,
`globalDisplayName = "Alice"`, `primaryUsername = "alice"`:

```
roster = "QmXoypiz..."   global = "Alice"   qns = "alice"
qns && roster && roster !== global   →  true
→ returns { name: "QmXoypiz...", isQnsVerified: false }
```

The `.q` name loses to a string the UI invented three lines earlier.

## 3-A. The site this write-up missed — ThreadPanel never passed the mapper

`src/components/thread/ThreadPanel.tsx:399` rendered `<MessageList>` **without
`mapSenderToUser`**, so the thread list silently fell back to MessageList's
internal mapper — the third row above, the one dismissed as "lower severity, if
that path is ever taken". It was taken, on every thread.

What makes it worse than the table suggested:

- Threads are a **space** context (`spaceId !== channelId`), so
  `resolveSpaceMemberName` runs and the substituted address outranks the `.q`
  name. This is the full-severity form of the bug, not a cosmetic one.
- The panel was **internally inconsistent**. `channelProps.mapSenderToUser` was
  already available and already used correctly at ThreadPanel.tsx:180 (thread
  starter) and :439 (participants), which pass `displayName` through untouched.
  Only the message list was wired wrong, so the same person could appear under
  two different names in one panel.

Fixed by passing `mapSenderToUser={channelProps.mapSenderToUser}`.

**Lesson for the next write-up.** The original analysis traced each *poisoning
line* to a resolver, but never asked *which components actually reach that line*.
That is how it rated the live, full-severity site lowest and a dead one highest.

## 3-B. Corrections — two of the three original findings do not hold

Recorded rather than quietly rewritten, because the analysis error is repeatable.

**`useChannelMessages.ts:162-174` was not reachable.** `Channel.tsx:282` is its
only consumer, and `Channel.tsx:307-322` wraps the returned mapper, consulting
`effectiveMembers` first and falling through to the base mapper only when the
sender is absent from it. `effectiveMembers` is built as `{...members}`
(`useMembersWithPublicProfileFallback.ts:126`, and identity when there is nothing
to fetch), so its key set is always a superset of `members`. The `if (member)`
branch — the poisoning one — therefore could not execute. Fixed anyway, since
correctness should not depend on a wrapper two files away, but it was never
causing a user-visible defect.

**The DM path could not lose a `.q` name.** `Message.tsx:444` routes
`spaceId === channelId` through `resolveMemberName`, whose ladder is
`override → QNS → displayName → address`. QNS is checked *above* `displayName`,
so a poisoned `displayName` cannot beat it — unlike `resolveSpaceMemberName`,
where a per-space name sits above QNS. The DM impact was limited to a member with
no `.q` name at all, where the visible difference is which truncation format
appears (`formatAddress`'s 6+6 vs the resolver's `6…4`). Cosmetic, not identity
loss.

The generalisable point: **the ladder's shape decides the blast radius.** The
same poisoned input is fatal above QNS and harmless below it. "Passes a fallback
into a resolver" is not by itself a severity.

## 3-C. New finding — `globalDisplayName` is a comparator, not a tier

Turned up by a test written for this fix, and it is worth its own item rather
than a silent fix here.

`resolveSpaceMemberName` reads `globalDisplayName` **only** to compare it against
the roster name and decide whether that roster name was deliberately set. It is
never returned. So a member with an empty override, a populated
`globalDisplayName` and no QNS name resolves to the **truncated address**, with a
perfectly good global name in the object.

This is **latent, not live**: `useMembersWithPublicProfileFallback.ts:147` merges
the global name INTO `displayName` before any render path sees it, so no current
caller reaches the resolver in that shape. It is pinned by a test
(`ReactionsModal.test.tsx`, "pins that globalDisplayName is a COMPARATOR") so the
behaviour is documented rather than assumed, and so the test changes
deliberately if a tier is ever added.

Not fixed here: adding a tier changes resolver semantics shared with every name
surface, which is a bigger blast radius than this bug warrants.

## 4. The fix shape

**Never pass a fallback into the resolver. Let the resolver produce the
fallback.** The pattern that works, already used correctly at
`src/components/space/Channel.tsx:1831`:

```ts
// wrong — the fallback is an INPUT
displayName: member?.displayName || truncate(address)

// right — the fallback is an OUTPUT
resolveSpaceMemberName({
  address,
  displayName: member?.displayName,        // may be empty; that is meaningful
  primaryUsername: member?.primaryUsername,
  globalDisplayName: member?.globalDisplayName,
})
```

Empty must reach the resolver as empty. That is the whole contract of the
two-slot model: empty override means "follow global", and a call site that
substitutes something for empty destroys that signal before the rule can read
it.

Where a caller genuinely has no member record, it now hands the resolver an
address-only object rather than a pre-truncated string, so every surface
truncates identically.

## 5. Also worth fixing while in here

**There is no avatar resolver on desktop.** `resolveDisplayName` in
`quorum-shared` covers names only, and desktop has no `resolveAvatar` /
`resolveMemberIcon` equivalent — grep for one returns nothing. So every avatar
call site picks its own source, exactly the situation the name resolver was
built to end. Mobile hit the same wall (see the linked mobile issue) and solved
it with a local `resolveMemberAvatar` implementing `override → global → self`,
with no QNS step because a `.q` name carries no picture. Deciding whether that
belongs in `quorum-shared` is a cross-client call, not a desktop one.

NOT done on this branch — still open, and still a cross-client decision. One
narrow related change was made: `ReactionsModal` now derives its avatar initials
from the **resolved** name, so the avatar and the label beside it cannot disagree.

## 6. Definition of done

- [x] No call site passes a computed fallback into `resolveMemberName` / `resolveSpaceMemberName`; the three sites in §3 are fixed
- [x] `globalDisplayName` and `primaryUsername` are passed wherever they are available, so the resolver has the tiers it needs (with §3-C noting that `globalDisplayName` is not itself a tier)
- [x] A follow-global member with a `.q` name renders as their `.q` name in the reaction list, not as an address — proven by `src/dev/tests/components/ReactionsModal.test.tsx`, verified red-before-green
- [x] Grep for the pattern `displayName ||` / `userIcon ||` across `src/` (excluding `src/dev/`) is reviewed, and every remaining hit is either fixed or recorded as legitimately not an identity ladder — see §7
- [x] Avatar resolution has a single home on desktop, **or the shared-package decision is filed as its own item** — filed, see the follow-up named in §Status. Desktop still has no avatar resolver
- [x] Checked against mobile: the same surface resolves identically on both clients — checked and MEASURED, see §9. The reaction surface now matches; three tier-level divergences were found and filed

## 7. Remaining `displayName ||` hits, reviewed

Every hit outside `src/dev/`, with a verdict. None feed a name resolver.

| Site | Verdict |
|---|---|
| `MentionDropdown.tsx:134`, `MessageEditTextarea.tsx:187,578,582,588` | Placeholder text for a picker/preview label, not a resolver input |
| `DirectMessageContactsList.tsx:45` | Reads the placeholder to DETECT a missing name — the opposite of substituting one |
| `SpaceSettingsModal.tsx:102`, `useUserSettings.ts:72`, `spaceProfilePayload.ts:117` | Form/payload defaults for the LOCAL user's own profile |
| `NavRail.tsx:94`, `useBatchSearchResultsDisplay.ts:141` | Local user's own name |
| `ContextMenu.tsx:122`, `SearchResultItem.tsx:106`, `useMessageActions.ts:482`, `useMessageFormatting.ts:161` | Display-only strings that never reach a resolver |
| `useMembersWithPublicProfileFallback.ts:147-148` | The per-field merge itself (override → roster global → public profile). Deliberate, and it also emits `globalDisplayName` separately so the comparison still works |
| `shims/quilibrium-sdk-channels.native.tsx:241` | Mock data |

## 8. Guard against recurrence

`src/dev/tests/components/messageListSenderMapper.contract.test.ts` asserts every
`<MessageList>` render site passes `mapSenderToUser`, with a documented exemption
for `DirectMessage.tsx` (no space roster, no override slot, and DM senders
resolve through the QNS-first ladder, so there is nothing to enrich). The test
was confirmed to fail when the ThreadPanel prop is removed. A stale-exemption
check keeps the allowlist honest.

## 9. Mobile parity — checked, with results

Closing the DoD item properly rather than asserting parity. Compared desktop's
`src/utils/resolveMemberName.ts` against mobile's `utils/resolveMemberName.ts`
(rewritten in `quorum-mobile` `7acfff6`).

**The surface in question now matches.** Mobile's
`components/Chat/ReactionDetailsModal.tsx:102-107` passes `m ?? { address: addr }`
— the roster row untouched, no fallback fed in — which is the same shape as this
fix. Both clients render a follow-global member's `.q` name in the reaction list.

Three tier-level divergences remain. All predate this work; none is introduced by
it. Filed as the follow-up item named in §Status.

**1. The global slot is a TIER on mobile and only a COMPARATOR on desktop.**
Mobile passes `display_name: global` into shared's `resolveDisplayName`
(`resolveMemberName.ts:133-140`), so a global name is genuinely rendered. Desktop
reads `globalDisplayName` only to detect an echoed roster name and never returns
it (§3-C). Desktop reaches the same output by a different mechanism — the
enricher merges the global name INTO `displayName` upstream — so a desktop
surface that does not use `useMembersWithPublicProfileFallback` would diverge.

**2. Echo detection exists only on desktop, deliberately.** Mobile's own header
documents the consequence: for a legacy roster row stamped before the
follow-global work (2026-07-16), mobile's stale echo outranks the member's QNS
name while desktop demotes it, so the same member reads differently on the two
clients until the row is cleared. Documented, decaying, accepted.

**3. The address fallback is formatted differently. MEASURED, not inferred:**

| Client | Same address, no name anywhere |
|---|---|
| Mobile — `truncateAddress(addr,'medium')` → `formatAddress(addr, 6, 4)` | `QmV5xWMo…F2nX` |
| Desktop — shared `resolveDisplayName`'s internal `truncate()` | `QmV5xW…F2nX` |

Both were evaluated against `QmPeerFEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz`.
Desktop shows two fewer entropy characters, because shared's `truncate()` is a
naive `slice(0,6)` that spends two of its six on the constant `Qm` prefix,
whereas `formatAddress` is Qm-aware and counts entropy after it.

Note this contradicts a claim in mobile's own source comment, which says its
address rung "is already parity-matched with desktop". It is parity-matched with
desktop's `formatAddress` **presets**, but desktop's *name resolver* does not use
`formatAddress` — it uses shared's `truncate()`. The comment is wrong for this
rung and should be corrected when the divergence is.

Mobile also returns an `isAddressFallback` flag that desktop lacks, so desktop
call sites cannot cheaply distinguish "no name known" from "a name". Minor, but
it is why mobile can vary avatar-initial behaviour and desktop cannot.

*Last updated: 2026-08-04*
