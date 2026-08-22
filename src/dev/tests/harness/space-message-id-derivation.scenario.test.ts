// NETWORKED. A space message may only be stored under the id its content derives.
//
//   yarn harness space-message-id-derivation
//
// The `messages` store is keyed by `messageId` and the durable save is an
// upsert, so the id a frame claims is the row it addresses. A space message's id
// IS a hash of its own content — `SHA-256(buildMessageFingerprint(...))`, what
// both clients compute on every send branch — but the receiver only recomputed
// it for SIGNED frames, inside a guard requiring a signature to be present.
// Declining to sign therefore skipped the check, and an unsigned frame carrying
// somebody else's `messageId` replaced their stored row wholesale.
//
// The forge sends a frame a well-behaved client cannot produce: `submitChannel-
// Message` always derives the id from the content it is about to send, so no
// honest path can claim an id it did not compute. `forgeSend` builds the exact
// bytes and hands them to the REAL sealing call; everything from the wire onward
// is production code and the receiver's path is untouched.
//
//   ATTACK   unsigned post, messageId = the victim's, different text   (PROPERTY: victim's row must not change)
//   CONTROL  unsigned post, same text, messageId correctly DERIVED     (must still arrive — proves the refusal is narrow)
//   DELIVERY one honest frame per content type, each of which must survive the gate
//
// The CONTROL is deliberately NOT the "fresh random messageId" arm the finding
// sketched. Under this rule a random id does not derive either, so that arm
// would be refused for the same reason as the attack and would prove nothing
// about narrowness. A correctly-derived forged frame isolates the one variable.
//
// POSITIVE control is the refusal's own log line, filtered to the attack's id.
// It fires only after unseal + decrypt, so capturing it proves the attack frame
// reached the id check rather than being dropped earlier for some other reason.
// A frame counter could not: every delivered frame is unsealed before it is
// classified.
//
// PRODUCTION relay, throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import {
  buildMessageFingerprint,
  computeMessageIdHex,
  logger,
  type Message,
  type MessageContent,
} from '@quilibrium/quorum-shared';
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

/** The id a space message must carry — the receiver's recipe, computed here. */
function derivedId(
  message: Pick<Message, 'nonce' | 'content'>,
  spaceId: string,
  channelId: string
): string {
  return computeMessageIdHex(
    buildMessageFingerprint({
      nonce: message.nonce,
      content: message.content as Parameters<
        typeof buildMessageFingerprint
      >[0]['content'],
      senderId: message.content.senderId,
      spaceId,
      channelId,
    })
  );
}

/**
 * A space `Message` built by hand, with the id decoupled from the content.
 *
 * `messageId` is passed in rather than derived, which is the whole point: an
 * honest client cannot express this frame because it computes the id from what
 * it is sending. Left unsigned — declining to sign is what disabled the only
 * receive-side id check, so signing it would be testing a different path.
 */
function forgePost(params: {
  spaceId: string;
  channelId: string;
  senderId: string;
  text: string;
  messageId: string;
  nonce: string;
}): Message {
  const { spaceId, channelId, senderId, text, messageId, nonce } = params;
  return {
    spaceId,
    channelId,
    messageId,
    digestAlgorithm: 'SHA-256',
    nonce,
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    lastModifiedHash: '',
    content: { type: 'post', senderId, text } as MessageContent,
    reactions: [],
  } as unknown as Message;
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
  'space-message-id-derivation: a space message may only be stored under the id its content derives',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-message-id-derivation', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[msgid-derivation] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [v, x] = await Promise.all([
      createSpaceBot(`mid-victim-${stamp}`),
      createSpaceBot(`mid-attacker-${stamp}`),
    ]);
    await Promise.all([v.start(), x.start()]);

    // Declared before the try so the finally can always restore what it patched,
    // even if setup throws. The save seams are per-bot and outlive the bots.
    const refusals: string[] = [];
    const origLoggerWarn = logger.warn.bind(logger);
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
          `[msgid-derivation] ↻ re-pushing for "${label}" (round ${round}/${rounds})`
        );
      }
      timedOut.push(label);
      console.log(`[msgid-derivation] ⏱ wait timed out: ${label}`);
    };

    try {
      say(
        `victim=${v.identity.address.slice(0, 12)} attacker=${x.identity.address.slice(0, 12)}`
      );

      // ── Setup: the victim owns the space, the attacker is an ordinary member.
      const s = await v.createSpace(`mid-S-${stamp}`);
      say(`space=${s.spaceId.slice(0, 12)} channel=${s.channelId.slice(0, 12)}`);
      const link = await v.inviteLink(s.spaceId);
      const joined = await x.join(link);
      expect(joined.spaceId).toBe(s.spaceId);
      say('attacker joined as an ordinary member (no role)');

      // DELIVERY instrument. Every frame that survives the new id gate reaches
      // `MessageService.saveMessage`; every frame refused by it does not. So
      // this list IS the set of frames the gate accepted, which is what the
      // delivery-preservation arms have to observe — a control frame (reaction,
      // edit, thread) mutates its TARGET's row rather than creating one of its
      // own, so its arrival cannot be read off the message store.
      //
      // Instrumented on BOTH bots, and that is load-bearing rather than tidy:
      // `submitChannelMessage` saves the sender's OWN copy through this same
      // method, so asserting a type on the bot that SENT it would pass without
      // the frame ever crossing the wire. Every arm below is therefore asserted
      // on the bot that did not send it. `pin` and `mute` are owner-only on the
      // send path, so those two are sent by the victim and observed on the
      // attacker.
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

      // POSITIVE-CONTROL instrument — the refusal's own warning.
      (logger as unknown as { warn: (...a: unknown[]) => void }).warn = (
        ...args: unknown[]
      ) => {
        const line = args.map((a) => String(a)).join(' ');
        if (line.includes('is not its own content fingerprint')) {
          refusals.push(line);
        }
        return origLoggerWarn(...(args as []));
      };

      // ── The victim's message, the one the attack tries to destroy ─────────
      const VICTIM_TEXT = `victim-original-${stamp}`;
      await v.post(s.spaceId, s.channelId, VICTIM_TEXT);
      const victimRow = await until(async () =>
        (await v.messageDB.getAllSpaceMessages({ spaceId: s.spaceId })).find(
          (m) =>
            m.content?.type === 'post' &&
            (m.content as { text?: string }).text === VICTIM_TEXT
        )
      );
      expect(victimRow, 'the victim never stored its own post').toBeTruthy();
      const M = victimRow!.messageId;
      say(`victim message M=${M.slice(0, 12)} text="${VICTIM_TEXT}"`);

      // The attacker must LEARN M off the wire, as a real attacker would.
      await forceDelivery(x);
      const seenByAttacker = await until(async () =>
        (await x.messageDB.getMessage({
          spaceId: s.spaceId,
          channelId: s.channelId,
          messageId: M,
        })) ?? undefined
      );
      expect(
        seenByAttacker,
        'the attacker never received the victim message, so it cannot name its id'
      ).toBeTruthy();
      say('attacker received M off the wire');

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
      const REPLY_TEXT = `honest-reply-${stamp}`;
      const EDITED_TEXT = `honest-post-B-EDITED-${stamp}`;

      const victimHasText = async (text: string) =>
        (await v.messageDB.getAllSpaceMessages({ spaceId: s.spaceId })).some(
          (m) =>
            m.content?.type === 'post' &&
            (m.content as { text?: string }).text === text
        );

      // BATCH 1 — the row-creating types. Three separate posts, because each
      // target-mutating arm in batch 2 needs its OWN row: two frames writing one
      // record is the same race as above, one batch lower down.
      await x.post(s.spaceId, s.channelId, A_TEXT);
      await x.post(s.spaceId, s.channelId, B_TEXT);
      await x.post(s.spaceId, s.channelId, C_TEXT);
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
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'post',
        senderId: x.identity.address,
        text: REPLY_TEXT,
        repliesToMessageId: M,
      });
      say('sent batch 1: [post A, post B, post C, embed, sticker, reply] (6)');

      await settleFor(
        'batch1 posts+embed+sticker+reply at victim',
        [v],
        async () =>
          (await victimHasText(A_TEXT)) &&
          (await victimHasText(B_TEXT)) &&
          (await victimHasText(C_TEXT)) &&
          (await victimHasText(REPLY_TEXT)) &&
          typesSeenBy('v').has('embed') &&
          typesSeenBy('v').has('sticker')
      );
      await sleep(SETTLE_MS);

      // The attacker's own copies name the ids its honest send path derived.
      const findByText = async (text: string) =>
        (await x.messageDB.getAllSpaceMessages({ spaceId: s.spaceId })).find(
          (m) =>
            m.content?.type === 'post' &&
            (m.content as { text?: string }).text === text
        );
      const rowA = await findByText(A_TEXT);
      const rowB = await findByText(B_TEXT);
      const rowC = await findByText(C_TEXT);
      const rowReply = await findByText(REPLY_TEXT);
      expect(
        rowA && rowB && rowC && rowReply,
        'the attacker did not store its own posts'
      ).toBeTruthy();

      // BATCH 2 — the target-mutating types, each on a DIFFERENT row.
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'reaction',
        senderId: x.identity.address,
        messageId: rowA!.messageId,
        reaction: '👍',
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
      say('sent batch 2: [reaction→A, edit→B, thread create→C] (3)');

      await settleFor('batch2 reaction+edit+thread at victim', [v], async () =>
        typesSeenBy('v').has('reaction') &&
          typesSeenBy('v').has('edit-message') &&
          typesSeenBy('v').has('thread')
      );
      await sleep(SETTLE_MS);

      // BATCH 3 — the SCOPE-BOUND control types.
      // `remove-message`, `pin` and `mute` are the members of the frozen
      // CONTROL_MESSAGE_TYPES whose fingerprint mixes spaceId+channelId into the
      // hash (`buildMessageFingerprint`). They are the only types that can catch
      // this gate passing a different scope than the send path used — it reads
      // the DELIVERING space where the older signature block read the WIRE one,
      // and without an arm here that divergence would be untested.
      // `update-profile` is here for a different reason: its send branch spells
      // the fingerprint out by hand instead of calling the shared builder, so
      // nothing but this arm would notice the two drifting apart.
      //
      // `mute` is sent by the VICTIM (the space owner) and therefore observed on
      // the ATTACKER. Asserting it on the sender would pass without the frame
      // ever crossing the wire, since the send path saves the sender's own copy
      // through the very method instrumented here.
      //
      // ⚠️ `pin` is sent but NOT asserted, and that is a harness limitation
      // rather than an oversight. Its send branch requires an explicit role
      // holding `message:pin` and deliberately grants no owner bypass
      // (`MessageService.submitChannelMessage`, the pin branch), so a freshly
      // created space's owner cannot produce one — MEASURED: the frame appeared
      // in neither bot's accepted list, including the sender's own local copy,
      // because it was never put on the wire. Giving it a real arm means
      // creating a role and broadcasting a manifest first. The scope-bound
      // fingerprint it would exercise is already covered by three honest
      // send-path frames: `remove-message`, `mute` and `edit-message` are all
      // members of the same frozen CONTROL_MESSAGE_TYPES list.
      //
      // Four frames, four different records: the remove deletes the reply row,
      // update-profile writes a member row, the pin writes A (if it goes at
      // all), and the mute has no handler so it lands as a row of its own.
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'remove-message',
        senderId: x.identity.address,
        removeMessageId: rowReply!.messageId,
      });
      await x.sendControl(s.spaceId, s.channelId, {
        type: 'update-profile',
        senderId: x.identity.address,
        displayName: `attacker-${stamp}`,
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
      say('sent batch 3: [remove→reply, update-profile (x); pin→A, mute (v)] (4)');

      await settleFor('batch3 scope-bound control types', [v, x], async () =>
        typesSeenBy('v').has('remove-message') &&
          typesSeenBy('v').has('update-profile') &&
          typesSeenBy('x').has('mute')
      );
      await sleep(SETTLE_MS);

      // ── PHASE 3 — the ATTACK ──────────────────────────────────────────────
      const ATTACK_TEXT = `ATTACKER-REPLACED-${stamp}`;
      await x.forgeSend(
        s.spaceId,
        forgePost({
          spaceId: s.spaceId,
          channelId: s.channelId,
          senderId: x.identity.address,
          text: ATTACK_TEXT,
          messageId: M, // the victim's id, on content that does not derive it
          nonce: crypto.randomUUID(),
        })
      );
      say(`sent ATTACK: unsigned post claiming M=${M.slice(0, 12)}`);

      // Resolve either way: it applied (M's text changed, on an unfixed build)
      // or it was refused by the id check (the fix's warning). NOT settleFor —
      // on an unfixed build neither outcome is "arrived", and a retry loop would
      // spend five rounds discovering that.
      await forceDelivery(v);
      await until(async () => {
        const row = await v.getMessage(s.spaceId, s.channelId, M);
        if ((row?.content as { text?: string })?.text !== VICTIM_TEXT) return true;
        if (refusals.some((l) => l.includes(M.substring(0, 12)))) return true;
        return undefined;
      });
      await sleep(SETTLE_MS);

      // ── PHASE 4 — the CONTROL ─────────────────────────────────────────────
      // The same forged, unsigned frame, differing in ONE variable: its id is
      // the one its own content derives. It must still be delivered and stored.
      const CONTROL_TEXT = `CONTROL-DERIVED-${stamp}`;
      const controlNonce = crypto.randomUUID();
      const controlId = derivedId(
        {
          nonce: controlNonce,
          content: {
            type: 'post',
            senderId: x.identity.address,
            text: CONTROL_TEXT,
          } as MessageContent,
        },
        s.spaceId,
        s.channelId
      );
      await x.forgeSend(
        s.spaceId,
        forgePost({
          spaceId: s.spaceId,
          channelId: s.channelId,
          senderId: x.identity.address,
          text: CONTROL_TEXT,
          messageId: controlId,
          nonce: controlNonce,
        })
      );
      say(`sent CONTROL: unsigned post, derived id=${controlId.slice(0, 12)}`);

      await settleFor('control frame at victim', [v], async () =>
        !!(await v.getMessage(s.spaceId, s.channelId, controlId))
      );
      await sleep(SETTLE_MS);

      // ── RESULT ────────────────────────────────────────────────────────────
      const mAfter = await v.getMessage(s.spaceId, s.channelId, M);
      const controlAfter = await v.getMessage(s.spaceId, s.channelId, controlId);
      const refusalsForM = refusals.filter((l) =>
        l.includes(M.substring(0, 12))
      ).length;

      // Every stored row the victim holds must carry an id its content derives.
      // The honest send path is what produced them, so this is the direct
      // recipe-agreement check: if the receiver's fingerprint disagreed with the
      // sender's for any content type, it shows up here.
      const victimRows = await v.messageDB.getAllSpaceMessages({
        spaceId: s.spaceId,
      });
      const undeliverable = victimRows
        .filter((m) => {
          // Rows the receiver SYNTHESIZED locally (join/leave/kick) are not wire
          // frames and never pass through the gate; their content types have no
          // fingerprint at all. Excluded deliberately, not overlooked.
          const t = String(m.content?.type);
          if (t === 'join' || t === 'leave' || t === 'kick') return false;
          // An APPLIED edit rewrites the target's text under the target's id, so
          // post B legitimately stops matching once phase 2 lands. That is the
          // stored-row exemption the sync paths depend on and the reason this
          // rule is wire-frame-only.
          if (m.messageId === rowB!.messageId) return false;
          return derivedId(m, s.spaceId, m.channelId) !== m.messageId;
        })
        .map((m) => `${String(m.content?.type)}:${m.messageId.slice(0, 12)}`);

      // The claim the whole scope of this rule rests on, measured rather than
      // argued: once an edit is APPLIED, the target row's id is no longer its
      // content's hash. `false` here means the sync paths could safely carry
      // this rule too, and the wire-frame-only scoping should be revisited.
      const editedRow = await v.getMessage(
        s.spaceId,
        s.channelId,
        rowB!.messageId
      );
      const editedStillDerives = editedRow
        ? derivedId(editedRow, s.spaceId, editedRow.channelId) ===
          editedRow.messageId
        : undefined;

      say('');
      say('==== RESULT ====');
      say(
        `SCOPE     edited row still derives    : ${editedStillDerives} ` +
          `(false = stored rows legitimately mismatch, so this rule is wire-frame-only)`
      );
      say(`PROPERTY  M's text after the attack : "${(mAfter?.content as { text?: string })?.text}"`);
      say(`POSITIVE  refusals naming M         : ${refusalsForM} (>=1 = reached the id check)`);
      say(`CONTROL   derived-id forgery stored : ${!!controlAfter}`);
      say(`DELIVERY  types accepted by victim   : ${[...typesSeenBy('v')].join(', ')}`);
      say(`DELIVERY  types accepted by attacker : ${[...typesSeenBy('x')].join(', ')}`);
      // The difference that matters when a type is missing: a frame the GATE
      // refused is a bug in the fix; a frame that never arrived is the relay or
      // the harness. Without this the two are indistinguishable, and the
      // temptation is to assume the harmless one.
      const strayRefusals = refusals.filter(
        (l) => !l.includes(M.substring(0, 12))
      );
      say(`DIAG      refusals total / not-M      : ${refusals.length} / ${strayRefusals.length}`);
      for (const l of strayRefusals.slice(0, 8)) say(`   ! stray refusal: ${l}`);
      say(`DIAG      phases that timed out       : ${timedOut.join(', ') || 'none'}`);
      // A frame that never left the sender looks identical, at the receiver, to
      // one the gate refused. This separates them at the source.
      say(
        `DIAG      outbound failures v / x     : ${v.graph.outbound.failures.length} / ${x.graph.outbound.failures.length}`
      );
      for (const f of [...v.graph.outbound.failures, ...x.graph.outbound.failures].slice(0, 5)) {
        say(`   ! outbound: ${f.error}`);
      }
      say(`DELIVERY  rows whose id != derived  : ${undeliverable.length ? undeliverable.join(', ') : 'none'}`);
      say(
        `receive failures: NOVEL victim=${v.novelErrors().length} attacker=${x.novelErrors().length}`
      );
      for (const e of v.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── no novel receive errors ───────────────────────────────────────────
      expect(
        v.novelErrors().length,
        'the victim raised a novel receive error — a frame may have been rejected ' +
          'before the handler ran, making an unchanged M a false positive'
      ).toBe(0);

      // ── SECURITY PROPERTY — the victim's row survived ─────────────────────
      // On an unfixed build M now holds the attacker's text and this fails
      // first: a clean red on the bug.
      expect(
        (mAfter?.content as { text?: string })?.text,
        'SECURITY: an unsigned post carrying the victim’s messageId replaced the ' +
          'victim’s stored message. A space message must only be stored under the ' +
          'id its own content derives.'
      ).toBe(VICTIM_TEXT);

      // ── POSITIVE CONTROL — refused BY the id check, not dropped earlier ───
      expect(
        refusalsForM,
        'POSITIVE CONTROL: no id-derivation refusal was logged for M — M being ' +
          'unchanged may mean the attack frame was dropped before the id check ' +
          'rather than refused by it'
      ).toBeGreaterThanOrEqual(1);

      // ── CONTROL — the refusal is narrow ──────────────────────────────────
      expect(
        controlAfter,
        'CONTROL: a forged frame whose id IS its content fingerprint was not ' +
          'stored — the gate is refusing more than the id mismatch, or nothing ' +
          'is arriving at all, in which case the attack arm proves nothing'
      ).toBeTruthy();

      // ── A FRAME THAT NEVER LEFT IS NOT A FRAME THE GATE REFUSED ──────────
      // First of the delivery checks, because it is the most upstream cause and
      // the one that has already been mistaken for the others. The outbound
      // queue records a send onto a not-yet-open socket in `failures` and
      // resolves anyway, so the sender believes it sent.
      expect(
        [...v.graph.outbound.failures, ...x.graph.outbound.failures].map(
          (f) => f.error
        ),
        'DELIVERY: an outbound send failed, so anything missing at the receiver ' +
          'never left the sender and says nothing about the id gate'
      ).toEqual([]);

      // ── DELIVERY DIAGNOSIS BEFORE DELIVERY VERDICT ───────────────────────
      // Asserted before the per-type checks below on purpose. A wait that
      // expired and a content type the gate refused produce the SAME symptom —
      // a type missing from the accepted list — and the per-type message blames
      // the gate. Failing here first says "nothing arrived", which is the relay
      // or the batch size, not the fix. Twice during development the second
      // reading was nearly mistaken for the first.
      expect(
        timedOut,
        'DELIVERY: a wait expired, so the per-type results below are about ' +
          'frames that never arrived rather than frames the gate refused. ' +
          `Gate refusals not naming the attack: ${strayRefusals.length}` +
          (strayRefusals.length ? ` — ${strayRefusals[0]}` : ' (so the gate refused nothing honest)')
      ).toEqual([]);

      // ── DELIVERY PRESERVATION — every honest type survived the gate ───────
      // Each type is asserted on the bot that did NOT send it, so a pass means
      // the frame crossed the wire and cleared the gate rather than being the
      // sender's own local copy.
      for (const [who, type] of [
        ['v', 'post'],
        ['v', 'embed'],
        ['v', 'sticker'],
        ['v', 'reaction'],
        ['v', 'edit-message'],
        ['v', 'thread'],
        ['v', 'remove-message'],
        ['v', 'update-profile'],
        ['x', 'mute'],
      ] as const) {
        expect(
          typesSeenBy(who).has(type),
          `DELIVERY: an honest '${type}' frame did not survive the id gate — the ` +
            `receiver's fingerprint does not reproduce the id the send path derived ` +
            `for this content type, so every message of this type is now dropped`
        ).toBe(true);
      }

      // ── DELIVERY PRESERVATION — the recipe agrees, row by row ─────────────
      expect(
        undeliverable,
        'DELIVERY: a stored row carries an id its own content does not derive. ' +
          'Every one of these would be refused on a live redelivery.'
      ).toEqual([]);

      say('PASS — ids are derived, the victim’s row is intact, delivery is unharmed');
    } finally {
      (logger as unknown as { warn: unknown }).warn = origLoggerWarn;
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
