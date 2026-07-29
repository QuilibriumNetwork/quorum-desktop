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
// ⚠️ THAT SECOND CAVEAT TURNED OUT TO MATTER ENORMOUSLY. During run 2 on the
// canonical accounts this scenario reported 201/201 each way, 0% loss — while the
// operator watched those same accounts' OTHER devices receive ~10 of 200 messages
// on one desktop and 0 of 200 on the other, in the same run. This bench was
// structurally blind to the channel that was failing. `dm-multidevice` is the
// scenario that measures it; run it before quoting a 0% result from here.
//
//   yarn harness dm-loss
//   HARNESS_LOSS_ROUNDS=200 HARNESS_LOSS_SETTLE_MS=600000 yarn harness dm-loss
import { test, expect } from 'vitest';
import { createBot, type HarnessBot } from './bot';
import { createCanonicalPair, hasCanonicalKeys } from './canonical';
import { WsTransport } from './transport';
import { direction, subscribedInboxes } from './loss';
import { missingReport, persistedNumbers } from './persistence';
import { RunLog } from './log';

const ROUNDS = Number(process.env.HARNESS_LOSS_ROUNDS ?? 40);
const GAP_MS = Number(process.env.HARNESS_LOSS_GAP_MS ?? 700);
const SETTLE_MS = Number(process.env.HARNESS_LOSS_SETTLE_MS ?? 120_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    //
    // HARNESS_LOSS_CANONICAL=1 drives the operator's two REAL test accounts
    // instead. That is not a convenience switch — it tests a specific hypothesis.
    // Issue #183's write-layer loss is directional and intermittent (32% one way,
    // ~0% the other, same devices/minutes/hub), and §27.4 reads that asymmetry as
    // per-WRITER or per-INBOX node state rather than blanket sampling loss. If so,
    // fresh throwaways are the population LEAST likely to exhibit it — the very
    // choice that removes the queued-frame confound may remove the phenomenon.
    // Aged, heavily-used, multi-device accounts are the population that matches
    // the phones where the loss was actually measured.
    //
    // `drain: true` clears each device inbox first, so queued history cannot be
    // counted as an arrival that was never sent in this run.
    const stamp = String(startedAt).slice(-6);
    const useCanonical = process.env.HARNESS_LOSS_CANONICAL === '1';
    if (useCanonical && !hasCanonicalKeys()) {
      throw new Error(
        'HARNESS_LOSS_CANONICAL=1 but BOT_A_PRIVATE_KEY/BOT_B_PRIVATE_KEY are not set ' +
          'in src/dev/tests/harness/.env.local'
      );
    }
    const [alice, bob] = useCanonical
      ? await (async () => {
          const { a, b } = await createCanonicalPair({ drain: true });
          return [a, b] as const;
        })()
      : await Promise.all([createBot(`loss-a-${stamp}`), createBot(`loss-b-${stamp}`)]);
    await Promise.all([alice.start(), bob.start()]);
    say(
      `mode=${useCanonical ? 'CANONICAL (real aged accounts)' : 'throwaway'} ` +
        `alice=${alice.identity.address.slice(0, 12)} bob=${bob.identity.address.slice(0, 12)}`,
      { mode: useCanonical ? 'canonical' : 'throwaway' }
    );

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

    // ── MESSAGE-LEVEL, the question the frame counts above cannot answer ─────
    //
    // `posts decrypted` is a running tally, so it cannot say WHICH message went
    // missing, and on multi-device accounts it also counts self-sync copies. That
    // is why this scenario reported 201/201 / 0% on the canonical accounts while
    // the operator watched the same accounts' other devices receive ~10 of 200:
    // nothing here was ever counting per-message persistence.
    //
    // These two lines are the whole point of running this on aged accounts:
    // "of the N messages the peer sent, how many did this bot's real code
    // actually persist, and are the absences a stall or scattered drops?"
    const bGot = persistedNumbers(bob, 'A->B');
    const aGot = persistedNumbers(alice, 'B->A');
    say('');
    say('==== MESSAGE-LEVEL, PERSISTED (not frames, not rendered) ====');
    say(`bob   persisted A->B : ${bGot.size}/${ROUNDS}`, { bobPersisted: bGot.size });
    if (bGot.size < ROUNDS) say(`   bob A->B gaps: ${missingReport(bob, 'A->B', ROUNDS)}`);
    say(`alice persisted B->A : ${aGot.size}/${ROUNDS}`, { alicePersisted: aGot.size });
    if (aGot.size < ROUNDS) say(`   alice B->A gaps: ${missingReport(alice, 'B->A', ROUNDS)}`);
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
