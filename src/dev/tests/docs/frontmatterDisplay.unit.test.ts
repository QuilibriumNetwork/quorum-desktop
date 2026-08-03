import { describe, expect, it } from 'vitest';
import {
  asList,
  formatFieldLabel,
  formatFieldValue,
  partitionFrontmatter,
} from '../../docs/utils/frontmatterDisplay';

describe('formatFieldLabel', () => {
  it('reads a snake_case or kebab-case key as words', () => {
    expect(formatFieldLabel('related_docs')).toBe('Related docs');
    expect(formatFieldLabel('spans-repos')).toBe('Spans repos');
    expect(formatFieldLabel('is-real-root-cause-of')).toBe('Is real root cause of');
  });

  it('does not mangle acronyms', () => {
    expect(formatFieldLabel('ai_generated')).toBe('AI generated');
    expect(formatFieldLabel('related_pr')).toBe('Related PR');
  });

  it('leaves a single plain word alone but capitalised', () => {
    expect(formatFieldLabel('severity')).toBe('Severity');
  });
});

describe('formatFieldValue', () => {
  it('renders booleans as words', () => {
    expect(formatFieldValue(true)).toBe('Yes');
    expect(formatFieldValue(false)).toBe('No');
  });

  it('renders a missing value as a dash', () => {
    expect(formatFieldValue(null)).toBe('—');
    expect(formatFieldValue(undefined)).toBe('—');
  });

  it('pulls the day back out of a serialised YAML date', () => {
    // Unquoted YAML dates become Date objects at scan time and reach the
    // browser as ISO timestamps once the manifest is JSON.
    expect(formatFieldValue('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
    expect(formatFieldValue('2026-08-01')).toBe('2026-08-01');
  });

  it('joins arrays', () => {
    expect(formatFieldValue(['a.md', 'b.md'])).toBe('a.md, b.md');
  });

  it('keeps prose intact', () => {
    expect(
      formatFieldValue('HIGH (authorization bypass / integrity)')
    ).toBe('HIGH (authorization bypass / integrity)');
  });
});

describe('asList', () => {
  it('splits an array into entries', () => {
    expect(asList(['one', 'two'])).toEqual(['one', 'two']);
  });

  it('wraps a lone string', () => {
    expect(asList('issues/transport/index.md')).toEqual([
      'issues/transport/index.md',
    ]);
  });

  it('is empty when there is no value', () => {
    expect(asList(null)).toEqual([]);
    expect(asList(undefined)).toEqual([]);
  });
});

describe('partitionFrontmatter', () => {
  it('is empty for a file whose YAML did not parse', () => {
    expect(partitionFrontmatter(undefined)).toEqual({
      primary: [],
      relations: [],
      other: [],
    });
  });

  it('orders the recognised fields, regardless of the order written', () => {
    const partition = partitionFrontmatter({
      created: '2026-08-01',
      severity: 'high',
      type: 'bug',
      priority: 'high',
    });
    expect(partition.primary.map((f) => f.key)).toEqual([
      'type',
      'priority',
      'severity',
      'created',
    ]);
  });

  it('drops title and status — both are rendered elsewhere', () => {
    const partition = partitionFrontmatter({
      title: 'Something',
      status: 'in-progress',
      type: 'task',
    });
    const allKeys = [
      ...partition.primary,
      ...partition.relations,
      ...partition.other,
    ].map((f) => f.key);
    expect(allKeys).not.toContain('title');
    // The folder is the source of truth for state, so a stale `status:` would
    // contradict the badge right next to it.
    expect(allKeys).not.toContain('status');
    expect(allKeys).toContain('type');
  });

  it('groups anything that points at other work', () => {
    const partition = partitionFrontmatter({
      related_docs: ['a.md'],
      related_bugs: ['b.md'],
      related: ['c.md'],
      depends_on: ['d.md'],
      'spans-repos': ['quorum-desktop'],
      superseded_by: 'e.md',
    });
    expect(partition.relations.map((f) => f.key).sort()).toEqual([
      'depends_on',
      'related',
      'related_bugs',
      'related_docs',
      'spans-repos',
      'superseded_by',
    ]);
    expect(partition.other).toEqual([]);
  });

  it('keeps every unrecognised key instead of dropping it', () => {
    // ~90 one-off keys exist across the tree; the panel must not hide them.
    const partition = partitionFrontmatter({
      'is-real-root-cause-of': 'x.md',
      'runtime-test': 'passed',
      'found_via': 'sync testing',
      github: 'https://example.invalid/1',
    });
    expect(partition.other.map((f) => f.key).sort()).toEqual([
      'found_via',
      'github',
      'is-real-root-cause-of',
      'runtime-test',
    ]);
    expect(partition.relations).toEqual([]);
  });

  it('skips a recognised field that is present but empty', () => {
    const partition = partitionFrontmatter({ type: 'bug', priority: null });
    expect(partition.primary.map((f) => f.key)).toEqual(['type']);
  });
});
