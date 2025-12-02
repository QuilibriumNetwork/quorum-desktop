import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { t } from '@lingui/core/macro';
import type { Bookmark } from '../../api/quorumApi';
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
import { isTouchDevice } from '../../utils/platform';
import { useSpaces } from '../../hooks';
import './BookmarksPanel.scss';

interface BookmarksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  isOpen,
  onClose,
  userAddress,
}) => {
  const navigate = useNavigate();
  const { data: spaces } = useSpaces({});

  // Message highlighting hook (same as pinned messages)
  const { scrollToMessage, highlightMessage } = useMessageHighlight();

  // Bookmark data
  const {
    bookmarks,
    bookmarkCount,
    isLoading,
    error,
    removeBookmark,
    filterBySourceType,
    filterBySpace,
  } = useBookmarks({ userAddress });

  // Filter state - single value like NotificationPanel
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Get filter options (like NotificationPanel)
  const filterOptions = useMemo(() => {
    const baseOptions = [
      { value: 'all', label: t`All bookmarks` },
      { value: 'dms', label: t`Direct messages` },
      { value: 'spaces', label: t`All spaces` },
    ];

    // Add individual space options
    if (spaces) {
      const spacesWithBookmarks = new Set(
        bookmarks
          .filter(b => b.sourceType === 'channel' && b.spaceId)
          .map(b => b.spaceId!)
      );

      const spaceOptions = spaces
        .filter(space => spacesWithBookmarks.has(space.spaceId))
        .map(space => ({
          value: space.spaceId,
          label: space.spaceName,
        }));

      return [...baseOptions, ...spaceOptions];
    }

    return baseOptions;
  }, [spaces, bookmarks]);

  // Get filtered bookmarks
  const filteredBookmarks = useMemo(() => {
    let result;
    if (selectedFilter === 'all') {
      result = filterBySourceType('all');
    } else if (selectedFilter === 'dms') {
      result = filterBySourceType('dm');
    } else if (selectedFilter === 'spaces') {
      result = filterBySourceType('channel');
    } else {
      // Individual space selected
      result = filterBySpace(selectedFilter);
    }


    return result;
  }, [filterBySourceType, filterBySpace, selectedFilter, bookmarks]);

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
          <Icon name="bookmark" className="empty-icon" />
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
            />
          )}
          style={{ height: '100%' }}
        />
      </div>
    );
  }, [isLoading, error, filteredBookmarks, renderEmptyState, handleJumpToMessage, handleRemoveBookmark]);

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