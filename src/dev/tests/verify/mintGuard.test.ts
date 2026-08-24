/**
 * The guard that stops a fresh checkout registering permanent production state.
 *
 * Three kinds of test here, and the later kinds are the ones that matter.
 *
 * The unit cases pin the decision rule: state present → run, anything missing →
 * skip, arm not listed → skip.
 *
 * The ENV cases pin the two arms whose behaviour is not fixed. Adversarial
 * review 2026-08-24 found the guard hardcoding the default identity names, so
 * with `HARNESS_DESKTOP_ROLE=a` exported in the shell it cleared an arm that
 * then minted two accounts under different names. `runner.mjs` spawns steps with
 * no `env` override, so a stray `export` really does reach them.
 *
 * The CONTRACT cases pin the guard to the code it is guarding, by reading the
 * scenario files off disk. Without them the guard has a silent failure mode
 * worse than not having it: if a bot is renamed in a scenario and this table is
 * not updated, the guard checks for a file the scenario no longer writes. On the
 * maintainer's machine the stale file still exists, so the guard says "safe to
 * run" — and the scenario mints a brand new account under its new name, on every
 * run, with the gate reporting a clean PASS above it.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  STATE_BY_ARM,
  DESKTOP_STATE_DIR,
  MOBILE_STATE_DIR,
  missingStateFor,
  mintGuardReason,
} from '../../../../scripts/verify/mintGuard.mjs';
import { stepsFor } from '../../../../scripts/verify/steps.mjs';
import { resolveMobileRepo } from '../harness/mobileRepo.mjs';

const DESKTOP_REPO = resolve(__dirname, '../../../..');
const HARNESS = resolve(DESKTOP_REPO, 'src/dev/tests/harness');

const REPOS = { desktop: '/repo/desktop', mobile: '/repo/mobile' };
const norm = (p: string) => p.replace(/\\/g, '/');

/** A space snapshot that WOULD restore: parseable, and naming one space. */
const GOOD_SPACE = JSON.stringify({ spaceId: 'S1', channelId: 'C1', savedAt: 0 });

/**
 * An `io` that answers true only for the paths it was handed, and returns a
 * restorable snapshot for any of them that is read.
 */
const only = (...present: string[]) => {
  const set = new Set(present.map(norm));
  return {
    exists: (p: string) => set.has(norm(p)),
    readText: (p: string) => (set.has(norm(p)) ? GOOD_SPACE : null),
  };
};
const NOTHING = { exists: () => false, readText: () => null };
const EVERYTHING = { exists: () => true, readText: () => GOOD_SPACE };

const desktopState = (name: string) =>
  resolve(REPOS.desktop, DESKTOP_STATE_DIR, `${name}.json`);
const spaceState = (name: string) =>
  resolve(REPOS.desktop, DESKTOP_STATE_DIR, `${name}-space.json`);
const mobileState = (name: string) => resolve(REPOS.mobile, MOBILE_STATE_DIR, `${name}.json`);

/** Everything `space-delivery` needs in order to reuse rather than create. */
const SPACE_DELIVERY_COMPLETE = [
  desktopState('space-delivery-victim'),
  desktopState('space-delivery-sender'),
  spaceState('space-delivery-victim'),
  spaceState('space-delivery-sender'),
];

describe('mintGuardReason', () => {
  it('allows an arm whose identities all exist', () => {
    const io = only(desktopState('alice-bot'), desktopState('bob-bot'));
    expect(mintGuardReason({ label: 'dm-basic' }, REPOS, io, {})).toBeNull();
  });

  it('blocks an arm when even ONE identity is missing', () => {
    // The dangerous middle case: a machine that ran dm-basic once but never
    // dm-delivery. Half-present state must not read as safe.
    const io = only(desktopState('alice-bot'));
    const reason = mintGuardReason({ label: 'dm-basic' }, REPOS, io, {});
    expect(reason).toContain('bob-bot.json');
    expect(reason).not.toContain('alice-bot.json');
  });

  it('names the arm’s missing files, so the reader knows which fix applies', () => {
    const reason = mintGuardReason({ label: 'dm-delivery' }, REPOS, NOTHING, {});
    expect(reason).toContain('dm-delivery-receiver.json');
    expect(reason).toContain('dm-delivery-sender.json');
  });

  // The fail-safe direction, and the opposite of routing.mjs's. Routing fails
  // toward running MORE because an unnecessary six minutes is cheap; here the
  // thing being avoided is irreversible, so an unknown arm is assumed to mint.
  it('blocks an arm it does not recognise, rather than assuming it is safe', () => {
    const reason = mintGuardReason({ label: 'some-new-arm' }, REPOS, EVERYTHING, {});
    expect(reason).toContain('no persisted-state entry');
    expect(reason).toContain('mintGuard.mjs');
  });

  it('reports unknown separately from missing, so the two cannot be confused', () => {
    expect(missingStateFor({ label: 'some-new-arm' }, REPOS, EVERYTHING, {})).toEqual({
      unknown: true,
      missing: [],
      mints: null,
    });
    expect(missingStateFor({ label: 'dm-basic' }, REPOS, EVERYTHING, {})).toEqual({
      unknown: false,
      missing: [],
      mints: null,
    });
  });

  it('always names the opt-in flag, whichever branch produced the reason', () => {
    for (const label of ['dm-basic', 'some-new-arm']) {
      expect(mintGuardReason({ label }, REPOS, NOTHING, {})).toContain('--live-allow-minting');
    }
  });
});

/**
 * `space-delivery` reuses a persisted space and CREATES one — permanent,
 * undeletable — whenever it cannot restore. `restoreSharedSpace`
 * (`spaceState.ts:304-330`) has four bail-outs and three of them leave the files
 * sitting on disk, so existence alone is not the right question.
 */
describe('space-delivery: mirroring restoreSharedSpace', () => {
  it('runs when both participants have a restorable snapshot', () => {
    const io = only(...SPACE_DELIVERY_COMPLETE);
    expect(mintGuardReason({ label: 'space-delivery' }, REPOS, io, {})).toBeNull();
  });

  // The defect adversarial review found. `restoreSharedSpace` is all-or-nothing
  // (`snaps.some((s) => !s)`), so the SENDER's file is as load-bearing as the
  // victim's — and the first version of this guard listed only the victim.
  it('blocks when only the SENDER’s space file is missing', () => {
    const io = only(
      desktopState('space-delivery-victim'),
      desktopState('space-delivery-sender'),
      spaceState('space-delivery-victim')
    );
    const reason = mintGuardReason({ label: 'space-delivery' }, REPOS, io, {});
    expect(reason).toContain('space-delivery-sender-space.json');
  });

  it('blocks when only the VICTIM’s space file is missing', () => {
    const io = only(
      desktopState('space-delivery-victim'),
      desktopState('space-delivery-sender'),
      spaceState('space-delivery-sender')
    );
    expect(mintGuardReason({ label: 'space-delivery' }, REPOS, io, {})).toContain(
      'space-delivery-victim-space.json'
    );
  });

  // `loadSpaceState` swallows a parse error and returns undefined, which sends
  // the scenario to its create branch. The file exists the whole time.
  it('blocks when a space file exists but cannot be parsed', () => {
    const io = {
      exists: () => true,
      readText: (p: string) => (p.includes('sender-space') ? '{ truncated' : GOOD_SPACE),
    };
    expect(mintGuardReason({ label: 'space-delivery' }, REPOS, io, {})).toContain(
      'space-delivery-sender-space.json'
    );
  });

  // Two bots holding DIFFERENT spaces each restore happily and then fail to
  // exchange anything, so restoreSharedSpace rejects the pair and creates.
  it('blocks when the two snapshots name different spaces', () => {
    const io = {
      exists: () => true,
      readText: (p: string) =>
        p.includes('sender-space')
          ? JSON.stringify({ spaceId: 'OTHER', channelId: 'C1', savedAt: 0 })
          : GOOD_SPACE,
    };
    expect(mintGuardReason({ label: 'space-delivery' }, REPOS, io, {})).toContain('unrestorable');
  });

  // CONTROL for the test above: same shape, agreeing ids, must be allowed —
  // otherwise "blocks on disagreement" would pass against a guard that blocks
  // unconditionally.
  it('allows two snapshots that agree', () => {
    const io = { exists: () => true, readText: () => GOOD_SPACE };
    expect(mintGuardReason({ label: 'space-delivery' }, REPOS, io, {})).toBeNull();
  });

  // HARNESS_FRESH short-circuits restore before a single file is read, so a
  // fully-populated machine still mints. The harness's own docs recommend
  // setting it, and nothing in scripts/verify/ clears it.
  it('blocks under HARNESS_FRESH even with every file present', () => {
    const io = only(...SPACE_DELIVERY_COMPLETE);
    for (const value of ['1', 'true']) {
      const reason = mintGuardReason({ label: 'space-delivery' }, REPOS, io, {
        HARNESS_FRESH: value,
      });
      expect(reason).toContain('HARNESS_FRESH');
      // It must NOT send the reader off to fix files that are fine.
      expect(reason).not.toContain('missing');
    }
  });

  it('ignores a HARNESS_FRESH value that is not 1 or true', () => {
    const io = only(...SPACE_DELIVERY_COMPLETE);
    expect(
      mintGuardReason({ label: 'space-delivery' }, REPOS, io, { HARNESS_FRESH: '0' })
    ).toBeNull();
  });

  /**
   * The guard and the scenario must answer "fresh space?" identically.
   *
   * Adversarial review found this rule hand-copied into the guard, because
   * `spaceState.ts` is TypeScript and the guard is plain `.mjs` run by node. The
   * two agreed at the time and nothing coupled them, so a later edit to either
   * would have left the guard silently under-protecting — clearing
   * `space-delivery` while the scenario went on to create a permanent Space.
   *
   * The rule now lives in `routing.mjs` and `spaceState.ts` re-exports it. This
   * test pins that: it imports the function through the HARNESS's path, so if
   * anyone reintroduces a local definition there, the two objects stop being
   * the same one and this goes red.
   */
  it('shares one wantsFreshSpace with the harness, not a copy', async () => {
    const fromRouting = (await import('../../../../scripts/verify/routing.mjs'))
      .wantsFreshSpace;
    const fromHarness = (await import('../harness/spaceState')).wantsFreshSpace;
    expect(fromHarness).toBe(fromRouting);

    // And it still behaves, so "same reference" cannot be satisfied by two
    // identically-broken exports.
    for (const [env, expected] of [
      [{ HARNESS_FRESH: '1' }, true],
      [{ HARNESS_FRESH: 'true' }, true],
      [{ HARNESS_FRESH: '0' }, false],
      [{ HARNESS_FRESH: '' }, false],
      [{}, false],
    ] as [Record<string, string>, boolean][]) {
      expect(fromRouting(env), JSON.stringify(env)).toBe(expected);
    }
  });
});

/**
 * `cross-dm` picks its bot names from `HARNESS_DESKTOP_ROLE`, on BOTH platforms
 * at once (desktop `a` ⇒ mobile `b`). The guard must resolve the role rather
 * than assume the default, or it clears one pair and the arm mints the other.
 */
describe('cross-dm: role-dependent identities', () => {
  const defaultIo = only(desktopState('cross-desktop-b'), mobileState('dm-bot-a'));
  const flippedIo = only(desktopState('cross-desktop-a'), mobileState('dm-bot-b'));

  it('checks the default pair when the role is unset', () => {
    expect(mintGuardReason({ label: 'cross-dm' }, REPOS, defaultIo, {})).toBeNull();
  });

  it('checks the FLIPPED pair when HARNESS_DESKTOP_ROLE=a', () => {
    expect(
      mintGuardReason({ label: 'cross-dm' }, REPOS, flippedIo, { HARNESS_DESKTOP_ROLE: 'a' })
    ).toBeNull();
  });

  // The actual defect: default files present, role flipped, guard used to wave
  // it through and the arm minted cross-desktop-a AND dm-bot-b.
  it('blocks the flipped run when only the DEFAULT pair exists', () => {
    const reason = mintGuardReason({ label: 'cross-dm' }, REPOS, defaultIo, {
      HARNESS_DESKTOP_ROLE: 'a',
    });
    expect(reason).toContain('cross-desktop-a.json');
    expect(reason).toContain('dm-bot-b.json');
  });

  it('blocks the default run when only the FLIPPED pair exists', () => {
    const reason = mintGuardReason({ label: 'cross-dm' }, REPOS, flippedIo, {});
    expect(reason).toContain('cross-desktop-b.json');
    expect(reason).toContain('dm-bot-a.json');
  });

  it('treats any role value other than "a" as the default', () => {
    // Mirrors run-cross.mjs's `=== 'a' ? 'a' : 'b'`. If that ever becomes a
    // three-way choice, this goes red rather than silently mis-guarding.
    for (const value of ['b', 'B', 'A', '', 'nonsense']) {
      expect(
        mintGuardReason({ label: 'cross-dm' }, REPOS, defaultIo, {
          HARNESS_DESKTOP_ROLE: value,
        }),
        `HARNESS_DESKTOP_ROLE=${JSON.stringify(value)} should resolve to the default pair`
      ).toBeNull();
    }
  });
});

describe('contract: the guard covers every live arm', () => {
  const liveSteps = stepsFor('desktop', DESKTOP_REPO, 'live');

  /**
   * Asserted BY VALUE, mirroring routing.test.ts's held-back-arms test and for
   * the same reason: the other contract tests only check that declared names
   * still exist in the scenarios. Neither can see a name being DELETED from the
   * table — and deleting one is the silent way to weaken the guard, because the
   * arm then looks fully satisfied while the scenario quietly mints whatever was
   * dropped. That is exactly how the `space-delivery-sender-space` gap shipped
   * with a green suite. Updating this list should be a deliberate act.
   */
  it('declares exactly the state each arm reuses', () => {
    const resolved = Object.fromEntries(
      Object.entries(STATE_BY_ARM).map(([k, f]) => [k, (f as (e: unknown) => unknown)({})])
    );
    expect(resolved).toEqual({
      'dm-basic': { desktop: ['alice-bot', 'bob-bot'] },
      'dm-delivery': { desktop: ['dm-delivery-receiver', 'dm-delivery-sender'] },
      'space-basic': { desktop: ['space-basic-a', 'space-basic-b'] },
      'space-delivery': {
        desktop: ['space-delivery-victim', 'space-delivery-sender'],
        spaces: ['space-delivery-victim', 'space-delivery-sender'],
        mints: null,
      },
      'cross-dm': { desktop: ['cross-desktop-b'], mobile: ['dm-bot-a'] },
      'config-cross': {
        desktop: ['config-cross-desktop', 'config-cross-read-desktop'],
        mobile: ['config-sync-bot'],
      },
    });
  });

  it('has an entry for every arm in the live catalogue', () => {
    const uncovered = liveSteps
      .map((s: { label: string }) => s.label)
      .filter((label: string) => !(label in STATE_BY_ARM));
    expect(uncovered).toEqual([]);
  });

  it('has no entry for an arm that no longer exists', () => {
    // The other direction. A stale entry is not dangerous, but it is a lie
    // about what the gate runs, and it is how this table starts drifting from
    // steps.mjs.
    const labels = new Set(liveSteps.map((s: { label: string }) => s.label));
    expect(Object.keys(STATE_BY_ARM).filter((k) => !labels.has(k))).toEqual([]);
  });
});

/**
 * Every declared name must match a bot the scenario actually creates.
 *
 * Names are EXTRACTED from the `createBot(...)` / `createSpaceBot(...)` calls,
 * not searched for. The first version of this test searched instead, and it was
 * wrong in the way that matters: it looked for the declared name or, failing
 * that, the name minus its last dash-segment. FALSIFIED 2026-08-24 — renaming
 * `createBot('alice-bot')` to `'alicia-bot'` left all tests green, because
 * `dm-basic.scenario.test.ts` has a local variable called `alice` and the
 * stripped stem found that instead. A contract test satisfied by an unrelated
 * identifier is worse than none: it certifies a link that is not there.
 *
 * Extraction has no such failure mode, because the only strings it can see are
 * the ones passed to a bot constructor. Interpolated segments
 * (`` `cross-desktop-${ROLE}` ``) become a `.+` wildcard, so they match
 * `cross-desktop-b` but not `crossdesk-b`.
 */
describe('contract: declared names match the scenarios on disk', () => {
  const BOT_CALL = /create(?:Space)?Bot\(\s*[`'"]([^`'"]+)[`'"]/g;
  const IDENTITY_CALL = /loadOrCreate(?:Bot|Identity)\(\s*[`'"]([^`'"]+)[`'"]/g;

  const namesIn = (source: string, patterns: RegExp[]) =>
    patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]));

  /**
   * Does a name the scenario creates account for a name we declared?
   *
   * Order matters and got this wrong once: escaping first turns `${ROLE}` into
   * `$\{ROLE\}`, which the interpolation pattern can no longer match, so the
   * wildcard was never substituted and every templated bot failed against
   * correct code. Punch the interpolations out to a sentinel FIRST, escape what
   * is left, then splice the wildcard back in. The sentinel is a NUL, which
   * cannot occur in a bot name and is untouched by the escape class.
   */
  const covers = (created: string, declared: string) => {
    const SENTINEL = '\u0000';
    const pattern = created
      .replace(/\$\{[^}]*\}/g, SENTINEL)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .split(SENTINEL)
      .join('.+');
    return new RegExp(`^${pattern}$`).test(declared);
  };

  const SCENARIOS: Record<string, string[]> = {
    'dm-basic': ['dm-basic.scenario.test.ts'],
    'dm-delivery': ['dm-delivery.scenario.test.ts'],
    'space-basic': ['space-basic.scenario.test.ts'],
    'space-delivery': ['space-delivery.scenario.test.ts'],
    'cross-dm': ['dm-cross.scenario.test.ts'],
    // run-config-cross.mjs runs both directions by default, so both files are
    // in scope for this arm.
    'config-cross': ['config-cross.scenario.test.ts', 'config-from-mobile.scenario.test.ts'],
  };

  /** Both roles, so a role-dependent arm is checked in both configurations. */
  const ENVS = [{}, { HARNESS_DESKTOP_ROLE: 'a' }];
  const specOf = (arm: string, env: unknown) =>
    (STATE_BY_ARM as Record<string, (e: unknown) => Record<string, string[]>>)[arm](env);

  it('maps every arm to at least one scenario file that exists', () => {
    for (const arm of Object.keys(STATE_BY_ARM)) {
      expect(SCENARIOS[arm], `no scenario mapped for ${arm}`).toBeDefined();
      for (const file of SCENARIOS[arm]) {
        expect(existsSync(resolve(HARNESS, file)), `${file} not found`).toBe(true);
      }
    }
  });

  it('finds every declared DESKTOP name in its scenario source, in both roles', () => {
    for (const env of ENVS) {
      for (const arm of Object.keys(STATE_BY_ARM)) {
        const source = SCENARIOS[arm]
          .map((f) => readFileSync(resolve(HARNESS, f), 'utf8'))
          .join('\n');
        const created = namesIn(source, [BOT_CALL, IDENTITY_CALL]);
        const spec = specOf(arm, env);
        // `spaces` holds bot names too — spaceState.ts appends `-space` to them
        // when it writes the file — so they are validated the same way.
        for (const name of [...(spec.desktop ?? []), ...(spec.spaces ?? [])]) {
          expect(
            created.some((c) => covers(c, name)),
            `${arm}: "${name}" is declared in mintGuard.mjs but no scenario creates it ` +
              `(scenario creates: ${created.join(', ') || 'nothing'}) — the guard is stale ` +
              'and would report this arm safe while it mints under a new name'
          ).toBe(true);
        }
      }
    }
  });

  /**
   * The other direction, and the one that catches a bot being ADDED.
   *
   * A new `createBot('whatever')` in an existing scenario mints an account the
   * guard knows nothing about, and every test above would stay green: they only
   * ever ask whether declared names still exist. This asks whether created names
   * are declared, in at least one role configuration.
   */
  it('declares every bot the scenarios create', () => {
    for (const [arm, files] of Object.entries(SCENARIOS)) {
      const source = files.map((f) => readFileSync(resolve(HARNESS, f), 'utf8')).join('\n');
      const declared = ENVS.flatMap((env) => {
        const spec = specOf(arm, env);
        return [...(spec.desktop ?? []), ...(spec.spaces ?? [])];
      });
      for (const created of namesIn(source, [BOT_CALL, IDENTITY_CALL])) {
        expect(
          declared.some((d) => covers(created, d)),
          `${arm}: scenario creates "${created}" but mintGuard.mjs does not declare it — ` +
            'that bot would be minted on a fresh checkout with no guard'
        ).toBe(true);
      }
    }
  });

  it('finds every declared MOBILE bot name in quorum-mobile’s scenarios', () => {
    const mobileRepo = resolveMobileRepo(DESKTOP_REPO);
    const harnessDir = resolve(mobileRepo, 'dev/harness');
    if (!existsSync(harnessDir)) {
      // The fast tier has to pass on a machine with no sibling checkout. Absent
      // mobile is already handled at runtime by `needsMobile` in index.mjs, so
      // skipping here loses nothing the gate depends on.
      expect(true).toBe(true);
      return;
    }
    const MOBILE_SOURCES: Record<string, string[]> = {
      // run-cross.mjs drives mobile's existing dm-two-bot scenario, whose bot is
      // `dm-bot-${ROLE}` — so both roles resolve into the same file.
      'dm-bot-a': ['dm-two-bot.scenario.ts'],
      'dm-bot-b': ['dm-two-bot.scenario.ts'],
      'config-sync-bot': ['config-cross.scenario.ts', 'config-to-desktop.scenario.ts'],
    };
    for (const env of ENVS) {
      for (const arm of Object.keys(STATE_BY_ARM)) {
        for (const name of specOf(arm, env).mobile ?? []) {
          const files = MOBILE_SOURCES[name];
          expect(files, `no mobile source mapped for "${name}"`).toBeDefined();
          const source = files
            .filter((f) => existsSync(resolve(harnessDir, f)))
            .map((f) => readFileSync(resolve(harnessDir, f), 'utf8'))
            .join('\n');
          const created = namesIn(source, [BOT_CALL, IDENTITY_CALL]);
          expect(
            created.some((c) => covers(c, name)),
            `"${name}" is declared but no mobile scenario creates it ` +
              `(creates: ${created.join(', ') || 'nothing'}) — mintGuard.mjs is stale`
          ).toBe(true);
        }
      }
    }
  });
});
