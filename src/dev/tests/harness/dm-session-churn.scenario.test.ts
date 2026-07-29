// Session churn UNDER LOAD — the combination no scenario has ever produced.
//
//   yarn harness dm-session-churn
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Every bench has been green while the operator's real accounts kept losing
// messages. The reason is a gap in coverage, not a difference in the code:
//
//   dm-loss / dm-multidevice   sustained volume, but the session is NEVER replaced
//   dm-reset-recover           replaces the session, but sends THREE messages,
//                              one at a time, with waits — so nothing is ever in
//                              flight at the moment of replacement
//
// **Volume without churn, and churn without volume. Never both.** Real accounts
// have both at once, which is exactly the condition this scenario creates.
//
// The defect under test (`bugs/2026-07-29-session-replacement-strands-in-flight-frames.md`):
// replacing a session mints a NEW receiving inbox and deletes the old state, so
// frames the peer had already addressed to the OLD inbox arrive with no state and
// are never persisted. A frame only gets stranded if it is already in the air when
// the replacement lands — which is why a one-message-at-a-time reset test cannot
// see it, and why 366 of them showed up in a live capture on a real desktop.
//
// ── What a positive result looks like ───────────────────────────────────────
//
// Messages sent by BOB shortly BEFORE the wipe should be missing from ALICE,
// because bob re-inits on its next send, alice replaces her session, and the
// frames already addressed to her old inbox can no longer be placed. The loss
// should cluster AROUND THE WIPE ROUND, not at the tail — that clustering is the
// signature, and it is what distinguishes this from a stall.
import { test, expect } from 'vitest';
import { createBot, type HarnessBot } from './bot';
import { direction, subscribedInboxes } from './loss';
import { missingReport, persistedNumbers } from './persistence';
import { RunLog } from './log';

const ROUNDS = Number(process.env.HARNESS_CHURN_ROUNDS ?? 60);
const GAP_MS = Number(process.env.HARNESS_CHURN_GAP_MS ?? 500);
const SETTLE_MS = Number(process.env.HARNESS_CHURN_SETTLE_MS ?? 180_000);
/** Which round wipes bob's sessions. Default: halfway, so there is traffic either side. */
const WIPE_AT = Number(process.env.HARNESS_CHURN_WIPE_AT ?? Math.floor(ROUNDS / 2));
/** How many wipes. >1 exercises repeated churn, which is what a 5+ device account does. */
const WIPES = Number(process.env.HARNESS_CHURN_WIPES ?? 1);
/**
 * HOLD MODE — the ingredient a plain wipe-under-load lacks.
 *
 * ⚠️ Run 1 of this scenario (60 rounds, wipe at #30, 500ms gap) came back
 * **60/60 both directions, zero loss**. A session replacement alone does NOT
 * strand anything on a healthy relay, because frames arrive in ~100ms and there
 * is nothing left in the air when the replacement lands.
 *
 * Production differs in two ways this mode reproduces:
 *
 *   1. **The receiver is not consuming.** Real devices sleep, background, get
 *      tab-throttled, disconnect. Frames queue at the relay instead of being
 *      processed on arrival, so there IS a backlog when a replacement happens.
 *   2. **The init envelope can be processed BEFORE the frames it orphans.** It
 *      goes to the DEVICE inbox; data frames go to the SESSION inbox. Two
 *      different inboxes, no ordering guarantee between them. If the init lands
 *      first, the session is replaced and everything still queued on the old
 *      session inbox becomes unplaceable.
 *
 * So this holds the receiver's inbound queue across the wipe, then releases the
 * device-inbox frames FIRST. That is a realistic delivery order, not a contrived
 * one — and it is the only ordering under which the defect can bite.
 */
const HOLD = process.env.HARNESS_CHURN_HOLD === '1';
/** Rounds the receiver stops consuming BEFORE the wipe, so pre-wipe frames queue. */
const HOLD_LEAD = Number(process.env.HARNESS_CHURN_HOLD_LEAD ?? 5);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Where the missing numbers sit relative to the wipe — the whole point. */
function lossWindow(got: Set<number>, rounds: number, wipeAt: number): string {
  const missing: number[] = [];
  for (let i = 1; i <= rounds; i++) if (!got.has(i)) missing.push(i);
  if (missing.length === 0) return 'none';
  const near = missing.filter((n) => Math.abs(n - wipeAt) <= 5).length;
  const after = missing.filter((n) => n > wipeAt).length;
  return (
    `${missing.length} missing | ${near} within ±5 of the wipe (#${wipeAt}) | ` +
    `${after} after it | first #${missing[0]} last #${missing[missing.length - 1]}`
  );
}

test(
  'dm-session-churn: a session replacement while messages are in flight',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-session-churn', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-churn] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };
    const stamp = String(startedAt).slice(-6);

    // Throwaway accounts on purpose. This scenario needs NO aged state — if the
    // mechanism is real it reproduces on a clean pair, which is a far stronger
    // result than one that only appears on the operator's account.
    const alice = await createBot(`churn-a-${stamp}`);
    const bob = await createBot(`churn-b-${stamp}`);
    await Promise.all([alice.start(), bob.start()]);

    say(
      `alice=${alice.identity.address.slice(0, 12)} bob=${bob.identity.address.slice(0, 12)} ` +
        `rounds=${ROUNDS} wipeAt=#${WIPE_AT} wipes=${WIPES}`,
      { rounds: ROUNDS, wipeAt: WIPE_AT, wipes: WIPES }
    );

    // Handshake both directions so a real session exists to be replaced. Without
    // this the wipe would be a no-op and the run would measure nothing.
    await alice.send(bob.identity.address, 'churn-setup A->B');
    await sleep(4000);
    await bob.send(alice.identity.address, 'churn-setup B->A');
    await sleep(4000);

    const wipeRounds = new Set(
      Array.from({ length: WIPES }, (_, k) => WIPE_AT + k * Math.floor(ROUNDS / (WIPES + 1)))
    );
    const wipeLog: { round: number; removed: number }[] = [];

    for (let i = 1; i <= ROUNDS; i++) {
      // BOTH directions every round, so there is always traffic in the air when
      // the wipe lands. This is the ingredient dm-reset-recover lacks.
      await alice
        .send(bob.identity.address, `CHURN-A->B #${i}`)
        .catch((e) => say(`send A->B #${i} threw: ${(e as Error).message}`));
      await bob
        .send(alice.identity.address, `CHURN-B->A #${i}`)
        .catch((e) => say(`send B->A #${i} threw: ${(e as Error).message}`));

      // ⚠️ The hold must start SEVERAL ROUNDS BEFORE the wipe, not on the same
      // round. Run 2 held and wiped together and came back 60/60 — because every
      // frame that queued was sent AFTER the wipe, so they were all init
      // envelopes to the device inbox and there was not a single pre-wipe
      // session-inbox frame in the backlog. The test never built the condition it
      // was meant to test. The whole hypothesis is about frames ALREADY addressed
      // to the old inbox, so the backlog has to contain some.
      if (HOLD && wipeRounds.has(i + HOLD_LEAD)) {
        alice.transport.holdInbound();
        say(
          `⏸️  HELD alice's inbound at round #${i} — she is "offline" for the ` +
            `${HOLD_LEAD} rounds BEFORE the wipe, so pre-wipe frames pile up on her old inbox`
        );
      }

      if (wipeRounds.has(i)) {
        if (HOLD) {
          say(`   (backlog on alice's old session inbox at wipe time: ${alice.transport.heldCount} frame(s))`);
        }
        // Bob forgets its sessions. Its NEXT send therefore carries a fresh init
        // envelope, which makes alice REPLACE her session and mint a new
        // receiving inbox — orphaning the one bob's queued frames are addressed
        // to. This is the production trigger, reproduced deliberately.
        const removed = await bob.wipeSessions();
        wipeLog.push({ round: i, removed });
        say(`⚡ WIPED bob's sessions at round #${i} (${removed} row(s)) — mid-flight`, {
          wipeRound: i,
          removed,
        });
      }

      // Release a few rounds later, so a real backlog has accumulated behind the
      // hold — including bob's post-wipe init envelope.
      if (HOLD && wipeRounds.has(i - 5)) {
        const deviceInbox = alice.identity.inboxAddress;
        const held = alice.transport.heldCount;
        // DEVICE-inbox frames first: that is where the init envelope lands, and
        // processing it before the session-inbox backlog is what orphans them.
        // Realistic — the two inboxes have no ordering guarantee between them.
        const { delivered } = await alice.transport.releaseInbound((frames) => [
          ...frames.filter((f) => f.inboxAddress === deviceInbox),
          ...frames.filter((f) => f.inboxAddress !== deviceInbox),
        ]);
        say(
          `▶️  RELEASED alice's inbound at round #${i}: ${held} held, ${delivered} delivered, ` +
            `device-inbox frames FIRST`,
          { releasedAt: i, held, delivered }
        );
      }

      await sleep(GAP_MS);
    }

    say(`send loop done; settling ${Math.round(SETTLE_MS / 1000)}s for redelivery`);
    await sleep(SETTLE_MS);

    const aInboxes = await subscribedInboxes(alice);
    const bInboxes = await subscribedInboxes(bob);
    const ab = direction(alice, bob, bInboxes);
    const ba = direction(bob, alice, aInboxes);

    say('');
    say('==== FRAME LEVEL (did the transport carry them?) ====');
    for (const [label, d] of [['A->B', ab], ['B->A', ba]] as const) {
      say(
        `${label}  sent=${d.sent}  arrived=${d.arrived}  missing=${d.missing}  ` +
          `loss=${d.lossPct.toFixed(1)}%`,
        { direction: label, ...d, missingFps: undefined }
      );
    }

    // The measurement. Frames arriving but messages not persisted is this bug's
    // whole signature — the transport is not where it fails.
    const bGot = persistedNumbers(bob, 'CHURN-A->B');
    const aGot = persistedNumbers(alice, 'CHURN-B->A');

    say('');
    say('==== MESSAGE LEVEL (what the real code PERSISTED) ====');
    say(`bob   persisted A->B : ${bGot.size}/${ROUNDS}`, { bobPersisted: bGot.size });
    say(`alice persisted B->A : ${aGot.size}/${ROUNDS}`, { alicePersisted: aGot.size });

    say('');
    say('==== WHERE THE LOSS SITS RELATIVE TO THE WIPE ====');
    say(`wipes: ${wipeLog.map((w) => `#${w.round} (${w.removed} rows)`).join(', ') || 'none'}`);
    // Clustering around the wipe is the signature. Loss at the TAIL instead would
    // mean a stall, which is a different defect entirely — do not conflate them.
    say(`alice B->A: ${lossWindow(aGot, ROUNDS, WIPE_AT)}`);
    say(`bob   A->B: ${lossWindow(bGot, ROUNDS, WIPE_AT)}`);
    if (aGot.size < ROUNDS) say(`   alice gap shape: ${missingReport(alice, 'CHURN-B->A', ROUNDS)}`);
    if (bGot.size < ROUNDS) say(`   bob   gap shape: ${missingReport(bob, 'CHURN-A->B', ROUNDS)}`);
    say(
      `novel decrypt failures: alice=${alice.novelErrors().length} bob=${bob.novelErrors().length}`
    );
    console.log(`[dm-churn] log: ${log.file}`);

    alice.stop();
    bob.stop();

    // Deliberately weak, like the other measurement scenarios: the run IS the
    // measurement. A hard assertion on delivery would turn a genuine product
    // finding into a red test someone "fixes" by relaxing it. Read the numbers.
    expect(ab.sent).toBeGreaterThan(0);
    expect(wipeLog.length).toBe(WIPES);
  },
  4 * 60 * 60 * 1000
);
