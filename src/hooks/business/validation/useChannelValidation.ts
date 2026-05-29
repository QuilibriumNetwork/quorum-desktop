import { useMemo } from 'react';
import {
  validateChannelName as validateChannelNameShared,
  validateChannelTopic as validateChannelTopicShared,
} from '@quilibrium/quorum-shared';
import { translateValidationResult } from './errorTranslator';

/**
 * Centralized channel name validation logic
 * Used across: ChannelEditorModal
 */
export const useChannelNameValidation = (channelName: string) => {
  const error = useMemo(
    () => translateValidationResult(validateChannelNameShared(channelName)),
    [channelName]
  );
  return { error, isValid: !error };
};

/**
 * Centralized channel topic validation logic
 * Used across: ChannelEditorModal
 */
export const useChannelTopicValidation = (channelTopic: string) => {
  const error = useMemo(
    () => translateValidationResult(validateChannelTopicShared(channelTopic)),
    [channelTopic]
  );
  return { error, isValid: !error };
};

/**
 * Validation helper for channel names (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateChannelName = (channelName: string): string | undefined =>
  translateValidationResult(validateChannelNameShared(channelName));

/**
 * Validation helper for channel topics (non-hook version)
 * Can be used in callbacks and non-component contexts
 */
export const validateChannelTopic = (channelTopic: string): string | undefined =>
  translateValidationResult(validateChannelTopicShared(channelTopic));
