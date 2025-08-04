/**
 * Platform detection utilities for future React Native compatibility
 *
 * Since we're currently a web-only app, these return web values.
 * When we add React Native, we'll update this to use Platform from react-native.
 */

// For now, we're always on web
export const isWeb = true;
export const isNative = false;
export const isIOS = false;
export const isAndroid = false;

// Platform-specific selection helper
export function platformSelect<T>(options: {
  web?: T;
  native?: T;
  ios?: T;
  android?: T;
  default: T;
}): T {
  // Currently always returns web option or default
  return options.web ?? options.default;
}

// Mock Platform object for compatibility
export const Platform = {
  OS: 'web' as const,
  select: <T>(specifics: { web?: T; ios?: T; android?: T; default?: T }): T => {
    return (
      specifics.web ?? specifics.default ?? (Object.values(specifics)[0] as T)
    );
  },
};
