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
import * as moment from 'moment-timezone';
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
import { shouldShowDateSeparator } from '../../utils/messageGrouping';
import { useScrollTracking } from '../../hooks/ui/useScrollTracking';
import { Button } from '../primitives';
import { Trans } from '@lingui/react/macro';

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
  isRepudiable?: boolean;
  roles: Role[];
  kickUserAddress?: string;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
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
  lastReadTimestamp?: number;
  onHashMessageNotFound?: (messageId: string) => Promise<void>;
  isLoadingHashMessage?: boolean;
  scrollToMessageId?: string; // For programmatic scrolling (e.g., auto-jump to first unread)
  newMessagesSeparator?: {
    firstUnreadMessageId: string;
    initialUnreadCount: number;
  } | null;
  onDismissSeparator?: () => void; // Callback when separator should be dismissed
}

function useWindowSize() {
  const [size, setSize] = React.useState([0, 0]);
  useLayoutEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
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
      isRepudiable,
      roles,
      kickUserAddress,
      setKickUserAddress,
      isDeletionInProgress,
      onUserClick,
      lastReadTimestamp = 0,
      onHashMessageNotFound,
      isLoadingHashMessage,
      scrollToMessageId,
      newMessagesSeparator,
      onDismissSeparator,
    } = props;

    const [width, height] = useWindowSize();
    const [hoverTarget, setHoverTarget] = useState<string>();
    const [emojiPickerOpen, setEmojiPickerOpen] = useState<string>();
    const [emojiPickerOpenDirection, setEmojiPickerOpenDirection] =
      useState<string>();
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
        return (
          members[senderId] || {
            displayName: 'Unknown User',
            userIcon: DefaultImages.UNKNOWN_USER,
          }
        );
      },
      [members]
    );

    const rowRenderer = useCallback(
      (index: number) => {
        const message = messageList[index];
        const previousMessage = index > 0 ? messageList[index - 1] : null;

        // Check if we need a date separator before this message
        const needsDateSeparator = shouldShowDateSeparator(
          message,
          previousMessage
        );

        // Check if we need to show the "New Messages" separator before this message
        const needsNewMessagesSeparator =
          newMessagesSeparator &&
          message.messageId === newMessagesSeparator.firstUnreadMessageId;

        return (
          <React.Fragment>
            {needsDateSeparator && (
              <DateSeparator
                timestamp={message.createdDate}
                className="message-date-separator"
              />
            )}
            {needsNewMessagesSeparator && (
              <NewMessagesSeparator
                count={newMessagesSeparator.initialUnreadCount}
              />
            )}
            <Message
              senderRoles={roles}
              spaceRoles={roles}
              stickers={stickers}
              emojiPickerOpen={emojiPickerOpen}
              setEmojiPickerOpen={setEmojiPickerOpen}
              emojiPickerOpenDirection={emojiPickerOpenDirection}
              setEmojiPickerOpenDirection={setEmojiPickerOpenDirection}
              message={message}
              customEmoji={customEmoji}
              messageList={messageList}
              virtuosoRef={virtuoso.current}
              mapSenderToUser={mapSenderToUser}
              hoverTarget={hoverTarget}
              setHoverTarget={setHoverTarget}
              setInReplyTo={setInReplyTo}
              editorRef={editor.current}
              repudiability={isRepudiable}
              height={height}
              canEditRoles={isSpaceOwner}
              canDeleteMessages={canDeleteMessages(message)}
              canPinMessages={
                canPinMessages ? canPinMessages(message) : undefined
              }
              channel={channel}
              submitMessage={submitMessage}
              kickUserAddress={kickUserAddress}
              setKickUserAddress={setKickUserAddress}
              onUserClick={onUserClick}
              lastReadTimestamp={lastReadTimestamp}
            />
          </React.Fragment>
        );
      },
      [
        messageList,
        roles,
        stickers,
        emojiPickerOpen,
        setEmojiPickerOpen,
        emojiPickerOpenDirection,
        setEmojiPickerOpenDirection,
        customEmoji,
        mapSenderToUser,
        hoverTarget,
        setHoverTarget,
        setInReplyTo,
        editor,
        isRepudiable,
        height,
        isSpaceOwner,
        canDeleteMessages,
        canPinMessages,
        channel,
        submitMessage,
        kickUserAddress,
        setKickUserAddress,
        onUserClick,
        lastReadTimestamp,
        newMessagesSeparator,
      ]
    );

    useEffect(() => {
      if (!init) {
        setTimeout(() => setInit(true), 200);
      }
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
            highlightMessage(msgId, { duration: 6000 }); // Match CSS animation duration
          }, 200);

          // Remove hash after highlighting is established
          setTimeout(() => {
            history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            );
          }, 1000);
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
    }, [init, location.hash, scrollToMessage, highlightMessage, messageList]); // Added new dependencies

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

    // Handle separator dismissal via Virtuoso's rangeChanged callback
    const handleRangeChanged = useCallback(
      (range: { startIndex: number; endIndex: number }) => {
        if (!newMessagesSeparator || !onDismissSeparator) {
          return;
        }

        const firstUnreadIndex = messageList.findIndex(
          (m) => m.messageId === newMessagesSeparator.firstUnreadMessageId
        );

        if (firstUnreadIndex === -1) return;

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
      [
        newMessagesSeparator,
        onDismissSeparator,
        messageList,
        separatorWasVisible,
      ]
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
