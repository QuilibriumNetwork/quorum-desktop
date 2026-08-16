/**
 * ThreadPanel — the "Started by" label must resolve via the identity module
 * (`<MemberName>`), not the old `resolveSpaceMemberName`/`formatResolvedName`
 * chain built from `channelProps.mapSenderToUser(creatorId)`.
 *
 * BEFORE this migration, `starterName` was computed from whatever
 * `mapSenderToUser` returned — a caller-supplied snapshot independent of the
 * roster ThreadPanel's OWN `<IdentityScopeProvider>` already loads from
 * `channelProps.rosterRows` (see the big comment on that mount in
 * ThreadPanel.tsx — its wiring is untouched by this migration). So a stale or
 * partial `mapSenderToUser` result could show a different name than every
 * other surface in this same panel.
 *
 * `mapSenderToUser` below deliberately returns a WRONG `displayName` with no
 * `globalDisplayName` — proof the label renders through the roster + public
 * profile the provider holds, not this local mapper. Same technique as
 * PinnedMessagesPanel.test.tsx (Phase D row 6).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

// Heavy children unrelated to name resolution — mocked so the panel renders
// without a full messaging/typing stack. The header content (where "Started
// by" lives) is passed to MessageList as `headerContent`; the mock renders
// exactly that, nothing else from MessageList's own machinery.
vi.mock('@/components/message/MessageList', () => ({
  MessageList: React.forwardRef((props: any, _ref: any) => (
    <div data-testid="message-list">{props.headerContent}</div>
  )),
}));
vi.mock('@/components/message/MessageComposer', () => ({
  __esModule: true,
  default: React.forwardRef((_props: any, _ref: any) => <div data-testid="composer" />),
}));
vi.mock('@/components/message/TypingIndicator', () => ({
  TypingIndicator: () => null,
}));

const useMessageComposerStub = () => ({
  pendingMessage: '',
  setPendingMessage: vi.fn(),
  handleKeyDown: vi.fn(),
  calculateRows: vi.fn(),
  getRootProps: () => ({}),
  getInputProps: () => ({}),
  processedImage: null,
  clearFile: vi.fn(),
  submitMessage: vi.fn(),
  submitSticker: vi.fn(),
  inReplyTo: null,
  setInReplyTo: vi.fn(),
  fileError: null,
  isProcessingImage: false,
  mentionError: null,
  messageValidation: null,
  characterCount: 0,
  showStickers: false,
  setShowStickers: vi.fn(),
});
vi.mock('@/hooks', () => ({
  useMessageComposer: (..._args: unknown[]) => useMessageComposerStub(),
}));

vi.mock('@/components/context/ThreadSettingsModalProvider', () => ({
  useThreadSettingsModal: () => ({ openThreadSettings: vi.fn() }),
}));
vi.mock('@/components/context/MobileProvider', () => ({
  useMobile: () => ({ openMobileEmojiDrawer: vi.fn() }),
}));
vi.mock('@/components/context/ResponsiveLayoutProvider', () => ({
  useResponsiveLayoutContext: () => ({ isMobile: false }),
}));
vi.mock('@/hooks/business/conversations/useUpdateThreadReadTime', () => ({
  useUpdateThreadReadTime: () => ({ mutate: vi.fn() }),
}));

const ADDR = 'QmPeerTEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// Deliberately WRONG name — see file header. `channelProps.mapSenderToUser`
// is the OLD data source; if the panel still reads it, this is what renders.
const staleMapSenderToUser = (_senderId: string) => ({
  address: ADDR,
  userIcon: undefined,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
  bio: undefined,
});

let threadContextFixture: any;

vi.mock('@/components/context/ThreadContext', () => ({
  useThreadContext: () => threadContextFixture,
  useThreadContextStore: () => ({
    getThreadState: () => ({ targetMessageId: null }),
    setThreadState: vi.fn(),
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

function makeFixture(rosterRow: Record<string, unknown>) {
  return {
    isOpen: true,
    threadId: 'thread-1',
    rootMessage: {
      messageId: 'root-1',
      content: { type: 'post', text: 'root text', senderId: ADDR },
      threadMeta: { createdBy: ADDR, isClosed: false },
    },
    threadMessages: [],
    isLoading: false,
    closeThread: vi.fn(),
    submitMessage: vi.fn(),
    submitSticker: vi.fn(),
    setThreadClosed: vi.fn(),
    updateThreadSettings: vi.fn(),
    removeThread: vi.fn(),
    channelProps: {
      spaceId: SPACE_ID,
      channelId: 'channel-1',
      members: {},
      rosterRows: { [ADDR]: rosterRow },
      roles: [],
      stickers: {},
      customEmoji: [],
      mapSenderToUser: staleMapSenderToUser,
      isSpaceOwner: false,
      canDeleteMessages: () => false,
      canPinMessages: () => false,
      currentUserAddress: 'QmSelf00000000000000000000000000000000',
      onUserClick: vi.fn(),
    },
    targetMessageId: null,
    updateTitle: vi.fn(),
  };
}

import ThreadPanel from '@/components/thread/ThreadPanel';

function renderPanel(rosterRow: Record<string, unknown>) {
  threadContextFixture = makeFixture(rosterRow);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ThreadPanel />
    </QueryClientProvider>,
  );
}

describe('ThreadPanel — "Started by" resolves via the identity module', () => {
  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderPanel({ display_name: '', global_display_name: 'Alice' });

    await waitFor(() => {
      const text = document.querySelector('.thread-panel__list-starter-name')?.textContent;
      expect(text).toBe('alice.q');
    });
    expect(
      document.querySelector('.thread-panel__list-starter-name')?.textContent,
    ).not.toContain('Stale Mapper Name');
  });

  it('a starter WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderPanel({ display_name: 'Mod Alice', global_display_name: 'Alice' });

    await waitFor(() => {
      const text = document.querySelector('.thread-panel__list-starter-name')?.textContent;
      expect(text).toBe('Mod Alice');
    });
    const text = document.querySelector('.thread-panel__list-starter-name')?.textContent;
    expect(text).not.toContain('.q');
    expect(text).not.toContain('Stale Mapper Name');
  });
});
