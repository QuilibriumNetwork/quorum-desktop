import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { ChannelThread } from '../../../api/quorumApi';

// Initialize Lingui before tests
beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const now = Date.now();

const joinedThread: ChannelThread = {
  threadId: 'joined-1', spaceId: 's1', channelId: 'c1', rootMessageId: 'msg-j',
  createdBy: 'user-a', createdAt: now - 1000, lastActivityAt: now - 1000,
  replyCount: 2, isClosed: false, hasParticipated: true,
  customTitle: 'Joined Thread',
};
const activeThread: ChannelThread = {
  threadId: 'active-1', spaceId: 's1', channelId: 'c1', rootMessageId: 'msg-a',
  createdBy: 'user-b', createdAt: now - 2000, lastActivityAt: now - 2000,
  replyCount: 1, isClosed: false, hasParticipated: false,
  customTitle: 'Active Thread',
};
const olderThread: ChannelThread = {
  threadId: 'older-1', spaceId: 's1', channelId: 'c1', rootMessageId: 'msg-o',
  createdBy: 'user-c', createdAt: now - SEVEN_DAYS_MS - 10000,
  lastActivityAt: now - SEVEN_DAYS_MS - 10000,
  replyCount: 0, isClosed: false, hasParticipated: false,
  customTitle: 'Older Thread',
};

const mockUseChannelThreads = vi.fn();
vi.mock('../../../hooks/business/threads/useChannelThreads', () => ({
  useChannelThreads: (args: unknown) => mockUseChannelThreads(args),
}));

vi.mock('../../../components/context/ThreadContext', () => ({
  useThreadContext: () => ({
    openThread: vi.fn(),
    closeThread: vi.fn(),
  }),
}));

vi.mock('../../../components/context/useMessageDB', () => ({
  useMessageDB: () => ({
    messageDB: { getMessageById: vi.fn().mockResolvedValue(null) },
  }),
}));

vi.mock('../../../utils/platform', () => ({
  isTouchDevice: () => false,
}));

vi.mock('@quilibrium/quorum-shared', () => ({
  formatRelativeTime: () => '2h ago',
}));

// Mock primitives
vi.mock('@/components/primitives', () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
  Button: ({ children, icon, disabled, tooltip, className, onClick, ...rest }: any) => (
    <button className={className} disabled={disabled} onClick={onClick} title={tooltip} {...rest}>
      {icon && <span data-testid={`icon-${icon}`}>{icon}</span>}
      {children}
    </button>
  ),
  Flex: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
  Container: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
}));

// Mock ListSearchInput to a simple input
vi.mock('../../../components/ui/ListSearchInput', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
    />
  ),
}));

// Mock DropdownPanel to just render children when open
vi.mock('../../../components/ui/DropdownPanel', () => ({
  DropdownPanel: ({ isOpen, children, headerContent }: any) =>
    isOpen ? <div data-testid="dropdown-panel">{headerContent}{children}</div> : null,
}));

import { ThreadsListPanel } from '../../../components/thread/ThreadsListPanel';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('ThreadsListPanel', () => {
  it('renders section headers for joined, active, and older groups', () => {
    mockUseChannelThreads.mockReturnValue({
      data: [joinedThread, activeThread, olderThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText(/JOINED THREADS/)).toBeInTheDocument();
    expect(screen.getByText(/OTHER ACTIVE THREADS/)).toBeInTheDocument();
    expect(screen.getByText(/OLDER THREADS/)).toBeInTheDocument();
  });

  it('does not render empty sections', () => {
    mockUseChannelThreads.mockReturnValue({
      data: [activeThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.queryByText(/JOINED THREADS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OLDER THREADS/)).not.toBeInTheDocument();
    expect(screen.getByText(/OTHER ACTIVE THREADS/)).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    mockUseChannelThreads.mockReturnValue({ data: [], isLoading: false });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByText(/No threads yet/i)).toBeInTheDocument();
  });

  it('filters by search query, hiding section headers', async () => {
    const user = userEvent.setup();
    mockUseChannelThreads.mockReturnValue({
      data: [joinedThread, activeThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    const input = screen.getByPlaceholderText(/Search threads/i);
    await user.type(input, 'Joined');
    expect(screen.getByText('Joined Thread')).toBeInTheDocument();
    expect(screen.queryByText('Active Thread')).not.toBeInTheDocument();
    expect(screen.queryByText(/JOINED THREADS/)).not.toBeInTheDocument();
  });

  it('shows no-results state when search has no matches', async () => {
    const user = userEvent.setup();
    mockUseChannelThreads.mockReturnValue({
      data: [joinedThread],
      isLoading: false,
    });
    render(
      <ThreadsListPanel isOpen={true} onClose={vi.fn()} spaceId="s1" channelId="c1"
        mapSenderToUser={() => ({ displayName: 'Alice' })} />,
      { wrapper: makeWrapper() }
    );
    await user.type(screen.getByPlaceholderText(/Search threads/i), 'zzznomatch');
    expect(screen.getByText(/No threads match/i)).toBeInTheDocument();
  });
});
