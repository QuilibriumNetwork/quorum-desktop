import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the invariant that both "channel is empty" bugs came from.
//
// The Messages cache key has two variants, chosen at MOUNT time from the
// space's `allowThreads` setting:
//
//   ['Messages', spaceId, channelId, 'with-threads' | 'no-threads']
//
// Only the mount point legitimately knows which variant it wants. Everything
// else — optimistic writes, sync refetches, cache reads — means "whatever this
// conversation actually mounted", and must go through the 3-element
// `buildMessagesKeyPrefix` with a prefix-matching API (`setQueriesData`,
// `getQueriesData`, `invalidateQueries`, `refetchQueries`).
//
// Two ways to break it, both of which shipped and both of which were silent:
//
//   1. `buildMessagesKey({ spaceId, channelId })` away from the mount point.
//      `includeThreadReplies` is now a required parameter, so the compiler
//      forces an author to STATE a variant — but it cannot force them to state
//      the RIGHT one. This test covers what the type system cannot.
//   2. A hand-rolled `['Messages', ...]` array literal, which bypasses the
//      builder entirely and so is invisible to the compiler. That is exactly
//      how `usePinnedMessages` ended up calling `getQueryData` — an EXACT hash
//      lookup — with a 3-element key that could never match anything.
//
// Reverting any part of the cache-key sweep turns this test red.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../../..');

/** The only place allowed to pick a specific thread variant: the mount. */
const EXACT_KEY_ALLOWED = ['hooks/queries/messages/useMessages.ts'];

/** The builders themselves are where the literals are supposed to live. */
const LITERAL_ALLOWED = ['hooks/queries/messages/buildMessagesKey.ts'];

/** Comments describing a key shape are documentation, not a call site. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dev' || entry.name === 'node_modules') continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
};

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');

describe('Messages cache key contract', () => {
  const files = collectSourceFiles(SRC);

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('only the mount point uses the variant-pinned exact key', () => {
    const offenders = files.filter((file) => {
      if (EXACT_KEY_ALLOWED.includes(rel(file))) return false;
      const text = fs.readFileSync(file, 'utf8');
      // `buildMessagesKey(` but not `buildMessagesKeyPrefix(`
      return /\bbuildMessagesKey\s*\(/.test(text);
    });

    expect(offenders.map(rel)).toEqual([]);
  });

  it('nothing hand-rolls a Messages key literal', () => {
    const offenders = files.filter((file) => {
      if (LITERAL_ALLOWED.includes(rel(file))) return false;
      const text = stripComments(fs.readFileSync(file, 'utf8'));
      // e.g. ['Messages', spaceId, channelId]
      return /\[\s*['"]Messages['"]\s*,/.test(text);
    });

    expect(offenders.map(rel)).toEqual([]);
  });

  it('control: the prefix builder is actually in use', () => {
    const users = files.filter((file) =>
      /\bbuildMessagesKeyPrefix\s*\(/.test(fs.readFileSync(file, 'utf8'))
    );

    // Services, hooks and components all rely on it; if this drops to zero the
    // two tests above would pass vacuously.
    expect(users.length).toBeGreaterThanOrEqual(5);
  });

  it('control: the mount point does pin a variant', () => {
    const mount = fs.readFileSync(
      path.join(SRC, 'hooks/queries/messages/useMessages.ts'),
      'utf8'
    );

    expect(mount).toMatch(/buildMessagesKey\s*\(/);
    expect(mount).toMatch(/includeThreadReplies/);
  });
});
