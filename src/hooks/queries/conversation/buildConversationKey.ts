const buildConversationKey = ({
  conversationId,
}: {
  conversationId: string;
}) => ['Conversation', conversationId];

export { buildConversationKey };
