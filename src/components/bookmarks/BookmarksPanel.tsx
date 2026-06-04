import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import type { Bookmark, Sticker } from '@quilibrium/quorum-shared';
import { buildMessageHash } from '../../utils/messageHashNavigation';
import { BookmarkItem } from './BookmarkItem';
import {
  Flex,
  Icon,
} from '../primitives';
import { DropdownPanel } from '../ui';
import { useBookmarks } from '../../hooks/business/bookmarks';
import { useSearchContext } from '../../hooks/useSearchContext';
import { isTouchDevice } from '../../utils/platform';
import './BookmarksPanel.scss';

interface BookmarksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  stickers?: { [key: string]: Sticker };
  // Props for MessagePreview rendering in BookmarkItem
  mapSenderToUser?: (senderId: string) => any;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  isOpen,
  onClose,
  userAddress,
  stickers,
  mapSenderToUser,
}) => {
  const navigate = useNavigate();

  // Panel is always scoped to the current route's context (this space or this
  // conversation). The global "all bookmarks" view lives on the /bookmarks page.
  const searchContext = useSearchContext();

  const {
    isLoading,
    error,
    removeBookmark,
    filterByConversation,
    filterByCurrentSpace,
  } = useBookmarks({ userAddress });

  const filteredBookmarks = useMemo(() => {
    if (searchContext.type === 'dm' && searchContext.conversationId && searchContext.conversationId !== 'general') {
      return filterByConversation(searchContext.conversationId);
    }
    if (searchContext.type === 'space' && searchContext.spaceId && searchContext.spaceId !== 'default') {
      return filterByCurrentSpace(searchContext.spaceId);
    }
    return [];
  }, [searchContext, filterByConversation, filterByCurrentSpace]);

  const contextCount = filteredBookmarks.length;

  // Handle navigation to bookmark - uses hash-based highlighting (cross-component communication)
  const handleJumpToMessage = useCallback((bookmark: Bookmark) => {
    // Close the panel first
    onClose();

    // Build compound hash for thread-aware navigation
    const hash = buildMessageHash(bookmark.messageId, bookmark.threadId);

    // Navigate with hash - destination MessageList handles scroll and Message detects hash for highlighting
    if (bookmark.sourceType === 'channel') {
      navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}${hash}`);
    } else {
      // For DMs: extract address from conversationId (format: "address/address")
      const dmAddress = bookmark.conversationId?.split('/')[0];
      navigate(`/messages/${dmAddress}${hash}`);
    }

    // Clean up hash after highlight animation completes (8s matches CSS animation)
    setTimeout(() => {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }, 8000);
  }, [navigate, onClose]);

  const handleRemoveBookmark = useCallback((bookmarkId: string) => {
    removeBookmark(bookmarkId);
  }, [removeBookmark]);

  const handleSeeAll = useCallback(() => {
    onClose();
    navigate('/bookmarks');
  }, [navigate, onClose]);

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <Flex justify="center" align="center" className="bookmark-empty-state">
          <Icon name="loader" className="empty-icon animate-spin" />
          <span className="empty-message">{t`Loading bookmarks...`}</span>
        </Flex>
      );
    }

    if (error) {
      return (
        <Flex justify="center" align="center" className="bookmark-empty-state">
          <Icon name="alert-triangle" className="empty-icon text-danger" />
          <span className="empty-message">{t`Failed to load bookmarks`}</span>
        </Flex>
      );
    }

    return null;
  }, [isLoading, error]);

  // Render bookmark list
  const renderBookmarkList = useCallback(() => {
    if (isLoading || error || filteredBookmarks.length === 0) {
      return renderEmptyState();
    }

    // Mobile layout
    if (isTouchDevice()) {
      return (
        <div className="mobile-drawer__item-list mobile-drawer__item-list--with-controls">
          {filteredBookmarks.map((bookmark) => (
            <div
              key={bookmark.bookmarkId}
              className="mobile-drawer__item-box mobile-drawer__item-box--interactive"
            >
              <BookmarkItem
                bookmark={bookmark}
                onJumpToMessage={handleJumpToMessage}
                onRemoveBookmark={handleRemoveBookmark}
                stickers={stickers}
                mapSenderToUser={mapSenderToUser}
                compactDate={isTouchDevice()}
              />
            </div>
          ))}
        </div>
      );
    }

    // Desktop layout with virtualization - fix height issue
    return (
      <div className="bookmarks-list" style={{ height: '400px', minHeight: '200px' }}>
        <Virtuoso
          data={filteredBookmarks}
          itemContent={(index, bookmark) => (
            <div className="panel-item-box panel-item-box--hoverable">
              <BookmarkItem
                bookmark={bookmark}
                onJumpToMessage={handleJumpToMessage}
                onRemoveBookmark={handleRemoveBookmark}
                stickers={stickers}
                mapSenderToUser={mapSenderToUser}
                compactDate={isTouchDevice()}
              />
            </div>
          )}
          style={{ height: '100%' }}
        />
      </div>
    );
  }, [isLoading, error, filteredBookmarks, renderEmptyState, handleJumpToMessage, handleRemoveBookmark, stickers, mapSenderToUser]);

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={Math.min(window.innerHeight * 0.8, 600)}
      title={
        contextCount === 1
          ? t`${contextCount} bookmark here`
          : t`${contextCount} bookmarks here`
      }
      className="bookmarks-panel"
      showCloseButton={true}
    >
      {renderBookmarkList()}
      <button
        type="button"
        className="bookmarks-panel__see-all"
        onClick={handleSeeAll}
      >
        {t`See all bookmarks`}
        <Icon name="arrow-right" size="sm" />
      </button>
    </DropdownPanel>
  );
};