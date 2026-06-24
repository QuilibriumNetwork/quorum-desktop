import { useMemo } from 'react';
import type { Space } from '@quilibrium/quorum-shared';
import { useAllMentionsGlobal } from '../mentions/useAllMentionsGlobal';
import { useAllRepliesGlobal } from '../replies/useAllRepliesGlobal';
import type { MentionNotification } from '../mentions/useAllMentions';
import type { ReplyNotification } from '../../../types/notifications';
import { GLOBAL_DISPLAY_CAP } from './constants';

export type GlobalMentionNotification = MentionNotification & { spaceId: string; spaceName: string };
export type GlobalReplyNotification = ReplyNotification & { spaceId: string; spaceName: string };
export type GlobalNotification = GlobalMentionNotification | GlobalReplyNotification;

interface Props {
  spaces: Space[];
  enabledTypes: ('mention-you' | 'mention-everyone' | 'mention-roles')[];
  replyEnabled: boolean;
}

/**
 * Compose the global mention + reply streams into one newest-first list for the
 * global notification panel. Merges, sorts, then slices to `GLOBAL_DISPLAY_CAP`
 * and exposes a `truncated` flag so the UI can surface "Showing N most recent"
 * (no silent truncation — see the design's performance section).
 */
export function useGlobalNotifications({ spaces, enabledTypes, replyEnabled }: Props) {
  const { mentions, isLoading: mLoading } = useAllMentionsGlobal({ spaces, enabledTypes });
  const { replies, isLoading: rLoading } = useAllRepliesGlobal({ spaces, enabled: replyEnabled });

  const { notifications, truncated } = useMemo(() => {
    const merged = [...(mentions as GlobalMentionNotification[]), ...(replies as GlobalReplyNotification[])]
      .sort((a, b) => b.message.createdDate - a.message.createdDate);
    // Slice AFTER the global sort so the cap is order-independent (no bias toward
    // whichever space was iterated first).
    return {
      notifications: merged.slice(0, GLOBAL_DISPLAY_CAP) as GlobalNotification[],
      truncated: merged.length > GLOBAL_DISPLAY_CAP,
    };
  }, [mentions, replies]);

  return { notifications, truncated, isLoading: mLoading || rLoading };
}
