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
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { NotificationSettings, NotificationTypeId } from '../../../types/notifications';
import { getDefaultNotificationSettings } from '../../../utils/notificationSettingsUtils';

interface UseMentionNotificationSettingsProps {
  spaceId: string;
}

interface UseMentionNotificationSettingsReturn {
  /** Current settings for this space */
  settings: NotificationSettings;
  /** Selected notification types (for multiselect control) */
  selectedTypes: NotificationTypeId[];
  /** Update selected types (doesn't save until saveSettings called) */
  setSelectedTypes: (types: NotificationTypeId[]) => void;
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
  const { messageDB } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const userAddress = currentPasskeyInfo?.address;

  const [settings, setSettings] = useState<NotificationSettings>(() =>
    getDefaultNotificationSettings(spaceId)
  );
  const [selectedTypes, setSelectedTypes] = useState<NotificationTypeId[]>([]);
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

  // Save settings to IndexedDB (called by Save button in modal)
  const saveSettings = useCallback(async () => {
    if (!userAddress) return;

    try {
      setIsSaving(true);

      // Get current config
      const config = await messageDB.getUserConfig({ address: userAddress });

      // Update notification settings for this space
      const updatedConfig = {
        ...config,
        address: userAddress, // Ensure address is set
        spaceIds: config?.spaceIds || [], // Preserve spaceIds
        notificationSettings: {
          ...(config?.notificationSettings || {}),
          [spaceId]: {
            spaceId,
            enabledNotificationTypes: selectedTypes,
          },
        },
      };

      // Save back to IndexedDB
      await messageDB.saveUserConfig(updatedConfig);

      // Update local state
      setSettings({
        spaceId,
        enabledNotificationTypes: selectedTypes,
      });

      // Note: Query invalidation should be done by the modal after calling saveSettings()
      // This allows the modal to batch invalidations if needed
    } catch (error) {
      console.error('[NotificationSettings] Error saving settings:', error);
      throw error; // Re-throw so modal can show error
    } finally {
      setIsSaving(false);
    }
  }, [spaceId, userAddress, selectedTypes, messageDB]);

  return {
    settings,
    selectedTypes,
    setSelectedTypes,
    isLoading,
    saveSettings,
    isSaving,
  };
}
