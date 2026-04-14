// src/components/emoji-picker/useFrequentlyUsed.ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'emoji-picker-frequently-used';
const LEGACY_KEY = 'epr_suggested'; // emoji-picker-react's key
const MAX_FREQUENT = 28;

interface FrequentEntry {
  count: number;
  lastUsed: number;
}

type FrequentMap = Record<string, FrequentEntry>;

/** Migrate from emoji-picker-react's epr_suggested format on first load */
function migrateLegacy(): FrequentMap | null {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;

    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return null;

    const migrated: FrequentMap = {};
    for (const entry of parsed) {
      if (entry?.unified) {
        migrated[entry.unified] = {
          count: entry.count ?? 1,
          lastUsed: Date.now(),
        };
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return null;
  }
}

function loadFrequent(): FrequentMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as FrequentMap;
    const migrated = migrateLegacy();
    if (migrated) return migrated;
  } catch {
    // Corrupted data, start fresh
  }
  return {};
}

function getTopFrequent(map: FrequentMap): string[] {
  return Object.entries(map)
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, MAX_FREQUENT)
    .map(([unified]) => unified);
}

export function useFrequentlyUsed() {
  const [frequentMap, setFrequentMap] = useState<FrequentMap>(loadFrequent);

  const recordUsage = useCallback((unified: string) => {
    setFrequentMap((prev) => {
      const updated = {
        ...prev,
        [unified]: {
          count: (prev[unified]?.count ?? 0) + 1,
          lastUsed: Date.now(),
        },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage full
      }
      return updated;
    });
  }, []);

  const frequentUnifieds = getTopFrequent(frequentMap);

  return { frequentUnifieds, recordUsage };
}
