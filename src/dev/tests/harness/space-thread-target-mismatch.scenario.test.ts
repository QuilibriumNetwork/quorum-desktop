// NETWORKED. Can a member permanently delete your caption-less image?
//
//   yarn harness space-thread-target-mismatch
//
// ── The attack ─────────────────────────────────────────────────────────────
//
// A `thread` frame carries TWO independent attacker-written fields naming what
// it acts on, and until this was fixed nothing tied them together:
//
//   threadMeta.threadId   what every authorization check reads
//   targetMessageId       what the destructive work actually operates on
//
// So the check and the deletion could be pointed at different things.
//
//   1. B opens a thread on B's OWN post. Always permitted, no role needed —
//      `create` is not a privileged action.
//   2. B sends `remove` naming that harmless thread, but with `targetMessageId`
//      set to one of A's messages.
//   3. Authorization resolves the thread's creator from `channel_threads` —
//      which is keyed by BARE threadId — sees B, and allows. The reply check
//      looks at B's own empty thread and also allows.
//   4. The applier then evaluates A's message. Its hard-delete branch fires on
//      `isSoftDeleted`, which is computed as "content.text is empty".
//
// Every caption-less image, embed and sticker has empty text. So does every
// message already soft-deleted by an ordinary `remove-message`. Any space
// member could destroy any of them, on every recipient's device, holding no
// role and forging no signature — B's frame is honestly signed by B throughout.
//
// The deletion also writes a tombstone, which suppresses re-sync. It is not
// recoverable.
//
// ── The two arms ───────────────────────────────────────────────────────────
//
// ATTACK   B removes its own thread while targeting A's caption-less image.
//          A's image must SURVIVE on A's device.
//
// CONTROL  B removes that same thread naming its OWN post as the target, which
//          is what an honest client sends. B's post must be GONE on A's device.
//
// The control is not optional: it is the only thing separating "the mismatch is
// refused" from "thread removal stopped working", and the attack arm reads
// identically under both.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { type ThreadMessage } from '@quilibrium/quorum-shared';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { sealThreadFrame, threadIdFor } from './threadFrames';
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

/**
 * The caption-less post carrying `marker`.
 *
 * Found by its media rather than its text, because its text is EMPTY — which is
 * the whole point. `text: ''` with attached media is exactly the shape of an
 * image posted without a caption, and also exactly the shape `remove-message`
 * leaves behind when it soft-deletes something (`MessageService.ts:2534-2542`).
 */
function captionlessPostId(
  bot: HarnessSpaceBot,
  marker: string
): string | undefined {
  return bot.captured.find(
    (m) =>
      m.content?.type === 'post' &&
      (m.content as { embeddedMedia?: string[] }).embeddedMedia?.[0] === marker
  )?.messageId;
}

test(
  'space-thread-target-mismatch: a thread removal must not reach a message that is not its root',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-thread-target-mismatch', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[target-mismatch] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [a, b] = await Promise.all([
      createSpaceBot(`tgt-victim-${stamp}`),
      createSpaceBot(`tgt-attacker-${stamp}`),
    ]);
    await Promise.all([a.start(), b.start()]);

    try {
      say(
        `victim=${a.identity.address.slice(0, 12)} attacker=${b.identity.address.slice(0, 12)}`
      );

      // ── Setup ────────────────────────────────────────────────────────────
      const { spaceId, channelId } = await a.createSpace(`tgt-${stamp}`);

      // A's caption-less image. Empty text is what arms the applier's
      // hard-delete branch, and it is an entirely ordinary thing to post.
      const marker = `victim-image-${stamp}`;
      await a.sendControl(spaceId, channelId, {
        type: 'post',
        senderId: a.identity.address,
        text: '',
        embeddedMedia: [marker],
      });

      const link = await a.inviteLink(spaceId);
      const joined = await b.join(link);
      expect(joined.spaceId).toBe(spaceId);

      // B's own post — the legitimate root of B's own thread.
      const bPostText = `B’s own post ${stamp}`;
      await b.post(spaceId, channelId, bPostText);

      const victimImageId = captionlessPostId(a, marker);
      expect(
        victimImageId,
        'the victim’s caption-less post was never persisted — nothing was tested'
      ).toBeTruthy();

      // B must SEE the victim's image to target it, and must have its own post.
      const seen = await until(async () => {
        const img = captionlessPostId(b, marker);
        const own = postIdByText(b, bPostText);
        return img && own ? { img, own } : undefined;
      });
      expect(
        seen,
        'attacker never received the victim’s image — nothing was tested'
      ).toBeTruthy();
      const { img: victimImageIdOnB, own: bPostId } = seen!;
      expect(
        victimImageIdOnB,
        'the two devices disagree about the victim image’s id — the attack ' +
          'below would target nothing'
      ).toBe(victimImageId);

      const signing = await b.signingKey(spaceId);
      expect(
        signing,
        'attacker holds no space signing key — no frame could be signed'
      ).toBeTruthy();

      // ── B opens a thread on its OWN post. Entirely legitimate ────────────
      const bThreadId = await threadIdFor(bPostId);
      await b.sendControl(spaceId, channelId, {
        type: 'thread',
        senderId: b.identity.address,
        targetMessageId: bPostId,
        action: 'create',
        threadMeta: {
          threadId: bThreadId,
          createdBy: b.identity.address,
          lastActivityAt: Date.now(),
        },
      } satisfies ThreadMessage);

      const threaded = await until(async () => {
        const root = await a.getMessage(spaceId, channelId, bPostId);
        return root?.threadMeta ? true : undefined;
      });
      expect(
        threaded,
        'the attacker’s thread never reached the victim — nothing was tested'
      ).toBeTruthy();
      say('attacker opened a thread on its own post');

      // ── ATTACK: B's thread, A's message as the target ────────────────────
      // Raw-sealed because the honest send path now refuses this shape too, and
      // a real attacker is not running our client. B signs it with B's own key;
      // nothing about the identity is forged.
      await b.forgeSend(
        spaceId,
        await sealThreadFrame({
          spaceId,
          channelId,
          signing: signing!,
          thread: {
            type: 'thread',
            senderId: b.identity.address,
            // ⚠️ THE MISMATCH: the victim's message...
            targetMessageId: victimImageId!,
            action: 'remove',
            threadMeta: {
              // ...while naming the attacker's own, empty, legitimate thread.
              threadId: bThreadId,
              createdBy: b.identity.address,
              lastActivityAt: Date.now(),
            },
          },
        })
      );
      say('ATTACK: remove sent naming the attacker’s thread, targeting the victim’s image');

      // ── CONTROL: the same thread, removed honestly ───────────────────────
      await b.sendControl(spaceId, channelId, {
        type: 'thread',
        senderId: b.identity.address,
        targetMessageId: bPostId,
        action: 'remove',
        threadMeta: {
          threadId: bThreadId,
          createdBy: b.identity.address,
          lastActivityAt: Date.now(),
        },
      } satisfies ThreadMessage);
      say('CONTROL: honest remove of the attacker’s own thread and root');

      // B authored that root, so an applied remove HARD-DELETES it. Waiting on
      // that gives the attack frame, sent first, at least as long to be applied.
      await until(async () => {
        const root = await a.getMessage(spaceId, channelId, bPostId);
        return root === undefined ? true : undefined;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ───────────────────────────────────────────────────────────
      const victimImageAfter = await a.getMessage(
        spaceId,
        channelId,
        victimImageId!
      );
      const bPostAfter = await a.getMessage(spaceId, channelId, bPostId);

      say('');
      say('==== RESULT ====');
      say(`ATTACK  victim image on victim: ${victimImageAfter ? 'ALIVE' : 'DELETED'}`);
      say(`CONTROL attacker post on victim: ${bPostAfter ? 'ALIVE' : 'DELETED'}`);
      say(
        `receive failures: NOVEL victim=${a.novelErrors().length} attacker=${b.novelErrors().length}`
      );
      for (const e of a.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── CONTROL first — the feature still works ─────────────────────────
      expect(
        bPostAfter,
        'CONTROL: the honest remove was never applied, so this run proves ' +
          'nothing about the mismatched one — thread removal may be broken, ' +
          'or no frame arrived'
      ).toBeFalsy();

      // ── ATTACK — the security property ──────────────────────────────────
      expect(
        victimImageAfter,
        'ATTACK: a member with no role permanently deleted the victim’s ' +
          'caption-less image by naming their own thread and targeting it'
      ).toBeTruthy();

      say('PASS — a removal reached only its own thread’s root');
    } finally {
      a.stop();
      b.stop();
    }
  },
  20 * 60 * 1000
);
