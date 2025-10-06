import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { EmbedMessage, Message as MessageType } from '../../api/quorumApi';
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
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';

import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import { ClickToCopyContent } from '../ui';
import { DefaultImages, truncateAddress } from '../../utils';
import { isTouchDevice } from '../../utils/platform';
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
  Icon,
  Tooltip,
} from '../primitives';

const DirectMessage: React.FC<{}> = () => {
  const { isMobile, isTablet, toggleLeftSidebar } =
    useResponsiveLayoutContext();

  const { openConversationSettings } = useModalContext();
  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { messageDB, submitMessage, keyset, getConfig } = useMessageDB();

  // State for message signing
  const [skipSigning, setSkipSigning] = useState<boolean>(false);
  const [nonRepudiable, setNonRepudiable] = useState<boolean>(true);
  const [isDeletionInProgress, setIsDeletionInProgress] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

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
    fetchNextPage,
    fetchPreviousPage,
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
              displayName={members[s].displayName}
              address={members[s].address || ''}
              size={36}
              className="flex-shrink-0"
            />
            <div className="flex flex-col ml-2">
              <span className="text-md font-bold truncate w-[190px] text-main/90">
                {members[s].displayName}{' '}
                {members[s].address === user.currentPasskeyInfo!.address && (
                  <span className="text-xs text-subtle">({t`You`})</span>
                )}
              </span>
              <span className="truncate w-[190px]">
                <ClickToCopyContent
                  text={members[s].address}
                  tooltipText={t`Copy address`}
                  tooltipLocation="left-start"
                  iconClassName="text-surface-9 hover:text-surface-10 dark:text-surface-8 dark:hover:text-surface-9"
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
            {/* Burger menu for mobile only */}
            {(isMobile || isTablet) && (
              <Button
                type="unstyled"
                onClick={toggleLeftSidebar}
                className="header-icon-button lg:hidden"
                iconName="bars"
                iconOnly
              />
            )}

            {/* User info - hidden on mobile first row, shown on desktop */}
            <Container className="hidden lg:flex flex-1 min-w-0">
              <FlexRow className="items-center">
                <FlexColumn className="justify-around">
                  <UserAvatar
                    userIcon={otherUser.userIcon}
                    displayName={otherUser.displayName}
                    address={otherUser.address || ''}
                    size={28}
                  />
                </FlexColumn>
                <FlexRow className="pl-2">
                  <FlexColumn className="justify-around font-semibold">
                    <Text>{otherUser.displayName}</Text>
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
                        className="font-light text-xs text-subtle"
                        iconPosition="right"
                        iconClassName="text-subtle hover:text-surface-7"
                        iconSize="xs"
                      >
                        {truncateAddress(address ?? '')}
                      </ClickToCopyContent>
                    </FlexRow>
                  </FlexColumn>
                </FlexRow>
              </FlexRow>
            </Container>

            {/* Controls - right side on both mobile and desktop */}
            <FlexRow className="items-center gap-2">
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
                  iconName="cog"
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
                  iconOnly
                />
              </Tooltip>
              <GlobalSearch className="dm-search ml-2" />
            </FlexRow>
          </div>

          {/* Second row on mobile: user info / Hidden on desktop (shown above) */}
          <Container className="w-full lg:hidden">
            <FlexRow className="items-center">
              <FlexColumn className="justify-around">
                <UserAvatar
                  userIcon={otherUser.userIcon}
                  displayName={otherUser.displayName}
                  address={otherUser.address || ''}
                  size={28}
                />
              </FlexColumn>
              <FlexRow className="pl-2">
                <FlexColumn className="justify-around font-semibold">
                  <Text>{otherUser.displayName}</Text>
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
                      className="font-light text-xs text-subtle"
                      iconPosition="right"
                      iconClassName="text-subtle hover:text-surface-7"
                      iconSize="xs"
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
                'message-list' + (!showUsers ? ' message-list-expanded' : '')
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
                fetchPreviousPage={() => {
                  fetchPreviousPage();
                }}
              />
            </Container>
            {/* Accept chat warning */}
            {!acceptChat && (
              <FlexRow className="justify-center">
                <Container className="w-auto px-3 py-2 mb-2 text-sm text-center rounded-lg bg-surface-4 text-subtle">
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
                  user: otherUser.displayName,
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

          {/* Desktop sidebar only - mobile sidebar renders via SidebarProvider at Layout level */}
          {showUsers && (
            <div className="hidden lg:block w-[260px] bg-chat border-l border-default overflow-y-auto flex-shrink-0 p-4">
              {rightSidebarContent}
            </div>
          )}
        </div>
      </FlexColumn>
    </div>
  );
};

export default DirectMessage;
