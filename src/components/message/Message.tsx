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
  faFaceSmileBeam,
  faReply,
  faTrash,
  faUnlock,
  faLink,
} from '@fortawesome/free-solid-svg-icons';
import { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import UserProfile from '../user/UserProfile';
import { useParams } from 'react-router';
import { InviteLink } from './InviteLink';
import Modal from '../Modal';
import './Message.scss';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { DefaultImages } from '../../utils';
import ReactTooltip from '../../components/ReactTooltip';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useLongPress } from '../../hooks/useLongPress';
import { useModalContext } from '../AppWithSearch';

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

const YTRegex = new RegExp(
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu\.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]{11})((?:\?|\&)\S+)?$/
);
const InviteRegex = new RegExp(
  /^((?:https?:)?\/\/?)?((?:www\.)?(?:qm\.one|app\.quorummessenger\.com))(\/(invite\/)?#(.*))$/
);

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
  const { openMobileActionsDrawer, openMobileEmojiDrawer } = useModalContext();

  // Responsive layout and device detection
  const { isMobile } = useResponsiveLayout();
  const isTouchDevice = 'ontouchstart' in window;
  const useMobileDrawer = isMobile;
  const useDesktopTap = !isMobile && isTouchDevice;
  const useDesktopHover = !isMobile && !isTouchDevice;

  // State for mobile emoji drawer (kept separate from actions drawer)
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);

  // State for desktop tap interaction
  const [actionsVisibleOnTap, setActionsVisibleOnTap] = useState(false);

  // State for copied link feedback
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // State for shared tooltip
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  // Effect to handle hiding tablet actions when clicking elsewhere
  React.useEffect(() => {
    if (useDesktopTap && actionsVisibleOnTap && hoverTarget === message.messageId) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (!target.closest(`#msg-${message.messageId}`)) {
          setHoverTarget(undefined);
          setActionsVisibleOnTap(false);
        }
      };

      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [useDesktopTap, actionsVisibleOnTap, hoverTarget, message.messageId]);

  const customEmojis = useMemo(() => {
    if (!customEmoji) return [];

    return customEmoji.map((c) => {
      return {
        names: [c.name],
        id: c.id,
        imgUrl: c.imgUrl,
      } as CustomEmoji;
    });
  }, [customEmoji]);
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
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);
  const [openImage, setOpenImage] = useState<string | null>(null);
  const canUserDelete = useMemo(() => {
    return (
      message.content.senderId == user.currentPasskeyInfo!.address ||
      canDeleteMessages
    );
  }, []);

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

  // Long-press handler for mobile and tablets
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (useMobileDrawer) {
        // Mobile: Open drawer
        openMobileActionsDrawer({
          message,
          onReply: handleReply,
          onCopyLink: handleCopyLink,
          onDelete: canUserDelete ? handleDelete : undefined,
          onReaction: handleReaction,
          onMoreReactions: handleMoreReactions,
          canDelete: canUserDelete,
          userAddress: user.currentPasskeyInfo!.address,
        });
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      } else if (useDesktopTap) {
        // Tablet: Show inline actions and hide others
        setHoverTarget(message.messageId);
        setActionsVisibleOnTap(true);
      }
    },
    delay: 500,
  });

  // Action handlers
  const handleReaction = (emoji: string) => {
    if (!message.reactions?.find(r => r.emojiId === emoji)?.memberIds.includes(user.currentPasskeyInfo!.address)) {
      submitMessage({
        type: 'reaction',
        messageId: message.messageId,
        reaction: emoji,
      });
    } else {
      submitMessage({
        type: 'remove-reaction',
        messageId: message.messageId,
        reaction: emoji,
      });
    }
  };

  const handleReply = () => {
    setInReplyTo(message);
    editorRef?.focus();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#msg-${message.messageId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(message.messageId);
    setTimeout(() => {
      setCopiedLinkId(prev => prev === message.messageId ? null : prev);
    }, 1500);
  };

  const handleDelete = () => {
    submitMessage({
      type: 'remove-message',
      removeMessageId: message.messageId,
    });
  };

  const handleMoreReactions = () => {
    if (useMobileDrawer) {
      openMobileEmojiDrawer({
        onEmojiClick: handleReaction,
        customEmojis: customEmojis,
      });
    } else {
      setShowEmojiDrawer(true);
    }
  };

  // Tooltip content mapping function
  const getTooltipContent = (action: string | null) => {
    switch (action) {
      case 'emoji':
        return t`More reactions`;
      case 'reply':
        return t`Reply`;
      case 'copy':
        return copiedLinkId === message.messageId ? t`Copied!` : t`Copy message link`;
      case 'delete':
        return t`Delete message`;
      default:
        return '';
    }
  };

  // Get the correct anchor ID for each action
  const getTooltipAnchorId = (action: string | null) => {
    switch (action) {
      case 'emoji':
        return `#emoji-tooltip-icon-${message.messageId}`;
      case 'reply':
        return `#reply-tooltip-icon-${message.messageId}`;
      case 'copy':
        return `#copy-link-tooltip-icon-${message.messageId}`;
      case 'delete':
        return `#delete-tooltip-icon-${message.messageId}`;
      default:
        return '';
    }
  };

  // Get the correct placement for each action
  const getTooltipPlacement = (action: string | null) => {
    switch (action) {
      case 'delete':
        return 'top-end'; // Delete is at the right edge, so expand left
      default:
        return 'top'; // All others open above and center
    }
  };

  return (
    <div
      id={`msg-${message.messageId}`}
      className={
        'text-base relative hover:bg-chat-hover flex flex-col ' +
        (message.mentions?.memberIds.includes(user.currentPasskeyInfo!.address)
          ? ' message-mentions-you'
          : '') +
        (isHashTarget ? ' message-highlighted' : '')
      }
      // Desktop mouse interaction
      onMouseOver={() => useDesktopHover && setHoverTarget(message.messageId)}
      onMouseOut={() => useDesktopHover && setHoverTarget(undefined)}
      onClick={(e) => {
        // Prevent default click behavior for mobile drawer
        if (useMobileDrawer) {
          e.preventDefault();
        }

        // For tablets, regular click should hide actions (not show them)
        if (useDesktopTap) {
          // Hide actions if clicking on a different message or same message
          if (hoverTarget !== message.messageId) {
            setHoverTarget(undefined);
            setActionsVisibleOnTap(false);
          }
        }

        // Common click behaviors
        setShowUserProfile(false);
        setEmojiPickerOpen(undefined);
      }}
      // Mobile and tablet touch interaction
      {...(useMobileDrawer || useDesktopTap ? longPressHandlers : {})}
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
              onClick={(e) => setShowUserProfile(false)}
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
                  editMode={false}
                  dismiss={() => {
                    setShowUserProfile(false);
                  }}
                />
              </div>
            </div>
          )}
          <div
            onClick={(e) => {
              setShowUserProfile(true);
              setEmojiPickerOpenDirection(
                e.clientY / height > 0.5 ? 'upwards' : 'downwards'
              );
              e.stopPropagation();
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
          <div className="message-content">
            {((hoverTarget === message.messageId && useDesktopHover) || (hoverTarget === message.messageId && actionsVisibleOnTap && useDesktopTap)) && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  return false;
                }}
                className="absolute flex flex-row right-4 top-[-10px] p-1 bg-tooltip select-none shadow-lg rounded-lg"
              >
                <div
                  onClick={() => {
                    if (
                      !message.reactions
                        ?.find((r) => r.emojiId == '❤️')
                        ?.memberIds.includes(user.currentPasskeyInfo!.address)
                    ) {
                      submitMessage({
                        type: 'reaction',
                        messageId: message.messageId,
                        reaction: '❤️',
                      });
                    }
                  }}
                  className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125  transition duration-200"
                >
                  ❤️
                </div>
                <div
                  onClick={() => {
                    if (
                      !message.reactions
                        ?.find((r) => r.emojiId == '👍')
                        ?.memberIds.includes(user.currentPasskeyInfo!.address)
                    ) {
                      submitMessage({
                        type: 'reaction',
                        messageId: message.messageId,
                        reaction: '👍',
                      });
                    }
                  }}
                  className="w-5 mr-1 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125  transition duration-200"
                >
                  👍
                </div>
                <div
                  onClick={() => {
                    if (
                      !message.reactions
                        ?.find((r) => r.emojiId == '🫡')
                        ?.memberIds.includes(user.currentPasskeyInfo!.address)
                    ) {
                      submitMessage({
                        type: 'reaction',
                        messageId: message.messageId,
                        reaction: '🔥',
                      });
                    }
                  }}
                  className="w-5 text-center rounded-md flex flex-col justify-around cursor-pointer hover:scale-125  transition duration-200"
                >
                  🔥
                </div>
                <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>
                <div
                  id={`emoji-tooltip-icon-${message.messageId}`}
                  onClick={(e) => {
                    setEmojiPickerOpen(message.messageId);
                    setEmojiPickerOpenDirection(
                      e.clientY / height > 0.5 ? 'upwards' : 'downwards'
                    );
                  }}
                  onMouseEnter={() => setHoveredAction('emoji')}
                  onMouseLeave={() => setHoveredAction(null)}
                  className="w-5 mr-2 text-center hover:scale-125 text-surface-9 hover:text-surface-10 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
                >
                  <FontAwesomeIcon icon={faFaceSmileBeam} />
                </div>

                <div
                  id={`reply-tooltip-icon-${message.messageId}`}
                  onClick={() => {
                    setInReplyTo(message);
                    editorRef?.focus();
                  }}
                  onMouseEnter={() => setHoveredAction('reply')}
                  onMouseLeave={() => setHoveredAction(null)}
                  className="w-5 mr-2 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
                >
                  <FontAwesomeIcon icon={faReply} />
                </div>

                <div
                  id={`copy-link-tooltip-icon-${message.messageId}`}
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#msg-${message.messageId}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLinkId(message.messageId);

                    // Reset tooltip after 1.5s
                    setTimeout(() => {
                      setCopiedLinkId((prev) =>
                        prev === message.messageId ? null : prev
                      );
                    }, 1500);
                  }}
                  onMouseEnter={() => setHoveredAction('copy')}
                  onMouseLeave={() => setHoveredAction(null)}
                  className="w-5 text-center text-surface-9 hover:text-surface-10 hover:scale-125 transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
                >
                  <FontAwesomeIcon icon={faLink} />
                </div>

                {canUserDelete && (
                  <>
                    <div className="w-2 mr-2 text-center flex flex-col border-r border-r-1 border-surface-5"></div>

                    <div
                      id={`delete-tooltip-icon-${message.messageId}`}
                      onClick={() => {
                        submitMessage({
                          type: 'remove-message',
                          removeMessageId: message.messageId,
                        });
                      }}
                      onMouseEnter={() => setHoveredAction('delete')}
                      onMouseLeave={() => setHoveredAction(null)}
                      className="w-5 text-center transition duration-200 rounded-md flex flex-col justify-around cursor-pointer"
                    >
                      <FontAwesomeIcon
                        icon={faTrash}
                        className="text-[rgb(var(--danger))] hover:text-[rgb(var(--danger-hover))] hover:scale-125"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Shared tooltip for all action icons to avoid flashing issues */}
            {((hoverTarget === message.messageId && useDesktopHover) || (hoverTarget === message.messageId && actionsVisibleOnTap && useDesktopTap)) && hoveredAction && (
              <ReactTooltip
                id={`shared-action-tooltip-${message.messageId}`}
                content={getTooltipContent(hoveredAction)}
                place={getTooltipPlacement(hoveredAction) as any}
                anchorSelect={getTooltipAnchorId(hoveredAction)}
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
                  customEmojis={customEmojis}
                  getEmojiUrl={(unified, style) => {
                    return '/apple/64/' + unified + '.png';
                  }}
                  skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                  theme={Theme.DARK}
                  onEmojiClick={(e) => {
                    if (
                      !message.reactions
                        ?.find((r) => r.emojiId == e.emoji)
                        ?.memberIds.includes(user.currentPasskeyInfo!.address)
                    ) {
                      submitMessage({
                        type: 'reaction',
                        messageId: message.messageId,
                        reaction: e.emoji,
                      });
                    } else {
                      submitMessage({
                        type: 'remove-reaction',
                        messageId: message.messageId,
                        reaction: e.emoji,
                      });
                    }
                    setEmojiPickerOpen(undefined);
                  }}
                />
              </div>
            )}

            {/* Mobile Emoji Picker */}
            {useMobileDrawer && showEmojiDrawer && (
              <Modal
                title=""
                visible={showEmojiDrawer}
                onClose={() => setShowEmojiDrawer(false)}
                hideClose={false}
              >
                <EmojiPicker
                  width="100%"
                  height={300}
                  suggestedEmojisMode={SuggestionMode.FREQUENT}
                  customEmojis={customEmojis}
                  getEmojiUrl={(unified, style) => {
                    return '/apple/64/' + unified + '.png';
                  }}
                  skinTonePickerLocation={SkinTonePickerLocation.PREVIEW}
                  theme={Theme.DARK}
                  onEmojiClick={(e) => {
                    handleReaction(e.emoji);
                    setShowEmojiDrawer(false);
                  }}
                />
              </Modal>
            )}

            <span className="message-sender-name">{sender.displayName}</span>
            <span className="pl-2">
              {!message.signature && (
                <FontAwesomeIcon
                  title={t`Message does not have a valid signature, this may not be from the sender`}
                  size={'2xs'}
                  icon={faUnlock}
                />
              )}
            </span>
            <span className="message-timestamp">{displayedTimestmap}</span>
            {(() => {
              if (message.content.type == 'post') {
                let content = Array.isArray(message.content.text)
                  ? message.content.text
                  : message.content.text.split('\n');
                return content.map((c, i) => {
                  return (
                    <div
                      key={message.messageId + '-' + i}
                      className="message-post-content break-words"
                    >
                      {c.split(' ').map((t, j) => {
                        if (t.match(new RegExp(`^@<Qm[a-zA-Z0-9]+>$`))) {
                          const mention = mapSenderToUser(
                            t.substring(2, t.length - 1)
                          );
                          return (
                            <React.Fragment
                              key={message.messageId + '-' + i + '-' + j}
                            >
                              <span className={'message-name-mentions-you'}>
                                {mention.displayName}
                              </span>{' '}
                            </React.Fragment>
                          );
                        }

                        if (t.match(YTRegex)) {
                          const group = t.match(YTRegex)![6];
                          return (
                            <div
                              key={message.messageId + '-' + i + '-' + j}
                              className="message-post-content"
                            >
                              <iframe
                                width={'560'}
                                height={'400'}
                                src={'https://www.youtube.com/embed/' + group}
                                allow="autoplay; encrypted-media"
                                className="rounded-lg"
                              ></iframe>
                            </div>
                          );
                        }

                        if (t.match(InviteRegex)) {
                          return (
                            <InviteLink
                              key={message.messageId + '-' + j}
                              inviteLink={t}
                            />
                          );
                        }

                        return (
                          <React.Fragment
                            key={message.messageId + '-' + i + '-' + j}
                          >
                            {linkify.test(t) ? (
                              <a
                                href={linkify.find(t)[0].href}
                                className="text-accent-300 hover:text-accent-400 hover:underline"
                                target="_blank"
                                referrerPolicy="no-referrer"
                              >
                                {t}
                              </a>
                            ) : (
                              <>{t}</>
                            )}{' '}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                });
              } else if (message.content.type == 'embed') {
                let content = message.content as {
                  imageUrl?: string;
                  videoUrl?: string;
                  width?: string;
                  height?: string;
                };
                return (
                  <div key={message.messageId} className="message-post-content">
                    {content.videoUrl?.startsWith(
                      'https://www.youtube.com/embed'
                    ) && (
                      <iframe
                        width={content.width || '560'}
                        height={content.height || '400'}
                        src={content.videoUrl}
                        allow="autoplay; encrypted-media"
                        className="rounded-lg"
                      ></iframe>
                    )}
                    {content.imageUrl && (
                      <img
                        src={content.imageUrl}
                        style={{
                          maxWidth: 300,
                          maxHeight: 300,
                          width: '100%',
                          cursor: 'pointer',
                        }}
                        className="rounded-lg hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                        onClick={(e) => {
                          const img = e.currentTarget;
                          if (
                            (img.naturalWidth > 300 ||
                              img.naturalHeight > 300) &&
                            content.imageUrl
                          ) {
                            setOpenImage(content.imageUrl);
                          }
                        }}
                      />
                    )}
                  </div>
                );
              } else if (message.content.type == 'sticker') {
                const sticker = (stickers ?? {})[message.content.stickerId];
                return (
                  <img
                    src={sticker?.imgUrl}
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
                    const hasReacted = r.memberIds.includes(
                      user.currentPasskeyInfo!.address
                    );
                    submitMessage({
                      type: hasReacted ? 'remove-reaction' : 'reaction',
                      messageId: message.messageId,
                      reaction: r.emojiId,
                    });
                  }}
                >
                  {customEmojis.find((e) => e.id === r.emojiName) ? (
                    <img
                      width="24"
                      className="mr-1"
                      src={
                        customEmojis.find((e) => e.id === r.emojiName)?.imgUrl
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
