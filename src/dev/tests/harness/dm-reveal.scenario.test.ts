// NETWORKED. The DM identity reveal rule, end to end, on the production relay.
//
//   yarn harness dm-reveal
//
// ── The rule under test ────────────────────────────────────────────────────
//
// The SENDER's identity is shown to the receiver. The RECEIVER's identity is
// NOT shown until they deliberately engage back — unless they had already
// messaged that partner before.
//
// So a spammer who messages you learns nothing about you. Reply once and you
// have chosen to be known, permanently, to that person.
//
// ── Why this cannot be a unit test ─────────────────────────────────────────
//
// The failure it guards against is a message that DOES leave the device. A unit
// test asserts against a mocked send seam, so it can only prove the code
// decided not to call the seam — never that nothing reached the peer. The two
// diverge exactly when the leak lives on a path the mock does not model, and
// that is where both real leaks in this feature were found (the broadcast
// sweep, and the delete-conversation signal).
//
// The assertion is made on the STRANGER'S STORED ROW. That is the only
// observation that answers "did they learn my name".
//
// ── Two bots, ONE process ──────────────────────────────────────────────────
//
// Unlike mobile (which needs two processes and a rendezvous directory), this
// repo's harness runs both sides in one vitest file with one clock, so the
// phase barrier is just `await`. Each bot has its own IndexedDB (see
// storage.ts), so their stores are genuinely separate.
//
// ⚠️ ONE SHARED localStorage. The reveal ledger and the send gate are
// localStorage-backed and BOTH bots see the same one. That is fine because
// every ledger key is scoped by (self, partner) and both bots have different
// self addresses — but it means a test must never assert on "the ledger is
// empty", only on "the ledger for THIS self says X".
//
// ── The two arms ───────────────────────────────────────────────────────────
//
// PHASE 1 (leak):    B is renamed while a stranger's row sits in B's store.
//                    A must NOT learn the new name.
// PHASE 2 (control): B then replies once. A MUST learn B's name.
//
// Phase 2 is not a bonus assertion, it is what makes phase 1 mean anything. A
// dead bench, a broken relay or a bot that never paired all produce "A learned
// nothing", which reads as a pass. Phase 1 is only evidence once phase 2 has
// proved the same pair, wire and code CAN carry a name.
//
// The two phases assert on DIFFERENT strings, so it is never ambiguous which
// arm delivered a value.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { createBot, type HarnessBot } from './bot';
import { clearReveal, hasRevealedTo } from '../../../utils/dmRevealLedger';
import { isPlaceholderDisplayName } from '../../../utils/identityPlaceholder';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 20_000);

/**
 * The names used by each phase. Unique per run: the relay redelivers un-acked
 * frames, so a fixed string could be satisfied by a leak from a PREVIOUS run
 * and read as this run's pass.
 */
const STAMP = String(Date.now()).slice(-8);
const LEAK_NAME = `leaked-${STAMP}`;
const REVEAL_NAME = `revealed-${STAMP}`;

async function rowFor(bot: HarnessBot, partner: string) {
  const res = await bot.messageDB.getConversation({
    conversationId: `${partner}/${partner}`,
  });
  return res?.conversation ?? null;
}

/** Poll a bot's stored row for a partner until `want` holds, or time out. */
async function pollRow(
  bot: HarnessBot,
  partner: string,
  want: (row: Awaited<ReturnType<typeof rowFor>>) => boolean,
  timeoutMs: number
) {
  const deadline = Date.now() + timeoutMs;
  let last = await rowFor(bot, partner);
  while (Date.now() < deadline) {
    if (want(last)) return last;
    await new Promise((r) => setTimeout(r, 500));
    last = await rowFor(bot, partner);
  }
  return last;
}

test(
  'dm-reveal: a stranger learns nothing until you reply, then learns your name',
  async () => {
    // A = the STRANGER. Initiates, and must end the run still not knowing B.
    // B = the RECIPIENT. Must not reveal itself until it replies.
    const [alice, bob] = await Promise.all([
      createBot('reveal-stranger-bot'),
      createBot('reveal-recipient-bot'),
    ]);

    try {
      await Promise.all([alice.start(), bob.start()]);

      // Un-acked frames are redelivered on every listen, so without this a run
      // starts on whatever the last one left queued — and for THIS scenario a
      // leftover identity frame is indistinguishable from a fresh leak.
      const drained = await Promise.all([alice.drainInbox(), bob.drainInbox()]);

      // The ledger is the thing under test, so start it from a known state
      // rather than trusting one. Scoped to each self: see the shared-storage
      // note in the header.
      clearReveal(alice.identity.address);
      clearReveal(bob.identity.address);

      // B needs a stored profile for the reveal-on-reply push to have anything
      // to say — the push reads the user config, exactly as the app does.
      await bob.messageDB.saveUserConfig({
        address: bob.identity.address,
        name: REVEAL_NAME,
        profile_image: '',
      } as never);

      console.log(
        `[dm-reveal] stranger=${alice.identity.address.slice(0, 12)} ` +
          `recipient=${bob.identity.address.slice(0, 12)} drained=${drained.join('/')}`
      );

      // ── Contact. This half is SUPPOSED to reveal A: initiating IS consent.
      // It is also what creates the row on B that a leak needs to be possible.
      await alice.send(bob.identity.address, 'hello from a stranger');

      // Wait for B to actually hold a row for A. Without it the sweep would
      // skip A for a completely different reason and phase 1 proves nothing.
      const strangerRowOnB = await pollRow(bob, alice.identity.address, (r) => !!r, SETTLE_MS);
      const rowOnA = await rowFor(alice, bob.identity.address);
      const ledgerClearOnB = !hasRevealedTo(bob.identity.address, alice.identity.address);

      // ── PHASE 1 — B renames while it has NOT replied. ───────────────────
      // The REAL sweep: the exact path that leaked before the ledger existed,
      // when it pushed identity to every conversation row it could enumerate.
      await bob.messageService.broadcastProfileToAllDMs(
        LEAK_NAME,
        '',
        undefined,
        bob.identity.address,
        bob.identity.keyset
      );
      console.log(`[dm-reveal] B swept rename "${LEAK_NAME}"`);

      // Give a leak every chance to arrive before declaring there was none. A
      // pass must mean "nothing came", not "we did not wait".
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const leakRow = await rowFor(alice, bob.identity.address);
      const leakedName = leakRow?.displayName;

      // ── PHASE 2 — one deliberate reply. Now the reveal is consented. ────
      await bob.send(alice.identity.address, 'a deliberate reply');
      console.log('[dm-reveal] B replied — reveal is now consented');

      const revealRow = await pollRow(
        alice,
        bob.identity.address,
        (r) => r?.displayName === REVEAL_NAME,
        SETTLE_MS * 2
      );
      const revealedName = revealRow?.displayName;

      // Both observations on one line, always printed, whichever assertion
      // below fails. Reading them together is what tells you whether the bench
      // was alive — which a single failing expect() never does.
      console.log(
        `[dm-reveal] RESULT phase1(leak)=${JSON.stringify(leakedName)} ` +
          `must_not_be="${LEAK_NAME}" | phase2(control)=${JSON.stringify(revealedName)} ` +
          `must_be="${REVEAL_NAME}" | preconditions rowOnB=${!!strangerRowOnB} ` +
          `rowOnA=${!!rowOnA} ledgerClearOnB=${ledgerClearOnB}`
      );

      // Asserted in dependency order, so the failure names the layer that
      // actually broke rather than the one that noticed.

      // (1) PRECONDITIONS. A vacuous run must fail loudly, not pass quietly.
      //     No row on B ⇒ the sweep had nothing to leak to. No row on A ⇒ an
      //     inbound identity update is dropped before it could be observed
      //     (handleDMProfileUpdate returns early when there is no row).
      expect(strangerRowOnB, 'B holds no row for the stranger — nothing to leak').toBeTruthy();
      expect(rowOnA, 'A holds no row for B — a leak could not be observed').toBeTruthy();
      expect(ledgerClearOnB, 'B already had a reveal recorded for the stranger').toBe(true);

      // (2) CONTROL ARM. Proves this pair CAN carry a name over this wire.
      //     Without it, (3) is satisfied for free by any dead bench.
      expect(revealedName).toBe(REVEAL_NAME);

      // (3) THE LEAK ASSERTION — the security property. Before the ledger, the
      //     sweep pushed B's new name to every row it held, a stranger's
      //     included.
      //
      //     ⚠️ Asserted as "A learned NO name", not merely "A did not learn
      //     LEAK_NAME". That distinction is not pedantry: a RED proof on
      //     2026-08-20 disabled the ledger check inside the auto-reveal, B
      //     genuinely leaked — and this scenario PASSED, because the leak
      //     arrived carrying B's config name rather than the swept rename. A
      //     leak test that names the expected string can only catch the leak it
      //     already imagined.
      expect(leakedName).not.toBe(LEAK_NAME);
      expect(
        isPlaceholderDisplayName(leakedName ?? '', bob.identity.address),
        `A learned a real name for B during phase 1: ${JSON.stringify(leakedName)}`
      ).toBe(true);

      // (4) And the ledger flipped for the right reason, not by accident.
      expect(hasRevealedTo(bob.identity.address, alice.identity.address)).toBe(true);
      expect(hasRevealedTo(alice.identity.address, bob.identity.address)).toBe(true);

      console.log('[dm-reveal] PASS — hidden from a stranger, revealed on reply');
    } finally {
      alice.stop();
      bob.stop();
    }
  },
  10 * 60 * 1000
);
