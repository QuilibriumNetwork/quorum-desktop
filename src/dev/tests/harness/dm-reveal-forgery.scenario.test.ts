// NETWORKED. Can a crafted message FORGE consent and unmask you?
//
//   yarn harness dm-reveal-forgery
//
// ── The attack ─────────────────────────────────────────────────────────────
//
// The reveal ledger has two ways to learn that you consented to a partner:
// you sent them something (recorded at send time), or `ensureRevealBootstrap`
// found a message YOU AUTHORED in that conversation's local history. The second
// exists because conversations predate the ledger, and because a message sent
// from another of your devices syncs here with your own senderId.
//
// That second path trusts `content.senderId` on a STORED message. So the
// question this scenario answers is: can an attacker put a message carrying
// YOUR address into YOUR OWN local history for THEIR conversation?
//
// If yes, one crafted frame converts a stranger into a "partner you already
// messaged", and the whole feature is bypassed — permanently, silently, and
// with no user-visible signal.
//
// ── Why a scenario and not a unit test ─────────────────────────────────────
//
// The claim under test is about what the REAL receive path persists. A unit
// test would assert against my own model of that path, which is exactly the
// thing in doubt. This drives the real crypto, the real relay and the real
// `handleNewMessage`, and then reads what actually landed in the database.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { createBot } from './bot';
import { clearReveal, hasRevealedTo } from '../../../utils/dmRevealLedger';
import { isPlaceholderDisplayName } from '../../../utils/identityPlaceholder';

const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 15_000);
const STAMP = String(Date.now()).slice(-8);
const VICTIM_NAME = `victim-${STAMP}`;

test(
  'dm-reveal-forgery: a forged self-authored message must not manufacture consent',
  async () => {
    // attacker = a stranger the victim has NEVER messaged.
    const [attacker, victim] = await Promise.all([
      createBot('forgery-attacker-bot'),
      createBot('forgery-victim-bot'),
    ]);

    try {
      await Promise.all([attacker.start(), victim.start()]);
      await Promise.all([attacker.drainInbox(), victim.drainInbox()]);
      clearReveal(attacker.identity.address);
      clearReveal(victim.identity.address);

      await victim.messageDB.saveUserConfig({
        address: victim.identity.address,
        name: VICTIM_NAME,
        profile_image: '',
      } as never);

      // 1. Ordinary first contact. Establishes the session the forged frame
      //    needs, and creates the victim's row for the attacker.
      await attacker.send(victim.identity.address, 'hello, total stranger here');
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      // 2. THE FORGERY. A full Message envelope, shaped exactly like one this
      //    client produces, except `content.senderId` names the VICTIM. Sent
      //    through the real encrypt-and-send path, so it is authenticated as
      //    coming from the attacker — only the inner field lies.
      const forged = {
        channelId: victim.identity.address,
        spaceId: victim.identity.address,
        messageId: `forged-${STAMP}`,
        digestAlgorithm: 'SHA-256',
        nonce: `forged-nonce-${STAMP}`,
        createdDate: Date.now(),
        modifiedDate: Date.now(),
        lastModifiedHash: '',
        content: {
          type: 'post',
          // ⚠️ THE LIE: the victim's own address, on a frame the attacker sent.
          senderId: victim.identity.address,
          text: 'a message the victim never wrote',
        },
        reactions: [],
      };
      await attacker.messageService.encryptAndSendDm(
        victim.identity.address,
        forged as unknown as Record<string, unknown>,
        attacker.identity.address,
        attacker.identity.keyset
      );
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      // 3. What actually landed in the victim's history for this conversation?
      const { messages } = await victim.messageDB.getMessages({
        spaceId: attacker.identity.address,
        channelId: attacker.identity.address,
        limit: 200,
      });
      const forgedStored = messages.find(
        (m) => m.content?.senderId === victim.identity.address
      );

      // 4. The victim renames. If the forgery worked, the sweep now believes
      //    the attacker is someone the victim deliberately messaged.
      await victim.messageService.broadcastProfileToAllDMs(
        VICTIM_NAME,
        '',
        undefined,
        victim.identity.address,
        victim.identity.keyset
      );
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const attackerRow = (
        await attacker.messageDB.getConversation({
          conversationId: `${victim.identity.address}/${victim.identity.address}`,
        })
      )?.conversation;
      const learnedName = attackerRow?.displayName;
      const ledgerFlipped = hasRevealedTo(
        victim.identity.address,
        attacker.identity.address
      );

      console.log(
        `[forgery] RESULT forgedStoredWithVictimSenderId=${!!forgedStored} ` +
          `ledgerFlipped=${ledgerFlipped} ` +
          `attackerLearned=${JSON.stringify(learnedName)} must_not_be="${VICTIM_NAME}" ` +
          `| victimMsgCount=${messages.length}`
      );

      // PRECONDITION — the bench must be alive: the attacker must hold a row
      // for the victim, or it could not observe a leak even if one occurred.
      expect(attackerRow, 'attacker holds no row for the victim — vacuous run').toBeTruthy();

      // THE SECURITY PROPERTY. Whatever the receive path chooses to do with a
      // forged senderId — drop it, normalise it, or store it — the outcome that
      // matters is that it must NOT convert a stranger into a revealed partner.
      expect(
        ledgerFlipped,
        'a forged self-authored message manufactured consent in the reveal ledger'
      ).toBe(false);
      expect(learnedName).not.toBe(VICTIM_NAME);
      expect(
        isPlaceholderDisplayName(learnedName ?? '', victim.identity.address),
        `attacker learned a real name via forgery: ${JSON.stringify(learnedName)}`
      ).toBe(true);

      console.log('[forgery] PASS — forged authorship did not manufacture consent');
    } finally {
      attacker.stop();
      victim.stop();
    }
  },
  10 * 60 * 1000
);
