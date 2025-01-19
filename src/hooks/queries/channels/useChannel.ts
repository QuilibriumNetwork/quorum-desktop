import { useSuspenseQuery } from '@tanstack/react-query';

import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { buildChannelFetcher } from './buildChannelFetcher';
import { buildChannelKey } from './buildChannelKey';

const useChannel = ({
  spaceId,
  channelId,
}: {
  spaceId: string;
  channelId: string;
}) => {
  const { apiClient } = useQuorumApiClient();

  return useSuspenseQuery({
    queryKey: buildChannelKey({ spaceId, channelId }),
    queryFn: buildChannelFetcher({ apiClient, spaceId, channelId }),
    refetchOnMount: true,
  });
};

export { useChannel };
