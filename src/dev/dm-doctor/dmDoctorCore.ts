/**
 * DM Doctor — pure core logic.
 *
 * No DOM, no IndexedDB, no window/console access. Everything here takes plain
 * data in and returns plain data out, so it is fully unit-testable without a
 * browser environment. IndexedDB reads live in `dmDoctorDb.ts`; the console-wrap
 * warning counters live in `warningCounters.ts`; the page that wires it all
 * together is `DmDoctor.tsx`.
 *
 * This ports the matching logic of the checked-in console probe
 * (`.agents/tools/dm-debug/07-receiver-probe.js`) so the same numbers a manual
 * probe run would produce come out of the resident dev panel, plus the two
 * misfiling/ghost-conversation checks from
 * `transport/2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md` under .agents/issues/.
 *
 * Also formats the "Copy full report" clipboard block: a self-contained
 * markdown paste designed for a fresh agent to read with no follow-up
 * questions. See `formatFullReport` at the bottom of this file.
 */

import type { DmWarningCounterState, DmWarningKey } from './warningCounters';

/** Minimal shape of a `messages` store row this module needs to read. */
export interface DmDoctorMessageRow {
  spaceId: string;
  channelId?: string;
  createdDate?: number;
  content?: {
    text?: string | string[] | null;
  } | null;
}

/** Minimal shape of a `conversations` store row this module needs to read. */
export interface DmDoctorConversationRow {
  conversationId: string;
  type: 'direct' | 'group';
  address: string;
  displayName?: string;
  lastMessageId?: string;
  /** `conversations.timestamp` per `.agents/docs/quorum-db-schema.md`. */
  timestamp?: number;
}

/** One matched sequence number, with where it was filed. */
export interface ScanHit {
  n: number;
  spaceId: string;
  /** true when this hit's spaceId equals the account's own address — a DM's
   *  conversation home must be the PEER's address, never the account's own. */
  misfiled: boolean;
  createdDate: number;
}

/**
 * Which time window a scan was restricted to. Prefix letters get reused
 * across test rounds (run "V 1..20" today, "V 1..20" next month), and a
 * store-wide scan with no time bound would silently merge both runs into one
 * "20/20 landed" — masking real loss in the newer run. `startMs` is the
 * caller-computed epoch-ms cutoff (see `computeScanWindowStart`); hits with
 * `createdDate` before it are excluded from landed/missing/duplicates/misfiled
 * but never discarded from the report — see `ScanWindowInfo`.
 */
export type ScanWindowOption = 'since-load' | '1h' | '6h' | '24h' | 'all';

export const SCAN_WINDOW_LABELS: Record<ScanWindowOption, string> = {
  'since-load': 'since page load',
  '1h': 'last 1h',
  '6h': 'last 6h',
  '24h': 'last 24h',
  all: 'all time',
};

export interface ScanWindowParam {
  option: ScanWindowOption;
  /** Epoch-ms cutoff computed by the caller; null means no cutoff (all time). */
  startMs: number | null;
}

/**
 * Compute the epoch-ms cutoff for a window option. Pure — the caller supplies
 * "now" and the page-load time so this stays deterministic and testable.
 */
export function computeScanWindowStart(
  option: ScanWindowOption,
  nowMs: number,
  pageLoadMs: number | null
): number | null {
  switch (option) {
    case 'since-load':
      return pageLoadMs;
    case '1h':
      return nowMs - 60 * 60 * 1000;
    case '6h':
      return nowMs - 6 * 60 * 60 * 1000;
    case '24h':
      return nowMs - 24 * 60 * 60 * 1000;
    case 'all':
      return null;
    default:
      return null;
  }
}

/** A span longer than this for an in-window burst means the window probably
 *  caught more than one run — flagged, not silently reported. */
const SPAN_SUSPICIOUS_SECONDS = 30 * 60;

export interface ScanWindowInfo {
  option: ScanWindowOption;
  startMs: number | null;
  /** Matches whose createdDate falls before `startMs` — excluded from
   *  landed/missing/duplicates/misfiled, but always counted, never dropped. */
  matchesOutsideWindow: number;
  outsideOldestMs: number | null;
  outsideNewestMs: number | null;
  /** First/last in-window hit, and the span between them. */
  firstHitMs: number | null;
  lastHitMs: number | null;
  spanSeconds: number | null;
  spanSuspicious: boolean;
}

export interface ScanResult {
  landed: number;
  missing: number[];
  duplicates: number;
  /** In-window hits only. */
  hits: ScanHit[];
  /** In-window hits only. */
  byConversation: Record<string, number>;
  window: ScanWindowInfo;
}

/** Escape a string for safe use inside a RegExp — the prefix is user input. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan every message row's text (`^\s*<prefix>\s*(\d+)\s*$`, case-insensitive)
 * for the numbered-burst pattern the manual test rounds send (e.g. "V 1" …
 * "V 20"), across the WHOLE messages store — not scoped to any one
 * conversation, so misfiled rows still get counted. Mirrors
 * `.agents/tools/dm-debug/07-receiver-probe.js` exactly, then restricts the
 * counted set to `window` (default: no restriction, matching the probe).
 */
export function scanSequence(
  messages: DmDoctorMessageRow[],
  prefix: string,
  expected: number,
  ownAddress: string | null | undefined,
  window: ScanWindowParam = { option: 'all', startMs: null }
): ScanResult {
  const re = new RegExp('^\\s*' + escapeRegExp(prefix) + '\\s*(\\d+)\\s*$', 'i');
  const allHits: ScanHit[] = [];

  for (const message of messages) {
    const raw = message?.content?.text;
    const texts = Array.isArray(raw) ? raw : [raw];
    for (const text of texts) {
      if (typeof text !== 'string') continue;
      const match = re.exec(text);
      if (!match) continue;
      allHits.push({
        n: Number(match[1]),
        spaceId: message.spaceId,
        misfiled: Boolean(ownAddress) && message.spaceId === ownAddress,
        createdDate: message.createdDate ?? 0,
      });
    }
  }

  const startMs = window.startMs;
  const inWindow = (hit: ScanHit) => startMs === null || hit.createdDate >= startMs;
  const hits = allHits.filter(inWindow);
  const outsideHits = allHits.filter((hit) => !inWindow(hit));

  const seen = new Set<number>();
  for (const hit of hits) seen.add(hit.n);
  const landed = seen.size;

  const missing: number[] = [];
  for (let i = 1; i <= expected; i++) {
    if (!seen.has(i)) missing.push(i);
  }

  const byConversation: Record<string, number> = {};
  for (const hit of hits) {
    byConversation[hit.spaceId] = (byConversation[hit.spaceId] ?? 0) + 1;
  }

  const hitDates = hits.map((h) => h.createdDate);
  const firstHitMs = hitDates.length ? Math.min(...hitDates) : null;
  const lastHitMs = hitDates.length ? Math.max(...hitDates) : null;
  const spanSeconds =
    firstHitMs !== null && lastHitMs !== null ? (lastHitMs - firstHitMs) / 1000 : null;

  const outsideDates = outsideHits.map((h) => h.createdDate);
  const outsideOldestMs = outsideDates.length ? Math.min(...outsideDates) : null;
  const outsideNewestMs = outsideDates.length ? Math.max(...outsideDates) : null;

  return {
    landed,
    missing,
    duplicates: hits.length - landed,
    hits,
    byConversation,
    window: {
      option: window.option,
      startMs,
      matchesOutsideWindow: outsideHits.length,
      outsideOldestMs,
      outsideNewestMs,
      firstHitMs,
      lastHitMs,
      spanSeconds,
      spanSuspicious: spanSeconds !== null && spanSeconds > SPAN_SUSPICIOUS_SECONDS,
    },
  };
}

export type GhostReason = 'self-address' | 'duplicate-peer';

export interface GhostConversationRow {
  conversationId: string;
  address: string;
  displayName: string;
  lastMessageId?: string;
  reasons: GhostReason[];
}

/**
 * Find conversation rows that are the ghost-conversation artifact described in
 * bugs/2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md:
 *
 * - a `direct` row keyed by the account's OWN address (or conversationId) —
 *   a DM conversation must be keyed by the peer, never by the account itself.
 * - a `direct` row that shares its `address` with another `direct` row — two
 *   rows for what should be one peer (a second observed artifact).
 *
 * A row can carry both reasons; it appears once in the result either way.
 *
 * ⚠️ This is a FLAGGED SUMMARY, not the authoritative view — a detector that
 * only ever prints its own positives is unfalsifiable in the field (a real
 * desktop showed a suspicious "Unknown User" sidebar row this function did
 * not flag). For the unconditional listing every direct row is judged
 * against, see `buildDirectConversationInventory` below.
 */
export function findGhostConversations(
  conversations: DmDoctorConversationRow[],
  ownAddress: string | null | undefined
): GhostConversationRow[] {
  const direct = conversations.filter((c) => c.type === 'direct');
  const byId = new Map<string, GhostConversationRow>();

  const flag = (row: DmDoctorConversationRow, reason: GhostReason) => {
    const existing = byId.get(row.conversationId);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    byId.set(row.conversationId, {
      conversationId: row.conversationId,
      address: row.address,
      displayName: row.displayName ?? '',
      lastMessageId: row.lastMessageId,
      reasons: [reason],
    });
  };

  if (ownAddress) {
    for (const row of direct) {
      if (row.address === ownAddress || row.conversationId === ownAddress) {
        flag(row, 'self-address');
      }
    }
  }

  const byAddress = new Map<string, DmDoctorConversationRow[]>();
  for (const row of direct) {
    const list = byAddress.get(row.address);
    if (list) {
      list.push(row);
    } else {
      byAddress.set(row.address, [row]);
    }
  }
  for (const rows of byAddress.values()) {
    if (rows.length < 2) continue;
    for (const row of rows) flag(row, 'duplicate-peer');
  }

  return [...byId.values()];
}

/** Flags `buildDirectConversationInventory` can attach to a row. `NO-PROFILE`
 *  is deliberately not implemented: nothing in `DmDoctorConversationRow` lets
 *  it be checked without a network call, and the brief for this tool is
 *  explicit that a cheap-or-skip rule applies. */
export type InventoryFlag =
  | 'SELF'
  | 'DUPLICATE-PEER'
  | 'NO-DISPLAY-NAME'
  | 'EMPTY'
  | 'ORPHAN-KEY';

export interface DirectConversationInventoryRow {
  /** The conversations-store `conversationId` for a real row; for an
   *  `ORPHAN-KEY` row (a messages-store spaceId with no matching conversation
   *  row) this is that raw spaceId instead. */
  conversationId: string;
  address: string;
  /** '(none)' when absent or blank — never silently omitted. */
  displayName: string;
  /** '(none)' when absent. */
  lastMessageId: string;
  /** `conversations.timestamp`; null when absent (always null for orphan rows). */
  timestamp: number | null;
  /** Rows in the messages store whose spaceId equals this row's address. */
  messageCount: number;
  flags: InventoryFlag[];
}

export interface DirectConversationInventory {
  /** Real `type: 'direct'` conversation rows, followed by any `ORPHAN-KEY`
   *  rows (messages-store keys with no matching conversation row). */
  rows: DirectConversationInventoryRow[];
  /** Count of real conversation rows only — excludes orphan entries, so
   *  "none suspicious" can be told apart from "none read". */
  totalDirectRows: number;
}

/**
 * The authoritative, unconditional inventory of every `type: 'direct'`
 * conversation row, plus any orphan messages-store keys. Unlike
 * `findGhostConversations` (which only ever emits its own positives and is
 * therefore unfalsifiable — a row it doesn't flag looks identical to a row it
 * never saw), this lists every row so a reader can judge for themselves.
 */
export function buildDirectConversationInventory(
  conversations: DmDoctorConversationRow[],
  messages: DmDoctorMessageRow[],
  ownAddress: string | null | undefined
): DirectConversationInventory {
  const direct = conversations.filter((c) => c.type === 'direct');

  const countBySpaceId = new Map<string, number>();
  for (const message of messages) {
    countBySpaceId.set(message.spaceId, (countBySpaceId.get(message.spaceId) ?? 0) + 1);
  }

  const rowsPerAddress = new Map<string, number>();
  for (const row of direct) {
    rowsPerAddress.set(row.address, (rowsPerAddress.get(row.address) ?? 0) + 1);
  }

  const rows: DirectConversationInventoryRow[] = direct.map((row) => {
    const flags: InventoryFlag[] = [];
    if (ownAddress && (row.address === ownAddress || row.conversationId === ownAddress)) {
      flags.push('SELF');
    }
    if ((rowsPerAddress.get(row.address) ?? 0) > 1) {
      flags.push('DUPLICATE-PEER');
    }
    const hasDisplayName = Boolean(row.displayName && row.displayName.trim());
    if (!hasDisplayName) {
      flags.push('NO-DISPLAY-NAME');
    }
    const messageCount = countBySpaceId.get(row.address) ?? 0;
    if (messageCount === 0) {
      flags.push('EMPTY');
    }
    return {
      conversationId: row.conversationId,
      address: row.address,
      displayName: hasDisplayName ? (row.displayName as string) : '(none)',
      lastMessageId: row.lastMessageId ?? '(none)',
      timestamp: row.timestamp ?? null,
      messageCount,
      flags,
    };
  });

  // Orphan detection must check against EVERY conversation row, not just
  // `direct` ones: the `messages` store holds space/channel traffic too (same
  // store, distinguished by spaceId/channelId), so scoping this to `direct`
  // addresses alone would flag every ordinary space channel as an "orphan DM"
  // and flood the report with false positives. A key counts as known if it
  // matches a group or direct row's `address`, or the first segment of a
  // `conversationId` (spaces are keyed "spaceId/channelId" per
  // .agents/docs/quorum-db-schema.md, so that first segment is the spaceId
  // messages in that space are actually filed under).
  const knownKeys = new Set<string>();
  for (const row of conversations) {
    if (row.address) knownKeys.add(row.address);
    const firstSegment = row.conversationId.split('/')[0];
    if (firstSegment) knownKeys.add(firstSegment);
  }
  const orphanRows: DirectConversationInventoryRow[] = [];
  for (const [spaceId, count] of countBySpaceId.entries()) {
    if (knownKeys.has(spaceId)) continue;
    orphanRows.push({
      conversationId: spaceId,
      address: spaceId,
      displayName: '(none)',
      lastMessageId: '(none)',
      timestamp: null,
      messageCount: count,
      flags: ['ORPHAN-KEY'],
    });
  }
  orphanRows.sort((a, b) => a.conversationId.localeCompare(b.conversationId));

  return {
    rows: [...rows, ...orphanRows],
    totalDirectRows: direct.length,
  };
}

/** Inputs supplied by the caller — the parts a `ScanResult` cannot know. */
export interface MeasurementRowMeta {
  when: string;
  run: string;
  configuration: string;
  /** The expected count the scan was run against (for the "landed/expected" cell). */
  expected: number;
  whatItChanged?: string;
  source?: string;
}

function msToIso(ms: number | null): string {
  return ms === null ? 'n/a' : new Date(ms).toISOString();
}

/**
 * Format a scan result as a markdown table row matching the convention of
 * `.agents/docs/transport-measurements.md`
 * (`| when | run | configuration | class | result | what it changed | source |`).
 * Always reports class "persistence" — a store scan reads what the app kept,
 * not what arrived on the wire or decrypted. The window a scan was restricted
 * to is part of the result cell: a landed/missing count is not reproducible
 * without knowing what time range it was computed over.
 */
export function formatMeasurementRow(
  scanResult: ScanResult,
  meta: MeasurementRowMeta
): string {
  const misfiledCount = scanResult.hits.filter((hit) => hit.misfiled).length;

  const resultParts = [`${scanResult.landed}/${meta.expected} landed`];
  if (scanResult.missing.length) {
    resultParts.push(`missing [${scanResult.missing.join(', ')}]`);
  } else {
    resultParts.push('none missing');
  }
  if (scanResult.duplicates) {
    resultParts.push(`duplicates ${scanResult.duplicates}`);
  }
  if (misfiledCount) {
    resultParts.push(`${misfiledCount} misfiled (ghost self-conversation)`);
  }
  resultParts.push(`window ${SCAN_WINDOW_LABELS[scanResult.window.option]}`);
  if (scanResult.window.matchesOutsideWindow) {
    resultParts.push(
      `${scanResult.window.matchesOutsideWindow} outside window (oldest ${msToIso(
        scanResult.window.outsideOldestMs
      )}, newest ${msToIso(scanResult.window.outsideNewestMs)})`
    );
  }
  if (scanResult.window.spanSuspicious) {
    resultParts.push('SPAN-SUSPICIOUS (in-window burst spans over 30min — window may cover more than one run)');
  }

  const cells = [
    meta.when,
    meta.run,
    meta.configuration,
    'persistence',
    resultParts.join(', '),
    meta.whatItChanged ?? '',
    meta.source ?? '',
  ];

  return `| ${cells.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`;
}

// ---------------------------------------------------------------------------
// "Copy full report" — the self-contained paste
// ---------------------------------------------------------------------------

/** One completed scan run, kept in page state for the session so the full
 *  report can include every scan since load, not just the latest. */
export interface ScanHistoryEntry {
  id: string;
  /** ISO timestamp of the IndexedDB read this scan was computed from. */
  atIso: string;
  prefix: string;
  expected: number;
  ownAddress: string | null;
  /** `messages`/`conversations` store row counts at the time of THIS read —
   *  distinct from the report's shared-context store size, which reflects
   *  only the most recent scan. Kept per-scan too since store growth between
   *  scans in one session is itself diagnostic. */
  messagesScanned: number;
  conversationsScanned: number;
  scanResult: ScanResult;
}

export interface FullReportInput {
  generatedAtIso: string;
  ownAddress: string | null;
  pageLoadedAtIso: string | null;
  /** Newest last. */
  history: ScanHistoryEntry[];
  /** null = no scan has run yet this session (distinct from `[]`, "scanned, none found"). */
  ghosts: GhostConversationRow[] | null;
  inventory: DirectConversationInventory | null;
  warningState: DmWarningCounterState | null;
}

export const DM_DOCTOR_RUNBOOK_POINTER = 'transport/runbook.md under .agents/issues/';

function formatDistributionLines(
  scanResult: ScanResult,
  ownAddress: string | null
): string[] {
  const entries = Object.entries(scanResult.byConversation).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return ['  (no rows matched this prefix in-window)'];
  return entries.map(([spaceId, count]) => {
    const isGhost = Boolean(ownAddress) && spaceId === ownAddress;
    const tag = isGhost ? "GHOST — filed under this account's own address" : 'ok';
    return `  - ${spaceId}: ${count} (${tag})`;
  });
}

function formatScanEntry(entry: ScanHistoryEntry, index: number, total: number): string {
  const { scanResult } = entry;
  const misfiledCount = scanResult.hits.filter((hit) => hit.misfiled).length;
  const lines: string[] = [];
  lines.push(`### Scan ${index + 1} of ${total} — prefix "${entry.prefix}"`);
  lines.push(`read_at: ${entry.atIso}`);
  lines.push(`prefix: ${entry.prefix}`);
  lines.push(`expected: ${entry.expected}`);
  lines.push(
    `window: ${SCAN_WINDOW_LABELS[scanResult.window.option]} (cutoff ${msToIso(scanResult.window.startMs)})`
  );
  lines.push(`landed: ${scanResult.landed}/${entry.expected}`);
  lines.push(`missing: ${scanResult.missing.length ? `[${scanResult.missing.join(', ')}]` : 'none'}`);
  lines.push(`duplicates: ${scanResult.duplicates}`);
  lines.push(`misfiled: ${misfiledCount}`);
  lines.push(`matches_outside_window: ${scanResult.window.matchesOutsideWindow}`);
  lines.push(`outside_window_oldest: ${msToIso(scanResult.window.outsideOldestMs)}`);
  lines.push(`outside_window_newest: ${msToIso(scanResult.window.outsideNewestMs)}`);
  lines.push(`first_hit_at: ${msToIso(scanResult.window.firstHitMs)}`);
  lines.push(`last_hit_at: ${msToIso(scanResult.window.lastHitMs)}`);
  lines.push(`span_seconds: ${scanResult.window.spanSeconds === null ? 'n/a' : scanResult.window.spanSeconds}`);
  lines.push(
    `span_suspicious: ${
      scanResult.window.spanSuspicious
        ? 'true (>30min — window likely caught more than one run)'
        : 'false'
    }`
  );
  lines.push(`messages_store_rows_at_this_scan: ${entry.messagesScanned}`);
  lines.push(`conversations_store_rows_at_this_scan: ${entry.conversationsScanned}`);
  lines.push('distribution (conversation key -> matched count):');
  lines.push(...formatDistributionLines(scanResult, entry.ownAddress));
  return lines.join('\n');
}

function formatWarningsSection(state: DmWarningCounterState | null): string {
  const lines: string[] = ['## Warning counters (since counter install)'];
  lines.push(`counters_installed_at: ${state?.installedAt ?? 'not installed yet'}`);
  const keys: DmWarningKey[] = ['sessionReplaced', 'unknownInbox', 'decryptFailish'];
  for (const key of keys) {
    const count = state?.counts[key] ?? 0;
    const last = state?.lastHits[key]?.[0];
    lines.push(`${key}: count=${count} last=${last ?? 'none'}`);
  }
  return lines.join('\n');
}

function formatGhostsSection(ghosts: GhostConversationRow[] | null): string {
  const lines: string[] = ['## Ghost / duplicate conversation rows (flagged summary — see inventory below for the unconditional list)'];
  if (ghosts === null) {
    lines.push('not scanned yet');
  } else if (ghosts.length === 0) {
    lines.push('none found');
  } else {
    for (const g of ghosts) {
      lines.push(
        `- conversationId=${g.conversationId} address=${g.address} displayName=${
          g.displayName || '(none)'
        } lastMessageId=${g.lastMessageId ?? '(none)'} reasons=[${g.reasons.join(', ')}]`
      );
    }
  }
  return lines.join('\n');
}

function formatInventoryRowLine(row: DirectConversationInventoryRow): string {
  const timestamp = row.timestamp === null ? 'none' : new Date(row.timestamp).toISOString();
  return `- conversationId=${row.conversationId} address=${row.address} displayName=${row.displayName} lastMessageId=${row.lastMessageId} timestamp=${timestamp} messages=${row.messageCount} flags=[${row.flags.join(', ') || 'none'}]`;
}

function formatInventorySection(inventory: DirectConversationInventory | null): string {
  const lines: string[] = [
    '## Direct conversations inventory (authoritative — every direct row, unconditionally)',
  ];
  if (inventory === null) {
    lines.push('not scanned yet');
    return lines.join('\n');
  }
  lines.push(`total_direct_rows: ${inventory.totalDirectRows}`);
  const directRows = inventory.rows.filter((row) => !row.flags.includes('ORPHAN-KEY'));
  const orphanRows = inventory.rows.filter((row) => row.flags.includes('ORPHAN-KEY'));
  if (directRows.length === 0) {
    lines.push('(no direct conversation rows)');
  } else {
    for (const row of directRows) lines.push(formatInventoryRowLine(row));
  }
  lines.push(
    'orphan conversation keys (messages store rows filed under a key with no matching conversations row):'
  );
  if (orphanRows.length === 0) {
    lines.push('none found');
  } else {
    for (const row of orphanRows) lines.push(formatInventoryRowLine(row));
  }
  return lines.join('\n');
}

/**
 * Build the complete "Copy full report" markdown paste: one self-contained
 * block covering every scan run this session, the shared context, warning
 * counters, ghost summary, the authoritative direct-conversations inventory,
 * and every scan's measurement-log row — so a fresh agent reading one paste
 * never needs a follow-up question. Pure and deterministic: every timestamp
 * is supplied by the caller, nothing here reads the clock or the DOM.
 */
export function formatFullReport(input: FullReportInput): string {
  const sections: string[] = [];

  sections.push(`### DM doctor report — ${input.generatedAtIso}`);
  sections.push(`protocol: ${DM_DOCTOR_RUNBOOK_POINTER}`);
  sections.push('');

  sections.push('## Shared context');
  sections.push(`own_address: ${input.ownAddress ?? 'unknown (not signed in)'}`);
  sections.push(`dm_doctor_page_loaded_at: ${input.pageLoadedAtIso ?? 'unknown'}`);
  sections.push(`scans_in_history: ${input.history.length}`);
  const latest = input.history[input.history.length - 1] ?? null;
  sections.push(
    `messages_store_rows: ${
      latest ? latest.messagesScanned : 'n/a (no scan run yet)'
    } (as of the most recent scan below)`
  );
  sections.push(
    `conversations_store_rows: ${
      latest ? latest.conversationsScanned : 'n/a (no scan run yet)'
    } (as of the most recent scan below)`
  );
  sections.push('');

  sections.push(
    `## Session scan history (${input.history.length} scan${
      input.history.length === 1 ? '' : 's'
    }, oldest first)`
  );
  if (input.history.length === 0) {
    sections.push('no scans run this session');
    sections.push('');
  } else {
    input.history.forEach((entry, i) => {
      sections.push(formatScanEntry(entry, i, input.history.length));
      sections.push('');
    });
  }

  sections.push(formatWarningsSection(input.warningState));
  sections.push('');
  sections.push(formatGhostsSection(input.ghosts));
  sections.push('');
  sections.push(formatInventorySection(input.inventory));
  sections.push('');

  sections.push('## Measurement log rows (paste into .agents/docs/transport-measurements.md)');
  if (input.history.length === 0) {
    sections.push('no scans run this session');
  } else {
    for (const entry of input.history) {
      sections.push(
        formatMeasurementRow(entry.scanResult, {
          when: entry.atIso.slice(0, 10),
          run: `DM doctor scan (prefix "${entry.prefix}")`,
          configuration: entry.ownAddress ? `own=${entry.ownAddress}` : 'own address unknown',
          expected: entry.expected,
          source: 'DM doctor panel (/dev/dm-doctor)',
        })
      );
    }
  }

  return sections.join('\n');
}
