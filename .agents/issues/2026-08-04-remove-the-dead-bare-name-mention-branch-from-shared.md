---
type: task
title: "quorum-shared's bare-@name mention branch is now dead code on both clients — remove it before something switches it back on"
status: in-progress
priority: low
created: 2026-08-04
updated: 2026-08-04
area: mentions / quorum-shared cleanup
source: filed 2026-08-04 as a desktop BUG, then corrected the same day — see §0. Desktop was never affected; mobile was, and has been fixed
related:
  - "quorum-shared src/utils/messagePreprocessing.ts (`processMentions`, `buildMemberKeyMap`)"
  - "quorum-shared src/utils/mentions.ts (`extractMentionsFromText`) — the notification-side extractor"
  - "quorum-mobile components/Chat/MessageRenderer.tsx and components/Chat/MentionableText.tsx (the mobile fix)"
---

# The dangerous branch is off everywhere. Delete it so it stays off.

## Status

Done on `quorum-shared` branch `fix/identity-resolver-and-mention-cleanup`, with
the matching desktop call-site update on the same branch name in `quorum-desktop`.

§3's "breaking signature change" concern was resolved by taking the breakage
**deliberately and loudly** rather than avoiding it — see §5.

Verified, not argued: the regression test was run against the OLD implementation
and fails there, then passes with the branch removed. quorum-shared 585 tests
pass; quorum-desktop 953 tests pass with typecheck and lint clean against the
rebuilt `dist`.

## 0. Correction — the original version of this issue was wrong about desktop

> This was first filed as a bug affecting **both** clients, claiming a hand-typed
> `@Name` renders as a real mention pill on desktop too. **That is false.** It was
> written from the shared implementation without checking desktop's call site.
>
> `src/components/message/MessageMarkdownRenderer.tsx:184-187` already passes an
> empty member array:
>
> ```ts
> // Desktop never produced legacy bare-`@name` mentions, so it passes no members.
> return sharedProcessMentions(text, [], hasEveryoneMention);
> ```
>
> and desktop has exactly one mention render path (`MessageMarkdownRenderer`, via
> react-markdown) with no second plain-text renderer and no name-keyed member map
> outside role handling. So desktop has always been strict. The observed defect was
> mobile-only and is fixed there.
>
> Recording this rather than quietly rewriting, because the mistake is instructive:
> the shared implementation told you what was *possible*, not what each client
> actually *does*. Check the call site.

## 1. What is actually left

`processMentions` in `quorum-shared` still contains a legacy branch that turns a
bare `@Name` into a user mention token whenever the text matches an entry in
`buildMemberKeyMap` (keyed on `display_name`, `name`, `address`). It is gated on
`members.length > 0`.

Both clients now pass an empty array, so the branch never executes:

| Client | Call site | Passes |
|---|---|---|
| Desktop | `src/components/message/MessageMarkdownRenderer.tsx:186` | `[]` (always did) |
| Mobile | `components/Chat/MessageRenderer.tsx` | omits `members` (fixed 2026-08-04) |

## 2. Why bother removing dead code

Because the gate is the *only* thing holding it off, and the gate is a caller's
argument rather than a property of the function. `PreprocessOptions` still
advertises `members?: SpaceMember[]`, so any future caller that passes a member
list silently re-enables it, and what it re-enables is genuinely harmful:

- **The pill lies.** `extractMentionsFromText` extracts `@<address>` only, so a
  bare `@Name` pill is styled, tappable, opens a profile, and notifies nobody.
  The sender cannot tell.
- **It can point at the wrong person.** Display names are not unique.
  `buildMemberKeyMap` is a plain object, so on a collision the later member in
  the array silently overwrites the earlier one.

The same pipeline already applies the correct rule to `@everyone`, and says so:

> An unauthorized/spoofed @everyone renders as plain text, matching how the
> notification path already refuses to honor it.

Names were simply never brought in line. Removing the branch makes "render only
what the notifier honours" structural instead of a convention two callers happen
to follow.

## 3. Scope

- Roles are NOT affected and must not change: bare `@roleTag` IS honoured by
  `extractMentionsFromText` (validated against the space's real roles), so role
  pills are truthful. Same for channels and `@everyone`.
- Removing `members` from `PreprocessOptions` is a breaking signature change for
  a published package. Either drop the parameter in a version both clients move
  to together, or keep the parameter and delete only the branch body.

## 4. Definition of done

- [x] The bare-name branch and `buildMemberKeyMap` are removed from `processMentions`
- [x] Role, channel and `@everyone` tokenization unchanged, with tests proving it
- [x] `members` is removed from `PreprocessOptions` (removed outright, not documented as ignored)
- [x] Both clients build against the version that drops it
- [x] A test asserts a bare `@Name` does NOT tokenize even when a matching member is supplied

## 5. How the signature change was made safe

§3 flagged the choice: drop the parameter (breaking) or keep it and empty the
body (safe but leaves the footgun). Neither, quite — the parameter was dropped in
a way that **cannot break silently**.

`processMentions(text, members, everyoneAuthorized)` became
`processMentions(text, everyoneAuthorized)`. The danger with a positional
removal is the silent shift: `processMentions(text, [], true)` would have passed
`[]` as `everyoneAuthorized`, and `[]` is falsy, so authorized `@everyone`
mentions would have quietly stopped rendering. That is exactly the class of
failure that runs for months undetected.

It cannot happen here, because `SpaceMember[]` is not assignable to `boolean`:
any surviving caller is a **compile error**, not a behaviour change. That made
the breakage a one-line fix at desktop's single call site
(`MessageMarkdownRenderer.tsx:186`), found by the typechecker rather than by a
user. Mobile passes an options object with no `members` key and needed no change.

Keeping a dead parameter was rejected precisely because it preserves the thing
§2 objects to: a slot that invites a future caller to fill it.

## 6. Two tests, doing different jobs

- **Type-level**: `Parameters<typeof processMentions>[1]` must be a boolean.
  Re-adding a members parameter stops the suite compiling.
- **Runtime**: a member list is forced past the type system with a cast, and the
  bare name must still not tokenize. This is the one that matters — it proves a
  plain-JS caller, or a stale bundled `dist`, cannot resurrect the branch either.

The runtime test was checked against the old implementation and **fails** there
(returning `hi <<<MENTION_USER:Qm…>>>`), so it is a test that could genuinely
have failed rather than one that passes either way.

## 7. Follow-up in quorum-mobile (not done here)

`components/Chat/MessageRenderer.tsx:80-97` carries a ~20-line comment explaining
that `members` is deliberately not passed because the branch is "gated on
`members.length > 0`, so omitting it is the supported way to switch that branch
off". That gate no longer exists — the branch is gone and the parameter with it.
The code is still correct; the comment now describes a mechanism that isn't
there. Worth trimming to a sentence on the next mobile touch.

*Last updated: 2026-08-04*
