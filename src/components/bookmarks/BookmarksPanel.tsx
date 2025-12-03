import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import type { Bookmark, Sticker, Role, Channel } from '../../api/quorumApi';
import { BookmarkItem } from './BookmarkItem';
import {
  FlexRow,
  FlexCenter,
  Text,
  Container,
  Icon,
  Select,
} from '../primitives';
import { DropdownPanel } from '../ui';
import { useBookmarks } from '../../hooks/business/bookmarks';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
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
  spaceRoles?: Role[];
  spaceChannels?: Channel[];
  onChannelClick?: (channelId: string) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  isOpen,
  onClose,
  userAddress,
  stickers,
  mapSenderToUser,
  spaceRoles,
  spaceChannels,
  onChannelClick,
}) => {
  const navigate = useNavigate();

  // Get current route context for filtering
  const searchContext = useSearchContext();

  // Message highlighting hook (same as pinned messages)
  const { scrollToMessage, highlightMessage } = useMessageHighlight();

  // Bookmark data
  const {
    bookmarkCount,
    isLoading,
    error,
    removeBookmark,
    filterBySourceType,
    filterByConversation,
    filterByCurrentSpace,
  } = useBookmarks({ userAddress });

  // Filter state - single value like NotificationPanel
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Dynamic filter options ordering based on context
  const filterOptions = useMemo(() => {
    const options = [{ value: 'all', label: t`All Bookmarks` }];

    // Dynamic ordering based on current context
    if (searchContext.type === 'dm' && searchContext.conversationId && searchContext.conversationId !== 'general') {
      // DM context: prioritize current conversation
      options.push(
        { value: `conversation:${searchContext.conversationId}`, label: t`This conversation` },
        { value: 'dms', label: t`All DMs` },
        { value: 'spaces', label: t`All Spaces` }
      );
    } else if (searchContext.type === 'space' && searchContext.spaceId && searchContext.spaceId !== 'default') {
      // Space context: prioritize current space
      options.push(
        { value: `currentSpace:${searchContext.spaceId}`, label: t`This Space` },
        { value: 'spaces', label: t`All Spaces` },
        { value: 'dms', label: t`All DMs` }
      );
    } else {
      // General context: standard ordering
      options.push(
        { value: 'dms', label: t`All DMs` },
        { value: 'spaces', label: t`All Spaces` }
      );
    }

    return options;
  }, [searchContext]);

  // Get filtered bookmarks with context-aware filtering
  const filteredBookmarks = useMemo(() => {
    if (selectedFilter.startsWith('conversation:')) {
      const conversationId = selectedFilter.replace('conversation:', '');
      return filterByConversation(conversationId);
    } else if (selectedFilter.startsWith('currentSpace:')) {
      const spaceId = selectedFilter.replace('currentSpace:', '');
      return filterByCurrentSpace(spaceId, searchContext.channelId);
    }

    // Handle standard filter types
    switch (selectedFilter) {
      case 'all':
        return filterBySourceType('all');
      case 'dms':
        return filterBySourceType('dm');
      case 'spaces':
        return filterBySourceType('channel');
      default:
        // Fallback to show all bookmarks
        return filterBySourceType('all');
    }
  }, [selectedFilter, searchContext, filterBySourceType, filterByConversation, filterByCurrentSpace]);

  // Handle navigation to bookmark (enhanced timing pattern matching pinned messages)
  const handleJumpToMessage = useCallback((bookmark: Bookmark) => {
    // Close the panel first
    onClose();

    // Navigate to the bookmarked message with hash for highlighting
    if (bookmark.sourceType === 'channel') {
      navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}#msg-${bookmark.messageId}`);
    } else {
      // For DMs: extract address from conversationId (format: "address/address")
      const dmAddress = bookmark.conversationId?.split('/')[0];
      navigate(`/messages/${dmAddress}#msg-${bookmark.messageId}`);
    }

    // Enhanced timing pattern (same as pinned messages): 100ms delay + 2000ms highlight
    setTimeout(() => {
      // The destination component will handle scrolling and highlighting via hash detection
      // But we can also trigger explicit highlighting for cross-context navigation reliability
      scrollToMessage(bookmark.messageId);
      highlightMessage(bookmark.messageId, { duration: 2000 }); // 2 seconds, matching pinned messages
    }, 100);
  }, [navigate, onClose, scrollToMessage, highlightMessage]);

  // Handle bookmark removal
  const handleRemoveBookmark = useCallback((bookmarkId: string) => {
    removeBookmark(bookmarkId);
  }, [removeBookmark]);

  // Handle filter change (like NotificationPanel)
  const handleFilterChange = useCallback((value: string) => {
    setSelectedFilter(value);
  }, []);

  // Render filter controls (like NotificationPanel)
  const renderFilterControls = useCallback(() => {
    if (bookmarkCount === 0) return null;

    return (
      <Container className="bookmarks-panel__controls">
        <FlexRow className="items-center justify-between gap-2">
          <Select
            value={selectedFilter}
            onChange={handleFilterChange}
            options={filterOptions}
            compactMode={true}
            compactIcon="filter"
            showSelectionCount={false}
            size="medium"
          />
        </FlexRow>
      </Container>
    );
  }, [bookmarkCount, selectedFilter, handleFilterChange, filterOptions]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <FlexCenter className="bookmark-empty-state">
          <Icon name="loader" className="empty-icon animate-spin" />
          <Text className="empty-message">{t`Loading bookmarks...`}</Text>
        </FlexCenter>
      );
    }

    if (error) {
      return (
        <FlexCenter className="bookmark-empty-state">
          <Icon name="alert-triangle" className="empty-icon text-danger" />
          <Text className="empty-message">{t`Failed to load bookmarks`}</Text>
        </FlexCenter>
      );
    }

    if (bookmarkCount === 0) {
      return (
        <FlexCenter className="bookmark-empty-state">
          <Icon name="bookmark" size="3xl" className="empty-icon" />
          <Text className="empty-message">{t`No bookmarks yet`}</Text>
          <Text className="empty-hint">
            {t`Bookmark messages to save them for later reference`}
          </Text>
        </FlexCenter>
      );
    }

    // Filtered results are empty
    return (
      <FlexCenter className="bookmark-empty-state">
        <Icon name="filter" className="empty-icon" />
        <Text className="empty-message">
          {selectedFilter === 'spaces'
            ? t`No bookmarks in spaces`
            : selectedFilter === 'dms'
            ? t`No bookmarks in DMs`
            : selectedFilter !== 'all'
            ? t`No bookmarks in this space`
            : t`No bookmarks found`
          }
        </Text>
      </FlexCenter>
    );
  }, [isLoading, error, bookmarkCount, selectedFilter]);

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
                spaceRoles={spaceRoles}
                spaceChannels={spaceChannels}
                onChannelClick={onChannelClick}
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
            <BookmarkItem
              key={bookmark.bookmarkId}
              bookmark={bookmark}
              onJumpToMessage={handleJumpToMessage}
              onRemoveBookmark={handleRemoveBookmark}
              stickers={stickers}
              mapSenderToUser={mapSenderToUser}
              spaceRoles={spaceRoles}
              spaceChannels={spaceChannels}
              onChannelClick={onChannelClick}
            />
          )}
          style={{ height: '100%' }}
        />
      </div>
    );
  }, [isLoading, error, filteredBookmarks, renderEmptyState, handleJumpToMessage, handleRemoveBookmark, stickers, mapSenderToUser, spaceRoles, spaceChannels, onChannelClick]);

  return (
    <DropdownPanel
      isOpen={isOpen}
      onClose={onClose}
      position="absolute"
      positionStyle="right-aligned"
      maxWidth={500}
      maxHeight={Math.min(window.innerHeight * 0.8, 600)}
      title={
        bookmarkCount === 1
          ? t`${bookmarkCount} bookmark`
          : t`${bookmarkCount} bookmarks`
      }
      className="bookmarks-panel"
      showCloseButton={true}
    >
      {renderFilterControls()}
      {renderBookmarkList()}
    </DropdownPanel>
  );
};