import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBookmarks as useBookmarksQuery } from '../../queries/bookmarks/useBookmarks';
import { useInvalidateBookmarks } from '../../queries/bookmarks/useInvalidateBookmarks';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { Bookmark, Message, BOOKMARKS_CONFIG } from '../../../api/quorumApi';

export interface BookmarkContext {
  spaceId?: string;
  channelId?: string;
  conversationId?: string;
}

interface UseBookmarksOptions {
  userAddress: string;
}

export const useBookmarks = ({ userAddress }: UseBookmarksOptions) => {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();
  const invalidateBookmarks = useInvalidateBookmarks();

  // Fetch bookmarks data
  const { data: bookmarks = [], isLoading, error } = useBookmarksQuery({ userAddress });

  // State for preventing rapid toggle race conditions
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

  // Computed values for O(1) lookup
  const bookmarkedMessageIds = useMemo(
    () => new Set(bookmarks.map(b => b.messageId)),
    [bookmarks]
  );

  const bookmarkCount = bookmarks.length;
  const canAddBookmark = bookmarkCount < BOOKMARKS_CONFIG.MAX_BOOKMARKS;

  // Helper to create bookmark from message
  const createBookmarkFromMessage = useCallback((
    message: Message,
    sourceType: 'channel' | 'dm',
    context: BookmarkContext,
    senderName: string,
    sourceName: string
  ): Bookmark => {
    // Extract text content for preview
    let textSnippet = '';
    if (message.content.type === 'post') {
      const text = message.content.text;
      textSnippet = Array.isArray(text) ? text.join(' ') : text;
    } else if (message.content.type === 'event') {
      textSnippet = message.content.text;
    }

    // Truncate to snippet length
    if (textSnippet.length > BOOKMARKS_CONFIG.PREVIEW_SNIPPET_LENGTH) {
      textSnippet = textSnippet.substring(0, BOOKMARKS_CONFIG.PREVIEW_SNIPPET_LENGTH) + '...';
    }

    return {
      bookmarkId: crypto.randomUUID(),
      messageId: message.messageId,
      spaceId: context.spaceId,
      channelId: context.channelId,
      conversationId: context.conversationId,
      sourceType,
      createdAt: Date.now(),
      cachedPreview: {
        senderAddress: message.content.senderId,
        senderName,
        textSnippet,
        messageDate: message.createdDate,
        sourceName,
      },
    };
  }, []);

  // Add bookmark mutation
  const addBookmarkMutation = useMutation({
    mutationFn: async (bookmark: Bookmark) => {
      await messageDB.addBookmark(bookmark);
    },
    onMutate: async (newBookmark) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', userAddress] });
      const previousBookmarks = queryClient.getQueryData(['bookmarks', userAddress]);
      queryClient.setQueryData(['bookmarks', userAddress], (old: Bookmark[] = []) => {
        return [newBookmark, ...old];
      });
      return { previousBookmarks };
    },
    onError: (err, newBookmark, context) => {
      queryClient.setQueryData(['bookmarks', userAddress], context?.previousBookmarks);
    },
    onSettled: () => {
      invalidateBookmarks({ userAddress });
    },
  });

  // Remove bookmark mutation
  const removeBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      await messageDB.removeBookmark(bookmarkId);
    },
    onMutate: async (bookmarkId) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', userAddress] });
      const previousBookmarks = queryClient.getQueryData(['bookmarks', userAddress]);
      queryClient.setQueryData(['bookmarks', userAddress], (old: Bookmark[] = []) => {
        return old.filter(b => b.bookmarkId !== bookmarkId);
      });
      return { previousBookmarks };
    },
    onError: (err, bookmarkId, context) => {
      queryClient.setQueryData(['bookmarks', userAddress], context?.previousBookmarks);
    },
    onSettled: () => {
      invalidateBookmarks({ userAddress });
    },
  });

  // Add bookmark function
  const addBookmark = useCallback((
    message: Message,
    sourceType: 'channel' | 'dm',
    context: BookmarkContext,
    senderName: string = 'Unknown User',
    sourceName: string = 'Unknown Source'
  ) => {
    if (!canAddBookmark) {
      console.warn('Cannot add bookmark: limit reached');
      return;
    }

    const bookmark = createBookmarkFromMessage(message, sourceType, context, senderName, sourceName);
    addBookmarkMutation.mutate(bookmark);
  }, [canAddBookmark, createBookmarkFromMessage, addBookmarkMutation]);

  // Remove bookmark function
  const removeBookmark = useCallback((bookmarkId: string) => {
    removeBookmarkMutation.mutate(bookmarkId);
  }, [removeBookmarkMutation]);

  // Toggle bookmark function with debounce
  const toggleBookmark = useCallback((
    message: Message,
    sourceType: 'channel' | 'dm',
    context: BookmarkContext,
    senderName: string = 'Unknown User',
    sourceName: string = 'Unknown Source'
  ) => {
    if (pendingToggles.has(message.messageId)) {
      return; // Ignore if pending
    }

    setPendingToggles(prev => new Set(prev).add(message.messageId));

    const existingBookmark = bookmarks.find(b => b.messageId === message.messageId);

    const mutation = existingBookmark ? removeBookmarkMutation : addBookmarkMutation;
    const mutationData = existingBookmark
      ? existingBookmark.bookmarkId
      : createBookmarkFromMessage(message, sourceType, context, senderName, sourceName);

    if (!existingBookmark && !canAddBookmark) {
      setPendingToggles(prev => {
        const next = new Set(prev);
        next.delete(message.messageId);
        return next;
      });
      console.warn('Cannot add bookmark: limit reached');
      return;
    }

    mutation.mutate(mutationData, {
      onSettled: () => {
        setPendingToggles(prev => {
          const next = new Set(prev);
          next.delete(message.messageId);
          return next;
        });
      }
    });
  }, [pendingToggles, bookmarks, removeBookmarkMutation, addBookmarkMutation, canAddBookmark, createBookmarkFromMessage]);

  // Helper functions
  const isBookmarked = useCallback(
    (messageId: string) => bookmarkedMessageIds.has(messageId),
    [bookmarkedMessageIds]
  );

  const isPending = useCallback(
    (messageId: string) => pendingToggles.has(messageId),
    [pendingToggles]
  );

  // Filtering functions
  const filterBySourceType = useCallback((type: 'channel' | 'dm' | 'all') => {
    if (type === 'all') return bookmarks;
    return bookmarks.filter(bookmark => bookmark.sourceType === type);
  }, [bookmarks]);

  const filterBySpace = useCallback((spaceId: string) => {
    return bookmarks.filter(bookmark => bookmark.spaceId === spaceId);
  }, [bookmarks]);

  return {
    // Queries
    bookmarks,
    bookmarkCount,
    isLoading,
    error,

    // Computed
    bookmarkedMessageIds,

    // Mutations
    addBookmark,
    removeBookmark,
    toggleBookmark,
    canAddBookmark,
    isPending,

    // Helpers
    isBookmarked,

    // Filtering
    filterBySourceType,
    filterBySpace,
  };
};