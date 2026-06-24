import * as React from 'react';
import { t } from '@lingui/core/macro';
import type { Bookmark, MessageContent, PostMessage } from '@quilibrium/quorum-shared';
import { formatAddress } from '@quilibrium/quorum-shared';
import { Flex, Button, Icon, Tooltip } from '../primitives';
import { UserAvatar } from '../user/UserAvatar';
import { MessageMarkdownRenderer } from '../message/MessageMarkdownRenderer';
import { useResolvedBookmark } from '../../hooks/queries/bookmarks';
import { formatMessageDate, DefaultImages } from '../../utils';
import { getEmbeddedMediaSrc } from '../../utils/embeddedMedia';
import { useImageModal } from '../context/ImageModalProvider';
import { isTouchDevice } from '../../utils/platform';

export interface BookmarkCardProps {
  bookmark: Bookmark;
  onJumpToMessage: (bookmark: Bookmark) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  /** Opens the user profile modal. Only invoked for resolved mentions —
   *  the renderer gates the click on its own resolution check. */
  onUserClick?: (
    user: { address: string; displayName?: string; userIcon?: string },
    event: React.MouseEvent,
    context?: { type: 'mention' | 'message-avatar'; element: HTMLElement }
  ) => void;
}

const getEmbeddedImageKeys = (content: MessageContent | undefined): string[] => {
  if (content?.type !== 'post' || !content.embeddedMedia) return [];
  const keys: string[] = [];
  for (const entry of content.embeddedMedia) {
    if ((entry.type === 'image' || entry.type === 'image-thumbnail') && !keys.includes(entry.key)) {
      keys.push(entry.key);
    }
  }
  return keys;
};

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  onJumpToMessage,
  onRemoveBookmark,
  onUserClick,
}) => {
  const { cachedPreview, sourceType } = bookmark;
  const { data: resolvedMessage } = useResolvedBookmark(bookmark, true);
  const { showImageModal } = useImageModal();

  const senderAddress = cachedPreview.senderAddress || resolvedMessage?.content?.senderId || '';
  const senderName = cachedPreview.senderName || t`Unknown User`;
  const senderIcon = cachedPreview.senderIcon;
  const messageDate = resolvedMessage?.createdDate ?? cachedPreview.messageDate;

  // Local map: bookmarks span all spaces/DMs, so we synthesize from the
  // cached snapshot rather than pulling a per-space member list.
  const mapSenderToUser = React.useCallback(
    (_senderId: string) => ({
      displayName: senderName,
      userIcon: senderIcon || DefaultImages.UNKNOWN_USER,
      address: senderAddress,
    }),
    [senderName, senderIcon, senderAddress]
  );

  // Strict resolver — we only "know" one user at this surface: the bookmark's
  // sender. Any other address (mentions in the message body) returns null,
  // and the renderer treats those as unresolved (truncated, non-interactive).
  const resolveSender = React.useCallback(
    (id: string) => (id === senderAddress
      ? { displayName: senderName, userIcon: senderIcon, address: senderAddress }
      : null),
    [senderAddress, senderName, senderIcon]
  );

  const renderSourceLine = () => {
    if (sourceType === 'channel') {
      // sourceName is "Space > #channel"; the thread chip trails it when set.
      return (
        <Flex align="center" className="bookmark-card__source">
          <Icon name="hashtag" size="sm" className="bookmark-card__source-icon" />
          <span className="bookmark-card__source-name truncate">
            {cachedPreview.sourceName || t`Space`}
          </span>
          {cachedPreview.threadName && (
            <>
              <Icon name="chevron-right" size="xs" className="bookmark-card__source-separator" />
              <Icon name="messages" size="sm" className="bookmark-card__source-icon" />
              <span className="bookmark-card__source-name truncate">
                {cachedPreview.threadName}
              </span>
            </>
          )}
        </Flex>
      );
    }
    // DM: cachedPreview.sourceName is usually empty.
    const counterpartLabel = senderName || (senderAddress ? formatAddress(senderAddress) : t`Unknown`);
    return (
      <Flex align="center" className="bookmark-card__source">
        <Icon name="message" size="sm" className="bookmark-card__source-icon" />
        <span className="bookmark-card__source-name truncate">
          {t`Conversation with ${counterpartLabel}`}
        </span>
      </Flex>
    );
  };

  const renderResolvedContent = () => {
    if (!resolvedMessage?.content) return null;
    const content = resolvedMessage.content;

    if (content.type === 'post') {
      const postContent = content as PostMessage;
      const fullText = Array.isArray(postContent.text)
        ? postContent.text.join('\n')
        : (postContent.text ?? '');
      const imageKeys = getEmbeddedImageKeys(postContent);

      return (
        <div className="message-post-content break-words">
          {fullText.trim().length > 0 && (
            <MessageMarkdownRenderer
              content={fullText}
              mapSenderToUser={mapSenderToUser}
              resolveSender={resolveSender}
              onUserClick={onUserClick}
              embeddedMedia={postContent.embeddedMedia}
            />
          )}
          {imageKeys.map((key) => {
            const thumbnailSrc =
              getEmbeddedMediaSrc(postContent, 'image-thumbnail', key) ??
              getEmbeddedMediaSrc(postContent, 'image', key);
            const fullSrc = getEmbeddedMediaSrc(postContent, 'image', key);
            if (!thumbnailSrc || !fullSrc) return null;
            return (
              <div key={key} className="relative inline-block mt-1">
                <img
                  src={thumbnailSrc}
                  className="message-image rounded-lg cursor-pointer hover:opacity-80"
                  onClick={() => showImageModal(fullSrc)}
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            );
          })}
        </div>
      );
    }

    if (content.type === 'embed') {
      const thumb = content.thumbnailUrl || content.imageUrl;
      if (!thumb) return null;
      return (
        <div className="message-post-content">
          <img
            src={thumb}
            className="message-image rounded-lg cursor-pointer hover:opacity-80"
            onClick={() => content.imageUrl && showImageModal(content.imageUrl)}
            style={{ maxWidth: 360, maxHeight: 240, width: 'auto' }}
          />
        </div>
      );
    }

    return null;
  };

  // Cached fallback for messages not in local IndexedDB (cross-device sync).
  const renderCachedFallback = () => {
    const contentType = cachedPreview.contentType || 'text';
    if (contentType === 'image') {
      const imgSrc = cachedPreview.thumbnailUrl || cachedPreview.imageUrl;
      if (imgSrc) {
        return (
          <div className="message-post-content">
            <img
              src={imgSrc}
              className="message-image rounded-lg"
              style={{ maxWidth: 360, maxHeight: 240, width: 'auto' }}
            />
          </div>
        );
      }
      return <span className="text-muted italic">{t`[Image]`}</span>;
    }
    if (contentType === 'sticker') {
      return <span className="text-muted italic">{t`[Sticker]`}</span>;
    }
    return (
      <div className="message-post-content break-words">
        <p>{cachedPreview.textSnippet || t`[Empty message]`}</p>
      </div>
    );
  };

  const renderContent = () => (resolvedMessage ? renderResolvedContent() : renderCachedFallback());

  const formattedTimestamp = formatMessageDate(messageDate);

  return (
    <div className="bookmark-card">
      {renderSourceLine()}

      <Flex
        align="center"
        gap="xs"
        className={`bookmark-card__actions${isTouchDevice() ? ' always-visible' : ''}`}
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
      </Flex>

      <Flex className="bookmark-card__body items-start">
        <UserAvatar
          userIcon={senderIcon}
          displayName={senderName}
          address={senderAddress}
          size={44}
          className="bookmark-card__avatar message-sender-icon"
        />
        <div className="bookmark-card__content message-content">
          <Flex align="center" className="bookmark-card__header min-w-0">
            <span className="message-sender-name truncate-user-name-chat flex-shrink min-w-0">
              {senderName}
            </span>
            <span className="message-timestamp">{formattedTimestamp}</span>
          </Flex>

          <div className="bookmark-card__message">{renderContent()}</div>
        </div>
      </Flex>
    </div>
  );
};

export default BookmarkCard;
