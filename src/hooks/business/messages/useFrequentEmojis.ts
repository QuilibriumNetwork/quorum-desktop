import { useMemo, useSyncExternalStore } from 'react';
import { parse as parseEmoji } from '@twemoji/parser';
import {
  FREQUENT_EMOJIS_KEY,
  subscribeFrequentEmojis,
} from '../../../components/emoji-picker/useFrequentlyUsed';
import { emojiToUnified } from '../../../utils/remarkTwemoji';

const DEFAULT_QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😢', '😮'];

interface FrequentEntry {
  count: number;
  lastUsed: number;
}

export interface FrequentEmoji {
  /** Native emoji character, used as the reaction payload. */
  emoji: string;
  /**
   * Unified codepoint, lowercased. The picker records usage keyed on
   * emoji-datasource-twitter's `unified` field, which is UPPERCASE ("1F600"),
   * while the PNGs that package ships are named lowercase ("1f600.png"). A
   * case-insensitive dev filesystem hides the mismatch; production's does not.
   */
  unified: string;
  /** Ready-to-use Twemoji asset path, or null if the emoji isn't recognised. */
  twemojiSrc: string | null;
}

/** Convert unified codepoint string (e.g. "1f60d") to native emoji character. */
function unifiedToNative(unified: string): string {
  return unified
    .split('-')
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join('');
}

/**
 * Resolve the Twemoji PNG for an entry. Prefers the recorded unified code and
 * falls back to parsing the native character, which is the only route open for
 * the built-in defaults (they carry no recorded code).
 */
function twemojiSrcFor(emoji: string, unified: string): string | null {
  if (unified) return `/twitter/64/${unified}.png`;
  const entities = parseEmoji(emoji);
  if (entities.length === 0) return null;
  return `/twitter/64/${emojiToUnified(entities[0].text)}.png`;
}

/** Read the raw JSON string from localStorage for snapshot comparison. */
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(FREQUENT_EMOJIS_KEY) ?? '{}';
  } catch {
    return '{}';
  }
}

function getServerSnapshot(): string {
  return '{}';
}

/**
 * Subscribe to both same-tab writes (via module-level channel) and
 * cross-tab StorageEvents so the hook re-renders whenever the emoji
 * picker records a new usage.
 */
function subscribe(callback: () => void): () => void {
  const unsubSameTab = subscribeFrequentEmojis(callback);

  const handler = (e: StorageEvent) => {
    if (e.key === FREQUENT_EMOJIS_KEY) callback();
  };
  window.addEventListener('storage', handler);

  return () => {
    unsubSameTab();
    window.removeEventListener('storage', handler);
  };
}

/**
 * Returns the top N most frequently used emojis from the custom emoji picker's
 * localStorage data, falling back to defaults (❤️, 👍, 🔥) when there
 * aren't enough entries.
 *
 * Each item includes the native emoji string, the (lowercased) unified
 * codepoint, and the resolved Twemoji image path.
 */
export function useFrequentEmojis(count = 3): FrequentEmoji[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    const withSrc = (emoji: string, unified: string): FrequentEmoji => ({
      emoji,
      unified,
      twemojiSrc: twemojiSrcFor(emoji, unified),
    });

    try {
      const map = JSON.parse(raw) as Record<string, FrequentEntry>;
      const sorted = Object.entries(map).sort(
        ([, a], [, b]) => b.lastUsed - a.lastUsed,
      );
      const frequent = sorted
        .slice(0, count)
        // Lowercase here, at the one place every consumer reads from, so no
        // call site can reintroduce the case mismatch against the PNG names.
        .map(([unified]) => withSrc(unifiedToNative(unified), unified.toLowerCase()));

      // Fill remaining slots with defaults (skip any already present)
      if (frequent.length < count) {
        for (const fallback of DEFAULT_QUICK_EMOJIS) {
          if (frequent.length >= count) break;
          if (!frequent.some((f) => f.emoji === fallback)) {
            frequent.push(withSrc(fallback, ''));
          }
        }
      }

      return frequent;
    } catch {
      return DEFAULT_QUICK_EMOJIS.slice(0, count).map((emoji) => withSrc(emoji, ''));
    }
  }, [raw, count]);
}
