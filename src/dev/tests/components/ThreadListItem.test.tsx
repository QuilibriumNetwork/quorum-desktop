import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChannelThread } from '@quilibrium/quorum-shared';
import { IdentityScopeProvider } from '@/identity';

// Mock primitives Icon
vi.mock('@/components/primitives', () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Flex: ({ children, className }: any) => <div className={className}>{children}</div>,
  Container: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock formatRelativeTime — MemberName (rendered inside ThreadListItem since
// its Phase D migration) needs the REST of quorum-shared's real exports
// (resolveIdentity etc.), so only override this one named export instead of
// replacing the whole module.
vi.mock('@quilibrium/quorum-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@quilibrium/quorum-shared')>();
  return { ...actual, formatRelativeTime: () => '2h ago' };
});

// ThreadListItem resolves its starter's name via `<MemberName enrich />`,
// which requests a public profile through this client — stubbed so it
// resolves to "no profile" instead of hitting the network in jsdom.
vi.mock('@/api/baseTypes', () => ({
  QuorumApiClient: class {
    getPublicProfile() {
      return Promise.resolve({ data: null });
    }
  },
  isHandledFetchError: () => false,
}));

import { ThreadListItem } from '../../../components/thread/ThreadListItem';

const baseThread: ChannelThread = {
  threadId: 'thread-1', spaceId: 'space-1', channelId: 'ch-1',
  rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
  lastActivityAt: 5000, replyCount: 3, isClosed: false, hasParticipated: false,
};

// `<MemberName>` (used for the "Started by" label since this component's
// Phase D migration) throws outside an `<IdentityScopeProvider>`.
function renderItem(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
        {ui}
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('ThreadListItem', () => {
  it('renders customTitle when provided', () => {
    renderItem(
      <ThreadListItem
        thread={{ ...baseThread, customTitle: 'My Custom Title' }}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('falls back to titleSnapshot when no customTitle', () => {
    renderItem(
      <ThreadListItem
        thread={{ ...baseThread, titleSnapshot: 'Snapshot text' }}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText('Snapshot text')).toBeInTheDocument();
  });

  it('falls back to "Thread" when neither customTitle nor titleSnapshot', () => {
    renderItem(
      <ThreadListItem
        thread={baseThread}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText('Thread')).toBeInTheDocument();
  });

  it('shows lock icon when thread is closed', () => {
    renderItem(
      <ThreadListItem
        thread={{ ...baseThread, isClosed: true }}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('calls onOpen when row is clicked', async () => {
    const user = userEvent.setup();
    const handleOpen = vi.fn();
    renderItem(
      <ThreadListItem
        thread={baseThread}
        onOpen={handleOpen}
      />
    );
    await user.click(screen.getByRole('button'));
    expect(handleOpen).toHaveBeenCalledWith('msg-1');
  });

  it('shows reply count in meta', () => {
    renderItem(
      <ThreadListItem
        thread={{ ...baseThread, replyCount: 5 }}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText(/5 replies/)).toBeInTheDocument();
  });

  it('shows singular "1 reply" for replyCount=1', () => {
    renderItem(
      <ThreadListItem
        thread={{ ...baseThread, replyCount: 1 }}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText(/1 reply/)).toBeInTheDocument();
  });
});
