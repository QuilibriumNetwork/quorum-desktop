import { useQuery } from '@tanstack/react-query';
import type { Space } from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import {
  buildGlobalSenderMap,
  type ResolvedGlobalSender,
} from '../../../utils/resolveGlobalSender';

/**
 * Resolve sender names for the GLOBAL notification panel across all spaces.
 *
 * The per-space panel uses Channel's `mapSenderToUser` (built from the channel's
 * enriched member list). The global panel spans spaces, so it pre-fetches each
 * space's roster via `messageDB.getSpaceMembers` and builds one synchronous
 * resolver keyed by `(spaceId, senderId)`. The fetch is cached by React Query
 * (30s stale) so opening the panel costs one batch of IndexedDB roster reads.
 */
export function useGlobalSenderResolver(spaces: Space[]) {
  const { messageDB } = useMessageDB();
  const spaceIds = spaces.map((s) => s.spaceId);

  const { data: resolve } = useQuery({
    queryKey: ['global-sender-resolver', ...spaceIds.slice().sort()],
    queryFn: async () => {
      const membersBySpace: Record<string, Awaited<ReturnType<typeof messageDB.getSpaceMembers>>> = {};
      for (const spaceId of spaceIds) {
        membersBySpace[spaceId] = await messageDB.getSpaceMembers(spaceId);
      }
      return buildGlobalSenderMap(membersBySpace);
    },
    enabled: spaceIds.length > 0,
    staleTime: 30000,
  });

  // Stable fallback until the rosters load: address-only resolution.
  return (
    resolve ?? ((spaceId: string, senderId: string): ResolvedGlobalSender => ({ address: senderId }))
  );
}
