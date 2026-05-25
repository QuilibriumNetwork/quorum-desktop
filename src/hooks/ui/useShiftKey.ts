import { useEffect, useState } from 'react';

/**
 * Tracks whether the Shift key is currently held down globally.
 *
 * Useful for swapping UI affordances to a "power user" variant while Shift is
 * pressed (quick-action toolbars, bypass-confirmation hints, etc.).
 */
export function useShiftKey(): boolean {
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    // Resync when the window loses focus — a Shift release that happens
    // outside the window otherwise leaves the state stuck on.
    const handleBlur = () => setIsShiftPressed(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return isShiftPressed;
}
