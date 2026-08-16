/**
 * ConversationSettingsModal — the "Fix Encryption" confirmation sentence
 * resolves the DM partner's name through `src/identity`, not
 * `conversation?.conversation?.displayName ?? 'this contact'` (a raw local
 * field with a caller-owned fallback standing in for the member's name).
 *
 * `ConversationSettingsModal` is mounted by `ModalProvider`, an ancestor of
 * `<DirectMessages />` (see Router.web.tsx), so it sits OUTSIDE the specific
 * DM's own `<IdentityScopeProvider>` (DirectMessage.tsx mounts one scoped to
 * the currently-open conversation, with that conversation's
 * `locallyKnownNames`). This modal is a genuinely detached, single-DM
 * surface — like a bookmark or a notification row — so it mounts its OWN
 * `<IdentityScopeProvider>`, wired the SAME way DirectMessage.tsx wires its
 * `locallyKnownNames` tier (design constraint 5 / fix round 1): the
 * partner's local `Conversation.displayName` is the last resort before a
 * truncated address, for a partner who has never published a public
 * profile.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// ConversationSettingsModal imports `useNavigate` from 'react-router' —
// keep the router primitives on the same package (see
// DirectMessage.test.tsx / KickUserModal.test.tsx for the same gotcha).
import { MemoryRouter } from 'react-router';
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
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF_ADDR } }),
}));

const getConversation = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getConversation },
    getConfig: vi.fn().mockResolvedValue({ nonRepudiable: true, deliveryReceipts: false, readReceipts: false }),
    keyset: { userKeyset: {} },
    deleteConversation: vi.fn(),
    deleteEncryptionStates: vi.fn(),
  }),
}));

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useConversations: () => ({ data: { pages: [] } }),
  };
});

vi.mock('@/hooks/business/dm/useDMMute', () => ({
  useDMMute: () => ({ isMuted: () => false, toggleMute: vi.fn() }),
}));
vi.mock('@/hooks/business/dm/useDMConversationSettings', () => ({
  useDMConversationSettings: () => ({
    saveSettings: vi.fn(),
    getOverride: () => undefined,
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

// react-tooltip crashes under vitest ("Invalid hook call") the same way
// noted in UserProfile.test.tsx / DirectMessageContactsList.test.tsx —
// stub it, keep the rest of primitives real.
vi.mock('@/components/primitives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/primitives')>();
  return {
    ...actual,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import ConversationSettingsModal from '@/components/modals/ConversationSettingsModal';

const PARTNER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const CONVERSATION_ID = `${PARTNER}/${PARTNER}`;

function renderModal(conversationDisplayName: string | undefined) {
  getConversation.mockResolvedValue({
    conversation: {
      conversationId: CONVERSATION_ID,
      address: PARTNER,
      displayName: conversationDisplayName ?? '',
      icon: '',
      type: 'direct',
      timestamp: 1000,
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/messages/${PARTNER}`]}>
        <ConversationSettingsModal conversationId={CONVERSATION_ID} visible onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openFixEncryptionConfirmation() {
  const user = userEvent.setup();
  await user.click(await screen.findByText('Fix Encryption'));
}

describe('ConversationSettingsModal — the reset-session sentence resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getConversation.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q in the confirmation sentence', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    renderModal('Alice (local)');
    await openFixEncryptionConfirmation();

    await waitFor(() =>
      expect(
        screen.getByText((_, node) => node?.tagName === 'P' && !!node.textContent?.includes('reset the encryption session with alice.q')),
      ).toBeInTheDocument(),
    );
  });

  it('a partner with NO public profile still renders their LOCAL conversation name, not "this contact"', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    renderModal('Carol (local only)');
    await openFixEncryptionConfirmation();

    await waitFor(() =>
      expect(
        screen.getByText(
          (_, node) =>
            node?.tagName === 'P' &&
            !!node.textContent?.includes('reset the encryption session with Carol (local only)'),
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/this contact/)).not.toBeInTheDocument();
  });
});
