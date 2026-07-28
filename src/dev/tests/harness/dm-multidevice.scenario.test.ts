// Multi-device DM delivery — the channel every other scenario is blind to.
//
//   yarn harness dm-multidevice
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Every previous scenario is two bots with ONE device each, so two paths on the
// normal DM send route have never been exercised:
//
//   1. the SELF-SYNC copy — a sender's own other devices
//   2. the PEER's second device
//
// Both are real: the send path fans out to
// `self.device_registrations.concat(counterparty.device_registrations)`
// (services/MessageService.ts:3016-3021).
//
// This is not a theoretical gap. During `dm-loss` run 2 on the canonical accounts
// the bench reported 201/201 each way, 0% loss — while the operator watched those
// same accounts' other devices receive ~10 of 200 messages on one desktop and 0 of
// 200 on the other, in the same run, both online. `dm-loss` excludes fan-out
// frames from its join by design ("unobserved, not observed-good"), so it was
// structurally blind to the channel that was failing.
//
// ── What this scenario refuses to do ────────────────────────────────────────
//
// It does NOT use the canonical accounts. They already carry 5+ device
// registrations, and createBot mints a NEW device per bot NAME and merges it into
// the registration (identity.ts:141-153). Running this there would permanently add
// devices to shared accounts and fan out to ghost inboxes we cannot observe —
// confounding the exact variable being isolated. Instead the account is generated
// here and thrown away.
import { test, expect } from 'vitest';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { createBot, type HarnessBot } from './bot';
import { direction, subscribedInboxes } from './loss';
import { makeApiClient } from './transport';
import { RunLog } from './log';

const ROUNDS = Number(process.env.HARNESS_MD_ROUNDS ?? 20);
const GAP_MS = Number(process.env.HARNESS_MD_GAP_MS ?? 900);
const SETTLE_MS = Number(process.env.HARNESS_MD_SETTLE_MS ?? 120_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Messages of a given text prefix this bot's real code actually persisted. */
const postsMatching = (bot: HarnessBot, prefix: string) =>
  new Set(
    bot.captured
      .filter((m) => m.content?.type === 'post' && (m.content.text ?? '').startsWith(prefix))
      .map((m) => m.content?.text as string)
  );

test(
  'dm-multidevice: a two-device account, per-device arrival',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-multidevice', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-md] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };
    const stamp = String(startedAt).slice(-6);

    // One generated account, handed to two bots. createBot takes the ACCOUNT from
    // privateKeyHex and the DEVICE from name, so this is genuinely one user with
    // two devices — not two users.
    const kp = JSON.parse(channel_raw.js_generate_ed448()) as { private_key: number[] };
    const KEY_A = Buffer.from(kp.private_key).toString('hex');
    // ed448 private keys are 57 bytes. Measured, not read off a spec sheet — two
    // earlier guesses at this length in this investigation were both wrong.
    expect(KEY_A).toHaveLength(114);

    // SEQUENTIAL, never Promise.all. Registration is a read-modify-write: each bot
    // fetches the current device list then posts a merged registration
    // (identity.ts:141-153). Concurrent creation silently drops one device, and the
    // scenario would then measure a one-device account while claiming otherwise.
    const aPhone = await createBot(`md-a-phone-${stamp}`, { privateKeyHex: KEY_A });
    const aLaptop = await createBot(`md-a-laptop-${stamp}`, { privateKeyHex: KEY_A });
    const bob = await createBot(`md-b-${stamp}`);

    say(
      `account A=${aPhone.identity.address.slice(0, 12)} ` +
        `phone=${aPhone.identity.inboxAddress.slice(0, 12)} ` +
        `laptop=${aLaptop.identity.inboxAddress.slice(0, 12)}  ` +
        `bob=${bob.identity.address.slice(0, 12)}`
    );

    // ── STEP 1: prove the premise before measuring anything ──────────────────
    //
    // Membership, not a count. A count of 2 passes for the wrong reasons — it
    // cannot tell "both of our devices registered" from "one of ours plus
    // something else". If this fails, every downstream number is meaningless, so
    // fail here rather than report a red result that is really a setup bug.
    const api = makeApiClient();
    const regA = (await api.getUser(aPhone.identity.address))?.data;
    const registeredInboxes = (regA?.device_registrations ?? []).map(
      (d) => d.inbox_registration.inbox_address
    );
    say(`account A registration lists ${registeredInboxes.length} device(s)`, {
      devices: registeredInboxes.length,
    });
    expect(aPhone.identity.address).toBe(aLaptop.identity.address); // same ACCOUNT
    expect(aPhone.identity.inboxAddress).not.toBe(aLaptop.identity.inboxAddress); // different DEVICE
    expect(registeredInboxes).toContain(aPhone.identity.inboxAddress);
    expect(registeredInboxes).toContain(aLaptop.identity.inboxAddress);

    await Promise.all([aPhone.start(), aLaptop.start(), bob.start()]);

    // ── Handshake ────────────────────────────────────────────────────────────
    //
    // Bench-lie guard, BOTH directions. A sender builds its fan-out from the
    // registration it fetched; if either side fetched before the second device
    // existed, that side legitimately reaches only one device and the red result
    // is ours, not the product's (cf. PR #264, where two bench defects made the
    // bench lie). Both devices are registered above before any bot starts, and the
    // handshake below forces each side to fetch registrations afterwards.
    await aPhone.send(bob.identity.address, 'md-setup phone->bob');
    await sleep(5000);
    await bob.send(aPhone.identity.address, 'md-setup bob->A');
    await sleep(5000);

    // ── STEP 2: send, then count PER DEVICE ──────────────────────────────────
    for (let i = 1; i <= ROUNDS; i++) {
      await aPhone.send(bob.identity.address, `MD-A->B #${i}`).catch((e) =>
        say(`send A->B #${i} threw: ${(e as Error).message}`)
      );
      await bob.send(aPhone.identity.address, `MD-B->A #${i}`).catch((e) =>
        say(`send B->A #${i} threw: ${(e as Error).message}`)
      );
      await sleep(GAP_MS);
    }

    say(`send loop done; settling ${Math.round(SETTLE_MS / 1000)}s for redelivery`);
    await sleep(SETTLE_MS);

    // Frame-level, reusing dm-loss's join once PER RECEIVING DEVICE. This is the
    // whole point: the same accounting, applied to each device separately, instead
    // of aggregated per account.
    const [phoneIn, laptopIn, bobIn] = await Promise.all([
      subscribedInboxes(aPhone),
      subscribedInboxes(aLaptop),
      subscribedInboxes(bob),
    ]);

    const legs = [
      ['A.phone -> bob        (peer, primary)', direction(aPhone, bob, bobIn)],
      ['A.phone -> A.laptop   (SELF-SYNC)     ', direction(aPhone, aLaptop, laptopIn)],
      ['bob     -> A.phone    (peer 1st dev)  ', direction(bob, aPhone, phoneIn)],
      ['bob     -> A.laptop   (PEER 2nd DEV)  ', direction(bob, aLaptop, laptopIn)],
    ] as const;

    say('');
    say('==== FRAME-LEVEL, PER DEVICE (de-duplicated by ciphertext fingerprint) ====');
    for (const [label, d] of legs) {
      say(
        `${label}  sent=${d.sent}  arrived=${d.arrived}  missing=${d.missing}  ` +
          `loss=${d.lossPct.toFixed(1)}%  unmatched=${d.unmatchedArrivals}`,
        { leg: label.trim(), ...d, missingFps: undefined }
      );
    }

    // Message-level. Frames and messages can disagree — a frame can arrive and
    // fail to decrypt — and the operator's observation was about MESSAGES, so
    // report both rather than assume they track each other.
    //
    // Counts what saveMessage received, NOT what a UI rendered. A message can be
    // persisted without appearing in a conversation that is not open, so a green
    // result here does not contradict what was seen live — it separates delivery
    // from display.
    const bobGot = postsMatching(bob, 'MD-A->B');
    const phoneGot = postsMatching(aPhone, 'MD-B->A');
    const laptopGotPeer = postsMatching(aLaptop, 'MD-B->A');
    const laptopGotSelf = postsMatching(aLaptop, 'MD-A->B');

    say('');
    say('==== MESSAGE-LEVEL, PER DEVICE (persisted, not rendered) ====');
    say(`bob        received A->B : ${bobGot.size}/${ROUNDS}`, { bobGot: bobGot.size });
    say(`A.phone    received B->A : ${phoneGot.size}/${ROUNDS}`, { phoneGot: phoneGot.size });
    say(`A.laptop   received B->A : ${laptopGotPeer.size}/${ROUNDS}   <- PEER to 2nd device`, {
      laptopGotPeer: laptopGotPeer.size,
    });
    say(`A.laptop   received A->B : ${laptopGotSelf.size}/${ROUNDS}   <- SELF-SYNC copy`, {
      laptopGotSelf: laptopGotSelf.size,
    });
    say(
      `novel decrypt failures: phone=${aPhone.novelErrors().length} ` +
        `laptop=${aLaptop.novelErrors().length} bob=${bob.novelErrors().length}`
    );
    console.log(`[dm-md] log: ${log.file}`);

    aPhone.stop();
    aLaptop.stop();
    bob.stop();

    // The run IS the measurement, so the assertions are deliberately weak: they
    // check the bench had data to join on, not that delivery succeeded. A hard
    // assertion on per-device arrival would turn a genuine product finding into a
    // red test that gets "fixed" by relaxing it. Read the numbers above.
    expect(bobGot.size).toBeGreaterThan(0);
    for (const [label, d] of legs) {
      if (d.sent === 0) say(`⚠️ NO FRAMES joined for ${label.trim()} — that leg measured nothing`);
    }
  },
  4 * 60 * 60 * 1000
);
