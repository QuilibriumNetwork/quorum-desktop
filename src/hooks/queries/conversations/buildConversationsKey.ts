const buildConversationsKey = ({ type }: { type: 'direct' | 'group' }) => [
  'Conversations',
  type,
];

export { buildConversationsKey };
