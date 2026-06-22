/**
 * Hook for managing personal "blocked users" (viewer-side hide).
 *
 * Blocking a user hides ALL of their messages — past and new — from YOUR own
 * rendered stream, scoped to a single space. It is purely viewer-side: it has
 * no moderation effect, needs no permission, and does not touch the user for
 * anyone else. This is intentionally DISTINCT from the role-gated moderation
 * mute (`useUserMuting` / `muted_users` / `MuteMessage`), which silences a user
 * for everyone and drops their messages at receive time.
 *
 * State lives in `UserConfig.blockedUsers[spaceId]` and syncs across the user's
 * devices via the UserConfig blob. Mirrors the config-backed, optimistic,
 * action-queued pattern used by `useDMMute`.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import {
  logger,
  isUserBlocked as sharedIsUserBlocked,
  getBlockedUsersForSpace,
} from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig, buildConfigKey } from '../../queries/config';
import { showError } from '../../../utils/toast';

interface UseBlockUserReturn {
  /** Addresses blocked in this space */
  blocked: string[];
  /** Set of blocked addresses for O(1) lookup */
  blockedSet: Set<string>;
  /** Check if a user is blocked in this space */
  isBlocked: (userAddress: string) => boolean;
  /** Block a user in this space */
  blockUser: (userAddress: string) => Promise<void>;
  /** Unblock a user in this space */
  unblockUser: (userAddress: string) => Promise<void>;
  /** Toggle block status for a user in this space */
  toggleBlock: (userAddress: string) => Promise<void>;
}

/**
 * @example
 * const { isBlocked, toggleBlock } = useBlockUser(spaceId);
 * if (isBlocked(address)) { ... }
 * await toggleBlock(address);
 */
export function useBlockUser(spaceId: string | undefined): UseBlockUserReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  const { data: config } = useConfig({ userAddress: userAddress || '' });

  // Blocked addresses for THIS space + memoized set for efficient lookup.
  const blocked = useMemo(
    () => (spaceId ? getBlockedUsersForSpace(spaceId, config?.blockedUsers) : []),
    [spaceId, config?.blockedUsers]
  );
  const blockedSet = useMemo(() => new Set(blocked), [blocked]);

  const isBlocked = useCallback(
    (target: string): boolean =>
      spaceId ? sharedIsUserBlocked(target, spaceId, config?.blockedUsers) : false,
    [spaceId, config?.blockedUsers]
  );

  const blockUser = useCallback(
    async (target: string): Promise<void> => {
      if (!userAddress || !keyset || !spaceId) return;

      try {
        // Read cache-first to see in-flight optimistic updates from a prior
        // toggle that hasn't yet persisted to IndexedDB; fall back to the DB.
        const currentConfig =
          queryClient.getQueryData<typeof config>(buildConfigKey({ userAddress })) ??
          (await messageDB.getUserConfig({ address: userAddress }));

        const currentBlockedAll = currentConfig?.blockedUsers || {};
        const currentBlockedSpace = currentBlockedAll[spaceId] || [];

        // Skip if already blocked in this space.
        if (currentBlockedSpace.includes(target)) return;

        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          blockedUsers: {
            ...currentBlockedAll,
            [spaceId]: [...currentBlockedSpace, target],
          },
        };

        // Optimistic cache update so the stream filter recomputes instantly.
        queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);

        actionQueueService
          .enqueue(
            'save-user-config',
            { config: updatedConfig },
            `config:${userAddress}` // Dedup key — collapses rapid toggles.
          )
          .catch((err) => {
            logger.error('[BlockUser] enqueue failed for blockUser, rolling back', err);
            queryClient.setQueryData(buildConfigKey({ userAddress }), currentConfig);
            showError(t`Failed to block user`);
          });
      } catch (error) {
        logger.error('[BlockUser] Error blocking user', error);
        throw error;
      }
    },
    [userAddress, keyset, spaceId, messageDB, queryClient, actionQueueService]
  );

  const unblockUser = useCallback(
    async (target: string): Promise<void> => {
      if (!userAddress || !keyset || !spaceId) return;

      try {
        const currentConfig =
          queryClient.getQueryData<typeof config>(buildConfigKey({ userAddress })) ??
          (await messageDB.getUserConfig({ address: userAddress }));

        const currentBlockedAll = currentConfig?.blockedUsers || {};
        const currentBlockedSpace = currentBlockedAll[spaceId] || [];

        // Skip if not blocked in this space.
        if (!currentBlockedSpace.includes(target)) return;

        const nextSpace = currentBlockedSpace.filter((addr) => addr !== target);
        const nextBlockedAll = { ...currentBlockedAll };
        // Drop the space key entirely when it empties, to keep the blob tidy.
        if (nextSpace.length > 0) {
          nextBlockedAll[spaceId] = nextSpace;
        } else {
          delete nextBlockedAll[spaceId];
        }

        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          blockedUsers: nextBlockedAll,
        };

        queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);

        actionQueueService
          .enqueue(
            'save-user-config',
            { config: updatedConfig },
            `config:${userAddress}`
          )
          .catch((err) => {
            logger.error('[BlockUser] enqueue failed for unblockUser, rolling back', err);
            queryClient.setQueryData(buildConfigKey({ userAddress }), currentConfig);
            showError(t`Failed to unblock user`);
          });
      } catch (error) {
        logger.error('[BlockUser] Error unblocking user', error);
        throw error;
      }
    },
    [userAddress, keyset, spaceId, messageDB, queryClient, actionQueueService]
  );

  const toggleBlock = useCallback(
    async (target: string): Promise<void> => {
      if (isBlocked(target)) {
        await unblockUser(target);
      } else {
        await blockUser(target);
      }
    },
    [isBlocked, blockUser, unblockUser]
  );

  return {
    blocked,
    blockedSet,
    isBlocked,
    blockUser,
    unblockUser,
    toggleBlock,
  };
}
