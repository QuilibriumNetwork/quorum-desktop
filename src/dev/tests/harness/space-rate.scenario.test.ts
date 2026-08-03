// SLICE S2 — the deliverable. How OFTEN does a new joiner get the roster?
//
//   yarn harness space-rate
//   HARNESS_RATE_SIZES=2,25,79 HARNESS_RATE_ITERATIONS=10 yarn harness space-rate
//
// S1 proved the exchange CAN work. It ran at two members and passed five times,
// which says nothing about a failure reported at ~79 members and described as
// intermittent. This scenario answers the three questions
// `2026-08-02-roster-pull-delivers-nothing-to-a-new-joiner.md` under .agents/issues/
// says a manual test cannot:
//
//   1. is it 1-in-2 or 1-in-50?
//   2. does it correlate with roster size?
//   3. does it ever succeed twice in a row?
//
// Each iteration is an independent trial: fresh accounts, a fresh space, a fresh
// joiner. A creates a space and holds a roster of N; B joins and must converge to
// N. Success is B's row count reaching N within the window, read from IndexedDB.
//
// ⚠️ THIS SCENARIO DOES NOT ASSERT A PASS RATE, deliberately. It is an
// instrument, not a regression test: it prints a rate and only fails if the
// instrument itself is broken (no trial completed). Asserting "≥90% must
// succeed" would convert a measurement into a coin flip that goes red on the
// days the bug is worst — which is exactly when the number matters most.
//
// ⚠️ COST. Every iteration registers two accounts and creates one space on
// PRODUCTION, and nothing cleans them up. A 3-size × 10-iteration sweep is 60
// registrations and 30 spaces. Creating throwaway spaces on production is
// approved (see the spec's operator decisions), but the volume is not
// incidental — start small and scale deliberately.
import { test, expect } from 'vitest';
import { createSpaceBot } from './spaceBot';
import { RunLog } from './log';

const SIZES = (process.env.HARNESS_RATE_SIZES ?? '2,25,79')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 2);
const ITERATIONS = Number(process.env.HARNESS_RATE_ITERATIONS ?? 3);
const WINDOW_MS = Number(process.env.HARNESS_RATE_WINDOW_MS ?? 90_000);
const SAMPLE_MS = Number(process.env.HARNESS_RATE_SAMPLE_MS ?? 2000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Trial {
  size: number;
  iteration: number;
  ok: boolean;
  /** Rows B ended with (1 = its own row only, i.e. nothing arrived). */
  got: number;
  /** ms from B joining to B reaching the full roster. */
  ms?: number;
  novelErrors: number;
  note?: string;
}

/** Longest run of consecutive successes — question 3, straight from the data. */
function longestStreak(trials: Trial[]): number {
  let best = 0;
  let cur = 0;
  for (const t of trials) {
    cur = t.ok ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

test(
  'space-rate: how often does a new joiner receive the full member roster?',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('space-rate', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[space-rate] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    say(
      `sweep sizes=[${SIZES.join(', ')}] iterations=${ITERATIONS} window=${WINDOW_MS / 1000}s ` +
        `(${SIZES.length * ITERATIONS} trials, ${SIZES.length * ITERATIONS * 2} registrations)`
    );

    const trials: Trial[] = [];

    for (const size of SIZES) {
      for (let i = 1; i <= ITERATIONS; i++) {
        const stamp = `${String(Date.now()).slice(-7)}`;
        let a: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
        let b: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
        try {
          [a, b] = await Promise.all([
            createSpaceBot(`rate-a-${stamp}`),
            createSpaceBot(`rate-b-${stamp}`),
          ]);
          await Promise.all([a.start(), b.start()]);

          const { spaceId } = await a.createSpace(
            `harness-s2-${size}-${stamp}`
          );
          // A already holds its own row, so seed size-1 to reach `size`.
          const seeded = await a.seedMembers(spaceId, size - 1);
          if (seeded !== size) {
            throw new Error(
              `seeding produced ${seeded} rows, expected ${size}`
            );
          }

          const link = await a.inviteLink(spaceId);
          const joinedAt = Date.now();
          await b.join(link);

          // B's join fires requestSync itself, so nothing here has to nudge it.
          //
          // Target arithmetic: A's roster is `size` and already counts A. B
          // writes its own row locally at join, and must then receive A's
          // `size` rows from the wire — so a complete result is `size + 1`.
          const target = size + 1;
          let ms: number | undefined;
          const deadline = Date.now() + WINDOW_MS;
          while (Date.now() < deadline) {
            await sleep(SAMPLE_MS);
            if ((await b.members(spaceId)) >= target) {
              ms = Date.now() - joinedAt;
              break;
            }
          }

          const got = await b.members(spaceId);
          const trial: Trial = {
            size,
            iteration: i,
            ok: got >= target,
            got,
            ms,
            novelErrors: b.novelErrors().length,
          };
          trials.push(trial);
          log.add(Date.now(), 'harness', 'trial', { ...trial });
          say(
            `  size=${size} iter=${i}/${ITERATIONS}  ${trial.ok ? 'OK' : 'MISS'}  ` +
              `rows=${got}/${target}` +
              (ms ? `  ${(ms / 1000).toFixed(1)}s` : '') +
              (trial.novelErrors ? `  novelErrors=${trial.novelErrors}` : '')
          );
        } catch (err) {
          // A thrown trial is NOT a delivery failure — it is the harness or the
          // relay failing, and folding it into the rate would corrupt the very
          // number this exists to produce. Recorded separately.
          const note = (err as Error)?.message ?? String(err);
          trials.push({
            size,
            iteration: i,
            ok: false,
            got: -1,
            novelErrors: 0,
            note,
          });
          say(
            `  size=${size} iter=${i}/${ITERATIONS}  ERROR (excluded from rate): ${note}`
          );
        } finally {
          a?.stop();
          b?.stop();
        }
      }
    }

    // ── Report ───────────────────────────────────────────────────────────────
    const valid = trials.filter((t) => t.got >= 0);
    const errored = trials.filter((t) => t.got < 0);

    say('');
    say('==== ROSTER DELIVERY RATE ====');
    say(
      `roster size | trials | delivered | rate   | median lag | longest streak`
    );
    for (const size of SIZES) {
      const forSize = valid.filter((t) => t.size === size);
      if (!forSize.length) continue;
      const ok = forSize.filter((t) => t.ok);
      const med = median(ok.map((t) => t.ms!).filter(Boolean));
      say(
        `${String(size).padStart(11)} | ${String(forSize.length).padStart(6)} | ` +
          `${String(ok.length).padStart(9)} | ` +
          `${((ok.length / forSize.length) * 100).toFixed(0).padStart(4)}% | ` +
          `${(med ? `${(med / 1000).toFixed(1)}s` : '—').padStart(10)} | ` +
          `${longestStreak(forSize)}`,
        {
          size,
          trials: forSize.length,
          delivered: ok.length,
          medianMs: med,
          longestStreak: longestStreak(forSize),
        }
      );
    }

    const allOk = valid.filter((t) => t.ok);
    say('');
    say(
      `OVERALL ${allOk.length}/${valid.length} delivered` +
        (valid.length
          ? ` (${((allOk.length / valid.length) * 100).toFixed(0)}%)`
          : '') +
        `, longest success streak ${longestStreak(valid)}`,
      { delivered: allOk.length, trials: valid.length }
    );
    // A partial roster is a DIFFERENT failure from an empty one: empty means the
    // member payload never arrived, partial means it arrived carrying less than
    // the peer holds (the peer-selection defect, NEXT STEP A in the bug file).
    // Reporting one number for both would hide which mechanism is at work.
    const empty = valid.filter((t) => !t.ok && t.got <= 1).length;
    const partial = valid.filter((t) => !t.ok && t.got > 1).length;
    say(
      `misses: ${empty} EMPTY (nothing arrived), ${partial} PARTIAL (short of the peer)`,
      {
        empty,
        partial,
      }
    );
    if (errored.length) {
      say(
        `⚠️ ${errored.length} trial(s) errored and are EXCLUDED from the rate above:`
      );
      for (const e of errored)
        say(`   size=${e.size} iter=${e.iteration}: ${e.note}`);
    }
    say(`log: ${log.file}`);

    // The run IS the measurement. Assert only that the instrument produced data —
    // see the header for why a pass-rate assertion would be wrong here.
    expect(valid.length).toBeGreaterThan(0);
  },
  4 * 60 * 60 * 1000
);
