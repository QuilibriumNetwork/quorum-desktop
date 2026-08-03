/**
 * Issue taxonomy — pure folder-and-frontmatter semantics for `.agents/issues/`.
 *
 * No filesystem, no fetch, no DOM: strings in, classifications out, so the rules
 * that decide what an issue *is* can be unit-tested without a scan or a browser.
 * The Node scanner (`scanMarkdownFiles.cjs`) only walks the tree and reads YAML;
 * the hook (`useMarkdownFiles.ts`) only maps records; every judgement call about
 * meaning lives here. Same three-way split as `dm-doctor/` and
 * `identity-coverage/`.
 *
 * ## The folder is the state
 *
 * `.agents/issues/` encodes an issue's state in its location, not in a field:
 *
 *     issues/                  → in progress, being worked on right now
 *     issues/.open/            → not started, or an unfixed bug nobody is on
 *     issues/.deferred/        → consciously postponed
 *     issues/.done/            → completed or fixed
 *     issues/.archived/        → obsolete, superseded, won't-fix
 *
 * so `deriveState` reads the folder and treats `status:` as advisory. That is
 * deliberate: 42 of 517 files currently carry a `status:` that contradicts the
 * folder they sit in (26 `.done/` files still claiming `in-progress`), because
 * moving a file is one action and editing its frontmatter is another, and the
 * second one gets forgotten. Trusting the folder means a stale field can never
 * misfile an issue in the viewer.
 *
 * The single exception is `on-hold`, which the convention places in the root
 * *alongside* in-progress work. There is no `.on-hold/` folder to read, so for
 * root files — and only root files — a `status: on-hold` is honoured.
 *
 * ## Epics
 *
 * A large issue that splits into sub-issues gets a named folder that behaves as
 * a miniature issues tree (`issues/transport/`, with its own `.done/`). The
 * epic is the first non-dot path segment; the state still comes from the
 * innermost dot-folder, so `transport/.done/x.md` is a done issue belonging to
 * the `transport` epic. Nothing nested under a top-level dot-folder is an epic:
 * `.archived/css-refactor/` is archived material, not active grouped work.
 *
 * ## Priority is normalised on read, not trusted
 *
 * Agents write prose into `priority:` (`medium — downgraded from HIGH once the
 * mechanism was shown to work`). `normalizePriority` keeps the leading word and
 * discards the rest, so a messy file still filters correctly instead of falling
 * into an "unset" bucket it does not belong in. `critical` folds into `high`:
 * the viewer offers three levels, and silently dropping a critical issue out of
 * the filter would be the worst possible failure mode for that field.
 */

export type IssueState =
  | 'in-progress'
  | 'open'
  | 'deferred'
  | 'done'
  | 'archived'
  | 'on-hold';

export type IssueType = 'bug' | 'task';

export type IssuePriority = 'low' | 'medium' | 'high';

export type IssueComplexity = 'low' | 'medium' | 'high' | 'very-high';

/** Display order for state chips: active work first, closed work last. */
export const ISSUE_STATE_ORDER: IssueState[] = [
  'in-progress',
  'on-hold',
  'open',
  'deferred',
  'done',
  'archived',
];

export const ISSUE_STATE_LABELS: Record<IssueState, string> = {
  'in-progress': 'In progress',
  'on-hold': 'On hold',
  open: 'Open',
  deferred: 'Deferred',
  done: 'Done',
  archived: 'Archived',
};

/** Most urgent first — the order someone scanning a backlog wants. */
export const ISSUE_PRIORITY_ORDER: IssuePriority[] = ['high', 'medium', 'low'];

export const ISSUE_TYPE_ORDER: IssueType[] = ['bug', 'task'];

export const ISSUE_COMPLEXITY_ORDER: IssueComplexity[] = [
  'low',
  'medium',
  'high',
  'very-high',
];

/**
 * Dot-folder → state. Legacy names are included because the pre-migration
 * layout used `.solved/` and `.todo/`, and a repo can still carry a stray one.
 */
const STATE_BY_DOT_FOLDER: Record<string, IssueState> = {
  '.open': 'open',
  '.todo': 'open',
  '.deferred': 'deferred',
  '.done': 'done',
  '.solved': 'done',
  '.archived': 'archived',
  '.archive': 'archived',
};

/** The scanner emits `'root'` for a file directly inside the scanned folder. */
const isRootFolder = (folder: string | null | undefined): boolean =>
  !folder || folder === 'root' || folder === '.';

const segmentsOf = (folder: string | null | undefined): string[] =>
  isRootFolder(folder) ? [] : String(folder).split('/').filter(Boolean);

/**
 * Where an issue stands, read from its folder.
 *
 * The innermost dot-folder wins, so an epic's own `.done/` classifies its files
 * exactly like the top-level one. A dot-folder we do not recognise is treated
 * as no dot-folder at all rather than inventing a state.
 */
export function deriveState(
  folder: string | null | undefined,
  frontmatterStatus?: string | null
): IssueState {
  const dot = [...segmentsOf(folder)]
    .reverse()
    .find((segment) => segment.startsWith('.') && segment in STATE_BY_DOT_FOLDER);

  if (dot) return STATE_BY_DOT_FOLDER[dot];

  // No status folder: the file lives in a working root. `on-hold` is the one
  // state with no folder of its own, so here — and only here — the field wins.
  return String(frontmatterStatus ?? '').trim().toLowerCase() === 'on-hold'
    ? 'on-hold'
    : 'in-progress';
}

/**
 * The epic an issue belongs to, or `null` when it is a standalone issue.
 * Only a *leading* non-dot segment names an epic; folders nested under a
 * status folder are that status's material, not a grouping.
 */
export function deriveEpic(folder: string | null | undefined): string | null {
  const [first] = segmentsOf(folder);
  if (!first || first.startsWith('.')) return null;
  return first;
}

/** Leading alphabetic token of a frontmatter value, lowercased. */
const leadingWord = (raw: unknown): string | null => {
  if (raw == null) return null;
  const match = String(raw).trim().toLowerCase().match(/^[a-z]+/);
  return match ? match[0] : null;
};

/**
 * `low | medium | high`, recovered from whatever was actually written.
 *
 * Keeps only the leading word, so `high (a test suite that under-reports
 * coverage is worse than one that fails)` still filters as `high`. `critical`
 * folds into `high` — the viewer offers three levels, and the alternative is
 * dropping the most urgent issues out of the filter entirely.
 */
export function normalizePriority(raw: unknown): IssuePriority | null {
  const word = leadingWord(raw);
  if (word === 'critical') return 'high';
  return word === 'low' || word === 'medium' || word === 'high' ? word : null;
}

/** `bug | task`, or `null` when the field is missing or something else. */
export function normalizeType(raw: unknown): IssueType | null {
  const word = leadingWord(raw);
  return word === 'bug' || word === 'task' ? word : null;
}

/**
 * `low | medium | high | very-high`. Unlike priority this keeps the hyphenated
 * form, so the leading-word trick would lose `very-high` — match the whole
 * value instead, tolerating spaces and underscores as separators.
 */
export function normalizeComplexity(raw: unknown): IssueComplexity | null {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  return value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'very-high'
    ? value
    : null;
}

/**
 * Sort key for "newest first": the `created` date when present, otherwise the
 * `YYYY-MM-DD-` prefix the naming convention puts on every issue filename.
 * Returns an empty string when neither exists, which sorts such files last.
 */
export function issueSortDate(
  created: unknown,
  filename: string | null | undefined
): string {
  if (created != null) {
    // `gray-matter` yields a Date for an unquoted YAML date; both forms start
    // with the ISO day, which is all the comparison needs.
    const iso =
      created instanceof Date
        ? created.toISOString()
        : String(created).trim();
    const day = iso.match(/^\d{4}-\d{2}-\d{2}/);
    if (day) return day[0];
  }
  const fromName = String(filename ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return fromName ? fromName[1] : '';
}
