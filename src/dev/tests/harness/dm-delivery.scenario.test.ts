// NETWORKED. Every DM content type must still reach the receiver's message
// store, unharmed, after any change to the DM receive path.
//
//   yarn harness dm-delivery
//
// The audit that produced this file (regression-coverage-map.md) found the
// biggest measured gap in the whole DM/space coverage sweep: no DM scenario
// asserted anything beyond plain text. `dm-basic` proves text round-trips;
// this proves the other eight content types do too, sent the real way
// through `send` / `sendControl` and asserted on the bot that did NOT send
// them — a pass means the frame crossed the wire and was applied, not that
// the sender saved its own local copy. Modelled on `space-delivery`
// (Task 8/9), but the DM bot's shape forced three departures from it:
//
//   1. NO `sendControl` existed before this file. `HarnessBot` only had
//      `send(toAddress, text)`. Added to `bot.ts` alongside `send`, reusing
//      its registration/passkey setup — `MessageService.submitMessage`
//      already accepts `pendingMessage: string | object`, so this needed no
//      new service code.
//   2. NO `graph.outbound.failures` diagnostic exists for DM. `deps.ts` runs
//      each enqueued action immediately (`void (async () => …)()`); the
//      serialized FIFO in `outbound.ts` is a SPACE-only concept (see the
//      harness README, point 4). So the assertion order here is novel
//      receive errors → timeouts → per-type, with no outbound arm — a DM
//      send that lands on a not-yet-open socket has no separate "recorded
//      but resolved anyway" failure list to consult.
//   3. `dm-update-profile` is not "target-mutating" in the sense the other
//      four types are — on the RECEIVE path it never reaches
//      `MessageService.saveMessage` AT ALL. `interceptControlMessages`
//      (MessageService.ts, the `parseDmProfileUpdate` branch) consumes it
//      before the generic save path and calls `handleDMProfileUpdate`, which
//      upserts the CONVERSATION row (`messageDB.saveConversation`) — never a
//      message row, receipt-ack- and typing-signal-style. Instrumenting
//      `saveMessage` for this type on the receiver would be a permanent
//      false negative regardless of whether the frame actually arrived.
//      Asserted separately below by reading the receiver's stored
//      conversation `displayName` after the push. This is receive-side
//      only, though: on the SEND side `submitMessage` classifies it
//      `isPostMessage = true` (it matches none of edit-message /
//      delete-conversation / reaction / remove-message, so it falls into the
//      same catch-all bucket as a real post), and the sender's own local
//      echo DOES reach `saveMessage` through that path — confirmed by this
//      file's own run log, which lists `dm-update-profile` under
//      `typesSeenBy('s')`. Only `typesSeenBy('r')` structurally never will.
//
// `reaction` / `remove-reaction` / `edit-message` / `remove-message` ARE
// target-mutating exactly as space-delivery's header describes: at the DB
// layer (`messageDB.saveMessage`) the object persisted is `{...target, …}`
// with `content.type` unchanged from the target's own type (typically
// 'post'), so the original frame's type is only visible one layer up, at
// `MessageService.saveMessage`, which receives the frame itself
// (`decryptedContent`) as its first argument before any mutation happens.
// Instrumented on both bots below, same seam as space-delivery.
//
// DM's WsTransport dispatches inbound frames through one serialized chain
// (`transport.ts`, `dispatch()`), unlike the concurrent handling that made
// space-delivery need `forceDelivery`'s disconnect/reconnect dance — no
// other `dm-*.scenario.test.ts` file uses it, and this one doesn't either.
// The six-frames-per-batch cap is kept anyway, per the task brief, as a
// conservative match to the measured space limit rather than a DM-specific
// re-measurement.
//
// FALSIFIED 2026-08-23: commenting out the `handleDMProfileUpdate` call
// inside `interceptControlMessages`'s dm-update-profile branch
// (MessageService.ts) — so the frame is still recognized and consumed (the
// anti-spoofing senderId check still runs) but never applied — turns this
// red. The receiver's conversation `displayName` never becomes the marker,
// so `settleFor('batch3 dm-update-profile applied at receiver', ...)` times
// out; `timedOut` holds exactly that one label, with 0 novel receive errors
// and no other batch/type affected. It surfaces via the blanket
// `expect(timedOut).toEqual([])` check, not the deeper per-type assert below
// it — that assert is structurally unreachable for ANY type in this file,
// since `timedOut` accumulates labels from every batch's `settleFor` calls
// and is asserted once, before all per-type checks. Task 9 found the same
// shape on the space arm, but there it was explained by a 6-item AND inside
// one batch; here it holds even for batch 3's un-ANDed, individually
// labelled checks, so it isn't a batch-size effect — it's the assertion
// order itself. Restored and reran GREEN. Unfalsified = not evidence.
//
// PRODUCTION relay, throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import { type Message } from '@quilibrium/quorum-shared';
import { createBot } from './bot';
import { RunLog } from './log';

const WINDOW_MS = Number(process.env.HARNESS_DM_DELIVERY_WINDOW_MS ?? 45_000);
const SAMPLE_MS = Number(process.env.HARNESS_DM_DELIVERY_SAMPLE_MS ?? 1500);
const SETTLE_MS = Number(process.env.HARNESS_SETTLE_MS ?? 3000);

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

test(
  'dm-delivery: every DM content type survives the receive path',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('dm-delivery', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[dm-delivery] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [receiver, sender] = await Promise.all([
      createBot(`delivery-receiver-${stamp}`),
      createBot(`delivery-sender-${stamp}`),
    ]);
    await Promise.all([receiver.start(), sender.start()]);

    // Declared before the try so the finally can always restore what it
    // patched, even if setup throws.
    const restoreSaves: (() => void)[] = [];
    /** Waits that expired rather than resolving — a silent timeout reads as a
     *  delivery bug at the assertion, so name them at the point they happen. */
    const timedOut: string[] = [];

    const settleFor = async (
      label: string,
      check: () => Promise<boolean>
    ): Promise<void> => {
      const got = await until(async () => ((await check()) ? true : undefined));
      if (!got) {
        timedOut.push(label);
        console.log(`[dm-delivery] ⏱ wait timed out: ${label}`);
      }
    };

    try {
      say(
        `receiver=${receiver.identity.address.slice(0, 12)} sender=${sender.identity.address.slice(0, 12)}`
      );

      // DELIVERY instrument: `MessageService.saveMessage`, not
      // `messageDB.saveMessage` — see the file header, point 3. Every content
      // type that isn't `dm-update-profile` reaches this method with its
      // ORIGINAL frame as the first argument, before reaction/edit/remove
      // mutate a target row. Instrumented on BOTH bots: `submitMessage`
      // saves the sender's own copy through this same method, so asserting a
      // type on the bot that SENT it would pass without the frame ever
      // crossing the wire.
      const acceptedBy = new Map<
        string,
        { messageId: string; type: string; text?: string }[]
      >();
      for (const [name, bot] of [
        ['r', receiver],
        ['s', sender],
      ] as const) {
        const seen: { messageId: string; type: string; text?: string }[] = [];
        acceptedBy.set(name, seen);
        const svc = bot.messageService as unknown as {
          saveMessage: (m: Message, ...rest: unknown[]) => Promise<void>;
        };
        const orig = svc.saveMessage.bind(svc);
        svc.saveMessage = async (m: Message, ...rest: unknown[]) => {
          seen.push({
            messageId: String(m?.messageId),
            type: String(m?.content?.type),
            text:
              m?.content?.type === 'post'
                ? String((m.content as { text?: string }).text ?? '')
                : undefined,
          });
          return orig(m, ...rest);
        };
        restoreSaves.push(() => {
          svc.saveMessage = orig;
        });
      }
      const typesSeenBy = (who: 'r' | 's') =>
        new Set((acceptedBy.get(who) ?? []).map((a) => a.type));
      /** Did a SPECIFIC message id show up in `who`'s accepted list? Needed
       *  for `post` — see its use below. */
      const sawMessage = (who: 'r' | 's', messageId: string) =>
        (acceptedBy.get(who) ?? []).some((a) => a.messageId === messageId);
      const sawText = (who: 'r' | 's', text: string) =>
        (acceptedBy.get(who) ?? []).some(
          (a) => a.type === 'post' && a.text === text
        );

      // DM conversation/message rows are keyed by the PARTNER's address on
      // both sides (see MessageService.ts, `conversationId = address + '/' +
      // address`), so from the receiver's perspective every row the sender
      // authored lives under `sender.identity.address`.
      const partnerId = sender.identity.address;
      const getAtReceiver = (messageId: string) =>
        receiver.messageDB.getMessage({
          spaceId: partnerId,
          channelId: partnerId,
          messageId,
        });
      const conversationDisplayNameAtReceiver = async () => {
        const res = await receiver.messageDB.getConversation({
          conversationId: `${partnerId}/${partnerId}`,
        });
        return res?.conversation?.displayName;
      };

      // ── BATCH 1 — the row-creating types (6 frames, the measured cap). ───
      // Four separate posts because batch 2's reaction, edit-message and
      // remove-message each need their OWN row: two frames mutating one
      // record within a delivered batch is the concurrency race the space
      // arm measured (six frames passed, seven lost two content types with
      // zero receive errors to explain it). D exists only so batch 2's
      // reaction (setup) and batch 3's remove-reaction have a row to mutate
      // that nothing else touches.
      const A_TEXT = `honest-post-A-${stamp}`;
      const B_TEXT = `honest-post-B-${stamp}`;
      const C_TEXT = `honest-post-C-${stamp}`;
      const D_TEXT = `honest-post-D-${stamp}`;
      const EDITED_TEXT = `honest-post-B-EDITED-${stamp}`;
      const PROFILE_MARKER = `dm-profile-${stamp}`;

      await sender.send(receiver.identity.address, A_TEXT);
      await sender.send(receiver.identity.address, B_TEXT);
      await sender.send(receiver.identity.address, C_TEXT);
      await sender.send(receiver.identity.address, D_TEXT);
      await sender.sendControl(receiver.identity.address, {
        type: 'embed',
        senderId: sender.identity.address,
        imageUrl: `https://example.invalid/${stamp}.png`,
        width: '100',
        height: '100',
      });
      await sender.sendControl(receiver.identity.address, {
        type: 'sticker',
        senderId: sender.identity.address,
        stickerId: `sticker-${stamp}`,
      });
      say('sent batch 1: [post A, post B, post C, post D, embed, sticker] (6)');

      await settleFor(
        'batch1 posts+embed+sticker at receiver',
        async () =>
          sawText('r', A_TEXT) &&
          sawText('r', B_TEXT) &&
          sawText('r', C_TEXT) &&
          sawText('r', D_TEXT) &&
          typesSeenBy('r').has('embed') &&
          typesSeenBy('r').has('sticker')
      );
      await sleep(SETTLE_MS);

      // The sender's own copies name the ids its honest send path derived —
      // needed so batch 2's control frames can target them by messageId.
      const findSent = (text: string) =>
        (acceptedBy.get('s') ?? []).find(
          (a) => a.type === 'post' && a.text === text
        );
      const rowA = findSent(A_TEXT);
      const rowB = findSent(B_TEXT);
      const rowC = findSent(C_TEXT);
      const rowD = findSent(D_TEXT);
      expect(
        rowA && rowB && rowC && rowD,
        'the sender did not store its own posts'
      ).toBeTruthy();

      // ── BATCH 2 — the target-mutating types, each on a DIFFERENT row (4
      //    frames), plus D's reaction (set up here for batch 3's
      //    remove-reaction — split across batches on purpose, same reason as
      //    the four separate rows above: one row, two writes, one batch is
      //    the race). ───────────────────────────────────────────────────────
      await sender.sendControl(receiver.identity.address, {
        type: 'reaction',
        senderId: sender.identity.address,
        messageId: rowA!.messageId,
        reaction: '👍',
      });
      await sender.sendControl(receiver.identity.address, {
        type: 'edit-message',
        senderId: sender.identity.address,
        originalMessageId: rowB!.messageId,
        editedText: EDITED_TEXT,
        editNonce: crypto.randomUUID(),
        editedAt: Date.now(),
      });
      await sender.sendControl(receiver.identity.address, {
        type: 'remove-message',
        senderId: sender.identity.address,
        removeMessageId: rowC!.messageId,
      });
      await sender.sendControl(receiver.identity.address, {
        type: 'reaction',
        senderId: sender.identity.address,
        messageId: rowD!.messageId,
        reaction: '🎉',
      });
      say(
        'sent batch 2: [reaction→A, edit-message→B, remove-message→C, reaction→D (setup)] (4)'
      );

      // Each checked by actual applied state, not just "a frame of this type
      // reached the handler" — stronger than a type-presence check and still
      // cheap, since `messageDB.getMessage` is a direct read.
      await settleFor('batch2 reaction→A applied at receiver', async () => {
        const m = await getAtReceiver(rowA!.messageId);
        return !!m?.reactions?.some(
          (r) => r.emojiId === '👍' && r.memberIds?.includes(sender.identity.address)
        );
      });
      await settleFor('batch2 edit-message→B applied at receiver', async () => {
        const m = await getAtReceiver(rowB!.messageId);
        return m?.content?.type === 'post' && (m.content as { text?: string }).text === EDITED_TEXT;
      });
      await settleFor('batch2 remove-message→C applied at receiver', async () => {
        const m = await getAtReceiver(rowC!.messageId);
        // rowC has no threadMeta, so an authorized DM remove hard-deletes it.
        return m === undefined;
      });
      await settleFor('batch2 reaction→D (setup) applied at receiver', async () => {
        const m = await getAtReceiver(rowD!.messageId);
        return !!m?.reactions?.some(
          (r) => r.emojiId === '🎉' && r.memberIds?.includes(sender.identity.address)
        );
      });
      await sleep(SETTLE_MS);

      // ── BATCH 3 — remove-reaction→D (removes what batch 2 just placed)
      //    and dm-update-profile (2 frames). ─────────────────────────────
      await sender.sendControl(receiver.identity.address, {
        type: 'remove-reaction',
        senderId: sender.identity.address,
        messageId: rowD!.messageId,
        reaction: '🎉',
      });
      await sender.sendControl(receiver.identity.address, {
        type: 'dm-update-profile',
        senderId: sender.identity.address,
        displayName: PROFILE_MARKER,
        userIcon: '',
      });
      say('sent batch 3: [remove-reaction→D, dm-update-profile] (2)');

      await settleFor('batch3 remove-reaction→D applied at receiver', async () => {
        const m = await getAtReceiver(rowD!.messageId);
        return !(m?.reactions ?? []).some((r) => r.emojiId === '🎉');
      });
      await settleFor('batch3 dm-update-profile applied at receiver', async () => {
        return (await conversationDisplayNameAtReceiver()) === PROFILE_MARKER;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ────────────────────────────────────────────────────────
      say('');
      say('==== RESULT ====');
      say(`DELIVERY  types accepted by receiver : ${[...typesSeenBy('r')].join(', ')}`);
      say(`DELIVERY  types accepted by sender   : ${[...typesSeenBy('s')].join(', ')}`);
      say(`DIAG      phases that timed out       : ${timedOut.join(', ') || 'none'}`);
      say(`receive failures: NOVEL receiver=${receiver.novelErrors().length} sender=${sender.novelErrors().length}`);
      for (const e of receiver.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── no novel receive errors ─────────────────────────────────────────
      // Asserted first: a frame rejected before the handler ever ran would
      // otherwise just read as a missing content type below, blaming the
      // receive path for a receive-side error instead.
      expect(
        receiver.novelErrors().length,
        'the receiver raised a novel receive error — a frame may have been ' +
          'rejected before the handler ran, which would show up below as a ' +
          'missing content type for a reason unrelated to delivery'
      ).toBe(0);

      // ── NO OUTBOUND ARM ───────────────────────────────────────────────
      // A DM bot has no `graph`, so there is no `outbound.failures` list to
      // consult here — see the file header, point 2. A send onto a
      // not-yet-open socket in this harness either throws (caught by the
      // scenario as a hard failure above) or succeeds; there is no third
      // "recorded as failed but resolved anyway" state to separate out.

      // ── DELIVERY DIAGNOSIS BEFORE DELIVERY VERDICT ───────────────────────
      // Asserted before the per-type checks below on purpose. A wait that
      // expired and a content type the receive path genuinely dropped
      // produce the SAME symptom, and the per-type message below would blame
      // the receive path either way.
      //
      // MEASURED 2026-08-23 (Task 9, space arm): do NOT read a clean-counters
      // timeout as "not the receive path" — a permanent single-type drop
      // inside `handleNewMessage` presents IDENTICALLY to relay/batch loss
      // under this check (zero novel errors, and it still times out). The
      // message below only claims what the counters actually show.
      const cleanCounters = receiver.novelErrors().length === 0;
      expect(
        timedOut,
        cleanCounters
          ? 'DELIVERY: a wait expired with no novel receive errors. This does ' +
              'NOT mean "not the receive path" — a permanent drop of any type ' +
              'presents identically to relay/timing loss under this check ' +
              '(MEASURED 2026-08-23, Task 9). Check the accepted-types ' +
              'diagnostic above before assuming this is the relay.'
          : 'DELIVERY: a wait expired, so the per-type results below are ' +
              'about frames that never arrived rather than frames the ' +
              'receive path dropped.'
      ).toEqual([]);

      // `post` cannot use a generic `typesSeenBy(...).has('post')` check
      // reliably in the general case (the space arm found this a tautology
      // when the asserting bot also sends posts of its own). The receiver
      // here never sends anything, so it would not currently be tautological
      // — but asserting a SPECIFIC message id costs nothing extra and stays
      // correct even if that changes.
      expect(
        sawMessage('r', rowA!.messageId),
        "DELIVERY: sender's honest 'post' A did not survive the receive " +
          'path — a post from a DM partner would now be dropped on arrival'
      ).toBe(true);

      // ── DELIVERY PRESERVATION — every other honest type survived the
      //    receive path ──────────────────────────────────────────────────
      for (const type of ['embed', 'sticker'] as const) {
        expect(
          typesSeenBy('r').has(type),
          `DELIVERY: an honest '${type}' frame did not survive the receive ` +
            `path — every message of this type would now be dropped on arrival`
        ).toBe(true);
      }

      // reaction / edit-message / remove-message / remove-reaction: asserted
      // on APPLIED STATE (set up above via settleFor), not just type
      // presence — stronger, because the applied state can only be true if
      // the mutation this content type performs actually happened.
      const rowAAfter = await getAtReceiver(rowA!.messageId);
      expect(
        rowAAfter?.reactions?.some(
          (r) => r.emojiId === '👍' && r.memberIds?.includes(sender.identity.address)
        ),
        "DELIVERY: an honest 'reaction' frame did not survive the receive " +
          'path — reactions from a DM partner would now be dropped on arrival'
      ).toBe(true);

      const rowBAfter = await getAtReceiver(rowB!.messageId);
      expect(
        rowBAfter?.content?.type === 'post' &&
          (rowBAfter.content as { text?: string }).text === EDITED_TEXT,
        "DELIVERY: an honest 'edit-message' frame did not survive the " +
          'receive path — edits from a DM partner would now be dropped on arrival'
      ).toBe(true);

      const rowCAfter = await getAtReceiver(rowC!.messageId);
      expect(
        rowCAfter,
        "DELIVERY: an honest 'remove-message' frame did not survive the " +
          'receive path — deletes from a DM partner would now be dropped on arrival'
      ).toBeUndefined();

      const rowDAfter = await getAtReceiver(rowD!.messageId);
      expect(
        (rowDAfter?.reactions ?? []).some((r) => r.emojiId === '🎉'),
        "DELIVERY: an honest 'remove-reaction' frame did not survive the " +
          'receive path — reaction removals from a DM partner would now be ' +
          'dropped on arrival'
      ).toBe(false);

      // dm-update-profile: asserted on the receiver's stored CONVERSATION
      // row, not `typesSeenBy` — see the file header, point 3. Only a
      // genuine dm-update-profile frame from the sender could set this exact
      // marker: the harness never populates `passkeyInfo.displayName` on any
      // other send, so no ordinary post can produce this value as a
      // side-effect of `updatedUserProfile`.
      expect(
        await conversationDisplayNameAtReceiver(),
        "DELIVERY: an honest 'dm-update-profile' frame did not survive the " +
          'receive path — profile pushes from a DM partner would now be ' +
          'dropped on arrival'
      ).toBe(PROFILE_MARKER);

      say('PASS — every DM content type survived the receive path');
    } finally {
      for (const restore of restoreSaves) restore();
      receiver.stop();
      sender.stop();
    }
  },
  15 * 60 * 1000
);
