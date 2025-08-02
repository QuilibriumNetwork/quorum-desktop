import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import './Channel.scss';
import { StickerMessage } from '../../api/quorumApi';
import { useChannelData, useChannelMessages, useMessageComposer } from '../../hooks';
import { useMessageDB } from '../context/MessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { MessageList } from '../message/MessageList';
import { t } from '@lingui/core/macro';
import ReactTooltip from '../ReactTooltip';
import { i18n } from '@lingui/core';
import { GlobalSearch } from '../search';
import { useResponsiveLayoutContext } from '../context/ResponsiveLayoutProvider';
import { useSidebar } from '../context/SidebarProvider';
import { Button, Icon, Container, FlexRow } from '../primitives';
import { MessageTextArea } from './MessageTextArea';
import { Buffer } from 'buffer';

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
  const queryClient = useQueryClient();
  const user = usePasskeysContext();
  const {
    showRightSidebar: showUsers,
    setShowRightSidebar: setShowUsers,
    setRightSidebarContent,
  } = useSidebar();
  const [init, setInit] = useState(false);
  const { submitChannelMessage } = useMessageDB();
  
  // Create a manual ref for the textarea (MessageList needs this for scrolling)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get channel data
  const {
    space,
    channel,
    members,
    activeMembers,
    roles,
    noRoleMembers,
    stickers,
    generateSidebarContent,
  } = useChannelData({ spaceId, channelId });

  // Get message handling
  const {
    messageList,
    fetchPreviousPage,
    canDeleteMessages,
    mapSenderToUser,
    isSpaceOwner,
  } = useChannelMessages({ spaceId, channelId, roles, members });

  // Handle message submission
  const handleSubmitMessage = useCallback(async (message: string | object, inReplyTo?: string) => {
    await submitChannelMessage(
      spaceId,
      channelId,
      message,
      queryClient,
      user.currentPasskeyInfo!,
      inReplyTo
    );
  }, [spaceId, channelId, submitChannelMessage, queryClient, user.currentPasskeyInfo]);

  // Handle sticker submission
  const handleSubmitSticker = useCallback(async (stickerId: string, inReplyTo?: string) => {
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
  }, [spaceId, channelId, submitChannelMessage, queryClient, user.currentPasskeyInfo]);

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
            <div className="font-semibold ml-[1pt] mb-1 text-xs">
              {section.title}
            </div>
            {section.members.map((member) => (
              <div
                key={member.address}
                className="w-full flex flex-row items-center mb-2"
              >
                <div
                  className="rounded-full w-[40px] h-[40px]"
                  style={{
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    backgroundImage: member.userIcon?.includes('var(--unknown-icon)')
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

  return (
    <div className="chat-container">
      <div className="flex flex-col">
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
        {(composer.fileError || composer.inReplyTo) && (
          <div className="flex flex-col w-full px-[11px]">
            {composer.fileError && (
              <div className="text-sm text-danger ml-1 mt-3 mb-1">
                {composer.fileError}
              </div>
            )}
            {composer.inReplyTo && (
              <div
                onClick={() => composer.setInReplyTo(undefined)}
                className="rounded-t-lg px-4 cursor-pointer py-1 text-sm flex flex-row justify-between bg-[var(--surface-4)]"
              >
                {i18n._('Replying to {user}', {
                  user: mapSenderToUser(composer.inReplyTo.content.senderId).displayName,
                })}
                <span
                  className="message-in-reply-dismiss"
                  onClick={() => composer.setInReplyTo(undefined)}
                >
                  ×
                </span>
              </div>
            )}
          </div>
        )}

        {composer.fileData && (
          <div className="mx-3 mt-2">
            <div className="p-2 relative rounded-lg bg-[rgba(0,0,0,0.2)] inline-block">
              <Button
                className="absolute p-1 px-2 m-1 bg-[rgba(0,0,0,0.6)] rounded-full"
                type="subtle"
                size="small"
                onClick={composer.clearFile}
              >
                <Icon name="x" size="xs" />
              </Button>
              <img
                style={{ maxWidth: 140, maxHeight: 140 }}
                src={
                  'data:' +
                  composer.fileType +
                  ';base64,' +
                  Buffer.from(composer.fileData).toString('base64')
                }
              />
            </div>
          </div>
        )}
        <div className="message-editor-container pr-6 lg:pr-8">
          <FlexRow
            className={
              'message-editor w-full items-center gap-2 ' +
              (composer.inReplyTo ? 'message-editor-reply' : '')
            }
          >
            <div {...composer.getRootProps()} data-tooltip-id="attach-image-tooltip">
              <input {...composer.getInputProps()} />
              <Button
                type="unstyled"
                onClick={() => {}} // onClick handled by dropzone
                className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
                iconName="plus"
                iconOnly
              />
            </div>
            <MessageTextArea
              value={composer.pendingMessage}
              onChange={composer.setPendingMessage}
              onKeyDown={composer.handleKeyDown}
              placeholder={i18n._('Send a message to #{channel_name}', {
                channel_name: channel?.channelName ?? '',
              })}
              calculateRows={composer.calculateRows}
            />
            <Button
              type="unstyled"
              className="hover:bg-surface-6 cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-surface-5 flex-shrink-0"
              onClick={() => {
                composer.setShowStickers(true);
              }}
              data-tooltip-id="add-sticker-tooltip"
              iconName="smile"
              iconOnly
            />
            <div
              className="hover:bg-accent-400 cursor-pointer w-8 h-8 rounded-full bg-accent bg-center bg-no-repeat bg-[url('/send.png')] bg-[length:60%] flex-shrink-0"
              onClick={() => {
                composer.submitMessage();
              }}
            />
          </FlexRow>
        </div>
      </div>

      {/* Desktop sidebar - only visible on lg+ screens */}
      <Container
        className={
          'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-y-auto ' +
          'transition-transform duration-300 ease-in-out ' +
          (showUsers
            ? 'hidden lg:block translate-x-0 fixed top-0 right-0 h-full z-[10000] lg:relative lg:top-auto lg:right-auto lg:h-auto lg:z-auto'
            : 'hidden')
        }
      >
        {generateSidebarContent().map((section) => (
          <div className="flex flex-col mb-2" key={section.title}>
            <div className="font-semibold ml-[1pt] mb-1 text-xs">
              {section.title}
            </div>
            {section.members.map((member) => (
              <div
                key={member.address}
                className="w-full flex flex-row items-center mb-2"
              >
                <div
                  className="rounded-full w-[40px] h-[40px]"
                  style={{
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    backgroundImage: member.userIcon?.includes('var(--unknown-icon)')
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
      </Container>

      <ReactTooltip
        id="attach-image-tooltip"
        content={t`attach image`}
        place="top"
      />
      <ReactTooltip
        id="add-sticker-tooltip"
        content={t`add sticker`}
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
            <Container className="flex flex-col border border-[var(--surface-5)] shadow-2xl w-[300px] h-[400px] rounded-lg bg-surface-4 pointer-events-auto">
              <div className="font-bold p-2 h-[40px] border-b border-b-[#272026]">
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
            </Container>
          </div>
        </>
      )}
    </div>
  );
};

export default Channel;