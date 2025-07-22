import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Message } from './Message';
import {
  Emoji,
  Message as MessageType,
  Role,
  Sticker,
} from '../../api/quorumApi';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import React from 'react';
import { DefaultImages } from '../../utils';

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

export const MessageList = ({
  messageList,
  stickers,
  members,
  setInReplyTo,
  editor,
  submitMessage,
  fetchPreviousPage,
  isSpaceOwner,
  canDeleteMessages,
  customEmoji,
  isRepudiable,
  roles,
  kickUserAddress,
  setKickUserAddress,
}: {
  messageList: MessageType[];
  stickers?: { [stickerId: string]: Sticker };
  members: any;
  setInReplyTo: React.Dispatch<React.SetStateAction<MessageType | undefined>>;
  editor: React.RefObject<HTMLTextAreaElement>;
  submitMessage: (message: any) => Promise<void>;
  fetchPreviousPage: () => void;
  isSpaceOwner?: boolean;
  canDeleteMessages: (message: MessageType) => boolean;
  customEmoji?: Emoji[];
  isRepudiable?: boolean;
  roles: Role[];
  kickUserAddress?: string;
  setKickUserAddress?: React.Dispatch<React.SetStateAction<string | undefined>>;
}) => {
  const [width, height] = useWindowSize();
  const [hoverTarget, setHoverTarget] = useState<string>();
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<string>();
  const [emojiPickerOpenDirection, setEmojiPickerOpenDirection] =
    useState<string>();
  const virtuoso = useRef<VirtuosoHandle>(null);
  const [init, setInit] = useState(false);
  const location = useLocation();

  const mapSenderToUser = (senderId: string) => {
    return (
      members[senderId] || {
        displayName: 'Unknown User',
        userIcon: DefaultImages.UNKNOWN_USER,
      }
    );
  };

  const rowRenderer = (index: number) => {
    const message = messageList[index];
    return (
      <Message
        senderRoles={roles}
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
        submitMessage={submitMessage}
        kickUserAddress={kickUserAddress}
        setKickUserAddress={setKickUserAddress}
      />
    );
  };

  useEffect(() => {
    if (!init) {
      setTimeout(() => setInit(true), 200);
    }
  }, []);

  useEffect(() => {
    if (!init || messageList.length === 0) return;

    // Capture hash but delay removal to allow Message components to detect it
    const hash = location.hash;
    if (hash.startsWith('#msg-')) {
      const msgId = hash.replace('#msg-', '');
      const index = messageList.findIndex((m) => m.messageId === msgId);
      if (index !== -1 && virtuoso.current) {
        // Scroll to the message - use instant scroll for search navigation to prevent focus stealing
        setTimeout(() => {
          virtuoso.current?.scrollToIndex({
            index,
            align: 'center',
            behavior: 'auto',
          });
        }, 200);

        // Remove hash after Message components have had time to detect it
        setTimeout(() => {
          history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        }, 1000);
      }
    }
  }, [init, messageList, location.hash]);

  return (
    <Virtuoso
      ref={virtuoso}
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
      alignToBottom={true}
      firstItemIndex={0}
      initialTopMostItemIndex={
        window.location.hash && window.location.hash.startsWith('#msg-')
          ? 0 // scroll to top initially, will override with scrollToIndex()
          : messageList.length - 1
      }
      followOutput={(isAtBottom: boolean) => {
        if (isAtBottom) {
          return 'smooth';
        } else {
          return false;
        }
      }}
      totalCount={messageList.length}
      itemContent={rowRenderer}
    />
  );
};
