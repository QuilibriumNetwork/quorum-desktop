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
import type {
  Emoji,
  Message as MessageType,
  Role,
  Sticker,
  Channel,
} from '@quilibrium/quorum-shared';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import React from 'react';
import { DefaultImages } from '../../utils';
import { useMessageHighlight } from '../../hooks/business/messages/useMessageHighlight';
import { shouldShowDateSeparator, shouldShowCompactHeader } from '@quilibrium/quorum-shared';
import { useScrollTracking } from '../../hooks/ui/useScrollTracking';
import { Button as ButtonBase } from '../primitives';
// Cast to work around React type version mismatch between quorum-shared and quorum-desktop
const Button = ButtonBase as React.FC<any>;
import { Trans } from '@lingui/react/macro';
import type { DmContext } from '../../hooks/business/messages/useMessageActions';
import { useQueryClient } from '@tanstack/react-query';
import { useScrollAnchor } from './useScrollAnchor';
// TEMPORARY DEBUG — remove with __scrollDebug.ts. See bugs/2026-05-24-virtuoso-measurement-scroll-reset.md
import { scrollDebug } from './__scrollDebug';

export interface MessageListRef {
  scrollToBottom: () => void;
  getVirtuosoRef: () => VirtuosoHandle | null;
  /** Set deletion flag synchronously to prevent followOutput scroll during deletions */
  setDeletionInProgress: (value: boolean) => void;
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
  highlightOnScroll?: boolean; // If true, also highlight the message when scrolling to it
  newMessagesSeparator?: {
    firstUnreadMessageId: string;
    initialUnreadCount: number;
  } | null;
  onDismissSeparator?: () => void; // Callback when separator should be dismissed
  onRetryMessage?: (message: MessageType) => void;
  /** DM context for offline-resilient reactions/deletes/edits (optional - only for DMs) */
  dmContext?: DmContext;
  /** Users for mention autocomplete in message edit mode */
  users?: Array<{ address: string; displayName?: string; userIcon?: string }>;
  /** Roles for mention autocomplete in message edit mode (note: this is different from the roles prop which is for rendering) */
  mentionRoles?: Array<{ roleId: string; roleTag: string; displayName: string; color: string }>;
  /** Channel groups for mention autocomplete in message edit mode */
  groups?: Array<{ groupName: string; channels: Channel[]; icon?: string; iconColor?: string }>;
  /** Whether @everyone is allowed in message edit mode */
  canUseEveryone?: boolean;
  /** Thread action callback */
  onStartThread?: (message: MessageType) => void;
  /** When true, messages align to top instead of bottom (used for thread panels) */
  alignToTop?: boolean;
  /** Optional content rendered above the first message inside the scrollable list (bottom-anchored with messages) */
  headerContent?: React.ReactNode;
  /** Show delivery receipt checkmarks on own DM messages */
  showDeliveryReceipts?: boolean;
  /** Show read receipt checkmarks on own DM messages */
  showReadReceipts?: boolean;
  /** Callback to report a message as read */
  reportRead?: (messageId: string, timestamp: number) => void;
  /** Snapshot of lastReadTimestamp at conversation load — for read receipt observer filtering */
  readReceiptBaseline?: number;
  /**
   * Space + channel context for the application-owned scroll anchor.
   * For DMs the convention is spaceId === channelId === recipientAddress.
   * When either is undefined the anchor is inert.
   * See bugs/2026-05-24-virtuoso-measurement-scroll-reset.md.
   */
  anchorSpaceId?: string;
  anchorChannelId?: string;
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
      onUserClick,
      onChannelClick,
      spaceChannels,
      lastReadTimestamp = 0,
      onHashMessageNotFound,
      isLoadingHashMessage,
      scrollToMessageId,
      highlightOnScroll = false,
      newMessagesSeparator,
      onDismissSeparator,
      spaceName,
      onRetryMessage,
      dmContext,
      users = [],
      mentionRoles = [],
      groups = [],
      canUseEveryone = false,
      onStartThread,
      alignToTop = false,
      headerContent,
      showDeliveryReceipts,
      showReadReceipts,
      reportRead,
      readReceiptBaseline,
      anchorSpaceId,
      anchorChannelId,
    } = props;

    const [_width, height] = useWindowSize();
    const queryClient = useQueryClient();
    const [hoverTarget, setHoverTarget] = useState<string>();
    const [emojiPickerOpen, setEmojiPickerOpen] = useState<string>();
    const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ x: number; y: number } | null>(null);

    // Reset emoji picker position when picker closes
    useEffect(() => {
      if (!emojiPickerOpen) {
        setEmojiPickerPosition(null);
      }
    }, [emojiPickerOpen]);

    // Close emoji picker when stickers panel opens
    useEffect(() => {
      const handleClose = () => setEmojiPickerOpen(undefined);
      document.addEventListener('quorum:close-emoji-picker', handleClose);
      return () => document.removeEventListener('quorum:close-emoji-picker', handleClose);
    }, [setEmojiPickerOpen]);

    // Close emoji picker when focus moves to the message composer (textarea or contenteditable)
    // but NOT when focus moves to the search input inside the emoji picker itself.
    useEffect(() => {
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.getAttribute('contenteditable') === 'true'
        ) {
          if (target.closest('.emoji-picker')) return;
          setEmojiPickerOpen(undefined);
        }
      };
      document.addEventListener('focusin', handleFocusIn);
      return () => document.removeEventListener('focusin', handleFocusIn);
    }, [setEmojiPickerOpen]);

    const virtuoso = useRef<VirtuosoHandle>(null);
    const [init, setInit] = useState(false);
    const location = useLocation();

    // Ref for deletion state - must be a ref (not state) for synchronous updates
    // This prevents followOutput from scrolling before React state updates propagate
    const deletionInProgressRef = useRef(false);

    // Track if we've jumped to an old message via hash navigation
    // This disables auto-scroll during manual pagination
    const [hasJumpedToOldMessage, setHasJumpedToOldMessage] = useState(false);
    // Ref mirror so useScrollAnchor can read the latest value synchronously
    // (state value would be stale in the cache-subscription callback).
    const hasJumpedToOldMessageRef = useRef(false);
    hasJumpedToOldMessageRef.current = hasJumpedToOldMessage;

    // Application-owned scroll anchoring — replaces Virtuoso's followOutput.
    // See bugs/2026-05-24-virtuoso-measurement-scroll-reset.md and
    // tasks/2026-05-24-virtuoso-application-owned-scroll-anchoring.md.
    const { snapToBottom, onAtBottomStateChange: anchorOnAtBottomStateChange } = useScrollAnchor({
      hasJumpedToOldMessageRef,
      deletionInProgressRef,
      queryClient,
      spaceId: anchorSpaceId,
      channelId: anchorChannelId,
    });

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

    // Combined bottom state handler: manages "Jump to Present" button,
    // forward pagination, AND the useScrollAnchor readiness signal.
    const handleBottomStateChange = useCallback(
      (atBottom: boolean) => {
        // TEMPORARY DEBUG
        scrollDebug.log({ kind: 'atBottomStateChange', note: `atBottom=${atBottom}` });

        // Update jump button visibility
        handleAtBottomStateChange(atBottom);

        // Signal scroll-anchor readiness on first atBottom=true after mount.
        // (Virtuoso's initial scroll is imperative; no DOM scroll event fires.)
        anchorOnAtBottomStateChange(atBottom);

        // Fetch next page when scrolling to bottom (for loading newer messages after jumping to old message)
        if (atBottom && init) {
          fetchNextPage();
        }
      },
      [handleAtBottomStateChange, anchorOnAtBottomStateChange, fetchNextPage, init]
    );

    // Jump to present handler — uses the application-owned snap rather than
    // Virtuoso's scrollToIndex to avoid re-triggering the measurement callback
    // bug we're working around. snapToBottom writes scrollTop directly.
    const handleJumpToPresent = useCallback(() => {
      if (messageList.length > 0) {
        snapToBottom();
        // Re-enable auto-scroll when user explicitly jumps to present
        setHasJumpedToOldMessage(false);
      }
    }, [messageList.length, snapToBottom]);

    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        if (messageList.length > 0) snapToBottom();
      },
      getVirtuosoRef: () => virtuoso.current,
      setDeletionInProgress: (value: boolean) => {
        deletionInProgressRef.current = value;
      },
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
    const messageDisplayInfo = useMemo(() => {
      return messageList.map((message, index) => {
        const previousMessage = index > 0 ? messageList[index - 1] : null;
        const needsDateSeparator = shouldShowDateSeparator(message, previousMessage);
        const needsNewMessagesSeparator = newMessagesSeparator &&
          message.messageId === newMessagesSeparator.firstUnreadMessageId;
        const isCompact = shouldShowCompactHeader(
          message, previousMessage, needsDateSeparator, !!needsNewMessagesSeparator
        );
        return { needsDateSeparator, needsNewMessagesSeparator, isCompact };
      });
    }, [messageList, newMessagesSeparator]);

    // Fix R4 (bugs/2026-05-24-virtuoso-measurement-scroll-reset.md):
    // Keep messageList + messageDisplayInfo behind refs so rowRenderer can
    // read current data without depending on their identity. This makes the
    // rowRenderer callback's reference stable across cache updates that don't
    // change Message component identity, which prevents Virtuoso from
    // re-evaluating items merely because the array reference changed.
    const messageListRef = useRef(messageList);
    const messageDisplayInfoRef = useRef(messageDisplayInfo);
    messageListRef.current = messageList;
    messageDisplayInfoRef.current = messageDisplayInfo;

    const rowRenderer = useCallback(
      (index: number) => {
        // Fix R4: read message + displayInfo from refs (always current), so
        // this callback's identity does NOT depend on messageList /
        // messageDisplayInfo array references.
        const message = messageListRef.current[index];
        const displayInfo = messageDisplayInfoRef.current[index];
        if (!message || !displayInfo) return null;

        // Gap class: first message or compact messages get no gap
        const gapClass = index === 0 || displayInfo.isCompact
          ? 'message-row message-row-first'
          : 'message-row';

        return (
          <div className={gapClass}>
            {index === 0 && headerContent}
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
              emojiPickerPosition={emojiPickerPosition}
              setEmojiPickerPosition={setEmojiPickerPosition}
              message={message}
              customEmoji={customEmoji}
              messageList={messageListRef.current}
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
              showDeliveryReceipts={showDeliveryReceipts}
              showReadReceipts={showReadReceipts}
              reportRead={reportRead}
              readReceiptBaseline={readReceiptBaseline}
              users={users}
              roles={mentionRoles}
              groups={groups}
              canUseEveryone={canUseEveryone}
              onStartThread={onStartThread ? () => onStartThread(message) : undefined}
              onBeforeDelete={() => {
                deletionInProgressRef.current = true;
                // Clear after delay to allow for follow-up operations
                setTimeout(() => {
                  deletionInProgressRef.current = false;
                }, 500);
              }}
            />
          </div>
        );
      },
      // Fix R4: deliberately exclude messageList and messageDisplayInfo —
      // they're read via refs above. Other deps are stable across cache
      // updates (callbacks, settings) so rowRenderer's identity is stable.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        roles,
        stickers,
        emojiPickerOpen,
        setEmojiPickerOpen,
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
        onStartThread,
        headerContent,
        showDeliveryReceipts,
        showReadReceipts,
        reportRead,
        readReceiptBaseline,
      ]
    );

    useEffect(() => {
      if (!init) {
        setTimeout(() => setInit(true), 200);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // TEMPORARY DEBUG — attach scroll recorder once the Virtuoso scroller mounts.
    // Remove with __scrollDebug.ts. See bugs/2026-05-24-virtuoso-measurement-scroll-reset.md
    useEffect(() => {
      let attempts = 0;
      const tryAttach = () => {
        const scroller = document.querySelector('[data-virtuoso-scroller]') as HTMLElement | null;
        if (scroller) {
          scrollDebug.attach(scroller);
          return;
        }
        if (++attempts < 20) setTimeout(tryAttach, 100);
      };
      tryAttach();
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

          setTimeout(() => {
            scrollToMessage(scrollToMessageId, virtuoso.current, messageList);
            if (highlightOnScroll) {
              // Set URL hash to trigger Message component's hash-based highlight mechanism.
              // Each Message listens to location.hash === `#msg-{id}` and highlights itself.
              window.location.hash = `#msg-${scrollToMessageId}`;
            }
          }, 200);
        }
      }
    }, [
      init,
      messageList,
      scrollToMessageId,
      highlightOnScroll,
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
        // TEMPORARY DEBUG
        scrollDebug.log({
          kind: 'rangeChanged',
          note: `start=${range.startIndex} end=${range.endIndex}`,
        });
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
          // Fix R3 (bugs/2026-05-24-virtuoso-measurement-scroll-reset.md):
          // Previously `{ top: height, bottom: height }` where height ≈ 800px.
          // On a list of short messages that briefly spanned the entire visible
          // index range, so any new InfiniteData ref from setQueriesData caused
          // Virtuoso to mount items at index 0/1 even when the user was near
          // the bottom — triggering a ~400px backward scrollTop adjustment.
          // Cap at 300px (≈6 message rows) — still smooth, no over-span.
          increaseViewportBy={{ top: 300, bottom: 300 }}
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
          alignToBottom={!alignToTop}
          firstItemIndex={0}
          initialTopMostItemIndex={
            alignToTop
              ? 0
              : window.location.hash && window.location.hash.startsWith('#msg-')
                ? 0 // scroll to top initially, will override with scrollToIndex()
                : messageList.length - 1
          }
          // Virtuoso's followOutput is permanently disabled. Scroll anchoring
          // on new messages is owned by useScrollAnchor (see bugs/2026-05-24-
          // virtuoso-measurement-scroll-reset.md and tasks/2026-05-24-virtuoso-
          // application-owned-scroll-anchoring.md).
          followOutput={false}
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
