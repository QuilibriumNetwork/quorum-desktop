import { describe, expect, it } from 'vitest';
import {
  deriveEpic,
  deriveState,
  issueSortDate,
  normalizeComplexity,
  normalizePriority,
  normalizeType,
  ISSUE_STATE_ORDER,
  ISSUE_STATE_LABELS,
} from '../../docs/utils/issueTaxonomy';

describe('deriveState', () => {
  it('reads state from the top-level status folder', () => {
    expect(deriveState('.open')).toBe('open');
    expect(deriveState('.deferred')).toBe('deferred');
    expect(deriveState('.done')).toBe('done');
    expect(deriveState('.archived')).toBe('archived');
  });

  it('treats a file in the root as work in progress', () => {
    // The scanner emits 'root' for a file directly inside `.agents/issues/`.
    expect(deriveState('root')).toBe('in-progress');
    expect(deriveState('')).toBe('in-progress');
    expect(deriveState(null)).toBe('in-progress');
    expect(deriveState(undefined)).toBe('in-progress');
  });

  it("honours on-hold only where there is no folder to contradict it", () => {
    // `on-hold` is the one state with no folder of its own.
    expect(deriveState('root', 'on-hold')).toBe('on-hold');
    expect(deriveState('transport', 'on-hold')).toBe('on-hold');
    // ...but a file that has been filed away is what its folder says it is.
    expect(deriveState('.done', 'on-hold')).toBe('done');
    expect(deriveState('messagedb/.archived', 'on-hold')).toBe('archived');
  });

  it('uses an epic\'s own status folder', () => {
    expect(deriveState('transport/.done')).toBe('done');
    expect(deriveState('mobile-dev/.archived')).toBe('archived');
    expect(deriveState('quorum-shared-migration/.done')).toBe('done');
  });

  it('classifies an epic\'s working root as in progress', () => {
    expect(deriveState('transport')).toBe('in-progress');
    expect(deriveState('search-optimization')).toBe('in-progress');
    expect(deriveState('quorum-shared-migration/designs')).toBe('in-progress');
  });

  it('takes the innermost status folder', () => {
    expect(deriveState('.archived/css-refactor')).toBe('archived');
    expect(deriveState('messagedb/.done')).toBe('done');
  });

  it('ignores a stale status field when the folder disagrees', () => {
    // 26 real files sit in `.done/` still claiming `in-progress`; the folder is
    // the source of truth precisely so those cannot misfile themselves.
    expect(deriveState('.done', 'in-progress')).toBe('done');
    expect(deriveState('mobile-dev/.archived', 'in-progress')).toBe('archived');
    expect(deriveState('.open', 'done')).toBe('open');
  });

  it('understands the pre-migration folder names', () => {
    expect(deriveState('.solved')).toBe('done');
    expect(deriveState('.todo')).toBe('open');
    expect(deriveState('.archive')).toBe('archived');
  });

  it('does not invent a state for an unrecognised dot folder', () => {
    expect(deriveState('.scratch')).toBe('in-progress');
  });

  it('labels and orders every state it can return', () => {
    const produced = new Set<string>([
      deriveState('root'),
      deriveState('root', 'on-hold'),
      deriveState('.open'),
      deriveState('.deferred'),
      deriveState('.done'),
      deriveState('.archived'),
    ]);
    produced.forEach((state) => {
      expect(ISSUE_STATE_ORDER).toContain(state);
      expect(ISSUE_STATE_LABELS[state as keyof typeof ISSUE_STATE_LABELS]).toBeTruthy();
    });
  });
});

describe('deriveEpic', () => {
  it('names the epic from the leading folder segment', () => {
    expect(deriveEpic('transport')).toBe('transport');
    expect(deriveEpic('transport/.done')).toBe('transport');
    expect(deriveEpic('quorum-shared-migration/designs')).toBe('quorum-shared-migration');
    expect(deriveEpic('mobile-dev/docs')).toBe('mobile-dev');
  });

  it('has no epic for a standalone issue', () => {
    expect(deriveEpic('root')).toBeNull();
    expect(deriveEpic('')).toBeNull();
    expect(deriveEpic(null)).toBeNull();
    expect(deriveEpic('.open')).toBeNull();
    expect(deriveEpic('.done')).toBeNull();
  });

  it('does not treat material inside a status folder as an epic', () => {
    // `.archived/css-refactor/` is archived work, not an active grouping.
    expect(deriveEpic('.archived/css-refactor')).toBeNull();
  });
});

describe('normalizePriority', () => {
  it('accepts the three clean values in any casing', () => {
    expect(normalizePriority('low')).toBe('low');
    expect(normalizePriority('medium')).toBe('medium');
    expect(normalizePriority('high')).toBe('high');
    expect(normalizePriority('HIGH')).toBe('high');
    expect(normalizePriority('  Medium  ')).toBe('medium');
  });

  it('recovers the grade from prose agents wrote into the field', () => {
    // Every one of these is a real value from `.agents/issues/`.
    expect(
      normalizePriority('medium — downgraded from HIGH once the mechanism was shown to work')
    ).toBe('medium');
    expect(
      normalizePriority('high (a test suite that under-reports coverage is worse than one that fails)')
    ).toBe('high');
    expect(
      normalizePriority('MEDIUM — downgraded 2026-08-03. The roster symptom is fixed (desktop')
    ).toBe('medium');
    expect(normalizePriority('low — no drift exists today; this prevents a future one')).toBe('low');
    expect(normalizePriority('high (follow-up to the interim signing-split fix)')).toBe('high');
  });

  it('folds critical into high rather than dropping it out of the filter', () => {
    expect(normalizePriority('critical')).toBe('high');
    expect(normalizePriority('Critical — breaks core functionality')).toBe('high');
  });

  it('reads a hyphenated grade as its leading word', () => {
    expect(normalizePriority('medium-high')).toBe('medium');
  });

  it('is null when there is nothing gradeable', () => {
    expect(normalizePriority(null)).toBeNull();
    expect(normalizePriority(undefined)).toBeNull();
    expect(normalizePriority('')).toBeNull();
    expect(normalizePriority('   ')).toBeNull();
    expect(normalizePriority('urgent')).toBeNull();
    expect(normalizePriority(3)).toBeNull();
  });
});

describe('normalizeType', () => {
  it('accepts bug and task', () => {
    expect(normalizeType('bug')).toBe('bug');
    expect(normalizeType('task')).toBe('task');
    expect(normalizeType('Task')).toBe('task');
  });

  it('is null for anything else', () => {
    expect(normalizeType('doc')).toBeNull();
    expect(normalizeType('report')).toBeNull();
    expect(normalizeType(null)).toBeNull();
    expect(normalizeType(undefined)).toBeNull();
  });
});

describe('normalizeComplexity', () => {
  it('keeps the hyphenated very-high intact', () => {
    expect(normalizeComplexity('very-high')).toBe('very-high');
    expect(normalizeComplexity('Very High')).toBe('very-high');
    expect(normalizeComplexity('very_high')).toBe('very-high');
  });

  it('accepts the other three', () => {
    expect(normalizeComplexity('low')).toBe('low');
    expect(normalizeComplexity('medium')).toBe('medium');
    expect(normalizeComplexity('HIGH')).toBe('high');
  });

  it('is null for anything else', () => {
    expect(normalizeComplexity('trivial')).toBeNull();
    expect(normalizeComplexity(null)).toBeNull();
  });
});

describe('issueSortDate', () => {
  it('prefers the created date', () => {
    expect(issueSortDate('2026-08-01', '2026-07-19-something.md')).toBe('2026-08-01');
  });

  it('reads a Date, which is what unquoted YAML dates parse to', () => {
    expect(issueSortDate(new Date('2026-03-19T00:00:00Z'), 'x.md')).toBe('2026-03-19');
  });

  it('falls back to the filename date prefix', () => {
    expect(issueSortDate(null, '2026-07-19-space-deletion-ghost-cleanup.md')).toBe('2026-07-19');
    expect(issueSortDate(undefined, '2026-08-02-roster-pull.md')).toBe('2026-08-02');
  });

  it('is empty when neither carries a date, so such files sort last', () => {
    expect(issueSortDate(null, 'README.md')).toBe('');
    expect(issueSortDate('not a date', 'candidates.md')).toBe('');
  });
});
