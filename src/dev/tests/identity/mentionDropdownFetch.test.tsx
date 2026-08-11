/**
 * MentionDropdown fetch cost — the instrument for design decision 3's
 * revision (2026-08-11): the mention autocomplete now enriches (`enrich` on
 * `<MemberName>`), same measurement style `identitySidebarFetch.test.tsx`
 * used to prove the sidebar's OPPOSITE (no-enrich) policy. This is what
 * stops "capped at maxDisplayResults" from quietly becoming a storm if that
 * cap ever grows: a repeatable test beats a one-off dev-console count.
 *
 * Two scenarios, one shared `QueryClient` per test:
 *
 *   1. Opening the dropdown with N distinct user candidates rendered issues
 *      AT MOST one fetch per distinct candidate — never per keystroke
 *      (simulated by re-rendering with an equivalent options array, standing
 *      in for a debounced re-filter landing on the same result set) and
 *      never per render.
 *   2. Re-opening the dropdown (closing it — `isOpen={false}`, which
 *      `MentionDropdown` renders as `null`, unmounting every row — then
 *      reopening with the same candidates) adds ZERO further fetches: the
 *      identity provider's own `requested` dedupe plus its 1h per-query
 *      `staleTime` serve it back from memory. The provider itself stays
 *      mounted across the toggle, exactly as it does in the real composer
 *      (the dropdown is a child of a much larger provider-wrapped subtree).
 */
import * as React from 'react';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { MentionOption } from '@/hooks/business/mentions';

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

import { IdentityScopeProvider } from '@/identity/identityProvider';
import { MentionDropdown } from '@/components/message/MentionDropdown';

const SPACE_ID = 'space-mention-fetch';
const DISTINCT_COUNT = 12;

// Placeholder addresses, not real ones — repo fixture convention.
const addressAt = (i: number): string =>
  `QmMentionFetch${String(i).padStart(4, '0')}${'B'.repeat(24)}`;

const distinctAddresses = Array.from({ length: DISTINCT_COUNT }, (_, i) => addressAt(i));

const rosterRows = distinctAddresses.reduce<Record<string, { display_name: string; global_display_name: string }>>(
  (acc, address, i) => {
    acc[address] = { display_name: '', global_display_name: `Candidate ${i}` };
    return acc;
  },
  {},
);

const optionsFor = (addrs: string[]): MentionOption[] =>
  addrs.map((address) => ({ type: 'user' as const, data: { address } }));

/** Resolves after a tick — realistic async shape, matters for overlapping
 *  in-flight calls to be observable rather than trivially serialized. */
function fakeGetPublicProfile(address: string) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        data: {
          display_name: `Profile ${address}`,
          profile_image: '',
          bio: '',
          timestamp: 1,
          signature: '',
        },
        status: 200,
      });
    }, 5);
  });
}

/** Give any fetch a couple of ticks to start before sampling. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 10));
  });
}

function Dropdown({ isOpen, options }: { isOpen: boolean; options: MentionOption[] }) {
  return (
    <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={{ [SPACE_ID]: rosterRows }} selfAddress={null}>
      <MentionDropdown
        isOpen={isOpen}
        filteredOptions={options}
        selectedIndex={0}
        onSelectOption={() => {}}
      />
    </IdentityScopeProvider>
  );
}

describe('mention autocomplete identity — enrich opt-in, fetch cost (design decision 3, revised 2026-08-11)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
    getPublicProfile.mockImplementation(fakeGetPublicProfile);
  });

  it('1. opening the dropdown: fetches bounded by distinct candidates rendered, never per keystroke/render', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const allOptions = optionsFor(distinctAddresses);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Dropdown isOpen options={allOptions} />
      </QueryClientProvider>,
    );
    await settle();

    const afterOpen = getPublicProfile.mock.calls.length;
    // eslint-disable-next-line no-console
    console.log(
      `[mentionDropdownFetch] scenario 1 — candidates rendered=${DISTINCT_COUNT} fetches=${afterOpen}`,
    );
    expect(afterOpen).toBe(DISTINCT_COUNT);

    // Simulate three keystrokes / re-renders that keep landing on the SAME
    // result set (a fresh array each time — not a reference-equality
    // shortcut) — the falsifiable case for "never per keystroke".
    for (let i = 0; i < 3; i++) {
      rerender(
        <QueryClientProvider client={queryClient}>
          <Dropdown isOpen options={optionsFor(distinctAddresses)} />
        </QueryClientProvider>,
      );
      await settle();
    }

    const afterKeystrokes = getPublicProfile.mock.calls.length;
    // eslint-disable-next-line no-console
    console.log(
      `[mentionDropdownFetch] scenario 1 — after 3 same-result re-renders, fetches=${afterKeystrokes}`,
    );
    expect(afterKeystrokes).toBe(afterOpen);
  });

  it('2. re-opening the dropdown adds ZERO further fetches — the 1h cache + provider dedupe serve it', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const allOptions = optionsFor(distinctAddresses);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <Dropdown isOpen options={allOptions} />
      </QueryClientProvider>,
    );
    await settle();
    const afterFirstOpen = getPublicProfile.mock.calls.length;
    expect(afterFirstOpen).toBe(DISTINCT_COUNT);

    // Close: MentionDropdown's own early return (`!isOpen`) renders null,
    // unmounting every row's <MemberName enrich>. The provider (Dropdown's
    // wrapper) stays mounted, exactly as in the real composer.
    rerender(
      <QueryClientProvider client={queryClient}>
        <Dropdown isOpen={false} options={allOptions} />
      </QueryClientProvider>,
    );
    await settle();

    // Reopen with the same candidates.
    rerender(
      <QueryClientProvider client={queryClient}>
        <Dropdown isOpen options={allOptions} />
      </QueryClientProvider>,
    );
    await settle();

    const afterReopen = getPublicProfile.mock.calls.length;
    // eslint-disable-next-line no-console
    console.log(
      `[mentionDropdownFetch] scenario 2 — after first open=${afterFirstOpen}, after close+reopen=${afterReopen}`,
    );
    expect(afterReopen).toBe(afterFirstOpen);
  });
});
