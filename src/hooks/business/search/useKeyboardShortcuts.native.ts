import { useCallback, useRef } from 'react';

/**
 * REACT NATIVE VERSION: Keyboard Shortcuts Hook
 * =============================================
 *
 * This is the React Native version of useKeyboardShortcuts.
 * Most keyboard shortcuts don't apply to mobile devices, so this is a simplified implementation.
 *
 * TODO: Consider implementing mobile-specific shortcuts if needed (e.g., hardware keyboard support)
 */
export function useKeyboardShortcuts({
  inputContainerRef,
  isFocused,
  onEscape,
}: {
  inputContainerRef: React.RefObject<any>; // React Native view instead of HTMLDivElement
  isFocused: boolean;
  onEscape?: () => void;
}) {
  const isUserTyping = useRef(false);

  // Mobile-friendly focus management - no window API dependencies
  const focusInputSafely = useCallback(() => {
    // Don't steal focus if user is actively typing
    if (isUserTyping.current) return;

    // On mobile, focus management is handled differently
    // React Native TextInput focus() method can be called directly
    if (inputContainerRef.current?.focus) {
      inputContainerRef.current.focus();
    }
  }, [inputContainerRef]);

  // Handle user typing state (same logic as web version)
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
      // Try to restore focus on mobile
      setTimeout(() => {
        if (isUserTyping.current && inputContainerRef.current?.focus) {
          inputContainerRef.current.focus();
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
