import { MessageDB } from '../../../db/messages';
import type { Message } from '@quilibrium/quorum-shared';

/**
 * Loads messages around a specific target message using bidirectional pagination.
 *
 * This utility is used for hash navigation to old messages that may not be in the
 * currently loaded message set. It fetches messages before and after the target
 * to provide context around the navigation target.
 *
 * @param messageDB - Database instance
 * @param spaceId - Space ID
 * @param channelId - Channel ID
 * @param targetMessageId - Message ID to load around
 * @param beforeLimit - Number of messages to load before target (default: 40)
 * @param afterLimit - Number of messages to load after target (default: 40)
 * @returns Combined message list with target message and surrounding context
 */
export async function loadMessagesAround({
  messageDB,
  spaceId,
  channelId,
  targetMessageId,
  beforeLimit = 40,
  afterLimit = 40,
  includeThreadReplies = false,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  targetMessageId: string;
  beforeLimit?: number;
  afterLimit?: number;
  includeThreadReplies?: boolean;
}): Promise<{
  messages: Message[];
  targetMessage: Message;
  prevCursor: number | null;
  nextCursor: number | null;
}> {
  // First, get the target message to obtain its timestamp
  const targetMessage = await messageDB.getMessage({
    spaceId,
    channelId,
    messageId: targetMessageId,
  });

  if (!targetMessage) {
    throw new Error(`Message ${targetMessageId} not found`);
  }

  const targetTimestamp = targetMessage.createdDate;

  // Load messages before target (older messages)
  const beforeResponse = await messageDB.getMessages({
    spaceId,
    channelId,
    cursor: targetTimestamp,
    direction: 'backward',
    limit: beforeLimit,
    includeThreadReplies,
  });

  // Load messages after target (newer messages)
  const afterResponse = await messageDB.getMessages({
    spaceId,
    channelId,
    cursor: targetTimestamp,
    direction: 'forward',
    limit: afterLimit,
    includeThreadReplies,
  });

  // Combine messages: before (chronological) + target + after (chronological)
  // beforeResponse.messages are already in chronological order (oldest to newest)
  // afterResponse.messages are also in chronological order
  // The target message itself is not included in either response (cursor is exclusive)
  // Note: getMessages() already filters isThreadReply, but the target is fetched via
  // getMessage() which doesn't filter — so exclude thread replies from the target
  const messages = [
    ...beforeResponse.messages,
    ...(targetMessage.isThreadReply && !includeThreadReplies ? [] : [targetMessage]),
    ...afterResponse.messages,
  ];

  return {
    messages,
    targetMessage,
    prevCursor: beforeResponse.prevCursor,
    nextCursor: afterResponse.nextCursor,
  };
}
