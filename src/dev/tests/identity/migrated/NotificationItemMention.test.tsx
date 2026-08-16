/**
 * Bug 2: a notification row whose message body mentions someone rendered the
 * RAW storage token (`@<address>`, angle brackets and all) instead of a
 * resolved name — a different failure from bug 1's wrong-name fallback (that
 * one still substitutes SOME name; this one substitutes nothing at all).
 *
 * Root cause, confirmed by reading `useMessageFormatting.ts`'s
 * `processTextToken` against the ALREADY-CORRECT reference implementation
 * (`processMentions` in quorum-shared, what the ordinary message list
 * renders through): `processTextToken`'s user-mention branch required
 * `message.mentions.memberIds.includes(address)` before it would recognize a
 * well-formed `@<CID>` token as a mention at all. `memberIds` is a
 * best-effort index used elsewhere for notification-triggering — the
 * reference implementation never checks it — so a real, well-formed mention
 * whose address is not (for whatever upstream reason) also listed there fell
 * all the way through every other token type to the final "regular text"
 * case, rendering completely unprocessed. The operator's repro mentions the
 * CURRENT USER specifically; self resolves from the viewer's own public
 * profile via `IdentityScopeProvider`'s `selfAddress`/`selfProfile` (never
 * from `currentPasskeyInfo`, which carries no QNS name) — this file's
 * `mentions.memberIds` is deliberately EMPTY to reproduce the exact
 * "no substitution ran at all" shape, independent of that self-specific
 * resolution path.
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

import { NotificationItem } from '@/components/notifications/NotificationItem';
import { IdentityScopeProvider } from '@/identity/identityProvider';
import type { MentionNotification } from '@/hooks/business/mentions';

const SENDER_ADDR = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz'; // "brave" in the operator's repro
const SELF_ADDR = 'QmPeerSEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz'; // the viewer — the mentioned person
const SPACE_ID = 'space-1';

// The exact shape that reproduces the bug: the message text names SELF_ADDR
// via a well-formed `@<address>` token, but `mentions.memberIds` — the field
// `processTextToken` used to gate recognition on — is EMPTY.
const selfMentionMessage = (): Message =>
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
      senderId: SENDER_ADDR,
      type: 'post' as const,
      text: `@<${SELF_ADDR}>`,
    },
    mentions: { memberIds: [], roleIds: [], channelIds: [] },
  }) as unknown as Message;

const notification: MentionNotification = {
  message: selfMentionMessage(),
  channelId: 'channel-1',
  channelName: 'general',
  mentionType: 'you',
};

function renderRow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{}} selfAddress={SELF_ADDR}>
        <NotificationItem
          notification={notification}
          onNavigate={() => {}}
          displayName={<span className="test-sender-name">brave.q</span>}
          mapSenderToUser={() => undefined}
          currentSpaceId={SPACE_ID}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('NotificationItem — an in-body @mention of the viewer resolves via the identity module (bug 2)', () => {
  it('never renders the raw "@<" storage token', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'selfname', display_name: 'Self Name' } });

    const { container } = renderRow();

    await waitFor(() => {
      const text = container.querySelector('.notification-text')?.textContent ?? '';
      expect(text).not.toContain('@<');
      expect(text).not.toContain(SELF_ADDR);
    });
  });

  it('renders the mentioned viewer\'s verified QNS name, resolved from their own public profile', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'selfname', display_name: 'Self Name' } });

    const { container } = renderRow();

    await waitFor(() => {
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('selfname.q');
    });
  });
});
