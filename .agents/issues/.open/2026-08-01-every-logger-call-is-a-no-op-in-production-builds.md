---
type: bug
title: "Production builds discard logger.warn and logger.error too, so 'fail open and log' produces zero signal from real users"
status: open
priority: medium
created: 2026-08-01
updated: 2026-08-17
severity: silent — nothing fails; we simply learn nothing from any user who is not a developer
area: observability / logging / quorum-shared
repos: quorum-shared (cause), quorum-desktop + quorum-mobile (affected)
related_docs:
  - ".agents/issues/transport/README.md"
  - ".agents/issues/.open/2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md"
---

# Every logger call is a no-op in production builds

## Status

**2026-08-17 — partially shipped in PR #349** (`feat: make the logger's
production escape hatch reachable`), with quorum-shared PR #82.

What landed: `window.quorumLogger` with `enable`/`disable`/`status`, which makes
the escape hatch the original author designed actually reachable. §4b explains
why a narrow wrapper rather than exposing `logger`, whose `enable()` would
re-arm the plaintext-printing `log` tier. Two independent guarantees, each
mutation-verified with its own test: `minLevel: 'warn'` keeps `log`/`debug`
dark, and `redact: true` strips engine-echoed plaintext.

`enable()` also refuses to turn on at all if it detects the linked
quorum-shared build cannot redact — desktop depends on it via
`link:../quorum-shared`, a filesystem link to a hand-built sibling whose `dist/`
is gitignored, and a stale one silently ignores `redact` while the message
still promises "content excluded". It pushes a canary through the real logger
rather than trusting a version string.

The blocking prerequisite is closed: see
`.done/2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md`.

**Still open — this is why the issue stays here.**

- **Option 2 is the one that matters for real users and is NOT done.** What
  shipped requires opening devtools and typing a command, so it serves a
  developer or a screen-share, not the ordinary user whose report you actually
  want. A "collect diagnostics" toggle with an in-memory buffer and an export is
  still the only route that produces a report from someone who will never open a
  console. Note the extra bar it carries: an exported file LEAVES the machine,
  unlike console output, so the plaintext sites at `MessageService.ts` must be
  redacted or excluded from the buffer before it ships.
- **Option 3 (counters in the DB Inspector)** untouched.
- **No CI backstop on message strings.** Redaction covers `Error` objects at the
  choke point, so it cannot be forgotten per-call-site — but a future
  `logger.warn('body: ' + plaintext)` interpolates into the message string,
  which nothing strips. Not present today (checked), unenforced tomorrow.
- **Not verified in production:** that an app log line appears at `warn` and not
  at `log`. Reaching those paths needs a logged-in session. Covered by unit
  tests and mutation against the same source that is bundled, but not observed
  in the built artifact.

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

**Verified against the shipped artifact, 2026-08-17.** This was re-checked by
reading `dist/` from a real production build rather than the source. The
minifier's output confirms both halves:

```js
// detectEnvironment(), as emitted. `S` is the bundled `process`.
function eLi(){ return typeof __DEV__<"u" ? __DEV__
              : S===void 0 ? (typeof window<"u" ? window.location?.hostname==="localhost" : !0)
              : !1 }
// shouldLog() — note `enabled` is consulted before the level
function tLi(e){ return y7.enabled ? LEVELS[e] >= LEVELS[y7.minLevel] : !1 }
```

The `process` branch was statically folded to `!1` because Vite substitutes
`NODE_ENV` at build time; the fallback branch fails too, since the deployment is
not on `localhost`. The log message strings themselves still ship to users as
dead weight.

## §1b. Was this deliberate? Yes — and the real reason is better than the stated one

Investigated 2026-08-17, because "the lead dev built it this way" deserved an
answer before anyone changed it. Conclusion up front: **the design is sound and
must stay for `log`/`debug`. The defect is narrower than §1's framing suggests.**

**Provenance.** `logger.ts` was authored by Cassandra Heart and arrived in
`quorum-shared`'s squashed `initial commit` (`2e67c1d`, 2025-12-30). It has never
been modified since, and has no ancestor in `quorum-desktop` or `quorum-mobile`
history. Desktop adopted it in `8bb6f411c` (2026-01-02), whose message reads
"Enables environment-aware logging (silent in prod, visible in dev)". Prod
silence was understood and chosen at both ends, not stumbled into.

**The stated reason** is the file's own header: "In production: no-ops for
performance." That is the weakest of the available justifications — a disabled
log call is one boolean check.

**The real reason was never written down.** The `log` tier prints decrypted
message plaintext:

| call site | what it prints |
|---|---|
| `MessageService.ts:4844` | `TripleRatchetDecrypt raw result: ${decryptResult}` — the entire decrypted payload |
| `MessageService.ts:4847` | `JSON.stringify(decrypted).substring(0, 200)` |
| `MessageService.ts:4856` | `first 100 chars: ${output.substring(0, 100)}` |

Enabling the `log` tier in production would print conversation content to the
console of a privacy-focused messenger. **Do not do it, and do not treat §1 as
an argument for doing it.**

**But that does not justify discarding `warn`/`error`, and the original author
appears to agree.** `logger.ts:122` documents `error` as "always logs unless
explicitly disabled". `shouldLog()` consults `config.enabled` before the level,
and `detectEnvironment()` sets `enabled = false` *automatically* — which is not
an explicit disable. The implementation contradicts its own docstring. Repairing
that is not overriding the original design; it is delivering it.

**Audit for Option 1, completed 2026-08-17.** Every `logger.warn` and
`logger.error` call site in `quorum-desktop/src`, `quorum-desktop/web` and
`quorum-shared/src` was checked for decrypted content, message bodies and
untruncated addresses. **Zero leaks.** The three near-misses are benign:
`ConfigService.ts:360` and `:367` log a static translated string, and
`BackupService.ts:536` logs counts and booleans only. Addresses already truncate
(`address.slice(0, 16)`). Option 1 is clear to implement as written.

**Why this dropped from `high` to `medium`.** The title previously implied the
whole mechanism was a mistake. It is not: three quarters of the behaviour is a
correct and necessary privacy control. The genuine defect is the narrow one above
— two severity levels killed against their documented contract — and its fix is
now de-risked by the audit. It remains a diagnosis-speed multiplier with a
compounding cost (§2b), which is why it is not `low`.

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

Do **not** simply flip `enabled` to true in production. §1b now carries the
evidence rather than the assumption: the `log` tier prints decrypted message
plaintext at `MessageService.ts:4844`, `:4847` and `:4856`. This is a concrete
privacy regression, not a theoretical one. The fix has to be selective by level,
and `log`/`debug` must stay off.

## §4. Options

1. **Keep `debug`/`log` off, let `warn`/`error` through.** Smallest change: make
   `shouldLog` consult the level before `config.enabled`, so the two severities
   that mean "something went wrong" survive a production build. This also
   reconciles the code with `logger.ts:122`, which already claims `error` behaves
   this way. **The prerequisite audit is done (§1b): zero content leaks at
   `warn`/`error`.** Note the honest limit of this option — it writes to the
   browser/Electron console, so it only pays off when someone actually opens
   devtools. It is cheap and correct, but it is not the option that produces
   reports from ordinary users; that is option 2.
2. **A user-facing "collect diagnostics" toggle**, off by default, that enables
   logging for that session and writes to a local buffer the user can export.
   Fits an anonymity-conscious app better than always-on remote reporting, and
   turns "it does not show my friend's name" into an actionable report.
3. **Counters instead of logs.** For questions that are statistical rather than
   forensic ("how many rows have no identity"), a small local counter surfaced
   in the DB Inspector answers them without printing anything sensitive. This is
   what the identity work's Step 4 diagnostic actually needs.

Option 1 and option 3 are complementary and neither requires a server.

## §4b. The recommended design, after a security review — 2026-08-17

The original author already designed a production escape hatch: `logger.enable()`,
documented at `logger.ts:88-92` as "useful for debugging production issues". It
has never worked, because `logger` is not attached to `window` or `globalThis`
anywhere (MEASURED — grep returns nothing), so it is unreachable in a shipped
build. Making it reachable is more faithful to the original intent than inventing
a severity rule, and it preserves off-by-default.

**Do NOT expose the raw `logger` object.** `logger.enable()` sets
`enabled = true` and leaves `minLevel` at its default of `'log'`. Since
`LOG_LEVELS.log (1) >= LOG_LEVELS.log (1)`, that re-arms the entire `log` tier,
including the three plaintext sites in §1b. Exposing `logger.enable()` is
therefore the exact action §3 forbids, just behind a manual step.

**Expose a narrow wrapper instead**, in `web/main.tsx`:

```ts
if (typeof window !== 'undefined') {
  (window as Window & { quorumLogger?: unknown }).quorumLogger = {
    enable:  () => logger.configure({ enabled: true, minLevel: 'warn' }),
    disable: () => logger.configure({ enabled: false }),
  };
}
```

`minLevel: 'warn'` makes `log` fail the threshold (`1 >= 3` is false), so the
plaintext sites stay dark regardless of what anyone types. This needs **no change
to `logger.ts`** and is structurally safe rather than safe-by-convention.

**Security review outcome** (adversarial review, 2026-08-17). The "an attacker
who can call this already has stronger primitives" argument was tested and holds
for OS-level malware, XSS, and malicious extensions: local storage is entirely
unencrypted at rest (`messages`, `space_keys`, `encryption_states` — only the
master keyset is AES-GCM protected, per `cryptographic-architecture.md:185-194`),
and this repo's own `quorum-db-schema.md` publishes console snippets for dumping
it. Electron posture is sound: `contextIsolation: true`, `nodeIntegration: false`,
no console persistence to disk, no telemetry or crash reporter.

The risks the review found are not attacker-driven:

- **Sanctioned-workflow social engineering.** Documenting "type this, paste the
  output" as the official support flow legitimises exactly the behaviour a
  scammer needs. The narrow wrapper largely defuses this, because the worst
  output it can produce contains no message content.
- **The public-tracker foot-gun.** A well-meaning user pasting console output
  into a public GitHub issue. Same mitigation.
- **Future drift.** The §1b audit is point-in-time with no enforced invariant.
  Once a production route exists, a careless `logger.warn(sensitiveThing)` in a
  future PR becomes reachable. `dbInspectorCoverage.test.ts` is the precedent for
  a CI-enforced backstop.

**Blocking prerequisite.** A separate defect must be fixed first:
`2026-08-17-decrypt-error-messages-leak-ten-characters-of-plaintext.md`. A
failing decrypt puts 10 characters of plaintext into `error.message`, and that
error is forwarded to `logger.error` — the exact tier this design opens.
`minLevel: 'warn'` does not help, because the leak travels on `error`.

Order of work: sanitiser + its failing test → the wrapper → the CI backstop.

## §5. How it was found

An error-handling review of the on-connect identity announce
(`2026-08-01-space-member-identity-announce-on-connect.md`) flagged that the
change relies on "fail open and log" for observability, then checked whether the
logs actually reach anywhere. They do not.

Re-opened 2026-08-17 to answer "was this deliberate?" before any code changed.
It was — see §1b. The finding survived, but its scope narrowed and its priority
dropped accordingly.

---
*Last updated: 2026-08-17*
