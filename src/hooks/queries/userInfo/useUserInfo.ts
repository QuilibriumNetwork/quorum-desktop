import { useSuspenseQuery } from '@tanstack/react-query';

import { buildUserInfoFetcher } from './buildUserInfoFetcher';
import { buildUserInfoKey } from './buildUserInfoKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useUserInfo = ({ address, enabled = true }: { address: string; enabled?: boolean }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildUserInfoKey({ address }),
    queryFn: enabled ? buildUserInfoFetcher({ messageDB, address }) : () => null,
    refetchOnMount: true,
  });
};

export { useUserInfo };
