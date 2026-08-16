/**
 * ThreadsListPanel / ThreadListItem — the thread-starter label must resolve
 * via the identity module (`<MemberName>`), not the panel's local
 * `resolveDisplayName` helper prop-drilled into `ThreadListItem`.
 *
 * BEFORE this migration, `resolveDisplayName` was built from whatever
 * `mapSenderToUser` returned — a caller-supplied snapshot independent of the
 * roster + public profile every other migrated surface reads — and handed
 * down as a plain function prop. `ThreadListItem` now resolves the address
 * itself via `<MemberName enrich />`, so the panel no longer needs
 * `mapSenderToUser` or `resolveDisplayName` at all.
 *
 * `staleMapSenderToUser` below deliberately returns a WRONG `displayName`
 * with no `globalDisplayName` — proof (on the RED run) that the row rendered
 * through the local mapper and not the identity module. Same technique as
 * PinnedMessagesPanel.test.tsx (Phase D row 6) and ThreadPanel.test.tsx
 * (Phase D row 12).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { ChannelThread } from '@quilibrium/quorum-shared';
import { IdentityScopeProvider } from '@/identity';

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

const ADDR = 'QmPeerLEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const thread: ChannelThread = {
  threadId: 'thread-1',
  spaceId: SPACE_ID,
  channelId: 'channel-1',
  rootMessageId: 'msg-1',
  createdBy: ADDR,
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  replyCount: 1,
  isClosed: false,
  hasParticipated: false,
  customTitle: 'A Thread',
};

const mockUseChannelThreads = vi.fn();
vi.mock('@/hooks/business/threads/useChannelThreads', () => ({
  useChannelThreads: (args: unknown) => mockUseChannelThreads(args),
}));

vi.mock('@/components/context/ThreadContext', () => ({
  useThreadContext: () => ({
    openThread: vi.fn(),
    closeThread: vi.fn(),
  }),
}));

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getMessageById: vi.fn().mockResolvedValue(null) },
  }),
}));

vi.mock('@/utils/platform', () => ({
  isTouchDevice: () => false,
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

// Deliberately WRONG name — see file header. This is the panel's OLD data
// source; if it still gets read, this is what renders instead of the
// identity module's resolved name.
const staleMapSenderToUser = (_senderId: string) => ({
  address: ADDR,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

import { ThreadsListPanel } from '@/components/thread/ThreadsListPanel';

function renderPanel(rosterRow: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  mockUseChannelThreads.mockReturnValue({ data: [thread], isLoading: false });
  // `mapSenderToUser` is passed via an `any`-typed object so this test stays
  // valid whether or not the prop still exists on ThreadsListPanelProps —
  // it is dropped from the panel's own props as part of this migration, but
  // keeping it here costs nothing and avoids a second edit to this file.
  const panelProps: any = {
    isOpen: true,
    onClose: vi.fn(),
    spaceId: SPACE_ID,
    channelId: 'channel-1',
    mapSenderToUser: staleMapSenderToUser,
  };
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider
        spaceId={SPACE_ID}
        rostersBySpace={{ [SPACE_ID]: { [ADDR]: rosterRow } }}
        selfAddress={null}
      >
        <ThreadsListPanel {...panelProps} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('ThreadsListPanel — thread-starter name resolves via the identity module', () => {
  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderPanel({ display_name: '', global_display_name: 'Alice' });

    await waitFor(() => {
      const text = document.querySelector('.thread-list-item__meta')?.textContent ?? '';
      expect(text).toContain('alice.q');
    });
    expect(
      document.querySelector('.thread-list-item__meta')?.textContent,
    ).not.toContain('Stale Mapper Name');
  });

  it('a starter WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderPanel({ display_name: 'Mod Alice', global_display_name: 'Alice' });

    await waitFor(() => {
      const text = document.querySelector('.thread-list-item__meta')?.textContent ?? '';
      expect(text).toContain('Mod Alice');
    });
    const text = document.querySelector('.thread-list-item__meta')?.textContent ?? '';
    expect(text).not.toContain('alice.q');
    expect(text).not.toContain('Stale Mapper Name');
  });
});
