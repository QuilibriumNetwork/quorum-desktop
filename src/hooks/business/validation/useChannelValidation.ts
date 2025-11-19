import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { validateNameForXSS, MAX_NAME_LENGTH, MAX_TOPIC_LENGTH } from '../../../utils/validation';

/**
 * Centralized channel name validation logic
 * Used across: ChannelEditorModal
 */
export const useChannelNameValidation = (channelName: string) => {
  const error = useMemo(() => {
    if (!channelName.trim()) {
      return t`Channel name is required`;
    }
    if (channelName.length > MAX_NAME_LENGTH) {
      return t`Channel name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    if (!validateNameForXSS(channelName)) {
      return t`Channel name cannot contain special characters`;
    }
    return undefined;
  }, [channelName]);

  const isValid = !error;

  return { error, isValid };
};

/**
 * Centralized channel topic validation logic
 * Used across: ChannelEditorModal
 */
export const useChannelTopicValidation = (channelTopic: string) => {
  const error = useMemo(() => {
    if (channelTopic.length > MAX_TOPIC_LENGTH) {
      return t`Channel topic must be ${MAX_TOPIC_LENGTH} characters or less`;
    }
    if (channelTopic && !validateNameForXSS(channelTopic)) {
      return t`Channel topic cannot contain special characters`;
    }
    return undefined;
  }, [channelTopic]);

  const isValid = !error;

  return { error, isValid };
};

/**
 * Validation helper for channel names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateChannelName = (channelName: string): string | undefined => {
  if (!channelName.trim()) {
    return t`Channel name is required`;
  }
  if (channelName.length > MAX_NAME_LENGTH) {
    return t`Channel name must be ${MAX_NAME_LENGTH} characters or less`;
  }
  if (!validateNameForXSS(channelName)) {
    return t`Channel name cannot contain special characters`;
  }
  return undefined;
};

/**
 * Validation helper for channel topics (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateChannelTopic = (channelTopic: string): string | undefined => {
  if (channelTopic.length > MAX_TOPIC_LENGTH) {
    return t`Channel topic must be ${MAX_TOPIC_LENGTH} characters or less`;
  }
  if (channelTopic && !validateNameForXSS(channelTopic)) {
    return t`Channel topic cannot contain special characters`;
  }
  return undefined;
};