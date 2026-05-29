import { useMemo } from 'react';
import { validateGroupName as validateGroupNameShared } from '@quilibrium/quorum-shared';
import { translateValidationResult } from './errorTranslator';

/**
 * Centralized group name validation logic
 * Used across: GroupEditorModal
 */
export const useGroupNameValidation = (groupName: string) => {
  const error = useMemo(
    () => translateValidationResult(validateGroupNameShared(groupName)),
    [groupName]
  );
  return { error, isValid: !error };
};

/**
 * Validation helper for group names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateGroupName = (groupName: string): string | undefined =>
  translateValidationResult(validateGroupNameShared(groupName));
