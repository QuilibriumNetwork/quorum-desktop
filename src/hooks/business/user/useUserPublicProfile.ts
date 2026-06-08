// useUserPublicProfile — fetch a user's public profile by address.
//
// Returns null when the user hasn't opted in (404 from server) or hasn't
// been observed on the network. Cached for an hour with React Query so
// chat surfaces don't refetch on every render. Used as a back-fill when
// the local Conversation/Space-member record has no displayName/icon
// (e.g. you receive a DM from a stranger before they've sent a message).
//
// Mirrors mobile's `hooks/useUserPublicProfile.ts`.

import { useQuery } from '@tanstack/react-query';
import { QuorumApiClient, isHandledFetchError } from '../../../api/baseTypes';
import type { PublicProfileResponse } from '../../../api/baseTypes';

export const publicProfileQueryKey = (address: string | undefined) =>
  ['user-public-profile', address ?? ''] as const;

export function useUserPublicProfile(
  address: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<PublicProfileResponse | null>({
    queryKey: publicProfileQueryKey(address),
    queryFn: async () => {
      if (!address) return null;
      try {
        const response = await new QuorumApiClient().getPublicProfile(address);
        return response.data;
      } catch (error: unknown) {
        // 404 = user hasn't opted in. Map to null so callers don't
        // surface this as an error; it's the common case.
        if (isHandledFetchError(error) && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: (options?.enabled ?? true) && !!address,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: false,
  });
}
