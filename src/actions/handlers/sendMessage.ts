import { Message, PostMessage } from '../../api/quorumApi';
import { t } from '@lingui/core/macro';

type Deps = {
  messageDB: any;
  submitChannelMessage: (
    spaceId: string,
    channelId: string,
    pendingMessage: string | object,
    queryClient: any,
    currentPasskeyInfo: any,
    inReplyTo?: string,
    skipSigning?: boolean
  ) => Promise<void>;
  queryClient: any;
};

export function createSendMessageHandler(deps: Deps) {
  const { messageDB, submitChannelMessage, queryClient } = deps;

  return async function handleSendMessage(context: {
    spaceId: string;
    channelId: string;
    pendingMessage: string | object;
    inReplyTo?: string;
    skipSigning?: boolean;
  }) {
    const { spaceId, channelId, pendingMessage, inReplyTo, skipSigning } = context;

    // Optimistic local save of a pending message
    const nonce = crypto.randomUUID();
    const messageIdBuffer = await crypto.subtle.digest(
      'SHA-256',
      Buffer.from(JSON.stringify({ nonce, spaceId, channelId, pendingMessage }), 'utf-8')
    );
    const message: Message = {
      spaceId,
      channelId,
      messageId: Buffer.from(messageIdBuffer).toString('hex'),
      digestAlgorithm: 'SHA-256',
      nonce,
      createdDate: Date.now(),
      modifiedDate: Date.now(),
      lastModifiedHash: '',
      content:
        typeof pendingMessage === 'string'
          ? ({
              type: 'post',
              senderId: '',
              text: pendingMessage,
              repliesToMessageId: inReplyTo,
            } as PostMessage)
          : {
              ...(pendingMessage as any),
              senderId: '',
            },
      reactions: [],
      mentions: { memberIds: [], roleIds: [], channelIds: [] },
    } as any;

    const conversation = await messageDB.getConversation({
      conversationId: spaceId + '/' + channelId,
    });
    await messageDB.saveMessage(
      message,
      message.createdDate,
      channelId,
      'group',
      conversation?.conversation?.icon,
      conversation?.conversation?.displayName
    );

    // Dispatch actual send via existing service logic (which updates caches and outbounds)
    await submitChannelMessage(spaceId, channelId, pendingMessage, queryClient, (context as any).currentPasskeyInfo, inReplyTo, skipSigning);
  };
}


