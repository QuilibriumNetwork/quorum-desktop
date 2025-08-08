import { useEffect, useRef, useCallback } from 'react';

export function useKeyboardShortcuts({
  inputContainerRef,
  isFocused,
  onEscape,
}: {
  inputContainerRef: React.RefObject<HTMLDivElement | null>;
  isFocused: boolean;
  onEscape?: () => void;
}) {
  const isUserTyping = useRef(false);

  // Centralized focus management - prevents focus when mobile overlay is active
  const focusInputSafely = useCallback(() => {
    // Don't steal focus if user is actively typing
    if (isUserTyping.current) return;

    // Prevent focus if mobile overlay is active
    if (window.innerWidth < 1024) {
      const mobileOverlay = document.querySelector('.bg-mobile-overlay');
      if (mobileOverlay) return; // Don't focus
    }

    // Find the actual input element within the Input primitive
    const inputElement = inputContainerRef.current?.querySelector('input');
    inputElement?.focus();
  }, [inputContainerRef]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusInputSafely();
      }

      // Escape to blur search
      if (e.key === 'Escape' && isFocused) {
        const inputElement = inputContainerRef.current?.querySelector('input');
        inputElement?.blur();
        onEscape?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, focusInputSafely, inputContainerRef, onEscape]);

  // Handle user typing state
  const markUserTyping = useCallback(() => {
    isUserTyping.current = true;
    // Reset typing state after a short delay
    setTimeout(() => {
      isUserTyping.current = false;
    }, 300);
  }, []);

  // Check if user is actively typing
  const checkUserTyping = useCallback(() => {
    return isUserTyping.current;
  }, []);

  // Handle focus restoration for typing users
  const handleFocusRestoration = useCallback(() => {
    if (isUserTyping.current) {
      // Try to restore focus
      setTimeout(() => {
        if (isUserTyping.current) {
          const inputElement =
            inputContainerRef.current?.querySelector('input');
          inputElement?.focus();
        }
      }, 10);
      return true; // Indicate focus should be restored
    }
    return false;
  }, [inputContainerRef]);

  return {
    focusInputSafely,
    markUserTyping,
    checkUserTyping,
    handleFocusRestoration,
  };
}
