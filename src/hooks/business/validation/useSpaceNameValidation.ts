import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS } from '../../../utils/validation';

/**
 * Centralized space name validation logic
 * Used across: CreateSpaceModal, SpaceSettingsModal/General
 */
export const useSpaceNameValidation = (spaceName: string) => {
  const error = useMemo(() => {
    if (!spaceName.trim()) {
      return t`Space name is required`;
    }
    if (!validateNameForXSS(spaceName)) {
      return t`Space name cannot contain special characters`;
    }
    return undefined;
  }, [spaceName]);

  const isValid = !error;

  return { error, isValid };
};

/**
 * Validation helper for space names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateSpaceName = (spaceName: string): string | undefined => {
  if (!spaceName.trim()) {
    return t`Space name is required`;
  }
  if (!validateNameForXSS(spaceName)) {
    return t`Space name cannot contain special characters`;
  }
  return undefined;
};
