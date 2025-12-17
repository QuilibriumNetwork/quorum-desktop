import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { useConfig, buildConfigKey } from '../../queries';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { NavItem, UserConfig } from '../../../db/messages';
import { IconName, IconVariant } from '../../../components/primitives/Icon/types';
import { IconColor } from '../../../components/space/IconPicker/types';
import { createFolder, deriveSpaceIds } from '../../../utils/folderUtils';
import { validateNameForXSS, MAX_NAME_LENGTH } from '../../../utils/validation';
import { useDeleteFolder } from './useDeleteFolder';

interface UseFolderManagementProps {
  folderId?: string;
}

export const useFolderManagement = ({
  folderId,
}: UseFolderManagementProps) => {
  const user = usePasskeysContext();
  const queryClient = useQueryClient();
  const { data: config } = useConfig({
    userAddress: user.currentPasskeyInfo?.address || '',
  });
  const { actionQueueService, keyset } = useMessageDB();
  const { deleteFolder: deleteFolderById } = useDeleteFolder();

  // Find existing folder if editing
  const existingFolder = useMemo(() => {
    if (!folderId || !config?.items) return null;
    const item = config.items.find(
      (i) => i.type === 'folder' && i.id === folderId
    );
    return item?.type === 'folder' ? item : null;
  }, [folderId, config?.items]);

  const isEditMode = !!existingFolder;

  // Form state
  const [name, setName] = useState(existingFolder?.name || 'Spaces');
  const [icon, setIcon] = useState<IconName | undefined>(
    existingFolder?.icon || 'folder'
  );
  const [iconColor, setIconColor] = useState<IconColor>(
    existingFolder?.color || 'default'
  );
  const [iconVariant, setIconVariant] = useState<IconVariant>('filled');
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState(0);

  // Sync with existing folder when it changes
  useEffect(() => {
    if (existingFolder) {
      setName(existingFolder.name);
      setIcon(existingFolder.icon || 'folder');
      setIconColor(existingFolder.color || 'default');
    }
  }, [existingFolder]);

  // Reset delete confirmation after timeout
  useEffect(() => {
    if (deleteConfirmationStep > 0) {
      const timeout = setTimeout(() => {
        setDeleteConfirmationStep(0);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [deleteConfirmationStep]);

  // Validation - same rules as space names (XSS + length)
  const validationError = useMemo(() => {
    if (!name.trim()) {
      return t`Folder name is required`;
    }
    if (name.length > MAX_NAME_LENGTH) {
      return t`Folder name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    if (!validateNameForXSS(name)) {
      return t`Folder name cannot contain special characters`;
    }
    return null;
  }, [name]);

  const canSave = !validationError;

  // Handlers
  const handleNameChange = useCallback((value: string) => {
    setName(value);
  }, []);

  const handleIconChange = useCallback(
    (newIcon: IconName | null, newColor: IconColor, newVariant: IconVariant) => {
      setIcon(newIcon || 'folder');
      setIconColor(newColor);
      setIconVariant(newVariant);
    },
    []
  );

  const saveChanges = useCallback(async () => {
    if (!config || !keyset || !canSave) return;

    const now = Date.now();
    let newItems: NavItem[];

    if (isEditMode && existingFolder) {
      // Update existing folder
      newItems = (config.items || []).map((item) => {
        if (item.type === 'folder' && item.id === folderId) {
          return {
            ...item,
            name: name.trim(),
            icon,
            color: iconColor,
            modifiedDate: now,
          };
        }
        return item;
      });
    } else {
      // This shouldn't happen in the modal (folders created via drag)
      // But handle it for completeness - see bug report: folder-editor-modal-race-condition.md
      const folder = createFolder(name.trim(), [], icon, iconColor);
      newItems = [...(config.items || []), folder];
    }

    const newConfig: UserConfig = {
      ...config,
      items: newItems,
      spaceIds: deriveSpaceIds(newItems),
    };

    // Optimistically update React Query cache for instant UI feedback
    if (config.address) {
      queryClient.setQueryData(
        buildConfigKey({ userAddress: config.address }),
        newConfig
      );
    }

    // Queue config save in background
    await actionQueueService.enqueue(
      'save-user-config',
      { config: newConfig, keyset },
      `config:${config.address}` // Dedup key
    );
  }, [
    config,
    keyset,
    canSave,
    isEditMode,
    existingFolder,
    folderId,
    name,
    icon,
    iconColor,
    actionQueueService,
    queryClient,
  ]);

  // Delete folder - wrapper around shared hook
  const deleteFolder = useCallback(async () => {
    if (!folderId) return;
    await deleteFolderById(folderId);
  }, [folderId, deleteFolderById]);

  // Handle delete click - returns true if confirmed (second click)
  const handleDeleteClick = useCallback(() => {
    if (deleteConfirmationStep === 0) {
      setDeleteConfirmationStep(1);
      return false;
    }
    return true;
  }, [deleteConfirmationStep]);

  return {
    // State
    name,
    icon,
    iconColor,
    iconVariant,
    isEditMode,
    canSave,
    validationError,
    deleteConfirmationStep,
    spaceCount: existingFolder?.spaceIds.length || 0,

    // Handlers
    handleNameChange,
    handleIconChange,
    saveChanges,
    handleDeleteClick,
    deleteFolder,
  };
};
