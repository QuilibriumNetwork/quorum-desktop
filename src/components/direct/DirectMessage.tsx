import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faBars,
} from '@fortawesome/free-solid-svg-icons';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { EmbedMessage, Message as MessageType } from '../../api/quorumApi';
import './DirectMessage.scss';
import { 
  useRegistration, 
  useMessageComposer, 
  useDirectMessagesList 
} from '../../hooks';
import { useConversation } from '../../hooks/queries/conversation/useConversation';
import { useMessageDB } from '../context/MessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { useSidebar } from '../context/SidebarProvider';
import { MessageList } from '../message/MessageList';
import MessageComposer, { MessageComposerRef } from '../message/MessageComposer';

import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';
import ClickToCopyContent from '../ClickToCopyContent';
import { DefaultImages, truncateAddress } from '../../utils';
import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { Button, Container, FlexRow, FlexColumn, FlexBetween, Text } from '../primitives';

const DirectMessage: React.FC<{}> = (p: {}) => {
  const { isDesktop, isMobile, isTablet, toggleLeftSidebar } =
    useResponsiveLayoutContext();
  
  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { messageDB, submitMessage, keyset } = useMessageDB();
  
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
  
  // Use business logic hooks for message handling
  const { messageList, acceptChat, fetchNextPage, fetchPreviousPage } = useDirectMessagesList();
  
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
  
  // Submit message function for MessageComposer
  const handleSubmitMessage = useCallback(async (message: string | object, inReplyTo?: string) => {
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
        inReplyTo
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
        inReplyTo
      );
    }
  }, [address, self, registration, queryClient, user, keyset, submitMessage]);

  // Use MessageComposer hook
  const composer = useMessageComposer({
    type: 'direct',
    onSubmitMessage: handleSubmitMessage,
    hasStickers: false, // DirectMessage doesn't have stickers
  });

  // Set sidebar content in context (exactly as original)
  React.useEffect(() => {
    console.log('DirectMessage members:', members); // Debug log
    console.log('Setting sidebar content, members count:', Object.keys(members).length);
    
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
    
    console.log('About to call setRightSidebarContent with:', sidebarContent);
    setRightSidebarContent(sidebarContent);
    console.log('setRightSidebarContent called');
  }, [members, user.currentPasskeyInfo, setRightSidebarContent]);

  // Clean up sidebar content when component unmounts
  React.useEffect(() => {
    return () => {
      setRightSidebarContent(null);
    };
  }, [setRightSidebarContent]);

  // Helper function to map sender to user (used by MessageList)
  const mapSenderToUser = useCallback((senderId: string) => {
    return (
      members[senderId] || {
        displayName: t`Unknown User`,
        userIcon: DefaultImages.UNKNOWN_USER,
      }
    );
  }, [members]);

  // Legacy submit function for MessageList compatibility
  const submit = useCallback(async (message: any) => {
    await handleSubmitMessage(message);
  }, [handleSubmitMessage]);

  const userIcon = otherUser.userIcon;
  const icon = userIcon?.includes(DefaultImages.UNKNOWN_USER)
    ? 'var(--unknown-icon)'
    : 'url(' + userIcon + ')';
  return (
    <div className="chat-container">
      <div className="flex flex-col">
        <div className="direct-message-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex flex-row items-center gap-2 lg:order-2 justify-between lg:justify-start mb-2 lg:mb-0">
            <div className="flex flex-row items-center gap-2">
              {(isMobile || isTablet) && (
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="w-6 h-6 p-2 !rounded-md cursor-pointer hover:bg-surface-6 flex items-center justify-center"
                  iconName="bars"
                  iconOnly
                />
              )}
              <GlobalSearch className="dm-search flex-1 lg:flex-none max-w-xs lg:max-w-none" />
            </div>
            <Button
              type="unstyled"
              onClick={() => {
                console.log('Users button clicked, showUsers was:', showUsers);
                setShowUsers(!showUsers);
                console.log('Users button clicked, showUsers now:', !showUsers);
              }}
              className="w-6 h-6 p-2 !rounded-md cursor-pointer hover:bg-surface-6 flex items-center justify-center [&_.quorum-button-icon-element]:text-sm"
              iconName="users"
              iconOnly
            />
          </div>
          <div className="flex-1 min-w-0 lg:order-1">
            <div className="flex flex-row items-center">
              <div className="flex flex-col justify-around">
                <div
                  className="w-[28px] h-[28px] bg-cover bg-center rounded-full"
                  style={{
                    backgroundImage: `${icon}`,
                  }}
                />
              </div>
              <div className="flex flex-row pl-2">
                <div className="flex flex-col justify-around font-semibold">
                  <span>{otherUser.displayName} |</span>
                </div>
                <div className="flex flex-col justify-around pl-1">
                  <div className="flex flex-row items-center">
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className={
            'message-list' + (!showUsers ? ' message-list-expanded' : '')
          }
        >
          <MessageList
            isRepudiable={true}
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
        </div>
        {/* Error and reply-to display */}
        {(composer.fileError || composer.inReplyTo) && (
          <Container className="flex flex-col w-full px-[11px]">
            {composer.fileError && (
              <Text className="text-sm text-danger ml-1 mt-3 mb-1">
                {composer.fileError}
              </Text>
            )}
            {composer.inReplyTo && (
              <FlexBetween
                onClick={() => composer.setInReplyTo(undefined)}
                className="rounded-t-lg px-4 cursor-pointer py-1 text-sm bg-surface-4"
              >
                <Text>
                  {i18n._('Replying to {user}', {
                    user: mapSenderToUser(composer.inReplyTo.content.senderId).displayName,
                  })}
                </Text>
                <Button
                  type="subtle"
                  size="small"
                  onClick={() => composer.setInReplyTo(undefined)}
                  iconName="x"
                  iconOnly
                  className="message-in-reply-dismiss"
                />
              </FlexBetween>
            )}
          </Container>
        )}

        {/* Accept chat warning */}
        {!acceptChat && (
          <FlexRow className="justify-center">
            <Container className="w-full px-3 py-2 mb-2 text-sm text-center rounded-lg bg-surface-4 text-subtle">
              {t`Until you reply, this sender will not see your display name or profile picture`}
            </Container>
          </FlexRow>
        )}

        {/* Message Composer */}
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
          onShowStickers={() => {}} // DirectMessage doesn't support stickers
          inReplyTo={composer.inReplyTo}
        />
      </div>

      {/* Desktop sidebar - content is managed by SidebarProvider */}
      <div
        className={
          'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-y-auto ' +
          'transition-transform duration-300 ease-in-out ' +
          (showUsers
            ? 'hidden lg:block translate-x-0 fixed top-0 right-0 h-full z-[10000] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
            : 'hidden')
        }
      >
        {rightSidebarContent}
      </div>
    </div>
  );
};

export default DirectMessage;
