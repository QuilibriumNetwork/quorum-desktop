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
  useRegistration,
  useMessageComposer,
  useDirectMessagesList,
} from '../../hooks';
import { useConversation } from '../../hooks/queries/conversation/useConversation';
import { useMessageDB } from '../context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useSidebar } from '../context/SidebarProvider';
import { loadMessagesAround } from '../../hooks/queries/messages/loadMessagesAround';
import { buildMessagesKey } from '../../hooks/queries/messages/buildMessagesKey';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';

import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { ClickToCopyContent, MobileDrawer } from '../ui';
import { DefaultImages, truncateAddress } from '../../utils';

import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useModalContext } from '../context/ModalProvider';
import { UserAvatar } from '../user/UserAvatar';
import {
  Button,
  Container,
  FlexRow,
  FlexColumn,
  Text,
  Tooltip,
} from '../primitives';

const DirectMessage: React.FC<{}> = () => {
  const { isMobile, isTablet, isDesktop, toggleLeftSidebar, navMenuOpen, toggleNavMenu } =
    useResponsiveLayoutContext();

  const { openConversationSettings } = useModalContext();

  // Unified panel state for search - ensures only search panel can be open
  type ActivePanel = 'search' | null;
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { submitMessage, keyset, getConfig, messageDB } = useMessageDB();

  // State for message signing
  const [skipSigning, setSkipSigning] = useState<boolean>(false);
  const [nonRepudiable, setNonRepudiable] = useState<boolean>(true);
  const [isDeletionInProgress, setIsDeletionInProgress] = useState(false);
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
  let { address } = useParams<{ address: string }>();
  const conversationId = address! + '/' + address!;

  // Get all the data we need (same as original)
  const { data: registration } = useRegistration({ address: address! });
  const { data: self } = useRegistration({
    address: user.currentPasskeyInfo!.address,
  });
  const { data: conversation } = useConversation({
    conversationId: conversationId,
  });

  // Get last read timestamp from conversation
  const lastReadTimestamp = conversation?.conversation?.lastReadTimestamp || 0;

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

  // Recreate members logic exactly as original (temporary fix)
  const members = useMemo(() => {
    let m = {} as {
      [address: string]: {
        displayName?: string;
        userIcon?: string;
        address: string;
      };
    };
    if (conversation?.conversation) {
      m[address!] = {
        displayName: conversation.conversation!.displayName,
        userIcon: conversation.conversation!.icon,
        address: address!,
      };
    } else if (registration?.registration) {
      m[registration.registration.user_address] = {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
        address: registration.registration.user_address,
      };
    }
    m[user.currentPasskeyInfo!.address] = {
      address: user.currentPasskeyInfo!.address,
      userIcon: user.currentPasskeyInfo!.pfpUrl,
      displayName: user.currentPasskeyInfo!.displayName,
    };
    return m;
  }, [registration, conversation, address, user.currentPasskeyInfo]);

  // Helper for compatibility
  const otherUser = members[address!] || {
    displayName: t`Unknown User`,
    userIcon: DefaultImages.UNKNOWN_USER,
    address: address!,
  };

  // Compute responsive icon size for header icons (lg for desktop ≥1024px, md for mobile/tablet)
  const headerIconSize = isDesktop ? 'lg' : 'lg';

  // Sidebar state
  const {
    showRightSidebar: showUsers,
    setShowRightSidebar: setShowUsers,
    rightSidebarContent,
    setRightSidebarContent,
  } = useSidebar();

  // Message composition - using shared MessageComposer hook
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const messageListRef = useRef<MessageListRef>(null);

  // Submit message function for MessageComposer
  const handleSubmitMessage = useCallback(
    async (message: string | object, inReplyTo?: string) => {
      if (!address) return; // Guard against undefined address

      // Check if this is a deletion to prevent auto-scroll (for consistency with Channel.tsx)
      const isDeletion =
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'remove-message';

      if (isDeletion) {
        setIsDeletionInProgress(true);
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

      // Clear deletion flag after a short delay
      if (isDeletion) {
        setTimeout(() => setIsDeletionInProgress(false), 300);
      }

      // Auto-scroll to bottom after sending message (same logic as Channel.tsx)
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

  // Use MessageComposer hook
  const composer = useMessageComposer({
    type: 'direct',
    onSubmitMessage: handleSubmitMessage,
    hasStickers: false, // DirectMessage doesn't have stickers
  });

  // Set sidebar content in context (exactly as original)
  React.useEffect(() => {
    const sidebarContent = (
      <div className="flex flex-col">
        {Object.keys(members).map((s) => (
          <div key={s} className="w-full flex flex-row items-center mb-2">
            <UserAvatar
              userIcon={members[s].userIcon}
              displayName={members[s].displayName ?? members[s].address}
              address={members[s].address || ''}
              size={36}
              className="flex-shrink-0"
            />
            <div className="flex flex-col ml-2">
              <span className="text-md font-bold truncate w-[190px] text-main/90">
                {members[s].displayName ?? members[s].address}{' '}
                {members[s].address === user.currentPasskeyInfo!.address && (
                  <span className="text-xs text-subtle">({t`You`})</span>
                )}
              </span>
              <span className="truncate w-[190px]">
                <ClickToCopyContent
                  text={members[s].address}
                  tooltipText={t`Copy address`}
                  tooltipLocation="left-start"
                  iconClassName="text-muted hover:text-main"
                  textVariant="subtle"
                  textSize="xs"
                  iconSize="xs"
                >
                  {truncateAddress(members[s].address)}
                </ClickToCopyContent>
              </span>
            </div>
          </div>
        ))}
      </div>
    );

    setRightSidebarContent(sidebarContent);
  }, [members, user.currentPasskeyInfo, setRightSidebarContent]);

  // Clean up sidebar content when component unmounts
  React.useEffect(() => {
    return () => {
      setRightSidebarContent(null);
    };
  }, [setRightSidebarContent]);

  // Auto-focus textarea when replying (same logic as Channel.tsx)
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
          // Calculate initial unread count
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

        // Calculate unread count from loaded messages
        const unreadCount = messages.filter(
          (m) => m.createdDate > lastReadTimestamp
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
  }, [address, lastReadTimestamp, messageDB, messageList, queryClient]);

  // Reset scrollToMessageId and separator when conversation changes
  useEffect(() => {
    setScrollToMessageId(undefined);
    setNewMessagesSeparator(null);
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

  return (
    <div className="chat-container">
      <FlexColumn>
        {/* Header - full width at top */}
        <Container
          ref={headerRef}
          className="direct-message-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-wrap lg:flex-nowrap lg:justify-between lg:items-center"
        >
          {/* First row on mobile: burger + controls / Single row on desktop */}
          <div className="w-full lg:w-auto flex items-center justify-between lg:contents">
            {/* Mobile controls - burger + NavMenu toggle */}
            {(isMobile || isTablet) && (
              <FlexRow className="gap-3 sm:gap-2">
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="header-icon-button lg:hidden"
                  iconName="bars"
                  iconOnly
                  iconSize={headerIconSize}
                />
                <Button
                  type="unstyled"
                  onClick={toggleNavMenu}
                  className="header-icon-button lg:hidden"
                  iconName={navMenuOpen ? 'chevron-left' : 'chevron-right'}
                  iconOnly
                  iconSize={headerIconSize}
                />
              </FlexRow>
            )}

            {/* User info - hidden on mobile first row, shown on desktop */}
            <Container className="hidden lg:flex flex-1 min-w-0">
              <FlexRow className="items-center">
                <FlexColumn className="justify-around">
                  <UserAvatar
                    userIcon={otherUser.userIcon}
                    displayName={otherUser.displayName ?? otherUser.address}
                    address={otherUser.address || ''}
                    size={28}
                  />
                </FlexColumn>
                <FlexRow className="pl-2">
                  <FlexColumn className="justify-around font-semibold">
                    <Text>{otherUser.displayName ?? otherUser.address}</Text>
                  </FlexColumn>
                  <FlexColumn className="justify-around px-1">
                    <Text className="text-subtle">|</Text>
                  </FlexColumn>
                  <FlexColumn className="justify-around">
                    <FlexRow className="items-center">
                      <ClickToCopyContent
                        text={address ?? ''}
                        tooltipText={t`Copy address`}
                        tooltipLocation="right"
                        className="text-subtle"
                        iconPosition="right"
                        iconClassName="text-subtle hover:text-surface-7"
                        iconSize="xs"
                        textSize="xs"
                      >
                        {truncateAddress(address ?? '')}
                      </ClickToCopyContent>
                    </FlexRow>
                  </FlexColumn>
                </FlexRow>
              </FlexRow>
            </Container>

            {/* Controls - right side on both mobile and desktop */}
            <FlexRow className="items-center gap-3 sm:gap-2">
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
              <Tooltip
                id="dm-members-list"
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
            </FlexRow>
          </div>

          {/* Second row on mobile: user info / Hidden on desktop (shown above) */}
          <Container className="w-full lg:hidden">
            <FlexRow className="items-center">
              <FlexColumn className="justify-around">
                <UserAvatar
                  userIcon={otherUser.userIcon}
                  displayName={otherUser.displayName ?? otherUser.address}
                  address={otherUser.address || ''}
                  size={28}
                />
              </FlexColumn>
              <FlexRow className="pl-2">
                <FlexColumn className="justify-around font-semibold">
                  <Text>{otherUser.displayName ?? otherUser.address}</Text>
                </FlexColumn>
                <FlexColumn className="justify-around px-1">
                  <Text className="text-subtle">|</Text>
                </FlexColumn>
                <FlexColumn className="justify-around">
                  <FlexRow className="items-center">
                    <ClickToCopyContent
                      text={address ?? ''}
                      tooltipText={t`Copy address`}
                      tooltipLocation="right"
                      className="text-subtle"
                      iconPosition="right"
                      iconClassName="text-subtle hover:text-main"
                      iconSize="xs"
                      textSize="xs"
                    >
                      {truncateAddress(address ?? '')}
                    </ClickToCopyContent>
                  </FlexRow>
                </FlexColumn>
              </FlexRow>
            </FlexRow>
          </Container>
        </Container>

        {/* Content area - flex container for messages and sidebar */}
        <div className="flex flex-1 min-w-0">
          {/* Messages and composer area */}
          <div className="flex flex-col flex-1 min-w-0">
            <Container
              className={
                'message-list relative' +
                (!showUsers ? ' message-list-expanded' : '')
              }
            >
              <MessageList
                ref={messageListRef}
                isRepudiable={!nonRepudiable}
                roles={[]}
                canDeleteMessages={canDeleteMessages}
                editor={composer.editor}
                messageList={messageList}
                setInReplyTo={composer.setInReplyTo}
                members={members}
                submitMessage={submit}
                isDeletionInProgress={isDeletionInProgress}
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
              />
            </Container>
            {/* Accept chat warning */}
            {!acceptChat && (
              <FlexRow className="justify-center">
                <Container className="w-auto mx-4 p-2 sm:px-4 mb-2 text-sm text-center rounded-lg bg-surface-4 text-subtle">
                  {t`Until you reply, this sender will not see your display name or profile picture`}
                </Container>
              </FlexRow>
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
              />
            </div>
          </div>

          {/* Desktop sidebar only - mobile sidebar renders via MobileDrawer below */}
          {showUsers && (
            <div className="hidden lg:block w-[260px] bg-chat border-l border-default overflow-y-auto flex-shrink-0 p-4">
              {rightSidebarContent}
            </div>
          )}
        </div>

        {/* Mobile drawer for user list below 1024px */}
        {!isDesktop && (
          <MobileDrawer
            isOpen={showUsers}
            onClose={() => setShowUsers(false)}
            showCloseButton={false}
            enableSwipeToClose={true}
            ariaLabel={t`Members List`}
          >
            <div className="p-4">
              {rightSidebarContent}
            </div>
          </MobileDrawer>
        )}
      </FlexColumn>
    </div>
  );
};

export default DirectMessage;
