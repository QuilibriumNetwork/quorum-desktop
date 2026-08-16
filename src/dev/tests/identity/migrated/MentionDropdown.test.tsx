/**
 * MentionDropdown — REVISED 2026-08-11 (design decision 3, second look).
 *
 * The operator's original call was "any surface that can render a whole
 * roster must not enrich" — but the mention autocomplete never renders a
 * whole roster: `useMentionInput` caps it at `maxDisplayResults = 50`, and
 * after a character or two it is a handful. That made this surface
 * over-conservative, and produced a visible inconsistency: the dropdown
 * showed a plain roster name while the message you were about to post would
 * render `<name>.q` for the same person (message headers, DM headers, etc.
 * already enrich). This file used to pin the OLD "never .q" rule — see git
 * history — and now pins the new one: a rendered row asks for the SAME
 * verified suffix the rest of the app would show for that person, via
 * `<MemberName enrich>`.
 *
 * The member sidebar is NOT part of this reversal — it is genuinely
 * unbounded (a whole space's roster) and keeps its no-enrich policy, pinned
 * separately by `identitySidebarFetch.test.tsx`. The fetch-COST side of this
 * change (bounded by distinct candidates, no keystroke/render multiplier, no
 * regrowth on reopen) is measured separately in
 * `../mentionDropdownFetch.test.tsx` — this file covers WHAT renders, not
 * how many requests it costs.
 *
 * Also still covers the filtering bug from the original migration:
 * `useMentionInput`'s matching must read the same fields the roster ladder
 * reads (`globalDisplayName`, not just `displayName`) — untouched by this
 * revision.
 */
import * as React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
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

import { MentionDropdown } from '@/components/message/MentionDropdown';
import { useMentionInput } from '@/hooks/business/mentions/useMentionInput';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerDEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// Deliberately WRONG displayName/primaryUsername on the OPTION's own data —
// proof the row renders through the identity module's roster+profile
// resolution, never this local, possibly-stale option payload (same
// precedent the pre-revision test used for the roster/global tiers; now
// extended to the QNS tier too).
function staleOption(overrides: Partial<MentionOption & { type: 'user' }> = {}): MentionOption {
  return {
    type: 'user',
    data: {
      address: ADDR,
      displayName: 'Stale Option Name',
      primaryUsername: 'not-the-real-qns-handle',
      globalDisplayName: 'Stale Global',
      userIcon: undefined,
      ...(overrides as any).data,
    },
  } as MentionOption;
}

function renderDropdown(
  rosters: Record<string, Record<string, unknown>>,
  options: MentionOption[],
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        <MentionDropdown
          isOpen
          filteredOptions={options}
          selectedIndex={0}
          onSelectOption={() => {}}
        />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
}

describe('MentionDropdown — user rows enrich (bounded, capped at maxDisplayResults)', () => {
  beforeEach(() => {
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: no per-space nickname, a global name, and a QNS name — renders <qns>.q, from the identity module (never the stale primaryUsername carried on the option itself)', async () => {
    getPublicProfile.mockResolvedValue({
      data: { primary_username: 'alice', display_name: 'Alice', profile_image: '', bio: '', timestamp: 1, signature: '' },
    });

    renderDropdown(
      { [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } },
      [staleOption()],
    );

    expect(await screen.findByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Stale Option Name')).not.toBeInTheDocument();
    expect(screen.queryByText('not-the-real-qns-handle')).not.toBeInTheDocument();
  });

  it('a candidate with ONLY a global name (no QNS profile) renders it plain, with no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: null });

    renderDropdown(
      { [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } },
      [staleOption()],
    );

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    // Give the (resolved-to-null) fetch a moment to settle before asserting
    // the negative — a false pass here would just mean we asserted too early.
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(ADDR));
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
  });

  it('a member WITH a per-space nickname renders the nickname, no .q — even when a QNS name IS cached (the per-space tier still outranks it)', async () => {
    getPublicProfile.mockResolvedValue({
      data: { primary_username: 'alice', display_name: 'Alice', profile_image: '', bio: '', timestamp: 1, signature: '' },
    });

    renderDropdown(
      { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } },
      [staleOption()],
    );

    expect(await screen.findByText('Mod Alice')).toBeInTheDocument();
    await waitFor(() => expect(getPublicProfile).toHaveBeenCalledWith(ADDR));
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Option Name')).not.toBeInTheDocument();
  });

  it("MentionDropdown's filter matches the resolved (displayed) name, not just the raw displayName field", async () => {
    // Follow-global state: no per-space override, name comes from
    // globalDisplayName. The OLD filter only checked `displayName` (empty)
    // + `primaryUsername` + `address`, so typing "ali" — a prefix of the
    // exact name shown in the dropdown — found nobody. Untouched by the
    // enrich revision above.
    const users = [
      {
        address: ADDR,
        displayName: undefined,
        globalDisplayName: 'Alice',
        primaryUsername: undefined,
      },
    ];

    getPublicProfile.mockResolvedValue({ data: null });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <IdentityScopeProvider
          spaceId={SPACE_ID}
          rostersBySpace={{ [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } }}
          selfAddress={null}
        >
          {children}
        </IdentityScopeProvider>
      </QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      (props: { textValue: string; cursorPosition: number }) =>
        useMentionInput({ ...props, users, onMentionSelect: () => {} }),
      { wrapper, initialProps: { textValue: '@ali', cursorPosition: 4 } },
    );
    // Force the debounced filter to re-run against the current props.
    rerender({ textValue: '@ali', cursorPosition: 4 });

    await waitFor(() => {
      expect(result.current.filteredOptions).toHaveLength(1);
    });
    expect(result.current.filteredOptions[0]).toMatchObject({
      type: 'user',
      data: { address: ADDR },
    });
  });
});
