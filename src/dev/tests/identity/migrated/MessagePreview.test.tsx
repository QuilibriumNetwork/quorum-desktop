/**
 * MessagePreview — the (currently header-hidden-in-production) sender header
 * must resolve via the identity module (`<MemberName>`), not the deleted
 * `getDisplayName`/`resolveNameForContext`/`formatResolvedName` chain built
 * from `mapSenderToUser`'s raw fields.
 *
 * BEFORE this migration, `getDisplayName` called `mapSenderToUser(senderId)`
 * and fed its fields through `resolveNameForContext`/`formatResolvedName` —
 * a resolution path independent of any surrounding IdentityScopeProvider.
 * `mapSenderToUser` below deliberately returns a WRONG displayName — proof
 * the header renders through the identity module and not this local mapper.
 *
 * Both current production callers (PinnedMessagesPanel, BookmarkItem) pass
 * `hideHeader={true}`, so this header is dead code in production today; these
 * tests mount it directly with `hideHeader={false}` to pin what it does when
 * re-enabled, exactly as the pre-migration code comment intended.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

import { MessagePreview } from '@/components/message/MessagePreview';
import { IdentityScopeProvider, MemberName } from '@/identity';

const ADDR = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// Deliberately WRONG name — see file header.
const staleMapSenderToUser = (_addr: string) => ({
  address: ADDR,
  displayName: 'Stale Mapper Name',
  primaryUsername: undefined,
  globalDisplayName: undefined,
});

const baseMessage = (): MessageType =>
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
  }) as unknown as MessageType;

function renderPreview(
  rosters: Record<string, Record<string, unknown>>,
  extra?: React.ReactNode,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        <MessagePreview
          message={baseMessage()}
          mapSenderToUser={staleMapSenderToUser}
          hideHeader={false}
        />
        {extra}
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('MessagePreview — header sender name resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderPreview({
      [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const name = container.querySelector('.dropdown-result-sender');
      expect(name?.textContent).toBe('alice.q');
    });
    expect(container.querySelector('.dropdown-result-sender')?.textContent).not.toBe(
      'Stale Mapper Name',
    );
  });

  it('a sender WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderPreview({
      [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } },
    });

    await waitFor(() => {
      const name = container.querySelector('.dropdown-result-sender');
      expect(name?.textContent).toBe('Mod Alice');
    });
  });

  it('the preview header and a <MemberName> resolve the SAME address to the SAME string', async () => {
    const rosters = { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } };

    const { container } = renderPreview(
      rosters,
      <MemberName address={ADDR} enrich className="header-name" />,
    );

    await waitFor(() => {
      const previewText = container.querySelector('.dropdown-result-sender')?.textContent;
      const headerText = container.querySelector('.header-name')?.textContent;
      expect(previewText).toBe('Mod Alice');
      expect(headerText).toBe('Mod Alice');
    });
  });
});
