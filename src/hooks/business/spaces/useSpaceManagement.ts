import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistrationContext } from '../../../components/context/RegistrationPersister';
import { useMessageDB } from '../../../components/context/MessageDB';
import { useSpace } from '../../queries';

export interface UseSpaceManagementOptions {
  spaceId: string;
  onClose?: () => void;
}

export interface UseSpaceManagementReturn {
  spaceName: string;
  setSpaceName: (name: string) => void;
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
  isRepudiable: boolean;
  setIsRepudiable: (isRepudiable: boolean) => void;
  saving: boolean;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  saveChanges: (iconData?: ArrayBuffer, currentIconFile?: File, bannerData?: ArrayBuffer, currentBannerFile?: File) => Promise<void>;
  handleDeleteSpace: () => Promise<void>;
  isOwner: boolean;
  currentPasskeyInfo: any;
}

export const useSpaceManagement = (
  options: UseSpaceManagementOptions
): UseSpaceManagementReturn => {
  const { spaceId, onClose } = options;
  
  const [spaceName, setSpaceName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isRepudiable, setIsRepudiable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  
  const { updateSpace, deleteSpace } = useMessageDB();
  const { currentPasskeyInfo } = usePasskeysContext();
  const { keyset } = useRegistrationContext();
  const { data: space } = useSpace({ spaceId });
  const navigate = useNavigate();

  // Update states when space data loads (only once)
  useEffect(() => {
    if (space) {
      setSpaceName(space.spaceName || '');
      setIsRepudiable(space.isRepudiable || false);
    }
  }, [space?.spaceId]); // Only run when space ID changes, not when state changes

  const saveChanges = useCallback(async (
    iconData?: ArrayBuffer, 
    currentIconFile?: File, 
    bannerData?: ArrayBuffer, 
    currentBannerFile?: File
  ) => {
    if (!spaceName.trim() || !space) return;
    
    setSaving(true);
    try {
      const iconUrl = iconData && currentIconFile
        ? 'data:' + currentIconFile.type + ';base64,' + Buffer.from(iconData).toString('base64')
        : space.iconUrl;

      const bannerUrl = bannerData && currentBannerFile
        ? 'data:' + currentBannerFile.type + ';base64,' + Buffer.from(bannerData).toString('base64')
        : space.bannerUrl;

      await updateSpace({
        ...space,
        spaceName,
        iconUrl,
        bannerUrl,
        isRepudiable,
      });
      
      onClose?.();
    } catch (error) {
      console.error('Failed to update space:', error);
    } finally {
      setSaving(false);
    }
  }, [spaceName, space, isRepudiable, updateSpace, onClose]);

  const handleDeleteSpace = useCallback(async () => {
    try {
      console.log('Attempting to delete space with ID:', spaceId, 'Type:', typeof spaceId);
      
      if (!spaceId || typeof spaceId !== 'string') {
        throw new Error(`Invalid spaceId: ${spaceId} (type: ${typeof spaceId})`);
      }
      
      await deleteSpace(spaceId);
      navigate('/');
      onClose?.();
    } catch (error) {
      console.error('Failed to delete space:', error);
      console.error('Space ID was:', spaceId);
    }
  }, [deleteSpace, spaceId, navigate, onClose]);

  // Determine if current user is owner (simplified logic)
  const isOwner = true; // For now, assume user is owner - would need proper implementation

  return {
    spaceName,
    setSpaceName,
    isPublic,
    setIsPublic,
    isRepudiable,
    setIsRepudiable,
    saving,
    selectedCategory,
    setSelectedCategory,
    saveChanges,
    handleDeleteSpace,
    isOwner,
    currentPasskeyInfo,
  };
};