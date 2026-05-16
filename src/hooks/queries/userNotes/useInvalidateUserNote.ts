import { useQueryClient } from '@tanstack/react-query';
import { buildUserNoteKey } from './buildUserNoteKey';

const useInvalidateUserNote = () => {
  const queryClient = useQueryClient();

  return ({ targetAddress }: { targetAddress: string }) => {
    queryClient.invalidateQueries({
      queryKey: buildUserNoteKey({ targetAddress }),
    });
  };
};

export { useInvalidateUserNote };
