import { describe, expect, it } from 'vitest';
import {
  hasRealName,
  hasRealIcon,
  classifyMemberIdentity,
  classifyDmIdentity,
  computeSpaceCoverage,
  computeDmCoverage,
  buildIdentityCoverageSnapshot,
  summarisePublicProfileProbe,
  computeCoverageDelta,
  formatSigned,
  formatIdentityCoverageReport,
  type DirectConversationIdentityRow,
  type IdentityMessageRow,
  type IdentitySpaceRow,
  type PublicProfileResult,
  type SpaceMemberIdentityRow,
} from '../../identity-coverage/identityCoverageCore';
import { DefaultImages } from '../../../utils';

const OWN = 'own-address-zzz';
const SPACE = 'space-alpha';
const OTHER_SPACE = 'space-beta';

const space = (spaceId = SPACE, name = 'Quorum Test 2'): IdentitySpaceRow => ({
  spaceId,
  name,
});

function member(
  address: string,
  fields: Partial<SpaceMemberIdentityRow> = {}
): SpaceMemberIdentityRow {
  return { spaceId: SPACE, user_address: address, ...fields };
}

function message(
  senderId: string,
  spaceId = SPACE,
  count = 1
): IdentityMessageRow[] {
  return Array.from({ length: count }, () => ({
    spaceId,
    content: { senderId },
  }));
}

// ---------------------------------------------------------------------------

describe('hasRealName / hasRealIcon — agreement with the render path', () => {
  it('treats the "Unknown User" placeholder as no name, not as a name', () => {
    expect(hasRealName('Unknown User')).toBe(false);
    expect(hasRealName('Alice')).toBe(true);
  });

  it('treats empty, missing and whitespace-only names as no name', () => {
    // The shared resolveDisplayName applies a trim-and-length check, so a
    // whitespace name falls through to the address. The count must agree.
    expect(hasRealName(undefined)).toBe(false);
    expect(hasRealName(null)).toBe(false);
    expect(hasRealName('')).toBe(false);
    expect(hasRealName('   ')).toBe(false);
  });

  it('treats the default avatar as no avatar', () => {
    expect(hasRealIcon(DefaultImages.UNKNOWN_USER)).toBe(false);
    expect(hasRealIcon('')).toBe(false);
    expect(hasRealIcon(undefined)).toBe(false);
    expect(hasRealIcon('data:image/png;base64,AAAA')).toBe(true);
  });
});

describe('classifyMemberIdentity — the two-slot model', () => {
  it('does NOT count a member whose identity lives only in the global slot', () => {
    // THE load-bearing case, and the reason this module exists rather than the
    // console probe. The follow-global work deliberately leaves the per-space
    // override slot empty; 06-space-member-sources.js reads only that slot and
    // would report this member as having no identity. They render fine.
    const verdict = classifyMemberIdentity(
      member('addr-global-only', {
        global_display_name: 'Bruno',
        global_user_icon: 'data:image/png;base64,BBBB',
      })
    );

    expect(verdict.nameFrom).toBe('global');
    expect(verdict.iconFrom).toBe('global');
    expect(verdict.noIdentity).toBe(false);
    expect(verdict.noName).toBe(false);
  });

  it('counts a member with both slots empty', () => {
    const verdict = classifyMemberIdentity(member('addr-empty'));

    expect(verdict.nameFrom).toBeNull();
    expect(verdict.iconFrom).toBeNull();
    expect(verdict.noIdentity).toBe(true);
  });

  it('counts a member whose only value is the placeholder in both slots', () => {
    const verdict = classifyMemberIdentity(
      member('addr-placeholder', {
        display_name: 'Unknown User',
        user_icon: DefaultImages.UNKNOWN_USER,
        global_display_name: 'Unknown User',
        global_user_icon: DefaultImages.UNKNOWN_USER,
      })
    );

    expect(verdict.noIdentity).toBe(true);
  });

  it('lets the override slot win over the global slot, per the ladder', () => {
    const verdict = classifyMemberIdentity(
      member('addr-both', {
        display_name: 'Per-space name',
        global_display_name: 'Global name',
      })
    );

    expect(verdict.nameFrom).toBe('override');
  });

  it('resolves name and avatar slots independently', () => {
    // A per-space nickname with no per-space picture is legitimate: the name
    // comes from the override slot, the avatar from the global one.
    const verdict = classifyMemberIdentity(
      member('addr-mixed', {
        display_name: 'Nickname',
        global_user_icon: 'data:image/png;base64,CCCC',
      })
    );

    expect(verdict.nameFrom).toBe('override');
    expect(verdict.iconFrom).toBe('global');
    expect(verdict.noIdentity).toBe(false);
  });

  it('falls back to the global slot when the override holds a placeholder', () => {
    const verdict = classifyMemberIdentity(
      member('addr-demoted', {
        display_name: 'Unknown User',
        global_display_name: 'Real Name',
      })
    );

    expect(verdict.nameFrom).toBe('global');
    expect(verdict.noName).toBe(false);
  });

  it('reports a name-only member as noName false but noIcon true', () => {
    const verdict = classifyMemberIdentity(
      member('addr-name-only', { global_display_name: 'Carla' })
    );

    expect(verdict.noName).toBe(false);
    expect(verdict.noIcon).toBe(true);
    // Not "no identity" — they render as a name with initials, not an address.
    expect(verdict.noIdentity).toBe(false);
  });
});

describe('computeSpaceCoverage', () => {
  it('finds senders with no member row at all (bucket A)', () => {
    const coverage = computeSpaceCoverage(
      space(),
      [member('has-row', { global_display_name: 'Dora' })],
      [...message('has-row', SPACE, 2), ...message('no-row', SPACE, 5)],
      OWN
    );

    expect(coverage.distinctSenders).toBe(2);
    expect(coverage.sendersWithNoRow).toBe(1);
    expect(coverage.missingSenders).toEqual([
      { address: 'no-row', messageCount: 5, isSelf: false },
    ]);
  });

  it('excludes the account\'s own address from the count but flags it', () => {
    // "No member row for yourself" is a different, rarer defect. Leaving it in
    // the headline would add a constant that no identity fix ever moves.
    const coverage = computeSpaceCoverage(
      space(),
      [],
      [...message(OWN, SPACE, 3), ...message('stranger', SPACE, 1)],
      OWN
    );

    expect(coverage.sendersWithNoRow).toBe(1);
    expect(coverage.selfMissingRow).toBe(true);
    expect(coverage.missingSenders).toHaveLength(2);
  });

  it('excludes kicked members from every headline count', () => {
    const coverage = computeSpaceCoverage(
      space(),
      [member('kicked-empty', { isKicked: true }), member('live-empty')],
      [],
      OWN
    );

    expect(coverage.memberRows).toBe(1);
    expect(coverage.kickedRows).toBe(1);
    expect(coverage.rowsNoIdentity).toBe(1);
  });

  it('ignores messages filed under a different space', () => {
    const coverage = computeSpaceCoverage(
      space(),
      [],
      [...message('in-space', SPACE, 1), ...message('elsewhere', OTHER_SPACE, 9)],
      OWN
    );

    expect(coverage.distinctSenders).toBe(1);
    expect(coverage.sendersWithNoRow).toBe(1);
  });

  it('sums the two disjoint figures into noIdentityTotal without double-counting', () => {
    const coverage = computeSpaceCoverage(
      space(),
      [member('empty-row'), member('good-row', { global_display_name: 'Eve' })],
      [
        ...message('empty-row', SPACE, 1),
        ...message('good-row', SPACE, 1),
        ...message('missing-row', SPACE, 1),
      ],
      OWN
    );

    expect(coverage.sendersWithNoRow).toBe(1);
    expect(coverage.rowsNoIdentity).toBe(1);
    expect(coverage.noIdentityTotal).toBe(2);
  });

  it('reproduces the 2026-06-13 baseline shape: 89 distinct senders, 46 with no row', () => {
    // Grounding test against the historical measurement quoted in the task, so
    // the counting rule cannot silently drift away from the number it is meant
    // to be compared with.
    const withRows = Array.from({ length: 43 }, (_, i) => `sender-with-row-${i}`);
    const withoutRows = Array.from({ length: 46 }, (_, i) => `sender-no-row-${i}`);

    const coverage = computeSpaceCoverage(
      space(),
      withRows.map((address) =>
        member(address, { global_display_name: `Name ${address}` })
      ),
      [...withRows, ...withoutRows].flatMap((address) => message(address)),
      OWN
    );

    expect(coverage.distinctSenders).toBe(89);
    expect(coverage.sendersWithNoRow).toBe(46);
    expect(coverage.rowsNoIdentity).toBe(0);
    expect(coverage.noIdentityTotal).toBe(46);
  });
});

describe('computeDmCoverage', () => {
  const dm = (
    address: string,
    fields: Partial<DirectConversationIdentityRow> = {}
  ): DirectConversationIdentityRow => ({
    conversationId: `conv-${address}`,
    type: 'direct',
    address,
    ...fields,
  });

  it('counts direct rows carrying neither a name nor an avatar', () => {
    const coverage = computeDmCoverage(
      [
        dm('peer-empty'),
        dm('peer-named', { displayName: 'Frida' }),
        dm('peer-placeholder', {
          displayName: 'Unknown User',
          icon: DefaultImages.UNKNOWN_USER,
        }),
      ],
      OWN
    );

    expect(coverage.directRows).toBe(3);
    expect(coverage.rowsNoIdentity).toBe(2);
    expect(coverage.rowsNoName).toBe(2);
  });

  it('excludes group rows', () => {
    const coverage = computeDmCoverage(
      [dm('peer'), { ...dm('group'), type: 'group' }],
      OWN
    );

    expect(coverage.directRows).toBe(1);
  });

  it('excludes a row keyed by the account\'s own address, and reports it apart', () => {
    const coverage = computeDmCoverage([dm(OWN), dm('peer')], OWN);

    expect(coverage.directRows).toBe(1);
    expect(coverage.selfRows).toBe(1);
  });

  it('flags a self-keyed row through classifyDmIdentity', () => {
    expect(classifyDmIdentity(dm(OWN), OWN).isSelf).toBe(true);
    expect(classifyDmIdentity(dm('peer'), OWN).isSelf).toBe(false);
    // conversationId can carry the own address instead of the address field.
    expect(
      classifyDmIdentity({ ...dm('peer'), conversationId: OWN }, OWN).isSelf
    ).toBe(true);
  });
});

describe('buildIdentityCoverageSnapshot', () => {
  const snapshotInput = {
    atIso: '2026-08-02T10:00:00.000Z',
    ownAddress: OWN,
    spaces: [space(SPACE, 'Alpha'), space(OTHER_SPACE, 'Beta')],
    members: [
      member('a-empty'),
      { ...member('b-good'), spaceId: OTHER_SPACE, global_display_name: 'Gus' },
    ],
    messages: [...message('ghost', SPACE, 1), ...message('b-good', OTHER_SPACE, 1)],
    conversations: [] as DirectConversationIdentityRow[],
  };

  it('totals across spaces and orders them worst first', () => {
    const snapshot = buildIdentityCoverageSnapshot(snapshotInput);

    expect(snapshot.spaces[0].spaceName).toBe('Alpha');
    expect(snapshot.spaces[0].noIdentityTotal).toBe(2); // 1 missing + 1 empty row
    expect(snapshot.spaces[1].noIdentityTotal).toBe(0);
    expect(snapshot.totals.noIdentityTotal).toBe(2);
    expect(snapshot.totals.sendersWithNoRow).toBe(1);
    expect(snapshot.totals.rowsNoIdentity).toBe(1);
  });

  it('records store sizes so an empty read cannot read as a clean result', () => {
    const snapshot = buildIdentityCoverageSnapshot(snapshotInput);

    expect(snapshot.messagesScanned).toBe(2);
    expect(snapshot.memberRowsScanned).toBe(2);
    expect(snapshot.conversationsScanned).toBe(0);
  });

  it('leaves the public-profile probe unset until it is explicitly run', () => {
    expect(buildIdentityCoverageSnapshot(snapshotInput).publicProfile).toBeNull();
  });
});

describe('summarisePublicProfileProbe', () => {
  const result = (
    address: string,
    status: number | 'error',
    hasName = false,
    hasImage = false
  ): PublicProfileResult => ({ address, status, hasName, hasImage });

  it('separates recoverable, no-source and errors', () => {
    const summary = summarisePublicProfileProbe([
      result('a', 200, true, false),
      result('b', 200, false, true),
      result('c', 404),
      result('d', 'error'),
      result('e', 200), // 200 but an empty profile — no source either
    ]);

    expect(summary.probed).toBe(5);
    expect(summary.recoverable).toBe(2);
    expect(summary.noSource).toBe(2);
    expect(summary.errors).toBe(1);
  });

  it('never counts a fetch error as evidence of a missing profile', () => {
    const summary = summarisePublicProfileProbe([result('a', 'error')]);

    expect(summary.errors).toBe(1);
    expect(summary.noSource).toBe(0);
  });
});

describe('delta and report', () => {
  const snapshotAt = (
    atIso: string,
    missing: number,
    emptyRows: number
  ) =>
    buildIdentityCoverageSnapshot({
      atIso,
      ownAddress: OWN,
      spaces: [space()],
      members: Array.from({ length: emptyRows }, (_, i) => member(`empty-${i}`)),
      messages: Array.from({ length: missing }, (_, i) =>
        message(`gone-${i}`)
      ).flat(),
      conversations: [],
    });

  it('reports improvement as a negative delta', () => {
    const before = snapshotAt('2026-08-02T10:00:00.000Z', 46, 4);
    const after = snapshotAt('2026-08-02T11:00:00.000Z', 2, 1);
    const delta = computeCoverageDelta(before, after);

    expect(delta.sendersWithNoRow).toBe(-44);
    expect(delta.rowsNoIdentity).toBe(-3);
    expect(delta.noIdentityTotal).toBe(-47);
  });

  it('always signs a delta explicitly', () => {
    expect(formatSigned(3)).toBe('+3');
    expect(formatSigned(-3)).toBe('-3');
    expect(formatSigned(0)).toBe('0');
  });

  it('formats a report carrying the headline, the delta and the baseline', () => {
    const report = formatIdentityCoverageReport({
      generatedAtIso: '2026-08-02T12:00:00.000Z',
      history: [
        snapshotAt('2026-08-02T10:00:00.000Z', 46, 0),
        snapshotAt('2026-08-02T11:00:00.000Z', 2, 0),
      ],
    });

    expect(report).toContain('NO_IDENTITY_TOTAL: -44');
    expect(report).toContain('senders_with_no_member_row: 46');
    expect(report).toContain('senders_with_no_member_row: 2');
    expect(report).toContain('89 distinct senders, 46 with no member row');
    expect(report).toContain('Snapshot 1 of 2');
    expect(report).toContain('Snapshot 2 of 2');
  });

  it('says so plainly when no snapshot has been taken', () => {
    const report = formatIdentityCoverageReport({
      generatedAtIso: '2026-08-02T12:00:00.000Z',
      history: [],
    });

    expect(report).toContain('No snapshots taken this session.');
  });

  it('omits the delta section for a single snapshot', () => {
    const report = formatIdentityCoverageReport({
      generatedAtIso: '2026-08-02T12:00:00.000Z',
      history: [snapshotAt('2026-08-02T10:00:00.000Z', 1, 0)],
    });

    expect(report).not.toContain('## Delta');
  });
});

// The first real snapshot (2026-08-02) reported every space as "(unnamed)",
// because the tool read `space.name` while the shared `Space` type — and what
// desktop persists — calls it `spaceName`. A report you cannot attribute to a
// space is a report you cannot act on, so this is pinned in both directions.
describe('space naming', () => {
  it('reads the spaceName field the app actually writes', () => {
    const result = buildIdentityCoverageSnapshot({
      spaces: [{ spaceId: 's1', spaceName: 'Quorum Test 2' }],
      members: [],
      messages: [],
      conversations: [],
      ownAddress: 'QmSelf',
      takenAt: '2026-08-02T00:00:00.000Z',
    });
    expect(result.spaces[0].spaceName).toBe('Quorum Test 2');
  });

  it('still falls back to a legacy `name` field', () => {
    const result = buildIdentityCoverageSnapshot({
      spaces: [{ spaceId: 's1', name: 'Legacy Space' }],
      members: [],
      messages: [],
      conversations: [],
      ownAddress: 'QmSelf',
      takenAt: '2026-08-02T00:00:00.000Z',
    });
    expect(result.spaces[0].spaceName).toBe('Legacy Space');
  });

  it('prefers spaceName when a row somehow carries both', () => {
    const result = buildIdentityCoverageSnapshot({
      spaces: [{ spaceId: 's1', spaceName: 'Current', name: 'Stale' }],
      members: [],
      messages: [],
      conversations: [],
      ownAddress: 'QmSelf',
      takenAt: '2026-08-02T00:00:00.000Z',
    });
    expect(result.spaces[0].spaceName).toBe('Current');
  });

  it('says (unnamed) rather than throwing when neither is present', () => {
    const result = buildIdentityCoverageSnapshot({
      spaces: [{ spaceId: 's1' }],
      members: [],
      messages: [],
      conversations: [],
      ownAddress: 'QmSelf',
      takenAt: '2026-08-02T00:00:00.000Z',
    });
    expect(result.spaces[0].spaceName).toBe('(unnamed)');
  });
});
