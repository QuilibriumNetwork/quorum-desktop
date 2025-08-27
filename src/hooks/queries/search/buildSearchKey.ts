import { SearchContext } from '../../../db/messages';

const buildSearchKey = ({
  query,
  context,
}: {
  query: string;
  context: SearchContext;
}) => {
  const contextKey =
    context.type === 'space'
      ? `space:${context.spaceId}`
      : `dm:${context.conversationId}`;

  return ['Search', query, contextKey];
};

export { buildSearchKey };
