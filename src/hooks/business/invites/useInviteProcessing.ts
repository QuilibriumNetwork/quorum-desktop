import { useState, useEffect } from 'react';
import { Space } from '../../../api/quorumApi';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { t } from '@lingui/core/macro';

/**
 * Module-level cache to persist invite data across component remounts
 * This prevents showing skeleton state when InviteLink remounts with the same URL
 */
const inviteCache = new Map<string, { space?: Space; error?: string }>();

/**
 * Custom hook for processing and validating invite links
 * Handles invite link verification and space data fetching
 * Uses cache to prevent unnecessary refetching and skeleton flashing on remount
 */
export const useInviteProcessing = (inviteLink: string) => {
  // Initialize state from cache if available
  const cached = inviteCache.get(inviteLink);
  const [error, setError] = useState<string | undefined>(cached?.error);
  const [space, setSpace] = useState<Space | undefined>(cached?.space);
  const { processInviteLink } = useMessageDB();

  useEffect(() => {
    const processInvite = async () => {
      // Skip if we already have cached data for this invite
      const cached = inviteCache.get(inviteLink);
      if (cached) {
        return; // Data already loaded, no need to refetch
      }

      try {
        setError(undefined);
        const spaceData = await processInviteLink(inviteLink);
        setSpace(spaceData);
        // Cache the successful result
        inviteCache.set(inviteLink, { space: spaceData });
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
        // Cache the error result
        inviteCache.set(inviteLink, { error: friendly });
      }
    };

    if (inviteLink) {
      processInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteLink]); // Only re-fetch when inviteLink changes, not when processInviteLink reference changes

  return {
    space,
    error,
    isProcessing: !space && !error,
  };
};
