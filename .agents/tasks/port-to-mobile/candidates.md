---
type: inventory
title: "Port to Mobile — candidates (features + convergence)"
status: living
created: 2026-06-12
updated: 2026-07-15
---

# Port-to-mobile candidates

> The inverse of [port-from-mobile/candidates.md](../port-from-mobile/candidates.md). This is the running list of **desktop → mobile** work: things mobile should get from desktop, not yet turned into a task.

> **What we do NOT do here.** We do **not** push code to `quorum-mobile`. Mobile is read-only context for this effort (same rule as [port-from-mobile/workflow.md](../port-from-mobile/workflow.md)). This doc is a curated reference for the lead dev + future sessions. When a candidate becomes a concrete dropped task, write the task file in the **mobile** repo and track it there (mobile's `STATUS.md` / the file's frontmatter); [quorum-shared-migration/mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md) is just a signpost to those homes (see [Lifecycle](#lifecycle) below).

## The two kinds of candidate (the `Type` column)

This doc deliberately merges what used to be two separate files (the old `desktop-better-than-mobile.md` was folded in here on 2026-06-12). The distinction is now a **column, not a file**:

| Type | Meaning | Example |
|---|---|---|
| **feature-port** | Mobile lacks the capability entirely. A true port. | Desktop has X; mobile has nothing equivalent. |
| **convergence** | Both apps have the capability, but desktop's implementation is materially better (more correct, more maintainable, respects more settings). Mobile could converge architecturally. | Both have reply counts; desktop's is derived-from-store, mobile's is a drift-prone cache. |

The line between them matters for **cost**: a `feature-port` is net-new mobile code; a `convergence` often needs mobile to *replace* working infrastructure (storage layer, type system), so it usually carries a lead-dev architecture call.

## Lifecycle

```
candidate (here)  →  concrete task dropped on mobile  →  mobile PR  →  done
   feature-port /         (task file in the mobile repo,
   convergence            tracked in mobile's STATUS.md /
   observation            its own frontmatter)
```

A candidate lives here as an **observation**. The moment it becomes a concrete, scoped task, write the task file in the **mobile** repo (`quorum-mobile/.agents/tasks/…`) and track its status there (frontmatter + mobile's `STATUS.md`). The desktop [`mobile-tasks-pending.md`](../quorum-shared-migration/mobile-tasks-pending.md) is a signpost to those mobile-side homes — it's not a list you add the task to.

## Status board

Legend: 📋 noted / still open · 🚧 task dropped (scoped, not started) · ✅ shipped on mobile · 🆕 new mobile capability (not a port) · ⏸️ deprioritized · ❌ won't port

> **🟢 Freshness re-audit 2026-07-15 — big batch shipped since June.** Re-verified every open row against the current mobile working tree (branch `feat/grouped-message-inline-indicators`; pins `@quilibrium/quorum-shared@2.1.0-33`) + shared `master` (`2.1.0-34`). The board below is grouped by status; the two cross-repo nuances worth carrying forward: **(a)** mobile pins `2.1.0-33` but shared is `2.1.0-34`, so the expanded icon set (#53) and promoted preprocessing pipeline (#52) await a mobile bump; **(b)** per-space notif prefs land in synced config but the in-memory refresh helpers are dead exports (inbound cross-device change needs a remount). Full change list in the [footer note](#).

> **Audit pass 2026-06-12 (historical — version facts refreshed 2026-07-15).** Rows 3–25 came from a structured cross-repo audit of the 5 user-named features + a broad sweep. Method: reversed capability-verification (verify the concept on mobile, not a name-grep). The recurring finding held: most gaps were mobile wiring on top of shared logic that already existed, not new shared work — and the bulk of that wiring has since shipped (see the board above). **Current versions (2026-07-15): mobile pins `@quilibrium/quorum-shared@2.1.0-33`; shared source is `2.1.0-34`.** The old note here said `2.1.0-29`/`2.1.0-26` — stale, ignore. The uncertain `UserConfig` fields (`nonRepudiable`, `deliveryReceipts`, `readReceipts`, `typingIndicatorsDM`, `typingIndicatorsSpaces`, `generateYouTubePreviews`, `deviceNames`, `userNotes`, `spaceTagId`) were all verified present in shared source.

> **How to read this board (reworked 2026-07-15 for scannability).** One entry per candidate, two lines each: a **headline** (`#N · Name — STATUS`) and a **detail** line. Grouped by status so "what's left" is the top section to read. `[FP]` = feature-port (mobile lacks it), `[CV]` = convergence (both have it, desktop's better). Cost tag in the detail line. This board is the **index**; the full prose (desktop vs mobile source, shared involvement, file:line) lives further down.
>
> **Where each candidate's full detail lives** (the numbering is non-contiguous — use this map, don't assume a `## N` exists):
> | Candidate | Full detail location |
> |---|---|
> | #1, #2 | own `## 1.` / `## 2.` heading |
> | #3, #4, #5, #6, #7 | own `## N.` heading |
> | #8, #22, #23 | `## User mentions cluster` (+ the `## 🔴 Cross-cutting … wire-format` note) |
> | #9–#21, #24 | `## Sweep findings (rows 9–25) — condensed` (one bullet each) |
> | #19 (expanded) | `### 19. Mobile i18n / language switcher` (near end) |
> | #25 | `## 25. Space folders — detailed` |
> | #26a–c, #27 | `## 🔴 Permission enforcement bugs` + `## 27.` (both ✅ resolved — see banners) |
> | #28 | `## 28.` heading |
> | #29, #30 | `## 29 / 30. Message highlighting` |
> | #31, #32, #33 | `## Channel & group icons — detailed` |
> | #34, #35, #36 | own `## N.` heading |
> | #37, #38 | board entry only (new mobile capabilities — no prose entry yet) |
>
> **⚠️ Every `## N.` prose entry for a ✅-shipped candidate opens with a `> ✅ CURRENT STATE` banner. The prose *after* the banner is the PRE-SHIP analysis** (why desktop is better, what the fix had to cover) — do NOT read it as the current mobile state. The banner + this board are the source of truth for status.

#### 📋 Still open — the live backlog (nothing shipped yet)

- **#9 · DM delivery & read receipts** — 📋 ABSENT `[FP]` `HIGH`
  Shared 100% ready (`ReceiptService` + wire types + per-msg/-conv/-config fields in published dist); pure mobile wiring. Re-confirmed absent 2026-07-15. **Top unshipped DM item.**
- **#7 · Typing indicators** — 📋 ABSENT `[FP]` `MED`
  Shared `TypingService` + types + tests complete; desktop ships a `.native.tsx` null-stub. Lowest-friction MED. Pairs with #16.
- **#16 · Global typing toggles (DM / Spaces)** — 📋 ABSENT `[FP]` `SMALL`
  `typingIndicatorsDM`/`typingIndicatorsSpaces` already in shared. Pairs with #7.
- **#5 · YouTube facade in chat** — 📋 ABSENT `[FP]` `MED`
  Thumbnail-first click-to-load; utils already in shared (mobile dupes parsing in the Farcaster feed only). Pairs with #6.
- **#6 · "Generate YouTube previews" setting** — 📋 ABSENT `[FP]` `SMALL`
  Privacy gate for #5; `UserConfig.generateYouTubePreviews` already in shared.
- **#10 · "New messages" separator + jump-to-first-unread** — 📋 ABSENT `[FP]` `MED`
  UI/scroll only, no shared work. Pairs with #28.
- **#28 · Scroll-to-first-unread on channel/DM entry** — 📋 ABSENT `[CV]` `MED`
  Desktop jumps if ≥5 unread or ≥5min old; mobile always lands at bottom. Reads shared `lastReadTimestamp` (already present). Pairs with #10.
- **#11 · Space tags** (4-char badge by sender name) — 📋 ABSENT `[FP]` `MED`
  Never reads `sender.spaceTag`; types + `UserConfig.spaceTagId` already in shared.
- **#12 · User notes** (private per-user annotations) — 📋 ABSENT `[FP]` `MED`
  `UserConfig.userNotes`/`deletedUserNoteAddresses` already in shared (needs sync handling).
- **#3 · Threads in spaces** — 📋 ABSENT `[FP]` `HIGH`
  **Biggest single gap.** Types exist in shared; `StorageAdapter` needs thread queries (additive); `ThreadService`/`channelThreadHelpers` are promotion candidates. Worth its own planning pass.
- **#30 · Mention viewport highlight** (unread @-you auto-flash on entry) — 📋 ABSENT `[FP]` `MED`
  No `onViewableItemsChanged` trigger; needs `lastReadTimestamp` plumbed to the list. Highlight anim infra exists (from #29).
- **#14 · Device renaming** — 📋 ABSENT `[FP]` `MED`
  Device list shows generic labels, no rename; `UserConfig.deviceNames` already in shared.
- **#13 · Encrypted DM backup `.qmbak`** — 📋 ABSENT `[FP]` `LARGE`
  Needs `expo-file-system`/`expo-document-picker`; format could be promoted (additive).
- **#19 · In-app i18n / language switcher** — 📋 ABSENT `[FP]` `MED`
  Zero Lingui on mobile; detailed plan exists (see the #19 entry). App-level, no shared export.
- **#17 · Space Settings "Fixes" section** (auto-repair) — 📋 ABSENT `[FP]` `SMALL` (low value)
- **#18 · Emoji skin-tone preference** (Fitzpatrick modifier) — 📋 ABSENT `[FP]` `SMALL-MED` (low value)
- **#20 · "Restore Missing Spaces" recovery tool** — 📋 ABSENT `[FP]` `SMALL`
  Mobile's hub-log sync may reduce the need.
- **#29 · Message highlight on link/notification/bookmark jump** — 📋 **PARTIAL** `[CV]` `LOW-MED`
  Pinned + bookmark jump work (`scrollToMessageWithHighlight`, UI-thread Reanimated), but still blurple (not desktop yellow), ~1.5s fade, and **no notification-tap trigger**.

#### 🚧 Task-dropped, not started (scoped, waiting on build)

- **#25 · Space folders UI** — 🚧 NOT started `[CV]` `MED`
  Spaces tab still renders a flat list, ignores `items`/folders (re-verified 2026-07-15). UX locked = **Telegram-style pill bar** (Option A) via shared `SegmentedPills`; task in mobile `.agents/tasks/.todo/2026-06-17-space-folders-pill-bar.md`. (PR #108 "channel drag reorder" is channel-reorder, NOT folders.)

#### ✅ Shipped on mobile (verified 2026-07-15 against the current mobile branch)

- **#4 · Markdown rendering** — ✅ SHIPPED `[FP]` (PR [#112](https://github.com/QuilibriumNetwork/quorum-mobile/pull/112))
  Hand-rolled `MessageMarkdownRenderer.native.tsx` (no 3rd-party lib): bold/italic/strike, inline + fenced code (scroll+copy), spoilers, blockquote, lists, headings. **Only gap: tables.** Preprocessing promoted to shared (#52) but mobile runs a local copy until it bumps `2.1.0-33→34`.
- **#8 · @everyone / @role mentions** — ✅ SHIPPED `[FP]` (PR [#112](https://github.com/QuilibriumNetwork/quorum-mobile/pull/112))
  Compose autocomplete offers @everyone (permission-gated) + roles; send calls `extractMentionsFromText`; both renderers show pills; notify via `isMentionedWithSettings` per-type.
- **#22 · User mention autocomplete + pill render** — ✅ SHIPPED `[CV]` (PR [#112](https://github.com/QuilibriumNetwork/quorum-mobile/pull/112))
  Inserts canonical `@<address>`; autocomplete covers members+roles+@everyone (cap 8); regex parses `@<...>` + legacy bare. **Wire-format mismatch resolved.**
- **#15 · "Always sign DMs" (nonRepudiable) toggle** — ✅ SHIPPED `[FP]` (PR [#142](https://github.com/QuilibriumNetwork/quorum-mobile/pull/142))
  "Always sign" Switch in `DMSettingsSheet` persists per-conversation `isRepudiable`; send reads it, so the stale `nonRepudiable:true` config default no longer gates signing. Per-DM (not a global Privacy toggle).
- **#21 · Per-message signing toggle** — ✅ SHIPPED `[FP]` (PR [#142](https://github.com/QuilibriumNetwork/quorum-mobile/pull/142))
  Composer lock button when `signingOptional` (conversation `isRepudiable`); `skipSigning`/`onToggleSkipSigning` threaded through DM send.
- **#35 · DM conversation settings parity** — ✅ SHIPPED (except receipts) `[CV]` (PRs [#138](https://github.com/QuilibriumNetwork/quorum-mobile/pull/138)/[#142](https://github.com/QuilibriumNetwork/quorum-mobile/pull/142))
  `DMSettingsSheet` now renders+wires Mute, Always-sign, Save Edit History, plus Fix-Encryption + Delete. Only the delivery/read-receipt toggles remain — gated on #9.
- **#36 · Delete your own message in a DM** — ✅ SHIPPED `[FP]` (PR [#139](https://github.com/QuilibriumNetwork/quorum-mobile/pull/139))
  DM screen wires `onDelete`+`canDeleteMessage` (own-message gate); propagates `remove-message` to all devices; receive-side honors the authenticated sender, not the spoofable payload.
- **#1 · Reply notification counts** — ✅ SHIPPED `[CV]` (PR [#128](https://github.com/QuilibriumNetwork/quorum-mobile/pull/128))
  Drift-prone MMKV counter **retired**; count derives from watermark-based `mentionReplyLog.ts`. `useReplyTracking` keeps only the active-channel marker.
- **#2 · Per-space notification preferences** — ✅ SHIPPED `[CV]` (PRs [#124](https://github.com/QuilibriumNetwork/quorum-mobile/pull/124)/[#126](https://github.com/QuilibriumNetwork/quorum-mobile/pull/126))
  Writes synced `UserConfig.notificationSettings`/`mutedChannels`; event-type Switch UI in `SpaceSettingsModal`; MMKV demoted to an NSE-read mirror. ⚠️ inbound cross-device change needs a space-screen remount (`refreshChannelMuteFromConfig` is a dead export); ⚠️ writes use `as any` until shared publishes the `NotificationSettings` fields.
- **#23 · Mention notification counts / inbox** — ✅ SHIPPED `[CV]` (PR [#128](https://github.com/QuilibriumNetwork/quorum-mobile/pull/128))
  Client-side mention/reply inbox (`mentionReplyLog.ts`): two-level read model, per-type gating, profile "Mentions & replies" section, per-channel + tab badges. (Viewport auto-flash is separate — #30, still open.)
- **#24 · Channel mute → dim muted channels** — ✅ SHIPPED `[CV]` (PR [#126](https://github.com/QuilibriumNetwork/quorum-mobile/pull/126))
  Muted channels **dimmed in place** (`textMuted` + `bell.slash`), whole-space mute shown on the space avatar. Mobile chose dim-never-hide, so it doesn't read `showMutedChannels` — a deliberate divergence, not a gap.
- **#31 · Channel icon picker parity** — ✅ SHIPPED `[CV]` (PR [#107](https://github.com/QuilibriumNetwork/quorum-mobile/pull/107))
  Shared-vocab picker (`ICON_OPTIONS`/`FILLED_ICONS`/`getIconColorHex`/`iconVariant`); old 20-icon local set deleted. **Follow-up:** shared #53 added 15 icons (source `2.1.0-34`); mobile pre-registered them (PR [#143](https://github.com/QuilibriumNetwork/quorum-mobile/pull/143)) but won't SHOW them until the `2.1.0-33→34` bump — no code change, just the bump.
- **#32 · Group icon + color** — ✅ SHIPPED `[CV]` (PR [#107](https://github.com/QuilibriumNetwork/quorum-mobile/pull/107))
  Group icon/color/variant picker wired via `ChannelSettingsSheet` group branch; group pencil affordance on the list.
- **#33 · Channel-list icons render default** (was a live bug) — ✅ FIXED `[CV]` (PR [#82](https://github.com/QuilibriumNetwork/quorum-mobile/pull/82))
  List now reads `channel.icon`/`iconColor`/`iconVariant`.
- **#34 · Avatar initials from display name** — ✅ SHIPPED `[CV]` (PR [#90](https://github.com/QuilibriumNetwork/quorum-mobile/pull/90))
  `DefaultAvatar`/`AvatarInitials` consume shared `getInitials`/`getColorFromDisplayName`; `SpaceIcon` consolidates space monograms.

#### 🆕 New mobile capabilities (landed after the June audit — not desktop→mobile ports)

Logged so the parity picture stays honest; some may be mobile-AHEAD or warrant a reverse convergence check.

- **#37 · Personal Block user** (viewer-side hide) — 🆕 SHIPPED (PR [#127](https://github.com/QuilibriumNetwork/quorum-mobile/pull/127))
  Hides a user's messages from your own view, per-space, synced via `UserConfig.blockedUsers[spaceId]`. No permission, no broadcast. **Reverse check answered (2026-07-15): desktop ALSO has personal block** (`useBlockUser.ts` + `BlockUserModal.tsx`, PR [#207](https://github.com/QuilibriumNetwork/quorum-desktop/pull/207), 2026-06-22) — no gap either direction. Worth a later parity spot-check that the two block models (mobile `blockedUsers[spaceId]` vs desktop's) are wire-compatible, but neither platform is missing the capability.
- **#38 · Moderation mute-user** (role-gated broadcast) — 🆕 SHIPPED (PR [#125](https://github.com/QuilibriumNetwork/quorum-mobile/pull/125))
  Requires `user:mute` role (no owner bypass), signed `MuteMessage` broadcast, receive-side re-validation + composer disable + timed mutes. **This is what row 26b once called "local-only, not a bug" — that reclassification is now stale** (see the permission section).

### 🔴 Correctness / permission bugs on mobile (not "missing features" — broken invariants)

These surfaced during the 2026-06-12 parity deep-dive. Mobile reimplements permission logic locally instead of consuming shared's helpers, and three enforcement gaps result. **Higher priority than most feature-ports** because they silently break access-control that desktop enforces.

> **✅ ENTIRE CLUSTER RESOLVED — re-verified 2026-07-15 against mobile branch + installed `2.1.0-33` dist.** The whole "publish + consume tail" the notes below describe as pending is DONE:
> - **26a `@everyone` (receive + send):** the receive-side `hasPermission(senderId, 'mention:everyone', space)` check is present in shared source `mentions.ts:309` AND in the installed `2.1.0-33` dist (`index.native.js:1661`); mobile send-side role-gates `allowEveryone` (`SpaceChatArea.tsx:360`). SHIPPED.
> - **26c owner-bypass:** the `if (isSpaceOwner) return true` short-circuit is GONE from shared (`_isSpaceOwner` param ignored) and confirmed absent in the `2.1.0-33` dist; mobile now delegates to shared helpers (`useRoleManagement.ts:27-30`), no local reimplementation. SHIPPED.
> - **26b `user:mute`:** ⚠️ **the "personal/local-only, not a bug" reclassification below is now STALE.** Mobile PR [#125](https://github.com/QuilibriumNetwork/quorum-mobile/pull/125) (`6d967ed`) shipped a REAL role-gated moderation mute (signed `MuteMessage` broadcast, receive-side permission re-validation, composer disable, timed mutes) — logged as new row **38**. The old local-only mute still exists separately as personal Block (row **37**).
> - **27 read-only channels:** both ENFORCE (composer gated on `canManageReadOnlyChannel`, locked-composer banner) AND the SET UI (read-only Switch + manager-role picker in `ChannelSettingsSheet`) are present. SHIPPED.
> The historical per-row notes below are kept for context but are superseded by this banner. Mobile pins `2.1.0-33` (NOT the `2.1.0-29` / `2.1.0-26` the old notes assume — those are stale; the fixes are all in the shipped `-33`).

> **🚧 TASK DROPPED 2026-06-12 → ✅ CORE SHIPPED 2026-06-13.** Rows 26a–c + 27 became mobile task `quorum-mobile/.agents/tasks/2026-06-12-permission-enforcement-wave-0.md` (= "Wave 0" in the sequencing section), now `partially-done`. Tracked desktop-side as row 0 in [mobile-tasks-pending.md](../quorum-shared-migration/mobile-tasks-pending.md). No shared work / no version bump (helpers already in mobile's installed `2.1.0-26`). **Per-row status (verified against mobile `master` 2026-06-14):**
> - **27 — read-only enforcement + receive-side delete validation → ✅ SHIPPED** (mobile PR [#76](https://github.com/QuilibriumNetwork/quorum-mobile/pull/76) `e6fcc9a` "Enforce message-delete and read-only-channel permissions on receipt"; PR [#77](https://github.com/QuilibriumNetwork/quorum-mobile/pull/77) `f78b8a7` dropped unsupported control messages instead of rendering them).
> - **26b — `user:mute` → ❌ NOT a permission gap (won't enforce).** Mobile's mute is **personal/local-only by design** (MMKV, affects only your own client) — there is nothing to gate. Reclassified out of Wave 0; not a bug.
> - **26a — `@everyone` receive-side check → ✅ SHARED FIX MERGED (awaiting publish).** The missing receive-side role check landed in **shared PR [#41](https://github.com/QuilibriumNetwork/quorum-shared/pull/41)** (`fc73eb2`, source `2.1.0-30`): `isMentionedWithSettings`/`mentions.ts` now imports and calls `hasPermission` to gate `@everyone`. Desktop sees it now (via `link:`). Mobile *consuming* it still depends on Wave 1 wiring the mention pipeline — but the shared enforcement primitive is no longer missing.
> - **26c — owner-permission bypass → 🟡 SHARED ROOT FIX MERGED, awaiting publish + consume.** The shared change (REMOVE the `if (isSpaceOwner) return true` short-circuit) **landed in shared PR [#41](https://github.com/QuilibriumNetwork/quorum-shared/pull/41)** (`fc73eb2`, source `2.1.0-30`): `hasPermission`/`getUserPermissions` now take `_isSpaceOwner` as deprecated/ignored ("ownership grants NO implicit permissions"). **Desktop already consumes it** (`link:`). **Remaining ceremony:** (1) `2.1.0-30` is **NOT yet published to npm** (latest published = `2.1.0-26`); (2) mobile pins `2.1.0-29` and **the next mobile version will bump to `2.1.0-30`** to consume this fix (confirmed intent, 2026-06-14); (3) mobile then drops its local permission duplication.
>
> **Bump blast-radius `2.1.0-26 → 2.1.0-30` (verified 2026-06-14): SAFE for mobile.** The bump carries **8 commits** (#36, #37, #38, #39 + `72ca300`, `f61ecc3`, #40, #41). All effectively additive by the atlas gut-check (mobile builds if it bumps now): #41 owner-bypass/`@everyone` (the intended fix; `permissions.ts` param renamed `isSpaceOwner`→`_isSpaceOwner` but same position/type/default `= false`, so callers compile), `primaryUsername?` on `UserConfig` (#40), `UpdateProfileMessage.displayName` widened to optional (`f61ecc3`), icon-picker vocabulary (#39 — the row-31 shared task), Input `leftIcon`/`rightIcon` slots (#38), Farcaster byte-limit validation (#37), QNS `.q`-suffix narrowing (#36). **Only breaking changes are two `validation/` renames** — `containsReservedDot`→`hasReservedQnsSuffix`, `MAX_BIO_LENGTH`→`MAX_BIO_BYTES` — **but mobile imports neither** (grep-verified), so they don't touch mobile. The cross-repo task `quorum-mobile/.agents/tasks/2026-06-12-owner-permission-bypass-cross-repo-fix.md` (`status: open`) tracks the publish+consume tail — the design/code part is done, not pending.

| # | Bug | Mobile evidence | Root cause | Shared fix available |
|---|---|---|---|---|
| 26a | **`@everyone` unenforced (the real propagating gap)** — desktop gates only on SEND (`Channel.tsx:1129` + `MessageService.ts:4626`); there is **no receive-side role check anywhere** — `isMentionedWithSettings` (shared `mentions.ts`) fires the notification on `mentions.everyone === true` with zero sender-permission check. So any client setting the flag notifies everyone. Mobile never sends `@everyone` today, but the receive-side hole is real on desktop. | send-gate exists, **receive-gate missing** | needs a NEW receive-side check: `hasPermission(senderId, 'mention:everyone', space)` in `isMentionedWithSettings` (verified 2026-06-14: `senderId` matches `role.members` format, same as the existing delete receive-check) |
| 26b | **`user:mute` unenforced** — mute is local-only MMKV; any member can mute anyone | `useUserMuting.ts` no guard; `UserProfileModal.tsx:271` shows button unconditionally; `createChannelPermissionChecker` unused on mobile | same | `createChannelPermissionChecker` ALREADY-EXISTS |
| 27 | **Read-only channels unenforced** — a channel set read-only on desktop shows mobile users a live composer; they can post | `SpaceChatArea.tsx:722-746` renders `MessageInput` with no `canPost` gate; `canManageReadOnlyChannel` unused; SET UI also absent in `SpaceSettingsModal` | same | `canManageReadOnlyChannel` + `Channel.isReadOnly`/`managerRoleIds` ALREADY-EXIST |
| 26c | ⚠️ **REFRAMED 2026-06-14** — the `isSpaceOwner` short-circuit is itself a BUG, not something to adopt. `isSpaceOwner` is only ever true on the owner's OWN device (it = "this device holds the owner key"); no other client can compute it (no `ownerAddress` on the wire — privacy). So `if (isSpaceOwner) return true` only fires on the owner's own client, granting buttons/sends that every receiver then judges by ROLE and rejects. Owners get NO implicit permissions except **kick** (Ed448 protocol-verified). Mobile's hooks OMITTING the short-circuit is accidentally MORE correct. | `useRoleManagement.ts:56-111` | see `quorum-mobile/.agents/tasks/2026-06-12-owner-permission-bypass-cross-repo-fix.md` (supersedes the old framing) | **NOT "delegate to shared"** — the real fix is REMOVE `if (isSpaceOwner) return true` from shared `hasPermission` + add the missing receive-side `@everyone` role check |

**Roles CRUD parity** (separate from enforcement): mobile's role create/edit/delete/assign/permission-toggle UI is substantially COMPLETE and matches desktop (neither has role color-picker or reordering). The gap is purely enforcement (26a–c, 27), not management.

### ✅ Channel-list icons render the default (row 33) — FIXED on mobile `master`

> **RESOLVED 2026-06-14** via mobile PR [#82](https://github.com/QuilibriumNetwork/quorum-mobile/pull/82) "Show each channel's saved icon and color in the channel list" (`fb81ffe`). `app/(tabs)/spaces/[id]/index.tsx:119-121` now reads `name={(channel.icon || 'number') as IconSymbolName}` + `color={channel.iconColor || theme.colors.textMuted}` — exactly the prescribed fix. Kept here for history; no longer a live bug.

**Symptom (user-reported 2026-06-12):** a channel's icon was set in mobile settings (saved correctly, showed in the settings modal), but the **channels list** always showed the default hashtag icon.

**Root cause (was):** `app/(tabs)/spaces/[id]/index.tsx:118` hardcoded `<IconSymbol name="number" …>` and never read `channel.icon` / `channel.iconColor`. Fixed by the one-line change above. **Note:** this was independent of the Tabler/SF icon-set mismatch (row 31) — that's a *separate* reason a desktop-set icon NAME may not resolve on mobile until the row-31 shared-vocabulary consumption lands; #82 fixed the list-render hardcoding (hit even mobile-set icons), not the cross-platform name mapping.

## Recommended sequencing (2026-06-12, with user priorities)

> **⚠️ Mostly historical as of 2026-07-15.** Waves 0–2 have largely SHIPPED (permissions, mentions cluster, markdown, notification rollout, DM signing/delete). **What actually remains** (the live backlog): **#9 DM receipts** (top DM item, shared-ready), **#7 typing indicators** + **#16 toggles** (shared `TypingService` ready), **#5/#6 YouTube facade + setting**, **#10/#28 unread separator + scroll-to-first-unread**, **#11 space tags**, **#12 user notes**, **#3 threads** (biggest), plus smaller polish (**#4** tables-only gap, **#29/#30** highlight, **#13/#14/#17/#18/#19/#20**). Also pending: mobile bump `2.1.0-33→34` to pick up the expanded icon set (#53) + the promoted preprocessing pipeline (#52). Read the status board above for per-row truth; the waves below are the original plan.

User-stated interest (2026-06-12), roughly in their priority order: user mentions (first), @everyone/role mentions, roles parity check, read-only channels, YouTube facade + setting, image+caption single-message, DM read receipts, scroll-to-last-seen, message highlighting, space tags, user notes, markdown. Below is the recommended ORDER, which front-loads the correctness bugs and the highest-leverage shared-consumption work.

**Wave 0 — permission enforcement (correctness, do first) — ✅ CORE SHIPPED 2026-06-13, residual carried forward.** The mention/roles/read-only items the user named were entangled: rows 26a–c + 27 are live access-control bugs sharing one root cause — mobile reimplements permissions instead of consuming shared. **What landed (mobile PR [#76](https://github.com/QuilibriumNetwork/quorum-mobile/pull/76) + [#77](https://github.com/QuilibriumNetwork/quorum-mobile/pull/77)):** receive-side **read-only-channel** enforcement (27) + **message-delete** validation, routed through the shared helpers. **What did NOT land in Wave 0, and why:** `user:mute` (26b) is **personal/local-only by design — not a permission gap** (reclassified out, won't enforce); `@everyone` (26a) is **deferred to Wave 1** (mobile sends no mention metadata today, so there's nothing to enforce until the pipeline exists); the owner-permission bypass (26c) **shared root fix is MERGED** (shared PR [#41](https://github.com/QuilibriumNetwork/quorum-shared/pull/41) removed the `isSpaceOwner` short-circuit + added the 26a receive-side `@everyone` check; desktop consumes it via `link:` now) — what remains is the **publish + mobile-consume tail** (`2.1.0-30` not yet on npm; mobile pins `2.1.0-29`). So the original "one fix closes four gaps" framing was optimistic: two gaps closed on mobile now (#27 + delete), 26b reclassified as a non-bug, 26a+26c fixed in shared and awaiting publish, mobile-side consumption of 26a/26c still to come. Read-only channel SET UI (#27 second half) and @role *send-metadata* (#8) still ride with Wave 1.

**Wave 1 — user mentions, done right (the user's #1).** Decide the wire format (🔴 cross-cutting note): align mobile to desktop's `@<address>`. Then: call `extractMentionsFromText` on mobile's send path (fixes empty `mentions` + @everyone/@role metadata — #8), align `MentionableText` regex to parse `@<address>` (#22 pill render), add roles/@everyone to autocomplete (#22). Mention notification counts (#23) + mention viewport highlight (#30) are the follow-on once `lastReadTimestamp` is plumbed. **Do Wave 0 first** — mention enforcement depends on the permission fix.

**Wave 2 — high-value standalone ports (independent, pick by appetite).**
- **YouTube facade (#5) + setting (#6)** — ship together (the setting gates the facade). Utils already in shared. MED + SMALL.
- **DM delivery/read receipts (#9)** — HIGH but high user value. **Shared is DONE** (receipts wire types + `ReceiptService` + per-message/conversation/config fields all in published `-31`, RN-safe — verified 2026-06-17); it's now pure mobile wiring, no shared blocker.
- **Scroll-to-first-unread (#28) + new-messages separator (#10)** — ship together, pure UI/scroll, no shared work.
- **Message-highlight parity (#29)** — small polish on mobile's existing partial impl (fix color/duration, add notification deep-link + pagination fallback).

**Wave 3 — the rest, by value.** Space tags (#11), user notes (#12), markdown (#4, MED-HIGH, RN renderer), then the smaller settings/UX items (#15, #16, #24, accent/theme toggles), then threads (#3, HIGH, biggest single effort — worth its own planning pass).

**Image + caption single message — CONVERGENCE, ✅ DONE both sides (desktop [#201](https://github.com/QuilibriumNetwork/quorum-desktop/pull/201) 2026-06-13 + mobile [#89](https://github.com/QuilibriumNetwork/quorum-mobile/pull/89) 2026-06-14, squash `6d8017f`).** The 2026-06-13 cross-repo review found this was a **live cross-platform bug**: mobile sent image+text as `EmbedMessage` with an informal `text?` cast and **never read `embeddedMedia` on render**, so a desktop photo+caption (`PostMessage` + `embeddedMedia` + text) showed on mobile as **caption text only — the image was dropped**. Convergence decision (settled): both apps use `PostMessage` + `embeddedMedia` (NOT "add `text?` to `EmbedMessage`"); `embed` becomes receive-only legacy. **Desktop side** (#201): image-only sends moved off `embed` onto `post`+`embeddedMedia`; GIF playback ported; send-button active-on-attach. **Mobile side** (#89, LaMat): renderer now reads `content.embeddedMedia` when `type === 'post'` (`components/Chat/types.ts:425`), and send goes through a `post`+`embeddedMedia` path with thumbnail-first ordering matching desktop (`services/space/spaceMessageService.ts:976-1041`). Two-repo, no shared change. Tracked as [mobile-tasks-pending row 1.7](../quorum-shared-migration/mobile-tasks-pending.md) + mobile task `2026-06-13-converge-image-caption-to-post-embeddedmedia.md` (status SHIPPED). **Caveat carried from the mobile task:** mobile→desktop is runtime-confirmed; desktop→mobile render is statically verified but not yet runtime-confirmed (blocked by an unrelated mobile symptom — see the mobile task).

### Already tracked on mobile (cross-ref, NOT new candidates)

| Capability | Mobile task | Status |
|---|---|---|
| DM profile sync (`dm-update-profile` broadcast/receive) | `quorum-mobile/.agents/tasks/2026-06-09-port-dm-update-profile-from-desktop.md` | 🚧 BLOCKED on shared publish (`DMUpdateProfileMessage` not in `2.1.0-26` dist) |
| Config→user read-back (bio, isProfilePublic, primaryUsername) | `quorum-mobile/.agents/tasks/2026-06-10-primary-username-sync-and-publish.md` + 2 bugs | 🚧 in progress; ties to QNS publish (see [[project_qns_username_broadcast_pending]]) |

### Not a meaningful port (desktop-chrome-specific — recorded, won't port)

Toast system (mobile has `ToastContext`) · web modal/overlay system (mobile uses native sheets) · ReactTooltip (no pointer on mobile) · responsive layout / sidebar drag (mobile is single-column native) · browser push permission UI (mobile has native push) · "Show QR for mobile import" (bootstraps mobile, irrelevant) · keyboard-shortcuts help (no keyboard chrome). Mobile-AHEAD (not a gap): onboarding privacy-level picker.

**Channel topic / description display — won't-port the DISPLAY, but GUARD the data (decided 2026-06-14).** Desktop renders `channel.channelTopic` in the channel header as `# name | topic` (`Channel.tsx:1407,1615`), but **already hides it below the `xs` breakpoint** (`hidden xs:inline`) — i.e. desktop itself only shows it when there's horizontal room. Mobile never reads `channelTopic` for display, so the cross-platform *display* surface is already zero. This is the mainstream pattern (Discord channel topics go up to 1024 chars w/ header truncation + popover; Slack has channel topics too) — Telegram is the outlier because its "channels" are a different primitive (no sub-channels). **Decision: do NOT port the topic display to mobile** (no phone-width room, desktop already hides it there) and do NOT remove the field (it's a working, mainstream feature). **`channelTopic` is now OPTIONAL on the shared `Channel` type** (`channelTopic?: string`) — fixed 2026-06-14 (shared `master` `8d7664c`, additive/non-breaking, no version bump): the field was declared required but was optional in practice (`validateChannelTopic` treats empty as valid, channels store `''`, every render site truthy-guards it) — that was type drift, now corrected. **Mobile consequence:** mobile may simply **omit `channelTopic`** when creating/saving a channel (it never displays it) — it is no longer forced to echo `''`. **⚠️ Still a data-integrity must-do:** mobile's channel-editor save must **not strip a `channelTopic` a desktop user set** — i.e. when editing an existing channel, carry the existing value through rather than writing back without it (now `undefined`-safe, but don't clobber a present value). Verify in the mobile channel-editor wiring when the icon/settings drawer work (rows 31/32) is picked up — same `useChannelManagement`-equivalent save path.

## Format for each entry

```
### N. <Capability name>  — [feature-port | convergence]

**Mobile:** `path/to/mobile/file.ts` — one-line summary of mobile's approach (or "absent" for feature-port)
**Desktop:** `path/to/desktop/file.ts` — one-line summary of desktop's approach
**Why desktop is better / why mobile needs it:** the concrete reasons
**Mobile cost:** low / medium / high — what mobile would need to change
**Shared-package involvement:** none / additive / would need new exports
**Status:** noted / task-dropped (→ tracker row) / deprioritized
```

---

## 1. Reply notification counts — convergence

> ✅ **CURRENT STATE (2026-07-15): SHIPPED on mobile** (PR [#128](https://github.com/QuilibriumNetwork/quorum-mobile/pull/128)). The MMKV counter described below is **retired**; count now derives from the watermark-based `mentionReplyLog.ts`. **The prose below is the PRE-SHIP analysis** — kept for the desktop-side rationale; read the status board for live status.

**Mobile:** [`quorum-mobile/hooks/chat/useReplyTracking.ts`](../../../../quorum-mobile/hooks/chat/useReplyTracking.ts) — MMKV-backed counter. WebSocket handler calls `incrementReplyCount` on every incoming reply where `replyMetadata.parentAuthor === currentUser`. A separate "active channel" module-level singleton suppresses bumps while the user is viewing the channel; `clearReplyCount` is called on entry.

**Desktop:** [`src/hooks/business/replies/useReplyNotificationCounts.ts`](../../../src/hooks/business/replies/useReplyNotificationCounts.ts) — React Query projection over `MessageDB`. Per render, queries `messageDB.getUnreadReplies()` with the channel's `conversation.lastReadTimestamp` as the cutoff, then filters out replies already read in threads via `threadReadTimes`. No separate "count" state to keep in sync.

**Why desktop is better:**
1. **No state divergence.** Mobile's counter is a cache that can drift from the canonical message store (reconnects, sync catch-up, multi-device sync, app restart mid-sync). Desktop's count is derived from the store, so it can't diverge.
2. **Respects user notification settings.** Desktop checks `notificationSettings[spaceId].isMuted`, per-type enable flags via `isNotificationTypeEnabled(settings, 'reply')`, and per-channel mutes via `mutedChannels`. If the user explicitly muted a channel or disabled reply notifications, desktop returns 0; mobile counts anyway.
3. **Respects per-thread read state.** Desktop excludes thread replies already read by checking against `threadReadTimes[threadId]`. Mobile has no thread-read awareness.
4. **No active-channel side-channel.** Desktop doesn't need mobile's module-level `activeChannelKey` singleton + `setActiveChannel`/`clearActiveChannel` API surface; "did the user read this" is a property of the canonical store, not an ephemeral RAM flag.
5. **Bounded display.** Desktop caps at `DISPLAY_THRESHOLD = 10` ("9+" in UI); mobile counts unboundedly.

**Mobile cost:** **HIGH.** Desktop's implementation assumes a persisted message store with `lastReadTimestamp` per conversation + per-thread read times. Mobile's storage layer (MMKV + `messagesDb.ts`) would need to gain equivalent indexes / queries. The mobile choice to skip a heavier IndexedDB-style store was likely deliberate for mobile constraints (cold boot, app suspension) — convergence requires reconsidering that.

**Shared-package involvement:** none in the short term. Desktop's hook is tightly coupled to its `MessageDB` interface (which is desktop-specific). If a shared `StorageAdapter` ever grows the methods desktop's hook calls (`getUnreadReplies`, `getThreadReadTimesForChannel`, `getConversation` with `lastReadTimestamp`), then the *logic* of the hook could become shareable — but that's downstream of substantial shared-storage work.

**Status:** ✅ **SHIPPED on mobile (re-verified 2026-07-15)** — the drift-prone MMKV counter is retired; count now derives from the watermark-based `mentionReplyLog.ts` (mobile PR #128). See the status-board row 1. (2026-06-01 orig.)

**Related desktop infrastructure (for context):**
- [`src/hooks/business/replies/useSpaceReplyCounts.ts`](../../../src/hooks/business/replies/useSpaceReplyCounts.ts) — aggregates per-space
- [`src/hooks/business/replies/useAllReplies.ts`](../../../src/hooks/business/replies/useAllReplies.ts) — full replies inbox
- [`src/hooks/business/mentions/useChannelMentionCounts.ts`](../../../src/hooks/business/mentions/useChannelMentionCounts.ts) — parallel mention-count system
- [`src/services/NotificationService.ts`](../../../src/services/NotificationService.ts) — OS-level notifications, typed metadata for `'dm' | 'mention' | 'reply'`
- [`src/components/notifications/NotificationPanel.tsx`](../../../src/components/notifications/NotificationPanel.tsx) — in-app notification panel
- [`.agents/tasks/.done/reply-notification-system.md`](../.done/reply-notification-system.md) — completed architecture task doc
- [`.agents/docs/features/mention-notification-system.md`](../../docs/features/mention-notification-system.md), [`notification-indicators-system.md`](../../docs/features/notification-indicators-system.md) — architecture docs

---

## 2. Per-space notification preferences — model richness, sync, and gating fidelity — convergence

> ✅ **CURRENT STATE (2026-07-15): SHIPPED on mobile** (PRs [#124](https://github.com/QuilibriumNetwork/quorum-mobile/pull/124)/[#126](https://github.com/QuilibriumNetwork/quorum-mobile/pull/126)). The source-of-truth question raised below was answered in favour of **synced `UserConfig`**: mobile now writes `UserConfig.notificationSettings`/`mutedChannels` (synced), with MMKV demoted to an NSE-read mirror, plus event-type Switch UI in `SpaceSettingsModal`. Two residual gaps: inbound cross-device change needs a space-screen remount (`refreshChannelMuteFromConfig` is a dead export), and writes use `as any` until shared publishes the `NotificationSettings.isMuted`/`enabledNotificationTypes` fields. **The prose below is the PRE-SHIP convergence analysis** — the "why desktop is better" + the architecture decision it drove; read the status board for live status.
>
> *(Historical: this was flagged 🚧 IN PROGRESS 2026-06-23 as the notification-system rollout began — that rollout, covering this row + #1 + #23 + #24, has now landed.)*

**Mobile:** [`quorum-mobile/services/notifications/notificationPrefs.ts`](../../../../quorum-mobile/services/notifications/notificationPrefs.ts) — three-level boolean tree in MMKV (`global:enabled`, `space:<id>`, `channel:<spaceId>:<channelId>`), AND-resolved by `shouldNotifyForContext()`. Local-only, mirrored to iOS App Group for the NSE to read. No event-type granularity.

**Desktop:** [`src/hooks/business/channels/useChannelMute.ts`](../../../src/hooks/business/channels/useChannelMute.ts) + [`UserConfig.notificationSettings`](../../../../quorum-shared/src/types/user.ts) — per-space `SpaceNotificationSettings` with `isMuted: boolean` AND `enabledNotificationTypes: SpaceNotificationTypeId[]` (`'mention-you' | 'mention-everyone' | 'mention-roles' | 'reply'`). Channel mute lives in separate `mutedChannels[spaceId]: string[]`. Stored in encrypted `UserConfig` blob, synced across devices via `apiClient.postUserSettings()`.

**Why desktop is better:**

1. **Event-type granularity.** Desktop users can opt out of `@everyone` while keeping `@you` notifications on — a real preference in busy spaces. Mobile has no equivalent; it's all-or-nothing per space/channel.
2. **Cross-device sync.** A user who mutes a noisy space on their desktop has it muted on their phone too. Mobile prefs are local to each device, so muting on phone doesn't carry to desktop or to a second phone. This is a real ongoing pain point for multi-device users.
3. **Settings are part of identity-encrypted user config.** Desktop's prefs survive reinstall (they're on the server, key-derived). Mobile's prefs are wiped on app reinstall / device change.
4. **Uses the existing shared type.** `SpaceNotificationSettings` and `SpaceNotificationTypeId` already live in `@quilibrium/quorum-shared/src/types/notifications.ts` — desktop consumes them, mobile imports the types but doesn't use them in UI. The shared schema is the natural target for convergence.

**Why mobile is currently better in two narrow ways (honest accounting):**
- Mobile's NSE-level (Swift) suppression means muted-channel pushes don't even reach the OS notification center on iOS — a privacy + battery win. Desktop's suppression happens in JS only.
- Mobile's simpler model is easier for casual users; the desktop event-type multi-select is denser UI. Convergence has to keep the master toggle prominent and the type filter as progressive disclosure.

**Mobile cost:** **HIGH.**
- Mobile would need to write to `UserConfig.notificationSettings` (synced config), replacing or supplementing the MMKV store.
- The iOS NSE currently reads MMKV via App Group mirror. Switching to `UserConfig` means either (a) the NSE reads the encrypted config (heavy; the NSE process needs key access), or (b) the synced settings get mirrored back into the same MMKV store that the NSE already reads. Option (b) is the realistic path: `UserConfig` is the source of truth and writes propagate to MMKV for the NSE.
- New mobile UI to expose the event-type filter (currently doesn't exist as a control on mobile).
- The May 28 architecture report records that mobile's local-only choice was **intentional**, not unfinished — convergence requires revisiting that decision with the lead dev, not just porting.

**Shared-package involvement:** **additive.** The types already exist. What's missing is a shared hook (`useNotificationSettings`) that both apps could consume, plus possibly a shared `shouldNotifyForContext`-equivalent utility that knows about both `isMuted` and `enabledNotificationTypes`. These would replace mobile's `notificationPrefs.ts` and parts of desktop's `useChannelMute.ts`.

**Status:** ✅ SHIPPED 2026-07-15 (see banner at top of this entry). *(orig. noted 2026-06-07.)*

**Related desktop infrastructure (for context):**
- [`quorum-shared/src/types/notifications.ts`](../../../../quorum-shared/src/types/notifications.ts) — shared types already exist (`SpaceNotificationSettings`, `SpaceNotificationTypeId`)
- [`quorum-shared/src/types/user.ts`](../../../../quorum-shared/src/types/user.ts) — `UserConfig.notificationSettings` shape
- [`src/hooks/business/channels/useChannelMute.ts`](../../../src/hooks/business/channels/useChannelMute.ts) — full desktop hook (read sites + writers)
- [`src/hooks/business/mentions/useMentionNotificationSettings.ts`](../../../src/hooks/business/mentions/useMentionNotificationSettings.ts) — event-type filter persistence (has its own sync bug — see [`2026-06-07-mention-type-filter-not-synced.md`](../../bugs/2026-06-07-mention-type-filter-not-synced.md))
- [`.agents/reports/2026-05-28-notification-architecture-divergence.md`](../../reports/2026-05-28-notification-architecture-divergence.md) — full architectural divergence analysis
- [`.agents/tasks/2026-06-07-align-notification-settings-with-mobile.md`](../2026-06-07-align-notification-settings-with-mobile.md) — desktop-side UX rename that left this convergence work deferred to this entry

**Suggested approach when this gets picked up:**
1. Decide the source-of-truth question with the lead dev: `UserConfig.notificationSettings` (cross-device sync) vs. status-quo MMKV (local-only). Recommend the former.
2. If sync is in: mirror `UserConfig` writes into the existing MMKV store so the iOS NSE keeps working without changes to the Swift code.
3. Add event-type filter UI to mobile space settings (progressive disclosure under the master toggle).
4. Promote `useChannelMute` and friends to `quorum-shared` once both apps consume the same shape.

---

## 🔴 Cross-cutting finding: the mention wire-format mismatch (read before scoping #8 / #22 / #23)

> ✅ **RESOLVED 2026-07-15** (mobile PR [#112](https://github.com/QuilibriumNetwork/quorum-mobile/pull/112)). Mobile now composes, sends, and renders the canonical `@<address>` format and calls shared `extractMentionsFromText` on send — the cross-platform break described below no longer happens. **The analysis below is historical**, kept because it explains *why* the format was chosen and what the fix had to cover.

The single most important finding of the 2026-06-12 audit. Desktop and mobile **store mentions in incompatible formats**, so cross-platform mentions silently break TODAY:

| Platform | Compose inserts | Storage format | Render parses |
|---|---|---|---|
| Desktop | `@<QmAbc123>` | `@<QmAbc123>` (angle-bracketed) | `/@<([^>]+)>/g` |
| Mobile | `@QmAbc123 ` (bare) | `@QmAbc123` (no brackets) | `/@([a-zA-Z0-9_.\-]+)/g` |

- A desktop→mobile message renders as literal text `@<QmAbc123>` on mobile (its regex can't match the brackets).
- A mobile→desktop message doesn't highlight on desktop (desktop expects brackets).
- Shared's `extractMentionsFromText` (`quorum-shared/src/utils/mentions.ts:393`, uses `/@<[^>]+>/g`) is the canonical extractor. **Mobile never calls it** — `quorum-mobile/services/space/spaceMessageService.ts` sets `mentions: { memberIds: [], roleIds: [], channelIds: [] }` to empty on every send path (lines ~285/402/562/630), and `quorum-mobile/components/Chat/MentionableText.tsx:43` uses a third, incompatible regex.

**This means the mentions cluster (#8, #22, #23) is not "nice to have" — it's a correctness bug across platforms.** The root fix is small in surface (one `extractMentionsFromText` call on send + a regex alignment on render) but needs a deliberate format decision with the lead dev (align mobile to `@<address>`, or change both). Flagged 🔴 in the status board. Likely belongs as a coordinated shared + mobile + desktop item.

---

## 3. Threads in spaces — feature-port

**Mobile:** ABSENT. No `threadId`/`threadMeta`/`isThreadReply` on `DisplayMessage` (`components/Chat/types.ts`), no "Create Thread" in `MessageActionSheet.tsx`, no `ThreadIndicator`, no thread hooks, no thread route. Mobile HAS flat inline-reply (`isReply`/`replyToMessageId`) — a different feature. (The `CastThreadModal` is Farcaster, unrelated.) No mobile `.agents/` planning exists.
**Desktop:** `src/components/thread/` (`ThreadPanel.tsx`, `ThreadIndicator.tsx`, `ThreadsListPanel.tsx`, `ThreadListItem.tsx`), `src/components/context/ThreadContext.tsx`, `src/hooks/business/threads/` (`useThreadMessages`, `useChannelThreads`, `useThreadStats`), `src/services/ThreadService.ts`, `src/services/channelThreadHelpers.ts`.
**Wire/storage format:** control message `type:'thread'`, `action: create|updateTitle|close|reopen|updateSettings|remove`, carrying `ThreadMeta { threadId, createdBy, customTitle?, isClosed?, ... }`. Replies carry `threadId` + client-side `isThreadReply`. Aggregated `ChannelThread` row persisted locally. Thread typing scope `th:<spaceId>:<channelId>:<threadId>`.
**Why mobile needs it:** Threads are a core space-collaboration primitive on desktop; mobile users in the same space can't see or participate in threaded conversations at all.
**Mobile cost:** HIGH — new thread route/view, `ThreadIndicator`, action-sheet entry, three hooks, `ThreadService` processing in the receive path, `StorageAdapter` thread query methods.
**Shared-package involvement:** types ALREADY-EXIST (`ThreadMeta`, `ThreadMessage`, `ChannelThread`, `Message.isThreadReply`, thread `TypingScope` all in `quorum-shared/src/types/message.ts` + `typing.ts`). `StorageAdapter` (shared `src/storage/adapter.ts`) has NO thread query methods → ADDITIVE. `ThreadService`/`channelThreadHelpers` are promotion candidates (currently `MessageDB`-coupled on desktop).
**Status:** noted (2026-06-12) — the largest single gap.

## 4. Markdown rendering in messages (code blocks, inline code, spoilers) — feature-port

> ✅ **CURRENT STATE (2026-07-15): SHIPPED on mobile** (PR [#112](https://github.com/QuilibriumNetwork/quorum-mobile/pull/112)). Mobile now ships a hand-rolled `MessageMarkdownRenderer.native.tsx` (bold/italic/strike, inline + fenced code, spoilers, blockquote, lists, headings). **Only gap: tables** aren't implemented. Preprocessing was promoted to shared (#52) but mobile runs a local copy until the `2.1.0-33→34` bump. **The "**Mobile:** ABSENT" prose below is the PRE-SHIP state** — kept for the desktop-side renderer detail; read the status board for live status.

**Mobile:** ABSENT for markdown. All message text routes through `components/Chat/MentionableText.tsx`, a custom tokenizer that only knows `@mention`/`#channel`/`:emoji:`/URL — **zero markdown awareness**. `**bold**`, `` `code` ``, fenced blocks, `||spoiler||` all render as literal characters. No markdown library in `package.json`. No mobile `.agents/` task.
**Desktop:** `src/components/message/MessageMarkdownRenderer.tsx` — `react-markdown` + `remark-gfm` + `remark-breaks` + custom `remarkTwemoji`. Bold/italic/strike/H3/blockquote/lists/tables, inline code, fenced code blocks (monospace, `bg-surface-4`, scroll-wrapped >10 lines, floating copy button — **no syntax-color highlighting**), spoilers (`||text||` → click/keyboard reveal, accessible).
**Why mobile needs it:** desktop users send formatted messages (and code) that mobile users see as raw syntax noise.
**Mobile cost:** MED-HIGH — add an RN markdown lib (e.g. `react-native-markdown-display`; `react-markdown` is DOM-only and can't be reused), build `MessageMarkdownRenderer.native.tsx` with `code`/`fence`/spoiler/mention overrides, wire `MessagesList.renderPostMessage` to it.
**Shared-package involvement:** parse/strip ALREADY-EXISTS — `quorum-shared/src/utils/markdownStripping.ts` + **`.native.ts`** (Metro-safe regex variant) + `markdownFormatting.ts` (compose-toolbar helpers) + `codeFormatting.ts` (DOM/RN-neutral). **Key split: PARSE is shareable, RENDER (DOM vs RN component tree) is not.** The desktop preprocessing pipeline (`processMentions`/`processURLs`/`fixUnclosedCodeBlocks`/`convertHeadersToH3`/…) lives inline in the renderer and is a strong ADDITIVE promotion candidate (`prepareMessageContent(content, opts)`) so both platforms share tokenization.
**Status:** ✅ SHIPPED 2026-07-15 (tables the only remaining gap — see banner at top of this entry). *(orig. noted 2026-06-12.)*

## 5. YouTube facade (lite embed) — feature-port

**Mobile:** ABSENT in chat. Mobile HAS a `react-native-youtube-iframe`-backed `YouTubeEmbed` (`components/SocialFeed/media/YouTubeEmbed.tsx`) but it's (a) Farcaster-social-feed only, (b) loads the player immediately (no thumbnail-first facade → no privacy/perf benefit), (c) doesn't consume message `embeddedMedia` thumbnails, (d) re-implements YouTube URL parsing locally instead of using shared. Chat-message YouTube links aren't embedded at all on mobile.
**Desktop:** `src/components/ui/YouTubeFacade.tsx` (+ `YouTubeEmbed.tsx` wrapper) — renders the sender-embedded base64 thumbnail with a play overlay; click swaps in the iframe. Sender embeds the thumb at send time in `useMessageComposer.ts` (gated by `generateYouTubePreviews`). `MessageMarkdownRenderer.tsx` detects standalone YT URLs → facade.
**Why mobile needs it:** privacy (receivers never hit YouTube) + perf, plus chat-parity (YT links currently inert in mobile chat).
**Mobile cost:** MED — RN facade (`Pressable` + thumbnail `Image` + play overlay → WebView on tap), wire the chat renderer to read `embeddedMedia.youtube-thumbnail`, gate send-side embedding on the setting (#6).
**Shared-package involvement:** ALREADY-EXISTS — `quorum-shared/src/utils/youtubeUtils.ts` exports `fetchYouTubeThumbnailAsBase64`, `extractStandaloneYouTubeVideoIds`, `extractYouTubeVideoId`, etc. Mobile should consume these (and drop its local dupes — cleanup bonus).
**Status:** noted (2026-06-12). Pairs with #6 (the setting).

## 6. "Generate YouTube previews" setting — feature-port

**Mobile:** ABSENT. No toggle in mobile settings; `useUserConfig` exposes no setter; composer never embeds a thumbnail. The shared `UserConfig.generateYouTubePreviews` field is imported (via the type) but never read/written.
**Desktop:** `src/components/modals/UserSettingsModal/Privacy.tsx:261-283` toggle; `useUserSettings.ts` read/write; stored in synced `UserConfig`.
**Why mobile needs it:** it's the privacy gate for #5 — without it the user can't control sender-side thumbnail fetching (an IP-leak vector).
**Mobile cost:** SMALL — toggle row in mobile Privacy settings + `updateYouTubePreviews` on `useUserConfig` + gate the composer.
**Shared-package involvement:** `UserConfig.generateYouTubePreviews` ALREADY-EXISTS in shared `src/types/user.ts:51`. No new exports.
**Status:** noted (2026-06-12).

## 7. Typing indicators — feature-port (shared-ready)

**Mobile:** ABSENT both sides. No `TypingService` instantiation, no broadcast from `MessageInput.tsx`, no `<TypingIndicator>`, and `context/WebSocketContext.tsx` has zero `typing-start`/`typing-stop` intercept (incoming typing msgs are silently dropped). No mobile `.agents/` task.
**Desktop:** `src/components/message/TypingIndicator.tsx`, `src/hooks/business/messages/useTypingIndicator.ts` + `useTypingNotifier.ts`, wired via `MessageDB.tsx` → `MessageService` (intercepts `typing-start/stop` in DM + space paths, never persists them). Sends via `sendEphemeralDMControl`/`sendEphemeralSpaceControl`. Notably ships `TypingIndicator.native.tsx` as a **null-stub with an explicit "mobile follow-up" comment**.
**Wire format:** `TypingMessage { type:'typing-start'|'typing-stop', senderId, scope:'dm'|'space', spaceId?, channelId?, threadId?, timestamp }`.
**Why mobile needs it:** presence parity; mobile users currently can't see desktop users typing and vice-versa.
**Mobile cost:** MED — WebSocket intercept → `typingService.onTypingReceived()`, instantiate `TypingService`, broadcast from `MessageInput` (+ auto-stop on send/unmount/`AppState` background), RN `TypingIndicator` component, privacy-gate wiring.
**Shared-package involvement:** ALREADY-COMPLETE — `quorum-shared/src/typing/` ships `TypingService` (throttle, 8s TTL, privacy gate, reorder protection, freshness filter) + types + a 483-line test suite, all public via `src/index.ts`. Constructor is platform-agnostic. Nothing new to publish.
**Status:** noted (2026-06-12) — lowest-friction medium feature; shared does the heavy lifting. Pairs with #16 (the send toggles).

## User mentions cluster (#8, #22, #23) — see cross-cutting note above first

> ✅ **CURRENT STATE (2026-07-15): all three SHIPPED** (mobile PRs [#112](https://github.com/QuilibriumNetwork/quorum-mobile/pull/112) + [#128](https://github.com/QuilibriumNetwork/quorum-mobile/pull/128)). #8 @everyone/@role (compose+send+render+notify), #22 autocomplete+pills (canonical `@<address>`, members+roles+@everyone), #23 client-side mention/reply inbox — all landed. **The per-sub-item breakdown below describes the PRE-SHIP gaps** — read the status board for live status.

**Desktop (the full system):** `src/hooks/business/mentions/` (`useMentionInput` tiered autocomplete, `useChannelMentionCounts`, `useSpaceMentionCounts`, `useAllMentions`, `useMentionNotificationSettings`, `useViewportMentionHighlight`), `MentionDropdown.tsx`, pill render in `MessageMarkdownRenderer.tsx` + `src/utils/mentionPillDom.ts`. Wire format `@<address>`; `@everyone` permission-gated; `@role` → `message.mentions.roleIds[]`.

**#22 Autocomplete + pill render — convergence (mobile's exist but worse + wrong format):** mobile `components/Chat/MessageInput.tsx` has @member/#channel autocomplete (inserts bare `@address` — wrong), caps at 6, no roles/@everyone, no QNS-awareness; `MentionableText.tsx` render regex can't parse `@<address>`. **Shared:** extract a named `USER_MENTION_REGEX` export (ADDITIVE); optionally migrate to a shared `useMentionInput`.

**#8 @everyone / @role — feature-port (ABSENT):** not in compose, send-metadata, render, or notify on mobile. **Shared:** `extractMentionsFromText` ALREADY handles both — mobile just never calls it.

**#23 Mention notification counts/highlights — convergence (scaffolded):** `DisplayChannel.mentionCount` plumbing exists but is server-vended; no client counting (`useChannelMentionCounts` et al. absent), no per-space notif settings UI, no unified inbox. **Shared:** `isMentionedWithSettings`, `SpaceNotificationSettings`, `formatMentionCount` ALREADY-EXIST. Pairs with convergence rows #1/#2.

**Status:** ✅ SHIPPED 2026-07-15 — #8/#22/#23 all landed; the format fix (the prerequisite) is resolved (see banner at top). *(orig. noted 2026-06-12.)*

---

## Sweep findings (rows 9–25) — condensed

Each verified against desktop source + mobile state; full evidence in the 2026-06-12 audit. Listed shortest-path-first within tier.

- **#9 DM delivery/read receipts** (feature-port, HIGH) — desktop `ReceiptService.ts` + `useReadReceipt.ts` + Privacy toggles; mobile ABSENT (renders nothing; doesn't intercept acks). **⚠️ SHARED IS DONE (verified 2026-06-17 against the installed `-31` dist):** the receipts migration the old doc said was "pending" has landed and published. Present + root-exported: wire types `DeliveryAckMessage`/`ReadAckMessage`/`ReceiptControlMessage`/`ReceiptControlMessageType`/`ReceiptEnvelopeFields` (`dist/types/receipt.d.ts`), the platform-agnostic `ReceiptService` (`dist/receipts/service.d.ts`, root-exported via `export * from './receipts'`; DOM access `typeof document`-guarded explicitly "so the same code runs unchanged on React Native"), per-message `deliveredAt`/`readAt` (`Message` type), per-conversation `deliveryReceipts`/`readReceipts` (`Conversation`), and global `deliveryReceipts`/`readReceipts` (`UserConfig`). **So #9 is now a pure mobile-wiring task: no shared change, no version bump, no publish.** Mobile work = decrypt-layer ack intercept → feed `ReceiptService`; instantiate it with mobile send + cache callbacks; mark read from a FlashList viewport observer (`onViewableItemsChanged`); render ✓/✓✓ from `deliveredAt`/`readAt`; add the global Privacy toggles + the per-DM override (row 35 Phase C). The desktop task `2026-05-19-receipts-shared-migration.md` is the migration that DELIVERED this — it's not a blocker, it's done.
- **#10 New-messages separator + jump-to-first-unread** (feature-port, MED) — desktop `NewMessagesSeparator.tsx` + Channel/DirectMessage scroll logic; mobile ABSENT. Shared NONE. FlashList `scrollToIndex` differs from Virtuoso.
- **#11 Space tags** (feature-port, MED) — desktop `src/components/space/SpaceTag/` + `Message.tsx` badge + General-tab picker + startup refresh; mobile ABSENT (never reads `sender.spaceTag`). Types + `UserConfig.spaceTagId` ALREADY in shared.
- **#12 User notes** (feature-port, MED) — desktop `user_notes` store + `UserProfile`/`DMUserProfileSidebar` UI; mobile ABSENT. `UserConfig.userNotes` ALREADY in shared (sync handling needed).
- **#13 Encrypted DM backup `.qmbak`** (feature-port, LARGE) — desktop `BackupService.ts` + Security tab; mobile ABSENT entirely. Shared NONE (format could be promoted). Needs `expo-file-system`/`expo-document-picker`.
- **#14 Device renaming** (feature-port, MED) — desktop `Security.tsx` inline rename; mobile shows device list but no rename. `UserConfig.deviceNames` ALREADY in shared.
- **#15 "Always sign DMs" toggle** (feature-port, SMALL) — desktop `Privacy.tsx:101-119`; mobile hardcodes `nonRepudiable:true` (`configService.ts:168`), no UI. Field ALREADY in shared.
- **#16 Global typing toggles (DM/Spaces)** (feature-port, SMALL) — desktop `Privacy.tsx:215-261`; mobile ABSENT. `typingIndicatorsDM`/`typingIndicatorsSpaces` ALREADY in shared. Pairs with #7.
- **#17 Space Settings "Fixes" section** (feature-port, SMALL, low value) — desktop `SpaceSettingsModal/General.tsx:231-256` auto-repair; mobile ABSENT.
- **#18 Emoji skin-tone preference** (feature-port, SMALL-MED, low value) — desktop `emoji-picker/useSkinTone.ts`; mobile ABSENT. localStorage → MMKV.
- **#19 In-app language switcher** (feature-port, MED) — desktop `Appearance.tsx:67-93` (Lingui); mobile has no UI locale switcher (verify it doesn't just follow system locale). Shared NONE.
- **#20 "Restore Missing Spaces"** (feature-port, SMALL) — desktop `Help.tsx:68-92`; mobile ABSENT (hub-log sync may reduce need).
- **#21 Per-message signing toggle** (feature-port, LOW) — desktop composer lock button (`skipSigning`); mobile has conversation/space-level repudiable toggles but no per-message override. Shared NONE (UI-only).
- **#24 Channel mute → hide/dim** (convergence, LOW-MED) — desktop `useChannelMute.ts` `showMutedChannels` + dimmed rows; mobile mutes notifications only, never reads `showMutedChannels` (ALREADY in shared `UserConfig`).
- **#25 Space folders UI** (convergence/feature-port hybrid, HIGH) — see the detailed entry below (UX needs a decision: port desktop's DnD vs a Telegram-style pill bar).
- **#31 Channel icon picker parity** / **#32 group icon+color** / **#33 channel-list icon bug** — see the "Channel & group icons" detailed entry below.

**Lower-confidence (flagged for manual check, not yet rows):** (a) bidirectional deep-link message loading — mobile `scrollToMessage` only searches the loaded window, so bookmarks/pins to old messages may silently no-op (this is the cause of the #29 partial state); (b) explicit "jump to present" button — present on desktop, not found on mobile.

## 25. Space folders — detailed (UX decision needed)

**Desktop:** `src/components/space/SpacesSidebar.tsx` + `SpacesSidebarFolder.tsx` + `FolderButton.tsx`; `src/hooks/business/folders/` (`useFolderDragAndDrop`, `useFolderManagement`, `useDeleteFolder`, `useFolderStates`); `src/components/modals/FolderEditorModal.tsx`. Create-by-drag (drop a space onto another), collapsible named+colored folders, reorder within/across folders.
**Mobile:** data layer round-trips correctly (`configService.ts` validates + reads/writes the `items`/`NavItem` array; `validateItems`, MAX_FOLDERS, MAX_SPACES_PER_FOLDER all enforced), but the Spaces tab (`app/(tabs)/spaces/index.tsx`) renders a **flat sorted list that ignores the `items` field** — folders synced from desktop are silently flattened. No folder UI, no editor, no DnD.
**Shared:** `NavItem`, `FolderColor`, `validateItems` ALREADY-EXIST. No new shared work for the data; this is purely a mobile UX build.

**UX decision — ✅ DECIDED 2026-06-17: Option A (Telegram-style pill bar).** Desktop's create-by-drag-and-drop is questionable on touch; the pill bar is the native, lower-cost path. The two directions that were weighed:
- **Option A — Telegram-style pill bar (✅ CHOSEN).** A horizontally-scrolling row of folder "pills" at the top of the Spaces list; tapping a pill filters the list to that folder's spaces. Add/remove a space to a folder via a long-press menu or an edit sheet (no drag). Far more native/usable on touch, much less to build than DnD, and it reads the SAME `items` data desktop writes — so cross-device folders Just Work. Trade-off accepted: not 1:1 with desktop's nested-collapsible model (it's filter-by-folder, not show-all-grouped).
- **Option B — port desktop's DnD model (rejected).** Collapsible folder groups + drag-to-create/reorder. Full parity but DnD on mobile lists is finicky (gesture conflicts with scroll, accessibility), higher build cost, arguably worse UX than the pill bar.

**🚧 Task dropped 2026-06-17:** `quorum-mobile/.agents/tasks/2026-06-17-space-folders-pill-bar.md`. **One semantics question still owed to the lead dev before/while building** (does NOT block scaffolding the pill bar): behavior for a space in multiple folders, and for "uncategorized" / no-folder spaces — see the task file.

## Channel & group icons — detailed (rows 31/32 + bug 33)

> ✅ **CURRENT STATE (2026-07-15): all three SHIPPED on mobile** (PRs [#107](https://github.com/QuilibriumNetwork/quorum-mobile/pull/107) + [#143](https://github.com/QuilibriumNetwork/quorum-mobile/pull/143), bug-33 fix [#82](https://github.com/QuilibriumNetwork/quorum-mobile/pull/82)). Mobile's picker consumes the shared vocabulary (`ICON_OPTIONS`/`FILLED_ICONS`/`getIconColorHex`/`iconVariant`) for both channels and groups; the channel list reads the saved icon/color. **One pending, no-code item:** shared #53 added 15 icons (source `2.1.0-34`); mobile pre-registered them but won't SHOW them until the `2.1.0-33→34` bump. **The "PARTIAL / 20 icons / ABSENT" prose below is the PRE-SHIP state.**

**Desktop:** both `ChannelEditorModal.tsx:130-140` and `GroupEditorModal.tsx:79-86` use a shared-on-desktop `<IconPicker>` (`src/components/space/IconPicker/`) with: **50 Tabler icons** (9 tiers), an **`iconVariant: 'outline' | 'filled'` toggle** (34 icons have filled variants), and an **8-color named palette** stored as enum strings (`'blue'`, `'green'`, …). Fields live on both `Channel` and `Group`.
**Shared:** `Channel.icon`/`iconColor`/`iconVariant` AND `Group.icon`/`iconColor`/`iconVariant` ALREADY-EXIST (`quorum-shared/src/types/space.ts`). The icon SET + color palette were **desktop-local** (`IconPicker/types.ts`) — that's why mobile drifted — but the **picker vocabulary is now PROMOTED to shared** (shared PR [#39](https://github.com/QuilibriumNetwork/quorum-shared/pull/39), `src/primitives/Icon/pickerVocabulary.ts`: icons, named colors, filled set, `getIconColorHex` helper) and **desktop already re-exports it from shared**. Mobile consuming this shared vocabulary is the remaining step (rides the `2.1.0-30` bump).

**#31 Channel icon picker — PARTIAL (under-featured); shared half DONE.** Mobile HAS a channel icon picker (`components/ui/IconPicker.tsx`, used in `SpaceSettingsModal.tsx`), but: only **20 icons** (old SF-Symbol names like `star.fill`, not Tabler names), **no outline/filled variant** concept at all, and colors stored as **raw hex** (`'#3b82f6'`) instead of desktop's named enums → a color/icon set on one platform may not match the other. The icon-set drift is already noted in mobile task `2026-06-09-migrate-iconsymbol-to-shared-icon-primitive.md` (deferred Phase 2b). **The "promote the icon SET + color palette + variant into `quorum-shared`" half is now DONE** (shared [#39](https://github.com/QuilibriumNetwork/quorum-shared/pull/39) merged + desktop import-swap done — see the shared task `quorum-shared-migration/2026-06-12-promote-icon-picker-vocabulary-to-shared.md`, `in-progress`). **Remaining = mobile consumption** (mobile row 7.3): bump to `2.1.0-30`, swap mobile's 20-icon local set + hex colors for the shared vocabulary + add the outline/filled variant concept.

**#32 Group icon + color — ABSENT on mobile.** Desktop has a full group picker (`GroupEditorModal`). Mobile's group header row (`SpaceSettingsModal.tsx:1824-1879`) has **no icon affordance** — and the `useUpdateGroup` mutation already *accepts* `icon`/`iconColor` (interface lines ~389-394, honored in the mutation fn), the UI just never calls that path. Low cost to wire once an icon picker exists.

**#33 Channel-list icon bug — ✅ FIXED.** Was: `app/(tabs)/spaces/[id]/index.tsx:118` hardcoded `<IconSymbol name="number" …>` and ignored `channel.icon`/`channel.iconColor`. **Fixed on mobile `master` by PR [#82](https://github.com/QuilibriumNetwork/quorum-mobile/pull/82) (`fb81ffe`)** — line 119-121 now reads `channel.icon`/`channel.iconColor`. See the (now-resolved) bug callout above.

> **Mobile settings UX note (user, 2026-06-12):** mobile currently crams all channel/group settings into the inline channels list, which is tight. Worth considering a **per-item mobile drawer** (open a drawer for a given channel OR group → all its settings inside, including the icon picker, read-only toggle, rename, delete). This would give the icon picker (and the read-only SET UI from #27, and group icon #32) a proper home instead of inline affordances on a cramped row. A design call, not yet scoped — but it's the natural container for several of these channel/group gaps at once.

## 🔴 Permission enforcement bugs (rows 26–27) — detailed

> ✅ **CURRENT STATE (2026-07-15): entire cluster RESOLVED on mobile** (verified against the shipped `2.1.0-33` dist). 26a `@everyone` (receive + send role-gated), 26c owner-bypass (short-circuit removed in shared; mobile delegates to shared helpers), 27 read-only (enforce + SET UI) — all shipped. **26b reclassified AGAIN:** mobile now ships a REAL role-gated moderation mute (#38), so the "local-only, not a bug" call below is stale. **The deep-dive below is the PRE-FIX analysis** — it explains the root cause and the reasoning; read the status board for live status.

Full parity deep-dive 2026-06-12. **Mobile's role CRUD is fine; enforcement is not.** Root cause: mobile reimplements `hasPermission`/`getUserPermissions`/`getUserRoles` locally (`quorum-mobile/hooks/chat/useRoleManagement.ts:56-111`) and never uses `createChannelPermissionChecker`/`canManageReadOnlyChannel` — so several checks desktop performs simply don't happen on mobile.

**Permission flags (parity OK):** both define the same four — `message:delete`, `message:pin`, `mention:everyone`, `user:mute` (`quorum-shared/src/types/space.ts:14`). Kick is owner-only at the protocol level on both (no flag).

**26a — `@everyone` unenforced.** Desktop gates at `Channel.tsx:1129-1136` + re-checks at send `MessageService.ts:4626-4630`. Mobile's `SpaceChatArea.tsx` send path has zero `hasPermission(..., 'mention:everyone')` call. Any member can `@everyone`. Fix: gate compose + send on the shared helper.

**26b — `user:mute` unenforced.** Desktop: `UserProfile.tsx:77-89` via `createChannelPermissionChecker().canMuteUser()` (no owner bypass — owners must self-assign the role). Mobile: `useUserMuting.ts` is a local MMKV toggle with no permission check; `UserProfileModal.tsx:271` shows the mute button unconditionally. (Note: mobile's mute is *local-only* anyway — a separate convergence question vs desktop's role-gated mute.)

**26c — REFRAMED 2026-06-14 (was "owner-permission masking"; the old framing was wrong).** The original framing called mobile's hooks OMITTING the `isSpaceOwner` short-circuit a "footgun" that "delegating to shared fixes." That is backwards. **`isSpaceOwner` is a self-only fact:** on mobile it = `!!getSpaceKey(spaceId, 'owner')`, i.e. "this device holds the owner key" — true ONLY on the owner's own device. No other client can compute it (no `ownerAddress` on the wire, by design — privacy, desktop #111). So a check like `if (isSpaceOwner) return true` can only ever fire on the owner's own client, about their own actions; every receiver evaluates that same action by **role** (the only verifiable signal) and rejects it if the sender holds no matching role. Net: the bypass grants the owner a button/send that nobody else honors — a guaranteed local-vs-remote disagreement.

Therefore the **design-of-record** (desktop #111 `space-owner-privacy-limitation.md` + `space-permissions/space-roles-system.md`) is: owners get **NO** implicit `message:delete`/`message:pin`/`mention:everyone`/`user:mute` — they must self-assign a role like anyone else. The ONLY owner-only action is **kick**, enforced cryptographically (the kick requires the owner's private Ed448 key to sign a server op; the server verifies it — ownership is *proven*, not asserted by a flag).

Consequences for this row:
- The shared `hasPermission`'s `if (isSpaceOwner) return true` (and `getUserPermissions`'s owner shortlist) is **itself the bug** — a legacy artifact from LaMat's 2025 code ("owners retain full permissions automatically"), written before the privacy constraint was understood. The fix is to **REMOVE** it, not adopt it. Tracked in `quorum-mobile/.agents/tasks/2026-06-12-owner-permission-bypass-cross-repo-fix.md`.
- Mobile's hooks omitting the short-circuit is **accidentally the more-correct outcome** (no blanket owner bypass), even if the structure is muddled (the one caller `[channelId].tsx:58-59` manually ORs `isSpaceOwner` back for pin/delete — which produces only a local illusion: delete is dropped by receivers via the role check, pin is local-MMKV-only).
- So routing mobile through shared as-is would **perpetuate** the bypass, not fix it. The correct sequence is: remove the shared bypass first, then mobile's role-only hooks are simply correct.

(Severity note: for pin/delete the bypass is send-side-only — receivers already role-check, so it's a local illusion. For **`@everyone` (26a)** there is NO receive-side role check anywhere — that's the real propagating gap, the higher-severity one.)

Old open task `2026-05-29-mobile-adopt-shared-permission-helpers.md` is now **WON'T-DO** (its "owners now see pin/delete — this is a fix" claim was wrong; marked accordingly in the mobile repo).

**Shared involvement (all ALREADY-EXIST):** `hasPermission`, `getUserPermissions`, `getUserRoles` (`quorum-shared/src/utils/permissions.ts`), `createChannelPermissionChecker`/`UnifiedPermissionSystem`/`canManageReadOnlyChannel` (`channelPermissions.ts`), `toggleRolePermission`/`setRolePermissions` (`roleUtils.ts`). Desktop consumes them; mobile duplicates a partial copy. Two open mobile tasks cover the hook + mutation-helper adoption but **not** the enforcement gaps above.

## 27. Read-only channels — feature-port (with correctness urgency)

> ✅ **CURRENT STATE (2026-07-15): SHIPPED on mobile** — both halves. ENFORCE: composer gated on `canManageReadOnlyChannel` with a locked-composer banner (`[channelId].tsx:121-125`, `SpaceChatArea.tsx:783-817`). SET UI: read-only Switch + manager-role picker in `ChannelSettingsSheet.tsx:392-421`. **The "ABSENT" prose below is the PRE-SHIP state** — read the status board for live status.

**Mobile:** SET = ABSENT in UI (the hook layer `useChannelManagement.ts:40,80,131,159` persists `isReadOnly`/`managerRoleIds`, but `SpaceSettingsModal.tsx` channel editor exposes no toggle/role-picker). ENFORCE = ABSENT entirely — `SpaceChatArea.tsx:722-746` renders `MessageInput` with no `canPost` gate; `canManageReadOnlyChannel` unused; no locked-composer banner. **A read-only channel synced from desktop shows mobile users a live composer and they can post** — silent access-control break.
**Desktop:** SET via `ChannelEditorModal.tsx:158-211` (Switch + manager-role multi-select). ENFORCE via `Channel.tsx:67-96` (`canPostInReadOnlyChannel`) → `canPost` → `<MessageComposer disabled>` (lock-icon banner) at `1730-1738`; also suppresses typing broadcasts + shows a lock channel-icon.
**Storage:** `Channel.isReadOnly?: boolean` + `managerRoleIds?: string[]` (`quorum-shared/src/types/space.ts:56-57`).
**Mobile cost:** ENFORCE-only minimal fix ~2-4h (compute `canManageReadOnlyChannel` in `[channelId].tsx`, thread `canPost` → `MessageInput disabled`, add banner). Full SET parity ~1-2 days (toggle + role picker in settings). Both ~2-3 days.
**Shared:** ALREADY-EXISTS (`canManageReadOnlyChannel` + the `Channel` fields). No new exports.
**Status:** ✅ SHIPPED 2026-07-15 — both enforce + SET UI landed (see banner at top). *(orig. noted 2026-06-12.)*

## 28. Scroll-to-first-unread on channel/DM entry — feature-port

**Mobile:** ABSENT. `MessagesList.tsx` always renders from bottom (FlashList `maintainVisibleContentPosition` + `startRenderingFromBottom`); has stay-at-bottom-on-new-message but no first-unread query. No `lastReadTimestamp`/`scrollToMessageId` prop plumbed from `SpaceChatArea`/`DMChatArea`.
**Desktop:** `Channel.tsx:916-1033` — on entry, `messageDB.getFirstUnreadMessage({ afterTimestamp: lastReadTimestamp })`, jumps if `unreadCount >= 5` OR oldest unread `>= 5min` old; sets `scrollToMessageId` → `MessageList.tsx:530-563` scrolls via Virtuoso `scrollToIndex`. (Note: it's jump-to-first-unread, NOT raw scroll-position restore.) Related β work: `useScrollAnchor.ts` / task `2026-05-24-virtuoso-application-owned-scroll-anchoring`.
**Mobile cost:** MED — plumb `lastReadTimestamp` into the chat areas, add a `scrollToMessageId`-style prop + first-unread query, use FlashList `scrollToIndex` (already available). Pairs naturally with #10 (new-messages separator).
**Shared:** NONE (reads shared `Conversation.lastReadTimestamp`, already there).
**Status:** noted (2026-06-12).

## 29 / 30. Message highlighting — #29 link-jump (convergence), #30 mention viewport (feature-port)

**Desktop:**
- Link/notification/bookmark/pinned jump → `MessageList.tsx:482-528` scroll + `highlightMessage(id, {duration:8000})` (`useMessageHighlight.ts`), CSS `flash-highlight` 8s (4s hold + 4s fade), `rgb(var(--warning)/0.2)`.
- Mention viewport entry → `useViewportMentionHighlight.ts:29-90` IntersectionObserver (threshold 0.5), guard `isMentioned && isUnread`, fires `highlightMessage(id, {duration:61000, variant:'mention'})`, CSS `flash-highlight-mention` 61s (~57s hold + 4s fade), `rgb(var(--warning)/0.1)`. **The "different timing depending on mention" = 8s for link-jumps vs 61s for unread mentions.**

**#29 Link-jump highlight — convergence (mobile PARTIAL):** `MessagesList.tsx:374-383` `scrollToMessageWithHighlight` exists for pinned (`SpaceChatArea:756`) + bookmark (`:770`, DM `:496`) nav. But: searches only the loaded window (silent no-op if target not loaded — see lower-confidence note), ~1.7s blurple Reanimated fade (NOT desktop's 8s yellow), no notification deep-link path, no pagination-to-find fallback. Fix: align color/duration, add notification deep-link, add load-more-until-found. Cost LOW-MED. Shared NONE.

**#30 Mention viewport highlight — feature-port (ABSENT):** no viewport-entry trigger, no `IntersectionObserver`/`onViewableItemsChanged` equivalent, no `lastReadTimestamp` at list level. RN path: `onViewableItemsChanged` on the FlashList + `isMentioned && isUnread` per item → existing Reanimated highlight. Cost MED (animation infra exists; trigger missing). Shared NONE. Pairs with #28 (both need `lastReadTimestamp` plumbed) and #23.

## 34. Avatar initials — display-name-based + shared logic — convergence

> ✅ **CURRENT STATE (2026-07-15): SHIPPED on mobile** (PR [#90](https://github.com/QuilibriumNetwork/quorum-mobile/pull/90)). `DefaultAvatar`/`AvatarInitials` now consume shared `getInitials`/`getColorFromDisplayName`; `SpaceIcon` consolidates the scattered space monograms. **The "derives from address" prose below is the PRE-SHIP state.**

**Mobile:** [`quorum-mobile/components/ui/DefaultAvatar.tsx`](../../../../quorum-mobile/components/ui/DefaultAvatar.tsx) — derives initials from the **address** string, not the display name: `address.startsWith('@') ? address.slice(1,3) : address.slice(0,2)`, uppercased (lines ~32-42). So a user's fallback avatar shows an opaque hex/base58 prefix like `"AC"` — meaningless to a human. Background color is a local djb2 hash over the address (`hashToColor`). Used at ~13 call sites (DM lists, message bubbles, call screens, profile/reaction modals, space lists). Space avatars are inconsistent: two list screens pass the *space address* into `DefaultAvatar` (→ address-prefix initials), three other spots inline their own `space.name.charAt(0)` monogram (`ApexSubscribeModal.tsx:361`, `InviteLinkCard.tsx:197`), and a couple show an SF Symbol instead.

**Desktop:** initials + color logic lives in **`quorum-shared/src/utils/avatar.ts`** (`getInitials`, `getColorFromDisplayName`, `lightenColor`/`darkenColor`) — pure, exported publicly. `getInitials(displayName)` = first letters of the first two whitespace words, uppercased; emoji-aware (returns the leading emoji); `''`/`"Unknown User"` → `'?'`. Both **user** avatars (`src/components/user/UserAvatar`) and **space** avatars (`src/components/space/SpaceAvatar`, `SpaceIcon.tsx`) route through ONE `UserInitials` component that calls these shared functions — zero duplication. A `UserInitials.native.tsx` already exists in the shared component stack (uses `expo-linear-gradient` + RN `<Text>`).

**Why desktop is better / why mobile needs it:**
1. **Meaningful initials.** Desktop shows `NA` for "Niccolò Angeli"; mobile shows address junk (`AC`). The desktop fallback is human-recognizable.
2. **One system for users AND spaces.** Desktop's space avatars reuse the exact same logic; mobile's space monograms are scattered across 3 inline copies + 2 address-based + 2 icon-only — inconsistent and drift-prone.
3. **The logic is already shared and battle-tested.** `getInitials`/`getColorFromDisplayName` are pure, in the published dist mobile already pins, emoji-aware, with a stable color palette. Mobile reimplements a worse version locally for no reason.

**Mobile cost:** **MED.** The algorithm ports for free (already in shared) — the work is component-side: (a) `DefaultAvatar` gains a `displayName` prop and calls shared `getInitials`/`getColorFromDisplayName` instead of its local address logic; (b) ~13 call sites pass a display name (in addition to / instead of the address); (c) extract a `SpaceIcon` to replace the scattered `charAt(0)` space monograms + address-based space avatars; (d) one RN wrinkle — `expo-image` (mobile's photo loader, `CachedAvatar.tsx`) can't fall back to a React node on load-error the way web `<img onError>` can, so the "show initials when the photo fails" path needs a small `useState`+`onError` wrapper (mobile's generic `Avatar.tsx` already implements this pattern correctly — copy it).

**Shared-package involvement:** **NONE.** `getInitials`, `getColorFromDisplayName`, `lightenColor`, `darkenColor` all already export from `@quilibrium/quorum-shared` (`src/utils/avatar.ts` → `utils/index.ts` → `index.ts`) and are in the dist mobile pins. No shared work, no version bump.

**Status:** ✅ SHIPPED 2026-07-15 (PR #90 — see banner at top). *(orig. task-dropped 2026-06-14 as `quorum-mobile/.agents/tasks/2026-06-14-avatar-initials-display-name-from-shared.md`.)* Also fixed two mobile inconsistencies (address-junk initials; scattered space monograms) as a side effect.

## 35. DM conversation settings parity — convergence (scaffolded-not-wired)

> ✅ **CURRENT STATE (2026-07-15): SHIPPED except receipts** (mobile PRs [#138](https://github.com/QuilibriumNetwork/quorum-mobile/pull/138)/[#142](https://github.com/QuilibriumNetwork/quorum-mobile/pull/142)). `DMSettingsSheet` now renders + wires Mute, Always-sign (`isRepudiable`), Save Edit History, plus the pre-existing Fix-Encryption + Delete. **Only the delivery/read-receipt toggles remain — gated on #9** (receipts don't exist on mobile yet). **The "coded-but-unwired / absent" prose below is the PRE-SHIP state.**

**Desktop:** [`src/components/modals/ConversationSettingsModal.tsx`](../../../src/components/modals/ConversationSettingsModal.tsx) — a per-DM settings modal exposing **five settings + delete**:
1. **Always sign messages** — per-conversation `isRepudiable` override of the global `nonRepudiable` (toggle inverts: `nonRepudiable = !isRepudiable`).
2. **Mute conversation** — via `useDMMute` (`isMuted`/`toggleMute`).
3. **Delivery receipts** — per-conversation override of the global setting (`undefined` = inherit global; shows a "Reset to global" affordance when overridden).
4. **Read receipts** — per-conversation override, **nested under delivery** (only shown when delivery is on; cascades off when delivery turns off).
5. **Save Edit History** — per-conversation, gated behind the `ENABLE_EDIT_HISTORY` feature flag.
Plus a **Delete Conversation** danger action (local-only delete via `deleteConversation`, with a confirmation modal; navigates to the next conversation after).

**Mobile:** [`quorum-mobile/components/Chat/DMSettingsSheet.tsx`](../../../../quorum-mobile/components/Chat/DMSettingsSheet.tsx) — a sheet titled "Conversation Settings" **already exists** and is opened from the DM header gear (`app/(tabs)/messages/dm/[id].tsx:222`). BUT:
- It renders each toggle **only if its callback prop is passed** (`{onToggleRepudiable && …}`, `{onToggleEditHistory && …}`), and the DM screen (`[id].tsx:357-364`) passes **only the values** `isRepudiable` / `saveEditHistory`, **not** `onToggleRepudiable` / `onToggleEditHistory` / `onDeleteConversation`. **Net effect: only "Fix Encryption" + "Delete Conversation" actually render** — the two coded toggles are invisible, and even Delete's `onDeleteConversation` handler is not passed (⚠️ likely a no-op — needs a runtime check).
- **Entirely absent (not even coded):** mute, delivery receipts, read receipts.
- Mobile has one setting desktop lacks: **"Fix Encryption"** (reset the DM session) — keep it.

**Why mobile needs it:** per-conversation signing, mute, and receipt overrides are real DM controls desktop users rely on; on mobile they're either invisible or missing. The "Always sign" per-conversation toggle is the DM-scoped sibling of the global #15 toggle.

**Mobile cost:** **MED**, but lower than a from-scratch port because the sheet shell + two toggles already exist. Work: (a) wire `onToggleRepudiable` / `onToggleEditHistory` / `onDeleteConversation` from `[id].tsx` (un-hides the coded toggles + fixes delete); (b) add mute (needs a mobile DM-mute equivalent of desktop's `useDMMute`); (c) add delivery + read receipt toggles **(depends on #9 receipts landing first — no point exposing a receipts override before receipts exist)**; (d) verify Delete Conversation actually deletes at runtime.

**Shared-package involvement:** **NONE / already-present in `-31`.** The per-conversation fields `isRepudiable`, `saveEditHistory`, `deliveryReceipts`, `readReceipts` already exist on the shared `Conversation` type (desktop reads/writes them via `messageDB.saveConversation`). The receipts portion is gated on the #9 receipt PIPELINE being built on mobile (a mobile-side effort) — **not** on any shared work: the receipts wire types + `ReceiptService` already shipped in published `-31` (verified 2026-06-17). No new exports needed for any part of row 35.

**Status:** ✅ SHIPPED 2026-07-15 except the receipt toggles (gated on #9 — see banner at top). *(orig. noted 2026-06-14.)* Pairs with **#9** (receipts) and **#15**. This is the settings-sheet half; own-message delete is **#36**.

## 36. Delete your own message in a DM — feature-port (wiring)

> ✅ **CURRENT STATE (2026-07-15): SHIPPED on mobile** (PR [#139](https://github.com/QuilibriumNetwork/quorum-mobile/pull/139)). The DM screen now wires `onDelete`+`canDeleteMessage` (own-message gate) and propagates a `remove-message` control to all devices; receive-side honors the authenticated sender, not the spoofable payload. **The "never passes them" prose below is the PRE-SHIP state.**

**Desktop:** `src/components/direct/DirectMessage.tsx:208,979` — `useDirectMessagesList()` returns `canDeleteMessages`, which is threaded into the DM message list so a user can delete their own messages in a conversation.

**Mobile:** the **infrastructure already exists** but is **not wired into the DM path**:
- `quorum-mobile/components/Chat/MessageActionSheet.tsx` fully supports delete — `onDelete?` + `canDelete?` props, a confirm `Alert`, and a rendered "Delete" action (lines 32-33, 161-171, 336-345).
- `quorum-mobile/components/Chat/MessagesList.tsx` accepts `onDelete` + `canDeleteMessage(message)` props and forwards them to the action sheet (lines 63-64, 1180-1181).
- **But** `app/(tabs)/messages/dm/[id].tsx` never passes `onDelete` / `canDeleteMessage` down the DM render path — so the Delete action **never appears when long-pressing your own message in a DM**. (Confirmed: no `onDelete`/`canDelete`/`deleteMessage` reference anywhere in the DM screen.)

**Why mobile needs it:** desktop users can delete their own DM messages; mobile users currently cannot — a plain parity gap with a working delete pipeline sitting unused.

**Mobile cost:** **LOW.** No new components, no shared work — wire `onDelete` (call the existing DM delete path) + `canDeleteMessage` (`msg.senderAddress === currentUserAddress`, mirroring how space chat gates it) from the DM screen into its message list. Verify the DM delete actually propagates/persists (same delete semantics desktop uses).

**Shared-package involvement:** **NONE.**

**Status:** ✅ SHIPPED 2026-07-15 (PR #139 — see banner at top). *(orig. noted 2026-06-14.)* Independent of **#35** (different files), hence its own row.

### 19. Mobile i18n / language switcher — feature-port (detailed plan exists)

**Mobile:** ABSENT entirely — `quorum-mobile` has no `@lingui/react` dependency and no i18n directory; the app is English-only.
**Desktop:** fully shipped — `@lingui/react ^5.3.3`, 32 `.po` locale files in `src/i18n/`, `dynamicActivate()` loading, `useLocaleSettings` hook, locale picker in `Appearance.tsx:67-93`.
**Why mobile needs it:** full language parity (26+ langs) with the web app; non-English users get an English-only mobile app today.
**Mobile cost:** MED (4-6h estimate in the original plan). RN-specific concerns: Metro dynamic-import handling (3 options: `@lingui/metro-transformer` / static import map / native dynamic imports), `AsyncStorage` for the locale pref (vs web `localStorage`), `react-native-localize` for device-locale detection, a `LanguageSelector.native` + settings entry.
**Shared:** NONE (app-level i18n; the `.po` translation *content* is shared by copying the same keys, not by an npm export).
**Detailed plan:** preserved at [`../mobile-dev/.archived/2026-01-09-internationalization-i18n-implementation-plan.md`](../mobile-dev/.archived/2026-01-09-internationalization-i18n-implementation-plan.md) (written 2026-01-09 for the old single-repo playground, but the technical substance — Metro options, AsyncStorage, locale detection, the 3 loading strategies, success criteria — maps directly onto standalone `quorum-mobile`; ignore its `mobile/` playground path references).
**Status:** noted (2026-06-12) — should be re-homed as a `quorum-mobile` task when picked up.

### Theme tab items (rows 10/11 in the settings sweep) — scaffolded, tiny

Mobile's `ThemeProvider` already exposes `setAccentColor` and `setIsDark`/`toggleTheme`, but `ProfileModal` Appearance section surfaces neither. Accent-color picker (6 swatches) and Light/Dark/System toggle are both SCAFFOLDED-NOT-WIRED → tiny UI-only adds. Also tiny: typed-"RESET" Danger Zone confirmation (mobile uses a plain `Alert`), and display-name inline validation (mobile has `maxLength` only; `validateDisplayName` ALREADY in shared).

---

*Last updated: 2026-07-15 — **big freshness re-audit + status-board readability rework.** Re-verified every open row against the current mobile working tree (branch `feat/grouped-message-inline-indicators`; pins `@quilibrium/quorum-shared@2.1.0-33`) and shared `master` (`2.1.0-34`). Flipped to ✅ SHIPPED: the mentions+markdown cluster (#4 markdown — tables the only gap; #8 @everyone/@role; #22 autocomplete+pills; the wire-format mismatch), the permission cluster (#26a/#26c enforced in the shipped `-33` dist; #27 read-only enforce + SET UI; and **#26b overturned** — mobile now ships REAL role-gated moderation mute, logged as new #38), the notification rollout (#1 reply counts, #2 per-space prefs, #23 mention inbox, #24 channel-mute dim), and the DM/signing cluster (#15, #21, #35-except-receipts, #36). Added two NEW mobile capabilities: **#37 Personal Block user** and **#38 Moderation mute-user**. Still open (unchanged): #3, #5, #6, #7, #9, #10, #11, #12, #13, #14, #16, #17, #18, #19, #20, #28, #30; #29 still PARTIAL; #25 task-dropped-not-started. Two cross-repo nuances flagged: (a) mobile pins `2.1.0-33` but shared is `2.1.0-34` — the expanded icon set (#53) and promoted `prepareMessageContent` pipeline (#52) await a mobile bump (mobile runs a local copy meanwhile); (b) per-space notif prefs land in synced config but the in-memory refresh helpers are dead exports (inbound cross-device change needs a remount). **Layout + agent-navigability pass:** replaced the two wide status-board tables + the new-capabilities table with a compact list grouped by status (📋 open / 🚧 not-started / ✅ shipped / 🆕 new), two lines per item. Added a **"where each candidate's full detail lives" map** to the board (the `## N.` numbering is non-contiguous; some detail lives in the `Sweep findings` blob). Guarded every ✅-shipped `## N.` detail entry with a `> ✅ CURRENT STATE` banner and updated its `**Status:**` line, so an agent grepping either the heading, the banner, or the Status line gets the current answer — the pre-ship prose after the banner is explicitly flagged as historical. Marked the recommended-sequencing waves + the permission deep-dive + the wire-format note as superseded. No mobile/shared code touched — desktop doc only.*

*Previously: 2026-06-23 — **row 2 (per-space notification preferences) → 🚧 IN PROGRESS on mobile**: we are now rolling out the entire notification system on `quorum-mobile`, starting with per-space notification prefs. Flipped the status-board row from 📋 noted to 🚧 in-progress and added an in-progress callout at the top of the detailed §2 entry noting the whole notification cluster (#1 reply counts, #2 prefs, #23 mention counts/highlights + OS-push/NSE plumbing) is the surface being converged; the synced-`UserConfig` vs MMKV source-of-truth question is the gating architecture call. No code change; signpost only. When concrete tasks land they'll be task files in the mobile repo per Lifecycle.*

*Previously: 2026-06-17 (pass 2) — **row 9 (DM receipts) CORRECTED**: the doc claimed receipts "need shared migration"; verified against the installed published `-31` dist that this is STALE — the entire receipts migration (wire types `DeliveryAck`/`ReadAck`/`ReceiptControlMessage`/`ReceiptEnvelopeFields`, RN-safe `ReceiptService` root-exported via `./receipts`, per-message `deliveredAt`/`readAt`, per-conversation + `UserConfig` toggles) already SHIPPED and PUBLISHED. #9 is now pure mobile wiring — no shared change, no bump. Fixed row 9, the #9 sweep entry, the Wave 2 line, and row 35's shared-involvement note. **Row 25 (space folders) UX DECIDED → Telegram-style pill bar (Option A)**, 🚧 task-dropped (`2026-06-17-space-folders-pill-bar.md`); cost revised MED (was HIGH for the rejected DnD); one multi-folder/uncategorized semantics question still owed to the lead. Verified the spaces tab flat-list bug + the mobile-local `validateItems`/`MAX_FOLDERS` (not shared exports, as the doc implied — corrected in the task). Previously 2026-06-17 (pass 1) — **rows 31 + 32 marked ✅ SHIPPED** (both consumed in mobile PR [#107](https://github.com/QuilibriumNetwork/quorum-mobile/pull/107) `23427dc`: full shared-vocab `IconPicker` replacing the old 20-icon local picker + group icon UI wired). **Rows 35 + 36 marked 🚧 task-dropped** — task files written in mobile repo. Previously: 2026-06-14 — **fixed `Channel.channelTopic` type drift**: was declared required (`channelTopic: string`) but optional in practice (validation treats empty as valid, channels store `''`, render sites truthy-guard) → widened to `channelTopic?: string` in shared `master` (`8d7664c`, pushed; additive/non-breaking; **no version bump**; desktop tsc clean against rebuilt dist). Updated the channel-topic entry accordingly: the "required, so removal is breaking" rationale is gone; mobile may now omit the field rather than echo `''` (still must not clobber a desktop-set value on edit).*

*Previously 2026-06-14 — recorded a **channel-topic display** decision under "Not a meaningful port": don't port the `channelTopic` header display to mobile (no phone-width room; desktop already `hidden xs:inline`) and don't remove the field (it's a required field on the shared `Channel` type — removal would be a breaking 3-repo change). It's the mainstream pattern (Discord/Slack have channel topics; Telegram is the outlier). ⚠️ Flagged the one real mobile must-do: preserve `channelTopic` read-through-write-through on save so a mobile edit never clobbers a desktop-set topic. No code changed.*

*Previously 2026-06-14 — icon-cluster freshness sweep. **Row 33 (channel-list icon bug) → ✅ FIXED** on mobile `master` (PR [#82](https://github.com/QuilibriumNetwork/quorum-mobile/pull/82) `fb81ffe` — list now reads `channel.icon`/`channel.iconColor`); demoted the 🐛 callout to resolved-history. **Row 31 (channel icon picker) → 🟡 shared half DONE** — picker vocabulary promoted to shared (PR [#39](https://github.com/QuilibriumNetwork/quorum-shared/pull/39), `pickerVocabulary.ts`) + desktop import-swap done; only mobile consumption remains (rides the `2.1.0-30` bump). Updated the status-board rows + the detailed icon section. Verified against mobile `master` + shared `main`. No code changed.*

*Previously 2026-06-14 — upgraded **26a + 26c** status: the shared root fix is **MERGED** in shared PR [#41](https://github.com/QuilibriumNetwork/quorum-shared/pull/41) (`fc73eb2`, source `2.1.0-30`) — removed the `isSpaceOwner` short-circuit from `hasPermission`/`getUserPermissions` (now `_isSpaceOwner`, deprecated/ignored) AND added the missing receive-side `@everyone` role check in `mentions.ts`. Desktop already consumes it via `link:`. **Remaining = publish + consume only:** `2.1.0-30` is NOT yet on npm (latest published `2.1.0-26`), mobile pins `2.1.0-29`. The prior "still open / fix is to REMOVE the short-circuit" framing was stale — the design+code is done, not pending. Verified against shared `main` source + npm. No code changed.*

*Previously 2026-06-14 — added two DM-parity candidates (user-flagged): **row 35 DM conversation settings parity** (convergence — desktop's `ConversationSettingsModal` has 5 settings + delete; mobile's `DMSettingsSheet` EXISTS but its repudiable/edit-history toggles are coded-but-unwired and mute/delivery-receipt/read-receipt are absent — scaffolded-not-wired, MED, fields already on shared `Conversation`) and **row 36 delete-own-message-in-DM** (feature-port/wiring — mobile's `MessageActionSheet`+`MessagesList` already support `onDelete`/`canDelete` but the DM screen never passes them, LOW, no shared work). Both verified against mobile `master` source. ⚠️ flagged for runtime check: mobile's existing Delete-Conversation may be a no-op (`onDeleteConversation` not passed). No code changed.*

*Previously 2026-06-14 — corrected **Wave 0 (permission enforcement)** status: NOT dropped/abandoned — **core SHIPPED** on mobile `master` (PR [#76](https://github.com/QuilibriumNetwork/quorum-mobile/pull/76) read-only + delete enforcement, [#77](https://github.com/QuilibriumNetwork/quorum-mobile/pull/77) control-message drop). Reclassified **26b `user:mute`** as a non-bug (personal/local-only mute by design, won't enforce), confirmed **26a `@everyone`** deferred to Wave 1, and **26c owner-bypass** still open as its own cross-repo task. Updated both the row 26 callout and the Wave 0 sequencing block. Verified against merged mobile source; no desktop code changed.*

*Previously 2026-06-14 — marked **Image + caption single message** ✅ DONE both sides: mobile PR [#89](https://github.com/QuilibriumNetwork/quorum-mobile/pull/89) (LaMat, squash `6d8017f`, merged to `master` 2026-06-14) landed the open mobile half — renderer reads `embeddedMedia` on `post` (`components/Chat/types.ts:425`) + send emits `post`+`embeddedMedia` thumbnail-first (`services/space/spaceMessageService.ts:976-1041`), matching desktop #201. Verified against merged mobile source. Caveat preserved: desktop→mobile render statically verified, not yet runtime-confirmed. No code changed in desktop.*

*Previously 2026-06-14 — REFRAMED the permission cluster after a deep cross-repo verification: corrected **row 26c** (the `isSpaceOwner` short-circuit is itself a BUG, not something to adopt — `isSpaceOwner` is a self-only fact, unverifiable by other clients; owners get nothing implicit except kick) and **row 26a** (the real gap is the MISSING receive-side `@everyone` role check in shared `isMentionedWithSettings`, not just the mobile send-gate). The old "delegating to shared fixes it" framing was backwards — routing through shared's current `hasPermission` perpetuates the bypass. Supersedes the old framing in favour of `quorum-mobile/.agents/tasks/2026-06-12-owner-permission-bypass-cross-repo-fix.md`. The mobile task `2026-05-29-mobile-adopt-shared-permission-helpers.md` is now WON'T-DO. No code changed.*

*Previously 2026-06-14 — added row **34** (Avatar initials, convergence): mobile derives avatar initials from the raw address (opaque "AC") while desktop derives from the display name (emoji-aware, deterministic color) using `getInitials`/`getColorFromDisplayName` that ALREADY live in `@quilibrium/quorum-shared` (`src/utils/avatar.ts`) — both user AND space avatars route through one shared `UserInitials`, no duplication. Mobile never imports them. MED cost (component rewire: `DefaultAvatar` + ~13 call sites + extract `SpaceIcon` + an `expo-image` error-fallback wrapper), NONE shared (logic already published). Also fixes two existing mobile inconsistencies (address-junk initials; scattered `charAt(0)` space monograms). Task-dropped: mobile task file `2026-06-14-avatar-initials-display-name-from-shared.md`.*

*Previously: 2026-06-12 (pass 3b) — dropped tasks for the icon cluster. Rows 31/32/33 → 🚧 task-dropped: mobile task `quorum-mobile/.agents/tasks/2026-06-12-channel-group-icon-and-settings.md` (sub-task 0 = the bug fix; 1 = per-item settings drawer + gear-opens-channel-drawer; 2 = channel icon parity; 3 = group icon+color; 4 = DnD reorder, second pass) + shared task `quorum-shared-migration/2026-06-12-promote-icon-picker-vocabulary-to-shared.md` (move `ICON_OPTIONS`/`ICON_COLORS`/`FILLED_ICONS`/`getIconColorHex` into quorum-shared so both apps share one picker vocabulary). Tracker rows 7.1/7.2/7.3 added.*

*Previously: 2026-06-12 (pass 3) — channel/group icon parity + space-folders UX. Added rows 31 (channel icon picker under-featured: 20 vs 50 icons, no outline/filled variant, hex-vs-named-color), 32 (group icon+color entirely absent on mobile), and 🐛 33 (LIVE BUG — `app/(tabs)/spaces/[id]/index.tsx:118` hardcodes the default channel-list icon, ignoring `channel.icon`; root cause of "icons show default in the list"). Enriched the #25 space-folders entry with a UX decision: Telegram-style pill bar (recommended to prototype) vs porting desktop's drag-and-drop. Added a mobile-settings-UX note: consider per-channel/per-group drawers (cramped inline settings today). NOTE on read-only channels (#27): only a TASK PLAN exists (Wave 0) — no mobile code written yet.*

*Previously: 2026-06-12 (pass 2) — added a parity deep-dive on 5 user-flagged items: roles/permissions (found 3 live enforcement bugs 26a–c + read-only-channels #27, all rooted in mobile not consuming shared permission helpers), scroll-to-first-unread (#28), message highlighting (#29 link-jump convergence + #30 mention-viewport feature-port). Added a **Recommended sequencing** section (Wave 0 permission fix → Wave 1 mentions → Wave 2 standalone ports → Wave 3 rest). **Image+caption single-message: verified NO PORT NEEDED** — mobile already sends one message (logged as minor wire-format convergence only).*

*Previously: 2026-06-12 (pass 1) — added rows 3–25 + the cross-cutting mention-format finding + 5 detailed named-feature entries (threads, markdown, YouTube facade + setting, typing indicators, mentions cluster) from a structured cross-repo audit. Verified the uncertain `UserConfig` fields directly against shared `2.1.0-29` source (all present). Cross-referenced two findings already tracked as mobile tasks (DM profile sync; config read-back). Recorded desktop-chrome-specific exclusions.*

*Previously: 2026-06-12 — file created. Folded in the two entries from the former `port-from-mobile/desktop-better-than-mobile.md` (reply notification counts; per-space notification preferences) as `convergence`-type candidates, and reframed the doc to also hold `feature-port` candidates via a `Type` column. The standalone `desktop-better-than-mobile.md` was retired in the same change — its distinction is now a column here, not a separate file.*
