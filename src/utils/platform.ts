/**
 * Platform detection utilities for cross-platform development
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
 * Check if running in React Native/mobile environment
 */
export function isMobile(): boolean {
  // Will be true when running in React Native
  // @ts-ignore - React Native global
  return (
    typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
  );
}

/**
 * Alias for isMobile() for backward compatibility
 */
export function isNative(): boolean {
  return isMobile();
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
 * Get the current platform as a string
 */
export function getPlatform(): 'web' | 'mobile' | 'electron' {
  if (isMobile()) return 'mobile';
  if (isElectron()) return 'electron';
  return 'web';
}

/**
 * Mobile-safe scrolling options for cross-platform compatibility
 */
export interface MobileSafeScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

/**
 * Safely scroll an element into view with mobile-optimized behavior
 * Handles inconsistencies across mobile browsers and provides fallbacks
 */
export function safeMobileScrollIntoView(
  element: Element,
  options: MobileSafeScrollOptions = {}
): void {
  const { behavior = 'auto', block = 'center', inline = 'nearest' } = options;

  // For mobile devices, use more conservative scrolling to avoid issues
  const isMobileDevice = isTouchDevice();

  try {
    if (isMobileDevice) {
      // On mobile, use auto behavior to prevent jarring animations
      // and use 'nearest' block positioning to minimize scroll distance
      element.scrollIntoView({
        behavior: 'auto',
        block: block === 'center' ? 'nearest' : block,
        inline,
      });
    } else {
      // On desktop, we can use the requested behavior
      element.scrollIntoView({
        behavior,
        block,
        inline,
      });
    }
  } catch (error) {
    // Fallback for older browsers that don't support options
    element.scrollIntoView(behavior === 'smooth');
  }
}

/**
 * Check if smooth scrolling is supported and advisable for current platform
 */
export function supportsSmoothScrolling(): boolean {
  if (typeof window === 'undefined') return false;

  // Smooth scrolling can be problematic on some mobile browsers
  // and lower-end devices, so be conservative
  const isMobileDevice = isTouchDevice();

  if (isMobileDevice) {
    // Only enable smooth scrolling on modern mobile browsers
    const supportsScrollBehavior =
      'scrollBehavior' in document.documentElement.style;
    return supportsScrollBehavior;
  }

  // Desktop browsers generally handle smooth scrolling well
  return true;
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

/**
 * Platform-specific feature flags
 */
export const platformFeatures = {
  hasFileSystem: isElectron(),
  hasNativeNotifications: isElectron() || isMobile(),
  hasCamera: isMobile(),
  hasDeepLinking: isMobile() || isElectron(),
  hasPushNotifications: isMobile(),
  hasTouch: typeof window !== 'undefined' ? isTouchDevice() : false,
  supportsSmoothScrolling:
    typeof window !== 'undefined' ? supportsSmoothScrolling() : false,
};
