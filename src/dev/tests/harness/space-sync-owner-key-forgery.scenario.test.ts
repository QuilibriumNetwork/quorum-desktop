// NETWORKED. A sync frame is only honoured when its signature verifies against a
// key the SPACE already bound to an identity — never against a key the frame
// itself introduced.
//
//   yarn harness space-sync-owner-key-forgery
//
// `sync-peer-map`, `sync-members` and `sync-messages` share one gate
// (`MessageService.ts:5787`, `:6519`, `:6648`):
//
//   reg.owner_public_keys.includes(exteriorEnvelope.owner_public_key)
//     || this.syncInfo.current[spaceId]
//
// The second disjunct is a truthiness test on an object this client writes when
// IT requests a sync, and which production code never deletes. Past the gate the
// handler verifies `owner_signature` against `owner_public_key` — both fields
// supplied by the sender, out of the same envelope. So once this page has asked
// for a sync even once, a frame signed by a key the attacker generated moments
// earlier verifies against itself and is applied as though the space owner had
// sent it.
//
// The forge sends a frame no honest client can produce. Every legitimate sender
// signs with a key the space knows: `synchronizeAll` with the registered owner
// key (`SyncService.ts:92`), `directSync` / `handleSyncInitiateV2` /
// `handleSyncManifest` with the sender's own space `inbox` key (`:348`, `:837`,
// `:968`). None of them can sign with a throwaway. Only the sealing call's
// signing keypair is chosen here; `SealSyncEnvelope` is the real one, and the
// receiver's path is untouched.
//
//   NOSYNC   fresh-key frame, delivered BEFORE the victim ever asked for a sync
//            → must be REFUSED (isolates the fallback as the cause: the owner
//              check is present and does work, it is the disjunct that opens)
//   ATTACK   fresh-key frame, delivered AFTER one sync request
//            → the victim must NOT store the forged roster row (PROPERTY)
//   PEER     the IDENTICAL frame signed with the sender's REAL per-space `inbox`
//            key — what every genuine peer sender uses
//            → must still be APPLIED. Without this arm a fix that refused ALL
//              peer sync would pass every other assertion here AND `space-basic`
//              (a fresh joiner also gets its roster via the ungated `sync-delta`),
//              so silent death of peer sync would look exactly like success.
//   BADSIG   fresh-key frame, signature corrupted, sync flag still set
//            → nothing must be written. ⚠️ MEASURED 2026-08-22: the production
//              relay REFUSES TO CARRY this frame — it never reaches the victim
//              socket at all — so this arm demonstrates relay-side filtering and
//              does NOT exercise the client's own ed448 call. Kept because a
//              relay that stopped filtering would make it a real client-side
//              control, and the arm reports which of the two happened.
//
// That relay behaviour also sharpens the diagnosis: the relay accepts the ATTACK
// frame for exactly the reason the client does — the envelope really is
// internally consistent. The defect was never a missing signature check. It is
// that the check is run against a key the frame chose.
//
// ⚠️ Each arm asserts a NEGATIVE ("the row was not written"), which is what a
// frame that never arrived also looks like. So every arm is paired with an
// arrival check that matches THAT ARM'S OWN throwaway signing key in
// `transport.arrived` — the raw socket log, upstream of any application
// dispatch. Without it a wholly broken transport would render this file green.
// MEASURED on the first run: the ATTACK arm is self-proving (the row appears,
// so the frame plainly arrived), but both control arms are not, and an earlier
// draft of this check read a log line that never fired — it would have reported
// "0 envelopes seen" while the attack was demonstrably landing.
//
// Each arm targets a DIFFERENT fabricated member row, so no two frames ever
// write the same key — the concurrency trap in the harness README bites well
// before "two frames, one row", and batches here are one frame deep for that
// reason.
//
// PRODUCTION relay, throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import {
  channel as secureChannel,
  channel_raw as ch,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { hexToSpreadArray } from '../../../utils/crypto';
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

/**
 * Force the relay to re-push everything queued for this bot.
 *
 * ⚠️ The sleep is not politeness. `reconnect` resolves once the socket has been
 * asked to open, but the CLOSING socket's own handler schedules a second
 * `open()` a second later, so the transport can end up pointing at a socket in
 * readyState CONNECTING while `connected` is still true. A send issued in that
 * window is recorded in `outbound.failures` and RESOLVES ANYWAY. Copied from
 * space-message-id-derivation, where that window silently ate two frames of six
 * and read exactly like the gate under test dropping them.
 */
async function forceDelivery(bot: HarnessSpaceBot): Promise<void> {
  // Drain first. Anything still queued when the socket churns is attempted
  // against a CONNECTING socket and lands in `outbound.failures`, which is
  // noise this scenario would otherwise have to explain away. MEASURED on the
  // first run of this file: three such failures on the victim, all from its own
  // sync-info / sync-request traffic, none related to any arm.
  await bot.graph.outbound.flush();
  bot.disconnect();
  await bot.reconnect();
  await until(async () => (bot.transport.connected ? true : undefined), 30_000);
  await sleep(3000);
  await until(async () => (bot.transport.connected ? true : undefined), 30_000);
}

/**
 * Did this bot's SOCKET receive the directed sync envelope signed by this exact
 * key?
 *
 * `transport.arrived` is appended in the raw ws 'message' handler, upstream of
 * any application dispatch (`transport.ts:314`), so it answers "did the frame
 * reach the client" independently of whether the client then accepted it,
 * refused it, or threw on it. That independence is the whole point: every
 * control arm here asserts a NEGATIVE, and a frame that never arrived is
 * indistinguishable from one that was refused.
 *
 * Matching the arm's own throwaway signing key makes it SPECIFIC to that arm. A
 * frame counter would not: the relay redelivers backlog on every `listen`, so a
 * counter rises for traffic that has nothing to do with the arm — the exact
 * false-green the harness README calls out (`space-manifest-scope`'s review
 * caught one).
 */
function forgedFrameArrived(
  bot: HarnessSpaceBot,
  signingKeyHex: string
): boolean {
  // Deliberately a substring search over the whole frame rather than a parse of
  // `encryptedContent`. An earlier version parsed the frame and matched
  // `outer.owner_public_key`; it reported "never arrived" for all three arms in
  // a run where the ATTACK arm had demonstrably arrived and written its row, so
  // an assumption about the relay's delivered shape was wrong. The needle is a
  // 114-hex-char ed448 public key generated for this arm alone — it cannot
  // collide with anything, and matching it needs no assumption about how the
  // relay wraps what it delivers.
  const needle = signingKeyHex.toLowerCase();
  return bot.transport.arrived.some((frame) => {
    try {
      return JSON.stringify(frame).toLowerCase().includes(needle);
    } catch {
      return false;
    }
  });
}

/** Top-level shape of a delivered frame — recorded so the next reader need not guess. */
function describeArrivedShape(bot: HarnessSpaceBot): string {
  const sample = bot.transport.arrived[bot.transport.arrived.length - 1];
  if (!sample) return 'none';
  const keys = Object.keys(sample).join(',');
  const raw = (sample as { encryptedContent?: unknown }).encryptedContent;
  let innerKeys = 'n/a';
  if (typeof raw === 'string') {
    try {
      innerKeys = Object.keys(JSON.parse(raw) as object).join(',');
    } catch {
      innerKeys = 'unparseable';
    }
  }
  return `frame{${keys}} encryptedContent{${innerKeys}}`;
}

/**
 * Seal a `sync-members` frame addressed to `victimInbox`, signed by a keypair
 * generated here rather than by any key the space registered.
 *
 * This is the whole forgery: `SealSyncEnvelope`'s FOURTH argument becomes the
 * envelope's `owner_public_key` / `owner_signature` pair
 * (`quilibrium-js-sdk-channels`, `SealSyncEnvelope`), and the receiver verifies
 * the signature against that same self-declared key. Passing a throwaway
 * keypair there is something no send path in the app can express — all four
 * real senders pass either the space `owner` keyset or their own `inbox` keyset.
 *
 * The hub and config keys are the attacker's REAL ones: they are shared per
 * space, so holding them is just membership, which is the bar this whole class
 * of finding already assumes.
 */
async function forgeSyncMembersFrame(params: {
  bot: HarnessSpaceBot;
  spaceId: string;
  victimInbox: string;
  members: unknown[];
  corruptSignature?: boolean;
  /**
   * Which key signs the envelope.
   *
   * `fresh` — a throwaway the space has never seen: the forgery.
   * `spaceInbox` — the sender's REAL per-space `inbox` key, which is exactly
   *   what `directSync` / `handleSyncInitiateV2` / `handleSyncManifest` sign
   *   with. This is the honest peer control, and it is the arm that keeps the
   *   fix from silently refusing all peer sync.
   */
  signWith?: 'fresh' | 'spaceInbox';
}): Promise<{ frame: string; signingKeyHex: string }> {
  const {
    bot,
    spaceId,
    victimInbox,
    members,
    corruptSignature,
    signWith = 'fresh',
  } = params;

  const hubKey = await bot.messageDB.getSpaceKey(spaceId, 'hub');
  const configKey = await bot.messageDB.getSpaceKey(spaceId, 'config');
  if (!hubKey?.address) {
    throw new Error(
      `[harness] no hub key/address for ${spaceId} — the attacker is not a member, ` +
        'so the forge cannot even be sealed and the run would prove nothing'
    );
  }

  let fresh: { public_key: number[]; private_key: number[] };
  if (signWith === 'spaceInbox') {
    const inboxKey = await bot.messageDB.getSpaceKey(spaceId, 'inbox');
    if (!inboxKey?.publicKey) {
      throw new Error(
        `[harness] no space inbox key for ${spaceId} — the honest peer control ` +
          'cannot be signed, so a green run would not prove peer sync still works'
      );
    }
    fresh = {
      public_key: hexToSpreadArray(inboxKey.publicKey),
      private_key: hexToSpreadArray(inboxKey.privateKey),
    };
  } else {
    // A keypair the space has never seen and never will.
    fresh = JSON.parse(ch.js_generate_ed448()) as {
      public_key: number[];
      private_key: number[];
    };
  }

  const envelope = await secureChannel.SealSyncEnvelope(
    victimInbox,
    hubKey.address,
    {
      type: 'ed448',
      private_key: hexToSpreadArray(hubKey.privateKey),
      public_key: hexToSpreadArray(hubKey.publicKey),
    },
    { type: 'ed448', ...fresh },
    JSON.stringify({
      type: 'control',
      message: { type: 'sync-members', members },
    }),
    configKey
      ? {
          type: 'x448' as const,
          public_key: hexToSpreadArray(configKey.publicKey),
          private_key: hexToSpreadArray(configKey.privateKey),
        }
      : undefined
  );

  if (corruptSignature) {
    // Flip one hex nibble. The envelope still parses and still opens — only the
    // ed448 check can tell the difference, which is precisely what this arm is
    // asking about.
    const sig = envelope.owner_signature;
    const flipped = sig[0] === '0' ? '1' : '0';
    envelope.owner_signature = flipped + sig.slice(1);
  }

  return {
    frame: JSON.stringify({ type: 'sync', ...envelope }),
    signingKeyHex: Buffer.from(new Uint8Array(fresh.public_key)).toString('hex'),
  };
}

/** Put a raw frame on the wire through the attacker's own serialized queue. */
async function send(bot: HarnessSpaceBot, frame: string): Promise<void> {
  bot.graph.outbound.enqueue(async () => [frame]);
  const drained = await bot.graph.outbound.flush();
  if (!drained) {
    throw new Error(
      '[harness] the attacker outbound queue did not drain — the frame was never ' +
        'sent, so any "refused" result below would be an artifact'
    );
  }
}

/** A fabricated roster row. The address is invented and belongs to nobody. */
function forgedRow(tag: string, stamp: string) {
  return {
    user_address: `QmForgedMember${tag}${stamp}`,
    inbox_address: `QmForgedInbox${tag}${stamp}`,
    display_name: `ATTACKER-INJECTED-${tag}-${stamp}`,
    user_icon: '',
  };
}

test(
  'space-sync-owner-key-forgery: a sync frame signed by a self-declared key must not be applied',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-sync-owner-key-forgery', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[sync-owner-forgery] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [v, x] = await Promise.all([
      createSpaceBot(`sokf-victim-${stamp}`),
      createSpaceBot(`sokf-attacker-${stamp}`),
    ]);
    await Promise.all([v.start(), x.start()]);

    try {
      say(
        `victim=${v.identity.address.slice(0, 12)} attacker=${x.identity.address.slice(0, 12)}`
      );

      // ── Setup ────────────────────────────────────────────────────────────
      // V owns the space; X is an ordinary member. X holding the hub and config
      // keys is exactly what membership means here — no privilege beyond that.
      const s = await v.createSpace(`sokf-${stamp}`);
      say(`space=${s.spaceId.slice(0, 12)}`);

      const link = await v.inviteLink(s.spaceId);
      const joined = await x.join(link);
      expect(joined.spaceId).toBe(s.spaceId);
      say('attacker joined as an ordinary member');

      const victimInbox = (await v.messageDB.getSpaceKey(s.spaceId, 'inbox'))
        ?.address;
      expect(
        victimInbox,
        'the victim has no space inbox address — nothing can be addressed to it'
      ).toBeTruthy();

      // Let the join settle so the roster/keys are in place on both sides and
      // the join traffic is not still in flight when the arms start.
      await forceDelivery(v);
      await sleep(SETTLE_MS);

      const rowNoSync = forgedRow('NOSYNC', stamp);
      const rowAttack = forgedRow('ATTACK', stamp);
      const rowBadSig = forgedRow('BADSIG', stamp);

      // ── ARM 1 — NOSYNC: the fallback is not yet open ─────────────────────
      // The victim has never called requestSync for this space, so
      // syncInfo.current[spaceId] should be unset and ONLY the owner-key
      // disjunct can admit a frame. A fresh key is not a registered owner key,
      // so this must be refused — which is what proves the owner check exists
      // and is doing work, making ARM 2 attributable to the fallback rather
      // than to there being no check at all.
      const syncFlagBefore = v.graph.syncInfo.current[s.spaceId];
      if (syncFlagBefore) {
        // Not expected — nothing in the harness calls requestSync implicitly —
        // but if some path armed it, say so rather than silently testing a
        // different thing, and clear it so the arm still means what it claims.
        say('⚠️ victim already had a sync session before ARM 1 — clearing it');
        delete v.graph.syncInfo.current[s.spaceId];
      }
      say(`ARM 1 NOSYNC — sync flag set: ${!!syncFlagBefore} (expected false)`);

      const f1 = await forgeSyncMembersFrame({
        bot: x,
        spaceId: s.spaceId,
        victimInbox: victimInbox!,
        members: [rowNoSync],
      });
      say(`ARM 1 signed by throwaway key ${f1.signingKeyHex.slice(0, 16)}…`);
      await send(x, f1.frame);
      await forceDelivery(v);
      await until(
        async () => (forgedFrameArrived(v, f1.signingKeyHex) ? true : undefined),
        WINDOW_MS
      );
      await sleep(SETTLE_MS);
      const arrived1 = forgedFrameArrived(v, f1.signingKeyHex);
      const noSyncRow = await v.messageDB.getSpaceMember(
        s.spaceId,
        rowNoSync.user_address
      );

      // ── ARM 2 — ATTACK: one sync request opens the fallback ──────────────
      const asked = await v.requestSync(s.spaceId);
      expect(asked, 'requestSync did not even queue — the precondition is unmet').toBe(
        true
      );
      await until(
        async () =>
          v.graph.syncInfo.current[s.spaceId] !== undefined ? true : undefined,
        30_000
      );
      const syncFlagArmed = !!v.graph.syncInfo.current[s.spaceId];
      expect(
        syncFlagArmed,
        'PRECONDITION: the victim requested a sync but syncInfo was never ' +
          'populated, so the fallback this scenario exercises is not open and ' +
          'a refused ATTACK arm would prove nothing'
      ).toBe(true);
      say('ARM 2 ATTACK — sync flag now armed (the fallback is open)');

      const f2 = await forgeSyncMembersFrame({
        bot: x,
        spaceId: s.spaceId,
        victimInbox: victimInbox!,
        members: [rowAttack],
      });
      say(`ARM 2 signed by throwaway key ${f2.signingKeyHex.slice(0, 16)}…`);
      await send(x, f2.frame);
      await forceDelivery(v);
      await until(
        async () => (forgedFrameArrived(v, f2.signingKeyHex) ? true : undefined),
        WINDOW_MS
      );
      await sleep(SETTLE_MS);
      const arrived2 = forgedFrameArrived(v, f2.signingKeyHex);
      const attackRow = await v.messageDB.getSpaceMember(
        s.spaceId,
        rowAttack.user_address
      );

      // ── ARM 3 — BADSIG: the same frame with a broken signature ───────────
      // Still inside an armed sync session, so the gate opens exactly as it did
      // for ARM 2 and only the ed448 result differs.
      const f3 = await forgeSyncMembersFrame({
        bot: x,
        spaceId: s.spaceId,
        victimInbox: victimInbox!,
        members: [rowBadSig],
        corruptSignature: true,
      });
      say(`ARM 3 signed by throwaway key ${f3.signingKeyHex.slice(0, 16)}… (signature corrupted)`);
      await send(x, f3.frame);
      await forceDelivery(v);
      // Short window on purpose: non-arrival is the MEASURED expectation here
      // (the relay filters it), so spending the full delivery window waiting for
      // something that is not coming just makes every run four minutes longer.
      await until(
        async () => (forgedFrameArrived(v, f3.signingKeyHex) ? true : undefined),
        30_000
      );
      await sleep(SETTLE_MS);
      const arrived3 = forgedFrameArrived(v, f3.signingKeyHex);
      const badSigRow = await v.messageDB.getSpaceMember(
        s.spaceId,
        rowBadSig.user_address
      );

      // ── ARM 4 — PEER: the identical frame signed with a REAL space key ───
      // THE MOST IMPORTANT ARM IN THIS FILE, and the reason is worth stating.
      // Every other arm asserts something was refused. A fix that refused ALL
      // peer sync would satisfy every one of them, and `space-basic` would still
      // pass too, because a fresh joiner also gets its roster through the
      // UNGATED `sync-delta` — so nothing else here would notice that peer-signed
      // sync had been killed outright. This arm isolates the single variable
      // under test: same sender, same payload, same envelope, only the signing
      // key differs. `spaceInbox` is precisely what the three real peer senders
      // sign with (`SyncService.ts:348`, `:837`, `:968`).
      const rowPeer = forgedRow('PEERKEY', stamp);
      const f4 = await forgeSyncMembersFrame({
        bot: x,
        spaceId: s.spaceId,
        victimInbox: victimInbox!,
        members: [rowPeer],
        signWith: 'spaceInbox',
      });
      say(`ARM 4 signed by the sender's REAL space key ${f4.signingKeyHex.slice(0, 16)}…`);
      await send(x, f4.frame);
      await forceDelivery(v);
      await until(
        async () => (forgedFrameArrived(v, f4.signingKeyHex) ? true : undefined),
        WINDOW_MS
      );
      await until(
        async () =>
          (await v.messageDB.getSpaceMember(s.spaceId, rowPeer.user_address))
            ? true
            : undefined,
        WINDOW_MS
      );
      await sleep(SETTLE_MS);
      const arrived4 = forgedFrameArrived(v, f4.signingKeyHex);
      const peerRow = await v.messageDB.getSpaceMember(
        s.spaceId,
        rowPeer.user_address
      );

      // ── DIAGNOSTICS BEFORE VERDICTS ──────────────────────────────────────
      // Order matters. A wedged send pipeline or a novel receive error makes
      // every "refused" result below meaningless, so those are reported and
      // asserted first — otherwise the run quietly indicts the code under test.
      say('');
      say('==== DIAG ====');
      say(
        `outbound failures  victim/attacker : ${v.graph.outbound.failures.length} / ${x.graph.outbound.failures.length}`
      );
      for (const f of [
        ...v.graph.outbound.failures,
        ...x.graph.outbound.failures,
      ].slice(0, 5)) {
        say(`   ! outbound: ${f.error}`);
      }
      say(
        `novel receive errors victim/attacker : ${v.novelErrors().length} / ${x.novelErrors().length}`
      );
      for (const e of v.novelErrors().slice(0, 5)) say(`   ! victim: ${e.message}`);
      say(
        `forged frame reached victim socket : arm1 ${arrived1}, arm2 ${arrived2}, ` +
          `arm3 ${arrived3}, arm4 ${arrived4}`
      );
      say(`frames arrived at victim socket (all traffic) : ${v.transport.arrived.length}`);
      say(`delivered frame shape : ${describeArrivedShape(v)}`);

      say('');
      say('==== RESULT ====');
      say(`NOSYNC  forged row stored : ${noSyncRow ? 'YES' : 'no'}  (want: no)`);
      say(`ATTACK  forged row stored : ${attackRow ? 'YES' : 'no'}  (want: no)`);
      say(`BADSIG  forged row stored : ${badSigRow ? 'YES' : 'no'}  (want: no)`);
      say(`PEER    real-key row stored : ${peerRow ? 'YES' : 'no'}  (want: YES)`);
      say(`log: ${log.file}`);

      // The ATTACKER's queue is asserted strictly: those are the frames every
      // verdict below is about, and one that never left is a refusal that never
      // happened.
      //
      // The VICTIM's queue is reported but deliberately NOT asserted empty. It
      // only ever carries the victim's own `sync-info` / `sync-request` traffic,
      // none of which any verdict here depends on, and `forceDelivery`'s
      // reconnect churn puts occasional sends against a CONNECTING socket
      // (MEASURED: 3 on the first run of this file, all that shape). The one
      // victim-side precondition — that a sync session is armed — is asserted
      // directly against `syncInfo` rather than inferred from a successful send,
      // so a dropped victim frame cannot manufacture a false refusal.
      expect(
        x.graph.outbound.failures.map((f) => f.error),
        'an attacker outbound action failed — a forged frame may never have ' +
          'reached the relay, so a refused arm cannot be attributed to the gate'
      ).toEqual([]);

      expect(
        v.novelErrors().length,
        'the victim raised a novel receive error — a forged frame may have been ' +
          'rejected before the gate ran, making every refusal below a false positive'
      ).toBe(0);

      // ── ARRIVAL — the negatives below are about refusal, not absence ──────
      expect(
        arrived1,
        'ARM 1 arrival: the NOSYNC frame never reached the victim socket, so ' +
          '"not stored" means "never delivered" and the arm proves nothing'
      ).toBe(true);
      expect(
        arrived2,
        'ARM 2 arrival: the ATTACK frame never reached the victim socket'
      ).toBe(true);
      // ARM 3 is NOT asserted to arrive. MEASURED 2026-08-22: the relay drops a
      // sync envelope whose owner_signature does not verify against its
      // owner_public_key, so the frame never reaches the victim. Asserting
      // arrival here would encode relay behaviour as a requirement; asserting
      // non-arrival would equally freeze it. Both outcomes are reported instead,
      // and only the outcome that matters either way — nothing was written — is
      // asserted below.
      say(
        arrived3
          ? 'ARM 3 note: the relay CARRIED the corrupted-signature frame, so its ' +
              'refusal below IS a client-side ed448 result'
          : 'ARM 3 note: the relay FILTERED the corrupted-signature frame — it ' +
              'never reached the victim, so this arm does not exercise the ' +
              "client's own ed448 check"
      );

      // ── DELIVERY — peer sync still works ─────────────────────────────────
      // Asserted BEFORE the security property on purpose. If peer-signed sync is
      // broken, the security result below is worthless: everything is refused,
      // including everything legitimate, and the "PASS" would be measuring a
      // client that has stopped syncing rather than one that has stopped being
      // forgeable.
      expect(
        arrived4,
        'ARM 4 arrival: the honest peer frame never reached the victim socket, so ' +
          'this run cannot show that peer sync survives the fix'
      ).toBe(true);
      expect(
        peerRow,
        'DELIVERY: a sync frame signed with the sender’s REAL per-space key was ' +
          'REFUSED. This is the silent-breakage failure mode — every peer sync ' +
          '(directSync, handleSyncInitiateV2, handleSyncManifest) signs with that ' +
          'key, so the fix has killed syncing rather than narrowing it.'
      ).toBeTruthy();

      // ── CONTROL 1 — the owner check exists and refuses a stranger ────────
      expect(
        noSyncRow,
        'CONTROL (NOSYNC): a fresh-key frame was applied even with NO sync ' +
          'session open. Then the owner-key check is not doing anything at all, ' +
          'and the ATTACK arm cannot be attributed to the syncInfo fallback.'
      ).toBeFalsy();

      // ── CONTROL 2 — a broken signature is honoured by nobody ─────────────
      // True whether the relay filtered it or the client refused it; the note
      // above records which. Either way, a frame whose signature does not verify
      // must never reach storage.
      expect(
        badSigRow,
        'CONTROL (BADSIG): a frame with a corrupted signature was applied. Some ' +
          'layer that must reject an unverifiable envelope did not.'
      ).toBeFalsy();

      // ── SECURITY PROPERTY ────────────────────────────────────────────────
      expect(
        attackRow,
        'SECURITY: an ordinary member signed a sync frame with a key it generated ' +
          'itself, and the victim applied it as owner-authored roster state. A ' +
          'signature must be verified against a key the space already bound to an ' +
          'identity, never against one the frame supplied.'
      ).toBeFalsy();

      say('PASS — a self-declared signing key is not accepted as space authority');
    } finally {
      v.stop();
      x.stop();
    }
  },
  20 * 60 * 1000
);
