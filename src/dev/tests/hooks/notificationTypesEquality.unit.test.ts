import { describe, it, expect } from 'vitest';

/**
 * Mirrors the `sameTypes` helper in
 * src/hooks/business/mentions/useMentionNotificationSettings.ts.
 *
 * That helper drives two behaviours the 2026-06-23 stale-read/clobber fix
 * depends on:
 *  1. The clobber guard on Save — a no-op Save (selection unchanged from the
 *     persisted value) must NOT POST, so it can't overwrite a value set on
 *     another device with a stale local default.
 *  2. The config re-sync effect — local selection is only re-seeded from a
 *     freshly-synced config when it actually differs from what's displayed.
 *
 * Inlined here (rather than imported) to match the repo's pure-logic unit-test
 * convention and avoid quorum-shared / React-context resolution in the runner.
 */
type SpaceNotificationTypeId =
  | 'mention-you'
  | 'mention-everyone'
  | 'mention-roles'
  | 'reply';

function sameTypes(
  a: SpaceNotificationTypeId[],
  b: SpaceNotificationTypeId[]
): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((type) => setB.has(type));
}

describe('sameTypes (notification-type selection equality)', () => {
  it('treats identical selections as equal regardless of order', () => {
    expect(
      sameTypes(['mention-you', 'reply'], ['reply', 'mention-you'])
    ).toBe(true);
    expect(
      sameTypes(
        ['mention-you', 'mention-everyone', 'mention-roles', 'reply'],
        ['reply', 'mention-roles', 'mention-everyone', 'mention-you']
      )
    ).toBe(true);
  });

  it('treats two empty selections as equal (all-disabled state)', () => {
    expect(sameTypes([], [])).toBe(true);
  });

  it('detects a different selection (drives the clobber guard to allow Save)', () => {
    // mobile set ['mention-roles']; desktop stale default is all-4 → must differ
    expect(
      sameTypes(
        ['mention-roles'],
        ['mention-you', 'mention-everyone', 'mention-roles', 'reply']
      )
    ).toBe(false);
  });

  it('detects same length but different members', () => {
    expect(sameTypes(['mention-you'], ['reply'])).toBe(false);
    expect(
      sameTypes(
        ['mention-you', 'reply'],
        ['mention-you', 'mention-everyone']
      )
    ).toBe(false);
  });

  it('detects a subset as not equal (length differs)', () => {
    expect(
      sameTypes(['mention-you'], ['mention-you', 'reply'])
    ).toBe(false);
  });
});
