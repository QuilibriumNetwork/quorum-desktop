import { describe, it, expect } from 'vitest';
import { shouldReconcileSelfIdentity } from '@/hooks/business/user/useReconcileSelfIdentity';

describe('shouldReconcileSelfIdentity', () => {
  it('writes when the synced name differs from the stored one', () => {
    expect(
      shouldReconcileSelfIdentity(
        { name: 'Ada 8', profile_image: 'img8' },
        { displayName: 'Ada 2', pfpUrl: 'img2' }
      )
    ).toEqual({ displayName: 'Ada 8', pfpUrl: 'img8' });
  });

  it('does NOT write when they already agree', () => {
    expect(
      shouldReconcileSelfIdentity(
        { name: 'Ada', profile_image: 'img' },
        { displayName: 'Ada', pfpUrl: 'img' }
      )
    ).toBeNull();
  });

  it('NEVER blanks a good stored name from an empty config', () => {
    // Cold start / offline: getConfig returns a default config with no name.
    // ~15 sites read the same in-memory passkey object, so one empty write
    // blanks every one of them at once.
    expect(
      shouldReconcileSelfIdentity({}, { displayName: 'Ada', pfpUrl: 'img' })
    ).toBeNull();
    expect(
      shouldReconcileSelfIdentity(
        { name: '', profile_image: '' },
        { displayName: 'Ada', pfpUrl: 'img' }
      )
    ).toBeNull();
    expect(
      shouldReconcileSelfIdentity(undefined, { displayName: 'Ada', pfpUrl: 'img' })
    ).toBeNull();
  });

  it('fills a name when the device has none yet', () => {
    expect(
      shouldReconcileSelfIdentity({ name: 'Ada' }, { displayName: undefined })
    ).toEqual({ displayName: 'Ada', pfpUrl: undefined });
  });

  it('updates only the avatar when only the avatar changed', () => {
    expect(
      shouldReconcileSelfIdentity(
        { name: 'Ada', profile_image: 'newImg' },
        { displayName: 'Ada', pfpUrl: 'oldImg' }
      )
    ).toEqual({ displayName: 'Ada', pfpUrl: 'newImg' });
  });
});
