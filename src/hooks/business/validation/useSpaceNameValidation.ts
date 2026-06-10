import { useMemo } from 'react';
import {
  validateSpaceName as validateSpaceNameShared,
  validateSpaceDescription as validateSpaceDescriptionShared,
  validateUserBio as validateUserBioShared,
  validateUserNote as validateUserNoteShared,
  MAX_BIO_BYTES,
  MAX_USER_NOTE_LENGTH,
} from '@quilibrium/quorum-shared';
import {
  translateValidationResult,
  translateValidationResults,
} from './errorTranslator';

// Re-export shared constants so existing consumers that import them from
// this module continue to work.
export { MAX_BIO_BYTES, MAX_USER_NOTE_LENGTH };

/**
 * Coarse character cap for the bio <textarea maxLength>. The real limit is
 * MAX_BIO_BYTES (256 UTF-8 bytes), which a single `maxLength` number can't
 * express — one emoji is up to 4 bytes. We set the input's hard cap to the
 * byte budget interpreted as characters: for ASCII it matches exactly, and for
 * multi-byte text it's a generous upper bound that never blocks valid input —
 * validateUserBio surfaces the real byte-overflow error first. It only stops a
 * user from typing an absurdly long all-ASCII bio.
 */
export const MAX_BIO_INPUT_CHARS = MAX_BIO_BYTES;

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
