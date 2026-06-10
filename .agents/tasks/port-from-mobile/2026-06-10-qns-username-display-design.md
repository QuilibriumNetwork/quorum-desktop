---
type: design
title: "QNS usernames on desktop — display, search, mention & trust model"
status: draft
created: 2026-06-10
related-candidate: "#12 (QNS marketplace) — this is a scoped slice; see candidates.md"
---

# QNS usernames on desktop — design

## Summary

Bring Quilibrium Name Service (QNS) usernames into `quorum-desktop` across four surfaces:

1. **DM search** — find and start a DM with someone by typing their `@username`.
2. **Profile cards** — show a user's QNS name (as `name.q`) when they have one published.
3. **Mentions** — mention space members by their QNS name; mention pills render the QNS name.
4. **Trust + validation** — the `.q` suffix is an unspoofable signal that a name is QNS-registered.

The unifying idea: **one name per context, with a single shared resolution rule**, and the QNS `.q` handle as a render-time trust marker that custom names are forbidden from imitating.

This is a **scoped slice of candidate #12 (QNS marketplace)** — it pulls in only the QNS *resolution* path (1 endpoint), not registration/auctions/pricing/marketplace.

## Background — what's real vs. dormant on mobile

Verified by reading `quorum-mobile` source (2026-06-10):

- **DM-by-`@username` is real and works.** `NewConversationModal.tsx` detects an `@` prefix, calls `useResolveName` (`GET /resolve/:name`), and derives a `Qm…` address from the returned `resolveKey` via `deriveAddress`. **This is a true port.**
- **QNS name in profile cards is scaffolded but NOT plumbed.** `UserProfileModal` / `UnifiedProfileHeader` contain `{user.primaryUsername && …}` render code, but the in-space member-tap path feeds them a `MessageUserInfo` object whose type (`components/Chat/MessagesList.tsx:28`) **has no `primaryUsername` field**. So tapping a member in a space shows display name + Farcaster handle + address, never the `.q` name — confirmed against a live user who has a QNS name. The username only renders on the user's **own** account screen. **Porting "username in profile" = making it work, i.e. net-new plumbing, not a port.**
- **Mention-by-username does not exist on mobile.** `primaryUsername` is never referenced in `components/Chat/`. Mention render order is `display_name || name || address`. **Net-new.**
- **No dot/`.q` validation exists on mobile.** The only "reserved name" logic is QNS registration invite-codes. Mobile's `.q` signal is therefore currently spoofable. **We will do this more safely than mobile.**

Ground-truth confirmed by the user via the live QNS site: **QNS names cannot contain dots.** This makes the `.q` trust signal airtight (see Trust model).

## The name model

### Resolution rule (the spine of the whole feature)

For any user, viewed by anyone, the **readable name** is resolved most-specific-first:

```
per-space display-name override  →  QNS primary_username  →  global display name  →  truncated address
```

- The **display names** (global + per-space override) are *presentation* — what a person wants to be casually called, chosen per context.
- The **QNS username** is *proof* — a verified, owned, globally-unique identity.
- The **address** is ground truth, shown only when there is no name at all.

There are **no checkboxes and no toggles.** Rationale (debated and rejected during brainstorming):

- A "use my QNS name instead of my display name" checkbox in user settings is a setting whose answer is the same for almost everyone (if you registered a QNS name, you want to be known by it). Cut.
- A per-space "be found by QNS vs. space name" toggle is redundant with the override itself: **typing a per-space name IS the opt-out.** A user who wants to stay disconnected from their QNS identity in a space simply sets a space display name; absence of one means their QNS name shows. The override's presence/absence *is* the privacy control.

Once a user has a QNS name, the **global display-name field becomes the fallback for the unregistered** — dead weight for that user, not deleted, just unused in resolution.

### The `.q` handle and trust model

- The QNS name is stored **bare** (`niccolo`). The `.q` suffix is **appended only at render time** (`` `${primaryUsername}.q` ``), in **accent color**. This mirrors mobile's `UnifiedProfileHeader` (the richer of mobile's two inconsistent treatments). **No badge** — the suffix is the signal.
- **What `.q` guarantees:** "this name is QNS-registered." It does **not** guarantee "this is the specific human you remember" — confusable registered names (e.g. `niccolo` vs `niccolò`) are a QNS registration-uniqueness matter, out of scope here. The UI must not imply more than "registered."

### Validation (what makes `.q` unspoofable)

Custom display names — **both** the global one (`UserSettingsModal/General.tsx`) and the per-space override (`SpaceSettingsModal/Account.tsx`) — must be rejected if, **after normalization**, they contain a dot.

- **The rule is: reject any dot in a custom name** (not merely the `.q` suffix). QNS names are dotless, so a dot in stored custom text is never legitimate. Forbidding all dots reserves the dotted namespace entirely for verified names and is visually clean ("only verified names have dots"). (Forbidding only the `.q` suffix would be the bare minimum, but this spec adopts the stronger all-dots rule. The only thing the plan still confirms is that there is no legitimate desktop use of dots in display names — none is known.)
- **Normalization before the check is mandatory** (else trivially bypassed): trim whitespace, and fold Unicode confusables (lookalike dots like `﹒`, `．`, full-width chars) to ASCII before testing. A naive `endsWith('.q')` on raw input is theater.
- This validation is **net-new** (mobile has none). It hooks into the existing validation pattern — `SpaceSettingsModal/Account.tsx` already imports `MAX_BIO_LENGTH` from `hooks/business/validation` and already surfaces a `displayNameError` prop; the global field in `General.tsx` gets the equivalent.

## Per-surface behavior

### 1. DM search by `@username`

- `NewDirectMessageModal.tsx` (today: single raw-address input, delegates to `useDirectMessageCreation`) gains `@`-prefix detection.
- On `@`-prefixed input: call the shared resolver (`resolveName`), then derive the `Qm…` address from the returned `resolveKey`. Show resolution status (resolving / resolved-as / not-found).
- The conversation is created against the **resolved address** (unchanged storage model); the conversation's displayed name follows the resolution rule (so it shows `niccolo.q`).
- Raw `Qm…` addresses keep working exactly as today.

### 2. Profile cards

- Plumb `primary_username` from the v2 public-profile payload (desktop's `PublicProfileResponse` in `api/baseTypes.ts` **already has the field** — `PublicProfileService` just never reads it for display, and publishes v1 dropping it).
  - **Read side:** surface `primary_username` into the member/profile data used by profile UI.
  - **Publish side:** desktop should start publishing v2 with `primary_username` when the local user has a QNS name (today it hard-codes v1 — `PublicProfileService.ts:22-23`).
- Profile card shows the resolved readable name as the primary line, and the `.q` handle (accent color) alongside the address — matching the in-space tap surface mobile *intended* but never plumbed.

### 3. Mentions

- **Autocomplete picker:** the candidate list (space members) carries the QNS name and the picker searches it, so you can type `@nic` and match `niccolo.q`. Requires the same `primary_username`-into-member-data plumbing as the profile surface (shared dependency, not extra).
- **Mention pill render:** stored token stays `@<address>` (unchanged wire format — settled). The pill *displays* via the resolution rule, so it shows the `.q` name when appropriate and updates live as names change (no frozen text).
- **Scope limit (held deliberately):** you can mention **space members only**. We do **not** add live QNS resolution into the compose path; mentioning a non-member stranger by QNS name is a separate, larger feature, out of scope. This keeps mentions cheap: no new network calls, no compose-time resolution, no storage change.

### 4. The "different name in space vs. DM" situation

Accepted as **honest, not a bug.** A person can be "Nic (mod)" in a space (their chosen costume there) and `niccolo.q` in a DM (their verified identity). The **address underneath proves it's the same person** across both. Optional post-v1 polish: a one-time reconciliation hint in the DM ("niccolo.q — Nic (mod) in #devspace"). Not in v1.

## Hard constraint: do not break mobile

**`quorum-mobile` must behave exactly as it does today after this lands — no functional change, no build break.** This is a non-negotiable acceptance criterion, not a best-effort.

The risk is confined to `quorum-shared` (the only code both apps share). Desktop-only files — `NewDirectMessageModal`, `PublicProfileService`, the settings-modal validation, the desktop mention pill/autocomplete — carry **zero** mobile risk; mobile never imports them.

Insulation already in our favor (verified 2026-06-10):

- **Mobile consumes shared as a *published* version**, not a local link: `quorum-mobile/package.json` pins `"@quilibrium/quorum-shared": "2.1.0-20"`. Therefore **nothing in the shared working tree reaches mobile until (a) a new version is published and (b) mobile explicitly bumps its dependency.** Mobile is insulated by default.
- **`PublicProfile` in shared already has `primary_username?: string`** (`src/types/user.ts`), and `SpaceMember = UserProfile & {…}`. So plumbing the field may need no type change at all; if it does, it's an additive optional field.

Guardrail rules for the shared work (enforce in the plan + review):

1. **Additive only.** New files for the resolver and the resolution helper. **Do not edit existing shared modules that mobile consumes**, do not change existing exports/signatures, do not move or rename anything mobile imports.
2. **Shared type changes must be additive + optional.** Only add `?:`-optional fields. Never make a field required, never rename/reshape an existing field. (Optional fields are provably non-breaking: existing object literals and existing readers are unaffected.)
3. **Do not route mobile's existing code through the new helper.** Mobile keeps its own QNS client and its own name ordering. The new shared helper is consumed by desktop only for now. Converging mobile onto it is explicitly out of scope (a future port-to-mobile item).
4. **Verification before any mobile version bump:** build + typecheck `quorum-mobile` against the new shared version and confirm no behavioral diff. Mobile bumps the dependency only after this passes. Until then mobile stays on its current pin and is unaffected.

## Architecture

### The shared name-resolution helper (single source of truth)

A pure function in `@quilibrium/quorum-shared` (alongside `src/utils/mentions.ts`) implementing the resolution rule. **Every surface calls it** — profile card, DM header, mention pill, mention autocomplete. This deliberately eliminates the drift mobile has between its two profile components.

Shape (illustrative, finalize in plan):

```
resolveDisplayName(member, { spaceId? }): { name: string, isQnsVerified: boolean }
  // most-specific-wins; isQnsVerified true only when the chosen name is the QNS username
```

The `.q` suffix + accent styling is applied by the **rendering layer** based on `isQnsVerified`, not baked into the returned string (keeps the helper pure and platform-agnostic).

**This helper is the spine and the highest-risk unit** — it is the single point all four surfaces depend on. It must be unit-tested hard (every precedence branch, the empty-name fallback, the verified flag).

### The minimal QNS resolver (in shared, from the start)

Per the user's decision, the resolver lives in `@quilibrium/quorum-shared` from day one (not desktop-local-then-promote). Mobile keeps its own 1235-LOC client for now; this is a fresh minimal resolver, not a replacement of mobile's.

Surface (the only QNS endpoint v1 needs):

```
QNS_BASE_URL = 'https://names.quilibrium.com'
GET /resolve/:name  →  { header, address, resolveKey?, metadata }   // resolveKey = hex ed448 pubkey
  React Query: key ['qns','resolve', name], staleTime 5 min
```

Plus `deriveAddress(resolveKeyHex) → Qm…` (port mobile's `services/onboarding/keyService.ts:105` derivation; check whether an equivalent already exists in shared crypto before porting).

`reverseLookup` (`GET /reverse/:keyOrAddress`) is **NOT needed for v1** — Capability 2/3 get the name from the published profile (Route A), not a live reverse-lookup.

### Data flow (sourcing — "Route A", mirrors mobile)

The QNS name reaches other users' apps by **riding along in the published public profile**, not via per-render QNS calls:

```
User picks QNS primary name  →  stored locally
  →  published in their signed public-profile payload (v2, primary_username field)
  →  other apps fetch that profile (already do, for avatar/name)  →  receive primary_username
  →  stored in member data  →  resolution helper reads it  →  rendered as name.q
```

Consequence (accepted): a displayed QNS name is only as fresh as the user's last profile publish. If a name is transferred away without a re-publish, the stale *label* lingers — but the *address* underneath stays correct, so a mention/DM still targets the right person. Worst case is a stale label, never a wrong target.

## Scope honesty (port vs. net-new)

| Surface | Nature | Notes |
|---|---|---|
| DM search by `@username` | **True port** | The one genuinely-working mobile feature. Needs the resolver + `deriveAddress`. |
| Profile `.q` display | **Net-new** | Mobile scaffolds but never plumbs `primaryUsername` to the in-space view. We make it work + add v2 publish. |
| Mentions by username | **Net-new** | Mobile never does this. Reuses profile plumbing + the resolution helper. |
| Dot validation | **Net-new** | Mobile has none; its `.q` is spoofable. We close that. |
| Resolution helper | **Net-new (shared)** | The spine; replaces mobile's per-component ad-hoc ordering. |

## Out of scope (v1)

- QNS registration / marketplace / auctions / pricing (the rest of candidate #12).
- Live QNS resolution in the mention compose path (mention non-members by QNS name).
- `reverseLookup` usage.
- The DM reconciliation hint (space-name vs. DM-name) — post-v1 polish.
- Replacing mobile's QNS client with the shared resolver (mobile keeps its own for now).

## Open items to settle in the plan

- **`deriveAddress`:** confirm whether shared crypto already exposes an ed448-pubkey → `Qm…` derivation before porting mobile's.
- **PR staging:** likely (1) shared resolver + resolution helper + tests, (2) DM search, (3) profile display + v2 publish + validation, (4) mentions. Finalize in writing-plans. The helper + resolver land first because everything depends on them.

## Risks

- **The resolution helper is a single point of dependency for four surfaces.** Mitigation: it's a small pure function with exhaustive unit tests; land it first with tests before any surface consumes it.
- **v2 publish change touches the public-profile signing payload.** Must match the server's expected v2 canonical form exactly (`public-profile-v2:address:displayName:profileImage:bio:primaryUsername:` + timestamp, per mobile's `publicProfile.ts:94`). Cross-check the desktop `PublicProfileService` signing against mobile's before shipping.
- **Cross-repo coordination:** resolver + helper live in `quorum-shared` → require a shared branch/PR per the established workflow before desktop can consume them.
- **Breaking mobile** (see [Hard constraint](#hard-constraint-do-not-break-mobile)). Mitigation is structural: mobile is pinned to a published shared version so it can't be affected until it bumps; all shared changes are additive-only + optional-only; mobile is built/typechecked against the new shared version before any bump. Mobile must behave identically afterward.

---

*Last updated: 2026-06-10*
