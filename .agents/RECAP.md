---
type: recap
title: "Quorum Desktop — Project State"
updated: 2026-08-16
---

# Quorum Desktop — Project State

> Last updated: 2026-08-16

## Dashboard

> Updated: 2026-08-16 · 92 live · 76 startable · 6 nearly done · 10 blocked

**Next step:** Fix `MessageDB`'s failure to recover from an abnormally closed IndexedDB connection — every write after it silently does nothing until the app restarts.

### Do next

| # | Issue | Why it matters |
|---|-------|----------------|
| 1 | [MessageDB never recovers from an abnormally closed connection](issues/.open/2026-08-06-messagedb-never-recovers-from-an-abnormally-closed-connection.md) | All persistence breaks and stays broken until restart. The user is given no signal, so messages appear sent and are not stored. |
| 2 | [Safari wipes all IndexedDB after 7 idle days](issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md) | Permanent loss of DM history and ratchet state for Safari users on the live site. Unverified against a real browser, so the reproduction IS step one. |
| 3 | [Every logger call is a no-op in production builds](issues/.open/2026-08-01-every-logger-call-is-a-no-op-in-production-builds.md) | Every "fail open and log" path in the app produces zero signal in the build users actually run. Fixing it is what makes the rest of this list diagnosable. |
| 4 | [A reconnecting client starves control-message processing](issues/2026-08-02-sync-requests-arrive-four-minutes-late-and-every-peer-rejects-them.md) | Sync requests expire unread, so a new joiner is answered by nobody. Already confirmed in the harness with the failing line captured, so it is ready to fix. |
| 5 | [The config upload has no size guard and fails silently](issues/.open/2026-08-05-config-upload-has-no-size-guard-and-fails-silently-on-mobile.md) | No client measures the payload before sending. A config save can fail with the user believing it succeeded. |
| 6 | [Config sync space loss race condition](issues/.open/2026-01-09-config-sync-space-loss-race-condition.md) | Spaces can be lost outright. Filed January and never actioned; still reads as a data-loss path. |
| 7 | [Make the Spaces list identical on every device](issues/.open/2026-07-31-spaces-list-cross-device-sync.md) | The umbrella for cross-device Spaces sync, carrying the verified per-pair state matrix. Start here rather than at its children. |

### Nearly done — needs a check

- [Six name surfaces never reached the resolver](issues/2026-08-10-name-surfaces-that-never-reached-the-resolver.md) — shipped in PR #325, suite green with every rule shown red on revert. Held open deliberately; confirm in the running app and close.
- [Desktop shows a stale display name except in User Settings](issues/.open/2026-08-04-desktop-shows-a-stale-name-everywhere-except-the-user-settings-field.md) — shipped in PR #313 and device-verified. Held open on purpose; decide whether anything still remains.
- [MASTER RECAP: control-message authorization](issues/.open/2026-06-25-MASTER-RECAP-control-message-auth.md) — every row of its own table reads DONE on both clients. Only release-timing coordination remains, which the file calls outside our control.
- [78 Dependabot alerts triaged, react-router bumped](issues/.open/2026-08-12-dependabot-78-alerts-triage-react-router-bump.md) — shipped in PR #337 with 1428 tests green. Nobody has driven the running app against the new router version.

### Blocked

- [Security tab key warning understates what the key controls](issues/.open/2026-08-14-security-tab-key-warning-understates-wallet-access.md) — two product decisions: whether desktop should name wallets while the wallet UI is mobile-only, and whether the copy should branch on account origin.
- [Record and show what the last config publish did](issues/.open/2026-08-08-record-and-show-what-the-last-config-publish-actually-did.md) — desktop shipped in PR #322; the mobile half waits on a package publish.
- [Privacy level presets](issues/.open/2026-08-10-privacy-level-presets-design.md) — designed and approved, blocked on mobile toggle parity. One prerequisite filed, one not.
- [announce-keys flooding: unbounded admissions](issues/.open/2026-07-20-announce-keys-flooding-unbounded-admissions.md) — awaiting a lead-dev decision. A first fix was written and rejected for deleting legitimate in-use devices.
- [Pre-existing key-handling items for the lead](issues/.open/2026-08-12-pre-existing-key-handling-items-for-the-lead.md) — five findings sharing one owner and one decision.

_Full list of every issue: [INDEX.md](INDEX.md)._

_Some issues are tracked privately and are not listed here._

---

## TL;DR

The last two weeks were dominated by identity resolution, and that arc has largely landed: names, avatars and bios now resolve from an address through one API (#327), every name surface routes through it (#325), a QNS claim is verified before it renders as a `.q` (#343), and the profile card's remaining caller-payload leaks were closed this week (#344, #345). What is left of that workstream is mostly the mobile port and a set of issues held open awaiting a real-app check rather than more code.

The backlog's centre of gravity has now moved to **storage and sync durability**, and that is where the top of the Do-next list sits. Three separate paths can lose or fail to persist user data without telling anyone: an IndexedDB connection that never recovers, Safari evicting the whole database after seven idle days, and a config upload with no size guard. Compounding all of them, every `logger` call is a no-op in production builds, so none of these failures leave a trace in the build users run.

Two known freezes have diagnoses but no fixes: the notification toggle (measured at ~1.8s, cause identified as the config-save encode chain, plan written) and the space/channel flicker during history replay. Nothing is currently on an open branch.

---

## In flight

Nothing in flight.

> Worth knowing: **11 issues carry `status: in-progress` but no branch exists for any of them.** All three feature branches from 2026-08-16 are merged and `main` is clean. In practice that field currently means "filed at the root of `issues/`", not "someone is working on it". The Do-next list above is built from what the bodies say, not from that field.

---

## Decisions

| date | decision | rationale |
|------|----------|-----------|
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

_Last updated: 2026-08-16_
