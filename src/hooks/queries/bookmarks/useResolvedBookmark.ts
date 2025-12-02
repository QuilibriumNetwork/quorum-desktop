import { useQuery } from '@tanstack/react-query';
import type { Bookmark, Message } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';

/**
 * Resolves a bookmark to its full message from local IndexedDB.
 *
 * Used for hybrid rendering in BookmarkItem:
 * - If message found → render with MessagePreview (full render)
 * - If not found → render with cachedPreview (fallback)
 *
 * No API calls - only local DB lookup (~1-5ms).
 * Message may not exist if:
 * - Cross-device sync (message not on this device)
 * - Channel/DM not loaded yet
 * - Message was deleted
 */
export const useResolvedBookmark = (
  bookmark: Bookmark | undefined,
  enabled: boolean = true
) => {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: ['resolvedBookmark', bookmark?.messageId],
    queryFn: async (): Promise<Message | null> => {
      if (!bookmark?.messageId) return null;

      // Use getMessageById for context-free lookup
      const message = await messageDB.getMessageById(bookmark.messageId);
      return message || null;
    },
    enabled: enabled && !!bookmark?.messageId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};
