---
type: task
title: "QNS username overrides display name everywhere (Model B) + mentions"
status: ready
created: 2026-06-11
branch: feat/qns-username-overrides-display-name
supersedes-progress-in: 2026-06-10-qns-username-display-plan.md (the "Model A vs B" block)
related-design: 2026-06-10-qns-username-display-design.md
---

# QNS username overrides display name everywhere + mentions by QNS name

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Work phase-by-phase; typecheck after each phase. The audit in §3 is the authoritative surface checklist — every box there must end checked or explicitly deferred with a note.

## 1. What unblocked this and what this branch does

**Unblock (2026-06-11):** Lead dev Cassie confirmed ("Agree") the resolution model. A user's elected QNS `primary_username` (rendered `name.q`) **overrides their typed display name everywhere**, except in a space where they've set a per-space custom name (the override still wins locally). This is "Model B" from the prior plan — the original design's rule all along. Stages 1+2+3 already shipped as **Model A** in PR #190 (merged to `main`): display name stayed primary, `.q` shown only as a secondary handle on the profile card.

**This branch (`feat/qns-username-overrides-display-name`) does two things:**
1. **Override conversion (Model A → Model B):** route every user-name render site through the shared `resolveDisplayName` rule so the QNS name becomes the primary name wherever a person is identified. Scope decided 2026-06-11: **all surfaces** (full audit in §3), not just the original ~5.
2. **Stage 4 — mentions by QNS name:** the mention autocomplete shows + matches space members by their QNS name; the mention pill renders `name.q`. Wire/storage format stays `@<address>` (unchanged).

**Privacy decision (settled 2026-06-11, to be raised with Cassie as confirmation, not a blocker):** `primary_username` is published in the **public profile only**, never in the message broadcast. Rationale is *consistency*, not reachability: the QNS resolver (`GET /resolve/:name`) already makes `@name → address` globally public, so a broadcast couldn't gate reachability anyway. Public-profile-only means the QNS label follows the same public/private opt-in as the rest of profile metadata (display name, avatar, bio). Putting it in the broadcast would surface a private-profile user's QNS identity to everyone they DM, contradicting the private signal. **No code in this branch depends on that call** — the read path is already public-profile-sourced (`useMembersWithPublicProfileFallback`, `recipientPublicProfile`). See [[project_qns_username_broadcast_pending]].

## 2. The one architecture decision: a desktop adapter, not direct helper calls

The shared helper:
```ts
resolveDisplayName(member: { display_name?, name?, primary_username?, address }, { spaceOverrideName? })
  → { name: string, isQnsVerified: boolean }
// precedence: spaceOverrideName → primary_username → display_name → name → truncate(address)
```

**Impedance mismatch with desktop data** (verified, this is why we adapt instead of calling directly):
- Shared uses **snake_case** (`display_name`, `primary_username`). Desktop member objects use **camelCase** (`displayName`, `primaryUsername`).
- Shared's model splits "global `display_name`" from "`spaceOverrideName`". **Desktop has no such split**: `useChannelData.ts:72` sets `displayName: curr.display_name` where `curr.display_name` is *already the per-space override* (from the member roster broadcast). In DMs, `displayName` is just the name. So on desktop, **`displayName` already means "the name that applies in this context"** — there is no separate global field to pass as `display_name` while passing the override separately.

**Decision: one thin desktop adapter** that maps desktop conventions onto the helper, so the precedence rule lives in exactly one place (the shared helper) and the camelCase/override-semantics bridge lives in exactly one place (the adapter). Every render site calls the adapter, never the helper directly, never re-implements precedence.

```ts
// src/utils/resolveMemberName.ts  (NEW)
import { resolveDisplayName as resolveShared } from '@quilibrium/quorum-shared';
import { getAddressSuffix } from '../utils';

export interface ResolvedMemberName {
  name: string;          // the readable name; never empty
  isQnsVerified: boolean; // true → render with the ".q" accent suffix
}

/**
 * Desktop adapter over shared resolveDisplayName. Desktop member objects carry
 * the *contextual* name in `displayName` (in a space that's already the
 * per-space override; in a DM it's just the name) and the QNS name in
 * `primaryUsername`. We want: QNS name wins UNLESS a per-space override is set.
 *
 * Because desktop's `displayName` already folds the override in, we can't blindly
 * feed it as the shared "display_name" (that would let it lose to the QNS name
 * even when it IS an override). Callers that KNOW a value is a genuine per-space
 * override pass it as `spaceOverrideName`; everyone else passes the member and
 * we treat `displayName` as the global fallback (QNS wins over it — the desired
 * Model B behavior).
 */
export function resolveMemberName(
  member: { displayName?: string | null; primaryUsername?: string | null; address: string },
  opts: { spaceOverrideName?: string | null } = {}
): ResolvedMemberName {
  const r = resolveShared(
    {
      address: member.address,
      display_name: member.displayName ?? undefined,
      primary_username: member.primaryUsername ?? undefined,
    },
    { spaceOverrideName: opts.spaceOverrideName }
  );
  // Desktop's truncation differs from shared's "Qm…1234"; keep desktop's so the
  // address-only fallback looks identical to every other desktop surface.
  if (!member.primaryUsername && !member.displayName && !opts.spaceOverrideName) {
    return { name: getAddressSuffix(member.address), isQnsVerified: false };
  }
  return { name: r.name, isQnsVerified: r.isQnsVerified };
}
```

> **Per-space override note — REVISED 2026-06-11 (second pass; supersedes the first CONFIRMED note):**
> First finding (still true): the roster's `displayName` (`useChannelData.ts:72` ← `messageDB.getSpaceMembers`) is a SINGLE field holding either a deliberate per-space name **or** the member's global name — it's seeded from the global name at join (`InvitationService.ts:756`) and overwritten by `update-profile` (`MessageService.ts:1298`), with **no marker of origin** (verified down to the shared `SpaceMember` type: no flag exists).
>
> First implementation treated every roster name as an override (`spaceOverrideName`). **Live testing exposed that as wrong for the common case:** since everyone's roster name defaults to their global name, the QNS name never won, so `.q` never showed in spaces at all.
>
> **Final rule (implemented): comparison-based custom-name detection in `resolveSpaceMemberName`.** The member's GLOBAL display name (`globalDisplayName`) comes from the same public-profile fetch that is the only source of `primaryUsername` — so it's available at zero extra cost wherever a QNS name is known:
> ```
> roster name ≠ global name  → deliberately typed for this space → wins, no .q
> roster name = global name  → just the global default            → QNS wins, .q shows
> global name unknown        → conservatively respect the roster name
> ```
> Plumbing change this required: `useMembersWithPublicProfileFallback` now fetches the public profile for **every visible sender** (not only name-less ones) — bounded to visible senders, never the roster; 1h cache shared with the profile-card key. Edge cases (accepted, documented): custom name identical to global reads as not-custom; a stale cached profile after a global rename briefly hides `.q`. Both degrade to a correct name without `.q`, never a wrong name.
>
> Full feature doc: `.agents/docs/features/qns-username-display.md`. Pending lead-dev asks (non-blocking): batch profile endpoint; explicit is-custom-name flag on `update-profile` (would replace the comparison).

**`.q` render helper.** The suffix + accent styling repeats across ~25 sites. Add a tiny presentational component so it's consistent and not copy-pasted:
```tsx
// src/components/user/ResolvedName.tsx  (NEW) — or a render fn if a component is too heavy per-site
// Renders `name` and, when isQnsVerified, the ".q" accent suffix.
// Use inline where a component fits; for string-only contexts (placeholders,
// aria-labels, tooltips) use a `formatResolvedName(r)` that returns `name` +
// (isQnsVerified ? '.q' : '') as a plain string.
```
Provide BOTH: a `<ResolvedName>` component for JSX sites and a `formatResolvedName(r): string` for string-only sites (placeholders, aria-labels, tooltip content, search match text).

**Naming-collision caution:** `ThreadListItem.tsx` / `ThreadsListPanel.tsx` already use a LOCAL prop named `resolveDisplayName` (a `(senderId)=>string`). Do NOT import the shared symbol into those files under the same name — either leave their prop as-is (it'll be fed by the adapter upstream) or alias on import. The shared `resolveDisplayName` is currently imported nowhere.

## 3. AUDIT — every name-render surface (authoritative checklist)

Verified 2026-06-11 against `main` post-PR-#190. **Tier 1** = `primaryUsername` already in scope (one-line-ish swap). **Tier 2** = needs plumbing (prop/type/fetcher) first. Per-space override is NOT separately distinguishable at any render site except the editing form — see §2 note; treat `displayName` as the contextual fallback.

### Tier 1 — primaryUsername already in scope — ✅ ALL DONE 2026-06-11

> Note on avatars: `UserAvatar displayName=` props were deliberately left on the raw `displayName` (used only for initials/alt-text); converting them would change the initial letter to the QNS name's. Name *text* sites are all converted.

- [x] **Message sender name (desktop)** — `src/components/message/Message.tsx:759` — `{sender.displayName}` — `sender` from `effectiveMembers` (has `primaryUsername`)
- [ ] **Message sender name (mobile layout)** — `Message.tsx:853` — `{sender.displayName}`
- [ ] **Reply preview sender** — `Message.tsx:562` — `{mapSenderToUser(reply.content.senderId).displayName}`
- [ ] **System event message** — `Message.tsx:589` — `{formatEventMessage(sender.displayName, …)}` (low value; include for consistency)
- [ ] **Pin tooltip (desktop+mobile)** — `Message.tsx:767,861` — `mapSenderToUser(pinnedBy)?.displayName` (string context → `formatResolvedName`)
- [ ] **DM header name (3 breakpoints)** — `src/components/direct/DirectMessage.tsx:785,906,925` — `otherUser.displayName ?? otherUser.address` — `otherUser.primaryUsername` present (set lines 331-334)
- [ ] **DM header avatar displayName props** — `DirectMessage.tsx:778,898-899` — pass resolved name (avatar uses it for initials/alt)
- [ ] **DM composer placeholder** — `DirectMessage.tsx:1044-1046` — `user: otherUser.displayName ?? otherUser.address` (string → `formatResolvedName`)
- [ ] **DM typing indicator resolveName** — `DirectMessage.tsx:1036` — `otherUser.displayName`
- [ ] **Notifications sender** — `src/components/notifications/NotificationPanel.tsx:279,302` → `NotificationItem.tsx:143` — `sender?.displayName` — `sender` from enriched `mapSenderToUser`
- [ ] **Reaction tooltip** — `src/components/message/ReactionsList.tsx:100` — `mapSenderToUser(id)?.displayName` (string → `formatResolvedName`)
- [ ] **Pinned messages panel sender** — `src/components/message/PinnedMessagesPanel.tsx:75` — `sender?.displayName`
- [ ] **Reply banner (composer)** — `src/components/message/MessageComposer.tsx:720` (+ `.native.tsx:315`) — `mapSenderToUser(...).displayName`
- [ ] **Mention pill in message body** — `src/components/message/MessageMarkdownRenderer.tsx:657,668` — `resolvedUser?.displayName || truncateAddress(...)` → render `@name.q` when verified
- [ ] **Thread "Started by" (panel)** — `src/components/thread/ThreadPanel.tsx:176,179,304` — `starterUser?.displayName` — `primaryUsername` dropped when building `starterUser` (line 176); carry it through then resolve
- [ ] **Thread list "Started by"** — `ThreadsListPanel.tsx:49-50` (the local `resolveDisplayName` prop) → feed adapter-resolved name; `ThreadListItem.tsx:34` consumes it
- [ ] **Typing indicator (channel/thread)** — `TypingIndicator.tsx` via `Channel.tsx:1674` & `ThreadPanel.tsx:416` — `mapSenderToUser(addr).displayName`
- [ ] **UserProfile card (already Model A)** — `src/components/user/UserProfile.tsx:222-231` — **convert**: make resolved name the primary line (currently `props.user.displayName` at 222 + secondary `.q` at 224-231). Model B = primary line shows `name.q` when verified.

### Tier 2 — needs plumbing first — ✅ DONE (except search + bookmarks, deferred & logged)

- [x] **Space member sidebar (desktop+mobile)** — DONE via **cheap merge** (decided 2026-06-11): the sidebar `itemContent` resolves via `resolveSpaceMemberName` pulling `primaryUsername` from the already-enriched `effectiveMembers` (zero new fetches). Members who've sent a visible message show `.q`; silent lurkers light up on next post or when their profile opens (UserProfile does an on-demand fetch). Full-roster enrichment with virtualized visible-range tracking is a deliberate follow-up — the right place to spend perf effort, best done once `.q` is live. **Space member sidebar (desktop+mobile)** — `src/components/space/Channel.tsx:1793,2022` — `item.displayName ?? item.address` — `item` from RAW `members` map (no `primaryUsername`; `useMembersWithPublicProfileFallback` is applied to `effectiveMembers`/senders only, deliberately for perf). **Plumb:** either (a) apply the fallback enrichment to visible roster items too, or (b) on-demand fetch like `UserProfile` does. Prefer (a) scoped to currently-visible/virtualized rows to avoid a roster-wide fetch storm — match the existing perf guard in `useMembersWithPublicProfileFallback`.
- [ ] **DM profile sidebar** — `src/components/direct/DMUserProfileSidebar.tsx:15-22,78,83` — prop type strips `primaryUsername`; parent `otherUser` HAS it. **Plumb:** widen prop interface to include `primaryUsername?`, pass it from `DirectMessage.tsx:1076,1091`, resolve.
- [ ] **DM conversation list (strip + full)** — `src/components/direct/DirectMessageContactsList.tsx:344,353,358,375,487,508` + `DirectMessageContact.tsx:83,114` — `c.displayName`/`props.displayName` — `Conversation` DB row + `useConversationsWithProfileBackfill` carry no `primaryUsername`. **Plumb:** add `primary_username` to the backfill hook (it already fetches public profiles), thread `primaryUsername` through the contact prop.
- [ ] **Mention autocomplete dropdown** — `src/components/message/MentionDropdown.tsx:190,197` — `option.data.displayName` — `users` from raw `members` (no `primaryUsername`). **Plumb (also Stage 4):** carry `primaryUsername` into the candidate objects + match against it. See Phase 5.
- [ ] **Reactions modal list** — `src/components/modals/ReactionsModal.tsx:46,127,131` — `user.displayName` — prop `members` type strips it. **Plumb:** widen the modal's member type; source already has it via `mapSenderToUser`.
- [~] **Search results (space + DM)** — `src/components/search/SearchResultItem.tsx:144` via `useBatchSearchResultsDisplay.ts:147,170` — **DEFERRED 2026-06-11 (logged).** `userInfo` comes from `buildUserInfoFetcher` → `messageDB.getUser` → a `channel.UserProfile` from the local user store, which does NOT carry `primary_username` (that lives on the public-profile endpoint, a different source). Wiring a public-profile fetch into the batch search hop is materially more work and a new data source; search is low-traffic and `.q` is dormant. Deferred to a follow-up rather than balloon this branch. Search keeps showing `display_name` (unchanged).
- [~] **Bookmarks card** — `src/components/bookmarks/BookmarkCard.tsx:48` — **DEFERRED 2026-06-11 (logged).** `cachedPreview.senderName` is a FROZEN snapshot; the card deliberately synthesizes its own one-entry `mapSenderToUser` (bookmarks span all spaces/DMs, no live member list). Recomputing the QNS name needs a per-card public-profile fetch — lowest-value, highest-incremental-cost surface, and `.q` is dormant. Card keeps the snapshot name (correct as-of bookmark time). Follow-up.

### Out of scope (record, don't convert)
- **NavRail own name** — `src/components/shell/NavRail.tsx:264` — current user's own name from `currentPasskeyInfo`; no QNS-name-for-self plumbing exists. Leave; note as a possible follow-up (showing your OWN `.q` in the nav).
- **Mute/Kick modals** — pass a `userName` filled by the click context; they inherit whatever the caller resolved. No independent change needed if callers pass resolved names.
- **SpaceSettingsModal/Account `value={displayName}`** — editing form for your own per-space name; not a "display another user" surface. (Dot-`.q` validation already wired in Stage 3.)

## 4. Phases

### Phase 0 — adapter + render helper (foundation) ✅ DONE 2026-06-11
- [x] Created `src/utils/resolveMemberName.ts` — exports `resolveMemberName` (DM/global), `resolveSpaceMemberName` (space-context, override-aware), `formatResolvedName` (string sites). Standalone module (no barrel; imported by path). Address fallback returns the shared helper's `Qm…1234` truncation.
- [x] Created `src/components/user/ResolvedName.tsx` (`<ResolvedName resolved className suffixClassName />`), `.q` in `text-accent`.
- [x] Unit test `src/dev/tests/utils/resolveMemberName.unit.test.ts` — **10 tests pass** (incl. the critical "per-space name wins over QNS name" case for `resolveSpaceMemberName`).
- [x] **Confirmation task — RESOLVED:** roster `displayName` (from `useSpaceMembers` → `messageDB.getSpaceMembers`) IS the per-space broadcast name = a genuine per-space override. So space-context surfaces MUST use `resolveSpaceMemberName` (passes `displayName` as `spaceOverrideName`), NOT `resolveMemberName`. See the §2 CONFIRMED note. This split is encoded in the two adapter functions.
- [x] `tsc --noEmit` clean (no new errors; pre-existing `ImportKeyStep` inherited from main).

### Phase 1 — Tier 1 conversions
- [ ] Convert every Tier 1 box in §3. For each: resolve via `resolveMemberName` (or `formatResolvedName` for string sites), render the `.q` suffix when `isQnsVerified`.
- [ ] `UserProfile.tsx`: make the **resolved name the primary line**; drop or fold the now-redundant secondary `.q` handle (Model B = the primary line IS `name.q`).
- [ ] Watch the thread-component naming collision (§2).
- [ ] tsc + `yarn lint` clean.

### Phase 2 — Tier 2 plumbing
- [ ] Do each Tier 2 box in §3, smallest-blast-radius first: DM sidebar prop → reactions modal type → conversation-list backfill → member sidebar enrichment → search fetcher → bookmarks recompute.
- [ ] Each plumbing addition is **additive + optional** (`primaryUsername?`) — no required-field changes.
- [ ] tsc + lint clean after each sub-step.

### Phase 3 — Stage 4 mentions
- [ ] **Candidate source carries `primaryUsername`:** `Channel.tsx` builds the `users` array fed to the mention input from the raw `members` map. Ensure `primaryUsername` rides along (additive).
- [ ] **Autocomplete match:** in the mention hook/filter, match the typed query against `primaryUsername` too (so `@ali` matches `alice`), in addition to existing `displayName`/`address`. Candidate label = `formatResolvedName(resolveMemberName(user))`.
- [ ] **Pill render:** `src/utils/mentionPillDom.ts` — the pill's display name comes from `option.data.displayName`; pass the adapter-resolved name and render `.q` when verified. `dataset.mentionAddress` stays the address (unchanged storage).
- [ ] Verify stored content is still `@<address>` (the mention regex still matches).
- [ ] tsc + lint clean.

### Phase 4 — verification gate ✅ DONE 2026-06-11 (manual smoke pending — see note)
- [x] No shared changes this branch (desktop-only), so shared build/test untouched — N/A confirmed.
- [x] `tsc --noEmit --jsx react-jsx --skipLibCheck` → clean (only pre-existing `ImportKeyStep` error).
- [x] `yarn build` → **succeeds** (`✓ built in 27s`, only usual chunk-size warnings).
- [x] Lint: the 5 `yarn lint` errors are all in the stale `.worktrees/secondary/` copy, NOT this work. Linting the 22 changed files directly → **0 errors, 20 warnings, all pre-existing** (legacy unused-vars/exhaustive-deps).
- [x] Unit tests: `resolveMemberName.unit.test.ts` → **10/10 pass** (incl. per-space-override-wins-over-QNS).
- [x] **Mobile insulation:** `quorum-mobile/package.json` pins `2.1.0-26` (published, not `link:`); this branch made **zero `quorum-shared` changes**, so mobile is trivially unaffected.
- [ ] **Manual smoke — PENDING (requires running app + temp injection).** Live `.q` is dormant (no real user publishes `primary_username` yet — two mobile bugs). To verify: temp-inject a `primaryUsername` on one member, confirm it renders as the PRIMARY name with `.q` accent across message authors, DM header, profile card, member sidebar, mention autocomplete + pill; confirm a per-space-named member keeps their space name (override wins); confirm a member with only `displayName` is unchanged; then revert the injection. Left for the user to run via the app.
- [x] §3 checkboxes updated; search + bookmarks deferrals logged.
- [x] Prior plan PROGRESS block updated (Model B confirmed by Cassie 2026-06-11) — see below.

## 5. Risks / watch-items
- **The member sidebar fetch-storm** (Tier 2): the raw roster is raw deliberately. Don't naively enrich the whole roster — scope to visible rows or on-demand, matching `useMembersWithPublicProfileFallback`'s perf guard. This is the single highest-risk edit.
- **`.q` dormant in real data:** can't fully verify live until mobile publishes `primary_username` (two mobile bugs, filed 2026-06-10). The render is correct; it lights up later. Don't treat "I can't see it live" as "it's broken."
- **String vs JSX sites:** placeholders/aria-labels/tooltips need `formatResolvedName` (plain string), not the `<ResolvedName>` component. Don't render a component into a string slot.
- **Avatar initials:** `UserAvatar` uses `displayName` for fallback initials/alt — feeding it the resolved name changes the initial letter to the QNS name's. Acceptable (consistent with showing the QNS name), but note it.

---

## Implementation status (2026-06-11)

**Implemented & verified on branch `feat/qns-username-overrides-display-name`** (24 files: 4 new, 20 modified; +433/-99). tsc clean, build green, 10/10 unit tests, lint clean (the 5 `yarn lint` errors live in the stale `.worktrees/secondary/` copy, not this work). Mobile untouched (zero shared changes).

- **Phase 0** — `resolveMemberName` / `resolveSpaceMemberName` / `formatResolvedName` adapter + `<ResolvedName>` component + unit tests. Confirmed roster `displayName` = per-space override → space surfaces use `resolveSpaceMemberName` (override wins over QNS), DM/global use `resolveMemberName` (QNS wins).
- **Phase 1 (Tier 1)** — UserProfile Model A→B (resolved name is now the primary line); message authors (desktop/mobile/reply/event/pin); DM header + placeholder + typing; notifications; reactions tooltip; pinned panel; composer reply banner; mention pills in message body; thread "Started by" + list; channel/thread typing indicators.
- **Phase 2 (Tier 2)** — DM profile sidebar (widened prop); reactions modal (widened MemberInfo); DM conversation list + strip (backfill hook now returns `ConversationWithQns`, previews hook made generic, fetches all DM partners — small N); member sidebar (cheap merge from `effectiveMembers`, no fetch storm). **Search results + bookmarks DEFERRED** (logged above — different data source / per-card fetch, low value, `.q` dormant).
- **Phase 3 (Stage 4 mentions)** — autocomplete matches `primaryUsername`; candidate label + pill render `name.q`; wire format stays `@<address>`.

**Remaining:** manual smoke in the running app with a temp-injected `primaryUsername` (live `.q` dormant until mobile publishes the field). Then open the PR (do NOT auto-merge).

*Last updated: 2026-06-11*
