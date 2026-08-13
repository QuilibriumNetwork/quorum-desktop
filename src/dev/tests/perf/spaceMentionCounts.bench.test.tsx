import * as React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Space } from '@quilibrium/quorum-shared';

/**
 * Instrument for "notification switches freeze the UI for 0.5-2s".
 * See .agents/issues/2026-08-13-notification-toggles-freeze-the-ui-via-a-full-mention-recount.md
 *
 * Every mute toggle calls `invalidateNotificationQueries()`, which invalidates
 * the space-wide ['mention-counts','space'] key and re-runs
 * `useSpaceMentionCounts`. The suspected cost is that its queryFn walks EVERY
 * channel of EVERY space doing THREE sequential IndexedDB reads each, on the
 * main thread.
 *
 * WHAT THIS MEASURES, AND WHY IT IS NOT WALL-CLOCK.
 * The MessageDB here is a counting stub, not a real (or faked) IndexedDB, so
 * the elapsed ms below is meaningless as a browser prediction and is printed as
 * context only — never asserted on. What transfers is the SHAPE of the work:
 * how many round-trips the hook issues per channel, and how that scales. Those
 * counts are deterministic and are the actual mechanism behind the freeze.
 *
 * NOT part of the unit suite — `vitest.config.ts` excludes `perf/**` because
 * the load this generates makes timing-sensitive tests elsewhere flake. Run it
 * with `yarn bench`.
 *
 * This drives the REAL hook via renderHook. It deliberately does NOT
 * re-implement the loop: a copy would measure the copy and would keep passing
 * if the real hook changed.
 *
 * TWO KNOWN LIMITS OF THIS INSTRUMENT — found in review, read before trusting
 * the numbers as a cost model:
 *
 *  1. It measures the MENTION half only. `useSpaceReplyCounts` is a structural
 *     twin and `invalidateNotificationQueries()` invalidates both space-level
 *     keys, so a real toggle costs roughly DOUBLE what this reports.
 *  2. It treats the three reads as equal cost. They are not: getConversation is
 *     an O(1) store.get and getThreadReadTimesForChannel is a small bounded
 *     index.getAll, but getUnreadMentions (db/messages.ts:2876) is a CURSOR that
 *     only stops early once it has `limit` MATCHES — so with no unread mentions
 *     it walks every message since lastReadTimestamp (the whole channel history
 *     when that is 0). True cost is O(messages scanned), not O(channels).
 *
 * So these counts are a lower bound on the SHAPE of the problem, not a
 * prediction of milliseconds. Converting them to time needs a browser profile.
 */

const USER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';

// Round-trip counters, incremented by the fake MessageDB below.
const calls = {
  getConversation: 0,
  getThreadReadTimesForChannel: 0,
  getUnreadMentions: 0,
};
const resetCalls = () => {
  calls.getConversation = 0;
  calls.getThreadReadTimesForChannel = 0;
  calls.getUnreadMentions = 0;
};

// A MessageDB stub that counts round-trips and resolves empty — i.e. the
// NO-UNREAD-MENTIONS case, which per the early-exit reading is the worst case,
// because the `spaceTotal >= DISPLAY_THRESHOLD` break can never fire.
const messageDB = {
  getUserConfig: async () => ({ address: USER, spaceIds: [] }),
  getConversation: async () => {
    calls.getConversation++;
    return { conversation: { lastReadTimestamp: 0 } };
  },
  getThreadReadTimesForChannel: async () => {
    calls.getThreadReadTimesForChannel++;
    return {};
  },
  getUnreadMentions: async () => {
    calls.getUnreadMentions++;
    return [];
  },
};

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  usePasskeysContext: () => ({ currentPasskeyInfo: { address: USER } }),
}));

vi.mock('../../../components/context/useMessageDB', () => ({
  useMessageDB: () => ({ messageDB }),
}));

import { useSpaceMentionCounts } from '../../../hooks/business/mentions/useSpaceMentionCounts';

/** A space with `channelCount` channels spread over 3 groups. */
const makeSpace = (i: number, channelCount: number): Space => {
  const channels = Array.from({ length: channelCount }, (_, c) => ({
    channelId: `space-${i}-channel-${c}`,
    channelName: `channel-${c}`,
  }));
  const perGroup = Math.ceil(channelCount / 3) || 1;
  return {
    spaceId: `space-${i}`,
    spaceName: `Space ${i}`,
    groups: [0, 1, 2].map((g) => ({
      groupName: `group-${g}`,
      channels: channels.slice(g * perGroup, (g + 1) * perGroup),
    })),
  } as unknown as Space;
};

const wrapper = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

/** Render the real hook once and report round-trips + elapsed ms. */
const measure = async (spaces: Space[]) => {
  resetCalls();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const started = performance.now();
  renderHook(() => useSpaceMentionCounts({ spaces }), {
    wrapper: wrapper(client),
  });
  await waitFor(() => expect(client.isFetching()).toBe(0));
  const elapsedMs = performance.now() - started;
  client.clear();
  return { ...calls, elapsedMs };
};

describe('useSpaceMentionCounts — cost of one recount (perf instrument)', () => {
  beforeEach(() => resetCalls());

  it('issues THREE sequential IndexedDB reads per channel, for every channel of every space', async () => {
    const grid = [
      { spaces: 1, channels: 5 },
      { spaces: 5, channels: 10 },
      { spaces: 10, channels: 20 },
    ];

    const rows: string[] = [];
    for (const { spaces: s, channels: c } of grid) {
      const list = Array.from({ length: s }, (_, i) => makeSpace(i, c));
      const r = await measure(list);
      const totalChannels = s * c;
      const roundTrips =
        r.getConversation +
        r.getThreadReadTimesForChannel +
        r.getUnreadMentions;

      rows.push(
        `${String(s).padStart(3)} spaces x ${String(c).padStart(3)} ch = ` +
          `${String(totalChannels).padStart(4)} channels -> ` +
          `${String(roundTrips).padStart(5)} IDB round-trips ` +
          `(${r.elapsedMs.toFixed(0)}ms with a stub DB, NOT a browser figure)`
      );

      // The mechanism: one read of each kind per channel, no batching.
      expect(r.getConversation).toBe(totalChannels);
      expect(r.getThreadReadTimesForChannel).toBe(totalChannels);
      expect(r.getUnreadMentions).toBe(totalChannels);
      // Which is 3 round-trips per channel, i.e. linear in TOTAL channels.
      expect(roundTrips).toBe(totalChannels * 3);
    }

    console.log(
      '\n[mention-recount cost per toggle]\n' + rows.join('\n') + '\n'
    );
  });

  it('costs the SAME whether spaces are few-and-wide or many-and-narrow (scales with total channels, not space count)', async () => {
    // A control on the diagnosis: if cost tracked space count rather than total
    // channel count, these two would differ. They must not.
    const fewWide = Array.from({ length: 2 }, (_, i) => makeSpace(i, 50));
    const manyNarrow = Array.from({ length: 50 }, (_, i) => makeSpace(i, 2));

    const a = await measure(fewWide);
    const b = await measure(manyNarrow);

    expect(a.getConversation).toBe(100);
    expect(b.getConversation).toBe(100);
    expect(
      a.getConversation + a.getThreadReadTimesForChannel + a.getUnreadMentions
    ).toBe(
      b.getConversation + b.getThreadReadTimesForChannel + b.getUnreadMentions
    );
  });

  it('CONTROL ARM: a muted space is skipped entirely, so it costs zero reads', async () => {
    // `useSpaceMentionCounts` does `if (settings?.isMuted) continue`. This arm
    // exists to prove the instrument can register a DIFFERENCE at all — if a
    // muted space also cost 3 reads/channel, the counters would be measuring
    // something other than the loop, and every number above would be suspect.
    const spaces = Array.from({ length: 4 }, (_, i) => makeSpace(i, 10));
    const before = await measure(spaces);
    expect(before.getConversation).toBe(40);

    messageDB.getUserConfig = async () => ({
      address: USER,
      spaceIds: [],
      notificationSettings: Object.fromEntries(
        spaces.map((s) => [s.spaceId, { spaceId: s.spaceId, isMuted: true }])
      ),
    });

    const after = await measure(spaces);
    expect(after.getConversation).toBe(0);
    expect(after.getUnreadMentions).toBe(0);

    // restore for any later test in this file
    messageDB.getUserConfig = async () => ({ address: USER, spaceIds: [] });
  });
});
