import { logger, generateMessagePreview } from '@quilibrium/quorum-shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Conversation } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';

/** The only thing this query owns: the rendered text/icon for a last message. */
export interface ConversationPreview {
  preview: string;
  previewIcon?: string;
}

/** conversationId -> preview payload. */
export type ConversationPreviewMap = Record<string, ConversationPreview>;

const EMPTY_PREVIEW: ConversationPreview = { preview: '', previewIcon: undefined };

/** Rows a caller can ask previews for — nothing else is read off them. */
type PreviewInput = Pick<Conversation, 'conversationId' | 'lastMessageId'>;

/**
 * Loads the last-message preview for each conversation, cached by
 * `conversationId:lastMessageId`.
 *
 * It returns ONLY the preview payload, deliberately. It used to return
 * `{ ...conv, preview, previewIcon }` — a full copy of every conversation row —
 * and the DM sidebar rendered that copy. Because the cache key moves only when a
 * `lastMessageId` changes, every other field on the copy froze at the moment the
 * query last ran: reading a DM advances `lastReadTimestamp` without touching any
 * message id, so the list kept rendering the pre-read snapshot and the unread dot
 * never cleared. The same trap had already swallowed `primaryUsername`.
 *
 * Keeping the payload narrow removes the trap for every current and future field:
 * caller-side state is never copied in here, so it can never go stale in here.
 * Merge onto the live rows at render time with {@link withPreviews}.
 */
export function useConversationPreviews(conversations: PreviewInput[]) {
  const { messageDB } = useMessageDB();

  // Create a stable reference for the query key - only changes when lastMessageIds change
  const messageIdMap = useMemo(
    () => Object.fromEntries(conversations.map((c) => [c.conversationId, c.lastMessageId])),
    [conversations.map((c) => `${c.conversationId}:${c.lastMessageId}`).join(',')]
  );

  return useQuery<ConversationPreviewMap>({
    queryKey: ['conversation-previews', messageIdMap],
    queryFn: async () => {
      // Batch fetch all messages for better performance
      const previewPromises = conversations.map(
        async (conv): Promise<[string, ConversationPreview]> => {
          if (!conv.lastMessageId) return [conv.conversationId, EMPTY_PREVIEW];

          try {
            // Extract spaceId and channelId from conversationId (format: "spaceId/channelId")
            const [spaceId, channelId] = conv.conversationId.split('/');

            const message = await messageDB.getMessage({
              spaceId,
              channelId,
              messageId: conv.lastMessageId,
            });

            const previewData = generateMessagePreview(message);
            return [
              conv.conversationId,
              { preview: previewData.text, previewIcon: previewData.icon },
            ];
          } catch (error) {
            logger.warn('Failed to load preview:', conv.conversationId, error);
            return [conv.conversationId, EMPTY_PREVIEW];
          }
        }
      );

      // Execute all queries in parallel with a limit to avoid overwhelming IndexedDB
      // Process in chunks of 10 to balance performance and avoid browser limits
      const entries: [string, ConversationPreview][] = [];
      for (let i = 0; i < previewPromises.length; i += 10) {
        const chunk = await Promise.all(previewPromises.slice(i, i + 10));
        entries.push(...chunk);
      }
      return Object.fromEntries(entries);
    },
    enabled: conversations.length > 0 && !!messageDB,
    staleTime: 30000, // 30 seconds - prevents refetch on focus/mount
    gcTime: 300000, // 5 minutes - keep in cache longer for better performance
    refetchOnWindowFocus: false, // Prevent refetch when user switches tabs
  });
}

/**
 * Attaches the cached preview payload to live conversation rows.
 *
 * The rows win on every field they carry: the preview map contributes text and
 * icon and nothing else, so read state, timestamps and identity always come from
 * the caller's current data.
 */
export function withPreviews<T extends { conversationId: string }>(
  conversations: T[],
  previews: ConversationPreviewMap | undefined
): (T & ConversationPreview)[] {
  return conversations.map((c) => ({
    ...c,
    ...(previews?.[c.conversationId] ?? EMPTY_PREVIEW),
  }));
}
