import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * `rgb(var(--x))` only works when `--x` holds a bare numeric triplet. Point it at
 * a hex literal and the declaration expands to `rgb(#bfb5c8)`, which is invalid
 * CSS — so the browser silently drops that one line and the element falls back
 * to whatever it inherits. Nothing errors, nothing logs, and the result usually
 * looks plausible.
 *
 * That is exactly how six declarations survived unnoticed: four typography
 * rules whose text quietly rendered at body colour instead of subtle, and the
 * message edit box, which lost its background and border entirely. Three more
 * pointed at variables (`--primary`, `--text-main`, `--text-on-primary`) that
 * were never defined anywhere in the repo.
 *
 * See `.agents/issues/.open/2026-08-12-typography-classes-have-no-working-colour.md`.
 *
 * This scan is the only thing that catches the whole class: neither TypeScript
 * nor the SCSS compiler looks inside a `var()`, because as far as either is
 * concerned the string is well-formed.
 */

const SOURCE_ROOT = 'src';

/** Files that can either use or define a custom property. */
const collectFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...collectFiles(full));
    } else if (/\.(scss|css|tsx?)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

/** `rgb(var(--x))`, `rgba(var(--x), .5)`, `rgb(var(--x) / 50%)`. */
const USAGE = /rgba?\(\s*var\(\s*(--[a-z0-9-]+)\s*\)/g;

/** `--x: <value>;` — the declaration, not the usage. */
const DEFINITION = /^[^\S\n]*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm;

/**
 * Three 0-255 numbers, space- or comma-separated. Both forms survive
 * substitution: `rgb(244 241 246)` and `rgb(255, 255, 255)` are equally valid,
 * and the comma form additionally works inside `rgba(var(--x), 0.5)`.
 */
const TRIPLET = /^\d{1,3}(?:\s*,\s*|\s+)\d{1,3}(?:\s*,\s*|\s+)\d{1,3}$/;

const lineOf = (source: string, index: number) =>
  source.slice(0, index).split('\n').length;

const rel = (file: string) => file.replace(/\\/g, '/');

describe('css colour variable format', () => {
  it('every variable used inside rgb()/rgba() is defined as a numeric triplet', () => {
    const files = collectFiles(SOURCE_ROOT);

    // name -> every value it is assigned, anywhere (themes redefine variables,
    // so one hex among five triplets still breaks that theme).
    const definitions = new Map<
      string,
      Array<{ value: string; where: string }>
    >();

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(DEFINITION)) {
        const [, name, rawValue] = match;
        const value = rawValue.trim();
        if (!definitions.has(name)) definitions.set(name, []);
        definitions
          .get(name)!
          .push({ value, where: `${rel(file)}:${lineOf(source, match.index)}` });
      }
    }

    const offenders: string[] = [];

    for (const file of files) {
      if (/[\\/]dev[\\/]tests[\\/]/.test(file)) continue;
      const source = readFileSync(file, 'utf8');

      for (const match of source.matchAll(USAGE)) {
        const name = match[1];
        const at = `${rel(file)}:${lineOf(source, match.index)}`;
        const defs = definitions.get(name);

        if (!defs) {
          offenders.push(`${at} — rgb(var(${name})) but ${name} is never defined`);
          continue;
        }

        for (const { value, where } of defs) {
          if (TRIPLET.test(value)) continue;
          offenders.push(
            `${at} — rgb(var(${name})) but ${name} is "${value}" at ${where}, not a numeric triplet`
          );
        }
      }
    }

    expect(
      offenders,
      `Declarations the browser will silently drop:\n\n${offenders.join('\n')}\n\n` +
        `Fix by using var(${'--x'}) directly instead of rgb(var(${'--x'})), ` +
        `or by storing the variable as a triplet.\n`
    ).toEqual([]);
  });
});
