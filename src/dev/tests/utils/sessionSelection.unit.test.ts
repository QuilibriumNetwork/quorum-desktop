import { describe, expect, it } from 'vitest';
import { orderSessionsForSend } from '../../../utils/sessionSelection';

const TAG = 'QmPeerDevice';
const row = (timestamp: number, inbox: string, sendReady = true) => ({
  timestamp,
  state: JSON.stringify({
    ratchet_state: `rs-${inbox}`,
    receiving_inbox: { inbox_address: `recv-${inbox}` },
    sending_inbox: {
      inbox_address: inbox,
      inbox_public_key: sendReady ? `pub-${inbox}` : '',
    },
    tag: TAG,
  }),
});

/** How the send path actually consumes this: first match for the tag wins. */
const pick = (rows: Parameters<typeof orderSessionsForSend>[0]) =>
  orderSessionsForSend(rows).find((s) => s.tag === TAG);

describe('orderSessionsForSend', () => {
  it('picks the NEWEST send-ready session after the peer resets', () => {
    // The stale row is first in insertion order; the old code took it and kept
    // sending to an inbox the peer had abandoned.
    const stale = row(1_000, 'abandoned-inbox');
    const fresh = row(2_000, 'peer-new-inbox');
    expect(pick([stale, fresh])?.sending_inbox.inbox_address).toBe(
      'peer-new-inbox'
    );
  });

  it('is independent of insertion order', () => {
    const stale = row(1_000, 'abandoned-inbox');
    const fresh = row(2_000, 'peer-new-inbox');
    expect(pick([fresh, stale])?.sending_inbox.inbox_address).toBe(
      'peer-new-inbox'
    );
  });

  it('prefers a send-ready session over a newer unconfirmed one', () => {
    // Send-ready skips init-envelope wrapping, so it wins even if older.
    const ready = row(1_000, 'ready-inbox', true);
    const unconfirmed = row(9_000, 'unconfirmed-inbox', false);
    expect(pick([unconfirmed, ready])?.sending_inbox.inbox_address).toBe(
      'ready-inbox'
    );
  });

  it('falls back to the newest unconfirmed session when none are send-ready', () => {
    const older = row(1_000, 'a', false);
    const newer = row(3_000, 'b', false);
    expect(pick([older, newer])?.sending_inbox.inbox_address).toBe('b');
  });

  it('skips unparseable rows instead of breaking the send', () => {
    const broken = { timestamp: 9_999, state: 'not json' };
    const good = row(1_000, 'good-inbox');
    expect(pick([broken, good])?.sending_inbox.inbox_address).toBe(
      'good-inbox'
    );
  });

  it('does not mutate the caller array', () => {
    const rows = [row(1_000, 'a'), row(2_000, 'b')];
    const before = rows.map((r) => r.timestamp);
    orderSessionsForSend(rows);
    expect(rows.map((r) => r.timestamp)).toEqual(before);
  });

  it('returns an empty array for no rows', () => {
    expect(orderSessionsForSend([])).toEqual([]);
  });

  // The SDK picks the shape of every outgoing frame from `state.sent_accept`
  // (DoubleRatchetInboxEncrypt): falsy wraps the frame in an
  // InitializationEnvelope carrying return_inbox_private_key and identity
  // fields. The flag is stored in the `sentAccept` COLUMN, not inside the
  // `state` JSON, so parsing `state` alone dropped it and every frame this
  // client sent was init-wrapped. These lock the plumbing.
  describe('sent_accept (decides init-wrapping in the SDK)', () => {
    const rowWith = (sentAccept?: boolean) => ({
      ...row(1_000, 'inbox'),
      sentAccept,
    });

    it('restores sent_accept from the row column', () => {
      expect(pick([rowWith(true)])?.sent_accept).toBe(true);
    });

    it('keeps a stored false rather than treating it as absent', () => {
      // `??` not `||`: a session genuinely not yet accepted must stay false, so
      // the peer keeps receiving our return-inbox details.
      expect(pick([rowWith(false)])?.sent_accept).toBe(false);
    });

    it('leaves sent_accept undefined when the column is absent', () => {
      // Undefined is falsy, so such a row still init-wraps — the safe default.
      expect(pick([rowWith(undefined)])?.sent_accept).toBeUndefined();
    });

    it('falls back to a value inlined in state when the column is absent', () => {
      const inlined = {
        timestamp: 1_000,
        state: JSON.stringify({
          ratchet_state: 'rs',
          receiving_inbox: { inbox_address: 'recv' },
          sending_inbox: { inbox_address: 'inbox', inbox_public_key: 'pub' },
          tag: TAG,
          sent_accept: true,
        }),
      };
      expect(pick([inlined])?.sent_accept).toBe(true);
    });

    it('lets the column win over a stale value inlined in state', () => {
      const conflicting = {
        timestamp: 1_000,
        sentAccept: false,
        state: JSON.stringify({
          ratchet_state: 'rs',
          receiving_inbox: { inbox_address: 'recv' },
          sending_inbox: { inbox_address: 'inbox', inbox_public_key: 'pub' },
          tag: TAG,
          sent_accept: true,
        }),
      };
      expect(pick([conflicting])?.sent_accept).toBe(false);
    });
  });
});
