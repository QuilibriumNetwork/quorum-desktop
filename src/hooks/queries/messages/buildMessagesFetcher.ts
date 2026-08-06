import { MessageDB } from '../../../db/messages';
import { wrapPaginatedFetcher } from '../../utils';
import { isWeb } from '../../../utils/platform';

/**
 * Determine the initial cursor for loading messages in a channel.
 *
 * This function decides where to start loading messages from:
 * - If there's a hash navigation (#msg-{messageId}), load from bottom (hash will override)
 * - If there are unread messages, load from the first unread
 * - Otherwise, load from bottom (normal behavior)
 *
 * @returns The cursor timestamp + 1 (to include the target message), or null to load from bottom
 */
async function determineInitialCursor({
  messageDB,
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}): Promise<number | null> {
  // Check if there's a hash navigation (web only)
  // Skip auto-jump if URL has a message hash target
  if (isWeb() && typeof window !== 'undefined') {
    const hasMessageHash =
      window.location.hash && window.location.hash.startsWith('#msg-');
    if (hasMessageHash) {
      return null; // Load from bottom, let hash navigation handle it
    }
  }

  const conversationId = `${spaceId}/${channelId}`;

  // Get last read timestamp
  const { conversation } = await messageDB.getConversation({ conversationId });
  const lastReadTimestamp = conversation?.lastReadTimestamp || 0;

  // No read pointer yet — a channel that has never been opened, or a fresh
  // device. Treating that as "everything is unread" anchors the jump on the
  // OLDEST message in the channel, which is the opposite of useful: the first
  // page then holds just that one message. Channel.tsx's own auto-jump effect
  // already bails out on this exact condition; the fetcher has to agree with
  // it, otherwise the two disagree about where the channel starts.
  if (lastReadTimestamp === 0) {
    return null; // Load from bottom
  }

  // Get first unread message
  const firstUnread = await messageDB.getFirstUnreadMessage({
    spaceId,
    channelId,
    afterTimestamp: lastReadTimestamp,
    includeThreadReplies,
  });

  // Jump to first unread, or load from bottom if none
  // NOTE: The +1 is because getMessages() excludes the cursor value itself
  return firstUnread ? firstUnread.timestamp + 1 : null;
}

const buildMessagesFetcher = ({
  messageDB,
  spaceId,
  channelId,
  includeThreadReplies = false,
}: {
  messageDB: MessageDB;
  spaceId: string;
  channelId: string;
  includeThreadReplies?: boolean;
}) =>
  wrapPaginatedFetcher(async ({ pageParam: cursor }) => {
    // On initial load (no cursor), determine where to start
    let effectiveCursor: number | undefined = cursor?.cursor;
    if (!cursor) {
      const initialCursor = await determineInitialCursor({
        messageDB,
        spaceId,
        channelId,
        includeThreadReplies,
      });
      effectiveCursor = initialCursor ?? undefined;
    }

    const response = await messageDB.getMessages({
      spaceId,
      channelId,
      cursor: effectiveCursor,
      direction: cursor?.direction,
      includeThreadReplies,
    });

    return response;
  });

export { buildMessagesFetcher };
