/**
 * Cursor utilities for indicating heavy operations to users
 *
 * When sync is enabled, crypto operations can block the main thread for several seconds.
 * These utilities help communicate that state to users via cursor changes.
 */

/**
 * Global flag to disable wait cursor feature.
 * Set to true to disable the wait cursor throughout the app.
 */
export const WAIT_CURSOR_DISABLED = false;

/**
 * Wraps an async function with a wait cursor.
 * Shows hourglass cursor before the operation starts, resets when done.
 *
 * Uses requestAnimationFrame to ensure cursor change paints before blocking starts.
 *
 * @example
 * await withWaitCursor(() => saveConfig({ config, keyset }));
 */
export const withWaitCursor = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (WAIT_CURSOR_DISABLED) {
    return fn();
  }

  document.body.style.cursor = 'wait';

  // Give browser a frame to paint the cursor change before blocking
  await new Promise(r => requestAnimationFrame(r));

  try {
    return await fn();
  } finally {
    document.body.style.cursor = 'default';
  }
};

/**
 * Sets the cursor to wait state. Call resetCursor() when done.
 * Useful when you need more control over timing.
 */
export const setWaitCursor = (): void => {
  document.body.style.cursor = 'wait';
};

/**
 * Resets cursor to default state.
 */
export const resetCursor = (): void => {
  document.body.style.cursor = 'default';
};
