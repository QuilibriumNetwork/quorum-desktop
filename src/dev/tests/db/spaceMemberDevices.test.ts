import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB } from '../../../db/messages';
import type { SpaceMemberDevice } from '@quilibrium/quorum-shared';

// Validates the DB v14 migration: the space_member_devices store is created and
// its CRUD (used by the per-device signing-key admission handlers) works against
// a real (fake-indexeddb) database — i.e. opening the DB at the new version
// doesn't throw and the store behaves as the resolver expects.
describe('MessageDB - space_member_devices store (v14)', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init(); // opens at DB_VERSION 14 → runs the onupgradeneeded chain
  });

  const device = (over: Partial<SpaceMemberDevice> = {}): SpaceMemberDevice => ({
    spaceId: 'space-1',
    userAddress: 'alice',
    deviceInboxAddress: 'dev-1',
    inboxAddress: 'signing-addr-1',
    spaceKeyPublicKey: 'pub-1',
    timestamp: 1000,
    revoked: false,
    ...over,
  });

  it('opens at v14 and starts with an empty store', async () => {
    expect(await db.getSpaceMemberDevices('space-1')).toEqual([]);
    expect(await db.getSpaceMemberDevice('space-1', 'dev-1')).toBeUndefined();
  });

  it('saves and retrieves an admission by device tag', async () => {
    await db.saveSpaceMemberDevice(device());
    expect(await db.getSpaceMemberDevice('space-1', 'dev-1')).toMatchObject({
      userAddress: 'alice',
      inboxAddress: 'signing-addr-1',
    });
  });

  it('upserts on the same (spaceId, deviceInboxAddress) key', async () => {
    await db.saveSpaceMemberDevice(device({ timestamp: 1000 }));
    await db.saveSpaceMemberDevice(
      device({ timestamp: 2000, spaceKeyPublicKey: 'pub-2', inboxAddress: 'signing-addr-2' })
    );
    const all = await db.getSpaceMemberDevices('space-1');
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ timestamp: 2000, inboxAddress: 'signing-addr-2' });
  });

  it('scopes getSpaceMemberDevices to the requested space', async () => {
    await db.saveSpaceMemberDevice(device({ spaceId: 'space-1', deviceInboxAddress: 'd1' }));
    await db.saveSpaceMemberDevice(device({ spaceId: 'space-2', deviceInboxAddress: 'd2' }));
    const s1 = await db.getSpaceMemberDevices('space-1');
    expect(s1).toHaveLength(1);
    expect(s1[0].deviceInboxAddress).toBe('d1');
  });

  it('returns every device tag for a space, including base58/hex-style tags', async () => {
    // Real device tags are base58btc; assert the key range captures a realistic set.
    const tags = ['1abc', 'QmZzz', 'zzz9', 'AAAA'];
    for (const t of tags) {
      await db.saveSpaceMemberDevice(device({ deviceInboxAddress: t }));
    }
    const all = await db.getSpaceMemberDevices('space-1');
    expect(all.map((d) => d.deviceInboxAddress).sort()).toEqual([...tags].sort());
  });

  it('stores a revocation tombstone (revoked row) alongside live admissions', async () => {
    await db.saveSpaceMemberDevice(device({ deviceInboxAddress: 'live', revoked: false }));
    await db.saveSpaceMemberDevice(
      device({ deviceInboxAddress: 'dead', revoked: true, inboxAddress: '' })
    );
    const all = await db.getSpaceMemberDevices('space-1');
    expect(all).toHaveLength(2);
    expect(all.find((d) => d.deviceInboxAddress === 'dead')?.revoked).toBe(true);
  });
});
