/**
 * MessageList — `resolveSender`'s membership/kicked GATE.
 *
 * `resolveSender` used to conflate two questions: "is this address a current
 * member?" (the gate) and "what is their name?" (identity, now resolved
 * separately via `useNameResolver`/`<MemberName>`). This migration splits
 * them: `resolveMessageListSenderGate` answers ONLY the first question, reads
 * ONLY the raw `members` roster passed into `<MessageList>`, and returns the
 * raw roster row (or null) — never a name, never anything the identity
 * module produced.
 *
 * This is the security-sensitive row: the gate decides whether a kicked or
 * non-member sender's mention pill renders as interactive (clickable,
 * navigable to a profile) or not. It MUST NOT move into `src/identity` — the
 * identity provider has no concept of `isKicked` at all, so routing the gate
 * through it would silently make every kicked member's mention clickable
 * again. Both blocks below exist to catch exactly that regression:
 *
 *   - the unit block pins `resolveMessageListSenderGate` itself (fast,
 *     precise — this is the level a mutation like "drop the isKicked check"
 *     or "read from identityFromMaps instead of `members`" is caught at).
 *   - the integration block pins the WIRING: a real `<Message>` render,
 *     with a `resolveSender` built the same way `<MessageList>` builds it,
 *     proves a kicked sender's `@mention` pill is non-interactive end to
 *     end, through the real `MessageMarkdownRenderer`.
 *
 * RED proof (recorded in the Phase D rows 22-24 report): temporarily
 * deleting the `isKicked` check from `resolveMessageListSenderGate` turns
 * both blocks red — the unit test on a direct assertion, the integration
 * test because the kicked member's pill gains the `interactive` class.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { Message as MessageType } from '@quilibrium/quorum-shared';

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

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: 'QmSelf00000000000000000000000000000000' },
  }),
}));

vi.mock('@/components/context/MobileProvider', () => ({
  useMobile: () => ({
    openMobileActionsDrawer: vi.fn(),
    openMobileEmojiDrawer: vi.fn(),
  }),
}));

vi.mock('@/components/context/ImageModalProvider', () => ({
  useImageModal: () => ({ showImageModal: vi.fn() }),
}));

vi.mock('@/components/context/EditHistoryModalProvider', () => ({
  useEditHistoryModal: () => ({ showEditHistoryModal: vi.fn() }),
}));

vi.mock('@/components/message/ReactionsList', () => ({
  ReactionsList: () => null,
}));

// Same five-hook stub as Message.test.tsx, but `getContentData`/
// `shouldUseMarkdown` are wired to route through the REAL
// `MessageMarkdownRenderer` (unlike Message.test.tsx, which stays on the
// plain-text path) — the gate only matters on the markdown mention path.
vi.mock('@/hooks', () => ({
  useMessageActions: () => ({
    handleReaction: vi.fn(),
    handleReply: vi.fn(),
    handleCopyLink: vi.fn(),
    handleCopyMessageText: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
    handleViewEditHistory: vi.fn(),
    handleBookmarkToggle: vi.fn(),
    handleMoreReactions: vi.fn(),
    canUserDelete: false,
    canUserEdit: false,
    canViewEditHistory: false,
    isBookmarked: false,
    copiedLinkId: null,
    copiedMessageText: null,
  }),
  useEmojiPicker: () => ({
    closeEmojiPickers: vi.fn(),
    customEmojis: [],
    openDesktopEmojiPicker: vi.fn(),
    handleDesktopEmojiClick: vi.fn(),
    handleMobileEmojiClick: vi.fn(),
    showMobileEmojiDrawer: false,
    closeMobileEmojiDrawer: vi.fn(),
  }),
  useMessageInteractions: () => ({
    shouldShowActions: false,
    handleMouseOver: vi.fn(),
    handleMouseOut: vi.fn(),
    handleMessageClick: vi.fn(),
    handleDoubleClick: vi.fn(),
    useMobileDrawer: false,
  }),
  useMessageFormatting: () => ({
    getContentData: () => ({
      type: 'post',
      messageId: 'msg-1',
      fullText: CONTENT,
    }),
    isMentioned: () => false,
    shouldUseMarkdown: () => true,
    processTextToken: (text: string) => ({ type: 'text', text, key: text }),
    handleImageClick: vi.fn(),
  }),
  usePinnedMessages: () => ({
    canPinMessages: false,
    togglePin: vi.fn(),
  }),
}));

vi.mock('@/hooks/business/messages/useMessageHighlight', () => ({
  useMessageHighlight: () => ({
    isHighlighted: () => false,
    highlightMessage: vi.fn(),
    getHighlightVariant: () => 'default',
  }),
}));

vi.mock('@/hooks/business/messages/useViewportMentionHighlight', () => ({
  useViewportMentionHighlight: () => ({ current: null }),
}));

vi.mock('@/hooks/business/messages/useReadReceipt', () => ({
  useReadReceipt: () => ({ current: null }),
}));

import { Message } from '@/components/message/Message';
import { resolveMessageListSenderGate } from '@/components/message/MessageList';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const SPACE_ID = 'space-1';
const SENDER_ADDR = 'QmPeerSEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const ACTIVE_ADDR = 'QmPeerKEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const KICKED_ADDR = 'QmPeerLEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const CONTENT = `hey @<${ACTIVE_ADDR}> and @<${KICKED_ADDR}> welcome`;

describe('resolveMessageListSenderGate — the raw-roster membership/kicked gate (unit)', () => {
  const members: Record<string, { address: string; isKicked?: boolean }> = {
    [ACTIVE_ADDR]: { address: ACTIVE_ADDR },
    [KICKED_ADDR]: { address: KICKED_ADDR, isKicked: true },
  };

  it('resolves a current, non-kicked member', () => {
    expect(resolveMessageListSenderGate(members, ACTIVE_ADDR)).toBe(members[ACTIVE_ADDR]);
  });

  it('gates a kicked member — returns null even though the roster row exists', () => {
    expect(resolveMessageListSenderGate(members, KICKED_ADDR)).toBeNull();
  });

  it('gates an address entirely absent from the roster', () => {
    expect(resolveMessageListSenderGate(members, 'QmNotAMember00000000000000000000000000000')).toBeNull();
  });
});

function renderMessage(
  message: MessageType,
  members: Record<string, { address: string; isKicked?: boolean }>,
  rosters: Record<string, Record<string, unknown>>,
  onUserClick: (...args: unknown[]) => void,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // Built exactly the way <MessageList>'s own `resolveSender` is built post
  // migration: a thin closure over `resolveMessageListSenderGate` and the
  // raw `members` map — nothing else.
  const resolveSender = (senderId: string) => resolveMessageListSenderGate(members, senderId);
  const mapSenderToUser = (senderId: string) => members[senderId] ?? { address: senderId };

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          <Message
            message={message}
            messageList={[message]}
            mapSenderToUser={mapSenderToUser}
            resolveSender={resolveSender}
            onUserClick={onUserClick}
            emojiPickerOpen={undefined}
            setEmojiPickerOpen={() => {}}
            emojiPickerPosition={null}
            setEmojiPickerPosition={() => {}}
            hoverTarget={undefined}
            setHoverTarget={() => {}}
            setInReplyTo={() => {}}
            editorRef={{ current: null }}
            height={40}
            submitMessage={async () => {}}
          />
        </IdentityScopeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MessageList\'s resolveSender, wired through Message -> MessageMarkdownRenderer (integration)', () => {
  it('a kicked member\'s @mention pill renders non-interactive; a live member\'s renders interactive', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    const members: Record<string, { address: string; isKicked?: boolean }> = {
      [SENDER_ADDR]: { address: SENDER_ADDR },
      [ACTIVE_ADDR]: { address: ACTIVE_ADDR },
      [KICKED_ADDR]: { address: KICKED_ADDR, isKicked: true },
    };

    const message = {
      messageId: 'msg-1',
      spaceId: SPACE_ID,
      channelId: 'channel-1',
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      digestAlgorithm: 'sha256' as const,
      nonce: 'nonce',
      lastModifiedHash: 'hash',
      signature: 'sig',
      content: {
        senderId: SENDER_ADDR,
        type: 'post' as const,
        text: CONTENT,
      },
    } as unknown as MessageType;

    const onUserClick = vi.fn();

    const { container } = renderMessage(
      message,
      members,
      {
        [SPACE_ID]: {
          [SENDER_ADDR]: { display_name: 'Sender' },
          [ACTIVE_ADDR]: { display_name: 'Active' },
          [KICKED_ADDR]: { display_name: 'Kicked' },
        },
      },
      onUserClick,
    );

    await waitFor(() => {
      const pills = container.querySelectorAll('.message-mentions-user');
      expect(pills.length).toBe(2);
    });

    const activePill = container.querySelector(`[data-user-address="${ACTIVE_ADDR}"]`);
    const kickedPill = container.querySelector(`[data-user-address="${KICKED_ADDR}"]`);

    expect(activePill?.className).toContain('interactive');
    expect(activePill?.className).not.toContain('non-interactive');

    expect(kickedPill?.className).toContain('non-interactive');
  });
});
