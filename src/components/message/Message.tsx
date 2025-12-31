import { logger } from '@quilibrium/quorum-shared';
import React, { useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Icon,
  Tooltip,
  Portal,
} from '../primitives';
import { useImageModal } from '../context/ImageModalProvider';
import './Message.scss';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { YouTubeEmbed } from '../ui/YouTubeEmbed';
import { useMobile } from '../context/MobileProvider';
import { UserAvatar } from '../user/UserAvatar';
import {
  useMessageActions,
  useEmojiPicker,
  useMessageInteractions,
  useMessageFormatting,
  usePinnedMessages,
} from '../../hooks';
import type { DmContext } from '../../hooks/business/messages/useMessageActions';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import { useViewportMentionHighlight } from '../../hooks/business/messages/useViewportMentionHighlight';
import MessageActions from './MessageActions';
import MessageActionsMenu from './MessageActionsMenu';
import { MessageMarkdownRenderer } from './MessageMarkdownRenderer';
import { isTouchDevice } from '../../utils/platform';
import { hapticLight } from '../../utils/haptic';
import { formatMessageDate } from '../../utils';
import { useEditHistoryModal } from '../context/EditHistoryModalProvider';
import { MessageEditTextarea } from './MessageEditTextarea';
import { ENABLE_MARKDOWN } from '../../config/features';
import { replaceMentionsWithDisplayNames } from '../../utils/markdownStripping';

// Utility function for robust GIF detection
const createGifDetector = (url: string, isLargeGif?: boolean) => {
  const normalizedUrl = url.toLowerCase();
  return (
    normalizedUrl.includes('data:image/gif') ||
    /\.gif(\?[^#]*)?(?:#.*)?$/i.test(normalizedUrl) ||
    !!isLargeGif
  );
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
  emojiPickerPosition: { x: number; y: number } | null;
  setEmojiPickerPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  hoverTarget: string | undefined;
  setHoverTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
  setInReplyTo: React.Dispatch<React.SetStateAction<MessageType | undefined>>;
  editorRef: any;
  height: number;
  submitMessage: (message: any) => Promise<void>;
  onUserClick?: (
    user: {
      address: string;
      displayName?: string;
      userIcon?: string;
    },
    event: React.MouseEvent,
    context?: { type: 'mention' | 'message-avatar'; element: HTMLElement }
  ) => void;
  onChannelClick?: (channelId: string) => void;
  spaceChannels?: Channel[];
  lastReadTimestamp?: number;
  spaceRoles?: Role[];
  spaceName?: string;
  onRetryMessage?: (message: MessageType) => void;
  /** DM context for offline-resilient reactions/deletes/edits (optional - only for DMs) */
  dmContext?: DmContext;
};

export const Message = React.memo(
  ({
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
    emojiPickerPosition,
    setEmojiPickerPosition,
    hoverTarget,
    setHoverTarget,
    setInReplyTo,
    editorRef,
    height,
    submitMessage,
    onUserClick,
    onChannelClick,
    spaceChannels = [],
    lastReadTimestamp = 0,
    spaceRoles = [],
    spaceName,
    onRetryMessage,
    dmContext,
  }: MessageProps) => {
    const user = usePasskeysContext();
    const { spaceId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { openMobileActionsDrawer, openMobileEmojiDrawer } = useMobile();

    // Component state that needs to be available to hooks
    const [showUserProfile, setShowUserProfile] = useState<boolean>(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isShowingGifAnimation, setIsShowingGifAnimation] = useState(false);

    // Modal contexts
    const { showImageModal } = useImageModal();
    const { showEditHistoryModal } = useEditHistoryModal();

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
      stickers,
      onEdit: (msg) => {
        if (msg.content.type === 'post') {
          setEditingMessageId(msg.messageId);
        }
      },
      onViewEditHistory: (msg) => {
        showEditHistoryModal(msg);
      },
      spaceRoles,
      spaceChannels,
      onChannelClick,
      // Bookmark context - determine from URL and message data
      spaceId: spaceId || message.spaceId,
      channelId: channel?.channelId || message.channelId,
      conversationId: (() => {
        // DM detection: /messages/ route with same spaceId/channelId
        const isDM = location.pathname.includes('/messages/') &&
                     message.spaceId === message.channelId;

        if (isDM) {
          // Use spaceId/spaceId format to match system expectations
          return `${message.spaceId}/${message.spaceId}`;
        }

        return undefined;
      })(),
      sourceName: (() => {
        // For DMs, return empty string (no source info shown)
        if (location.pathname.includes('/messages/') && message.spaceId === message.channelId) {
          return '';
        }

        // For channels, include space name if available
        if (channel?.channelName) {
          return spaceName ? `${spaceName} > ${channel.channelName}` : channel.channelName;
        }

        return 'Unknown';
      })(),
      // DM context for offline-resilient reactions/deletes
      dmContext,
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
          ...buildDrawerConfig(),
          ...config,
        });
      },
      onEmojiPickerUserProfileClick: emojiPicker.handleUserProfileClick,
      onReply: messageActions.handleReply,
      isEditing: editingMessageId === message.messageId,
    });

    // Message formatting logic
    const formatting = useMessageFormatting({
      message,
      stickers,
      mapSenderToUser,
      onImageClick: showImageModal,
      spaceRoles,
      spaceChannels,
      currentSpaceId: spaceId,
    });

    // Pinned messages logic
    const pinnedMessages = usePinnedMessages(
      message.spaceId || spaceId || '',
      message.channelId || '',
      channel,
      mapSenderToUser,
      stickers,
      spaceRoles,
      spaceChannels,
      onChannelClick
    );

    // Message highlighting - dual mechanism design:
    // 1. URL Hash: Cross-component communication (pinned, bookmarks, search, reply clicks)
    //    - Hash is global browser state all Message components detect via useLocation()
    // 2. Local State: Self-highlighting for mentions when they enter viewport
    //    - useViewportMentionHighlight calls highlightMessage on THIS component's hook instance
    const { isHighlighted, highlightMessage, getHighlightVariant } = useMessageHighlight();
    const isMessageHighlighted = useMemo(() => {
      // Check BOTH mechanisms - hash for cross-component, state for self-highlighting
      const isUrlTarget = location.hash === `#msg-${message.messageId}`;
      const isStateHighlighted = isHighlighted(message.messageId);
      return isUrlTarget || isStateHighlighted;
    }, [message.messageId, location.hash, isHighlighted]);

    const highlightClassName = useMemo(() => {
      if (!isMessageHighlighted) return '';
      const variant = getHighlightVariant();
      return variant === 'mention' ? 'message-highlighted-mention' : 'message-highlighted';
    }, [isMessageHighlighted, getHighlightVariant]);

    // Auto-highlight mentioned messages when they enter viewport (60 second duration)
    // Only highlights UNREAD mentions (messages created after last read time)
    const isMentioned = formatting.isMentioned(
      user.currentPasskeyInfo!.address
    );
    const isUnread = message.createdDate > lastReadTimestamp;
    const mentionRef = useViewportMentionHighlight(
      message.messageId,
      isMentioned,
      isUnread,
      highlightMessage
    );

    const sender = mapSenderToUser(message.content?.senderId);
    const displayedTimestmap = formatMessageDate(message.createdDate);
    const isEdited = message.modifiedDate !== message.createdDate;

    const formatEventMessage = (userDisplayName: string, type: string) => {
      switch (type) {
        case 'join':
          return (
            <>
              <Icon name="user-plus" size="sm" className="mr-2 text-subtle flex-shrink-0" />
              <span className="truncate-user-name-chat">{userDisplayName}</span>
              <span className="ml-1 flex-shrink-0">{i18n._('has joined')}</span>
            </>
          );
        case 'leave':
          return (
            <>
              <Icon name="logout" size="sm" className="mr-2 text-subtle flex-shrink-0" />
              <span className="truncate-user-name-chat">{userDisplayName}</span>
              <span className="ml-1 flex-shrink-0">{i18n._('has left')}</span>
            </>
          );
        case 'kick':
          return (
            <>
              <Icon name="ban" size="sm" className="mr-2 text-danger flex-shrink-0" />
              <span className="truncate-user-name-chat">{userDisplayName}</span>
              <span className="ml-1 flex-shrink-0">{i18n._('has been kicked')}</span>
            </>
          );
      }
    };

    // Handle more reactions with mobile/desktop logic
    const handleMoreReactions = useCallback(() => {
      // Always use MobileProvider's emoji drawer (EmojiPickerDrawer)
      // This is used from MessageActionsDrawer, which is part of the mobile drawer system
      openMobileEmojiDrawer({
        onEmojiClick: messageActions.handleReaction,
        customEmojis: emojiPicker.customEmojis,
      });
    }, [openMobileEmojiDrawer, messageActions.handleReaction, emojiPicker.customEmojis]);

    // Handle 3-dots menu click for touch devices
    const handle3DotsMenuClick = (event: React.MouseEvent) => {
      event.stopPropagation();

      // Add haptic feedback for touch interaction
      hapticLight();

      // All touch devices: Open bottom drawer with message actions
      openMobileActionsDrawer(buildDrawerConfig());
    };

    // Shared drawer configuration builder to avoid duplication
    const buildDrawerConfig = useCallback(
      () => ({
          message,
          onReply: messageActions.handleReply,
          onCopyLink: messageActions.handleCopyLink,
          onCopyMessageText: messageActions.handleCopyMessageText,
          onDelete: messageActions.canUserDelete
            ? () =>
                messageActions.handleDelete({
                  shiftKey: false,
                } as React.MouseEvent)
            : undefined,
          onPin: pinnedMessages.canPinMessages
            ? () =>
                pinnedMessages.togglePin(
                  { shiftKey: false } as React.MouseEvent,
                  message
                )
            : undefined,
          onReaction: messageActions.handleReaction,
          onMoreReactions: handleMoreReactions,
          onEdit: messageActions.canUserEdit ? messageActions.handleEdit : undefined,
          onViewEditHistory: messageActions.canViewEditHistory ? messageActions.handleViewEditHistory : undefined,
          canDelete: messageActions.canUserDelete,
          canEdit: messageActions.canUserEdit,
          canViewEditHistory: messageActions.canViewEditHistory,
          canPinMessages: pinnedMessages.canPinMessages,
          userAddress: user.currentPasskeyInfo!.address,
          // Bookmark functionality
          isBookmarked: messageActions.isBookmarked,
          onBookmarkToggle: messageActions.handleBookmarkToggle,
      }),
      [message, messageActions, pinnedMessages, user, handleMoreReactions]
    );

    // Handle right-click context menu (desktop only)
    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        // Only show context menu on non-touch devices
        if (isTouchDevice()) return;

        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      },
      []
    );

    return (
      <FlexColumn
        ref={mentionRef}
        id={`msg-${message.messageId}`}
        className={
          'text-base relative ' +
          (isTouchDevice()
            ? 'border-t-2 border-t-surface-00 pt-2' // Add thicker top border for touch devices
            : 'hover:bg-chat-hover ') + // Only add hover effect on non-touch devices
          // Note: Mentions now use 60-second highlight (message-highlighted-mention)
          // Other highlights (search, pinned, hash) use 6-second highlight (message-highlighted)
          // The viewport hook auto-triggers the highlight when mentioned messages enter view
          (highlightClassName ? ` ${highlightClassName}` : '')
        }
        // Desktop mouse interaction
        onMouseOver={interactions.handleMouseOver}
        onMouseOut={interactions.handleMouseOut}
        onClick={interactions.handleMessageClick}
        onDoubleClick={interactions.handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* 3-Dots Menu Button for Touch Devices - Top Right Corner */}
        {isTouchDevice() && (
          <Container
            onClick={handle3DotsMenuClick}
            className="absolute top-2 right-2 p-2 cursor-pointer rounded z-10"
            style={{ minWidth: '32px', minHeight: '32px' }}
          >
            <Icon
              name="dots-vertical"
              size="sm"
              className="text-muted hover:text-main transition-colors"
            />
          </Container>
        )}

        {(() => {
          if (message.content.type == 'post') {
            const replyIndex = !message.content.repliesToMessageId
              ? undefined
              : messageList.findIndex(
                  (c) =>
                    c.messageId === (message.content as any).repliesToMessageId
                );
            const reply =
              replyIndex !== undefined ? messageList[replyIndex] : undefined;
            if (reply) {
              // Get reply text and replace mention addresses with display names
              const replyText = reply.content.type == 'post'
                ? (Array.isArray(reply.content.text)
                    ? reply.content.text.join(' ')
                    : reply.content.text)
                : '';
              const replyTextWithNames = replaceMentionsWithDisplayNames(
                replyText,
                mapSenderToUser
              );

              return (
                <Container
                  key={reply.messageId + 'rplyhd'}
                  className={`message-reply-heading flex items-center min-w-0 ${
                    isTouchDevice() ? 'pr-12' : ''
                  }`}
                  onClick={() => {
                    // Navigate with hash to trigger highlighting via URL state
                    const currentPath = window.location.pathname;
                    navigate(`${currentPath}#msg-${reply.messageId}`);

                    // Scroll to the message
                    virtuosoRef?.scrollToIndex({
                      index: replyIndex,
                      align: 'start',
                      behavior: 'smooth',
                    });

                    // Remove hash after highlight animation completes (8s matches CSS animation)
                    setTimeout(() => {
                      history.replaceState(
                        null,
                        '',
                        window.location.pathname + window.location.search
                      );
                    }, 8000);
                  }}
                >
                  <Container className="message-reply-curve flex-shrink-0" />
                  <UserAvatar
                    userIcon={mapSenderToUser(reply.content.senderId).userIcon}
                    displayName={
                      mapSenderToUser(reply.content.senderId).displayName
                    }
                    address={reply.content.senderId}
                    size={32}
                    className="message-reply-sender-icon flex-shrink-0"
                  />
                  <Text className="message-reply-sender-name flex-shrink-0 truncate-user-name-chat">
                    {mapSenderToUser(reply.content.senderId).displayName}
                  </Text>
                  <Text className="message-reply-text flex-1 min-w-0">
                    {replyTextWithNames}
                  </Text>
                </Container>
              );
            } else {
              return <></>;
            }
          }
        })()}
        {['join', 'leave', 'kick'].includes(message.content.type) && (
          <FlexRow className="px-4 py-2 italic items-center min-w-0" align="center">
            <Text
              variant={message.content.type === 'kick' ? 'danger' : 'subtle'}
              className="flex items-center min-w-0 flex-1"
            >
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
                    roles={senderRoles}
                    user={sender}
                    dismiss={() => {
                      setShowUserProfile(false);
                    }}
                  />
                </Container>
              </FlexRow>
            )}
            <UserAvatar
              userIcon={sender.userIcon}
              displayName={sender.displayName}
              address={sender.address}
              size={44}
              className="message-sender-icon"
              onClick={
                isTouchDevice()
                  ? interactions.handleUserProfileClick
                  : (event: React.MouseEvent) => {
                      event.stopPropagation();
                      if (onUserClick) {
                        onUserClick(
                          {
                            address: sender.address,
                            displayName: sender.displayName,
                            userIcon: sender.userIcon,
                          },
                          event,
                          {
                            type: 'message-avatar',
                            element: event.currentTarget as HTMLElement,
                          }
                        );
                      }
                    }
              }
            />
            <Container className="message-content">
              {interactions.shouldShowActions && (
                <MessageActions
                  message={message}
                  userAddress={user.currentPasskeyInfo!.address}
                  canUserDelete={messageActions.canUserDelete}
                  canUserEdit={messageActions.canUserEdit}
                  canPinMessages={
                    canPinMessages !== undefined
                      ? canPinMessages
                      : pinnedMessages.canPinMessages
                  }
                  height={height}
                  onReaction={messageActions.handleReaction}
                  onReply={messageActions.handleReply}
                  onCopyLink={messageActions.handleCopyLink}
                  onCopyMessageText={messageActions.handleCopyMessageText}
                  onDelete={messageActions.handleDelete}
                  onPin={(e) => pinnedMessages.togglePin(e, message)}
                  onMoreReactions={messageActions.handleMoreReactions}
                  onEdit={messageActions.handleEdit}
                  onViewEditHistory={messageActions.handleViewEditHistory}
                  canViewEditHistory={messageActions.canViewEditHistory}
                  copiedLinkId={messageActions.copiedLinkId}
                  copiedMessageText={messageActions.copiedMessageText}
                  // Bookmark props
                  isBookmarked={messageActions.isBookmarked}
                  onBookmarkToggle={messageActions.handleBookmarkToggle}
                />
              )}

              {emojiPickerOpen === message.messageId && !emojiPickerPosition && (
                <Container
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className={
                    'absolute right-4 z-[9999] ' +
                    (emojiPickerOpenDirection == 'upwards'
                      ? 'bottom-6'
                      : 'top-0')
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

              {/* Fixed position emoji picker (opened from context menu) */}
              {emojiPickerOpen === message.messageId && emojiPickerPosition && (
                <Portal>
                  <Container
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="fixed z-[10002]"
                    style={{
                      left: Math.min(emojiPickerPosition.x, window.innerWidth - 352),
                      top: Math.min(emojiPickerPosition.y, window.innerHeight - 435),
                    }}
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
                        setEmojiPickerPosition(null);
                      }}
                    />
                  </Container>
                </Portal>
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

              {/* Desktop layout: horizontal row with username and timestamp */}
              <FlexRow align="center" className="items-center min-w-0 hidden xs:flex">
                <Text className="message-sender-name truncate-user-name-chat flex-shrink min-w-0">
                  {sender.displayName}
                </Text>
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
                    <Icon
                      name="pin"
                      size="sm"
                      variant="filled"
                      className="ml-2 text-accent"
                    />
                  </Tooltip>
                )}
                {messageActions.isBookmarked && (
                  <Tooltip
                    id={`bookmark-indicator-${message.messageId}`}
                    content={t`Bookmarked`}
                    showOnTouch={true}
                    autoHideAfter={3000}
                  >
                    <Icon
                      name="bookmark"
                      size="sm"
                      variant="filled"
                      className="ml-2 text-accent"
                    />
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
                        name="warning"
                        variant="filled"
                        size="xs"
                        className="text-warning"
                      />
                    </Tooltip>
                  )}
                </Text>
                <FlexRow align="center" gap="xs" className="flex-shrink-0 min-w-20 mr-4">
                  <Text className="message-timestamp">{displayedTimestmap}</Text>
                  {isEdited && (
                    <Text variant="subtle" size="xs">
                      {t`(edited)`}
                    </Text>
                  )}
                </FlexRow>
              </FlexRow>

              {/* Mobile layout: vertical stack with timestamp above username */}
              <FlexColumn className="xs:hidden items-start">
                {/* Timestamp row on mobile - aligned to left edge */}
                <FlexRow align="center" gap="xs" className="mb-1 flex-shrink-0 min-w-20 mr-4">
                  <Text className="message-timestamp">{displayedTimestmap}</Text>
                  {isEdited && (
                    <Text variant="subtle" size="xs">
                      {t`(edited)`}
                    </Text>
                  )}
                </FlexRow>

                {/* Username row on mobile */}
                <FlexRow align="center" className="items-center min-w-0">
                  <Text className="message-sender-name truncate-user-name-chat flex-shrink min-w-0">
                    {sender.displayName}
                  </Text>
                  {message.isPinned && (
                    <Tooltip
                      id={`pin-indicator-mobile-${message.messageId}`}
                      content={
                        message.pinnedBy
                          ? t`Pinned by ${mapSenderToUser(message.pinnedBy)?.displayName || message.pinnedBy}`
                          : t`Pinned`
                      }
                      showOnTouch={true}
                      autoHideAfter={3000}
                    >
                      <Icon
                        name="pin"
                        size="sm"
                        variant="filled"
                        className="ml-2 text-accent"
                      />
                    </Tooltip>
                  )}
                  {messageActions.isBookmarked && (
                    <Tooltip
                      id={`bookmark-indicator-mobile-${message.messageId}`}
                      content={t`Bookmarked`}
                      showOnTouch={true}
                      autoHideAfter={3000}
                    >
                      <Icon
                        name="bookmark"
                        size="sm"
                        variant="filled"
                        className="ml-2 text-accent"
                      />
                    </Tooltip>
                  )}
                  <Text className="pl-2">
                    {!message.signature && (
                      <Tooltip
                        id={`signature-warning-mobile-${message.messageId}`}
                        content={t`Message does not have a valid signature, this may not be from the sender`}
                        showOnTouch={true}
                        autoHideAfter={3000}
                      >
                        <Icon
                          name="warning"
                          variant="filled"
                          size="xs"
                          className="text-warning"
                        />
                      </Tooltip>
                    )}
                  </Text>
                </FlexRow>
              </FlexColumn>

              {(() => {
                const contentData = formatting.getContentData();
                if (!contentData) return null;

                // Show edit UI if this message is being edited
                if (editingMessageId === message.messageId && contentData.type === 'post') {
                  // Extract text exactly as stored - no modifications
                  const messageText = message.content.type === 'post' ? message.content.text : '';
                  const initialText = Array.isArray(messageText)
                    ? messageText.join('\n')
                    : messageText || '';

                  return (
                    <MessageEditTextarea
                      message={message}
                      initialText={initialText}
                      onCancel={() => setEditingMessageId(null)}
                      submitMessage={submitMessage}
                      mapSenderToUser={mapSenderToUser}
                      dmContext={dmContext}
                    />
                  );
                }

                if (contentData.type === 'post') {
                  // Check if we should use markdown rendering (disabled for security review)
                  if (ENABLE_MARKDOWN && formatting.shouldUseMarkdown()) {
                    return (
                      <Container className="message-post-content break-words">
                        <MessageMarkdownRenderer
                          content={contentData.fullText}
                          mapSenderToUser={mapSenderToUser}
                          onUserClick={onUserClick}
                          onChannelClick={onChannelClick}
                          onMessageLinkClick={(channelId, messageId) => {
                            if (spaceId) {
                              navigate(`/spaces/${spaceId}/${channelId}#msg-${messageId}`);
                            }
                          }}
                          hasEveryoneMention={message.mentions?.everyone}
                          roleMentions={message.mentions?.roleIds}
                          channelMentions={message.mentions?.channelIds}
                          spaceRoles={spaceRoles}
                          spaceChannels={spaceChannels}
                          messageSenderId={message.content?.senderId}
                          currentUserAddress={user.currentPasskeyInfo?.address}
                          currentSpaceId={spaceId}
                        />
                      </Container>
                    );
                  }

                  // Fall back to the original token-based rendering
                  return contentData.content.map((c, i) => {
                    // Smart tokenization: preserve mention patterns (which may contain spaces in display names)
                    // Matches: @[Display Name]<address> or #[Channel Name]<channelId> as single tokens
                    const mentionPattern = /(@(?:\[[^\]]+\])?<[^>]+>|#(?:\[[^\]]+\])?<[^>]+>)/g;
                    const tokens: string[] = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = mentionPattern.exec(c)) !== null) {
                      // Add any text before this mention (split by spaces)
                      if (match.index > lastIndex) {
                        const beforeText = c.slice(lastIndex, match.index);
                        tokens.push(...beforeText.split(' ').filter(t => t));
                      }
                      // Add the mention as a single token
                      tokens.push(match[0]);
                      lastIndex = match.index + match[0].length;
                    }
                    // Add any remaining text after the last mention
                    if (lastIndex < c.length) {
                      const afterText = c.slice(lastIndex);
                      tokens.push(...afterText.split(' ').filter(t => t));
                    }

                    return (
                      <Container
                        key={contentData.messageId + '-' + i}
                        className="message-post-content break-words"
                      >
                        {tokens.map((t, j) => {
                          const tokenData = formatting.processTextToken(
                            t,
                            contentData.messageId,
                            i,
                            j
                          );

                          if (tokenData.type === 'mention') {
                            // Check if this is @everyone, a role mention, or a user mention
                            const isEveryone = tokenData.address === 'everyone';
                            const isRole = !isEveryone && !tokenData.address.startsWith('Qm');
                            const mentionClass = isEveryone
                              ? 'message-mentions-everyone'
                              : isRole
                                ? 'message-mentions-role'
                                : 'message-mentions-user';
                            return (
                              <React.Fragment key={tokenData.key}>
                                <Text className={mentionClass}>
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
                            const truncatedText =
                              tokenData.text.length > 50
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

                          if (tokenData.type === 'channel-mention') {
                            return (
                              <React.Fragment key={tokenData.key}>
                                <Text
                                  as="span"
                                  className={`message-mentions-channel ${tokenData.isInteractive ? 'interactive' : 'non-interactive'}`}
                                  onClick={tokenData.isInteractive ? () => {
                                    if (onChannelClick) {
                                      onChannelClick(tokenData.channelId);
                                    }
                                  } : undefined}
                                >
                                  {tokenData.displayName}
                                </Text>{' '}
                              </React.Fragment>
                            );
                          }

                          if (tokenData.type === 'message-link') {
                            return (
                              <React.Fragment key={tokenData.key}>
                                <Text
                                  as="span"
                                  className={`message-mentions-message-link ${tokenData.isInteractive ? 'interactive' : 'non-interactive'}`}
                                  onClick={tokenData.isInteractive ? () => {
                                    // Navigate to the message in the channel
                                    if (spaceId) {
                                      navigate(`/spaces/${spaceId}/${tokenData.channelId}#msg-${tokenData.messageId}`);
                                    }
                                  } : undefined}
                                >
                                  #{tokenData.channelName}
                                  <span className="message-mentions-message-link__separator"> › </span>
                                  <Icon name="comment-dots" size="sm" variant="filled" className="message-mentions-message-link__icon" />
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
                    );
                  });
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
                          const isGif = createGifDetector(
                            contentData.content.imageUrl,
                            (contentData.content as any).isLargeGif
                          );

                          return (
                            <div className="relative inline-block">
                              <img
                                src={
                                  (contentData.content as any).thumbnailUrl ||
                                  contentData.content.imageUrl
                                }
                                className={`message-image rounded-lg transition-opacity duration-200 ${
                                  isGif
                                    ? (contentData.content as any).isLargeGif &&
                                      (contentData.content as any)
                                        .thumbnailUrl &&
                                      !isShowingGifAnimation
                                      ? 'cursor-pointer' // Pointer cursor for GIF static thumbnails
                                      : 'cursor-auto' // No pointer cursor for animating GIFs
                                    : 'cursor-pointer hover:opacity-80' // Clickable for non-GIFs
                                }`}
                                onClick={(e) => {
                                  if (isGif) {
                                    // For GIFs: animate in-place, don't open modal
                                    if (
                                      (contentData.content as any).isLargeGif &&
                                      (contentData.content as any).thumbnailUrl
                                    ) {
                                      // Switch from thumbnail to full GIF animation with error handling
                                      const img = e.target as HTMLImageElement;
                                      if (
                                        img.src.includes('thumbnail') ||
                                        img.src !== contentData.content.imageUrl
                                      ) {
                                        const originalSrc = img.src;

                                        // Set up error handler before changing src
                                        const handleError = () => {
                                          logger.warn(
                                            'Failed to load full GIF, reverting to thumbnail'
                                          );
                                          img.src = originalSrc;
                                          img.removeEventListener(
                                            'error',
                                            handleError
                                          );
                                          setIsShowingGifAnimation(false);
                                        };

                                        img.addEventListener(
                                          'error',
                                          handleError
                                        );
                                        img.src = contentData.content.imageUrl!;
                                        setIsShowingGifAnimation(true); // Hide play icon when showing animation
                                      }
                                    }
                                    // For small GIFs, they're already animating - do nothing
                                  } else {
                                    // For static images: open modal as usual
                                    formatting.handleImageClick(
                                      e,
                                      contentData.content.imageUrl!,
                                      !!(contentData.content as any)
                                        .thumbnailUrl
                                    );
                                  }
                                }}
                              />
                              {(contentData.content as any).isLargeGif &&
                                (contentData.content as any).thumbnailUrl &&
                                !isShowingGifAnimation && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/50 rounded-full p-2">
                                      <svg
                                        className="w-6 h-6 text-white"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M8 5v14l11-7z" />
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
                  return (
                    <img
                      src={contentData.sticker?.imgUrl}
                      className="message-sticker rounded-lg"
                    />
                  );
                }
              })()}
              <FlexRow className="flex-wrap pt-1 -mr-1">
                {message.reactions?.map((r) => (
                  <FlexRow
                    key={message.messageId + '-reactions-' + r.emojiId}
                    className={
                      'cursor-pointer items-center mr-1 mb-1 rounded-lg py-[1pt] px-2 whitespace-nowrap ' +
                      (r.memberIds.includes(user.currentPasskeyInfo!.address)
                        ? 'bg-accent-rgb/30 hover:bg-accent-rgb/60 border border-accent'
                        : 'bg-surface-5 hover:bg-surface-00 border border-surface-5 hover:border-surface-00')
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

              {/* Message Send Status Indicator */}
              {message.sendStatus === 'sending' && (
                <FlexRow align="center" gap="xs" className="message-status sending pt-1">
                  <Icon name="clock" size="xs" />
                  <Text size="sm" variant="warning">{t`Sending...`}</Text>
                </FlexRow>
              )}
              {message.sendStatus === 'failed' && (
                <FlexRow align="center" gap="xs" className="message-status failed pt-1">
                  <Icon name="warning" size="xs" />
                  <Text size="sm" variant="danger">
                    {t`Failed to send.`}{' '}
                    <Text
                      as="span"
                      size="sm"
                      variant="danger"
                      className="message-status__retry"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onRetryMessage?.(message);
                      }}
                    >
                      {t`Retry`}
                    </Text>
                  </Text>
                  {message.sendError && (
                    <Tooltip
                      id={`send-error-${message.messageId}`}
                      content={message.sendError}
                      showOnTouch={true}
                      autoHideAfter={3000}
                    >
                      <Icon name="question-circle" size="xs" />
                    </Tooltip>
                  )}
                </FlexRow>
              )}
            </Container>
          </FlexRow>
        )}

        {/* Desktop Context Menu */}
        {contextMenu && (
          <MessageActionsMenu
            message={message}
            position={contextMenu}
            onClose={() => setContextMenu(null)}
            onReply={() => {
              messageActions.handleReply();
              setContextMenu(null);
            }}
            onCopyLink={messageActions.handleCopyLink}
            onCopyMessageText={messageActions.handleCopyMessageText}
            onDelete={
              messageActions.canUserDelete
                ? () =>
                    messageActions.handleDelete({
                      shiftKey: false,
                    } as React.MouseEvent)
                : undefined
            }
            onPin={
              pinnedMessages.canPinMessages
                ? () =>
                    pinnedMessages.togglePin(
                      { shiftKey: false } as React.MouseEvent,
                      message
                    )
                : undefined
            }
            onReaction={messageActions.handleReaction}
            onMoreReactions={() => {
              const menuPosition = contextMenu;
              setContextMenu(null);
              // Use setTimeout to ensure context menu is closed before opening emoji picker
              setTimeout(() => {
                if (menuPosition) {
                  setEmojiPickerPosition(menuPosition);
                }
                messageActions.handleMoreReactions(0);
              }, 0);
            }}
            onEdit={
              messageActions.canUserEdit ? messageActions.handleEdit : undefined
            }
            onViewEditHistory={
              messageActions.canViewEditHistory
                ? messageActions.handleViewEditHistory
                : undefined
            }
            canDelete={messageActions.canUserDelete}
            canEdit={messageActions.canUserEdit}
            canViewEditHistory={messageActions.canViewEditHistory}
            canPinMessages={pinnedMessages.canPinMessages}
            userAddress={user.currentPasskeyInfo!.address}
            copiedLinkId={messageActions.copiedLinkId}
            copiedMessageText={messageActions.copiedMessageText}
            isBookmarked={messageActions.isBookmarked}
            onBookmarkToggle={messageActions.handleBookmarkToggle}
          />
        )}

      </FlexColumn>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    // Only re-render if these specific props change
    const shouldRerender =
      prevProps.message.messageId !== nextProps.message.messageId ||
      prevProps.message.modifiedDate !== nextProps.message.modifiedDate ||
      prevProps.message.lastModifiedHash !== nextProps.message.lastModifiedHash ||
      JSON.stringify(prevProps.message.content) !== JSON.stringify(nextProps.message.content) ||
      JSON.stringify(prevProps.message.edits) !== JSON.stringify(nextProps.message.edits) ||
      prevProps.emojiPickerOpen !== nextProps.emojiPickerOpen ||
      prevProps.emojiPickerPosition !== nextProps.emojiPickerPosition ||
      prevProps.hoverTarget !== nextProps.hoverTarget ||
      prevProps.height !== nextProps.height ||
      JSON.stringify(prevProps.message.reactions) !==
        JSON.stringify(nextProps.message.reactions) ||
      prevProps.message.isPinned !== nextProps.message.isPinned ||
      prevProps.message.sendStatus !== nextProps.message.sendStatus;

    return !shouldRerender;
  }
);
