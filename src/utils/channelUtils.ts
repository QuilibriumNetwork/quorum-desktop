/**
 * Utility functions for channel operations
 */

import { logger } from '@quilibrium/quorum-shared';
import type { Channel } from '../api/quorumApi';
import type { UserConfig } from '../db/messages';

/**
 * Find a channel by name in a list of channels
 * Uses case-insensitive matching for better user experience
 *
 * @param channelName - The channel name to search for
 * @param channels - Array of channels to search in
 * @returns The found channel or undefined if not found
 *
 * @example
 * const channel = findChannelByName('general', channels);
 * if (channel) {
 *   logger.log('Found channel:', channel.channelId);
 * }
 */
export function findChannelByName(
  channelName: string,
  channels: Channel[]
): Channel | undefined {
  if (!channelName || !channels || channels.length === 0) {
    return undefined;
  }

  const nameLower = channelName.toLowerCase();

  return channels.find(
    channel => channel.channelName.toLowerCase() === nameLower
  );
}

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