import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
// @ts-ignore - plain JS config, no types
import tailwindConfig from '../../../../tailwind.config.js';

/**
 * A Tailwind class that names a colour the theme does not define generates no
 * CSS at all. Nothing errors: the class stays on the element, the build passes,
 * and the element silently falls back to whatever it inherits. That failure is
 * invisible in review and usually plausible on screen, which is why these
 * accumulate.
 *
 * `border-default` is the case that makes the point. `theme.borderColor.DEFAULT`
 * names the bare `border` utility, not `border-default`, so ~90 call sites wrote
 * a class that never existed. It looked correct only because Tailwind's preflight
 * paints every element's border with that same variable anyway.
 *
 * Others found by the first run of this test, all silently wrong for months:
 * `hover:text-main-hover`, `text-primary` / `border-primary` / `bg-chat-overlay`
 * on the message-loading card, `focus:border-primary`, `text-md` (Tailwind has
 * `text-base`, never `text-md`), and every `-accent/<opacity>` class — an opacity
 * modifier cannot apply to a bare `var()` value, which is what `accent-rgb`
 * exists for.
 *
 * See `.agents/issues/.done/2026-08-12-hover-text-utilities-generate-no-css.md`.
 *
 * Related: `cssColourVariableFormat.test.ts` catches the neighbouring defect,
 * where the class does generate but its `rgb(var(--x))` value is invalid CSS.
 */

/** Namespaces where a bad value yields no rule rather than a build error. */
const NAMESPACES =
  'text|bg|border|divide|from|via|to|ring|outline|decoration|placeholder|caret|fill|stroke|shadow|accent';
const CANDIDATE = new RegExp(`^(?:[a-z0-9-]+:)*!?(?:${NAMESPACES})-`);

const collectFiles = (dir: string, match: RegExp): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...collectFiles(full, match));
    } else if (match.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

/** `.\32 xl\:text-xl` -> `2xl:text-xl` */
const unescapeSelector = (selector: string) =>
  selector
    .replace(/\\([0-9a-fA-F]{1,6})[ ]?/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/\\(.)/g, '$1');

/**
 * Class-list string literals, one line at a time. Scanning across lines drifts
 * out of phase on the first apostrophe in JSX prose ("don't") and then reports
 * fragments of markup as class names.
 */
const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;

/** `className`, `iconClassName`, `nameWrapperClassName`, plain `class`, ... */
const CLASS_ATTR =
  /\b(?:[a-zA-Z]*[cC]lassName|class)\s*=\s*(?:"([^"\n]*)"|'([^'\n]*)')/g;

const rel = (file: string) => file.replace(/\\/g, '/');

/**
 * Comments must go before any string scan. Prose in a doc comment quotes class
 * names in backticks, which reads as a template literal — this very file's
 * comment above mentions `text-md`, and without this the test reports itself.
 * The `[^:]` guard keeps `https://` out of the line-comment rule.
 */
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('tailwind classes generate css', () => {
  it('every colour utility written in source produces a rule', async () => {
    // 1. Exactly the utilities Tailwind would ship for this repo, built from the
    //    real config so the test cannot drift from the build.
    const { css: utilities } = await postcss([
      tailwindcss(tailwindConfig),
    ]).process('@tailwind utilities;', { from: undefined });

    // Matching stops at an unescaped `:`, so `.hover\:text-danger:hover` yields
    // the class `hover:text-danger` rather than the whole selector.
    const generated = new Set<string>();
    for (const match of utilities.matchAll(/\.((?:\\.|[\w-])+)/g)) {
      generated.add(unescapeSelector(match[1]));
    }
    expect(generated.size).toBeGreaterThan(500); // the scan itself still works

    // 2. Hand-written SCSS classes are legitimate too (`text-label`, `bg-onboarding`).
    const scssClasses = new Set<string>();
    for (const file of collectFiles('src', /\.(scss|css)$/)) {
      for (const match of readFileSync(file, 'utf8').matchAll(
        /\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g
      )) {
        scssClasses.add(match[1]);
      }
    }

    const isKnown = (cls: string) => generated.has(cls) || scssClasses.has(cls);

    // 3. Every candidate class written in source must resolve to one of those.
    const dead = new Map<string, Set<string>>();

    const inspect = (
      chunk: string,
      file: string,
      source: string,
      index: number
    ) => {
      const tokens = chunk
        .replace(/\$\{[^}]*\}/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      for (const token of tokens) {
        if (!CANDIDATE.test(token) || isKnown(token)) continue;
        // Arbitrary values (`text-[var(--x)]`) escape too many ways to compare
        // as plain strings, and a wrong one is a CSS error rather than a no-op.
        if (token.includes('[')) continue;
        const line = source.slice(0, index).split('\n').length;
        if (!dead.has(token)) dead.set(token, new Set());
        dead.get(token)!.add(`${rel(file)}:${line}`);
      }
    };

    for (const file of collectFiles('src', /\.(tsx?|jsx?)$/)) {
      // Block comments are blanked rather than removed so reported line numbers
      // still match the file on disk.
      const source = stripComments(readFileSync(file, 'utf8'));

      // A `className="..."` value is a class list by definition, even when it
      // holds a single token (`className="text-md"`).
      for (const match of source.matchAll(CLASS_ATTR)) {
        inspect(match[1] ?? match[2] ?? '', file, source, match.index!);
      }

      // Class lists also get built in helpers and returned as plain strings.
      // Treat a literal as one only when two or more of its tokens are real
      // classes: a single hit misfires on CSS values such as the transition
      // `'border-color 0.15s ease-in-out'`, where `ease-in-out` is also a class.
      for (const match of source.matchAll(STRING_LITERAL)) {
        const chunk = match[2];
        if (chunk.includes('<') || chunk.includes('>')) continue; // markup
        const tokens = chunk.split(/\s+/).filter(Boolean);
        if (tokens.filter(isKnown).length < 2) continue;
        inspect(chunk, file, source, match.index!);
      }
    }

    const report = [...dead]
      .sort()
      .map(
        ([cls, where]) =>
          `  ${cls}\n${[...where]
            .sort()
            .map((w) => `      ${w}`)
            .join('\n')}`
      )
      .join('\n');

    expect(
      dead.size,
      dead.size
        ? `${dead.size} class(es) generate no CSS — the theme defines no such colour:\n${report}\n`
        : ''
    ).toBe(0);
  }, 60_000);
});
