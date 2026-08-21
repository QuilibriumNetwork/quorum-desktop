// NETWORKED. Can someone who opened a thread on your message DELETE your replies in it?
//
//   yarn harness space-thread-reply-wipe
//
// ── The rule, and where it was ─────────────────────────────────────────────
//
// Opening a thread on someone else's message is ordinary behaviour and it makes
// you the thread's creator. `action: 'remove'` then hard-deletes the thread —
// and every reply inside it, on every recipient's device.
//
// The product rule bounding that has always been: a creator may remove a thread
// holding nothing but their OWN replies; past that it takes `message:delete`.
// It was implemented once, in `ThreadSettingsModal.tsx:194`, which hides the
// Delete button and says why. That decides what an honest client OFFERS. It
// decides nothing about what a receiver ACCEPTS, and the receive path applied
// `remove` with no equivalent check — so a modified client that simply sent the
// frame anyway wiped everyone else's replies for everyone.
//
// ── The three arms ────────────────────────────────────────────────────────
//
// ATTACK      B threads A's post, A replies, B sends `remove` via the RAW seal
//             (bypassing its own client's send gate, as a modified client would).
//             A's reply must SURVIVE on A's device.
//
// SEND GATE   Same setup, but B uses the REAL send path. An honest client must
//             refuse to broadcast it — and must not apply it locally either, or
//             B alone believes the thread is gone. Checked on BOTH devices.
//
// CONTROL     B threads A's post, replies to itself, and removes it honestly.
//             That must still work: B's reply GONE and the root's `threadMeta`
//             STRIPPED, on A's device.
//
// The control arm is not optional. Without it, a build that ignored every
// thread frame — or a run where nothing arrived at all — passes both security
// arms perfectly. Its stripped `threadMeta` is the positive evidence that
// removes are being received, decrypted, authorized and applied.
//
// ⚠️ Confirm this file goes RED against pre-fix code before trusting it green
// against a fix. The sibling scenario's first draft was green against the
// vulnerable code — a test that could not fail — because the frame it sent was
// refused for a reason unrelated to the property under test. Here the analogous
// trap is the ATTACK arm: if it used `sendControl` instead of `forgeSend`, the
// fix's own SEND gate would stop the frame leaving B, and the arm would pass
// without the receive side ever being asked anything.
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

/** An honest `create` for a thread this bot is opening as itself. */
function createFrame(
  bot: HarnessSpaceBot,
  rootId: string,
  threadId: string
): ThreadMessage {
  return {
    type: 'thread',
    senderId: bot.identity.address,
    targetMessageId: rootId,
    action: 'create',
    threadMeta: {
      threadId,
      createdBy: bot.identity.address,
      lastActivityAt: Date.now(),
    },
  } satisfies ThreadMessage;
}

/** An honest `remove` for a thread this bot created. No field lies. */
function removeFrame(
  bot: HarnessSpaceBot,
  rootId: string,
  threadId: string
): ThreadMessage {
  return {
    type: 'thread',
    senderId: bot.identity.address,
    targetMessageId: rootId,
    action: 'remove',
    threadMeta: {
      threadId,
      createdBy: bot.identity.address,
      lastActivityAt: Date.now(),
    },
  } satisfies ThreadMessage;
}

test(
  'space-thread-reply-wipe: opening a thread on someone’s message must not confer the power to delete their replies in it',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-thread-reply-wipe', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[reply-wipe] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    // Fresh throwaways: a reused bot would already hold the roots, threads and
    // replies from a previous run and could "pass" with no exchange happening.
    const [a, b] = await Promise.all([
      createSpaceBot(`wipe-victim-${stamp}`),
      createSpaceBot(`wipe-attacker-${stamp}`),
    ]);
    await Promise.all([a.start(), b.start()]);

    try {
      say(
        `victim=${a.identity.address.slice(0, 12)} attacker=${b.identity.address.slice(0, 12)}`
      );

      // ── Setup: A owns a space with three posts; B joins ──────────────────
      const { spaceId, channelId } = await a.createSpace(`wipe-${stamp}`);
      const attackText = `A root, attacked ${stamp}`;
      const gateText = `A root, send-gated ${stamp}`;
      const controlText = `A root, control ${stamp}`;
      await a.post(spaceId, channelId, attackText);
      await a.post(spaceId, channelId, gateText);
      await a.post(spaceId, channelId, controlText);

      const link = await a.inviteLink(spaceId);
      const joined = await b.join(link);
      expect(joined.spaceId).toBe(spaceId);

      // B must SEE all three roots before it can thread them. This is the real
      // sync exchange, so it is polled rather than slept through.
      const seen = await until(async () => {
        const atk = postIdByText(b, attackText);
        const gate = postIdByText(b, gateText);
        const ctl = postIdByText(b, controlText);
        return atk && gate && ctl ? { atk, gate, ctl } : undefined;
      });
      expect(
        seen,
        'attacker never received the victim’s posts — nothing was tested'
      ).toBeTruthy();
      const {
        atk: attackRootId,
        gate: gateRootId,
        ctl: controlRootId,
      } = seen!;

      const signing = await b.signingKey(spaceId);
      expect(
        signing,
        'attacker holds no space signing key — no frame could be signed'
      ).toBeTruthy();

      const attackThreadId = await threadIdFor(attackRootId);
      const gateThreadId = await threadIdFor(gateRootId);
      const controlThreadId = await threadIdFor(controlRootId);

      // ── B opens all three threads, honestly, as itself ───────────────────
      // Nothing is forged here. Threading someone else's post is allowed, and
      // it is what makes B the creator of all three.
      await b.sendControl(
        spaceId,
        channelId,
        createFrame(b, attackRootId, attackThreadId)
      );
      await b.sendControl(
        spaceId,
        channelId,
        createFrame(b, gateRootId, gateThreadId)
      );
      await b.sendControl(
        spaceId,
        channelId,
        createFrame(b, controlRootId, controlThreadId)
      );

      // All three must reach A, or the replies below are orphaned and the
      // removes have nothing meaningful to act on.
      const threaded = await until(async () => {
        const atk = await a.getMessage(spaceId, channelId, attackRootId);
        const gate = await a.getMessage(spaceId, channelId, gateRootId);
        const ctl = await a.getMessage(spaceId, channelId, controlRootId);
        return atk?.threadMeta && gate?.threadMeta && ctl?.threadMeta
          ? true
          : undefined;
      });
      expect(
        threaded,
        'the threads never reached the victim — nothing was tested'
      ).toBeTruthy();
      say('three threads opened by the attacker on the victim’s posts');

      // ── A replies inside two of B's threads. This is the content at risk ──
      const attackReplyText = `A reply the attacker must not destroy ${stamp}`;
      const gateReplyText = `A reply the send gate must protect ${stamp}`;
      await a.postToThread(
        spaceId,
        channelId,
        attackThreadId,
        attackReplyText
      );
      await a.postToThread(spaceId, channelId, gateThreadId, gateReplyText);

      // ── B replies in its OWN thread — the removable case ─────────────────
      const controlReplyText = `B’s own reply ${stamp}`;
      await b.postToThread(
        spaceId,
        channelId,
        controlThreadId,
        controlReplyText
      );

      const attackReplyId = postIdByText(a, attackReplyText);
      const gateReplyId = postIdByText(a, gateReplyText);
      expect(
        attackReplyId && gateReplyId,
        'the victim’s own replies were never persisted — nothing was tested'
      ).toBeTruthy();

      // B must have SEEN A's replies before the send-gate arm, or that gate
      // would refuse for the wrong reason (an empty local thread reads as
      // "only my own replies", which is permitted).
      const bSawReplies = await until(
        async () =>
          postIdByText(b, attackReplyText) && postIdByText(b, gateReplyText)
            ? true
            : undefined
      );
      expect(
        bSawReplies,
        'the attacker never received the victim’s replies — the send-gate arm ' +
          'would be refused for the wrong reason'
      ).toBeTruthy();
      // Polled, not sampled once: this one crosses the wire (B → A), unlike A's
      // own replies above, which A saved locally on send and has immediately.
      const controlReplyId = await until(async () =>
        postIdByText(a, controlReplyText)
      );
      expect(
        controlReplyId,
        'the victim never received the attacker’s reply — the control arm has ' +
          'nothing to prove was deleted'
      ).toBeTruthy();
      say('replies in place: victim x2 (attack, gate), attacker x1 (control)');

      // ── ARM 1 — ATTACK: raw-sealed remove, bypassing B's own send gate ───
      // No field in this frame lies. B really is the verified sender and really
      // is the thread's creator. It is illegitimate only because the thread
      // holds a reply B did not write — which is exactly the condition the
      // receiver must now check for itself.
      await b.forgeSend(
        spaceId,
        await sealThreadFrame({
          spaceId,
          channelId,
          signing: signing!,
          thread: removeFrame(b, attackRootId, attackThreadId),
        })
      );
      say('ARM 1: raw-sealed remove sent (modified client)');

      // ── ARM 2 — SEND GATE: the same request through the real send path ───
      //
      // The send gate reads the SENDER's own thread index, so what B has
      // indexed under this thread is the input that decides the arm. Reported
      // rather than asserted: a mismatch between the two sides here is the
      // first thing to look at if this arm behaves oddly, and it is invisible
      // from the outcome alone.
      const gateRepliesOnSender = await b.messageDB.getThreadMessages({
        spaceId,
        channelId,
        threadId: gateThreadId,
      });
      const gateRepliesOnVictim = await a.messageDB.getThreadMessages({
        spaceId,
        channelId,
        threadId: gateThreadId,
      });
      say(
        `gate thread index: sender sees ${gateRepliesOnSender.messages.length} replies ` +
          `(authors ${gateRepliesOnSender.messages.map((m) => m.content?.senderId?.slice(0, 6)).join(',') || 'none'}), ` +
          `victim sees ${gateRepliesOnVictim.messages.length}`
      );

      await b.sendControl(
        spaceId,
        channelId,
        removeFrame(b, gateRootId, gateThreadId)
      );
      say('ARM 2: remove submitted through the honest send path');

      // The send gate's other half is MEASURED here and asserted at the end
      // with everything else. Read here because this is the moment it is
      // about — the local cleanup (`handleThreadSendPostBroadcast`) runs inline
      // with the send or not at all. Twenty seconds later the same read is
      // noisy for reasons unrelated to the gate (see the end-of-run control).
      // Asserted later so a pre-fix run fails on the SECURITY property first
      // rather than short-circuiting here, which would hide it.
      const senderKeptThreadAfterRefusedSend = !!(
        await b.getMessage(spaceId, channelId, gateRootId)
      )?.threadMeta;
      say(
        `ARM 2: sender kept the thread after its own gate refused = ${senderKeptThreadAfterRefusedSend}`
      );

      // ── ARM 3 — CONTROL: an honest, permitted remove ─────────────────────
      await b.sendControl(
        spaceId,
        channelId,
        removeFrame(b, controlRootId, controlThreadId)
      );
      say('ARM 3: honest remove of a thread holding only the sender’s replies');

      // The control arm is the one with a positive outcome to wait for, so it
      // doubles as the settle signal: once A has applied it, A has had at least
      // as long to apply the two frames sent before it.
      await until(async () => {
        const ctl = await a.getMessage(spaceId, channelId, controlRootId);
        return ctl && !ctl.threadMeta ? true : undefined;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ───────────────────────────────────────────────────────────
      const attackReplyAfter = await a.getMessage(
        spaceId,
        channelId,
        attackReplyId!
      );
      const gateReplyAfter = await a.getMessage(
        spaceId,
        channelId,
        gateReplyId!
      );
      const controlReplyAfter = await a.getMessage(
        spaceId,
        channelId,
        controlReplyId!
      );
      const controlRootAfter = await a.getMessage(
        spaceId,
        channelId,
        controlRootId
      );
      // Reported, not asserted — and paired, which is the point. The ATTACK
      // root is the control: no remove was ever applied to it on EITHER device,
      // so if both of these read the same way the late change is ambient sync
      // behaviour (backlog re-delivery re-saving a root as it was first posted,
      // before it had any threadMeta) and not this gate. If they DIVERGE, that
      // is worth chasing. The gate itself is asserted inline, at the moment it
      // acts. MEASURED 2026-08-21: both read false at this point.
      const gateRootOnSenderLater = await b.getMessage(
        spaceId,
        channelId,
        gateRootId
      );
      const attackRootOnSenderLater = await b.getMessage(
        spaceId,
        channelId,
        attackRootId
      );

      say('');
      say('==== RESULT ====');
      say(`ARM 1 attack  reply on victim: ${attackReplyAfter ? 'ALIVE' : 'DELETED'}`);
      say(`ARM 2 gate    reply on victim: ${gateReplyAfter ? 'ALIVE' : 'DELETED'}`);
      say(
        `late on SENDER (ambient, not asserted): gate threadMeta=${!!gateRootOnSenderLater?.threadMeta} ` +
          `attack threadMeta=${!!attackRootOnSenderLater?.threadMeta} — these two should MATCH`
      );
      say(`ARM 3 control reply on victim: ${controlReplyAfter ? 'ALIVE' : 'DELETED'}`);
      say(
        `ARM 3 control root  on victim: ${controlRootAfter ? 'ALIVE' : 'DELETED'}  threadMeta=${!!controlRootAfter?.threadMeta}`
      );
      say(
        `receive failures: NOVEL victim=${a.novelErrors().length} attacker=${b.novelErrors().length}`
      );
      for (const e of a.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── CONTROL ARM assertions — the feature still works ────────────────
      //
      // These run FIRST deliberately. If thread removal is broken, or nothing
      // arrived, this is the arm that says so, and it says so before either
      // security assertion can pass for the wrong reason.
      expect(
        controlRootAfter,
        'CONTROL: an honest remove hard-deleted a root the remover did not write — ' +
          'thread removal is over-reaching'
      ).toBeTruthy();
      expect(
        controlRootAfter?.threadMeta,
        'CONTROL: the honest remove was never applied, so this run proves nothing ' +
          'about the refused ones — thread removal may be broken outright'
      ).toBeFalsy();
      expect(
        controlReplyAfter,
        'CONTROL: a permitted remove left its own replies behind — removal is ' +
          'now too narrow, and the security arms below prove nothing'
      ).toBeFalsy();

      // ── ARM 1 — the security property ───────────────────────────────────
      expect(
        attackReplyAfter,
        'ATTACK: a member who opened a thread on the victim’s post DESTROYED the ' +
          'victim’s reply inside it, from a client that simply sent the frame'
      ).toBeTruthy();

      // ── ARM 2 — sender and receiver reach the same answer ────────────────
      expect(
        gateReplyAfter,
        'SEND GATE: a remove reached the victim through the honest send path and ' +
          'destroyed the victim’s reply'
      ).toBeTruthy();
      expect(
        senderKeptThreadAfterRefusedSend,
        'SEND GATE: the sender applied the removal locally even though its own ' +
          'gate refused to broadcast it — this client alone now believes the ' +
          'thread is gone, and nobody else will ever tell it otherwise'
      ).toBe(true);

      say('PASS — thread removal stopped where other members’ replies began');
    } finally {
      a.stop();
      b.stop();
    }
  },
  20 * 60 * 1000
);
