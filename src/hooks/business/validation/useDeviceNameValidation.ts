import { useMemo } from 'react';
import { validateDeviceName as validateDeviceNameShared } from '@quilibrium/quorum-shared';
import { translateValidationResult } from './errorTranslator';

/**
 * Non-hook validator — usable in callbacks and async contexts.
 */
export function validateDeviceName(name: string): string | undefined {
  return translateValidationResult(validateDeviceNameShared(name));
}

/**
 * React hook for real-time device name validation.
 */
export function useDeviceNameValidation(name: string) {
  const error = useMemo(() => validateDeviceName(name), [name]);
  return { error, isValid: !error };
}
