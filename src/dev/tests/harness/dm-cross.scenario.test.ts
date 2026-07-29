// mobile↔desktop DM delivery — the one configuration no bench has ever covered.
//
//   yarn harness:cross
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The field evidence says loss is worse **mobile→desktop and mobile→mobile than
// desktop→desktop** (`tasks/.done/2026-07-27-cross-platform-dm-harness.md`). Every
// bench to date measures one platform talking to itself:
//
//   desktop↔desktop   301/301, 201/201, 0%      (dm-loss)
//   mobile↔mobile     80/80, 0%                 (quorum-mobile yarn harness:dm)
//   mobile↔desktop    NEVER RUN                 <- this file
//
// So the cell the field actually complains about is the cell with no data. That
// is what this closes. It does NOT close quorum-mobile#183 item 2 (node-side
// write loss) — see §7 of the solved ratchet-lock bug for why those are
// different layers.
//
// ── How the pairing works ───────────────────────────────────────────────────
//
// This is HALF of a run. `run-cross.mjs` starts mobile's existing
// `dm-two-bot` jest scenario as one role and this file as the other, sharing a
// HARNESS_RUN_ID and a rendezvous directory. quorum-mobile needs NO changes —
// this side simply speaks its protocol. See rendezvous.ts for why two processes
// rather than the single-process bundle slice 4 originally specced.
//
// ⚠️ Skipped unless HARNESS_ROLE is set, so a plain `yarn harness` (which runs
// every scenario) does not hang here waiting for a peer that was never started.
import { test, expect } from 'vitest';
import { createBot } from './bot';
import {
  awaitPeer,
  label,
  parseLabel,
  peerOf,
  publish,
  waitUntil,
  type Hello,
  type Role,
} from './rendezvous';
import { RunLog } from './log';

const ROLE = (process.env.HARNESS_ROLE ?? '') as Role;
// These MUST match what mobile reads, because both sides derive `endAt` from
// them independently. run-cross.mjs sets them once and both children inherit.
const ROUNDS = Number(process.env.HARNESS_ROUNDS ?? 20);
const SEND_INTERVAL_MS = Number(process.env.HARNESS_SEND_INTERVAL_MS ?? 1500);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 20_000);

const paired = ROLE === 'a' || ROLE === 'b';

test.skipIf(!paired)(
  'dm-cross: desktop exchanges DMs with a mobile bot in another process',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog(`dm-cross-${ROLE}`, startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-cross ${ROLE}] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };
    const peer = peerOf(ROLE);

    const bot = await createBot(`cross-desktop-${ROLE}-${String(startedAt).slice(-6)}`);
    await bot.start();

    // Stale frames from an earlier run would be counted as this run's arrivals.
    const drained = await bot.drainInbox();
    if (drained > 0) say(`drained ${drained} stale frame(s) before starting`);

    publish(ROLE, 'hello', {
      address: bot.identity.address,
      inboxAddress: bot.identity.inboxAddress,
      readyAt: Date.now(),
    } satisfies Hello);

    const theirs = await awaitPeer<Hello>(ROLE, 'hello');
    const mine = { readyAt: Date.now() };

    // Both sides derive the SAME instant from the SAME two numbers, so neither
    // starts before the other is listening. A bot that began early would post to
    // an unsubscribed inbox and count it as loss. Mobile computes this
    // identically — do not change one side alone.
    const startAt = Math.max(theirs.readyAt, mine.readyAt) + 5_000;
    const endAt = startAt + ROUNDS * SEND_INTERVAL_MS + SETTLE_MS;

    say(
      `me=${bot.identity.address.slice(0, 12)} peer(mobile)=${theirs.address.slice(0, 12)} ` +
        `rounds=${ROUNDS}`,
      { role: ROLE, rounds: ROUNDS }
    );

    const sentByMe: number[] = [];
    const receivedFromPeer = new Set<number>();

    const trySend = async (n: number) => {
      try {
        await bot.send(theirs.address, label(ROLE, n));
        sentByMe.push(n);
      } catch (err) {
        // A send that THREW is a different failure from a message that vanished
        // silently; conflating them would misattribute the loss.
        say(`send #${n} threw: ${(err as Error).message}`);
      }
    };

    bot.onDecrypted = (m) => {
      const text = m.content?.type === 'post' ? (m.content.text ?? '') : '';
      const tag = text ? parseLabel(text) : null;
      // Only the PEER's messages count. This seam also fires for our own
      // outgoing messages, which would otherwise inflate the count to a perfect
      // score no matter what the wire did.
      if (!tag || tag.from !== peer) return;
      const isNew = !receivedFromPeer.has(tag.n);
      receivedFromPeer.add(tag.n);
      // B answers each DISTINCT message once. Replying on a redelivery would
      // send the same number twice and corrupt the sent list.
      if (ROLE === 'b' && isNew) void trySend(tag.n);
    };

    await waitUntil(startAt);

    // ONE initiator, mirroring mobile exactly. Both sides sending from the same
    // instant looked natural and was wrong: it opens sessions in both directions
    // at once, and a 25-round run failed all 50 messages on X3DH while every
    // frame arrived intact. That is a session-establishment race, not transport
    // loss, and mixing the two makes the number meaningless. So A initiates and
    // B echoes — both directions still traverse the wire independently.
    if (ROLE === 'a') {
      for (let n = 1; n <= ROUNDS; n++) {
        await trySend(n);
        await waitUntil(startAt + n * SEND_INTERVAL_MS);
      }
    }

    await waitUntil(endAt);

    publish(ROLE, 'result', {
      role: ROLE,
      address: bot.identity.address,
      sent: sentByMe,
      received: [...receivedFromPeer].sort((x, y) => x - y),
    });

    say(
      `sent=${sentByMe.length}/${ROLE === 'a' ? ROUNDS : receivedFromPeer.size} ` +
        `received=${receivedFromPeer.size}  novel decrypt failures=${bot.novelErrors().length}`,
      { sent: sentByMe.length, received: receivedFromPeer.size }
    );
    console.log(`[dm-cross ${ROLE}] log: ${log.file}`);

    bot.stop();

    // Deliberately weak: run-cross.mjs owns the loss verdict, because neither
    // side can compute it alone — loss is one side's sends against the other
    // side's arrivals. Asserting delivery here would turn a genuine product
    // finding into a red test that gets "fixed" by relaxing it.
    expect(paired).toBe(true);
  },
  60 * 60 * 1000
);
