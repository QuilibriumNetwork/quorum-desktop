import { logger } from '@quilibrium/quorum-shared';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useRegistrationContext } from '../../../components/context/useRegistrationContext';
import { useMessageDB } from '../../../components/context/useMessageDB';
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
  saveEditHistory: boolean;
  setSaveEditHistory: (saveEditHistory: boolean) => void;
  saving: boolean;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  saveChanges: (
    iconData?: ArrayBuffer,
    currentIconFile?: File,
    bannerData?: ArrayBuffer,
    currentBannerFile?: File
  ) => Promise<void>;
  handleDeleteSpace: () => Promise<void>;
  isOwner: boolean;
  currentPasskeyInfo: any;
  deleteError: string | null;
  clearDeleteError: () => void;
  isDeleting: boolean;
}

export const useSpaceManagement = (
  options: UseSpaceManagementOptions
): UseSpaceManagementReturn => {
  const { spaceId, onClose } = options;

  const [spaceName, setSpaceName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isRepudiable, setIsRepudiable] = useState(false);
  const [saveEditHistory, setSaveEditHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      setSaveEditHistory(space.saveEditHistory ?? false);
    }
  }, [space?.spaceId]); // Only run when space ID changes, not when state changes

  const saveChanges = useCallback(
    async (
      iconData?: ArrayBuffer,
      currentIconFile?: File,
      bannerData?: ArrayBuffer,
      currentBannerFile?: File
    ) => {
      if (!spaceName.trim() || !space) return;

      setSaving(true);
      try {
        const iconUrl =
          iconData && currentIconFile
            ? 'data:' +
              currentIconFile.type +
              ';base64,' +
              Buffer.from(iconData).toString('base64')
            : space.iconUrl;

        const bannerUrl =
          bannerData && currentBannerFile
            ? 'data:' +
              currentBannerFile.type +
              ';base64,' +
              Buffer.from(bannerData).toString('base64')
            : space.bannerUrl;

        await updateSpace({
          ...space,
          spaceName,
          iconUrl,
          bannerUrl,
          isRepudiable,
          saveEditHistory,
        });

        onClose?.();
      } catch (error) {
        console.error('Failed to update space:', error);
      } finally {
        setSaving(false);
      }
    },
    [spaceName, space, isRepudiable, saveEditHistory, updateSpace, onClose]
  );

  const handleDeleteSpace = useCallback(async () => {
    setDeleteError(null);
    try {
      logger.log(
        'Attempting to delete space with ID:',
        spaceId,
        'Type:',
        typeof spaceId
      );

      if (!spaceId || typeof spaceId !== 'string') {
        throw new Error(
          `Invalid spaceId: ${spaceId} (type: ${typeof spaceId})`
        );
      }

      // Check if space has channels - prevent deletion if channels exist
      if (space?.groups) {
        const totalChannelCount = space.groups.reduce(
          (total, group) => total + (group.channels?.length || 0),
          0
        );

        if (totalChannelCount > 0) {
          setDeleteError('channels-exist');
          return;
        }
      }

      // Show deleting overlay before starting crypto operations
      setIsDeleting(true);

      await deleteSpace(spaceId);
      navigate('/');
      onClose?.();
    } catch (error) {
      console.error('Failed to delete space:', error);
      console.error('Space ID was:', spaceId);
      setDeleteError('unknown');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteSpace, spaceId, navigate, onClose, space]);

  const clearDeleteError = useCallback(() => {
    setDeleteError(null);
  }, []);

  // Determine if current user is owner (simplified logic)
  const isOwner = true; // For now, assume user is owner - would need proper implementation

  return {
    spaceName,
    setSpaceName,
    isPublic,
    setIsPublic,
    isRepudiable,
    setIsRepudiable,
    saveEditHistory,
    setSaveEditHistory,
    saving,
    selectedCategory,
    setSelectedCategory,
    saveChanges,
    handleDeleteSpace,
    isOwner,
    currentPasskeyInfo,
    deleteError,
    clearDeleteError,
    isDeleting,
  };
};
