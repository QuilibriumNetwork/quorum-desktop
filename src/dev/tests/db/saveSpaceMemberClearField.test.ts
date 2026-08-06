import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDB, type SpaceMemberRow } from '../../../db/messages';

// `saveSpaceMember` merges rather than replaces, and DROPS explicit
// `undefined`s so a partially-populated row (the shape a sync delta arrives in)
// cannot punch holes in fields it does not carry. That is deliberate and must
// stay — it is the 2026-08-01 fix for the delta erasing the global identity
// slot.
//
// The cost, discovered the same day: the row then has NO WAY TO EXPRESS
// "remove this field". `spaceTag` is the field that needs it, because a tag
// DELETION is signalled by absence on the wire — the sender omits `spaceTag`
// entirely — and both update-profile receive handlers translate that absence
// into `participant.spaceTag = undefined`. After the merge fix that assignment
// is silently discarded, so an owner-deleted tag renders on every other
// member's roster forever.
//
// Hence an explicit `clearFields`. Absence still means "no change" (the safe
// default for every partial writer); a caller that genuinely means "remove
// this" now has to say so.
//
// See 2026-08-01-space-tag-can-no-longer-be-cleared-from-a-member-roster.md under .agents/issues/

const SPACE = 'space-1';
const MEMBER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const TAG = { letters: 'QUIL', url: 'https://example.test/tag.png', spaceId: SPACE };

const taggedRow = (): SpaceMemberRow =>
  ({
    user_address: MEMBER,
    inbox_address: 'inbox-1',
    global_display_name: 'Ada Lovelace',
    global_user_icon: 'data:image/jpeg;base64,/9j/REAL',
    globalProfileTimestamp: 5000,
    spaceTag: TAG,
    joinedAt: 1000,
  }) as unknown as SpaceMemberRow;

describe('MessageDB.saveSpaceMember — clearing a field', () => {
  let db: MessageDB;

  beforeEach(async () => {
    const FDBFactory = (await import('fake-indexeddb/lib/FDBFactory')).default;
    globalThis.indexedDB = new FDBFactory();
    db = new MessageDB();
    await db.init();
  });

  it('stores a space tag in the first place', async () => {
    await db.saveSpaceMember(SPACE, taggedRow());
    expect((await db.getSpaceMember(SPACE, MEMBER)).spaceTag).toEqual(TAG);
  });

  // THE REGRESSION: this is exactly what the update-profile receive handler
  // does when the owner has deleted the tag.
  it('removes the tag when the caller asks for it explicitly', async () => {
    await db.saveSpaceMember(SPACE, taggedRow());

    const row = await db.getSpaceMember(SPACE, MEMBER);
    row.spaceTag = undefined;
    await db.saveSpaceMember(SPACE, row, { clearFields: ['spaceTag'] });

    expect((await db.getSpaceMember(SPACE, MEMBER)).spaceTag).toBeUndefined();
  });

  // The property from the earlier fix that must NOT regress: without an
  // explicit request, an absent field means "no change".
  it('still preserves an absent field when no clear is requested', async () => {
    await db.saveSpaceMember(SPACE, taggedRow());
    await db.saveSpaceMember(SPACE, {
      user_address: MEMBER,
      inbox_address: 'inbox-1',
    } as unknown as SpaceMemberRow);

    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.spaceTag).toEqual(TAG);
    expect(row.global_display_name).toBe('Ada Lovelace');
  });

  it('clears only the named field, leaving the identity slots alone', async () => {
    await db.saveSpaceMember(SPACE, taggedRow());

    const row = await db.getSpaceMember(SPACE, MEMBER);
    row.spaceTag = undefined;
    await db.saveSpaceMember(SPACE, row, { clearFields: ['spaceTag'] });

    const after = await db.getSpaceMember(SPACE, MEMBER);
    expect(after.global_display_name).toBe('Ada Lovelace');
    expect(after.global_user_icon).toBe('data:image/jpeg;base64,/9j/REAL');
    expect(after.globalProfileTimestamp).toBe(5000);
    expect(after.joinedAt).toBe(1000);
  });

  it('is a no-op on a field that was never set', async () => {
    await db.saveSpaceMember(SPACE, {
      user_address: MEMBER,
      inbox_address: 'inbox-1',
      global_display_name: 'Ada Lovelace',
    } as unknown as SpaceMemberRow);

    await db.saveSpaceMember(
      SPACE,
      { user_address: MEMBER, inbox_address: 'inbox-1' } as unknown as SpaceMemberRow,
      { clearFields: ['spaceTag'] }
    );

    const row = await db.getSpaceMember(SPACE, MEMBER);
    expect(row.spaceTag).toBeUndefined();
    expect(row.global_display_name).toBe('Ada Lovelace');
  });

  it('creates a brand-new row unharmed when a clear is requested', async () => {
    await db.saveSpaceMember(
      SPACE,
      { user_address: MEMBER, inbox_address: 'inbox-1' } as unknown as SpaceMemberRow,
      { clearFields: ['spaceTag'] }
    );
    expect((await db.getSpaceMember(SPACE, MEMBER)).user_address).toBe(MEMBER);
  });

  // A clear must not leak across members or spaces — the key is composite and
  // the merge reads the row back before writing it.
  it('does not clear the same field on another member', async () => {
    const OTHER = 'QmOtherMemberBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    await db.saveSpaceMember(SPACE, taggedRow());
    await db.saveSpaceMember(SPACE, {
      ...taggedRow(),
      user_address: OTHER,
    } as unknown as SpaceMemberRow);

    const row = await db.getSpaceMember(SPACE, MEMBER);
    row.spaceTag = undefined;
    await db.saveSpaceMember(SPACE, row, { clearFields: ['spaceTag'] });

    expect((await db.getSpaceMember(SPACE, OTHER)).spaceTag).toEqual(TAG);
  });

  it('does not clear the same member in another space', async () => {
    await db.saveSpaceMember(SPACE, taggedRow());
    await db.saveSpaceMember('space-2', taggedRow());

    const row = await db.getSpaceMember(SPACE, MEMBER);
    row.spaceTag = undefined;
    await db.saveSpaceMember(SPACE, row, { clearFields: ['spaceTag'] });

    expect((await db.getSpaceMember('space-2', MEMBER)).spaceTag).toEqual(TAG);
  });
});
