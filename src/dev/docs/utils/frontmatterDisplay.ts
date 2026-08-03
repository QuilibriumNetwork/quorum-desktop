/**
 * Frontmatter display — deciding what an issue's metadata box shows.
 *
 * The `.agents/` convention names a handful of fields, but agents write far
 * more than that: a survey of the 517 issues found ~90 distinct keys, most used
 * once (`root-cause`, `verified-by`, `spans-repos`, `is-real-root-cause-of`,
 * `surfaced-by`). Hardcoding a list of fields to render would mean every new
 * key is silently invisible until someone notices and edits this file — and
 * nobody notices, because invisible is invisible.
 *
 * So the panel renders *everything* and only decides where. Recognised fields
 * get a place and a label, relations get grouped, and the long tail falls into
 * a generic section rather than off the page. Misclassifying a rare key costs
 * nothing; dropping it costs the whole point of opening the file.
 *
 * Pure string work — no React, no I/O — so the partitioning can be tested
 * directly.
 */

/** Rendered as the page heading, so showing it again would be duplication. */
const HIDDEN_KEYS = new Set(['title']);

/**
 * Shown first, in this order.
 *
 * `status` is deliberately absent: for issues the frontmatter's copy routinely
 * contradicts the folder (26 `.done/` files still say `in-progress`), so the
 * panel takes the derived state from the file record instead. The raw field is
 * treated as noise and dropped.
 */
const PRIMARY_ORDER = [
  'type',
  'priority',
  'complexity',
  'severity',
  'area',
  'scope',
  'repo',
  'repos',
  'created',
  'updated',
  'completed',
  'ai_generated',
  'reviewed_by',
];

/** Keys whose values point at other work; grouped so links read together. */
const RELATION_KEYS = new Set([
  'depends_on',
  'depends-on',
  'blocked_by',
  'blocked-by',
  'supersedes',
  'superseded_by',
  'spans-repos',
  'parent-task',
  'builds_on',
  'builds-on',
]);

/** Acronyms mechanical capitalisation would otherwise mangle. */
const ACRONYMS = new Set(['ai', 'dm', 'ui', 'api', 'db', 'url', 'pr', 'qns', 'id']);

export interface FrontmatterField {
  key: string;
  label: string;
  value: unknown;
}

export interface FrontmatterPartition {
  primary: FrontmatterField[];
  relations: FrontmatterField[];
  other: FrontmatterField[];
}

const isRelationKey = (key: string): boolean =>
  key.startsWith('related') || RELATION_KEYS.has(key);

/** `ai_generated` → `AI generated`, `spans-repos` → `Spans repos`. */
export function formatFieldLabel(key: string): string {
  const words = key.split(/[-_\s]+/).filter(Boolean);
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    })
    .join(' ');
}

/**
 * A value as text.
 *
 * Dates arrive as ISO strings because the manifest is JSON — unquoted YAML
 * dates become `Date` objects at scan time and serialise on the way through —
 * so a bare day is pulled back out of the timestamp rather than shown as
 * `2026-08-01T00:00:00.000Z`.
 */
export function formatFieldValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatFieldValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);

  const text = String(value);
  const isoDay = text.match(/^(\d{4}-\d{2}-\d{2})T[\d:.]+Z?$/);
  return isoDay ? isoDay[1] : text;
}

/** Values that render as a list of chips rather than one string. */
export function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(formatFieldValue).filter(Boolean);
  const text = formatFieldValue(value);
  return text === '—' ? [] : [text];
}

/**
 * Split frontmatter into the three sections the panel renders. Every key ends
 * up in exactly one of them, except the ones rendered elsewhere on the page.
 */
export function partitionFrontmatter(
  frontmatter: Record<string, unknown> | undefined | null
): FrontmatterPartition {
  const result: FrontmatterPartition = { primary: [], relations: [], other: [] };
  if (!frontmatter) return result;

  const field = (key: string): FrontmatterField => ({
    key,
    label: formatFieldLabel(key),
    value: frontmatter[key],
  });

  const seen = new Set<string>(HIDDEN_KEYS);

  // The frontmatter `status` is superseded by the folder-derived state, which
  // the panel renders from the file record instead.
  seen.add('status');

  PRIMARY_ORDER.forEach((key) => {
    if (key in frontmatter && frontmatter[key] != null) {
      result.primary.push(field(key));
      seen.add(key);
    }
  });

  Object.keys(frontmatter)
    .filter((key) => !seen.has(key))
    .forEach((key) => {
      if (isRelationKey(key)) result.relations.push(field(key));
      else result.other.push(field(key));
    });

  return result;
}
