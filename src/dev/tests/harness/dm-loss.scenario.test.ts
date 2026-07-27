// THREAD 3 — measure desktop↔desktop transport loss, per direction.
//
// Issue #183 item 2 says the node write path "drops a fraction of frames handed to
// an open socket, 32% one direction phone↔phone". That has never been measured
// desktop↔desktop. This does it the only way that is sound:
//
//   sent      = frames the real send path handed to the socket (transport.sent)
//   arrived   = frames the peer's socket actually produced (transport.arrived)
//   matched   = the intersection, joined by CIPHERTEXT fingerprint
//
// Both sides are de-duplicated by fingerprint before any count is quoted: an
// un-acked frame is redelivered on every `listen`, and raw counters have
// overstated volume by 2-5x three separate times in this investigation.
//
// ⚠️ Two things this CANNOT establish, stated up front:
//   - "loss" here means "had not arrived by the end of the run". Redelivery has
//     been observed taking longer than a whole capture round, so a short run
//     overstates loss. HARNESS_LOSS_SETTLE_MS is the tail window; make it long.
//   - a frame addressed to an inbox this pair does not subscribe to (multi-device
//     fan-out to the accounts' OTHER devices) can never arrive here and is not
//     loss. Only frames addressed to the peer's subscribed inboxes are counted.
//
//   yarn harness dm-loss
//   HARNESS_LOSS_ROUNDS=200 HARNESS_LOSS_SETTLE_MS=600000 yarn harness dm-loss
import { test, expect } from 'vitest';
import { createBot, type HarnessBot } from './bot';
import { WsTransport } from './transport';
import { RunLog } from './log';

const ROUNDS = Number(process.env.HARNESS_LOSS_ROUNDS ?? 40);
const GAP_MS = Number(process.env.HARNESS_LOSS_GAP_MS ?? 700);
const SETTLE_MS = Number(process.env.HARNESS_LOSS_SETTLE_MS ?? 120_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Inbox addresses a bot is actually listening on — the only place a frame CAN land. */
async function subscribedInboxes(bot: HarnessBot): Promise<Set<string>> {
  const states = await bot.messageDB.getAllEncryptionStates();
  return new Set([bot.identity.inboxAddress, ...states.map((s) => s.inboxId)]);
}

function direction(from: HarnessBot, to: HarnessBot, toInboxes: Set<string>) {
  // Frames this sender addressed to an inbox the receiver is subscribed to.
  const sent = new Map<string, number>();
  for (const s of from.transport.sent) {
    if (!s.fp) continue;
    if (s.target && !toInboxes.has(s.target)) continue; // fan-out elsewhere, not loss
    if (!sent.has(s.fp)) sent.set(s.fp, s.t);
  }
  const arrived = new Set<string>();
  for (const f of to.transport.arrived) {
    const fp = WsTransport.ciphertextFp(f);
    if (fp) arrived.add(fp);
  }
  const missing = [...sent.keys()].filter((fp) => !arrived.has(fp));
  return {
    sent: sent.size,
    arrived: [...sent.keys()].filter((fp) => arrived.has(fp)).length,
    missing: missing.length,
    lossPct: sent.size ? (missing.length / sent.size) * 100 : 0,
    // Frames the receiver got that the sender never recorded sending to it:
    // redeliveries of older frames, or frames from the account's other devices.
    unmatchedArrivals: [...arrived].filter((fp) => !sent.has(fp)).length,
  };
}

test(
  'dm-loss: send-vs-arrive frame loss rate, both directions',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-loss', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-loss] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    // Fresh accounts: reused ones carry queued frames that arrive without having
    // been sent in this run, which would corrupt both sides of the join.
    const stamp = String(startedAt).slice(-6);
    const [alice, bob] = await Promise.all([
      createBot(`loss-a-${stamp}`),
      createBot(`loss-b-${stamp}`),
    ]);
    await Promise.all([alice.start(), bob.start()]);
    say(`alice=${alice.identity.address.slice(0, 12)} bob=${bob.identity.address.slice(0, 12)}`);

    let aPosts = 0;
    let bPosts = 0;
    alice.onDecrypted = (m) => { if (m.content?.type === 'post') aPosts += 1; };
    bob.onDecrypted = (m) => { if (m.content?.type === 'post') bPosts += 1; };

    await alice.send(bob.identity.address, 'loss-setup A->B');
    await sleep(4000);
    await bob.send(alice.identity.address, 'loss-setup B->A');
    await sleep(4000);

    for (let i = 1; i <= ROUNDS; i++) {
      await Promise.all([
        alice.send(bob.identity.address, `A->B #${i}`).catch(() => {}),
        bob.send(alice.identity.address, `B->A #${i}`).catch(() => {}),
      ]);
      await sleep(GAP_MS);
      if (i % 10 === 0) {
        say(`round ${i}/${ROUNDS}  aSent=${alice.transport.sent.length} bSent=${bob.transport.sent.length} ` +
          `aArrived=${alice.transport.arrived.length} bArrived=${bob.transport.arrived.length}`);
      }
    }

    // The tail window matters more than the send loop: recovery by redelivery is
    // slow, and anything counted before it completes is latency read as loss.
    say(`send loop done; settling ${Math.round(SETTLE_MS / 1000)}s for redelivery`);
    const settleStep = Math.max(15_000, Math.floor(SETTLE_MS / 8));
    for (let waited = 0; waited < SETTLE_MS; waited += settleStep) {
      await sleep(Math.min(settleStep, SETTLE_MS - waited));
      const inboxes = await subscribedInboxes(bob);
      const d = direction(alice, bob, inboxes);
      say(`  +${Math.round((waited + settleStep) / 1000)}s  A->B still missing ${d.missing}/${d.sent}`);
    }

    // Does a bot receive its OWN outbound frames? It subscribes to every
    // encryption-state inbox, and if any of those is the inbox it SENDS to, the
    // relay hands its own ciphertext back — which can never decrypt and would
    // manufacture failures that have nothing to do with the bug under study.
    const selfEcho = async (b: HarnessBot, label: string) => {
      const mine = new Set(b.transport.sent.map((s) => s.fp).filter(Boolean) as string[]);
      const echoed = b.transport.arrived.filter((f) => {
        const fp = WsTransport.ciphertextFp(f);
        return fp && mine.has(fp);
      });
      const own = await subscribedInboxes(b);
      const targets = new Set(b.transport.sent.map((s) => s.target).filter(Boolean) as string[]);
      const onInbox = new Map<string, number>();
      for (const f of echoed) {
        const a = String(f.inboxAddress ?? '?');
        onInbox.set(a, (onInbox.get(a) ?? 0) + 1);
      }
      const detail = [...onInbox.entries()].map(([a, n]) =>
        `${a.slice(0, 10)}x${n}${own.has(a) ? ' [subscribed]' : ''}${targets.has(a) ? ' [own send target]' : ''}`
      ).join(' ');
      say(`self-echo ${label}: ${echoed.length} of ${b.transport.arrived.length} arrivals are ` +
        `this bot's OWN ciphertext  ${detail}`, { bot: label, echoed: echoed.length });
      return echoed.length;
    };
    await selfEcho(alice, 'alice');
    await selfEcho(bob, 'bob');

    const bobInboxes = await subscribedInboxes(bob);
    const aliceInboxes = await subscribedInboxes(alice);
    const ab = direction(alice, bob, bobInboxes);
    const ba = direction(bob, alice, aliceInboxes);

    say('');
    say('==== RESULT (de-duplicated by ciphertext fingerprint) ====');
    for (const [label, d] of [['A->B', ab], ['B->A', ba]] as const) {
      say(`${label}  sent=${d.sent}  arrived=${d.arrived}  missing=${d.missing}  ` +
        `loss=${d.lossPct.toFixed(1)}%  unmatched-arrivals=${d.unmatchedArrivals}`,
        { direction: label, ...d });
    }
    say(`posts decrypted: alice=${aPosts} bob=${bPosts}`);
    say(`decrypt failures — NOVEL (the only ones worth quoting): ` +
      `alice=${alice.novelErrors().length} bob=${bob.novelErrors().length}   ` +
      `replays (expected refusals): alice=${alice.errors.length - alice.novelErrors().length} ` +
      `bob=${bob.errors.length - bob.novelErrors().length}`,
      { aNovel: alice.novelErrors().length, bNovel: bob.novelErrors().length });
    say(`raw counters (NOT to be quoted): aSent=${alice.transport.sent.length} ` +
      `bArrived=${bob.transport.arrived.length} bSent=${bob.transport.sent.length} ` +
      `aArrived=${alice.transport.arrived.length}`);
    console.log(`[dm-loss] log: ${log.file}`);

    alice.stop();
    bob.stop();

    // The run IS the measurement; assert only that the join had data on both sides.
    expect(ab.sent).toBeGreaterThan(0);
    expect(ba.sent).toBeGreaterThan(0);
  },
  4 * 60 * 60 * 1000
);
