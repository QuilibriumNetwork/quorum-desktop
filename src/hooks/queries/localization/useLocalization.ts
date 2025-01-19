import { useSuspenseQuery } from '@tanstack/react-query';

import { useQuorumApiClient } from '../../../components/context/QuorumApiContext';
import { buildLocalizationFetcher } from './buildLocalizationFetcher';
import { buildLocalizationKey } from './buildLocalizationKey';

const useLocalization = ({ langId }: { langId: string }) => {
  const { apiClient } = useQuorumApiClient();

  return useSuspenseQuery({
    queryKey: buildLocalizationKey({ langId }),
    queryFn: buildLocalizationFetcher({ apiClient, langId }),
    refetchOnMount: true,
  });
};

export { useLocalization };
