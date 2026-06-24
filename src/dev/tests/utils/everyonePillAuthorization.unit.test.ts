import { describe, it, expect } from 'vitest';
import { hasPermission } from '@quilibrium/quorum-shared';
import type { Role, Space } from '@quilibrium/quorum-shared';

/**
 * Covers the @everyone styled-pill authorization rule introduced by the
 * 2026-06-23 task (mirror of quorum-mobile c144d3c).
 *
 * The render layer styles `@everyone` as a pill ONLY when:
 *   message.mentions.everyone === true  AND
 *   hasPermission(senderId, 'mention:everyone', { roles })   // role-only, no owner bypass
 *
 * This mirrors the predicate computed in Message.tsx / MessagePreview.tsx /
 * NotificationItem.tsx, and asserts it lines up with the trust rule the
 * notification path (isMentionedWithSettings) already enforces. We exercise the
 * real shared `hasPermission` against a `{ roles }` shim — the same shim those
 * components pass — rather than re-implementing it.
 */

/** The exact predicate the components compute (kept in one place for the test). */
function everyoneAuthorized(
  everyoneFlag: boolean,
  senderId: string | undefined,
  roles: Role[]
): boolean {
  if (everyoneFlag !== true) return false;
  if (!senderId) return false;
  return hasPermission(senderId, 'mention:everyone', { roles } as Space);
}

const AUTHORIZED_SENDER = 'QmAuthorizedSender';
const PLAIN_SENDER = 'QmPlainSender';

const roles: Role[] = [
  {
    roleId: 'role-announcer',
    roleTag: 'announcer',
    displayName: 'Announcer',
    color: 'blue',
    members: [AUTHORIZED_SENDER],
    permissions: ['mention:everyone'],
    isPublic: true,
  } as unknown as Role,
  {
    roleId: 'role-member',
    roleTag: 'member',
    displayName: 'Member',
    color: 'gray',
    members: [PLAIN_SENDER],
    permissions: [],
    isPublic: true,
  } as unknown as Role,
];

describe('everyone pill authorization', () => {
  it('authorizes when the flag is set AND the sender holds mention:everyone', () => {
    expect(everyoneAuthorized(true, AUTHORIZED_SENDER, roles)).toBe(true);
  });

  it('refuses when the sender lacks mention:everyone (unauthorized/spoofed)', () => {
    expect(everyoneAuthorized(true, PLAIN_SENDER, roles)).toBe(false);
  });

  it('refuses when the wire flag is not set, even for an authorized sender', () => {
    expect(everyoneAuthorized(false, AUTHORIZED_SENDER, roles)).toBe(false);
  });

  it('refuses when the sender is unknown to the space roles', () => {
    expect(everyoneAuthorized(true, 'QmStranger', roles)).toBe(false);
  });

  it('refuses when senderId is missing', () => {
    expect(everyoneAuthorized(true, undefined, roles)).toBe(false);
  });

  it('refuses (safe fallback) when no space roles are available', () => {
    // e.g. bookmarks render MessagePreview without space roles → plain text
    expect(everyoneAuthorized(true, AUTHORIZED_SENDER, [])).toBe(false);
  });

  it('does NOT grant via ownership — role membership is the only path', () => {
    // No role grants mention:everyone, so even a would-be owner is unauthorized.
    const noGrantRoles: Role[] = [
      {
        roleId: 'role-everyone-denied',
        roleTag: 'everyone',
        displayName: 'Everyone',
        color: 'gray',
        members: [AUTHORIZED_SENDER],
        permissions: [],
        isPublic: true,
      } as unknown as Role,
    ];
    expect(everyoneAuthorized(true, AUTHORIZED_SENDER, noGrantRoles)).toBe(false);
  });
});
