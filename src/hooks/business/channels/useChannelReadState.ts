import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useInvalidateSpace } from '../../queries/space/useInvalidateSpace';

type ChannelReadState = {
  lastReadTimestamp: number;
  lastReadMessageId?: string;
};

const STORAGE_KEY_PREFIX = 'channel_read_state:';

function storageKey(spaceId: string, channelId: string, userAddress: string) {
  return `${STORAGE_KEY_PREFIX}${userAddress}:${spaceId}/${channelId}`;
}

export function useChannelReadState(
  spaceId: string,
  channelId: string,
  userAddress?: string
) {
  const { messageDB } = useMessageDB();
  const invalidateSpace = useInvalidateSpace();
  const [state, setState] = useState<ChannelReadState>({ lastReadTimestamp: 0 });

  // Load from localStorage on mount
  useEffect(() => {
    if (!userAddress) return;
    try {
      const raw = localStorage.getItem(storageKey(spaceId, channelId, userAddress));
      if (raw) {
        const parsed = JSON.parse(raw) as ChannelReadState;
        setState(parsed);
      }
    } catch {}
  }, [spaceId, channelId, userAddress]);

  const markRead = useCallback(
    async (timestamp?: number, lastReadMessageId?: string) => {
      const next: ChannelReadState = {
        lastReadTimestamp: timestamp ?? Date.now(),
        lastReadMessageId,
      };
      setState(next);
      if (userAddress) {
        try {
          localStorage.setItem(
            storageKey(spaceId, channelId, userAddress),
            JSON.stringify(next)
          );
        } catch {}
      }
      // Also persist conversation lastReadTimestamp for DM parity
      try {
        await messageDB.saveReadTime({
          conversationId: `${spaceId}/${channelId}`,
          lastMessageTimestamp: next.lastReadTimestamp,
        });
      } catch {}
      // Invalidate space so mention counts recompute
      invalidateSpace({ spaceId });
    },
    [spaceId, channelId, userAddress, messageDB, invalidateSpace]
  );

  return useMemo(
    () => ({
      lastReadTimestamp: state.lastReadTimestamp,
      lastReadMessageId: state.lastReadMessageId,
      markRead,
    }),
    [state, markRead]
  );
}












