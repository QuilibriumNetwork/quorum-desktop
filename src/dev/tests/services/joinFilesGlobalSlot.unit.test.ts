import { describe, it, expect, vi } from 'vitest';
import { buildJoinedMemberRow } from '@/services/MessageService';

// MessageService.ts imports the native SDK at module load; stub it so this
// pure-logic helper can be imported without the real WASM channel module.
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

const P = {
  address: 'QmJoiner0000000000000000000000000000000',
  inboxAddress: 'inbox-1',
  userIcon: 'data:image/png;base64,AAA',
  displayName: 'Ada',
  joinedAt: 1700000000000,
};

describe('buildJoinedMemberRow', () => {
  it('files the joiner identity in the GLOBAL slot, never the override slot', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.global_display_name).toBe('Ada');
    expect(row.global_user_icon).toBe(P.userIcon);
    // A value in the override slot outranks every later global update, and the
    // on-connect announce reads it back and re-stamps it forever. That is the
    // whole defect, so this assertion is the point of the task.
    expect(row.display_name).toBeUndefined();
    expect(row.user_icon).toBeUndefined();
  });

  it('stamps globalProfileTimestamp so a later rename can win', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.globalProfileTimestamp).toBe(P.joinedAt);
  });

  it('preserves the authoritative inbox_address from the verified join', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.inbox_address).toBe('inbox-1');
  });

  it('carries joinedAt and an explicit not-kicked state', () => {
    const row = buildJoinedMemberRow(P) as Record<string, unknown>;
    expect(row.joinedAt).toBe(P.joinedAt);
    expect(row.isKicked).toBe(false);
  });
});
