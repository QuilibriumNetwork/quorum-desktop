/**
 * Message — the header sender name and the reply-to preview name must both
 * resolve via the identity module (`<MemberName>`/`useResolvedMemberName`),
 * not the old `resolveNameForContext`/`ResolvedName` chain built from
 * `mapSenderToUser`.
 *
 * BEFORE this migration the header called
 * `resolveNameForContext({ ...mapSenderToUser(senderId), address }, { isDm })`.
 * `mapSenderToUser` is built from the LOCAL roster — it never carries
 * `primaryUsername` — so the header's ".q" name could only ever appear if a
 * profile happened to already be cached from some other surface; there was
 * no dedicated fetch for the message header itself. The reply-to preview
 * called the exact same resolver independently, so the two call sites could
 * silently drift from each other. Both must now resolve through the SAME
 * identity provider, which fetches the sender's public profile (`enrich`).
 *
 * `mapSenderToUser` below deliberately returns a WRONG `displayName` —
 * proof that the header/preview render through the identity module and not
 * this local mapper. Pre-migration, the old resolver treated
 * `mapSenderToUser`'s `displayName` AS the per-space name directly, so this
 * stale string is exactly what would have rendered, never "alice.q".
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

// Reactions are irrelevant to name resolution and drag in useReactionsModal
// context wiring that has nothing to do with this test.
vi.mock('@/components/message/ReactionsList', () => ({
  ReactionsList: () => null,
}));

// The five business hooks Message.tsx pulls from the barrel. Stubbed so the
// render never needs the real message-actions/formatting machinery — this
// test is only about how the sender name resolves.
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
      content: ['hello'],
      fullText: 'hello',
    }),
    isMentioned: () => false,
    shouldUseMarkdown: () => false,
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

import { Message } from '@/components/message/Message';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerMEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const baseMessage = (overrides: Partial<MessageType> = {}): MessageType =>
  ({
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
      senderId: ADDR,
      type: 'post' as const,
      text: 'hello there',
    },
    ...overrides,
  }) as unknown as MessageType;

// Deliberately WRONG name — see file header.
const staleMapSenderToUser = (_senderId: string) => ({
  address: ADDR,
  userIcon: undefined,
  displayName: 'Stale Mapper Name',
  bio: undefined,
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

const textOf = (container: HTMLElement, selector: string): string[] =>
  Array.from(container.querySelectorAll(selector)).map((el) => el.textContent?.trim() ?? '');

function renderMessage(
  message: MessageType,
  messageList: MessageType[],
  rosters: Record<string, Record<string, unknown>>,
  mapSenderToUser: (senderId: string) => any = staleMapSenderToUser,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
          <Message
            message={message}
            messageList={messageList}
            mapSenderToUser={mapSenderToUser}
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

describe('Message — sender name resolves via the identity module', () => {
  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q in the header', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderMessage(baseMessage(), [baseMessage()], {
      [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const names = textOf(container, '.message-sender-name');
      expect(names.length).toBeGreaterThan(0);
      expect(names[0]).toBe('alice.q');
    });
    expect(textOf(container, '.message-sender-name')).not.toContain('Stale Mapper Name');
  });

  it('a sender WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderMessage(baseMessage(), [baseMessage()], {
      [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const names = textOf(container, '.message-sender-name');
      expect(names.length).toBeGreaterThan(0);
      expect(names[0]).toBe('Mod Alice');
    });
    expect(textOf(container, '.message-sender-name').some((n) => n.includes('.q'))).toBe(false);
    expect(textOf(container, '.message-sender-name')).not.toContain('Stale Mapper Name');
  });

  it('the reply-to preview resolves the SAME name as the header — no drift between the two call sites', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const original = baseMessage({ messageId: 'msg-0' });
    const reply = baseMessage({
      messageId: 'msg-1',
      content: {
        senderId: ADDR,
        type: 'post',
        text: 'replying to myself',
        repliesToMessageId: 'msg-0',
      } as unknown as MessageType['content'],
    });

    const { container } = renderMessage(reply, [original, reply], {
      [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const headerNames = textOf(container, '.message-sender-name');
      const replyNames = textOf(container, '.message-reply-sender-name');
      expect(headerNames.length).toBeGreaterThan(0);
      expect(replyNames.length).toBeGreaterThan(0);
      expect(headerNames[0]).toBe('alice.q');
      expect(replyNames[0]).toBe('alice.q');
    });
  });
});

// SECURITY: the reply-preview's in-body @mentions used to render
// `mapSenderToUser(address).displayName` raw (via shared's
// `replaceMentionsWithDisplayNames`) — a per-space/global field with no
// forged-".q" guard. A member who sets their own nickname to literally
// "eviladmin.q" would render as an indistinguishable verified QNS name in
// the reply-preview line above every message that mentions them, even
// though `resolveIdentity`'s guard (`presentUnreserved`) exists specifically
// to drop a stored name that tries to forge that marker. See
// `resolveDisplayName.ts`'s `presentUnreserved` docstring.
const ATTACKER = 'QmAttackerEgVKpYZKYuFu2J49zHXnA8vZtEqHMtzzzz';

// Simulates `effectiveMembers`/`useVisibleSenderProfileFallback`: a
// per-space nickname flows through unfiltered as `displayName`.
const forgedNameMapSenderToUser = (senderId: string) =>
  senderId === ATTACKER
    ? {
        address: ATTACKER,
        userIcon: undefined,
        displayName: 'eviladmin.q',
        bio: undefined,
        primaryUsername: undefined,
        globalDisplayName: undefined,
      }
    : staleMapSenderToUser(senderId);

describe('Message — reply-preview in-body @mentions cannot forge a verified name (security)', () => {
  it('a member whose stored nickname ends in ".q" does NOT render as verified in the reply-preview text', async () => {
    // No public profile for anyone — isolates the space-tier guard: without
    // it, "eviladmin.q" is the only candidate name and would render verified.
    getPublicProfile.mockResolvedValue({ data: null });

    const original = baseMessage({
      messageId: 'msg-0',
      content: {
        senderId: ATTACKER,
        type: 'post',
        text: `hey @<${ATTACKER}> check this out`,
      } as unknown as MessageType['content'],
    });
    const reply = baseMessage({
      messageId: 'msg-1',
      content: {
        senderId: ADDR,
        type: 'post',
        text: 'replying',
        repliesToMessageId: 'msg-0',
      } as unknown as MessageType['content'],
    });

    const { container } = renderMessage(
      reply,
      [original, reply],
      {
        [SPACE_ID]: {
          [ADDR]: { display_name: '', global_display_name: 'Alice' },
          // The forged nickname, stored exactly the way a member's own
          // per-space override would be.
          [ATTACKER]: { display_name: 'eviladmin.q' },
        },
      },
      forgedNameMapSenderToUser,
    );

    await waitFor(() => {
      expect(textOf(container, '.message-reply-text').length).toBeGreaterThan(0);
    });

    const replyText = textOf(container, '.message-reply-text').join(' ');
    expect(replyText).not.toContain('@eviladmin.q');
    // The resolver's real fallback for a guarded-out name: a truncated
    // address, not the forged string and not empty.
    expect(replyText).toContain(`@${ATTACKER.slice(0, 6)}`);
  });
});
