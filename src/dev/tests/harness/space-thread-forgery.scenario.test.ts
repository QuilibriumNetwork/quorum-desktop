// NETWORKED. Can a stranger DESTROY your messages by opening a thread on them?
//
//   yarn harness space-thread-forgery
//
// ── The attack ─────────────────────────────────────────────────────────────
//
// Thread actions used to be authorized against `content.senderId` — PLAINTEXT
// the sending client writes — rather than against the sender the crypto layer
// authenticated. `remove` is the destructive one: it chooses between
// hard-deleting the thread's ROOT message and merely stripping that root's
// `threadMeta`, and it made that choice by comparing two payload fields to each
// other.
//
// A single forged frame is not enough, and the reason is the whole point of
// this scenario. Authorization asks two questions in order:
//
//   1. is the sender the thread's creator?          → allowed
//   2. otherwise, does the sender hold message:delete? → allowed
//
// Claiming to be the victim gets you nothing on its own: the victim is not the
// creator either, so you land on question 2 and need a role you cannot grant
// yourself. The chain works by making question 1 answer yes:
//
//   1. A posts a message.
//   2. B opens a thread on it, and writes `threadMeta.createdBy: <A>`. Thread
//      creation was unauthenticated and the registry copied `createdBy` straight
//      off the wire, so the thread now records A as its own creator.
//   3. B sends `remove` claiming `senderId: <A>`. Now sender == creator, so
//      question 1 says yes with no role involved — and "am I the root's author?"
//      compares two payload fields that both say A, so it says yes too.
//
// A's message is gone. B never held a role, the space owner was never involved,
// and every frame decrypted perfectly.
//
// ⚠️ Step 2 is what makes this reachable. An earlier version of this scenario
// created the thread honestly (`createdBy: <B>`) and forged only the remove.
// That version passed against PRE-FIX code — the claimed sender A was neither
// creator nor role-holder, so the pre-fix check denied it for reasons having
// nothing to do with the fix. It was a green test that could not fail. If you
// are tempted to simplify this file by dropping the forged `createdBy`, that is
// the trap you are walking back into.
//
// ── The two arms, and why the control one is not optional ──────────────────
//
// ATTACK ARM   B forges `createdBy: <A>` then `senderId: <A>`. A's root must SURVIVE.
// CONTROL ARM  B opens and removes a thread honestly, as itself. A's root must
//              also survive, but its `threadMeta` must be STRIPPED.
//
// The control arm distinguishes "the fix works" from "threads are broken".
// Without it, a build that ignored every thread frame — or one where the frames
// never arrived at all — would pass the attack arm perfectly. Its stripped
// `threadMeta` is the positive evidence that removes are being received,
// decrypted, authorized and applied.
//
// ── Why this scenario builds its own envelopes ─────────────────────────────
//
// A well-behaved client cannot express either forged frame: `submitChannelMessage`
// overwrites `content.senderId` with the sender's own address, and the fix pins
// `threadMeta.createdBy` to the verified signer. A real attacker is not running
// our client, so the scenario does what a modified one would — it builds the
// exact bytes and hands them to the REAL sealing call (`encryptAndSendToSpace`),
// each with a genuine ed448 signature from B's own space signing key. Only the
// send side is synthetic; everything from the wire onward is A's production
// receive path.
//
// Signing them for real matters. A garbage-signed frame would be refused for a
// reason that has nothing to do with authorization, and the scenario would pass
// while testing nothing. Note the two forged frames differ here on purpose:
// the CREATE claims B's own authorship, so its signature verifies and survives
// intact; only the REMOVE claims A, which is the claim under test.
//
// ⚠️ Talks to the PRODUCTION relay with throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { channel_raw as ch } from '@quilibrium/quilibrium-js-sdk-channels';
import {
  canonicalize,
  type Message,
  type ThreadMessage,
} from '@quilibrium/quorum-shared';
import { createSpaceBot, type HarnessSpaceBot } from './spaceBot';
import { RunLog } from './log';

const WINDOW_MS = Number(process.env.HARNESS_SPACE_WINDOW_MS ?? 120_000);
const SAMPLE_MS = Number(process.env.HARNESS_SPACE_SAMPLE_MS ?? 2000);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 20_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The thread id the app derives from a root message — see Channel.tsx. */
async function threadIdFor(messageId: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(messageId + ':thread')
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Poll until `check` returns a value, or the window closes. */
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

/** The messageId of the post carrying `text`, as this bot persisted it. */
function postIdByText(bot: HarnessSpaceBot, text: string): string | undefined {
  return bot.captured.find(
    (m) =>
      m.content?.type === 'post' &&
      (m.content as { text?: string }).text === text
  )?.messageId;
}

/**
 * Build a space `Message` around a thread payload exactly as the honest send
 * path builds it, then sign it with `signing`.
 *
 * The fingerprint uses `content.senderId` because that is what the RECEIVER
 * feeds to `buildMessageFingerprint`. Keeping them equal is what makes a forged
 * frame internally consistent rather than merely malformed — a malformed frame
 * would be dropped early and would prove nothing.
 */
async function sealThreadFrame(params: {
  spaceId: string;
  channelId: string;
  thread: ThreadMessage;
  signing: { publicKey: string; privateKey: string };
}): Promise<Message> {
  const { spaceId, channelId, thread, signing } = params;
  const nonce = crypto.randomUUID();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Buffer.from(
      nonce + 'thread' + thread.senderId + canonicalize(thread as never),
      'utf-8'
    )
  );
  return {
    spaceId,
    channelId,
    messageId: Buffer.from(digest).toString('hex'),
    digestAlgorithm: 'SHA-256',
    nonce,
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    lastModifiedHash: '',
    content: thread,
    publicKey: signing.publicKey,
    signature: Buffer.from(
      JSON.parse(
        ch.js_sign_ed448(
          Buffer.from(signing.privateKey, 'hex').toString('base64'),
          Buffer.from(digest).toString('base64')
        )
      ),
      'base64'
    ).toString('hex'),
    reactions: [],
  } as unknown as Message;
}

test(
  'space-thread-forgery: opening a thread on someone else’s message must not confer the power to destroy it',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-thread-forgery', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[thread-forgery] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    // Fresh throwaways: a reused bot would already hold the roots and threads
    // from a previous run and could "pass" with no exchange having happened.
    const [a, b] = await Promise.all([
      createSpaceBot(`thr-victim-${stamp}`),
      createSpaceBot(`thr-attacker-${stamp}`),
    ]);
    await Promise.all([a.start(), b.start()]);

    try {
      say(
        `victim=${a.identity.address.slice(0, 12)} attacker=${b.identity.address.slice(0, 12)}`
      );

      // ── Setup: A owns a space with two posts; B joins ────────────────────
      const { spaceId, channelId } = await a.createSpace(`thr-${stamp}`);
      const attackText = `A root under attack ${stamp}`;
      const controlText = `A root as control ${stamp}`;
      await a.post(spaceId, channelId, attackText);
      await a.post(spaceId, channelId, controlText);

      const link = await a.inviteLink(spaceId);
      const joined = await b.join(link);
      expect(joined.spaceId).toBe(spaceId);

      // B must actually SEE both roots before it can thread them. This is the
      // real sync exchange, so it is polled rather than slept through.
      const seen = await until(async () => {
        const atk = postIdByText(b, attackText);
        const ctl = postIdByText(b, controlText);
        return atk && ctl ? { atk, ctl } : undefined;
      });
      expect(
        seen,
        'attacker never received the victim’s posts — nothing was tested'
      ).toBeTruthy();
      const { atk: attackRootId, ctl: controlRootId } = seen!;
      say(
        `roots: attack=${attackRootId.slice(0, 10)} control=${controlRootId.slice(0, 10)}`
      );

      const signing = await b.signingKey(spaceId);
      expect(
        signing,
        'attacker holds no space signing key — no frame could be signed'
      ).toBeTruthy();

      const attackThreadId = await threadIdFor(attackRootId);
      const controlThreadId = await threadIdFor(controlRootId);

      // ── ATTACK, step 2: open a thread that CLAIMS THE VICTIM CREATED IT ──
      // Sent as B (so the signature verifies and survives the receive gate);
      // only `threadMeta.createdBy` lies. This is the step that makes the
      // remove below reachable without any role.
      await b.forgeSend(
        spaceId,
        await sealThreadFrame({
          spaceId,
          channelId,
          signing: signing!,
          thread: {
            type: 'thread',
            senderId: b.identity.address,
            targetMessageId: attackRootId,
            action: 'create',
            threadMeta: {
              threadId: attackThreadId,
              // ⚠️ THE FIRST LIE: B is creating this thread, not A.
              createdBy: a.identity.address,
              lastActivityAt: Date.now(),
            },
          },
        })
      );

      // ── CONTROL: an ordinary thread, opened honestly by B ────────────────
      await b.sendControl(spaceId, channelId, {
        type: 'thread',
        senderId: b.identity.address,
        targetMessageId: controlRootId,
        action: 'create',
        threadMeta: {
          threadId: controlThreadId,
          createdBy: b.identity.address,
          lastActivityAt: Date.now(),
        },
      } satisfies ThreadMessage);

      // Both threads must have landed on A's device, or the removes below have
      // nothing to act on and the whole run is vacuous.
      const threaded = await until(async () => {
        const atk = await a.getMessage(spaceId, channelId, attackRootId);
        const ctl = await a.getMessage(spaceId, channelId, controlRootId);
        return atk?.threadMeta && ctl?.threadMeta ? { atk, ctl } : undefined;
      });
      expect(
        threaded,
        'the threads never reached the victim — nothing was tested'
      ).toBeTruthy();
      // Report, do not assert. Post-fix this reads as the ATTACKER (the forged
      // createdBy was overwritten with the verified signer); pre-fix it reads as
      // the VICTIM. Asserting either way would pin the scenario to one side of
      // the fix, and its job is to run meaningfully against both.
      say(
        `victim's view of attacked thread: createdBy=${threaded!.atk.threadMeta?.createdBy?.slice(0, 10)} ` +
          `(attacker=${b.identity.address.slice(0, 10)} victim=${a.identity.address.slice(0, 10)})`
      );

      // ── ATTACK, step 3: `remove`, claiming to be A ──────────────────────
      await b.forgeSend(
        spaceId,
        await sealThreadFrame({
          spaceId,
          channelId,
          signing: signing!,
          thread: {
            type: 'thread',
            // ⚠️ THE SECOND LIE: the victim's address, on a frame B sealed.
            senderId: a.identity.address,
            targetMessageId: attackRootId,
            action: 'remove',
            threadMeta: {
              threadId: attackThreadId,
              createdBy: a.identity.address,
              lastActivityAt: Date.now(),
            },
          },
        })
      );
      say('forged remove sent (claims victim authorship over victim-owned thread)');

      // ── CONTROL: the same remove, sent honestly as B ────────────────────
      await b.sendControl(spaceId, channelId, {
        type: 'thread',
        senderId: b.identity.address,
        targetMessageId: controlRootId,
        action: 'remove',
        threadMeta: {
          threadId: controlThreadId,
          createdBy: b.identity.address,
          lastActivityAt: Date.now(),
        },
      } satisfies ThreadMessage);
      say('honest remove sent (control arm)');

      // The control arm is the one with a positive outcome to wait for, so it
      // doubles as the settle signal: once A has applied it, A has had at least
      // as long to apply the forged frame that was sent first.
      await until(async () => {
        const ctl = await a.getMessage(spaceId, channelId, controlRootId);
        return ctl && !ctl.threadMeta ? true : undefined;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ───────────────────────────────────────────────────────────
      const attackRootAfter = await a.getMessage(
        spaceId,
        channelId,
        attackRootId
      );
      const controlRootAfter = await a.getMessage(
        spaceId,
        channelId,
        controlRootId
      );

      say('');
      say('==== RESULT ====');
      say(
        `attack  root: ${attackRootAfter ? 'ALIVE' : 'DELETED'}  threadMeta=${!!attackRootAfter?.threadMeta}`
      );
      say(
        `control root: ${controlRootAfter ? 'ALIVE' : 'DELETED'}  threadMeta=${!!controlRootAfter?.threadMeta}`
      );
      say(
        `receive failures: NOVEL victim=${a.novelErrors().length} attacker=${b.novelErrors().length}`
      );
      for (const e of a.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── CONTROL ARM assertions — the feature still works ────────────────
      //
      // These run FIRST deliberately. If threads are broken, or nothing
      // arrived, this is the arm that says so, and it says so before the
      // security assertion can pass for the wrong reason.
      expect(
        controlRootAfter,
        'CONTROL ARM: an honest thread remove hard-deleted a root the remover did not write — ' +
          'thread removal is over-reaching'
      ).toBeTruthy();
      expect(
        controlRootAfter?.threadMeta,
        'CONTROL ARM: the honest remove was never applied, so this run proves nothing about the ' +
          'forged one — threads may be broken, or no frame arrived'
      ).toBeFalsy();

      // ── ATTACK ARM assertion — the security property ────────────────────
      expect(
        attackRootAfter,
        'ATTACK: opening a thread on someone’s message, claiming they created it, then claiming ' +
          'to be them, DESTROYED their message'
      ).toBeTruthy();

      say('PASS — a forged authorship claim carried no authority over the root');
    } finally {
      a.stop();
      b.stop();
    }
  },
  15 * 60 * 1000
);
