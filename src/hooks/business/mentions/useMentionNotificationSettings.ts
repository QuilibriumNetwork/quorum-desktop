/**
 * Hook for managing mention notification settings
 *
 * Provides functions to load, update, and save per-space mention notification preferences.
 * Settings are stored in IndexedDB user_config.mentionSettings[spaceId] and sync across devices.
 *
 * Part of Phase 4: Mention Notification Settings
 * @see .agents/tasks/mention-notification-settings-phase4.md
 */

import { useState, useEffect, useCallback } from 'react';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { MentionNotificationSettings, MentionTypeId } from '../../../types/notifications';
import { getDefaultMentionSettings } from '../../../utils/notificationSettingsUtils';

interface UseMentionNotificationSettingsProps {
  spaceId: string;
}

interface UseMentionNotificationSettingsReturn {
  /** Current settings for this space */
  settings: MentionNotificationSettings;
  /** Selected mention types (for multiselect control) */
  selectedTypes: MentionTypeId[];
  /** Update selected types (doesn't save until saveSettings called) */
  setSelectedTypes: (types: MentionTypeId[]) => void;
  /** Whether settings are being loaded */
  isLoading: boolean;
  /** Save settings to IndexedDB */
  saveSettings: () => Promise<void>;
  /** Whether save operation is in progress */
  isSaving: boolean;
}

/**
 * Hook for managing mention notification settings for a space
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

  const [settings, setSettings] = useState<MentionNotificationSettings>(() =>
    getDefaultMentionSettings(spaceId)
  );
  const [selectedTypes, setSelectedTypes] = useState<MentionTypeId[]>([]);
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

        if (config?.mentionSettings?.[spaceId]) {
          const loadedSettings = config.mentionSettings[spaceId];
          setSettings(loadedSettings);
          setSelectedTypes(loadedSettings.enabledMentionTypes as MentionTypeId[]);
        } else {
          // Use defaults for new space
          const defaults = getDefaultMentionSettings(spaceId);
          setSettings(defaults);
          setSelectedTypes(defaults.enabledMentionTypes);
        }
      } catch (error) {
        console.error('[MentionSettings] Error loading settings:', error);
        // Use defaults on error
        const defaults = getDefaultMentionSettings(spaceId);
        setSettings(defaults);
        setSelectedTypes(defaults.enabledMentionTypes);
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

      // Update mention settings for this space
      const updatedConfig = {
        ...config,
        address: userAddress, // Ensure address is set
        spaceIds: config?.spaceIds || [], // Preserve spaceIds
        mentionSettings: {
          ...(config?.mentionSettings || {}),
          [spaceId]: {
            spaceId,
            enabledMentionTypes: selectedTypes,
          },
        },
      };

      // Save back to IndexedDB
      await messageDB.saveUserConfig(updatedConfig);

      // Update local state
      setSettings({
        spaceId,
        enabledMentionTypes: selectedTypes,
      });

      // Note: Query invalidation should be done by the modal after calling saveSettings()
      // This allows the modal to batch invalidations if needed
    } catch (error) {
      console.error('[MentionSettings] Error saving settings:', error);
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
