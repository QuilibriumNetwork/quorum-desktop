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
    } = props;

    const [width, height] = useWindowSize();
    const [hoverTarget, setHoverTarget] = useState<string>();
    const [emojiPickerOpen, setEmojiPickerOpen] = useState<string>();
    const [emojiPickerOpenDirection, setEmojiPickerOpenDirection] =
      useState<string>();
    const virtuoso = useRef<VirtuosoHandle>(null);
    const [init, setInit] = useState(false);
    const location = useLocation();

    // Message highlighting context - replaces direct DOM manipulation
    const { highlightMessage, scrollToMessage } = useMessageHighlight();

    // Scroll tracking for jump to present button
    const { handleAtBottomStateChange, shouldShowJumpButton } =
      useScrollTracking();

    // Jump to present handler
    const handleJumpToPresent = useCallback(() => {
      if (virtuoso.current && messageList.length > 0) {
        virtuoso.current.scrollToIndex({
          index: messageList.length - 1,
          align: 'end',
          behavior: 'auto',
        });
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

        return (
          <React.Fragment>
            {needsDateSeparator && (
              <DateSeparator
                timestamp={message.createdDate}
                className="message-date-separator"
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
      ]
    );

    useEffect(() => {
      if (!init) {
        setTimeout(() => setInit(true), 200);
      }
    }, []);

    // Track if we've already processed a hash navigation to prevent re-navigation on messageList changes
    const [hasProcessedHash, setHasProcessedHash] = useState(false);

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
          // Message not found (possibly deleted) - mark as processed and remove hash
          // This prevents infinite attempts to find a deleted message
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
    }, [init, location.hash, scrollToMessage, highlightMessage, messageList]); // Added new dependencies

    // Reset hash processing flag when location.hash changes to a new value
    useEffect(() => {
      if (location.hash.startsWith('#msg-')) {
        setHasProcessedHash(false);
      }
    }, [location.hash]);

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
          atBottomStateChange={handleAtBottomStateChange}
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
            // Original logic for everything else
            if (isAtBottom) {
              return 'smooth';
            } else {
              return false;
            }
          }}
          totalCount={messageList.length}
          computeItemKey={computeItemKey}
          itemContent={rowRenderer}
        />

        {/* Jump to Present Button */}
        {shouldShowJumpButton && (
          <div className="absolute bottom-20 right-6 z-50 bg-chat rounded-full">
            <Button
              type="secondary"
              onClick={handleJumpToPresent}
              className="shadow-lg"
            >
              <Trans>Jump to present</Trans>
            </Button>
          </div>
        )}
      </>
    );
  }
);
