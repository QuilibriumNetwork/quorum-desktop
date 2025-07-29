import { useState, useEffect, useRef } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistration } from '../../queries';
import { useRegistrationContext } from '../../../components/context/RegistrationPersister';
import { useMessageDB } from '../../../components/context/MessageDB';
import { UserConfig } from '../../../db/messages';
import { DefaultImages } from '../../../utils';

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
}

export const useUserSettings = (
  options: UseUserSettingsOptions = {}
): UseUserSettingsReturn => {
  const { currentPasskeyInfo, updateStoredPasskey, exportKey } = usePasskeysContext();
  const [displayName, setDisplayName] = useState(currentPasskeyInfo?.displayName || '');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [allowSync, setAllowSync] = useState(false);
  const [nonRepudiable, setNonRepudiable] = useState(true);
  const [init, setInit] = useState(false);
  
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo?.address!,
  });
  const { keyset } = useRegistrationContext();
  const { saveConfig, getConfig, updateUserProfile } = useMessageDB();
  const existingConfig = useRef<UserConfig | null>(null);
  
  const [stagedRegistration, setStagedRegistration] = useState(registration?.registration);

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

    const profileImageUrl = currentFile && fileData
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

    // Save config
    await saveConfig({
      config: {
        ...existingConfig.current!,
        allowSync,
        nonRepudiable: nonRepudiable,
      },
      keyset: keyset,
    });

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
  };
};