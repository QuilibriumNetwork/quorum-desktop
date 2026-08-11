import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { Bookmark } from '@quilibrium/quorum-shared';
import { Button, Icon, Input, Select } from '../primitives';
import { BookmarkCard } from './BookmarkCard';
import { useBookmarks } from '../../hooks/business/bookmarks';
import { useMultiSpaceRosters, useLocalDmNames } from '../../hooks/business/identity';
import { buildMessageHash } from '../../utils/messageHashNavigation';
import { useOptionalShellState } from '../shell/useShellState';
import { useUserProfileModal } from '../../hooks/business/ui/useUserProfileModal';
import { FloatingPopover } from '../ui';
import UserProfile from '../user/UserProfile';
import { IdentityScopeProvider, useNameResolver } from '../../identity';
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

/**
 * `BookmarksPage` mounts the `<IdentityScopeProvider>` (own function body
 * runs BEFORE it exists in the tree, same shape as `Channel.tsx`'s
 * `ChannelTypingIndicator` / `DirectMessageContactsList`'s `Inner`), so the
 * search filter — which needs to resolve a name per bookmark — lives here,
 * a real child, where `useNameResolver` is valid.
 *
 * FIX (final fix wave, finding 5): search used to match
 * `bookmark.cachedPreview.senderName` — a string frozen at bookmark-creation
 * time (`useMessageActions.ts`'s `handleBookmarkToggle`). `BookmarkCard`
 * itself stopped rendering that field long ago (it resolves the sender from
 * `senderAddress` via `src/identity`, same as every other surface), so a
 * renamed sender's bookmarks silently stopped matching their own search
 * query — the card shows the new name but the search still needs the old
 * one. Search now resolves the SAME way the card renders.
 */
const BookmarksPageInner: React.FC<{
  bookmarks: Bookmark[];
  bookmarkCount: number;
  isLoading: boolean;
  error: unknown;
  removeBookmark: (bookmarkId: string) => void;
  filterBySourceType: (filter: SourceFilter) => Bookmark[];
}> = ({ bookmarks, bookmarkCount, isLoading, error, removeBookmark, filterBySourceType }) => {
  const navigate = useNavigate();
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

  // Imperative/bulk resolver — the search filter runs inside a `useMemo`
  // over every bookmark, not inside JSX, so it cannot call a hook per row
  // (see `useNameResolver`'s docstring). `resolve()` reads the SAME
  // per-bookmark ladder `BookmarkCard` uses (its own `spaceId`, matching
  // recipe rule 2 — a bookmark is a detached surface that keeps its
  // per-space name).
  const { resolve, requestNames } = useNameResolver();

  // Request every distinct sender's profile up front, from ALL bookmarks
  // (not just the currently-filtered/rendered ones) — same reasoning as
  // `DirectMessageContactsList.tsx`'s proactive `requestNames`: a bookmark
  // hidden by an active search term still needs its sender's profile in
  // hand so a NEW search term can match their QNS name on the first
  // keystroke, not only after the source filter happens to render it once.
  const distinctSenderAddresses = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of bookmarks) {
      const addr = b.cachedPreview.senderAddress;
      if (addr && !seen.has(addr)) {
        seen.add(addr);
        out.push(addr);
      }
    }
    return out;
  }, [bookmarks]);
  React.useEffect(() => {
    requestNames(distinctSenderAddresses);
  }, [distinctSenderAddresses, requestNames]);

  const filteredBookmarks = React.useMemo(() => {
    const base = filterBySourceType(sourceFilter);
    const query = search.trim().toLowerCase();
    if (!query) return base;
    return base.filter((bookmark) => {
      const { textSnippet, sourceName, senderAddress } = bookmark.cachedPreview;
      const resolved = resolve(senderAddress, { spaceId: bookmark.spaceId });
      const senderName = resolved.isQnsVerified ? `${resolved.name}.q` : resolved.name;
      return (
        senderName.toLowerCase().includes(query) ||
        textSnippet?.toLowerCase().includes(query) ||
        sourceName?.toLowerCase().includes(query)
      );
    });
  }, [filterBySourceType, sourceFilter, search, resolve]);

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
          <Icon name="spinner" size="5xl" className="empty-state__icon animate-spin" />
          <p className="empty-state__title">{t`Loading bookmarks...`}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="empty-state empty-state--fill">
          <Icon name="warning" size="5xl" className="empty-state__icon" />
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
                  ? t`No bookmarks in Spaces.`
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

      {/* User profile card — opened from mention clicks inside cards.
          Anchored to the clicked mention via @floating-ui. No spaceId/roles
          since bookmarks are cross-surface; UserProfile gracefully degrades
          to display name + address + send-message. */}
      <FloatingPopover
        open={userProfileModal.isOpen && !!userProfileModal.selectedUser}
        onClose={userProfileModal.handleClose}
        anchor={userProfileModal.anchorElement}
        closeOnScroll
      >
        {userProfileModal.selectedUser && (
          <UserProfile
            key={userProfileModal.selectedUser.address}
            user={userProfileModal.selectedUser}
            dismiss={userProfileModal.handleClose}
          />
        )}
      </FloatingPopover>
    </div>
  );
};

export const BookmarksPage: React.FC = () => {
  const user = usePasskeysContext();
  const userAddress = user?.currentPasskeyInfo?.address || '';

  const {
    bookmarks,
    bookmarkCount,
    isLoading,
    error,
    removeBookmark,
    filterBySourceType,
  } = useBookmarks({ userAddress });

  // Bookmarks span every space the user belongs to — a DETACHED surface with
  // no single enclosing <IdentityScopeProvider> (unlike Channel.tsx, which is
  // always inside one Space). Build one roster per distinct spaceId
  // represented here, from ALL bookmarks rather than the filtered/searched
  // subset, so switching the filter or typing a search term never needs a
  // fresh IndexedDB read.
  const bookmarkSpaceIds = React.useMemo(
    () => bookmarks.map((b) => b.spaceId).filter((id): id is string => !!id),
    [bookmarks]
  );
  const rostersBySpace = useMultiSpaceRosters(bookmarkSpaceIds);
  // Same reusable source `SearchResults.tsx`/`useRootIdentityScope` use — the
  // `'dm'` source filter (SourceFilter above) means this page renders DM
  // bookmarks too, and a DM bookmark's sender can be a DM contact known only
  // from their local conversation record (no public profile, no space
  // roster row). Without this the page had no DM-shaped local-name source of
  // its own and fell to a truncated address for that sender.
  const locallyKnownNames = useLocalDmNames(userAddress || null);

  return (
    <IdentityScopeProvider
      rostersBySpace={rostersBySpace}
      selfAddress={userAddress || null}
      locallyKnownNames={locallyKnownNames}
    >
      <BookmarksPageInner
        bookmarks={bookmarks}
        bookmarkCount={bookmarkCount}
        isLoading={isLoading}
        error={error}
        removeBookmark={removeBookmark}
        filterBySourceType={filterBySourceType}
      />
    </IdentityScopeProvider>
  );
};

export default BookmarksPage;
