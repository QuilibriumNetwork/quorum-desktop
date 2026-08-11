import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
import { IdentityScopeProvider } from '@/identity/identityProvider';

// MessageMarkdownRenderer resolves mention names via src/identity
// (useNameResolver), which throws outside an IdentityScopeProvider — none of
// these cases contain a `@<address>` mention, but the provider is required
// unconditionally (every render calls the hook), so every case needs one in
// scope regardless of what it exercises.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const withIdentityScope = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <IdentityScopeProvider rostersBySpace={{}} selfAddress={null}>
      {children}
    </IdentityScopeProvider>
  </QueryClientProvider>
);
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: withIdentityScope });

const INVITE_URL =
  'https://app.quorummessenger.com/invite/#spaceId=QmPeerQEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz&configKey=9e390fd97e0a61aecdce931c7f3dab04d0e57b8da89a50510981be5394714eda';

// The invite card replaces the link entirely, so "card" and "plain link" are
// mutually exclusive outcomes — every case below asserts both directions.
const expectCard = () => {
  expect(screen.getByTestId('invite-card')).toHaveAttribute('data-invite-link', INVITE_URL);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
};
const expectNoCard = () => {
  expect(screen.queryByTestId('invite-card')).not.toBeInTheDocument();
};

describe('MessageMarkdownRenderer — invite links', () => {
  describe('card only when the link stands alone on its line', () => {
    it('shows the card for a bare link that is the whole message', () => {
      render(<MessageMarkdownRenderer content={INVITE_URL} />);
      expectCard();
    });

    it('shows the card for a bare link alone on its own line among prose', () => {
      render(<MessageMarkdownRenderer content={`come join us\n${INVITE_URL}\nsee you there`} />);
      expectCard();
      expect(screen.getByText(/come join us/)).toBeInTheDocument();
    });

    it('keeps a mid-sentence link as a plain link, not a card', () => {
      render(<MessageMarkdownRenderer content={`join here ${INVITE_URL} thanks`} />);
      expectNoCard();
      expect(screen.getByRole('link')).toHaveAttribute('href', INVITE_URL);
    });

    it('keeps a labelled markdown link as a plain link, not a card', () => {
      render(<MessageMarkdownRenderer content={`[Quorum Space](${INVITE_URL})`} />);

      expectNoCard();
      const link = screen.getByRole('link', { name: 'Quorum Space' });
      expect(link).toHaveAttribute('href', INVITE_URL);
      // No stray `)` left over from a mangled link destination.
      expect(screen.queryByText(/\)/)).not.toBeInTheDocument();
    });

    it('leaves a link inside inline code untouched', () => {
      render(<MessageMarkdownRenderer content={`\`${INVITE_URL}\``} />);

      expectNoCard();
      expect(screen.getByText(INVITE_URL)).toBeInTheDocument();
    });

    it('handles one labelled and one bare link in the same message', () => {
      render(
        <MessageMarkdownRenderer content={`[Quorum Space](${INVITE_URL})\n${INVITE_URL}`} />
      );

      expect(screen.getByTestId('invite-card')).toHaveAttribute('data-invite-link', INVITE_URL);
      expect(screen.getByRole('link', { name: 'Quorum Space' })).toHaveAttribute('href', INVITE_URL);
    });
  });

  describe('long links are truncated for display', () => {
    const LONG =
      'https://example.com/a/very/long/path/that/keeps/going/and/going/and/going?q=1234567890';

    it('truncates an auto-linked URL to 50 chars but keeps the full href', () => {
      render(<MessageMarkdownRenderer content={LONG} />);

      const link = screen.getByRole('link');
      expect(link.textContent).toBe(`${LONG.substring(0, 50)}...`);
      expect(link).toHaveAttribute('href', LONG);
      expect(link).toHaveAttribute('title', LONG);
    });

    it('truncates a mid-sentence invite link too', () => {
      render(<MessageMarkdownRenderer content={`join here ${INVITE_URL} thanks`} />);

      const link = screen.getByRole('link');
      expect(link.textContent).toBe(`${INVITE_URL.substring(0, 50)}...`);
      expect(link).toHaveAttribute('href', INVITE_URL);
    });

    it('never truncates an author-written label', () => {
      render(<MessageMarkdownRenderer content={`[my link](${LONG})`} />);

      expect(screen.getByRole('link').textContent).toBe('my link');
    });
  });
});
