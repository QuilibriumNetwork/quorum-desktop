import { useState } from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessageDB } from '../../../components/context/MessageDB';
import { useRegistrationContext } from '../../../components/context/RegistrationPersister';
import { useRegistration } from '../../queries';
import { DefaultImages } from '../../../utils';

export interface UseSpaceCreationOptions {
  onSuccess?: () => void;
}

export interface UseSpaceCreationReturn {
  spaceName: string;
  setSpaceName: (name: string) => void;
  creating: boolean;
  createSpace: (
    spaceName: string,
    fileData?: ArrayBuffer,
    currentFile?: File,
    repudiable?: boolean,
    pub?: boolean
  ) => Promise<void>;
  canCreate: boolean;
}

export const useSpaceCreation = (
  options: UseSpaceCreationOptions = {}
): UseSpaceCreationReturn => {
  const [spaceName, setSpaceName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const navigate = useNavigate();
  const { createSpace: createSpaceAPI } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: registration } = useRegistration({
    address: currentPasskeyInfo!.address,
  });

  const createSpace = async (
    name: string,
    fileData?: ArrayBuffer,
    currentFile?: File,
    repudiable: boolean = false,
    pub: boolean = true
  ) => {
    if (!name || creating) return;

    setCreating(true);

    try {
      const iconData = fileData && currentFile
        ? 'data:' +
          currentFile.type +
          ';base64,' +
          Buffer.from(fileData).toString('base64')
        : DefaultImages.UNKNOWN_USER;

      const { spaceId, channelId } = await createSpaceAPI(
        name,
        iconData,
        keyset,
        registration.registration!,
        repudiable,
        pub,
        currentPasskeyInfo?.pfpUrl!,
        currentPasskeyInfo?.displayName!
      );

      navigate(`/spaces/${spaceId}/${channelId}`);
      options.onSuccess?.();
    } finally {
      setCreating(false);
    }
  };

  const canCreate = !!spaceName && !creating;

  return {
    spaceName,
    setSpaceName,
    creating,
    createSpace,
    canCreate,
  };
};