---
type: doc
title: Invite System Documentation
status: done
ai_generated: true
created: 2026-01-09T00:00:00.000Z
updated: 2026-06-07T00:00:00.000Z
---

# Invite System Documentation

> **⚠️ AI-Generated**: May contain errors. Verify before use.

## Overview

The Quorum desktop application supports two invite link formats for spaces: **one-time** (private) and **public**. Both formats coexist on the same space — generating a public link does NOT block one-time invites, and either format can be sent to a contact via DM. This document explains how the invite system works, its architecture, and behavioral considerations.

> **Consolidation note (2026-06-07):** desktop's invite logic was realigned with mobile (`quorum-mobile/services/space/inviteService.ts`). Previously, generating a public link rekeyed all members, minted a new config keypair, uploaded ~200 evals, and silently hijacked the "send private invite" button. After consolidation, public generation reuses the existing config key, uploads exactly 1 eval, refreshes the manifest, and both invite formats remain available in parallel. See [`tasks/2026-06-07-consolidate-invite-system-with-mobile.md`](../../tasks/2026-06-07-consolidate-invite-system-with-mobile.md).

## Architecture Overview

The invite system operates through several key components:

### Core Components

1. **SpaceSettingsModal/Invites.tsx** - Main UI for managing invites (`src/components/modals/SpaceSettingsModal/Invites.tsx`, 476 lines)
2. **useInviteManagement.ts** - Hook managing invite state and logic
3. **useInviteValidation.ts** - Hook for validating invite links
4. **useSpaceJoining.ts** - Hook for joining spaces via invites
5. **InvitationService.ts** - Encapsulates core invite-related business logic and interacts with MessageDB for persistence.
6. **MessageDB Context** - Provides access to InvitationService and other services.
7. **InviteLink.tsx** - Component for displaying and processing invite links

### Data Flow

1. **Invite Creation**: Handled by `InvitationService` via `generateNewInviteLink()`
2. **Invite Sending**: Sent via `sendInviteToUser()` to direct message conversations (logic likely within `MessageService` or `InvitationService`)
3. **Invite Processing**: Links parsed and validated through `useInviteValidation` hook
4. **Space Joining**: Users join via `InvitationService`'s `joinInviteLink()` function

## Invite Types and Behavior

### One-Time vs Public: Key Differences

| Aspect | One-Time Invite | Public Invite |
|--------|-----------------|---------------|
| **Eval lives where** | Embedded in the URL | Uploaded to server, keyed by `configPublicKey` |
| **Eval consumed when** | Link is **generated** | Link is **generated** (1 server-side eval per regen) |
| **URL changes each generation** | Yes (unique `secret` + `template` each time) | No (deterministic per space — same configKey reused) |
| **One link = how many people** | 1 person per link | Unlimited until regenerated |
| **Crypto material in URL** | Full (`template`, `secret`, `hubKey`) | Minimal (`configKey` only) |
| **How joiner gets crypto material** | Embedded in URL | Fetched from server via `getSpaceInviteEval()` |
| **Available alongside the other type?** | Yes — coexist freely | Yes — coexist freely |

### One-Time Invites

One-time invites are sent directly to users via existing conversations or manual address entry. Each link contains all the cryptographic material needed for exactly one person to join.

**Characteristics:**
- **One link per person**: Each generated link contains a unique `secret` that can only be used once
- Sent through direct messages or shared out-of-band
- **Eval consumed on generation**: Each one-time invite consumes one secret from the local `evals` array
- **Limited supply**: Spaces have a finite pool of secrets (~10K from space creation)
- URL contains all crypto material needed to join (no server fetch required)

### Public Invite Links

Public invite links are shareable URLs that anyone can use to join a space. They reuse the space's existing config key.

**Characteristics:**
- **Same URL for everyone**: Share one link with unlimited people
- **Eval consumed on join**: When someone uses the link, the server returns the stored eval; the same eval is served to every joiner (one eval per public-link generation)
- Can be shared anywhere (social media, websites, etc.)
- Regeneratable: re-uploads a fresh eval and a fresh manifest snapshot to the server. The URL string itself is unchanged because the configKey is unchanged.

## How the System Behaves

### Coexistence model (current, as of 2026-06-07)

Public and one-time invites are independent capabilities on the same space:

1. **Generating a public link**: reuses the existing config keypair, uploads exactly 1 server-side eval, re-publishes the encrypted manifest with a fresh timestamp, saves `space.inviteUrl` locally. **Does not** rekey members or invalidate the local one-time evals pool.

2. **Generating a one-time link** (`constructInviteLink`): pops one eval from the local pool, bakes the full crypto material into the URL. Always returns a fresh URL even when `space.inviteUrl` is set. The old short-circuit that hijacked this method to return the public URL has been removed.

3. **Sending an invite via DM**: the service-layer `sendInviteToUser` action takes a `mode: 'one-time' | 'public' | 'reuse'` argument plus an optional `presetLink`. In `'public'` mode it forwards the existing `space.inviteUrl` (errors if no public link exists). In `'one-time'` mode it generates a fresh URL per call. In `'reuse'` mode it sends the explicit `presetLink` value without generating anything new (no eval consumed). The current UI never uses `'reuse'` — the active call paths are `'one-time'` for the One-Time tab's Send via DM (fresh per send) and `'public'` for the Public tab's Send via DM. `'reuse'` is retained on the service surface because the architectural property is useful (e.g. a future "review then send" pattern would call it).

4. **Regenerating the public link**: produces the **same URL string** (because the configKey is reused). The server-side eval is overwritten with a fresh one, and the manifest snapshot is updated. Existing copies of the URL in the wild continue to resolve.

### Evals (Polynomial Evaluations)

Evals are cryptographic secrets used exclusively for invite generation. They are NOT used for message encryption.

**Eval Allocation:**

| Operation | Evals Consumed/Generated | Notes |
|-----------|--------------------------|-------|
| Space creation | ~10,000 generated (SDK default) | No `total` param passed |
| Generate one-time invite link | 1 consumed from local pool | URL embeds the eval |
| Generate public invite link | 1 consumed from local pool, uploaded to server | `MAX_PUBLIC_EVALS = 1`; replaces any existing server-side eval for this space |
| Kick user (rekey) | `members + 200` generated, replaces session | This is the only operation that still rekeys; out of scope for the invite consolidation |

**Eval Consumption:**

```typescript
// InvitationService.constructInviteLink — one-time invite consumes one eval
const index_secret_raw = sets[0].evals.shift(); // Removes from array
await this.messageDB.saveEncryptionState(
  { ...response[0], state: JSON.stringify(sets[0]) },
  true
);
```

```typescript
// InvitationService.generateNewInviteLink — public link consumes one eval
session.evals = session.evals.slice(MAX_PUBLIC_EVALS); // MAX_PUBLIC_EVALS = 1
await this.messageDB.saveEncryptionState(
  { ...stateRow, state: JSON.stringify(session) },
  true
);
```

### Known Issue: Config Sync Bloat

See: `.agents/bugs/encryption-state-evals-bloat.md`

Space creation allocates ~10K evals (~2MB per space) which causes config sync failures for users who create many spaces. The `generateNewInviteLink` and `kickUser` operations correctly use `members + 200`, suggesting the 10K default at creation may be unintentional.

**Proposed improvement**: On-demand eval generation instead of upfront allocation.

## Technical Architecture Details

### Single Key System Architecture (post-consolidation)

There is one config keypair per space, established at space creation. Both one-time and public invites are built on top of it.

```
Created: When space is first created
Keys: space_key, owner_key, hub_key, config_key
Used by: constructInviteLink() AND generateNewInviteLink() — both reuse the original config_key
Lifetime: Permanent for the life of the space (unless explicitly rotated by some future feature)
```

This is a behavior change from the previous design, where `generateNewInviteLink` minted a fresh config keypair on each call. The new design matches `quorum-mobile/services/space/inviteService.ts`, where the comment is explicit: *"Use the EXISTING space config key (not a new one). This ensures all space members use the same config key for hub envelope encryption/decryption."*

### Invite Link Structures

**One-Time Invites (existing config key + consumed secret):**

```
https://app.quorummessenger.com/#spaceId={SPACE_ID}&configKey={CONFIG_PRIVATE_KEY}&template={TEMPLATE}&secret={CONSUMED_SECRET}&hubKey={HUB_PRIVATE_KEY}
```

**Note:** the `secret` comes from `evals.shift()`. Each one-time invite consumes one slot from the local pool.

**Public Links (existing config key, eval lives on server):**

```
https://app.quorummessenger.com/invite/#spaceId={SPACE_ID}&configKey={CONFIG_PRIVATE_KEY}
```

**Note:** the `configKey` here is the SAME `configKey` used by one-time invites and by member-side hub envelope encryption. The URL is therefore deterministic per space.

**Domain Resolution (as of 2026-06-07):**
- **Production** (`app.quorummessenger.com`): Generated URLs use `app.quorummessenger.com` (matches mobile). `qm.one` short links are still accepted as input for backward compatibility. See `buildInviteBase` helper in `InvitationService.ts`.
- **Staging** (`test.quorummessenger.com`): Uses `test.quorummessenger.com`.
- **Local Development** (`localhost`): Uses `localhost:port` with http protocol.

### Cryptographic Flow

**One-Time Invites (`constructInviteLink`):**

1. Load `config_key` and `hub_key` from local storage.
2. Load the space's encryption state (`spaceId/spaceId` conversationId).
3. Verify the local pool has at least one eval; throw if exhausted.
4. Deep-copy the template, set `ratchet.id = 10001 - evals.length`, copy `root_key` from session state, hex-encode the template.
5. Pop one eval via `evals.shift()`, hex-encode as the URL `secret`.
6. Persist the smaller pool via `saveEncryptionState`.
7. Return the URL: `{base}#spaceId={..}&configKey={..}&template={..}&secret={..}&hubKey={..}`.

**Public Links (`generateNewInviteLink`):**

1. Load `owner_key`, `hub_key`, `config_key` from local storage.
2. Load the space's encryption state.
3. Verify the local pool has at least `MAX_PUBLIC_EVALS = 1` eval; throw if exhausted.
4. Generate an ephemeral X448 keypair (used for both eval and manifest encryption).
5. Take the first eval (slice, don't mutate yet), build one encrypted eval payload using the existing config public key.
6. Sign the eval payload with `owner_key`, POST to `apiClient.postSpaceInviteEvals`.
7. Re-encrypt the local space manifest with the same config key + ephemeral key, sign with `owner_key`, POST to `apiClient.postSpaceManifest`.
8. Set `space.inviteUrl = "{base}/invite/#spaceId={..}&configKey={..}"` using the EXISTING config private key. Save via `saveSpace`.
9. Decrement the local pool (`session.evals.slice(MAX_PUBLIC_EVALS)`), persist via `saveEncryptionState`. This happens AFTER successful network calls so a failed upload doesn't leak a pool slot.

### Database Operations

- **Space Keys**: Multiple types stored ('hub', 'owner', 'config', 'space'). All set at space creation; not rotated by invite operations.
- **Space State**: `inviteUrl` tracks the current public link (deterministic per space; same string across regenerations).
- **Encryption State**: A single per-space row holds the DKG template + local evals pool. Both invite paths mutate this row by popping evals.
- **Member Management**: Real-time updates via WebSocket sync (unaffected by invite operations).

## Recommendations

### Security Improvements

1. **Implement Banned User Tracking**: Create persistent ban list to prevent re-joining
2. **Enhanced Validation**: Add banned user checks in invite processing


### Code Quality

1. **Centralized Validation**: Move invite validation logic to single location
2. **Type Safety**: Improve TypeScript definitions for invite-related types
3. **Error Handling**: More granular error categorization and handling
4. **Documentation**: Better code comments explaining the dual key system

### Current Invites UI Flow

**Segmented toggle (underline tabs)**: At the top of the Invites tab the user picks a mode — **One-Time** or **Public Link**. The Public option is owner-only; non-owners see it disabled.

**One-Time mode** (deliberately departs from mobile's UI to avoid mobile's same-URL-to-many footgun):
- Two parallel actions, no displayed link box. Resting state shows just **Send via DM** (expandable) and **Copy a link**.
- **Send via DM**: expands an inline existing-conversations picker + manual-address fallback + a **Send Invite** button. Each click of Send Invite mints a fresh one-time URL invisibly and DMs it to the chosen contact (mode='one-time' under the hood). Selected contact is cleared on success so the user can immediately pick another. The picker stays expanded for repeat sends.
- **Copy a link**: mints a fresh one-time URL and writes it to the clipboard. The URL is never rendered on screen. A persistent "Link copied" callout confirms. Each click mints another link. A local 1.2s minimum spinner duration keeps the button's "Generating…" state perceivable (the underlying mint is sync-fast).
- **Mutually exclusive success callouts**: clicking Send via DM collapses the Copy callout; clicking Copy a link collapses the DM picker and clears any leftover "Invite sent" callout. Only one success state visible at a time.
- Each Send or Copy action consumes one local eval. With ~10K evals per space, exhaustion is unrealistic in practice.

**Public mode** (owner only):
- If no public link exists: "Generate Public Invite Link" primary button → confirmation modal → link generated. Confirmation is shown only for first-time generation.
- If a public link exists: copyable link field + "Republish" secondary button (subtle-outline variant, visually demoted) + "Send via DM" expandable picker.
- "Republish" bypasses the confirmation modal. It pushes a fresh encrypted eval and a fresh manifest snapshot through the invite-resolution path; the URL string stays identical.

> **What "Republish" is actually for.** The manifest snapshot is already pushed automatically every time the owner saves any Space changes (name, description, icon, etc.) — `SpaceService.updateSpace` calls `postSpaceManifest` on every save. The Republish button's UNIQUE behavior is `postSpaceInviteEvals` — pushing a fresh encrypted eval through the invite-resolution path. The eval is the cryptographic ticket joiners fetch when they click the public link.
>
> Practically, the button is a defensive escape hatch: it gives the owner a self-service way to fix a public invite link that mysteriously stops working. It's not a routine action — owners shouldn't need to click it after normal edits. Mobile has the same button (labeled "New" with a misleading "Regenerate to invalidate the old link" caption — the URL doesn't change). Verified by tracing `quorum-mobile/services/space/inviteService.ts` `generatePublicInviteLink` vs. mobile's save flow (`useSpaceSettings.ts` → `broadcastSpaceUpdate.ts`) — only the button calls `postInviteEvals`.
- "Send via DM" picker forwards the existing `space.inviteUrl` (mode='public').

**Pool-exhausted state** (typically only on legacy desktop-created spaces):
- A warning banner replaces the inability to issue new invites with an honest explanation.
- Banner copy adapts: if `space.inviteUrl` exists AND user is in one-time mode, it points them at the Public Link tab.
- All one-time generate/copy and public refresh buttons are disabled. In Public mode, "Send via DM" still works because it forwards the existing `space.inviteUrl` (mode='public' doesn't consume an eval).

## Summary

Both invite formats coexist on the same space, sharing one config keypair:

1. **One-time invites consume finite secrets** — each generation permanently uses one secret from the local `evals` pool.
2. **Public-link generation is cheap** — 1 server-side eval upload + 1 manifest re-publish, no member rekey, no new keypair.
3. **Public-link URL is deterministic per space** — regenerating produces the same string; the server-side eval is what gets refreshed.
4. **"Expiration" errors are validation failures** — typically eval pool exhaustion or stale links from before the 2026-06-07 consolidation.
5. **No persistent user blocking** — kicked users can still receive invites and click public links.

## Frequently Asked Questions

### Can kicked users receive new invites?

**Yes.** There is no ban-list check in the invite send path or in the public-link join path. Kicked users can receive one-time DMs and click public links. Owners who want to keep someone out have to manage that out-of-band.

### Why do I get "Invite Link Expired" errors?

These are cryptographic validation failures, not time-based expirations. Common causes:

- **Eval pool exhaustion**: the space has used up its local pool.
- **Stale public links from before 2026-06-07**: spaces that had a public link generated under the old desktop logic embedded a freshly-minted configKey in the URL. After the consolidation, regenerating the public link on the new build emits a URL built from the original space configKey instead — the old URL becomes a dead pointer. Owners can regenerate to get the new (current) URL.
- **Missing or corrupted space configuration** in local storage.

### Can kicked users rejoin via public invite links?

**Yes.** Public invite links bypass membership checks. The only way to lock someone out is to remove the public link entirely or rely on social trust.

### Can I go back to "one-time only" after generating a public link?

**The question no longer applies** under the post-consolidation model. One-time invites continue to work whether or not a public link exists. If you want to stop offering public joins, the only options are:

- **Republish** the public link to refresh the eval — useful if joiners report the link isn't working. The URL stays the same; this does not invalidate the old link in any meaningful sense.
- **Future work** would need a backend `DELETE /invite/evals` endpoint to truly take the public link offline. None currently exists.

---

## Environment-Specific Invite System (September 2025 Update)

### Dynamic Domain Resolution

The invite system now dynamically detects the environment and uses appropriate domains:

**Implementation:** `@quilibrium/quorum-shared` — `src/utils/inviteDomain.ts`

1. **Production Environment** (`app.quorummessenger.com`):
   - Generates invite links with `qm.one` (short domain)
   - Accepts both `qm.one` and `app.quorummessenger.com` links
   - Maintains backward compatibility with all existing invites

2. **Staging Environment** (`test.quorummessenger.com`):
   - Generates invite links with `test.quorummessenger.com`
   - Only accepts staging domain links (isolation from production)
   - Prevents cross-environment invite confusion

3. **Local Development** (`localhost:port`):
   - Generates invite links with `http://localhost:port`
   - Accepts all domains for comprehensive testing
   - Supports common development ports (3000, 5173, etc.)

### Key Benefits:
- **No hardcoded domains**: Automatically adapts to deployment environment
- **Staging isolation**: Test environment works independently
- **Local testing**: Developers can test invite flows without deployment
- **Production safety**: No changes to existing production behavior

### Files Modified:
- `@quilibrium/quorum-shared` `src/utils/inviteDomain.ts` - Utility for dynamic domain resolution
- `src/components/context/MessageDB.tsx` - Provides access to `InvitationService` which uses dynamic domain for invite generation
- `src/components/modals/JoinSpaceModal.tsx` - Uses dynamic domain for display
- `src/hooks/business/spaces/useInviteValidation.ts` - Dynamic validation prefixes

## Duplicate Prevention (Fixed)

**Issues Fixed**: Multiple join messages, redundant invites to existing members

**Changes**:
- `InvitationService.joinInviteLink()` - Added membership check before saving member/sending join message
- `useInviteManagement.invite()` - Added membership validation with warning display
- `MessageDB` context - Provides access to `SpaceService` for `getSpaceMember()` for membership checks

**Result**: Clean invite flow with no duplicate joins or redundant invite sending.

---


_Covers: SpaceSettingsModal/Invites.tsx, useInviteManagement.ts, useInviteValidation.ts, useSpaceJoining.ts, InvitationService.ts, MessageDB Context, InviteLink.tsx, inviteDomain.ts_

_Last updated: 2026-06-07_
