import { describe, expect, it } from 'vitest';
import {
  scanSequence,
  findGhostConversations,
  buildDirectConversationInventory,
  formatMeasurementRow,
  formatFullReport,
  computeScanWindowStart,
  DM_DOCTOR_RUNBOOK_POINTER,
  type DmDoctorMessageRow,
  type DmDoctorConversationRow,
  type ScanHistoryEntry,
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

describe('scanSequence — window default (no window argument)', () => {
  it('defaults to "all" time with no cutoff — matches every hit, zero outside-window, not span-suspicious', () => {
    const messages = [msg(1, PEER, { createdDate: 10 }), msg(2, PEER, { createdDate: 20_010 })];
    const result = scanSequence(messages, 'V', 2, OWN);

    expect(result.window.option).toBe('all');
    expect(result.window.startMs).toBeNull();
    expect(result.window.matchesOutsideWindow).toBe(0);
    expect(result.window.spanSuspicious).toBe(false);
    expect(result.landed).toBe(2);
  });
});

describe('scanSequence — time window filtering', () => {
  const CUTOFF = 1_000_000; // arbitrary epoch-ms cutoff used across this block

  it('computes landed/missing/duplicates/byConversation from in-window hits only, and never drops the out-of-window matches from the report', () => {
    const messages = [
      // three OLD hits, from a previous run reusing the same letter — before the cutoff
      msg(1, PEER, { createdDate: CUTOFF - 3000 }),
      msg(2, PEER, { createdDate: CUTOFF - 2000 }),
      msg(3, PEER, { createdDate: CUTOFF - 1000 }),
      // three NEW hits, in-window
      msg(4, PEER, { createdDate: CUTOFF + 1000 }),
      msg(5, PEER, { createdDate: CUTOFF + 2000 }),
      msg(6, PEER, { createdDate: CUTOFF + 3000 }),
    ];
    const result = scanSequence(messages, 'V', 6, OWN, { option: '1h', startMs: CUTOFF });

    // Old hits (1,2,3) must not count toward landed and must show as missing.
    expect(result.landed).toBe(3);
    expect(result.missing).toEqual([1, 2, 3]);
    expect(result.duplicates).toBe(0);
    expect(result.byConversation).toEqual({ [PEER]: 3 });

    // But they are never silently dropped — they are reported as outside-window.
    expect(result.window.matchesOutsideWindow).toBe(3);
    expect(result.window.outsideOldestMs).toBe(CUTOFF - 3000);
    expect(result.window.outsideNewestMs).toBe(CUTOFF - 1000);
  });

  it('reports landed 0 plus a non-zero matchesOutsideWindow when every hit predates the cutoff', () => {
    const messages = [
      msg(1, PEER, { createdDate: CUTOFF - 5000 }),
      msg(2, PEER, { createdDate: CUTOFF - 4000 }),
    ];
    const result = scanSequence(messages, 'V', 2, OWN, { option: '1h', startMs: CUTOFF });

    expect(result.landed).toBe(0);
    expect(result.missing).toEqual([1, 2]);
    expect(result.hits).toEqual([]);
    expect(result.byConversation).toEqual({});
    expect(result.window.matchesOutsideWindow).toBe(2);
    expect(result.window.firstHitMs).toBeNull();
    expect(result.window.lastHitMs).toBeNull();
    expect(result.window.spanSeconds).toBeNull();
  });

  it('flags spanSuspicious when the in-window burst spans over 30 minutes', () => {
    const messages = [
      msg(1, PEER, { createdDate: CUTOFF }),
      msg(2, PEER, { createdDate: CUTOFF + 40 * 60 * 1000 }), // 40 minutes later
    ];
    const result = scanSequence(messages, 'V', 2, OWN, { option: '6h', startMs: CUTOFF - 1 });

    expect(result.window.spanSeconds).toBe(40 * 60);
    expect(result.window.spanSuspicious).toBe(true);
  });

  it('does not flag spanSuspicious for a normal tight burst', () => {
    const messages = [
      msg(1, PEER, { createdDate: CUTOFF }),
      msg(2, PEER, { createdDate: CUTOFF + 40_000 }), // 40 seconds later
    ];
    const result = scanSequence(messages, 'V', 2, OWN, { option: '6h', startMs: CUTOFF - 1 });

    expect(result.window.spanSeconds).toBe(40);
    expect(result.window.spanSuspicious).toBe(false);
  });

  it('"all" time (explicit) behaves exactly as today: no cutoff, nothing outside window', () => {
    const numbers = Array.from({ length: 20 }, (_, i) => i + 1).filter(
      (n) => ![2, 5, 10].includes(n)
    );
    const messages = numbers.map((n) => msg(n, PEER, { prefix: 'U' }));
    const result = scanSequence(messages, 'U', 20, OWN, { option: 'all', startMs: null });

    expect(result.landed).toBe(17);
    expect(result.missing).toEqual([2, 5, 10]);
    expect(result.duplicates).toBe(0);
    expect(result.window.matchesOutsideWindow).toBe(0);
    expect(result.window.spanSuspicious).toBe(false);
  });
});

describe('computeScanWindowStart', () => {
  const NOW = Date.parse('2026-07-29T18:00:00.000Z');
  const PAGE_LOAD = Date.parse('2026-07-29T17:30:00.000Z');

  it('"since-load" returns the page-load timestamp', () => {
    expect(computeScanWindowStart('since-load', NOW, PAGE_LOAD)).toBe(PAGE_LOAD);
  });

  it('"1h"/"6h"/"24h" subtract the matching duration from now', () => {
    expect(computeScanWindowStart('1h', NOW, PAGE_LOAD)).toBe(NOW - 60 * 60 * 1000);
    expect(computeScanWindowStart('6h', NOW, PAGE_LOAD)).toBe(NOW - 6 * 60 * 60 * 1000);
    expect(computeScanWindowStart('24h', NOW, PAGE_LOAD)).toBe(NOW - 24 * 60 * 60 * 1000);
  });

  it('"all" returns null (no cutoff)', () => {
    expect(computeScanWindowStart('all', NOW, PAGE_LOAD)).toBeNull();
  });

  it('"since-load" returns null when the page-load time is unknown', () => {
    expect(computeScanWindowStart('since-load', NOW, null)).toBeNull();
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
    timestamp: overrides.timestamp,
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

describe('buildDirectConversationInventory', () => {
  it('returns an empty inventory (rows: [], totalDirectRows: 0) when there are no conversations at all', () => {
    const inventory = buildDirectConversationInventory([], [], OWN);
    expect(inventory).toEqual({ rows: [], totalDirectRows: 0 });
  });

  it('lists a normal, unremarkable direct row with zero flags', () => {
    const rows = [conv('conv-1', PEER, { displayName: 'Alice', lastMessageId: 'msg-1', timestamp: 500 })];
    const messages = [msg(1, PEER)];
    const inventory = buildDirectConversationInventory(rows, messages, OWN);

    expect(inventory.totalDirectRows).toBe(1);
    expect(inventory.rows).toHaveLength(1);
    expect(inventory.rows[0]).toEqual({
      conversationId: 'conv-1',
      address: PEER,
      displayName: 'Alice',
      lastMessageId: 'msg-1',
      timestamp: 500,
      messageCount: 1,
      flags: [],
    });
  });

  it('flags SELF when the row is keyed by (or addressed to) the account\'s own address', () => {
    const byAddress = buildDirectConversationInventory([conv('conv-1', OWN)], [], OWN);
    expect(byAddress.rows[0].flags).toContain('SELF');

    const byConversationId = buildDirectConversationInventory(
      [conv(OWN, 'some-other-address')],
      [],
      OWN
    );
    expect(byConversationId.rows[0].flags).toContain('SELF');
  });

  it('does not flag SELF when ownAddress is unknown', () => {
    const inventory = buildDirectConversationInventory([conv('conv-1', OWN)], [], null);
    expect(inventory.rows[0].flags).not.toContain('SELF');
  });

  it('flags DUPLICATE-PEER on every row sharing the same address', () => {
    const rows = [conv('conv-1', PEER), conv('conv-2', PEER), conv('conv-3', 'someone-else')];
    const inventory = buildDirectConversationInventory(rows, [], OWN);

    const byId = new Map(inventory.rows.map((r) => [r.conversationId, r]));
    expect(byId.get('conv-1')!.flags).toContain('DUPLICATE-PEER');
    expect(byId.get('conv-2')!.flags).toContain('DUPLICATE-PEER');
    expect(byId.get('conv-3')!.flags).not.toContain('DUPLICATE-PEER');
  });

  it('flags NO-DISPLAY-NAME when displayName is absent or blank, and reports it as "(none)"', () => {
    const rows = [
      conv('conv-1', PEER, { displayName: undefined }),
      conv('conv-2', 'someone-else', { displayName: '   ' }),
    ];
    const inventory = buildDirectConversationInventory(rows, [], OWN);

    for (const row of inventory.rows) {
      expect(row.flags).toContain('NO-DISPLAY-NAME');
      expect(row.displayName).toBe('(none)');
    }
  });

  it('flags EMPTY when zero messages are filed under the row\'s address', () => {
    const inventory = buildDirectConversationInventory([conv('conv-1', PEER)], [], OWN);
    expect(inventory.rows[0].messageCount).toBe(0);
    expect(inventory.rows[0].flags).toContain('EMPTY');
  });

  it('counts messages by address across the WHOLE store (not scoped to any prefix)', () => {
    const rows = [conv('conv-1', PEER)];
    const messages = [msg(1, PEER, { textOverride: 'hello' }), msg(2, PEER, { textOverride: 'V 9' })];
    const inventory = buildDirectConversationInventory(rows, messages, OWN);
    expect(inventory.rows[0].messageCount).toBe(2);
    expect(inventory.rows[0].flags).not.toContain('EMPTY');
  });

  it('carries multiple flags at once on the same row', () => {
    // Keyed by own address (SELF), shares that address with another row
    // (DUPLICATE-PEER), no display name, and no messages filed under it.
    const rows = [conv('conv-1', OWN, { displayName: undefined }), conv('conv-2', OWN)];
    const inventory = buildDirectConversationInventory(rows, [], OWN);
    const row1 = inventory.rows.find((r) => r.conversationId === 'conv-1')!;
    expect(row1.flags.sort()).toEqual(['DUPLICATE-PEER', 'EMPTY', 'NO-DISPLAY-NAME', 'SELF']);
  });

  it('ignores group-type rows for the direct listing', () => {
    const rows: DmDoctorConversationRow[] = [
      { conversationId: 'space-1/chan-1', type: 'group', address: 'space-1', displayName: 'A channel' },
    ];
    const inventory = buildDirectConversationInventory(rows, [], OWN);
    expect(inventory.totalDirectRows).toBe(0);
    expect(inventory.rows.filter((r) => !r.flags.includes('ORPHAN-KEY'))).toEqual([]);
  });

  it('flags ORPHAN-KEY for a messages-store spaceId with no matching conversation row', () => {
    const rows = [conv('conv-1', PEER)];
    const messages = [msg(1, PEER), msg(1, 'ghost-key-with-no-row')];
    const inventory = buildDirectConversationInventory(rows, messages, OWN);

    const orphan = inventory.rows.find((r) => r.conversationId === 'ghost-key-with-no-row');
    expect(orphan).toBeDefined();
    expect(orphan!.flags).toEqual(['ORPHAN-KEY']);
    expect(orphan!.address).toBe('ghost-key-with-no-row');
    expect(orphan!.displayName).toBe('(none)');
    expect(orphan!.lastMessageId).toBe('(none)');
    expect(orphan!.timestamp).toBeNull();
    expect(orphan!.messageCount).toBe(1);
    // Orphans are not counted in totalDirectRows — that count is real conversation rows only.
    expect(inventory.totalDirectRows).toBe(1);
  });

  it('does NOT flag a spaceId as orphan when it matches a GROUP row\'s address or conversationId prefix', () => {
    // Regression guard: the messages store holds space/channel traffic in the
    // same table as DMs. If orphan detection only checked `direct` addresses,
    // every ordinary space channel would be misreported as an "orphan DM".
    const rows: DmDoctorConversationRow[] = [
      { conversationId: 'space-1/chan-1', type: 'group', address: 'space-1', displayName: 'A channel' },
    ];
    const messages = [msg(1, 'space-1')];
    const inventory = buildDirectConversationInventory(rows, messages, OWN);
    expect(inventory.rows.some((r) => r.flags.includes('ORPHAN-KEY'))).toBe(false);
  });

  it('sorts orphan rows by key for a stable, diffable report', () => {
    const messages = [msg(1, 'zzz-key'), msg(1, 'aaa-key')];
    const inventory = buildDirectConversationInventory([], messages, OWN);
    expect(inventory.rows.map((r) => r.conversationId)).toEqual(['aaa-key', 'zzz-key']);
  });
});

describe('formatMeasurementRow', () => {
  it('formats a clean run as a markdown table row, including the window it was computed over', () => {
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
      '| 2026-07-30 | DM doctor scan (prefix "V") | own=own-address-b | persistence | 20/20 landed, none missing, window all time | confirmed clean | DM doctor panel |'
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

  it('reports the outside-window count and SPAN-SUSPICIOUS flag when present', () => {
    const CUTOFF = 1_000_000;
    const messages = [
      msg(1, PEER, { createdDate: CUTOFF - 5000 }), // outside
      msg(2, PEER, { createdDate: CUTOFF }),
      msg(3, PEER, { createdDate: CUTOFF + 40 * 60 * 1000 }), // 40 min later -> suspicious span
    ];
    const result = scanSequence(messages, 'V', 3, OWN, { option: '6h', startMs: CUTOFF - 1 });
    const row = formatMeasurementRow(result, {
      when: '2026-07-30',
      run: 'scan',
      configuration: 'cfg',
      expected: 3,
    });

    expect(row).toContain('window last 6h');
    expect(row).toContain('1 outside window');
    expect(row).toContain('SPAN-SUSPICIOUS');
  });
});

describe('formatFullReport', () => {
  function historyEntry(overrides: Partial<ScanHistoryEntry> = {}): ScanHistoryEntry {
    const messages = Array.from({ length: 20 }, (_, i) => msg(i + 1, PEER));
    const scanResult = scanSequence(messages, 'V', 20, OWN);
    return {
      id: 'scan-1',
      atIso: '2026-07-29T18:10:00.000Z',
      prefix: 'V',
      expected: 20,
      ownAddress: OWN,
      messagesScanned: messages.length,
      conversationsScanned: 3,
      scanResult,
      ...overrides,
    };
  }

  it('includes the header and protocol pointer', () => {
    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: '2026-07-29T18:00:00.000Z',
      history: [],
      ghosts: null,
      inventory: null,
      warningState: null,
    });

    expect(report).toContain('### DM doctor report — 2026-07-29T19:00:00.000Z');
    expect(report).toContain(`protocol: ${DM_DOCTOR_RUNBOOK_POINTER}`);
  });

  it('emits the full own address, never truncated', () => {
    const longAddress = 'QmQuCGpEgVKpYZKYuFu2J49zHXnA8vZtEqHMtpB4imXST1';
    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: longAddress,
      pageLoadedAtIso: null,
      history: [],
      ghosts: null,
      inventory: null,
      warningState: null,
    });
    expect(report).toContain(`own_address: ${longAddress}`);
    expect(report).not.toContain('…');
  });

  it('handles the empty-history case distinctly (no scans, not an error)', () => {
    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: '2026-07-29T18:00:00.000Z',
      history: [],
      ghosts: null,
      inventory: null,
      warningState: null,
    });

    expect(report).toContain('scans_in_history: 0');
    expect(report).toContain('no scans run this session');
    expect(report).toContain('not scanned yet'); // ghosts + inventory sections
  });

  it('includes every scan in history, oldest first, with per-scan detail and distribution', () => {
    const uMessages = Array.from({ length: 20 }, (_, i) => i + 1)
      .filter((n) => ![2, 5, 10].includes(n))
      .map((n) => msg(n, PEER, { prefix: 'U' }));
    const uScan = scanSequence(uMessages, 'U', 20, OWN);
    const vMessages = Array.from({ length: 20 }, (_, i) => msg(i + 1, OWN));
    const vScan = scanSequence(vMessages, 'V', 20, OWN);

    const history: ScanHistoryEntry[] = [
      historyEntry({ id: 'scan-1', prefix: 'U', atIso: '2026-07-29T18:00:00.000Z', scanResult: uScan, messagesScanned: uMessages.length }),
      historyEntry({ id: 'scan-2', prefix: 'V', atIso: '2026-07-29T18:20:00.000Z', scanResult: vScan, messagesScanned: vMessages.length }),
    ];

    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: '2026-07-29T17:00:00.000Z',
      history,
      ghosts: null,
      inventory: null,
      warningState: null,
    });

    expect(report).toContain('scans_in_history: 2');
    // Both scans present, in order (U before V in the text).
    const uIndex = report.indexOf('### Scan 1 of 2 — prefix "U"');
    const vIndex = report.indexOf('### Scan 2 of 2 — prefix "V"');
    expect(uIndex).toBeGreaterThan(-1);
    expect(vIndex).toBeGreaterThan(uIndex);

    expect(report).toContain('landed: 17/20');
    expect(report).toContain('missing: [2, 5, 10]');
    expect(report).toContain('landed: 20/20');
    expect(report).toContain('misfiled: 20');
    // Distribution line, labelled as the ghost case for the V scan.
    expect(report).toContain(`${OWN}: 20 (GHOST — filed under this account's own address)`);
    // Measurement rows for both scans appear at the end.
    expect(report).toContain('DM doctor scan (prefix "U")');
    expect(report).toContain('DM doctor scan (prefix "V")');
  });

  it('renders "none found" for an empty ghosts list, distinct from "not scanned yet"', () => {
    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: null,
      history: [historyEntry()],
      ghosts: [],
      inventory: { rows: [], totalDirectRows: 0 },
      warningState: null,
    });

    expect(report).toContain('## Ghost / duplicate conversation rows');
    // "none found" appears right after the ghosts header, not "not scanned yet".
    const ghostsIdx = report.indexOf('## Ghost / duplicate conversation rows');
    const nextSectionIdx = report.indexOf('## Direct conversations inventory');
    const ghostsBody = report.slice(ghostsIdx, nextSectionIdx);
    expect(ghostsBody).toContain('none found');
    expect(ghostsBody).not.toContain('not scanned yet');
  });

  it('renders ghost rows and the full inventory (direct + orphan) when present', () => {
    const ghosts = findGhostConversations([conv(OWN, OWN)], OWN);
    const inventory = buildDirectConversationInventory(
      [conv(OWN, OWN), conv('conv-2', PEER)],
      [msg(1, PEER), msg(1, 'orphan-key')],
      OWN
    );

    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: null,
      history: [historyEntry()],
      ghosts,
      inventory,
      warningState: null,
    });

    expect(report).toContain(`conversationId=${OWN}`);
    expect(report).toContain('reasons=[self-address]');
    expect(report).toContain('total_direct_rows: 2');
    expect(report).toContain('flags=[SELF, EMPTY]');
    expect(report).toContain('orphan conversation keys');
    expect(report).toContain('conversationId=orphan-key');
    expect(report).toContain('flags=[ORPHAN-KEY]');
  });

  it('renders warning counters with counts and last-hit timestamps, distinguishing "0, never installed" from "0, nothing happened yet"', () => {
    const neverInstalled = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: null,
      history: [],
      ghosts: null,
      inventory: null,
      warningState: null,
    });
    expect(neverInstalled).toContain('counters_installed_at: not installed yet');

    const installedButQuiet = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: null,
      history: [],
      ghosts: null,
      inventory: null,
      warningState: {
        installedAt: '2026-07-29T18:00:00.000Z',
        counts: { sessionReplaced: 0, unknownInbox: 2, decryptFailish: 0 },
        lastHits: { sessionReplaced: [], unknownInbox: ['2026-07-29T18:05:00.000Z'], decryptFailish: [] },
      },
    });
    expect(installedButQuiet).toContain('counters_installed_at: 2026-07-29T18:00:00.000Z');
    expect(installedButQuiet).toContain('sessionReplaced: count=0 last=none');
    expect(installedButQuiet).toContain('unknownInbox: count=2 last=2026-07-29T18:05:00.000Z');
  });

  it('reports matches_outside_window and span metrics per scan', () => {
    const CUTOFF = 1_000_000;
    const messages = [
      msg(1, PEER, { createdDate: CUTOFF - 5000 }),
      msg(2, PEER, { createdDate: CUTOFF }),
    ];
    const windowed = scanSequence(messages, 'V', 2, OWN, { option: '1h', startMs: CUTOFF - 1 });
    const entry = historyEntry({ scanResult: windowed });

    const report = formatFullReport({
      generatedAtIso: '2026-07-29T19:00:00.000Z',
      ownAddress: OWN,
      pageLoadedAtIso: null,
      history: [entry],
      ghosts: null,
      inventory: null,
      warningState: null,
    });

    expect(report).toContain('matches_outside_window: 1');
    expect(report).toContain('window: last 1h');
  });
});
