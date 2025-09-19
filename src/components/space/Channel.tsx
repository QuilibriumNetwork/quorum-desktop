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
import { Button, Tooltip, Icon, Input } from '../primitives';
import { getIconColorHex } from './IconPicker/types';
import MessageComposer, {
  MessageComposerRef,
} from '../message/MessageComposer';
import { PinnedMessagesPanel } from '../message/PinnedMessagesPanel';
import { Virtuoso } from 'react-virtuoso';
import UserProfile from '../user/UserProfile';
import type { Channel, Role } from '../../api/quorumApi';

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
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    address: string;
    displayName?: string;
    userIcon?: string;
  } | null>(null);
  const [modalPosition, setModalPosition] = useState<{ top: number } | null>(null);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const headerRef = React.useRef<HTMLDivElement>(null);
  const { submitChannelMessage } = useMessageDB();

  // Create refs for textarea (MessageList needs this for scrolling and we need it for focus)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageComposerRef = useRef<MessageComposerRef>(null);
  const messageListRef = useRef<MessageListRef>(null);

  // Get channel data
  const { space, channel, members, roles, stickers, generateSidebarContent, generateVirtualizedUserList } =
    useChannelData({ spaceId, channelId });

  // Get message handling
  const {
    messageList,
    fetchPreviousPage,
    canDeleteMessages,
    canPinMessages,
    mapSenderToUser,
    isSpaceOwner,
  } = useChannelMessages({ spaceId, channelId, roles, members, channel });

  // Get pinned messages
  const { pinnedCount } = usePinnedMessages(spaceId, channelId, channel);

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

  // Handle user profile click in sidebar
  const handleUserProfileClick = useCallback((user: {
    address: string;
    displayName?: string;
    userIcon?: string;
  }, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent background click from closing modal
    
    const rect = event.currentTarget.getBoundingClientRect();
    setModalPosition({ top: rect.top });
    setSelectedUser(user);
    setShowUserProfile(true);
  }, []);

  // Handle user profile modal close
  const handleUserProfileClose = useCallback(() => {
    setShowUserProfile(false);
    setSelectedUser(null);
    setModalPosition(null);
  }, []);

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
      filteredSections = sections.map(section => ({
        ...section,
        members: section.members.filter(member =>
          member.displayName?.toLowerCase().includes(term) ||
          member.address?.toLowerCase().includes(term)
        )
      })).filter(section => section.members.length > 0);
    }

    const sidebarContent = (
      <>
        {/* Mobile Search Input */}
        <div className="sticky top-0 z-10" style={{ backgroundColor: 'inherit' }}>
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
              className={searchFocused ? "text-accent" : "text-subtle"}
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
              <div className="mb-3 text-xs pb-1 border-b border-default px-3 pt-3">
                {section.title}
              </div>
              {section.members.map((member) => (
                <div
                  key={member.address}
                  className="w-full flex flex-row items-center mb-2 px-3 cursor-pointer hover:bg-surface-2 rounded-md py-1 transition-colors duration-150"
                  onClick={(event) => handleUserProfileClick({
                    address: member.address,
                    displayName: member.displayName,
                    userIcon: member.userIcon,
                  }, event)}
                >
                  <div
                    className="rounded-full w-[30px] h-[30px] opacity-80"
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
  }, [generateSidebarContent, setRightSidebarContent, searchInput, activeSearch, handleUserProfileClick]);

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
            {/* Burger menu for mobile only */}
            {!isDesktop && (
              <Button
                type="unstyled"
                onClick={toggleLeftSidebar}
                className="header-icon-button lg:hidden"
                iconName="bars"
                iconOnly
              />
            )}

            {/* Channel name - hidden on mobile first row, shown on desktop */}
            <div className="hidden lg:flex flex-1 min-w-0">
              <div className="flex items-center gap-2 truncate whitespace-nowrap overflow-hidden">
                <Icon
                  name={iconName as any}
                  size="sm"
                  className="flex-shrink-0"
                  color={iconColor}
                  style={!iconColor ? { color: 'var(--color-text-subtle)' } : undefined}
                />
                <span className="text-main font-medium flex-shrink truncate">
                  {channel?.channelName}
                </span>
                {channel?.channelTopic && (
                  <>
                    <span className="text-subtle flex-shrink-0">|</span>
                    <span className="text-subtle font-light text-sm flex-shrink truncate">
                      {channel.channelTopic}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Controls - right side on both mobile and desktop */}
            <div className="flex flex-row items-center gap-2">
              {pinnedCount > 0 && (
                <div className="relative">
                  <Tooltip
                    id={`pinned-messages-${channelId}`}
                    content={t`Pinned Messages`}
                    showOnTouch={false}
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
                    channel={channel}
                    mapSenderToUser={mapSenderToUser}
                    virtuosoRef={messageListRef.current?.getVirtuosoRef()}
                    messageList={messageList}
                    stickers={stickers}
                  />
                </div>
              )}
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
                  iconOnly
                />
              </Tooltip>
              <GlobalSearch className="channel-search ml-2" />
            </div>
          </div>

          {/* Second row on mobile: channel name / Hidden on desktop (shown above) */}
          <div className="w-full lg:hidden">
            <div className="flex items-center gap-2 truncate whitespace-nowrap overflow-hidden">
              <Icon
                name={iconName as any}
                size="sm"
                className="flex-shrink-0"
                color={iconColor}
                style={!iconColor ? { color: 'var(--color-text-subtle)' } : undefined}
              />
              <span className="text-main font-medium flex-shrink truncate">
                {channel?.channelName}
              </span>
              {channel?.channelTopic && (
                <>
                  <span className="text-subtle flex-shrink-0">|</span>
                  <span className="text-subtle font-light text-sm flex-shrink truncate">
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
                'message-list' + (!showUsers ? ' message-list-expanded' : '')
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
                    className={searchFocused ? "text-accent" : "text-muted"}
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
                  {activeSearch && generateVirtualizedUserList(activeSearch).length === 0 && (
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
                        <div className="mb-3 text-xs pb-1 border-b border-default">
                          {item.title}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="px-4 pb-2">
                        <div
                          className="w-full flex flex-row items-center cursor-pointer hover:bg-surface-2 rounded-md p-1 -m-1 transition-colors duration-150 group"
                          onClick={(event) => handleUserProfileClick({
                            address: item.address,
                            displayName: item.displayName,
                            userIcon: item.userIcon,
                          }, event)}
                        >
                          <div
                            className="rounded-full w-[30px] h-[30px] opacity-80 group-hover:opacity-100 transition-opacity duration-150"
                            style={{
                              backgroundPosition: 'center',
                              backgroundSize: 'cover',
                              backgroundImage: item.userIcon?.includes(
                                'var(--unknown-icon)'
                              )
                                ? item.userIcon
                                : `url(${item.userIcon})`,
                            }}
                          />
                          <div className="flex flex-col ml-2 text-subtle group-hover:text-main transition-colors duration-150">
                            <span className="text-md font-bold">
                              {item.displayName}
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

      {/* User Profile Modal - desktop only (≥1024px) */}
      {showUserProfile && selectedUser && modalPosition && window.innerWidth >= 1024 && (
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
              top: `${modalPosition.top}px`,
              left: showUsers ? `calc(100vw - 260px - 320px)` : `calc(100vw - 320px)`,
            }}
          >
            <div className="pointer-events-auto">
              <UserProfile
                key={selectedUser.address}
                spaceId={spaceId}
                canEditRoles={isSpaceOwner}
                kickUserAddress={kickUserAddress}
                setKickUserAddress={setKickUserAddress}
                roles={roles || []}
                user={selectedUser}
                dismiss={handleUserProfileClose}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Channel;
