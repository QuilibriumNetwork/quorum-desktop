import { useSuspenseQuery } from '@tanstack/react-query';

import { buildUserInfoFetcher } from './buildUserInfoFetcher';
import { buildUserInfoKey } from './buildUserInfoKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useUserInfo = ({ address }: { address: string }) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildUserInfoKey({ address }),
    queryFn: buildUserInfoFetcher({ messageDB, address }),
    refetchOnMount: true,
  });
};

export { useUserInfo };
