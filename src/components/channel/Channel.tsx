import React, { useEffect, useState, useCallback, useRef } from 'react';
import './Channel.scss';
import { StickerMessage } from '../../api/quorumApi';
import {
  useChannelData,
  useChannelMessages,
  useMessageComposer,
} from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageList, MessageListRef } from '../message/MessageList';
import { i18n } from '@lingui/core';
import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useSidebar } from '../context/SidebarProvider';
import { useModals } from '../context/ModalProvider';
import { Button, Icon } from '../primitives';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';

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
  const { isDesktop, toggleLeftSidebar } = useResponsiveLayoutContext();
  const { openKickUser } = useModals();
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const {
    showRightSidebar: showUsers,
    setShowRightSidebar: setShowUsers,
    setRightSidebarContent,
  } = useSidebar();
  const [init, setInit] = useState(false);
  const { submitChannelMessage } = useMessageDB();

  // Create refs for textarea (MessageList needs this for scrolling and we need it for focus)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const messageListRef = useRef<MessageListRef>(null);

  // Get channel data
  const { space, channel, members, roles, stickers, generateSidebarContent } =
    useChannelData({ spaceId, channelId });

  // Get message handling
  const {
    messageList,
    fetchPreviousPage,
    canDeleteMessages,
    mapSenderToUser,
    isSpaceOwner,
  } = useChannelMessages({ spaceId, channelId, roles, members });

  // Handle message submission
  const handleSubmitMessage = useCallback(
    async (message: string | object, inReplyTo?: string) => {
      await submitChannelMessage(
        spaceId,
        channelId,
        message,
        queryClient,
        user.currentPasskeyInfo!,
        inReplyTo
      );

      // Only auto-scroll for actual messages (text/embed), not reactions
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
    [
      spaceId,
      channelId,
      submitChannelMessage,
      queryClient,
      user.currentPasskeyInfo,
    ]
  );

  // Handle sticker submission
  const handleSubmitSticker = useCallback(
    async (stickerId: string, inReplyTo?: string) => {
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
        inReplyTo
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
    ]
  );

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

  // Set sidebar content in context
  React.useEffect(() => {
    const sections = generateSidebarContent();
    const sidebarContent = (
      <>
        {sections.map((section) => (
          <div className="flex flex-col mb-2" key={section.title}>
            <div className="font-semibold ml-[1pt] mb-3 text-xs pb-1 border-b border-default">
              {section.title}
            </div>
            {section.members.map((member) => (
              <div
                key={member.address}
                className="w-full flex flex-row items-center mb-2"
              >
                <div
                  className="rounded-full w-[30px] h-[30px]"
                  style={{
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    backgroundImage: member.userIcon?.includes(
                      'var(--unknown-icon)'
                    )
                      ? member.userIcon
                      : `url(${member.userIcon})`,
                  }}
                />
                <div className="flex flex-col ml-2 text-main">
                  <span className="text-md font-bold">
                    {member.displayName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </>
    );
    setRightSidebarContent(sidebarContent);
  }, [generateSidebarContent, setRightSidebarContent]);

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

  // Handle kick user modal opening
  React.useEffect(() => {
    if (kickUserAddress) {
      openKickUser(kickUserAddress);
      setKickUserAddress(undefined); // Clear local state immediately
    }
  }, [kickUserAddress, openKickUser, setKickUserAddress]);

  return (
    <div className="chat-container">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="channel-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          <div className="flex flex-row items-center gap-2 lg:order-2 justify-between lg:justify-start mb-2 lg:mb-0">
            <div className="flex flex-row items-center gap-2">
              {!isDesktop && (
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="w-6 h-6 p-2 !rounded-md cursor-pointer hover:bg-surface-6 flex items-center justify-center"
                  iconName="bars"
                  iconOnly
                />
              )}
              <GlobalSearch className="channel-search flex-1 lg:flex-none max-w-xs lg:max-w-none" />
            </div>
            <Button
              type="unstyled"
              onClick={() => {
                setShowUsers(!showUsers);
              }}
              className="w-6 h-6 p-2 !rounded-md cursor-pointer hover:bg-surface-6 flex items-center justify-center [&_.quorum-button-icon-element]:text-sm"
              iconName="users"
              iconOnly
            />
          </div>
          <div className="flex-1 min-w-0 lg:order-1">
            <div className="truncate">
              <span>
                #{channel?.channelName}
                {channel?.channelTopic && ' | '}
              </span>
              <span className="font-light text-sm">
                {channel?.channelTopic}
              </span>
            </div>
          </div>
        </div>
        <div
          className={
            'message-list' + (!showUsers ? ' message-list-expanded' : '')
          }
        >
          <MessageList
            ref={messageListRef}
            isRepudiable={space?.isRepudiable}
            stickers={stickers}
            roles={roles}
            canDeleteMessages={canDeleteMessages}
            isSpaceOwner={isSpaceOwner}
            editor={textareaRef}
            messageList={messageList}
            setInReplyTo={composer.setInReplyTo}
            customEmoji={space?.emojis}
            members={members}
            submitMessage={handleSubmitMessage}
            kickUserAddress={kickUserAddress}
            setKickUserAddress={setKickUserAddress}
            fetchPreviousPage={() => {
              fetchPreviousPage();
            }}
          />
        </div>

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
          fileData={composer.fileData}
          fileType={composer.fileType}
          clearFile={composer.clearFile}
          onSubmitMessage={composer.submitMessage}
          onShowStickers={() => composer.setShowStickers(true)}
          inReplyTo={composer.inReplyTo}
          fileError={composer.fileError}
          mapSenderToUser={mapSenderToUser}
          setInReplyTo={composer.setInReplyTo}
        />
      </div>

      {/* Desktop sidebar - only visible on lg+ screens */}
      <div
        className={
          'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-y-auto flex-shrink-0 ' +
          'transition-all duration-300 ease-in-out ' +
          (showUsers
            ? 'hidden lg:block fixed top-0 right-0 h-full z-[10000] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
            : 'hidden')
        }
      >
        {generateSidebarContent().map((section) => (
          <div className="flex flex-col mb-2" key={section.title}>
            <div className="font-semibold ml-[1pt] mb-3 text-xs pb-1 border-b border-default">
              {section.title}
            </div>
            {section.members.map((member) => (
              <div
                key={member.address}
                className="w-full flex flex-row items-center mb-2"
              >
                <div
                  className="rounded-full w-[30px] h-[30px]"
                  style={{
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    backgroundImage: member.userIcon?.includes(
                      'var(--unknown-icon)'
                    )
                      ? member.userIcon
                      : `url(${member.userIcon})`,
                  }}
                />
                <div className="flex flex-col ml-2 text-main">
                  <span className="text-md font-bold">
                    {member.displayName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Stickers panel - positioned at top level to avoid stacking context issues */}
      {composer.showStickers && (
        <>
          <div
            className="fixed inset-0 top-16 z-[9990]"
            onClick={() => composer.setShowStickers(false)}
          />
          <div
            className={`fixed bottom-20 z-[9999] pointer-events-none ${showUsers ? 'right-[300px]' : 'right-6'} transition-all duration-300`}
          >
            <div className="flex flex-col border border-surface-5 shadow-2xl w-[300px] h-[400px] rounded-lg bg-surface-4 pointer-events-auto">
              <div className="font-bold p-2 h-[40px] border-b border-surface-5">
                Stickers
              </div>
              <div className="grid grid-cols-3 auto-rows-min gap-1 w-[300px] p-4 overflow-y-auto max-h-[359px]">
                {space?.stickers.map((s) => {
                  return (
                    <Button
                      key={'sticker-' + s.id}
                      className="flex justify-center items-center w-[80px] h-[80px] hover:bg-surface-6 hover:scale-105 transition-all duration-200 rounded-lg p-1 bg-surface-3"
                      onClick={() => {
                        composer.submitSticker(s.id);
                      }}
                      type="subtle"
                    >
                      <img
                        src={s.imgUrl}
                        className="max-w-full max-h-full object-contain rounded-md"
                        alt="sticker"
                      />
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Channel;
