/**
 * MentionDropdown — the autocomplete list can render a whole roster (up to
 * 50 matches, and an unqueried view already lists 10), so — same rule as the
 * member sidebar — it must NOT enrich: every row resolves from the roster
 * maps already in memory (`<MemberName>` with no `enrich`), never a
 * per-address public-profile fetch. A row therefore shows the roster name
 * (per-space override, else the global name) and NEVER a `.q` suffix, even
 * when the option's own data happens to carry a `primaryUsername` (e.g.
 * cached from some other enriched surface) — that data must be ignored here.
 *
 * BEFORE this migration a row resolved via `resolveSpaceMemberName({
 * address, displayName: option.data.displayName, primaryUsername:
 * option.data.primaryUsername, globalDisplayName: option.data.globalDisplayName
 * })` — a per-row computation fed entirely from `option.data`, independent of
 * the ambient roster. `option.data` below deliberately carries a WRONG
 * `displayName` and a `primaryUsername` that must NOT surface as `.q` — proof
 * the row renders through the identity module's roster-only ladder and not
 * this local, per-option data.
 *
 * Also covers the filtering bug the migration surfaced: `useMentionInput`'s
 * `filterUsers` matched only the RAW `displayName` field, never
 * `globalDisplayName` — so a follow-global member (the default state, empty
 * per-space override) could not be found by typing the exact name the
 * dropdown shows for them. Fixed by matching the same fields the roster
 * ladder reads.
 */
import * as React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
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

import { MentionDropdown } from '@/components/message/MentionDropdown';
import { useMentionInput } from '@/hooks/business/mentions/useMentionInput';
import { IdentityScopeProvider } from '@/identity/identityProvider';

const ADDR = 'QmPeerDEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

// Deliberately WRONG displayName, plus a primaryUsername that must NOT
// surface as ".q" on this no-enrich surface — see file header.
function staleOption(overrides: Partial<MentionOption & { type: 'user' }> = {}): MentionOption {
  return {
    type: 'user',
    data: {
      address: ADDR,
      displayName: 'Stale Option Name',
      primaryUsername: 'alice',
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

describe('MentionDropdown — user rows resolve via the identity module (no enrich)', () => {
  it('the load-bearing case: no per-space nickname, a global name — renders the ROSTER name with NO .q, even though a QNS name is cached on the option', () => {
    renderDropdown(
      { [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } },
      [staleOption()],
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('alice.q')).not.toBeInTheDocument();
    expect(screen.queryByText(/alice\.q|Stale/)).not.toBeInTheDocument();
  });

  it('a member WITH a per-space nickname renders the nickname, no .q', () => {
    renderDropdown(
      { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } },
      [staleOption()],
    );

    expect(screen.getByText('Mod Alice')).toBeInTheDocument();
    expect(screen.queryByText(/\.q/)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Option Name')).not.toBeInTheDocument();
  });

  it("MentionDropdown's filter matches the resolved (displayed) name, not just the raw displayName field", async () => {
    // Follow-global state: no per-space override, name comes from
    // globalDisplayName. The OLD filter only checked `displayName` (empty)
    // + `primaryUsername` + `address`, so typing "ali" — a prefix of the
    // exact name shown in the dropdown — found nobody.
    const users = [
      {
        address: ADDR,
        displayName: undefined,
        globalDisplayName: 'Alice',
        primaryUsername: undefined,
      },
    ];

    const { result, rerender } = renderHook(
      (props: { textValue: string; cursorPosition: number }) =>
        useMentionInput({ ...props, users, onMentionSelect: () => {} }),
      { initialProps: { textValue: '@ali', cursorPosition: 4 } },
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
