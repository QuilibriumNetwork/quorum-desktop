/**
 * The DM reveal ledger.
 *
 * The property under test is not "does it store a boolean" — it is "which way
 * does it fail". Every uncertain path must answer NOT REVEALED, because the
 * opposite answer is a privacy leak that nobody can observe from the UI.
 *
 * ⚠️ The fail-closed tests here make `localStorage` GENUINELY THROW, via a spy
 * on `Storage.prototype`. Mobile's first attempt at the same proof used a mock
 * store that could not throw, so the safety branch was unreachable from any
 * test while appearing covered. If you replace these spies with a fake store,
 * check that the fake can still throw — or you have deleted the test without
 * deleting the file.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hasRevealedTo,
  recordReveal,
  clearReveal,
  messagesContainSelfAuthored,
  ensureRevealBootstrap,
  __resetRevealMemoForTests,
} from '@/utils/dmRevealLedger';

const SELF = 'QmMeMeMeVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imBBBB';
const PARTNER = 'QmPeerAEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imAAAA';
const OTHER = 'QmThemThemKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imCCCC';

beforeEach(() => {
  localStorage.clear();
  __resetRevealMemoForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  __resetRevealMemoForTests();
});

/**
 * A stored message row, as `saveMessage` writes it.
 *
 * The two fields are deliberately independent, because that split IS the bug
 * this module was hardened against:
 *
 *   `content.senderId`        — plaintext THE SENDER WROTE. Attacker-controlled.
 *   `authenticatedSenderId`   — stamped at persist time from what the crypto
 *                               layer authenticated. Not forgeable.
 *
 * So `post(PARTNER, SELF)` models the exploit: a message the partner sent, whose
 * payload claims we wrote it. Passing no `authenticatedSenderId` models a row
 * written before the marker existed — unknown provenance, which must fail closed.
 */
const post = (claimedSenderId: string, authenticatedSenderId?: string) => ({
  content: { type: 'post', senderId: claimedSenderId },
  ...(authenticatedSenderId === undefined ? {} : { authenticatedSenderId }),
});

/** A row we genuinely authored: both fields agree, and the marker is ours. */
const ours = () => post(SELF, SELF);
/** An ordinary inbound row from the partner. */
const theirs = () => post(PARTNER, PARTNER);

describe('the basic contract', () => {
  it('is unset by default and set after recordReveal', () => {
    expect(hasRevealedTo(SELF, PARTNER)).toBe(false);
    recordReveal(SELF, PARTNER, 1_000);
    expect(hasRevealedTo(SELF, PARTNER)).toBe(true);
  });

  it('is directional and pair-scoped — one reveal never implies another', () => {
    recordReveal(SELF, PARTNER, 1_000);
    expect(hasRevealedTo(SELF, OTHER)).toBe(false);
    expect(hasRevealedTo(OTHER, PARTNER)).toBe(false);
    // The reverse direction is a different relationship entirely.
    expect(hasRevealedTo(PARTNER, SELF)).toBe(false);
  });

  it('clearReveal(self, partner) unsets one; clearReveal(self) unsets all of self', () => {
    recordReveal(SELF, PARTNER, 1_000);
    recordReveal(SELF, OTHER, 1_000);
    recordReveal(OTHER, PARTNER, 1_000);

    clearReveal(SELF, PARTNER);
    expect(hasRevealedTo(SELF, PARTNER)).toBe(false);
    expect(hasRevealedTo(SELF, OTHER)).toBe(true);

    clearReveal(SELF);
    expect(hasRevealedTo(SELF, OTHER)).toBe(false);
    // Another self's records are untouched by a scoped sweep.
    expect(hasRevealedTo(OTHER, PARTNER)).toBe(true);
  });

  it('clearReveal(self) removes EVERY record for that self, not just the first', () => {
    // Regression shape: removing entries while iterating localStorage by index
    // reindexes it and silently skips half the matches.
    const partners = Array.from({ length: 6 }, (_, i) => `${PARTNER}${i}`);
    for (const p of partners) recordReveal(SELF, p, 1_000);
    clearReveal(SELF);
    __resetRevealMemoForTests();
    for (const p of partners) expect(hasRevealedTo(SELF, p)).toBe(false);
  });
});

describe('the key encoding is injective (Global Constraint 3)', () => {
  it('cannot be confused by a separator inside an address', () => {
    // `${self}:${partner}` would make these two pairs collide on "A:B:C".
    // Real addresses exclude ':' today, but nothing ENFORCES that, and the
    // failure mode of a collision is fail-OPEN — the one direction this
    // feature must never fail.
    recordReveal('A', 'B:C', 1_000);
    expect(hasRevealedTo('A:B', 'C')).toBe(false);
    expect(hasRevealedTo('A', 'B:C')).toBe(true);
  });

  it('cannot be confused by a quote or a comma inside an address', () => {
    recordReveal('A"', ',B', 1_000);
    expect(hasRevealedTo('A', '",,B')).toBe(false);
    expect(hasRevealedTo('A"', ',B')).toBe(true);
  });

  it('scopes a self-wide clear to exactly that self, even on a prefix-shaped neighbour', () => {
    recordReveal('QmAbc', PARTNER, 1_000);
    recordReveal('QmAbcdef', PARTNER, 1_000); // starts with the other self's text
    clearReveal('QmAbc');
    __resetRevealMemoForTests();
    expect(hasRevealedTo('QmAbc', PARTNER)).toBe(false);
    expect(hasRevealedTo('QmAbcdef', PARTNER)).toBe(true);
  });
});

describe('malformed identifiers fail CLOSED and are never written', () => {
  it('refuses to read for an empty self or partner', () => {
    expect(hasRevealedTo('', PARTNER)).toBe(false);
    expect(hasRevealedTo(SELF, '')).toBe(false);
    expect(hasRevealedTo(undefined as unknown as string, PARTNER)).toBe(false);
  });

  it('refuses to WRITE under a degenerate key', () => {
    recordReveal('', '', 1_000);
    recordReveal('', PARTNER, 1_000);
    recordReveal(SELF, '', 1_000);
    // Nothing was persisted at all — not merely unreadable.
    expect(localStorage.length).toBe(0);
  });

  it('refuses a self-wide clear from a degenerate self rather than sweeping', () => {
    recordReveal(SELF, PARTNER, 1_000);
    clearReveal('');
    expect(hasRevealedTo(SELF, PARTNER)).toBe(true);
  });
});

describe('storage failures fail CLOSED — the branch is reached, not merely written', () => {
  it('reads false when getItem throws', () => {
    recordReveal(SELF, PARTNER, 1_000);
    __resetRevealMemoForTests(); // force a real read
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(hasRevealedTo(SELF, PARTNER)).toBe(false);
    expect(spy).toHaveBeenCalled(); // the throwing path really ran
  });

  it('does NOT memoize a failed read, so recovery is immediate', () => {
    recordReveal(SELF, PARTNER, 1_000);
    __resetRevealMemoForTests();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(hasRevealedTo(SELF, PARTNER)).toBe(false);
    spy.mockRestore();
    // A pinned negative memo would keep answering false here forever.
    expect(hasRevealedTo(SELF, PARTNER)).toBe(true);
  });

  it('survives a throwing setItem by keeping the reveal in memory only', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => recordReveal(SELF, PARTNER, 1_000)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    // Memo-only: this session behaves correctly...
    expect(hasRevealedTo(SELF, PARTNER)).toBe(true);
    // ...and nothing was actually persisted, which is why the bootstrap
    // re-derivation from history is the real durability mechanism.
    spy.mockRestore();
    __resetRevealMemoForTests();
    expect(hasRevealedTo(SELF, PARTNER)).toBe(false);
  });

  it('a throwing clear drops the memo, so nothing answers from a layer we could not clear', () => {
    recordReveal(SELF, PARTNER, 1_000); // populates memo AND storage
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    clearReveal(SELF);
    vi.restoreAllMocks();

    // The proof is that the next read goes to STORAGE rather than being served
    // by a memo the failed clear left behind. Without the catch's memo.clear(),
    // getItem is never called and this spy count stays 0.
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    hasRevealedTo(SELF, PARTNER);
    expect(getItem).toHaveBeenCalled();
  });
});

describe('messagesContainSelfAuthored', () => {
  it('is true only when a row carrying OUR authenticated marker is present', () => {
    expect(messagesContainSelfAuthored([theirs(), theirs()], SELF)).toBe(false);
    expect(messagesContainSelfAuthored([theirs(), ours()], SELF)).toBe(true);
  });

  it('REJECTS a forged row that merely CLAIMS our senderId', () => {
    // The measured exploit, as a unit test. An attacker sends an ordinary post
    // with `content.senderId` set to the victim's address. It is stored, and
    // while this function read that field it returned true — which flipped the
    // ledger and leaked the victim's real name on the next sweep.
    // MEASURED live 2026-08-20 via `yarn harness dm-reveal-forgery`.
    const forged = post(SELF, PARTNER); // claims us; crypto says the partner
    expect(messagesContainSelfAuthored([forged], SELF)).toBe(false);
    // Still rejected sitting beside real partner traffic.
    expect(messagesContainSelfAuthored([theirs(), forged], SELF)).toBe(false);
  });

  it('IGNORES content.senderId entirely — it is not even consulted', () => {
    // The inverse of the test above, and the one that pins the actual rule.
    // A row whose payload names the PARTNER but whose authenticated marker is
    // OURS still counts as ours. If someone reintroduces a `senderId ===
    // selfAddress` pre-filter "for speed", this goes red.
    expect(messagesContainSelfAuthored([post(PARTNER, SELF)], SELF)).toBe(true);
  });

  it('fails CLOSED on a row with no marker at all (pre-existing history)', () => {
    // Rows written before the marker existed prove nothing. Fail-safe: the
    // partner waits for one more deliberate send from this device.
    expect(messagesContainSelfAuthored([post(SELF)], SELF)).toBe(false);
    expect(messagesContainSelfAuthored([post(SELF, '')], SELF)).toBe(false);
  });

  it('is false for empty, missing and malformed input', () => {
    expect(messagesContainSelfAuthored([], SELF)).toBe(false);
    expect(messagesContainSelfAuthored(undefined, SELF)).toBe(false);
    expect(messagesContainSelfAuthored([{}, { content: {} } as never], SELF)).toBe(false);
    expect(messagesContainSelfAuthored([ours()], '')).toBe(false);
  });
});

describe('ensureRevealBootstrap — derive once from history, never persist a negative', () => {
  it('derives true from a self-authored message and caches it', async () => {
    const getMessages = vi.fn().mockResolvedValue({ messages: [theirs(), ours()] });
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(true);
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(true);
    // Cached: the second call short-circuits on the ledger, no second scan.
    expect(getMessages).toHaveBeenCalledTimes(1);
  });

  it('a forged history NEVER bootstraps the ledger', async () => {
    // End-to-end shape of the exploit: the attacker's forged row is the ONLY
    // thing in history claiming our address. The bootstrap must not flip, and
    // must not persist anything — a persisted true would be permanent.
    const getMessages = vi.fn().mockResolvedValue({
      messages: [theirs(), post(SELF, PARTNER)],
    });
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(false);
    expect(hasRevealedTo(SELF, PARTNER)).toBe(false);
  });

  it('scans the DM under (spaceId = partner, channelId = partner)', async () => {
    const getMessages = vi.fn().mockResolvedValue({ messages: [] });
    await ensureRevealBootstrap(SELF, PARTNER, getMessages);
    expect(getMessages).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: PARTNER, channelId: PARTNER })
    );
  });

  it('an inbound-only stranger row stays false, and re-scans every time', async () => {
    const getMessages = vi.fn().mockResolvedValue({ messages: [theirs()] });
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(false);
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(false);
    // A negative was NOT persisted — that is what lets a later reply flip it.
    expect(getMessages).toHaveBeenCalledTimes(2);
    recordReveal(SELF, PARTNER, 2_000);
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(true);
  });

  it('fails CLOSED when the history read rejects', async () => {
    const getMessages = vi.fn().mockRejectedValue(new Error('db closed'));
    expect(await ensureRevealBootstrap(SELF, PARTNER, getMessages)).toBe(false);
  });

  it('fails CLOSED when the history read resolves to garbage', async () => {
    expect(await ensureRevealBootstrap(SELF, PARTNER, vi.fn().mockResolvedValue({}))).toBe(false);
    expect(
      await ensureRevealBootstrap(SELF, PARTNER, vi.fn().mockResolvedValue(null as never))
    ).toBe(false);
  });

  it('never scans history for a degenerate identifier', async () => {
    const getMessages = vi.fn().mockResolvedValue({ messages: [ours()] });
    expect(await ensureRevealBootstrap('', PARTNER, getMessages)).toBe(false);
    expect(await ensureRevealBootstrap(SELF, '', getMessages)).toBe(false);
    expect(getMessages).not.toHaveBeenCalled();
  });
});
