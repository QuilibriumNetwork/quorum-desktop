import { describe, it, expect, vi } from 'vitest';
import { buildSpaceOwnerFetcher } from '@/hooks/queries/spaceOwner/buildSpaceOwnerFetcher';
import type { MessageDB } from '@/db/messages';

/**
 * Ownership is possession of the `owner` key slot, and nothing else.
 *
 * There is no ownership flag on the Space record, no server-side owner lookup a client
 * can ask, and no ownership transfer. This fetcher is therefore the single gate in
 * front of every owner-only surface: the Space settings tabs, the owner entries in the
 * Space context menu, and the withholding of "Leave" from owners.
 *
 * It is pinned because the wrong answer shipped for a long time right next to it —
 * `useSpaceManagement` returned a hardcoded `const isOwner = true`, which would grant
 * owner UI to every member. That stub is now deleted, and these tests exist so the
 * surviving implementation cannot drift into the same shape unnoticed.
 */

const dbWithKeys = (keys: Record<string, unknown>) =>
  ({
    getSpaceKey: vi.fn(async (spaceId: string, keyId: string) => keys[`${spaceId}:${keyId}`]),
  }) as unknown as MessageDB;

const SPACE_ID = 'space-under-test';

describe('buildSpaceOwnerFetcher', () => {
  it('is false when this device holds no owner key for the Space', async () => {
    const messageDB = dbWithKeys({});

    await expect(buildSpaceOwnerFetcher({ messageDB, spaceId: SPACE_ID })()).resolves.toBe(
      false
    );
  });

  it('is false on a member device that holds every other key for the Space', async () => {
    // A joined member legitimately holds the space, config, hub and inbox keys. Only
    // the owner slot is absent, and only that slot decides ownership.
    const messageDB = dbWithKeys({
      [`${SPACE_ID}:${SPACE_ID}`]: { privateKey: 'x' },
      [`${SPACE_ID}:config`]: { privateKey: 'x' },
      [`${SPACE_ID}:hub`]: { privateKey: 'x' },
      [`${SPACE_ID}:inbox`]: { privateKey: 'x' },
    });

    await expect(buildSpaceOwnerFetcher({ messageDB, spaceId: SPACE_ID })()).resolves.toBe(
      false
    );
  });

  it('is true once the owner key is present', async () => {
    const messageDB = dbWithKeys({ [`${SPACE_ID}:owner`]: { privateKey: 'x' } });

    await expect(buildSpaceOwnerFetcher({ messageDB, spaceId: SPACE_ID })()).resolves.toBe(
      true
    );
  });

  it('asks for the owner slot of the requested Space, not another key or another Space', async () => {
    // Pins both arguments. Querying the wrong slot would answer a different question
    // entirely while still returning a plausible boolean.
    const messageDB = dbWithKeys({ [`${SPACE_ID}:owner`]: { privateKey: 'x' } });

    await buildSpaceOwnerFetcher({ messageDB, spaceId: SPACE_ID })();

    expect(messageDB.getSpaceKey).toHaveBeenCalledWith(SPACE_ID, 'owner');
  });

  it('does not treat another Space’s owner key as ownership of this one', async () => {
    const messageDB = dbWithKeys({ 'a-different-space:owner': { privateKey: 'x' } });

    await expect(buildSpaceOwnerFetcher({ messageDB, spaceId: SPACE_ID })()).resolves.toBe(
      false
    );
  });
});
