import { useMemo } from 'react';
import {
  validateSpaceName as validateSpaceNameShared,
  validateSpaceDescription as validateSpaceDescriptionShared,
  validateUserBio as validateUserBioShared,
  validateUserNote as validateUserNoteShared,
  MAX_BIO_LENGTH,
  MAX_USER_NOTE_LENGTH,
} from '@quilibrium/quorum-shared';
import {
  translateValidationResult,
  translateValidationResults,
} from './errorTranslator';

// Re-export shared constants so existing consumers that import them from
// this module continue to work.
export { MAX_BIO_LENGTH, MAX_USER_NOTE_LENGTH };

/**
 * Centralized space name validation logic
 * Used across: CreateSpaceModal, SpaceSettingsModal/General
 */
export const useSpaceNameValidation = (spaceName: string) => {
  const error = useMemo(
    () => translateValidationResult(validateSpaceNameShared(spaceName)),
    [spaceName]
  );
  return { error, isValid: !error };
};

/**
 * Validation helper for space names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateSpaceName = (spaceName: string): string | undefined =>
  translateValidationResult(validateSpaceNameShared(spaceName));

/**
 * Validation helper for space descriptions (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateSpaceDescription = (
  description: string,
  maxLength: number
): string[] =>
  translateValidationResults(validateSpaceDescriptionShared(description, maxLength));

/**
 * Validation helper for user bio (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateUserBio = (bio: string): string[] =>
  translateValidationResults(validateUserBioShared(bio));

/**
 * Validation helper for user note (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateUserNote = (note: string): string[] =>
  translateValidationResults(validateUserNoteShared(note));
