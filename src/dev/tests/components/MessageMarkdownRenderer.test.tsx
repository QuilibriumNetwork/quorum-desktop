import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Keep the tree light: the invite card and the YouTube facade pull in app state
// we don't need to exercise the markdown pipeline.
vi.mock('@/components/message/InviteLink', () => ({
  InviteLink: ({ inviteLink }: { inviteLink: string }) => (
    <div data-testid="invite-card" data-invite-link={inviteLink} />
  ),
}));
vi.mock('@/components/ui/YouTubeFacade', () => ({
  YouTubeFacade: ({ videoId }: { videoId: string }) => (
    <div data-testid="youtube-embed" data-video-id={videoId} />
  ),
}));

import { MessageMarkdownRenderer } from '@/components/message/MessageMarkdownRenderer';

const INVITE_URL =
  'https://app.quorummessenger.com/invite/#spaceId=QmZM3AKwKfMprQZvSk3Mpgii2JS31TS5izHrwJe1itprrG&configKey=9e390fd97e0a61aecdce931c7f3dab04d0e57b8da89a50510981be5394714eda';

describe('MessageMarkdownRenderer — invite links', () => {
  it('renders a markdown-linked invite as a real anchor, not plain text', () => {
    render(<MessageMarkdownRenderer content={`[Quorum Space](${INVITE_URL})`} />);

    const link = screen.getByRole('link', { name: 'Quorum Space' });
    expect(link).toHaveAttribute('href', INVITE_URL);
    // The label must not leak the stray `)` left behind by a mangled destination.
    expect(screen.queryByText(/\)/)).not.toBeInTheDocument();
  });

  it('still renders a bare invite URL as an invite card', () => {
    render(<MessageMarkdownRenderer content={INVITE_URL} />);

    expect(screen.getByTestId('invite-card')).toHaveAttribute('data-invite-link', INVITE_URL);
  });

  it('leaves an invite URL inside inline code untouched', () => {
    render(<MessageMarkdownRenderer content={`\`${INVITE_URL}\``} />);

    expect(screen.queryByTestId('invite-card')).not.toBeInTheDocument();
    expect(screen.getByText(INVITE_URL)).toBeInTheDocument();
  });
});
