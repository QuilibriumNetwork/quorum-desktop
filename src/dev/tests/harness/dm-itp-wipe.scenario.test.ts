// Storage eviction — what a Quorum account actually loses when the browser
// destroys its database, and what comes back afterwards.
//
// Filed against
// `.agents/issues/.open/2026-08-05-safari-itp-wipes-indexeddb-after-7-idle-days.md`,
// whose Verification section opens with "Do not close this on reasoning."
//
// ── What this can and cannot answer ────────────────────────────────────────
//
// The issue makes two separable claims, and only the second is about Quorum:
//
//   A. Safari's ITP deletes script-writable storage after 7 days of Safari use
//      without interaction. A WebKit POLICY claim. Not testable here, and not
//      testable on Windows at all — it needs real Safari and a 7-day counter
//      that cannot be advanced from outside. It stays unverified by this file.
//
//   B. When the database is gone, DM history and sessions do not come back,
//      while the conversation itself can resume on a fresh session. An APP
//      behaviour claim. The app cannot tell WHY its database vanished — ITP, a
//      "clear site data" click, and a new device are the same event to it — so
//      this is fully testable anywhere, including headless on Windows.
//
// This scenario measures B. It deliberately does not dress itself up as
// measuring A.
//
// ── Why not just reuse dm-reset-recover ────────────────────────────────────
//
// That one calls `wipeSessions()`, which removes `encryption_states` and leaves
// `messages` and `conversations` intact. It is the milder failure: you lose the
// ability to decrypt on the old session but keep your history. Eviction takes
// both, and the difference is the entire point of the issue — so this asserts on
// the census, not only on recovery, and the mutation check below confirms a
// session-only wipe makes it go red.
//
//   yarn harness dm-itp-wipe
import { test, expect } from 'vitest';
import { createBot } from './bot';
import { dmCensus, listDatabaseNames } from './inspect';
import { dbNameOf } from './storage';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 6000);

const settle = () => new Promise((r) => setTimeout(r, SETTLE_MS));

/** Every post body this bot currently has ON DISK (not the in-memory capture log). */
async function textsOnDisk(bot: Awaited<ReturnType<typeof createBot>>): Promise<string[]> {
  const data = await bot.messageDB.getAllDMData({ address: bot.identity.address });
  return data.messages
    .filter((m) => m.content?.type === 'post')
    .map((m) => m.content?.text ?? '');
}

test(
  'dm-itp-wipe: an evicted database loses history and sessions, and the conversation resumes on a fresh one',
  async () => {
    const [alice, bob] = await Promise.all([
      createBot('itp-alice'),
      createBot('itp-bob'),
    ]);

    // Distinct texts, NOT a count of callbacks. `onDecrypted` fires per
    // saveMessage, and one logical message can legitimately be persisted more
    // than once: un-acked frames are redelivered on every `listen`, and the
    // receive path additionally salvages the message embedded in a refused init
    // envelope. A first cut of this test asserted `=== 2` on the callback count
    // and measured 4 for exactly that reason. A set asks the question the
    // scenario actually cares about — did this message arrive at all.
    const bobSeen = new Set<string>();
    const aliceSeen = new Set<string>();
    const noteInto = (seen: Set<string>) => (m: { content?: { type?: string; text?: string } }) => {
      if (m.content?.type === 'post' && m.content.text) seen.add(m.content.text);
    };
    bob.onDecrypted = noteInto(bobSeen);
    alice.onDecrypted = noteInto(aliceSeen);

    // Frames left queued by a previous run would be redelivered on `listen` and
    // land in the post-wipe window, where they would look like recovered history.
    await Promise.all([alice.drainInbox(), bob.drainInbox()]);
    await Promise.all([alice.start(), bob.start()]);

    // ── 1. Seed real history, both directions ──────────────────────────────
    await alice.send(bob.identity.address, 'seed-a #1');
    await settle();
    await alice.send(bob.identity.address, 'seed-a #2');
    await settle();
    await bob.send(alice.identity.address, 'seed-b #1');
    await settle();

    expect(bobSeen.has('seed-a #1')).toBe(true);
    expect(bobSeen.has('seed-a #2')).toBe(true);
    expect(aliceSeen.has('seed-b #1')).toBe(true);

    const bobBefore = await dmCensus(bob.messageDB, bob.identity.address);
    const aliceBefore = await dmCensus(alice.messageDB, alice.identity.address);
    const dbsBefore = await listDatabaseNames();
    const seededTexts = await textsOnDisk(bob);

    console.log(
      `[dm-itp-wipe] bob BEFORE  messages=${bobBefore.messages} conversations=${bobBefore.conversations} sessions=${bobBefore.sessions}`
    );
    console.log(`[dm-itp-wipe] databases BEFORE: ${dbsBefore?.join(', ') ?? '(databases() unsupported)'}`);

    // Precondition. Without real data on disk, everything below would pass
    // against an account that never had anything to lose.
    expect(bobBefore.messages).toBeGreaterThan(0);
    expect(bobBefore.conversations).toBeGreaterThan(0);
    expect(bobBefore.sessions).toBeGreaterThan(0);
    expect(seededTexts.length).toBeGreaterThan(0);

    // ── 2. The eviction ────────────────────────────────────────────────────
    // Bob's browser only. Alice is the control arm: she must be untouched.
    const bobDbName = dbNameOf(bob.messageDB);
    await bob.wipeAll();

    // Sample the database list BEFORE anything reads through MessageDB. Every
    // read method starts with `await this.init()`, which re-opens — and therefore
    // re-CREATES — the database with an empty schema. Measured here: taking this
    // sample after the census showed `quorum_db_itp-bob` present again and made
    // the delete look like it had not happened. It had; the app had simply
    // rebuilt an empty one on first touch, which is exactly what a real tab does
    // on the visit after an eviction.
    const dbsRightAfterWipe = await listDatabaseNames();

    const bobAfter = await dmCensus(bob.messageDB, bob.identity.address);
    const aliceAfterWipe = await dmCensus(alice.messageDB, alice.identity.address);
    const dbsAfterReopen = await listDatabaseNames();

    console.log(
      `[dm-itp-wipe] bob AFTER   messages=${bobAfter.messages} conversations=${bobAfter.conversations} sessions=${bobAfter.sessions}`
    );
    console.log(
      `[dm-itp-wipe] databases immediately after wipe: ${dbsRightAfterWipe?.join(', ') ?? '(databases() unsupported)'}`
    );
    console.log(
      `[dm-itp-wipe] databases after first read (init recreates): ${dbsAfterReopen?.join(', ') ?? '(databases() unsupported)'}`
    );

    // The loss, measured.
    expect(bobAfter.messages).toBe(0);
    expect(bobAfter.conversations).toBe(0);
    expect(bobAfter.sessions).toBe(0);

    // CONTROL ARM. Eviction hit one browser. If Alice's numbers move too, the
    // harness is sharing one database between bots (a real regression it has had
    // before — see storage.ts) and every assertion above is measuring the wrong
    // thing.
    expect(aliceAfterWipe).toEqual(aliceBefore);

    // The database itself was destroyed, not merely emptied...
    if (dbsRightAfterWipe) expect(dbsRightAfterWipe).not.toContain(bobDbName);
    // ...and the app rebuilds an empty one the moment it reads again. Worth
    // pinning: "quorum_db exists" is NOT evidence that a user's data survived.
    if (dbsAfterReopen) expect(dbsAfterReopen).toContain(bobDbName);

    // ── 3. Recovery: Bob re-initiates ──────────────────────────────────────
    // With no encryption state present the send path opens a NEW session via
    // DoubleRatchetInboxEncryptForceSenderInit (MessageService).
    await bob.send(alice.identity.address, 'recover-init #1');
    await settle();
    expect(aliceSeen.has('recover-init #1')).toBe(true);

    // ── 4. And the reply flows back over the fresh session ─────────────────
    await alice.send(bob.identity.address, 'after-wipe #1');
    await settle();
    expect(bobSeen.has('after-wipe #1')).toBe(true);

    // ── 5. The conversation resumed; the history did NOT come back ─────────
    // This is the distinction the issue turns on. Recovery alone would be
    // satisfied by step 4 — what makes the loss permanent is that nothing
    // restored the seeded messages in the process.
    const bobTextsAfter = await textsOnDisk(bob);
    const revived = seededTexts.filter((t) => bobTextsAfter.includes(t));

    console.log(
      `[dm-itp-wipe] seeded=${seededTexts.length} revived=${revived.length} onDiskNow=[${bobTextsAfter.join(' | ')}]`
    );

    alice.stop();
    bob.stop();

    expect(revived).toEqual([]);
    // Bob can talk again, so the store is not simply broken — it is empty and
    // moving forward.
    expect(bobTextsAfter.some((t) => t.startsWith('after-wipe'))).toBe(true);
  },
  240_000
);
