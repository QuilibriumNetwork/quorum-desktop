/**
 * Utility functions for message link detection and parsing
 * Uses centralized environment detection from environmentDomains.ts
 */

import { buildValidPrefixes } from './environmentDomains';

export interface MessageLinkInfo {
  spaceId: string;
  channelId: string;
  messageId: string;
  isRelative: boolean;
}

/**
 * Get valid message link prefixes based on current environment
 * Uses centralized domain detection
 */
export function getValidMessageLinkPrefixes(): string[] {
  return buildValidPrefixes('/spaces/');
}

/**
 * Parse message link URL into components
 * Returns null if not a valid message link
 */
export function parseMessageLink(url: string): MessageLinkInfo | null {
  // Match: [prefix]/spaces/{spaceId}/{channelId}#msg-{messageId}
  const regex = /\/spaces\/([^\/]+)\/([^#]+)#msg-([a-zA-Z0-9_-]+)$/;
  const match = url.match(regex);

  if (!match) return null;

  return {
    spaceId: match[1],
    channelId: match[2],
    messageId: match[3],
    isRelative: url.startsWith('/'),
  };
}

/**
 * Check if a URL is a message link (convenience function)
 */
export function isMessageLink(url: string): boolean {
  return parseMessageLink(url) !== null;
}
