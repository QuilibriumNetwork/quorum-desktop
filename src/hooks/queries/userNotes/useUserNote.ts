import { useQuery } from '@tanstack/react-query';
import { buildUserNoteFetcher } from './buildUserNoteFetcher';
import { buildUserNoteKey } from './buildUserNoteKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useUserNote = ({ targetAddress }: { targetAddress: string }) => {
  const { messageDB } = useMessageDB();

  return useQuery({
    queryKey: buildUserNoteKey({ targetAddress }),
    queryFn: buildUserNoteFetcher({ messageDB, targetAddress }),
    staleTime: Infinity, // Note state is invalidated manually after save or delete
    enabled: !!targetAddress,
    networkMode: 'always', // This query uses IndexedDB, not network
  });
};

export { useUserNote };
