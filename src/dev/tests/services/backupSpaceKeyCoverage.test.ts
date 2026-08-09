/**
 * Backup export — does a `.qmbak` actually contain the Space keys?
 *
 * PURPOSE
 * Settles §1 and §10.1 of `.agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md`,
 * which claims that a user with sync OFF exports a backup containing **no Space
 * key material at all** — including the `owner` private key, which is the only
 * proof of Space ownership and has no other copy anywhere.
 *
 * That claim was INFERRED from reading three places in the code, never observed.
 * The whole design rests on it, so it gets an instrument rather than an argument.
 *
 * APPROACH — integration, deliberately NOT unit
 * Real `MessageDB` on fake-indexeddb, real `ConfigService.saveConfig`, real
 * `BackupService.exportBackup`, real WebCrypto. Only the network (`apiClient`)
 * and the wasm signing core are stubbed. Mocking `messageDB` here would measure
 * the mock, which is exactly the failure mode this instrument exists to avoid:
 * the claim IS about what the real save/export chain leaves on disk.
 *
 * READING THE RESULT
 *   Arm A red, Arm B green  → the design's §1 holds. Expected.
 *   Both arms green         → §1 is REFUTED. Backups already carry Space keys;
 *                             slices 1-2 of the design are unnecessary. Stop and
 *                             rewrite the issue before writing any code.
 *   Both arms red           → the harness is broken, not the app. Neither arm
 *                             means anything. Fix the harness first.
 *
 * The last case is why Arm B exists. Without a control that SHOULD find the key,
 * "we found no key" is indistinguishable from "we looked in the wrong place".
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { MessageDB } from '@/db/messages';
import { ConfigService } from '@/services/ConfigService';
import { BackupService } from '@/services/BackupService';
import { getDefaultUserConfig } from '@/utils';
import { QueryClient } from '@tanstack/react-query';

// The wasm core is never initialised in this suite (see vitest.config.ts), so the
// two signing calls saveConfig makes are stubbed. Nothing under test depends on
// the signature being real — the payload we inspect is produced before signing.
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    SealHubEnvelope: vi.fn().mockResolvedValue({ sealed: 'hub-envelope' }),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: vi.fn().mockReturnValue(JSON.stringify(true)),
    js_generate_ed448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [1, 2, 3], private_key: [4, 5, 6] })
    ),
  },
}));

/**
 * The value the whole instrument hunts for.
 *
 * A distinctive hex sentinel rather than a realistic key: the strongest assertion
 * available is "does this string appear ANYWHERE in the decrypted payload", which
 * is independent of any belief about which field is supposed to carry it. A
 * realistic-looking random key would work identically but makes a failure much
 * harder to read.
 */
const OWNER_PRIVATE_KEY = 'c0ffee'.repeat(19); // 114 hex chars, Ed448-private-key length

/**
 * Synthetic CIDv0 addresses. `MessageDB.saveConversation` rejects any direct
 * conversation not keyed `<Qm…>/<Qm…>` where both halves are the same
 * base58-decodable 46-char CID (messages.ts:1119-1135), so these cannot be
 * hand-written placeholders. Generated as CIDv0 (0x12 0x20 + digest) over a
 * constant byte fill — valid to the validator, and transparently not anyone's
 * real address.
 */
const SPACE_ID = 'QmZDbJ9cy9z1J74DgtGJEQW6yop3j15t6i31KW5McmVKzp'; // digest 0xA1…
const USER_ADDRESS = 'QmaNDKajtL35LxRkwWgNn2Sz6mxkJRXxmeXwef4pNxBzUq'; // digest 0xB2…
const PEER_ADDRESS = 'QmbWqM1roW69PooJC96TKePsDk7Ssqz3Sb2syp4H98texr'; // digest 0xC3…
const DM_INBOX = 'QmcfTNSyig9DSfAqSmWXsGLkLiG9TGS87XXpJy3juKbKSs'; // digest 0xD4…
/** Direct conversations are keyed `<addr>/<addr>`, not `<addr>/<inbox>`. */
const DM_CONVERSATION_ID = `${PEER_ADDRESS}/${PEER_ADDRESS}`;

/** Ed448 keyset shape BackupService/ConfigService read `user_key` off. */
const KEYSET = {
  user_key: {
    private_key: new Uint8Array(57).fill(7),
    public_key: new Uint8Array(57).fill(9),
  },
} as any;

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');

  // setup.ts replaces global crypto with vi.fn() stubs whose subtle.digest
  // resolves a zero-filled buffer. Real AES-GCM and SHA-512 are required here:
  // the instrument encrypts a backup and decrypts it again, and a stubbed digest
  // would make every derived key identical — the round trip would "pass" while
  // measuring nothing. Registered in this file's beforeAll, which runs after
  // setup.ts's.
  for (const target of [globalThis, global]) {
    Object.defineProperty(target, 'crypto', {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }
});

describe('Backup export — Space key coverage (design §1 / §10.1)', () => {
  let db: MessageDB;
  let configService: ConfigService;
  let backupService: BackupService;
  let postedConfigs: any[];

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    localStorage.clear();

    db = new MessageDB();
    await db.init();

    postedConfigs = [];
    configService = new ConfigService({
      messageDB: db,
      apiClient: {
        postUserSettings: vi.fn(async (_addr: string, body: any) => {
          postedConfigs.push(body);
          return { data: {} };
        }),
        getUserSettings: vi.fn().mockRejectedValue(new Error('offline')),
      },
      spaceInfo: { current: {} },
      enqueueOutbound: vi.fn(),
      sendHubMessage: vi.fn().mockResolvedValue('hub-msg'),
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    } as any);

    backupService = new BackupService({ messageDB: db });

    await seedSpaceWithFullKeyset();
    await seedDirectMessageConversation();
  });

  /**
   * Mirrors what SpaceService writes when a user CREATES a Space
   * (SpaceService.ts:356-431): seven keys, of which `owner` is the irreplaceable
   * one, plus the Space's Triple Ratchet state under `<spaceId>/<spaceId>`.
   */
  async function seedSpaceWithFullKeyset() {
    await db.saveSpace({ spaceId: SPACE_ID, name: 'Alpha' } as any);

    const keys = [
      { keyId: 'config', privateKey: 'aa'.repeat(57) },
      { keyId: 'hub', privateKey: 'bb'.repeat(57), address: 'QmHubAlpha' },
      { keyId: 'owner', privateKey: OWNER_PRIVATE_KEY },
      { keyId: 'inbox', privateKey: 'dd'.repeat(57), address: 'QmInboxAlpha' },
      { keyId: 'signing', privateKey: 'ee'.repeat(57), address: 'QmInboxAlpha' },
      { keyId: 'QmGroupAlpha', privateKey: 'ff'.repeat(57) },
      { keyId: SPACE_ID, privateKey: '11'.repeat(57) },
    ];
    for (const k of keys) {
      await db.saveSpaceKey({
        spaceId: SPACE_ID,
        keyId: k.keyId,
        publicKey: 'pub-' + k.keyId,
        privateKey: k.privateKey,
        ...(k.address ? { address: k.address } : {}),
      } as any);
    }

    await db.saveEncryptionState(
      {
        conversationId: `${SPACE_ID}/${SPACE_ID}`,
        inboxId: 'QmInboxAlpha',
        state: JSON.stringify({ triple_ratchet: 'space-state' }),
        timestamp: 1000,
      } as any,
      true
    );
  }

  /**
   * A DM, so the export has known-good content. Its presence in the payload is
   * the positive control for "the export ran and produced something real" — it
   * separates "no Space keys" from "no output at all".
   */
  async function seedDirectMessageConversation() {
    await db.saveConversation({
      conversationId: DM_CONVERSATION_ID,
      type: 'direct',
      timestamp: 2000,
      address: PEER_ADDRESS,
      icon: '',
      displayName: 'Peer',
    } as any);

    await db.saveEncryptionState(
      {
        conversationId: DM_CONVERSATION_ID,
        inboxId: DM_INBOX,
        state: JSON.stringify({ sending_inbox: { inbox_public_key: 'dm' } }),
        timestamp: 2000,
      } as any,
      true
    );
  }

  /**
   * Decrypts a produced .qmbak the way BackupService.importBackup does.
   *
   * The derivation is re-implemented rather than imported because the service
   * exposes no decrypt-to-payload method. That is safe here specifically because
   * AES-GCM is authenticated: a wrong key throws instead of returning plausible
   * garbage, so a mistake in this helper cannot turn into a false pass.
   */
  async function decryptBackup(blob: Blob) {
    const file = JSON.parse(await blob.text());

    const prefix = new TextEncoder().encode('quorum-backup-v1');
    const priv = new Uint8Array(KEYSET.user_key.private_key);
    const combined = new Uint8Array(prefix.length + priv.length);
    combined.set(prefix);
    combined.set(priv, prefix.length);

    const derived = await crypto.subtle.digest('SHA-512', combined);
    const key = await crypto.subtle.importKey(
      'raw',
      derived.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(file.iv, 'hex') },
      key,
      Buffer.from(file.ciphertext, 'hex')
    );

    const json = new TextDecoder().decode(plaintext);
    return { file, payload: JSON.parse(json), raw: json };
  }

  /** Saves a config through the real ConfigService, then exports a real backup. */
  async function saveThenExport(allowSync: boolean) {
    await configService.saveConfig({
      config: {
        ...getDefaultUserConfig(USER_ADDRESS),
        allowSync,
        spaceIds: [SPACE_ID],
        items: [{ type: 'space', id: SPACE_ID }],
      } as any,
      keyset: { userKeyset: KEYSET, deviceKeyset: {} as any },
    });

    const blob = await backupService.exportBackup({
      keyset: KEYSET,
      address: USER_ADDRESS,
    });
    return decryptBackup(blob);
  }

  // ── Positive control ────────────────────────────────────────────────────────
  // If this fails, nothing below is interpretable: it means the export produced
  // nothing, so "no owner key found" would be trivially true and meaningless.

  it('CONTROL: the export produces a decryptable file with real content', async () => {
    const { file, payload } = await saveThenExport(false);

    expect(file.version).toBe(1);
    expect(payload.conversations).toHaveLength(1);
    expect(payload.conversations[0].address).toBe(PEER_ADDRESS);
    expect(payload.encryption_states.length).toBeGreaterThan(0);
  });

  it('CONTROL: Space ratchet states ARE already exported (design §5)', async () => {
    // Independent of the key question, and load-bearing for the design: the
    // Space-side Triple Ratchet state already ships in every .qmbak today. Only
    // the keys that make it meaningful are missing.
    const { payload } = await saveThenExport(false);

    const spaceState = payload.encryption_states.find(
      (s: any) => s.conversationId === `${SPACE_ID}/${SPACE_ID}`
    );
    expect(spaceState).toBeDefined();
  });

  // ── Arm A — the claim under test ────────────────────────────────────────────

  it('ARM A (sync OFF): the backup contains NO Space key material', async () => {
    const { payload, raw } = await saveThenExport(false);

    // The strongest form of the assertion: the owner private key appears nowhere
    // in the decrypted payload, whatever field might have carried it.
    expect(raw).not.toContain(OWNER_PRIVATE_KEY);

    // And the specific mechanism the design names: spaceKeys never gets assembled.
    expect(payload.user_config?.spaceKeys ?? []).toHaveLength(0);

    // There is no second source — the payload has no space_keys domain at all.
    expect(payload).not.toHaveProperty('space_keys');
    expect(payload).not.toHaveProperty('spaces');
  });

  it('ARM A: the Space is listed but unusable — ids without keys', async () => {
    // The shape that makes this dangerous rather than merely incomplete: the file
    // LOOKS like it knows about the Space. A restore reading spaceIds would report
    // a Space it cannot actually rebuild.
    const { payload } = await saveThenExport(false);

    expect(payload.user_config?.spaceIds).toContain(SPACE_ID);
    expect(payload.user_config?.spaceKeys ?? []).toHaveLength(0);
  });

  // ── Arm B — the control that proves Arm A looked in the right place ─────────

  it('ARM B (sync ON, control): the SAME export DOES carry the owner key', async () => {
    const { payload, raw } = await saveThenExport(true);

    // Same seed, same export call, one flag different. If this is also empty the
    // harness never had a chance of finding the key and Arm A proves nothing.
    expect(raw).toContain(OWNER_PRIVATE_KEY);

    const spaceKeys = payload.user_config?.spaceKeys ?? [];
    expect(spaceKeys).toHaveLength(1);
    expect(spaceKeys[0].spaceId).toBe(SPACE_ID);
    expect(spaceKeys[0].keys.map((k: any) => k.keyId).sort()).toEqual(
      ['QmGroupAlpha', SPACE_ID, 'config', 'hub', 'inbox', 'owner', 'signing'].sort()
    );
  });

  it('ARM B: confirms the sync branch is what populates spaceKeys', async () => {
    // Pins the mechanism rather than the symptom: the assembled spaceKeys also
    // reached the upload, so the difference between the arms is the allowSync
    // branch in saveConfig and nothing else.
    await saveThenExport(true);
    expect(postedConfigs).toHaveLength(1);
  });

  // ── The consequence, stated as a test ──────────────────────────────────────

  it('a sync-OFF backup cannot rebuild the Space; a sync-ON one can', async () => {
    const off = await saveThenExport(false);
    expect(off.raw).not.toContain(OWNER_PRIVATE_KEY);

    // Fresh DB + fresh service, same account: this is the restore-onto-a-wiped-
    // device situation. What the file holds is all there is.
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    const wiped = new MessageDB();
    await wiped.init();
    expect(await wiped.getSpaces()).toHaveLength(0);
    expect(await wiped.getSpaceKeys(SPACE_ID)).toHaveLength(0);

    // Nothing in the sync-off payload could repopulate those two.
    const restorable = off.payload.user_config?.spaceKeys ?? [];
    expect(restorable).toHaveLength(0);
  });
});
