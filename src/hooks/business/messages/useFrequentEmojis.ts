import { useMemo, useSyncExternalStore } from 'react';

/**
 * localStorage key used by emoji-picker-react to store suggested/frequent emojis.
 * Each entry has: { unified: string, original: string, count: number }
 */
const EPR_SUGGESTED_KEY = 'epr_suggested';

const DEFAULT_QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😢', '😮'];

interface SuggestedItem {
  unified: string;
  original: string;
  count: number;
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
    return window.localStorage.getItem(EPR_SUGGESTED_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function getServerSnapshot(): string {
  return '[]';
}

/**
 * Subscribe to storage events so the hook re-renders when another tab
 * or the emoji picker updates the suggested list.
 */
function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === EPR_SUGGESTED_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/**
 * Returns the top 3 most frequently used emojis from emoji-picker-react's
 * localStorage data, falling back to defaults (❤️, 👍, 🔥) when there
 * aren't enough entries.
 *
 * Each item includes the native emoji string and the unified codepoint
 * (for rendering as a Twemoji image).
 */
export function useFrequentEmojis(count = 3) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    try {
      const items: SuggestedItem[] = JSON.parse(raw);
      const sorted = [...items].sort((a, b) => b.count - a.count);
      const frequent = sorted.slice(0, count).map((item) => ({
        emoji: unifiedToNative(item.unified),
        unified: item.unified,
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
