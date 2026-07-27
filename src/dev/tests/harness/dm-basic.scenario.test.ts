// SLICE 3 — two bots exchange numbered DMs, NO browser. The two-browser loop,
// replaced: one process, both sides, one clock, a merged transcript.
//
//   yarn harness dm-basic
//
// Bot A and bot B are throwaway accounts (persisted + reused). A sends numbered
// messages; B replies to each. Everything the real code decrypts on each side is
// captured and written to a merged JSONL log under logs/.
import { test, expect } from 'vitest';
import { createBot } from './bot';
import { RunLog } from './log';

const ROUNDS = Number(process.env.HARNESS_ROUNDS ?? 5);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 8000);

function textOf(m: { content?: { type?: string; text?: string } }): string {
  return m.content?.type === 'post' ? (m.content.text ?? '') : `<${m.content?.type}>`;
}

test(
  'dm-basic: two bots exchange numbered DMs with no browser',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-basic', startedAt);

    const [alice, bob] = await Promise.all([
      createBot('alice-bot'),
      createBot('bob-bot'),
    ]);
    log.add(Date.now(), 'harness', 'note', {
      alice: alice.identity.address,
      bob: bob.identity.address,
    });

    // Bob auto-replies to each post it receives.
    let bobReplies = 0;
    bob.onDecrypted = (m) => {
      if (m.content?.type !== 'post') return;
      const text = textOf(m);
      if (text.startsWith('A→B')) {
        log.add(Date.now(), 'bob', 'recv', { text });
        const n = text.split('#')[1] ?? '?';
        bobReplies += 1;
        void bob.send(alice.identity.address, `B→A #${n}`).catch((e) =>
          console.error('[dm-basic] bob reply failed:', (e as Error).message)
        );
      }
    };

    let aliceGotReplies = 0;
    alice.onDecrypted = (m) => {
      if (m.content?.type === 'post' && textOf(m).startsWith('B→A')) {
        aliceGotReplies += 1;
        log.add(Date.now(), 'alice', 'recv', { text: textOf(m) });
      }
    };

    await Promise.all([alice.start(), bob.start()]);
    console.log(`[dm-basic] alice=${alice.identity.address.slice(0, 12)} bob=${bob.identity.address.slice(0, 12)}`);

    for (let i = 1; i <= ROUNDS; i++) {
      log.add(Date.now(), 'alice', 'send', { text: `A→B #${i}` });
      await alice.send(bob.identity.address, `A→B #${i}`);
      await new Promise((r) => setTimeout(r, 1200));
    }

    // Let the last replies land.
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    alice.stop();
    bob.stop();

    console.log(`[dm-basic] A→B sent=${ROUNDS}  B received=${bobReplies}  A got replies=${aliceGotReplies}`);
    console.log(`[dm-basic] merged log: ${log.file}`);

    // Proof of a real round trip: at least one A→B arrived at B and at least one
    // B→A reply arrived back at A, all through the real send/receive code.
    expect(bobReplies).toBeGreaterThan(0);
    expect(aliceGotReplies).toBeGreaterThan(0);
  },
  180_000
);
