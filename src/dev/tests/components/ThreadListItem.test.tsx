import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChannelThread } from '../../../api/quorumApi';

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

// Mock formatRelativeTime
vi.mock('@quilibrium/quorum-shared', () => ({
  formatRelativeTime: () => '2h ago',
}));

import { ThreadListItem } from '../../../components/thread/ThreadListItem';

const baseThread: ChannelThread = {
  threadId: 'thread-1', spaceId: 'space-1', channelId: 'ch-1',
  rootMessageId: 'msg-1', createdBy: 'user-1', createdAt: 1000,
  lastActivityAt: 5000, replyCount: 3, isClosed: false, hasParticipated: false,
};

describe('ThreadListItem', () => {
  it('renders customTitle when provided', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, customTitle: 'My Custom Title' }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText('My Custom Title')).toBeInTheDocument();
  });

  it('falls back to titleSnapshot when no customTitle', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, titleSnapshot: 'Snapshot text' }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText('Snapshot text')).toBeInTheDocument();
  });

  it('falls back to "Thread" when neither customTitle nor titleSnapshot', () => {
    render(
      <ThreadListItem
        thread={baseThread}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText('Thread')).toBeInTheDocument();
  });

  it('shows lock icon when thread is closed', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, isClosed: true }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('calls onOpen when row is clicked', async () => {
    const user = userEvent.setup();
    const handleOpen = vi.fn();
    render(
      <ThreadListItem
        thread={baseThread}
        onOpen={handleOpen}
        resolveDisplayName={() => 'Alice'}
      />
    );
    await user.click(screen.getByRole('button'));
    expect(handleOpen).toHaveBeenCalledWith('msg-1');
  });

  it('shows reply count in meta', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, replyCount: 5 }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText(/5 replies/)).toBeInTheDocument();
  });

  it('shows singular "1 reply" for replyCount=1', () => {
    render(
      <ThreadListItem
        thread={{ ...baseThread, replyCount: 1 }}
        onOpen={vi.fn()}
        resolveDisplayName={() => 'Alice'}
      />
    );
    expect(screen.getByText(/1 reply/)).toBeInTheDocument();
  });
});
