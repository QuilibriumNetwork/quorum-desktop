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
 *   1. Simulates what typing actually does: the candidate list CHANGES across
 *      renders (narrows as a filter tightens, widens again on backspace,
 *      sometimes lands on the exact same result twice — a debounced re-filter
 *      settling on the same set). Fetch count is asserted after EVERY step
 *      against the number of GENUINELY NEW addresses introduced so far, never
 *      against the render count. This replaced an earlier version (found
 *      overclaiming in review 2026-08-11) that only ever re-rendered with the
 *      SAME address set — a shape the provider's `requested` Set absorbs
 *      regardless of whether the calling code is correctly memoized, so it
 *      could not have failed even against a component that called `request()`
 *      on every render. See the RED transcript recorded in
 *      `.superpowers/sdd/2026-08-10-identity-resolution-architecture-plan/placeholder-and-provider-merge-report.md`
 *      for what actually falsifies this version.
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

  it('1. typing narrows/widens the candidate list: fetches track genuinely NEW addresses only, never render count', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Steps simulate a real keystroke session: open on a broad match, narrow
    // as the filter tightens (rows for 2/3/4 unmount — no new addresses, so
    // no new fetches are expected even though it's a genuine option-list
    // change, not a same-array re-render), widen on backspace to a DIFFERENT
    // broader match that reveals two addresses never rendered before (5, 6 —
    // genuinely new, so exactly 2 new fetches expected), a redundant
    // re-render landing on that exact same widened result (debounce noise —
    // zero new fetches), then backspace further so address 2 — narrowed out
    // and unmounted two steps ago, its <MemberName> row genuinely destroyed
    // and about to be genuinely recreated — reappears alongside the rest.
    // That last step is the strongest form of "never per keystroke": it's a
    // REAL remount of an already-known address (not a same-array re-render
    // sidestep), so it only passes if the fetch is bounded by address
    // identity, not by component mount lifecycle. Each step's expected DELTA
    // is the count of addresses in that step not seen in any earlier step —
    // never the render count and never the size of that step's own option
    // list.
    const steps: { label: string; addrs: number[]; expectedNewFetches: number }[] = [
      { label: 'open (0-4)', addrs: [0, 1, 2, 3, 4], expectedNewFetches: 5 },
      { label: 'narrow to (0-1)', addrs: [0, 1], expectedNewFetches: 0 },
      { label: 'widen to (0,1,5,6) — 5,6 are new', addrs: [0, 1, 5, 6], expectedNewFetches: 2 },
      { label: 'same result again (debounce noise)', addrs: [0, 1, 5, 6], expectedNewFetches: 0 },
      { label: 'widen further: 2 REMOUNTS (already known, unmounted at step 2)', addrs: [0, 1, 2, 5, 6], expectedNewFetches: 0 },
    ];

    let rerender: ReturnType<typeof render>['rerender'] | undefined;
    let runningTotal = 0;

    for (const step of steps) {
      const options = optionsFor(step.addrs.map(addressAt));
      const tree = (
        <QueryClientProvider client={queryClient}>
          <Dropdown isOpen options={options} />
        </QueryClientProvider>
      );
      if (!rerender) {
        ({ rerender } = render(tree));
      } else {
        rerender(tree);
      }
      await settle();

      const total = getPublicProfile.mock.calls.length;
      const delta = total - runningTotal;
      // eslint-disable-next-line no-console
      console.log(
        `[mentionDropdownFetch] scenario 1 — step "${step.label}": total fetches=${total} (delta=${delta}, expected delta=${step.expectedNewFetches})`,
      );
      expect(delta).toBe(step.expectedNewFetches);
      runningTotal = total;
    }

    // Final cross-check, independent of the per-step deltas above: total
    // fetches equals the count of DISTINCT addresses shown across the WHOLE
    // session (0,1,2,3,4,5,6 = 7) — not the number of renders (4) and not
    // the sum of each step's option-list length (5+2+4+4=15).
    const distinctAddressesShown = new Set(steps.flatMap((s) => s.addrs)).size;
    expect(runningTotal).toBe(distinctAddressesShown);
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
