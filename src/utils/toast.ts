/**
 * Toast notification utilities
 *
 * Simple helpers for displaying toast notifications via the event-based system.
 * Toasts are displayed in Layout.tsx which listens to 'quorum:toast' events.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastDetail {
  message: string;
  variant: ToastVariant;
}

/**
 * Show a toast notification with the specified variant
 *
 * @param message - The message to display
 * @param variant - The toast variant (info, success, warning, error)
 */
export const showToast = (message: string, variant: ToastVariant = 'info'): void => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<ToastDetail>('quorum:toast', {
      detail: { message, variant },
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
