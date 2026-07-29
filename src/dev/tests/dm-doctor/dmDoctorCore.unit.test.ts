import { describe, expect, it } from 'vitest';
import {
  scanSequence,
  findGhostConversations,
  formatMeasurementRow,
  type DmDoctorMessageRow,
  type DmDoctorConversationRow,
} from '../../dm-doctor/dmDoctorCore';

const OWN = 'own-address-b';
const PEER = 'peer-address-a';

function msg(
  n: number,
  spaceId: string,
  opts: { prefix?: string; createdDate?: number; textOverride?: string | string[] } = {}
): DmDoctorMessageRow {
  const { prefix = 'V', createdDate = 1000 + n, textOverride } = opts;
  return {
    spaceId,
    channelId: spaceId,
    createdDate,
    content: { text: textOverride ?? `${prefix} ${n}` },
  };
}

describe('scanSequence', () => {
  it('matches today\'s real-data shape: 20 hits, all filed under the account\'s own address (misfiled)', () => {
    // Mirrors the 2026-07-29 V-run: 20/20 in the store, every row filed under
    // spaceId = channelId = the sender's own address instead of the peer's.
    const messages = Array.from({ length: 20 }, (_, i) => msg(i + 1, OWN));
    const result = scanSequence(messages, 'V', 20, OWN);

    expect(result.landed).toBe(20);
    expect(result.missing).toEqual([]);
    expect(result.duplicates).toBe(0);
    expect(result.hits).toHaveLength(20);
    expect(result.hits.every((h) => h.misfiled)).toBe(true);
    expect(result.byConversation).toEqual({ [OWN]: 20 });
  });

  it('matches the U-run shape: 17/20 landed, missing [2, 5, 10], not misfiled', () => {
    const numbers = Array.from({ length: 20 }, (_, i) => i + 1).filter(
      (n) => ![2, 5, 10].includes(n)
    );
    const messages = numbers.map((n) => msg(n, PEER, { prefix: 'U' }));
    const result = scanSequence(messages, 'U', 20, OWN);

    expect(result.landed).toBe(17);
    expect(result.missing).toEqual([2, 5, 10]);
    expect(result.duplicates).toBe(0);
    expect(result.hits.every((h) => !h.misfiled)).toBe(true);
  });

  it('counts duplicates when the same number lands more than once', () => {
    const messages = [
      msg(1, PEER),
      msg(1, PEER, { createdDate: 2000 }), // redelivered copy of the same number
      msg(2, PEER),
    ];
    const result = scanSequence(messages, 'V', 2, OWN);

    expect(result.landed).toBe(2);
    expect(result.missing).toEqual([]);
    expect(result.duplicates).toBe(1);
    expect(result.hits).toHaveLength(3);
  });

  it('reads content.text as a string[] the same way as a plain string', () => {
    const messages: DmDoctorMessageRow[] = [
      { spaceId: PEER, content: { text: ['V 1', 'not a match'] } },
      { spaceId: PEER, content: { text: 'V 2' } },
    ];
    const result = scanSequence(messages, 'V', 2, OWN);

    expect(result.landed).toBe(2);
    expect(result.missing).toEqual([]);
  });

  it('is case-insensitive on the prefix, matches the probe regex exactly', () => {
    const messages: DmDoctorMessageRow[] = [
      { spaceId: PEER, content: { text: 'v1' } },
      { spaceId: PEER, content: { text: '  V   2  ' } },
    ];
    const result = scanSequence(messages, 'V', 2, OWN);

    expect(result.landed).toBe(2);
  });

  it('ignores non-matching text and rows with missing/non-string content', () => {
    const messages: DmDoctorMessageRow[] = [
      { spaceId: PEER, content: { text: 'hello world' } },
      { spaceId: PEER, content: {} },
      { spaceId: PEER, content: null },
      { spaceId: PEER },
      { spaceId: PEER, content: { text: 'V 1' } },
    ];
    const result = scanSequence(messages, 'V', 1, OWN);

    expect(result.landed).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it('marks misfiled only when ownAddress is known and matches spaceId', () => {
    const messages = [msg(1, OWN)];
    const withoutOwn = scanSequence(messages, 'V', 1, null);
    const withOwn = scanSequence(messages, 'V', 1, OWN);

    expect(withoutOwn.hits[0].misfiled).toBe(false);
    expect(withOwn.hits[0].misfiled).toBe(true);
  });

  it('tallies byConversation across every distinct spaceId seen', () => {
    const messages = [msg(1, PEER), msg(2, PEER), msg(3, OWN)];
    const result = scanSequence(messages, 'V', 3, OWN);

    expect(result.byConversation).toEqual({ [PEER]: 2, [OWN]: 1 });
  });

  it('treats an empty prefix as "just digits", and escapes regex-special prefixes safely', () => {
    const messages: DmDoctorMessageRow[] = [{ spaceId: PEER, content: { text: '7' } }];
    expect(scanSequence(messages, '', 7, OWN).landed).toBe(1);

    // A prefix containing a regex metacharacter must be treated literally, not
    // as part of the pattern (defensive — the UI restricts this to one letter,
    // but the function itself must not be exploitable/crashable).
    const weird: DmDoctorMessageRow[] = [{ spaceId: PEER, content: { text: 'V. 1' } }];
    expect(() => scanSequence(weird, 'V.', 1, OWN)).not.toThrow();
    expect(scanSequence(weird, 'V.', 1, OWN).landed).toBe(1);
    expect(scanSequence([{ spaceId: PEER, content: { text: 'VX 1' } }], 'V.', 1, OWN).landed).toBe(0);
  });

  it('only reports missing numbers within 1..expected, even if higher numbers landed', () => {
    const messages = [msg(1, PEER), msg(25, PEER)];
    const result = scanSequence(messages, 'V', 2, OWN);

    expect(result.landed).toBe(2); // both 1 and 25 are distinct landed numbers
    expect(result.missing).toEqual([2]); // only 2 is missing from the 1..2 range
  });
});

function conv(
  conversationId: string,
  address: string,
  overrides: Partial<DmDoctorConversationRow> = {}
): DmDoctorConversationRow {
  return {
    conversationId,
    type: 'direct',
    address,
    displayName: overrides.displayName ?? `name-${address}`,
    lastMessageId: overrides.lastMessageId,
    ...overrides,
  };
}

describe('findGhostConversations', () => {
  it('flags a direct row whose address equals the account\'s own address', () => {
    const rows = [conv(OWN, OWN), conv(PEER, PEER)];
    const ghosts = findGhostConversations(rows, OWN);

    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].conversationId).toBe(OWN);
    expect(ghosts[0].reasons).toEqual(['self-address']);
  });

  it('flags a direct row whose conversationId (not address) equals the account\'s own address', () => {
    const rows = [conv(OWN, 'some-other-address'), conv(PEER, PEER)];
    const ghosts = findGhostConversations(rows, OWN);

    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].conversationId).toBe(OWN);
    expect(ghosts[0].reasons).toEqual(['self-address']);
  });

  it('flags a pair of direct rows sharing the same peer address as duplicate-peer', () => {
    const rows = [
      conv('conv-1', PEER, { displayName: 'Alice (old)' }),
      conv('conv-2', PEER, { displayName: 'Alice (new)' }),
    ];
    const ghosts = findGhostConversations(rows, OWN);

    expect(ghosts).toHaveLength(2);
    expect(ghosts.map((g) => g.conversationId).sort()).toEqual(['conv-1', 'conv-2']);
    expect(ghosts.every((g) => g.reasons.includes('duplicate-peer'))).toBe(true);
  });

  it('carries both reasons once, without duplicating the row, when a row matches both criteria', () => {
    const rows = [conv(OWN, OWN), conv('conv-2', OWN)];
    const ghosts = findGhostConversations(rows, OWN);

    expect(ghosts).toHaveLength(2);
    const selfRow = ghosts.find((g) => g.conversationId === OWN)!;
    expect(selfRow.reasons.sort()).toEqual(['duplicate-peer', 'self-address']);
  });

  it('ignores group-type rows entirely', () => {
    const rows: DmDoctorConversationRow[] = [
      { conversationId: OWN, type: 'group', address: OWN, displayName: 'Some space channel' },
    ];
    expect(findGhostConversations(rows, OWN)).toEqual([]);
  });

  it('returns nothing when there are no ghosts and no duplicates', () => {
    const rows = [conv('conv-1', PEER), conv('conv-2', 'someone-else')];
    expect(findGhostConversations(rows, OWN)).toEqual([]);
  });

  it('does not flag self-address ghosts when ownAddress is unknown', () => {
    const rows = [conv(OWN, OWN)];
    expect(findGhostConversations(rows, null)).toEqual([]);
  });
});

describe('formatMeasurementRow', () => {
  it('formats a clean run as a markdown table row', () => {
    const result = scanSequence(
      Array.from({ length: 20 }, (_, i) => msg(i + 1, PEER)),
      'V',
      20,
      OWN
    );
    const row = formatMeasurementRow(result, {
      when: '2026-07-30',
      run: 'DM doctor scan (prefix "V")',
      configuration: 'own=own-address-b',
      expected: 20,
      whatItChanged: 'confirmed clean',
      source: 'DM doctor panel',
    });

    expect(row).toBe(
      '| 2026-07-30 | DM doctor scan (prefix "V") | own=own-address-b | persistence | 20/20 landed, none missing | confirmed clean | DM doctor panel |'
    );
  });

  it('reports missing, duplicates and misfiled counts together', () => {
    const messages = [
      msg(1, OWN),
      msg(1, OWN, { createdDate: 2000 }), // duplicate
      msg(3, OWN),
    ];
    const result = scanSequence(messages, 'V', 3, OWN);
    const row = formatMeasurementRow(result, {
      when: '2026-07-30',
      run: 'scan',
      configuration: 'cfg',
      expected: 3,
    });

    expect(row).toContain('2/3 landed');
    expect(row).toContain('missing [2]');
    expect(row).toContain('duplicates 1');
    // All 3 matched rows (including the duplicate) are filed under the
    // account's own address, so all 3 hits — not just the 2 unique numbers —
    // are misfiled.
    expect(row).toContain('3 misfiled (ghost self-conversation)');
  });

  it('escapes pipe characters in free-text fields so the row stays a valid table row', () => {
    const result = scanSequence([msg(1, PEER)], 'V', 1, OWN);
    const row = formatMeasurementRow(result, {
      when: '2026-07-30',
      run: 'scan | with a pipe',
      configuration: 'cfg',
      expected: 1,
    });

    expect(row).toContain('scan \\| with a pipe');
  });

  it('defaults optional fields to empty cells', () => {
    const result = scanSequence([msg(1, PEER)], 'V', 1, OWN);
    const row = formatMeasurementRow(result, {
      when: '2026-07-30',
      run: 'scan',
      configuration: 'cfg',
      expected: 1,
    });

    const cells = row.split('|').map((c) => c.trim());
    // | when | run | configuration | class | result | whatItChanged | source |
    expect(cells[6]).toBe(''); // whatItChanged
    expect(cells[7]).toBe(''); // source
  });
});
