/**
 * Backup export — does a `.qmbak` carry the Space keys?
 *
 * WHY THIS FILE EXISTS
 * `.agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md` §1 claimed
 * that a user with sync OFF exported a backup containing **no Space key material
 * at all** — including the `owner` private key, the sole proof of Space ownership,
 * which has no other copy anywhere. That was INFERRED from reading three places in
 * the code. This file measured it, and it held.
 *
 * Slice 1 then fixed it: `getAllSpaceData` reads the `spaces` and `space_keys`
 * stores directly instead of the `user_config.spaceKeys` snapshot. The assertions
 * below are now the other way round — a sync-off export MUST carry the keys.
 *
 * The pre-fix behaviour is still pinned, from the other side: §"the snapshot is
 * still empty" proves the export works because it reads the owning stores, and
 * NOT because something incidentally started populating the config. Without that
 * test, a later change could reintroduce the dependency on `allowSync` and every
 * other assertion here would stay green.
 *
 * APPROACH — integration, deliberately NOT unit
 * Real `MessageDB` on fake-indexeddb, real `ConfigService.saveConfig`, real
 * `BackupService.exportBackup`, real WebCrypto. Only the network and the wasm
 * signing core are stubbed. Mocking `messageDB` would measure the mock, which is
 * the exact failure mode this file exists to rule out: the claim IS about what
 * the real save/export chain leaves in the file.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { MessageDB } from '@/db/messages';
import { ConfigService } from '@/services/ConfigService';
import {
  BackupService,
  BackupError,
  BACKUP_FORMAT_VERSION,
  domainsOf,
  V1_DOMAINS,
} from '@/services/BackupService';
import { getDefaultUserConfig } from '@/utils';
import { QueryClient } from '@tanstack/react-query';

// The wasm core is never initialised in this suite (see vitest.config.ts), so the
// signing calls saveConfig makes are stubbed. Nothing under test depends on the
// signature being real — the payload inspected here is built before signing.
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
 * The value the instrument hunts for.
 *
 * A distinctive hex sentinel rather than a realistic key: the strongest assertion
 * available is "does this string appear ANYWHERE in the decrypted payload", which
 * holds regardless of which field is supposed to carry it. A random-looking key
 * would work identically but makes a failure far harder to read.
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

/** The seven keys SpaceService writes when a user CREATES a Space (SpaceService.ts:356-431). */
const CREATED_SPACE_KEY_IDS = [
  'config',
  'hub',
  'owner',
  'inbox',
  'signing',
  'QmGroupAlpha',
  SPACE_ID,
];

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
  // this file encrypts a backup and decrypts it again, and a stubbed digest would
  // make every derived key identical — the round trip would "pass" while
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

describe('Backup export — Space key coverage', () => {
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

    await seedCreatedSpace();
    await seedDirectMessageConversation();
  });

  /** Mirrors what SpaceService writes when a user CREATES a Space. */
  async function seedCreatedSpace(evalPoolBytes = 0) {
    await db.saveSpace({ spaceId: SPACE_ID, name: 'Alpha' } as any);

    const privateKeys: Record<string, string> = {
      config: 'aa'.repeat(57),
      hub: 'bb'.repeat(57),
      owner: OWNER_PRIVATE_KEY,
      inbox: 'dd'.repeat(57),
      signing: 'ee'.repeat(57),
      QmGroupAlpha: 'ff'.repeat(57),
      [SPACE_ID]: '11'.repeat(57),
    };
    for (const keyId of CREATED_SPACE_KEY_IDS) {
      await db.saveSpaceKey({
        spaceId: SPACE_ID,
        keyId,
        publicKey: 'pub-' + keyId,
        privateKey: privateKeys[keyId],
        ...(keyId === 'hub' || keyId === 'inbox' || keyId === 'signing'
          ? { address: 'QmAddr' + keyId }
          : {}),
      } as any);
    }

    await db.saveEncryptionState(
      {
        conversationId: `${SPACE_ID}/${SPACE_ID}`,
        inboxId: 'QmAddrinbox',
        state: JSON.stringify({
          triple_ratchet: 'space-state',
          // Stand-in for the ~10k polynomial evals pre-allocated per created
          // Space (2025-12-09-encryption-state-evals-bloat.md). Zero by default
          // to keep the suite fast; the size test supplies a realistic pool.
          evals: 'e'.repeat(evalPoolBytes),
        }),
        timestamp: 1000,
      } as any,
      true
    );
  }

  /**
   * A DM, so the export has known-good content. Its presence is the positive
   * control for "the export ran and produced something real" — it separates
   * "no Space keys" from "no output at all".
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

  /** Derives the backup key exactly as BackupService.deriveKey does. */
  async function deriveKey(usage: KeyUsage) {
    const prefix = new TextEncoder().encode('quorum-backup-v1');
    const priv = new Uint8Array(KEYSET.user_key.private_key);
    const combined = new Uint8Array(prefix.length + priv.length);
    combined.set(prefix);
    combined.set(priv, prefix.length);

    const derived = await crypto.subtle.digest('SHA-512', combined);
    return crypto.subtle.importKey(
      'raw',
      derived.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      [usage]
    );
  }

  /**
   * Decrypts a produced .qmbak the way importBackup does.
   *
   * The derivation is re-implemented rather than imported because the service
   * exposes no decrypt-to-payload method. Safe here specifically because AES-GCM
   * is authenticated: a wrong key throws instead of returning plausible garbage,
   * so a mistake in this helper cannot become a false pass.
   */
  async function decryptBackup(blob: Blob) {
    const file = JSON.parse(await blob.text());
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(file.iv, 'hex') },
      await deriveKey('decrypt'),
      Buffer.from(file.ciphertext, 'hex')
    );
    const raw = new TextDecoder().decode(plaintext);
    return { file, payload: JSON.parse(raw), raw, bytes: blob.size };
  }

  /** Writes a backup file at an arbitrary version — for back-compat tests. */
  async function makeBackupFile(version: number, payload: unknown) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await deriveKey('encrypt'),
      new TextEncoder().encode(JSON.stringify(payload))
    );
    return JSON.stringify({
      version,
      iv: Buffer.from(iv).toString('hex'),
      ciphertext: Buffer.from(encrypted).toString('hex'),
      createdAt: Date.now(),
    });
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

    return decryptBackup(
      await backupService.exportBackup({ keyset: KEYSET, address: USER_ADDRESS })
    );
  }

  // ── Positive controls ───────────────────────────────────────────────────────
  // If these fail nothing else is interpretable: an empty export would make
  // "no owner key found" trivially true and meaningless.

  it('CONTROL: the export produces a decryptable file with real content', async () => {
    const { file, payload } = await saveThenExport(false);

    expect(file.version).toBe(BACKUP_FORMAT_VERSION);
    expect(payload.conversations).toHaveLength(1);
    expect(payload.conversations[0].address).toBe(PEER_ADDRESS);
    expect(payload.encryption_states.length).toBeGreaterThan(0);
  });

  it('CONTROL: Space ratchet states were already exported before slice 1', async () => {
    // Independent of the key question and load-bearing for the design: the
    // Space-side Triple Ratchet state has always shipped in a .qmbak. Only the
    // keys that make it meaningful were missing.
    const { payload } = await saveThenExport(false);

    expect(
      payload.encryption_states.find(
        (s: any) => s.conversationId === `${SPACE_ID}/${SPACE_ID}`
      )
    ).toBeDefined();
  });

  // ── Slice 1: the behaviour that changed ─────────────────────────────────────

  it('sync OFF: the backup carries every Space key, including `owner`', async () => {
    const { payload, raw } = await saveThenExport(false);

    // The strongest form: the owner key is in the file, wherever it lives.
    expect(raw).toContain(OWNER_PRIVATE_KEY);

    expect(payload.spaces.map((s: any) => s.spaceId)).toEqual([SPACE_ID]);
    expect(payload.space_keys.map((k: any) => k.keyId).sort()).toEqual(
      [...CREATED_SPACE_KEY_IDS].sort()
    );
    expect(
      payload.space_keys.find((k: any) => k.keyId === 'owner').privateKey
    ).toBe(OWNER_PRIVATE_KEY);
  });

  it('sync OFF: the config snapshot is STILL empty — the keys come from the store', async () => {
    // This is the test that keeps the fix honest. The export must work because it
    // reads `space_keys` directly, NOT because something started populating
    // user_config.spaceKeys when sync is off. If that snapshot ever fills in
    // here, the export has quietly re-acquired a dependency on `allowSync` and
    // every other assertion in this file would still pass.
    const { payload } = await saveThenExport(false);

    expect(payload.user_config?.spaceKeys ?? []).toHaveLength(0);
    expect(payload.space_keys.length).toBe(CREATED_SPACE_KEY_IDS.length);
  });

  it('sync ON: same export, same keys — the flag no longer changes the outcome', async () => {
    // Before slice 1 this arm was the control that proved the sync-off arm was
    // looking in the right place. It now pins the real goal: the backup is
    // identical in substance whether sync is on or off.
    const { payload, raw } = await saveThenExport(true);

    expect(raw).toContain(OWNER_PRIVATE_KEY);
    expect(payload.space_keys.map((k: any) => k.keyId).sort()).toEqual(
      [...CREATED_SPACE_KEY_IDS].sort()
    );
    // ...and the sync path still does its own separate thing: the config was
    // published with its spaceKeys assembled as before.
    expect(postedConfigs).toHaveLength(1);
    // But the BACKUP no longer carries that snapshot — it would duplicate the
    // multi-megabyte eval pool already present in `encryption_states`. Key
    // material travels once, from the store that owns it. See the
    // "no weight it cannot use" block.
    expect(payload.user_config.spaceKeys).toBeUndefined();
  });

  // ── Format and back-compat ─────────────────────────────────────────────────

  it('declares per-domain presence, including what it does NOT carry', async () => {
    const { payload } = await saveThenExport(false);

    expect(payload.domains).toMatchObject({
      dm_messages: true,
      dm_conversations: true,
      encryption_states: true,
      user_config: true,
      spaces: true,
      space_keys: true,
      // Still out of scope. Declared false rather than omitted so a restore can
      // say so instead of silently restoring nothing.
      space_messages: false,
    });
  });

  it('a v1 file still imports, and reports that it has no Space keys', async () => {
    // v1 files are on users' disks right now. Refusing them would be the same
    // outcome as having no backup at all.
    const v1 = await makeBackupFile(1, {
      messages: [],
      conversations: [
        {
          conversationId: DM_CONVERSATION_ID,
          type: 'direct',
          timestamp: 1,
          address: PEER_ADDRESS,
          icon: '',
          displayName: 'Peer',
        },
      ],
      encryption_states: [],
    });

    const result = await backupService.importBackup({
      keyset: KEYSET,
      fileContent: v1,
    });

    expect(result.version).toBe(1);
    expect(result.conversationsWritten).toBe(1);
    expect(result.domains).toEqual(V1_DOMAINS);
    expect(result.domains.space_keys).toBe(false);
  });

  it('a file from a NEWER format is refused, not half-restored', async () => {
    // Opposite call from v1: a future file may hold domains this build would
    // silently drop, and a partial restore that looks complete is worse than a
    // clear refusal.
    const future = await makeBackupFile(99, { messages: [], conversations: [] });

    await expect(
      backupService.importBackup({ keyset: KEYSET, fileContent: future })
    ).rejects.toThrow(BackupError);
    await expect(
      backupService.importBackup({ keyset: KEYSET, fileContent: future })
    ).rejects.toThrow(/newer version/i);
  });

  it('domainsOf falls back correctly for a v1 file with no domains block', () => {
    expect(domainsOf({ version: 1 }, { messages: [], conversations: [] } as any)).toEqual(
      V1_DOMAINS
    );
  });

  // ── Size: the number that gates the Space-messages decision ────────────────

  describe('the file carries no weight it cannot use', () => {
    // Both of these were found by exporting on a REAL account: 3 Spaces and 2
    // DMs produced a 17.6 MB file, several times what the per-Space cost
    // predicts. Neither is visible on a seeded database, because a seeded one has
    // no debris and no sync history.

    it('excludes encryption states orphaned by deleted Spaces', async () => {
      // A created Space pre-allocates a ~2 MB eval pool, and deleting the Space
      // has been observed to leak that state rather than remove it. The export
      // read every state unfiltered, so the debris rode along — and it is dead
      // weight by construction, since the restore only rebuilds Spaces present in
      // the file.
      const GHOST = 'QmcfTNSyig9DSfAqSmWXsGLkLiG9TGS87XXpJy3juKbKSs';
      await db.saveEncryptionState(
        {
          conversationId: `${GHOST}/${GHOST}`,
          inboxId: 'QmGhostInbox',
          state: JSON.stringify({ evals: 'e'.repeat(64 * 1024) }),
          timestamp: 900,
        } as any,
        true
      );

      const { payload, raw } = await saveThenExport(false);

      expect(
        payload.encryption_states.map((s: any) => s.conversationId)
      ).not.toContain(`${GHOST}/${GHOST}`);
      expect(raw).not.toContain('e'.repeat(1024));

      // CONTROL: the live Space's own state is still there. Without this the
      // filter could pass by dropping everything.
      expect(
        payload.encryption_states.map((s: any) => s.conversationId)
      ).toContain(`${SPACE_ID}/${SPACE_ID}`);
    });

    it('keeps a DM state whose conversation row does not exist yet', async () => {
      // The gap a reviewer found in the first version of this filter. A DM's
      // encryption state can legitimately exist before its conversation row: if
      // the first frame of a new session is a control message (typing,
      // delivery-ack, profile update) the handler returns before saveMessage
      // creates the row. Matching on the X/X id shape alone called that an
      // orphan and dropped it.
      //
      // Kept now because the state carries `sending_inbox`, which is the same
      // discriminator the receive path uses to tell a DM from a Space.
      // MUST differ from PEER_ADDRESS: that one has a conversation row seeded in
      // beforeEach, so it would be kept by the live-conversation check and this
      // test would pass without the discriminator ever running. Caught by
      // mutation — the first version of this test used PEER_ADDRESS and stayed
      // green with the discriminator removed.
      const ROWLESS_PEER = 'Qmdp5Pt6drCHVWYNhPvcQtHdTgQr2gtCnU2ke83CfWHyvt';
      await db.saveEncryptionState(
        {
          conversationId: `${ROWLESS_PEER}/${ROWLESS_PEER}`,
          inboxId: 'QmRowlessInbox',
          state: JSON.stringify({ sending_inbox: { inbox_public_key: 'x' } }),
          timestamp: 700,
        } as any,
        true
      );

      const { payload } = await saveThenExport(false);

      expect(
        payload.encryption_states.map((s: any) => s.conversationId)
      ).toContain(`${ROWLESS_PEER}/${ROWLESS_PEER}`);
    });

    it('keeps a DM state, which has the same id shape as a Space state', async () => {
      // The filter cannot key on shape alone: a DM conversationId is `X/X` too.
      // Dropping DM states would be a silent data loss dressed up as a size win.
      const { payload } = await saveThenExport(false);

      expect(
        payload.encryption_states.map((s: any) => s.conversationId)
      ).toContain(DM_CONVERSATION_ID);
    });

    it('does not ship the Space eval pool twice via user_config', async () => {
      // With sync ON the stored config carries a per-Space bundle that EMBEDS
      // that Space's encryption state — the same pool already exported under
      // `encryption_states`. It travelled twice in every backup.
      const { payload } = await saveThenExport(true);

      expect(payload.user_config).toBeDefined();
      expect(payload.user_config.spaceKeys).toBeUndefined();

      // CONTROL: the rest of the config still travels, and the key material is
      // still present via the store that owns it.
      expect(payload.user_config.address).toBe(USER_ADDRESS);
      expect(payload.space_keys.map((k: any) => k.keyId)).toContain('owner');
    });
  });

  it('MEASUREMENT: a created Space\'s eval pool dominates the file, and hex doubles it', async () => {
    // Answers §10.4 of the overhaul design without needing a real account export.
    // A created Space pre-allocates ~10k polynomial evals (~2 MB) into its
    // encryption state; a joined one costs ~12-63 KB
    // (2025-12-09-encryption-state-evals-bloat.md, measured on a real account).
    const EVAL_POOL = 2 * 1024 * 1024; // 2 MB, the measured per-created-Space cost

    const lean = await saveThenExport(false);

    // Re-seed the same Space with a realistic eval pool.
    await db.saveEncryptionState(
      {
        conversationId: `${SPACE_ID}/${SPACE_ID}`,
        inboxId: 'QmAddrinbox',
        state: JSON.stringify({ triple_ratchet: 's', evals: 'e'.repeat(EVAL_POOL) }),
        timestamp: 1001,
      } as any,
      true
    );
    const fat = await saveThenExport(false);

    const growth = fat.bytes - lean.bytes;

    // The eval pool passes through to the file essentially intact...
    expect(growth).toBeGreaterThan(EVAL_POOL);

    // ...and then hex encoding of the ciphertext doubles it. This is the finding
    // that matters for the size budget: the .qmbak on disk is ~2x its payload,
    // so a 4 MB account (two created Spaces) yields an ~8 MB download. Asserted
    // as a range rather than a constant so AES-GCM padding/IV noise cannot make
    // it flaky.
    expect(growth).toBeGreaterThan(EVAL_POOL * 1.9);
    expect(growth).toBeLessThan(EVAL_POOL * 2.2);

    // Written straight to stdout: vitest's default reporter swallows console.log,
    // and the point of this test is as much the number as the assertion. Run the
    // file directly to read it off.
    process.stdout.write(
      `\n[backup size] lean=${lean.bytes}B  with-2MB-evals=${fat.bytes}B  ` +
        `growth=${growth}B (${(growth / EVAL_POOL).toFixed(2)}x the pool)\n`
    );
  });
});
