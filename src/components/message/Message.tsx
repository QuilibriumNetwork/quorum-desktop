import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as moment from 'moment-timezone';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type {
  Emoji,
  Message as MessageType,
  Role,
  Sticker,
  Channel,
} from '../../api/quorumApi';
import EmojiPicker, {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import UserProfile from '../user/UserProfile';
import { useParams } from 'react-router';
import { InviteLink } from './InviteLink';
import {
  Modal,
  Text,
  Container,
  FlexRow,
  FlexColumn,
  FlexCenter,
  Icon,
  Tooltip,
} from '../primitives';
import { useImageModal } from '../context/ImageModalProvider';
import './Message.scss';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../utils';
import { YouTubeEmbed } from '../ui/YouTubeEmbed';
import { useMobile } from '../context/MobileProvider';
import {
  useMessageActions,
  useEmojiPicker,
  useMessageInteractions,
  useMessageFormatting,
  usePinnedMessages,
} from '../../hooks';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import MessageActions from './MessageActions';
import { MessageMarkdownRenderer } from './MessageMarkdownRenderer';
import { getImageConfig } from '../../utils/imageProcessing/config';

// Utility function for robust GIF detection
const createGifDetector = (url: string, isLargeGif?: boolean) => {
  const normalizedUrl = url.toLowerCase();
  return normalizedUrl.includes('data:image/gif') ||
         /\.gif(\?[^#]*)?(?:#.*)?$/i.test(normalizedUrl) ||
         !!isLargeGif;
};

type MessageProps = {
  customEmoji?: Emoji[];
  stickers?: { [key: string]: Sticker };
  message: MessageType;
  messageList: MessageType[];
  senderRoles: Role[];
  canEditRoles?: boolean;
  canDeleteMessages?: boolean;
  canPinMessages?: boolean;
  channel?: Channel;
  mapSenderToUser: (senderId: string) => any;
  virtuosoRef?: any;
  emojiPickerOpen: string | undefined;
  setEmojiPickerOpen: React.Dispatch<React.SetStateAction<string | undefined>>;
  emojiPickerOpenDirection: string | undefined;
  setEmojiPickerOpenDirection: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  hoverTarget: string | undefined;
  setHoverTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
  setInReplyTo: React.Dispatch<React.SetStateAction<MessageType | undefined>>;
  repudiability?: boolean;
  editorRef: any;
  height: number;
  submitMessage: (message: any) => Promise<void>;
  kickUserAddress?: string;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
  onUserClick?: (user: {
    address: string;
    displayName?: string;
    userIcon?: string;
  }, event: React.MouseEvent, context?: { type: 'mention' | 'message-avatar'; element: HTMLElement }) => void;
};

export const Message = React.memo(({
  customEmoji,
  stickers,
  message,
  messageList,
  senderRoles,
  canEditRoles,
  canDeleteMessages,
  canPinMessages,
  channel,
  mapSenderToUser,
  virtuosoRef,
  emojiPickerOpen,
  setEmojiPickerOpen,
  emojiPickerOpenDirection,
  setEmojiPickerOpenDirection,
  hoverTarget,
  setHoverTarget,
  setInReplyTo,
  repudiability,
  editorRef,
  height,
  submitMessage,
  kickUserAddress,
  setKickUserAddress,
  onUserClick,
}: MessageProps) => {
  const user = usePasskeysContext();
  const { spaceId } = useParams();
  const location = useLocation();
  const { openMobileActionsDrawer, openMobileEmojiDrawer } = useMobile();

  // Component state that needs to be available to hooks
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);

  // Image modal context
  const { showImageModal } = useImageModal();

  // Message actions business logic
  const messageActions = useMessageActions({
    message,
    userAddress: user.currentPasskeyInfo!.address,
    canDeleteMessages,
    height,
    onSubmitMessage: submitMessage,
    onSetInReplyTo: setInReplyTo,
    onSetEmojiPickerOpen: setEmojiPickerOpen,
    onSetEmojiPickerDirection: setEmojiPickerOpenDirection,
    editorRef,
    mapSenderToUser,
  });

  // Emoji picker business logic
  const emojiPicker = useEmojiPicker({
    customEmoji,
    height,
    onEmojiClick: messageActions.handleReaction,
    onSetEmojiPickerOpen: setEmojiPickerOpen,
    onSetEmojiPickerDirection: setEmojiPickerOpenDirection,
  });

  // Message interactions logic
  const interactions = useMessageInteractions({
    message,
    hoverTarget,
    setHoverTarget,
    setShowUserProfile,
    onCloseEmojiPickers: emojiPicker.closeEmojiPickers,
    onMobileActionsDrawer: (config) => {
      // For touch devices, always show confirmation (shiftKey = false)
      // This ensures mobile/touch users always get confirmation modals
      openMobileActionsDrawer({
        ...config,
        onReply: messageActions.handleReply,
        onCopyLink: messageActions.handleCopyLink,
        onDelete: messageActions.canUserDelete
          ? () => messageActions.handleDelete({ shiftKey: false } as React.MouseEvent)
          : undefined,
        onPin: pinnedMessages.canPinMessages
          ? () => pinnedMessages.togglePin({ shiftKey: false } as React.MouseEvent, message)
          : undefined,
        onReaction: messageActions.handleReaction,
        onMoreReactions: handleMoreReactions,
        canDelete: messageActions.canUserDelete,
        canPinMessages: pinnedMessages.canPinMessages,
        userAddress: user.currentPasskeyInfo!.address,
      });
    },
    onEmojiPickerUserProfileClick: emojiPicker.handleUserProfileClick,
  });

  // Message formatting logic
  const formatting = useMessageFormatting({
    message,
    stickers,
    mapSenderToUser,
    onImageClick: showImageModal,
  });

  // Pinned messages logic
  const pinnedMessages = usePinnedMessages(
    message.spaceId || spaceId || '',
    message.channelId || '',
    channel,
    mapSenderToUser,
    stickers
  );

  // Message highlighting logic - replaces isHashTarget
  const { isHighlighted } = useMessageHighlight();
  const isMessageHighlighted = useMemo(() => {
    // Check both URL hash (for backward compatibility) and React state highlighting
    const isUrlTarget = location.hash === `#msg-${message.messageId}`;
    const isStateHighlighted = isHighlighted(message.messageId);
    return isUrlTarget || isStateHighlighted;
  }, [message.messageId, location.hash, isHighlighted]);

  let sender = mapSenderToUser(message.content?.senderId);
  const time = moment.tz(
    message.createdDate,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const fromNow = time.fromNow();
  const timeFormatted = time.format('h:mm a');

  const displayedTimestmap = time.calendar(null, {
    sameDay: function () {
      return `[${t`Today at ${timeFormatted}`}]`;
    },
    lastWeek: 'dddd',
    lastDay: `[${t`Yesterday at ${timeFormatted}`}]`,
    sameElse: function () {
      return `[${fromNow}]`;
    },
  });

  const formatEventMessage = (userDisplayName: string, type: string) => {
    switch (type) {
      case 'join':
        return (
          <>
            <Icon name="user-join" size="sm" className="mr-2 text-subtle" />
            {i18n._('{user} has joined', { user: userDisplayName })}
          </>
        );
      case 'leave':
        return (
          <>
            <Icon name="user-leave" size="sm" className="mr-2 text-subtle" />
            {i18n._('{user} has left', { user: userDisplayName })}
          </>
        );
      case 'kick':
        return (
          <>
            <Icon name="user-kick" size="sm" className="mr-2 text-danger" />
            {i18n._('{user} has been kicked', { user: userDisplayName })}
          </>
        );
    }
  };

  // Handle more reactions with mobile/desktop logic
  const handleMoreReactions = () => {
    if (interactions.useMobileDrawer) {
      openMobileEmojiDrawer({
        onEmojiClick: messageActions.handleReaction,
        customEmojis: emojiPicker.customEmojis,
      });
    } else {
      emojiPicker.openMobileEmojiDrawer();
    }
  };

  return (
    <FlexColumn
      id={`msg-${message.messageId}`}
      className={
        'text-base relative hover:bg-chat-hover ' +
        (formatting.isMentioned(user.currentPasskeyInfo!.address)
          ? ' message-mentions-you'
          : '') +
        (isMessageHighlighted ? ' message-highlighted' : '')
      }
      // Desktop mouse interaction
      onMouseOver={interactions.handleMouseOver}
      onMouseOut={interactions.handleMouseOut}
      onClick={interactions.handleMessageClick}
      // Mobile and tablet touch interaction
      {...interactions.touchHandlers}
    >
      {(() => {
        if (message.content.type == 'post') {
          let replyIndex = !message.content.repliesToMessageId
            ? undefined
            : messageList.findIndex(
                (c) =>
                  c.messageId === (message.content as any).repliesToMessageId
              );
          let reply =
            replyIndex !== undefined ? messageList[replyIndex] : undefined;
          if (reply) {
            return (
              <Container
                key={reply.messageId + 'rplyhd'}
                className="message-reply-heading"
                onClick={() =>
                  virtuosoRef?.scrollToIndex({
                    index: replyIndex,
                    align: 'start',
                    behavior: 'smooth',
                  })
                }
              >
                <Container className="message-reply-curve" />
                <Container
                  className="message-reply-sender-icon"
                  style={{
                    backgroundImage: `url(${
                      mapSenderToUser(
                        reply.content.senderId
                      ).userIcon?.includes(DefaultImages.UNKNOWN_USER)
                        ? 'var(--unknown-icon)'
                        : mapSenderToUser(reply.content.senderId).userIcon
                    })`,
                  }}
                />
                <Text className="message-reply-sender-name">
                  {mapSenderToUser(reply.content.senderId).displayName}
                </Text>
                <Text className="message-reply-text">
                  {reply.content.type == 'post' && reply.content.text}
                </Text>
              </Container>
            );
          } else {
            return <></>;
          }
        }
      })()}
      {['join', 'leave', 'kick'].includes(message.content.type) && (
        <FlexRow className="px-4 py-2 italic" align="center">
          <Text variant={message.content.type === 'kick' ? 'danger' : 'subtle'}>
            {formatEventMessage(sender.displayName, message.content.type)}
          </Text>
        </FlexRow>
      )}
      {!['join', 'leave', 'kick'].includes(message.content.type) && (
        <FlexRow
          className={
            'w-full font-[11pt] px-[16px] pb-[8px] items-start ' +
            ((
              !(message.content as any).repliesToMessageId
                ? undefined
                : messageList.findIndex(
                    (c) => c.messageId === message.messageId
                  )
            )
              ? ''
              : 'pt-[8px]')
          }
        >
          {showUserProfile && spaceId && (
            <FlexRow
              onClick={interactions.handleUserProfileBackgroundClick}
              className={
                'absolute left-0 top-0 w-full mt-[-1000px] pb-[200px] pt-[1000px] z-[1000]'
              }
            >
              <Container
                className={
                  emojiPickerOpenDirection == 'upwards'
                    ? 'ml-[10px] mt-[-220px]'
                    : 'ml-[10px]'
                }
              >
                <UserProfile
                  spaceId={message.spaceId}
                  canEditRoles={canEditRoles}
                  kickUserAddress={kickUserAddress}
                  setKickUserAddress={setKickUserAddress}
                  roles={senderRoles}
                  user={sender}
                  dismiss={() => {
                    setShowUserProfile(false);
                  }}
                />
              </Container>
            </FlexRow>
          )}
          <Container
            onClick={(event) => {
              event.stopPropagation();
              if (onUserClick) {
                onUserClick(
                  {
                    address: sender.address,
                    displayName: sender.displayName,
                    userIcon: sender.userIcon,
                  },
                  event,
                  { type: 'message-avatar', element: event.currentTarget as HTMLElement }
                );
              }
            }}
            className="message-sender-icon"
            style={{
              backgroundImage: sender.userIcon?.includes(
                DefaultImages.UNKNOWN_USER
              )
                ? 'var(--unknown-icon)'
                : `url(${sender.userIcon})`,
            }}
          />
          <Container className="message-content">
            {interactions.shouldShowActions && (
              <MessageActions
                message={message}
                userAddress={user.currentPasskeyInfo!.address}
                canUserDelete={messageActions.canUserDelete}
                canPinMessages={
                  canPinMessages !== undefined
                    ? canPinMessages
                    : pinnedMessages.canPinMessages
                }
                height={height}
                onReaction={messageActions.handleReaction}
                onReply={messageActions.handleReply}
                onCopyLink={messageActions.handleCopyLink}
                onDelete={messageActions.handleDelete}
                onPin={(e) => pinnedMessages.togglePin(e, message)}
                onMoreReactions={messageActions.handleMoreReactions}
                copiedLinkId={messageActions.copiedLinkId}
              />
            )}

            {emojiPickerOpen === message.messageId && (
              <Container
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className={
                  'absolute right-4 z-[9999] ' +
                  (emojiPickerOpenDirection == 'upwards' ? 'bottom-6' : 'top-0')
                }
              >
                <EmojiPicker
                  suggestedEmojisMode={SuggestionMode.FREQUENT}
                  customEmojis={emojiPicker.customEmojis}
                  getEmojiUrl={(unified) => {
                    return '/apple/64/' + unified + '.png';
                  }}
                  skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                  theme={Theme.DARK}
                  onEmojiClick={(e) => {
                    emojiPicker.handleDesktopEmojiClick(e.emoji);
                  }}
                />
              </Container>
            )}

            {/* Mobile Emoji Picker */}
            {interactions.useMobileDrawer &&
              emojiPicker.showMobileEmojiDrawer && (
                <Modal
                  title=""
                  visible={emojiPicker.showMobileEmojiDrawer}
                  onClose={emojiPicker.closeMobileEmojiDrawer}
                  hideClose={false}
                >
                  <EmojiPicker
                    width="100%"
                    height={300}
                    suggestedEmojisMode={SuggestionMode.FREQUENT}
                    customEmojis={emojiPicker.customEmojis}
                    getEmojiUrl={(unified) => {
                      return '/apple/64/' + unified + '.png';
                    }}
                    skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                    theme={Theme.DARK}
                    onEmojiClick={(e) => {
                      emojiPicker.handleMobileEmojiClick(e.emoji);
                    }}
                  />
                </Modal>
              )}

            <Text className="message-sender-name">{sender.displayName}</Text>
            {message.isPinned && (
              <Tooltip
                id={`pin-indicator-${message.messageId}`}
                content={
                  message.pinnedBy
                    ? t`Pinned by ${mapSenderToUser(message.pinnedBy)?.displayName || message.pinnedBy}`
                    : t`Pinned`
                }
                showOnTouch={true}
                autoHideAfter={3000}
              >
                <Icon name="thumbtack" size="xs" className="ml-2 text-accent" />
              </Tooltip>
            )}
            <Text className="pl-2">
              {!message.signature && (
                <Tooltip
                  id={`signature-warning-${message.messageId}`}
                  content={t`Message does not have a valid signature, this may not be from the sender`}
                  showOnTouch={true}
                  autoHideAfter={3000}
                >
                  <Icon
                    name="exclamation-triangle"
                    size="xs"
                    className="text-warning"
                  />
                </Tooltip>
              )}
            </Text>
            <Text className="message-timestamp">{displayedTimestmap}</Text>
            {(() => {
              const contentData = formatting.getContentData();
              if (!contentData) return null;

              if (contentData.type === 'post') {
                // Check if we should use markdown rendering
                if (formatting.shouldUseMarkdown()) {
                  return (
                    <Container className="message-post-content break-words">
                      <MessageMarkdownRenderer
                        content={contentData.fullText}
                        mapSenderToUser={mapSenderToUser}
                        onUserClick={onUserClick}
                      />
                    </Container>
                  );
                }

                // Fall back to the original token-based rendering
                return contentData.content.map((c, i) => (
                  <Container
                    key={contentData.messageId + '-' + i}
                    className="message-post-content break-words"
                  >
                    {c.split(' ').map((t, j) => {
                      const tokenData = formatting.processTextToken(
                        t,
                        contentData.messageId,
                        i,
                        j
                      );

                      if (tokenData.type === 'mention') {
                        return (
                          <React.Fragment key={tokenData.key}>
                            <Text className={'message-name-mentions-you'}>
                              {tokenData.displayName}
                            </Text>{' '}
                          </React.Fragment>
                        );
                      }

                      if (tokenData.type === 'youtube') {
                        return (
                          <Container
                            key={tokenData.key}
                            className="message-post-content"
                          >
                            <YouTubeEmbed
                              src={
                                'https://www.youtube.com/embed/' +
                                tokenData.videoId
                              }
                              allow="autoplay; encrypted-media"
                              className="rounded-lg youtube-embed"
                            />
                          </Container>
                        );
                      }

                      if (tokenData.type === 'invite') {
                        return (
                          <InviteLink
                            key={tokenData.key}
                            inviteLink={tokenData.inviteLink}
                          />
                        );
                      }

                      if (tokenData.type === 'link') {
                        const truncatedText = tokenData.text.length > 50
                          ? tokenData.text.substring(0, 50) + '...'
                          : tokenData.text;

                        return (
                          <React.Fragment key={tokenData.key}>
                            <Text
                              as="a"
                              href={tokenData.url}
                              target="_blank"
                              referrerPolicy="no-referrer"
                            >
                              {truncatedText}
                            </Text>{' '}
                          </React.Fragment>
                        );
                      }

                      return (
                        <React.Fragment key={tokenData.key}>
                          {tokenData.text}{' '}
                        </React.Fragment>
                      );
                    })}
                  </Container>
                ));
              } else if (contentData.type === 'embed') {
                return (
                  <Container
                    key={contentData.messageId}
                    className="message-post-content"
                  >
                    {contentData.content.videoUrl?.startsWith(
                      'https://www.youtube.com/embed'
                    ) && (
                      <YouTubeEmbed
                        src={contentData.content.videoUrl}
                        allow="autoplay; encrypted-media"
                        className="rounded-lg youtube-embed"
                      />
                    )}
                    {contentData.content.imageUrl && (() => {
                      const isGif = createGifDetector(contentData.content.imageUrl, contentData.content.isLargeGif);

                      // Get the max display width from configuration
                      const config = getImageConfig('messageAttachment');
                      const gifMaxWidth = config.gifMaxDisplayWidth || 300;

                      // Track if large GIF is showing animated version (not thumbnail)
                      const [isShowingAnimation, setIsShowingAnimation] = useState(false);

                      return (
                        <div className="relative inline-block">
                          <img
                            src={contentData.content.thumbnailUrl || contentData.content.imageUrl}
                            className={`message-image rounded-lg transition-opacity duration-200 ${
                              isGif
                                ? (contentData.content.isLargeGif && contentData.content.thumbnailUrl && !isShowingAnimation
                                    ? 'cursor-pointer' // Pointer cursor for GIF static thumbnails
                                    : 'cursor-auto') // No pointer cursor for animating GIFs
                                : 'cursor-pointer hover:opacity-80' // Clickable for non-GIFs
                            }`}
                            style={{
                              maxWidth: isGif ? `${gifMaxWidth}px` : undefined // Constrain GIFs using config value
                            }}
                            onClick={(e) => {
                              if (isGif) {
                                // For GIFs: animate in-place, don't open modal
                                if (contentData.content.isLargeGif && contentData.content.thumbnailUrl) {
                                  // Switch from thumbnail to full GIF animation with error handling
                                  const img = e.target as HTMLImageElement;
                                  if (img.src.includes('thumbnail') || img.src !== contentData.content.imageUrl) {
                                    const originalSrc = img.src;

                                    // Set up error handler before changing src
                                    const handleError = () => {
                                      console.warn('Failed to load full GIF, reverting to thumbnail');
                                      img.src = originalSrc;
                                      img.removeEventListener('error', handleError);
                                      setIsShowingAnimation(false);
                                    };

                                    img.addEventListener('error', handleError);
                                    img.src = contentData.content.imageUrl!;
                                    setIsShowingAnimation(true); // Hide play icon when showing animation
                                  }
                                }
                                // For small GIFs, they're already animating - do nothing
                              } else {
                                // For static images: open modal as usual
                                formatting.handleImageClick(
                                  e,
                                  contentData.content.imageUrl!,
                                  !!contentData.content.thumbnailUrl
                                );
                              }
                            }}
                          />
                          {contentData.content.isLargeGif && contentData.content.thumbnailUrl && !isShowingAnimation && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="bg-black/50 rounded-full p-2">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </Container>
                );
              } else if (contentData.type === 'sticker') {
                // Use the same robust GIF detection for stickers
                const isStickerGif = contentData.sticker?.imgUrl ?
                  createGifDetector(contentData.sticker.imgUrl) : false;

                // Get sticker config
                const stickerConfig = getImageConfig('sticker');
                const stickerGifMaxWidth = stickerConfig.gifMaxDisplayWidth || 300;

                return (
                  <img
                    src={contentData.sticker?.imgUrl}
                    className="message-sticker rounded-lg"
                    style={{
                      maxWidth: isStickerGif ? `${stickerGifMaxWidth}px` : undefined // Use config value
                    }}
                  />
                );
              }
            })()}
            <FlexRow className="flex-wrap pt-1 -mr-1">
              {message.reactions?.map((r) => (
                <FlexRow
                  key={message.messageId + '-reactions-' + r.emojiId}
                  className={
                    'cursor-pointer items-center mr-1 mb-1 rounded-lg py-[1pt] px-2 border border-transparent whitespace-nowrap ' +
                    (r.memberIds.includes(user.currentPasskeyInfo!.address)
                      ? 'bg-accent-150 hover:bg-accent-200 dark:bg-accent-700 dark:hover:bg-accent-600'
                      : 'bg-tooltip hover:bg-surface-5')
                  }
                  onClick={() => {
                    messageActions.handleReaction(r.emojiId);
                  }}
                >
                  {emojiPicker.customEmojis.find(
                    (e) => e.id === r.emojiName
                  ) ? (
                    <img
                      width="24"
                      className="mr-1"
                      src={
                        emojiPicker.customEmojis.find(
                          (e) => e.id === r.emojiName
                        )?.imgUrl
                      }
                    />
                  ) : (
                    <Text className="mr-1">{r.emojiName}</Text>
                  )}
                  <Text className="text-sm">{r.count}</Text>
                </FlexRow>
              ))}
            </FlexRow>
          </Container>
        </FlexRow>
      )}
    </FlexColumn>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if these specific props change
  const shouldRerender = (
    prevProps.message.messageId !== nextProps.message.messageId ||
    prevProps.emojiPickerOpen !== nextProps.emojiPickerOpen ||
    prevProps.hoverTarget !== nextProps.hoverTarget ||
    prevProps.height !== nextProps.height ||
    prevProps.kickUserAddress !== nextProps.kickUserAddress ||
    JSON.stringify(prevProps.message.reactions) !== JSON.stringify(nextProps.message.reactions) ||
    prevProps.message.isPinned !== nextProps.message.isPinned
  );

  return !shouldRerender;
});
