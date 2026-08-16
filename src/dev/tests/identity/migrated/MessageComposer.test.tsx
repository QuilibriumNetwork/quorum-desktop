/**
 * MessageComposer — a mention pill inserted from the autocomplete dropdown
 * must resolve its label through the identity module, not
 * `resolveMentionPillName`/`extractPillDataFromOption`.
 *
 * THE TRAP THIS FILE CLOSES (flagged in the phase-D recipe and carried
 * forward from rows 4-6's report): `mentionPillDom.ts`'s
 * `extractPillDataFromOption` internally calls the restricted
 * `resolveMentionPillName` — but the eslint ratchet only restricts
 * `resolveMentionPillName` BY NAME, so a file that imports
 * `extractPillDataFromOption` (not `resolveMentionPillName` directly) is
 * invisible to the rule. `MessageComposer.tsx`'s live pill-insertion path
 * goes through `useMentionPillEditor.insertPill`, which called exactly that
 * function — so taking `MessageComposer.tsx` off the ratchet alone would
 * have left this path silently unmigrated with lint staying green.
 *
 * Fixed by giving `useMentionPillEditor` an injected `resolveName` function
 * (the same shape `useNameResolver().resolve` produces) and having
 * `insertPill` build its `PillData` from that instead of
 * `extractPillDataFromOption`.
 *
 * WHY THIS TEST DRIVES `insertPill` DIRECTLY, NOT A CLICKED DROPDOWN ROW:
 * `MessageComposer` always renders `<MentionDropdown usePortal>`, which
 * anchors through `FloatingPopover` — real floating-ui positioning jsdom
 * cannot usefully simulate, and it is UI chrome unrelated to name
 * resolution. Row 5's `MessageEditTextarea.test.tsx` set the same
 * precedent: it mocks `MentionDropdown` away entirely. This file follows
 * suit, but captures the REAL props `MessageComposer` passes to
 * `MentionDropdown` (including `onSelectOption`, the exact callback a real
 * click would invoke) and calls that captured callback directly — so the
 * assertion still exercises `MessageComposer`'s own
 * `handleMentionSelect` -> `insertPill` wiring, not a hand-rolled substitute.
 *
 * `mapSenderToUser`/the option's own `displayName` below is deliberately
 * WRONG — proof the pill renders through the identity module and not local
 * option data.
 *
 * WHY THE LOAD-BEARING CASE WARMS THE PROFILE CACHE BEFORE TYPING: a
 * composer pill is written to the DOM once, at insertion time — unlike
 * `MessageEditTextarea`'s rebuild-on-mount, the compose box never re-renders
 * an already-inserted pill when its profile lands later. So the ".q" case
 * can only be demonstrated for an address that is ALREADY resolved when the
 * user clicks the option, exactly the realistic flow where some other
 * enriched surface (a message header, this composer's own reply-to preview)
 * resolved it first. `MessageComposer.tsx`'s `mentionedAddresses` effect
 * still requests enrichment for every address already piled into the current
 * draft — it just cannot help the FIRST pill for a brand-new address.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import type { MentionOption } from '@/hooks/business/mentions';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');

  // jsdom's Range does not implement getBoundingClientRect/getClientRects —
  // MessageComposer's caret-coordinate measurement (for dropdown
  // positioning) calls these on every editor input and throws without this,
  // aborting the whole event dispatch before React commits the state update
  // this test depends on. Unrelated to name resolution; stubbed so the input
  // event completes.
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function (this: Range) {
      return {
        top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
        toJSON() { return this; },
      } as DOMRect;
    };
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function (this: Range) {
      return [] as unknown as DOMRectList;
    };
  }
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

vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  usePasskeysContext: () => ({
    currentPasskeyInfo: { address: 'QmSelf00000000000000000000000000000000' },
  }),
}));

// Chrome unrelated to name resolution.
vi.mock('@/components/message/MarkdownToolbar', () => ({ MarkdownToolbar: () => null }));

// See file header: capture the real props (including onSelectOption) instead
// of rendering the portal-anchored dropdown.
let capturedDropdownProps: {
  filteredOptions: MentionOption[];
  onSelectOption: (option: MentionOption) => void;
} | null = null;
vi.mock('@/components/message/MentionDropdown', () => ({
  MentionDropdown: (props: {
    filteredOptions: MentionOption[];
    onSelectOption: (option: MentionOption) => void;
  }) => {
    capturedDropdownProps = props;
    return null;
  },
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

import { MessageComposer } from '@/components/message/MessageComposer';
import { IdentityScopeProvider, useIdentityContext } from '@/identity/identityProvider';
import { publicProfileQueryKey } from '@/hooks/business/user/useUserPublicProfile';

const ADDR = 'QmPeerCEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imzzzz';
const SPACE_ID = 'space-1';

/** Set the caret at the end of `editor`'s content — `insertPill` and the
 *  cursor-tracking effects require an active Selection inside the editor. */
function putCaretAtEnd(editor: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Fires `request(address)` on mount, to warm the provider's cache BEFORE a
 *  pill is inserted. A composer pill is a raw DOM write, not a React render
 *  — inserting it after enrichment lands does not update it retroactively
 *  (see MessageComposer.tsx's `mentionedAddresses` comment), so the ".q"
 *  case can only be demonstrated for an address that was ALREADY warm —
 *  exactly the realistic flow where some other already-enriched surface (a
 *  message header, this same composer's reply-to preview) resolved the
 *  address first. Mirrors MessageEditTextarea.test.tsx's WarmUp. */
function WarmUp({ addresses }: { addresses: string[] }) {
  const { request } = useIdentityContext();
  React.useEffect(() => {
    addresses.forEach(request);
  }, [addresses, request]);
  return null;
}

function ComposerHarness({ users }: { users: Array<{ address: string; displayName?: string; primaryUsername?: string; globalDisplayName?: string }> }) {
  const [value, setValue] = React.useState('');
  return (
    <MessageComposer
      value={value}
      onChange={setValue}
      onKeyDown={() => {}}
      placeholder="Message"
      calculateRows={() => 1}
      getRootProps={() => ({})}
      getInputProps={() => ({})}
      clearFile={() => {}}
      onSubmitMessage={() => {}}
      onShowStickers={() => {}}
      users={users as never}
    />
  );
}

function renderComposer(
  rosters: Record<string, Record<string, unknown>>,
  users: Array<{ address: string; displayName?: string; primaryUsername?: string; globalDisplayName?: string }>,
  warmAddresses: string[] = [],
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <IdentityScopeProvider spaceId={SPACE_ID} rostersBySpace={rosters} selfAddress={null}>
        <WarmUp addresses={warmAddresses} />
        <ComposerHarness users={users} />
      </IdentityScopeProvider>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

/** Type a bare "@" into the composer's contentEditable and wait for the
 *  dropdown's (unfiltered, Tier 1 "empty query") options to appear. An empty
 *  query lists every candidate alphabetically with no name-matching involved
 *  — deliberately, so this file's assertions are about the SELECTED pill's
 *  resolved label, not about `useMentionInput`'s filter logic (a separate
 *  concern, covered by MentionDropdown.test.tsx). */
async function typeMentionQuery(container: HTMLElement) {
  const editor = container.querySelector('.message-composer-contenteditable') as HTMLElement;
  editor.textContent = '@';
  putCaretAtEnd(editor);
  act(() => {
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await waitFor(() => {
    expect(capturedDropdownProps?.filteredOptions.length).toBeGreaterThan(0);
  });

  return editor;
}

describe('MessageComposer — inserted mention pills resolve via the identity module', () => {
  beforeEach(() => {
    capturedDropdownProps = null;
    getPublicProfile.mockReset();
  });

  it('the load-bearing case: no per-space nickname, a global name, and a QNS name renders <qns>.q on the inserted pill', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container, client } = renderComposer(
      { [SPACE_ID]: { [ADDR]: { display_name: '', global_display_name: 'Alice' } } },
      [{ address: ADDR, displayName: 'Stale Option Name', primaryUsername: undefined, globalDisplayName: 'Stale Global' }],
      [ADDR],
    );

    // Wait for the warm-up fetch to land before typing — a composer pill is
    // a raw DOM write at insertion time, so the profile must already be
    // resolved when the user clicks the option.
    await waitFor(() => {
      expect(client.getQueryData(publicProfileQueryKey(ADDR))).toBeTruthy();
    });

    const editor = await typeMentionQuery(container);

    putCaretAtEnd(editor);
    act(() => {
      capturedDropdownProps!.onSelectOption(capturedDropdownProps!.filteredOptions[0]);
    });

    await waitFor(() => {
      const pill = editor.querySelector('[data-mention-type="user"]');
      expect(pill?.textContent).toBe('@alice.q');
    });
    expect(editor.querySelector('[data-mention-type="user"]')?.textContent).not.toContain('Stale');
  });

  it('a member WITH a per-space nickname inserts the pill with the nickname and no .q', async () => {
    getPublicProfile.mockResolvedValue({ data: { primary_username: 'alice', display_name: 'Alice' } });

    const { container } = renderComposer(
      { [SPACE_ID]: { [ADDR]: { display_name: 'Mod Alice', global_display_name: 'Alice' } } },
      [{ address: ADDR, displayName: 'Stale Option Name', primaryUsername: undefined, globalDisplayName: 'Stale Global' }],
    );

    const editor = await typeMentionQuery(container);

    putCaretAtEnd(editor);
    act(() => {
      capturedDropdownProps!.onSelectOption(capturedDropdownProps!.filteredOptions[0]);
    });

    await waitFor(() => {
      const pill = editor.querySelector('[data-mention-type="user"]');
      expect(pill?.textContent).toBe('@Mod Alice');
    });
    expect(editor.querySelector('[data-mention-type="user"]')?.textContent).not.toContain('.q');
    expect(editor.querySelector('[data-mention-type="user"]')?.textContent).not.toContain('Stale');
  });
});
