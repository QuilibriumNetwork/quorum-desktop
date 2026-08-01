import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB, type SpaceMemberRow } from '../../../db/messages';

// `db.saveSpaceMember` does a full-row `store.put`, so it writes exactly the
// object it is handed and everything absent from that object is destroyed.
//
// That matters because the space SYNC path feeds it members reconstructed from
// the wire, and the wire shape (shared `SpaceMember`) has no global slot at all:
// the desktop adapter's dbMemberToShared drops `global_display_name`,
// `global_user_icon`, `global_bio`, `bio` and both profile timestamps. So
// applying a member delta could erase the very identity that renders.
//
// The global slot is what renders for most members: the follow-global work
// (2026-07-16) deliberately stopped stamping the per-space OVERRIDE fields, so
// they are empty unless someone set a real per-space override.
//
// See .agents/bugs/2026-08-01-space-sync-member-delta-blind-to-and-erases-global-slot.md

const SPACE = 'space-1';
const MEMBER = 'QmNSr2YL6iLho1CQfRNikQRs2mBxGQRSL2CXYmtKL5ihUB';

/** A member as it exists locally: global identity set, no per-space override. */
const localRow = (): SpaceMemberRow =>
  ({
    user_address: MEMBER,
    inbox_address: 'inbox-1',
    // Override slot deliberately empty — the normal state post-follow-global.
    display_name: '',
    user_icon: '',
    // Global slot: the identity that actually renders.
    global_display_name: 'Ada Lovelace',
    global_user_icon: 'data:image/jpeg;base64,/9j/REAL',
    global_bio: 'mathematician',
    globalProfileTimestamp: 5000,
    profileTimestamp: 4000,
    joinedAt: 1000,
  }) as unknown as SpaceMemberRow;

/**
 * The same member as the sync delta reconstructs it: everything the shared
 * `SpaceMember` type can carry, and nothing it cannot. Mirrors
 * MessageService.ts's member-delta apply, which spreads the wire member and
 * preserves only `joinedAt`.
 */
const deltaShapedRow = (): SpaceMemberRow =>
  ({
    user_address: MEMBER,
    inbox_address: 'inbox-1',
    display_name: '',
    user_icon: '',
    joinedAt: 1000,
  }) as unknown as SpaceMemberRow;

describe('MessageDB.saveSpaceMember — the global identity slot survives a sync delta', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init();
  });

  it('stores the global slot in the first place', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.global_display_name).toBe('Ada Lovelace');
    expect(row.global_user_icon).toBe('data:image/jpeg;base64,/9j/REAL');
  });

  // THE BUG: a member delta carries no global slot, and a full-row put erases
  // whatever it does not mention.
  it('does not erase the global slot when a delta-shaped row is applied', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    await db.saveSpaceMember(SPACE, deltaShapedRow());

    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.global_display_name).toBe('Ada Lovelace');
    expect(row.global_user_icon).toBe('data:image/jpeg;base64,/9j/REAL');
  });

  it('does not erase the per-slot staleness guards either', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    await db.saveSpaceMember(SPACE, deltaShapedRow());

    const row = await db.getSpaceMember(SPACE, MEMBER);
    // Without these an out-of-order rebroadcast can let an older value win.
    expect(row.globalProfileTimestamp).toBe(5000);
    expect(row.profileTimestamp).toBe(4000);
  });

  it('does not erase the bio', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    await db.saveSpaceMember(SPACE, deltaShapedRow());
    expect((await db.getSpaceMember(SPACE, MEMBER)).global_bio).toBe('mathematician');
  });

  // The other half of the rule: a real incoming value must still win, or the
  // roster could never be updated at all.
  it('still applies a REAL incoming override', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    await db.saveSpaceMember(SPACE, {
      ...deltaShapedRow(),
      display_name: 'Ada (this space)',
      user_icon: 'data:image/jpeg;base64,/9j/OVERRIDE',
    } as unknown as SpaceMemberRow);

    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.display_name).toBe('Ada (this space)');
    expect(row.user_icon).toBe('data:image/jpeg;base64,/9j/OVERRIDE');
    // ...without collateral damage to the global slot.
    expect(row.global_display_name).toBe('Ada Lovelace');
  });

  it('still applies a REAL incoming global identity (a rename must land)', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    await db.saveSpaceMember(SPACE, {
      ...localRow(),
      global_display_name: 'Ada L.',
      globalProfileTimestamp: 9000,
    } as unknown as SpaceMemberRow);

    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.global_display_name).toBe('Ada L.');
    expect(row.globalProfileTimestamp).toBe(9000);
  });

  it('creates a brand-new row from a delta with no prior local state', async () => {
    await db.saveSpaceMember(SPACE, deltaShapedRow());
    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.user_address).toBe(MEMBER);
    expect(row.global_display_name).toBeUndefined();
  });

  it('is per-space — one space does not leak into another', async () => {
    await db.saveSpaceMember(SPACE, localRow());
    await db.saveSpaceMember('space-2', deltaShapedRow());
    expect((await db.getSpaceMember(SPACE, MEMBER)).global_display_name).toBe('Ada Lovelace');
  });
});
