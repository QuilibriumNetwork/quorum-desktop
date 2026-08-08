---
type: task
title: "Record and show what the last config publish actually did"
status: open
complexity: medium
priority: high
ai_generated: true
created: 2026-08-08
updated: 2026-08-08
area: config sync / observability
repos: quorum-desktop + quorum-mobile (+ quorum-shared for the shared type)
parent: ".agents/issues/.open/2026-08-07-config-sync-overhaul-design.md"
related:
  - ".agents/issues/.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md"
  - ".agents/issues/.done/2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md"
---

# Record and show what the last config publish actually did

> **⚠️ AI-Generated**: May contain errors. Verify before use.
> Code claims are **READ** at the cited lines on 2026-08-08, except the desktop
> data-loss path, which is **MEASURED** by the tests recorded below.

**Slice 1 of [the config sync overhaul](2026-08-07-config-sync-overhaul-design.md).**
Fully unblocked — needs nothing from the lead dev. Do this first: it is the
instrument every later slice is verified with. It is *mostly* additive, but not
entirely — see the scope note below, which is the one part to treat carefully.

## What & Why

A device cannot currently tell whether its config reached the server, for any
reason. `allowSync` off, a refuse-to-publish hold, and a genuine successful
upload all write the local row and all look identical. "My setting saved" has
never been evidence that it synced.

After this, the user sees "Last synced 3 minutes ago", or a specific reason it
did not, next to the sync toggle.

> **Scope note.** This started as pure instrumentation. Scoping it found a real
> data-loss path on desktop — a permanently-rejected publish throws before the
> local write, so the user's change is discarded on that device (details below).
> Fixing it is unavoidable here, because recording the outcome means catching the
> error, and catching it without persisting would be a deliberate choice to keep
> losing the edit. So this slice is **no longer behaviour-neutral on desktop.**
> Treat the failure path as the risky part and test it directly.

**Do not build a size threshold in this task.** MEASURED 2026-08-07: a **4566 KB**
payload was accepted with a confirmed server read-back, which sits *above* the
only recorded rejection (~4 MB, 2025-12-09). Those cannot both be a byte ceiling,
and a client-side request timeout has appeared as a second failure mode. So the
limit is not currently knowable — record the size and the outcome, and let the
threshold follow once §4.1 is answered or the data explains itself.

## Status

**2026-08-08 — the data-loss half shipped in PR #321** (`fix(config): a refused
sync no longer discards the user's change`). **This issue stays open**; the part
it exists for has not been built yet.

What landed, desktop only:

- A `try`/`catch` around the POST that holds the error, lets the local DB write
  and cache write happen, then re-throws past them, so a refused publish no
  longer discards the user's edit.
- The incoming timestamp is restored in that catch, so persisting on the failure
  path does not re-open what #320 closed.
- Acceptance tests as `ConfigService.unit.test.tsx` §8 — four tests, written
  first and confirmed red, with a control arm. Each of the three code pieces was
  reverted individually and confirmed to turn a specific test red.
- Verified: 34/34 in that file, 1137/1137 across the suite, typecheck clean.

Still open, and it is most of the task:

- No outcome is recorded anywhere. The six `PublishOutcome` values, the
  `LastPublish` record, and the `payloadBytes` measurement are all unbuilt.
- No shared type in quorum-shared.
- No status line in either client's privacy settings, so the user still cannot
  tell a working sync from a dead one.
- Nothing on mobile. Mobile never had the data-loss bug (it already persists and
  already restores the timestamp), but it has none of the recording either, and
  it is the client whose only signal compiles out in release.

## Both clients need this — mobile most of all

Nothing here couples the two: the record is device-local, no field is added to
the synced blob, and neither client reads the other's. So either side can land
first; that ordering is a scheduling call.

**What is not optional is that mobile gets it.** A record only ever describes the
device that wrote it. Each client builds its own payload from its own local Space
keys and computes its own held set, so desktop can publish cleanly while the
phone holds every time. Desktop-only coverage answers "is my laptop publishing?"
and leaves "why did my phone stop syncing?" exactly as unanswerable as it is
today — and mobile is the side the evidence already points at.

The two halves are not the same size, in the direction you might not expect:

| | Desktop | Mobile |
|---|---|---|
| `try`/`catch` around the POST | **absent** — must be added | present, `:859` |
| Restores the timestamp on failure | **no** — must be added | already does, `:871` |
| Persists locally on failure | **no** — the write is skipped | already does, `:876` |
| Retries a failed publish | yes, via the action queue | **no** — the error is swallowed |
| Branches to record at | all five exist | all five exist, four already log |

So desktop carries the whole risky control-flow change, and mobile is close to
"write a record where a log already is". Start with desktop while implementing:
it is the faster loop and the only side where the change can go wrong.

**Mobile is the smaller job and the bigger payoff.** Its failure signal is
`logger.warn`, which compiles out in release builds, so a mobile user today has
no signal at all while a desktop user at least has a console.

**The two clients fail in opposite, both-wrong ways.** Desktop loses the change
and tells you; mobile keeps the change and tells you nothing. Neither is what
this task describes, which is keep the change *and* say so. Fixing both is
in scope here.

## What scoping this actually turned up

**1. On desktop, a permanently-rejected publish discards the user's change.**
This is the headline, and it is a data-loss path rather than a missing-telemetry
one.

> ✅ **MEASURED 2026-08-08**, not inferred. Four tests added in
> [`ConfigService.unit.test.tsx`](../../../src/dev/tests/services/ConfigService.unit.test.tsx)
> §8, on branch `test/config-publish-failure-persistence`:
>
> | Test | Today |
> |---|---|
> | CONTROL ARM — an accepted publish persists the edit | **pass** |
> | Still rejects, so the queue can classify the failure | **pass** |
> | Persists the edit when the server refuses the blob | **FAIL** |
> | Withholds the timestamp after a rejected publish (Rule 1) | **FAIL** |
>
> Both failures report `undefined`, i.e. `saveUserConfig` was **never called at
> all** — the edit does not reach the DB in any form. The control arm passing is
> what rules out a broken harness. The other 30 tests in the file are unaffected
> (32 passed / 2 failed).
>
> These are the acceptance tests for this issue. They go green on the fix and are
> already written, so the revert check is free.

The mechanism, **READ** at the cited lines on 2026-08-08:

- `postUserSettings` is a bare `await` with no `try`/`catch`
  ([ConfigService.ts:693](../../../src/services/ConfigService.ts#L693)), and the
  API client throws on any 4xx.
- So the throw propagates out of `saveConfig`, and the local DB write at
  [`:733`](../../../src/services/ConfigService.ts#L733) never runs. Nothing the
  user changed survives a reload.
- The known evals-bloat rejection is `400 "invalid config missing data"`, and
  `isPermanentError` matches any message containing `"invalid"` or `"validation"`
  ([ActionQueueHandlers.ts:100-104](../../../src/services/ActionQueueHandlers.ts#L100)).
  So that case is classified **permanent**: the task is marked failed and
  **never retried** ([ActionQueueService.ts:316-323](../../../src/services/ActionQueueService.ts#L316)).

> ⚠️ Corrects an earlier note in this file that said the queue "retries
> indefinitely". It does not, for exactly the failure class that matters most.
> Transient errors (timeouts, 5xx, network) do retry, up to `maxRetries`.

The one thing desktop does get right: a permanent failure shows a
`Failed to save settings` toast, so it is not *silent*. But the toast says
nothing about sync, and the change is gone either way.

**On mobile the same rejection behaves the opposite way**: the catch swallows it
(`:859-873`), so the change persists locally, no retry is attempted, and — in a
release build, where `logger.warn` compiles out — there is no signal at all.

**2. Adding the local write on that path creates a Rule 1 hazard — desktop only.**
Mobile already restores the timestamp in its catch (`:871`), so this applies to
the new desktop catch alone. The
timestamp-authority fix restores `incomingTimestamp` on every path that does not
reach the server, but a throwing POST currently bypasses all of them. That is
harmless *today* only because the local write is skipped too. **The moment this
task makes the failure path persist, it must also restore the timestamp**, or it
reintroduces [the bug that shipped as #320/#243](../.done/2026-08-07-a-device-with-sync-off-still-claims-a-newer-timestamp.md).

## Design decisions, already made

**Store it device-local, NOT in `UserConfig`.** It is a fact about *this device's*
relationship to the server. Putting it in the synced blob would broadcast a
per-device fact to every other device, rewrite the blob on every save, and grow
the payload this work exists to watch.

- Desktop: `localStorage`, following the shrink diagnostic's precedent at
  [ConfigService.ts:484](../../../src/services/ConfigService.ts#L484)
  (`quorum:diag:configSpaceShrink`). Suggested key: `quorum:sync:lastPublish`.
- Mobile: MMKV, alongside the existing config storage.

**Shape** (type declared once in `quorum-shared`, both clients import it):

```ts
type PublishOutcome =
  | 'published'   // POST returned
  | 'off'         // allowSync is false
  | 'no-keys'     // no keypair available
  | 'held'        // refuse-to-publish: would have narrowed the Space list
  | 'rejected'    // server refused it
  | 'timeout';    // request timed out client-side

type LastPublish = {
  at: number;              // ms epoch
  outcome: PublishOutcome;
  payloadBytes?: number;   // ciphertext length, only when one was built
  spacesPublished?: number;
  spacesHeld?: number;     // 'held' only
  detail?: string;         // server message / error, for 'rejected'
};
```

## Implementation

### 1. Shared type (`quorum-shared`)

Add `PublishOutcome` and `LastPublish` to `src/types/`, export from the barrel.
Additive, so it ships alone; both clients pick it up on the next publish + bump.
Desktop needs `yarn build` on shared's dist before it sees them.

### 2. Desktop — `src/services/ConfigService.ts`

Record at each branch that already exists. All five points are present today; only
the failure path needs new control flow.

| Outcome | Where |
|---|---|
| `off` | the `if (config.allowSync)` at `:529` — record in the else path |
| `held` | `:655-660`, the `droppedSpaceIds.length > 0` branch (has both counts in hand) |
| `published` | immediately after the POST resolves, `:693+` |
| `rejected` / `timeout` | **new** `try`/`catch` around the POST |

In the new `catch`, in this order:

1. Classify the error (timeout vs server rejection).
2. Record the outcome, including `payloadBytes` — `ciphertext.length` is already
   in scope at the call site.
3. **Restore `config.timestamp = incomingTimestamp`** (see hazard 2 above).
4. Let the local write at `:733` proceed, so the user's change persists.
5. **Re-throw afterwards**, so the queue still classifies and reports the
   failure exactly as it does today. Do not swallow it.

> ⚠️ **Steps 4 and 5 conflict in the obvious implementation.** The local write is
> at `:733`, *after* the whole `if (config.allowSync)` block — so a plain
> `catch { record(); throw; }` skips it again and fixes nothing. Hold the error
> and re-throw past the write:
>
> ```ts
> let publishError: unknown;
> try {
>   await this.apiClient.postUserSettings(/* … */);
>   /* … tombstone clearing … */
> } catch (err) {
>   publishError = err;
>   recordLastPublish(classify(err), { payloadBytes: ciphertext.length, /* … */ });
>   config.timestamp = incomingTimestamp;   // Rule 1: nothing reached the server
> }
> // … existing local write at :733 runs either way …
> if (publishError) throw publishError;    // after the write, not instead of it
> ```
>
> Getting either half alone is a regression: swallow it and the toast plus the
> retry both disappear; re-throw early and the change is still lost.

Keep the re-throw so `isPermanentError` keeps working
([ActionQueueHandlers.ts:100](../../../src/services/ActionQueueHandlers.ts#L100)).
It correctly treats the evals-bloat `400 "invalid …"` as permanent — no retry,
one toast — while transient errors still back off and retry. That classification
is right; this change only stops it costing the user their edit.

Also record `payloadBytes` on the `published` path. That is the measurement half
of the size work, and it is free here.

### 3. Mobile — `services/config/configService.ts`

Smaller than desktop: the branches are already separate, already commented, and
four of the five already log. Add a record next to each log.

| Outcome | Where |
|---|---|
| `off` | `:668` (already logs "NOT publishing — allowSync is off") |
| `no-keys` | `:677` |
| `held` | `:794`, the `droppedSpaceIds.length > 0` branch |
| `published` | `:834`, which already logs `bytes=encryptedConfig.length` |
| `rejected` / `timeout` | the existing catch at `:859-873` |

No control-flow change is needed here. The catch already restores the timestamp
(`:871`) and already falls through to the local save (`:876`).

⚠️ **Mobile's existing failure log is `logger.warn`, which compiles to a no-op in
release builds.** The stored record must not depend on it. Write the record
first, then log.

### 4. UI

Desktop: under the "Enable sync" row in
[Privacy.tsx](../../../src/components/modals/UserSettingsModal/Privacy.tsx).
Mobile: under "Enable Sync" in `ProfileModal.tsx`'s Privacy & Sync section.

One line of text, no new controls:

| Outcome | Copy |
|---|---|
| `published` | "Last synced 3 minutes ago" |
| `off` | "Not syncing. Changes stay on this device." |
| `held` | "Waiting for Spaces to finish syncing before this device publishes again." |
| `rejected` | "Last sync was refused by the server. Your changes are saved on this device." |
| `timeout` | "Last sync timed out. Will retry." |
| `no-keys` | "Can't sync: no key available on this device." |
| never published | "Not synced yet." |

## Verification

- [ ] Each of the six outcomes is reachable and produces the right record. Force
      them: toggle sync off; delete a Space's encryption state locally to trigger
      the hold; point the client at an unreachable host for the timeout.
- [x] **Acceptance tests written and confirmed red** — `ConfigService.unit.test.tsx`
      §8, branch `test/config-publish-failure-persistence`. Two red (persistence,
      Rule 1), two green (control arm, still-rejects). Turning the two red ones
      green is the definition of this fix working.
- [ ] **`rejected` persists the local change** — the §8 test goes green, *and* the
      same thing is confirmed by hand once: make the POST fail, change a setting,
      reload, the setting is still there.
- [ ] **The queue still classifies the failure.** Two cases, because they take
      different branches: a `400 "invalid …"` must still be marked permanent
      (failed, one `Failed to save settings` toast, **no** retry), and a timeout
      or 5xx must still back off and retry. If the re-throw was dropped, both go
      green on the persistence test above while the queue is silently dead.
- [ ] **Rule 1 holds on the failure path.** After a rejected publish, this
      device's stored `timestamp` must equal the incoming one, not `Date.now()`.
      Then confirm another device's config still wins on the next pull.
- [ ] **Revert each of those three and confirm the test goes red.** They are
      independent and all three are easy to half-implement.
- [ ] `payloadBytes` matches the real ciphertext length. Cross-check one reading
      against `.agents/tools/dm-debug/08-self-identity-sources.js`.
- [ ] Mobile: verify in a **release** build, not just dev. The whole point is that
      the existing signal is compiled out there.
- [ ] No new field appears in the synced blob. Diff a payload before and after.

## Definition of Done

- [ ] Shared type added and published
- [ ] All six outcomes recorded on desktop
- [ ] All six outcomes recorded on mobile
- [x] Desktop failure path persists locally, restores the timestamp, and re-throws
      — PR #321
- [ ] Status line visible in both clients' privacy settings
- [ ] Verified in a mobile release build
- [ ] Revert tests confirmed red
- [ ] **Both clients done** — order is a scheduling call, but mobile is not optional

---

*Last updated: 2026-08-08*

## Updates
- **2026-08-08 08:32**: Instrument built before the fix: added ConfigService.unit.test.tsx section 8 (4 tests) on branch test/config-publish-failure-persistence. MEASURED — a rejected publish never calls saveUserConfig at all, so the user's edit is discarded. Control arm (accepted publish persists) passes, so the harness is sound. 32 passed / 2 failed; the 2 failures are the acceptance criteria.
