/**
 * NotificationPanel — the GLOBAL notification row's sender must resolve via
 * the identity module (`<MemberName>`/`useResolvedName`), not the legacy
 * `resolveGlobalSender` prop.
 *
 * BEFORE this migration the row header called `resolveGlobalSender(spaceId,
 * senderId)`, built by `buildGlobalSenderMap` from the local roster
 * (`src/utils/resolveGlobalSender.ts`). That map has no field for
 * `primary_username` — a roster row cannot carry it — so `sender.primaryUsername`
 * was always undefined and the row could show a per-space/global nickname but
 * NEVER the QNS ".q" name, regardless of what the operator's profile said.
 *
 * The load-bearing case below (no per-space override, a global name, and a
 * QNS name) is exactly the shape `resolveGlobalSender` could never produce a
 * ".q" for. The nickname case is a non-regression check: it already rendered
 * correctly with the OLD code (a real per-space override always outranks the
 * QNS name), so this test must not be the thing that started passing it.
 *
 * Phase D row 24: the row HEADER migrated first (an earlier row); the
 * `resolveGlobalSender` PROP survived because in-body `@mentions` inside the
 * global panel's message preview (NotificationItem -> useMessageFormatting's
 * `mapSenderToUser(id)?.displayName`) still read it. That prop, the hook
 * behind it (`useGlobalSenderResolver`), and the module behind THAT
 * (`buildGlobalSenderMap` / `src/utils/resolveGlobalSender.ts`) are now
 * deleted — in-body mentions resolve through `useNameResolver().resolve(id,
 * { spaceId: rowSpaceId })`, the SAME bulk resolver every other "many
 * addresses outside JSX" surface uses (MessageMarkdownRenderer,
 * MessageEditTextarea, ReactionsList). The describe block below pins that:
 * a mentioned address that was NEVER a `resolveGlobalSender`-carryable QNS
 * name now renders its `.q` correctly inside the notification body text.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('@/components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: {
      saveReadTime: vi.fn(),
      getChannelThreads: vi.fn().mockResolvedValue([]),
      bulkSaveThreadReadTimes: vi.fn(),
    },
  }),
}));

// Stable references — a fresh array/object literal returned on every render
// re-triggers NotificationPanel's `useEffect(() => setSelectedTypes(savedTypes),
// [savedTypes])`, which would otherwise loop forever against a mock.
const SAVED_TYPES = ['mention-you', 'mention-everyone', 'mention-roles', 'reply'] as const;
vi.mock('@/hooks/business/mentions', () => ({
  useAllMentions: () => ({ mentions: [], isLoading: false }),
  useMentionNotificationSettings: () => ({ selectedTypes: SAVED_TYPES, isLoading: false }),
}));
vi.mock('@/hooks/business/replies', () => ({
  useAllReplies: () => ({ replies: [], isLoading: false }),
}));

let GLOBAL_NOTIFICATIONS: unknown[] = [];
vi.mock('@/hooks/business/notifications', () => ({
  useGlobalNotifications: () => ({ notifications: GLOBAL_NOTIFICATIONS, truncated: false, isLoading: false }),
  GLOBAL_DISPLAY_CAP: 100,
}));

// Not the object of this test — stub out to avoid depending on the primitive
// package's internal rendering (portals, floating-ui) for controls we never
// assert on. Modal is unused here (global mode still renders through
// DropdownPanel's sibling per-space branch is NOT exercised; the global
// branch uses the real Modal export from primitives... see below).
vi.mock('@/components/primitives', () => ({
  Flex: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
  Icon: ({ name, className }: any) => <span data-testid={`icon-${name}`} className={className} />,
  Button: ({ children, className, onClick, iconName, ...rest }: any) => (
    <button className={className} onClick={onClick} {...rest}>
      {iconName && <span data-testid={`icon-${iconName}`} />}
      {children}
    </button>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
  Select: () => null,
  Modal: ({ visible, children }: any) => (visible ? <div data-testid="modal">{children}</div> : null),
}));

vi.mock('@/components/modals/ConfirmationModal', () => ({
  default: () => null,
}));

import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerNEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const MENTIONED_ADDR = 'QmPeerOEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    messageId: 'msg-1',
    spaceId: SPACE_ID,
    channelId: 'channel-1',
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    digestAlgorithm: 'sha256' as const,
    nonce: 'nonce',
    lastModifiedHash: 'hash',
    content: {
      senderId: ADDR,
      type: 'post' as const,
      text: 'hello there',
    },
    ...overrides,
  }) as unknown as Message;

function renderPanel(
  displayName: string,
  globalDisplayName: string,
  opts: { rosters?: Record<string, Record<string, unknown>>; message?: Message } = {},
) {
  GLOBAL_NOTIFICATIONS = [
    {
      message: opts.message ?? message(),
      channelId: 'channel-1',
      channelName: 'general',
      mentionType: 'you',
      spaceId: SPACE_ID,
      spaceName: 'Test Space',
    },
  ];

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <IdentityScopeProvider
          rostersBySpace={
            opts.rosters ?? { [SPACE_ID]: { [ADDR]: { display_name: displayName, global_display_name: globalDisplayName } } }
          }
          selfAddress={null}
        >
          <NotificationPanel
            global
            isOpen
            onClose={() => {}}
            spaceId=""
            channelIds={[]}
            mapSenderToUser={() => undefined}
          />
        </IdentityScopeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Read the author label as rendered (`{displayName}: `). Uses the whole
// element's textContent rather than RTL's default text matcher, because
// `getByText` only concatenates an element's OWN direct text-node children —
// pre-migration `displayName` was a plain string sharing the span with the
// ": " suffix (one merged text node), but post-migration it is a nested
// <MemberName> element, which `getByText('X:')` would never match even
// though it renders correctly. textContent sees through both shapes.
const authorLabel = (container: HTMLElement): string =>
  container.querySelector('.notification-author')?.textContent?.trim() ?? '';

describe('NotificationPanel — global sender resolves via the identity module', () => {
  it('the load-bearing case: no per-space override, a global name, and a QNS name renders <qns>.q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderPanel('', 'Alice');

    // The exact defect: resolveGlobalSender can never carry a QNS name, so the
    // old code rendered the bare global name ("Alice:") and never this.
    await waitFor(() => expect(authorLabel(container)).toBe('alice.q:'));
  });

  it('a member WITH a per-space nickname renders the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderPanel('Mod Alice', 'Alice');

    // Already correct before this migration (a real override always outranks
    // the QNS name) — this case must not be what makes the file look fixed.
    await waitFor(() => expect(authorLabel(container)).toBe('Mod Alice:'));
  });
});

describe('NotificationPanel — global panel in-body @mentions resolve via useNameResolver (row 24)', () => {
  it('a mentioned address with NO per-space override and a QNS name renders <qns>.q inside the preview text', async () => {
    getPublicProfile.mockImplementation((address: string) =>
      Promise.resolve(
        address === MENTIONED_ADDR
          ? { data: { primary_username: 'bob', display_name: 'Bob' } }
          : { data: null },
      ),
    );

    const { container } = renderPanel('', '', {
      rosters: {
        [SPACE_ID]: {
          [ADDR]: { display_name: '', global_display_name: '' },
          // No per-space override, no roster global slot — the exact shape
          // `buildGlobalSenderMap` could never carry a QNS name for, because
          // a roster row has no `primary_username` field at all.
          [MENTIONED_ADDR]: { display_name: '', global_display_name: '' },
        },
      },
      message: message({
        content: {
          senderId: ADDR,
          type: 'post',
          text: `hey @<${MENTIONED_ADDR}> welcome`,
        },
        mentions: { memberIds: [MENTIONED_ADDR] },
      } as never),
    });

    await waitFor(() => {
      // No literal "@" here: useMessageFormatting.ts's `displayName` is the
      // resolved name only (the "@" only appears in ITS OWN fallback string,
      // `@${address.substring(0,8)}...`, a pre-existing asymmetry outside
      // this row's scope) — the mention SPAN's presence and its resolved
      // text are what this pins.
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('bob.q');
    });
  });

  it('a mentioned address WITH a per-space nickname renders the nickname, not the address truncation', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    const { container } = renderPanel('', '', {
      rosters: {
        [SPACE_ID]: {
          [ADDR]: { display_name: '', global_display_name: '' },
          [MENTIONED_ADDR]: { display_name: 'Mod Bob', global_display_name: 'Bob' },
        },
      },
      message: message({
        content: {
          senderId: ADDR,
          type: 'post',
          text: `hey @<${MENTIONED_ADDR}> welcome`,
        },
        mentions: { memberIds: [MENTIONED_ADDR] },
      } as never),
    });

    await waitFor(() => {
      expect(container.querySelector('.message-mentions-user')?.textContent).toBe('Mod Bob');
    });
    expect(container.querySelector('.notification-text')?.textContent).not.toContain('.q');
  });
});
