/**
 * Ordering stored DM sessions so the SEND path picks the right one.
 *
 * Several stored rows legitimately share one device tag: a session we created by
 * sending first can coexist with one created by RECEIVING the peer's init
 * envelope. The send path selects with `sets.find((s) => s.tag === inbox)`,
 * which takes whatever comes first — so the ORDER of this array decides which
 * session every outgoing message uses.
 *
 * The rule is: send-ready rows first, and among those the NEWEST.
 *
 * Recency is the part that was missing, and it breaks resets. When the peer
 * resets they mint a new receiving inbox and announce it in a fresh init
 * envelope — but they cannot delete our old row, so we hold BOTH a stale
 * confirmed row (pointing at an inbox they have abandoned) and the new one.
 * Both look send-ready, and the stale one comes first in insertion order, so it
 * won every time: every message we sent went to a dead inbox and was silently
 * discarded by the peer as having no session for it, while their messages kept
 * arriving normally.
 *
 * A reset is meant to be ONE-SIDED — one user resets, their next message carries
 * the new session, and both sides converge. That only works if the peer's send
 * path adopts the newest session. Observed live 2026-07-25: after a reset on one
 * device, that device's direction worked and the other direction was completely
 * dead, and the failure flipped sides depending on who reset. Mobile has the
 * same rule in `selectSendState`.
 */

type Ordered = { ts: number; set: Record<string, unknown> };

function isSendReady(set: Record<string, unknown> | undefined): boolean {
  const sending = set?.sending_inbox as
    | { inbox_public_key?: string }
    | undefined;
  return Boolean(sending?.inbox_public_key);
}

/**
 * Parse stored encryption-state rows into session objects, ordered so that the
 * first match for a given tag is the one to send with.
 *
 * ## `sent_accept` must be restored here, not just in the stored row
 *
 * The SDK chooses the shape of every outgoing frame on `state.sent_accept`
 * (`DoubleRatchetInboxEncrypt`): truthy sends the Double Ratchet envelope alone,
 * falsy sends an `InitializationEnvelope` carrying the session setup material
 * (return inbox keys, identity public key, display name, icon) with the ratchet
 * envelope nested inside.
 *
 * That flag is persisted in the `sentAccept` COLUMN, while the session itself is
 * persisted as JSON in `state`. This function used to return only
 * `JSON.parse(r.state)` — so `sent_accept` was `undefined` on every send, and
 * this client re-sent setup material on every DM frame instead of only until the
 * session was established. Confirmed 2026-07-27 against captured data: 12 of 12
 * stored state blobs contain exactly
 * `ratchet_state / receiving_inbox / sending_inbox / tag`, and offline replay
 * showed 24 of 24 sampled frames carrying it.
 *
 * NOT a disclosure issue: both branches seal their payload with
 * `js_encrypt_inbox_message` to the recipient's inbox encryption key, so the
 * setup material is encrypted in transit exactly like message content. The cost
 * of the bug was payload size, not exposure.
 *
 * The column is the authority (`??`, so a legitimate stored `false` is kept);
 * anything already inside the JSON is only a fallback for rows written by a
 * future save that inlines it.
 */
// Returns `any[]` deliberately: this replaces `response.map((e) => JSON.parse(e.state))`,
// whose element type was `any`. Narrowing it here would ripple type errors through
// every call site for no safety gain — the ordering is the change, not the typing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function orderSessionsForSend<
  T extends { timestamp?: number; state: string; sentAccept?: boolean },
>(rows: T[]): any[] {
  return rows
    .map((r): Ordered | null => {
      try {
        const set = JSON.parse(r.state) as Record<string, unknown>;
        // Restore the flag the SDK reads. Without this line the SDK sees
        // `undefined` and init-wraps every frame — see the note above.
        set.sent_accept = r.sentAccept ?? set.sent_accept;
        return { ts: r.timestamp ?? 0, set };
      } catch {
        return null; // unparseable row — skip rather than break the send
      }
    })
    .filter((x): x is Ordered => x !== null)
    .sort((a, b) => {
      const ar = isSendReady(a.set) ? 1 : 0;
      const br = isSendReady(b.set) ? 1 : 0;
      if (ar !== br) return br - ar; // send-ready first (skips init wrapping)
      return b.ts - a.ts; // then newest, so a peer's reset is adopted
    })
    .map((x) => x.set);
}
