import type { Message, Mentions } from '../api/quorumApi';
import { createIPFSCIDRegex } from './validation';

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
 * Check if a mention has proper word boundaries (whitespace before and after)
 * This ensures mentions only render when they are standalone tokens, not part of markdown syntax
 *
 * @param text - The full text being searched
 * @param match - The regex match object containing the mention
 * @returns true if the mention has whitespace boundaries
 *
 * @example
 * hasWordBoundaries("Hello @user", match) // true - space before, end of string after
 * hasWordBoundaries("**@user**", match) // false - asterisks before and after
 * hasWordBoundaries("[text](@user)", match) // false - parenthesis before, bracket after
 */
export function hasWordBoundaries(text: string, match: RegExpMatchArray): boolean {
  const beforeChar = match.index && match.index > 0 ? text[match.index - 1] : '\n';
  const afterIndex = match.index! + match[0].length;
  const afterChar = afterIndex < text.length ? text[afterIndex] : '\n';

  // Check if both characters are whitespace, punctuation, or end-of-string
  // This prevents mentions inside markdown syntax like **@user** or [@user](link)
  // but allows mentions at sentence ends like "@user!" or "@user."
  const isValidBoundary = (char: string) => /[\s.,!?;:\n]/.test(char);

  return isValidBoundary(beforeChar) && isValidBoundary(afterChar);
}

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
 * Check if a user is mentioned in a message, respecting notification settings
 *
 * This function filters mentions based on user preferences (Phase 4).
 * Only mentions of enabled types will trigger notifications.
 *
 * @param message - The message to check
 * @param options - Configuration for mention checking
 * @param options.userAddress - Current user's address
 * @param options.enabledTypes - Array of enabled notification types using unified format (e.g., ['mention-you', 'mention-everyone'])
 * @param options.userRoles - Optional: User's role IDs (for future role mention support)
 * @returns true if user is mentioned based on enabled settings
 *
 * @example
 * // Check with only personal mentions enabled
 * const mentioned = isMentionedWithSettings(message, {
 *   userAddress: 'QmAbc123',
 *   enabledTypes: ['mention-you']
 * });
 *
 * @example
 * // Check with all mention types enabled
 * const mentioned = isMentionedWithSettings(message, {
 *   userAddress: 'QmAbc123',
 *   enabledTypes: ['mention-you', 'mention-everyone', 'mention-roles']
 * });
 *
 * @see .agents/tasks/mention-notification-settings-phase4.md
 */
export function isMentionedWithSettings(
  message: Message,
  options: {
    userAddress: string;
    enabledTypes: string[];
    userRoles?: string[];
  }
): boolean {
  const { userAddress, enabledTypes, userRoles = [] } = options;
  const mentions = message.mentions;

  if (!mentions) return false;

  // Check personal mentions (@you)
  if (enabledTypes.includes('mention-you')) {
    if (mentions.memberIds?.includes(userAddress)) {
      return true;
    }
  }

  // Check @everyone mentions
  if (enabledTypes.includes('mention-everyone')) {
    if (mentions.everyone === true) {
      return true;
    }
  }

  // Check role mentions (@roles - Phase 2b)
  if (enabledTypes.includes('mention-roles') && mentions.roleIds && userRoles.length > 0) {
    const hasRoleMention = userRoles.some(roleId =>
      mentions.roleIds?.includes(roleId)
    );
    if (hasRoleMention) {
      return true;
    }
  }

  return false;
}

/**
 * Maximum number of mentions allowed per message to prevent spam
 */
export const MAX_MENTIONS_PER_MESSAGE = 20;


/**
 * Extract mentions from message text
 * Parses @<address> format mentions, @roleTag mentions, @everyone, and #<channelId> mentions
 *
 * @param text - The message text to parse
 * @param options - Optional configuration for mention extraction
 * @param options.allowEveryone - Whether the user has permission to use @everyone (default: false)
 * @param options.spaceRoles - Array of roles for validation (for role mention extraction)
 * @param options.spaceChannels - Array of channels for validation (for channel mention extraction)
 * @returns Mentions object with memberIds, roleIds, channelIds, and everyone fields populated
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
 *
 * @example
 * const text = "Hey @moderators and @admins, please review!";
 * const mentions = extractMentionsFromText(text, { spaceRoles: [...] });
 * // Returns: { memberIds: [], roleIds: ['role-id-1', 'role-id-2'], channelIds: [] }
 *
 * @example
 * const text = "Check out #<ch-abc123> and #<ch-def456> for updates!";
 * const mentions = extractMentionsFromText(text, { spaceChannels: [...] });
 * // Returns: { memberIds: [], roleIds: [], channelIds: ['ch-abc123', 'ch-def456'] }
 */
export function extractMentionsFromText(
  text: string,
  options?: {
    allowEveryone?: boolean;
    spaceRoles?: Array<{ roleId: string; roleTag: string }>;
    spaceChannels?: Array<{ channelId: string; channelName: string }>;
  }
): Mentions {
  const mentions: Mentions = {
    memberIds: [],
    roleIds: [],
    channelIds: [],
  };

  // Rate limiting: Count mentions as we process them
  let totalMentionCount = 0;

  // Count and extract @everyone mentions
  if (/@everyone\b/i.test(text)) {
    const everyoneMatches = Array.from(text.matchAll(/@everyone\b/gi));
    for (const match of everyoneMatches) {
      if (hasWordBoundaries(text, match)) {
        totalMentionCount++; // Count @everyone syntax (always count for rate limiting)
        if (options?.allowEveryone) {
          mentions.everyone = true; // Only extract if user has permission
        }
        break; // Only need to find one valid @everyone
      }
    }
  }

  // Count and extract user mentions: @<anything>
  // For rate limiting: count any @<...> syntax
  // For extraction: validate IPFS CID format
  const userMentionSyntaxRegex = /@<[^>]+>/g;
  const userSyntaxMatches = Array.from(text.matchAll(userMentionSyntaxRegex));

  // Count all @<...> syntax for rate limiting (stop at MAX+1 for efficiency)
  for (const match of userSyntaxMatches) {
    if (hasWordBoundaries(text, match)) {
      totalMentionCount++; // Count any @<...> syntax
      if (totalMentionCount > MAX_MENTIONS_PER_MESSAGE) break; // Early exit optimization
    }
  }

  // Extract valid user mentions (with IPFS CID validation)
  const cidPattern = createIPFSCIDRegex().source;
  const validUserMentionRegex = new RegExp(`@<(${cidPattern})>`, 'g');
  const validUserMatches = Array.from(text.matchAll(validUserMentionRegex));

  for (const match of validUserMatches) {
    const address = match[1];
    if (address && hasWordBoundaries(text, match)) {
      // Only add to array if not already included (for notification purposes)
      if (!mentions.memberIds.includes(address)) {
        mentions.memberIds.push(address);
      }
    }
  }

  // Count and extract role mentions: @roleTag (NO brackets)
  // For rate limiting: count any @roleTag syntax (except @everyone)
  // For extraction: validate against actual space roles
  const roleMentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const roleMatches = Array.from(text.matchAll(roleMentionRegex));

  for (const match of roleMatches) {
    const possibleRoleTag = match[1];

    // Skip 'everyone' (already handled above)
    if (possibleRoleTag.toLowerCase() === 'everyone') continue;

    // Count all @roleTag syntax for rate limiting (stop at MAX+1 for efficiency)
    if (hasWordBoundaries(text, match)) {
      totalMentionCount++; // Count any @roleTag syntax
      if (totalMentionCount > MAX_MENTIONS_PER_MESSAGE) break; // Early exit optimization
    }
  }

  // Extract valid role mentions (validate against actual space roles)
  if (options?.spaceRoles && options.spaceRoles.length > 0) {
    for (const match of roleMatches) {
      const possibleRoleTag = match[1];

      // Skip 'everyone' (already handled above)
      if (possibleRoleTag.toLowerCase() === 'everyone') continue;

      // Only process roles that have proper word boundaries
      if (!hasWordBoundaries(text, match)) continue;

      // Validate against space roles (case-insensitive)
      const role = options.spaceRoles.find(
        r => r.roleTag.toLowerCase() === possibleRoleTag.toLowerCase()
      );

      // Only add valid roles to array (for notifications)
      if (role && !mentions.roleIds.includes(role.roleId)) {
        mentions.roleIds.push(role.roleId);
      }
    }
  }

  // Count and extract channel mentions: #<anything>
  // For rate limiting: count any #<...> syntax
  // For extraction: validate against actual space channels
  const channelMentionRegex = /#<([^>]+)>/g;
  const channelMatches = Array.from(text.matchAll(channelMentionRegex));

  // Count all #<...> syntax for rate limiting (stop at MAX+1 for efficiency)
  for (const match of channelMatches) {
    if (hasWordBoundaries(text, match)) {
      totalMentionCount++; // Count any #<...> syntax
      if (totalMentionCount > MAX_MENTIONS_PER_MESSAGE) break; // Early exit optimization
    }
  }

  // Extract valid channel mentions (validate against actual space channels)
  if (options?.spaceChannels && options.spaceChannels.length > 0) {
    for (const match of channelMatches) {
      const possibleChannelId = match[1];

      // Only process channel mentions that have proper word boundaries
      if (!hasWordBoundaries(text, match)) continue;

      // Match by ID only (exact match for rename-safety)
      const channel = options.spaceChannels.find(c => c.channelId === possibleChannelId);

      // Only add valid channels to array (for notifications)
      if (channel && !mentions.channelIds.includes(channel.channelId)) {
        mentions.channelIds.push(channel.channelId);
      }
    }
  }

  // Set the total mention count (for validation)
  mentions.totalMentionCount = totalMentionCount;

  return mentions;
}
