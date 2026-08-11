/**
 * DirectMessageContactsList — the DM list + search resolve via the identity
 * module, not `resolveMemberName`/`conversationMatchesSearch`
 * (`utils/conversationSearch.ts`, deleted by this migration).
 *
 * `DirectMessageContactsList` is mounted from `Sidebar.tsx` (the app shell),
 * with NO ambient `<IdentityScopeProvider>` above it — the component now
 * mounts its own (global scope: DM conversations carry no spaceId, so a
 * per-space nickname is meaningless). `DirectMessageContact`, the row
 * component, is a real child here (already migrated in the sibling row) —
 * it needs that ambient provider or it throws.
 *
 * THE RED CASE: `useConversationsWithProfileBackfill` is mocked here to a
 * plain passthrough (no `primaryUsername` attachment at all) — deliberately
 * removing the OLD code's ONLY source of the QNS name. Before migration this
 * makes both the rendered name and the search match fail, because the OLD
 * code has no other way to learn a partner's `primary_username`. After
 * migration, the row and the search both resolve through the identity
 * module's OWN independent `enrich` request (same
 * `publicProfileQueryKey(address)` as `useConversationsWithProfileBackfill`
 * would have used — see the "no new fetch path" describe block below for the
 * MEASURED proof this doesn't add a second network request).
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

// Forces the desktop (`role="link"`, real `onContextMenu`) branch of
// `DirectMessageContact` — `isTouchDevice()`'s jsdom answer isn't reliable
// across this suite (some sibling files note it reads true, some false), and
// the touch branch below never wires `onContextMenu` at all (context menus
// are desktop-only), so the finding-3 context-menu test needs this forced.
vi.mock('@/utils/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platform')>();
  return { ...actual, isTouchDevice: () => false };
});

const SELF_ADDR = 'QmSelf000000000000000000000000000000000000';
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: SELF_ADDR } }),
}));

const getMessage = vi.fn();
const getConversation = vi.fn();
const saveConversation = vi.fn();
const deleteConversation = vi.fn();
vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getMessage, getConversation, saveConversation },
    deleteConversation,
  }),
}));

vi.mock('@/components/context/ModalProvider', () => ({
  useModalContext: () => ({ openNewDirectMessage: vi.fn(), openConversationSettings: vi.fn() }),
}));

vi.mock('@/hooks/business/dm/useDMFavorites', () => ({
  useDMFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    favoritesSet: new Set<string>(),
  }),
}));
vi.mock('@/hooks/business/dm/useDMMute', () => ({
  useDMMute: () => ({
    isMuted: () => false,
    toggleMute: vi.fn(),
    mutedSet: new Set<string>(),
  }),
}));

// react-tooltip crashes under vitest ("Invalid hook call") the same way
// noted in UserProfile.test.tsx — stub it, keep the rest of primitives real.
vi.mock('@/components/primitives', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/primitives')>();
  return {
    ...actual,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const ADDR_A = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const ADDR_B = 'QmPeerBEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const conversation = (address: string, displayName: string) => ({
  conversationId: `${address}/${address}`,
  address,
  displayName,
  icon: '',
  type: 'direct' as const,
  timestamp: 1_000,
  lastReadTimestamp: 1_000,
  lastMessageId: 'msg-1',
});

/** Simulates `useConversationsWithProfileBackfill` attaching NOTHING — the
 *  OLD code's only path to a QNS name is cut off deliberately. See file
 *  header. */
vi.mock('@/hooks/business/conversations/useConversationsWithProfileBackfill', () => ({
  useConversationsWithProfileBackfill: (conversations: unknown[]) => conversations,
}));

// Bypasses useConversations' useSuspenseInfiniteQuery (backed by
// messageDB.getConversations, IndexedDB machinery unrelated to this test) —
// feed the list directly, same as the rest of this file's mocks feed the
// surrounding hooks.
let mockConversations: ReturnType<typeof conversation>[] = [];
vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useConversationPolling: () => ({
      conversations: mockConversations,
      refetchConversations: vi.fn(),
    }),
  };
});

import DirectMessageContactsList from '@/components/direct/DirectMessageContactsList';

function renderList(conversations: ReturnType<typeof conversation>[]) {
  mockConversations = conversations;
  getMessage.mockResolvedValue({ text: '' });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/messages']}>
        <DirectMessageContactsList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DirectMessageContactsList — render resolves via the identity module', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getMessage.mockReset();
  });

  it('the load-bearing case: a global name and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve({
        data:
          address === ADDR_A
            ? { primary_username: 'alice', display_name: 'Alice' }
            : null,
      }),
    );

    renderList([conversation(ADDR_A, 'Alice')]);

    expect(await screen.findByText('alice.q')).toBeInTheDocument();
  });

  it('a global name with no QNS name renders with no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: '', display_name: 'Bob' } });

    renderList([conversation(ADDR_B, 'Bob')]);

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
  });
});

describe('DirectMessageContactsList — fix round 1: wires the LOCAL conversation name into the provider', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getMessage.mockReset();
  });

  it('a partner with NO public profile still renders their LOCAL conversation displayName, not a truncated address', async () => {
    // No public profile at all — the OLD bug: with an always-empty roster
    // (DMs have no spaceId) and a 404 profile, this row used to resolve to
    // an all-null identity and render the truncated address instead.
    getPublicProfile.mockResolvedValue({ data: null });

    renderList([conversation(ADDR_A, 'Carol (local only)')]);

    // The row's NAME label resolves to the local name (the address subtitle
    // underneath it, `formatAddress(props.address)`, is unrelated —
    // DirectMessageContact always shows it as a second line when there's no
    // message preview yet, name or no name).
    expect(await screen.findByText('Carol (local only)')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
  });
});

describe('DirectMessageContactsList — search matches the name the user actually sees', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getMessage.mockReset();
  });

  it('finds the QNS-named row by typing its .q name, not the stored display name', async () => {
    // Note: with no public profile at all, a row falls back to the
    // truncated ADDRESS, not the local conversation's stored displayName —
    // the identity module's global ladder for a DM partner has no roster
    // tier (rostersBySpace is always {} here) and reads globalName ONLY
    // from the fetched public profile. So B needs a profile too (no QNS) to
    // render as "Bob" at all.
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve({
        data:
          address === ADDR_A
            ? { primary_username: 'alice', display_name: 'Alice' }
            : { primary_username: '', display_name: 'Bob' },
      }),
    );

    renderList([conversation(ADDR_A, 'Alice'), conversation(ADDR_B, 'Bob')]);

    // Both rows visible before any search — row resolves alice.q.
    expect(await screen.findByText('alice.q')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Search direct messages'));
    await user.type(screen.getByPlaceholderText('Name or Address'), 'alice.q');

    await waitFor(() => {
      expect(screen.getByText('alice.q')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });
  });
});

describe('DirectMessageContactsList — the right-click context menu header resolves via the identity module (finding 3)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getMessage.mockReset();
  });

  it('does not paint the raw stored "Unknown User" placeholder when the partner actually has a resolvable name', async () => {
    // The conversation's LOCAL/raw displayName is literally the placeholder
    // "Unknown User" (see `isUnknownUser` above) — realistic for a contact
    // whose row has since resolved a real name via a public profile, but
    // whose stale/never-updated local field still holds the placeholder.
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve(
        address === ADDR_A
          ? { data: { primary_username: 'alice', display_name: 'Alice' } }
          : { data: null },
      ),
    );

    renderList([conversation(ADDR_A, 'Unknown User')]);

    // The row itself already resolves via the identity module (unaffected
    // by this finding) — confirms the profile landed.
    const rowName = await screen.findByText('alice.q');
    const row = rowName.closest('[role="link"]') as HTMLElement;
    expect(row).not.toBeNull();

    fireEvent.contextMenu(row);

    await waitFor(() => {
      const header = document.querySelector('.context-menu-header-text');
      expect(header).not.toBeNull();
      expect(header!.textContent).toBe('alice.q');
    });
    expect(screen.queryByText('Unknown User')).not.toBeInTheDocument();
  });
});

describe('DirectMessageContactsList — enrich does not add a new fetch path', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getMessage.mockReset();
  });

  it('requests each distinct partner address at most once, MEASURED', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve({
        data:
          address === ADDR_A
            ? { primary_username: 'alice', display_name: 'Alice' }
            : null,
      }),
    );

    renderList([conversation(ADDR_A, 'Alice')]);

    await screen.findByText('alice.q');
    // Query-key dedup: the row's own `enrich` request (DirectMessageContact)
    // and the list's proactive `requestNames` both ask for ADDR_A, but share
    // one `publicProfileQueryKey(ADDR_A)` cache entry inside the SAME
    // provider instance — exactly one underlying fetch for ADDR_A, not one
    // per consumer. (The provider's own self-profile auto-request accounts
    // for the OTHER call — SELF_ADDR — which this filters out.)
    const addrACalls = getPublicProfile.mock.calls.filter(([addr]) => addr === ADDR_A);
    expect(addrACalls).toHaveLength(1);
  });
});
