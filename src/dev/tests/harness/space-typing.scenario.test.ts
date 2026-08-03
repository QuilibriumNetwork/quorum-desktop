// Are typing frames redelivered on every reconnect, forever?
//
//   yarn harness space-typing
//
// ## Why this exists
//
// The relay retains a frame until the client deletes it, and that delete IS the
// ack. The space receive path acks exactly once, in the tail of
// `handleNewMessage`. But a typing frame returns BEFORE that tail
// (`MessageService.ts`, the `isTypingMessage` branch), so it is processed and
// never acked.
//
// If that reading is right, every typing indicator ever sent to you stays on the
// relay and is redelivered on every `listen` — each time costing a full unseal
// and a trip through the inbound queue. `TypingService`'s 30s freshness filter
// hides the UI symptom, but it runs AFTER the frame has been received and
// decrypted, so it does nothing for the cost.
//
// That matters more than it sounds. Queue DEPTH is the variable that decides
// whether a perishable control frame (a `sync-info` reply, valid 30s) is read in
// time — see the FALSIFIED section of
// `2026-08-02-sync-requests-arrive-four-minutes-late-…`: the wait is the number
// of frames AHEAD, and no scheduling change alters that. A permanent,
// ever-growing source of queue depth beats every scheduling fix on the table.
//
// ⚠️ The team's own doc already records the replay:
// `.agents/docs/features/messages/typing-indicators.md` describes the freshness
// filter as defending against "hub-replay on subscribe-join, which would
// otherwise flood the receive path with ancient typing-starts". So the replay is
// known. What has not been established is that it is UNBOUNDED — that these
// frames are never acked and therefore accumulate for the life of the account.
//
// ## What this measures
//
// A controlled two-arm comparison inside one run:
//
//   POST    — an ordinary message. Acked in the tail. Should NOT come back.
//   TYPING  — a typing indicator. Never acked. Should come back.
//
// The post is the control arm. If BOTH come back, the harness is wrong about
// acking generally and this scenario proves nothing about typing specifically.
// If NEITHER comes back, the diagnosis is wrong and that is worth knowing.
import { test, expect } from 'vitest';
import { createSpaceBot } from './spaceBot';
import { WsTransport } from './transport';
import { RunLog } from './log';

const WINDOW_MS = Number(process.env.HARNESS_TYPING_WINDOW_MS ?? 60_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How many times each fingerprint appears in a bot's arrival log. */
function fingerprintCounts(transport: WsTransport): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of transport.arrived) {
    const fp = WsTransport.fingerprint(f);
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }
  return counts;
}

/** Wait until `transport.arrived` stops growing, or the deadline passes. */
async function settle(transport: WsTransport, quietMs = 3000): Promise<void> {
  let last = -1;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const now = transport.arrived.length;
    if (now === last) return;
    last = now;
    await sleep(quietMs);
  }
}

test(
  'space-typing: is a typing frame redelivered after a reconnect?',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('space-typing', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[space-typing] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const stamp = String(Date.now()).slice(-7);
    let a: Awaited<ReturnType<typeof createSpaceBot>> | undefined;
    let b: Awaited<ReturnType<typeof createSpaceBot>> | undefined;

    try {
      [a, b] = await Promise.all([
        createSpaceBot(`ty-a-${stamp}`),
        createSpaceBot(`ty-b-${stamp}`),
      ]);
      await Promise.all([a.start(), b.start()]);

      const { spaceId, channelId } = await a.createSpace(`harness-ty-${stamp}`);
      const link = await a.inviteLink(spaceId);
      await b.join(link);
      await settle(b.transport);
      say(`joined; B has seen ${b.transport.arrived.length} frame(s)`);

      // ── Control arm: an ordinary post, which the tail acks ──────────────────
      await a.post(spaceId, channelId, `control-post-${stamp}`);
      await settle(b.transport);
      const afterPost = b.transport.arrived.length;
      const postFp =
        afterPost > 0
          ? WsTransport.fingerprint(b.transport.arrived[afterPost - 1])
          : undefined;
      say(`after POST: ${afterPost} frame(s), newest fp=${postFp}`);

      // ── Treatment arm: a typing indicator, which returns before the ack ─────
      await a.graph.messageService.sendEphemeralSpaceControl(spaceId, {
        type: 'typing-start',
        senderId: a.identity.userAddress ?? 'unknown',
        scope: 'space',
        spaceId,
        channelId,
        timestamp: Date.now(),
      });
      await settle(b.transport);
      const afterTyping = b.transport.arrived.length;
      const typingFp =
        afterTyping > afterPost
          ? WsTransport.fingerprint(b.transport.arrived[afterTyping - 1])
          : undefined;
      say(`after TYPING: ${afterTyping} frame(s), newest fp=${typingFp}`);

      if (!typingFp || typingFp === postFp) {
        say(
          `⚠️ INCONCLUSIVE: the typing frame did not arrive as a distinct new ` +
            `frame (postFp=${postFp} typingFp=${typingFp}). Nothing can be ` +
            `concluded about redelivery from this run.`
        );
      }

      const before = fingerprintCounts(b.transport);

      // ── Reconnect: the relay re-pushes whatever B never acked ──────────────
      say('B disconnecting…');
      b.disconnect();
      await sleep(2000);
      await b.reconnect();
      await settle(b.transport);
      const after = fingerprintCounts(b.transport);
      say(`after RECONNECT: ${b.transport.arrived.length} frame(s) total`);

      const redelivered = (fp: string | undefined) =>
        fp ? (after.get(fp) ?? 0) - (before.get(fp) ?? 0) : -1;

      const postRedelivered = redelivered(postFp);
      const typingRedelivered = redelivered(typingFp);

      // Everything that came back, not just the two we are tracking — a
      // permanently un-acked frame class would show up here as a population,
      // and that is the finding that would matter most.
      const allRedelivered = [...after.entries()].filter(
        ([fp, n]) => n > (before.get(fp) ?? 0)
      );

      say('');
      say('==== REDELIVERY AFTER RECONNECT ====');
      say(`  POST   (acked in the tail)      redelivered ${postRedelivered}x`);
      say(`  TYPING (returns before the ack) redelivered ${typingRedelivered}x`);
      say(`  frames redelivered in total: ${allRedelivered.length}`);
      say('');
      say(
        'Expected if the diagnosis holds: POST 0, TYPING 1. ' +
          'If BOTH are 0 the diagnosis is WRONG. If BOTH are 1 the harness is ' +
          'not modelling acks and the run proves nothing about typing.'
      );
      say(`log: ${log.file}`);

      log.add(Date.now(), 'harness', 'result', {
        postFp,
        typingFp,
        postRedelivered,
        typingRedelivered,
        totalRedelivered: allRedelivered.length,
        arrived: b.transport.arrived.length,
      });

      // Instrument, not a regression gate — it reports a number. The only hard
      // assertion is that the run actually happened.
      expect(b.transport.arrived.length).toBeGreaterThan(0);
    } finally {
      a?.stop();
      b?.stop();
    }
  },
  10 * 60 * 1000
);
