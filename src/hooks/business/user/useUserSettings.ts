import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistration, buildConfigKey } from '../../queries';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { BroadcastSpaceTag } from '@quilibrium/quorum-shared';
import { DefaultImages } from '../../../utils';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';
import { BackupService } from '../../../services/BackupService';
import { getDeviceName } from '../../../utils/deviceInfo';

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
  const [spaceTagId, setSpaceTagId] = useState<string | undefined>(undefined);
  const [init, setInit] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const { keyset } = useRegistrationContext();
  const { messageDB, actionQueueService, getConfig, updateUserProfile, setTypingConfig } = useMessageDB();
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
      (async () => {
        const config = await getConfig({
          address: currentPasskeyInfo.address,
          userKey: keyset.userKeyset,
        });
        setAllowSync(config?.allowSync ?? false);
        setNonRepudiable(config?.nonRepudiable ?? true);
        setDeliveryReceipts(config?.deliveryReceipts ?? false);
        setReadReceipts(config?.readReceipts ?? false);
        setTypingIndicatorsDM(config?.typingIndicatorsDM ?? false);
        setTypingIndicatorsSpaces(config?.typingIndicatorsSpaces ?? false);
        setGenerateYouTubePreviews(config?.generateYouTubePreviews ?? false);
        setBio(config?.bio ?? '');
        setSpaceTagId(config?.spaceTagId ?? undefined);
        const loadedNames = config?.deviceNames ?? {};
        setDeviceNames(loadedNames);
        setIsConfigLoaded(true);

        // Auto-name this device if it doesn't have a name yet
        const inboxAddress = keyset.deviceKeyset?.inbox_keyset?.inbox_address;
        if (inboxAddress && !loadedNames[inboxAddress]) {
          const autoName = await getDeviceName();
          const updatedNames = { ...loadedNames, [inboxAddress]: autoName };
          const updatedConfig = { ...config, deviceNames: updatedNames };
          setDeviceNames(updatedNames);
          actionQueueService.enqueue(
            'save-user-config',
            { config: updatedConfig },
            `config:${currentPasskeyInfo.address}`
          );
        }
      })();
    }
  }, [init, currentPasskeyInfo, getConfig, keyset, actionQueueService]);

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
    return await exportKey(currentPasskeyInfo.address);
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

    // Update user profile in message DB
    updateUserProfile(
      displayName,
      profileImageUrl ?? DefaultImages.UNKNOWN_USER,
      currentPasskeyInfo,
      resolvedSpaceTag
    );

    // Fetch fresh config to avoid overwriting changes from other devices
    const freshConfig = await getConfig({
      address: currentPasskeyInfo.address,
      userKey: keyset.userKeyset,
    });
    const newConfig = {
      ...freshConfig,
      allowSync,
      nonRepudiable: nonRepudiable,
      deliveryReceipts,
      readReceipts,
      typingIndicatorsDM,
      typingIndicatorsSpaces,
      generateYouTubePreviews,
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

    await actionQueueService.enqueue(
      'save-user-config',
      { config: newConfig },
      `config:${currentPasskeyInfo.address}` // Dedup key
    );

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
