// NETWORKED. The CONTROL ARM for the delete-conversation-self authentication gate.
//
//   yarn harness dm-selfdelete-control
//
// `dm-selfdelete-forgery.scenario.test.ts` proves a STRANGER cannot delete your
// conversations by claiming to be you. On its own that proof is worthless: a
// handler that never fires at all would pass it.
//
// This is the other half. Two devices of the SAME account. Device 1 deletes a
// conversation; device 2 must delete its own copy, because that is what the
// signal is for. If this goes red, the security gate is over-tight and
// multi-device deletion is silently broken — a failure mode nobody would notice
// from the forgery test alone.
//
// Run these two together, always. Either one alone can be satisfied by a bug.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { channel_raw } from '@quilibrium/quilibrium-js-sdk-channels';
import { createBot } from './bot';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 20_000);
const STAMP = String(Date.now()).slice(-8);

test(
  'dm-selfdelete-control: my own second device still honours my delete',
  async () => {
    // One ACCOUNT, two DEVICES: createBot takes the ACCOUNT from privateKeyHex
    // and the DEVICE from the bot NAME (see dm-multidevice.scenario.test.ts).
    //
    // A fresh throwaway key per run, deliberately: a stable name on a stable
    // account would mint a PERMANENT extra device registration that cannot be
    // deregistered. Throwaway accounts make that cost disposable.
    const privateKeyHex = Buffer.from(
      (JSON.parse(channel_raw.js_generate_ed448()) as { private_key: number[] }).private_key
    ).toString('hex');
    expect(privateKeyHex, 'ed448 private keys are 57 bytes / 114 hex chars').toHaveLength(114);

    // SEQUENTIAL, never Promise.all. Registration is a read-modify-write: each
    // bot fetches the current device list then posts a merged registration, so
    // concurrent creation silently drops one device and the scenario would then
    // be testing a one-device account while claiming otherwise.
    const device1 = await createBot(`selfdel-ctl-d1-${STAMP}`, { privateKeyHex });
    const device2 = await createBot(`selfdel-ctl-d2-${STAMP}`, { privateKeyHex });
    const friend = await createBot(`selfdel-ctl-friend-${STAMP}`);

    try {
      await Promise.all([device1.start(), device2.start(), friend.start()]);
      await Promise.all([
        device1.drainInbox(),
        device2.drainInbox(),
        friend.drainInbox(),
      ]);

      expect(
        device1.identity.address,
        'the two devices must share one account, or this tests nothing'
      ).toBe(device2.identity.address);
      expect(device1.identity.inboxAddress).not.toBe(device2.identity.inboxAddress);

      // 1. A real conversation, visible on BOTH devices.
      await friend.send(device1.identity.address, `hello ${STAMP}`);
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await device1.send(friend.identity.address, 'hi back');
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const convId = `${friend.identity.address}/${friend.identity.address}`;
      const before1 = (await device1.messageDB.getConversation({ conversationId: convId }))
        ?.conversation;
      const before2 = (await device2.messageDB.getConversation({ conversationId: convId }))
        ?.conversation;

      // 2. Device 1 deletes the conversation. This fans out
      //    delete-conversation-self to our own devices.
      const passkeyInfo = {
        credentialId: '',
        address: device1.identity.address,
        publicKey: Buffer.from(
          new Uint8Array(device1.identity.keyset.userKeyset.user_key.public_key)
        ).toString('hex'),
        completedOnboarding: true,
      };
      await device1.messageService.deleteConversation(
        convId,
        passkeyInfo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        device1.identity.keyset,
        device1.messageService.submitMessage.bind(device1.messageService)
      );
      await new Promise((r) => setTimeout(r, SETTLE_MS * 2));

      const after2 = (await device2.messageDB.getConversation({ conversationId: convId }))
        ?.conversation;

      console.log(
        `[selfdel-control] RESULT device2 before=${!!before2} after=${!!after2} ` +
          `| device1 before=${!!before1}`
      );

      // PRECONDITIONS — both devices must actually have held the row, or the
      // "it got deleted" observation is meaningless.
      expect(before1, 'device 1 never held the conversation').toBeTruthy();
      expect(before2, 'device 2 never held the conversation — nothing to delete').toBeTruthy();

      // THE CONTROL. The authentication gate must not have broken self-sync.
      expect(
        after2,
        'device 2 did NOT honour my own delete — the security gate is over-tight'
      ).toBeFalsy();

      console.log('[selfdel-control] PASS — my own delete still reaches my other device');
    } finally {
      device1.stop();
      device2.stop();
      friend.stop();
    }
  },
  10 * 60 * 1000
);
