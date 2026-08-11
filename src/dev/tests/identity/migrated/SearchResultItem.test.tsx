/**
 * SearchResultItem — a pure presentational component now: it renders the
 * `displayName` `useBatchSearchResultsDisplay` already resolved through
 * `src/identity`, with no caller-owned fallback layered on top.
 *
 * BEFORE this migration it rendered
 * `displayData?.displayName || (displayData?.isLoading ? 'Loading...' :
 * 'Unknown User')` — a second, REDUNDANT fallback stacked on top of the
 * hook's own. The resolver already guarantees a non-empty string (a
 * truncated address at worst), so that caller-owned fallback could only ever
 * mask a real resolved name if one were ever falsy — pinned here by
 * asserting a resolved `.q` name renders verbatim, and that the literal
 * strings 'Unknown User' / 'Loading...' never appear once `displayData` is
 * present.
 */
import * as React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

import { SearchResultItem } from '@/components/search/SearchResultItem';
import type { SearchResult } from '@/db/messages';
import type { BatchSearchResultDisplayData } from '@/hooks';

const SENDER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const spaceResult: SearchResult = {
  score: 1,
  highlights: [],
  message: {
    spaceId: 'space-1',
    channelId: 'channel-1',
    messageId: 'm1',
    digestAlgorithm: '',
    nonce: '',
    createdDate: Date.now(),
    modifiedDate: Date.now(),
    lastModifiedHash: '',
    content: { senderId: SENDER, type: 'post', text: 'hello world' },
    reactions: [],
    mentions: { memberIds: [], roleIds: [], channelIds: [] },
  },
} as unknown as SearchResult;

describe('SearchResultItem — renders the already-resolved name verbatim', () => {
  it('renders a resolved <qns>.q name with no caller-owned fallback overriding it', () => {
    const displayData: BatchSearchResultDisplayData = {
      messageId: 'm1',
      isDM: false,
      displayName: 'alice.q',
      spaceName: 'My Space',
      channelName: 'general',
      icon: undefined,
      isLoading: false,
    };

    render(
      <SearchResultItem
        result={spaceResult}
        onNavigate={() => {}}
        highlightTerms={(text: string) => text}
        searchTerms={[]}
        index={0}
        displayData={displayData}
      />,
    );

    expect(screen.getByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Unknown User')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders a resolved nickname with no .q, still with no fallback text', () => {
    const displayData: BatchSearchResultDisplayData = {
      messageId: 'm1',
      isDM: false,
      displayName: 'Mod Bob',
      spaceName: 'My Space',
      channelName: 'general',
      icon: undefined,
      isLoading: false,
    };

    render(
      <SearchResultItem
        result={spaceResult}
        onNavigate={() => {}}
        highlightTerms={(text: string) => text}
        searchTerms={[]}
        index={0}
        displayData={displayData}
      />,
    );

    expect(screen.getByText('Mod Bob')).toBeInTheDocument();
    expect(screen.queryByText(/\.q$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Unknown User')).not.toBeInTheDocument();
  });
});
