import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as moment from 'moment-timezone';
import * as linkify from 'linkifyjs';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import {
  Emoji,
  Message as MessageType,
  Role,
  Sticker,
} from '../../api/quorumApi';
import EmojiPicker, {
  SkinTonePickerLocation,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUnlock,
} from '@fortawesome/free-solid-svg-icons';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import UserProfile from '../user/UserProfile';
import { useParams } from 'react-router';
import { InviteLink } from './InviteLink';
import { Modal } from '../primitives';
import './Message.scss';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../utils';
import { useLongPress } from '../../hooks/useLongPress';
import { useModalContext } from '../context/ModalProvider';
import { useMobile } from '../context/MobileProvider';
import { useMessageActions, useEmojiPicker, useMessageInteractions, useMessageFormatting } from '../../hooks';
import MessageActions from './MessageActions';

type MessageProps = {
  customEmoji?: Emoji[];
  stickers?: { [key: string]: Sticker };
  message: MessageType;
  messageList: MessageType[];
  senderRoles: Role[];
  canEditRoles?: boolean;
  canDeleteMessages?: boolean;
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
  const [openImage, setOpenImage] = useState<string | null>(null);

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
        onDelete: messageActions.canUserDelete ? messageActions.handleDelete : undefined,
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
    onImageClick: setOpenImage,
  });


  let sender = mapSenderToUser(message.content?.senderId);
  const isHashTarget = useMemo(() => {
    return location.hash === `#msg-${message.messageId}`;
  }, [message.messageId, location.hash]);
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
        return i18n._('{user} has joined', { user: userDisplayName });
      case 'leave':
        return i18n._('{user} has left', { user: userDisplayName });
      case 'kick':
        return i18n._('{user} has been kicked', { user: userDisplayName });
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
    <div
      id={`msg-${message.messageId}`}
      className={
        'text-base relative hover:bg-chat-hover flex flex-col ' +
        (formatting.isMentioned(user.currentPasskeyInfo!.address)
          ? ' message-mentions-you'
          : '') +
        (isHashTarget ? ' message-highlighted' : '')
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
              <div
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
                <div className="message-reply-curve" />
                <div
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
                <div className="message-reply-sender-name">
                  {mapSenderToUser(reply.content.senderId).displayName}
                </div>
                <div className="message-reply-text">
                  {reply.content.type == 'post' && reply.content.text}
                </div>
              </div>
            );
          } else {
            return <></>;
          }
        }
      })()}
      {['join', 'leave', 'kick'].includes(message.content.type) && (
        <div className="flex flex-row font-[11px] px-[11px] py-[8px] italic">
          {formatEventMessage(sender.displayName, message.content.type)}
        </div>
      )}
      {!['join', 'leave', 'kick'].includes(message.content.type) && (
        <div
          className={
            'flex flex-row w-full font-[11pt] px-[11px] pb-[8px] ' +
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
            <div
              onClick={interactions.handleUserProfileBackgroundClick}
              className={
                'absolute left-0 top-0 w-full mt-[-1000px] pb-[200px] pt-[1000px] z-[1000] flex flex-row'
              }
            >
              <div
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
              </div>
            </div>
          )}
          <div
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
          <div className="message-content">
            {interactions.shouldShowActions && (
              <MessageActions
                message={message}
                userAddress={user.currentPasskeyInfo!.address}
                canUserDelete={messageActions.canUserDelete}
                height={height}
                onReaction={messageActions.handleReaction}
                onReply={messageActions.handleReply}
                onCopyLink={messageActions.handleCopyLink}
                onDelete={messageActions.handleDelete}
                onMoreReactions={messageActions.handleMoreReactions}
                copiedLinkId={messageActions.copiedLinkId}
              />
            )}

            {emojiPickerOpen === message.messageId && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={
                  'absolute right-4 z-[9999] ' +
                  (emojiPickerOpenDirection == 'upwards' ? 'bottom-6' : 'top-0')
                }
              >
                <EmojiPicker
                  suggestedEmojisMode={SuggestionMode.FREQUENT}
                  customEmojis={emojiPicker.customEmojis}
                  getEmojiUrl={(unified, style) => {
                    return '/apple/64/' + unified + '.png';
                  }}
                  skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                  theme={Theme.DARK}
                  onEmojiClick={(e) => {
                    emojiPicker.handleDesktopEmojiClick(e.emoji);
                  }}
                />
              </div>
            )}

            {/* Mobile Emoji Picker */}
            {interactions.useMobileDrawer && emojiPicker.showMobileEmojiDrawer && (
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
                  getEmojiUrl={(unified, style) => {
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

            <span className="message-sender-name">{sender.displayName}</span>
            <span className="pl-2">
              {!repudiability && !message.signature && (
                <FontAwesomeIcon
                  title={t`Message does not have a valid signature, this may not be from the sender`}
                  size={'2xs'}
                  icon={faUnlock}
                />
              )}
            </span>
            <span className="message-timestamp">{displayedTimestmap}</span>
            {(() => {
              const contentData = formatting.getContentData();
              if (!contentData) return null;

              if (contentData.type === 'post') {
                return contentData.content.map((c, i) => (
                  <div
                    key={contentData.messageId + '-' + i}
                    className="message-post-content break-words"
                  >
                    {c.split(' ').map((t, j) => {
                      const tokenData = formatting.processTextToken(t, contentData.messageId, i, j);
                      
                      if (tokenData.type === 'mention') {
                        return (
                          <React.Fragment key={tokenData.key}>
                            <span className={'message-name-mentions-you'}>
                              {tokenData.displayName}
                            </span>{' '}
                          </React.Fragment>
                        );
                      }

                      if (tokenData.type === 'youtube') {
                        return (
                          <div
                            key={tokenData.key}
                            className="message-post-content"
                          >
                            <iframe
                              width={'560'}
                              height={'400'}
                              src={'https://www.youtube.com/embed/' + tokenData.videoId}
                              allow="autoplay; encrypted-media"
                              className="rounded-lg"
                            ></iframe>
                          </div>
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
                            <a
                              href={tokenData.url}
                              className="text-accent-300 hover:text-accent-400 hover:underline"
                              target="_blank"
                              referrerPolicy="no-referrer"
                            >
                              {tokenData.text}
                            </a>{' '}
                          </React.Fragment>
                        );
                      }

                      return (
                        <React.Fragment key={tokenData.key}>
                          {tokenData.text}{' '}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ));
              } else if (contentData.type === 'embed') {
                return (
                  <div key={contentData.messageId} className="message-post-content">
                    {contentData.content.videoUrl?.startsWith(
                      'https://www.youtube.com/embed'
                    ) && (
                      <iframe
                        width={contentData.content.width || '560'}
                        height={contentData.content.height || '400'}
                        src={contentData.content.videoUrl}
                        allow="autoplay; encrypted-media"
                        className="rounded-lg"
                      ></iframe>
                    )}
                    {contentData.content.imageUrl && (
                      <img
                        src={contentData.content.imageUrl}
                        style={{
                          maxWidth: 300,
                          maxHeight: 300,
                          width: '100%',
                          cursor: 'pointer',
                        }}
                        className="rounded-lg hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                        onClick={(e) => formatting.handleImageClick(e, contentData.content.imageUrl!)}
                      />
                    )}
                  </div>
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
            <div className="flex flex-wrap pt-1 -mr-1">
              {message.reactions?.map((r) => (
                <div
                  key={message.messageId + '-reactions-' + r.emojiId}
                  className={
                    'cursor-pointer flex flex-row items-center mr-1 mb-1 rounded-lg py-[1pt] px-2 border border-transparent whitespace-nowrap ' +
                    (r.memberIds.includes(user.currentPasskeyInfo!.address)
                      ? 'bg-accent-150 hover:bg-accent-200 dark:bg-accent-700 dark:hover:bg-accent-600'
                      : 'bg-tooltip hover:bg-surface-5')
                  }
                  onClick={() => {
                    messageActions.handleReaction(r.emojiId);
                  }}
                >
                  {emojiPicker.customEmojis.find((e) => e.id === r.emojiName) ? (
                    <img
                      width="24"
                      className="mr-1"
                      src={
                        emojiPicker.customEmojis.find((e) => e.id === r.emojiName)?.imgUrl
                      }
                    />
                  ) : (
                    <span className="mr-1">{r.emojiName}</span>
                  )}
                  <span className="text-sm">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {openImage && (
        <Modal
          title=""
          visible={true}
          onClose={() => setOpenImage(null)}
          hideClose={false}
        >
          <div className="flex justify-center items-center">
            <img
              src={openImage}
              style={{
                maxHeight: '80vh',
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
              }}
              className="rounded-lg"
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
