/**
 * Hook that syncs muted DM conversations to the NotificationService
 *
 * This hook subscribes to user config changes and updates the NotificationService
 * with the current set of muted conversation IDs. This prevents desktop
 * notifications from being triggered for muted conversations.
 */

import { useEffect } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useConfig } from '../../queries/config';
import { notificationService } from '../../../services/NotificationService';

/**
 * Syncs muted conversations from user config to NotificationService
 *
 * This hook should be called once in a component that renders when
 * the user is authenticated (e.g., Layout component).
 */
export function useMutedConversationsSync(): void {
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  useEffect(() => {
    // Update NotificationService with current muted conversations
    const mutedSet = new Set(config?.mutedConversations || []);
    notificationService.setMutedConversations(mutedSet);
  }, [config?.mutedConversations]);
}
