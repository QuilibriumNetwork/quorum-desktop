import { useState, useEffect } from 'react';
import { Space } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/MessageDB';
import { t } from '@lingui/core/macro';

/**
 * Custom hook for processing and validating invite links
 * Handles invite link verification and space data fetching
 */
export const useInviteProcessing = (inviteLink: string) => {
  const [error, setError] = useState<string>();
  const [space, setSpace] = useState<Space>();
  const { processInviteLink } = useMessageDB();

  useEffect(() => {
    const processInvite = async () => {
      try {
        setError(undefined);
        const spaceData = await processInviteLink(inviteLink);
        setSpace(spaceData);
      } catch (e) {
        setError(t`Could not verify invite`);
        setSpace(undefined);
      }
    };

    if (inviteLink) {
      processInvite();
    }
  }, [inviteLink, processInviteLink]);

  return {
    space,
    error,
    isProcessing: !space && !error,
  };
};