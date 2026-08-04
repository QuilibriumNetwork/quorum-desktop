/**
 * Source-level contract: every <MessageList> render site must pass
 * `mapSenderToUser`.
 *
 * This exists because of a bug the issue write-up missed entirely. ThreadPanel
 * rendered <MessageList> WITHOUT the prop, so the list silently fell back to
 * MessageList's internal mapper — which substituted a truncated address for an
 * empty `displayName`. Threads are a space context, so `resolveSpaceMemberName`
 * ran, read that substituted address as a deliberate per-space name, and ranked
 * it ABOVE the member's QNS `.q` name. Thread authors rendered as addresses
 * while the same panel's header and participant list, which DID use the
 * enriched mapper, rendered the real names.
 *
 * A behaviour test for that would have to mount ThreadPanel with a thread
 * context, a composer and a virtualized list. The defect is a missing prop, so
 * assert on the missing prop: this is cheap, and it fails on the exact mistake.
 *
 * The internal mapper no longer poisons anything, so a missing prop is no
 * longer a correctness bug on its own — it now means the list resolves from the
 * RAW roster instead of the public-profile-enriched map, and loses `.q` names
 * and avatars for senders whose roster row is thin. Still a defect, still worth
 * pinning.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dev') continue;
      tsxFiles(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

interface Site {
  file: string;
  line: number;
  body: string;
}

function findMessageListSites(): Site[] {
  const sites: Site[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    // `<MessageList` followed by whitespace or `>` — excludes the type-only
    // `useRef<MessageListRef>` occurrences.
    const re = /<MessageList[\s>]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const end = source.indexOf('/>', m.index);
      sites.push({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: source.slice(0, m.index).split('\n').length,
        body: source.slice(m.index, end === -1 ? source.length : end),
      });
    }
  }
  return sites;
}

/**
 * Sites that may legitimately omit the prop, with the reason. An entry here is
 * a claim that the site has nothing to enrich — NOT a licence to skip it.
 */
const EXEMPT: Record<string, string> = {
  'src/components/direct/DirectMessage.tsx':
    'DMs are not a space context: there is no roster, no per-space override, ' +
    'and no public-profile back-fill map. DirectMessage builds its own members ' +
    'record already carrying primaryUsername, and Message routes DM senders ' +
    'through resolveMemberName (QNS above displayName), so the internal ' +
    'pass-through mapper is correct here.',
};

describe('<MessageList> sender-mapper contract', () => {
  const sites = findMessageListSites();

  // Guard against a vacuous pass: if the regex or the traversal breaks, this
  // suite would otherwise "pass" while checking nothing at all.
  it('finds the known render sites', () => {
    expect(sites.length).toBeGreaterThanOrEqual(3);
    const files = sites.map((s) => s.file);
    expect(files).toContain('src/components/space/Channel.tsx');
    expect(files).toContain('src/components/thread/ThreadPanel.tsx');
    expect(files).toContain('src/components/direct/DirectMessage.tsx');
  });

  it('every non-exempt render site passes mapSenderToUser', () => {
    const missing = sites
      .filter((s) => !s.body.includes('mapSenderToUser') && !EXEMPT[s.file])
      .map((s) => `${s.file}:${s.line}`);

    expect(
      missing,
      'These <MessageList> sites resolve sender names from the raw roster ' +
        'instead of the enriched mapper, so `.q` names and public-profile ' +
        'avatars go missing. Pass mapSenderToUser, or add an EXEMPT entry ' +
        'stating why the site has nothing to enrich',
    ).toEqual([]);
  });

  it('has no stale exemptions', () => {
    // An exemption that no longer matches a real site is dead weight that
    // makes the contract look narrower than it is.
    const files = new Set(sites.map((s) => s.file));
    const stale = Object.keys(EXEMPT).filter((f) => !files.has(f));
    expect(stale, 'EXEMPT names a file with no <MessageList> site').toEqual([]);

    const unnecessary = Object.keys(EXEMPT).filter((f) =>
      sites.some((s) => s.file === f && s.body.includes('mapSenderToUser')),
    );
    expect(
      unnecessary,
      'This site now passes mapSenderToUser — drop its EXEMPT entry',
    ).toEqual([]);
  });
});
