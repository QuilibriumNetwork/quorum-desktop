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
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { createBot, type HarnessBot } from './bot';
import { config } from './env';
import { direction, subscribedInboxes } from './loss';
import { installLockProbe, summariseLockHolds } from './lock-probe';
import { deleteFault, makeApiClient } from './transport';
import { missingReport, postsMatching } from './persistence';
import { RunLog } from './log';

const ROUNDS = Number(process.env.HARNESS_MD_ROUNDS ?? 20);
const GAP_MS = Number(process.env.HARNESS_MD_GAP_MS ?? 900);
const SETTLE_MS = Number(process.env.HARNESS_MD_SETTLE_MS ?? 120_000);
/**
 * Devices on account A. Two proved the shape and measured clean at 100 rounds,
 * which did NOT reproduce the ~10-of-200 seen on accounts carrying 5+ devices —
 * so device COUNT is the next variable, and it is the cheap one: raising this
 * costs nothing on any real account.
 *
 * Fan-out is already known to scale hard with device count (~9 frames/message on
 * 5+ device accounts vs ~1:1 on throwaways), so if a threshold exists this is the
 * dial that finds it.
 */
const DEVICES = Math.max(2, Number(process.env.HARNESS_MD_DEVICES ?? 2));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test(
  'dm-multidevice: an N-device account, per-device arrival',
  async () => {
    const startedAt = Date.now();
    const log = new RunLog('dm-multidevice', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-md] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };
    const stamp = String(startedAt).slice(-6);

    // BEFORE any bot exists: the mutex is a process-wide singleton, so the wrap
    // has to be in place before the first critical section runs or the early
    // holds are missed. Confirms or refutes the ratchet-lock-across-HTTP bug
    // directly, instead of inferring it from which messages went missing —
    // and it reports even on a run where nothing is lost.
    const lockSamples = installLockProbe();

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
    // This is also why the loop below awaits each createBot in turn.
    const botNames: string[] = [];
    const aDevices: HarnessBot[] = [];
    for (let d = 0; d < DEVICES; d++) {
      const name = `md-a-dev${d}-${stamp}`;
      botNames.push(name);
      aDevices.push(await createBot(name, { privateKeyHex: KEY_A }));
    }
    const bobName = `md-b-${stamp}`;
    botNames.push(bobName);
    const bob = await createBot(bobName);

    // Device 0 is the sender; every other device of account A should receive a
    // self-sync copy of what it sends, and a copy of everything bob sends.
    const sender = aDevices[0];
    const others = aDevices.slice(1);

    say(
      `account A=${sender.identity.address.slice(0, 12)} with ${DEVICES} device(s): ` +
        aDevices.map((b, i) => `dev${i}=${b.identity.inboxAddress.slice(0, 10)}`).join(' ') +
        `  bob=${bob.identity.address.slice(0, 12)}`,
      { devices: DEVICES }
    );

    // ── STEP 1: prove the premise before measuring anything ──────────────────
    //
    // Membership, not a count. A count of 2 passes for the wrong reasons — it
    // cannot tell "both of our devices registered" from "one of ours plus
    // something else". If this fails, every downstream number is meaningless, so
    // fail here rather than report a red result that is really a setup bug.
    // The relay intermittently 502s on /users. This read is SETUP, not
    // measurement, so retry it — a transient server error killing the run after
    // every bot has already registered wastes the whole setup and, worse, tempts
    // whoever hits it into loosening the assertion instead. Retrying here is safe
    // precisely because nothing about delivery is being measured yet.
    const api = makeApiClient();
    const fetchRegistration = async () => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          return (await api.getUser(sender.identity.address))?.data;
        } catch (err) {
          lastErr = err;
          say(`registration read attempt ${attempt}/5 failed: ${(err as Error).message}`);
          await sleep(2000 * attempt);
        }
      }
      throw lastErr;
    };
    const regA = await fetchRegistration();
    const registeredInboxes = (regA?.device_registrations ?? []).map(
      (d) => d.inbox_registration.inbox_address
    );
    say(`account A registration lists ${registeredInboxes.length} device(s)`, {
      registered: registeredInboxes.length,
    });
    for (const b of aDevices) {
      expect(b.identity.address).toBe(sender.identity.address); // same ACCOUNT
      expect(registeredInboxes).toContain(b.identity.inboxAddress); // this DEVICE is registered
    }
    // Every device distinct — catches a name collision silently reusing a keyset.
    expect(new Set(aDevices.map((b) => b.identity.inboxAddress)).size).toBe(DEVICES);

    await Promise.all([...aDevices.map((b) => b.start()), bob.start()]);

    // ── Handshake ────────────────────────────────────────────────────────────
    //
    // Bench-lie guard, BOTH directions. A sender builds its fan-out from the
    // registration it fetched; if either side fetched before the second device
    // existed, that side legitimately reaches only one device and the red result
    // is ours, not the product's (cf. PR #264, where two bench defects made the
    // bench lie). Both devices are registered above before any bot starts, and the
    // handshake below forces each side to fetch registrations afterwards.
    await sender.send(bob.identity.address, 'md-setup A.dev0->bob');
    await sleep(5000);
    await bob.send(sender.identity.address, 'md-setup bob->A');
    await sleep(5000);

    // ── STEP 2: send, then count PER DEVICE ──────────────────────────────────
    for (let i = 1; i <= ROUNDS; i++) {
      await sender.send(bob.identity.address, `MD-A->B #${i}`).catch((e) =>
        say(`send A->B #${i} threw: ${(e as Error).message}`)
      );
      await bob.send(sender.identity.address, `MD-B->A #${i}`).catch((e) =>
        say(`send B->A #${i} threw: ${(e as Error).message}`)
      );
      await sleep(GAP_MS);
    }

    say(`send loop done; settling ${Math.round(SETTLE_MS / 1000)}s for redelivery`);
    await sleep(SETTLE_MS);

    // Frame-level, reusing dm-loss's join once PER RECEIVING DEVICE. This is the
    // whole point: the same accounting, applied to each device separately, instead
    // of aggregated per account.
    const inboxesOf = new Map<HarnessBot, Set<string>>();
    for (const b of [...aDevices, bob]) inboxesOf.set(b, await subscribedInboxes(b));

    const pad = (s: string) => s.padEnd(34);
    const legs: [string, ReturnType<typeof direction>][] = [
      [pad('A.dev0 -> bob (peer, primary)'), direction(sender, bob, inboxesOf.get(bob)!)],
      [pad('bob -> A.dev0 (peer 1st dev)'), direction(bob, sender, inboxesOf.get(sender)!)],
    ];
    for (const [i, dev] of others.entries()) {
      const n = i + 1;
      legs.push([
        pad(`A.dev0 -> A.dev${n} (SELF-SYNC)`),
        direction(sender, dev, inboxesOf.get(dev)!),
      ]);
      legs.push([
        pad(`bob -> A.dev${n} (PEER->EXTRA DEV)`),
        direction(bob, dev, inboxesOf.get(dev)!),
      ]);
    }

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

    say('');
    say('==== MESSAGE-LEVEL, PER DEVICE (persisted, not rendered) ====');
    say(`bob      received A->B : ${bobGot.size}/${ROUNDS}`, { bobGot: bobGot.size });
    for (const [i, dev] of aDevices.entries()) {
      const peer = postsMatching(dev, 'MD-B->A').size;
      const self = postsMatching(dev, 'MD-A->B').size;
      say(
        `A.dev${i}   received B->A : ${peer}/${ROUNDS}` +
          (i === 0
            ? '   <- the sending device'
            : `   |  self-sync A->B : ${self}/${ROUNDS}   <- EXTRA DEVICE`),
        { device: i, peer, self }
      );
      if (peer < ROUNDS) say(`   dev${i} B->A gaps: ${missingReport(dev, 'MD-B->A', ROUNDS)}`);
      if (i > 0 && self < ROUNDS)
        say(`   dev${i} A->B gaps: ${missingReport(dev, 'MD-A->B', ROUNDS)}`);
    }
    say(
      'novel decrypt failures: ' +
        aDevices.map((b, i) => `dev${i}=${b.novelErrors().length}`).join(' ') +
        ` bob=${bob.novelErrors().length}`
    );

    // The direct test of the ratchet-lock-across-HTTP mechanism. Holds clustering
    // at ~22s / ~45s / ~69s mean the lock is waiting on a timing-out POST; holds
    // in single-digit ms mean it is doing crypto only and the mechanism is not
    // firing on this run. ⚠️ Do NOT look only near 22s — mutations retry twice,
    // so a stalled ack lands near 45s or 69s.
    say('');
    say('==== RATCHET LOCK HOLD TIMES (bug 2026-07-28, §5.3) ====');
    // Which relay condition this run measured. Without this line a reader cannot
    // tell a clean baseline from a clean fault-injected run, and those mean
    // opposite things: the first proves nothing, the second refutes the mechanism.
    say(deleteFault.summary(), {
      faultDelayMs: deleteFault.delayMs,
      faultCalls: deleteFault.calls,
      faultInjected: deleteFault.injected,
    });
    for (const line of summariseLockHolds(lockSamples)) say(line);
    console.log(`[dm-md] log: ${log.file}`);

    for (const b of aDevices) b.stop();
    bob.stop();

    // Each run mints a throwaway account and one state file per bot. Nothing
    // accumulates on an account that matters, but the directory would grow without
    // bound, so the scenario removes what it created.
    for (const name of botNames) {
      const p = resolve(config.stateDir, `${name}.json`);
      if (existsSync(p)) rmSync(p, { force: true });
    }

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
