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

  // Check for @everyone mentions
  if (options.checkEveryone && message.mentions.everyone) {
    return true;
  }

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

  // Check for @everyone mentions
  if (options.checkEveryone && message.mentions.everyone) {
    return 'everyone';
  }

  return null;
}

/**
 * Extract mentions from message text
 * Parses @<address> format mentions and returns a Mentions object
 *
 * @param text - The message text to parse
 * @param options - Optional configuration for mention extraction
 * @param options.allowEveryone - Whether the user has permission to use @everyone (default: false)
 * @returns Mentions object with memberIds array populated
 *
 * @example
 * const text = "Hey @<QmAbc123> and @<QmDef456>, check this out!";
 * const mentions = extractMentionsFromText(text);
 * // Returns: { memberIds: ['QmAbc123', 'QmDef456'], roleIds: [], channelIds: [] }
 *
 * @example
 * const text = "Hey @everyone, important announcement!";
 * const mentions = extractMentionsFromText(text, { allowEveryone: true });
 * // Returns: { memberIds: [], roleIds: [], channelIds: [], everyone: true }
 */
export function extractMentionsFromText(
  text: string,
  options?: { allowEveryone?: boolean }
): Mentions {
  const mentions: Mentions = {
    memberIds: [],
    roleIds: [],
    channelIds: [],
  };

  // Remove code blocks (both inline and fenced) before processing mentions
  // This prevents @everyone in code examples from triggering notifications
  const textWithoutCodeBlocks = text
    .replace(/```[\s\S]*?```/g, '') // Remove fenced code blocks
    .replace(/`[^`]+`/g, '');        // Remove inline code

  // Check for @everyone mention (only if user has permission)
  if (/@everyone\b/i.test(textWithoutCodeBlocks)) {
    if (options?.allowEveryone) {
      mentions.everyone = true;
    }
    // If allowEveryone is false/undefined, @everyone is ignored (not extracted)
  }

  // Match @<address> pattern in text without code blocks
  const mentionRegex = /@<([^>]+)>/g;
  const matches = Array.from(textWithoutCodeBlocks.matchAll(mentionRegex));

  for (const match of matches) {
    const address = match[1];
    if (address && !mentions.memberIds.includes(address)) {
      mentions.memberIds.push(address);
    }
  }

  return mentions;
}
