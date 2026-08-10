/**
 * useVisibleSenderProfileFallback — replaces `useMembersWithPublicProfileFallback`
 * (Phase D row 23). NAME rendering has moved to `src/identity` for every
 * surface that reads it (message header, mention pills, profile card); this
 * hook now exists ONLY for what `src/identity` deliberately does not cover.
 *
 * Two things are pinned here:
 *
 *   - `userIcon`/`bio`/`primaryUsername`/`globalDisplayName` are still
 *     enriched from the visible sender's public profile exactly as before —
 *     `useMentionInput.ts`'s search matching and Message.tsx's avatar/reactor
 *     icons still read these RAW, outside this migration's scope.
 *   - `displayName`'s network-fetch tier is GONE: it now reads ONLY the raw
 *     roster (per-space override, else the roster global slot), never the
 *     fetched public profile's `display_name`. The load-bearing case is a
 *     member with NEITHER a per-space override NOR a roster global slot, but
 *     WHO DOES have a published public profile — before this migration that
 *     member's `displayName` was the public profile's name; after, it is
 *     undefined. This is deliberate (see the hook's file header for why
 *     Channel.tsx cannot route this field through `src/identity` instead) —
 *     the test exists so a future accidental re-introduction of the fetch
 *     tier, or an accidental regression of the roster tiers, both show up
 *     here rather than being noticed only in the UI.
 */
import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getPublicProfile = vi.fn();

vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

import { useVisibleSenderProfileFallback } from '@/hooks/business/user/useVisibleSenderProfileFallback';

const ADDR = 'QmPeerVEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const OTHER = 'QmPeerWEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  getPublicProfile.mockReset();
});

describe('useVisibleSenderProfileFallback — displayName reads ONLY the raw roster', () => {
  it('the load-bearing case: no per-space override, no roster global slot, but a published public profile — displayName stays undefined', async () => {
    getPublicProfile.mockResolvedValue({
      data: { display_name: 'Published Name', primary_username: 'alice', profile_image: 'icon.png', bio: 'hi' },
    });

    const members = { [ADDR]: { address: ADDR, displayName: '' } };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(ADDR));
    await waitFor(() => expect(result.current[ADDR]?.userIcon).toBe('icon.png'));

    // The regression this pins: displayName must NOT pick up the fetched
    // profile's name once the roster tiers are both empty.
    expect(result.current[ADDR]?.displayName).toBeUndefined();
  });

  it('still takes displayName from the per-space override when set', async () => {
    getPublicProfile.mockResolvedValue({ data: { display_name: 'Published Name' } });
    const members = { [ADDR]: { address: ADDR, displayName: 'Mod Alice' } };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(ADDR));
    await waitFor(() => expect(result.current[ADDR]?.userIcon).toBeUndefined());
    expect(result.current[ADDR]?.displayName).toBe('Mod Alice');
  });

  it('falls back to the roster GLOBAL slot (no fetch needed) when there is no per-space override', async () => {
    getPublicProfile.mockResolvedValue({ data: null });
    const members = { [ADDR]: { address: ADDR, displayName: '', globalDisplayName: 'Roster Global Alice' } };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(ADDR));
    expect(result.current[ADDR]?.displayName).toBe('Roster Global Alice');
  });
});

describe('useVisibleSenderProfileFallback — non-name fields still fully enriched', () => {
  it('userIcon/bio/primaryUsername/globalDisplayName all come from the public profile when the roster has nothing', async () => {
    getPublicProfile.mockResolvedValue({
      data: { profile_image: 'icon.png', bio: 'hi there', primary_username: 'alice', display_name: 'Global Alice' },
    });
    const members = { [ADDR]: { address: ADDR } };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current[ADDR]?.userIcon).toBe('icon.png'));
    expect(result.current[ADDR]?.bio).toBe('hi there');
    expect(result.current[ADDR]?.primaryUsername).toBe('alice');
    expect(result.current[ADDR]?.globalDisplayName).toBe('Global Alice');
  });

  it('the per-space icon override wins over the roster global slot and the public profile', async () => {
    getPublicProfile.mockResolvedValue({ data: { profile_image: 'pub-icon.png' } });
    const members = {
      [ADDR]: { address: ADDR, userIcon: 'override-icon.png', globalUserIcon: 'roster-global-icon.png' },
    };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(ADDR));
    expect(result.current[ADDR]?.userIcon).toBe('override-icon.png');
  });

  it('opaque roster fields (isKicked, joinedAt) pass through unchanged for an enriched member', async () => {
    getPublicProfile.mockResolvedValue({ data: { profile_image: 'icon.png' } });
    const members = { [ADDR]: { address: ADDR, isKicked: true, joinedAt: 12345 } };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current[ADDR]?.userIcon).toBe('icon.png'));
    expect(result.current[ADDR]?.isKicked).toBe(true);
    expect(result.current[ADDR]?.joinedAt).toBe(12345);
  });
});

describe('useVisibleSenderProfileFallback — bounded to visible addresses', () => {
  it('a member NOT in visibleAddresses is passed through untouched, no fetch issued', async () => {
    const members = {
      [ADDR]: { address: ADDR, displayName: '' },
      [OTHER]: { address: OTHER, displayName: '' },
    };
    const { result } = renderHook(
      () => useVisibleSenderProfileFallback(members, [ADDR]),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledTimes(1));
    expect(getPublicProfile).not.toHaveBeenCalledWith(OTHER);
    expect(result.current[OTHER]).toBe(members[OTHER]);
  });
});
