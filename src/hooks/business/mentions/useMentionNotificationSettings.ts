/**
 * Hook for managing notification settings (mentions and replies)
 *
 * Provides functions to load, update, and save per-space notification preferences.
 * Settings are stored in IndexedDB user_config.notificationSettings[spaceId] and sync across devices.
 *
 * Part of Phase 4: Mention Notification Settings & Reply Notification System
 * @see .agents/tasks/mention-notification-settings-phase4.md
 * @see .agents/tasks/reply-notification-system.md
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { SpaceNotificationSettings, SpaceNotificationTypeId } from '../../../types/notifications';
import { getDefaultNotificationSettings } from '@quilibrium/quorum-shared';
import { buildConfigKey } from '../../queries/config';

interface UseMentionNotificationSettingsProps {
  spaceId: string;
}

interface UseMentionNotificationSettingsReturn {
  /** Current settings for this space */
  settings: SpaceNotificationSettings;
  /** Selected notification types (for multiselect control) */
  selectedTypes: SpaceNotificationTypeId[];
  /** Update selected types (doesn't save until saveSettings called) */
  setSelectedTypes: (types: SpaceNotificationTypeId[]) => void;
  /** Whether settings are being loaded */
  isLoading: boolean;
  /** Save settings to IndexedDB */
  saveSettings: () => Promise<void>;
  /** Whether save operation is in progress */
  isSaving: boolean;
}

/**
 * Hook for managing notification settings for a space
 *
 * @example
 * const {
 *   selectedTypes,
 *   setSelectedTypes,
 *   saveSettings,
 *   isSaving
 * } = useMentionNotificationSettings({ spaceId });
 *
 * // In UI:
 * <Select
 *   value={selectedTypes}
 *   onChange={setSelectedTypes}
 *   multiple={true}
 *   options={[...]}
 * />
 *
 * // On save:
 * await saveSettings();
 */
export function useMentionNotificationSettings({
  spaceId,
}: UseMentionNotificationSettingsProps): UseMentionNotificationSettingsReturn {
  const { messageDB, actionQueueService, keyset } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<SpaceNotificationSettings>(() =>
    getDefaultNotificationSettings(spaceId)
  );
  const [selectedTypes, setSelectedTypes] = useState<SpaceNotificationTypeId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!userAddress) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const config = await messageDB.getUserConfig({ address: userAddress });
        const settings = config?.notificationSettings?.[spaceId];

        if (settings) {
          setSettings(settings);
          setSelectedTypes(settings.enabledNotificationTypes);
        } else {
          // Use defaults for new space
          const defaults = getDefaultNotificationSettings(spaceId);
          setSettings(defaults);
          setSelectedTypes(defaults.enabledNotificationTypes);
        }
      } catch (error) {
        console.error('[NotificationSettings] Error loading settings:', error);
        // Use defaults on error
        const defaults = getDefaultNotificationSettings(spaceId);
        setSettings(defaults);
        setSelectedTypes(defaults.enabledNotificationTypes);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [spaceId, userAddress, messageDB]);

  // Save settings via action queue (encrypts, signs, syncs cross-device, persists locally).
  // Mirrors useChannelMute.muteSpace so per-space settings stay on a single sync path.
  const saveSettings = useCallback(async () => {
    if (!userAddress || !keyset) return;

    try {
      setIsSaving(true);

      // Cache-first read so we see in-flight optimistic updates from other
      // hooks writing the same config (e.g. muteSpace flipping isMuted).
      const currentConfig =
        queryClient.getQueryData<Awaited<ReturnType<typeof messageDB.getUserConfig>>>(
          buildConfigKey({ userAddress })
        ) ?? (await messageDB.getUserConfig({ address: userAddress }));

      // Preserve any other fields already in notificationSettings[spaceId]
      // (most importantly isMuted, written by useChannelMute.muteSpace).
      const currentSettings =
        currentConfig?.notificationSettings?.[spaceId] ||
        getDefaultNotificationSettings(spaceId);

      const updatedConfig = {
        ...currentConfig,
        address: userAddress,
        spaceIds: currentConfig?.spaceIds || [],
        notificationSettings: {
          ...(currentConfig?.notificationSettings || {}),
          [spaceId]: {
            ...currentSettings,
            spaceId,
            enabledNotificationTypes: selectedTypes,
          },
        },
      };

      // Optimistically update React Query cache for instant UI feedback
      queryClient.setQueryData(
        buildConfigKey({ userAddress }),
        updatedConfig
      );

      // Update local state to reflect the saved values
      setSettings({
        ...currentSettings,
        spaceId,
        enabledNotificationTypes: selectedTypes,
      });

      // Queue config save in background (encrypt + sign + post + IndexedDB).
      // Fire-and-forget keeps the modal responsive; the optimistic cache update
      // already gave the UI its instant feedback.
      void actionQueueService.enqueue(
        'save-user-config',
        { config: updatedConfig },
        `config:${userAddress}` // Dedup key - collapses with other config writes
      );
    } catch (error) {
      console.error('[NotificationSettings] Error saving settings:', error);
      throw error; // Re-throw so modal can show error
    } finally {
      setIsSaving(false);
    }
  }, [spaceId, userAddress, keyset, selectedTypes, messageDB, queryClient, actionQueueService]);

  return {
    settings,
    selectedTypes,
    setSelectedTypes,
    isLoading,
    saveSettings,
    isSaving,
  };
}
