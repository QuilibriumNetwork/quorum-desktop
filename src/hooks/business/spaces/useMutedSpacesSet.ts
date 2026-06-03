/**
 * Hook returning the set of space IDs the user has muted at the space level
 * (`config.notificationSettings[spaceId].isMuted`).
 *
 * Per-space mute / unmute actions live in `useChannelMute({ spaceId })`. This
 * hook is the read-side equivalent of DM's `useDMMute().mutedSet`, surfacing
 * the full set in one call so the sidebar can derive `isMuted` for every row
 * without N hook invocations.
 */

import { useMemo } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig } from '../../queries/config';

interface UseMutedSpacesSetReturn {
  mutedSpacesSet: Set<string>;
  isMuted: (spaceId: string) => boolean;
}

export function useMutedSpacesSet(): UseMutedSpacesSetReturn {
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  const mutedSpacesSet = useMemo(() => {
    const settings = config?.notificationSettings;
    if (!settings) return new Set<string>();
    const ids: string[] = [];
    for (const spaceId of Object.keys(settings)) {
      if (settings[spaceId]?.isMuted) ids.push(spaceId);
    }
    return new Set(ids);
  }, [config?.notificationSettings]);

  return {
    mutedSpacesSet,
    isMuted: (spaceId: string) => mutedSpacesSet.has(spaceId),
  };
}
