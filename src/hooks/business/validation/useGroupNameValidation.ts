import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS, MAX_NAME_LENGTH } from '../../../utils/validation';

/**
 * Centralized group name validation logic
 * Used across: GroupEditorModal
 */
export const useGroupNameValidation = (groupName: string) => {
  const error = useMemo(() => {
    if (!groupName.trim()) {
      return t`Group name is required`;
    }
    if (groupName.length > MAX_NAME_LENGTH) {
      return t`Group name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    if (!validateNameForXSS(groupName)) {
      return t`Group name cannot contain special characters`;
    }
    return undefined;
  }, [groupName]);

  const isValid = !error;

  return { error, isValid };
};

/**
 * Validation helper for group names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateGroupName = (groupName: string): string | undefined => {
  if (!groupName.trim()) {
    return t`Group name is required`;
  }
  if (groupName.length > MAX_NAME_LENGTH) {
    return t`Group name must be ${MAX_NAME_LENGTH} characters or less`;
  }
  if (!validateNameForXSS(groupName)) {
    return t`Group name cannot contain special characters`;
  }
  return undefined;
};