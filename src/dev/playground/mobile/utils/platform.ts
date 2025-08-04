/**
 * Platform detection utilities for React Native
 */

import { Platform as RNPlatform } from 'react-native';

// Platform detection based on React Native
export const isWeb = RNPlatform.OS === 'web';
export const isNative = RNPlatform.OS !== 'web';
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