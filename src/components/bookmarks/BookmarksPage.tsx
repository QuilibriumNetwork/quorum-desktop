import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Bookmark } from '@quilibrium/quorum-shared';
import { Button, Icon, Input, Select } from '../primitives';
import { BookmarkCard } from './BookmarkCard';
import { useBookmarks } from '../../hooks/business/bookmarks';
import { buildMessageHash } from '../../utils/messageHashNavigation';
import { useOptionalShellState } from '../shell/useShellState';
import { useUserProfileModal } from '../../hooks/business/ui/useUserProfileModal';
import UserProfile from '../user/UserProfile';
import './BookmarksPage.scss';

type SourceFilter = 'all' | 'channel' | 'dm';

const PhoneHeader: React.FC = () => {
  const shell = useOptionalShellState();
  if (!shell || shell.viewport !== 'phone') return null;
  return (
    <div className="chat-header text-main">
      <Button
        type="unstyled"
        onClick={shell.openDrawer}
        className="header-icon-button"
        iconName="menu"
        iconSize="lg"
        iconOnly
        ariaLabel={t`Open navigation`}
      />
    </div>
  );
};

export const BookmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const user = usePasskeysContext();
  const userAddress = user?.currentPasskeyInfo?.address || '';

  const {
    bookmarkCount,
    isLoading,
    error,
    removeBookmark,
    filterBySourceType,
  } = useBookmarks({ userAddress });

  const [search, setSearch] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all');

  // Mention click → open user profile modal. Cards only invoke this for
  // resolved mentions (BookmarkCard's resolveSender restricts that to the
  // bookmark's own sender), so the modal always has real cached data.
  const userProfileModal = useUserProfileModal();

  const sourceOptions = React.useMemo(
    () => [
      { value: 'all', label: t`All bookmarks` },
      { value: 'dm', label: t`Direct messages` },
      { value: 'channel', label: t`Spaces` },
    ],
    []
  );

  const filteredBookmarks = React.useMemo(() => {
    const base = filterBySourceType(sourceFilter);
    const query = search.trim().toLowerCase();
    if (!query) return base;
    return base.filter((bookmark) => {
      const { senderName, textSnippet, sourceName } = bookmark.cachedPreview;
      return (
        senderName?.toLowerCase().includes(query) ||
        textSnippet?.toLowerCase().includes(query) ||
        sourceName?.toLowerCase().includes(query)
      );
    });
  }, [filterBySourceType, sourceFilter, search]);

  const handleJumpToMessage = React.useCallback(
    (bookmark: Bookmark) => {
      const hash = buildMessageHash(bookmark.messageId, bookmark.threadId);
      if (bookmark.sourceType === 'channel') {
        navigate(`/spaces/${bookmark.spaceId}/${bookmark.channelId}${hash}`);
      } else {
        const dmAddress = bookmark.conversationId?.split('/')[0];
        navigate(`/messages/${dmAddress}${hash}`);
      }
      setTimeout(() => {
        history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }, 8000);
    },
    [navigate]
  );

  const handleSourceChange = (value: string | string[]) => {
    setSourceFilter(value as SourceFilter);
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="empty-state empty-state--fill">
          <Icon name="loader" size="5xl" className="empty-state__icon animate-spin" />
          <p className="empty-state__title">{t`Loading bookmarks...`}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="empty-state empty-state--fill">
          <Icon name="alert-triangle" size="5xl" className="empty-state__icon" />
          <p className="empty-state__title">{t`Failed to load bookmarks`}</p>
        </div>
      );
    }

    if (bookmarkCount === 0) {
      return (
        <div className="empty-state empty-state--fill">
          <Icon name="bookmark" size="5xl" className="empty-state__icon" />
          <p className="empty-state__title">
            {t`No bookmarks yet. Bookmark messages to save them for later reference.`}
          </p>
        </div>
      );
    }

    if (filteredBookmarks.length === 0) {
      return (
        <div className="empty-state empty-state--fill">
          <Icon name="filter" size="5xl" className="empty-state__icon" />
          <p className="empty-state__title">
            {search.trim()
              ? t`No bookmarks match your search.`
              : sourceFilter === 'dm'
                ? t`No bookmarks in direct messages.`
                : sourceFilter === 'channel'
                  ? t`No bookmarks in spaces.`
                  : t`No bookmarks found.`}
          </p>
        </div>
      );
    }

    return (
      <div className="bookmarks-page__list">
        {filteredBookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.bookmarkId}
            bookmark={bookmark}
            onJumpToMessage={handleJumpToMessage}
            onRemoveBookmark={removeBookmark}
            onUserClick={userProfileModal.handleUserClick}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bookmarks-page">
      <PhoneHeader />
      <div className="bookmarks-page__inner">
        <div className="bookmarks-page__title-row">
          <h1 className="bookmarks-page__title">{t`Bookmarks`}</h1>
          {bookmarkCount > 0 && (
            <span className="bookmarks-page__count">
              {bookmarkCount === 1
                ? t`${bookmarkCount} bookmark`
                : t`${bookmarkCount} bookmarks`}
            </span>
          )}
        </div>

        <div className="bookmarks-page__header">
          <div className="bookmarks-page__search">
            <Input
              value={search}
              onChange={setSearch}
              placeholder={t`Search bookmarks...`}
              variant="bordered"
              disabled={bookmarkCount === 0}
            />
          </div>
          <Select
            className="bookmarks-page__filter"
            value={sourceFilter}
            onChange={handleSourceChange}
            options={sourceOptions}
            variant="bordered"
            borderedDropdown
            disabled={bookmarkCount === 0}
          />
        </div>

        {renderBody()}
      </div>

      {/* User profile overlay — opened from mention clicks inside cards.
          No spaceId/roles since bookmarks are cross-surface; UserProfile
          gracefully degrades to display name + address + send-message. */}
      {userProfileModal.isOpen &&
        userProfileModal.selectedUser &&
        userProfileModal.modalPosition && (
          <>
            <div
              className="fixed inset-0 z-[9990]"
              onClick={userProfileModal.handleClose}
            />
            <div
              className="fixed z-[9999] pointer-events-none"
              style={{
                top: `${userProfileModal.modalPosition.top}px`,
                left:
                  userProfileModal.modalPosition.left !== undefined
                    ? `${userProfileModal.modalPosition.left}px`
                    : `calc(100vw - 320px)`,
              }}
            >
              <div className="pointer-events-auto">
                <UserProfile
                  key={userProfileModal.selectedUser.address}
                  user={userProfileModal.selectedUser}
                  dismiss={userProfileModal.handleClose}
                />
              </div>
            </div>
          </>
        )}
    </div>
  );
};

export default BookmarksPage;
