---
type: bug
title: "Space members show truncated address — no space_members row (join broadcast never arrived)"
status: open
priority: high
ai_generated: false
created: 2026-06-13
updated: 2026-06-13
related_docs:
  - ".agents/docs/debugging/dm-architecture-and-debug-playbook.md"
  - ".agents/tasks/.done/2026-06-10-space-message-list-public-profile-fallback.md"
  - ".agents/tasks/.done/per-space-profile-data-flow-analysis.md"
related_files:
  - "src/services/MessageService.ts"
  - "src/hooks/business/user/useMembersWithPublicProfileFallback.ts"
related_tools:
  - ".agents/tools/dm-debug/06-space-member-sources.js"
---

# Space members show truncated address — no `space_members` row

## Symptom

In a space channel's message list, many senders render as a 6-char truncated
address with an initials-only avatar instead of their real name/pfp — even
though they have joined the space AND posted many messages. The earlier
public-profile-fallback fix (PR #191) does not help them.

## Root cause (confirmed by live diagnostic, 2026-06-13)

**These senders have no row in `space_members` at all.** Their `join` control
message never reached this client (offline at join time, dropped broadcast, or
joined-before-us with no historical replay). Identity is therefore unresolvable
and the render falls back to `senderId.slice(-6)`.

### Live evidence

Diagnostic `.agents/tools/dm-debug/06-space-member-sources.js` run against test
space `QmZM3AKwKfMprQZvSk3Mpgii2JS31TS5izHrwJe1itprrG` ("Quorum Test 2"):

- **89 distinct senders** have posted messages.
- **46 of them (52%) have NO `space_members` row** — including every
  truncated-address user from the reported screenshot (E9AouU, teSNCf, eH6cNY,
  XHUczm, plus high-volume posters CRcRk8=64 msgs, eH6cNY=63, XHUczm=38).
- The 43 "has row" senders are the ones whose `join` did arrive.
- The space's `space_members` table has 69 rows but 89 senders posted — even the
  rows present don't cover everyone active.

### Why normal message traffic does NOT recover identity

`space_members` is only ever WRITTEN by three paths, none triggered by receiving
a normal `post`:

1. `join` control message → `MessageService.ts:3246` creates the row.
2. `update-profile` → only *updates* an existing row. On the established-session
   path (`MessageService.ts:1783`) it `return`s early if the row is missing.
   (The new-session path `MessageService.ts:1262` was already fixed to upsert.)
3. `sync-members` / roster sync from owner → `MessageService.ts:4023`, `:4301`.

The regular message-receive path (`MessageService.ts:3154`) only READS
`space_members` to verify the sender's signature (non-repudiability). It never
writes identity. So a sender with a missing row posts forever as a truncated
address.

### Latent secondary bug: null-deref on non-repudiable spaces

At `MessageService.ts:3178`, the non-repudiability check reads
`participant.inbox_address` with **no null guard**:

```ts
const participant = await this.messageDB.getSpaceMember(space.spaceId, decryptedContent.content.senderId);
// ...
const inboxMismatch =
  !isUpdateProfile &&
  participant.inbox_address !== inboxAddress &&   // participant may be null
  participant.inbox_address;
```

When `participant` is null (the 46-sender case) AND the space is
non-repudiable (`!space.isRepudiable`, line 3150), this throws a TypeError.
The throw propagates to the outer catch at `MessageService.ts:4348`
(`'Error processing hub/sync message'`), which logs and swallows it — so on a
**non-repudiable space these senders' messages are silently dropped entirely.**

The reported space renders the messages (truncated name) because it is
**repudiable** — the `!space.isRepudiable` guard is false, the block is skipped,
no deref. So the visible symptom (truncated name) and the latent symptom
(dropped message) depend on the space's repudiability setting.

## Why this is the transport/sync gap, not a render bug

This is the same unsolved cluster flagged in the DM playbook ("Known sync issues
— NOT yet fixed"): control-message delivery between clients is unreliable. The
`join` broadcasts for half the roster never landed. The public-profile fallback
(PR #191) can't help because it enriches *existing* rows — with no row, there's
nothing to enrich.

## Mobile parity check (2026-06-13)

Investigated `quorum-mobile` `context/WebSocketContext.tsx` to see whether
mobile already solves this, since desktop changes must not diverge from mobile
on shared protocol behaviour.

**Mobile is identical to desktop on the core gap: a plain `post`/`embed`/`sticker`
NEVER writes `space_members`** (mobile live path lines 2067-2148, batch path
3291-3335 — zero `saveSpaceMember` calls; they only READ a member row to build a
notification preview). Mobile also has no signature-verification-driven
inbox-address derivation that would seed a row from a raw post. So the
"upsert-from-message-traffic" idea would be a desktop-only divergence, not a
parity fix — **do NOT pursue it as the primary fix.**

**Mobile IS ahead of desktop on one path:** its `update-profile` handler is a
true upsert. When no member row exists (join missed), it creates one with
`inbox_address: ''` rather than bailing. Mobile live path
`WebSocketContext.tsx:1925-1985`, batch path `:3195-3241`, with an explicit
comment naming the "join control was missed" recovery case. Desktop only has
this upsert on the new-session path (`MessageService.ts:1262`); the
established-session path (`:1783`) still bails. **This is the real parity gap to
close.**

Mobile's render-time recovery is the same as desktop's: `useMembersWithPublicProfileFallback`
(`hooks/useMembersWithPublicProfileFallback.ts`) — render-only, no MMKV
write-back. Field convention on mobile: `address` / `profile_image` (vs desktop
`user_address` / `user_icon`); storage key `spaceMembers:<spaceId>` in MMKV.

## Proposed fix (revised after mobile check)

### Fix 1 (parity, do this): apply the line-1262 upsert to line 1783

Desktop's established-session `update-profile` handler (`MessageService.ts:1783`)
bails with `if (!participant) return`. Mirror the new-session upsert at
`:1262` (and mobile's `:1925`) so a profile update from a sender whose `join`
was missed CREATES the row instead of dropping the update. This is a true
cross-platform parity fix, low-risk, and directly recovers identity for the
affected users the moment they next save their profile.

### Fix 2 (correctness, do this): null-guard line 3178

`participant.inbox_address` at `MessageService.ts:3178` derefs a possibly-null
`participant`. On a non-repudiable space this throws and the message is silently
dropped (swallowed at the outer catch, `:4348`). Guard with
`participant?.inbox_address`. Independent of Fix 1; fixes the message-dropping
regression on non-repudiable spaces. Mobile does not have this bug because it
does not do desktop's inbox-from-publicKey derivation in the receive path.

### Fix 3 (deeper, needs design + lead-dev input): reliable `join`/roster delivery

The root cause is that ~half the `join` broadcasts never arrive — the unsolved
control-message transport gap (same cluster as the DM non-delivery issue). The
robust fix is making join/`sync-members` delivery reliable, OR an owner-side
periodic roster re-broadcast, OR a peer "request roster" pull. This is the only
fix that recovers name+avatar for a silent member who never re-saves their
profile. It is NOT client-render-side and should be raised with the lead dev
(Telegram, per project convention) rather than patched unilaterally.

### Explicitly NOT doing: upsert `space_members` from raw message traffic

Considered (would seed an inbox-only row from a verified post) and rejected:
(a) mobile doesn't do it → desktop-only divergence on shared protocol state;
(b) it writes canonical membership state from a derived source, the same
correctness risk the PR #191 task already rejected for write-through;
(c) it only seeds inbox+address, still no name/avatar from a `post`, so the
user-visible win is marginal over Fix 1 + the existing public-profile fallback.

## How to reproduce / diagnose

1. Open the affected space in the app.
2. DevTools console (log level "All levels"), paste
   `.agents/tools/dm-debug/06-space-member-sources.js`.
3. `__spaceMissingSenders('<spaceId>')` — lists senders with no member row.
4. `__spaceMemberSources('<spaceId>')` — classifies existing rows by source.

---
*Last updated: 2026-06-13*
