# Regression coverage map

## Purpose

`yarn verify` prints a `NOT COVERED` line on every run so a `PASS` can never be
read as more than it is. This document is where that line comes from. Every
row below cites a file, a `file:line`, or says "none found" — it is a record
of what was actually measured on 2026-08-23, not an estimate of what probably
exists. Where a claim could not be verified from the code, it says
`UNKNOWN — not yet measured` rather than guessing.

The scope is the regression harness under `src/dev/tests/harness/` (the
`*.scenario.test.ts` files `yarn verify`'s live tier runs) plus the component
test suite under `src/dev/tests/components/`. Unit tests elsewhere in the repo
exist and pass, but they mock the SDK and check logic in isolation — they are
not what this map is about, which is "does a message or action survive a real
send/receive round trip."

When coverage changes (a new scenario ships, a gap closes), update this
document and `NOT_COVERED` in `scripts/verify/report.mjs` together — a stale
map is worse than no map, because it makes the gate's silence look
deliberate when it is really just unmeasured.

## Content types

`@quilibrium/quorum-shared`'s `src/types/message.ts` defines **27** content
types (`grep -n "  type: '" quorum-shared/src/types/message.ts`), not the 28
this document's originating brief expected — recorded here as a measured
correction, not silently fixed.

The **space arm**'s authority is the assertion loop in
`space-message-id-derivation.scenario.test.ts:691-708`: each listed type is
asserted on the bot that did *not* send it, so a pass means the frame crossed
the wire and cleared the id-derivation gate, not that it was the sender's own
local copy. The **DM arm** has no equivalent single loop; each DM scenario
asserts what it asserts locally, cited per row. The **cross-client arm** is
`dm-cross.scenario.test.ts` (desktop↔mobile DMs) and
`config-cross.scenario.test.ts` / `config-from-mobile.scenario.test.ts`
(config, not a message content type, but the only other cross-client wire
format exercised) — there is no space cross-client scenario.

| Content type | Space arm | DM arm | Cross-client arm | Notes |
|---|---|---|---|---|
| `post` | Asserted — `space-message-id-derivation.scenario.test.ts:692` | Asserted (delivery) — `dm-basic.scenario.test.ts:78-79`, and the receive path is exercised across most `dm-*` scenarios | Asserted — `dm-cross.scenario.test.ts:108,158` | The only type exercised on every arm |
| `update-profile` | Asserted — `:699` | None found | None found | |
| `dm-update-profile` | N/A (DM-only type) | **Sent only** — counted at the send seam, `dm-auto-reveal.scenario.test.ts:56`, asserted as a count at lines 111 and 115; never confirmed to arrive/decrypt at the peer | None found | Same shape as space's `pin`: proven to leave the client, not proven to land |
| `remove-message` | Asserted — `:698` | None found | None found | |
| `event` | None found | None found | None found | |
| `embed` | Asserted — `:693` | None found | None found | |
| `reaction` | Asserted — `:695` | None found | None found | |
| `remove-reaction` | **None found** — absent from the assertion loop | **None found** | None found | Zero coverage on any arm; see Gaps |
| `join` | Not a wire frame — receiver-synthesized, deliberately excluded from the id-derivation check (`space-message-id-derivation.scenario.test.ts:562-566`); the underlying *effect* (roster growth) is asserted in `space-basic.scenario.test.ts:191` | N/A | N/A | The content type itself is architecturally untestable by this gate; the membership effect is covered separately (see critical paths) |
| `leave` | Same as `join`: synthesized, excluded at `:562-566` | N/A | N/A | No scenario exercises a member leaving |
| `kick` | Same as `join`: synthesized, excluded at `:562-566`; the *action* (`kickUser`) is covered in `space-kick.scenario.test.ts:124` | N/A | N/A | Content type itself untestable by the id gate; the effect is covered (see critical paths) |
| `mute` | Asserted — `:700` (sent by the space owner, observed on the attacker bot per the comment at `:428-430`) | None found | None found | |
| `sticker` | Asserted — `:694` | None found | None found | |
| `pin` | **Sent but never asserted** — `space-message-id-derivation.scenario.test.ts:433`. Requires a role holding `message:pin` with no owner bypass, and the harness has no role-creation helper (`spaceBot.ts` has none) | None found | None found | See Gaps — highest-priority content-type gap alongside `remove-reaction` |
| `delete-conversation` | None found | None found | None found | Distinct from `delete-conversation-self`, below |
| `delete-conversation-self` | N/A (DM-only type) | Asserted via storage effect, not a `content.type` equality check — `dm-selfdelete-control.scenario.test.ts:103-108` (own second device honours the delete) and `dm-selfdelete-forgery.scenario.test.ts:95` (a forged one from a stranger is rejected) | None found | Real coverage, just not the pattern the brief's grep (`content?.type ===`) would find — flagged here so it isn't miscounted as a gap |
| `edit-message` | Asserted — `:696` | None found | None found | |
| `thread` | Asserted — `:697` | None found (DMs have no threads) | None found | |
| `call-offer` | None found | None found | None found | No scenario touches any of the 8 call/WebRTC content types |
| `call-answer` | None found | None found | None found | |
| `call-reject` | None found | None found | None found | |
| `call-hangup` | None found | None found | None found | |
| `call-event` | None found | None found | None found | |
| `call-ice-candidate` | None found | None found | None found | |
| `call-renegotiate` | None found | None found | None found | |
| `space-call-start` | None found | None found | None found | |
| `space-call-end` | None found | None found | None found | |

**Tally:** of 27 content types, 9 are asserted delivered on the space arm
(matching the pre-measured finding), 1 more (`post`) is asserted delivered on
the DM arm, 1 (`delete-conversation-self`) is asserted via effect rather than
type-equality on the DM arm, 2 (`pin`, `dm-update-profile`) are sent but never
confirmed delivered, 3 (`join`/`leave`/`kick`) are architecturally excluded
from the id-derivation gate with their effects covered elsewhere, and **11**
(`event`, `remove-reaction`, `delete-conversation`, and the 8 call types) have
no coverage of any kind on any arm.

## Non-message critical paths

| Path | Status | Evidence |
|---|---|---|
| Space create | Covered | `space-create.scenario.test.ts` — asserts the local row, the manifest reads back through the real join-side decode path, encryption state, space key, member row, and a second channel |
| Invite (generate + accept) | Covered | Link generation + relay readback: `space-create.scenario.test.ts:42-50`. Link consumption via a real invite: `space-basic.scenario.test.ts:104-105`. Invite *expiry or revocation* is not exercised — none found |
| Join | Covered | `space-basic.scenario.test.ts:105,188,191` — both the post-join message and the roster row are asserted |
| Kick | Covered | `space-kick.scenario.test.ts` — asserts pre-kick control (B can read A), the kick itself (`:124`), post-kick exclusion, and that a pre-kick backup restore does not let the kicked member back in (`:179-202`) |
| Rejoin (reconnect) | Covered, with a caveat | `space-backlog.scenario.test.ts:149` (`b.reconnect()`) measures whether a reconnect backlog starves the roster handshake. This is a socket-reconnect scenario, not a leave-then-rejoin-as-a-new-member scenario — the latter is `UNKNOWN — not yet measured` |
| Role permissions | **None found** | No scenario creates a role or grants a permission. `spaceBot.ts` has no role-creation helper at all — this is a harness capability gap, not just a missing test (confirmed by the `pin` comment at `space-message-id-derivation.scenario.test.ts:439-440`: "Giving it a real arm means creating a role and broadcasting a manifest first") |
| Config sync | Covered, both directions | Desktop→mobile: `config-cross.scenario.test.ts:92`. Mobile→desktop: `config-from-mobile.scenario.test.ts:97-106`. Each direction asserts publish-then-read-back; concurrent-edit merge conflict (the "known merge-asymmetry issue" the file's own header references) is not separately exercised |
| Storage eviction and restore | Covered, both DM and Space | DM: `dm-itp-wipe.scenario.test.ts:89-163` (history and sessions lost, conversation resumes fresh). Space: `space-wipe-restore.scenario.test.ts:156-250` (Spaces/profile/keys restore from a published config; DMs do not; the sync-off arm is the control and restores nothing) |
| Login | Partial | Only exercised as the config-restore path inside `space-wipe-restore.scenario.test.ts` (title: "login rebuilds Spaces and profile only for a published config, and never DMs", `:126`) — this is `ConfigService.getConfig` on a fresh device, not an authentication/passkey/session flow. No scenario or component test drives an actual login UI or session-creation path — that part is `UNKNOWN — not yet measured` |

## Gaps, ranked by silence

Ranked by whether a user would notice the underlying failure on their own,
not by how many types or files are affected — a gap nobody would ever notice
outranks one they would hit on the very next click, because the loud failures
take care of themselves.

1. **Role/permission gating has no coverage of any kind, and the harness
   cannot currently produce one.** A regression that makes a permission check
   fail open (grant an action to someone who shouldn't have it) produces no
   symptom visible to any ordinary user — it is only ever discovered by an
   attacker exploiting it or a manual audit. This is the single most silent
   category measured: not "untested," but "the test infrastructure to even
   attempt it doesn't exist" (`spaceBot.ts` has no role helper).

2. **`remove-reaction` is asserted nowhere, on either arm.** If delivery
   breaks, the person who removed their reaction sees their own optimistic
   UI update succeed and has no reason to suspect anything failed; only a
   peer who happens to notice a reaction that should be gone would ever
   catch it, and that reads as "didn't refresh" long before it reads as "bug."

3. **`pin` is sent but never confirmed delivered, on either arm**
   (`space-message-id-derivation.scenario.test.ts:433`), and
   **`dm-update-profile` is sent but never confirmed delivered**
   (`dm-auto-reveal.scenario.test.ts:56`). Both fail the same way: the
   sender's own view looks correct because the send succeeded locally, so
   only someone else's client would show the miss, and a missing pin or a
   stale profile is easy to misread as "nobody did that" rather than "this
   broke."

4. **Calling has zero coverage.** All 8 WebRTC content types
   (`call-offer` through `space-call-end`) appear in no scenario. The
   headline failure (a call never connects) is loud and would be caught by
   anyone testing the feature by hand. The quieter regressions this leaves
   unguarded — a dropped `call-renegotiate` during a network change, a lost
   `call-ice-candidate` — surface as vague "bad call quality" that a user
   attributes to their own network, not to a specific regression.

5. **No end-to-end or integration test exists at all** —
   `src/dev/tests/integration/` and `src/dev/tests/e2e/` each contain only a
   `README.md` (`ls` both). A regression in the glue between two
   individually-tested pieces (a click that no longer wires through to the
   handler it used to, a multi-step flow that silently drops a step) has no
   automated path to being caught; it ships until a human happens to walk
   the exact flow by hand.

Named for completeness, but ranked lowest deliberately — these are large or
structurally excluded, but a failure in any of them is loud almost by
definition, which is exactly why they do not need to occupy one of the five
`NOT_COVERED` slots:

- **155 of 169 components have no test** (see Component count below) — a
  broken render is normally a blank screen, a thrown error boundary, or an
  obviously wrong layout, all things a user hits on the very next screen
  they open.
- **DMs are never tested past plain text.** No `dm-*.scenario.test.ts` sends
  `embed`, `sticker`, `reaction`, `edit-message` or `remove-message`. A
  regression here is visible the moment someone tries the feature (a
  missing embed, a reaction that won't apply) — loud to the user, silent
  only to the gate.
- **Electron packaging and iOS/Android native builds** are outside what a
  Node-based `yarn verify` can exercise at all — the loudest possible
  failure mode (the build itself fails) takes care of surfacing itself.

### Component count

The pre-measured finding "16 of 169 components have a test" does not survive
a strict count and is corrected here. `find src/components -name "*.tsx"`
returns exactly **169** files. Of the 22 test files under
`src/dev/tests/components/` (23 minus `README.md`), only **14** import a
component that actually exists as one of those 169 `.tsx` files:
`AppErrorScreen`, `BackupStatus`, `DangerZone`, `EmojiPicker`,
`FloatingPopover`, `MessageMarkdownRenderer`, `PasskeyStatus`,
`ReactionsModal`, `RouteBoundary` (via `routeErrorBoundary.test.tsx`,
which also renders `AppErrorScreen`), `Security` (two test files),
`SyncStatusLine`, `ThreadListItem`, `ThreadsListPanel`, and
`WebsocketProvider` (two test files). Two more test files —
`Button.test.tsx` and `Modal.test.tsx` — render primitives re-exported from
`quorum-shared`; those primitives have no local `.tsx` source under
`src/components/` at all (`src/components/primitives/` contains only
`index.ts`, a re-export barrel), so they are not part of the 169 being
measured and do not belong in this count. The remaining test files
(`channelThreadRawRosterGate.contract.test.ts`,
`cssColourVariableFormat.test.ts`, `emojiPickerFrequentLookup.unit.test.ts`,
`iconNames.test.ts`, `messageListSenderMapper.contract.test.ts`,
`tailwindClassesGenerate.test.ts`) test file-format/contract invariants, not
a rendered component.

**Corrected: 14 of 169 components have a test; 155 of 169 do not.**

---

*Last updated: 2026-08-23*
