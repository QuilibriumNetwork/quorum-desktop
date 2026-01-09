import { logger } from '@quilibrium/quorum-shared';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useMutedUsers, useInvalidateMutedUsers } from '../../hooks/queries/mutedUsers';
import { formatMuteRemaining } from '../../utils/dateFormatting';
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
import { Button, Tooltip, Icon } from '../primitives';
import { MobileDrawer, ListSearchInput, TouchAwareListItem } from '../ui';
import { getIconColorHex } from './IconPicker/types';
import { isTouchDevice } from '../../utils/platform';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';
import { PinnedMessagesPanel } from '../message/PinnedMessagesPanel';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { BookmarksPanel } from '../bookmarks/BookmarksPanel';
import { Virtuoso } from 'react-virtuoso';
import UserProfile from '../user/UserProfile';
import { useUserProfileModal } from '../../hooks/business/ui/useUserProfileModal';
import type { Channel, Role } from '../../api/quorumApi';
import { UserAvatar } from '../user/UserAvatar';
import { getUserRoles, hasPermission } from '../../utils/permissions';

// Helper function to check if user can post in read-only channel
// NOTE: Space owners must explicitly join a manager role to post in read-only channels.
// This is intentional - the receiving side cannot verify space ownership (privacy requirement).
function canPostInReadOnlyChannel(
  channel: Channel | undefined,
  userAddress: string | undefined,
  roles: Role[],
  _isSpaceOwner: boolean
): boolean {
  // If not a read-only channel, allow posting
  if (!channel?.isReadOnly) {
    return true;
  }

  // If no manager roles defined, nobody can post
  if (!channel.managerRoleIds || channel.managerRoleIds.length === 0) {
    return false;
  }

  // Check if user has any of the manager roles (space owners must also be in a manager role)
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
};

const Channel: React.FC<ChannelProps> = ({
  spaceId,
  channelId,
}) => {
  const navigate = useNavigate();
  const { isDesktop, toggleLeftSidebar, navMenuOpen, toggleNavMenu } =
    useResponsiveLayoutContext();
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const { showRightSidebar: showUsers, setShowRightSidebar: setShowUsers } =
    useSidebar();
  const [init, setInit] = useState(false);
  const [skipSigning, setSkipSigning] = useState<boolean>(false);

  // Unified panel state - ensures only one panel can be open at a time
  type ActivePanel = 'pinned' | 'notifications' | 'bookmarks' | 'search' | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // User profile modal state and logic
  const userProfileModal = useUserProfileModal({ showUsers });

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Collapsed role groups state (persisted per-space in localStorage)
  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`space-role-groups-collapsed-${spaceId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save collapsed roles to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(
        `space-role-groups-collapsed-${spaceId}`,
        JSON.stringify([...collapsedRoles])
      );
    } catch (e) {
      logger.warn('[Channel] Failed to save collapsed roles to localStorage:', e);
    }
  }, [collapsedRoles, spaceId]);

  // Reset collapsed roles when space changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`space-role-groups-collapsed-${spaceId}`);
      setCollapsedRoles(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch {
      setCollapsedRoles(new Set());
    }
  }, [spaceId]);

  // Toggle role group collapse
  const toggleRoleCollapse = useCallback((roleTitle: string) => {
    setCollapsedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleTitle)) {
        next.delete(roleTitle);
      } else {
        next.add(roleTitle);
      }
      return next;
    });
  }, []);

  const headerRef = React.useRef<HTMLDivElement>(null);
  const { submitChannelMessage, retryMessage, messageDB } = useMessageDB();

  // Hash message loading state
  const [isLoadingHashMessage, setIsLoadingHashMessage] = useState(false);

  // Auto-jump to first unread state
  const [scrollToMessageId, setScrollToMessageId] = useState<
    string | undefined
  >();

  // New Messages separator state
  const [newMessagesSeparator, setNewMessagesSeparator] = useState<{
    firstUnreadMessageId: string;
    initialUnreadCount: number;
  } | null>(null);

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

  // Check if current user is muted in this space (considers expiration)
  const { data: mutedUsers } = useMutedUsers({ spaceId });
  const invalidateMutedUsers = useInvalidateMutedUsers();
  const currentMuteRecord = mutedUsers?.find(
    m => m.targetUserId === user?.currentPasskeyInfo?.address
  );
  const isCurrentUserMuted = currentMuteRecord
    ? (!currentMuteRecord.expiresAt || currentMuteRecord.expiresAt > Date.now())
    : false;

  // Auto-refresh when mute expires
  useEffect(() => {
    if (!currentMuteRecord?.expiresAt) return; // Forever mute or not muted

    const remaining = currentMuteRecord.expiresAt - Date.now();
    if (remaining <= 0) return; // Already expired

    const timer = setTimeout(() => {
      invalidateMutedUsers({ spaceId });
    }, remaining);

    return () => clearTimeout(timer);
  }, [currentMuteRecord?.expiresAt, invalidateMutedUsers, spaceId]);

  // Get current user address for bookmarks
  const userAddress = user?.currentPasskeyInfo?.address || '';

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

      // Scroll is handled by Virtuoso's followOutput - no manual scroll needed
      // Deletion flag is set via onBeforeDelete callback in MessageList
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

  // Handle retrying a failed message
  const handleRetryMessage = useCallback(
    async (message: import('../../api/quorumApi').Message) => {
      await retryMessage(spaceId, channelId, message, queryClient);
    },
    [spaceId, channelId, retryMessage, queryClient]
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
      // Scroll is handled by Virtuoso's followOutput - no manual scroll needed
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

  // Auto-jump to first unread message on channel entry
  useEffect(() => {
    // Skip if there's a hash navigation in progress
    if (window.location.hash.startsWith('#msg-')) {
      return;
    }

    // Skip if no unread messages
    if (lastReadTimestamp === 0) {
      return;
    }

    // Check for first unread message and load messages around it
    const jumpToFirstUnread = async () => {
      try {
        // Get the first unread message
        const firstUnread = await messageDB.getFirstUnreadMessage({
          spaceId,
          channelId,
          afterTimestamp: lastReadTimestamp,
        });

        // If no unread message found, don't jump
        if (!firstUnread) {
          return;
        }

        // Check if the first unread is already in the loaded messages
        // If it is, we don't need to reload (it will be highlighted via lastReadTimestamp)
        const isAlreadyLoaded = messageList.some(
          (m) => m.messageId === firstUnread.messageId
        );

        if (isAlreadyLoaded) {
          // Message is already loaded, just scroll to it
          // Calculate initial unread count (messages after lastReadTimestamp)
          const unreadCount = messageList.filter(
            (m) => m.createdDate > lastReadTimestamp
          ).length;

          // Check if we should show separator (avoid showing during active chatting)
          const firstUnreadAge = Date.now() - firstUnread.timestamp;
          const MIN_UNREAD_COUNT = 5; // Show if 5+ unreads
          const MIN_AGE_MS = 5 * 60 * 1000; // Show if oldest unread is 5+ minutes old

          const shouldShowSeparator =
            unreadCount >= MIN_UNREAD_COUNT || firstUnreadAge > MIN_AGE_MS;

          setScrollToMessageId(firstUnread.messageId);

          // Only set separator if threshold is met
          if (shouldShowSeparator) {
            setNewMessagesSeparator({
              firstUnreadMessageId: firstUnread.messageId,
              initialUnreadCount: unreadCount,
            });
          }

          return;
        }

        // Load messages around the first unread message
        const { messages, prevCursor, nextCursor } = await loadMessagesAround({
          messageDB,
          spaceId,
          channelId,
          targetMessageId: firstUnread.messageId,
          beforeLimit: 40,
          afterLimit: 40,
        });

        // Update React Query cache to replace current pages with new data
        queryClient.setQueryData(
          buildMessagesKey({ spaceId, channelId }),
          {
            pages: [{ messages, prevCursor, nextCursor }],
            pageParams: [undefined],
          }
        );

        // Calculate initial unread count from the loaded messages
        const unreadCount = messages.filter(
          (m) => m.createdDate > lastReadTimestamp
        ).length;

        // Check if we should show separator (avoid showing during active chatting)
        const firstUnreadAge = Date.now() - firstUnread.timestamp;
        const MIN_UNREAD_COUNT = 5; // Show if 5+ unreads
        const MIN_AGE_MS = 5 * 60 * 1000; // Show if oldest unread is 5+ minutes old

        const shouldShowSeparator =
          unreadCount >= MIN_UNREAD_COUNT || firstUnreadAge > MIN_AGE_MS;

        // Set the message ID to scroll to
        setScrollToMessageId(firstUnread.messageId);

        // Only set separator if threshold is met
        if (shouldShowSeparator) {
          setNewMessagesSeparator({
            firstUnreadMessageId: firstUnread.messageId,
            initialUnreadCount: unreadCount,
          });
        }
      } catch (error) {
        console.error('Failed to jump to first unread:', error);
        // Silently fail - user will see messages from bottom as usual
      }
    };

    // Only auto-jump on initial channel mount
    // We use a small delay to ensure the message list is ready
    const timer = setTimeout(() => {
      jumpToFirstUnread();
    }, 100);

    return () => clearTimeout(timer);
  }, [channelId, spaceId, lastReadTimestamp, messageDB, messageList, queryClient]);

  // Reset scrollToMessageId and separator when channel changes
  useEffect(() => {
    setScrollToMessageId(undefined);
    setNewMessagesSeparator(null);
  }, [channelId]);

  // Get current user's role IDs for role mention filtering
  const userRoleIds = React.useMemo(() => {
    if (!space || !user.currentPasskeyInfo?.address) return [];
    const userRolesData = getUserRoles(user.currentPasskeyInfo.address, space);
    return userRolesData.map((r) => r.roleId);
  }, [space, user.currentPasskeyInfo?.address]);

  // Extract channels for channel mentions (flat array for other components)
  const spaceChannels = React.useMemo(() => {
    if (!space) return [];
    return space.groups.flatMap(g => g.channels);
  }, [space]);

  // Extract groups for grouped channel mentions in MessageComposer
  const spaceGroups = React.useMemo(() => {
    if (!space) return [];
    return space.groups || [];
  }, [space]);

  // Check @everyone permission for mentions
  const canUseEveryone = React.useMemo(() => {
    return hasPermission(
      user.currentPasskeyInfo?.address || '',
      'mention:everyone',
      space || undefined,
      isSpaceOwner || false
    );
  }, [user.currentPasskeyInfo?.address, space, isSpaceOwner]);

  // Handle channel navigation for channel mentions
  const handleChannelClick = useCallback((targetChannelId: string) => {
    navigate(`/spaces/${spaceId}/${targetChannelId}`);
  }, [navigate, spaceId]);

  // Check if user can post in this channel
  const canPostInChannel = canPostInReadOnlyChannel(
    channel,
    user.currentPasskeyInfo?.address,
    roles,
    isSpaceOwner || false
  );
  // Also block muted users from posting
  const canPost = canPostInChannel && !isCurrentUserMuted;

  // Helper function to get channel icon and color
  const getChannelIconAndColor = () => {
    if (channel?.icon) {
      // Use custom channel icon and color
      return {
        iconName: channel.icon,
        iconColor: getIconColorHex(channel.iconColor as any),
        iconVariant: (channel.iconVariant || 'outline') as 'outline' | 'filled',
      };
    }

    // Fall back to default icons
    if (channel?.isReadOnly) {
      return {
        iconName: 'lock' as const,
        iconColor: undefined, // Use default text color
        iconVariant: 'outline' as const,
      };
    }

    return {
      iconName: 'hashtag' as const,
      iconColor: undefined, // Use default text color
      iconVariant: 'outline' as const,
    };
  };

  const { iconName, iconColor, iconVariant } = getChannelIconAndColor();

  // Compute responsive icon size for header icons (lg for desktop ≥1024px, sm for mobile/tablet)
  const headerIconSize = isDesktop ? 'lg' : 'lg';

  // Message composer hook
  const composer = useMessageComposer({
    type: 'channel',
    onSubmitMessage: handleSubmitMessage,
    onSubmitSticker: handleSubmitSticker,
    hasStickers: true,
  });

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
  // Debounced to avoid excessive recalculations during window drag
  useEffect(() => {
    if (headerRef.current) {
      let timeoutId: ReturnType<typeof setTimeout>;

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

      const debouncedUpdate = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updateHeaderHeight, 150);
      };

      updateHeaderHeight();
      window.addEventListener('resize', debouncedUpdate);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', debouncedUpdate);
      };
    }
  }, []);

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
          className="chat-header border-b text-main flex flex-wrap lg:flex-nowrap lg:justify-between lg:items-center"
        >
          {/* First row on mobile: burger + controls / Single row on desktop */}
          <div className="w-full lg:w-auto flex items-center justify-between lg:contents">
            {/* Mobile controls - burger + NavMenu toggle */}
            {!isDesktop && (
              <div className="flex items-center gap-2">
                <Button
                  type="unstyled"
                  onClick={toggleNavMenu}
                  className="header-icon-button lg:hidden"
                  iconName={navMenuOpen ? 'chevron-left' : 'menu'}
                  iconSize={headerIconSize}
                  iconOnly
                />
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="header-icon-button lg:hidden"
                  iconName="sidebar-left-expand"
                  iconSize={headerIconSize}
                  iconOnly
                />
              </div>
            )}

            {/* Channel name - hidden on mobile first row, shown on desktop */}
            <div className="hidden lg:flex flex-1 min-w-0">
              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <Icon
                  name={iconName as any}
                  size={headerIconSize}
                  className="flex-shrink-0"
                  color={iconColor}
                  variant={iconVariant}
                  style={
                    !iconColor
                      ? { color: 'var(--color-text-subtle)' }
                      : undefined
                  }
                />
                <span className="text-main font-bold flex-shrink min-w-0 truncate-base">
                  {channel?.channelName}
                </span>
                {channel?.channelTopic && (
                  <>
                    <span className="hidden xs:inline text-subtle flex-shrink-0 font-normal">
                      |
                    </span>
                    <span className="hidden xs:inline text-subtle flex-shrink-2 min-w-0 truncate-base font-normal">
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
                      className={`relative header-icon-button ${activePanel === 'pinned' ? 'active' : ''}`}
                      iconName="pin"
                      iconSize={headerIconSize}
                      iconVariant={activePanel === 'pinned' ? 'filled' : 'outline'}
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
                    spaceRoles={roles}
                    spaceChannels={spaceChannels}
                    onChannelClick={handleChannelClick}
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
                    className={`relative header-icon-button ${activePanel === 'notifications' ? 'active' : ''}`}
                    iconName="bell"
                    iconSize={headerIconSize}
                    iconVariant={activePanel === 'notifications' ? 'filled' : 'outline'}
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
                  spaceRoles={space?.roles || []}
                  spaceChannels={space?.groups.flatMap((g) => g.channels) || []}
                />
              </div>

              {/* Bookmarks */}
              <div className="relative">
                <Tooltip
                  id={`bookmarks-${channelId}`}
                  content={t`Bookmarks`}
                  showOnTouch={false}
                >
                  <Button
                    type="unstyled"
                    onClick={() => setActivePanel('bookmarks')}
                    className={`header-icon-button ${activePanel === 'bookmarks' ? 'active' : ''}`}
                    iconName="bookmark"
                    iconSize={headerIconSize}
                    iconVariant={activePanel === 'bookmarks' ? 'filled' : 'outline'}
                    iconOnly
                  />
                </Tooltip>

                {/* Bookmarks Panel */}
                <BookmarksPanel
                  isOpen={activePanel === 'bookmarks'}
                  onClose={() => setActivePanel(null)}
                  userAddress={userAddress}
                  stickers={stickers}
                  mapSenderToUser={mapSenderToUser}
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
                  className={`header-icon-button ${showUsers ? 'active' : ''}`}
                  iconName="users"
                  iconSize={headerIconSize}
                  iconOnly
                />
              </Tooltip>

              {/* Search: Touch devices always show icon, non-touch devices show inline search */}
              {isTouchDevice() ? (
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
                className={`channel-search${isTouchDevice() ? '' : ' ml-2'}`}
                isOpen={activePanel === 'search'}
                onOpen={() => setActivePanel('search')}
                onClose={() => setActivePanel(null)}
              />
            </div>
          </div>

          {/* Second row on mobile: channel name / Hidden on desktop (shown above) */}
          <div className="w-full lg:hidden mt-3">
            <div className="flex items-center gap-3 sm:gap-2 overflow-hidden min-w-0">
              <Icon
                name={iconName as any}
                size={headerIconSize}
                className="flex-shrink-0"
                color={iconColor}
                variant={iconVariant}
                style={
                  !iconColor ? { color: 'var(--color-text-subtle)' } : undefined
                }
              />
              <span className="text-main font-bold flex-shrink min-w-0 truncate-base">
                {channel?.channelName}
              </span>
              {channel?.channelTopic && (
                <>
                  <span className="hidden xs:inline text-subtle font-light flex-shrink-0">
                    |
                  </span>
                  <span className="hidden xs:inline text-subtle font-normal text-sm flex-shrink-2 min-w-0 truncate-base">
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
                onUserClick={userProfileModal.handleUserClick}
                lastReadTimestamp={lastReadTimestamp}
                onHashMessageNotFound={handleHashMessageNotFound}
                isLoadingHashMessage={isLoadingHashMessage}
                scrollToMessageId={scrollToMessageId}
                newMessagesSeparator={newMessagesSeparator}
                onDismissSeparator={() => setNewMessagesSeparator(null)}
                onChannelClick={handleChannelClick}
                spaceChannels={spaceChannels}
                fetchPreviousPage={() => {
                  fetchPreviousPage();
                }}
                fetchNextPage={() => {
                  fetchNextPage();
                }}
                hasNextPage={hasNextPage}
                spaceName={space?.spaceName}
                onRetryMessage={handleRetryMessage}
                users={Object.values(members)}
                mentionRoles={roles?.filter(role => role.isPublic !== false)}
                groups={spaceGroups}
                canUseEveryone={canUseEveryone}
              />
            </div>

            <div className="message-editor-container">
              <MessageComposer
                canUseEveryone={canUseEveryone}
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
                roles={roles?.filter(role => role.isPublic !== false)}
                groups={spaceGroups}
                fileError={composer.fileError}
                isProcessingImage={composer.isProcessingImage}
                mapSenderToUser={mapSenderToUser}
                setInReplyTo={composer.setInReplyTo}
                showSigningToggle={space?.isRepudiable}
                skipSigning={skipSigning}
                onSigningToggle={() => setSkipSigning(!skipSigning)}
                disabled={!canPost}
                disabledMessage={
                  isCurrentUserMuted
                    ? currentMuteRecord?.expiresAt
                      ? t`You are muted for ${formatMuteRemaining(currentMuteRecord.expiresAt)}`
                      : t`You have been muted in this Space`
                    : channel?.isReadOnly
                      ? t`You cannot post in this channel`
                      : undefined
                }
                mentionError={composer.mentionError}
                messageValidation={composer.messageValidation}
                characterCount={composer.characterCount}
              />
            </div>
          </div>

          {/* Desktop sidebar only - mobile uses MobileDrawer below */}
          {showUsers && (
            <div className="channel-users-sidebar list-bottom-fade-chat hidden lg:block w-[260px] bg-chat border-l border-default flex-shrink-0">
              {/* Search Input */}
              <div className="px-4 pt-4 bg-chat sticky top-0 z-10">
                <ListSearchInput
                  value={searchInput}
                  onChange={setSearchInput}
                  placeholder={t`Name or Address`}
                  variant="underline"
                  showSearchIcon={false}
                />
                <div className="pb-2">
                  {activeSearch &&
                    generateVirtualizedUserList(activeSearch, collapsedRoles).length === 0 && (
                      <div className="text-xs text-subtle mt-1">
                        {t`No users found!`}
                      </div>
                    )}
                </div>
              </div>

              <Virtuoso
                data={generateVirtualizedUserList(activeSearch, collapsedRoles)}
                overscan={10}
                components={{
                  Footer: () => <div className="channel-users-fade-spacer" />,
                }}
                itemContent={(_index, item) => {
                  if (item.type === 'header') {
                    return (
                      <div
                        className="role-group-header flex flex-col p-4 pb-0 cursor-pointer group"
                        onClick={() => toggleRoleCollapse(item.title)}
                      >
                        <div className="mb-1 text-xs text-subtle pb-1 flex items-center gap-1 group-hover:text-main transition-colors">
                          <Icon
                            name="chevron-down"
                            size="xs"
                            className={`role-group-chevron transition-transform duration-150 ${item.isCollapsed ? '-rotate-90' : ''}`}
                          />
                          <span>{item.title}</span>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="px-4 pb-2">
                        <div
                          className="w-full flex flex-row items-center cursor-pointer hover:bg-surface-2 rounded-md p-1 -m-1 transition-colors duration-150 group min-w-0"
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
                            className="opacity-80 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0"
                          />
                          <div className="flex flex-col ml-2 text-subtle group-hover:text-main transition-colors duration-150 min-w-0 flex-1">
                            <span className="text-md font-bold truncate-user-name">
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
          {/* Mobile Search Input */}
          <div
            className="sticky top-0 z-10"
            style={{ backgroundColor: 'var(--surface-0)' }}
          >
            <div className="search-mobile-header p-4">
              <ListSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder={t`Search Username or Address`}
                variant="bordered"
                clearable={true}
              />
            </div>
            {activeSearch &&
              generateVirtualizedUserList(activeSearch, collapsedRoles).length === 0 && (
                <div className="px-4 pb-3 -mt-2">
                  <div className="text-xs text-subtle">
                    {t`No users found!`}
                  </div>
                </div>
              )}
          </div>

          {/* User List - Virtualized for performance with large member counts */}
          <Virtuoso
            data={generateVirtualizedUserList(activeSearch, collapsedRoles)}
            overscan={10}
            components={{
              Footer: () => <div className="h-4" />,
            }}
            itemContent={(_index, item) => {
              if (item.type === 'header') {
                return (
                  <div
                    className="role-group-header role-group-header--mobile flex items-center gap-1 text-subtle text-xs pb-1 px-4 pt-3 cursor-pointer"
                    onClick={() => toggleRoleCollapse(item.title)}
                  >
                    <Icon
                      name="chevron-down"
                      size="xs"
                      className={`role-group-chevron transition-transform duration-150 ${item.isCollapsed ? '-rotate-90' : ''}`}
                    />
                    <span>{item.title}</span>
                  </div>
                );
              }
              return (
                <TouchAwareListItem
                  className="w-full flex flex-row items-center mb-2 px-4 cursor-pointer py-1 min-w-0"
                  onClick={() => {
                    // On mobile, user profile opens in drawer - no positioning needed
                    userProfileModal.handleUserClick(
                      {
                        address: item.address,
                        displayName: item.displayName,
                        userIcon: item.userIcon,
                      },
                      { stopPropagation: () => {} } as React.MouseEvent
                    );
                  }}
                >
                  <UserAvatar
                    userIcon={item.userIcon}
                    displayName={item.displayName ?? item.address}
                    address={item.address}
                    size={30}
                    className="opacity-80 flex-shrink-0"
                  />
                  <div className="flex flex-col ml-2 text-subtle min-w-0 flex-1">
                    <span className="text-md font-bold truncate-user-name">
                      {item.displayName ?? item.address}
                    </span>
                  </div>
                </TouchAwareListItem>
              );
            }}
            style={{ height: 'calc(80vh - 120px)' }}
          />
        </MobileDrawer>
      )}
    </div>
  );
};

export default Channel;
