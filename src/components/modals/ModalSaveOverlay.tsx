import * as React from 'react';
import { Icon } from '../primitives';
import { t } from '@lingui/core/macro';

interface ModalSaveOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Custom message to display (defaults to "Saving...") */
  message?: string;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Modal Save Overlay Component
 *
 * Displays a semi-transparent overlay with a spinner and message during async operations.
 * Commonly used in modals to prevent user interaction while processing.
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
 * ```
 */
const ModalSaveOverlay: React.FC<ModalSaveOverlayProps> = ({
  visible,
  message = t`Saving...`,
  className = '',
}) => {
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
        <div className="modal-save-text">{message}</div>
      </div>
    </div>
  );
};

export default ModalSaveOverlay;