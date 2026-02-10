import { logger } from '@quilibrium/quorum-shared';
import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { EmbedMessage } from '../../api/quorumApi';
import './DirectMessage.scss';
import {
  useMessageComposer,
  useDirectMessagesList,
  useUpdateReadTime,
} from '../../hooks';
import { useRegistrationOptional } from '../../hooks/queries/registration/useRegistrationOptional';
import { useConversation } from '../../hooks/queries/conversation/useConversation';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { loadMessagesAround } from '../../hooks/queries/messages/loadMessagesAround';
import { buildMessagesKey } from '../../hooks/queries/messages/buildMessagesKey';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';

import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { ClickToCopyContent } from '../ui';
import { DefaultImages, getAddressSuffix } from '../../utils';
import { isTouchDevice } from '../../utils/platform';

import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useModalContext } from '../context/ModalProvider';
import { UserAvatar } from '../user/UserAvatar';
import {
  Button,
  Container,
  Flex,
  Tooltip,
} from '../primitives';
import { BookmarksPanel } from '../bookmarks/BookmarksPanel';

const DirectMessage: React.FC<{}> = () => {
  const { isMobile, isTablet, toggleLeftSidebar, navMenuOpen, toggleNavMenu } =
    useResponsiveLayoutContext();

  const { openConversationSettings } = useModalContext();

  // Unified panel state for search - ensures only search panel can be open
  type ActivePanel = 'search' | 'bookmarks' | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { submitMessage, retryDirectMessage, keyset, getConfig, messageDB } = useMessageDB();

  // State for message signing
  const [skipSigning, setSkipSigning] = useState<boolean>(false);
  const [nonRepudiable, setNonRepudiable] = useState<boolean>(true);
  const headerRef = useRef<HTMLDivElement>(null);

  // Auto-jump to first unread state
  const [scrollToMessageId, setScrollToMessageId] = useState<string | undefined>();

  // New Messages separator state
  const [newMessagesSeparator, setNewMessagesSeparator] = useState<{
    firstUnreadMessageId: string;
    initialUnreadCount: number;
  } | null>(null);

  // Hash navigation state
  const [isLoadingHashMessage, setIsLoadingHashMessage] = useState(false);

  // Extract business logic hooks but also get the original data for compatibility
  const { address } = useParams<{ address: string }>();
  const conversationId = address! + '/' + address!;

  // Store last viewed DM address for navigation persistence
  useEffect(() => {
    if (address) {
      sessionStorage.setItem('lastDmAddress', address);
    }
  }, [address]);

  // Get all the data we need
  // Use non-suspense registration queries for offline resilience
  const { data: registration } = useRegistrationOptional({ address: address! });
  const { data: self } = useRegistrationOptional({
    address: user.currentPasskeyInfo!.address,
  });
  const { data: conversation } = useConversation({
    conversationId: conversationId,
  });

  // Get last read timestamp from conversation
  const lastReadTimestamp = conversation?.conversation?.lastReadTimestamp || 0;

  // Mutation for updating read time with proper cache invalidation
  const { mutate: updateReadTime } = useUpdateReadTime({
    spaceId: address!,
    channelId: address!,
  });

  // Get current user address for bookmarks
  const userAddress = user?.currentPasskeyInfo?.address || '';

  // Refs for tracking visible message timestamps (for read-time updates)
  const latestTimestampRef = useRef<number>(0);
  const lastSavedTimestampRef = useRef<number>(0);

  // Determine default signing behavior: conversation setting overrides user default.
  React.useEffect(() => {
    (async () => {
      try {
        const convIsRepudiable = conversation?.conversation?.isRepudiable;
        const cfg = await getConfig({
          address: user.currentPasskeyInfo!.address,
          userKey: keyset.userKeyset,
        });
        const userNonRepudiable = cfg?.nonRepudiable ?? true;
        if (typeof convIsRepudiable !== 'undefined') {
          const convNonRepudiable = !convIsRepudiable;
          setNonRepudiable(convNonRepudiable);
          setSkipSigning(convNonRepudiable ? false : !userNonRepudiable);
        } else {
          setNonRepudiable(userNonRepudiable);
          setSkipSigning(userNonRepudiable ? false : true);
        }
      } catch {
        setNonRepudiable(true);
        setSkipSigning(false);
      }
    })();
  }, [
    conversation?.conversation?.isRepudiable,
    keyset.userKeyset,
    getConfig,
    user.currentPasskeyInfo,
  ]);

  // Use business logic hooks for message handling
  const {
    messageList,
    acceptChat,
    fetchPreviousPage,
    fetchNextPage,
    hasNextPage,
    canDeleteMessages,
  } = useDirectMessagesList();

  // Build members with fallback chain: conversation (IndexedDB) > registration (network) > defaults
  // This allows the component to render offline using cached conversation data
  const members = useMemo(() => {
    const m = {} as {
      [address: string]: {
        displayName?: string;
        userIcon?: string;
        address: string;
      };
    };
    if (conversation?.conversation) {
      // Priority 1: Use conversation data from IndexedDB (available offline)
      m[address!] = {
        displayName: conversation.conversation!.displayName ?? t`Unknown User`,
        userIcon: conversation.conversation!.icon ?? DefaultImages.UNKNOWN_USER,
        address: address!,
      };
    } else if (registration?.registration) {
      // Priority 2: Use registration data from network API
      m[registration.registration.user_address] = {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
        address: registration.registration.user_address,
      };
    } else {
      // Priority 3: Offline fallback - use address as identifier
      m[address!] = {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
        address: address!,
      };
    }
    // Self data - use passkey context as primary source (always available)
    m[user.currentPasskeyInfo!.address] = {
      address: user.currentPasskeyInfo!.address,
      userIcon: user.currentPasskeyInfo!.pfpUrl,
      displayName: user.currentPasskeyInfo!.displayName,
    };
    return m;
  }, [registration, conversation, address, user.currentPasskeyInfo]);

  // Clean up stale encryption states when registration data changes
  // This fixes the DM inbox mismatch bug where Action Queue encrypts to old inboxes
  useEffect(() => {
    // Guard: Only run when BOTH self and counterparty registration are available
    if (!self?.registration || !registration?.registration || !address) {
      return;
    }

    const cleanupStaleEncryptionStates = async () => {
      try {
        const convId = `${address}/${address}`;
        const states = await messageDB.getEncryptionStates({ conversationId: convId });

        if (states.length === 0) return;

        // Check BOTH self and counterparty inboxes (matches legacy path at MessageService.ts:1627-1634)
        const validInboxes = [
          ...self.registration.device_registrations
            .map(d => d.inbox_registration.inbox_address),
          ...registration.registration.device_registrations
            .map(d => d.inbox_registration.inbox_address),
        ];

        let deletedCount = 0;
        for (const state of states) {
          const parsed = JSON.parse(state.state);
          if (!validInboxes.includes(parsed.tag)) {
            await messageDB.deleteEncryptionState(state);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          logger.log('[DirectMessage] Cleaned up stale encryption states', {
            conversationId: convId,
            deletedCount,
            remainingCount: states.length - deletedCount,
          });
        }
      } catch (error) {
        logger.error('[DirectMessage] Failed to cleanup stale encryption states:', error);
        // Don't throw - cleanup is best-effort, shouldn't break the page
      }
    };

    cleanupStaleEncryptionStates();
  }, [self?.registration, registration?.registration, address, messageDB]);

  // Helper for compatibility
  const otherUser = members[address!] || {
    displayName: t`Unknown User`,
    userIcon: DefaultImages.UNKNOWN_USER,
    address: address!,
  };

  // Icon size for header icons
  const headerIconSize = 'lg';


  // Message composition - using shared MessageComposer hook
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const messageListRef = useRef<MessageListRef>(null);

  // Submit message function for MessageComposer
  const handleSubmitMessage = useCallback(
    async (message: string | object, inReplyTo?: string) => {
      if (!address) return; // Guard against undefined address

      // Guard against missing registration data (offline)
      if (!self?.registration || !registration?.registration) {
        logger.warn('[DirectMessage] Cannot send message: registration data unavailable (offline?)');
        return;
      }

      const effectiveSkip = nonRepudiable ? false : skipSigning;

      if (typeof message === 'string') {
        // Text message
        await submitMessage(
          address,
          message,
          self.registration!,
          registration.registration!,
          queryClient,
          user.currentPasskeyInfo!,
          keyset,
          inReplyTo,
          effectiveSkip
        );
      } else {
        // Embed message (image)
        await submitMessage(
          address,
          message as EmbedMessage,
          self.registration!,
          registration.registration!,
          queryClient,
          user.currentPasskeyInfo!,
          keyset,
          inReplyTo,
          effectiveSkip
        );
      }

      // Scroll is handled by Virtuoso's followOutput - no manual scroll needed
      // Deletion flag is set via onBeforeDelete callback in MessageList
    },
    [
      address,
      self,
      registration,
      queryClient,
      user,
      keyset,
      submitMessage,
      nonRepudiable,
      skipSigning,
    ]
  );

  // Handle retrying a failed message
  const handleRetryMessage = useCallback(
    async (message: import('../../api/quorumApi').Message) => {
      if (!self?.registration || !registration?.registration) {
        console.error('Cannot retry: missing registration data');
        return;
      }
      await retryDirectMessage(
        address!,
        message,
        self.registration,
        registration.registration,
        queryClient,
        user.currentPasskeyInfo!,
        keyset
      );
    },
    [address, self, registration, queryClient, user.currentPasskeyInfo, keyset, retryDirectMessage]
  );

  // Use MessageComposer hook
  const composer = useMessageComposer({
    type: 'direct',
    onSubmitMessage: handleSubmitMessage,
    hasStickers: false, // DirectMessage doesn't have stickers
  });


  // Auto-focus textarea when replying (same logic as Channel.tsx)
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

  // Auto-jump to first unread message on conversation entry
  useEffect(() => {
    // Skip if there's a hash navigation in progress
    if (window.location.hash.startsWith('#msg-')) {
      return;
    }

    // Skip if no unread messages
    if (lastReadTimestamp === 0) {
      return;
    }

    const jumpToFirstUnread = async () => {
      try {
        // Get the first unread message
        const firstUnread = await messageDB.getFirstUnreadMessage({
          spaceId: address!,
          channelId: address!,
          afterTimestamp: lastReadTimestamp,
        });

        // If no unread message found, don't jump
        if (!firstUnread) {
          return;
        }

        // Check if the first unread is already in the loaded messages
        const isAlreadyLoaded = messageList.some(
          (m) => m.messageId === firstUnread.messageId
        );

        if (isAlreadyLoaded) {
          // Calculate initial unread count (only count messages from the other party)
          const currentUserId = user.currentPasskeyInfo!.address;
          const unreadCount = messageList.filter(
            (m) => m.createdDate > lastReadTimestamp &&
                   m.content.senderId !== currentUserId
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
          spaceId: address!,
          channelId: address!,
          targetMessageId: firstUnread.messageId,
          beforeLimit: 40,
          afterLimit: 40,
        });

        // Update React Query cache to replace current pages with new data
        queryClient.setQueryData(
          buildMessagesKey({ spaceId: address!, channelId: address! }),
          {
            pages: [{ messages, prevCursor, nextCursor }],
            pageParams: [undefined],
          }
        );

        // Calculate unread count from loaded messages (only count messages from the other party)
        const currentUserId = user.currentPasskeyInfo!.address;
        const unreadCount = messages.filter(
          (m) => m.createdDate > lastReadTimestamp &&
                 m.content.senderId !== currentUserId
        ).length;

        const firstUnreadAge = Date.now() - firstUnread.timestamp;
        const MIN_UNREAD_COUNT = 5;
        const MIN_AGE_MS = 5 * 60 * 1000;

        const shouldShowSeparator =
          unreadCount >= MIN_UNREAD_COUNT || firstUnreadAge > MIN_AGE_MS;

        // Set the message ID to scroll to
        setScrollToMessageId(firstUnread.messageId);

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

    // Only auto-jump on initial conversation mount
    const timer = setTimeout(() => {
      jumpToFirstUnread();
    }, 100);

    return () => clearTimeout(timer);
  }, [address, lastReadTimestamp, messageDB, messageList, queryClient, user.currentPasskeyInfo]);

  // Reset scrollToMessageId, separator, and timestamp refs when conversation changes
  useEffect(() => {
    setScrollToMessageId(undefined);
    setNewMessagesSeparator(null);
    // Reset timestamp refs to ensure read time is saved for each conversation
    latestTimestampRef.current = 0;
    lastSavedTimestampRef.current = 0;
  }, [address]);

  // Hash navigation handler
  const handleHashMessageNotFound = useCallback(
    async (messageId: string) => {
      try {
        setIsLoadingHashMessage(true);

        const { messages, prevCursor, nextCursor } = await loadMessagesAround({
          messageDB,
          spaceId: address!,
          channelId: address!,
          targetMessageId: messageId,
          beforeLimit: 40,
          afterLimit: 40,
        });

        queryClient.setQueryData(
          buildMessagesKey({ spaceId: address!, channelId: address! }),
          {
            pages: [{ messages, prevCursor, nextCursor }],
            pageParams: [undefined],
          }
        );
      } catch (error) {
        console.error('Failed to load hash message:', error);
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
    [messageDB, address, queryClient]
  );

  // Helper function to map sender to user (used by MessageList)
  const mapSenderToUser = useCallback(
    (senderId: string) => {
      return (
        members[senderId] || {
          displayName: t`Unknown User`,
          userIcon: DefaultImages.UNKNOWN_USER,
        }
      );
    },
    [members]
  );

  // Legacy submit function for MessageList compatibility
  const submit = useCallback(
    async (message: any) => {
      await handleSubmitMessage(message);
    },
    [handleSubmitMessage]
  );

  // Update latest timestamp ref whenever messageList or conversation changes
  // Use the max of: last message in list OR conversation.timestamp
  // This ensures we mark as read even if newest message isn't in the loaded list yet
  const conversationTimestamp = conversation?.conversation?.timestamp || 0;
  useEffect(() => {
    let maxTimestamp = latestTimestampRef.current;

    // Check message list
    if (messageList && messageList.length > 0) {
      const latestMessage = messageList[messageList.length - 1];
      if (latestMessage && latestMessage.createdDate > maxTimestamp) {
        maxTimestamp = latestMessage.createdDate;
      }
    }

    // Also check conversation timestamp (source of truth for unread comparison)
    if (conversationTimestamp > maxTimestamp) {
      maxTimestamp = conversationTimestamp;
    }

    if (maxTimestamp > latestTimestampRef.current) {
      latestTimestampRef.current = maxTimestamp;
    }
  }, [messageList, conversationTimestamp]);

  // Periodic check to save read time (every 2 seconds)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (
        latestTimestampRef.current > 0 &&
        latestTimestampRef.current > lastSavedTimestampRef.current
      ) {
        updateReadTime(latestTimestampRef.current);
        lastSavedTimestampRef.current = latestTimestampRef.current;
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [updateReadTime]);

  // Save immediately when leaving DM conversation (component unmount)
  useEffect(() => {
    return () => {
      if (latestTimestampRef.current > lastSavedTimestampRef.current) {
        updateReadTime(latestTimestampRef.current);
      }
    };
  }, [updateReadTime]);

  return (
    <div className="chat-container">
      <Flex direction="column">
        {/* Header - full width at top */}
        <Container
          ref={headerRef}
          className="chat-header text-main flex flex-wrap lg:flex-nowrap lg:justify-between lg:items-center"
        >
          {/* First row on mobile: burger + controls / Single row on desktop */}
          <div className="w-full lg:w-auto flex items-center justify-between lg:contents">
            {/* Mobile controls - burger + NavMenu toggle */}
            {(isMobile || isTablet) && (
              <Flex className="gap-3 sm:gap-2">
                <Button
                  type="unstyled"
                  onClick={toggleNavMenu}
                  className="header-icon-button lg:hidden"
                  iconName={navMenuOpen ? 'chevron-left' : 'menu'}
                  iconOnly
                  iconSize={headerIconSize}
                />
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="header-icon-button lg:hidden"
                  iconName="sidebar-left-expand"
                  iconOnly
                  iconSize={headerIconSize}
                />
              </Flex>
            )}

            {/* User info - hidden on mobile first row, shown on desktop */}
            <Container className="hidden lg:flex flex-1 min-w-0">
              <Flex className="items-center min-w-0">
                <Flex direction="column" className="justify-around flex-shrink-0">
                  <UserAvatar
                    userIcon={otherUser.userIcon}
                    displayName={otherUser.displayName ?? otherUser.address}
                    address={otherUser.address || ''}
                    size={28}
                  />
                </Flex>
                <div className="pl-2 flex items-center gap-2 overflow-hidden min-w-0">
                  <span className="font-semibold truncate-user-name-chat flex-shrink min-w-0">
                    {otherUser.displayName ?? otherUser.address}
                  </span>
                  <span className="text-subtle flex-shrink-0 hidden xs:block">|</span>
                  <ClickToCopyContent
                    text={address ?? ''}
                    tooltipText={t`Copy address`}
                    tooltipLocation="right"
                    className="text-subtle flex-shrink-0 hidden xs:block"
                    iconPosition="right"
                    iconClassName="text-subtle hover:text-surface-7"
                    iconSize="xs"
                    textSize="xs"
                  >
                    {getAddressSuffix(address ?? '')}
                  </ClickToCopyContent>
                </div>
              </Flex>
            </Container>

            {/* Controls - right side on both mobile and desktop */}
            <Flex className="items-center gap-3 sm:gap-2">
              <Tooltip
                id="dm-settings-toggle"
                content={t`Conversation settings`}
                place="bottom"
                showOnTouch={false}
              >
                <Button
                  type="unstyled"
                  onClick={() => openConversationSettings(conversationId)}
                  className="header-icon-button"
                  iconName="settings"
                  iconSize={headerIconSize}
                  iconOnly
                />
              </Tooltip>
              {/* Bookmarks */}
              <div className="relative">
                <Tooltip
                  id="dm-bookmarks"
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
                  mapSenderToUser={mapSenderToUser}
                />
              </div>

              {/* Search: Touch devices always show icon, non-touch devices show inline search */}
              {isTouchDevice() ? (
                <Tooltip
                  id="dm-search-toggle"
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
                className="dm-search ml-2"
                isOpen={activePanel === 'search'}
                onOpen={() => setActivePanel('search')}
                onClose={() => setActivePanel(null)}
              />
            </Flex>
          </div>

          {/* Second row on mobile: user info / Hidden on desktop (shown above) */}
          <Container className="w-full lg:hidden mt-3">
            <Flex className="items-center min-w-0">
              <Flex direction="column" className="justify-around flex-shrink-0">
                <UserAvatar
                  userIcon={otherUser.userIcon}
                  displayName={otherUser.displayName ?? otherUser.address}
                  address={otherUser.address || ''}
                  size={28}
                />
              </Flex>
              {/* xs and up: horizontal layout with separator */}
              <div className="pl-2 hidden xs:flex items-center gap-2 overflow-hidden min-w-0">
                <span className="font-semibold truncate-user-name-chat">
                  {otherUser.displayName ?? otherUser.address}
                </span>
                <span className="text-subtle flex-shrink-0">|</span>
                <ClickToCopyContent
                  text={address ?? ''}
                  tooltipText={t`Copy address`}
                  tooltipLocation="right"
                  className="text-subtle flex-shrink-0"
                  iconPosition="right"
                  iconClassName="text-subtle hover:text-main"
                  iconSize="xs"
                  textSize="xs"
                >
                  {getAddressSuffix(address ?? '')}
                </ClickToCopyContent>
              </div>
              {/* Below xs: vertical layout - name above address */}
              <div className="pl-2 flex xs:hidden flex-col min-w-0">
                <span className="text-label font-semibold truncate">
                  {otherUser.displayName ?? otherUser.address}
                </span>
                <ClickToCopyContent
                  text={address ?? ''}
                  tooltipText={t`Copy address`}
                  tooltipLocation="right"
                  className="text-subtle text-[0.75rem]"
                  iconPosition="right"
                  iconClassName="text-subtle hover:text-main"
                  iconSize="xs"
                >
                  {getAddressSuffix(address ?? '')}
                </ClickToCopyContent>
              </div>
            </Flex>
          </Container>
        </Container>

        {/* Content area - flex container for messages and sidebar */}
        <div className="flex flex-1 min-w-0">
          {/* Messages and composer area */}
          <div className="flex flex-col flex-1 min-w-0">
            <Container className="message-list message-list-expanded relative">
              <MessageList
                ref={messageListRef}
                roles={[]}
                canDeleteMessages={canDeleteMessages}
                editor={composer.editor}
                messageList={messageList}
                setInReplyTo={composer.setInReplyTo}
                members={members}
                submitMessage={submit}
                scrollToMessageId={scrollToMessageId}
                newMessagesSeparator={newMessagesSeparator}
                onDismissSeparator={() => setNewMessagesSeparator(null)}
                onHashMessageNotFound={handleHashMessageNotFound}
                isLoadingHashMessage={isLoadingHashMessage}
                fetchPreviousPage={() => {
                  fetchPreviousPage();
                }}
                fetchNextPage={() => {
                  fetchNextPage();
                }}
                hasNextPage={hasNextPage}
                onRetryMessage={handleRetryMessage}
                dmContext={
                  self?.registration && registration?.registration
                    ? { self: self.registration, counterparty: registration.registration }
                    : undefined
                }
              />
            </Container>
            {/* Accept chat warning */}
            {!acceptChat && (
              <Flex className="justify-center">
                <Container className="w-auto mx-4 p-2 sm:px-4 mb-2 text-sm text-center rounded-lg bg-surface-4 text-subtle">
                  {t`Until you reply, this sender will not see your display name or profile picture`}
                </Container>
              </Flex>
            )}

            {/* Message Composer */}
            <div className="message-editor-container">
              <MessageComposer
                ref={messageComposerRef}
                value={composer.pendingMessage}
                onChange={composer.setPendingMessage}
                onKeyDown={composer.handleKeyDown}
                placeholder={i18n._('Send a message to {user}', {
                  user: otherUser.displayName ?? otherUser.address,
                })}
                calculateRows={composer.calculateRows}
                getRootProps={composer.getRootProps}
                getInputProps={composer.getInputProps}
                processedImage={composer.processedImage}
                clearFile={composer.clearFile}
                onSubmitMessage={composer.submitMessage}
                onShowStickers={() => {}}
                hasStickers={false}
                inReplyTo={composer.inReplyTo}
                fileError={composer.fileError}
                isProcessingImage={composer.isProcessingImage}
                mapSenderToUser={mapSenderToUser}
                setInReplyTo={composer.setInReplyTo}
                showSigningToggle={!nonRepudiable}
                skipSigning={skipSigning}
                onSigningToggle={() => setSkipSigning(!skipSigning)}
                mentionError={composer.mentionError}
                messageValidation={composer.messageValidation}
                characterCount={composer.characterCount}
              />
            </div>
          </div>

        </div>
      </Flex>
    </div>
  );
};

export default DirectMessage;
