---
type: bug
title: "Every logger call is a no-op in production builds, so 'fail open and log' produces zero signal from real users"
status: open
priority: high
created: 2026-08-01
updated: 2026-08-02
severity: silent — nothing fails; we simply learn nothing from any user who is not a developer
area: observability / logging / quorum-shared
repos: quorum-shared (cause), quorum-desktop + quorum-mobile (affected)
related_docs:
  - ".agents/issues/transport/README.md"
---

# Every logger call is a no-op in production builds

## §1. The finding

`quorum-shared/src/utils/logger.ts` decides once, at module load, whether
logging happens at all:

```ts
function detectEnvironment(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;                    // RN/Expo
  if (typeof process !== 'undefined' && process.env)
    return process.env.NODE_ENV !== 'production';                        // Node/Electron
  if (typeof window !== 'undefined')
    return window.location?.hostname === 'localhost';                    // browser
  return true;
}
config.enabled = detectEnvironment();
```

`shouldLog()` returns `false` immediately when `config.enabled` is false, before
the level is even considered. **In a production build every `logger.debug`,
`logger.log`, `logger.warn` and `logger.error` call is discarded**, on all three
branches: `__DEV__` is false in a release RN bundle, Vite statically replaces
`process.env.NODE_ENV` with `'production'`, and a deployed web app is not on
`localhost`.

A repo-wide grep for `logger.configure`, `logger.enable` and `setLogLevel` in
`quorum-desktop/src` and `quorum-desktop/web` finds **no call sites**, so nothing
re-enables it at runtime. There is no Sentry or other reporting integration in
the desktop repo.

## §2. Why this matters more than it looks

Large parts of this codebase are deliberately built to **fail open and log** —
the identity announce gates, the DM profile gate, the sync paths, the transport
retry logic. That is the right design: a redundant retry is harmless, a
suppressed one leaves a user rendering as a 6-character address forever. But the
"and log" half is what makes the failure *diagnosable*, and in production that
half does not exist.

Concretely, today we cannot answer any of these from a real user's session:

- did the on-connect identity announce run, or silently skip every space?
- did a space have no signing key, or did the send fail on the wire?
- how often does a gate read hit a corrupt record?
- how often does a frame fail to decrypt?

Every one of those has a `logger` call written for it. None of them produce
anything outside a developer's own machine. This is also why transport
reliability had to be measured with a hand-built harness rather than read off
production behaviour.

### §2b. The list keeps growing — a new site, added 2026-08-02

The roster convergence check (`src/utils/rosterConvergence.ts` +
`MessageService.scheduleRosterConvergenceCheck`) re-broadcasts a `sync-request`
when a peer advertised more members than we actually received. Its entire
observable surface is `logger`, so in production it can:

- decide the roster is short and re-ask — invisibly;
- decide **not** to re-ask because the attempt budget is spent while still 70
  rows short — invisibly, and this is the single most actionable state it has;
- throw inside its timer and repair nothing, ever — invisibly.

It was written that way **knowingly**, and the alternative was considered and
rejected: a bespoke counter for one feature is a band-aid on a systemic problem,
and building private telemetry per feature is how a codebase ends up with five
incompatible half-solutions instead of one fix.

⚠️ **The point of recording it here is that the cost of this bug is compounding,
not static.** Every "fail open and log" feature shipped from now on adds another
question nobody can answer about a real user's session. The next one that wants
production visibility should trigger the fix in §4 rather than route around it.

The mitigation actually applied, which is available to any similar feature: the
decision function returns a **typed reason** rather than a boolean, and the
caller logs it on every branch. That does nothing in production, but it means a
developer reproducing the problem locally gets "not asking (cap-reached) — have
1, best offer 78" instead of silence. Cheap, and it makes the eventual §4 fix a
matter of changing the sink rather than re-instrumenting the code.

## §3. What NOT to do

Do **not** simply flip `enabled` to true in production. The reason it is off is
sound: these logs are chatty, some carry addresses and message ids, and a
messenger that prints conversation metadata to a shared console is a privacy
regression. The fix has to be selective.

## §4. Options

1. **Keep `debug`/`log` off, let `warn`/`error` through.** Smallest change: make
   `shouldLog` consult the level before `config.enabled`, so the two severities
   that mean "something went wrong" survive a production build. Requires an
   audit that no `warn`/`error` call site prints message content or a full
   address — several already truncate (`address.slice(0, 16)`), which suggests
   the convention is half-established.
2. **A user-facing "collect diagnostics" toggle**, off by default, that enables
   logging for that session and writes to a local buffer the user can export.
   Fits an anonymity-conscious app better than always-on remote reporting, and
   turns "it does not show my friend's name" into an actionable report.
3. **Counters instead of logs.** For questions that are statistical rather than
   forensic ("how many rows have no identity"), a small local counter surfaced
   in the DB Inspector answers them without printing anything sensitive. This is
   what the identity work's Step 4 diagnostic actually needs.

Option 1 and option 3 are complementary and neither requires a server.

## §5. How it was found

An error-handling review of the on-connect identity announce
(`2026-08-01-space-member-identity-announce-on-connect.md`) flagged that the
change relies on "fail open and log" for observability, then checked whether the
logs actually reach anywhere. They do not.

---
*Last updated: 2026-08-02*
