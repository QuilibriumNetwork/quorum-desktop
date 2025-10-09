import type { Message, Mentions } from '../api/quorumApi';

/**
 * Options for checking if a user is mentioned in a message
 */
export interface MentionCheckOptions {
  /** Current user's address */
  userAddress: string;
  /** User's role IDs (for future role mention support) */
  userRoles?: string[];
  /** Whether to check for @everyone mentions (for future support) */
  checkEveryone?: boolean;
}

/**
 * Type of mention found in a message
 */
export type MentionType = 'user' | 'role' | 'everyone' | null;

/**
 * Check if a user is mentioned in a message
 *
 * @param message - The message to check
 * @param options - User information for mention checking
 * @returns true if the user is mentioned in the message
 *
 * @example
 * const mentioned = isMentioned(message, {
 *   userAddress: 'QmV5xWMo5CYSxgAAy6emKFZZPCKwCsBZKZxXD3mCUZF2n'
 * });
 */
export function isMentioned(
  message: Message,
  options: MentionCheckOptions
): boolean {
  if (!message.mentions) return false;

  const { userAddress } = options;

  // Check if user is directly mentioned
  if (message.mentions.memberIds?.includes(userAddress)) {
    return true;
  }

  // Future: Check for role mentions when role system is implemented
  // if (userRoles.length > 0 && message.mentions.roleIds) {
  //   const hasRoleMention = userRoles.some(roleId =>
  //     message.mentions?.roleIds.includes(roleId)
  //   );
  //   if (hasRoleMention) return true;
  // }

  // Future: Check for @everyone mentions when implemented
  // if (checkEveryone && message.mentions.everyone) {
  //   return true;
  // }

  return false;
}

/**
 * Get the type of mention for a user in a message
 * Useful for filtering/categorizing mentions in notification UI (Phase 3)
 *
 * @param message - The message to check
 * @param options - User information for mention checking
 * @returns The type of mention, or null if not mentioned
 */
export function getMentionType(
  message: Message,
  options: MentionCheckOptions
): MentionType {
  if (!message.mentions) return null;

  const { userAddress } = options;

  // Check in priority order: user > role > everyone
  if (message.mentions.memberIds?.includes(userAddress)) {
    return 'user';
  }

  // Future: Check for role mentions
  // if (userRoles.length > 0 && message.mentions.roleIds) {
  //   const hasRoleMention = userRoles.some(roleId =>
  //     message.mentions?.roleIds.includes(roleId)
  //   );
  //   if (hasRoleMention) return 'role';
  // }

  // Future: Check for @everyone mentions
  // if (checkEveryone && message.mentions.everyone) {
  //   return 'everyone';
  // }

  return null;
}

/**
 * Extract mentions from message text
 * Parses @<address> format mentions and returns a Mentions object
 *
 * @param text - The message text to parse
 * @returns Mentions object with memberIds array populated
 *
 * @example
 * const text = "Hey @<QmAbc123> and @<QmDef456>, check this out!";
 * const mentions = extractMentionsFromText(text);
 * // Returns: { memberIds: ['QmAbc123', 'QmDef456'], roleIds: [], channelIds: [] }
 */
export function extractMentionsFromText(text: string): Mentions {
  const mentions: Mentions = {
    memberIds: [],
    roleIds: [],
    channelIds: [],
  };

  // Match @<address> pattern
  // The address is between @< and >
  const mentionRegex = /@<([^>]+)>/g;
  const matches = text.matchAll(mentionRegex);

  for (const match of matches) {
    const address = match[1];
    if (address && !mentions.memberIds.includes(address)) {
      mentions.memberIds.push(address);
    }
  }

  return mentions;
}
