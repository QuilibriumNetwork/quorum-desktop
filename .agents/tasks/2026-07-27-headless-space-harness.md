---
type: task
title: "Headless SPACE harness — reproduce & measure desktop↔desktop space message delivery lag/loss"
status: SPEC — not yet started. Review before building.
created: 2026-07-27
area: Spaces / mesh sync / triple ratchet / testing infrastructure
builds_on: .agents/tasks/2026-07-27-headless-dm-harness.md (DM harness — slices 1-4 done; reuse its identity/transport/storage/bot machinery)
related:
  - "quorum-mobile/.agents/bugs/2026-07-20-mobile-desktop-message-transport-delay-loss-master.md (master; §0 space-receive fixes are MOBILE; desktop differs)"
  - "quorum-mobile/.agents/bugs/2026-07-26-spaces-log-append-ack-ignored-silent-write-loss.md (MOBILE hub-log ack — desktop does NOT use hub-log; carries the open triple-ratchet late-join question)"
  - ".agents/bugs/2026-01-09-config-sync-space-loss-race-condition.md"
  - ".agents/bugs/2026-06-13-space-members-missing-no-join-row.md"
  - ".agents/docs/data-management-architecture-guide.md (desktop sync architecture)"
---

# Headless SPACE harness (spec)

## The problem this targets (operator's words)

> "Sometimes user A posts a message in a space and user B, connected on a
> different browser, doesn't see it. Or the message lands with a lag."

Desktop↔desktop. Today this is **anecdotal** — nobody can trigger it on demand,
so it has never been measured. The DM harness proved the approach; this extends
it to spaces so we can **reproduce and measure** space delivery: post N messages
from A, count how many reach B and how long each takes, unattended, repeatably.

## Recon findings (established against the real code 2026-07-27)

1. **Desktop does NOT use the mobile hub-log path.** The two mobile space bugs
   above are about `log-append` / `log-append-ack` in `WebSocketContext.tsx` —
   **zero occurrences in desktop `src`**. So the mobile send-loss root cause does
   not transfer. Desktop's own space-send-loss is UNKNOWN and unmeasured.
2. **Desktop spreads space messages by a hash-based delta mesh sync**
   (`SyncService`, "new hash-based delta protocol"). B receives A's post only when
   a sync reconciles them. Flow: `requestSync` (broadcast, on connect/periodic) →
   `initiateSync` (pick a peer) → `handleSyncInitiateV2` (manifest) → delta
   exchange (`directSync` / `synchronizeAll`) → `informSyncData`. The "hub"
   (`sendHubMessage`) carries sync COORDINATION, not the messages.
   → **Hypothesis to test first: the lag/loss is a sync-trigger/coverage gap** —
   B doesn't sync promptly (or with the right peer) after A posts, so the message
   is invisible until a reconnect/restart forces catch-up ("flush on restart").
3. **Space membership uses a Triple Ratchet group session**, established via
   `secureChannel.EstablishTripleRatchetSessionForSpace` (SpaceService.ts:350, :855).
   Create/invite/join all exist as real methods:
   `SpaceService.createSpace` (:128), `createChannel` (:1189),
   `InvitationService.sendInviteToUser` (:150), `joinInviteLink` (:510).
4. **Open crypto question inherited from the mobile report:** does the Triple
   Ratchet have a late-join fork like the DM Double Ratchet? UNKNOWN. The harness
   can eventually probe this the way `dr-*` probes the double ratchet.

## The core challenge (this is the risk that sizes the build)

For the DM harness, the ~17 space/sync `MessageServiceDependencies` were stubbed
as no-ops. **For spaces they become load-bearing** and must be wired for real:
`synchronizeAll`, `informSyncData`, `initiateSync`, `directSync`,
`handleSyncInitiateV2`, `handleSyncManifest`, `sendHubMessage`, plus real
`SpaceService` + `SyncService`. That is the bulk of the work.

Second challenge: **a fresh harness device must become a functioning member** of
a space (hold the Triple Ratchet session + manifest + member list). Two ways in:

- **Path A — self-contained (RECOMMENDED FIRST).** The harness CREATES a fresh
  test space (bot A), bot B joins via a real invite. Everything happens in-harness
  with real methods; fully deterministic; no dependence on external state.
- **Path B — the operator's real test space.** Bot loads user A's existing space
  (A owns it, both are members, real users present). Higher fidelity, but a fresh
  device must RESTORE the space's Triple Ratchet session — the hard part — and it
  shares a live space with real people. Do this AFTER Path A works.

## Slices (each ends in something observable; risky steps annotated)

### Slice S0 — recon spike (do FIRST, before committing to the design)
Drive `SpaceService.createSpace` + `createChannel` from one headless bot and
confirm a space is created on the relay and reads back.
- **Expected:** `getSpace(spaceId)` returns the manifest we just wrote.
- **Most likely failure + signal:** create needs config/keyset wiring the DM deps
  don't provide → throws in `submitUpdateSpace` or a missing dep. Countermove:
  wire the minimum ConfigService/SpaceService deps.
- **Assumption recon couldn't resolve:** whether create/join need anything
  passkey-interactive. DM send did NOT (ed448 `js_sign_ed448`); assume spaces are
  the same and VERIFY here. If they do → Path A blocked, reassess.
- **Observable:** `yarn harness space-create` prints a live spaceId + channel.

### Slice S1 — two bots in one space, B receives ONE post
Bot A creates space + channel; bot B joins via `InvitationService` invite; both
establish the Triple Ratchet session; A posts one message to the channel; B
receives it via the real sync path.
- **Expected:** B's captured messages include A's post.
- **Most likely failure + signal:** B never syncs → B.captured stays empty though
  A's post persisted on A. Signal: no `sync-initiate`/manifest traffic in B's log.
  Countermove: confirm `requestSync` fires on B after join/connect; wire the sync
  deps that were no-ops.
- **Observable:** `yarn harness space-basic` → "B received A's post".
- **This is the make-or-break slice.** If B can receive one synced post, the rest
  is measurement.

### Slice S2 — measure delivery rate + lag (the deliverable)
A posts N messages to the channel; measure how many B receives and the lag of
each (post time → B-persist time). Sample sync activity. Repeatable, unattended.
- **Observable:** `yarn harness space-volume` → "B received 87/100, median lag 4s,
  13 missing at T+2min". Merged both-sides JSONL log (reuse `log.ts`).
- This is the number that turns the anecdote into a measured bug — and the
  regression test once a fix lands.

### Slice S3 — stress the sync-trigger hypothesis
Vary the conditions the recon flagged: post while B is mid-sync; post then force a
reconnect; multiple members; post bursts. Find the condition under which B does
NOT get the message without a restart — the reproduction.
- **Observable:** a named condition that reliably drops/lags a post, + its log.

### Slice S4 (optional, later) — Path B: the operator's real test space
Bot restores user A's existing space session and joins the live test space with
real members. Higher fidelity; needs the Triple-Ratchet-session-restore work.

## Reuse from the DM harness (already built)

identity/transport/storage/env/canonical/log/xpdump/`ratchetStats` sampler all
carry over unchanged. The bot gains a space-member mode and channel send/receive;
`deps.ts` gains the real sync wiring (currently no-op). The jsdom + `ws` +
fake-indexeddb + wasm-from-sibling + lingui-locale environment is unchanged.

## Non-goals

- Mobile (the hub-log bugs are mobile's; this is desktop↔desktop).
- The UI. Protocol + service layer only.
- Fixing the bug. This REPRODUCES and MEASURES it; the fix is a separate task
  informed by what S2/S3 find.

## Operator decisions (answered 2026-07-27)

- **Creating throwaway spaces on production: approved** (same footprint as making a
  test space in a browser).
- **User A already owns a throwaway space.** The harness can DISCOVER it from A's
  config (`getUserSettings` + `decryptUserConfig` with A's key) and reuse it —
  avoids creating new spaces. BUT: a fresh harness device still has to establish
  its space Triple Ratchet session from empty storage. For A (owner) that's
  bootstrappable from the owner key; for B (member) restoring an EXISTING
  membership on a fresh device WITHOUT re-joining is the hard, unknown part.
  → Therefore **S0/S1 still start self-contained** (harness creates a space, B
  joins via invite — both sessions established cleanly). **Reusing A's existing
  throwaway space is the Path B refinement** (S4), which additionally exercises
  fresh-device session-restore. Aim for reuse once the clean path works.
- **Path B concrete target** (user A's existing throwaway space, provided 2026-07-27):
  - spaceId: `QmbdLB6bAAdiparnE3iByhJcv5W3t3tDpx15BzCQdeG2z7`
  - channelId: `QmYomM8EAeaCZJN8GFJjxTvKEfUDNErDdgtn2JjsKfjZpJ`
  - A is the owner (its key is `BOT_A_PRIVATE_KEY` in .env.local). These are
    addresses, not secrets. Use for S4 once S0-S1 prove session establishment.
