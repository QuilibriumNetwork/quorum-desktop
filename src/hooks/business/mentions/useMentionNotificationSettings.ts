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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import type { SpaceNotificationSettings, SpaceNotificationTypeId } from '../../../types/notifications';
import { getDefaultNotificationSettings, logger } from '@quilibrium/quorum-shared';
import { useConfig, buildConfigKey } from '../../queries/config';
import { showError } from '../../../utils/toast';

/** Order-insensitive equality for two notification-type selections. */
function sameTypes(
  a: SpaceNotificationTypeId[],
  b: SpaceNotificationTypeId[]
): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((type) => setB.has(type));
}

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

  // Read config reactively from React Query (IndexedDB-backed), the same source
  // the notification panel hooks use. This replaces the previous one-shot mount
  // read that could capture desktop's stale local default before a cross-device
  // config sync had landed in IndexedDB — making the modal display (and worse,
  // a no-op Save) clobber a value another device had already set.
  // See .agents/tasks/.todo/2026-06-23-notification-settings-stale-read-and-clobber.md
  const { data: config } = useConfig({ userAddress: userAddress || '' });

  // The persisted settings for this space, derived from the live config.
  // Falls back to all-types-enabled defaults for a space with no stored value.
  const settings = useMemo<SpaceNotificationSettings>(
    () =>
      config?.notificationSettings?.[spaceId] ??
      getDefaultNotificationSettings(spaceId),
    [config?.notificationSettings, spaceId]
  );

  // Local edit state for the multiselect. Seeded from the persisted settings
  // and re-synced whenever the persisted value changes (e.g. a config sync
  // lands while the modal is open) UNLESS the user has a pending unsaved edit.
  const [selectedTypes, setSelectedTypes] = useState<SpaceNotificationTypeId[]>(
    () => settings.enabledNotificationTypes
  );
  const [isSaving, setIsSaving] = useState(false);

  // Tracks whether the user has locally changed the selection since it was last
  // synced from config. While dirty, incoming config changes don't overwrite
  // the in-progress edit; a successful Save resets this.
  const isDirtyRef = useRef(false);
  const handleSetSelectedTypes = useCallback(
    (types: SpaceNotificationTypeId[]) => {
      isDirtyRef.current = true;
      setSelectedTypes(types);
    },
    []
  );

  // Re-sync local selection from the persisted value when config updates and the
  // user has no pending edit. Keeps the displayed selection fresh after a
  // cross-device sync without stomping an in-progress local change.
  const persistedTypes = settings.enabledNotificationTypes;
  useEffect(() => {
    if (isDirtyRef.current) return;
    setSelectedTypes((prev) =>
      sameTypes(prev, persistedTypes) ? prev : persistedTypes
    );
  }, [persistedTypes]);

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

      // Clobber guard: if the selection matches what's already persisted, there
      // is nothing to write. This protects against the no-op Save that would
      // otherwise POST the current (now always-fresh) value back. Combined with
      // the reactive read above, a Save can no longer overwrite a value set on
      // another device with a stale desktop default.
      if (sameTypes(selectedTypes, currentSettings.enabledNotificationTypes)) {
        isDirtyRef.current = false;
        return;
      }

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

      // Optimistically update React Query cache for instant UI feedback. The
      // derived `settings` value re-reads from this cache, so the UI reflects
      // the save immediately without separate local state.
      queryClient.setQueryData(
        buildConfigKey({ userAddress }),
        updatedConfig
      );

      // The local selection now matches what we just persisted optimistically;
      // clear the dirty flag so future config syncs are free to re-seed it.
      isDirtyRef.current = false;

      // Queue config save in background (encrypt + sign + post + IndexedDB).
      // Fire-and-forget keeps the modal responsive; the optimistic cache update
      // already gave the UI its instant feedback. On failure, restore the cache
      // (which reverts the derived `settings`) so the UI matches what persisted.
      actionQueueService
        .enqueue(
          'save-user-config',
          { config: updatedConfig },
          `config:${userAddress}` // Dedup key - collapses with other config writes
        )
        .catch((err) => {
          logger.error('[NotificationSettings] enqueue failed for saveSettings, rolling back', err);
          queryClient.setQueryData(buildConfigKey({ userAddress }), currentConfig);
          showError(t`Failed to save notification setting`);
        });
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
    setSelectedTypes: handleSetSelectedTypes,
    // Config is read via a suspense query, so by the time this hook's consumer
    // renders the value is already resolved — there is no separate loading
    // phase. Kept in the return for API compatibility with the modal.
    isLoading: false,
    saveSettings,
    isSaving,
  };
}
