---
type: task
title: "Promote the message-preprocessing pipeline (mention/URL/header/code-fence transforms) to quorum-shared"
status: ready
created: 2026-06-18
updated: 2026-06-25
runtime-test: not-required (logic move; visual smoke on both apps)
priority: medium (de-dups desktop's inlined pipeline; gives mobile's markdown renderer a shared backbone)
source: mobile-originated — quorum-mobile Wave 1 Phase 2 wrote a clean pure-function extraction first
related:
  - quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-18-adopt-shared-message-preprocessing.md (the mobile consumer leg)
  - quorum-mobile/.agents/tasks/2026-06-18-mentions-and-markdown-renderer.md (Wave 1; where the mobile pipeline was written)
  - quorum-desktop/src/components/message/MessageMarkdownRenderer.tsx (the desktop file holding the inlined copy)
  - quorum-mobile/utils/messagePreprocessing.ts (the clean draft to start the shared module from)
---

# Promote the message-preprocessing pipeline to quorum-shared

## Status snapshot (re-verified 2026-06-25)

Re-checked against all three repos before marking ready. **The task is still worth
doing and the duplication is real**, but one large chunk it described as *pending* has
already landed independently, so the remaining work is smaller and cleaner than the
2026-06-18 draft implied:

- ❌ **Not started:** `quorum-shared/src/utils/messagePreprocessing.ts` does not exist;
  no test file; desktop still has every function inlined in
  `MessageMarkdownRenderer.tsx`; mobile still imports its local
  `utils/messagePreprocessing.ts`. The duplication this task removes is live.
- ✅ **Already done (was the task's biggest open item):** the **option-B role/channel
  reconciliation**. Desktop's renderer ALREADY resolves role/channel mentions directly
  from `spaceRoles: Role[]` / `spaceChannels: Channel[]` with **no
  `message.mentions.roleIds`/`channelIds` filter** — see
  `MessageMarkdownRenderer.tsx:364` (`processRoleMentions`) and `:411`
  (`processChannelMentions`), whose own comments now describe option B. The props are
  already `spaceRoles`/`spaceChannels` (`:49-50`), not the old `roleMentions: string[]`
  / `channelMentions: string[]`. **So this is now a pure extraction, not a behavior
  change.** The whole "Design decision required / option A vs B" debate is settled and
  shipped; it survives below only as historical context.
- ✅ **Infra confirmed ready:** shared uses Vitest with 8 existing `src/utils/*.test.ts`
  files; `src/utils/index.ts` barrel exists; `SpaceMember`/`Role`/`Channel` are all
  exported from shared; none of the 8 function names collide with existing shared
  exports; desktop consumes shared via `link:../quorum-shared` (no publish needed for
  desktop to pick up new code, same as the icon-picker migration).

So: **proceed with the extraction.** The new-vs-draft work is reconciling a handful of
genuine desktop↔mobile divergences (listed in "Divergences to reconcile" below) — that
is the real engineering content now, not the filtering decision.

**Independent worth-it review (2026-06-25):** before committing, an independent skeptical
agent re-read all three repos and graded the migration **"Worth it, medium-high confidence."**
It confirmed the duplication is real (~320 desktop lines + 383 mobile lines of one algorithm),
that the `<<<MENTION_*>>>` vocabulary is a genuine load-bearing protocol (`markdownStripping.ts`
+ `.native.ts` already hardcode it to strip those tokens — so a producer divergence is a real
cross-platform bug, not cosmetic), that it's truly pure (needs no `.native` split), and that
there are no export-name collisions. It also surfaced **two divergences the original draft
missed** — now captured as #7 (the `!mapSenderToUser` guard, a token-leak risk) and #8
(`@<roleId>` role form). Both were independently verified against the code before being added.
Net: the migration makes sense; #7 is the one item that must not be implemented carelessly.

## Why

Desktop's `src/components/message/MessageMarkdownRenderer.tsx` contains a
preprocessing pipeline — pure string transforms that run BEFORE `react-markdown`:
tokenize mentions/roles/channels into `<<<MENTION_*>>>` markers, auto-link bare
URLs, normalize headers to `###`, and balance unclosed code fences. These are
**inlined** in the component (module-level functions + `useCallback` closures).

Mobile (Wave 1 Phase 2) needed the same pipeline for its hand-rolled RN markdown
renderer and wrote a clean, React-free extraction at
`quorum-mobile/utils/messagePreprocessing.ts`. So we now have **two copies of one
pure-string algorithm**, and the internal token vocabulary
(`<<<MENTION_USER:…>>>`, `<<<MENTION_ROLE:roleTag:displayName>>>`,
`<<<MENTION_CHANNEL:channelId:channelName>>>`) is **shared protocol** between the
platforms. Any divergence in these transforms = cross-platform render bugs.

**Structurally ready to promote:** 100% pure string→string — no DOM, no native
APIs, no `unified`. Unlike `markdownStripping` (which forks into `.native.ts`
because of `unified`/`remark` — confirmed both files still present in shared), this
needs **no `.native` split** — one module, both platforms. It already depends only
on `hasWordBoundaries` + `createIPFSCIDRegex`, which are already shared exports.

## What's already shared (don't re-do)

- `hasWordBoundaries`, `createIPFSCIDRegex` (the two helpers the pipeline calls)
- `extractMentionsFromText`, `isMentioned`, `getMentionType`, `isMentionedWithSettings` (mentions.ts)
- `extractCodeContent`, `shouldUseScrollContainer`, `getScrollContainerMaxHeight` (codeFormatting.ts)
- `stripMarkdown`/`processMarkdownText` (markdownStripping.ts + .native — a *different* concern: stripping for previews, not tokenizing for rendering)
- `getRoleColorHex` (roleUtils.ts)
- `SpaceMember`, `Role`, `Channel` types (all exported from the shared root)

## What's NOT shared (this task moves it)

The pure pipeline, currently duplicated (desktop inlined + mobile-local):

- `processMentions` (`@<address>` + `@everyone` → tokens)
- `processRoleMentions`, `processChannelMentions`
- `processURLs`, `convertHeadersToH3`, `fixUnclosedCodeBlocks`
- `getProtectedRegions` / `isInProtectedRegion` (code-region protection — internal helper)
- `hasMarkdown(text)` detector (mobile-only today; useful to both)
- `prepareMessageContent(text, opts)` orchestrator (mobile-only today; desktop will NOT call it — see step 5)

Mobile's `utils/messagePreprocessing.ts` is already a clean draft of the shared
module — **start from it.** It is the better-factored of the two copies (typed opts,
JSDoc, named exports).

## Divergences to reconcile (the actual engineering content)

These are the real desktop↔mobile differences a naive copy would paper over. Resolve
each deliberately in the shared module; cover each with a test.

1. **`processURLs` — angle-bracket autolink skip (desktop-only).** Desktop's version
   (`MessageMarkdownRenderer.tsx:179-182`) skips a URL already wrapped as a `<URL>`
   autolink (`beforeUrl.endsWith('<') && afterUrl.startsWith('>')`). Mobile's
   (`messagePreprocessing.ts:250`) has **no** such skip. **Keep desktop's behavior** —
   port the angle-bracket guard into shared. Test: `<https://x.com>` is left untouched;
   a bare `https://x.com` is wrapped.

2. **`getProtectedRegions` — markdown-link protection.** Desktop's `getProtectedRegions`
   (`:86`) protects fenced code, inline code **AND** existing `[text](url)` markdown
   links. Mobile's `getProtectedRegions` (`:55`) protects only code; it then re-protects
   md-links *inline inside `processURLs`* (`:254`). Net effect is similar for URL
   auto-linking but NOT identical for mention tokenization (desktop won't tokenize a
   mention sitting inside `[text](url)`; mobile would). **Decide one behavior** — desktop's
   (links are protected everywhere) is the safer superset; adopt it in shared so a
   `@<addr>` inside a markdown link's text doesn't get tokenized. Test both: a mention
   and a bare URL inside `[ ]( )` stay untouched.

3. **`@everyone` parameter shape.** Desktop gates `@everyone` tokenization on a
   `hasEveryoneMention: boolean` prop (`:305`). Mobile gates on `opts.everyoneAuthorized`
   (`:101`). Same concept (only tokenize an *authorized* `@everyone`), different param
   name. **Unify on one name** in the shared signature — `everyoneAuthorized` (mobile's,
   more precise about meaning) — and have desktop pass its `hasEveryoneMention` value
   into it. Document that the caller owns the authorization decision (the shared function
   only tokenizes; it does not decide who's allowed to ping).

4. **`convertHeadersToH3` regex.** Desktop uses two sequential replaces
   (`^##\s → "### "`, then `^#\s → "### "`; `:265-267`). Mobile uses one pass
   (`^(#{1,2})(?!#)(\s+) → "###$2"`; `:290`). Confirm equivalence (they should produce
   identical output for `#`, `##`, `###+`) and pick the single-pass mobile form. Test:
   `# h` and `## h` → `### h`; `### h` and `#### h` unchanged; a `#` inside a fence
   untouched.

5. **Legacy bare-`@address` shim (mobile-only).** Mobile's `processMentions` tolerates a
   legacy bare `@address` (no brackets), gated on a `members` array
   (`:138-155`). Desktop never produced bare-format mentions, so it always passes no
   members → the shim is inert. **Keep it in shared, gated on `members.length > 0`** so
   it's harmless for desktop. Test: with members supplied, bare `@alice` → token; with
   none, bare `@alice` stays plain text.

6. **Newline normalization (`\r\n? → \n`).** `prepareMessageContent` does this as its
   first step (`:323`); the individual functions do NOT. Desktop will call the individual
   functions (not the orchestrator — see step 5 of Scope), so desktop does NOT inherit
   normalization — fine, desktop never hit the CR bug (it goes through react-markdown).
   Just don't silently fold it into an individual function and change desktop's behavior.

7. **⚠️ `!mapSenderToUser` early-return guard (desktop-only — MUST preserve).** Found by
   the independent worth-it review; the original draft missed it. Desktop's `processMentions`
   returns `text` unchanged when `mapSenderToUser` is falsy (`MessageMarkdownRenderer.tsx:297`).
   Mobile's shared `processMentions` has NO such guard — it always tokenizes. `mapSenderToUser`
   is an **optional** prop, and the renderer is used at callsites that omit it (verified:
   `BookmarkCard.tsx:121`, plus DirectMessage/BookmarksPanel paths). At those callsites the
   token→React renderer (`processMentionTokens`) may also not be fully wired — so if the shared
   function tokenizes unconditionally, a `@<address>` becomes a `<<<MENTION_USER:…>>>` token
   that can **leak raw to the user** instead of staying plain text. **Fix: keep the guard in
   desktop's `useCallback` wrapper, NOT in the shared function.** The shared function stays a
   pure unconditional tokenizer (correct); desktop's wrapper short-circuits:
   ```ts
   const processMentions = useCallback((text: string): string => {
     if (!mapSenderToUser) return text;            // desktop-only caller guard — preserve
     return sharedProcessMentions(text, [], hasEveryoneMention);
   }, [mapSenderToUser, hasEveryoneMention]);
   ```
   Test the shared function tokenizes unconditionally; assert the guard in the desktop wrapper
   via the visual-smoke step (a message with `@<addr>` in a context without `mapSenderToUser`
   must NOT show a raw token).

8. **`@<roleId>` canonical role form (additive for desktop — note, don't block).** Found by
   the review. Mobile's `processRoleMentions` matches BOTH `@<roleId>` (angle-bracketed UUID,
   `messagePreprocessing.ts:171-187`) and bare `@roleTag` (`:190-207`). Desktop only matches
   bare `@roleTag` (`MessageMarkdownRenderer.tsx:385`). Verified desktop's composer writes roles
   as **bare `@roleTag`, never `@<roleId>`** (`MessageComposer.tsx:233-234`), so for
   desktop-authored messages the extra `@<roleId>` branch is **inert**. Accept it as additive
   (harmless), but be aware: a user who types literal `@<some-uuid>` text where the uuid matches
   a real role's id would now get a pill on desktop where before it stayed plain. Negligible edge
   case; call it out in the desktop PR description rather than trying to strip the branch.

## Scope

1. **Create `quorum-shared/src/utils/messagePreprocessing.ts`** from the mobile file,
   applying the divergence reconciliations above. Add it to the `src/utils/index.ts`
   barrel (which the root re-exports), alongside the existing `markdownStripping`/
   `codeFormatting` lines. Public surface: `prepareMessageContent`, `hasMarkdown`, and the
   individual `process*` functions (for callers — i.e. desktop — that want steps à la carte).

2. **Role/channel API — already option B, just match the signature.** Shared signature:
   `processRoleMentions(text, roles: Role[])`, `processChannelMentions(text, channels: Channel[])`
   — filterless, resolve directly from the arrays. **Desktop already uses exactly this shape**
   (`spaceRoles`/`spaceChannels`, no id filter), so no desktop behavior change is needed here;
   the refactor just swaps the inlined `useCallback` bodies for shared imports.

3. **Carry the mobile legacy shim** (divergence #5) — gated on `members` being supplied.

4. **Leave the desktop-only steps inlined.** `processInviteLinks`,
   `processStandaloneYouTubeUrls`, `processMessageLinks` are desktop-only (mobile defers
   them to its facade tasks). **Do not move them** — promote the common core now; revisit
   when the mobile facades (#5 YouTube, invite cards, message links) land. They stay in
   `MessageMarkdownRenderer.tsx`.

5. **Refactor desktop to consume shared.** Replace the inlined functions in
   `MessageMarkdownRenderer.tsx` with shared imports:
   - Module-level (`processURLs`, plus `getProtectedRegions`/`isInProtectedRegion`) → import from shared.
   - `useCallback` ones (`processMentions`, `processRoleMentions`, `processChannelMentions`)
     → call the shared pure functions inside the `useCallback`, passing the closed-over
     args (`mapSenderToUser`→members not needed for desktop, `hasEveryoneMention`,
     `spaceRoles`, `spaceChannels`) as function params matching the shared signature. Keep
     the `useCallback` wrappers (they preserve referential stability for the `processedContent`
     useMemo deps).
   - `convertHeadersToH3`, `fixUnclosedCodeBlocks` (currently defined *inside* the component
     body, `:253`/`:278`) → import from shared.
   - **Do NOT call `prepareMessageContent` on desktop.** Desktop's pipeline interleaves
     desktop-only steps with shared ones in a specific order:
     `processInviteLinks` → `processStandaloneYouTubeUrls` → mentions/roles/channels →
     `processMessageLinks` → `processURLs` → `convertHeadersToH3` → `fixUnclosedCodeBlocks`
     (see the `processedContent` useMemo at `:772-790`). Critically `processMessageLinks`
     MUST run before `processURLs` to avoid double-processing (the comment at `:770` says so).
     Desktop calls the **individual** shared functions in its existing order; only mobile uses
     the `prepareMessageContent` orchestrator.
   - `processMentionTokens` (the token→React renderer, `:569`) is desktop-DOM-specific and
     stays in the component — it is NOT part of this move.

6. **Mobile consumes** — separate leg, tracked in the mobile task (consumer): bump the
   shared dep, swap `@/utils/messagePreprocessing` → `@quilibrium/quorum-shared`,
   delete the local file. Its `everyoneAuthorized`/`members`/`roles`/`channels` opts already
   match the shared signature, so it's a near-drop-in.

## Tests — ship them in shared with the move

Shared already uses **Vitest** with an established `src/utils/*.test.ts` pattern
(confirmed: `mentions.test.ts`, `validation.test.ts`, `roleUtils.test.ts`,
`messageGrouping.test.ts`, + 4 more). Add `src/utils/messagePreprocessing.test.ts` in
the SAME PR. This is the durable home for these tests — they cover desktop AND mobile
from one suite.

> **Why not test in mobile?** Mobile has no test runner at all (no jest/vitest, no
> `test` script, zero test files as of 2026-06-18). Desktop's preprocessing functions
> were never unit-tested (inlined, untestable). So shared is the only place these tests
> have ever had a home, and the only place they won't go stale when the logic moves.

Test matrix (each divergence above also gets a test — see that section):
- mention tokenization: `@<address>` → `<<<MENTION_USER:…>>>`; `@everyone` (authorized) →
  `<<<MENTION_EVERYONE>>>`; `@everyone` (NOT authorized) → stays plain; legacy bare
  `@address` (with members) → token; (without members) → plain
- code-region protection: no tokenization inside `` `inline` `` or ` ```fenced``` `
- markdown-link protection (divergence #2): mention + bare URL inside `[ ]( )` untouched
- word-boundary rejection: `x@everyone` must NOT match; mention at string start/end OK
- role/channel tokenization against the resolver arrays (and case-sensitive role tag match per current desktop regex `@${roleTag}(?!\w)`)
- `processURLs`: bare URL → `[url](url)`; skips code + existing markdown links + `<URL>` autolinks (divergence #1)
- `convertHeadersToH3`: `#`/`##` → `###`, leaves `###`+ alone, protects code blocks (divergence #4)
- `fixUnclosedCodeBlocks`: odd fence count gets a closing fence; even is untouched
- `hasMarkdown`: plain chat line / bare @mention / bare URL → false; `**b**`, `_i_`,
  `~~s~~`, `` `c` ``, fences, `||s||`, `# h`, `> q`, `- list`, `1. ol`, `---` → true

## Cross-repo workflow

Follow [cross-repo-workflow.md](cross-repo-workflow.md). Shape (driver = shared + desktop;
consumer = mobile):

1. **quorum-shared PR** (you author; user drives merge + version bump per
   [feedback_quorum_shared_workflow]): add `messagePreprocessing.ts` + `messagePreprocessing.test.ts`,
   add the line to `src/utils/index.ts`, `yarn build`, `yarn test:run`. Additive — no breaking
   change. Bump the `X.Y.Z-N` suffix (currently `2.1.0-34`; do NOT "fix" the suffix to plain
   SemVer — it's a deliberate lead-dev convention).
2. **quorum-desktop PR** (this branch): swap `MessageMarkdownRenderer.tsx`'s inlined functions to
   shared imports; verify the renderer still produces identical output (mentions, spoilers, code,
   URLs, headers). `npx tsc --noEmit` + `yarn lint` clean. Desktop picks up shared via
   `link:../quorum-shared` once shared's `dist/` is rebuilt (`yarn build` in shared) — same
   mechanism as the icon-picker migration; no publish needed for local desktop dev.
3. **quorum-mobile**: consumer leg — tracked in the mobile task
   ([`2026-06-18-adopt-shared-message-preprocessing.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-18-adopt-shared-message-preprocessing.md)).

> Reminder ([feedback_dont_break_mobile_on_shared_changes]): the shared change must be
> **additive** — new module, new exports, no edits to existing shared signatures mobile is
> pinned to. Mobile consumes on its own schedule via a version bump.

## Verification

- [ ] quorum-shared: `messagePreprocessing` + tests exported from root; `yarn build` +
      `yarn test:run` clean. Every divergence (#1-#8) has a covering test or documented decision.
- [ ] quorum-desktop: the `!mapSenderToUser` guard (divergence #7) is preserved in the
      desktop `useCallback` wrapper — a `@<address>` in a context without `mapSenderToUser`
      (e.g. a bookmark card) renders as plain text, NOT a raw `<<<MENTION_USER:…>>>` token.
- [ ] quorum-desktop: `MessageMarkdownRenderer.tsx` imports the pure functions from shared
      (`processURLs`, `processMentions`, `processRoleMentions`, `processChannelMentions`,
      `convertHeadersToH3`, `fixUnclosedCodeBlocks`, `getProtectedRegions`/`isInProtectedRegion`);
      `npx tsc --noEmit` + `yarn lint` clean.
- [ ] quorum-desktop: renderer output unchanged (visual smoke — a message with @mention, @role,
      #channel, `**bold**`, fenced code, `||spoiler||`, a bare URL, a `<https://x.com>` autolink,
      a `[label](url)` markdown link containing an @mention).
- [ ] quorum-desktop: pipeline step order preserved (`processMessageLinks` before
      `processURLs`); a message link is NOT double-processed into a plain URL.
- [ ] quorum-desktop: the desktop-only steps (`processInviteLinks`,
      `processStandaloneYouTubeUrls`, `processMessageLinks`, `processMentionTokens`) remain
      inlined and unchanged.
- [ ] No regression on desktop (mentions/spoilers/code/URLs/headers all still render).
- [ ] Mobile consumer leg opened/linked.

## Historical context — the role/channel filtering decision (NOW MOOT, kept for the record)

The 2026-06-18 draft framed role/channel filtering as an open design decision (option A:
keep desktop's `message.mentions.roleIds` filter; option B: adopt mobile's filterless
resolve-from-array). **Option B was chosen AND has since been implemented on desktop**
independently of this task — `MessageMarkdownRenderer.tsx` already resolves directly from
`spaceRoles`/`spaceChannels` with no id filter, and its inline comments document the option-B
rationale (consistency, pill = "names a real role" not "pinged everyone", notification path
unchanged). So there is nothing to decide or change here anymore; the extraction simply
matches the signature desktop already uses. The original rationale is preserved in git
history of this file if needed.

---

*Last updated: 2026-06-25 — re-verified against all three repos and marked `ready`, then
hardened with an independent worth-it review. Key correction vs the 2026-06-18 draft: the
option-B role/channel reconciliation is already shipped on desktop, so this is now a pure
extraction, not a behavior change. Replaced the stale "design decision required" section
with a concrete "Divergences to reconcile" list. The independent review confirmed the
migration is worth doing (medium-high confidence) and added two divergences the draft
missed: #7 the `!mapSenderToUser` guard (token-leak risk — keep the guard in desktop's
wrapper, not the shared fn) and #8 the `@<roleId>` role form (additive/inert for desktop,
verified via `MessageComposer.tsx:233-234`). Confirmed shared test infra (Vitest + 8 suites),
the `src/utils` barrel, `SpaceMember`/`Role`/`Channel` exports, zero export-name collisions,
and the `link:../quorum-shared` consume path.*
