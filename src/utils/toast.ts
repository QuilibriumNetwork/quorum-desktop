/**
 * Toast notification utilities
 *
 * Simple helpers for displaying toast notifications via the event-based system.
 * Toasts are displayed in Layout.tsx which listens to 'quorum:toast' events.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastOptions {
  variant?: ToastVariant;
  /** Position toast at fixed bottom (for modals/settings). Default positions above MessageComposer. */
  bottomFixed?: boolean;
}

interface ToastDetail {
  id?: string;
  message: string;
  variant: ToastVariant;
  persistent?: boolean;
  /** Position toast at fixed bottom (for modals/settings). Default positions above MessageComposer. */
  bottomFixed?: boolean;
}

/**
 * Show a toast notification with the specified variant
 *
 * @param message - The message to display
 * @param variantOrOptions - The toast variant or options object
 */
export const showToast = (
  message: string,
  variantOrOptions: ToastVariant | ToastOptions = 'info'
): void => {
  if (typeof window === 'undefined') return;

  const options: ToastOptions =
    typeof variantOrOptions === 'string'
      ? { variant: variantOrOptions }
      : variantOrOptions;

  window.dispatchEvent(
    new CustomEvent<ToastDetail>('quorum:toast', {
      detail: {
        message,
        variant: options.variant || 'info',
        bottomFixed: options.bottomFixed,
      },
    })
  );
};

/**
 * Show a success toast notification
 *
 * @param message - The success message to display
 */
export const showSuccess = (message: string): void => {
  showToast(message, 'success');
};

/**
 * Show an error toast notification
 *
 * @param message - The error message to display
 */
export const showError = (message: string): void => {
  showToast(message, 'error');
};

/**
 * Show a warning toast notification
 *
 * @param message - The warning message to display
 */
export const showWarning = (message: string): void => {
  showToast(message, 'warning');
};

/**
 * Show an info toast notification
 *
 * @param message - The info message to display
 */
export const showInfo = (message: string): void => {
  showToast(message, 'info');
};

/**
 * Show a persistent toast that stays visible until manually dismissed
 *
 * @param id - Unique identifier for the toast (used for dismissal)
 * @param message - The message to display
 * @param variant - The toast variant (info, success, warning, error)
 * @param bottomFixed - Position toast at fixed bottom (for modals/settings)
 */
export const showPersistentToast = (
  id: string,
  message: string,
  variant: ToastVariant = 'info',
  bottomFixed?: boolean
): void => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<ToastDetail>('quorum:toast', {
      detail: { id, message, variant, persistent: true, bottomFixed },
    })
  );
};

/**
 * Dismiss a toast by its ID
 *
 * @param id - The ID of the toast to dismiss
 */
export const dismissToast = (id: string): void => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<{ id: string }>('quorum:toast-dismiss', {
      detail: { id },
    })
  );
};

// NOTE: the global "Syncing..." toast was removed on 2026-08-13. It fired from
// SyncService.requestSync(), which runs once per space on every connect, so it
// appeared on every refresh whether or not anything needed syncing — and it was
// a single global toast, not per-space. See
// .agents/issues/.open/2026-08-13-sync-indicator-needs-a-per-space-behind-by-signal.md
// for the diagnosis and the signal a future implementation should use.
//
// showPersistentToast / dismissToast above are deliberately kept: they are a
// general capability, not sync-specific.
