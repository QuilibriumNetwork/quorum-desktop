---
type: task
title: "Promote the message-preprocessing pipeline (mention/URL/header/code-fence transforms) to quorum-shared"
status: open
created: 2026-06-18
runtime-test: not-required (logic move; visual smoke on both apps)
priority: medium (de-dups desktop's inlined pipeline; gives mobile's markdown renderer a shared backbone)
source: mobile-originated — quorum-mobile Wave 1 Phase 2 wrote a clean pure-function extraction first
related:
  - quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-18-adopt-shared-message-preprocessing.md (the mobile consumer leg)
  - quorum-mobile/.agents/tasks/2026-06-18-mentions-and-markdown-renderer.md (Wave 1; where the mobile pipeline was written)
  - quorum-desktop/src/components/message/MessageMarkdownRenderer.tsx (the desktop file holding the inlined copy)
---

# Promote the message-preprocessing pipeline to quorum-shared

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
because of `unified`/`remark`), this needs **no `.native` split** — one module,
both platforms. It already depends only on `hasWordBoundaries` + `createIPFSCIDRegex`,
which are already shared exports.

## What's already shared (don't re-do)

- `hasWordBoundaries`, `createIPFSCIDRegex` (the two helpers the pipeline calls)
- `extractMentionsFromText`, `isMentioned`, `getMentionType`, `isMentionedWithSettings` (mentions.ts)
- `extractCodeContent`, `shouldUseScrollContainer`, `getScrollContainerMaxHeight` (codeFormatting.ts)
- `stripMarkdown`/`processMarkdownText` (markdownStripping.ts + .native — a *different* concern: stripping for previews, not tokenizing for rendering)
- `getRoleColorHex` (roleUtils.ts)

## What's NOT shared (this task moves it)

The pure pipeline, currently duplicated (desktop inlined + mobile-local):

- `processMentions` (`@<address>` + `@everyone` → tokens)
- `processRoleMentions`, `processChannelMentions`
- `processURLs`, `convertHeadersToH3`, `fixUnclosedCodeBlocks`
- `getProtectedRegions` / `isInProtectedRegion` (code-region protection — internal)
- `hasMarkdown(text)` detector (mobile-only today; useful to both)
- `prepareMessageContent(text, opts)` orchestrator

Mobile's `utils/messagePreprocessing.ts` is already a clean draft of the shared
module — start from it.

## Design decision: role-mention filtering — DECIDED (option B)

The one non-mechanical call. **Settled: adopt mobile's filterless behavior on both
platforms.**

Background. Desktop today does NOT tokenize every `@roleTag` it finds — it only
styles a role mention if that role's id is in the message's pre-extracted mention
set (`message.mentions.roleIds`). See
`src/hooks/business/messages/useMessageFormatting.ts:159`
(`if (role && message.mentions.roleIds.includes(role.roleId))`) and the renderer's
`roleMentions: string[]` prop fed from `message.mentions?.roleIds`
(`Message.tsx:1138`). Mobile's `processRoleMentions(text, roles)` has NO such
filter: it tokenizes any existing role that matches `@roleTag` (or `@<roleId>`).

**Decision (B): desktop drops the `message.mentions.roleIds` filter and adopts
mobile's resolve-from-array behavior.** Rationale:
- **Consistency = better UX.** The exact same text `@admin` renders identically
  everywhere, instead of being a pill or plain grey depending on invisible state
  (was it picked from the @ menu? did an edit desync the list?). Inconsistent
  rendering of identical text is the worse experience.
- **Still satisfies the hard requirement:** a pill is only ever rendered for a role
  that ACTUALLY EXISTS in the space — both options check the role list first, so a
  non-existent `@notarole` never becomes a pill under either. (This requirement is
  not the discriminator; both pass it.)
- **Simpler, unified code:** one signature `processRoleMentions(text, roles)` /
  `processChannelMentions(text, channels)` for both platforms; no filter param to
  thread through.

**Known, accepted trade-off — pill ≠ notification.** On desktop today
`message.mentions.roleIds` is also the set that decides who gets PINGED, so pill and
ping coincide. Under B they can diverge: typing `@admin` as casual text (never picked
from the menu) lights up as a pill but does NOT notify the admin role's members.
Accepted: the pill means "this names a real role," not "this pinged everyone" (matches
Discord-style behavior). The notification path is unchanged — only the visual
tokenization stops consulting `roleIds`.

Wire-format compatibility verified: mobile's function matches BOTH `@<roleId>` and
bare `@roleTag`, and desktop's composer writes roles as bare `@roleTag`
(`MessageComposer.tsx:232`), users as `@<address>`, channels as `#<channelId>`. The
mobile function already handles desktop's wire format.

## Scope

1. **Create `quorum-shared/src/utils/messagePreprocessing.ts`** from the mobile file.
   Re-export the public surface (`prepareMessageContent`, `hasMarkdown`, and the
   individual `process*` functions for callers that want steps à la carte) from the
   package root barrel.

2. **Reconcile the role/channel API — option B (decided).**
   - Shared signature: `processRoleMentions(text, roles: Role[])`,
     `processChannelMentions(text, channels: Channel[])` — filterless, resolve
     directly from the arrays (mobile's existing shape).
   - Desktop drops the `roleMentions: string[]` / `channelMentions: string[]` filter
     props and the `message.mentions.roleIds`/`channelIds` plumbing into the renderer;
     it passes `spaceRoles` / `spaceChannels` as the resolver arrays instead.
   - Net desktop behavior change: a `@roleTag` / `#<channelId>` that names an existing
     role/channel now tokenizes regardless of whether it was in `message.mentions`.
     Intended (see decided design call above).

3. **Carry the mobile legacy shim.** Mobile's `processMentions` tolerates the legacy
   bare `@address` (no brackets) format for messages already in storage from old
   mobile clients. Keep it in shared, gated on a `members` array being supplied
   (harmless for desktop, which never produced bare-format mentions).

4. **Decide on the desktop-only steps.** `processInviteLinks`,
   `processStandaloneYouTubeUrls`, `processMessageLinks` are desktop-only today
   (mobile defers them to its facade tasks). **Recommend: promote the common core
   now; leave these three desktop-inlined** (or add to shared behind opt-in flags)
   until the mobile facades (#5 YouTube, invite cards, message links) land.

5. **Refactor desktop to consume shared.** Replace the inlined functions in
   `MessageMarkdownRenderer.tsx` with shared imports. The module-level ones
   (`processURLs`, `convertHeadersToH3`, `fixUnclosedCodeBlocks`) are an easy lift;
   the `useCallback` ones need their closed-over args (`mapSenderToUser`,
   `hasEveryoneMention`, the role/channel arrays) passed as function params, matching
   the shared signature.
   - **Do NOT call the `prepareMessageContent` orchestrator on desktop.** Desktop's
     pipeline interleaves desktop-only steps with the shared ones in a specific order:
     `processInviteLinks` → `processStandaloneYouTubeUrls` → mentions/roles/channels →
     `processMessageLinks` → `processURLs` → `convertHeadersToH3` →
     `fixUnclosedCodeBlocks`. Critically `processMessageLinks` MUST run before
     `processURLs` to avoid double-processing (see the comment at the current
     `processedContent` useMemo). So desktop calls the **individual** shared functions
     in its existing order; only mobile uses the `prepareMessageContent` orchestrator.
   - **Newline normalization:** `prepareMessageContent` does `\r\n? → \n` as its first
     step; desktop's inlined pipeline does not. If desktop adopts the individual
     functions (not the orchestrator) it does NOT inherit this — fine, since desktop
     never hit the CR bug. Just don't reintroduce it silently.

6. **Mobile consumes** — separate leg, tracked in the mobile task (consumer): bump the
   shared dep, swap `@/utils/messagePreprocessing` → `@quilibrium/quorum-shared`,
   delete the local file.

## Tests — ship them in shared with the move

Shared already uses **Vitest** with an established `src/utils/*.test.ts` pattern
(`mentions.test.ts`, `validation.test.ts`, `roleUtils.test.ts`). Add
`src/utils/messagePreprocessing.test.ts` in the SAME PR. This is the durable home
for these tests — they cover desktop AND mobile from one suite.

> **Why not test in mobile?** Mobile has no test runner at all (no jest/vitest, no
> `test` script, zero test files as of 2026-06-18). Desktop's preprocessing functions
> were never unit-tested (inlined, untestable). So shared is the only place these tests
> have ever had a home, and the only place they won't go stale when the logic moves.

Test matrix:
- mention tokenization: `@<address>` → `<<<MENTION_USER:…>>>`; `@everyone` →
  `<<<MENTION_EVERYONE>>>`; legacy bare `@address` (with members) → token
- code-region protection: no tokenization inside `` `inline` `` or ` ```fenced``` `
- word-boundary rejection: `x@everyone` must NOT match; mention at string start/end OK
- role/channel tokenization against the resolver arrays (and case-insensitive role tag)
- `processURLs`: bare URL → `[url](url)`; skips code + existing markdown links + autolinks
- `convertHeadersToH3`: `#`/`##` → `###`, leaves `###`+ alone, protects code blocks
- `fixUnclosedCodeBlocks`: odd fence count gets a closing fence; even is untouched
- `hasMarkdown`: plain chat line / bare @mention / bare URL → false; `**b**`, `_i_`,
  `~~s~~`, `` `c` ``, fences, `||s||`, `# h`, `> q`, `- list`, `1. ol`, `---` → true
- emphasis nesting sanity if the inline parser is also promoted (optional — the inline
  RN renderer is mobile-specific; only the preprocessing is shared)

## Mobile/desktop divergences to account for when sharing (from device testing 2026-06-18)

Device testing of the mobile renderer surfaced where mobile genuinely needs
different logic than desktop. Keep this split in mind when promoting — the PURE
pieces are shareable; the RN-RENDERING and a few behavioral bits are not (or need
to be parameterized).

**Shareable (pure logic — the promotion target):**
- The whole preprocessing pipeline (mention/role/channel tokenization, URL
  auto-link, header normalize, fence balance).
- The **block parser** (text → block AST: paragraph/heading/blockquote/list/
  code/hr) and the **inline parser** (runs → bold/italic/strike/code/spoiler/
  mention tokens/emoji/link). These are pure and platform-agnostic. Desktop
  currently uses `react-markdown` (DOM-only) so it can't reuse a renderer, but a
  shared **AST producer** could feed both: desktop renders AST→DOM, mobile
  AST→RN. Worth considering as the real long-term shape.

**Mobile-specific (must NOT be naively shared / needs parameterizing):**
- **Newline normalization (`\r\n?` → `\n`) before block parsing.** Mobile needs
  this because pasted text on device carried stray CRs that broke per-line block
  matching (only the last blockquote/list line survived). Desktop via
  react-markdown doesn't hit this. If the block parser is shared, this normalize
  step should live INSIDE it (harmless for desktop, required for mobile).
- **Spoiler rendering.** Desktop uses a CSS class toggle; mobile renders block
  glyphs (`█`) when hidden because RN `color: 'transparent'` on nested `<Text>`
  is unreliable. Pure-logic shareable (detect `||...||`); the reveal/hide
  RENDERING stays platform-specific.
- **Pill styling.** Desktop uses a highlighted background pill; mobile uses
  color-only (bg read too heavy on small screens). Shareable: which runs are
  pills + their semantic color. NOT shareable: the visual treatment.
- **Channel mention wire format alignment.** Mobile's composer now inserts
  `#<channelId>` (matching desktop's shared format) and `MentionableText` parses
  both `#<id>` and legacy `#name`. This convergence is good — it means a shared
  channel-tokenizer works for both. Note the legacy `#name` parse is a mobile
  back-comat concern (old mobile messages stored bare names).
- **Auto-link truncation (50 chars).** Mobile matches desktop's number; keep the
  threshold a shared constant so they can't drift.

## Cross-repo workflow

Follow [cross-repo-workflow.md](cross-repo-workflow.md). Shape:
1. **quorum-shared PR**: add `messagePreprocessing.ts` + tests, re-export from root,
   bump version. Additive — no breaking change.
2. **quorum-desktop PR**: swap `MessageMarkdownRenderer.tsx`'s inlined functions to
   shared imports; verify the renderer still produces identical output (mentions,
   spoilers, code, URLs, headers). tsc + lint clean.
3. **quorum-mobile**: consumer leg — tracked in the mobile task
   ([`2026-06-18-adopt-shared-message-preprocessing.md`](file:///D:/GitHub/Quilibrium/quorum-mobile/.agents/tasks/quorum-shared-migration/2026-06-18-adopt-shared-message-preprocessing.md)).
   Add the `mobile-tasks-pending.md` signpost is NOT needed (it's a signpost now, per
   the port-to-mobile README) — the mobile task file is the live status home.

## Verification

- [ ] quorum-shared: `messagePreprocessing` + tests exported from root; `yarn build` +
      `vitest` clean.
- [ ] quorum-desktop: `MessageMarkdownRenderer.tsx` imports from shared; tsc + lint
      clean; renderer output unchanged (visual smoke: a message with @mention, @role,
      #channel, `**bold**`, fenced code, `||spoiler||`, a bare URL).
- [ ] quorum-desktop: role/channel filtering behavior matches the option chosen in the
      "Design decision required" section — specifically verify a `@roleTag` NOT in
      `message.mentions.roleIds` renders the same as before (plain under option A;
      now-styled under option B, which must be intentional).
- [ ] quorum-desktop: pipeline step order preserved (`processMessageLinks` before
      `processURLs`); a message link is NOT double-processed into a plain URL.
- [ ] No regression on desktop (mentions/spoilers/code/URLs/headers all still render).
- [ ] Mobile consumer leg opened/linked.

---

*Last updated: 2026-06-18 — mobile-originated promotion. Driver leg (author shared
module + tests, refactor desktop). Consumer leg is the mobile task. Added explicit
role/channel-filtering design decision (option A preserves desktop's
`message.mentions.roleIds` filter via an optional id param; option B adopts mobile's
filterless behavior), the orchestrator-vs-individual-functions constraint for desktop,
and matching verification items.*
