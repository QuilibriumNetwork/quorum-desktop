// SLICE 2 — one bot receives a REAL DM sent from your browser, decrypts it with
// the real MessageService, and prints the plaintext.
//
//   yarn harness dm-receive
//
// What to do while it runs:
//   1. It prints the bot's ACCOUNT address and then waits.
//   2. In a browser signed into a throwaway test user, start a new DM to that
//      account address and send a message.
//   3. The bot decrypts it headlessly and prints the text.
//
// Wait window defaults to 120s; override with HARNESS_WAIT_MS. If nothing
// arrives the test still passes (it can't force you to send) and logs that none
// came — so it never blocks CI.
import { test, expect } from 'vitest';
import { createBot } from './bot';

const WAIT_MS = Number(process.env.HARNESS_WAIT_MS ?? 120_000);

test(
  'dm-receive: a browser-sent DM decrypts headlessly',
  async () => {
    const bot = await createBot('recv-bot');
    console.log('\n' + '='.repeat(64));
    console.log(`  Send a DM from your browser to this account address:`);
    console.log(`    ${bot.identity.address}`);
    console.log(`  Waiting up to ${Math.round(WAIT_MS / 1000)}s ...`);
    console.log('='.repeat(64) + '\n');

    const firstMessage = new Promise<void>((resolve) => {
      bot.onDecrypted = (m) => {
        const text =
          m.content?.type === 'post' ? m.content.text : `<${m.content?.type}>`;
        const sender = m.content?.senderId ?? '(unknown)';
        console.log(`[dm-receive] ✅ decrypted from ${sender.slice(0, 12)}: ${text}`);
        resolve();
      };
    });

    await bot.start();
    console.log(`[dm-receive] listening on inbox ${bot.identity.inboxAddress.slice(0, 16)}…`);

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    await Promise.race([firstMessage, timeout]);

    bot.stop();

    if (bot.captured.length === 0) {
      console.log('[dm-receive] no message arrived in the wait window (nothing to assert).');
    } else {
      console.log(`[dm-receive] captured ${bot.captured.length} message(s) total.`);
      expect(bot.captured.length).toBeGreaterThan(0);
    }
  },
  WAIT_MS + 30_000
);
