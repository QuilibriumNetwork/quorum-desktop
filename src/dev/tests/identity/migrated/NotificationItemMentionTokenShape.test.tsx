/**
 * Bug 3 (operator-reported): a mention inside a notification-row message body
 * rendered the raw storage token (`@<Qm…`, angle bracket and all) while the
 * SAME message rendered the mention correctly in the ordinary message list.
 *
 * Root cause: `processTextToken`'s user-mention branch (`useMessageFormatting.ts`)
 * matched with an ANCHORED regex, `^@<(CID)>$` — the WHOLE space-delimited
 * token had to equal `@<address>` exactly. A real IndexedDB probe of the
 * operator's message store found a mention token 5 characters longer than a
 * bare `@<CID>` and NOT ending in `>` — i.e. text glued onto the token with no
 * separating space — which fell straight through every other token type to
 * "regular text" and rendered completely raw.
 *
 * `NotificationItem.renderMessageContent` is the ONLY consumer of
 * `processTextToken` that tokenizes via naive `line.split(' ')` — `Message.tsx`
 * and `MessagePreview.tsx` both pre-isolate `@<[^>]+>` as its own token via a
 * smart-tokenization regex BEFORE calling `processTextToken`, which already
 * protects them from shapes (a)/(b) below (though NOT from shape (c), which
 * has no closing `>` for their pre-tokenizer to find either — see the fix
 * report for the full consumer audit).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { Message } from '@quilibrium/quorum-shared';

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

// Keep the MessageMarkdownRenderer tree light for the parity checks below —
// neither is exercised by mention-only content.
vi.mock('@/components/message/InviteLink', () => ({
  InviteLink: () => null,
}));
vi.mock('@/components/ui/YouTubeFacade', () => ({
  YouTubeFacade: () => null,
}));

import { NotificationItem } from '@/components/notifications/NotificationItem';
import { MessageMarkdownRenderer } from '@/components/message/MessageMarkdownRenderer';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import type { MentionNotification } from '@/hooks/business/mentions';

const SENDER_ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const MENTIONED_ADDR = 'QmPeerTEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';
const ROSTERS = { [SPACE_ID]: { [MENTIONED_ADDR]: { display_name: 'Ada Lovelace' } } };

function messageWithText(text: string): Message {
  return {
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
      text,
    },
    mentions: { memberIds: [MENTIONED_ADDR], roleIds: [], channelIds: [] },
  } as unknown as Message;
}

function renderNotification(text: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const notification: MentionNotification = {
    message: messageWithText(text),
    channelId: 'channel-1',
    channelName: 'general',
    mentionType: 'you',
  };
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={ROSTERS} selfAddress={null}>
        <NotificationItem
          notification={notification}
          onNavigate={() => {}}
          displayName={<span>sender</span>}
          mapSenderToUser={() => undefined}
          currentSpaceId={SPACE_ID}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

function renderMarkdown(content: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={ROSTERS} selfAddress={null}>
        <MessageMarkdownRenderer
          content={content}
          mapSenderToUser={() => ({ address: MENTIONED_ADDR })}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('NotificationItem — a mention token carrying extra characters (bug 3)', () => {
  beforeAll(() => {
    getPublicProfile.mockResolvedValue({ data: null }); // no QNS name; roster nickname "Ada Lovelace" wins
  });

  it('control: an exact `@<CID>` token renders the name, never the raw token (must not regress)', async () => {
    const { container } = renderNotification(`hey @<${MENTIONED_ADDR}> there`);

    await waitFor(() => {
      const text = container.querySelector('.notification-text')?.textContent ?? '';
      expect(text).toContain('Ada Lovelace');
      expect(text).not.toContain('@<');
    });
  });

  it('shape (a): trailing punctuation directly after `>` still renders the name, punctuation preserved', async () => {
    const { container } = renderNotification(`hey @<${MENTIONED_ADDR}>! there`);

    await waitFor(() => {
      const text = container.querySelector('.notification-text')?.textContent ?? '';
      expect(text).toContain('Ada Lovelace');
      expect(text).not.toContain('@<');
      const pill = container.querySelector('.message-mentions-user');
      // The `!` sits immediately after the pill, no inserted space.
      expect(pill?.nextSibling?.textContent).toBe('!');
    });
  });

  it('shape (b): text immediately following `>` with no space still renders the name — the operator\'s measured shape', async () => {
    // 5 extra characters after `>`, not ending in `>` — matches the measured
    // 54-char (49 + 5) shape from the operator's IndexedDB probe.
    const { container } = renderNotification(`hey @<${MENTIONED_ADDR}>thx!! there`);

    await waitFor(() => {
      const text = container.querySelector('.notification-text')?.textContent ?? '';
      expect(text).toContain('Ada Lovelace');
      expect(text).not.toContain('@<');
    });
  });

  it('shape (c): a token with no closing `>` at all still renders the name', async () => {
    const { container } = renderNotification(`hey @<${MENTIONED_ADDR} there`);

    await waitFor(() => {
      const text = container.querySelector('.notification-text')?.textContent ?? '';
      expect(text).toContain('Ada Lovelace');
      expect(text).not.toContain('@<');
    });
  });

  describe('parity with the ordinary message-list path (MessageMarkdownRenderer)', () => {
    it('the control case resolves the SAME name in both paths', async () => {
      const text = `hey @<${MENTIONED_ADDR}> there`;
      const notif = renderNotification(text);
      const md = renderMarkdown(text);

      await waitFor(() => {
        const notifName = notif.container.querySelector('.message-mentions-user')?.textContent;
        const mdName = md.container.querySelector('.message-mentions-user')?.textContent?.replace(/^@/, '');
        expect(notifName).toBe('Ada Lovelace');
        expect(mdName).toBe('Ada Lovelace');
        expect(notifName).toBe(mdName);
      });
    });

    it('shape (a) (trailing punctuation) resolves the SAME name in both paths', async () => {
      const text = `hey @<${MENTIONED_ADDR}>! there`;
      const notif = renderNotification(text);
      const md = renderMarkdown(text);

      await waitFor(() => {
        const notifName = notif.container.querySelector('.message-mentions-user')?.textContent;
        const mdName = md.container.querySelector('.message-mentions-user')?.textContent?.replace(/^@/, '');
        expect(notifName).toBe('Ada Lovelace');
        expect(mdName).toBe('Ada Lovelace');
        expect(notifName).toBe(mdName);
      });
    });

    it('documented divergence: shape (b) (no space before trailing text) is intentionally NOT recognized by the reference implementation, so only the notification path resolves it', async () => {
      // quorum-shared's `processMentions` filters matches through
      // `hasWordBoundaries`, which requires the character AFTER the match to
      // be whitespace or specific punctuation — "t" (the start of "thx!!")
      // fails that check, so the reference implementation leaves this token
      // as raw, unprocessed text. The notification/preview fallback is
      // deliberately more lenient (see the fix report) so this is a known,
      // bounded difference — not a regression to chase.
      const text = `hey @<${MENTIONED_ADDR}>thx!! there`;
      const notif = renderNotification(text);
      const md = renderMarkdown(text);

      await waitFor(() => {
        const notifText = notif.container.querySelector('.notification-text')?.textContent ?? '';
        expect(notifText).toContain('Ada Lovelace');
        expect(notifText).not.toContain('@<');
      });

      // The reference implementation genuinely does not resolve this shape.
      expect(md.container.querySelector('.message-mentions-user')).toBeNull();
    });
  });
});
