import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useChannelReadState } from '../channels/useChannelReadState';

export function useChannelMentionCounts(spaceId: string, channelIds: string[]) {
  const { messageDB } = useMessageDB();
  const passkeys = usePasskeysContext();
  const userAddress = passkeys.currentPasskeyInfo?.address;

  const [counts, setCounts] = useState<Record<string, number>>({});

  // Maintain per-channel read state to compute unread mentions
  const readStates = channelIds.map((channelId) => ({
    channelId,
    stateHook: useChannelReadState(spaceId, channelId, userAddress),
  }));

  const refresh = useCallback(async () => {
    if (!userAddress) return;
    const entries = await Promise.all(
      channelIds.map(async (channelId) => {
        const rs = readStates.find((r) => r.channelId === channelId)!.stateHook;
        const count = await messageDB.getUnreadMentionCountForChannel({
          spaceId,
          channelId,
          memberId: userAddress,
          sinceTimestamp: rs.lastReadTimestamp || 0,
        });
        return [channelId, count] as const;
      })
    );
    setCounts(Object.fromEntries(entries));
  }, [channelIds, messageDB, readStates, spaceId, userAddress]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return useMemo(
    () => ({
      counts,
      refresh,
    }),
    [counts, refresh]
  );
}












