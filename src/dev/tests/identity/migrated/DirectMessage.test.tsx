/**
 * DirectMessage — the DM header AND own-message resolution both resolve via
 * the identity module (`<MemberName>`/`useResolvedName`), not
 * `resolveMemberName`/`ResolvedName`, and self identity comes from the
 * provider's SELF TIER (own public profile), never from `currentPasskeyInfo`
 * (which carries no QNS name).
 *
 * THE BUG THIS ROW CLOSES: the `members` map used to hand-build a SELF entry
 * from `currentPasskeyInfo.displayName`/`.pfpUrl` plus a bolted-on
 * `ownPublicProfile.primary_username` — a caller-side patch for exactly the
 * defect the identity module's provider now owns structurally (see
 * `identityFromMaps`'s self tier). `currentPasskeyInfo` below deliberately
 * carries a WRONG display name with NO way to carry a QNS name; only the
 * ambient provider's self tier (fed by `ownPublicProfile`, i.e. the mocked
 * `getPublicProfile` for the self address) has the real one.
 *
 * MessageList/MessageComposer/TypingIndicator are heavy, already-migrated
 * components with their own extensive test suites — stubbed here to isolate
 * exactly what THIS file (DirectMessage.tsx) is responsible for wiring:
 * the provider's `selfAddress`/`rostersBySpace`, the header's resolved name,
 * the `members` map's (deleted) self-identity fields, and the composer
 * bar's/typing-indicator's resolved partner name — not Message.tsx's own
 * rendering, which Message.test.tsx already covers.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
// DirectMessage.tsx (and useDirectMessagesList) import `useParams` from
// 'react-router', not 'react-router-dom' — use the SAME package here so the
// route context is the one those hooks actually read.
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
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
const OTHER_ADDR = 'QmPeerEEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: {
      address: SELF_ADDR,
      // Deliberately WRONG / incomplete — no QNS name can live here. Proof
      // the header/self-tier no longer trust this for anything but the
      // avatar fallback icon.
      displayName: 'Stale Local Display Name',
      pfpUrl: 'local-pfp-url',
    },
  }),
}));

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    submitMessage: vi.fn(),
    retryDirectMessage: vi.fn(),
    keyset: { userKeyset: {} },
    getConfig: vi.fn().mockResolvedValue({}),
    messageDB: {
      getEncryptionStates: vi.fn().mockResolvedValue([]),
      getFirstUnreadMessage: vi.fn().mockResolvedValue(null),
    },
    receiptService: { clearReadBuffer: vi.fn(), onMessageRead: vi.fn() },
  }),
}));

vi.mock('@/hooks/queries/registration/useRegistrationOptional', () => ({
  useRegistrationOptional: ({ address }: { address: string }) => ({
    data: { registration: { user_address: address, device_registrations: [] } },
  }),
}));

vi.mock('@/hooks/queries/conversation/useConversation', () => ({
  useConversation: () => ({ data: { conversation: null } }),
}));

vi.mock('@/hooks/queries/config', () => ({
  useConfig: () => ({ data: { conversationSettings: {} } }),
}));

vi.mock('@/hooks/business/bookmarks', () => ({
  useBookmarks: () => ({ filterByConversation: () => [] }),
}));

vi.mock('@/components/context/ModalProvider', () => ({
  useModalContext: () => ({ openConversationSettings: vi.fn() }),
}));

vi.mock('@/components/context/MobileProvider', () => ({
  useMobile: () => ({ openMobileEmojiDrawer: vi.fn() }),
}));

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useMessageComposer: () => ({
      editor: { current: null },
      inReplyTo: undefined,
      setInReplyTo: vi.fn(),
      pendingMessage: '',
      setPendingMessage: vi.fn(),
      handleKeyDown: vi.fn(),
      calculateRows: () => 1,
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      processedImage: undefined,
      clearFile: vi.fn(),
      submitMessage: vi.fn(),
      fileError: null,
      isProcessingImage: false,
      mentionError: null,
      messageValidation: { isValid: true, errors: [] },
      characterCount: 0,
    }),
    useDirectMessagesList: () => ({
      messageList: [],
      acceptChat: true,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      hasNextPage: false,
      canDeleteMessages: () => false,
    }),
    useUpdateReadTime: () => ({ mutate: vi.fn() }),
  };
});

// MessageList/MessageComposer/TypingIndicator are heavy, separately-tested
// components — stub each to a minimal probe that surfaces exactly the prop
// this file is responsible for computing correctly. `MemberName` (real,
// from src/identity) inside the MessageList stub simulates what a real
// self-sent message row (Message.tsx, migrated + tested separately) does
// with the SAME ambient provider.
import { MemberName } from '@/identity';
vi.mock('@/components/message/MessageList', () => ({
  MessageList: React.forwardRef(
    ({ members }: { members: Record<string, { userIcon?: string; displayName?: string; primaryUsername?: string }> }, _ref: unknown) => (
      <div>
        <div data-testid="self-member-entry">{JSON.stringify(members[SELF_ADDR] ?? null)}</div>
        <div data-testid="own-message-name">
          <MemberName address={SELF_ADDR} enrich />
        </div>
      </div>
    ),
  ),
}));
vi.mock('@/components/message/MessageComposer', () => ({
  __esModule: true,
  default: React.forwardRef(
    ({ placeholder }: { placeholder: string }, _ref: unknown) => (
      <div data-testid="composer-placeholder">{placeholder}</div>
    ),
  ),
}));
vi.mock('@/components/message/TypingIndicator', () => ({
  TypingIndicator: ({ resolveName }: { resolveName: (addr: string) => string | undefined }) => (
    <div data-testid="typing-resolve">{resolveName(OTHER_ADDR) ?? 'NONE'}</div>
  ),
}));

// react-tooltip crashes under vitest ("Invalid hook call") — same as other
// migrated tests; stub the primitive, keep the rest of the barrel real.
vi.mock('@/components/primitives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/primitives')>();
  return {
    ...actual,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    ClickToCopyContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock('@/components/search', () => ({ GlobalSearch: () => null }));

import DirectMessage from '@/components/direct/DirectMessage';
import { ResponsiveLayoutProvider } from '@/components/context/ResponsiveLayoutProvider';

function renderDM(profiles: { self?: Record<string, unknown> | null; other?: Record<string, unknown> | null }) {
  getPublicProfile.mockImplementation((address: string) =>
    Promise.resolve({
      data: address === SELF_ADDR ? (profiles.self ?? null) : (profiles.other ?? null),
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ResponsiveLayoutProvider>
          <MemoryRouter initialEntries={[`/messages/${OTHER_ADDR}`]}>
            <Routes>
              <Route path="/messages/:address" element={<DirectMessage />} />
            </Routes>
          </MemoryRouter>
        </ResponsiveLayoutProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('DirectMessage — header resolves the partner via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q', async () => {
    renderDM({
      self: { primary_username: '', display_name: '' },
      other: { primary_username: 'alice', display_name: 'Alice' },
    });

    // The header repeats the name across responsive breakpoints (desktop,
    // mobile xs+, mobile below-xs) — all present in the DOM at once in
    // jsdom, only one visible via CSS at a time. Assert at least one match.
    await waitFor(() => {
      expect(screen.getAllByText('alice.q').length).toBeGreaterThan(0);
    });
  });

  it('a global name with no QNS name renders with no .q', async () => {
    renderDM({
      self: { primary_username: '', display_name: '' },
      other: { primary_username: '', display_name: 'Bob' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
  });
});

describe('DirectMessage — YOUR OWN name in your own DM messages resolves from your own profile, including .q', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  // NOT RED before migration, and that is itself a finding worth recording:
  // DirectMessage.tsx's `<IdentityScopeProvider selfAddress={userAddress}>`
  // predates this row (an earlier phase mounted it), so a consumer that
  // resolves purely from the ambient provider — exactly what the stubbed
  // MessageList probe below does, and what the real (separately migrated,
  // separately tested) Message.tsx does — already got the self tier right
  // beforehand. This is kept as a regression guard for that wiring, not as
  // this row's load-bearing pin; the genuinely-red case is the next test.
  it('own-message resolution reads the SELF tier (own public profile), not currentPasskeyInfo', async () => {
    renderDM({
      self: { primary_username: 'gatto', display_name: 'GattoPardo' },
      other: { primary_username: '', display_name: 'Bob' },
    });

    // The probe inside the stubbed MessageList resolves SELF_ADDR through
    // the SAME ambient provider a real Message.tsx row would use.
    expect(await screen.findByText('gatto.q')).toBeInTheDocument();
    expect(screen.queryByText('Stale Local Display Name')).not.toBeInTheDocument();
  });

  it('the members map no longer hand-builds a self identity (displayName/primaryUsername)', async () => {
    renderDM({
      self: { primary_username: 'gatto', display_name: 'GattoPardo' },
      other: { primary_username: '', display_name: 'Bob' },
    });

    const entry = await screen.findByTestId('self-member-entry');
    const parsed = JSON.parse(entry.textContent || 'null');
    expect(parsed).not.toBeNull();
    // Icon is kept (avatar picture is outside the identity module's remit —
    // MemberIdentity carries no icon field); name/QNS fields are gone.
    expect(parsed.userIcon).toBe('local-pfp-url');
    expect(parsed.displayName).toBeUndefined();
    expect(parsed.primaryUsername).toBeUndefined();
  });
});

describe('DirectMessage — composer placeholder and typing indicator resolve the partner name', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('both read the SAME resolved <qns>.q name as the header', async () => {
    renderDM({
      self: { primary_username: '', display_name: '' },
      other: { primary_username: 'alice', display_name: 'Alice' },
    });

    // `otherNameString` recomputes once the recipient's public profile query
    // resolves — a real async tick, not instant — so poll rather than
    // asserting on the first paint.
    await waitFor(() => {
      expect(screen.getByTestId('typing-resolve')).toHaveTextContent('alice.q');
      expect(screen.getByTestId('composer-placeholder')).toHaveTextContent('alice.q');
    });
  });
});
