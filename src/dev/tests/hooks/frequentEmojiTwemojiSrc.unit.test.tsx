import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFrequentEmojis } from '../../../hooks/business/messages/useFrequentEmojis';
import { FREQUENT_EMOJIS_KEY } from '../../../components/emoji-picker/useFrequentlyUsed';

/**
 * The quick-reaction row in the message toolbar reads its emoji from the
 * emoji picker's "frequently used" localStorage map. The picker records usage
 * keyed on emoji-datasource-twitter's `unified` field, which is UPPERCASE
 * ("1F600"). The Twemoji PNGs shipped by that same package are named in
 * lowercase ("1f600.png").
 *
 * A Windows dev box serves those files off a case-insensitive filesystem, so
 * "/twitter/64/1F600.png" resolves there and the bug is invisible. Production
 * serves from a case-sensitive filesystem, where the same URL 404s and every
 * recently-used emoji renders as a broken image.
 *
 * These tests pin the casing at the hook — the single point every consumer
 * (MessageActions, MessageActionsMenu, MessageActionsDrawer) reads from.
 */

const stored = (map: Record<string, { count: number; lastUsed: number }>) =>
  window.localStorage.setItem(FREQUENT_EMOJIS_KEY, JSON.stringify(map));

describe('useFrequentEmojis — Twemoji asset casing', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('lowercases the uppercase unified codes the emoji picker records', () => {
    stored({
      '1F600': { count: 5, lastUsed: 300 },
      '2764-FE0F': { count: 4, lastUsed: 200 },
      '1F44D': { count: 3, lastUsed: 100 },
    });

    const { result } = renderHook(() => useFrequentEmojis(3));

    expect(result.current.map((e) => e.unified)).toEqual([
      '1f600',
      '2764-fe0f',
      '1f44d',
    ]);
  });

  it('builds asset paths that match the shipped lowercase PNG filenames', () => {
    stored({ '1F600': { count: 1, lastUsed: 1 } });

    const { result } = renderHook(() => useFrequentEmojis(1));

    expect(result.current[0].twemojiSrc).toBe('/twitter/64/1f600.png');
    // Guard the exact failure mode: an uppercase path 404s in production.
    expect(result.current[0].twemojiSrc).not.toMatch(/[A-F]/);
  });

  it('resolves a path for the built-in defaults, which carry no unified code', () => {
    const { result } = renderHook(() => useFrequentEmojis(3));

    // Storage is empty, so all three slots come from DEFAULT_QUICK_EMOJIS.
    expect(result.current).toHaveLength(3);
    for (const entry of result.current) {
      expect(entry.twemojiSrc).toMatch(/^\/twitter\/64\/[0-9a-f-]+\.png$/);
    }
    // ❤️ is the first default and carries the VS16 selector.
    expect(result.current[0].twemojiSrc).toBe('/twitter/64/2764-fe0f.png');
  });

  it('keeps already-lowercase legacy keys untouched', () => {
    // epr_suggested (emoji-picker-react) migration writes lowercase codes.
    stored({ '1f525': { count: 2, lastUsed: 10 } });

    const { result } = renderHook(() => useFrequentEmojis(1));

    expect(result.current[0].unified).toBe('1f525');
    expect(result.current[0].twemojiSrc).toBe('/twitter/64/1f525.png');
  });
});
