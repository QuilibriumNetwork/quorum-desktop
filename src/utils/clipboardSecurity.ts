/**
 * Copying sensitive values (private keys) to the clipboard with auto-clear.
 *
 * Two execution paths:
 *
 * - **Electron app** — the preload exposes `electron.clipboard.copySecret`,
 *   which routes through the MAIN process (`clipboard:copy-secret` in
 *   web/electron/main.cjs). The main-process clipboard module has no document
 *   focus requirement, so the 60s compare-and-clear is reliable even when the
 *   user has switched to another app. Returns `'auto-clear'`.
 *
 * - **Plain web build** — Chromium forbids clipboard access (read AND write)
 *   from an unfocused document, and an unfocused page has no mechanism to
 *   clear the clipboard at all. Best effort: schedule a compare-and-clear at
 *   the deadline (works if our window happens to be focused) and retry once
 *   when the window regains focus. Returns `'best-effort'` so the UI can word
 *   its message honestly instead of promising a clear that may not happen.
 *
 * State is module-level on purpose: the clear lifecycle must survive the
 * settings modal unmounting right after the user copies.
 */

export const SENSITIVE_CLIPBOARD_CLEAR_MS = 60_000;

export type SensitiveCopyMode = 'auto-clear' | 'best-effort';

interface ElectronClipboardBridge {
  copySecret: (text: string) => Promise<number>;
}

function getElectronClipboard(): ElectronClipboardBridge | undefined {
  return (window as any).electron?.clipboard?.copySecret
    ? (window as any).electron.clipboard
    : undefined;
}

let cancelPendingWebClear: (() => void) | null = null;

function scheduleBestEffortWebClear(secret: string): void {
  // A newer copy supersedes any pending clear.
  cancelPendingWebClear?.();

  const deadline = Date.now() + SENSITIVE_CLIPBOARD_CLEAR_MS;

  const tryClear = async () => {
    // Focus regained before the deadline: keep the listener armed.
    if (Date.now() < deadline) return;
    cleanup();
    try {
      const current = await navigator.clipboard.readText();
      if (current === secret) {
        await navigator.clipboard.writeText('');
      }
    } catch {
      // Document unfocused or permission denied — a web page has no further
      // way to touch the clipboard. The UI never promised otherwise.
    }
  };

  const timer = setTimeout(tryClear, SENSITIVE_CLIPBOARD_CLEAR_MS);
  window.addEventListener('focus', tryClear);

  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener('focus', tryClear);
    cancelPendingWebClear = null;
  };
  cancelPendingWebClear = cleanup;
}

/**
 * Copy a sensitive value to the clipboard. Resolves with the mode that was
 * used so the caller can word its messaging accordingly.
 */
export async function copySensitiveText(
  text: string
): Promise<SensitiveCopyMode> {
  const electronClipboard = getElectronClipboard();
  if (electronClipboard) {
    await electronClipboard.copySecret(text);
    return 'auto-clear';
  }

  await navigator.clipboard.writeText(text);
  scheduleBestEffortWebClear(text);
  return 'best-effort';
}
