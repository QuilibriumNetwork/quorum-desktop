import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { isValidIconName } from '@quilibrium/quorum-shared';

/**
 * `Icon` renders null for a name outside the IconName union, and TypeScript
 * cannot catch it: the shipped `Icon/index.d.ts` re-exports from './Icon' while
 * only `Icon.web.d.ts` is emitted, so under skipLibCheck the whole primitive
 * resolves to `any`. Twelve call sites had silently rendered nothing for months
 * before this test existed.
 *
 * Until the emit is fixed in quorum-shared (see
 * .agents/issues/.open/2026-08-06-invalid-icon-names-render-nothing-and-no-type-error-catches-them.md)
 * this scan is the only thing standing between a typo and an invisible icon.
 */

const SOURCE_ROOT = 'src';

const collectSourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

/**
 * Only literals that really reach `Icon`. Matching a bare `name="..."` would
 * flag things like RadioGroup's HTML field name, which is not an icon at all.
 */
const PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: '<Icon name>', regex: /<Icon\b[^>]*?\bname=["']([a-z0-9-]+)["']/gs },
  { label: 'iconName prop', regex: /\biconName=["']([a-z0-9-]+)["']/g },
  { label: 'icon: descriptor', regex: /\bicon:\s*["']([a-z0-9-]+)["']/g },
];

describe('icon names', () => {
  it('every icon literal in src/ exists in IconName', () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SOURCE_ROOT)) {
      const source = readFileSync(file, 'utf8');
      for (const { label, regex } of PATTERNS) {
        for (const match of source.matchAll(regex)) {
          if (isValidIconName(match[1])) continue;
          const line = source.slice(0, match.index).split('\n').length;
          offenders.push(
            `${file.replace(/\\/g, '/')}:${line} "${match[1]}" (${label})`
          );
        }
      }
    }

    expect(
      offenders,
      `These render no icon at all. Check the IconName union in ` +
        `@quilibrium/quorum-shared for the right name (the alert triangle is ` +
        `"warning", the alert circle is "error", the spinner is "spinner").\n` +
        offenders.join('\n')
    ).toEqual([]);
  });

  it('recognises a known-bad name, so the scan can actually fail', () => {
    expect(isValidIconName('alert-triangle')).toBe(false);
    expect(isValidIconName('warning')).toBe(true);
  });
});
