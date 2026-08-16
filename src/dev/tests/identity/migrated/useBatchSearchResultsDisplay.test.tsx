/**
 * useBatchSearchResultsDisplay — the hook actually wired to production
 * (`SearchResults.tsx` -> `SearchResultItem.tsx`). Batch-resolves every
 * search result's sender name in one pass; before this migration it read
 * `userInfo?.display_name || 'Unknown User'` (a raw local field, a
 * `messageDB.getUser` snapshot, with a caller-owned fallback stacked on top)
 * for BOTH Space senders and DM partners, and `currentPasskeyInfo.displayName`
 * for a self-authored DM message — the identical self-name bug just fixed in
 * the nav rail (commit e066e789d).
 *
 * `SearchResults.tsx` mounts its own `<IdentityScopeProvider>` (multi-space,
 * via `useMultiSpaceRosters`) because it is a detached, cross-space surface —
 * a single search can return results from many different spaces the user
 * belongs to, exactly like `ReactionsModal`. This test wraps the hook with
 * the same shape directly instead of mounting the whole panel.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const getPublicProfile = vi.fn();
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile(address: string) {
      return getPublicProfile(address);
    }
  },
  isHandledFetchError: () => false,
}));

const SELF_ADDR = 'QmSelf000000000000000000000000000000000000';
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: SELF_ADDR, displayName: 'Device Record Name', pfpUrl: '' },
  }),
}));

const getSpace = vi.fn();
const getUser = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getSpace, getUser },
  }),
}));

// This test pins WIRING — that the name the identity module resolves is the one
// this surface renders. It is not a test of QNS ownership, which lives in
// `identity/verifiedQnsNames.test.ts` and shared's `verifyQnsClaim.test.ts`,
// both mutation-proven.
//
// The claim still travels the real path (profile -> claimedNamesIn ->
// verifiedQnsNames -> IdentitySources -> the ladder), so this still fails if the
// provider stops populating the verified map. Only the final comparison is
// stubbed, because the address fixtures here are arbitrary and no real key
// derives to them.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

import { useBatchSearchResultsDisplay } from '@/hooks/business/search/useBatchSearchResultsDisplay';
import { IdentityScopeProvider, type RosterNameRow } from '@/identity';
import type { SearchResult } from '@/db/messages';

const SPACE_ID = 'space-1';
const CHANNEL_ID = 'channel-1';
const ALICE = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const BOB = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const DM_PARTNER = 'QmPeerCEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const spaceResult = (id: string, sender: string): SearchResult =>
  ({
    score: 1,
    highlights: [],
    message: {
      spaceId: SPACE_ID,
      channelId: CHANNEL_ID,
      messageId: id,
      digestAlgorithm: '',
      nonce: '',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content: { senderId: sender, type: 'post', text: 'hello' },
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    },
  }) as unknown as SearchResult;

const dmResult = (id: string, sender: string, dmAddress: string): SearchResult =>
  ({
    score: 1,
    highlights: [],
    message: {
      spaceId: dmAddress,
      channelId: dmAddress,
      messageId: id,
      digestAlgorithm: '',
      nonce: '',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content: { senderId: sender, type: 'post', text: 'hi' },
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    },
  }) as unknown as SearchResult;

function wrapperFor(rosters: Record<string, Record<string, RosterNameRow>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <IdentityScopeProvider rostersBySpace={rosters} selfAddress={SELF_ADDR}>
          {children}
        </IdentityScopeProvider>
      </QueryClientProvider>
    );
  };
}

describe('useBatchSearchResultsDisplay — resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getSpace.mockReset();
    getUser.mockReset();
    getSpace.mockResolvedValue({ spaceName: 'My Space', groups: [] });
    getUser.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
  });

  it('the load-bearing case: a Space sender with a global name and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve({
        data: address === ALICE ? { primary_username: 'alice', display_name: 'Alice' } : null,
      }),
    );

    const { result } = renderHook(
      () => useBatchSearchResultsDisplay({ results: [spaceResult('m1', ALICE)] }),
      { wrapper: wrapperFor({ [SPACE_ID]: { [ALICE]: { display_name: '', global_display_name: 'Alice' } } }) },
    );

    await waitFor(() =>
      expect(result.current.resultsData.get('m1')?.displayName).toBe('alice.q'),
    );
  });

  it('a Space sender with only a per-space nickname renders with no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    const { result } = renderHook(
      () => useBatchSearchResultsDisplay({ results: [spaceResult('m2', BOB)] }),
      { wrapper: wrapperFor({ [SPACE_ID]: { [BOB]: { display_name: 'Mod Bob', global_display_name: 'Bob' } } }) },
    );

    await waitFor(() =>
      expect(result.current.resultsData.get('m2')?.displayName).toBe('Mod Bob'),
    );
    expect(result.current.resultsData.get('m2')?.displayName).not.toMatch(/\.q$/);
  });

  it('a DM partner resolves through the identity module, not a raw messageDB.getUser field', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve({
        data: address === DM_PARTNER ? { primary_username: 'carol', display_name: 'Carol' } : null,
      }),
    );

    const { result } = renderHook(
      () => useBatchSearchResultsDisplay({ results: [dmResult('m3', DM_PARTNER, DM_PARTNER)] }),
      { wrapper: wrapperFor({}) },
    );

    await waitFor(() =>
      expect(result.current.resultsData.get('m3')?.displayName).toBe('carol.q'),
    );
  });

  it('YOUR OWN DM message resolves your name from the identity module, not currentPasskeyInfo.displayName', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'me', display_name: 'My Name' } });

    const { result } = renderHook(
      () => useBatchSearchResultsDisplay({ results: [dmResult('m4', SELF_ADDR, DM_PARTNER)] }),
      { wrapper: wrapperFor({}) },
    );

    await waitFor(() =>
      expect(result.current.resultsData.get('m4')?.displayName).toBe('me.q'),
    );
    expect(result.current.resultsData.get('m4')?.displayName).not.toBe('Device Record Name');
  });
});
