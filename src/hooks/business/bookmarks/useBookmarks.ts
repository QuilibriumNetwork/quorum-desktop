import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBookmarks as useBookmarksQuery } from '../../queries/bookmarks/useBookmarks';
import { useInvalidateBookmarks } from '../../queries/bookmarks/useInvalidateBookmarks';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { Bookmark, Message, BOOKMARKS_CONFIG } from '../../../api/quorumApi';
import { stripMarkdownAndMentions } from '../../../utils/markdownStripping';

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
    // Determine content type and extract relevant data
    let contentType: 'text' | 'image' | 'sticker' = 'text';
    let textSnippet = '';
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let stickerId: string | undefined;

    if (message.content.type === 'embed') {
      // Image/embed content
      contentType = 'image';
      imageUrl = message.content.imageUrl;
      thumbnailUrl = message.content.thumbnailUrl;
    } else if (message.content.type === 'sticker') {
      // Sticker content
      contentType = 'sticker';
      stickerId = message.content.stickerId;
    } else if (message.content.type === 'post') {
      // Text content
      contentType = 'text';
      const text = message.content.text;
      textSnippet = Array.isArray(text) ? text.join(' ') : text;
    } else if (message.content.type === 'event') {
      contentType = 'text';
      textSnippet = message.content.text;
    }

    // Strip markdown and mentions for clean plain text preview
    if (textSnippet) {
      textSnippet = stripMarkdownAndMentions(textSnippet);

      // Truncate to snippet length
      if (textSnippet.length > BOOKMARKS_CONFIG.PREVIEW_SNIPPET_LENGTH) {
        textSnippet = textSnippet.substring(0, BOOKMARKS_CONFIG.PREVIEW_SNIPPET_LENGTH) + '...';
      }
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
        contentType,
        imageUrl,
        thumbnailUrl,
        stickerId,
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
    onError: (_err, _newBookmark, context) => {
      queryClient.setQueryData(['bookmarks', userAddress], context?.previousBookmarks);
    },
    onSettled: () => {
      invalidateBookmarks({ userAddress });
    },
  });

  // Remove bookmark mutation
  const removeBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      // Remove bookmark from IndexedDB
      await messageDB.removeBookmark(bookmarkId);

      // Track deletion for sync (Phase 7: Critical Fix)
      const config = await messageDB.getUserConfig({ address: userAddress });
      if (config) {
        config.deletedBookmarkIds = config.deletedBookmarkIds || [];
        config.deletedBookmarkIds.push(bookmarkId);
        await messageDB.saveUserConfig(config);
      }
    },
    onMutate: async (bookmarkId) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', userAddress] });
      const previousBookmarks = queryClient.getQueryData(['bookmarks', userAddress]);
      queryClient.setQueryData(['bookmarks', userAddress], (old: Bookmark[] = []) => {
        return old.filter(b => b.bookmarkId !== bookmarkId);
      });
      return { previousBookmarks };
    },
    onError: (_err, _bookmarkId, context) => {
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
    // Validate bookmark limit
    if (!canAddBookmark) {
      console.warn('Cannot add bookmark: limit reached');
      return;
    }

    // Validate message structure
    if (!message || !message.messageId || !message.content) {
      console.warn('Cannot add bookmark: invalid message structure');
      return;
    }

    // Validate context consistency with sourceType
    if (sourceType === 'channel' && (!context.spaceId || !context.channelId)) {
      console.warn('Cannot add bookmark: channel bookmark requires spaceId and channelId');
      return;
    }
    if (sourceType === 'dm' && !context.conversationId) {
      console.warn('Cannot add bookmark: DM bookmark requires conversationId');
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
    // Validate message structure first (before accessing messageId)
    if (!message || !message.messageId || !message.content) {
      console.warn('Cannot toggle bookmark: invalid message structure');
      return;
    }

    // Validate context consistency with sourceType
    if (sourceType === 'channel' && (!context.spaceId || !context.channelId)) {
      console.warn('Cannot toggle bookmark: channel bookmark requires spaceId and channelId');
      return;
    }
    if (sourceType === 'dm' && !context.conversationId) {
      console.warn('Cannot toggle bookmark: DM bookmark requires conversationId');
      return;
    }

    if (pendingToggles.has(message.messageId)) {
      return; // Ignore if pending
    }

    setPendingToggles(prev => new Set(prev).add(message.messageId));

    const existingBookmark = bookmarks.find(b => b.messageId === message.messageId);

    if (existingBookmark) {
      // Remove existing bookmark
      removeBookmarkMutation.mutate(existingBookmark.bookmarkId, {
        onSettled: () => {
          setPendingToggles(prev => {
            const next = new Set(prev);
            next.delete(message.messageId);
            return next;
          });
        }
      });
    } else {
      // Add new bookmark
      if (!canAddBookmark) {
        setPendingToggles(prev => {
          const next = new Set(prev);
          next.delete(message.messageId);
          return next;
        });
        console.warn('Cannot add bookmark: limit reached');
        return;
      }

      const newBookmark = createBookmarkFromMessage(message, sourceType, context, senderName, sourceName);
      addBookmarkMutation.mutate(newBookmark, {
        onSettled: () => {
          setPendingToggles(prev => {
            const next = new Set(prev);
            next.delete(message.messageId);
            return next;
          });
        }
      });
    }
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


  // New filtering functions for context-aware filtering
  const filterByConversation = useCallback((conversationId: string) => {
    return bookmarks.filter(bookmark => bookmark.conversationId === conversationId);
  }, [bookmarks]);

  const filterByCurrentSpace = useCallback((spaceId: string, channelId?: string) => {
    if (channelId) {
      // Filter by specific channel within space
      return bookmarks.filter(bookmark =>
        bookmark.spaceId === spaceId && bookmark.channelId === channelId
      );
    } else {
      // Filter by entire space (all channels)
      return bookmarks.filter(bookmark => bookmark.spaceId === spaceId);
    }
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
    filterByConversation,
    filterByCurrentSpace,
  };
};