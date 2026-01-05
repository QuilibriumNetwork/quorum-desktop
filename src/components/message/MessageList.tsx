import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import { useLocation } from 'react-router-dom';
import { Message } from './Message';
import { DateSeparator } from './DateSeparator';
import { NewMessagesSeparator } from './NewMessagesSeparator';
import {
  Emoji,
  Message as MessageType,
  Role,
  Sticker,
  Channel,
} from '../../api/quorumApi';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import React from 'react';
import { DefaultImages } from '../../utils';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import { shouldShowDateSeparator, shouldShowCompactHeader } from '../../utils/messageGrouping';
import { useScrollTracking } from '../../hooks/ui/useScrollTracking';
import { Button } from '../primitives';
import { Trans } from '@lingui/react/macro';
import type { DmContext } from '../../hooks/business/messages/useMessageActions';

export interface MessageListRef {
  scrollToBottom: () => void;
  getVirtuosoRef: () => VirtuosoHandle | null;
}

interface MessageListProps {
  messageList: MessageType[];
  stickers?: { [stickerId: string]: Sticker };
  members: any;
  setInReplyTo: React.Dispatch<React.SetStateAction<MessageType | undefined>>;
  editor: React.RefObject<HTMLTextAreaElement | null>;
  submitMessage: (message: any) => Promise<void>;
  fetchPreviousPage: () => void;
  fetchNextPage: () => void;
  hasNextPage?: boolean;
  isSpaceOwner?: boolean;
  canDeleteMessages: (message: MessageType) => boolean;
  canPinMessages?: (message: MessageType) => boolean;
  channel?: Channel;
  customEmoji?: Emoji[];
  spaceName?: string;
  roles: Role[];
  isDeletionInProgress?: boolean;
  onUserClick?: (
    user: {
      address: string;
      displayName?: string;
      userIcon?: string;
    },
    event: React.MouseEvent,
    context?: { type: 'mention' | 'message-avatar'; element: HTMLElement }
  ) => void;
  onChannelClick?: (channelId: string) => void;
  spaceChannels?: Channel[];
  lastReadTimestamp?: number;
  onHashMessageNotFound?: (messageId: string) => Promise<void>;
  isLoadingHashMessage?: boolean;
  scrollToMessageId?: string; // For programmatic scrolling (e.g., auto-jump to first unread)
  newMessagesSeparator?: {
    firstUnreadMessageId: string;
    initialUnreadCount: number;
  } | null;
  onDismissSeparator?: () => void; // Callback when separator should be dismissed
  onRetryMessage?: (message: MessageType) => void;
  /** DM context for offline-resilient reactions/deletes/edits (optional - only for DMs) */
  dmContext?: DmContext;
}

function useWindowSize() {
  const [size, setSize] = React.useState([0, 0]);
  useLayoutEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }

    // Debounce resize to avoid recalculating Virtuoso overscan on every pixel
    function debouncedUpdate() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateSize, 150);
    }

    window.addEventListener('resize', debouncedUpdate);
    updateSize();
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedUpdate);
    };
  }, []);
  return size;
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  (props, ref) => {
    const {
      messageList,
      stickers,
      members,
      setInReplyTo,
      editor,
      submitMessage,
      fetchPreviousPage,
      fetchNextPage,
      hasNextPage,
      isSpaceOwner,
      canDeleteMessages,
      canPinMessages,
      channel,
      customEmoji,
      roles,
      isDeletionInProgress,
      onUserClick,
      onChannelClick,
      spaceChannels,
      lastReadTimestamp = 0,
      onHashMessageNotFound,
      isLoadingHashMessage,
      scrollToMessageId,
      newMessagesSeparator,
      onDismissSeparator,
      spaceName,
      onRetryMessage,
      dmContext,
    } = props;

    const [_width, height] = useWindowSize();
    const [hoverTarget, setHoverTarget] = useState<string>();
    const [emojiPickerOpen, setEmojiPickerOpen] = useState<string>();
    const [emojiPickerOpenDirection, setEmojiPickerOpenDirection] =
      useState<string>();
    const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ x: number; y: number } | null>(null);

    // Reset emoji picker position when picker closes
    useEffect(() => {
      if (!emojiPickerOpen) {
        setEmojiPickerPosition(null);
      }
    }, [emojiPickerOpen]);

    const virtuoso = useRef<VirtuosoHandle>(null);
    const [init, setInit] = useState(false);
    const location = useLocation();

    // Track if we've jumped to an old message via hash navigation
    // This disables auto-scroll during manual pagination
    const [hasJumpedToOldMessage, setHasJumpedToOldMessage] = useState(false);

    // Message highlighting context - replaces direct DOM manipulation
    const { highlightMessage, scrollToMessage } = useMessageHighlight();

    // Scroll tracking for jump to present button
    const { handleAtBottomStateChange, shouldShowJumpButton } =
      useScrollTracking({
        messageCount: messageList.length,
        minMessageCount: 10, // Only show button if there are at least 10 messages
      });

    // Track if separator has been visible (for dismissal logic via Virtuoso rangeChanged)
    const [separatorWasVisible, setSeparatorWasVisible] = useState(false);

    // Combined bottom state handler: manages both "Jump to Present" button and forward pagination
    const handleBottomStateChange = useCallback(
      (atBottom: boolean) => {
        // Update jump button visibility
        handleAtBottomStateChange(atBottom);

        // Fetch next page when scrolling to bottom (for loading newer messages after jumping to old message)
        if (atBottom && init) {
          fetchNextPage();
        }
      },
      [handleAtBottomStateChange, fetchNextPage, init]
    );

    // Jump to present handler
    const handleJumpToPresent = useCallback(() => {
      if (virtuoso.current && messageList.length > 0) {
        virtuoso.current.scrollToIndex({
          index: messageList.length - 1,
          align: 'end',
          behavior: 'auto',
        });
        // Re-enable auto-scroll when user explicitly jumps to present
        setHasJumpedToOldMessage(false);
      }
    }, [messageList.length]);

    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        if (virtuoso.current && messageList.length > 0) {
          virtuoso.current.scrollToIndex({
            index: messageList.length - 1,
            align: 'end',
            behavior: 'auto',
          });
        }
      },
      getVirtuosoRef: () => virtuoso.current,
    }));

    const mapSenderToUser = useCallback(
      (senderId: string) => {
        const member = members[senderId];
        if (member) {
          return {
            ...member,
            displayName: member.displayName || senderId.slice(-6),
          };
        }
        return {
          displayName: senderId?.slice(-6) || 'Unknown User',
          userIcon: DefaultImages.UNKNOWN_USER,
        };
      },
      [members]
    );

    // Memoize message display info (date separators, new messages separators, compact headers)
    // Two-pass calculation: first compute isCompact, then derive hasCompactBelow
    const messageDisplayInfo = useMemo(() => {
      // First pass: calculate basic display info
      const info = messageList.map((message, index) => {
        const previousMessage = index > 0 ? messageList[index - 1] : null;
        const needsDateSeparator = shouldShowDateSeparator(message, previousMessage);
        const needsNewMessagesSeparator = newMessagesSeparator &&
          message.messageId === newMessagesSeparator.firstUnreadMessageId;
        const isCompact = shouldShowCompactHeader(
          message, previousMessage, needsDateSeparator, !!needsNewMessagesSeparator
        );
        return { needsDateSeparator, needsNewMessagesSeparator, isCompact, hasCompactBelow: false };
      });
      // Second pass: set hasCompactBelow based on next message
      for (let i = 0; i < info.length - 1; i++) {
        info[i].hasCompactBelow = info[i + 1].isCompact;
      }
      return info;
    }, [messageList, newMessagesSeparator]);

    const rowRenderer = useCallback(
      (index: number) => {
        const message = messageList[index];
        const displayInfo = messageDisplayInfo[index];

        return (
          <React.Fragment>
            {displayInfo.needsDateSeparator && (
              <DateSeparator
                timestamp={message.createdDate}
                className="message-date-separator"
              />
            )}
            {displayInfo.needsNewMessagesSeparator && <NewMessagesSeparator />}
            <Message
              senderRoles={roles}
              spaceRoles={roles}
              stickers={stickers}
              emojiPickerOpen={emojiPickerOpen}
              setEmojiPickerOpen={setEmojiPickerOpen}
              emojiPickerOpenDirection={emojiPickerOpenDirection}
              setEmojiPickerOpenDirection={setEmojiPickerOpenDirection}
              emojiPickerPosition={emojiPickerPosition}
              setEmojiPickerPosition={setEmojiPickerPosition}
              message={message}
              customEmoji={customEmoji}
              messageList={messageList}
              virtuosoRef={virtuoso.current}
              mapSenderToUser={mapSenderToUser}
              hoverTarget={hoverTarget}
              setHoverTarget={setHoverTarget}
              setInReplyTo={setInReplyTo}
              editorRef={editor.current}
              height={height}
              canEditRoles={isSpaceOwner}
              canDeleteMessages={canDeleteMessages(message)}
              canPinMessages={
                canPinMessages ? canPinMessages(message) : undefined
              }
              channel={channel}
              submitMessage={submitMessage}
              onUserClick={onUserClick}
              onChannelClick={onChannelClick}
              spaceChannels={spaceChannels}
              lastReadTimestamp={lastReadTimestamp}
              spaceName={spaceName}
              onRetryMessage={onRetryMessage}
              dmContext={dmContext}
              isCompact={displayInfo.isCompact}
              hasCompactBelow={displayInfo.hasCompactBelow}
            />
          </React.Fragment>
        );
      },
      [
        messageList,
        messageDisplayInfo,
        roles,
        stickers,
        emojiPickerOpen,
        setEmojiPickerOpen,
        emojiPickerOpenDirection,
        setEmojiPickerOpenDirection,
        emojiPickerPosition,
        setEmojiPickerPosition,
        customEmoji,
        mapSenderToUser,
        hoverTarget,
        setHoverTarget,
        setInReplyTo,
        editor,
        height,
        isSpaceOwner,
        canDeleteMessages,
        canPinMessages,
        channel,
        submitMessage,
        onUserClick,
        onChannelClick,
        spaceChannels,
        lastReadTimestamp,
        spaceName,
        onRetryMessage,
        dmContext,
      ]
    );

    useEffect(() => {
      if (!init) {
        setTimeout(() => setInit(true), 200);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track if we've already processed a hash navigation to prevent re-navigation on messageList changes
    const [hasProcessedHash, setHasProcessedHash] = useState(false);
    const [hasProcessedScrollTo, setHasProcessedScrollTo] = useState(false);

    useEffect(() => {
      if (!init || messageList.length === 0) return;

      // Capture hash but delay removal to allow Message components to detect it
      const hash = location.hash;
      if (hash.startsWith('#msg-') && !hasProcessedHash) {
        const msgId = hash.replace('#msg-', '');
        const index = messageList.findIndex((m) => m.messageId === msgId);
        if (index !== -1) {
          // Mark that we've processed this hash navigation
          setHasProcessedHash(true);

          // Use the React state-based highlighting system instead of DOM manipulation
          setTimeout(() => {
            // Scroll using the centralized scroll function
            scrollToMessage(msgId, virtuoso.current, messageList);

            // Highlight using React state (this will trigger re-render with highlight class)
            highlightMessage(msgId, { duration: 8000 }); // Match CSS animation duration (8s)
          }, 200);

          // Remove hash after highlight animation completes (8s matches CSS animation)
          setTimeout(() => {
            history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            );
          }, 8000);
        } else {
          // Message not found in current list
          if (onHashMessageNotFound && !hasProcessedHash) {
            setHasProcessedHash(true); // Prevent multiple calls
            setHasJumpedToOldMessage(true); // Disable auto-scroll during pagination
            onHashMessageNotFound(msgId).catch((error) => {
              console.error('Failed to load hash message:', error);
              // Hash will be removed by parent's error handling
            });
          } else if (!onHashMessageNotFound) {
            // Fallback: silently mark as processed if no callback provided
            setHasProcessedHash(true);
            setTimeout(() => {
              history.replaceState(
                null,
                '',
                window.location.pathname + window.location.search
              );
            }, 100);
          }
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasProcessedHash intentionally excluded to prevent infinite loops
    }, [init, location.hash, scrollToMessage, highlightMessage, messageList, onHashMessageNotFound]);

    // Handle programmatic scrollToMessageId (e.g., auto-jump to first unread)
    useEffect(() => {
      if (!init || messageList.length === 0 || !scrollToMessageId) return;

      // Only process once per scrollToMessageId
      if (!hasProcessedScrollTo) {
        const index = messageList.findIndex(
          (m) => m.messageId === scrollToMessageId
        );

        if (index !== -1) {
          setHasProcessedScrollTo(true);
          setHasJumpedToOldMessage(true); // Disable auto-scroll during pagination

          // Scroll to the message (no highlight - unread line is shown via lastReadTimestamp)
          setTimeout(() => {
            scrollToMessage(scrollToMessageId, virtuoso.current, messageList);
          }, 200);
        }
      }
    }, [
      init,
      messageList,
      scrollToMessageId,
      hasProcessedScrollTo,
      scrollToMessage,
    ]);

    // Reset scrollTo processing flag when scrollToMessageId changes
    useEffect(() => {
      setHasProcessedScrollTo(false);
    }, [scrollToMessageId]);

    // Reset hash processing flag when location.hash changes to a new value
    useEffect(() => {
      if (location.hash.startsWith('#msg-')) {
        setHasProcessedHash(false);
      }
    }, [location.hash]);

    // Reset jump flag when navigating to a different channel
    useEffect(() => {
      setHasJumpedToOldMessage(false);
    }, [location.pathname]);

    // Automatically reset jump flag when reaching the present (no more pages to load forward)
    useEffect(() => {
      if (hasJumpedToOldMessage && hasNextPage === false) {
        setHasJumpedToOldMessage(false);
      }
    }, [hasJumpedToOldMessage, hasNextPage]);

    // Reset separator visibility tracking when separator changes
    useEffect(() => {
      if (!newMessagesSeparator) {
        setSeparatorWasVisible(false);
      }
    }, [newMessagesSeparator]);

    // Memoize firstUnreadIndex to avoid O(n) search on every scroll event
    // This moves the expensive findIndex out of the scroll callback
    const firstUnreadIndex = useMemo(() => {
      if (!newMessagesSeparator?.firstUnreadMessageId) return -1;
      return messageList.findIndex(
        (m) => m.messageId === newMessagesSeparator.firstUnreadMessageId
      );
    }, [messageList, newMessagesSeparator?.firstUnreadMessageId]);

    // Handle separator dismissal via Virtuoso's rangeChanged callback
    const handleRangeChanged = useCallback(
      (range: { startIndex: number; endIndex: number }) => {
        if (firstUnreadIndex === -1 || !onDismissSeparator) {
          return;
        }

        const isVisible =
          firstUnreadIndex >= range.startIndex &&
          firstUnreadIndex <= range.endIndex;

        if (isVisible && !separatorWasVisible) {
          // First time separator becomes visible
          setSeparatorWasVisible(true);
        } else if (!isVisible && separatorWasVisible) {
          // Separator scrolled out of view - dismiss it
          onDismissSeparator();
        }
      },
      [firstUnreadIndex, onDismissSeparator, separatorWasVisible]
    );

    // Stable computeItemKey to prevent unnecessary re-mounts
    const computeItemKey = React.useCallback(
      (index: number) => {
        const message = messageList[index];
        return message?.messageId || `fallback-${index}`;
      },
      [messageList]
    );

    return (
      <>
        <Virtuoso
          ref={virtuoso}
          className="scrollbar-message-list"
          style={{ position: 'relative' }}
          overscan={{ main: height, reverse: height }}
          increaseViewportBy={{ top: height, bottom: height }}
          atTopThreshold={0}
          atTopStateChange={(atTop) => {
            if (!init) {
              return;
            }
            if (atTop) {
              fetchPreviousPage();
            }
          }}
          atBottomThreshold={5000}
          atBottomStateChange={handleBottomStateChange}
          alignToBottom={true}
          firstItemIndex={0}
          initialTopMostItemIndex={
            window.location.hash && window.location.hash.startsWith('#msg-')
              ? 0 // scroll to top initially, will override with scrollToIndex()
              : messageList.length - 1
          }
          followOutput={(isAtBottom: boolean) => {
            // Don't auto-scroll during deletions, even if user is at bottom
            if (isDeletionInProgress) {
              return false;
            }
            // Don't auto-scroll after jumping to old message (prevents scroll during manual pagination)
            // Only auto-scroll when at the true present (hasNextPage === false)
            if (hasJumpedToOldMessage) {
              return false;
            }
            // Only auto-scroll if we're at bottom AND at the true present (no more pages to load)
            if (isAtBottom && hasNextPage === false) {
              return 'smooth';
            }
            return false;
          }}
          totalCount={messageList.length}
          computeItemKey={computeItemKey}
          itemContent={rowRenderer}
          rangeChanged={handleRangeChanged}
          components={{
            Footer: () => <div className="message-list-bottom-spacer" />,
          }}
        />

        {/* Jump to Present Button */}
        {shouldShowJumpButton && (
          <div className="absolute bottom-6 right-6 z-50 bg-chat rounded-full transition-all duration-300">
            <Button
              type="secondary"
              onClick={handleJumpToPresent}
              className="shadow-lg"
            >
              <Trans>Jump to present</Trans>
            </Button>
          </div>
        )}

        {/* Loading Hash Message Indicator */}
        {isLoadingHashMessage && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-chat-overlay rounded-lg p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              <span className="text-sm text-primary">
                <Trans>Loading message...</Trans>
              </span>
            </div>
          </div>
        )}
      </>
    );
  }
);
