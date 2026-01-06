import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS, MAX_NAME_LENGTH } from '../../../utils/validation';

/**
 * Maximum length for user bio/description
 * Matches mobile app limit for consistency
 */
export const MAX_BIO_LENGTH = 160;

/**
 * Centralized space name validation logic
 * Used across: CreateSpaceModal, SpaceSettingsModal/General
 */
export const useSpaceNameValidation = (spaceName: string) => {
  const error = useMemo(() => {
    if (!spaceName.trim()) {
      return t`Space name is required`;
    }
    if (spaceName.length > MAX_NAME_LENGTH) {
      return t`Space name must be ${MAX_NAME_LENGTH} characters or less`;
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
  if (spaceName.length > MAX_NAME_LENGTH) {
    return t`Space name must be ${MAX_NAME_LENGTH} characters or less`;
  }
  if (!validateNameForXSS(spaceName)) {
    return t`Space name cannot contain special characters`;
  }
  return undefined;
};

/**
 * Validation helper for space descriptions (non-hook version)
 * Can be used in callbacks and non-component contexts
 *
 * @param description - The description to validate
 * @param maxLength - Maximum allowed length for the description
 * @returns Array of error messages (empty if valid)
 */
export const validateSpaceDescription = (
  description: string,
  maxLength: number
): string[] => {
  const errors: string[] = [];

  if (!validateNameForXSS(description)) {
    errors.push(t`Description cannot contain special characters`);
  }

  if (description.length > maxLength) {
    errors.push(t`Description must be ${maxLength} characters or less`);
  }

  return errors;
};

/**
 * Validation helper for user bio (non-hook version)
 * Can be used in callbacks and non-component contexts
 *
 * @param bio - The bio to validate
 * @returns Array of error messages (empty if valid)
 */
export const validateUserBio = (bio: string): string[] => {
  const errors: string[] = [];

  if (!validateNameForXSS(bio)) {
    errors.push(t`Bio cannot contain special characters`);
  }

  if (bio.length > MAX_BIO_LENGTH) {
    errors.push(t`Bio must be ${MAX_BIO_LENGTH} characters or less`);
  }

  return errors;
};
