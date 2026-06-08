---
type: log
title: Port-from-mobile shipped log
status: living
created: 2026-06-01
updated: 2026-06-08
---

# Port-from-mobile shipped log

Chronological history of features ported from `quorum-mobile` to `quorum-desktop`, with lessons learned at the top.

## Top-level lessons

- **Symbol-grep is not capability-verification.** The same capability can exist on both apps under different names and different architectures. Two candidates were knocked off in one session this way: #2 Message search (different impl, same UX — desktop uses `<GlobalSearch>` embedded in DM/Channel headers) and #3 Reply tracking (mobile MMKV counter vs desktop's `useReplyNotificationCounts` derived from `MessageDB`). The workflow now requires stating the capability in plain terms and grepping desktop for the *concept*, not the mobile symbol.
- **Port the capability, not the mobile UX pattern.** Mobile UX choices reflect mobile chrome and constraints. Desktop has different chrome and a different UX model (Discord-style spaces + DMs split, not Telegram-style unified list). A feature being shipped on mobile means the *capability* is real; whether the *UX pattern* fits desktop is a separate judgment. Default to desktop's UX language; ask the user when in doubt.
- **The effort is a two-way diff, not a one-way port.** When desktop's implementation is better than mobile's, log it in [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md) as a future port-to-mobile candidate for the lead dev. We don't act on those directly (mobile is read-only), but recording them gives the lead a curated convergence list.
- **Verify backend assumptions before scoping UI.** #6 was originally framed as "Public profile UI" — implying a directory/browse surface. Investigation against the mobile API client (the source of truth for what the server exposes) showed the server has NO user-enumeration endpoint at all. Neither app can ship a directory without backend work. The same investigation revealed mobile's `NewConversationModal` accepts `@username` via QNS that desktop's `NewDirectMessageModal` doesn't — that's a separable mini-candidate logged under `#12`. The lesson: when a candidate's framing implies a surface (directory, search, browse), check the backend client surface FIRST, not the mobile UI; a single grep against the API client can rule out an entire feature.
- **Rebase, don't merge — and read what landed on main.** During #6's shipping, three commits landed on `main` mid-session, including PR #180 (`fix(action-queue): roll back optimistic state and surface error toasts on enqueue failure`) which changed the save-config enqueue from blocking-`await` to fire-and-forget with rollback. Rebasing surfaced this in a clean conflict block. The fire-and-forget rollback introduced a new consistency hole specific to our port (publish-then-rollback could leave server-published but local-off); a code-review pass before shipping caught it and we added a best-effort revert in the same `.catch` path. Lesson: when shipping over a base that's moving, rebase + read the new commits + re-run code review.
- **"Non-owner can X" needs three checks, not one.** New rule from #29's three-round framing back-and-forth. When a candidate's framing implies "non-owners can do X", verify all three before scoping: (a) **service-layer gate** — grep the service for owner-key checks or role gates (`Only space owners can…`, `requires owner`, key-existence checks like mobile's `getSpaceKey(spaceId, 'owner')`); (b) **manifest-replication** — check whether the field the UI shows is part of the synced/encrypted manifest, in which case non-owners hold the *data* an owner published, not the ability to *do* the thing; (c) **UI is "do" or "view"** — distinguish "this control generates" from "this control reads a synced field". Mobile's InviteModal looks like a generator to a non-owner but is actually a viewer of the owner-published `space.inviteUrl`. A single grep on the service file would have shortcut to the right framing.

## 2026-06-08 — re-audit (no ports shipped; three new candidates added)

Session: `session-2026-06-08-2` in the primary clone.

Pulled all three repos and surveyed mobile's commit delta since the previous baseline:
- `quorum-mobile`: `0fa63d4` (2026-05-30) → `ccd69e6` (2026-06-02). One large content commit (`56ffd31 2026-06-01 "latest update"`) brought in ~12k inserts including three new mainline feature clusters.
- `quorum-shared`: `9d1c08f` (2026-05-30) → `1115a25` (2026-06-05). Type/icon-only additive PRs (`DirectoryEntry`, `UserConfig.hideMutedSpacesFromSidebar`, `Bookmark.cachedPreview` optionals, `IconWallet`). Already consumed during #1 ship.
- `quorum-desktop`: no main movement relevant to the audit.

Added three new candidates to [candidates.md](candidates.md):

- **#27 Skins (custom themes)** ❔ — full skin engine + server gallery + local editor. Desktop's `Appearance.tsx` (96 LOC) only does theme/accent/language; mobile ships ~2000+ LOC across `components/skins/`, `services/skins/`, `services/theme/`, `theme/skins/`, `components/ui/{AppBackground,SkinTouchable}`. Pure-logic shared-promotion candidates if picked up: `validate.ts` (488 LOC, security-critical), `types.ts`, `mergeSkin.ts`. Bundles a third call site for the Ed448 signing-payload helpers deferred from #6.
- **#28 On-device translation** ❔ — native iOS Translation + Android ML Kit module, with `services/translation/*` and `components/translation/*`. Desktop has no equivalent and Electron has no easy bridge to these engines. Realistic paths: cloud (privacy regression vs mobile's on-device guarantee), WASM (size cost), or skip. Re-implementation rather than a port.
- **#29 Non-owner read-only access to the existing public invite URL** 🟢 — smallest port in the queue. Walked through three framings before landing at the right model (recorded in [`### #29` notes](candidates.md#29-non-owner-read-only-access-to-the-existing-public-invite-url--ready-to-pick) and the top-level lessons block). Real shape: `space.inviteUrl` (in shared) gets replicated to every member via the encrypted space manifest when the owner generates a public invite. Desktop's only `inviteUrl` consumer is the owner-only `SpaceSettings > Invites` tab. The port = a lightweight read-only modal exposing the URL + copy + share to all members; no generate/regenerate controls for non-owners.

Folded Farcaster-cluster additions in the same mobile delta under existing `❔ needs UX call` rows rather than promoting them to top-level candidates:
- `useBlockedFids`, `useFollowingFids`, `useMutedFids`, `useUserVisibilityActions`, `services/farcaster/socialGraph.ts`, `services/farcaster/feedPrefs.ts` → under #9 Farcaster.
- `services/spaces/farcasterSpaceSocket.ts` → under #15 Audio spaces.
- `components/SocialFeed/views/HegemonyGovernanceView.tsx`, `ProposalVoteBlock.tsx`, `useHegemonyGovernance.ts`, `services/governance/governanceClient.ts` → under #9 + #17 Governance.
- `components/SocialFeed/media/VideoViewer.tsx`, `CastOverflowButton.tsx`, `ProfileOverflowButton.tsx`, `ProfileActionButtons.tsx` → under #9.

Channel-management hooks (`hooks/chat/useChannelManagement.ts` on mobile) confirmed already on desktop as the full `src/hooks/business/channels/*` tree — Class E, not a candidate.

No ports shipped this session. #29 is queued for the next session.

## 2026-06-08 — #6 Public profile UI shipped (+ retired speculative `/discover/people`)

- **Branch**: `feat/port-public-profile-from-mobile`.
- **Task file**: [`.done/2026-06-08-port-public-profile.md`](.done/2026-06-08-port-public-profile.md) (moved to `.done/` as part of the merge).
- **PR**: [#181](https://github.com/QuilibriumNetwork/quorum-desktop/pull/181) (merged 2026-06-08).
- **Repos touched**: `quorum-desktop` only. `quorum-shared` was untouched (everything needed already exported, including `int64ToBytes`, `UserConfig.isProfilePublic`, `UserConfig.bio`). `quorum-mobile` is read-only context for this effort.

### What shipped

| Layer | What |
|---|---|
| API client | New URL helper (`getPublicProfileUrl`) + 3 methods on `QuorumApiClient` (`getPublicProfile`, `postPublicProfile`, `deletePublicProfile`) + 3 wire-type interfaces in `baseTypes.ts`. |
| Service | `src/services/PublicProfileService.ts` — signs the canonical payload with `ch.js_sign_ed448`, posts/deletes against the server. Byte-for-byte compatible with mobile's signing (verified during code review). |
| Privacy UI | "Public profile" Switch in the Privacy/Security settings tab, placed right before the disabled "Show Online Status" row to form a coherent visibility cluster. Turning ON triggers a destructive-style confirmation modal (matches mobile's "Make profile public?" alert); turning OFF unpublishes silently. |
| State plumbing | `useUserSettings` exposes `isProfilePublic` / `setIsProfilePublic`, initializes from `config?.isProfilePublic`, includes it in the `save-user-config` action queue payload, and calls publish/unpublish via the service. The publish call now runs BEFORE the fire-and-forget enqueue (with a best-effort revert in the `.catch` if the local save fails — see the lesson above). |
| DM header backfill | `useUserPublicProfile` hook + a fallback chain in `DirectMessage.tsx`'s `members` useMemo. The recipient's name and avatar appear in the DM chat header before they send any message, when they've opted in. |
| Space message backfill | `useMembersWithPublicProfileFallback` hook (with the manual ref-cache perf pattern verbatim-ported from mobile) + wiring in `Channel.tsx`. Senders whose local `SpaceMember` record is empty or stale get backfilled from their public profile in the message list. The member-list sidebar and role logic intentionally don't use the backfilled map (would mean fetching profiles for every space member). |
| Subtractive | Deleted `PeopleTab.tsx/.scss`, `DiscoverSidebar.tsx/.scss`. Simplified `DiscoverPage` to render only the spaces directory. Router redirects `/discover/people` → `/discover/spaces` for stale bookmarks. NavRail entry renamed "Discover" → "Public spaces". |
| Drive-bys | (1) Fixed two latent bugs in `ConfirmationModal.tsx` — the title was hidden inside `.modal-complex-wrapper`-hosted modals because the un-hide CSS rule required a className the component didn't always set, and `variant: 'warning' \| 'info'` rendered unstyled confirm buttons because `Button` only knows `'danger'` as a destructive type. (2) Updated stale `db/messages.ts` comment claiming `bio` was local-only — it's been syncing via UserConfig for months. |

### What changed scope during shipping

- **Public profile directory** — original framing implied one; backend has no enumeration endpoint, so it isn't shippable without server work. People tab was speculative scaffolding from a prior session built on this same assumption. Retired in the same PR.
- **QNS `@username` resolution in `NewDirectMessageModal`** — mobile has it via the QNS client; desktop doesn't have QNS at all. Pulling in QNS would mean a 1,235 LOC client + 451 LOC of hooks + a new base URL — candidate #12 territory, not a small extract. Logged as a mini-candidate under #12.
- **Bio sync** — initial assumption was that bio was local-only on desktop. Investigation showed it's been syncing via UserConfig (the `db/messages.ts` comment was stale). What this PR adds *for bio* is carrying it in the public-profile payload so non-members can see it.
- **Shared promotion of signing helpers** — `int64BE` / `concatBytes` / canonicalize-then-sign helpers are the same pattern Reporting (#5) would use. Deferred to a follow-up: extract once #5 is also picked up and we have two real call sites to lock in the API shape. Cross-pointer added to `quorum-shared-migration/README.md`.

### Lessons captured (also pulled into the top-level block above)

- **Verify backend assumptions before scoping UI.** Saved us from shipping a permanently-empty directory page.
- **Rebase, don't merge — and read what landed on main.** PR #180's fire-and-forget enqueue introduced a race that only surfaced because we walked the diff and re-ran code review on the rebased branch.

## 2026-06-01 — folder scaffolded + initial inventory + capability-verification pass

- Created `.agents/tasks/port-from-mobile/` with README, workflow, candidates, shipped-log, desktop-better-than-mobile.
- Pulled all three repos; confirmed mobile master at `0fa63d4` (2026-05-30), shared at `9d1c08f` (2026-05-30).
- Session branch: `session-2026-06-01`.
- Inventory pass identified 26 candidate features.
- Capability-verification rule introduced after two candidates (#2, #3) were initially ranked as "ready to pick" then knocked off when closer reading found desktop has them under different names.
- **Final status after this session:**
  - 🟢 **#1 Discover spaces** — user's first pick. Capability-verified missing on desktop (`JoinSpaceModal` + `AddSpaceModal` are invite-link-only). Next session: draft task file.
  - 🟢 **#6 Public profile UI** — capability-verified missing. Queued behind #1.
  - ⏸️ **#5 Reporting** — capability missing but deprioritized (user call: not a near-term product priority).
  - ❌ **#2 Message search** — desktop has it via `<GlobalSearch>` embedded in DM + Channel headers.
  - ❌ **#3 Reply tracking** — desktop has it under a different name (`useReplyNotificationCounts`), strictly better. Logged in `desktop-better-than-mobile.md` #1 as a future port-to-mobile candidate.
  - ❌ **#4 Last-message-preview / spaces sort** — UX-pattern conflict (Discord vs Telegram model).
  - ⚠️ **#8 OG metadata** — Farcaster-only on mobile; not a chat feature. Demoted.
  - ❔ Product-scope candidates (#9 Farcaster, #12 QNS, #13 Wallet, #14 Calling, #15 Audio spaces, #16 Miniapps, #17 Governance) — need product decisions before scoping.

---

*Last updated: 2026-06-08 — re-audit entry added (no ships). Three new candidates: #27 Skins, #28 On-device translation, #29 Non-owner read-only access to the existing public invite URL. New top-level lesson recorded: "non-owner can X" needs three checks (service-layer gate, manifest replication, UI is "do" or "view").*
