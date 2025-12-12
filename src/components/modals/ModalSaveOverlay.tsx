import * as React from 'react';
import { useState, useEffect } from 'react';
import { Icon } from '../primitives';
import { t } from '@lingui/core/macro';

interface ModalSaveOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Custom message to display (defaults to "Saving...") */
  message?: string;
  /** Optional className for additional styling */
  className?: string;
  /** Enable progressive messages for long operations (default: true) */
  enableProgressiveMessages?: boolean;
}

/**
 * Modal Save Overlay Component
 *
 * Displays a semi-transparent overlay with a spinner and message during async operations.
 * Commonly used in modals to prevent user interaction while processing.
 *
 * Features progressive messages that update as the operation takes longer, providing
 * friendly feedback to users during extended waits.
 *
 * IMPORTANT: When using this overlay, always implement a timeout failsafe to prevent
 * users from being stuck indefinitely if the operation hangs. Use the useModalSaveState
 * hook which provides automatic timeout handling (default 30 seconds).
 *
 * @example
 * ```tsx
 * // For saving with timeout protection (recommended)
 * const { isSaving, saveUntilComplete } = useModalSaveState({
 *   maxTimeout: 30000, // 30 seconds max
 *   onSaveError: (err) => setSaveError(err.message),
 *   onTimeout: () => setSaveError('Operation timed out. Please try again.')
 * });
 *
 * <ModalSaveOverlay visible={isSaving} message="Saving..." />
 *
 * // For other operations
 * <ModalSaveOverlay visible={isDeleting} message="Deleting..." />
 * <ModalSaveOverlay visible={isProcessing} message="Processing..." />
 * <ModalSaveOverlay visible={isUploading} message="Uploading files..." />
 *
 * // Disable progressive messages if needed
 * <ModalSaveOverlay visible={isSaving} enableProgressiveMessages={false} />
 * ```
 */
const ModalSaveOverlay: React.FC<ModalSaveOverlayProps> = ({
  visible,
  message = t`Saving...`,
  className = '',
  enableProgressiveMessages = true,
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    if (!visible) {
      setCurrentMessage(message);
      return;
    }

    setCurrentMessage(message);

    if (!enableProgressiveMessages) {
      return;
    }

    // Progressive message timeouts
    const timeouts: NodeJS.Timeout[] = [];

    // 3 seconds - Still working
    timeouts.push(
      setTimeout(() => {
        setCurrentMessage(t`Almost done...`);
      }, 3000)
    );

    // 8 seconds - Hang in there
    timeouts.push(
      setTimeout(() => {
        setCurrentMessage(t`Hang in there...`);
      }, 8000)
    );

    // 13 seconds - This is embarrassing
    timeouts.push(
      setTimeout(() => {
        setCurrentMessage(t`This is embarrassing...`);
      }, 15000)
    );

    // 18 seconds - Timeout warning
    timeouts.push(
      setTimeout(() => {
        setCurrentMessage(t`Timeout in 10 seconds anyway...`);
      }, 20000)
    );

    // Cleanup function
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, enableProgressiveMessages]);

  if (!visible) return null;

  return (
    <div className={`modal-save-overlay ${className}`}>
      <div className="modal-save-backdrop" />
      <div className="modal-save-content">
        <Icon
          name="spinner"
          size={24}
          className="modal-save-spinner icon-spin"
        />
        <div className="modal-save-text">{currentMessage}</div>
      </div>
    </div>
  );
};

export default ModalSaveOverlay;