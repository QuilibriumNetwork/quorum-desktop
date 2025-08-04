import { useState, useEffect, useCallback } from 'react';
import { isWeb } from '../../../utils/platform';

export const ACCENT_COLORS = [
  'blue',
  'purple',
  'fuchsia',
  'orange',
  'green',
  'yellow',
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

interface UseAccentColorReturn {
  activeAccent: AccentColor;
  setAccent: (color: AccentColor) => void;
  availableColors: readonly AccentColor[];
}

export const useAccentColor = (): UseAccentColorReturn => {
  const [activeAccent, setActiveAccent] = useState<AccentColor>('blue');

  // Load accent color from storage on mount
  useEffect(() => {
    if (isWeb && typeof window !== 'undefined') {
      const currentAccent =
        (localStorage.getItem('accent-color') as AccentColor) || 'blue';
      setActiveAccent(currentAccent);
    }
    // TODO: For native, we'll use AsyncStorage in the future
  }, []);

  // Set accent color function
  const setAccent = useCallback((color: AccentColor) => {
    if (isWeb && typeof document !== 'undefined') {
      // Web: Update CSS classes
      ACCENT_COLORS.forEach((c) => {
        document.documentElement.classList.remove(`accent-${c}`);
      });
      document.documentElement.classList.add(`accent-${color}`);

      // Web: Persist to localStorage
      localStorage.setItem('accent-color', color);
    }
    // TODO: For native, we'll update theme context and use AsyncStorage

    // Update state (works for both web and native)
    setActiveAccent(color);
  }, []);

  return {
    activeAccent,
    setAccent,
    availableColors: ACCENT_COLORS,
  };
};
