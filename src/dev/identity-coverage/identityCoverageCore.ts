/**
 * Identity Coverage — pure core logic.
 *
 * The instrument for Step 4 of
 * `.agents/tasks/2026-08-01-identity-announce-cadence-research.md`: one number
 * you can read before and after an identity fix, instead of taking anyone's
 * word for it. Every change in that task exists to move this number down.
 *
 * No DOM, no IndexedDB, no network, no clock. Plain rows in, plain data out, so
 * the whole classification is unit-testable without a browser. IndexedDB reads
 * live in `identityCoverageDb.ts`; the page that wires it together is
 * `IdentityCoverage.tsx`. Same three-way split as `dm-doctor/`.
 *
 * ## What this counts, and why not what the console probe counted
 *
 * Ports the questions encoded in the checked-in probes
 * `.agents/tools/dm-debug/06-space-member-sources.js` and `05-profile-sources.js`,
 * with one correction. Those scripts predate the two-slot identity model, so
 * they read only the per-space OVERRIDE slot (`display_name` / `user_icon`).
 * The follow-global work deliberately leaves that slot empty for members who
 * have not set a per-space name, so "override slot is empty" no longer means
 * "renders as an address" — the GLOBAL slot (`global_display_name` /
 * `global_user_icon`) may still carry a perfectly good identity.
 *
 * What this module counts instead is "lands on the last rung of the precedence
 * ladder", which is the thing the operator actually sees on screen:
 *
 *     per-space override → QNS `.q` → global display name → truncated address
 *                                                            ^^^^^^^^^^^^^^^^
 *
 * The ladder itself is `resolveDisplayName` in quorum-shared (via
 * `src/utils/resolveMemberName.ts`). Only the last two rungs are decidable from
 * local storage: QNS `primary_username` is not a field of a stored member row,
 * it arrives with the public profile. So the local count is deliberately the
 * pessimistic one, and the optional public-profile probe (see
 * `summarisePublicProfileProbe`) splits it into "a render-time fetch could
 * still save this" versus "no source anywhere".
 *
 * ## Two figures, never merged
 *
 * `sendersWithNoRow` and `rowsNoIdentity` are reported separately because they
 * have different causes and different fixes: the first is a roster row that
 * never arrived (a join/sync transport gap), the second is a row that arrived
 * carrying nothing (an announce/digest gap). Collapsing them into one number
 * would hide which of the two a change actually moved.
 */

import {
  isPlaceholderDisplayName,
  isPlaceholderIcon,
} from '../../utils/identityPlaceholder';

// ---------------------------------------------------------------------------
// Row shapes — the minimal slice of each store this module reads
// ---------------------------------------------------------------------------

/** Minimal shape of a `space_members` row. Mirrors `SpaceMemberRow` in
 *  `src/db/messages.ts`; only the identity-bearing fields are needed here. */
export interface SpaceMemberIdentityRow {
  spaceId: string;
  user_address: string;
  /** Per-space OVERRIDE slot. */
  display_name?: string;
  user_icon?: string;
  /** GLOBAL slot (two-slot model). */
  global_display_name?: string;
  global_user_icon?: string;
  isKicked?: boolean;
}

/** Minimal shape of a `messages` row — just enough to attribute a sender. */
export interface IdentityMessageRow {
  spaceId: string;
  content?: { senderId?: string | null } | null;
}

/** Minimal shape of a `spaces` row, for naming the per-space breakdown. */
export interface IdentitySpaceRow {
  spaceId: string;
  /**
   * The shared `Space` type calls this `spaceName`, and that is what desktop
   * actually persists. `name` is kept as a fallback only because reading the
   * wrong one of the two is exactly how every space in the first real snapshot
   * came back as "(unnamed)" — a report you cannot act on, because you cannot
   * tell which space the bad numbers belong to.
   */
  spaceName?: string;
  name?: string;
}

/** Minimal shape of a `conversations` row. */
export interface DirectConversationIdentityRow {
  conversationId: string;
  type: 'direct' | 'group';
  address: string;
  displayName?: string;
  icon?: string;
}

// ---------------------------------------------------------------------------
// The two predicates everything else is built on
// ---------------------------------------------------------------------------

/**
 * True when a stored display name would actually render as a name.
 *
 * Mirrors the render path exactly, in both of its steps: the app demotes the
 * locale-aware `'Unknown User'` placeholder via `realDisplayNameOrUndefined`,
 * and then quorum-shared's `resolveDisplayName` applies a trim-and-length
 * check before accepting it. A count that skipped either step would disagree
 * with the screen, which would make it worthless as a measurement.
 */
export function hasRealName(value?: string | null): boolean {
  if (isPlaceholderDisplayName(value)) return false;
  return (value ?? '').trim().length > 0;
}

/**
 * True when a stored avatar would actually render as an avatar.
 *
 * Mirrors `realIconOrUndefined` — empty or the default placeholder image means
 * `UserAvatar` degrades to address-derived initials.
 */
export function hasRealIcon(value?: string | null): boolean {
  return !isPlaceholderIcon(value);
}

// ---------------------------------------------------------------------------
// Per-row classification
// ---------------------------------------------------------------------------

/** Which of the two local slots supplied a value. */
export type IdentitySlot = 'override' | 'global';

export interface MemberIdentityVerdict {
  address: string;
  /** Slot that supplied a real name, or null. Override wins, per the ladder. */
  nameFrom: IdentitySlot | null;
  /** Slot that supplied a real avatar, or null. */
  iconFrom: IdentitySlot | null;
  /** The row renders as a truncated address rather than a name. */
  noName: boolean;
  /** The row renders address-derived initials rather than an avatar. */
  noIcon: boolean;
  /** THE headline predicate: no name AND no avatar, from either slot. */
  noIdentity: boolean;
  /** Excluded from every headline count — a kicked member rendering as an
   *  address is not a coverage failure. Reported so the exclusion is visible. */
  isKicked: boolean;
}

/**
 * Classify one `space_members` row against both identity slots.
 *
 * Note the asymmetry with the render ladder: the override slot beats the global
 * slot for BOTH name and avatar, but a row can legitimately draw its name from
 * one slot and its avatar from the other (e.g. a per-space nickname with no
 * per-space picture). `nameFrom` and `iconFrom` are therefore resolved
 * independently rather than picking one winning slot for the whole row.
 */
export function classifyMemberIdentity(
  row: SpaceMemberIdentityRow
): MemberIdentityVerdict {
  const nameFrom: IdentitySlot | null = hasRealName(row.display_name)
    ? 'override'
    : hasRealName(row.global_display_name)
      ? 'global'
      : null;

  const iconFrom: IdentitySlot | null = hasRealIcon(row.user_icon)
    ? 'override'
    : hasRealIcon(row.global_user_icon)
      ? 'global'
      : null;

  return {
    address: row.user_address,
    nameFrom,
    iconFrom,
    noName: nameFrom === null,
    noIcon: iconFrom === null,
    noIdentity: nameFrom === null && iconFrom === null,
    isKicked: Boolean(row.isKicked),
  };
}

export interface DmIdentityVerdict {
  conversationId: string;
  address: string;
  noName: boolean;
  noIcon: boolean;
  noIdentity: boolean;
  /** A `direct` row keyed by the account's own address — the ghost-conversation
   *  artifact `dm-doctor` also flags. Excluded from headline counts. */
  isSelf: boolean;
}

/** Classify one `direct` conversation row. A DM row has only one identity slot
 *  (`displayName` / `icon`) — there is no global slot on the DM side. */
export function classifyDmIdentity(
  row: DirectConversationIdentityRow,
  ownAddress: string | null | undefined
): DmIdentityVerdict {
  const noName = !hasRealName(row.displayName);
  const noIcon = !hasRealIcon(row.icon);
  return {
    conversationId: row.conversationId,
    address: row.address,
    noName,
    noIcon,
    noIdentity: noName && noIcon,
    isSelf: Boolean(
      ownAddress &&
        (row.address === ownAddress || row.conversationId === ownAddress)
    ),
  };
}

// ---------------------------------------------------------------------------
// Senders with no member row at all (bucket A)
// ---------------------------------------------------------------------------

export interface MissingSenderRow {
  address: string;
  messageCount: number;
  /** The account's own address. Excluded from the headline count: "no member
   *  row for yourself" is a different and much rarer defect, and letting it sit
   *  in the coverage number would add a constant that no fix ever moves. */
  isSelf: boolean;
}

// ---------------------------------------------------------------------------
// Per-space aggregation
// ---------------------------------------------------------------------------

export interface SpaceCoverage {
  spaceId: string;
  spaceName: string;
  /** Distinct senders observed in this space's messages, self included. */
  distinctSenders: number;
  /** Senders with no `space_members` row at all. Excludes self. */
  sendersWithNoRow: number;
  /** True when the account's own address is among the senders with no row. */
  selfMissingRow: boolean;
  /** `space_members` rows for this space, excluding kicked members. */
  memberRows: number;
  kickedRows: number;
  /** Rows present but carrying no identity in either slot. */
  rowsNoIdentity: number;
  rowsNoName: number;
  rowsNoIcon: number;
  /**
   * People in this space who cannot render as anything but an address:
   * `sendersWithNoRow + rowsNoIdentity`. The two sets are disjoint by
   * construction — a sender with no row has no row to classify, and a
   * classified row is by definition not missing — so the sum double-counts
   * nobody.
   */
  noIdentityTotal: number;
  missingSenders: MissingSenderRow[];
  rowsWithoutIdentity: MemberIdentityVerdict[];
}

/**
 * Build the coverage picture for one space.
 *
 * `messages` is the WHOLE store, not a pre-filtered slice: space traffic is
 * filed under `spaceId`, so filtering happens here and DM rows (filed under a
 * peer address) simply never match.
 */
export function computeSpaceCoverage(
  space: IdentitySpaceRow,
  members: SpaceMemberIdentityRow[],
  messages: IdentityMessageRow[],
  ownAddress: string | null | undefined
): SpaceCoverage {
  const scopedMembers = members.filter((m) => m.spaceId === space.spaceId);
  const memberAddresses = new Set(scopedMembers.map((m) => m.user_address));

  const senderCounts = new Map<string, number>();
  for (const message of messages) {
    if (message.spaceId !== space.spaceId) continue;
    const senderId = message.content?.senderId;
    if (!senderId) continue;
    senderCounts.set(senderId, (senderCounts.get(senderId) ?? 0) + 1);
  }

  const missingSenders: MissingSenderRow[] = [];
  for (const [address, messageCount] of senderCounts.entries()) {
    if (memberAddresses.has(address)) continue;
    missingSenders.push({
      address,
      messageCount,
      isSelf: Boolean(ownAddress) && address === ownAddress,
    });
  }
  missingSenders.sort((a, b) => b.messageCount - a.messageCount);

  const verdicts = scopedMembers.map(classifyMemberIdentity);
  const live = verdicts.filter((v) => !v.isKicked);
  const rowsWithoutIdentity = live.filter((v) => v.noIdentity);

  const sendersWithNoRow = missingSenders.filter((s) => !s.isSelf).length;
  const rowsNoIdentity = rowsWithoutIdentity.length;

  return {
    spaceId: space.spaceId,
    spaceName: space.spaceName?.trim() || space.name?.trim() || '(unnamed)',
    distinctSenders: senderCounts.size,
    sendersWithNoRow,
    selfMissingRow: missingSenders.some((s) => s.isSelf),
    memberRows: live.length,
    kickedRows: verdicts.length - live.length,
    rowsNoIdentity,
    rowsNoName: live.filter((v) => v.noName).length,
    rowsNoIcon: live.filter((v) => v.noIcon).length,
    noIdentityTotal: sendersWithNoRow + rowsNoIdentity,
    missingSenders,
    rowsWithoutIdentity,
  };
}

// ---------------------------------------------------------------------------
// DM aggregation
// ---------------------------------------------------------------------------

export interface DmCoverage {
  /** `type: 'direct'` rows, excluding any keyed by the account's own address. */
  directRows: number;
  selfRows: number;
  rowsNoIdentity: number;
  rowsNoName: number;
  rowsNoIcon: number;
  rowsWithoutIdentity: DmIdentityVerdict[];
}

export function computeDmCoverage(
  conversations: DirectConversationIdentityRow[],
  ownAddress: string | null | undefined
): DmCoverage {
  const verdicts = conversations
    .filter((c) => c.type === 'direct')
    .map((c) => classifyDmIdentity(c, ownAddress));

  const live = verdicts.filter((v) => !v.isSelf);
  const rowsWithoutIdentity = live.filter((v) => v.noIdentity);

  return {
    directRows: live.length,
    selfRows: verdicts.length - live.length,
    rowsNoIdentity: rowsWithoutIdentity.length,
    rowsNoName: live.filter((v) => v.noName).length,
    rowsNoIcon: live.filter((v) => v.noIcon).length,
    rowsWithoutIdentity,
  };
}

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

export interface CoverageTotals {
  distinctSenders: number;
  sendersWithNoRow: number;
  memberRows: number;
  rowsNoIdentity: number;
  rowsNoName: number;
  rowsNoIcon: number;
  /** `sendersWithNoRow + rowsNoIdentity` across every space. THE headline. */
  noIdentityTotal: number;
}

export interface IdentityCoverageSnapshot {
  /** ISO timestamp of the IndexedDB read this snapshot was computed from. */
  atIso: string;
  ownAddress: string | null;
  spaces: SpaceCoverage[];
  totals: CoverageTotals;
  dms: DmCoverage;
  /** Store sizes at read time — a snapshot computed over an empty store is not
   *  the same claim as one computed over a full one, and must not read as it. */
  messagesScanned: number;
  memberRowsScanned: number;
  conversationsScanned: number;
  /** null until the (optional, network) public-profile probe has been run. */
  publicProfile: PublicProfileProbeSummary | null;
}

export interface BuildSnapshotInput {
  atIso: string;
  ownAddress: string | null;
  spaces: IdentitySpaceRow[];
  members: SpaceMemberIdentityRow[];
  messages: IdentityMessageRow[];
  conversations: DirectConversationIdentityRow[];
}

/**
 * Assemble the full snapshot. Deterministic: the caller supplies the timestamp,
 * nothing here reads the clock.
 *
 * Spaces are ordered worst-first (highest `noIdentityTotal`), so the space that
 * needs attention is the one at the top of the table rather than whichever
 * happened to be inserted first.
 */
export function buildIdentityCoverageSnapshot(
  input: BuildSnapshotInput
): IdentityCoverageSnapshot {
  const spaces = input.spaces
    .map((space) =>
      computeSpaceCoverage(space, input.members, input.messages, input.ownAddress)
    )
    .sort(
      (a, b) =>
        b.noIdentityTotal - a.noIdentityTotal ||
        a.spaceName.localeCompare(b.spaceName)
    );

  const sum = (pick: (s: SpaceCoverage) => number): number =>
    spaces.reduce((acc, space) => acc + pick(space), 0);

  return {
    atIso: input.atIso,
    ownAddress: input.ownAddress,
    spaces,
    totals: {
      distinctSenders: sum((s) => s.distinctSenders),
      sendersWithNoRow: sum((s) => s.sendersWithNoRow),
      memberRows: sum((s) => s.memberRows),
      rowsNoIdentity: sum((s) => s.rowsNoIdentity),
      rowsNoName: sum((s) => s.rowsNoName),
      rowsNoIcon: sum((s) => s.rowsNoIcon),
      noIdentityTotal: sum((s) => s.noIdentityTotal),
    },
    dms: computeDmCoverage(input.conversations, input.ownAddress),
    messagesScanned: input.messages.length,
    memberRowsScanned: input.members.length,
    conversationsScanned: input.conversations.length,
    publicProfile: null,
  };
}

// ---------------------------------------------------------------------------
// Optional public-profile probe (the last leg of "from any source")
// ---------------------------------------------------------------------------

/**
 * One public-profile lookup result. The fetching itself lives in
 * `identityCoverageDb.ts` — this module only reclassifies.
 */
export interface PublicProfileResult {
  address: string;
  /** HTTP status, or 'error' when the request never completed. */
  status: number | 'error';
  hasName: boolean;
  hasImage: boolean;
}

export interface PublicProfileProbeSummary {
  probed: number;
  /** A render-time public-profile fetch could still put a name or avatar on
   *  screen. The local row is empty, but the user is not invisible. */
  recoverable: number;
  /** No public profile and no local identity: nothing anywhere can render
   *  these. This is the irreducible core of the problem. */
  noSource: number;
  /** Requests that failed outright — counted apart from `noSource`, because a
   *  network error is not evidence of a missing profile. */
  errors: number;
  results: PublicProfileResult[];
}

export function summarisePublicProfileProbe(
  results: PublicProfileResult[]
): PublicProfileProbeSummary {
  let recoverable = 0;
  let noSource = 0;
  let errors = 0;

  for (const result of results) {
    if (result.status === 'error') {
      errors += 1;
    } else if (result.hasName || result.hasImage) {
      recoverable += 1;
    } else {
      noSource += 1;
    }
  }

  return { probed: results.length, recoverable, noSource, errors, results };
}

// ---------------------------------------------------------------------------
// Before/after delta — the whole point of the instrument
// ---------------------------------------------------------------------------

export interface CoverageDelta {
  beforeIso: string;
  afterIso: string;
  sendersWithNoRow: number;
  rowsNoIdentity: number;
  noIdentityTotal: number;
  dmRowsNoIdentity: number;
}

/** Signed differences, after minus before. Negative is improvement. */
export function computeCoverageDelta(
  before: IdentityCoverageSnapshot,
  after: IdentityCoverageSnapshot
): CoverageDelta {
  return {
    beforeIso: before.atIso,
    afterIso: after.atIso,
    sendersWithNoRow:
      after.totals.sendersWithNoRow - before.totals.sendersWithNoRow,
    rowsNoIdentity: after.totals.rowsNoIdentity - before.totals.rowsNoIdentity,
    noIdentityTotal:
      after.totals.noIdentityTotal - before.totals.noIdentityTotal,
    dmRowsNoIdentity: after.dms.rowsNoIdentity - before.dms.rowsNoIdentity,
  };
}

/** `-4`, `+2`, `0` — sign always explicit, so a delta can never be misread as
 *  an absolute count when it is pasted into a task file. */
export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

// ---------------------------------------------------------------------------
// "Copy report" — the self-contained paste
// ---------------------------------------------------------------------------

export const IDENTITY_COVERAGE_TASK_POINTER =
  '.agents/tasks/2026-08-01-identity-announce-cadence-research.md';

/** The 2026-06-13 run on the "Quorum Test 2" space, from the task's Step 4
 *  brief. Quoted in the report so a fresh reader has something to compare a
 *  first run against without going hunting. */
export const HISTORICAL_BASELINE =
  '2026-06-13, space "Quorum Test 2": 89 distinct senders, 46 with no member row.';

function truncate(address: string): string {
  return address.length > 20
    ? `${address.slice(0, 10)}…${address.slice(-6)}`
    : address;
}

function formatSpaceSection(space: SpaceCoverage): string {
  const lines: string[] = [];
  lines.push(`### ${space.spaceName} (${truncate(space.spaceId)})`);
  lines.push(`distinct_senders: ${space.distinctSenders}`);
  lines.push(`senders_with_no_member_row: ${space.sendersWithNoRow}`);
  lines.push(`self_missing_row: ${space.selfMissingRow}`);
  lines.push(`member_rows: ${space.memberRows} (kicked, excluded: ${space.kickedRows})`);
  lines.push(`rows_no_identity: ${space.rowsNoIdentity}`);
  lines.push(`rows_no_name: ${space.rowsNoName}`);
  lines.push(`rows_no_icon: ${space.rowsNoIcon}`);
  lines.push(`no_identity_total: ${space.noIdentityTotal}`);

  lines.push('senders with no member row (address, messages):');
  if (space.missingSenders.length === 0) {
    lines.push('  none');
  } else {
    for (const sender of space.missingSenders) {
      lines.push(
        `  - ${sender.address} messages=${sender.messageCount}${sender.isSelf ? ' (SELF — excluded from count)' : ''}`
      );
    }
  }

  lines.push('rows present but carrying no identity:');
  if (space.rowsWithoutIdentity.length === 0) {
    lines.push('  none');
  } else {
    for (const row of space.rowsWithoutIdentity) {
      lines.push(`  - ${row.address}`);
    }
  }

  return lines.join('\n');
}

function formatSnapshotSection(
  snapshot: IdentityCoverageSnapshot,
  index: number,
  total: number
): string {
  const lines: string[] = [];
  lines.push(`## Snapshot ${index + 1} of ${total} — ${snapshot.atIso}`);
  lines.push('');
  lines.push('### Totals (all spaces)');
  lines.push(`senders_with_no_member_row: ${snapshot.totals.sendersWithNoRow}`);
  lines.push(`rows_no_identity: ${snapshot.totals.rowsNoIdentity}`);
  lines.push(`NO_IDENTITY_TOTAL: ${snapshot.totals.noIdentityTotal}`);
  lines.push(`distinct_senders: ${snapshot.totals.distinctSenders}`);
  lines.push(`member_rows: ${snapshot.totals.memberRows}`);
  lines.push(`rows_no_name: ${snapshot.totals.rowsNoName}`);
  lines.push(`rows_no_icon: ${snapshot.totals.rowsNoIcon}`);
  lines.push('');
  lines.push('### DMs');
  lines.push(`direct_rows: ${snapshot.dms.directRows} (self-keyed, excluded: ${snapshot.dms.selfRows})`);
  lines.push(`rows_no_identity: ${snapshot.dms.rowsNoIdentity}`);
  lines.push(`rows_no_name: ${snapshot.dms.rowsNoName}`);
  lines.push(`rows_no_icon: ${snapshot.dms.rowsNoIcon}`);
  if (snapshot.dms.rowsWithoutIdentity.length) {
    lines.push('direct rows carrying no identity:');
    for (const row of snapshot.dms.rowsWithoutIdentity) {
      lines.push(`  - ${row.address} conversationId=${row.conversationId}`);
    }
  }
  lines.push('');
  lines.push('### Store sizes at read time');
  lines.push(`messages_rows: ${snapshot.messagesScanned}`);
  lines.push(`space_members_rows: ${snapshot.memberRowsScanned}`);
  lines.push(`conversations_rows: ${snapshot.conversationsScanned}`);
  lines.push('');
  lines.push('### Public-profile probe');
  if (snapshot.publicProfile === null) {
    lines.push('not run (local-only counts above)');
  } else {
    const probe = snapshot.publicProfile;
    lines.push(`probed: ${probe.probed}`);
    lines.push(`recoverable_from_public_profile: ${probe.recoverable}`);
    lines.push(`no_source_anywhere: ${probe.noSource}`);
    lines.push(`fetch_errors: ${probe.errors}`);
  }
  lines.push('');
  lines.push('### Per space (worst first)');
  if (snapshot.spaces.length === 0) {
    lines.push('no spaces in the local database');
  } else {
    for (const space of snapshot.spaces) {
      lines.push(formatSpaceSection(space));
      lines.push('');
    }
  }

  return lines.join('\n');
}

export interface CoverageReportInput {
  generatedAtIso: string;
  /** Newest last. */
  history: IdentityCoverageSnapshot[];
}

/**
 * Build the complete "Copy report" markdown paste: every snapshot taken this
 * session, the before/after delta when there is more than one, and the
 * historical baseline to compare a first run against — so a fresh reader needs
 * no follow-up questions.
 *
 * Pure and deterministic: every timestamp comes from the caller.
 */
export function formatIdentityCoverageReport(
  input: CoverageReportInput
): string {
  const sections: string[] = [];
  const { history } = input;

  sections.push(`# Identity coverage report — ${input.generatedAtIso}`);
  sections.push(`task: ${IDENTITY_COVERAGE_TASK_POINTER}`);
  sections.push(`historical baseline: ${HISTORICAL_BASELINE}`);
  sections.push('');
  sections.push(
    'Counts are read straight from IndexedDB, so they measure what PERSISTED, ' +
      'not what rendered once from an in-memory fallback.'
  );
  sections.push('');

  if (history.length === 0) {
    sections.push('No snapshots taken this session.');
    return sections.join('\n');
  }

  if (history.length >= 2) {
    const delta = computeCoverageDelta(history[0], history[history.length - 1]);
    sections.push('## Delta — first snapshot to last (negative is improvement)');
    sections.push(`from: ${delta.beforeIso}`);
    sections.push(`to:   ${delta.afterIso}`);
    sections.push(
      `senders_with_no_member_row: ${formatSigned(delta.sendersWithNoRow)}`
    );
    sections.push(`rows_no_identity: ${formatSigned(delta.rowsNoIdentity)}`);
    sections.push(`NO_IDENTITY_TOTAL: ${formatSigned(delta.noIdentityTotal)}`);
    sections.push(`dm_rows_no_identity: ${formatSigned(delta.dmRowsNoIdentity)}`);
    sections.push('');
  }

  history.forEach((snapshot, index) => {
    sections.push(formatSnapshotSection(snapshot, index, history.length));
    sections.push('');
  });

  return sections.join('\n');
}
