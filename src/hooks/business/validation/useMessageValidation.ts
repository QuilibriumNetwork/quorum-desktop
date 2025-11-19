import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { MAX_MESSAGE_LENGTH } from '../../../utils/validation';

/**
 * Message validation hook for character limits in MessageComposer
 * Shows counter at 80% threshold, changes to danger color when exceeded
 */
export const useMessageValidation = (message: string) => {
  const validationState = useMemo(() => {
    const messageLength = message.length;
    const thresholdLength = Math.floor(MAX_MESSAGE_LENGTH * 0.8); // 80% = 1600 chars

    const isOverLimit = messageLength > MAX_MESSAGE_LENGTH;
    const isApproachingLimit = messageLength >= thresholdLength && !isOverLimit;
    const shouldShowCounter = messageLength >= thresholdLength;
    const remainingChars = MAX_MESSAGE_LENGTH - messageLength;

    return {
      isOverLimit,
      isApproachingLimit,
      shouldShowCounter,
      remainingChars,
      messageLength,
      maxLength: MAX_MESSAGE_LENGTH,
      thresholdLength,
      isValid: !isOverLimit,
    };
  }, [message]);

  return validationState;
};

/**
 * Non-hook version for use in callbacks and non-component contexts
 */
export const validateMessageLength = (message: string): boolean => {
  return message.length <= MAX_MESSAGE_LENGTH;
};

/**
 * Get character counter display text
 */
export const getMessageCounterText = (messageLength: number): string => {
  return `${messageLength}/${MAX_MESSAGE_LENGTH}`;
};