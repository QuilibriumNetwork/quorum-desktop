---
type: index
title: "Port from Mobile — Master Tracker"
status: ongoing
created: 2026-06-01
updated: 2026-06-01
---

# Cross-app feature diff (port-from-mobile) — Master Tracker

> **🔴 New session? Read these first, in order:**
> 1. **[workflow.md](workflow.md)** — workflow rulebook for this effort. Session branching, PR sizing, pulling all three repos, when to promote to shared, **mandatory capability-verification step** (read this — symbol-grep is not enough), "port the capability, not the UX pattern" rule. Re-read at the start of every session.
> 2. **[candidates.md](candidates.md)** — running list of mobile features that don't exist on desktop. Filter for what to pick next.
> 3. **[desktop-better-than-mobile.md](desktop-better-than-mobile.md)** — inverse inventory: capabilities where desktop's implementation is materially better than mobile's. Reference doc for the lead dev / future port-to-mobile work. Read when verifying that a candidate isn't already on desktop under a different name.
> 4. **[shipped-log.md](shipped-log.md)** — chronological history of what's been ported + lessons learned.

> **What this folder is.** Conceptually a **two-way feature diff** between `quorum-desktop` and `quorum-mobile`. Active work runs through [candidates.md](candidates.md) — features mobile has and desktop is missing, ported selectively to desktop. The sibling [desktop-better-than-mobile.md](desktop-better-than-mobile.md) tracks the inverse (capabilities where desktop is better), which we do NOT act on directly (mobile is read-only for this effort) but record so the lead dev has a curated convergence list when there's bandwidth.

> **What we do.** Pick features that make sense on desktop UX, port them, opportunistically promote pure logic to `@quilibrium/quorum-shared`. When porting, port the *capability*, not the mobile UX pattern (see workflow.md).

> **What we do NOT do.** We do NOT push code to `quorum-mobile`. Mobile is read-only context.

> **Relationship to [quorum-shared-migration/](../quorum-shared-migration/).** That folder moves existing code into shared. This folder is a two-way feature diff between apps. They overlap when a port surfaces shareable logic — in that case, follow the shared-migration's [cross-repo-workflow.md](../quorum-shared-migration/cross-repo-workflow.md) for the shared piece, and consider whether a `mobile-tasks-pending.md` entry over there is warranted (concrete swap task) vs. a `desktop-better-than-mobile.md` entry here (broader capability-shaped observation).

## Architecture principle

We are NOT trying to mirror mobile feature-for-feature. We pick features that:
1. Make sense on desktop UX (e.g. wallet / governance might, calling might not, voice notes might not).
2. Don't require a major desktop architectural shift to land.
3. Either already exist in `@quilibrium/quorum-shared` (easy port) or have portable pure logic worth promoting.

When a feature doesn't fit those criteria, we skip it — desktop doesn't need to be a mobile clone.

## Folder layout

```
port-from-mobile/
├── README.md                          ← this file (catalog: status table + pointers)
├── workflow.md                        ← workflow rulebook (read every session)
├── candidates.md                      ← mobile features not on desktop (running inventory + per-candidate notes)
├── desktop-better-than-mobile.md      ← inverse: where desktop is better than mobile (port-to-mobile candidates for the lead dev)
├── shipped-log.md                     ← chronological history + lessons learned
├── 2026-XX-XX-port-<slug>.md          ← active per-feature task files (date-prefixed)
└── .done/                             ← completed per-task files land here
```

**Doc separation of concerns** (no overlap):
- **README.md** = catalog. Status table of features being ported + pointers. What exists.
- **candidates.md** = mobile→desktop inventory + per-candidate notes/decisions. What we could pick.
- **desktop-better-than-mobile.md** = desktop→mobile inventory. Where desktop is better. Reference for the lead dev's future convergence work; we don't act on it directly.
- **shipped-log.md** = history. Chronological entries per port + lessons learned. What changed and why.

**Convention.** Per-feature executable tasks live at the root, dated `YYYY-MM-DD-port-<slug>.md`, and move into `.done/` once merged. Evergreen workflow/reference docs (workflow, candidates, shipped-log, README) live at the root WITHOUT date prefixes.

## Status table

Legend: ✅ done · 🟢 ready to start · 🚧 in progress · ⏸️ deprioritized · ❌ won't port · 📋 investigating

| Feature | Mobile location | Status | Reference |
|---|---|---|---|
| Unified /spaces page — PR 1 (My Spaces + Discover) (#1) | `app/(tabs)/spaces/discover.tsx`, `hooks/chat/useExploreSpaces.ts` (Discover only); My Spaces tab is desktop-original | ✅ shipped (PR #170, 2026-06-04) | [Task file](.done/2026-06-01-port-discover-spaces.md) · [candidates.md `#1`](candidates.md#1-discover-spaces--shipped-pr-170-2026-06-04) |
| Unified /spaces page — PR 2 (Join via link + Create space tabs + retire old modals) | Obsoleted by new UI shell (PR #171, 2026-06-03) | ❌ obsolete | [Task file](.done/2026-06-01-port-discover-spaces-pr2.md) |
| Public profile + remove `/discover/people` (#6) | `services/profile/publicProfile.ts`, `hooks/useUserPublicProfile.ts`, `hooks/useMembersWithPublicProfileFallback.ts` | ✅ shipped (2026-06-08) | [Task file](.done/2026-06-08-port-public-profile.md) · [candidates.md `#6`](candidates.md#6-public-profile-ui--shipped-2026-06-08) |
| Per-space profile bio override (#30) | `components/SpaceSettingsModal.tsx`, `services/space/spaceMessageService.ts` | ✅ shipped (PR #185, 2026-06-08) | [Task file](.done/2026-06-08-port-per-space-bio.md) · [candidates.md `#30`](candidates.md#30-per-space-profile-bio-override--shipped-pr-185-2026-06-08) |
| Reporting (#5) | `services/reporting/reportService.ts`, `components/ReportModal.tsx` | ⏸️ deprioritized | [candidates.md `#5`](candidates.md#5-reporting---deprioritized-but-engineering-ready) |
| Message search (#2) | — | ❌ already on desktop | [candidates.md `#2`](candidates.md#2-message-search--ruled-out-class-e) |
| Reply tracking (#3) | — | ❌ desktop strictly better | [desktop-better-than-mobile.md #1](desktop-better-than-mobile.md#1-reply-notification-counts) |
| Last-message-preview / spaces sort (#4) | — | ❌ UX-pattern conflict | [candidates.md `#4`](candidates.md#4-last-message-preview--spaces-list-sort--wont-port) |
| OG metadata (#8) | — | ⚠️ Farcaster-only on mobile | [candidates.md `#8`](candidates.md#8-og-metadata--farcaster-only-on-mobile) |
| Skins / custom themes (#27) | `components/skins/*`, `services/skins/*`, `theme/skins/*` | ❔ needs UX call | [candidates.md `#27`](candidates.md#27-skins-custom-themes---needs-ux-call-low-priority-2026-06-10) |
| On-device translation (#28) | `modules/quorum-translation/*`, `services/translation/*`, `components/translation/*` | ❔ needs UX call | [candidates.md `#28`](candidates.md#28-on-device-translation---needs-ux-call) |
| Non-owner read-only access to public invite URL (#29) | `app/(tabs)/spaces/[id]/index.tsx` (header), `components/InviteModal.tsx` | ✅ shipped (PR #182, 2026-06-08) | [Task file](.done/2026-06-08-port-non-owner-invite-view.md) · [candidates.md `#29`](candidates.md#29-non-owner-read-only-access-to-public-invite-url--shipped-pr-182-2026-06-08) |
| QNS usernames — DM search + profile `.q` + `.q`-suffix validation (scoped slice of #12) | `services/api/qnsClient.ts` (resolution only), `hooks/useQNS.ts`, `components/NewConversationModal.tsx`, `UnifiedProfileHeader.tsx` | ✅ shipped (PR #190, 2026-06-10) — 🚧 display model (A vs B) + mentions pending lead-dev call | [Design](2026-06-10-qns-username-display-design.md) · [Plan](2026-06-10-qns-username-display-plan.md) (PROGRESS section) · [candidates.md `#12`](candidates.md#12-qns-marketplace--auctions) |
| Onboarding key import — paste hex / paste 24 words (#31) + copy-key in settings | `app/(onboarding)/account-setup.tsx`, `components/onboarding/HexInputView.tsx`, `components/ProfileModal.tsx` (copy), `components/onboarding/MnemonicInputView.tsx`, `services/onboarding/keyService.ts` | 🟢 paste-hex + copy-hex ready (UI-only, task drafted) · ❔ 24-words needs product call (#31b) | [Task file](2026-06-11-port-key-paste-import-and-copy-export.md) · [candidates.md `#31a`](candidates.md#31a-onboarding-paste-private-key-hex--engineering-ready) · [candidates.md `#31b`](candidates.md#31b-onboarding-paste-recovery-phrase-24-words--needs-a-product-call) |

## Next up

**🚧 One port in flight (blocked on a lead-dev call): QNS usernames.** PR #190 shipped the model-independent core (DM search by `@username`, `.q`-suffix validation, and a Model-A profile `.q` render). Two pieces remain, both gated on the lead dev's reply to the **display-model question** (asked via Telegram 2026-06-10 — "should a user's primary QNS name override their display name everywhere, except per-space overrides?"):
1. **Display-model rework** — if the answer is "primary name everywhere" (Model B, the author's preference), route every name-render through the shared `resolveDisplayName` helper instead of the current secondary-handle treatment.
2. **Mentions by QNS name (Stage 4)** — not started; same decision gates it.

Resume point + full state: [`2026-06-10-qns-username-display-plan.md`](2026-06-10-qns-username-display-plan.md) → "PROGRESS" section. Note: live `.q` display is also blocked by two **mobile** bugs (primary_username not synced/published; isProfilePublic not syncing) — filed in mobile's `.agents/bugs/`; desktop render is correct and lights up once mobile publishes the field.

Otherwise the actionable list is intentionally empty (user call, 2026-06-10): #5 Reporting and #27 Skins are both low priority. See [candidates.md → Actionable now](candidates.md#actionable-now) for the always-current pick-next view.

State of the remaining candidates:

- ⏸️ **#5 Reporting** — engineering-ready (capability-verified missing, ~195 LOC + a modal), but deprioritized. Cleanest pick-up if trust/safety moves up. Bundles the deferred Ed448 signing-helper shared-promotion (second call site).
- ❔ **#27 Skins (custom themes)** — full skin engine on mobile (~2000+ LOC, gallery with Ed448-signed publishes). Low priority + needs a product-scope call (app-wide vs per-space, editor parity, gallery on day one).
- ❔ **#28 On-device translation** — native iOS/Android modules; a re-implementation, not a port (cloud = privacy regression, WASM = size cost). Needs a product-scope call.
- ❔ **Big-surface cluster** — #9 Farcaster, #13 Wallet, #14 Calling, #15 Audio spaces, #16 Miniapps, #17 Governance. Each needs a yes/no/later before engineering. See [candidates.md → Awaiting a product-scope call](candidates.md#awaiting-a-product-scope-call).
- 🚧 **#12 QNS** — the full marketplace (registration/auctions/pricing) is still ❔ a product call, but a **scoped slice shipped** (PR #190): resolution-only, powering DM-search-by-`@username` + verified-name display. The full marketplace remains unscoped.

Everything else is ❌ already-on-desktop / won't-port — see [candidates.md → Resolved archive](candidates.md#resolved-archive).

**Follow-up from #29 — resolved.** The `InvitationService.joinInviteLink` crash (`"[object Object]" is not valid JSON`) surfaced while smoke-testing #29 was fixed in PR #183 (`fix(invites): joinInviteLink handles new eval response shape + uses eval's ephemeral key`) and the related invite bugs were closed out in PR #184.

When picking up the next port-from-mobile session: start from [candidates.md → Actionable now](candidates.md#actionable-now), run the capability-verification step from [workflow.md](workflow.md#capability-verification--mandatory-before-drafting-a-task), and for any "non-owner can X" candidate run the service-layer-gate + manifest-replication check (lesson recorded in [candidates.md `#29`](candidates.md#29-non-owner-read-only-access-to-public-invite-url--shipped-pr-182-2026-06-08)).

## Branch / session workflow

- **[workflow.md](workflow.md)** — full rules. Headline: session branches (`session-YYYY-MM-DD`), rename on ship, pull all three repos first, feature-scoped PRs.

## Open questions / parking lot

(Add anything that doesn't fit yet but might matter later.)

---

*Last updated: 2026-06-11 — **Drafted the #31a task** ([key paste-import + copy-export](2026-06-11-port-key-paste-import-and-copy-export.md)), folding in the copy-private-key companion (desktop can only download the `.key` file; mobile copies to clipboard; `getPrivateKeyHex()` already exists and is wired into Security.tsx) plus a Security-tab UI consolidation (download/copy/QR are three actions on one secret). Both halves UI-only — one PR. #31b (24 words) parked on a lead-dev call. Updated the status-table row + linked the task.*

*Previously: 2026-06-11 — **Added #31 Onboarding key import** to the status table (paste hex private key / paste 24-word recovery phrase). User-surfaced, capability-verified missing on desktop (`ImportKeyStep` is file-upload-only). Split: #31a hex-paste is 🟢 engineering-ready and UI-only (the SDK's `importKeyFile` already parses a 114-char hex string — no SDK or shared change needed); #31b 24-words is ❔ a product call (BIP-39 derivation lives only in mobile, needs shared promotion + a recoverability decision). Logged in candidates.md, not built yet (user call).*

*Previously: 2026-06-10 — **QNS usernames shipped** (PR #190, scoped slice of #12): DM search by `@username` (verified live), `.q`-suffix display-name validation, and a Model-A profile `.q` render. Added a status-table row; rewrote "Next up" to reflect the in-flight follow-up (display-model A-vs-B decision + Stage 4 mentions, both blocked on a lead-dev Telegram call) instead of "no port in flight"; reframed the #12 cluster line (full marketplace still unscoped, slice shipped). Two mobile bugs block live `.q` (filed in mobile `.agents/bugs/`). Resume point: `2026-06-10-qns-username-display-plan.md` PROGRESS section.*

*Previously: 2026-06-10 — **candidates.md reorganized** by actionability (status board → actionable → awaiting product call → resolved archive → reference); README status table + "Next up" + cross-anchor links updated to match. Added the #30 per-space-bio row (shipped PR #185) to the table. Marked the #29 join-bug follow-up resolved (PR #183 + #184). Per-candidate decision notes were preserved (moved, not deleted). User call: #5 Reporting and #27 Skins both low priority — no port in flight, actionable list intentionally empty.*

*Previously: 2026-06-08 — **#29 Non-owner read-only access to the public invite URL shipped** (PR #182). Branch `feat/port-non-owner-invite-view-from-mobile`. Task file moved to `.done/`. Smoke test surfaced a pre-existing crash in `InvitationService.joinInviteLink` (line 593) — unrelated to this port; fixed separately in PR #183. Status table flipped to ✅ shipped.*

*Previously: 2026-06-08 — `session-2026-06-08-2` re-audited mobile against the previous baseline (`0fa63d4` 2026-05-30 → `ccd69e6` 2026-06-02). Three new candidates added: **#27 Skins**, **#28 On-device translation**, **#29 Non-owner read-only access to public invite URL**. #29's framing took three rounds with the user — original assumption ("non-owners can generate") was wrong; the real model is "owner publishes once → manifest sync replicates the URL to every member's local Space → non-owners read-only display."*

*Previously: 2026-06-08 — #6 Public profile UI shipped. Branch `feat/port-public-profile-from-mobile`. Task file moved to `.done/`. Status table flipped to ✅ shipped; `Next up` reset to "no port in flight". Code-review pass during shipping caught a publish/rollback consistency hole new to desktop (post PR #180's fire-and-forget enqueue) and fixed it before merge. Captured the lesson in shipped-log.*

*Previously: 2026-06-08 — #6 Public profile UI picked up on `session-2026-06-08`. Scope clarified during pickup: backend has no user-enumeration endpoint, so neither app has a profile directory. The port = publish toggle + DM-header resolve-by-address + member fallback resolver. Bundled: removal of speculative `/discover/people` + simplified Discover chrome. Status table updated to reflect #1 shipped and PR 2 obsolete.*

*Previously: 2026-06-01 — discover-spaces port scoped up to a unified `/spaces` page; PR 1 task file drafted with all 11 design decisions locked; PR 2 task file drafted alongside it (deferred status) to preserve the same-session design context.*

*Previously: 2026-06-01 — reframed as a two-way feature diff after several "same capability under different names" discoveries. Added [`desktop-better-than-mobile.md`](desktop-better-than-mobile.md). Capability-verified #6 and #1 missing on desktop; user picked #1 as first port. #2, #3, #4, #8 ruled out for various reasons (see status table).*
