/**
 * Backup restore — Spaces come back, and an import can never make a device worse.
 *
 * Slice 2 of `.agents/issues/.open/2026-08-09-backup-restore-overhaul-design.md`.
 *
 * THE PROPERTY UNDER TEST
 * §4 of the design argues the restore must reconcile **per record**, not per
 * file: a single import is routinely "restore the DMs, touch none of the Spaces"
 * for one device and "add three Spaces" for another. The safety property that
 * falls out is stronger and much easier to test than the case list:
 *
 *     an import is ADDITIVE — it can add what is missing, and can never
 *     overwrite, downgrade or remove what is already there.
 *
 * If that holds, a stale backup, a backup restored onto the wrong device, and a
 * backup imported twice are all automatically safe, with no need to reason about
 * the file's age. So it is asserted as a property (byte-equality of every
 * pre-existing key row) rather than case by case.
 *
 * The blast radius is why: these are Space private keys, including `owner`, which
 * has no other copy anywhere. A restore that quietly rolled one back would be
 * undetectable by using the app.
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

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {
    SealHubEnvelope: vi.fn().mockResolvedValue({ sealed: 'hub-envelope' }),
  },
  channel_raw: {
    js_sign_ed448: vi.fn().mockReturnValue(JSON.stringify('mock-signature')),
    js_verify_ed448: vi.fn().mockReturnValue(JSON.stringify(true)),
    // Echoes back a manifest for the Space that was actually asked for.
    //
    // A fixed spaceId here is NOT good enough, and getting this wrong is subtle:
    // adoptSpaces persists the decrypted MANIFEST (`saveSpace(manifest)`), so a
    // stub returning a constant id writes every Space under that one id. The
    // restore then looks like it worked — the keys land correctly, keyed by the
    // real id — while `getSpace(realId)` stays empty, so the additive guard never
    // fires and a re-import restores the same Space forever. Caught by the
    // import-twice test below, which is precisely why that test exists.
    //
    // The stub reads the id back out of the ciphertext the caller passed, which
    // `getSpaceManifest` below plants for exactly this purpose.
    js_decrypt_inbox_message: vi.fn((argJson: string) => {
      const { ciphertext } = JSON.parse(argJson);
      const spaceId = ciphertext.ciphertext;
      return JSON.stringify([
        ...Buffer.from(JSON.stringify({ spaceId, name: 'S' }), 'utf-8'),
      ]);
    }),
    js_generate_ed448: vi.fn().mockReturnValue(
      JSON.stringify({ public_key: [1, 2, 3], private_key: [4, 5, 6] })
    ),
  },
}));

const SPACE_A = 'QmZDbJ9cy9z1J74DgtGJEQW6yop3j15t6i31KW5McmVKzp';
const SPACE_B = 'QmbWqM1roW69PooJC96TKePsDk7Ssqz3Sb2syp4H98texr';
const USER_ADDRESS = 'QmaNDKajtL35LxRkwWgNn2Sz6mxkJRXxmeXwef4pNxBzUq';

/** A distinct peer for the isolation tests, so they cannot collide with the
 *  deletion-axis describe block's conversation. */
const PEER_FOR_ISOLATION = 'QmcfTNSyig9DSfAqSmWXsGLkLiG9TGS87XXpJy3juKbKSs';

const OWNER_KEY_IN_BACKUP = 'aaaa'.repeat(28);
const OWNER_KEY_ON_DEVICE = 'bbbb'.repeat(28);

const KEYSET = {
  user_key: {
    private_key: new Uint8Array(57).fill(7),
    public_key: new Uint8Array(57).fill(9),
  },
} as any;

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');

  for (const target of [globalThis, global]) {
    Object.defineProperty(target, 'crypto', {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }

  // ⚠️ HARNESS FIX, NOT A PRODUCT BUG. Do not "fix" the app for this.
  //
  // Under vitest's jsdom environment `Buffer instanceof Uint8Array` is FALSE:
  // jsdom installs its own `Uint8Array` global, while Node's Buffer extends
  // Node's. multiformats' `coerce()` does an instanceof check and throws
  // "Unknown type, must be binary type", so `sha256.digest(Buffer.from(...))`
  // — which the real adopt path calls (ConfigService, inbox address derivation)
  // — fails here and nowhere else.
  //
  // In the browser there is one realm and `Buffer` is a polyfill extending that
  // same `Uint8Array`, so the instanceof holds. This path also runs in
  // production on every synced multi-device login, which is independent evidence
  // it is fine there.
  //
  // Point the global at the constructor Buffer actually extends so the two
  // agree. Scoped to this file; vitest isolates environments per file.
  Object.defineProperty(globalThis, 'Uint8Array', {
    value: Object.getPrototypeOf(Buffer.prototype).constructor,
    configurable: true,
    writable: true,
  });
});

describe('Backup restore — Spaces, additive only', () => {
  let db: MessageDB;
  let configService: ConfigService;
  let backupService: BackupService;

  async function freshDb() {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    const next = new MessageDB();
    await next.init();
    return next;
  }

  function wire(target: MessageDB) {
    configService = new ConfigService({
      messageDB: target,
      apiClient: {
        postUserSettings: vi.fn().mockResolvedValue({ data: {} }),
        getUserSettings: vi.fn().mockRejectedValue(new Error('offline')),
        // The restore re-fetches the Space definition rather than trusting the
        // file (design §3, step 4) — these are that fetch.
        getSpace: vi.fn().mockResolvedValue({ data: { registration: 'reg' } }),
        // Plants the requested spaceId in the ciphertext so the decrypt stub can
        // return a manifest describing the right Space — see js_decrypt_inbox_message.
        getSpaceManifest: vi.fn(async (spaceId: string) => ({
          data: {
            space_manifest: JSON.stringify({
              ciphertext: spaceId,
              initialization_vector: 'iv',
              associated_data: 'ad',
            }),
            ephemeral_public_key: 'aabb',
          },
        })),
        postHubAdd: vi.fn().mockResolvedValue({ data: {} }),
      },
      spaceInfo: { current: {} },
      enqueueOutbound: vi.fn(),
      sendHubMessage: vi.fn().mockResolvedValue('hub-msg'),
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    } as any);

    backupService = new BackupService({
      messageDB: target,
      adoptSpaces: (args) => configService.adoptSpaces(args),
    });
  }

  beforeEach(async () => {
    db = await freshDb();
    localStorage.clear();
    wire(db);
  });

  async function seedSpace(
    target: MessageDB,
    spaceId: string,
    ownerPrivateKey: string
  ) {
    await target.saveSpace({ spaceId, name: 'S' } as any);
    for (const [keyId, privateKey] of [
      ['config', '11'.repeat(57)],
      ['hub', '22'.repeat(57)],
      ['owner', ownerPrivateKey],
    ] as const) {
      await target.saveSpaceKey({
        spaceId,
        keyId,
        publicKey: 'pub-' + keyId,
        privateKey,
        ...(keyId === 'hub' ? { address: 'QmHub' + spaceId.slice(2, 8) } : {}),
      } as any);
    }
    await target.saveEncryptionState(
      {
        conversationId: `${spaceId}/${spaceId}`,
        inboxId: 'QmInbox' + spaceId.slice(2, 8),
        state: JSON.stringify({ triple_ratchet: spaceId }),
        timestamp: 1000,
      } as any,
      true
    );
  }

  /** Produces a real .qmbak from whatever is currently in `source`. */
  async function exportFrom(source: MessageDB) {
    const svc = new BackupService({ messageDB: source });
    const blob = await svc.exportBackup({ keyset: KEYSET, address: USER_ADDRESS });
    return blob.text();
  }

  // ── The headline behaviour ─────────────────────────────────────────────────

  it('restores a Space onto a wiped device', async () => {
    await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
    const file = await exportFrom(db);

    // Wipe: new device, same account, nothing but the file.
    db = await freshDb();
    wire(db);
    expect(await db.getSpaces()).toHaveLength(0);

    const report = await backupService.importBackup({
      keyset: KEYSET,
      fileContent: file,
    });

    expect(report.spacesRestored).toEqual([SPACE_A]);
    expect(report.spacesAlreadyPresent).toEqual([]);

    // The irreplaceable part actually landed.
    const owner = (await db.getSpaceKeys(SPACE_A)).find((k) => k.keyId === 'owner');
    expect(owner?.privateKey).toBe(OWNER_KEY_IN_BACKUP);
  });

  // ── The additive property ──────────────────────────────────────────────────

  it('PROPERTY: an older backup cannot overwrite a live Space\'s keys', async () => {
    // The dangerous case. The file holds one owner key, the device holds a
    // DIFFERENT one for the same Space — as it would if the key were rotated, or
    // if the backup were simply stale. The device's copy must win untouched.
    await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
    const staleFile = await exportFrom(db);

    db = await freshDb();
    wire(db);
    await seedSpace(db, SPACE_A, OWNER_KEY_ON_DEVICE);

    const before = await db.getSpaceKeys(SPACE_A);

    const report = await backupService.importBackup({
      keyset: KEYSET,
      fileContent: staleFile,
    });

    expect(report.spacesRestored).toEqual([]);
    expect(report.spacesAlreadyPresent).toEqual([SPACE_A]);

    // Byte-equality of every pre-existing row, not just the owner key: asserted
    // as a property so a future change cannot quietly alter a different key.
    const after = await db.getSpaceKeys(SPACE_A);
    expect(after).toEqual(before);
    expect(
      after.find((k) => k.keyId === 'owner')?.privateKey
    ).toBe(OWNER_KEY_ON_DEVICE);
  });

  it('PROPERTY: a partial device gets only what it is missing', async () => {
    // The case a whole-file "merge vs restore" mode cannot express: within one
    // import, one Space must be left alone and another must be restored.
    await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
    await seedSpace(db, SPACE_B, OWNER_KEY_IN_BACKUP);
    const file = await exportFrom(db);

    db = await freshDb();
    wire(db);
    await seedSpace(db, SPACE_A, OWNER_KEY_ON_DEVICE); // has A, missing B

    const report = await backupService.importBackup({
      keyset: KEYSET,
      fileContent: file,
    });

    expect(report.spacesRestored).toEqual([SPACE_B]);
    expect(report.spacesAlreadyPresent).toEqual([SPACE_A]);
    expect(
      (await db.getSpaceKeys(SPACE_A)).find((k) => k.keyId === 'owner')?.privateKey
    ).toBe(OWNER_KEY_ON_DEVICE);
  });

  it('PROPERTY: importing the same file twice is a no-op the second time', async () => {
    await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
    const file = await exportFrom(db);

    db = await freshDb();
    wire(db);

    const first = await backupService.importBackup({ keyset: KEYSET, fileContent: file });
    const keysAfterFirst = await db.getSpaceKeys(SPACE_A);

    const second = await backupService.importBackup({ keyset: KEYSET, fileContent: file });

    expect(first.spacesRestored).toEqual([SPACE_A]);
    expect(second.spacesRestored).toEqual([]);
    expect(second.spacesAlreadyPresent).toEqual([SPACE_A]);
    expect(await db.getSpaceKeys(SPACE_A)).toEqual(keysAfterFirst);
  });

  // ── Refusing to write something broken ─────────────────────────────────────

  it('skips a Space whose encryption state is missing, rather than writing a corrupt one', async () => {
    // adoptSpaces persists `{ ...encryptionState, inboxId }`. With no state that
    // writes a row that looks present and can decrypt nothing — worse than not
    // restoring, because it would also block a later correct restore via the
    // `if (!existingSpace)` guard.
    await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
    const file = await exportFrom(db);

    // Strip the Space's encryption state out of the payload, keeping the keys.
    const svc = new BackupService({ messageDB: db });
    const parsed = JSON.parse(file);
    const decrypted = await decryptPayload(parsed);
    decrypted.encryption_states = decrypted.encryption_states.filter(
      (s: any) => s.conversationId !== `${SPACE_A}/${SPACE_A}`
    );
    const tampered = await reencrypt(parsed, decrypted);
    void svc;

    db = await freshDb();
    wire(db);

    const report = await backupService.importBackup({
      keyset: KEYSET,
      fileContent: tampered,
    });

    expect(report.spacesRestored).toEqual([]);
    expect(report.spacesFailed).toEqual([
      { spaceId: SPACE_A, reason: 'no encryption state in backup' },
    ]);
    expect(await db.getSpaces()).toHaveLength(0);
  });

  // ── Deletions must survive a restore ───────────────────────────────────────

  describe('a restore must not undo a deletion made after the backup', () => {
    // The second axis of safety, and the one "additive" does NOT cover.
    // Additive protects state the user CHANGED; nothing about it protects state
    // the user REMOVED. Restoring a backup taken before a deletion would
    // re-`put()` the deleted message and silently undo a deliberate act.
    const PEER = 'QmcfTNSyig9DSfAqSmWXsGLkLiG9TGS87XXpJy3juKbKSs';
    const CONV = `${PEER}/${PEER}`;

    async function seedDm(target: MessageDB, messageId: string) {
      await target.saveConversation({
        conversationId: CONV,
        type: 'direct',
        timestamp: 1,
        address: PEER,
        icon: '',
        displayName: 'Peer',
      } as any);
      await target.saveMessage(
        {
          messageId,
          spaceId: PEER,
          channelId: PEER,
          createdDate: 1000,
          content: { type: 'post', body: 'secret' },
        } as any,
        PEER,
        PEER,
        'direct'
      );
    }

    it('a DM deleted after the backup stays deleted', async () => {
      await seedDm(db, 'msg-regrettable');
      const file = await exportFrom(db);

      // The user changes their mind and deletes it.
      await db.deleteMessage('msg-regrettable');
      expect(await db.getMessage({ spaceId: PEER, channelId: PEER, messageId: 'msg-regrettable' }))
        .toBeUndefined();

      // Later, they restore the older backup for unrelated reasons.
      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(
        await db.getMessage({ spaceId: PEER, channelId: PEER, messageId: 'msg-regrettable' })
      ).toBeUndefined();
      expect(report.messagesSkippedAsDeleted).toBe(1);
      expect(report.messagesWritten).toBe(0);
    });

    it('CONTROL: a message that was never deleted DOES restore', async () => {
      // Without this, the test above would pass just as well if the import
      // silently wrote nothing at all.
      await seedDm(db, 'msg-wanted');
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.messagesWritten).toBe(1);
      expect(report.messagesSkippedAsDeleted).toBe(0);
      expect(
        await db.getMessage({ spaceId: PEER, channelId: PEER, messageId: 'msg-wanted' })
      ).toBeDefined();
    });

    it('a whole conversation deleted after the backup stays deleted', async () => {
      // The case the single-message tests missed entirely. "Delete Chat" is the
      // common deletion action and it goes through a DIFFERENT path
      // (deleteMessagesForConversation + deleteConversation) that wrote no
      // tombstones at all, so restoring an older backup silently brought the
      // entire chat back.
      await seedDm(db, 'msg-in-deleted-chat');
      const file = await exportFrom(db);

      await db.deleteMessagesForConversation(CONV);
      await db.deleteConversation(CONV);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      // Neither the messages nor the conversation row come back.
      expect(
        await db.getMessage({ spaceId: PEER, channelId: PEER, messageId: 'msg-in-deleted-chat' })
      ).toBeUndefined();
      // getConversation returns a wrapper object, so assert on the payload:
      // the wrapper is truthy even when nothing was found.
      expect(
        (await db.getConversation({ conversationId: CONV }))?.conversation
      ).toBeUndefined();
      expect(report.conversationsSkippedAsDeleted).toBe(1);
      expect(report.conversationsWritten).toBe(0);
      expect(report.messagesWritten).toBe(0);
    });

    it('CONTROL: a conversation that was never deleted DOES restore', async () => {
      await seedDm(db, 'msg-kept');
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.conversationsWritten).toBe(1);
      expect(report.conversationsSkippedAsDeleted).toBe(0);
      expect(
        (await db.getConversation({ conversationId: CONV }))?.conversation
      ).toBeDefined();
    });

    it('starting the chat again clears the tombstone, so it can restore once more', async () => {
      // The peer writes again, or the user re-opens the chat. saveConversation is
      // the choke point that clears the record. The import writes to the store
      // directly and so cannot clear its own gate.
      await seedDm(db, 'msg-x');
      const file = await exportFrom(db);

      await db.deleteMessagesForConversation(CONV);
      await db.deleteConversation(CONV);
      expect(await db.getDeletedConversationIds()).toContain(CONV);

      await db.saveConversation({
        conversationId: CONV,
        type: 'direct',
        timestamp: 5,
        address: PEER,
        icon: '',
        displayName: 'Peer',
      } as any);
      expect(await db.getDeletedConversationIds()).not.toContain(CONV);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });
      expect(report.conversationsSkippedAsDeleted).toBe(0);
    });

    it('messages from a deleted chat stay gone even after the chat resumes', async () => {
      // The case that makes the PER-MESSAGE tombstones in the bulk-delete path
      // load-bearing rather than redundant with the conversation gate.
      //
      // Delete the chat → both tombstones written. The peer then writes again,
      // which clears the CONVERSATION tombstone (the chat legitimately exists
      // once more). Now restore an old backup: the conversation gate no longer
      // blocks anything, so only the per-message tombstones stand between the
      // user and the resurrection of messages they deleted.
      //
      // Found by mutation: removing the bulk tombstone write left every other
      // test in this file green.
      await seedDm(db, 'msg-deleted-then-chat-resumed');
      const file = await exportFrom(db);

      await db.deleteMessagesForConversation(CONV);
      await db.deleteConversation(CONV);

      // The peer writes again — chat is back, conversation tombstone cleared.
      await db.saveConversation({
        conversationId: CONV,
        type: 'direct',
        timestamp: 9,
        address: PEER,
        icon: '',
        displayName: 'Peer',
      } as any);
      expect(await db.getDeletedConversationIds()).not.toContain(CONV);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(
        await db.getMessage({
          spaceId: PEER,
          channelId: PEER,
          messageId: 'msg-deleted-then-chat-resumed',
        })
      ).toBeUndefined();
      expect(report.messagesSkippedAsDeleted).toBe(1);
    });

    it('deleting a DM now writes a tombstone at all', async () => {
      // Pins the behaviour change this relies on. Tombstones used to be written
      // for channel messages only, on the reasoning that DMs have no sync
      // mechanism to re-add them — which backup restore made false.
      await seedDm(db, 'msg-tombstoned');
      await db.deleteMessage('msg-tombstoned');

      expect(await db.isMessageDeleted('msg-tombstoned')).toBe(true);
      expect(await db.getDeletedMessageIds()).toContain('msg-tombstoned');
    });
  });

  describe('a restore must not re-join a Space the user left', () => {
    // The Space half of the deletion axis, and the one with an outward-facing
    // consequence: adoptSpaces calls postHubAdd and sends a sync control
    // message, so re-adding a Space the user was kicked from would re-announce
    // them to the Space that removed them.

    it('a Space left after the backup is not restored', async () => {
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      // The user leaves. (Recorded by SpaceService/MessageService in the app;
      // called directly here so the test does not depend on those flows.)
      await db.deleteSpace(SPACE_A);
      await db.markSpaceDeparted({ spaceId: SPACE_A, reason: 'left' });

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.spacesRestored).toEqual([]);
      expect(report.spacesFailed).toEqual([
        { spaceId: SPACE_A, reason: 'you left this Space after this backup was taken' },
      ]);
      expect(await db.getSpaces()).toHaveLength(0);
    });

    it('being removed is reported differently from leaving', async () => {
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      await db.deleteSpace(SPACE_A);
      await db.markSpaceDeparted({ spaceId: SPACE_A, reason: 'removed' });

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.spacesFailed[0].reason).toMatch(/removed from this Space/);
    });

    it('CONTROL: a Space that was never departed DOES restore', async () => {
      // Without this the gate could pass by restoring nothing at all.
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.spacesRestored).toEqual([SPACE_A]);
    });

    it('rejoining clears the departure, so the Space can be restored again', async () => {
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      await db.deleteSpace(SPACE_A);
      await db.markSpaceDeparted({ spaceId: SPACE_A, reason: 'left' });
      // The user is invited back (InvitationService clears the record here).
      await db.clearSpaceDeparture(SPACE_A);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.spacesRestored).toEqual([SPACE_A]);
    });

    it('the gate does NOT apply to config sync — only to stale backup files', async () => {
      // adoptSpaces serves both paths. A synced config is the account's CURRENT
      // state, published after the departure; a backup is stale by construction.
      // Gating sync on departures would break leaving on one device and
      // rejoining on another, so the gate lives in BackupService, not here.
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const bundle = {
        spaceId: SPACE_A,
        encryptionState: (
          await db.getEncryptionStates({ conversationId: `${SPACE_A}/${SPACE_A}` })
        )[0],
        keys: await db.getSpaceKeys(SPACE_A),
      };

      await db.deleteSpace(SPACE_A);
      await db.markSpaceDeparted({ spaceId: SPACE_A, reason: 'left' });

      const adopted = await configService.adoptSpaces({ spaceKeys: [bundle] as any });

      expect(adopted.restored).toEqual([SPACE_A]);
    });
  });

  describe('failure isolation and reporting', () => {
    // Everything here was found by code review, not by a failing test — the
    // properties that were mutation-tested held, and the reporting around them
    // was where the gaps were.

    it('a Space whose manifest cannot be fetched is REPORTED, not silently dropped', async () => {
      // It previously fell out of restored/alreadyPresent/failed alike, while its
      // keys — saved a few lines earlier — were already on disk with no `spaces`
      // row to render them. A user saw a clean restore with a Space missing.
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);
      (configService as any).apiClient.getSpaceManifest = vi
        .fn()
        .mockResolvedValue(undefined);

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.spacesRestored).toEqual([]);
      expect(report.spacesFailed).toEqual([
        { spaceId: SPACE_A, reason: 'could not fetch Space manifest' },
      ]);
    });

    it('one failing Space does not abandon the rest of the batch', async () => {
      // The per-Space try/catch promises this, but the getSpace() read sat
      // outside it, so a single transient IndexedDB failure threw straight out
      // and discarded results for every Space already restored.
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      await seedSpace(db, SPACE_B, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);

      const realGetSpace = db.getSpace.bind(db);
      let calls = 0;
      db.getSpace = vi.fn(async (id: string) => {
        calls += 1;
        if (calls === 1) throw new Error('transient IDB failure');
        return realGetSpace(id);
      }) as any;

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      // One reported as failed, the other still restored — not an aborted batch.
      expect(report.spacesFailed).toHaveLength(1);
      expect(report.spacesRestored).toHaveLength(1);
      expect(report.spacesFailed[0].reason).toMatch(/transient IDB failure/);
    });

    it('a Space-restore failure does not erase an already-written DM restore', async () => {
      // importDMData commits at step 4; step 5 used to be unguarded, so any throw
      // rejected the whole call and the user was told "Failed to import backup"
      // about an import whose messages had landed and were staying.
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      await db.saveConversation({
        conversationId: `${PEER_FOR_ISOLATION}/${PEER_FOR_ISOLATION}`,
        type: 'direct',
        timestamp: 1,
        address: PEER_FOR_ISOLATION,
        icon: '',
        displayName: 'Peer',
      } as any);
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);
      db.getDepartedSpaces = vi
        .fn()
        .mockRejectedValue(new Error('departure read exploded')) as any;

      const report = await backupService.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      // The DM half survived and is reported, rather than the whole call rejecting.
      expect(report.conversationsWritten).toBe(1);
      expect(report.spacesFailed).toEqual([
        { spaceId: '*', reason: 'departure read exploded' },
      ]);
    });

    it('a backup with Space keys but no adoptSpaces reports them, rather than ignoring them', async () => {
      await seedSpace(db, SPACE_A, OWNER_KEY_IN_BACKUP);
      const file = await exportFrom(db);

      db = await freshDb();
      wire(db);
      // Export-only construction — the configuration the constructor documents.
      const noAdopt = new BackupService({ messageDB: db });

      const report = await noAdopt.importBackup({
        keyset: KEYSET,
        fileContent: file,
      });

      expect(report.spacesRestored).toEqual([]);
      expect(report.spacesFailed).toEqual([
        {
          spaceId: SPACE_A,
          reason: 'Space restore is not available in this context',
        },
      ]);
    });
  });

  it('a v1 file restores DMs and reports that Spaces were not in it', async () => {
    // Regression guard for the back-compat promise: v1 files predate Space key
    // capture, and must still import rather than be refused.
    const v1 = await makeV1File();

    const report = await backupService.importBackup({
      keyset: KEYSET,
      fileContent: v1,
    });

    expect(report.version).toBe(1);
    expect(report.domains.space_keys).toBe(false);
    expect(report.spacesRestored).toEqual([]);
    expect(await db.getSpaces()).toHaveLength(0);
  });

  // ── helpers ────────────────────────────────────────────────────────────────

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

  async function decryptPayload(file: any) {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(file.iv, 'hex') },
      await deriveKey('decrypt'),
      Buffer.from(file.ciphertext, 'hex')
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  async function reencrypt(file: any, payload: unknown) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await deriveKey('encrypt'),
      new TextEncoder().encode(JSON.stringify(payload))
    );
    return JSON.stringify({
      ...file,
      iv: Buffer.from(iv).toString('hex'),
      ciphertext: Buffer.from(encrypted).toString('hex'),
    });
  }

  async function makeV1File() {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await deriveKey('encrypt'),
      new TextEncoder().encode(
        JSON.stringify({ messages: [], conversations: [], encryption_states: [] })
      )
    );
    return JSON.stringify({
      version: 1,
      iv: Buffer.from(iv).toString('hex'),
      ciphertext: Buffer.from(encrypted).toString('hex'),
      createdAt: Date.now(),
    });
  }
});
