#!/usr/bin/env node
/**
 * Refuse to mint permanent production state on a machine that has none.
 *
 * ## The problem this exists for
 *
 * Every live arm drives real bots against the PRODUCTION relay, and a bot whose
 * identity file is absent gets minted and registered on the spot. Relay accounts
 * and Spaces are **permanent**: there is no delete endpoint and registrations do
 * not expire. So the cost of a first run is paid forever, by everyone.
 *
 * Fixed bot names (2026-08-23) solved half of this: a bot registers once and is
 * then reused from `src/dev/tests/harness/.state/<name>.json`. But that directory
 * is gitignored — it holds real private keys — so "reused" means *per machine*,
 * not *globally*. MEASURED 2026-08-24: a fresh checkout running a plain
 * `yarn verify` registers 6 accounts and 1 Space. Fixed names bounded the cost
 * per machine; nothing bounded the number of machines.
 *
 * That was tolerable while this gate existed only on one branch. Shipping it to
 * `main` is precisely the act that hands the behaviour to every other developer's
 * agent, and to any CI job somebody later points at a command called "verify".
 *
 * ## What it does
 *
 * Before running a live arm, ask the only question that matters: **would this
 * arm create permanent state that does not already exist?** It answers by
 * checking for the identity files the arm reuses.
 *
 *   - files all present  → the arm registers nothing; run it, exactly as before
 *   - any file missing   → running it would mint; skip with a printed reason
 *
 * On the maintainer's machine every file is present, so this changes nothing.
 * On a fresh clone, and in CI, the live arms skip and the run reports
 * `PASS (PARTIAL)` naming what was left out. `--live-allow-minting` opts in.
 *
 * ## Why the check is "does the file exist" and not "who is running this"
 *
 * A machine-identity check (an env var, a hostname, a config file) answers a
 * question that only correlates with the one we care about, and correlations
 * drift. This asks the real question directly: for bot identities, the guard's
 * predicate and the minting condition in `identity.ts`'s `loadOrCreateBot` are
 * the same predicate.
 *
 * **The space-reuse path needed more than existence**, and the first version of
 * this module claimed otherwise. Adversarial review 2026-08-24 found three ways
 * a file could be present while `space-delivery` still created a permanent
 * Space, so the guard now mirrors `restoreSharedSpace` (`spaceState.ts:304-330`)
 * rather than approximating it:
 *
 *   1. it needs **both** participants' `-space.json`, not just the victim's —
 *      `restoreSharedSpace` bails if `snaps.some((s) => !s)`
 *   2. `HARNESS_FRESH=1` short-circuits restore before any file is read, so a
 *      fully-populated machine still mints
 *   3. an unparseable file, or two files naming different spaces, both fall
 *      through to the create branch
 *
 * ## The one exception: `space-basic`
 *
 * That arm creates a Space on EVERY run because creating one is its subject, so
 * no persisted state can make it mint-free. It is not blocked here; it is gated
 * behind `--all` instead (see steps.mjs), which is a deliberate, documented cost
 * the operator already accepted. Its bots are still guarded.
 *
 * ## Direction of failure
 *
 * `routing.mjs` fails toward running MORE, because an unclassified path might
 * carry risk and an unnecessary six minutes is cheap. **Here the safe direction
 * inverts**: the thing being avoided is irreversible, and the cost of being
 * over-careful is a skipped arm on a machine that has no identities anyway. So
 * an arm this module does not recognise is treated as "would mint" and held
 * back. `mintGuard.test.ts` asserts every live arm has an entry, so adding one
 * without listing it here fails the fast tier rather than quietly minting.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Both imported, not re-derived. `run-cross.mjs` and `spaceState.ts` use the
// same two functions from the same module, so the guard cannot answer "which
// bots?" or "will it reuse the space?" differently from the code it guards.
import { crossRoles, wantsFreshSpace } from './routing.mjs';

/** Relative to each repo root. */
export const DESKTOP_STATE_DIR = 'src/dev/tests/harness/.state';
export const MOBILE_STATE_DIR = 'dev/harness/.state';

/**
 * The disk access this module needs, injected as one object so tests can answer
 * both questions without touching a filesystem. `readText` must return `null`
 * rather than throw when a file cannot be read — an unreadable file is exactly
 * the "restore will fail, so the arm will mint" case, not an error.
 */
export const REAL_IO = {
  exists: existsSync,
  readText: (p) => {
    try {
      return readFileSync(p, 'utf8');
    } catch {
      return null;
    }
  },
};

/**
 * The persisted state each live arm reuses, keyed by step label.
 *
 * Every entry is a **function of the environment**, not a fixed list, and that
 * is the fix for the second defect adversarial review found on 2026-08-24: two
 * arms choose their identity names from env vars at run time, so a static table
 * can describe at most one of the runs it is supposed to be guarding.
 *
 * Each returns `{ desktop, mobile, spaces, mints }`:
 *   - `desktop` / `mobile` — bot identity stems. `identity.ts` stores
 *     `<name>.json` under that repo's state dir.
 *   - `spaces` — `spaceState.ts` space snapshots, stored `<name>-space.json`.
 *     Checked more strictly than mere existence; see `spacesRestorable`.
 *   - `mints` — a reason string when this arm WILL create permanent state
 *     whatever is on disk. `null` otherwise.
 *
 * READ 2026-08-24 from the scenario sources — the `createBot` / `createSpaceBot`
 * call in each file is the authority, not this table, which is why the contract
 * tests cross-check them.
 */
export const STATE_BY_ARM = {
  'dm-basic': () => ({ desktop: ['alice-bot', 'bob-bot'] }),
  'dm-delivery': () => ({ desktop: ['dm-delivery-receiver', 'dm-delivery-sender'] }),
  // `space-basic` creates a Space on EVERY run by design — creating one is its
  // subject, so no amount of persisted state makes it mint-free. Deliberately
  // NOT reported as `mints`: it is gated behind `--all` instead (steps.mjs), a
  // documented cost the operator has already accepted, and blocking it here as
  // well would silently remove it from `--all` too. Its bots are still guarded,
  // so a fresh checkout running `--all` skips it rather than registering two
  // accounts on top of the Space.
  'space-basic': () => ({ desktop: ['space-basic-a', 'space-basic-b'] }),
  'space-delivery': (env) => ({
    desktop: ['space-delivery-victim', 'space-delivery-sender'],
    // BOTH participants, because `restoreSharedSpace` is all-or-nothing:
    // `snaps.some((s) => !s)` sends it to the create branch if either is
    // missing. The first version of this entry listed only the victim, so a
    // machine missing just the sender's file was reported safe and then left a
    // permanent Space behind.
    spaces: ['space-delivery-victim', 'space-delivery-sender'],
    mints: wantsFreshSpace(env)
      ? 'HARNESS_FRESH is set, which makes restoreSharedSpace skip the persisted space and create a NEW one'
      : null,
  }),
  // The role decides the NAMES, so it has to be resolved, not assumed. Both
  // sides flip together: desktop `a` ⇒ mobile `b`.
  'cross-dm': (env) => {
    const roles = crossRoles(env);
    return {
      desktop: [`cross-desktop-${roles.desktop}`],
      mobile: [`dm-bot-${roles.mobile}`],
    };
  },
  // run-config-cross.mjs runs BOTH directions by default: `config-cross`
  // (desktop publishes) and `config-from-mobile` (desktop reads). Both desktop
  // bots load mobile's account key, so they register a DEVICE on an existing
  // account rather than minting a new one — still permanent state, still worth
  // guarding, and the arm already refuses outright when mobile's file is absent.
  'config-cross': () => ({
    desktop: ['config-cross-desktop', 'config-cross-read-desktop'],
    mobile: ['config-sync-bot'],
  }),
};

/**
 * Would `restoreSharedSpace` actually restore from these snapshots?
 *
 * Mirrors `spaceState.ts:304-330` rather than checking existence, because three
 * of its four bail-outs leave the file sitting on disk:
 *
 *   - any snapshot missing            → create
 *   - any snapshot unparseable        → `loadSpaceState` swallows the error and
 *                                       returns undefined → create
 *   - snapshots naming different      → create
 *     spaceId/channelId
 *
 * Returns the list of paths that fail, so the caller can name them.
 */
function unrestorableSpaces(paths, io) {
  const bad = [];
  const snaps = [];
  for (const path of paths) {
    if (!io.exists(path)) {
      bad.push(path);
      continue;
    }
    const text = io.readText(path);
    let parsed = null;
    try {
      parsed = text === null ? null : JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (!parsed) bad.push(path);
    else snaps.push({ path, snap: parsed });
  }
  if (bad.length || snaps.length < 2) return bad;
  // All present and parseable — do they describe the SAME space?
  const { spaceId, channelId } = snaps[0].snap;
  const disagrees = snaps.some(
    (s) => s.snap.spaceId !== spaceId || s.snap.channelId !== channelId
  );
  return disagrees ? snaps.map((s) => s.path) : [];
}

/**
 * Which persisted files this arm needs but does not have.
 *
 * Returns `{ unknown }` for an arm absent from `STATE_BY_ARM` — the caller must
 * treat that as "would mint", per this module's header. `exists` is injected so
 * the whole module is testable without touching a disk.
 */
export function missingStateFor(step, repos, io = REAL_IO, env = process.env) {
  const entry = STATE_BY_ARM[step.label];
  if (!entry) return { unknown: true, missing: [], mints: null };
  const spec = entry(env);

  const missing = [];
  for (const name of spec.desktop ?? []) {
    if (!io.exists(resolve(repos.desktop, DESKTOP_STATE_DIR, `${name}.json`))) {
      missing.push(`.state/${name}.json`);
    }
  }
  for (const name of spec.mobile ?? []) {
    // A missing quorum-mobile checkout is a DIFFERENT condition, already handled
    // by `needsMobile` in index.mjs, which emits its own skip. Resolving against
    // a non-existent root here would simply report the file missing too — same
    // outcome (the arm does not run), less accurate reason. Harmless either way.
    if (!io.exists(resolve(repos.mobile, MOBILE_STATE_DIR, `${name}.json`))) {
      missing.push(`quorum-mobile/dev/harness/.state/${name}.json`);
    }
  }
  const spacePaths = (spec.spaces ?? []).map((name) =>
    resolve(repos.desktop, DESKTOP_STATE_DIR, `${name}-space.json`)
  );
  for (const path of unrestorableSpaces(spacePaths, io)) {
    missing.push(`.state/${path.split(/[\\/]/).pop()} (missing or unrestorable)`);
  }
  return { unknown: false, missing, mints: spec.mints ?? null };
}

/**
 * The skip reason for this arm, or `null` when it is safe to run.
 *
 * The message names the files rather than just saying "no state", because the
 * fix differs by arm: `config-cross` wants mobile's own scenario run first,
 * while `dm-basic` genuinely has nothing to reuse and can only be minted.
 */
export function mintGuardReason(step, repos, io = REAL_IO, env = process.env) {
  const { unknown, missing, mints } = missingStateFor(step, repos, io, env);
  const optIn = 'Opt in with `yarn verify --live-allow-minting`';
  if (unknown) {
    return (
      `no persisted-state entry for this arm in scripts/verify/mintGuard.mjs — ` +
      `assuming it would register permanent production state. Add an entry, or ` +
      `opt in with \`yarn verify --live-allow-minting\``
    );
  }
  // Checked BEFORE `missing`, because it is true regardless of what is on disk
  // and reporting a file list here would send the reader off to fix the wrong
  // thing — the files are fine, the environment is what forces the mint.
  if (mints) {
    return `would create PERMANENT production state: ${mints}. ${optIn}`;
  }
  if (missing.length === 0) return null;
  return (
    `would register PERMANENT production state (missing ${missing.join(', ')}) — ` +
    `relay accounts and Spaces cannot be deleted. ${optIn}`
  );
}

/**
 * One line for the report explaining the whole class of skip, so the reader is
 * not left inferring the rule from N per-arm rows.
 */
export const MINT_GUARD_SUMMARY =
  'live arms were skipped because this machine has no persisted bot identities — ' +
  'running them would register permanent, undeletable accounts and Spaces on the ' +
  'PRODUCTION relay. The fast tier ran in full. `yarn verify --live-allow-minting` ' +
  'accepts that cost deliberately.';
