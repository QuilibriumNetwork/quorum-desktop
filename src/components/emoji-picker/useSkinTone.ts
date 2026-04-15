// src/components/emoji-picker/useSkinTone.ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'emoji-picker-skin-tone';

/** The 5 skin tone modifier codepoints + null for default */
export const SKIN_TONES = [null, '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

function loadSkinTone(): SkinTone {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SKIN_TONES.includes(stored as SkinTone)) {
      return stored as SkinTone;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

export function useSkinTone() {
  const [skinTone, setSkinToneState] = useState<SkinTone>(loadSkinTone);

  const setSkinTone = useCallback((tone: SkinTone) => {
    setSkinToneState(tone);
    try {
      if (tone === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, tone);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { skinTone, setSkinTone };
}
