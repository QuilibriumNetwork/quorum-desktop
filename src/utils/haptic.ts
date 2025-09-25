/**
 * Cross-platform haptic feedback utilities
 * Provides vibration feedback for better touch device UX
 */

/**
 * Haptic feedback intensity levels
 */
export enum HapticIntensity {
  Light = 50,    // 50ms - subtle feedback for taps
  Medium = 100,  // 100ms - standard feedback for actions
  Heavy = 200,   // 200ms - strong feedback for important actions
}

/**
 * Triggers haptic feedback on supported devices
 * @param intensity - The intensity/duration of the vibration
 * @returns boolean indicating if vibration was triggered
 */
export function triggerHapticFeedback(
  intensity: HapticIntensity = HapticIntensity.Light
): boolean {
  // Check if vibration API is available
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Attempt to trigger vibration
      navigator.vibrate(intensity);
      return true;
    } catch (error) {
      // Silently fail if vibration is blocked by browser
      // This can happen due to permissions or browser settings
      console.debug('Haptic feedback blocked:', error);
      return false;
    }
  }

  return false;
}

/**
 * Triggers a light haptic feedback (50ms)
 * Commonly used for touch acknowledgment
 */
export function hapticLight(): boolean {
  return triggerHapticFeedback(HapticIntensity.Light);
}

/**
 * Triggers a medium haptic feedback (100ms)
 * Commonly used for standard interactions like long press
 */
export function hapticMedium(): boolean {
  return triggerHapticFeedback(HapticIntensity.Medium);
}

/**
 * Triggers a heavy haptic feedback (200ms)
 * Commonly used for important actions or errors
 */
export function hapticHeavy(): boolean {
  return triggerHapticFeedback(HapticIntensity.Heavy);
}

/**
 * Triggers a custom pattern of haptic feedback
 * @param pattern - Array of vibration durations and pauses
 * @returns boolean indicating if vibration was triggered
 */
export function hapticPattern(pattern: number[]): boolean {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.debug('Haptic pattern blocked:', error);
      return false;
    }
  }

  return false;
}

/**
 * Cancels any ongoing vibration
 */
export function cancelHaptic(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch (error) {
      // Silently ignore
    }
  }
}