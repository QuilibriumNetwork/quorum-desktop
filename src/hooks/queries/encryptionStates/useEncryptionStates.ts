import { useSuspenseQuery } from '@tanstack/react-query';

import { buildEncryptionStatesFetcher } from './buildEncryptionStatesFetcher';
import { buildEncryptionStatesKey } from './buildEncryptionStatesKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useEncryptionStates = ({
  conversationId,
}: {
  conversationId: string;
}) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildEncryptionStatesKey({ conversationId }),
    queryFn: buildEncryptionStatesFetcher({ messageDB, conversationId }),
    refetchOnMount: true,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useEncryptionStates };
