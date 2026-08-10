import { describe, it, expect } from 'vitest';
import { buildRowData } from '../../../components/emoji-picker/emojiData';
import type { EmojiItem } from '../../../components/emoji-picker/types';

/**
 * The picker's "Frequently Used" row resolves stored codes against
 * emoji-datasource-twitter, whose `unified` field is UPPERCASE ("1F600").
 *
 * Codes migrated from the old emoji-picker-react store (`epr_suggested`) are
 * LOWERCASE and are copied across verbatim, so a case-sensitive match drops
 * them: the row silently comes up short for anyone who used the app before the
 * picker rewrite. Matching is therefore case-insensitive.
 */

const COLUMNS = 8;

/** Flatten the emoji that actually render under the "Frequently Used" header. */
function frequentlyUsedEmojis(frequentUnifieds: string[]): EmojiItem[] {
  const { rows, categoryRowIndices } = buildRowData(COLUMNS, frequentUnifieds, []);
  const start = categoryRowIndices.get('Frequently Used');
  if (start == null) return [];

  const out: EmojiItem[] = [];
  // Walk forward from the header until the next header row.
  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.type === 'header') break;
    if (row.type === 'emoji-row') out.push(...row.emojis);
  }
  return out;
}

describe('buildRowData — Frequently Used lookup', () => {
  it('resolves the uppercase codes the current picker records', () => {
    const found = frequentlyUsedEmojis(['1F600']);
    expect(found.map((e) => e.unified)).toEqual(['1F600']);
  });

  it('resolves lowercase codes migrated from the legacy store', () => {
    const found = frequentlyUsedEmojis(['1f600', '2764-fe0f']);
    expect(found.map((e) => e.unified)).toEqual(['1F600', '2764-FE0F']);
  });

  it('does not list an emoji twice when both casings are stored', () => {
    // A user who used the app before AND after the rewrite can hold both keys
    // for the same emoji. They must collapse to one entry: the row renders with
    // `key={item.unified}`, so a duplicate would also collide as a React key.
    const found = frequentlyUsedEmojis(['1f600', '1F600']);
    expect(found.map((e) => e.unified)).toEqual(['1F600']);
  });

  it('still drops codes that match no emoji at all', () => {
    const found = frequentlyUsedEmojis(['ffffff-not-an-emoji']);
    expect(found).toEqual([]);
  });

  it('omits the Frequently Used section entirely when nothing resolves', () => {
    const { categoryRowIndices } = buildRowData(COLUMNS, ['ffffff-not-an-emoji'], []);
    expect(categoryRowIndices.has('Frequently Used')).toBe(false);
  });
});
