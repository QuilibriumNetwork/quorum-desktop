/**
 * Hook for per-conversation DM settings that sync across a user's devices.
 *
 * The overrides (save-edit-history, always-sign, delivery/read receipts) live on
 * IndexedDB `user_config.conversationSettings`, keyed by conversationId, and sync
 * via the encrypted config blob — the same mechanism as DM mute. Reading and
 * writing go through the shared `conversationSettingsUtils` helpers so desktop
 * and mobile agree byte-for-byte on the map semantics.
 *
 * Uses the Action Queue for offline support and crash recovery, mirroring
 * `useDMMute`.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import {
  logger,
  getConversationSetting,
  setConversationSetting,
  type ConversationSettingKey,
} from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig, buildConfigKey } from '../../queries/config';
import { showError } from '../../../utils/toast';

/** Patch shape for a per-conversation save: any subset of the override keys. */
export type ConversationSettingsPatch = Partial<
  Record<ConversationSettingKey, boolean | undefined>
>;

interface UseDMConversationSettingsReturn {
  /**
   * Read one per-conversation override from the synced config. Returns
   * `undefined` when unset — the caller then falls back to the local
   * `Conversation` record (legacy), the global setting, or the default.
   */
  getOverride: (
    conversationId: string,
    key: ConversationSettingKey
  ) => boolean | undefined;
  /**
   * Persist a patch of overrides for a conversation. A key set to `undefined`
   * clears that override (reset-to-global). Bumps the entry's `updatedAt` so
   * the change wins last-write-wins merge across devices.
   */
  saveSettings: (
    conversationId: string,
    patch: ConversationSettingsPatch
  ) => Promise<void>;
}

export function useDMConversationSettings(): UseDMConversationSettingsReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  // Get user config from React Query cache (reactive to optimistic updates).
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  const getOverride = useCallback(
    (
      conversationId: string,
      key: ConversationSettingKey
    ): boolean | undefined =>
      getConversationSetting(config?.conversationSettings, conversationId, key),
    [config?.conversationSettings]
  );

  const saveSettings = useCallback(
    async (
      conversationId: string,
      patch: ConversationSettingsPatch
    ): Promise<void> => {
      if (!userAddress || !keyset) return;

      try {
        // Cache-first read so rapid saves compose (see useDMMute). Falls back to
        // IndexedDB when the cache is cold.
        const currentConfig =
          queryClient.getQueryData<typeof config>(
            buildConfigKey({ userAddress })
          ) ?? (await messageDB.getUserConfig({ address: userAddress }));

        // Overrides-only hygiene: if the patch carries no actual override AND no
        // entry exists yet for this conversation, there is nothing to store and
        // nothing to clear — skip the write so we never persist a default-valued
        // (empty-but-timestamped) entry. When an entry DOES exist, we still write
        // so an all-inherited patch clears it (the reset tombstone propagates).
        const hasOverride = Object.values(patch).some((v) => v !== undefined);
        const hasExistingEntry =
          !!currentConfig?.conversationSettings?.[conversationId];
        if (!hasOverride && !hasExistingEntry) return;

        const updatedConfig = {
          ...currentConfig,
          address: userAddress,
          spaceIds: currentConfig?.spaceIds || [],
          conversationSettings: setConversationSetting(
            currentConfig?.conversationSettings,
            conversationId,
            patch
          ),
        };

        // Optimistically update React Query cache for instant UI feedback.
        queryClient.setQueryData(buildConfigKey({ userAddress }), updatedConfig);

        // Queue config save in background (offline support, crash recovery).
        // Fire-and-forget: the optimistic cache update already gave the UI its
        // feedback. Awaiting would block the next save and widen the race window.
        actionQueueService
          .enqueue(
            'save-user-config',
            { config: updatedConfig },
            `config:${userAddress}` // Dedup key — collapses rapid saves
          )
          .catch((err) => {
            logger.error(
              '[DMConversationSettings] enqueue failed, rolling back',
              err
            );
            queryClient.setQueryData(
              buildConfigKey({ userAddress }),
              currentConfig
            );
            showError(t`Failed to save conversation settings`);
          });
      } catch (error) {
        console.error(
          '[DMConversationSettings] Error saving conversation settings:',
          error
        );
        throw error;
      }
    },
    [userAddress, keyset, messageDB, queryClient, actionQueueService]
  );

  return { getOverride, saveSettings };
}
