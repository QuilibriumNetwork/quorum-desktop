import { describe, it, expect, vi } from 'vitest';
import { applyProfileUpdate } from '@/services/MessageService';
import type { SpaceMemberRow } from '@/db/messages';
import type { UpdateProfileMessage } from '@quilibrium/quorum-shared';

// MessageService.ts imports the native SDK at module load; stub it so this
// pure-logic helper can be imported without the real WASM channel module.
vi.mock('@quilibrium/quilibrium-js-sdk-channels', () => ({
  channel: {},
  channel_raw: {},
}));

const SENDER = 'QmSender000000000000000000000000000000000';

function row(overrides: Partial<SpaceMemberRow> = {}): SpaceMemberRow {
  return { user_address: SENDER, inbox_address: 'inbox', ...overrides };
}

// UpdateProfileMessage.userIcon is required on the wire type, but the real
// senders OMIT it entirely on a global-only / no-icon-override broadcast (they
// cast the object). We model that faithfully: userIcon is only present when a
// test passes it, so a "no override" message genuinely has no override fields.
// The cast mirrors the send-path cast that papers over the required field.
function msg(content: Partial<UpdateProfileMessage>): UpdateProfileMessage {
  return { senderId: SENDER, type: 'update-profile', ...content } as UpdateProfileMessage;
}

describe('applyProfileUpdate — two-slot per-slot LWW guard', () => {
  it('applies both slots and stamps timestamps when the row has none (legacy row = always apply)', () => {
    const p = row();
    applyProfileUpdate(
      p,
      msg({ displayName: 'Ada', globalDisplayName: 'Ada Global' } as Partial<UpdateProfileMessage>),
      1000
    );
    expect(p.display_name).toBe('Ada');
    expect(p.global_display_name).toBe('Ada Global');
    expect(p.profileTimestamp).toBe(1000);
    expect(p.globalProfileTimestamp).toBe(1000);
  });

  it('does NOT clobber a newer stored value with an older message (override slot)', () => {
    const p = row({ display_name: 'New', profileTimestamp: 2000 });
    applyProfileUpdate(p, msg({ displayName: 'Old' } as Partial<UpdateProfileMessage>), 1000);
    expect(p.display_name).toBe('New'); // older message rejected
    expect(p.profileTimestamp).toBe(2000); // timestamp unchanged
  });

  it('applies a strictly-newer message (override slot)', () => {
    const p = row({ display_name: 'Old', profileTimestamp: 1000 });
    applyProfileUpdate(p, msg({ displayName: 'New' } as Partial<UpdateProfileMessage>), 2000);
    expect(p.display_name).toBe('New');
    expect(p.profileTimestamp).toBe(2000);
  });

  it('treats an equal timestamp as a no-op (self-echo case)', () => {
    const p = row({ display_name: 'Mine', profileTimestamp: 1500 });
    applyProfileUpdate(p, msg({ displayName: 'Echo' } as Partial<UpdateProfileMessage>), 1500);
    expect(p.display_name).toBe('Mine'); // >= guard rejects the equal-ts echo
    expect(p.profileTimestamp).toBe(1500);
  });

  it('applies slots independently: a stale global-only message cannot block a fresh override', () => {
    // Global slot is fresh (ts 3000); an OLDER override message (ts 1000) arrives.
    const p = row({ global_display_name: 'G', globalProfileTimestamp: 3000 });
    applyProfileUpdate(p, msg({ displayName: 'Override' } as Partial<UpdateProfileMessage>), 1000);
    // Override applied on its own (undefined override ts = always apply)...
    expect(p.display_name).toBe('Override');
    expect(p.profileTimestamp).toBe(1000);
    // ...and the fresh global slot is untouched.
    expect(p.global_display_name).toBe('G');
    expect(p.globalProfileTimestamp).toBe(3000);
  });

  it('applies slots independently: a stale override-only message cannot block a fresh global', () => {
    const p = row({ display_name: 'O', profileTimestamp: 3000 });
    applyProfileUpdate(
      p,
      msg({ globalDisplayName: 'Global New' } as Partial<UpdateProfileMessage>),
      1000
    );
    expect(p.global_display_name).toBe('Global New');
    expect(p.globalProfileTimestamp).toBe(1000);
    expect(p.display_name).toBe('O'); // fresh override untouched
    expect(p.profileTimestamp).toBe(3000);
  });

  it("honors '' as a deliberate clear (presence check, not truthy)", () => {
    const p = row({ display_name: 'Ada', bio: 'hi', profileTimestamp: 1000 });
    applyProfileUpdate(p, msg({ displayName: '', bio: '' } as Partial<UpdateProfileMessage>), 2000);
    expect(p.display_name).toBe(''); // cleared, not left as 'Ada'
    expect(p.bio).toBe('');
  });

  it('leaves an untouched slot alone when only the other slot is present', () => {
    const p = row({ display_name: 'Keep', profileTimestamp: 1000 });
    applyProfileUpdate(
      p,
      msg({ globalDisplayName: 'GN' } as Partial<UpdateProfileMessage>),
      2000
    );
    // No override fields on the message → override slot (and its ts) untouched.
    expect(p.display_name).toBe('Keep');
    expect(p.profileTimestamp).toBe(1000);
    expect(p.global_display_name).toBe('GN');
  });

  it('falls back to Date.now() when createdDate is 0/falsy', () => {
    const before = Date.now();
    const p = row();
    applyProfileUpdate(p, msg({ displayName: 'Ada' } as Partial<UpdateProfileMessage>), 0);
    expect(p.profileTimestamp).toBeGreaterThanOrEqual(before);
  });
});
