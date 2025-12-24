import { useQuery } from '@tanstack/react-query';

import { buildConversationFetcher } from './buildConversationFetcher';
import { buildConversationKey } from './buildConversationKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useConversation = ({ conversationId }: { conversationId: string }) => {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: buildConversationKey({ conversationId }),
    queryFn: buildConversationFetcher({ messageDB, conversationId }),
    refetchOnMount: true,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useConversation };
