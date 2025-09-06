import { useSuspenseQuery } from '@tanstack/react-query';

import { buildSpacesFetcher } from './buildSpacesFetcher';
import { buildSpacesKey } from './buildSpacesKey';
import { useMessageDB } from '../../../components/context/useMessageDB';

const useSpaces = ({}: {}) => {
  const { messageDB } = useMessageDB();

  return useSuspenseQuery({
    queryKey: buildSpacesKey({}),
    queryFn: buildSpacesFetcher({ messageDB }),
    refetchOnMount: true,
  });
};

export { useSpaces };
