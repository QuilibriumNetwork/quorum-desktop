/**
 * ReactionsModal — the reaction list must show a member's REAL name.
 *
 * Regression cover for the "fallback fed INTO the resolver" defect: the modal
 * used to compute `member?.displayName || memberId.slice(0, 8) + '...'` and pass
 * the RESULT to `resolveSpaceMemberName`. For a follow-global member — the
 * DEFAULT state since the follow-global work, where the per-space override slot
 * is deliberately left empty — that handed the resolver an address in the
 * `displayName` slot. The resolver reads a present `displayName` as a deliberate
 * per-space name, and a per-space name outranks the QNS `.q` name, so the pill
 * showed `QmV5xWMo...` while the member's `.q` name sat unused in the very same
 * object.
 *
 * The load-bearing case is `follow-global member with a .q name`. Delete the
 * `displayName` line from ReactionsModal's memo and that test must go red.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { messages } from '@/i18n/en/messages';
import { ReactionsModal } from '@/components/modals/ReactionsModal';
import type { MemberInfo } from '@/components/modals/ReactionsModal';

beforeAll(() => {
  i18n.load('en', messages);
  i18n.activate('en');
});

// Render the modal body inline — we're asserting on names, not on portals.
vi.mock('@/components/primitives/Modal/ModalContainer', () => ({
  ModalContainer: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <div data-testid="modal-container">{children}</div> : null),
}));

vi.mock('@/components/primitives/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const ADDR = 'QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2nX';

const reactions = [{ emojiId: 'e1', emojiName: '👍', count: 1, memberIds: [ADDR] }];

function renderWith(member: Partial<MemberInfo>) {
  return render(
    <ReactionsModal
      visible
      onClose={() => {}}
      reactions={reactions as never}
      customEmojis={[]}
      members={{ [ADDR]: { address: ADDR, ...member } as MemberInfo }}
    />,
  );
}

describe('ReactionsModal — name resolution', () => {
  it('shows the .q name for a follow-global member (empty per-space override)', () => {
    // The default state: no per-space override, a global name, and a QNS name.
    renderWith({
      displayName: undefined,
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });

    // `.q` is rendered as a sibling text node, so match the whole label.
    expect(screen.getByText('alice.q')).toBeInTheDocument();
    // The exact defect: an address stood in for the name.
    expect(screen.queryByText(/^QmV5xWMo/)).not.toBeInTheDocument();
  });

  it('shows the .q name when the roster echoes the global name at join', () => {
    // roster === global means "not deliberately set for this space", so the
    // QNS name still wins. Same outcome, different storage shape.
    renderWith({
      displayName: 'Alice',
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });

    expect(screen.getByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('still lets a DELIBERATE per-space name outrank the .q name', () => {
    // The tier that must NOT regress: a real override differs from the global
    // name and is the whole point of the two-slot model.
    renderWith({
      displayName: 'Alice (mod)',
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });

    expect(screen.getByText('Alice (mod)')).toBeInTheDocument();
    expect(screen.queryByText('alice.q')).not.toBeInTheDocument();
  });

  it('renders globalDisplayName as a real resolver TIER', () => {
    // CHANGED DELIBERATELY 2026-08-05. This test previously pinned the opposite:
    // that `globalDisplayName` was only a comparator and this shape rendered a
    // truncated address. It said "if a future caller supplies the two slots
    // separately, this test is the one that will change — deliberately". This is
    // that change, and it was not hypothetical.
    //
    // The old behaviour was latent only while every roster row carried a stamped
    // override, so callers passing the RAW roster field (the member sidebar,
    // Channel.tsx) still got a name. Once the override is correctly empty — its
    // normal state under the two-slot model — those callers rendered the address
    // for everyone, including the user themself. Measured on a real account.
    renderWith({ displayName: undefined, globalDisplayName: 'Alice' });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('still prefers the QNS name over the global slot', () => {
    // Ladder order: deliberate override → QNS → global → address. Adding the
    // global tier must not let it jump the QNS name.
    renderWith({
      displayName: undefined,
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });
    expect(screen.getByText('alice.q')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('demotes an override that merely ECHOES the global name', () => {
    // roster === global means a legacy stamp, not a choice. It must not outrank
    // the QNS name.
    renderWith({
      displayName: 'Alice',
      globalDisplayName: 'Alice',
      primaryUsername: 'alice',
    });
    expect(screen.getByText('alice.q')).toBeInTheDocument();
  });

  it('renders the merged global name when the enricher has filled displayName', () => {
    // How the global name ACTUALLY reaches this surface in production.
    renderWith({ displayName: 'Alice', globalDisplayName: 'Alice' });
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('falls back to a truncated address when the member has no name at all', () => {
    // The fallback is legitimate HERE — produced by the resolver, as output.
    renderWith({});
    expect(screen.getByText(/QmV5xW/)).toBeInTheDocument();
  });

  it('does not render a member entirely absent from the members map as blank', () => {
    render(
      <ReactionsModal
        visible
        onClose={() => {}}
        reactions={reactions as never}
        customEmojis={[]}
        members={{}}
      />,
    );
    expect(screen.getByText(/QmV5xW/)).toBeInTheDocument();
  });
});
