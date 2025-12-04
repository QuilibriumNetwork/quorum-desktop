import React from 'react';
import { t } from '@lingui/core/macro';
import type { Bookmark, Sticker } from '../../api/quorumApi';
import {
  FlexRow,
  FlexBetween,
  Text,
  Button,
  Container,
  Tooltip,
  Icon,
} from '../primitives';
import { isTouchDevice } from '../../utils/platform';
import { formatMessageDate } from '../../utils';
import { useResolvedBookmark } from '../../hooks/queries/bookmarks';
import { MessagePreview } from '../message/MessagePreview';

export interface BookmarkItemProps {
  bookmark: Bookmark;
  onJumpToMessage: (bookmark: Bookmark) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  stickers?: { [key: string]: Sticker };
  // Props for MessagePreview rendering (when message is resolved)
  mapSenderToUser?: (senderId: string) => any;
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({
  bookmark,
  onJumpToMessage,
  onRemoveBookmark,
  stickers,
  mapSenderToUser,
}) => {
  const { cachedPreview } = bookmark;

  // Try to resolve the full message from local IndexedDB
  const { data: resolvedMessage } = useResolvedBookmark(bookmark, true);

  // Render cached preview fallback (used when message not found locally)
  const renderCachedPreview = () => {
    const contentType = cachedPreview.contentType || 'text';

    if (contentType === 'image') {
      const imgSrc = cachedPreview.thumbnailUrl || cachedPreview.imageUrl;
      if (imgSrc) {
        return (
          <Container className="bookmark-media-preview">
            <img
              src={imgSrc}
              alt={t`Bookmarked image`}
              className="bookmark-image rounded-lg"
              style={{ maxWidth: 200, maxHeight: 120, width: 'auto' }}
            />
          </Container>
        );
      }
      return <Text className="message-preview text-muted">{t`[Image]`}</Text>;
    }

    if (contentType === 'sticker') {
      const sticker = cachedPreview.stickerId ? stickers?.[cachedPreview.stickerId] : undefined;
      if (sticker && typeof sticker === 'object' && sticker.imgUrl) {
        return (
          <Container className="bookmark-media-preview">
            <img
              src={sticker.imgUrl}
              alt={t`Bookmarked sticker`}
              className="bookmark-sticker rounded-lg"
              style={{ maxWidth: 80, maxHeight: 80 }}
            />
          </Container>
        );
      }
      return <Text className="message-preview text-muted">{t`[Sticker]`}</Text>;
    }

    // Default: text content
    return (
      <Text className="message-preview">
        {cachedPreview.textSnippet || t`[Empty message]`}
      </Text>
    );
  };

  // Render content: prefer MessagePreview if message resolved, fallback to cached
  const renderContent = () => {
    // If we have the full message and mapSenderToUser, render with MessagePreview
    if (resolvedMessage && mapSenderToUser) {
      return (
        <MessagePreview
          message={resolvedMessage}
          mapSenderToUser={mapSenderToUser}
          stickers={stickers}
          showBackground={false}
          hideHeader={true}
          disableMentionInteractivity={true}
        />
      );
    }

    // Fallback to cached preview
    return renderCachedPreview();
  };

  return (
    <Container
      key={bookmark.bookmarkId}
      className="bookmark-item"
    >
      <Container className="result-header">
        <FlexBetween className="result-meta-container">
          <FlexRow className="result-meta items-center min-w-0 flex-1 mr-2">
            <Icon name="user" className="result-user-icon flex-shrink-0" />
            <Text className="result-sender mr-2 truncate flex-shrink min-w-0">
              {cachedPreview.senderName || t`Unknown User`}
            </Text>
            <Icon name="calendar-alt" className="result-date-icon flex-shrink-0 ml-1" />
            <Text className="result-date flex-shrink-0 whitespace-nowrap ml-1">
              {formatMessageDate(cachedPreview.messageDate)}
            </Text>
          </FlexRow>
          <FlexRow
            className={`message-actions items-center flex-shrink-0${isTouchDevice() ? ' always-visible' : ''}`}
          >
            <Button
              type="secondary"
              onClick={() => onJumpToMessage(bookmark)}
              iconName="arrow-right"
              size="small"
              className="gap-1"
            >
              {t`Jump`}
            </Button>
            <Tooltip
              id={`remove-bookmark-${bookmark.bookmarkId}`}
              content={t`Remove bookmark`}
              place="top"
              showOnTouch={false}
            >
              <Button
                type="unstyled"
                onClick={() => onRemoveBookmark(bookmark.bookmarkId)}
                iconName="bookmark-off"
                iconOnly={true}
                size="small"
                className="text-danger flex items-center justify-center"
                iconSize="lg"
              />
            </Tooltip>
          </FlexRow>
        </FlexBetween>
      </Container>

      {/* Source context line - only show for channels, not DMs */}
      {bookmark.sourceType === 'channel' && (
        <Container className="result-source">
          <FlexRow className="items-center">
            <Icon
              name="hashtag"
              className="source-icon flex-shrink-0"
            />
            <Text className="source-name truncate flex-1">
              {cachedPreview.sourceName}
            </Text>
          </FlexRow>
        </Container>
      )}

      {/* Message preview */}
      <Container className="result-content">
        {renderContent()}
      </Container>
    </Container>
  );
};
