/**
 * Utility functions for channel operations
 */

import type { Channel } from '../api/quorumApi';

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
 *   console.log('Found channel:', channel.channelId);
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