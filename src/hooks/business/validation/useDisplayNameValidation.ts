import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS, MAX_NAME_LENGTH } from '../../../utils/validation';

/**
 * Centralized display name validation logic
 * Used across: Onboarding, UserSettingsModal, SpaceSettingsModal
 */
export const useDisplayNameValidation = (displayName: string) => {
  const error = useMemo(() => {
    if (!displayName.trim()) {
      return t`Display name is required`;
    }
    if (displayName.length > MAX_NAME_LENGTH) {
      return t`Display name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    if (displayName.trim().toLowerCase() === 'everyone') {
      return t`'everyone' is a reserved name.`;
    }
    if (!validateNameForXSS(displayName)) {
      return t`Display name cannot contain special characters`;
    }
    return undefined;
  }, [displayName]);

  const isValid = !error;

  return { error, isValid };
};

/**
 * Validation helper for display names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateDisplayName = (displayName: string): string | undefined => {
  if (!displayName.trim()) {
    return t`Display name is required`;
  }
  if (displayName.length > MAX_NAME_LENGTH) {
    return t`Display name must be ${MAX_NAME_LENGTH} characters or less`;
  }
  if (displayName.trim().toLowerCase() === 'everyone') {
    return t`'everyone' is a reserved name.`;
  }
  if (!validateNameForXSS(displayName)) {
    return t`Display name cannot contain special characters`;
  }
  return undefined;
};
