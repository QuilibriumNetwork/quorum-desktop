/**
 * Platform detection utilities.
 *
 * This app targets web browsers and Electron only. React Native detection used
 * to live here, from when the mobile app was going to be built in this repo;
 * it was removed in 2026-08 along with the rest of that scaffolding. Note that
 * the `isMobile` used throughout the components is a different thing entirely —
 * it comes from `useResponsiveLayout()` and means "narrow viewport", not
 * "running on a phone".
 */

/**
 * Check if running in a web browser environment
 */
export function isWeb(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.document !== 'undefined'
  );
}

/**
 * Check if running in Electron desktop environment
 */
export function isElectron(): boolean {
  // Check for Electron user agent
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent &&
    navigator.userAgent.includes('Electron')
  ) {
    return true;
  }

  // Check for Electron process
  // @ts-ignore - Electron global
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.electron
  ) {
    return true;
  }

  // Check for Electron window object
  // @ts-ignore - Electron global
  if (typeof window !== 'undefined' && window.electron) {
    return true;
  }

  return false;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Detect if the current device supports touch input
 * Uses multiple detection methods for maximum compatibility
 * @returns true if device supports touch, false otherwise
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * Check if a feature flag is enabled via environment variable
 * Supports both Vite (VITE_*) and Node.js/Electron (process.env.*) patterns
 *
 * Usage: Set VITE_ENABLE_EDIT_HISTORY=true or ENABLE_EDIT_HISTORY=true in your environment
 */
export function isFeatureEnabled(featureName: string): boolean {
  const envKey = featureName.toUpperCase().replace(/-/g, '_');
  const viteKey = `VITE_${envKey}`;

  // Try import.meta.env for Vite first (primary way in Vite)
  try {
    // Access import.meta.env directly - Vite exposes it at compile time
    // @ts-ignore - import.meta.env is available in Vite but TypeScript types may not include custom vars
    const viteEnv = import.meta.env;
    if (viteEnv) {
      // Check with VITE_ prefix (Vite convention)
      if (viteEnv[viteKey] !== undefined) {
        const value = viteEnv[viteKey];
        return value === 'true' || value === true || value === '1' || value === 1;
      }
    }
  } catch (error) {
    // Silently fall through to process.env check
  }

  // Fallback to process.env (works for Node.js/Electron and some Vite polyfills)
  if (typeof process !== 'undefined' && process.env) {
    // Check with VITE_ prefix first (Vite convention)
    if (process.env[viteKey] !== undefined) {
      const value = process.env[viteKey];
      return value === 'true' || value === '1';
    }
    // Fallback to check without VITE_ prefix (for Node.js/Electron)
    if (process.env[envKey] !== undefined) {
      const value = process.env[envKey];
      return value === 'true' || value === '1';
    }
  }

  return false;
}
