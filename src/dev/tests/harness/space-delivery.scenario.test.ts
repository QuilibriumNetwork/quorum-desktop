// NETWORKED. Every space content type must still reach the receiver's message
// store, unharmed, after any change to the receive path.
//
//   yarn harness space-delivery
//
// Extracted from `space-message-id-derivation`, which proved this same set of
// content types survives its id-derivation gate but bundled the check inside
// an attack/control/positive-control run. This file keeps only the DELIVERY
// half, so "did this change drop a feature?" can be asked directly, without
// also running an attack: one honest frame per content type, sent the real
// way through `submitChannelMessage` / `sendControl`, and asserted on the bot
// that did NOT send it — a pass means the frame crossed the wire and was
// applied, not that the sender saved its own local copy.
//
// Two traps were MEASURED building the parent scenario and apply here
// unchanged. Both are documented in full, verbatim, where they are enforced
// (the batch-1 comment below, and `forceDelivery`'s own comment) — repeated
// here because they are the first thing to re-read before touching batching:
//
//   1. Batch size. The receiver processes a delivered batch CONCURRENTLY, so
//      writes to the message store race and some are silently lost: six
//      frames per batch passed, seven lost the embed and the sticker — with
//      zero receive errors to explain it. That loss is indistinguishable
//      from a content type failing to survive the receive path, which is the
//      exact thing this file exists to measure. Six frames per batch, at most.
//   2. Sending just after a reconnect. `reconnect()` resolves once the socket
//      has been asked to open, but the closing socket's own handler schedules
//      a second `open()` a second later, so a send issued in that window can
//      land on a socket in readyState CONNECTING while `connected` reads
//      `true`. The outbound queue records it in `failures` and RESOLVES
//      ANYWAY — the sender believes it sent. MEASURED: two frames of a
//      six-frame batch vanished exactly this way.
//
// `pin` is sent but deliberately NOT asserted, and that is a harness
// limitation rather than an oversight — do not "fix" it into a failing arm.
// Its send branch requires an explicit role holding `message:pin` with no
// owner bypass (`MessageService.submitChannelMessage`, the pin branch), so a
// freshly created space's owner cannot produce one: MEASURED, the frame
// appeared in neither bot's accepted list, including the sender's own local
// copy, because it was never put on the wire. Giving it a real arm means
// creating a role and broadcasting a manifest first.
//
// PRODUCTION relay, throwaway accounts. See identity.ts.
//
// FALSIFIED 2026-08-23: dropping `sticker` before `saveMessage` in the space
// receive dispatch (handleNewMessage's non-DM branch) turns this red — sticker
// is cleanly absent from the victim's accepted types, 0 outbound failures, 0
// novel errors. It surfaces as batch1's `timedOut` failure, not the per-type
// one, since settleFor ANDs sticker with 5 other items in that batch. Task 8's
// fix round separately falsified `post` via a bogus message id — a different
// assertion, different proof. Unfalsified = not evidence.
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

/**
 * Force the relay to re-push everything queued for this bot.
 *
 * ⚠️ The wait at the end is not politeness. `reconnect` resolves once the socket
 * has been asked to open, and a send issued in the window after that lands on a
 * socket in readyState CONNECTING: the outbound queue records it in `failures`
 * and RESOLVES ANYWAY, so `sendControl` returns as though the frame went out.
 * MEASURED — two frames of a six-frame batch vanished exactly this way, and the
 * symptom at the far end (a content type missing from the receiver, with zero
 * receive errors and zero gate refusals) is indistinguishable from the id gate
 * dropping that type, which is the conclusion this scenario exists to support.
 */
async function forceDelivery(bot: HarnessSpaceBot): Promise<void> {
  bot.disconnect();
  await bot.reconnect();
  await until(async () => (bot.transport.connected ? true : undefined), 30_000);
  // A reconnect churns through TWO sockets, and `connected` cannot see it. The
  // closing socket's own handler schedules another `open()` a second later
  // (`transport.ts`, the 'close' listener) — by then `reopen()` has already
  // cleared the `closed` flag, so that stray open runs, replaces `this.ws`, and
  // leaves the transport pointing at a socket in readyState CONNECTING while
  // `connected` is still true from the first one. Sleeping past the churn is
  // the cheap fix; the alternative is changing the transport, which every other
  // scenario shares.
  await sleep(3000);
  await until(async () => (bot.transport.connected ? true : undefined), 30_000);
}

test(
  'space-delivery: every space content type survives the receive path',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-delivery', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[space-delivery] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [v, x] = await Promise.all([
      createSpaceBot(`delivery-victim-${stamp}`),
      createSpaceBot(`delivery-sender-${stamp}`),
    ]);
    await Promise.all([v.start(), x.start()]);

    // Declared before the try so the finally can always restore what it patched,
    // even if setup throws. The save seams are per-bot and outlive the bots.
    const restoreSaves: (() => void)[] = [];
    /** Waits that expired rather than resolving — a silent timeout reads as a
     *  delivery bug at the assertion, so name them at the point they happen. */
    const timedOut: string[] = [];
    /**
     * Push, wait, and push AGAIN if it did not land.
     *
     * One `disconnect`/`reconnect` is not enough on its own. The relay only
     * pushes a retained frame in response to a `listen`, and a frame that was
     * pushed but not processed stays un-acked and is re-pushed on the NEXT
     * listen — so a round that comes up short is worth repeating, whereas a
     * single long wait just sits there with nothing arriving. MEASURED: batches
     * of six and of seven both lost a frame on a single push, with zero receive
     * errors and zero gate refusals, which reads exactly like the gate dropping
     * a content type and is not.
     */
    const settleFor = async (
      label: string,
      receivers: HarnessSpaceBot[],
      check: () => Promise<boolean>,
      rounds = 5
    ): Promise<void> => {
      for (let round = 1; round <= rounds; round++) {
        for (const r of receivers) await forceDelivery(r);
        const got = await until(
          async () => ((await check()) ? true : undefined),
          45_000
        );
        if (got) return;
        console.log(
          `[space-delivery] ↻ re-pushing for "${label}" (round ${round}/${rounds})`
        );
      }
      timedOut.push(label);
      console.log(`[space-delivery] ⏱ wait timed out: ${label}`);
    };

    try {
      say(
        `victim=${v.identity.address.slice(0, 12)} sender=${x.identity.address.slice(0, 12)}`
      );

      // ── Setup: the victim owns the space, the sender is an ordinary member.
      const s = await v.createSpace(`delivery-S-${stamp}`);
      say(`space=${s.spaceId.slice(0, 12)} channel=${s.channelId.slice(0, 12)}`);
      const link = await v.inviteLink(s.spaceId);
      const joined = await x.join(link);
      expect(joined.spaceId).toBe(s.spaceId);
      say('sender joined as an ordinary member (no role)');

      // DELIVERY instrument. Every frame that reaches the receive path ends up
      // at `MessageService.saveMessage`; a frame that never arrives does not.
      // So this list IS the set of frames the receiver accepted, which is what
      // the delivery-preservation arms have to observe — a control frame
      // (reaction, edit, thread, remove-reaction) mutates its TARGET's row
      // rather than creating one of its own, so its arrival cannot be read off
      // the message store any other way.
      //
      // Instrumented on BOTH bots, and that is load-bearing rather than tidy:
      // `submitChannelMessage` saves the sender's OWN copy through this same
      // method, so asserting a type on the bot that SENT it would pass without
      // the frame ever crossing the wire. Every arm below is therefore asserted
      // on the bot that did not send it. `pin` and `mute` are owner-only on the
      // send path, so those two are sent by the victim and observed on the
      // sender.
      const acceptedBy = new Map<string, { messageId: string; type: string }[]>();
      for (const [name, bot] of [
        ['v', v],
        ['x', x],
      ] as const) {
        const seen: { messageId: string; type: string }[] = [];
        acceptedBy.set(name, seen);
        const svc = bot.graph.messageService as unknown as {
          saveMessage: (m: Message, ...rest: unknown[]) => Promise<void>;
        };
        const orig = svc.saveMessage.bind(svc);
        svc.saveMessage = async (m: Message, ...rest: unknown[]) => {
          seen.push({
            messageId: String(m?.messageId),
            type: String(m?.content?.type),
          });
          return orig(m, ...rest);
        };
        restoreSaves.push(() => {
          svc.saveMessage = orig;
        });
      }
      const typesSeenBy = (who: 'v' | 'x') =>
        new Set((acceptedBy.get(who) ?? []).map((a) => a.type));
      /** Did a SPECIFIC message id show up in `who`'s accepted list? Needed for
       *  `post`, where the type-only check below is a tautology — see its use. */
      const sawMessage = (who: 'v' | 'x', messageId: string) =>
        (acceptedBy.get(who) ?? []).some((a) => a.messageId === messageId);

      // ── The message the honest reply targets ───────────────────────────────
      const M_TEXT = `root-post-${stamp}`;
      await v.post(s.spaceId, s.channelId, M_TEXT);
      const victimRow = await until(async () =>
        (await v.messageDB.getAllSpaceMessages({ spaceId: s.spaceId })).find(
          (m) =>
            m.content?.type === 'post' &&
            (m.content as { text?: string }).text === M_TEXT
        )
      );
      expect(victimRow, 'the victim never stored its own post').toBeTruthy();
      const M = victimRow!.messageId;
      say(`victim message M=${M.slice(0, 12)} text="${M_TEXT}"`);

      // The sender must receive M off the wire before it can address a reply
      // to it, same as any ordinary member replying to someone else's post.
      await forceDelivery(x);
      const seenBySender = await until(async () =>
        (await x.messageDB.getMessage({
          spaceId: s.spaceId,
          channelId: s.channelId,
          messageId: M,
        })) ?? undefined
      );
      expect(
        seenBySender,
        'the sender never received the victim message, so it cannot reply to it'
      ).toBeTruthy();
      say('sender received M off the wire');

      // ── DELIVERY PRESERVATION — one honest frame per content type ─────────
      // Sent the honest way through `submitChannelMessage`, so every id is
      // derived by the real send path and has to be reproduced by the receiver.
      // This is the half that matters most: if the receiver's fingerprint
      // disagrees with the sender's for even one content type, every message of
      // that type is silently dropped — a worse and quieter bug than the one
      // being fixed.
      //
      // ⚠️ SIX FRAMES PER DELIVERED BATCH, AT MOST, and that number is measured
      // rather than chosen. The relay pushes a batch and the receiver processes
      // its frames CONCURRENTLY, so writes to the message store race and some are
      // silently lost: at six this scenario passed, at seven it lost the embed
      // and the sticker — with zero receive errors and zero gate refusals to
      // explain it. That loss is indistinguishable from the gate dropping a
      // content type, which is the exact conclusion this file exists to support.
      //
      // Serialising every arm behind its own reconnect was tried instead and is
      // WORSE: fourteen disconnect/reconnect cycles against the production relay
      // wedged on the first one and the run never progressed past setup. Keep the
      // reconnect count low and the batches small.
      const A_TEXT = `honest-post-A-${stamp}`;
      const B_TEXT = `honest-post-B-${stamp}`;
      const C_TEXT = `honest-post-C-${stamp}`;
      const D_TEXT = `honest-post-D-${stamp}`;
      const REPLY_TEXT = `honest-reply-${stamp}`;
      const EDITED_TEXT = `honest-post-B-EDITED-${stamp}`;

      const victimHasText = async (text: string) =>
        (await v.messageDB.getAllSpaceMessages({ spaceId: s.spaceId })).some(
          (m) =>
            m.content?.type === 'post' &&
            (m.content as { text?: string }).text === text
        );

      // BATCH 1 — the row-creating types. Four separate posts, because each
      // target-mutating arm in batch 2 and batch 3 needs its OWN row: two
      // frames writing one record is the same race the six-frame limit above
      // guards against, one batch lower down. D exists only so batch 2's
      // reaction and batch 3's remove-reaction have a row to mutate that
      // nothing else touches.
      await x.post(s.spaceId, s.channelId, A_TEXT);
      await x.post(s.spaceId, s.channelId, B_TEXT);
      await x.post(s.spaceId, s.channelId, C_TEXT);
      await x.post(s.spaceId, s.channelId, D_TEXT);
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'embed',
        senderId: x.identity.address,
        imageUrl: `https://example.invalid/${stamp}.png`,
        width: 100,
        height: 100,
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'sticker',
        senderId: x.identity.address,
        stickerId: `sticker-${stamp}`,
      });
      say('sent batch 1: [post A, post B, post C, post D, embed, sticker] (6)');

      await settleFor(
        'batch1 posts+embed+sticker at victim',
        [v],
        async () =>
          (await victimHasText(A_TEXT)) &&
          (await victimHasText(B_TEXT)) &&
          (await victimHasText(C_TEXT)) &&
          (await victimHasText(D_TEXT)) &&
          typesSeenBy('v').has('embed') &&
          typesSeenBy('v').has('sticker')
      );
      await sleep(SETTLE_MS);

      // The sender's own copies name the ids its honest send path derived.
      const findByText = async (text: string) =>
        (await x.messageDB.getAllSpaceMessages({ spaceId: s.spaceId })).find(
          (m) =>
            m.content?.type === 'post' &&
            (m.content as { text?: string }).text === text
        );
      const rowA = await findByText(A_TEXT);
      const rowB = await findByText(B_TEXT);
      const rowC = await findByText(C_TEXT);
      const rowD = await findByText(D_TEXT);
      expect(
        rowA && rowB && rowC && rowD,
        'the sender did not store its own posts'
      ).toBeTruthy();

      // BATCH 2 — the target-mutating types, each on a DIFFERENT row, plus the
      // reply (which needs M, resolved above) and D's reaction (set up here for
      // batch 3's remove-reaction — see the comment on that send below).
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'reaction',
        senderId: x.identity.address,
        messageId: rowA!.messageId,
        reaction: '👍',
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'post',
        senderId: x.identity.address,
        text: REPLY_TEXT,
        repliesToMessageId: M,
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'edit-message',
        senderId: x.identity.address,
        originalMessageId: rowB!.messageId,
        editedText: EDITED_TEXT,
        editNonce: crypto.randomUUID(),
        editedAt: Date.now(),
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'thread',
        senderId: x.identity.address,
        action: 'create',
        targetMessageId: rowC!.messageId,
        threadMeta: {
          threadId: await threadIdFor(rowC!.messageId),
          title: `thread-${stamp}`,
          createdBy: x.identity.address,
          createdAt: Date.now(),
        },
      });
      // `remove-reaction` needs a reaction to remove, so it targets D, which
      // receives one here. Split across batches on purpose: the two frames
      // write the same row, and two writes to one record inside a single
      // delivered batch is the concurrency race the file header warns about.
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'reaction',
        senderId: x.identity.address,
        messageId: rowD!.messageId,
        reaction: '🎉',
      });
      say('sent batch 2: [reaction→A, reply, edit→B, thread create→C, reaction→D] (5)');

      await settleFor(
        'batch2 reaction+reply+edit+thread+reaction at victim',
        [v],
        async () =>
          (await victimHasText(REPLY_TEXT)) &&
          typesSeenBy('v').has('reaction') &&
          typesSeenBy('v').has('edit-message') &&
          typesSeenBy('v').has('thread')
      );
      await sleep(SETTLE_MS);

      const rowReply = await findByText(REPLY_TEXT);
      expect(rowReply, 'the sender did not store its own reply').toBeTruthy();

      // BATCH 3 — record-scoped honest frames, one arm per content type that
      // doesn't fit batches 1-2. `remove-message` deletes the reply row from
      // batch 2, `update-profile` writes a member row, `mute` has no handler so
      // it lands as a row of its own, and `remove-reaction` clears the reaction
      // D received in batch 2.
      //
      // `mute` is sent by the VICTIM (the space owner) and therefore observed on
      // the SENDER. Asserting it on the bot that sent the other frames here
      // would pass without the mute frame ever crossing the wire, since the
      // send path saves the sender's own copy through the very method
      // instrumented above.
      //
      // `pin` is sent but NOT asserted — see the file header for why.
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'remove-message',
        senderId: x.identity.address,
        removeMessageId: rowReply!.messageId,
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'update-profile',
        senderId: x.identity.address,
        displayName: `sender-${stamp}`,
        userIcon: '',
      });
      await v.sendControl(s.spaceId, s.channelId, {
        type: 'pin',
        senderId: v.identity.address,
        targetMessageId: rowA!.messageId,
        action: 'pin',
      });
      await v.sendControl(s.spaceId, s.channelId, {
        type: 'mute',
        senderId: v.identity.address,
        // Nobody's address, so honouring or refusing it changes nothing else.
        targetUserId: `QmMutedNobody${stamp}`,
        muteId: `mute-${stamp}`,
        timestamp: Date.now(),
        action: 'mute',
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'remove-reaction',
        senderId: x.identity.address,
        messageId: rowD!.messageId,
        reaction: '🎉',
      });
      say(
        'sent batch 3: [remove→reply, update-profile (x); pin→A, mute (v); remove-reaction→D (x)] (5)'
      );

      await settleFor(
        'batch3 record-scoped types',
        [v, x],
        async () =>
          typesSeenBy('v').has('remove-message') &&
          typesSeenBy('v').has('update-profile') &&
          typesSeenBy('v').has('remove-reaction') &&
          typesSeenBy('x').has('mute')
      );
      await sleep(SETTLE_MS);

      // ── RESULT ────────────────────────────────────────────────────────────
      say('');
      say('==== RESULT ====');
      say(`DELIVERY  types accepted by victim   : ${[...typesSeenBy('v')].join(', ')}`);
      say(`DELIVERY  types accepted by sender   : ${[...typesSeenBy('x')].join(', ')}`);
      say(`DIAG      phases that timed out       : ${timedOut.join(', ') || 'none'}`);
      // A frame that never left the sender looks identical, at the receiver, to
      // one the receive path dropped. This separates them at the source.
      say(
        `DIAG      outbound failures v / x     : ${v.graph.outbound.failures.length} / ${x.graph.outbound.failures.length}`
      );
      for (const f of [...v.graph.outbound.failures, ...x.graph.outbound.failures].slice(0, 5)) {
        say(`   ! outbound: ${f.error}`);
      }
      say(
        `receive failures: NOVEL victim=${v.novelErrors().length} sender=${x.novelErrors().length}`
      );
      for (const e of v.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── no novel receive errors ───────────────────────────────────────────
      // Asserted first: a frame rejected before the handler ever ran would
      // otherwise just read as a missing content type below, blaming the
      // receive path for a receive-side error instead.
      expect(
        v.novelErrors().length,
        'the victim raised a novel receive error — a frame may have been ' +
          'rejected before the handler ran, which would show up below as a ' +
          'missing content type for a reason unrelated to delivery'
      ).toBe(0);

      // ── A FRAME THAT NEVER LEFT IS NOT A FRAME THE RECEIVER DROPPED ───────
      // Second, because it is the most upstream cause and the one that has
      // already been mistaken for the others. The outbound queue records a
      // send onto a not-yet-open socket in `failures` and resolves anyway, so
      // the sender believes it sent.
      expect(
        [...v.graph.outbound.failures, ...x.graph.outbound.failures].map(
          (f) => f.error
        ),
        'DELIVERY: an outbound send failed, so anything missing at the receiver ' +
          'never left the sender and says nothing about the receive path'
      ).toEqual([]);

      // ── DELIVERY DIAGNOSIS BEFORE DELIVERY VERDICT ───────────────────────
      // Asserted before the per-type checks below on purpose. A wait that
      // expired and a content type the receive path genuinely dropped produce
      // the SAME symptom — a type missing from the accepted list — and the
      // per-type message below would blame the receive path either way.
      //
      // MEASURED 2026-08-23 (Task 9): do NOT read a clean-counters timeout as
      // "the relay, not the code under test" — that claim was falsified. A
      // permanent single-type drop inside `handleNewMessage` (a real receive-
      // path bug) presents IDENTICALLY to relay/batch loss under this check:
      // outbound failures 0/0, novel errors 0, and this still times out. The
      // message below only claims what the counters actually show, and points
      // at the accepted-types diagnostic instead of guessing "it's the relay".
      const cleanCounters =
        v.graph.outbound.failures.length === 0 &&
        x.graph.outbound.failures.length === 0 &&
        v.novelErrors().length === 0;
      expect(
        timedOut,
        cleanCounters
          ? 'DELIVERY: a wait expired with clean outbound sends and no novel ' +
              'receive errors. This does NOT mean "not the receive path" — a ' +
              'permanent drop of any batch item presents identically to relay/' +
              'batch loss under this check (MEASURED 2026-08-23, Task 9). Check ' +
              'the accepted-types diagnostic above for which type(s) are missing ' +
              'before assuming this is the relay.'
          : 'DELIVERY: a wait expired, so the per-type results below are about ' +
              'frames that never arrived rather than frames the receive path dropped.'
      ).toEqual([]);

      // `post` cannot use the generic `typesSeenBy(...).has(type)` check below.
      // The victim's own M send (needed earlier so the reply has something to
      // point at) already puts 'post' in `v`'s accepted-types set before `x`
      // ever sends anything — so a receive path that silently stopped
      // accepting posts FROM OTHER MEMBERS would still read that line as true,
      // and its failure message could never fire. Assert on a specific
      // x-authored post's id instead: this can only be true if that exact
      // frame crossed the wire and was saved by `v`.
      expect(
        sawMessage('v', rowA!.messageId),
        "DELIVERY: x's honest 'post' A did not survive the receive path — " +
          'a post from another member would now be dropped on arrival'
      ).toBe(true);

      // ── DELIVERY PRESERVATION — every other honest type survived the
      //    receive path ──────────────────────────────────────────────────
      // Each type is asserted on the bot that did NOT send it, so a pass means
      // the frame crossed the wire and was applied, rather than being read off
      // the sender's own local copy.
      for (const [who, type] of [
        ['v', 'embed'],
        ['v', 'sticker'],
        ['v', 'reaction'],
        ['v', 'edit-message'],
        ['v', 'thread'],
        ['v', 'remove-message'],
        ['v', 'update-profile'],
        ['v', 'remove-reaction'],
        ['x', 'mute'],
      ] as const) {
        expect(
          typesSeenBy(who).has(type),
          `DELIVERY: an honest '${type}' frame did not survive the receive path ` +
            `— every message of this type would now be dropped on arrival`
        ).toBe(true);
      }

      say('PASS — every space content type survived the receive path');
    } finally {
      for (const restore of restoreSaves) restore();
      v.stop();
      x.stop();
    }
  },
  30 * 60 * 1000
);

/** The thread id the app derives from a root message — see threadFrames.ts. */
async function threadIdFor(messageId: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(messageId + ':thread')
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
