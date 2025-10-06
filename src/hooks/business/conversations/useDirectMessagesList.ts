import { useMemo, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessages } from '../../queries/messages/useMessages';
import { useInvalidateConversation } from '../../queries/conversation/useInvalidateConversation';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { Message as MessageType } from '../../../api/quorumApi';

export interface UseDirectMessagesListReturn {
  messageList: MessageType[];
  acceptChat: boolean;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  saveReadTime: () => void;
  canDeleteMessages: (message: MessageType) => boolean;
}

/**
 * Hook for managing DirectMessage message list and chat acceptance state
 */
export function useDirectMessagesList(): UseDirectMessagesListReturn {
  const { address } = useParams<{ address: string }>();
  const user = usePasskeysContext();
  const conversationId = address! + '/' + address!;
  const [acceptChat, setAcceptChat] = useState(false);

  const { messageDB } = useMessageDB();
  const invalidateConversation = useInvalidateConversation();

  // Get messages for this conversation
  const {
    data: messages,
    fetchNextPage,
    fetchPreviousPage,
  } = useMessages({ spaceId: address!, channelId: address! });

  // Process message list
  const messageList = useMemo(() => {
    return messages.pages.flatMap(
      (p) => (p as { messages: MessageType[] }).messages as MessageType[]
    );
  }, [messages]);

  // Determine if user has sent messages (auto-accept chat)
  useEffect(() => {
    const userMessages = messageList.filter(
      (m) => m.content.senderId === user.currentPasskeyInfo!.address
    );

    // If the user has sent any messages, auto-accept the chat
    if (userMessages.length > 0) {
      setAcceptChat(true);
    }
  }, [messageList, user.currentPasskeyInfo]);

  // Initial message loading
  useEffect(() => {
    if ((messages.pages[0] as any)?.messages?.length === 0) {
      fetchNextPage();
      fetchPreviousPage();
    }
  }, []);

  // Save read time when messages change
  useEffect(() => {
    messageDB.saveReadTime({
      conversationId,
      lastMessageTimestamp: Date.now(),
    });
    invalidateConversation({ conversationId });
  }, [messageList, messageDB, conversationId, invalidateConversation]);

  const saveReadTime = () => {
    messageDB.saveReadTime({
      conversationId,
      lastMessageTimestamp: Date.now(),
    });
    invalidateConversation({ conversationId });
  };

  const canDeleteMessages = useCallback(
    (message: MessageType) => {
      const userAddress = user.currentPasskeyInfo?.address;
      if (!userAddress) return false;

      // Users can always delete their own messages (no time limit)
      if (message.content.senderId === userAddress) {
        return true;
      }

      return false;
    },
    [user.currentPasskeyInfo]
  );

  return {
    messageList,
    acceptChat,
    fetchNextPage,
    fetchPreviousPage,
    saveReadTime,
    canDeleteMessages,
  };
}
