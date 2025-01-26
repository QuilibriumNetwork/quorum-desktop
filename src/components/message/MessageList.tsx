import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as moment from 'moment-timezone';
import { Message } from './Message';
import { Emoji, Message as MessageType, Role } from '../../api/quorumApi';
import { Virtuoso } from 'react-virtuoso';
import React from 'react';

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
  const virtuoso = useRef(null);
  const [init, setInit] = useState(false);

  const mapSenderToUser = (senderId: string) => {
    return (
      members[senderId] || {
        displayName: 'Unknown User',
        userIcon: '/unknown.png',
      }
    );
  };

  const rowRenderer = (index: number) => {
    const message = messageList[index];
    return (
      <Message
        senderRoles={roles}
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
      initialTopMostItemIndex={messageList.length - 1}
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
