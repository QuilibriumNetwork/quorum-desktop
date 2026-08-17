---
type: recap
title: "Quorum Desktop — Project State"
updated: 2026-08-17
---

# Quorum Desktop — Project State

> Last updated: 2026-08-17

## Dashboard

> Updated: 2026-08-17 · 91 live · 74 startable · 7 nearly done · 10 blocked

**Next step:** Finish production diagnostics (Option 2: a diagnostics toggle with an export) — it is the only route that gets a failure report from a user who will never open devtools, and three separate issues are now waiting on evidence it would collect.

### Do next

| # | Issue | Why it matters |
|---|-------|----------------|
| 1 | [Production diagnostics reach a developer, not an ordinary user](issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md) | Half done. PR #349 shipped `quorumLogger.enable()`, so warn/error can now be read in a production build — but only by someone willing to open devtools. The remaining piece (Option 2: a diagnostics toggle with an export) is the only route that gets a report from a user who never will, and it is now the shared gate on the forced-close evidence and on measuring whether storage eviction reaches real users at all. |
| 2 | [Safari wipes all IndexedDB after 7 idle days](issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) | **Reframed 2026-08-17 by PR #350.** The app-side consequence is now measured headlessly, and the correction matters: with `allowSync` off (the default) an eviction takes Spaces and profile too, not just DMs. M4 shipped — a backup reminder for sync-off users. What is left is either **Mac-gated** (WebKit's 7-day trigger, the installed-app exemption, M2's passkey Phase 0) or small and unbuilt (M3 `persist()`, M5, M6). Do the small ones here; the reproduction waits on Apple hardware. |
| 3 | [A reconnecting client starves control-message processing](issues/2026-08-02-sync-requests-arrive-four-minutes-late-and-every-peer-rejects-them.md) | Sync requests expire unread, so a new joiner is answered by nobody. Already confirmed in the harness with the failing line captured, so it is ready to fix. |
| 4 | [The config upload has no size guard and fails silently](issues/.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md) | No client measures the payload before sending. A config save can fail with the user believing it succeeded. |
| 5 | [Config sync space loss race condition](issues/.open/2026-01-09-config-sync-space-loss-race-condition.md) | Spaces can be lost outright. Filed January and never actioned; still reads as a data-loss path. |
| 6 | [Make the Spaces list identical on every device](issues/.open/2026-07-31-spaces-list-cross-device-sync.md) | The umbrella for cross-device Spaces sync, carrying the verified per-pair state matrix. Start here rather than at its children. |

### Nearly done — needs a check

- **Config sync slice 1 — one thing left, and it needs eyes.** [Record what the last publish did](issues/.open/2026-08-08-record-and-show-what-the-last-config-publish-actually-did.md). Slice 2 closed (below). The release-build criterion turned out to be reachable cold: mobile #254/#255 prove the record is written under the real shipping log configuration, and `yarn check:release-bundle` asserts every failure string survives into the production bundle. What remains is watching the line render on a device, plus three untouched desktop-side items (queue classification, Rule 1 on the failure path, the `payloadBytes` cross-check).
- [Six name surfaces never reached the resolver](issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md) — shipped in PR #325, suite green with every rule shown red on revert. Held open deliberately; confirm in the running app and close.
- [Desktop shows a stale display name except in User Settings](issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md) — shipped in PR #313 and device-verified. Held open on purpose; decide whether anything still remains.
- [MASTER RECAP: control-message authorization](issues/.open/2026-06-25-MASTER-RECAP-control-message-auth.md) — every row of its own table reads DONE on both clients. Only release-timing coordination remains, which the file calls outside our control.
- [78 Dependabot alerts triaged, react-router bumped](issues/.open/2026-08-12-dependabot-78-alerts-triage-react-router-bump.md) — shipped in PR #337 with 1428 tests green. Nobody has driven the running app against the new router version.

### Blocked

- [A DB call landing mid-close still fails once](issues/.open/2026-08-17-a-db-call-landing-mid-close-still-fails-once.md) — deliberately gated on evidence, not queued. The fix is 104 hand-edits across the storage layer to remove a brief self-healing hiccup; #346 added the log line that can say whether forced closes reach real users at all. PR #349 made that line readable in a production build, but only via `quorumLogger.enable()` in devtools, so the evidence still has to be collected deliberately rather than arriving on its own.
- [Security tab key warning understates what the key controls](issues/.open/2026-08-14-security-tab-key-warning-understates-wallet-access.md) — two product decisions: whether desktop should name wallets while the wallet UI is mobile-only, and whether the copy should branch on account origin.
- [Pre-existing key-handling items for the lead](issues/.open/2026-08-12-pre-existing-key-handling-items-for-the-lead.md) — five findings sharing one owner and one decision.
- [Privacy level presets](issues/.open/2026-08-10-privacy-level-presets-design.md) — designed and approved, blocked on mobile toggle parity. One prerequisite filed, one not.
- [announce-keys flooding: unbounded admissions](issues/.open/2026-07-20-announce-keys-flooding-unbounded-admissions.md) — awaiting a lead-dev decision. A first fix was written and rejected for deleting legitimate in-use devices.

_Full list of every issue: [INDEX.md](INDEX.md)._

_Some issues are tracked privately and are not listed here._

---

## TL;DR

The last two weeks were dominated by identity resolution, and that arc has largely landed: names, avatars and bios now resolve from an address through one API (#327), every name surface routes through it (#325), a QNS claim is verified before it renders as a `.q` (#343), and the profile card's remaining caller-payload leaks were closed this week (#344, #345). What is left of that workstream is mostly the mobile port and a set of issues held open awaiting a real-app check rather than more code.

The backlog's centre of gravity has now moved to **storage and sync durability**, and that is where the top of the Do-next list sits. One of those paths closed on 2026-08-17: `MessageDB` now recovers from a browser-forced connection close instead of leaving a dead handle that wedged every read and write for the rest of the session (#346). Two remain, both able to lose user data without telling anyone: Safari evicting the whole database after seven idle days, and a config upload with no size guard. Compounding both, `logger.warn` and `logger.error` are discarded in production builds, so none of these failures leave a trace in the build users actually run — including the forced-close warning #346 just added.

Two known freezes have diagnoses but no fixes: the notification toggle (measured at ~1.8s, cause identified as the config-save encode chain, plan written) and the space/channel flicker during history replay. Nothing is currently on an open branch.

---

## In flight

Nothing in flight.

> Worth knowing: **11 issues carry `status: in-progress` but no branch exists for any of them.** All three feature branches from 2026-08-16 are merged and `main` is clean. In practice that field currently means "filed at the root of `issues/`", not "someone is working on it". The Do-next list above is built from what the bodies say, not from that field.

---

## Decisions

| date | decision | rationale |
|------|----------|-----------|
| 2026-08-17 | `allowSync` stays **off** by default, so backups carry the whole recovery story | Measured: with sync off the server holds nothing, and an eviction takes Spaces and profile as well as DMs. Turning sync on would recover more, but the default is a deliberate privacy position — so the answer is to prevent the wipe (M2) and make a backup exist when it happens anyway (M4, shipped #350), not to sync more |
| 2026-08-17 | Nothing tells users their DM sessions were not restored | Not actionable (the conversation re-establishes itself), not visible (the only symptom is a message you never received), and unsayable in the user's vocabulary. Reasons recorded in `docs/features/user-data-backup.md` so the same copy is not re-proposed (#350) |
| 2026-08-17 | Cross-client sync is measured in BOTH directions, not one | The two ConfigService implementations are independent code sharing only a type, so "desktop's blob decrypts on mobile" is not evidence about the reverse. The one-directional harness could not have seen the drift its own merge-asymmetry issue was filed for (#351) |
| 2026-08-17 | The mid-close retry helper is gated on field evidence, not queued as follow-up work | It is 104 hand-edits across the storage layer, most landing where no test watches, to remove a brief self-healing hiccup. #346 added the instrument that can say whether forced closes reach real users at all; build it if the data says so (#346) |
| 2026-08-16 | The recap is regenerated from issue bodies and never sorts on `priority:` | The field is a cached judgement that goes stale in prose-only updates; four of nine sampled disagreed with their own body |
| 2026-08-16 | Profile-card fields resolve from the address, not from the click payload | A mention-pill click carries only an address, so any field read from the payload rendered differently depending on which pill was clicked (#344, #345) |
| 2026-08-13 | The global "Syncing…" toast was removed rather than repaired | Three previous attempts shipped a trigger that read correctly and behaved wrongly; the rebuild is gated on measuring a per-space signal first |
| 2026-08-11 | Member names resolve from an address through one API | Partial identities could not be expressed, so every surface invented its own ladder (#327) |
| 2026-08-09 | `allowSync` is device-local and authoritative | Turning sync off did not stay off, because the synced blob's value won on adopt (#322) |
| 2026-08-09 | A restore may never resurrect deleted messages, conversations or departed Spaces | Backups previously carried a `user_config` snapshot that could undo a deletion (#324) |

---

## Reference

| file | notes |
|------|-------|
| [2026-08-16-issue-backlog-triage.md](reports/2026-08-16-issue-backlog-triage.md) | What is actually in the 87-issue backlog, and which taxonomy changes would and would not help. Carries its own correction. |
| [quorum-shared-architecture.md](docs/quorum-shared-architecture.md) | How the three repos share types, primitives and sync protocol |
| [config-sync-system.md](docs/config-sync-system.md) | The config publish/adopt path, which several open issues sit on |
| [cryptographic-architecture.md](docs/cryptographic-architecture.md) | Key handling and the crypto boundaries |
| [quorum-db-schema.md](docs/quorum-db-schema.md) | IndexedDB stores, relevant to the persistence issues at the top of Do-next |
| [2026-08-05-pwa-mobile-fallback-feasibility.md](reports/2026-08-05-pwa-mobile-fallback-feasibility.md) | Where the Safari ITP finding came from |
| [transport/index.md](issues/transport/index.md) | Entry point for the transport and delivery epic |

---

_Last updated: 2026-08-17_
