// Does a RECONNECT BACKLOG starve the roster handshake?
//
//   yarn harness space-backlog
//   HARNESS_BACKLOG_SIZES=0,50,200 HARNESS_BACKLOG_ITERATIONS=3 yarn harness space-backlog
//
// This is the experiment `.agents/bugs/2026-08-02-sync-requests-arrive-four-
// minutes-late-and-every-peer-rejects-them.md` §5b step 1 asks for, and it is
// the thing a manual test cannot do: vary the backlog and watch the rate move.
//
// ## The field observation being reproduced
//
// A joiner that had not opened the app in a long time showed a console dominated
// by its reconnect backlog — 352 `announce-keys`, 659 decrypt calls, running from
// log line 245 to 4040. Its three `sync-request`s sat at lines 2211, 2225 and
// 3998, interleaved in that flood, and every one was read ~210s late against a
// 30s expiry. It answered NOBODY for four minutes, across all six of its spaces,
// and stayed at 1 member row.
//
// The reading is head-of-line blocking: the frames are not slow to arrive, the
// client is slow to reach them. Inbound processing is serial (the app's
// `processInbound`, and `WsTransport.dispatch` here), so a perishable
// `sync-request` queued behind hundreds of real decrypts is stale by the time it
// is read. The expiry is doing its job; the scheduling is the bug.
//
// ## Why the previous sweep could not see this
//
// `space-rate` measured 15/15 at 2, 25 and 79 members — on FRESH accounts with no
// backlog. That is not a refutation of the field failure; it is the CONTROL ARM
// of the hypothesis above, and it behaved exactly as predicted. This scenario
// adds the treatment arm.
//
// ## The design
//
//   A creates S_backlog, B joins it            → B now has an inbox the relay fills
//   B goes offline                             → transport closed, frames retain
//   A posts M messages to S_backlog            → M real frames queue for B
//   A creates S_target and seeds a roster of N
//   B comes back online AND joins S_target     → the flood and the handshake race
//
// Sweeping M gives a dose-response curve. If the roster rate falls as M grows,
// the diagnosis is settled with a curve rather than an anecdote — and
// `announce-keys` flooding, currently rated LOW because it needs an attacker,
// becomes a no-attacker-needed availability bug.
//
// ⚠️ FIDELITY, stated honestly. The field backlog was `announce-keys` control
// messages; this uses space POSTS. Both enter the same space branch of
// `handleNewMessage` and both cost a real hub-envelope unseal plus a triple
// ratchet decrypt, so posts are a faithful proxy for the COST and the SERIAL
// QUEUE. They are not a proxy for anything specific to announce-keys handling.
// What this cannot reproduce at all is the socket behaviour that needs real
// devices — see "Why every bench was green" in tasks/transport/measurements.md.
import { test, expect } from 'vitest';
import { createSpaceBot } from './spaceBot';
import { RunLog } from './log';

const SIZES = (process.env.HARNESS_BACKLOG_SIZES ?? '0,50,200')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0);
const ITERATIONS = Number(process.env.HARNESS_BACKLOG_ITERATIONS ?? 2);
const ROSTER = Number(process.env.HARNESS_BACKLOG_ROSTER ?? 79);
const WINDOW_MS = Number(process.env.HARNESS_BACKLOG_WINDOW_MS ?? 180_000);
const SAMPLE_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Trial {
  backlog: number;
  iteration: number;
  ok: boolean;
  got: number;
  target: number;
  /** ms from B rejoining to a complete roster. */
  ms?: number;
  /** Frames B's socket actually received during the window. */
  framesArrived: number;
  note?: string;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

test(
  'space-backlog: does a reconnect backlog starve the roster handshake?',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('space-backlog', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[space-backlog] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    say(
      `backlog sweep=[${SIZES.join(', ')}] iterations=${ITERATIONS} roster=${ROSTER} ` +
        `window=${WINDOW_MS / 1000}s`
    );

    const trials: Trial[] = [];

    for (const backlog of SIZES) {
      for (let i = 1; i <= ITERATIONS; i++) {
        const stamp = String(Date.now()).slice(-7);
        let a: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
        let b: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
        try {
          [a, b] = await Promise.all([
            createSpaceBot(`bk-a-${stamp}`),
            createSpaceBot(`bk-b-${stamp}`),
          ]);
          await Promise.all([a.start(), b.start()]);

          // 1. A space B belongs to, so the relay has somewhere to queue for it.
          const s1 = await a.createSpace(`harness-bk-src-${stamp}`);
          await b.join(await a.inviteLink(s1.spaceId));

          // 2. B goes offline. Frames posted now are retained for it.
          b.disconnect();
          await sleep(1000);

          // 3. Build the backlog.
          if (backlog > 0) {
            say(`  building backlog of ${backlog} message(s)…`);
            await a.postMany(s1.spaceId, s1.channelId, backlog, `bk-${stamp}`);
          }

          // 4. The space whose roster we actually care about.
          const s2 = await a.createSpace(`harness-bk-tgt-${stamp}`);
          const seeded = await a.seedMembers(s2.spaceId, ROSTER - 1);
          if (seeded !== ROSTER) {
            throw new Error(`seeding produced ${seeded}, expected ${ROSTER}`);
          }
          const link = await a.inviteLink(s2.spaceId);

          // 5. B returns and joins. The retained flood and the roster handshake
          //    now compete for B's single serial inbound queue — the field
          //    condition.
          const framesBefore = b.transport.arrived.length;
          await b.reconnect();
          const rejoinedAt = Date.now();
          await b.join(link);

          const target = ROSTER + 1;
          let ms: number | undefined;
          const deadline = Date.now() + WINDOW_MS;
          while (Date.now() < deadline) {
            await sleep(SAMPLE_MS);
            if ((await b.members(s2.spaceId)) >= target) {
              ms = Date.now() - rejoinedAt;
              break;
            }
          }

          const got = await b.members(s2.spaceId);
          const trial: Trial = {
            backlog,
            iteration: i,
            ok: got >= target,
            got,
            target,
            ms,
            framesArrived: b.transport.arrived.length - framesBefore,
          };
          trials.push(trial);
          log.add(Date.now(), 'harness', 'trial', { ...trial });
          say(
            `  backlog=${backlog} iter=${i}/${ITERATIONS}  ${trial.ok ? 'OK' : 'MISS'}  ` +
              `rows=${got}/${target}  framesArrived=${trial.framesArrived}` +
              (ms ? `  ${(ms / 1000).toFixed(1)}s` : '')
          );
        } catch (err) {
          const note = (err as Error)?.message ?? String(err);
          trials.push({
            backlog,
            iteration: i,
            ok: false,
            got: -1,
            target: ROSTER + 1,
            framesArrived: 0,
            note,
          });
          say(`  backlog=${backlog} iter=${i}  ERROR (excluded): ${note}`);
        } finally {
          a?.stop();
          b?.stop();
        }
      }
    }

    const valid = trials.filter((t) => t.got >= 0);
    const errored = trials.filter((t) => t.got < 0);

    say('');
    say('==== ROSTER DELIVERY vs RECONNECT BACKLOG ====');
    say(`backlog | trials | delivered | rate  | median lag | median frames`);
    for (const backlog of SIZES) {
      const forSize = valid.filter((t) => t.backlog === backlog);
      if (!forSize.length) continue;
      const ok = forSize.filter((t) => t.ok);
      const med = median(ok.map((t) => t.ms!).filter(Boolean));
      const medFrames = median(forSize.map((t) => t.framesArrived));
      say(
        `${String(backlog).padStart(7)} | ${String(forSize.length).padStart(6)} | ` +
          `${String(ok.length).padStart(9)} | ` +
          `${((ok.length / forSize.length) * 100).toFixed(0).padStart(4)}% | ` +
          `${(med ? `${(med / 1000).toFixed(1)}s` : '—').padStart(10)} | ${medFrames ?? '—'}`,
        {
          backlog,
          trials: forSize.length,
          delivered: ok.length,
          medianMs: med,
          medianFrames: medFrames,
        }
      );
    }
    say('');
    say(
      'Read the RATE column top to bottom. A fall as backlog grows is the ' +
        'head-of-line-blocking diagnosis confirmed; a flat column says the ' +
        'backlog is not what starves the handshake, and the field cause is ' +
        'something this harness still cannot host.'
    );
    if (errored.length) {
      say(`⚠️ ${errored.length} trial(s) errored and are EXCLUDED:`);
      for (const e of errored)
        say(`   backlog=${e.backlog} iter=${e.iteration}: ${e.note}`);
    }
    say(`log: ${log.file}`);

    // Instrument, not regression test — see space-rate for the reasoning.
    expect(valid.length).toBeGreaterThan(0);
  },
  4 * 60 * 60 * 1000
);
