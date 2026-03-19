import { stripMarkdown } from '@quilibrium/quorum-shared';
import type { ChannelThread, ThreadMeta } from '@quilibrium/quorum-shared';

export function buildChannelThreadFromCreate({
  spaceId,
  channelId,
  rootMessageId,
  threadMeta,
  rootMessageText,
  currentUserAddress,
  now,
}: {
  spaceId: string;
  channelId: string;
  rootMessageId: string;
  threadMeta: ThreadMeta;
  rootMessageText: string;
  currentUserAddress: string;
  now: number;
}): ChannelThread {
  const stripped = stripMarkdown(rootMessageText).slice(0, 100);
  return {
    threadId: threadMeta.threadId,
    spaceId,
    channelId,
    rootMessageId,
    createdBy: threadMeta.createdBy,
    createdAt: now,
    lastActivityAt: threadMeta.lastActivityAt ?? now,
    replyCount: 0,
    isClosed: false,
    customTitle: threadMeta.customTitle,
    titleSnapshot: stripped || undefined,
    hasParticipated: threadMeta.createdBy === currentUserAddress,
  };
}

export function updateChannelThreadOnReply({
  existing,
  replySenderId,
  replyTimestamp,
  currentUserAddress,
}: {
  existing: ChannelThread;
  replySenderId: string;
  replyTimestamp: number;
  currentUserAddress: string;
}): ChannelThread {
  return {
    ...existing,
    replyCount: existing.replyCount + 1,
    lastActivityAt: replyTimestamp,
    hasParticipated:
      existing.hasParticipated || replySenderId === currentUserAddress,
  };
}
