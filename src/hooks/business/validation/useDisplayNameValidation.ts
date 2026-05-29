import { useMemo } from 'react';
import { validateDisplayName as validateDisplayNameShared } from '@quilibrium/quorum-shared';
import { translateValidationResult } from './errorTranslator';

/**
 * Centralized display name validation logic
 * Used across: Onboarding, UserSettingsModal, SpaceSettingsModal
 */
export const useDisplayNameValidation = (displayName: string) => {
  const error = useMemo(
    () => translateValidationResult(validateDisplayNameShared(displayName)),
    [displayName]
  );
  return { error, isValid: !error };
};

/**
 * Validation helper for display names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateDisplayName = (displayName: string): string | undefined =>
  translateValidationResult(validateDisplayNameShared(displayName));
