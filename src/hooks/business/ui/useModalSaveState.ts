import { useState, useCallback, useRef } from 'react';

interface UseModalSaveStateOptions {
  /** Default timeout in milliseconds (defaults to 2000ms) */
  defaultTimeout?: number;
  /** Maximum timeout before forcefully stopping the save operation (defaults to 30000ms / 30 seconds) */
  maxTimeout?: number;
  /** Delay before showing overlay - prevents flash for fast operations (defaults to 1000ms) */
  showOverlayDelay?: number;
  /** Callback to execute after save completes */
  onSaveComplete?: () => void;
  /** Callback to execute on save error */
  onSaveError?: (error: Error) => void;
  /** Callback to execute when operation close out */
  onTimeout?: () => void;
}

interface UseModalSaveStateReturn {
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Set the saving state directly */
  setIsSaving: (saving: boolean) => void;
  /** Execute save function and close after timeout */
  saveWithTimeout: (
    saveFn: () => Promise<void> | void,
    timeout?: number
  ) => Promise<void>;
  /** Execute save function and close only after completion */
  saveUntilComplete: (saveFn: () => Promise<void>) => Promise<void>;
}

/**
 * Hook for managing modal save states with timeout and completion options
 *
 * @example
 * ```tsx
 * const { isSaving, saveWithTimeout, saveUntilComplete } = useModalSaveState({
 *   maxTimeout: 60000, // 60 seconds max timeout (default is 30s)
 *   onSaveComplete: dismiss,
 *   onSaveError: (err) => console.error(err),
 *   onTimeout: () => alert('Save operation timed out')
 * });
 *
 * // Save and close after 3 seconds
 * const handleSave = () => {
 *   saveWithTimeout(async () => {
 *     await updateData();
 *   }, 3000);
 * };
 *
 * // Save and close only when complete (with 60s failsafe)
 * const handleSaveStrict = () => {
 *   saveUntilComplete(async () => {
 *     await updateData();
 *   });
 * };
 * ```
 */
export const useModalSaveState = ({
  defaultTimeout = 2000,
  maxTimeout = 30000, // 30 seconds default max timeout
  showOverlayDelay = 1000, // Only show overlay if operation takes >1s
  onSaveComplete,
  onSaveError,
  onTimeout,
}: UseModalSaveStateOptions = {}): UseModalSaveStateReturn => {
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showOverlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timeouts helper
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    if (showOverlayTimerRef.current) {
      clearTimeout(showOverlayTimerRef.current);
      showOverlayTimerRef.current = null;
    }
  }, []);

  // Save with a timeout - closes after specified time regardless of completion
  const saveWithTimeout = useCallback(
    async (
      saveFn: () => Promise<void> | void,
      timeout: number = defaultTimeout
    ): Promise<void> => {
      setIsSaving(true);
      clearTimeouts();

      try {
        // Execute save function
        await saveFn();

        // Set timeout to hide overlay and call complete callback
        timeoutRef.current = setTimeout(() => {
          setIsSaving(false);
          clearTimeouts();
          onSaveComplete?.();
        }, timeout);
      } catch (error) {
        setIsSaving(false);
        clearTimeouts();
        onSaveError?.(error as Error);
        throw error;
      }
    },
    [defaultTimeout, onSaveComplete, onSaveError, clearTimeouts]
  );

  // Save until complete - only closes when operation finishes (with max timeout failsafe)
  // Shows overlay only if operation takes longer than showOverlayDelay (prevents flash)
  const saveUntilComplete = useCallback(
    async (saveFn: () => Promise<void>): Promise<void> => {
      clearTimeouts();

      // Delay showing overlay to prevent flash for fast operations
      showOverlayTimerRef.current = setTimeout(() => {
        setIsSaving(true);
      }, showOverlayDelay);

      // Set maximum timeout as a failsafe
      maxTimeoutRef.current = setTimeout(() => {
        setIsSaving(false);
        clearTimeouts();
        const timeoutError = new Error(`Save operation timed out after ${maxTimeout / 1000} seconds`);
        onSaveError?.(timeoutError);
        onTimeout?.();
      }, maxTimeout);

      try {
        await saveFn();

        // Clear all timers - if fast enough, overlay never showed
        clearTimeouts();
        setIsSaving(false);
        onSaveComplete?.();
      } catch (error) {
        clearTimeouts();
        setIsSaving(false);
        onSaveError?.(error as Error);
        throw error;
      }
    },
    [maxTimeout, showOverlayDelay, onSaveComplete, onSaveError, onTimeout, clearTimeouts]
  );

  return {
    isSaving,
    setIsSaving,
    saveWithTimeout,
    saveUntilComplete,
  };
};