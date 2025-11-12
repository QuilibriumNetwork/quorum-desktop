import React, { useEffect, useState, useCallback, useRef } from 'react';
import './Channel.scss';
import { StickerMessage } from '../../api/quorumApi';
import {
  useChannelData,
  useChannelMessages,
  useMessageComposer,
  usePinnedMessages,
  useConversation,
  useUpdateReadTime,
} from '../../hooks';
import { loadMessagesAround } from '../../hooks/queries/messages/loadMessagesAround';
import { buildMessagesKey } from '../../hooks/queries/messages/buildMessagesKey';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageList, MessageListRef } from '../message/MessageList';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useSidebar } from '../context/SidebarProvider';
import { useModals } from '../context/ModalProvider';
import { Button, Tooltip, Icon, Input } from '../primitives';
import { MobileDrawer } from '../ui';
import { getIconColorHex } from './IconPicker/types';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';
import { PinnedMessagesPanel } from '../message/PinnedMessagesPanel';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { Virtuoso } from 'react-virtuoso';
import UserProfile from '../user/UserProfile';
import { useUserProfileModal } from '../../hooks/business/ui/useUserProfileModal';
import type { Channel, Role } from '../../api/quorumApi';
import { UserAvatar } from '../user/UserAvatar';
import { getUserRoles } from '../../utils/permissions';

// Helper function to check if user can post in read-only channel
function canPostInReadOnlyChannel(
  channel: Channel | undefined,
  userAddress: string | undefined,
  roles: Role[],
  isSpaceOwner: boolean
): boolean {
  // If not a read-only channel, allow posting
  if (!channel?.isReadOnly) {
    return true;
  }

  // Space owners can always post
  if (isSpaceOwner) {
    return true;
  }

  // If no manager roles defined, only space owner can post
  if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) {
    return false;
  }

  // Check if user has any of the manager roles
  if (!userAddress) {
    return false;
  }

  return roles.some(
    (role) =>
      channel.managerRoleIds?.includes(role.roleId) &&
      role.members.includes(userAddress)
  );
}

type ChannelProps = {
  spaceId: string;
  channelId: string;
  kickUserAddress?: string;
  setKickUserAddress: React.Dispatch<React.SetStateAction<string | undefined>>;
};

const Channel: React.FC<ChannelProps> = ({
  spaceId,
  channelId,
  kickUserAddress,
  setKickUserAddress,
}) => {
  const { isDesktop, toggleLeftSidebar, navMenuOpen, toggleNavMenu } =
    useResponsiveLayoutContext();
  const { openKickUser } = useModals();
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const {
    showRightSidebar: showUsers,
    setShowRightSidebar: setShowUsers,
    setRightSidebarContent,
  } = useSidebar();
  const [init, setInit] = useState(false);
  const [skipSigning, setSkipSigning] = useState<boolean>(false);

  // Unified panel state - ensures only one panel can be open at a time
  type ActivePanel = 'pinned' | 'notifications' | 'search' | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const [isDeletionInProgress, setIsDeletionInProgress] = useState(false);

  // User profile modal state and logic
  const userProfileModal = useUserProfileModal({ showUsers });

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const headerRef = React.useRef<HTMLDivElement>(null);
  const { submitChannelMessage, messageDB } = useMessageDB();

  // Hash message loading state
  const [isLoadingHashMessage, setIsLoadingHashMessage] = useState(false);

  // Create refs for textarea (MessageList needs this for scrolling and we need it for focus)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const messageListRef = useRef<MessageListRef>(null);

  // Get channel data
  const {
    space,
    channel,
    members,
    roles,
    stickers,
    generateSidebarContent,
    generateVirtualizedUserList,
  } = useChannelData({ spaceId, channelId });

  // Get message handling
  const {
    messageList,
    fetchPreviousPage,
    fetchNextPage,
    hasNextPage,
    canDeleteMessages,
    canPinMessages,
    mapSenderToUser,
    isSpaceOwner,
  } = useChannelMessages({ spaceId, channelId, roles, members, channel });

  // Get pinned messages
  const { pinnedCount } = usePinnedMessages(spaceId, channelId, channel);

  // Get last read timestamp for mention highlighting - using React Query
  const conversationId = `${spaceId}/${channelId}`;
  const { data: conversationData } = useConversation({ conversationId });
  const lastReadTimestamp =
    conversationData?.conversation?.lastReadTimestamp || 0;

  // Mutation for updating read time with proper cache invalidation
  const { mutate: updateReadTime } = useUpdateReadTime({ spaceId, channelId });

  // Debounced search effect
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.length >= 3 || searchInput.length === 0) {
        setActiveSearch(searchInput);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Handle message submission
  const handleSubmitMessage = useCallback(
    async (message: string | object, inReplyTo?: string) => {
      // Check if this is a deletion to prevent auto-scroll
      const isDeletion =
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'remove-message';

      if (isDeletion) {
        setIsDeletionInProgress(true);
      }

      // Fetch parent message if replying (for reply notifications)
      let parentMessage;
      if (inReplyTo) {
        try {
          parentMessage = await messageDB.getMessage({
            spaceId,
            channelId,
            messageId: inReplyTo,
          });
        } catch (error) {
          console.error('[Channel] Failed to fetch parent message:', error);
        }
      }

      const effectiveSkip = space?.isRepudiable ? skipSigning : false;
      await submitChannelMessage(
        spaceId,
        channelId,
        message,
        queryClient,
        user.currentPasskeyInfo!,
        inReplyTo,
        effectiveSkip,
        isSpaceOwner,
        parentMessage
      );

      // Clear deletion flag after a short delay
      if (isDeletion) {
        setTimeout(() => setIsDeletionInProgress(false), 300);
      }

      // Only auto-scroll for actual messages (text/embed), not reactions or deletions
      const isReaction =
        typeof message === 'object' &&
        'type' in message &&
        (message.type === 'reaction' || message.type === 'remove-reaction');

      if (!isReaction && !isDeletion) {
        setTimeout(() => {
          messageListRef.current?.scrollToBottom();
        }, 100);
      }
    },
    [
      spaceId,
      channelId,
      submitChannelMessage,
      queryClient,
      user.currentPasskeyInfo,
      space,
      skipSigning,
      isSpaceOwner,
      messageDB,
    ]
  );

  // Handle sticker submission
  const handleSubmitSticker = useCallback(
    async (stickerId: string, inReplyTo?: string) => {
      // Fetch parent message if replying (for reply notifications)
      let parentMessage;
      if (inReplyTo) {
        try {
          parentMessage = await messageDB.getMessage({
            spaceId,
            channelId,
            messageId: inReplyTo,
          });
        } catch (error) {
          console.error('[Channel] Failed to fetch parent message:', error);
        }
      }

      const stickerMessage: StickerMessage = {
        senderId: user.currentPasskeyInfo?.address,
        type: 'sticker',
        stickerId: stickerId,
      } as StickerMessage;
      await submitChannelMessage(
        spaceId,
        channelId,
        stickerMessage,
        queryClient,
        user.currentPasskeyInfo!,
        inReplyTo,
        false, // Stickers are always signed
        isSpaceOwner,
        parentMessage
      );
      // Auto-scroll to bottom after sending sticker
      setTimeout(() => {
        messageListRef.current?.scrollToBottom();
      }, 100);
    },
    [
      spaceId,
      channelId,
      submitChannelMessage,
      queryClient,
      user.currentPasskeyInfo,
      isSpaceOwner,
      messageDB,
    ]
  );

  // Handle user profile modal close
  const handleUserProfileClose = useCallback(() => {
    userProfileModal.handleClose();
  }, [userProfileModal]);

  // Handle hash navigation to messages not in current list
  const handleHashMessageNotFound = useCallback(
    async (messageId: string) => {
      try {
        setIsLoadingHashMessage(true);

        // Load messages around the target message
        const { messages, prevCursor, nextCursor } = await loadMessagesAround({
          messageDB,
          spaceId,
          channelId,
          targetMessageId: messageId,
          beforeLimit: 40,
          afterLimit: 40,
        });

        // Update React Query cache to replace current pages with new data
        // This creates a single page centered around the target message
        queryClient.setQueryData(
          buildMessagesKey({ spaceId, channelId }),
          {
            pages: [{ messages, prevCursor, nextCursor }],
            pageParams: [undefined],
          }
        );

        // The MessageList will automatically re-render with the new data
        // and the existing hash navigation logic will scroll to the message
      } catch (error) {
        console.error('Failed to load hash message:', error);
        // Show error notification (you may want to add a toast/notification here)
        // For now, just remove the hash to prevent infinite retry
        setTimeout(() => {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        }, 100);
      } finally {
        setIsLoadingHashMessage(false);
      }
    },
    [messageDB, spaceId, channelId, queryClient]
  );

  // Get current user's role IDs for role mention filtering
  const userRoleIds = React.useMemo(() => {
    if (!space || !user.currentPasskeyInfo?.address) return [];
    const userRolesData = getUserRoles(user.currentPasskeyInfo.address, space);
    return userRolesData.map((r) => r.roleId);
  }, [space, user.currentPasskeyInfo?.address]);

  // Check if user can post in this channel
  const canPost = canPostInReadOnlyChannel(
    channel,
    user.currentPasskeyInfo?.address,
    roles,
    isSpaceOwner || false
  );

  // Helper function to get channel icon and color
  const getChannelIconAndColor = () => {
    if (channel?.icon) {
      // Use custom channel icon and color
      return {
        iconName: channel.icon,
        iconColor: getIconColorHex(channel.iconColor as any),
      };
    }

    // Fall back to default icons
    if (channel?.isReadOnly) {
      return {
        iconName: 'lock' as const,
        iconColor: undefined, // Use default text color
      };
    }

    return {
      iconName: 'hashtag' as const,
      iconColor: undefined, // Use default text color
    };
  };

  const { iconName, iconColor } = getChannelIconAndColor();

  // Compute responsive icon size for header icons (lg for desktop ≥1024px, sm for mobile/tablet)
  const headerIconSize = isDesktop ? 'lg' : 'lg';

  // Message composer hook
  const composer = useMessageComposer({
    type: 'channel',
    onSubmitMessage: handleSubmitMessage,
    onSubmitSticker: handleSubmitSticker,
    hasStickers: true,
  });

  // Clean up sidebar content when component unmounts
  React.useEffect(() => {
    return () => {
      setRightSidebarContent(null);
    };
  }, [setRightSidebarContent]);

  // Set sidebar content in context (includes mobile search)
  React.useEffect(() => {
    const sections = generateSidebarContent();

    // Filter sections for mobile search
    let filteredSections = sections;
    if (activeSearch) {
      const term = activeSearch.toLowerCase();
      filteredSections = sections
        .map((section) => ({
          ...section,
          members: section.members.filter(
            (member) =>
              member.displayName?.toLowerCase().includes(term) ||
              member.address?.toLowerCase().includes(term)
          ),
        }))
        .filter((section) => section.members.length > 0);
    }

    const sidebarContent = (
      <>
        {/* Mobile Search Input */}
        <div
          className="sticky top-0 z-10"
          style={{ backgroundColor: 'inherit' }}
        >
          <div
            className="flex items-center gap-2 py-3"
            style={{
              borderBottom: `1px solid ${searchFocused ? 'var(--accent)' : 'var(--color-border-default)'}`,
              paddingBottom: '0',
              transition: 'border-color 0.15s ease-in-out',
            }}
          >
            <Icon
              name="search"
              size="sm"
              className={searchFocused ? 'text-accent' : 'text-subtle'}
              style={{ transition: 'color 0.15s ease-in-out' }}
            />
            <Input
              value={searchInput}
              onChange={setSearchInput}
              placeholder={t`Username or Address`}
              variant="minimal"
              className="flex-1"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{ border: 'none', borderBottom: 'none' }}
              type="search"
              autoComplete="off"
            />
          </div>
          <div className="pb-3">
            {activeSearch && filteredSections.length === 0 && (
              <div className="text-xs text-subtle mt-1">
                {t`No users found!`}
              </div>
            )}
          </div>
        </div>

        {/* User List */}
        <div className="overflow-y-auto">
          {filteredSections.map((section) => (
            <div className="flex flex-col mb-2" key={section.title}>
              <div className="mb-3 text-xs text-subtle pb-1 px-3 pt-3">
                {section.title}
              </div>
              {section.members.map((member) => (
                <div
                  key={member.address}
                  className="w-full flex flex-row items-center mb-2 px-3 cursor-pointer hover:bg-surface-2 rounded-md py-1 transition-colors duration-150"
                  onClick={(event) =>
                    userProfileModal.handleUserClick(
                      {
                        address: member.address,
                        displayName: member.displayName,
                        userIcon: member.userIcon,
                      },
                      event
                    )
                  }
                >
                  <UserAvatar
                    userIcon={member.userIcon}
                    displayName={member.displayName}
                    address={member.address}
                    size={30}
                    className="opacity-80"
                  />
                  <div className="flex flex-col ml-2 text-subtle">
                    <span className="text-md font-bold">
                      {member.displayName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
    setRightSidebarContent(sidebarContent);
  }, [
    generateSidebarContent,
    setRightSidebarContent,
    searchInput,
    activeSearch,
    userProfileModal.handleUserClick,
  ]);

  useEffect(() => {
    if (!init) {
      setTimeout(() => setInit(true), 200);
    }
  }, []);

  // Auto-focus textarea when replying
  useEffect(() => {
    if (composer.inReplyTo) {
      messageComposerRef.current?.focus();
    }
  }, [composer.inReplyTo]);

  // Calculate header height for mobile sidebar positioning
  useEffect(() => {
    if (headerRef.current) {
      const updateHeaderHeight = () => {
        const rect = headerRef.current?.getBoundingClientRect();
        if (rect) {
          // Get the total height including the header element and its top offset
          const totalHeight = rect.bottom;
          document.documentElement.style.setProperty(
            '--header-height',
            `${totalHeight}px`
          );
        }
      };

      updateHeaderHeight();
      window.addEventListener('resize', updateHeaderHeight);

      return () => {
        window.removeEventListener('resize', updateHeaderHeight);
      };
    }
  }, []);

  // Handle kick user modal opening
  React.useEffect(() => {
    if (kickUserAddress) {
      openKickUser(kickUserAddress);
      setKickUserAddress(undefined); // Clear local state immediately
    }
  }, [kickUserAddress, openKickUser, setKickUserAddress]);

  // Save read time when viewing channel (for mention count tracking)
  // Uses mutation to ensure proper cache invalidation
  // Uses ref + interval pattern to avoid restarting timer on every new message
  const latestTimestampRef = useRef<number>(0);
  const lastSavedTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (messageList.length > 0) {
      // Update ref with latest timestamp (doesn't restart timer)
      latestTimestampRef.current = Math.max(
        ...messageList.map((msg) => msg.createdDate || 0)
      );
    }
  }, [messageList]);

  useEffect(() => {
    // Periodic check every 2 seconds to save if there's new content
    const intervalId = setInterval(() => {
      if (
        latestTimestampRef.current > 0 &&
        latestTimestampRef.current > lastSavedTimestampRef.current
      ) {
        // Use mutation - handles DB write + invalidation in correct order
        updateReadTime(latestTimestampRef.current);
        lastSavedTimestampRef.current = latestTimestampRef.current;
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [updateReadTime]);

  // Save immediately when leaving channel (component unmount)
  useEffect(() => {
    return () => {
      // Save any unsaved progress on unmount
      if (latestTimestampRef.current > lastSavedTimestampRef.current) {
        // Use mutation - ensures proper invalidation on unmount
        updateReadTime(latestTimestampRef.current);
      }
    };
  }, [updateReadTime]);

  return (
    <div className="chat-container">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header - full width at top */}
        <div
          ref={headerRef}
          className="channel-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-wrap lg:flex-nowrap lg:justify-between lg:items-center"
        >
          {/* First row on mobile: burger + controls / Single row on desktop */}
          <div className="w-full lg:w-auto flex items-center justify-between lg:contents">
            {/* Mobile controls - burger + NavMenu toggle */}
            {!isDesktop && (
              <div className="flex items-center gap-2">
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="header-icon-button lg:hidden"
                  iconName="bars"
                  iconSize={headerIconSize}
                  iconOnly
                />
                <Button
                  type="unstyled"
                  onClick={toggleNavMenu}
                  className="header-icon-button lg:hidden"
                  iconName={navMenuOpen ? 'chevron-left' : 'chevron-right'}
                  iconSize={headerIconSize}
                  iconOnly
                />
              </div>
            )}

            {/* Channel name - hidden on mobile first row, shown on desktop */}
            <div className="hidden lg:flex flex-1 min-w-0">
              <div className="flex items-center gap-2 truncate whitespace-nowrap overflow-hidden">
                <Icon
                  name={iconName as any}
                  size={headerIconSize}
                  className="flex-shrink-0"
                  color={iconColor}
                  style={
                    !iconColor
                      ? { color: 'var(--color-text-subtle)' }
                      : undefined
                  }
                />
                <span className="text-main font-bold flex-shrink truncate">
                  {channel?.channelName}
                </span>
                {channel?.channelTopic && (
                  <>
                    <span className="hidden xs:inline text-subtle flex-shrink-0 font-normal">
                      |
                    </span>
                    <span className="hidden xs:inline text-subtle flex-shrink truncate font-normal">
                      {channel.channelTopic}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Controls - right side on both mobile and desktop */}
            <div className="flex flex-row items-center gap-3 sm:gap-2">
              {pinnedCount > 0 && (
                <div className="relative">
                  <Tooltip
                    id={`pinned-messages-${channelId}`}
                    content={t`Pinned Messages`}
                    showOnTouch={false}
                  >
                    <Button
                      type="unstyled"
                      onClick={() => setActivePanel('pinned')}
                      className="relative header-icon-button"
                      iconName="pin"
                      iconSize={headerIconSize}
                      iconOnly
                    >
                      <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {pinnedCount > 9 ? '9+' : pinnedCount}
                      </span>
                    </Button>
                  </Tooltip>

                  {/* Pinned Messages Panel */}
                  <PinnedMessagesPanel
                    isOpen={activePanel === 'pinned'}
                    onClose={() => setActivePanel(null)}
                    spaceId={spaceId}
                    channelId={channelId}
                    channel={channel}
                    mapSenderToUser={mapSenderToUser}
                    virtuosoRef={messageListRef.current?.getVirtuosoRef()}
                    messageList={messageList}
                    stickers={stickers}
                  />
                </div>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <Tooltip
                  id={`notifications-${channelId}`}
                  content={t`Notifications`}
                  showOnTouch={false}
                >
                  <Button
                    type="unstyled"
                    onClick={() => setActivePanel('notifications')}
                    className="relative header-icon-button"
                    iconName="bell"
                    iconSize={headerIconSize}
                    iconOnly
                  />
                </Tooltip>

                {/* Notification Panel */}
                <NotificationPanel
                  isOpen={activePanel === 'notifications'}
                  onClose={() => setActivePanel(null)}
                  spaceId={spaceId}
                  channelIds={
                    space?.groups.flatMap((g) =>
                      g.channels.map((c) => c.channelId)
                    ) || []
                  }
                  mapSenderToUser={mapSenderToUser}
                  userRoleIds={userRoleIds}
                />
              </div>

              <Tooltip
                id={`members-list-${channelId}`}
                content={t`Members List`}
                showOnTouch={false}
              >
                <Button
                  type="unstyled"
                  onClick={() => {
                    setShowUsers(!showUsers);
                  }}
                  className="header-icon-button"
                  iconName="users"
                  iconSize={headerIconSize}
                  iconOnly
                />
              </Tooltip>

              {/* Search: Desktop shows inline GlobalSearch, Mobile shows search icon */}
              {!isDesktop ? (
                <Tooltip
                  id={`search-${channelId}`}
                  content={t`Search Messages`}
                  showOnTouch={false}
                >
                  <Button
                    type="unstyled"
                    onClick={() => setActivePanel('search')}
                    className="header-icon-button"
                    iconName="search"
                    iconSize={headerIconSize}
                    iconOnly
                  />
                </Tooltip>
              ) : null}

              <GlobalSearch
                className="channel-search ml-2"
                isOpen={activePanel === 'search'}
                onOpen={() => setActivePanel('search')}
                onClose={() => setActivePanel(null)}
              />
            </div>
          </div>

          {/* Second row on mobile: channel name / Hidden on desktop (shown above) */}
          <div className="w-full lg:hidden">
            <div className="flex items-center gap-3 sm:gap-2 truncate whitespace-nowrap overflow-hidden">
              <Icon
                name={iconName as any}
                size={headerIconSize}
                className="flex-shrink-0"
                color={iconColor}
                style={
                  !iconColor ? { color: 'var(--color-text-subtle)' } : undefined
                }
              />
              <span className="text-main font-bold flex-shrink truncate">
                {channel?.channelName}
              </span>
              {channel?.channelTopic && (
                <>
                  <span className="hidden xs:inline text-subtle font-light flex-shrink-0">
                    |
                  </span>
                  <span className="hidden xs:inline text-subtle font-normal text-sm flex-shrink truncate">
                    {channel.channelTopic}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content area - flex container for messages and sidebar */}
        <div className="flex flex-1 relative">
          {/* Messages and composer area */}
          <div className="flex flex-col flex-1">
            <div
              className={
                'message-list relative' +
                (!showUsers ? ' message-list-expanded' : '')
              }
            >
              <MessageList
                ref={messageListRef}
                isRepudiable={space?.isRepudiable}
                stickers={stickers}
                roles={roles}
                canDeleteMessages={canDeleteMessages}
                canPinMessages={canPinMessages}
                channel={channel}
                isSpaceOwner={isSpaceOwner}
                editor={textareaRef}
                messageList={messageList}
                setInReplyTo={composer.setInReplyTo}
                customEmoji={space?.emojis}
                members={members}
                submitMessage={handleSubmitMessage}
                kickUserAddress={kickUserAddress}
                setKickUserAddress={setKickUserAddress}
                isDeletionInProgress={isDeletionInProgress}
                onUserClick={userProfileModal.handleUserClick}
                lastReadTimestamp={lastReadTimestamp}
                onHashMessageNotFound={handleHashMessageNotFound}
                isLoadingHashMessage={isLoadingHashMessage}
                fetchPreviousPage={() => {
                  fetchPreviousPage();
                }}
                fetchNextPage={() => {
                  fetchNextPage();
                }}
                hasNextPage={hasNextPage}
              />
            </div>

            <div className="message-editor-container">
              <MessageComposer
                ref={messageComposerRef}
                value={composer.pendingMessage}
                onChange={composer.setPendingMessage}
                onKeyDown={composer.handleKeyDown}
                placeholder={i18n._('Send a message to #{channel_name}', {
                  channel_name: channel?.channelName ?? '',
                })}
                calculateRows={composer.calculateRows}
                getRootProps={composer.getRootProps}
                getInputProps={composer.getInputProps}
                processedImage={composer.processedImage}
                clearFile={composer.clearFile}
                onSubmitMessage={composer.submitMessage}
                onShowStickers={() => composer.setShowStickers(true)}
                inReplyTo={composer.inReplyTo}
                users={Object.values(members)}
                roles={roles}
                fileError={composer.fileError}
                isProcessingImage={composer.isProcessingImage}
                mapSenderToUser={mapSenderToUser}
                setInReplyTo={composer.setInReplyTo}
                showSigningToggle={space?.isRepudiable}
                skipSigning={skipSigning}
                onSigningToggle={() => setSkipSigning(!skipSigning)}
                disabled={!canPost}
                disabledMessage={
                  channel?.isReadOnly
                    ? t`You cannot post in this channel`
                    : undefined
                }
              />
            </div>
          </div>

          {/* Desktop sidebar only - mobile sidebar renders via SidebarProvider at Layout level */}
          {showUsers && (
            <div className="hidden lg:block w-[260px] bg-chat border-l border-default flex-shrink-0">
              {/* Search Input */}
              <div className="px-4 pt-4 bg-chat sticky top-0 z-10">
                <div
                  className="flex items-center gap-2"
                  style={{
                    borderBottom: `1px solid ${searchFocused ? 'var(--accent)' : 'var(--color-border-default)'}`,
                    paddingBottom: '0',
                    transition: 'border-color 0.15s ease-in-out',
                  }}
                >
                  <Icon
                    name="search"
                    size="sm"
                    className={searchFocused ? 'text-accent' : 'text-muted'}
                    style={{ transition: 'color 0.15s ease-in-out' }}
                  />
                  <Input
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder={t`Username or Address`}
                    variant="minimal"
                    className="flex-1"
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    style={{ border: 'none', borderBottom: 'none' }}
                    type="search"
                    autoComplete="off"
                  />
                </div>
                <div className="pb-3">
                  {activeSearch &&
                    generateVirtualizedUserList(activeSearch).length === 0 && (
                      <div className="text-xs text-subtle mt-1">
                        {t`No users found!`}
                      </div>
                    )}
                </div>
              </div>

              <Virtuoso
                data={generateVirtualizedUserList(activeSearch)}
                overscan={10}
                itemContent={(_index, item) => {
                  if (item.type === 'header') {
                    return (
                      <div className="flex flex-col p-4 pb-0">
                        <div className="mb-1 text-xs text-subtle pb-1">
                          {item.title}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="px-4 pb-2">
                        <div
                          className="w-full flex flex-row items-center cursor-pointer hover:bg-surface-2 rounded-md p-1 -m-1 transition-colors duration-150 group"
                          onClick={(event) =>
                            userProfileModal.handleUserClick(
                              {
                                address: item.address,
                                displayName: item.displayName,
                                userIcon: item.userIcon,
                              },
                              event
                            )
                          }
                        >
                          <UserAvatar
                            userIcon={item.userIcon}
                            displayName={item.displayName ?? item.address}
                            address={item.address}
                            size={30}
                            className="opacity-80 group-hover:opacity-100 transition-opacity duration-150"
                          />
                          <div className="flex flex-col ml-2 text-subtle group-hover:text-main transition-colors duration-150">
                            <span className="text-md font-bold">
                              {item.displayName ?? item.address}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                }}
                style={{ height: '100%' }}
              />
            </div>
          )}
        </div>
      </div>

      <Tooltip
        id="toggle-signing-tooltip"
        content={
          skipSigning
            ? 'This message will NOT be signed'
            : 'This message will be signed'
        }
        place="top"
      />

      {/* Stickers panel - positioned at top level to avoid stacking context issues */}
      {composer.showStickers && (
        <>
          <div
            className="stickers-backdrop"
            onClick={() => composer.setShowStickers(false)}
          />
          <div
            className={`stickers-panel-wrapper ${showUsers ? 'with-sidebar' : 'without-sidebar'}`}
          >
            <div className="stickers-panel">
              <div className="stickers-panel-header">Stickers</div>
              <div className="stickers-panel-grid">
                {space?.stickers.map((s) => {
                  return (
                    <div
                      key={'sticker-' + s.id}
                      className="sticker-item"
                      onClick={() => {
                        composer.submitSticker(s.id);
                      }}
                    >
                      <img src={s.imgUrl} alt="sticker" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* User Profile Modal - desktop only (≥1024px) */}
      {userProfileModal.isOpen &&
        userProfileModal.selectedUser &&
        userProfileModal.modalPosition &&
        isDesktop && (
          <>
            {/* Background click area - excludes sidebar to allow user switching */}
            <div
              className="fixed inset-0 z-[9990]"
              style={{
                right: showUsers ? '260px' : '0px',
              }}
              onClick={handleUserProfileClose}
            />
            <div
              className="fixed z-[9999] pointer-events-none"
              style={{
                top: `${userProfileModal.modalPosition.top}px`,
                left:
                  userProfileModal.modalPosition.left !== undefined
                    ? `${userProfileModal.modalPosition.left}px`
                    : showUsers
                      ? `calc(100vw - 260px - 320px)`
                      : `calc(100vw - 320px)`,
              }}
            >
              <div className="pointer-events-auto">
                <UserProfile
                  key={userProfileModal.selectedUser.address}
                  spaceId={spaceId}
                  canEditRoles={isSpaceOwner}
                  kickUserAddress={kickUserAddress}
                  setKickUserAddress={setKickUserAddress}
                  roles={roles || []}
                  user={userProfileModal.selectedUser}
                  dismiss={handleUserProfileClose}
                />
              </div>
            </div>
          </>
        )}

      {/* Mobile drawer for user list below 1024px */}
      {!isDesktop && (
        <MobileDrawer
          isOpen={showUsers}
          onClose={() => setShowUsers(false)}
          showCloseButton={false}
          enableSwipeToClose={true}
          ariaLabel={t`Channel members`}
        >
          {/* Mobile Search Input - matches search results style */}
          <div
            className="sticky top-0 z-10"
            style={{ backgroundColor: 'var(--surface-0)' }}
          >
            <div className="search-mobile-header p-4">
              <Input
                type="search"
                variant="bordered"
                placeholder={t`Search Username or Address`}
                value={searchInput}
                onChange={(value: string) => {
                  setSearchInput(value);
                }}
                className="search-mobile-input"
                autoComplete="off"
                clearable={true}
              />
            </div>
            {activeSearch &&
              generateSidebarContent()
                .map((section) => ({
                  ...section,
                  members: section.members.filter(
                    (member) =>
                      member.displayName
                        ?.toLowerCase()
                        .includes(activeSearch.toLowerCase()) ||
                      member.address
                        ?.toLowerCase()
                        .includes(activeSearch.toLowerCase())
                  ),
                }))
                .filter((section) => section.members.length > 0).length ===
                0 && (
                <div className="px-4 pb-3 -mt-2">
                  <div className="text-xs text-subtle">
                    {t`No users found!`}
                  </div>
                </div>
              )}
          </div>

          {/* User List */}
          <div className="overflow-y-auto">
            {generateSidebarContent()
              .map((section) => ({
                ...section,
                members: activeSearch
                  ? section.members.filter(
                      (member) =>
                        member.displayName
                          ?.toLowerCase()
                          .includes(activeSearch.toLowerCase()) ||
                        member.address
                          ?.toLowerCase()
                          .includes(activeSearch.toLowerCase())
                    )
                  : section.members,
              }))
              .filter((section) => section.members.length > 0)
              .map((section) => (
                <div className="flex flex-col mb-2" key={section.title}>
                  <div className="mb-1 text-subtle text-xs pb-1 px-4 pt-3">
                    {section.title}
                  </div>
                  {section.members.map((member) => (
                    <div
                      key={member.address}
                      className="w-full flex flex-row items-center mb-2 px-4 cursor-pointer py-1"
                      onClick={(event) =>
                        userProfileModal.handleUserClick(
                          {
                            address: member.address,
                            displayName: member.displayName,
                            userIcon: member.userIcon,
                          },
                          event
                        )
                      }
                    >
                      <UserAvatar
                        userIcon={member.userIcon}
                        displayName={member.displayName}
                        address={member.address}
                        size={30}
                        className="opacity-80"
                      />
                      <div className="flex flex-col ml-2 text-subtle">
                        <span className="text-md font-bold">
                          {member.displayName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </MobileDrawer>
      )}
    </div>
  );
};

export default Channel;
