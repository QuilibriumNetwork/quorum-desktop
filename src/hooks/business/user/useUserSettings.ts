import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistration, buildConfigKey } from '../../queries';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { type BroadcastSpaceTag, logger } from '@quilibrium/quorum-shared';
import type { UserConfig } from '../../../db/messages';
import { DefaultImages } from '../../../utils';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { BackupService } from '../../../services/BackupService';
import { PublicProfileService } from '../../../services/PublicProfileService';
import { QuorumApiClient } from '../../../api/baseTypes';
import type { PublicProfileResponse } from '../../../api/baseTypes';
import { publicProfileQueryKey } from './useUserPublicProfile';
import { getDeviceName } from '../../../utils/deviceInfo';
import { showError } from '../../../utils/toast';
import { normalizePrivateKeyHex } from '../../../utils/privateKey';

export interface UseUserSettingsOptions {
  onSave?: () => void;
}

export interface UseUserSettingsReturn {
  displayName: string;
  setDisplayName: (name: string) => void;
  bio: string;
  setBio: (bio: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  allowSync: boolean;
  setAllowSync: (allow: boolean) => void;
  nonRepudiable: boolean;
  setNonRepudiable: (repudiable: boolean) => void;
  deliveryReceipts: boolean;
  setDeliveryReceipts: (value: boolean) => void;
  readReceipts: boolean;
  setReadReceipts: (value: boolean) => void;
  typingIndicatorsDM: boolean;
  setTypingIndicatorsDM: (value: boolean) => void;
  typingIndicatorsSpaces: boolean;
  setTypingIndicatorsSpaces: (value: boolean) => void;
  generateYouTubePreviews: boolean;
  setGenerateYouTubePreviews: (value: boolean) => void;
  isProfilePublic: boolean;
  setIsProfilePublic: (value: boolean) => void;
  spaceTagId: string | undefined;
  setSpaceTagId: (id: string | undefined) => void;
  saveChanges: (fileData?: ArrayBuffer, currentFile?: File, markedForDeletion?: boolean) => Promise<void>;
  currentPasskeyInfo: any;
  stagedRegistration: any;
  setStagedRegistration: (registration: any) => void;
  removeDevice: (identityKey: string) => void;
  downloadKey: () => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<{ messagesWritten: number; conversationsWritten: number }>;
  getPrivateKeyHex: () => Promise<string>;
  saveDeviceName: (name: string) => Promise<void>;
  deviceNames: { [inboxAddress: string]: string };
  keyset: any;
  removedDevices: string[];
  isConfigLoaded: boolean;
}

export const useUserSettings = (
  options: UseUserSettingsOptions = {}
): UseUserSettingsReturn => {
  const { currentPasskeyInfo, updateStoredPasskey, exportKey } =
    usePasskeysContext();
  const [displayName, setDisplayName] = useState(
    currentPasskeyInfo?.displayName || ''
  );
  const [bio, setBio] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [allowSync, setAllowSync] = useState(false);
  const [nonRepudiable, setNonRepudiable] = useState(true);
  const [deliveryReceipts, setDeliveryReceipts] = useState(false);
  const [readReceipts, setReadReceipts] = useState(false);
  const [typingIndicatorsDM, setTypingIndicatorsDM] = useState(false);
  const [typingIndicatorsSpaces, setTypingIndicatorsSpaces] = useState(false);
  const [generateYouTubePreviews, setGenerateYouTubePreviews] = useState(false);
  const [isProfilePublic, setIsProfilePublic] = useState(false);
  const [spaceTagId, setSpaceTagId] = useState<string | undefined>(undefined);
  const [init, setInit] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const { keyset } = useRegistrationContext();
  const { messageDB, actionQueueService, getConfig, updateUserProfile, setTypingConfig, broadcastDeviceRevocations } = useMessageDB();
  const queryClient = useQueryClient();
  const uploadRegistration = useUploadRegistration();

  const [stagedRegistration, setStagedRegistration] = useState(
    registration?.registration
  );
  const [removedDevices, setRemovedDevices] = useState<string[]>([]);
  const [pendingTombstones, setPendingTombstones] = useState<string[]>([]);
  const [deviceNames, setDeviceNames] = useState<{ [inboxAddress: string]: string }>({});

  // Update staged registration when registration data becomes available
  useEffect(() => {
    if (registration?.registration && !stagedRegistration) {
      setStagedRegistration(registration.registration);
    }
  }, [registration, stagedRegistration]);

  // Initialize settings from config
  useEffect(() => {
    if (!init && currentPasskeyInfo) {
      setInit(true);

      // Prefer the React Query cache snapshot when present. The cache is
      // updated optimistically on every save (see saveChanges below), and
      // saves are queued through the action queue — between enqueue and
      // the queue draining to IndexedDB there is a window where getConfig
      // would return stale data. Reading the cache first eliminates that
      // window for the common case (reopen the modal right after a save).
      // On cold start the cache is empty and we fall back to getConfig.
      const cachedConfig = queryClient.getQueryData<UserConfig>(
        buildConfigKey({ userAddress: currentPasskeyInfo.address })
      );

      const applyConfig = (config: UserConfig | undefined) => {
        setAllowSync(config?.allowSync ?? false);
        setNonRepudiable(config?.nonRepudiable ?? true);
        setDeliveryReceipts(config?.deliveryReceipts ?? false);
        setReadReceipts(config?.readReceipts ?? false);
        setTypingIndicatorsDM(config?.typingIndicatorsDM ?? false);
        setTypingIndicatorsSpaces(config?.typingIndicatorsSpaces ?? false);
        setGenerateYouTubePreviews(config?.generateYouTubePreviews ?? false);
        // Hydrate the display name from config (saveChanges writes it as
        // `name`). Without this the field only reflected
        // currentPasskeyInfo.displayName at mount and stayed empty whenever
        // that was blank — even though the name was set and synced elsewhere.
        // Only overwrite when config actually carries a name, so we don't blank
        // a good passkey-seeded value with an empty config.
        if (config?.name !== undefined) {
          setDisplayName(config.name);
        }
        setBio(config?.bio ?? '');
        setIsProfilePublic(config?.isProfilePublic ?? false);
        setSpaceTagId(config?.spaceTagId ?? undefined);
        const loadedNames = config?.deviceNames ?? {};
        setDeviceNames(loadedNames);
        setIsConfigLoaded(true);
      };

      if (cachedConfig) {
        applyConfig(cachedConfig);
        return;
      }

      (async () => {
        const config = await getConfig({
          address: currentPasskeyInfo.address,
          userKey: keyset.userKeyset,
        });
        applyConfig(config);

        // Auto-name this device if it doesn't have a name yet
        const inboxAddress = keyset.deviceKeyset?.inbox_keyset?.inbox_address;
        const loadedNames = config?.deviceNames ?? {};
        if (inboxAddress && !loadedNames[inboxAddress]) {
          const autoName = await getDeviceName();
          const updatedNames = { ...loadedNames, [inboxAddress]: autoName };
          const updatedConfig = { ...config, deviceNames: updatedNames };
          setDeviceNames(updatedNames);
          // Log-only on failure: this is a one-shot first-run autoname with no
          // user action behind it. Toast would be confusing; the next session
          // start will re-attempt since loadedNames still won't have the entry.
          actionQueueService
            .enqueue(
              'save-user-config',
              { config: updatedConfig },
              `config:${currentPasskeyInfo.address}`
            )
            .catch((err) => {
              logger.error('[UserSettings] enqueue failed for auto-device-name', err);
            });
        }
      })();
    }
  }, [init, currentPasskeyInfo, getConfig, keyset, actionQueueService, queryClient]);

  const removeDevice = (identityKey: string) => {
    // Find inbox address before removing from staged registration
    const device = stagedRegistration?.device_registrations?.find(
      (d: any) => d.identity_public_key === identityKey
    );
    if (device?.inbox_registration?.inbox_address) {
      setPendingTombstones(prev => [...prev, device.inbox_registration.inbox_address]);
    }

    setStagedRegistration((reg: any) => {
      return {
        ...reg!,
        device_registrations: reg!.device_registrations.filter(
          (d: any) => d.identity_public_key !== identityKey
        ),
      };
    });

    setRemovedDevices(prev => [...prev, identityKey]);
  };

  const saveDeviceName = async (name: string) => {
    if (!currentPasskeyInfo || !keyset?.userKeyset) return;

    const inboxAddress = keyset.deviceKeyset?.inbox_keyset?.inbox_address;
    if (!inboxAddress) return;

    const freshConfig = await getConfig({
      address: currentPasskeyInfo.address,
      userKey: keyset.userKeyset,
    });

    const updatedNames = {
      ...(freshConfig?.deviceNames ?? {}),
      [inboxAddress]: name,
    };

    const updatedConfig = {
      ...freshConfig,
      deviceNames: updatedNames,
    };

    await actionQueueService.enqueue(
      'save-user-config',
      { config: updatedConfig },
      `config:${currentPasskeyInfo.address}`
    );

    // Update local state immediately
    setDeviceNames(updatedNames);
  };

  const downloadKey = async () => {
    if (!currentPasskeyInfo) return;

    const content = await exportKey(currentPasskeyInfo.address);
    const fileName = currentPasskeyInfo.address + '.key';
    const blob = new Blob([content], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getPrivateKeyHex = async (): Promise<string> => {
    if (!currentPasskeyInfo) throw new Error('No passkey info available');
    const raw = await exportKey(currentPasskeyInfo.address);
    return normalizePrivateKeyHex(raw);
  };

  const exportBackup = async () => {
    if (!currentPasskeyInfo || !keyset?.userKeyset) return;

    const backupService = new BackupService({ messageDB });
    const blob = await backupService.exportBackup({
      keyset: keyset.userKeyset,
      address: currentPasskeyInfo.address,
    });

    // Generate filename: quorum_backup_YYYYMMDD_HHMMSS_XXXXXX.qmbak
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const addressSuffix = currentPasskeyInfo.address.slice(-6);
    const filename = `quorum_backup_${timestamp}_${addressSuffix}.qmbak`;

    // Download using same DOM pattern as downloadKey
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File): Promise<{ messagesWritten: number; conversationsWritten: number }> => {
    if (!keyset?.userKeyset) throw new Error('No keyset available');

    const fileContent = await file.text();
    const backupService = new BackupService({ messageDB });
    return backupService.importBackup({
      keyset: keyset.userKeyset,
      fileContent,
    });
  };

  const saveChanges = async (fileData?: ArrayBuffer, currentFile?: File, markedForDeletion?: boolean) => {
    if (!currentPasskeyInfo) return;

    // Determine profile image URL: deletion clears it, new file uses data URL, otherwise keep existing
    let profileImageUrl: string;
    if (markedForDeletion) {
      profileImageUrl = DefaultImages.UNKNOWN_USER;
    } else if (currentFile && fileData) {
      profileImageUrl =
        'data:' +
        currentFile.type +
        ';base64,' +
        Buffer.from(fileData).toString('base64');
    } else {
      profileImageUrl = currentPasskeyInfo.pfpUrl ?? DefaultImages.UNKNOWN_USER;
    }

    // Update stored passkey
    updateStoredPasskey(currentPasskeyInfo.credentialId, {
      credentialId: currentPasskeyInfo.credentialId,
      address: currentPasskeyInfo.address,
      publicKey: currentPasskeyInfo.publicKey,
      displayName: displayName,
      pfpUrl: profileImageUrl,
      completedOnboarding: true,
    });

    // Resolve spaceTagId to full BroadcastSpaceTag for broadcast
    let resolvedSpaceTag: BroadcastSpaceTag | undefined;
    if (spaceTagId) {
      try {
        const spaces = await messageDB.getSpaces();
        const tagSpace = spaces.find((s) => s.spaceId === spaceTagId);
        if (tagSpace?.spaceTag?.letters) {
          resolvedSpaceTag = { ...tagSpace.spaceTag, spaceId: tagSpace.spaceId };
        }
      } catch {
        // Non-blocking: tag won't appear but profile still saves
      }
    }

    // Fetch fresh config to avoid overwriting changes from other devices.
    // Reading this BEFORE the update-profile broadcast lets us compare the
    // current bio against the new one so we only re-broadcast bio when the
    // user actually edited it — otherwise an unrelated save (e.g. toggling
    // a notification preference) would re-broadcast the global bio to
    // every space, clobbering any per-space bio override the user has set.
    const freshConfig = await getConfig({
      address: currentPasskeyInfo.address,
      userKey: keyset.userKeyset,
    });

    // Update user profile in message DB
    const trimmedBio = bio.trim();
    const previousBio = (freshConfig?.bio ?? '').trim();
    const bioChanged = trimmedBio !== previousBio;
    updateUserProfile(
      displayName,
      profileImageUrl ?? DefaultImages.UNKNOWN_USER,
      currentPasskeyInfo,
      resolvedSpaceTag,
      bioChanged ? trimmedBio : undefined
    );
    const newConfig = {
      ...freshConfig,
      allowSync,
      nonRepudiable: nonRepudiable,
      deliveryReceipts,
      readReceipts,
      typingIndicatorsDM,
      typingIndicatorsSpaces,
      generateYouTubePreviews,
      isProfilePublic,
      name: displayName,
      profile_image: profileImageUrl,
      bio: bio.trim() || undefined,
      spaceTagId: spaceTagId || undefined,
      // Merge local device names (includes any recent renames not yet in DB)
      deviceNames: {
        ...(freshConfig?.deviceNames ?? {}),
        ...deviceNames,
      },
      // Merge pending tombstones with any existing ones
      deletedDeviceNameAddresses: [
        ...(freshConfig?.deletedDeviceNameAddresses ?? []),
        ...pendingTombstones,
      ],
    };

    // Optimistically update the React Query cache so the saved settings are
    // visible to any concurrent reader before the queue task drains. Without
    // this, code paths that read config from the cache (e.g. folder ops) can
    // pick up stale state during the queue's processing window.
    queryClient.setQueryData(
      buildConfigKey({ userAddress: currentPasskeyInfo.address }),
      newConfig
    );

    // Refresh our own public-profile cache: non-overridden spaces render our
    // name/avatar from it (1h staleTime), so a global change wouldn't reach
    // already-rendered messages otherwise. Set optimistically; refetch only when
    // public (a private profile 404s to null and would blank the value).
    {
      const key = publicProfileQueryKey(currentPasskeyInfo.address);
      queryClient.setQueryData<PublicProfileResponse | null>(key, (prev) => ({
        ...(prev ?? { signature: '' }),
        display_name: displayName,
        profile_image: profileImageUrl ?? '',
        bio: isProfilePublic ? bio.trim() : (prev?.bio ?? ''),
        timestamp: Date.now(),
      }) as PublicProfileResponse);
      if (isProfilePublic) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    }

    // Public profile publish/unpublish: best-effort. The local
    // isProfilePublic setting is the source of truth — server publish
    // success/failure does not gate it (mirrors mobile's pattern).
    //
    // Cases:
    //   isProfilePublic=true  → publish/republish with the new fields.
    //   isProfilePublic=false AND was previously true → unpublish (delete).
    //   isProfilePublic=false AND was previously false → no-op.
    //
    // Run BEFORE the fire-and-forget enqueue so the rollback `.catch`
    // below can observe whether the public-profile call already went
    // through and undo it if the local save then fails. Otherwise we'd
    // get an inconsistent state: the server has a published profile but
    // the local toggle says off, with no UI surfaced to fix it.
    const wasProfilePublic = freshConfig?.isProfilePublic === true;
    let publishedThisSave = false;
    let unpublishedThisSave = false;
    if (keyset?.userKeyset) {
      const publicProfileService = new PublicProfileService({
        apiClient: new QuorumApiClient(),
      });
      if (isProfilePublic) {
        try {
          await publicProfileService.publish(
            {
              address: currentPasskeyInfo.address,
              displayName: displayName,
              profileImage: profileImageUrl,
              bio: bio.trim(),
            },
            { userKeyset: keyset.userKeyset }
          );
          publishedThisSave = true;
        } catch (error) {
          logger.warn('[useUserSettings] publishPublicProfile failed', error);
        }
      } else if (wasProfilePublic) {
        try {
          await publicProfileService.unpublish(currentPasskeyInfo.address, {
            userKeyset: keyset.userKeyset,
          });
          unpublishedThisSave = true;
        } catch (error) {
          logger.warn('[useUserSettings] unpublishPublicProfile failed', error);
        }
      }
    }

    // Fire-and-forget enqueue with rollback: the optimistic cache update
    // earlier already surfaced the new config to readers. If enqueue
    // rejects (queue full, IDB write failure), restore the pre-update
    // snapshot, toast the user, and — critically — also revert any
    // public-profile mutation we just made above. Without that revert,
    // we'd leave the server with a published profile (or a missing one)
    // that no longer matches what the local source of truth shows,
    // with no UI surfaced to fix it.
    actionQueueService
      .enqueue(
        'save-user-config',
        { config: newConfig },
        `config:${currentPasskeyInfo.address}` // Dedup key
      )
      .catch((err) => {
        logger.error('[UserSettings] enqueue failed for saveChanges, rolling back', err);
        queryClient.setQueryData(
          buildConfigKey({ userAddress: currentPasskeyInfo.address }),
          freshConfig
        );
        showError(t`Failed to save settings`);

        // Best-effort revert of the public-profile mutation that already
        // succeeded against the server. We deliberately do NOT await this;
        // failure here is logged but doesn't escalate (we've already
        // surfaced the primary error to the user via the toast above).
        if (keyset?.userKeyset && (publishedThisSave || unpublishedThisSave)) {
          const svc = new PublicProfileService({ apiClient: new QuorumApiClient() });
          const revert = publishedThisSave
            ? svc.unpublish(currentPasskeyInfo.address, { userKeyset: keyset.userKeyset })
            : svc.publish(
                {
                  address: currentPasskeyInfo.address,
                  displayName: freshConfig?.name ?? '',
                  profileImage: freshConfig?.profile_image ?? '',
                  bio: (freshConfig?.bio ?? '').trim(),
                },
                { userKeyset: keyset.userKeyset }
              );
          revert.catch((revertErr) => {
            logger.warn(
              '[useUserSettings] public-profile revert after enqueue failure also failed',
              revertErr
            );
          });
        }
      });

    // Update TypingService gate immediately so toggle-OFF doesn't wait for
    // the action queue / IndexedDB round-trip. On ON→OFF transitions this
    // also clears any active outbound typing sessions and received typists
    // of the affected kind.
    setTypingConfig(typingIndicatorsDM, typingIndicatorsSpaces);

    // If devices were removed, reconstruct and upload the registration
    if (removedDevices.length > 0 && stagedRegistration) {
      // Reconstruct the registration with the updated device list
      // This ensures proper signing of the modified registration
      const updatedRegistration = await secureChannel.ConstructUserRegistration(
        keyset.userKeyset,
        stagedRegistration.device_registrations,
        [] // No new devices to add
      );

      await uploadRegistration({
        address: currentPasskeyInfo.address,
        registration: updatedRegistration,
      });

      // Broadcast master-signed revoke-device tombstones for the removed
      // devices across every space, so receivers stop admitting their
      // per-device signing keys. pendingTombstones holds exactly the removed
      // devices' DM inbox addresses (the revocation handle). Fire-and-forget;
      // failures are logged inside the service (offline receivers catch up on
      // the next re-announce). Cleared alongside the other tombstones below.
      broadcastDeviceRevocations(pendingTombstones).catch((err) => {
        logger.warn('[UserSettings] broadcastDeviceRevocations failed', err);
      });

      // Clear the removed devices list after successful save
      setRemovedDevices([]);
    }

    setPendingTombstones([]);

    options.onSave?.();
  };

  return {
    displayName,
    setDisplayName,
    bio,
    setBio,
    selectedCategory,
    setSelectedCategory,
    allowSync,
    setAllowSync,
    nonRepudiable,
    setNonRepudiable,
    deliveryReceipts,
    setDeliveryReceipts,
    readReceipts,
    setReadReceipts,
    typingIndicatorsDM,
    setTypingIndicatorsDM,
    typingIndicatorsSpaces,
    setTypingIndicatorsSpaces,
    generateYouTubePreviews,
    setGenerateYouTubePreviews,
    isProfilePublic,
    setIsProfilePublic,
    spaceTagId,
    setSpaceTagId,
    saveChanges,
    currentPasskeyInfo,
    stagedRegistration,
    setStagedRegistration,
    removeDevice,
    saveDeviceName,
    deviceNames,
    downloadKey,
    exportBackup,
    importBackup,
    getPrivateKeyHex,
    keyset,
    removedDevices,
    isConfigLoaded,
  };
};
