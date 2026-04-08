import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS, MAX_NAME_LENGTH } from '@quilibrium/quorum-shared';

// Allowed: unicode letters, unicode digits, spaces, hyphens, parentheses, apostrophes
const DEVICE_NAME_PATTERN = /^[\p{L}\p{N} \-()']+$/u;

/**
 * Non-hook validator — usable in callbacks and async contexts.
 */
export function validateDeviceName(name: string): string | undefined {
  if (!name.trim()) {
    return t`Device name cannot be empty`;
  }
  if (name.length > MAX_NAME_LENGTH) {
    return t`Device name must be ${MAX_NAME_LENGTH} characters or less`;
  }
  if (!validateNameForXSS(name)) {
    return t`Device name cannot contain HTML`;
  }
  if (!DEVICE_NAME_PATTERN.test(name)) {
    return t`Device name can only contain letters, numbers, spaces, hyphens, and parentheses`;
  }
  return undefined;
}

/**
 * React hook for real-time device name validation.
 */
export function useDeviceNameValidation(name: string) {
  const error = useMemo(() => validateDeviceName(name), [name]);
  return { error, isValid: !error };
}
