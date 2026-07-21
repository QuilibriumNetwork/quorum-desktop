/**
 * One-time migration of legacy device-local per-conversation DM settings into
 * the synced `UserConfig.conversationSettings` map.
 *
 * Before this feature, `saveEditHistory` / `isRepudiable` / `deliveryReceipts` /
 * `readReceipts` lived on the local IndexedDB `Conversation` record and never
 * synced. The read sites still fall back to those local fields (dual-read), so
 * nothing is lost without this hook — but a user's existing choices would not
 * propagate to their other devices until they re-saved each conversation. This
 * sweep folds any existing local values into the synced map once, so they
 * propagate automatically.
 *
 * Seeded entries get a deliberately low `updatedAt` (MIGRATION_TS) so that any
 * genuine future edit on any device — and any already-synced entry — wins the
 * last-write-wins merge. Runs once per user, guarded by a localStorage flag.
 * Conversations already present in the synced map are left untouched.
 */

import { useEffect, useRef } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import {
  logger,
  setConversationSetting,
  type ConversationSettingsMap,
} from '@quilibrium/quorum-shared';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { buildConfigKey } from '../../queries/config';

/** Schema version — bump to re-run the migration if the shape ever changes. */
const MIGRATION_KEY_PREFIX = 'dmConvSettingsMigrated:v1:';
/** Low timestamp so any real edit (or already-synced entry) beats a seeded one. */
const MIGRATION_TS = 1;

export function useMigrateConversationSettings(): void {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!userAddress || !keyset || ranRef.current) return;

    const flagKey = `${MIGRATION_KEY_PREFIX}${userAddress}`;
    if (localStorage.getItem(flagKey)) return;
    ranRef.current = true;

    (async () => {
      try {
        const config = await messageDB.getUserConfig({ address: userAddress });
        const existing: ConversationSettingsMap =
          config?.conversationSettings ?? {};

        const { conversations } = await messageDB.getConversations({
          type: 'direct',
        });

        let map: ConversationSettingsMap = existing;
        let migrated = 0;

        for (const conv of conversations) {
          const id = conv.conversationId;
          if (!id || existing[id]) continue; // already synced — don't overwrite

          const patch: Record<string, boolean | undefined> = {};
          if (typeof conv.isRepudiable !== 'undefined')
            patch.isRepudiable = conv.isRepudiable;
          if (typeof conv.saveEditHistory !== 'undefined')
            patch.saveEditHistory = conv.saveEditHistory;
          if (typeof conv.deliveryReceipts !== 'undefined')
            patch.deliveryReceipts = conv.deliveryReceipts;
          if (typeof conv.readReceipts !== 'undefined')
            patch.readReceipts = conv.readReceipts;

          if (Object.keys(patch).length === 0) continue;

          map = setConversationSetting(map, id, patch, MIGRATION_TS);
          migrated++;
        }

        if (migrated > 0) {
          const updatedConfig = {
            ...config,
            address: userAddress,
            spaceIds: config?.spaceIds || [],
            conversationSettings: map,
          };
          queryClient.setQueryData(
            buildConfigKey({ userAddress }),
            updatedConfig
          );
          await actionQueueService.enqueue(
            'save-user-config',
            { config: updatedConfig },
            `config:${userAddress}`
          );
          logger.log(
            `[DMConversationSettings] migrated ${migrated} local conversation setting(s) into synced config`
          );
        }

        localStorage.setItem(flagKey, String(Date.now()));
      } catch (error) {
        // Non-fatal: dual-read fallback keeps local values working. Don't set
        // the flag, so the sweep retries next launch.
        ranRef.current = false;
        logger.error(
          '[DMConversationSettings] migration sweep failed',
          error
        );
      }
    })();
  }, [userAddress, keyset, messageDB, actionQueueService, queryClient]);
}
