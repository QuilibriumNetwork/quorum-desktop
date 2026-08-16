/**
 * useSearchResultDisplay — single-item search result display hook. Exported
 * from `src/hooks/business/search` but not currently wired to any component
 * (superseded in production by `useBatchSearchResultsDisplay`); still real
 * production source, still reachable by a future caller, and still audited —
 * see `2026-08-10-identity-resolution-architecture-plan/second-tranche-report.md`.
 *
 * Two defects, both from rendering raw fields instead of resolving through
 * `src/identity`:
 *   - Space messages rendered `userInfo?.display_name || 'Unknown User'` — a
 *     raw local field plus a caller-owned fallback, no ".q" ever possible.
 *   - A DM message YOU sent rendered `currentPasskeyInfo.displayName` — the
 *     device-local auth record, which carries no QNS name. Identical bug to
 *     the one just fixed in the nav rail (commit e066e789d).
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
    // The device-local record. `displayName` here must NEVER be what a self
    // DM search result renders — that's the exact bug this pins.
    currentPasskeyInfo: { address: SELF_ADDR, displayName: 'Device Record Name', pfpUrl: '' },
  }),
}));

const getSpace = vi.fn();
const getConversation = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getSpace, getConversation },
  }),
}));

// Pins WIRING, not QNS ownership. Only the final ownership comparison is
// stubbed, because the address fixtures here are arbitrary and no real ed448
// key derives to them. The claim still travels the whole real path, so this
// still fails if the provider stops populating the verified map. Ownership
// itself is pinned in `identity/verifiedQnsNames.test.ts` and shared's
// `verifyQnsClaim.test.ts`, both mutation-proven.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@quilibrium/quorum-shared')>()),
  claimedNameBelongsTo: () => true,
}));

import { useSearchResultDisplay } from '@/hooks/business/search/useSearchResultDisplay';
import { IdentityScopeProvider, type RosterNameRow } from '@/identity';
import type { SearchResult } from '@/db/messages';

const SPACE_ID = 'space-1';
const CHANNEL_ID = 'channel-1';
const SENDER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const spaceMessageResult = (): SearchResult =>
  ({
    score: 1,
    highlights: [],
    message: {
      spaceId: SPACE_ID,
      channelId: CHANNEL_ID,
      messageId: 'msg-1',
      digestAlgorithm: '',
      nonce: '',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content: { senderId: SENDER, type: 'post', text: 'hello' },
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    },
  }) as unknown as SearchResult;

const dmSelfMessageResult = (): SearchResult =>
  ({
    score: 1,
    highlights: [],
    message: {
      // isDM detection: spaceId === channelId
      spaceId: SELF_ADDR,
      channelId: SELF_ADDR,
      messageId: 'msg-2',
      digestAlgorithm: '',
      nonce: '',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content: { senderId: SELF_ADDR, type: 'post', text: 'hi from me' },
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    },
  }) as unknown as SearchResult;

function wrapperFor(rosters: Record<string, Record<string, RosterNameRow>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <React.Suspense fallback={null}>
          <IdentityScopeProvider rostersBySpace={rosters} selfAddress={SELF_ADDR}>
            {children}
          </IdentityScopeProvider>
        </React.Suspense>
      </QueryClientProvider>
    );
  };
}

describe('useSearchResultDisplay — resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getSpace.mockReset();
    getConversation.mockReset();
    getConversation.mockResolvedValue({ conversation: null });
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q for a Space message sender', async () => {
    getSpace.mockResolvedValue({ spaceName: 'My Space', groups: [] });
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { result } = renderHook(() => useSearchResultDisplay({ result: spaceMessageResult() }), {
      wrapper: wrapperFor({ [SPACE_ID]: { [SENDER]: { display_name: '', global_display_name: 'Alice' } } }),
    });

    await waitFor(() => expect(result.current.displayName).toBe('alice.q'));
  });

  it('a per-space nickname with no QNS name renders with no .q', async () => {
    getSpace.mockResolvedValue({ spaceName: 'My Space', groups: [] });
    getPublicProfile.mockResolvedValue({ data: null });

    const { result } = renderHook(() => useSearchResultDisplay({ result: spaceMessageResult() }), {
      wrapper: wrapperFor({ [SPACE_ID]: { [SENDER]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } }),
    });

    await waitFor(() => expect(result.current.displayName).toBe('Mod Alice'));
    expect(result.current.displayName).not.toMatch(/\.q$/);
  });

  it('YOUR OWN DM message resolves your name from the identity module, not currentPasskeyInfo.displayName', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'me', display_name: 'My Name' } });

    const { result } = renderHook(() => useSearchResultDisplay({ result: dmSelfMessageResult() }), {
      wrapper: wrapperFor({}),
    });

    await waitFor(() => expect(result.current.displayName).toBe('me.q'));
    expect(result.current.displayName).not.toBe('Device Record Name');
  });
});
