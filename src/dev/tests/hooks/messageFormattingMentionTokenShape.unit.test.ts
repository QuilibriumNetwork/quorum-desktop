import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';

/**
 * Bug 3: `processTextToken`'s user-mention branch matched with an ANCHORED
 * regex, `^@<(CID)>$` — recognizing a mention only when the WHOLE
 * space-delimited token was exactly `@<address>`. A real IndexedDB probe of
 * an operator's message store found a mention token 5 characters longer than
 * a bare `@<CID>` and NOT ending in `>` — i.e. extra characters glued onto
 * the token with no separating space — that fell straight through to the
 * "regular text" case and rendered completely raw (`@<Qm...>` visible,
 * literally, angle brackets included).
 *
 * The already-correct reference implementation, `processMentions` in
 * quorum-shared (`messagePreprocessing.ts:156-172`), never requires token
 * equality — it SCANS the full text for `@<(CID)>` and only ever replaces
 * the matched substring, leaving everything else untouched. This file pins
 * `processTextToken` to the same scanning principle: a well-formed CID in
 * `@<…>` form is recognized wherever it appears in the token, and whatever
 * text sits before/after the match is preserved via `prefix`/`suffix`
 * rather than being swallowed or dropped.
 *
 * The CID itself has a fixed, self-delimiting length (`Qm` + 44
 * alphanumeric characters), so the closing `>` is consumed when present but
 * is NOT required to locate the address — a token missing its closing
 * bracket entirely (shape 3 below) still resolves instead of leaking the
 * raw token. This is a DELIBERATE point of divergence from
 * `processMentions`'s own `hasWordBoundaries` gate (which requires the char
 * before/after the match to be whitespace or specific punctuation, and
 * DOES require the closing `>`) — see the fix report for why the
 * notification/preview fallback path is intentionally more lenient here.
 */

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

import { useMessageFormatting } from '@/hooks/business/messages/useMessageFormatting';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const SENDER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const MENTIONED = 'QmPeerTEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

const messageWithText = (text: string) =>
  ({
    messageId: 'msg-1',
    spaceId: 'space-1',
    channelId: 'channel-1',
    createdDate: 1_000,
    content: { type: 'post', senderId: SENDER, text: [text] },
    reactions: [],
    mentions: { memberIds: [MENTIONED], roleIds: [], channelIds: [] },
  }) as any;

function renderFormatting(text: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        IdentityScopeProvider,
        {
          spaceId: 'space-1',
          rostersBySpace: { 'space-1': { [MENTIONED]: { display_name: 'Ada Lovelace' } } },
          selfAddress: null,
        },
        children,
      ),
    );
  return renderHook(
    () =>
      useMessageFormatting({
        message: messageWithText(text),
        stickers: {},
        mapSenderToUser: () => undefined,
        onImageClick: () => {},
        currentSpaceId: 'space-1',
      }),
    { wrapper },
  );
}

describe('useMessageFormatting — processTextToken recognizes a mention token carrying extra characters', () => {
  beforeAll(() => {
    getPublicProfile.mockResolvedValue({ data: null });
  });

  it('control: an exact `@<CID>` token resolves the name (must not regress)', async () => {
    const token = `@<${MENTIONED}>`;
    const { result } = renderFormatting(token);

    await waitFor(() => {
      const parsed = result.current.processTextToken(token, 'msg-1', 0, 0);
      expect(parsed.type).toBe('mention');
      expect(parsed.displayName).toBe('Ada Lovelace');
      expect(parsed.prefix).toBe('');
      expect(parsed.suffix).toBe('');
    });
  });

  it('shape (a): trailing punctuation directly after `>` resolves the name and preserves the punctuation', async () => {
    const token = `@<${MENTIONED}>!`; // 1 extra char after `>`
    const { result } = renderFormatting(token);

    await waitFor(() => {
      const parsed = result.current.processTextToken(token, 'msg-1', 0, 0);
      expect(parsed.type).toBe('mention');
      expect(parsed.displayName).toBe('Ada Lovelace');
      expect(parsed.suffix).toBe('!');
      expect(JSON.stringify(parsed)).not.toContain('@<');
    });
  });

  it('shape (b): text immediately following `>` with no space resolves the name and preserves the text', async () => {
    const token = `@<${MENTIONED}>thx!!`; // 5 extra chars after `>` — the operator's measured shape
    const { result } = renderFormatting(token);

    await waitFor(() => {
      const parsed = result.current.processTextToken(token, 'msg-1', 0, 0);
      expect(parsed.type).toBe('mention');
      expect(parsed.displayName).toBe('Ada Lovelace');
      expect(parsed.suffix).toBe('thx!!');
      expect(JSON.stringify(parsed)).not.toContain('@<');
    });
  });

  it('shape (c): a token with no closing `>` at all still resolves the name', async () => {
    const token = `@<${MENTIONED}`; // no closing bracket anywhere
    const { result } = renderFormatting(token);

    await waitFor(() => {
      const parsed = result.current.processTextToken(token, 'msg-1', 0, 0);
      expect(parsed.type).toBe('mention');
      expect(parsed.displayName).toBe('Ada Lovelace');
      expect(parsed.suffix).toBe('');
      expect(JSON.stringify(parsed)).not.toContain('@<');
    });
  });

  it('bulk `requestNames` prefetch also picks up a mention with no closing `>` (so its name is fetchable, not stuck on the fallback)', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'ada', display_name: 'Ada Lovelace' } });
    const token = `@<${MENTIONED}`;
    const { result } = renderFormatting(token);

    await waitFor(() => {
      const parsed = result.current.processTextToken(token, 'msg-1', 0, 0);
      expect(parsed.displayName).toBe('ada.q');
    });
  });
});
