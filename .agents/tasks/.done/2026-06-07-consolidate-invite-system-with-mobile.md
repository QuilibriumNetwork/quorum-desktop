---
type: task
title: Consolidate desktop invite system with mobile (cryptographic logic + UX)
status: in-progress
branch: feat/consolidate-invite-system-with-mobile
created: 2026-06-07
updated: 2026-06-08
---

> **2026-06-08 follow-up note.** The §4 statement that "The join path already handles both public ... and private ... correctly" turned out to be wrong on **two** counts. Bug 1: the server response shape for `/invite/eval` had changed from a JSON-encoded string to a plain object, and desktop's `JSON.parse(inviteEval.data)` crashed on every public-invite join with `"[object Object]" is not valid JSON`. Bug 2: desktop was using the manifest's `ephemeral_public_key` to decrypt the eval, but the manifest's key gets rotated on every space update (kick/role/settings/channel) while the eval's doesn't — so any post-publish space update silently broke joining for everyone with the existing link. Mobile's join path handled both correctly already; we just didn't read it. Both bugs fixed in **PR #183** (task [`2026-06-08-fix-join-invite-link.md`](../2026-06-08-fix-join-invite-link.md)). Lesson for future "scope out the join path" decisions: actually diff desktop's `joinInviteLink` against mobile's equivalent before assuming parity.

# Consolidate desktop invite system with mobile

## 1. Summary

Desktop's invite system and mobile's invite system diverged. The lead (who owns mobile) shipped a simpler, cheaper model: public and private invites coexist on the same space, "Generate Public Link" doesn't rekey, and the UI surfaces a single modal with a segmented toggle.

This task aligns desktop with mobile's model: cryptographic behavior, UX, copy, and the underlying service-call sequence. Per the migration cross-repo workflow rule (2026-05-28: "when mobile has shipped a working pattern, mobile's pattern is the starting point"), mobile is the canonical reference here.

## 2. The actual logic gap

### Mobile model (`quorum-mobile/services/space/inviteService.ts`)

- **`generatePrivateInviteLink(spaceId)`** — pops one ticket from the local `evals` pool, bakes template + secret + hubKey + configKey into the URL. No state mutation beyond the smaller pool. URL form: `https://app.quorummessenger.com/#spaceId=...&configKey=...&template=...&secret=...&hubKey=...`.
- **`generatePublicInviteLink(spaceId)`** — reuses the **existing** space config key (line 332-339, "Use the EXISTING space config key (not a new one)"). Uploads exactly `MAX_PUBLIC_EVALS = 1` eval to the server keyed by `configPublicKey`. Re-uploads the manifest (so joiners see a current snapshot). Saves `space.inviteUrl` locally. No member rekey, no new keypair, no batch eval generation.
- Both functions can be called repeatedly in any order. Private invites continue to work after a public link exists. Public link regeneration produces an identical URL string (same `configKey`) — what changes is the server-side eval and the manifest.
- The owner-only check is implicit in `getSpaceKey(spaceId, 'owner')` failing for non-owners (throws "Only space owners can generate public invites").

### Desktop model (current — `src/services/InvitationService.ts`)

- **`constructInviteLink(spaceId)` (private)** — has a short-circuit at lines 58-60: `if (space?.inviteUrl) return space.inviteUrl;`. So once a public link exists, the "Send Private Invite" button silently sends the public URL to the DM. The user thinks they're sending a one-time link; they're not.
- **`generateNewInviteLink(spaceId, ...)`** — heavy. Generates a brand-new X448 config keypair, runs a full member rekey loop (one sealed envelope per existing member), pre-encrypts ~200 evals (one per remaining ticket), batch-uploads them. Re-uploads the manifest with the new config key. Saves the new `space.inviteUrl` with the new configKey embedded.
- Consequence: regenerating a public link on desktop produces a **different URL** (different configKey), invalidates the old URL, and is dramatically more expensive than mobile.

### Side-by-side

| Aspect | Mobile | Desktop today |
|---|---|---|
| Public-link generation cost | 1 server eval upload + 1 manifest upload | ~200 server evals + N member envelopes + new config keypair + manifest |
| Public-link configKey | Reuses existing | Generates new |
| Public-link URL string changes on regen | No (same configKey) | Yes (new configKey) |
| Old public link after regen | Same URL, fresh server eval | Different URL, old one is now a dead pointer |
| Private invite after public exists | Works (pops next local eval, returns full URL) | Silently returns public URL (short-circuit in constructInviteLink) |
| UI mode selection | Per-click via segmented toggle | Stacked sections; public mode is sticky |
| Member rekey on public gen | No | Yes |

The lead's mobile design is intentionally cheaper. We adopt it.

## 3. In scope

- **Stop generating `qm.one` URLs on desktop.** Mobile generates `https://app.quorummessenger.com/...` for all invite links and we're aligning with that. See §6.1 below for the concrete change in `@quilibrium/quorum-shared`.
- Rewrite `InvitationService.constructInviteLink` to **never** short-circuit on `space.inviteUrl`. Always generate a fresh one-time link from the local evals pool.
- Rewrite `InvitationService.generateNewInviteLink` to mirror mobile's `generatePublicInviteLink`:
  - Reuse existing space config key (no new keypair, no `saveSpaceKey` for 'config').
  - Upload exactly **1** eval (not ~200).
  - No member rekey loop, no sealed envelopes to existing members.
  - Re-upload the manifest encrypted with the existing config key, with a fresh timestamp.
  - Save `space.inviteUrl` locally.
- Redesign `src/components/modals/SpaceSettingsModal/Invites.tsx`:
  - Replace the two stacked sections with mobile's segmented toggle: **One-Time** / **Public Link**.
  - Single primary "Generate Invite Link" button; copy adapts to selected mode.
  - On generation, show the link box with **Copy** and **Share to DM** actions (share opens an inline conversation picker, same as mobile's `ShareInviteSheet`).
  - Show a small info/warning banner that adapts to the selected mode (one-time vs reusable, copy from mobile lines 274-278).
  - Keep "Generate New Link" available when a link is showing (regenerate same mode).
  - Owner-only gating for the Public option; non-owners see only One-Time.
- Fix the existing typo on line 248 ("Inivte" → "Invite") as part of the copy refresh.
- Update `.agents/docs/features/invite-system-analysis.md` to reflect the new model:
  - Remove the "system switch is permanent" warning section.
  - Update the "Eval Allocation" table (public gen now consumes 1 eval, not `members + 200`).
  - Update the "Current Public Invite Link UI Flow" section.
  - Update the "Can I go back to private-only mode" FAQ — no longer relevant, both coexist.
  - Update the `constructInviteLink` code snippet to remove the short-circuit.

## 4. Out of scope

- Promoting any invite code into `@quilibrium/quorum-shared`. The services-design audit (`2026-05-18-services-design.md` §12) explicitly puts `InvitationService.ts` in the "STAYS PER-APP" bucket: 904 LOC of React Query / `MutableRefObject` / Lingui coupling, plus `joinInviteLink` calls `queryClient.invalidateQueries` four times. Mobile already uses shared's invite domain helpers (`getInviteUrlBase`, `parseInviteParams`, `getValidInvitePrefixes`); desktop uses them too. That's already the right amount of sharing for this layer.
- Touching `joinInviteLink`. The join path already handles both public (no `secret`/`template`/`hubKey` in URL → fetches eval from server) and private (full crypto material in URL) correctly. The cleanup only affects generation, not consumption.
- Mobile-side changes. Mobile is already correct.
- The pre-assign-role-to-non-member feature (`2026-04-20-invite-with-role-design.md`) — that's a separate planned feature. This task neither blocks nor unblocks it.
- The legacy "Send Invite to Existing Conversations" picker (the `SearchableConversationSelect` block) — mobile's `ShareInviteSheet` is the new pattern but it has the same intent (pick a DM, send the link as a message). We adapt the UI to be more compact like mobile's, but keep the underlying `sendInviteToUser` call path. No change to `InvitationService.sendInviteToUser`.

## 5. Why this approach (vs alternatives)

Three options were considered:

1. **Match mobile fully (this task).** Highest alignment, cheapest runtime, makes the "system switch" go away. Requires changing both `constructInviteLink` and `generateNewInviteLink`. Best long-term: desktop and mobile converge on the same conceptual model, which makes the eventual `InvitationService` audit (if it ever moves into shared) clean.
2. Keep desktop's heavy regen, just remove the short-circuit. Smaller blast radius but leaves desktop and mobile cryptographically asymmetric (different `configKey` per regen on desktop, same on mobile). Future bugs around link sharing across platforms would become harder to reason about.
3. UX/copy only, no logic change. Doesn't actually solve the reported problem (user wants both link types to coexist). Toggle would be cosmetic since the short-circuit would still hijack private generation once public exists.

Picking #1.

### Why the lead's mobile model is safe to adopt

- **No data loss.** The local evals pool isn't deleted by the new public-gen path. Existing members aren't rekeyed (no need — the configKey didn't change). Manifests on the server stay decryptable by anyone who has the URL.
- **Joiner experience is unchanged.** `joinInviteLink` already handles both link shapes today; it doesn't care whether the eval came from a new configKey or the existing one. The decryption path is identical.
- **Trust signal.** The lead designs both apps and ships the mobile crypto. The migration playbook explicitly says: where mobile and desktop diverge on something the lead already shipped, follow mobile.

## 6. Concrete code changes

### 6.1 Desktop-only override: stop generating `qm.one` URLs

**Status check (verified 2026-06-07):**

- `quorum-shared/src/utils/inviteDomain.ts` `getInviteBaseDomain()` returns `qm.one` for hosts on `app.quorummessenger.com` (lines 26-29).
- `quorum-mobile/services/space/inviteService.ts` has its own hardcoded `INVITE_DOMAINS.production = 'app.quorummessenger.com'` (line 35) and does NOT use shared's `getInviteUrlBase` for generation — so mobile generates `https://app.quorummessenger.com/...` URLs regardless.
- `quorum-desktop` uses shared's `getInviteUrlBase` everywhere, so prod desktop currently generates `https://qm.one/...` URLs.
- Both apps accept both prefixes for parsing/joining, so cross-platform interop already works.

**Decision: do NOT touch `quorum-shared` in this task.** Override the prod host at the desktop call sites instead. Trade-off: small, contained patch in desktop; no cross-repo PR; no shared version bump. Cost: duplicates the "use long domain in prod" rule. Acceptable for now because there's a planned cleanup track in shared anyway.

**Change:** at the two desktop call sites that currently call `getInviteUrlBase` for invite generation (inside `InvitationService.constructInviteLink` and `InvitationService.generateNewInviteLink`), wrap the value so that when the returned domain is `qm.one`, we substitute `app.quorummessenger.com`. Easiest form: a small local helper in `InvitationService.ts`:

```typescript
function buildInviteBase(isPublic: boolean): string {
  const base = getInviteUrlBase(isPublic);
  // Match mobile: use the long prod domain, not the qm.one short one.
  // The shared helper still emits qm.one for back-compat with old code paths;
  // override here until shared is updated in a separate cross-repo PR.
  return base.replace('://qm.one/', '://app.quorummessenger.com/');
}
```

Then replace the two `getInviteUrlBase(...)` calls in `InvitationService.ts` with `buildInviteBase(...)`. Leave all other call sites of `getInviteUrlBase` (for example join-link validation paths in hooks, or display in `JoinSpaceModal`) untouched — those care about acceptance, not generation, and `getValidInvitePrefixes` already covers both hosts.

After this change:

- New desktop-generated invite URLs: `https://app.quorummessenger.com/#...` (matches mobile).
- New desktop-generated public links: `https://app.quorummessenger.com/invite/#...` (matches mobile).
- Old `qm.one` URLs still in the wild (from past generations) keep working — `getValidInvitePrefixes()` accepts both, and the `qm.one` short domain still redirects.
- Shared package: unchanged. No version bump needed for this part.

### File: `src/services/InvitationService.ts`

**`constructInviteLink` (lines 56-106) — remove the short-circuit:**

```typescript
async constructInviteLink(spaceId: string) {
  const space = await this.messageDB.getSpace(spaceId);
  // REMOVED: if (space?.inviteUrl) return space.inviteUrl;

  const config_key = await this.messageDB.getSpaceKey(spaceId, 'config');
  const hub_key = await this.messageDB.getSpaceKey(spaceId, 'hub');
  // ... rest unchanged: pops one eval, bakes the full URL
}
```

**`generateNewInviteLink` (lines 142-504) — major rewrite to mirror mobile's `generatePublicInviteLink`:**

- Drop `secureChannel.EstablishTripleRatchetSessionForSpace` call.
- Drop the `ch.js_generate_x448()` call for `configPair`. Use existing config key from `messageDB.getSpaceKey(spaceId, 'config')`.
- Drop the `filteredMembers` rekey loop (all the inner-envelope / SealSyncEnvelope / outbounds code).
- Replace the `for (let e = session.evals.shift(); e != undefined; ...)` loop with a single-eval encryption (mobile uses `session.evals.slice(0, MAX_PUBLIC_EVALS = 1)` — keep the same constant for parity).
- Manifest upload uses the existing configKey, fresh timestamp.
- Final `space.inviteUrl` uses the **existing** configKey, not a new one. So the URL string will be deterministic per space until/unless a future change replaces the configKey for other reasons.
- Pull the smaller eval-count out of the local pool (`session.evals = session.evals.slice(1)`) and persist.
- Remove the `enqueueOutbound` for outbounds (no rekey envelopes to send).

The Quilibrium SDK calls used by mobile (`encryptInboxMessage`, `signEd448`, `getPublicKeyX448`, `generateX448`) are all available on desktop via `channel_raw as ch` — no SDK gap.

### File: `src/components/modals/SpaceSettingsModal/Invites.tsx`

Replace the entire body of the `Invites` component with a mobile-inspired layout:

- Top: title "Invites", short description.
- Segmented toggle (use the `Switch`-style primitive or a custom inline two-button toggle — mobile uses a custom one, desktop can match using existing primitives).
- Info text adapts to selection (mobile copy:
  - one-time: "Generate a one-time use invite link. Each link can only be used by one person."
  - public: "Generate a reusable public invite link. Anyone with this link can join.")
- Primary button "Generate Invite Link" (or "Generate Public Link" when in public mode).
- After generation: `ClickToCopyContent` with the URL, plus a Share button that opens an inline picker of existing DMs (reuses the existing `getUserOptions()` flow that's currently inlined in the component).
- Below: small banner with the existing warning copy (mobile: "Anyone with this link can join. You can regenerate it at any time to invalidate the old link." or "This link can only be used once. Generate a new link for each person you want to invite.").
- "Generate New Link" secondary button.
- Owner-only gating: if not owner, hide the Public Link toggle (or disable it with a tooltip). Use existing `useSpaceOwnership` / `isSpaceOwner` logic that already exists for `generateNewInviteLink` callers.

Note: keep the legacy `useInviteManagement` hook surface; this is a UI-layer refactor on top of the same hook. The hook may need a small additional state field for the active toggle mode, but no breaking API change.

### File: `src/hooks/business/spaces/useInviteManagement.ts` (not read in this task)

May need a small change: when calling `invite()` (send-to-DM), the hook will need to know whether to construct a one-time URL or use the existing public URL. Today `constructInviteLink` short-circuits to public; after this change, it always builds one-time. So the "share" path needs to either:

- (a) call `constructInviteLink` for the one-time flow, or
- (b) use `space.inviteUrl` directly for the public-share flow.

The toggle in the UI determines which. The hook should expose two separate share-to-DM actions, OR accept a `mode: 'private' | 'public'` argument. Either is fine; prefer the explicit-argument variant for clarity at the call site.

### File: `.agents/docs/features/invite-system-analysis.md`

- Drop the "⚠️ System Switch Behavior" section (the model no longer applies).
- Update the "Evals (Polynomial Evaluations)" table:
  - "Generate public invite link" row: `1` eval (was `members + 200`).
  - "Kick user (rekey)" row: stays as-is (kick is a separate operation, not in scope).
- Update the "Current Public Invite Link UI Flow" section to describe the new toggle-based modal.
- Update "Can I go back to private-only mode after enabling public links?" FAQ — answer becomes "Not applicable: both modes coexist. You can always generate a fresh one-time link even when a public link exists."
- Add a short note: "As of 2026-06-07, desktop aligns with mobile's behavior — public-link generation is a 1-eval upload + manifest refresh, no member rekey."
- Update the `constructInviteLink` code snippet to remove the short-circuit and add a comment pointing to mobile parity.

## 7. Testing plan

Manual on web (Vite dev) first; Electron later.

### Private-only path (clean slate)

- Create a new space. Don't generate a public link.
- Send a one-time invite to a DM. Recipient joins. Confirm join works exactly as today.
- Generate another one-time invite. Confirm a different URL is produced. Recipient B joins.

### Public-then-private

- Create a new space. Generate a public link. Copy it.
- Without closing the modal, switch to One-Time toggle. Generate. Confirm:
  - The URL produced is different from the public one.
  - The URL is a full private link (`#spaceId=...&configKey=...&template=...&secret=...&hubKey=...`).
- Recipient A joins via the private link. Confirm join works.
- Recipient B joins via the public link. Confirm join works.
- Both end up in the space with no role.

### Public regen produces identical URL

- Space with existing public link. Click "Generate New Link" in public mode.
- Confirm the URL string is identical to the previous one.
- Have an old joiner click the old (= new = same) URL. Confirm they can still join.

### Cross-platform sync

- Create a space on desktop. Generate a public link.
- Open the same space on mobile. Confirm mobile sees the same `space.inviteUrl`.
- Generate a private link on mobile. Confirm desktop sees the local eval pool decremented (visible in pool size on next desktop private-gen attempt).

### Owner-only gating

- Sign in as a non-owner member. Confirm the Public Link toggle is hidden/disabled.
- Sign in as the owner. Confirm both toggles work.

### Manifest refresh

- Generate a public link. Confirm the server's manifest reflects current space state (rename the space, regenerate, then join from a fresh device — should see the new name on the join screen).

### Regression: existing public links from before this change

- Spaces created on the old desktop logic stored a `space.inviteUrl` built from a fresh-on-public-gen configKey, not the original space configKey. With the new logic, regenerating produces a URL built from the **original** configKey instead — different URL string.
- **Not a real concern in practice**: nearly all current real spaces were created on the mobile app, so they already follow the new model. The handful of desktop-created spaces with old-style public URLs are acceptable collateral: if their old URL silently stops resolving, that's fine.
- **Hard requirement**: the app must not **crash** on a space with an old-style `inviteUrl`. The link can become a dead pointer, but rendering the settings modal, opening the space, generating a new link, sending DMs, etc. must all keep working. This is easy to satisfy since `space.inviteUrl` is just a string we read — nothing in the new flow parses or relies on a specific configKey embedded in it.
- Confirm in testing: open a pre-existing desktop space that has an old `inviteUrl` set, open the Invites modal, verify it renders without errors, regenerate the link, verify the new URL replaces the old one cleanly.

## 8. Risks

- **The desktop rekey loop existed for a reason.** Best guess: it was an early-days "we don't fully trust the eval-reuse server behavior, so generate a fresh ratchet on every public gen" defensive move. Mobile's design (single eval, manifest refresh, no rekey) is the optimized version after the server behavior settled. We cannot pause on the lead's review for this change — we're shipping the alignment now. Mitigation: mobile has been running this exact model in production for months, so it's empirically safe. PR description still lists the open questions so the lead can flag anything when they next touch this code.
- **Existing desktop-created public links from before this change.** Not a real concern — almost all production spaces were created on mobile and already follow the new model. The only invariant: the app must not crash when it encounters an old-style `inviteUrl`. The old URL silently becoming a dead pointer is acceptable. Covered in testing.
- **i18n strings.** New copy needs Lingui marking + `yarn extract`. Standard part of the UI work.
- **`useInviteManagement` refactor blast radius.** The hook is already on the roadmap's "hardest" list. Resist scope creep — keep the refactor scoped to "add a mode argument to the share-to-DM mutation", don't try to split CRUD vs form-state in this PR.

## 9. Sequencing

Desktop-only PR on this branch (`feat/consolidate-invite-system-with-mobile`). Mobile and shared are untouched. Three commits:

1. **Service-layer rewrite.** `InvitationService.ts` only. New `generateNewInviteLink` mirrors mobile; `constructInviteLink` short-circuit removed; add the small `buildInviteBase` host-override helper (§6.1) and route the two generation call sites through it. tsc clean. Manual smoke: dev console can call both methods and produce both URL shapes, both with `app.quorummessenger.com` host.
2. **UI refactor.** `Invites.tsx` + any small `useInviteManagement` adjustment + i18n extract. Visual parity check with mobile (screenshot side-by-side in PR description).
3. **Docs.** Update `.agents/docs/features/invite-system-analysis.md`. Mention this task file. Last-updated footer.

Open PR to `main`, squash-merge per [[overview]]'s branch policy.

**Future cleanup (separate task, not in scope here):** when the cross-repo workflow allows, fix `getInviteBaseDomain()` in `quorum-shared` to emit `app.quorummessenger.com` directly and remove the desktop-side `buildInviteBase` override. That cleanup also unblocks the pending mobile task (`2026-05-29-mobile-rewire-invite-helpers-to-shared.md`) which wants mobile to use shared's helpers instead of its own hardcoded `INVITE_DOMAINS`.

Open PR after commit 3 to `main`. Squash-merge per [[overview]]'s branch policy.

## 10. Open questions for the lead

To raise in the PR description, not blockers for the design:

- The desktop rekey loop on public-link gen — was that intentionally defensive or just stale? (Confirms it's safe to drop.)
- Mobile's `MAX_PUBLIC_EVALS = 1` constant — was 200 the original number on both platforms, or did mobile start with 1 from the beginning?
- Any planned changes to the server-side eval-serving behavior (the "Option 2: server now serves the same eval to every joiner" comment in mobile's inviteService) that would invalidate the convergence?

---

## Implementation log (2026-06-07)

**Service layer** (`src/services/InvitationService.ts`):
- `constructInviteLink` short-circuit removed. Always builds a fresh one-time URL from the local pool.
- `generateNewInviteLink` rewritten to match mobile: reuses existing config key (no new keypair, no member rekey), uploads exactly 1 eval (`MAX_PUBLIC_EVALS = 1`), re-publishes manifest with fresh timestamp, then decrements the local pool only on success.
- Added `buildInviteBase()` helper to substitute `qm.one` → `app.quorummessenger.com` in generated URLs (matches mobile output). Acceptance of `qm.one` URLs remains unchanged.
- Added `InviteEvalsExhaustedError` typed error; thrown by both invite paths when the local pool is empty so callers can render a friendly banner.
- `sendInviteToUser` gained a `mode: 'one-time' | 'public'` parameter so the UI can choose between generating a fresh one-time link or forwarding the existing public URL.

**UI** (`src/components/modals/SpaceSettingsModal/Invites.tsx`):
- Replaced the two stacked sections with a segmented toggle (One-Time / Public Link) styled as underline tabs.
- One-time mode: DM picker + "Send Invite" primary action (one-shot pick-and-send), plus a "Generate Link" secondary action that produces and displays the URL for sharing outside Quorum.
- Public mode: link box + "Republish" secondary action (subtle-outline variant) with a plain-English tooltip + "Send via DM" expanding picker. First-time generation still gated by a confirmation modal. The button was renamed twice during this PR: first from "Refresh Link" → "Update Join Preview" (which overstated the user-visible effect), then to "Republish" after verifying that the manifest snapshot is already re-uploaded automatically on every save (`SpaceService.updateSpace` → `postSpaceManifest`). The button's UNIQUE behavior — the thing the normal save flow doesn't do — is `postSpaceInviteEvals` (server-side eval refresh). Practically, the button is a defensive escape hatch for the rare case where joiners report the public link isn't working. Confirmed parity with mobile: mobile's button (labeled "New") has the same architectural role, despite a misleading "invalidate the old link" caption.
- Owner-only gating on the Public toggle; non-owners see only One-Time.
- Pool-exhausted state: dedicated `Callout` banner + disabled actions. Banner copy points the user toward the public-link path when an `inviteUrl` already exists.
- Invites tab icon changed from `user-plus` to `share` to match mobile.
- Refresh-success callout separated from generation-success callout (different copy).

**Hook** (`src/hooks/business/spaces/useInviteManagement.ts`):
- Threads the `mode` parameter through to `sendInviteToUser`.
- Adds `generateOneTimeLink`, `generatedOneTimeLink`, `clearGeneratedOneTimeLink`, `generatingOneTimeLink`, `generateOneTimeLinkError` for the new Generate Link action.
- Proactively detects pool exhaustion on mount by reading the encryption state, exposes `poolExhausted` flag.
- Catches `InviteEvalsExhaustedError` from both invite paths and surfaces it via `poolExhausted` instead of generic failure text.

**Context** (`src/components/context/MessageDB.tsx`):
- Exposes `constructInviteLink` through the context so the UI can build a one-time URL without sending it.
- `sendInviteToUser` signature extended with the `mode` parameter.

**Confirmation modal copy** (`SpaceSettingsModal.tsx`):
- Simplified to first-time-generation only. Removed the conditional refresh-vs-generate text; refresh now bypasses the modal entirely.

**Tests** (`src/dev/tests/services/InvitationService.unit.test.tsx`):
- All 24 tests passing.
- Updated tests 1, 3, 6, 7 to reflect new behavior (no short-circuit, fresh one-time link even when `inviteUrl` exists).
- Added new tests covering: MAX_PUBLIC_EVALS = 1 upload count, existing config key reuse (no new keypair), no `postSpace`, no `getSpaceMembers`, no outbound rekey envelopes, manifest re-publish call, pool decrement, failure-doesn't-leak-pool, empty-pool error, non-owner gating, qm.one absence in generated URLs.

**Docs updated**:
- `.agents/docs/features/invite-system-analysis.md` rewritten to reflect the single-key model. Dropped the "system switch is permanent" warning. Updated eval allocation table. Updated FAQ.
- `.agents/bugs/2025-09-22-public-invite-link-intermittent-expiration.md` annotated as `likely-resolved-by-consolidation` (original "first 1-2 joiners succeed" symptom matches the old eval-pop-per-join behavior that the new server-side model removes).
- `.agents/tasks/.todo/2026-01-09-delete-public-invite-link.md` annotated with the consolidation context — task is still valid, narrower scope now.

**Out-of-scope items NOT done in this PR** (documented for follow-up):
- Recovery path for legacy spaces with drained local pools (real production spaces are on mobile and unaffected; not worth the UI surface).
- Auto-update of the manifest snapshot on space metadata changes — already in place via `SpaceService.updateSpace`. The "Republish" button is NOT redundant with this (it ALSO refreshes the server-side eval via `postSpaceInviteEvals`, which the save flow does not).
- Shared package change to make `getInviteUrlBase` emit `app.quorummessenger.com` instead of `qm.one` directly. Currently overridden at the desktop call site via `buildInviteBase`.

---

## Late-stage UI revision (same PR)

After the initial implementation landed in the codebase, multiple rounds of user feedback led to a One-Time mode redesign. The earlier iterations (recorded in the implementation log above) went through:

1. **Always-visible DM picker + Send Invite button + Generate Link secondary** — felt heavy, the two zones (link area + picker) read as disconnected.
2. **Generate-first-then-share, mirroring mobile** — added a `'reuse'` service mode so the displayed link could be DMed without minting fresh. User reported the displayed link could be sent to multiple recipients (mobile has the same footgun: link is single-use at the network level; second and later joiners silently fail). Investigated mobile's pattern thoroughly via an agent, confirmed mobile sends the same URL to all recipients with only a passive warning text.
3. **Final landed UI** — deliberately deviates from mobile to close the multi-recipient footgun:
   - **No displayed link box.** The one-time URL is never rendered on screen.
   - **Send via DM** (secondary) expands an inline picker. Each Send Invite click mints a fresh `'one-time'` URL invisibly. Multiple sends in a row each get independent unique URLs. Selected contact auto-clears after success.
   - **Copy a link** (subtle-outline) mints + writes to clipboard + shows a persistent "Link copied" callout. The URL is never displayed. 1.2s minimum spinner ensures the action is perceivable.
   - **Mutually exclusive success states.** Clicking either button clears the other's leftover UI (the Copy button collapses the DM picker AND clears the Invite-sent callout; opening the DM picker clears the Link-copied callout). Only one success state visible at a time.
   - **Persistent callouts.** No `autoClose` — user dismisses with the X.
   - **Underline-tab styling** for the mode toggle (no pill background); hover bumps to `rgb(var(--color-text-main))` for visible affordance.

### Service-layer impact

The `sendInviteToUser` signature added a `'reuse'` mode + `presetLink` arg during the generate-first iteration. The final UI never calls it (one-time sends use `'one-time'`; public sends use `'public'`). `'reuse'` is retained on the service surface because the architectural property is useful for future "review then send" patterns — see invite-system-analysis.md §3 for the rationale.

### Why we deviate from mobile here

Mobile's UI forces every one-time invite through a displayed-link flow and lets users send the same URL to multiple recipients with only a passive warning text. Mobile's pattern was traced thoroughly (`components/InviteModal.tsx`, `components/ShareInviteSheet.tsx`, `services/space/inviteService.ts`, `hooks/chat/useInviteManagement.ts`); the footgun is intentional UX, not a bug. The lead presumably accepted that warning-text approach as good enough.

On desktop we have the room for a different pattern that closes the footgun deterministically. The trade-off is a small platform divergence. If the lead pushes back, the simplest revert is to switch the "Send Invite" button's call from `mode='one-time'` to `mode='reuse'` with the displayed link as `presetLink` — restoring mobile's same-URL-to-many behavior — and reintroducing the displayed link box. The service layer already supports both patterns.

### Other late-stage polish

- **Republish tooltip** rewritten to plain English: *"If users report that this invite link isn't working, click to republish it. The link URL stays the same."* — replaces earlier wordings that overstated the user-visible effect.
- **Confirmation modals** removed for refresh/republish (state change is invisible; URL stays identical). First-time public-link generation still gated by a confirmation (genuine state change: the space becomes publicly joinable).
- **Tab icon** changed from `user-plus` to `share` to match mobile.
- **Pool-exhausted banner** copy adapts to mode — when in one-time mode with an existing public URL, it points the user to the Public Link tab; when already in public mode it omits the redirect to avoid the self-referential "switch above" instruction.
- **Generate-new-on-public-gen** decision: the saved encryption state template's `dkg_ratchet` is now deep-copied before mutation in `constructInviteLink` (mirrors mobile's defensive pattern). Without this, concurrent generations could leak mutated `ratchet.id`/`root_key` into the persisted template. Test asserts the saved template stays unmutated.

### Test additions

- 28 tests passing.
- Added: `mode='public'` happy path + missing-inviteUrl error, `mode='reuse'` happy path + missing-presetLink error.
- Updated: `constructInviteLink` deep-copy assertion (saved template stays at original `id`; only the URL-embedded template has the bumped `ratchet.id`).

*Created 2026-06-07. Implementation log appended 2026-06-07. Late-stage UI revision section appended 2026-06-07.*
