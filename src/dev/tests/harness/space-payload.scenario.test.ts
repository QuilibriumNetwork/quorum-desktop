// Does the member delta survive when it is the LAST of several payloads?
//
//   yarn harness space-payload
//   HARNESS_PAYLOAD_MESSAGES=0,5,50 HARNESS_PAYLOAD_ITERATIONS=3 yarn harness space-payload
//
// ## ✅ WHAT THIS ESTABLISHED — and it refuted the premise it was built on
//
// The field signature of the roster failure is precise:
//
//   sync-delta: memberDelta=ABSENT, messageDelta=present, isFinal=false
//   …and a console-wide search for isFinal=true returned NOTHING.
//
// `buildSyncDeltaPayloads` (quorum-shared/src/sync/service.ts:731-790) emits
// message chunks first with `isFinal: false`, then a SEPARATE final payload
// carrying `memberDelta` with `isFinal: true`. So the field failure is
// specifically **the LAST of several payloads never arriving**.
//
// This scenario was written on the assumption that `space-rate` and
// `space-backlog` were blind to that shape, because their target spaces hold no
// posts — no posts, no message chunk, so the member delta would be the ONLY
// payload, and a one-payload exchange cannot lose "the last of N".
//
// **That assumption was WRONG, and the first run disproved it:**
//
//   sync-initiate: Their manifest has 0 digests
//   sync-initiate: Built 2 delta payload(s)          ← TWO, with zero posts
//   sync-delta: memberDelta=ABSENT, messageDelta=present, isFinal=false
//   sync-delta: memberDelta=79 members, …, isFinal=true    ← and it ARRIVES
//
// The `join` control message is itself a message digest, so there is ALWAYS a
// message chunk ahead of the member payload. Every space scenario has been
// exercising the exact field shape from the beginning, and the final payload
// lands every time.
//
// **Payload count is therefore ruled out as the variable**, and the earlier
// green results are broader than I claimed, not narrower. Kept as a scenario
// because it is the only place that reports `builtPayloads` from the responder's
// own log, so a future change that alters payload assembly is visible here — and
// because HARNESS_PAYLOAD_BYTES can push past the 5 MB chunk boundary if
// three-or-more-payload behaviour ever needs testing.
//
// ## What to read in the output
//
// `builtPayloads` comes from the RESPONDER's own log line ("Built N delta
// payload(s)"), so it is what the real code decided to send, not an inference.
// Compare it against whether the roster landed:
//
//   builtPayloads=1, roster OK          → the one-payload case, already known good
//   builtPayloads=2+, roster OK         → multi-payload delivery works; the field
//                                          failure needs some other variable
//   builtPayloads=2+, roster MISSING    → 🔴 reproduced. The last payload is the
//                                          one that dies, and that is the field bug
//
// ⚠️ Chunking note: `chunkMessages` splits at MAX_CHUNK_SIZE (5 MB), so a few
// small messages produce ONE message chunk, giving 2 payloads total. That is
// already the field shape ("Built 2 delta payload(s)"). Pushing beyond 2 needs
// >5 MB of message bodies — HARNESS_PAYLOAD_BYTES exists for that.
import { test, expect } from 'vitest';
import { createSpaceBot } from './spaceBot';
import { RunLog } from './log';

const COUNTS = (process.env.HARNESS_PAYLOAD_MESSAGES ?? '0,5,50')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0);
const ITERATIONS = Number(process.env.HARNESS_PAYLOAD_ITERATIONS ?? 2);
const ROSTER = Number(process.env.HARNESS_PAYLOAD_ROSTER ?? 79);
/** Body size per message. Raise past ~5MB total to force multiple chunks. */
const BYTES = Number(process.env.HARNESS_PAYLOAD_BYTES ?? 64);
const WINDOW_MS = Number(process.env.HARNESS_PAYLOAD_WINDOW_MS ?? 120_000);
const SAMPLE_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Trial {
  messages: number;
  iteration: number;
  ok: boolean;
  got: number;
  target: number;
  ms?: number;
  /** What the responder's own log said it built. */
  builtPayloads: number[];
  /** sync-delta frames the joiner processed. */
  deltasReceived: number;
  /** Did the joiner also get the messages? Separates the two halves. */
  postsReceived: number;
  note?: string;
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Pull every "Built N delta payload(s)" count out of a bot's trace. */
function builtCounts(trace: string[]): number[] {
  const out: number[] = [];
  for (const line of trace) {
    const m = /Built (\d+) delta payload/.exec(line);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

test(
  'space-payload: does the member delta survive as the LAST of several payloads?',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('space-payload', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[space-payload] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    say(
      `sweep messages=[${COUNTS.join(', ')}] iterations=${ITERATIONS} roster=${ROSTER} ` +
        `bodyBytes=${BYTES}`
    );

    const trials: Trial[] = [];

    for (const messages of COUNTS) {
      for (let i = 1; i <= ITERATIONS; i++) {
        const stamp = String(Date.now()).slice(-7);
        let a: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
        let b: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
        try {
          [a, b] = await Promise.all([
            createSpaceBot(`pl-a-${stamp}`),
            createSpaceBot(`pl-b-${stamp}`),
          ]);
          await Promise.all([a.start(), b.start()]);

          const { spaceId, channelId } = await a.createSpace(
            `harness-pl-${messages}-${stamp}`
          );
          const seeded = await a.seedMembers(spaceId, ROSTER - 1);
          if (seeded !== ROSTER) {
            throw new Error(`seeding produced ${seeded}, expected ${ROSTER}`);
          }

          // Messages BEFORE the joiner arrives — that is what puts them in the
          // delta, and therefore what puts a message chunk ahead of the member
          // payload.
          if (messages > 0) {
            const body = 'x'.repeat(Math.max(1, BYTES));
            say(
              `  posting ${messages} message(s) of ~${BYTES}B into the target space…`
            );
            await a.postMany(
              spaceId,
              channelId,
              messages,
              `pl-${stamp} ${body}`
            );
          }

          const link = await a.inviteLink(spaceId);
          const joinedAt = Date.now();
          await b.join(link);

          const target = ROSTER + 1;
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
            messages,
            iteration: i,
            ok: got >= target,
            got,
            target,
            ms,
            builtPayloads: builtCounts(a.syncTrace),
            deltasReceived: b.traceCount('sync-delta'),
            postsReceived: b.captured.filter((m) => m.content?.type === 'post')
              .length,
          };
          trials.push(trial);
          log.add(Date.now(), 'harness', 'trial', { ...trial });
          say(
            `  msgs=${messages} iter=${i}/${ITERATIONS}  ${trial.ok ? 'OK' : 'MISS'}  ` +
              `roster=${got}/${target}  builtPayloads=[${trial.builtPayloads.join(',')}]  ` +
              `deltas=${trial.deltasReceived}  posts=${trial.postsReceived}` +
              (ms ? `  ${(ms / 1000).toFixed(1)}s` : '')
          );
          // A MISS with 2+ payloads built is the field signature. Say so loudly
          // and dump the joiner's tail, because that is the case this whole
          // scenario exists to catch.
          if (!trial.ok && trial.builtPayloads.some((n) => n >= 2)) {
            say(
              `    🔴 FIELD SIGNATURE: responder built ${Math.max(...trial.builtPayloads)} ` +
                `payload(s) and the roster did not land`
            );
            for (const line of b.syncTrace.slice(-8))
              say(`      | ${line.slice(0, 150)}`);
          }
        } catch (err) {
          const note = (err as Error)?.message ?? String(err);
          trials.push({
            messages,
            iteration: i,
            ok: false,
            got: -1,
            target: ROSTER + 1,
            builtPayloads: [],
            deltasReceived: 0,
            postsReceived: 0,
            note,
          });
          say(`  msgs=${messages} iter=${i}  ERROR (excluded): ${note}`);
        } finally {
          a?.stop();
          b?.stop();
        }
      }
    }

    const valid = trials.filter((t) => t.got >= 0);
    const errored = trials.filter((t) => t.got < 0);

    say('');
    say('==== ROSTER DELIVERY vs PAYLOAD COUNT ====');
    say(
      `messages | trials | roster ok | rate  | median lag | max payloads built`
    );
    for (const messages of COUNTS) {
      const forCount = valid.filter((t) => t.messages === messages);
      if (!forCount.length) continue;
      const ok = forCount.filter((t) => t.ok);
      const med = median(ok.map((t) => t.ms!).filter(Boolean));
      const maxBuilt = Math.max(0, ...forCount.flatMap((t) => t.builtPayloads));
      say(
        `${String(messages).padStart(8)} | ${String(forCount.length).padStart(6)} | ` +
          `${String(ok.length).padStart(9)} | ` +
          `${((ok.length / forCount.length) * 100).toFixed(0).padStart(4)}% | ` +
          `${(med ? `${(med / 1000).toFixed(1)}s` : '—').padStart(10)} | ${maxBuilt}`,
        {
          messages,
          trials: forCount.length,
          rosterOk: ok.length,
          medianMs: med,
          maxPayloadsBuilt: maxBuilt,
        }
      );
    }
    say('');
    say(
      'If "max payloads built" never reaches 2, this run did NOT test the field ' +
        'shape and its rate says nothing about it — raise HARNESS_PAYLOAD_MESSAGES ' +
        'or HARNESS_PAYLOAD_BYTES until it does.'
    );
    if (errored.length) {
      say(`⚠️ ${errored.length} trial(s) errored and are EXCLUDED:`);
      for (const e of errored)
        say(`   msgs=${e.messages} iter=${e.iteration}: ${e.note}`);
    }
    say(`log: ${log.file}`);

    // Instrument, not regression test.
    expect(valid.length).toBeGreaterThan(0);
  },
  4 * 60 * 60 * 1000
);
