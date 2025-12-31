import { logger } from '@quilibrium/quorum-shared';
import { useState, useCallback } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useInvalidateConfig } from '../../queries';
import { showToast } from '../../../utils/toast';

export interface UseSpaceRecoveryReturn {
  restoreMissingSpaces: () => Promise<void>;
  isRestoring: boolean;
}

export const useSpaceRecovery = (): UseSpaceRecoveryReturn => {
  const [isRestoring, setIsRestoring] = useState(false);
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { messageDB, saveConfig, getConfig } = useMessageDB();
  const invalidateConfig = useInvalidateConfig();

  const restoreMissingSpaces = useCallback(async () => {
    if (!currentPasskeyInfo || !keyset || !messageDB) {
      showToast(t`Unable to restore: not logged in`, { variant: 'error', bottomFixed: true });
      return;
    }

    setIsRestoring(true);
    try {
      // 1. Get all spaces from IndexedDB
      const dbSpaces = await messageDB.getSpaces();

      // 2. Get current nav space IDs from config
      const config = await getConfig({
        address: currentPasskeyInfo.address,
        userKey: keyset.userKeyset,
      });

      if (!config) {
        showToast(t`Unable to load user config`, { variant: 'error', bottomFixed: true });
        return;
      }

      const navSpaceIds = new Set(config.spaceIds || []);

      // 3. Find orphaned spaces (in DB but not in nav)
      const orphaned = dbSpaces.filter(space => !navSpaceIds.has(space.spaceId));

      // 4. Filter to only spaces with valid encryption state
      const recoverable: string[] = [];
      for (const space of orphaned.slice(0, 50)) { // Limit 50
        const encStates = await messageDB.getEncryptionStates({
          conversationId: space.spaceId + '/' + space.spaceId
        });
        const encState = encStates[0];

        if (encState) {
          try {
            // Validate that state is parseable JSON if present
            if (encState.state) JSON.parse(encState.state);
            // Skip bloated encryption states (>500KB) - these cause sync failures
            const stateSize = encState.state?.length || 0;
            if (stateSize > 500_000) {
              logger.log(`[SpaceRecovery] Skipping ${space.spaceId.slice(0, 12)}... - bloated state (${(stateSize / 1024 / 1024).toFixed(1)}MB)`);
              continue;
            }
            recoverable.push(space.spaceId);
          } catch {
            // Skip invalid encryption state
          }
        }
      }

      logger.log(`[SpaceRecovery] Found ${orphaned.length} orphaned, ${recoverable.length} recoverable`);

      if (recoverable.length === 0) {
        showToast(t`No missing spaces found`, { variant: 'info', bottomFixed: true });
        return;
      }

      // 5. Add spaces back to config
      const updatedConfig = {
        ...config,
        spaceIds: [...new Set([...config.spaceIds, ...recoverable])],
        items: [
          ...(config.items || []),
          ...recoverable
            .filter(id => !config.spaceIds.includes(id))
            .map(id => ({ type: 'space' as const, id }))
        ]
      };

      // 6. Save config
      await saveConfig({ config: updatedConfig, keyset });

      // 7. Invalidate React Query cache (nav menu updates automatically)
      await invalidateConfig({ userAddress: currentPasskeyInfo.address });

      showToast(t`Restored ${recoverable.length} space(s)`, { variant: 'success', bottomFixed: true });
    } catch (error) {
      console.error('[SpaceRecovery] Error:', error);
      showToast(t`Failed to restore spaces`, { variant: 'error', bottomFixed: true });
    } finally {
      setIsRestoring(false);
    }
  }, [currentPasskeyInfo, keyset, messageDB, getConfig, saveConfig, invalidateConfig]);

  return { restoreMissingSpaces, isRestoring };
};
