import React, { useEffect, useState, useCallback, useRef } from 'react';
import './Channel.scss';
import { StickerMessage } from '../../api/quorumApi';
import {
  useChannelData,
  useChannelMessages,
  useMessageComposer,
  usePinnedMessages,
} from '../../hooks';
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
import { Button, Icon, Tooltip } from '../primitives';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';
import { PinnedMessagesPanel } from '../message/PinnedMessagesPanel';

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
  const [skipSigning, setSkipSigning] = useState<boolean>(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
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

  // Get pinned messages
  const { pinnedCount } = usePinnedMessages(spaceId, channelId);

  // Handle message submission
  const handleSubmitMessage = useCallback(
    async (message: string | object, inReplyTo?: string) => {
      const effectiveSkip = space?.isRepudiable ? skipSigning : false;
      await submitChannelMessage(
        spaceId,
        channelId,
        message,
        queryClient,
        user.currentPasskeyInfo!,
        inReplyTo,
        effectiveSkip
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
      space,
      skipSigning,
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
        inReplyTo,
        false // Stickers are always signed
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
        {/* Header - full width at top */}
        <div className="channel-name border-b mt-[8px] pb-[8px] mx-[11px] lg:mx-4 text-main flex flex-col lg:flex-row lg:justify-between lg:items-center">
          {/* Mobile layout - keep original structure */}
          <div className="flex flex-row items-center gap-2 justify-between mb-2 lg:hidden">
            <div className="flex flex-row items-center gap-2">
              {!isDesktop && (
                <Button
                  type="unstyled"
                  onClick={toggleLeftSidebar}
                  className="header-icon-button"
                  iconName="bars"
                  iconOnly
                />
              )}
              <GlobalSearch className="channel-search flex-1" />
            </div>
            <div className="flex flex-row items-center gap-2">
              {pinnedCount > 0 && (
                <div className="relative">
                  <Tooltip
                    id={`pinned-messages-${channelId}`}
                    content={t`Pinned Messages`}
                  >
                    <Button
                      type="unstyled"
                      onClick={() => {
                        setShowPinnedMessages(true);
                      }}
                      className="relative header-icon-button"
                      iconName="thumbtack"
                      iconOnly
                    >
                      <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {pinnedCount > 9 ? '9+' : pinnedCount}
                      </span>
                    </Button>
                  </Tooltip>
                  
                  {/* Pinned Messages Panel */}
                  <PinnedMessagesPanel
                    isOpen={showPinnedMessages}
                    onClose={() => setShowPinnedMessages(false)}
                    spaceId={spaceId}
                    channelId={channelId}
                    mapSenderToUser={mapSenderToUser}
                  />
                </div>
              )}
              <Button
                type="unstyled"
                onClick={() => {
                  setShowUsers(!showUsers);
                }}
                className="header-icon-button"
                iconName="users"
                iconOnly
              />
            </div>
          </div>

          {/* Channel name/topic - order-1 on desktop */}
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

          {/* Desktop controls - right aligned, order-2 */}
          <div className="hidden lg:flex flex-row items-center gap-2 lg:order-2">
            {pinnedCount > 0 && (
              <div className="relative">
                <Tooltip
                  id={`pinned-messages-${channelId}`}
                  content={t`Pinned Messages`}
                >
                  <Button
                    type="unstyled"
                    onClick={() => {
                      setShowPinnedMessages(true);
                    }}
                    className="relative header-icon-button"
                    iconName="thumbtack"
                    iconOnly
                  >
                    <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                      {pinnedCount > 9 ? '9+' : pinnedCount}
                    </span>
                  </Button>
                </Tooltip>
                
                {/* Pinned Messages Panel */}
                <PinnedMessagesPanel
                  isOpen={showPinnedMessages}
                  onClose={() => setShowPinnedMessages(false)}
                  spaceId={spaceId}
                  channelId={channelId}
                  mapSenderToUser={mapSenderToUser}
                />
              </div>
            )}
            <Button
              type="unstyled"
              onClick={() => {
                setShowUsers(!showUsers);
              }}
              className="header-icon-button"
              iconName="users"
              iconOnly
            />
            <GlobalSearch className="channel-search ml-4" />
          </div>
        </div>

        {/* Content area - flex container for messages and sidebar */}
        <div className="flex flex-1 relative">
          {/* Messages and composer area */}
          <div className="flex flex-col flex-1">
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
                fileData={composer.fileData}
                fileType={composer.fileType}
                clearFile={composer.clearFile}
                onSubmitMessage={composer.submitMessage}
                onShowStickers={() => composer.setShowStickers(true)}
                inReplyTo={composer.inReplyTo}
                fileError={composer.fileError}
                mapSenderToUser={mapSenderToUser}
                setInReplyTo={composer.setInReplyTo}
                showSigningToggle={space?.isRepudiable}
                skipSigning={skipSigning}
                onSigningToggle={() => setSkipSigning(!skipSigning)}
              />
            </div>
          </div>

          {/* Desktop sidebar - positioned in content area */}
          {showUsers && (
            <div className="hidden lg:block w-[260px] bg-chat border-l border-default overflow-y-auto flex-shrink-0">
              {generateSidebarContent().map((section) => (
                <div className="flex flex-col mb-2 p-4" key={section.title}>
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
          )}
        </div>
      </div>

      {/* Mobile sidebar - overlay */}
      {showUsers && (
        <div className="lg:hidden fixed top-0 right-0 h-full w-[260px] bg-mobile-sidebar overflow-y-auto z-[10000] transition-all duration-300 ease-in-out">
          {generateSidebarContent().map((section) => (
            <div className="flex flex-col mb-2 p-4" key={section.title}>
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
      )}
      
      <Tooltip
        id="toggle-signing-tooltip"
        content={skipSigning ? 'This message will NOT be signed' : 'This message will be signed'}
        place="top"
      />


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
