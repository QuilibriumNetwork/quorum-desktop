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
import { useScrollAnchor } from '../../hooks/ui/useScrollAnchor';

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
  /** Optional sender->identity resolver. When provided (e.g. Channel's
   *  public-profile-backfilled mapper, or DirectMessage's own), it is used
   *  instead of the internal one built from the raw `members` map. This is how
   *  the public-profile fallback reaches per-message name/avatar rendering. */
  mapSenderToUser?: (senderId: string) => {
    address?: string;
    displayName?: string;
    userIcon?: string;
    [extra: string]: unknown;
  };
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
  /** Scroll-anchor context. For DMs, spaceId === channelId === recipientAddress. */
  anchorSpaceId?: string;
  anchorChannelId?: string;
  /** Explicit cache prefix for the scroll-anchor — needed by ThreadPanel (different key shape). */
  anchorQueryKeyPrefix?: readonly unknown[];
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
      mapSenderToUser: mapSenderToUserProp,
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
      anchorQueryKeyPrefix,
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

    // Ref (not state) so the suppression flag updates synchronously during deletion.
    const deletionInProgressRef = useRef(false);

    const [hasJumpedToOldMessage, setHasJumpedToOldMessage] = useState(false);
    // Ref mirror so useScrollAnchor's cache callback reads a fresh value.
    const hasJumpedToOldMessageRef = useRef(false);
    hasJumpedToOldMessageRef.current = hasJumpedToOldMessage;

    // Replaces Virtuoso's followOutput — see docs/features/messages/scroll-anchoring.md.
    const {
      snapToBottom,
      onAtBottomStateChange: anchorOnAtBottomStateChange,
      setScrollerEl: setAnchorScrollerEl,
    } = useScrollAnchor({
      hasJumpedToOldMessageRef,
      deletionInProgressRef,
      queryClient,
      spaceId: anchorSpaceId,
      channelId: anchorChannelId,
      queryKeyPrefix: anchorQueryKeyPrefix,
    });

    const { highlightMessage, scrollToMessage } = useMessageHighlight();

    const { handleAtBottomStateChange, shouldShowJumpButton } =
      useScrollTracking({
        messageCount: messageList.length,
        minMessageCount: 10,
      });

    const [separatorWasVisible, setSeparatorWasVisible] = useState(false);

    const handleBottomStateChange = useCallback(
      (atBottom: boolean) => {
        handleAtBottomStateChange(atBottom);
        anchorOnAtBottomStateChange(atBottom);
        if (atBottom && init) {
          fetchNextPage();
        }
      },
      [handleAtBottomStateChange, anchorOnAtBottomStateChange, fetchNextPage, init]
    );

    // Bypass Virtuoso's scrollToIndex — our snap writes scrollTop directly,
    // which avoids re-triggering the measurement-callback bug.
    const handleJumpToPresent = useCallback(() => {
      if (messageList.length > 0) {
        snapToBottom();
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

    // Internal resolver from the raw `members` map — used only when the caller
    // doesn't supply its own mapper. Space channels and DMs both pass an
    // enriched mapper (with public-profile fallback) via the prop; this is the
    // bare fallback for any caller that doesn't.
    const mapSenderToUserInternal = useCallback(
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

    const mapSenderToUser = mapSenderToUserProp ?? mapSenderToUserInternal;

    // Strict variant — returns null when the address isn't a current, active
    // member of this space. Kicked members are explicitly treated as
    // unresolved so their mentions render as non-interactive truncated-address
    // pills rather than as clickable pills that would open a profile of a
    // user no longer reachable. Forwarded to Message → MessageMarkdownRenderer.
    const resolveSender = useCallback(
      (senderId: string) => {
        const m = members[senderId];
        if (!m || (m as any).isKicked) return null;
        return m;
      },
      [members]
    );

    // Date separators, new-messages separators, and compact-header flags per row.
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

    // Refs let rowRenderer read current data without re-binding its identity on
    // every cache update — otherwise Virtuoso re-evaluates every row.
    const messageListRef = useRef(messageList);
    const messageDisplayInfoRef = useRef(messageDisplayInfo);
    messageListRef.current = messageList;
    messageDisplayInfoRef.current = messageDisplayInfo;

    const rowRenderer = useCallback(
      (index: number) => {
        const message = messageListRef.current[index];
        const displayInfo = messageDisplayInfoRef.current[index];
        if (!message || !displayInfo) return null;

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
              resolveSender={resolveSender}
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
      // Intentionally excludes messageList / messageDisplayInfo — read via refs above.
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
          setHasProcessedHash(true);

          setTimeout(() => {
            scrollToMessage(msgId, virtuoso.current, messageList);
            highlightMessage(msgId, { duration: 8000 });
          }, 200);

          // 8s matches the CSS highlight animation duration.
          setTimeout(() => {
            history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            );
          }, 8000);
        } else {
          // Message not in current page — let parent paginate to find it.
          if (onHashMessageNotFound && !hasProcessedHash) {
            setHasProcessedHash(true);
            setHasJumpedToOldMessage(true);
            onHashMessageNotFound(msgId).catch((error) => {
              console.error('Failed to load hash message:', error);
            });
          } else if (!onHashMessageNotFound) {
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
    // hasProcessedHash excluded — including it would loop on each set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [init, location.hash, scrollToMessage, highlightMessage, messageList, onHashMessageNotFound]);

    // Programmatic scrollToMessageId (e.g. auto-jump to first unread).
    useEffect(() => {
      if (!init || messageList.length === 0 || !scrollToMessageId) return;

      if (!hasProcessedScrollTo) {
        const index = messageList.findIndex(
          (m) => m.messageId === scrollToMessageId
        );

        if (index !== -1) {
          setHasProcessedScrollTo(true);
          setHasJumpedToOldMessage(true);

          setTimeout(() => {
            scrollToMessage(scrollToMessageId, virtuoso.current, messageList);
            if (highlightOnScroll) {
              // Each Message listens for #msg-{id} and highlights itself.
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

    useEffect(() => {
      setHasProcessedScrollTo(false);
    }, [scrollToMessageId]);

    useEffect(() => {
      if (location.hash.startsWith('#msg-')) {
        setHasProcessedHash(false);
      }
    }, [location.hash]);

    useEffect(() => {
      setHasJumpedToOldMessage(false);
    }, [location.pathname]);

    // Re-enable auto-scroll once we've paged forward to the present.
    useEffect(() => {
      if (hasJumpedToOldMessage && hasNextPage === false) {
        setHasJumpedToOldMessage(false);
      }
    }, [hasJumpedToOldMessage, hasNextPage]);

    useEffect(() => {
      if (!newMessagesSeparator) {
        setSeparatorWasVisible(false);
      }
    }, [newMessagesSeparator]);

    const firstUnreadIndex = useMemo(() => {
      if (!newMessagesSeparator?.firstUnreadMessageId) return -1;
      return messageList.findIndex(
        (m) => m.messageId === newMessagesSeparator.firstUnreadMessageId
      );
    }, [messageList, newMessagesSeparator?.firstUnreadMessageId]);

    // Dismiss the separator once it has been visible and then scrolls out of view.
    const handleRangeChanged = useCallback(
      (range: { startIndex: number; endIndex: number }) => {
        if (firstUnreadIndex === -1 || !onDismissSeparator) {
          return;
        }

        const isVisible =
          firstUnreadIndex >= range.startIndex &&
          firstUnreadIndex <= range.endIndex;

        if (isVisible && !separatorWasVisible) {
          setSeparatorWasVisible(true);
        } else if (!isVisible && separatorWasVisible) {
          onDismissSeparator();
        }
      },
      [firstUnreadIndex, onDismissSeparator, separatorWasVisible]
    );

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
          scrollerRef={setAnchorScrollerEl}
          className="scrollbar-message-list"
          style={{ position: 'relative' }}
          overscan={{ main: height, reverse: height }}
          // Cap at 300px (~6 rows). Larger values made the rendered range span
          // the whole list on short messages, causing big backward scroll jumps
          // on cache updates. See bugs/2026-05-24-virtuoso-measurement-scroll-reset.md.
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
          // useScrollAnchor owns auto-scroll on new messages — see scroll-anchoring.md.
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
