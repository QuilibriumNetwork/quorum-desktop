import { useMemo, useSyncExternalStore } from 'react';

/**
 * localStorage key written by the custom emoji picker.
 * Format: Record<unified_codepoint_string, { count: number, lastUsed: number }>
 */
const FREQUENT_KEY = 'emoji-picker-frequently-used';

const DEFAULT_QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😢', '😮'];

interface FrequentEntry {
  count: number;
  lastUsed: number;
}

/** Convert unified codepoint string (e.g. "1f60d") to native emoji character. */
function unifiedToNative(unified: string): string {
  return unified
    .split('-')
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join('');
}

/** Read the raw JSON string from localStorage for snapshot comparison. */
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(FREQUENT_KEY) ?? '{}';
  } catch {
    return '{}';
  }
}

function getServerSnapshot(): string {
  return '{}';
}

/**
 * Subscribe to storage events so the hook re-renders when another tab
 * or the emoji picker updates the frequent-emoji map.
 */
function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === FREQUENT_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/**
 * Returns the top N most frequently used emojis from the custom emoji picker's
 * localStorage data (key: "emoji-picker-frequently-used"), falling back to
 * defaults (❤️, 👍, 🔥) when there aren't enough entries.
 *
 * Each item includes the native emoji string and the unified codepoint
 * (for rendering as a Twemoji image).
 */
export function useFrequentEmojis(count = 3) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    try {
      const map = JSON.parse(raw) as Record<string, FrequentEntry>;
      const sorted = Object.entries(map).sort(
        ([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed,
      );
      const frequent = sorted.slice(0, count).map(([unified]) => ({
        emoji: unifiedToNative(unified),
        unified,
      }));

      // Fill remaining slots with defaults (skip any already present)
      if (frequent.length < count) {
        for (const fallback of DEFAULT_QUICK_EMOJIS) {
          if (frequent.length >= count) break;
          if (!frequent.some((f) => f.emoji === fallback)) {
            frequent.push({ emoji: fallback, unified: '' });
          }
        }
      }

      return frequent;
    } catch {
      return DEFAULT_QUICK_EMOJIS.slice(0, count).map((emoji) => ({
        emoji,
        unified: '',
      }));
    }
  }, [raw, count]);
}
