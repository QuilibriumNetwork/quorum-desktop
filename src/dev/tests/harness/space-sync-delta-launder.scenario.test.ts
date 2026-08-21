// NETWORKED. A sync delta cannot reach another space's message by first
// overwriting that message's own row to claim the delivering space.
//
//   yarn harness space-sync-delta-launder
//
// Scoping the delete alone is not enough: the same delta's `newMessages` arm can
// overwrite a target row (keyed by bare messageId) and stamp it with the
// delivering space, after which the delete check passes on the laundered row.
// The fix guards all three arms with the same "already belongs to another
// space?" test on the same stored row, so the save arm cannot launder what the
// delete arm consumes.
//
//   m2    victim's message in S2  → laundered via newMessages, then named for delete
//   bOwn  sender's own message S1 → named for delete (positive control: frame ran)
//   m3    victim's message in S1  → never named (bystander: not a store wipe)
//
// The sender only ever deletes its OWN message. Send side is production crypto
// (`SpaceService.sendHubMessage` with the sender's real shared keys); the
// receiver's path is untouched. PRODUCTION relay, throwaway accounts. See
// identity.ts.
import { test, expect } from 'vitest';
import { type Message } from '@quilibrium/quorum-shared';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { RunLog } from './log';

const WINDOW_MS = Number(process.env.HARNESS_SPACE_WINDOW_MS ?? 120_000);
const SAMPLE_MS = Number(process.env.HARNESS_SPACE_SAMPLE_MS ?? 2000);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 20_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(
  check: () => Promise<T | undefined>,
  windowMs = WINDOW_MS
): Promise<T | undefined> {
  const deadline = Date.now() + windowMs;
  for (;;) {
    const got = await check();
    if (got !== undefined) return got;
    if (Date.now() >= deadline) return undefined;
    await sleep(SAMPLE_MS);
  }
}

function postIdByText(bot: HarnessSpaceBot, text: string): string | undefined {
  return bot.captured.find(
    (m) =>
      m.content?.type === 'post' &&
      (m.content as { text?: string }).text === text
  )?.messageId;
}

/** A minimal post-shaped `Message` reusing `messageId` — the laundering payload. */
function launderMessage(
  messageId: string,
  spaceId: string,
  channelId: string,
  senderId: string,
  text: string
): Message {
  return {
    spaceId,
    channelId,
    messageId,
    digestAlgorithm: 'SHA-256',
    nonce: crypto.randomUUID(),
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    lastModifiedHash: '',
    content: { type: 'post', senderId, text },
    publicKey: '',
    signature: '',
    reactions: [],
  } as unknown as Message;
}

/** Seal a `sync-delta` with chosen newMessages + deletedMessageIds and send it. */
async function sendSyncDelta(
  bot: HarnessSpaceBot,
  spaceId: string,
  channelId: string,
  delta: { newMessages?: Message[]; deletedMessageIds?: string[] }
): Promise<void> {
  const frame = await bot.graph.spaceService.sendHubMessage(
    spaceId,
    JSON.stringify({
      type: 'control',
      message: {
        type: 'sync-delta',
        messageDelta: {
          spaceId,
          channelId,
          newMessages: delta.newMessages ?? [],
          updatedMessages: [],
          deletedMessageIds: delta.deletedMessageIds ?? [],
        },
        isFinal: true,
      },
    })
  );
  bot.graph.outbound.enqueue(async () => [frame]);
  await bot.flush();
}

test(
  'space-sync-delta-launder: laundering a row’s spaceId via newMessages must not enable an out-of-space delete',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-sync-delta-launder', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[sync-delta-launder] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [a, b] = await Promise.all([
      createSpaceBot(`sdl-victim-${stamp}`),
      createSpaceBot(`sdl-sender-${stamp}`),
    ]);
    await Promise.all([a.start(), b.start()]);

    try {
      say(
        `victim=${a.identity.address.slice(0, 12)} sender=${b.identity.address.slice(0, 12)}`
      );

      const s1 = await a.createSpace(`sdl-s1-${stamp}`);
      const s2 = await a.createSpace(`sdl-s2-${stamp}`);
      say(`S1=${s1.spaceId.slice(0, 12)} S2=${s2.spaceId.slice(0, 12)}`);

      const m2Text = `A in S2 — launder+delete target ${stamp}`;
      const m3Text = `A in S1 — the bystander ${stamp}`;
      await a.post(s2.spaceId, s2.channelId, m2Text);
      await a.post(s1.spaceId, s1.channelId, m3Text);

      const m2 = postIdByText(a, m2Text);
      const m3 = postIdByText(a, m3Text);
      expect(m2, 'M2 (S2 message) was never persisted — nothing to test').toBeTruthy();
      expect(m3, 'M3 (bystander) was never persisted — control is void').toBeTruthy();
      expect(await a.getMessage(s2.spaceId, s2.channelId, m2!)).toBeTruthy();

      const link = await a.inviteLink(s1.spaceId);
      const joined = await b.join(link);
      expect(joined.spaceId).toBe(s1.spaceId);

      const bOwnText = `B’s own post in S1 ${stamp}`;
      await b.post(s1.spaceId, s1.channelId, bOwnText);
      const bOwn = await until(async () => {
        const id = postIdByText(a, bOwnText);
        return id && (await a.getMessage(s1.spaceId, s1.channelId, id))
          ? id
          : undefined;
      });
      expect(
        bOwn,
        'the victim never received the sender’s own S1 post — no positive control'
      ).toBeTruthy();
      say('sender joined S1; victim holds the positive-control target');

      // ── ATTACK: launder m2 into S1 via newMessages, then delete it ────────
      await sendSyncDelta(b, s1.spaceId, s1.channelId, {
        newMessages: [
          launderMessage(m2!, s1.spaceId, s1.channelId, b.identity.address, 'x'),
        ],
        deletedMessageIds: [bOwn!, m2!],
      });
      say(
        'ATTACK: sync-delta into S1 — newMessages reuses m2’s id, deletedMessageIds=[bOwn, m2]'
      );

      await until(async () => {
        const still = await a.getMessage(s1.spaceId, s1.channelId, bOwn!);
        return still === undefined ? true : undefined;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ───────────────────────────────────────────────────────────
      const bOwnAfter = await a.getMessage(s1.spaceId, s1.channelId, bOwn!);
      // m2 is read WITHOUT its space scope, so that a successful launder (which
      // would have moved the row to S1) is still detected as "row present" and
      // never mistaken for a survival. If the row exists under ANY space, the
      // message was not destroyed.
      const m2After = await a.messageDB.getMessageById(m2!);
      const m3After = await a.getMessage(s1.spaceId, s1.channelId, m3!);

      say('');
      say('==== RESULT ====');
      say(`POSITIVE  bOwn in S1 (named)       : ${bOwnAfter ? 'ALIVE' : 'DELETED'}`);
      say(
        `PROPERTY  m2 (laundered + named)   : ${
          m2After ? `PRESENT (space=${m2After.spaceId.slice(0, 8)})` : 'DESTROYED'
        }`
      );
      say(`BYSTANDER m3 in S1 (unnamed)       : ${m3After ? 'ALIVE' : 'DELETED'}`);
      say(
        `receive failures: NOVEL victim=${a.novelErrors().length} sender=${b.novelErrors().length}`
      );
      for (const e of a.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── POSITIVE CONTROL — the frame was processed ───────────────────────
      expect(
        bOwnAfter,
        'POSITIVE CONTROL: the in-space delete was not applied, so this run ' +
          'proves nothing about the laundered one'
      ).toBeFalsy();
      expect(
        a.novelErrors().length,
        'the victim raised a novel receive error — the forged frame may have ' +
          'been rejected before the handler ran'
      ).toBe(0);

      // ── BYSTANDER ────────────────────────────────────────────────────────
      expect(
        m3After,
        'BYSTANDER: an unnamed message was deleted — result is not isolated'
      ).toBeTruthy();

      // ── SECURITY PROPERTY — no launder-then-delete ───────────────────────
      // m2 must still exist AND still belong to S2. Either "destroyed" or
      // "relocated to S1" is a failure: relocation alone is the cross-space
      // overwrite, and it is the step that would have unlocked the delete.
      expect(
        m2After,
        'SECURITY: the victim’s S2 message was destroyed — the newMessages arm ' +
          'laundered its spaceId and the delete arm then consumed it'
      ).toBeTruthy();
      expect(
        m2After?.spaceId,
        'SECURITY: the victim’s S2 message was relocated into S1 by a laundering ' +
          'newMessages entry — spaceId must be immutable across a sync-delta'
      ).toBe(s2.spaceId);

      say('PASS — a sync-delta could not launder a row across the space boundary');
    } finally {
      a.stop();
      b.stop();
    }
  },
  20 * 60 * 1000
);
