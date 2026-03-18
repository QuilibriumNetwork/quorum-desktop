/**
 * Utility functions for channel operations
 */

import type { UserConfig } from '../db/messages';

// Re-export findChannelByName from shared so existing consumers don't break
export { findChannelByName } from '@quilibrium/quorum-shared';

/**
 * Check if a channel is muted for a specific space
 *
 * @param spaceId - The space ID to check
 * @param channelId - The channel ID to check
 * @param mutedChannels - The mutedChannels object from UserConfig
 * @returns true if the channel is muted, false otherwise
 *
 * @example
 * const isMuted = isChannelMuted('space-123', 'channel-abc', userConfig?.mutedChannels);
 * if (isMuted) {
 *   console.log('Channel is muted');
 * }
 */
export function isChannelMuted(
  spaceId: string,
  channelId: string,
  mutedChannels?: UserConfig['mutedChannels']
): boolean {
  if (!mutedChannels || !spaceId || !channelId) {
    return false;
  }

  const spaceMutedChannels = mutedChannels[spaceId];
  if (!spaceMutedChannels || !Array.isArray(spaceMutedChannels)) {
    return false;
  }

  return spaceMutedChannels.includes(channelId);
}

/**
 * Get all muted channel IDs for a specific space
 *
 * @param spaceId - The space ID to get muted channels for
 * @param mutedChannels - The mutedChannels object from UserConfig
 * @returns Array of muted channel IDs (empty array if none)
 *
 * @example
 * const mutedIds = getMutedChannelsForSpace('space-123', userConfig?.mutedChannels);
 * const visibleChannels = allChannels.filter(ch => !mutedIds.includes(ch.channelId));
 */
export function getMutedChannelsForSpace(
  spaceId: string,
  mutedChannels?: UserConfig['mutedChannels']
): string[] {
  if (!mutedChannels || !spaceId) {
    return [];
  }

  const spaceMutedChannels = mutedChannels[spaceId];
  if (!spaceMutedChannels || !Array.isArray(spaceMutedChannels)) {
    return [];
  }

  return spaceMutedChannels;
}