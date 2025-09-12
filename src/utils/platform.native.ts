/**
 * Platform detection utilities for React Native
 */

import { Platform as RNPlatform } from 'react-native';

/**
 * Check if running in a web browser environment
 */
export function isWeb(): boolean {
  return RNPlatform.OS === 'web';
}

/**
 * Check if running in React Native/mobile environment
 */
export function isMobile(): boolean {
  return RNPlatform.OS !== 'web';
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
  // Not applicable in React Native
  return false;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return __DEV__;
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return !__DEV__;
}

/**
 * Get the current platform as a string
 */
export function getPlatform(): 'web' | 'mobile' | 'electron' {
  if (isMobile()) return 'mobile';
  return 'web';
}

/**
 * Platform-specific feature flags
 */
export const platformFeatures = {
  hasFileSystem: false,
  hasNativeNotifications: true,
  hasCamera: true,
  hasDeepLinking: true,
  hasPushNotifications: true,
};

// React Native specific exports
export const isIOS = RNPlatform.OS === 'ios';
export const isAndroid = RNPlatform.OS === 'android';

// Platform-specific selection helper
export function platformSelect<T>(options: {
  web?: T;
  native?: T;
  ios?: T;
  android?: T;
  default: T;
}): T {
  if (isWeb && options.web !== undefined) return options.web;
  if (isIOS && options.ios !== undefined) return options.ios;
  if (isAndroid && options.android !== undefined) return options.android;
  if (isNative && options.native !== undefined) return options.native;
  return options.default;
}

// Re-export React Native Platform for convenience
export const Platform = RNPlatform;
