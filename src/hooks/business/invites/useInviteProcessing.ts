import { useState, useEffect } from 'react';
import { Space } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
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
      } catch (e: any) {
        const raw = e?.message || e?.toString?.() || '';
        // Surface specific, user-friendly errors from known conditions
        let friendly = t`Could not verify invite`;
        if (/invalid link/i.test(raw)) {
          friendly = t`The invite link format is invalid.`;
        } else if (/invalid response/i.test(raw)) {
          friendly = t`Could not fetch the Space details. Please try again.`;
        }
        setError(friendly);
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
