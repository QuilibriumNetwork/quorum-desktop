// NETWORKED. A sync delta may only delete messages belonging to the space that
// delivered it.
//
//   yarn harness space-sync-delta-scope
//
// `sync-delta` carries `deletedMessageIds`, applied against a `messages` store
// keyed by bare messageId — so without a scope check a delta into one space
// could delete a message stored for a DIFFERENT space, one the sender may have
// no relationship to. The handler skips any id whose stored row belongs to
// another space.
//
//   bOwn  sender's message in S1 → named for delete (positive control: frame ran)
//   m2    victim's message in S2 → named for delete (must survive: out of scope)
//   m3    victim's message in S1 → never named (bystander: not a store wipe)
//
// The sender only ever deletes its OWN message. Send side is production crypto
// (`SpaceService.sendHubMessage` with the sender's real shared keys); the
// receiver's path is untouched. PRODUCTION relay, throwaway accounts. See
// identity.ts.
import { test, expect } from 'vitest';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { RunLog } from './log';

const WINDOW_MS = Number(process.env.HARNESS_SPACE_WINDOW_MS ?? 120_000);
const SAMPLE_MS = Number(process.env.HARNESS_SPACE_SAMPLE_MS ?? 2000);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 20_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll `check` until it returns a defined value or the window expires. */
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

/**
 * Seal a `sync-delta` hub-control frame with `bot`'s real space keys and put it
 * on the wire, exactly as a hub broadcast travels.
 *
 * `SpaceService.sendHubMessage` is the SAME call the app uses for every hub
 * control frame: it fetches this bot's `hub` + `config` keys and returns a
 * `{type:'group',...}` frame. Only the payload is chosen here. Enqueuing on the
 * bot's own outbound queue is how the frame reaches the relay and fans out to
 * the space's listeners.
 */
async function sendSyncDeltaDelete(
  bot: HarnessSpaceBot,
  spaceId: string,
  channelId: string,
  deletedMessageIds: string[]
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
          newMessages: [],
          updatedMessages: [],
          deletedMessageIds,
        },
        isFinal: true,
      },
    })
  );
  bot.graph.outbound.enqueue(async () => [frame]);
  await bot.flush();
}

test(
  'space-sync-delta-scope: a sync-delta must not delete a message outside its delivering space',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-sync-delta-scope', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[sync-delta-scope] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [a, b] = await Promise.all([
      createSpaceBot(`sds-victim-${stamp}`),
      createSpaceBot(`sds-sender-${stamp}`),
    ]);
    await Promise.all([a.start(), b.start()]);

    try {
      say(
        `victim=${a.identity.address.slice(0, 12)} sender=${b.identity.address.slice(0, 12)}`
      );

      // ── Setup ────────────────────────────────────────────────────────────
      // A owns two spaces on ONE device (one IndexedDB). B joins only S1. A's
      // message in S2 is reachable from an S1 frame iff the delete ignores scope.
      const s1 = await a.createSpace(`sds-s1-${stamp}`);
      const s2 = await a.createSpace(`sds-s2-${stamp}`);
      say(`S1=${s1.spaceId.slice(0, 12)} S2=${s2.spaceId.slice(0, 12)}`);

      const m2Text = `A in S2 — out of the delta’s scope ${stamp}`;
      const m3Text = `A in S1 — the bystander ${stamp}`;
      await a.post(s2.spaceId, s2.channelId, m2Text);
      await a.post(s1.spaceId, s1.channelId, m3Text);

      const m2 = postIdByText(a, m2Text);
      const m3 = postIdByText(a, m3Text);
      expect(m2, 'M2 (S2 message) was never persisted — nothing to test').toBeTruthy();
      expect(m3, 'M3 (bystander) was never persisted — control is void').toBeTruthy();
      expect(await a.getMessage(s2.spaceId, s2.channelId, m2!)).toBeTruthy();
      expect(await a.getMessage(s1.spaceId, s1.channelId, m3!)).toBeTruthy();

      const link = await a.inviteLink(s1.spaceId);
      const joined = await b.join(link);
      expect(joined.spaceId).toBe(s1.spaceId);
      say('sender joined S1 (and nothing else)');

      // B posts its OWN message in S1. This is the message B is entitled to
      // delete, and its deletion is the positive control.
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
        'the victim never received the sender’s own S1 post — the positive ' +
          'control cannot run, so a surviving M2 would prove nothing'
      ).toBeTruthy();
      say('victim holds the sender’s own S1 post (positive-control target)');

      // ── The delta: names an in-space message (bOwn) and an out-of-space one (m2)
      await sendSyncDeltaDelete(b, s1.spaceId, s1.channelId, [bOwn!, m2!]);
      say('sync-delta sent into S1, deletedMessageIds = [bOwn(S1), m2(S2)]');

      // Wait for the positive control to land, then settle. Waiting on the
      // in-space delete gives the out-of-space one at least as long to be applied
      // if the scope check were absent — so a surviving M2 is a real refusal.
      await until(async () => {
        const still = await a.getMessage(s1.spaceId, s1.channelId, bOwn!);
        return still === undefined ? true : undefined;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ───────────────────────────────────────────────────────────
      const bOwnAfter = await a.getMessage(s1.spaceId, s1.channelId, bOwn!);
      const m2After = await a.getMessage(s2.spaceId, s2.channelId, m2!);
      const m3After = await a.getMessage(s1.spaceId, s1.channelId, m3!);

      say('');
      say('==== RESULT ====');
      say(`POSITIVE  bOwn in S1 (named)   : ${bOwnAfter ? 'ALIVE' : 'DELETED'}`);
      say(`PROPERTY  m2   in S2 (named)   : ${m2After ? 'ALIVE' : 'DELETED'}`);
      say(`BYSTANDER m3   in S1 (unnamed) : ${m3After ? 'ALIVE' : 'DELETED'}`);
      say(
        `receive failures: NOVEL victim=${a.novelErrors().length} sender=${b.novelErrors().length}`
      );
      for (const e of a.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── POSITIVE CONTROL first — the delete path is live ─────────────────
      expect(
        bOwnAfter,
        'POSITIVE CONTROL: the in-space delete was NOT applied, so this run ' +
          'proves nothing about the out-of-space one — sync-delta delete may be ' +
          'broken, or no frame arrived'
      ).toBeFalsy();

      expect(
        a.novelErrors().length,
        'the victim raised a novel receive error — the forged frame may have ' +
          'been rejected before the handler ran, making a surviving M2 a false ' +
          'positive'
      ).toBe(0);

      // ── BYSTANDER — the delete was targeted ──────────────────────────────
      expect(
        m3After,
        'BYSTANDER: an unnamed message was deleted — the delete is untargeted ' +
          '(or the store was wiped), so the property below is not isolated'
      ).toBeTruthy();

      // ── SECURITY PROPERTY — the scope boundary held ──────────────────────
      expect(
        m2After,
        'SECURITY: a sync-delta delivered on S1 deleted a message in S2. A ' +
          'delete must be refused when the stored row belongs to another space.'
      ).toBeTruthy();

      say('PASS — the delta deleted only within its delivering space');
    } finally {
      a.stop();
      b.stop();
    }
  },
  20 * 60 * 1000
);
