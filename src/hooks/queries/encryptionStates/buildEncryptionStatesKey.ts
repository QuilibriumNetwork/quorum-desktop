const buildEncryptionStatesKey = ({
  conversationId,
}: {
  conversationId: string;
}) => ['EncryptionStates', conversationId];

export { buildEncryptionStatesKey };
