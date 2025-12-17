import { useState, useEffect, useRef } from 'react';
import { usePasskeysContext, channel as secureChannel } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistration } from '../../queries';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { UserConfig } from '../../../db/messages';
import { DefaultImages } from '../../../utils';
import { useUploadRegistration } from '../../mutations/useUploadRegistration';

export interface UseUserSettingsOptions {
  onSave?: () => void;
}

export interface UseUserSettingsReturn {
  displayName: string;
  setDisplayName: (name: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  allowSync: boolean;
  setAllowSync: (allow: boolean) => void;
  nonRepudiable: boolean;
  setNonRepudiable: (repudiable: boolean) => void;
  saveChanges: (fileData?: ArrayBuffer, currentFile?: File) => Promise<void>;
  currentPasskeyInfo: any;
  stagedRegistration: any;
  setStagedRegistration: (registration: any) => void;
  removeDevice: (identityKey: string) => void;
  downloadKey: () => Promise<void>;
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
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [allowSync, setAllowSync] = useState(false);
  const [nonRepudiable, setNonRepudiable] = useState(true);
  const [init, setInit] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const { keyset } = useRegistrationContext();
  const { actionQueueService, getConfig, updateUserProfile } = useMessageDB();
  const uploadRegistration = useUploadRegistration();
  const existingConfig = useRef<UserConfig | null>(null);

  const [stagedRegistration, setStagedRegistration] = useState(
    registration?.registration
  );
  const [removedDevices, setRemovedDevices] = useState<string[]>([]);

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
        existingConfig.current = config;
        setAllowSync(config?.allowSync ?? false);
        setNonRepudiable(config?.nonRepudiable ?? true);
        setIsConfigLoaded(true);
      })();
    }
  }, [init, currentPasskeyInfo, getConfig, keyset]);

  const removeDevice = (identityKey: string) => {
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

  const saveChanges = async (fileData?: ArrayBuffer, currentFile?: File) => {
    if (!currentPasskeyInfo) return;

    const profileImageUrl =
      currentFile && fileData
        ? 'data:' +
          currentFile.type +
          ';base64,' +
          Buffer.from(fileData).toString('base64')
        : currentPasskeyInfo.pfpUrl;

    // Update stored passkey
    updateStoredPasskey(currentPasskeyInfo.credentialId, {
      credentialId: currentPasskeyInfo.credentialId,
      address: currentPasskeyInfo.address,
      publicKey: currentPasskeyInfo.publicKey,
      displayName: displayName,
      pfpUrl: profileImageUrl,
      completedOnboarding: true,
    });

    // Update user profile in message DB
    updateUserProfile(
      displayName,
      profileImageUrl ?? DefaultImages.UNKNOWN_USER,
      currentPasskeyInfo
    );

    // Queue config save in background - no more UI blocking!
    const newConfig = {
      ...existingConfig.current!,
      allowSync,
      nonRepudiable: nonRepudiable,
      name: displayName,
      profile_image: profileImageUrl,
    };
    await actionQueueService.enqueue(
      'save-user-config',
      { config: newConfig, keyset },
      `config:${currentPasskeyInfo.address}` // Dedup key
    );

    // If devices were removed, reconstruct and upload the registration
    if (removedDevices.length > 0 && stagedRegistration) {
      try {
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
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    }

    options.onSave?.();
  };

  return {
    displayName,
    setDisplayName,
    selectedCategory,
    setSelectedCategory,
    allowSync,
    setAllowSync,
    nonRepudiable,
    setNonRepudiable,
    saveChanges,
    currentPasskeyInfo,
    stagedRegistration,
    setStagedRegistration,
    removeDevice,
    downloadKey,
    keyset,
    removedDevices,
    isConfigLoaded,
  };
};
