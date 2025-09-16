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
};

export const Message = ({
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
      openMobileActionsDrawer({
        ...config,
        onReply: messageActions.handleReply,
        onCopyLink: messageActions.handleCopyLink,
        onDelete: messageActions.canUserDelete
          ? messageActions.handleDelete
          : undefined,
        onReaction: messageActions.handleReaction,
        onMoreReactions: handleMoreReactions,
        canDelete: messageActions.canUserDelete,
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
    mapSenderToUser
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
            onClick={interactions.handleUserProfileClick}
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
                            <iframe
                              src={
                                'https://www.youtube.com/embed/' +
                                tokenData.videoId
                              }
                              allow="autoplay; encrypted-media"
                              className="rounded-lg youtube-embed"
                            ></iframe>
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
                        return (
                          <React.Fragment key={tokenData.key}>
                            <Text
                              as="a"
                              href={tokenData.url}
                              target="_blank"
                              referrerPolicy="no-referrer"
                            >
                              {tokenData.text}
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
                      <iframe
                        src={contentData.content.videoUrl}
                        allow="autoplay; encrypted-media"
                        className="rounded-lg youtube-embed"
                      ></iframe>
                    )}
                    {contentData.content.imageUrl && (
                      <img
                        src={contentData.content.imageUrl}
                        style={{
                          maxWidth: 300,
                          maxHeight: 300,
                          width: 'auto',
                          cursor: 'pointer',
                        }}
                        className="rounded-lg hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                        onClick={(e) =>
                          formatting.handleImageClick(
                            e,
                            contentData.content.imageUrl!
                          )
                        }
                      />
                    )}
                  </Container>
                );
              } else if (contentData.type === 'sticker') {
                return (
                  <img
                    src={contentData.sticker?.imgUrl}
                    style={{ maxWidth: 300, maxHeight: 300 }}
                    className="rounded-lg"
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
};
