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
 * `.agents/bugs/2026-07-29-stale-returning-device-dm-sends-vanish-and-misfile.md`.
 */

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

export interface ScanResult {
  landed: number;
  missing: number[];
  duplicates: number;
  hits: ScanHit[];
  byConversation: Record<string, number>;
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
 * `.agents/tools/dm-debug/07-receiver-probe.js` exactly.
 */
export function scanSequence(
  messages: DmDoctorMessageRow[],
  prefix: string,
  expected: number,
  ownAddress: string | null | undefined
): ScanResult {
  const re = new RegExp('^\\s*' + escapeRegExp(prefix) + '\\s*(\\d+)\\s*$', 'i');
  const hits: ScanHit[] = [];

  for (const message of messages) {
    const raw = message?.content?.text;
    const texts = Array.isArray(raw) ? raw : [raw];
    for (const text of texts) {
      if (typeof text !== 'string') continue;
      const match = re.exec(text);
      if (!match) continue;
      hits.push({
        n: Number(match[1]),
        spaceId: message.spaceId,
        misfiled: Boolean(ownAddress) && message.spaceId === ownAddress,
        createdDate: message.createdDate ?? 0,
      });
    }
  }

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

  return {
    landed,
    missing,
    duplicates: hits.length - landed,
    hits,
    byConversation,
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

/**
 * Format a scan result as a markdown table row matching the convention of
 * `.agents/docs/transport-measurements.md`
 * (`| when | run | configuration | class | result | what it changed | source |`).
 * Always reports class "persistence" — a store scan reads what the app kept,
 * not what arrived on the wire or decrypted.
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
