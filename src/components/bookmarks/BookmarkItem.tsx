import React from 'react';
import { t } from '@lingui/core/macro';
import type { Bookmark } from '../../api/quorumApi';
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

export interface BookmarkItemProps {
  bookmark: Bookmark;
  onJumpToMessage: (bookmark: Bookmark) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}

export const BookmarkItem: React.FC<BookmarkItemProps> = ({
  bookmark,
  onJumpToMessage,
  onRemoveBookmark,
}) => {
  const { cachedPreview } = bookmark;

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
        <Text className="message-preview">
          {cachedPreview.textSnippet || t`No text content`}
        </Text>
      </Container>
    </Container>
  );
};