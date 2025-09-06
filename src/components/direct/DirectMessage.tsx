import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
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
import { useMessageDB } from '../context/MessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useSidebar } from '../context/SidebarProvider';
import { MessageList, MessageListRef } from '../message/MessageList';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';

import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages, truncateAddress } from '../../utils';
import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { Button, Container, FlexRow, FlexColumn, Text, Icon, Tooltip } from '../primitives';

const DirectMessage: React.FC<{}> = () => {
  const { isMobile, isTablet, toggleLeftSidebar } =
    useResponsiveLayoutContext();

  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { messageDB, submitMessage, keyset, getConfig } = useMessageDB();
  
  // State for message signing
  const [skipSigning, setSkipSigning] = useState<boolean>(false);
  const [nonRepudiable, setNonRepudiable] = useState<boolean>(true);

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
  }, [conversation?.conversation?.isRepudiable, keyset.userKeyset, getConfig, user.currentPasskeyInfo]);

  // Use business logic hooks for message handling
  const { messageList, acceptChat, fetchNextPage, fetchPreviousPage } =
    useDirectMessagesList();

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

      // Auto-scroll to bottom after sending message (same logic as Channel.tsx)
      const isReaction =
        typeof message === 'object' &&
        'type' in message &&
        (message.type === 'reaction' || message.type === 'remove-reaction');

      if (!isReaction) {
        setTimeout(() => {
          messageListRef.current?.scrollToBottom();
        }, 100);
      }
    },
    [address, self, registration, queryClient, user, keyset, submitMessage, nonRepudiable, skipSigning]
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
            <div
              className="rounded-full w-[36px] h-[36px] flex-shrink-0"
              style={{
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                backgroundImage: `url(${members[s].userIcon})`,
              }}
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

  const userIcon = otherUser.userIcon;
  const icon = userIcon?.includes(DefaultImages.UNKNOWN_USER)
    ? 'var(--unknown-icon)'
    : 'url(' + userIcon + ')';
  return (
    <div className="chat-container">
      <FlexColumn>
        <Container className="direct-message-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <FlexRow className="items-center gap-2 lg:order-2 justify-between lg:justify-start mb-2 lg:mb-0">
            <FlexRow className="items-center gap-2">
              {(isMobile || isTablet) && (
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="w-6 h-6 p-2 !rounded-md cursor-pointer hover:bg-surface-6 flex items-center justify-center"
                  iconName="bars"
                  iconOnly
                />
              )}
              {/* Desktop: non-repudiability toggle to the left of search */}
              <div
                className="hidden lg:flex w-8 h-8 items-center justify-center rounded-md bg-surface-5 hover:bg-surface-6 cursor-pointer"
                onClick={async () => {
                  const next = !nonRepudiable;
                  setNonRepudiable(next);
                  try {
                    const existing = await messageDB.getConversation({ conversationId });
                    const baseConv = existing.conversation ?? {
                      conversationId,
                      address: address!,
                      icon: otherUser.userIcon || DefaultImages.UNKNOWN_USER,
                      displayName: otherUser.displayName || t`Unknown User`,
                      type: 'direct' as const,
                      timestamp: Date.now(),
                    };
                    await messageDB.saveConversation({ ...baseConv, isRepudiable: !next });
                    if (!next) {
                      const cfg = await getConfig({
                        address: user.currentPasskeyInfo!.address,
                        userKey: keyset.userKeyset,
                      });
                      const userNonRepudiable = cfg?.nonRepudiable ?? true;
                      setSkipSigning(!userNonRepudiable);
                    } else {
                      setSkipSigning(false);
                    }
                  } catch {}
                }}
                data-tooltip-id="dm-repudiability-toggle"
              >
                <Icon name={nonRepudiable ? 'lock' : 'unlock'} size="sm" className="text-subtle" />
              </div>
              <GlobalSearch className="dm-search flex-1 lg:flex-none max-w-xs lg:max-w-none" />
            </FlexRow>
            <FlexRow className="items-center gap-2">
              <Button
              type="unstyled"
              onClick={() => {
                setShowUsers(!showUsers);
              }}
              className="w-6 h-6 p-2 !rounded-md cursor-pointer hover:bg-surface-6 flex items-center justify-center [&_.quorum-button-icon-element]:text-sm"
              iconName="users"
              iconOnly
            />
              {/* Mobile: non-repudiability toggle at far right */}
              <div
                className="flex lg:hidden w-8 h-8 items-center justify-center rounded-md bg-surface-5 hover:bg-surface-6 cursor-pointer"
                onClick={async () => {
                  const next = !nonRepudiable;
                  setNonRepudiable(next);
                  try {
                    const existing = await messageDB.getConversation({ conversationId });
                    const baseConv = existing.conversation ?? {
                      conversationId,
                      address: address!,
                      icon: otherUser.userIcon || DefaultImages.UNKNOWN_USER,
                      displayName: otherUser.displayName || t`Unknown User`,
                      type: 'direct' as const,
                      timestamp: Date.now(),
                    };
                    await messageDB.saveConversation({ ...baseConv, isRepudiable: !next });
                    if (!next) {
                      const cfg = await getConfig({
                        address: user.currentPasskeyInfo!.address,
                        userKey: keyset.userKeyset,
                      });
                      const userNonRepudiable = cfg?.nonRepudiable ?? true;
                      setSkipSigning(!userNonRepudiable);
                    } else {
                      setSkipSigning(false);
                    }
                  } catch {}
                }}
                data-tooltip-id="dm-repudiability-toggle"
              >
                <Icon name={nonRepudiable ? 'lock' : 'unlock'} size="sm" className="text-subtle" />
              </div>
            </FlexRow>
          </FlexRow>
          <Container className="flex-1 min-w-0 lg:order-1">
            <FlexRow className="items-center">
              <FlexColumn className="justify-around">
                <Container
                  className="w-[28px] h-[28px] bg-cover bg-center rounded-full"
                  style={{
                    backgroundImage: `${icon}`,
                  }}
                />
              </FlexColumn>
              <FlexRow className="pl-2">
                <FlexColumn className="justify-around font-semibold">
                  <Text>{otherUser.displayName} |</Text>
                </FlexColumn>
                <FlexColumn className="justify-around pl-1">
                  <FlexRow className="items-center">
                    <ClickToCopyContent
                      text={address ?? ''}
                      tooltipText={t`Copy address`}
                      tooltipLocation="right"
                      className="font-light text-sm text-subtle"
                      iconPosition="right"
                      iconClassName="text-subtle hover:text-surface-7"
                    >
                      {truncateAddress(address ?? '')}
                    </ClickToCopyContent>
                  </FlexRow>
                </FlexColumn>
              </FlexRow>
            </FlexRow>
          </Container>
        </Container>
        <Container
          className={
            'message-list' + (!showUsers ? ' message-list-expanded' : '')
          }
        >
          <MessageList
            ref={messageListRef}
            isRepudiable={!nonRepudiable}
            roles={[]}
            canDeleteMessages={() => false}
            editor={composer.editor}
            messageList={messageList}
            setInReplyTo={composer.setInReplyTo}
            members={members}
            submitMessage={submit}
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
            fileData={composer.fileData}
            fileType={composer.fileType}
            clearFile={composer.clearFile}
            onSubmitMessage={composer.submitMessage}
            onShowStickers={() => {}}
            hasStickers={false}
            inReplyTo={composer.inReplyTo}
            fileError={composer.fileError}
            mapSenderToUser={mapSenderToUser}
            setInReplyTo={composer.setInReplyTo}
            showSigningToggle={!nonRepudiable}
            skipSigning={skipSigning}
            onSigningToggle={() => setSkipSigning(!skipSigning)}
          />
        </div>
      </FlexColumn>

      {/* Desktop sidebar - content is managed by SidebarProvider */}
      <Container
        className={
          'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-y-auto ' +
          'transition-transform duration-300 ease-in-out ' +
          (showUsers
            ? 'hidden lg:block translate-x-0 fixed top-0 right-0 h-full z-[10000] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
            : 'hidden')
        }
      >
        {rightSidebarContent}
      </Container>
      <Tooltip
        id="dm-repudiability-toggle"
        content={nonRepudiable ? t`Always sign this conversation's messages` : t`You may choose not to sign this conversation's messages`}
        place="top"
      />
    </div>
  );
};

export default DirectMessage;