// NETWORKED. Consent belongs to the RELATIONSHIP, not the session.
//
//   yarn harness dm-auto-reveal
//
// ── What this proves ───────────────────────────────────────────────────────
//
// A friend you have messaged before reinstalls the app. Their new device shows
// your name without you having to do anything — because you already consented
// to this relationship, and a new device of theirs does not re-ask.
//
// And it fires ONCE. An init envelope can be REDELIVERED, and every redelivery
// looks like "a new session appeared", so an undebounced auto-reveal turns one
// reinstall into a push storm. The count assertion below is the only thing that
// tests the debounce: asserting mere presence would pass with any number of
// pushes, including a storm.
//
// ── The shape of the run ───────────────────────────────────────────────────
//
//   1. A and B exchange one message each. Both ledgers now record consent.
//   2. A WIPES its sessions and sends again — a fresh init envelope, which is
//      what a reinstall or a second device looks like on the wire.
//   3. B's receive path sees the new session and auto-reveals, unprompted.
//   4. A wipes and sends AGAIN. B must stay silent this time (debounce).
//
// Step 4 is the control for the count: without it, "one push" could just mean
// "one opportunity", and the debounce would never have been exercised at all.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { createBot } from './bot';
import { clearReveal, hasRevealedTo } from '../../../utils/dmRevealLedger';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 15_000);
const STAMP = String(Date.now()).slice(-8);
const B_NAME = `friend-${STAMP}`;

test(
  'dm-auto-reveal: a known partner’s new device is answered, once and only once',
  async () => {
    const [alice, bob] = await Promise.all([
      createBot('autoreveal-friend-a-bot'),
      createBot('autoreveal-friend-b-bot'),
    ]);

    // Count B's outgoing identity pushes at the real send seam. Every reveal
    // path in the service funnels through `encryptAndSendDm`, so this counts
    // frames that genuinely left the client, not intentions.
    let bobProfilePushes = 0;
    const origSend = bob.messageService.encryptAndSendDm.bind(bob.messageService);
    bob.messageService.encryptAndSendDm = (async (
      address: string,
      content: Record<string, unknown>,
      ...rest: unknown[]
    ) => {
      if ((content as { type?: string })?.type === 'dm-update-profile') {
        bobProfilePushes += 1;
      }
      return (origSend as (...a: unknown[]) => Promise<void>)(address, content, ...rest);
    }) as typeof bob.messageService.encryptAndSendDm;

    try {
      await Promise.all([alice.start(), bob.start()]);
      await Promise.all([alice.drainInbox(), bob.drainInbox()]);
      clearReveal(alice.identity.address);
      clearReveal(bob.identity.address);

      await bob.messageDB.saveUserConfig({
        address: bob.identity.address,
        name: B_NAME,
        profile_image: '',
      } as never);

      // ── 1. Become friends: both sides deliberately message the other. ────
      await alice.send(bob.identity.address, 'hello friend');
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await bob.send(alice.identity.address, 'hi back');
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const bobConsented = hasRevealedTo(bob.identity.address, alice.identity.address);
      console.log(`[auto-reveal] friendship established, B consented=${bobConsented}`);

      // The pushes from phase 1 are not what this scenario measures — reset so
      // the count below is unambiguously the auto-reveal's.
      bobProfilePushes = 0;

      // ── 2. A "reinstalls": local sessions gone, next send re-inits. ──────
      const wiped1 = await alice.wipeSessions();
      await alice.send(bob.identity.address, 'back from a reinstall');
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const pushesAfterFirstReinstall = bobProfilePushes;

      // ── 4. A second new session. The debounce must swallow this one. ─────
      const wiped2 = await alice.wipeSessions();
      await alice.send(bob.identity.address, 'and a second new device');
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const pushesAfterSecondReinstall = bobProfilePushes;

      console.log(
        `[auto-reveal] RESULT wiped=${wiped1}/${wiped2} ` +
          `pushes after 1st new session=${pushesAfterFirstReinstall} ` +
          `after 2nd=${pushesAfterSecondReinstall} (must be 1 and 1) ` +
          `| B consented=${bobConsented}`
      );

      // (1) PRECONDITIONS — a vacuous run must fail loudly.
      expect(bobConsented, 'B never recorded consent — nothing could auto-reveal').toBe(true);
      expect(wiped1, 'A had no sessions to wipe — no new init was produced').toBeGreaterThan(0);
      expect(wiped2, 'A had no sessions to wipe the second time').toBeGreaterThan(0);

      // (2) THE BEHAVIOUR — the friend's new device is answered unprompted.
      expect(pushesAfterFirstReinstall).toBe(1);

      // (3) THE DEBOUNCE — a second new session inside the window adds nothing.
      //     Asserting the COUNT, not the presence: presence passes on a storm.
      expect(pushesAfterSecondReinstall).toBe(1);

      console.log('[auto-reveal] PASS — answered once, and only once');
    } finally {
      alice.stop();
      bob.stop();
    }
  },
  10 * 60 * 1000
);
