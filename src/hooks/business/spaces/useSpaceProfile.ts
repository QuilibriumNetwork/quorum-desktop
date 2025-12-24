import { useState, useEffect, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { processAvatarImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { showError } from '../../../utils/toast';
import { useDisplayNameValidation } from '../validation';

export interface UseSpaceProfileOptions {
  spaceId: string;
  onSave?: () => void;
}

export interface UseSpaceProfileReturn {
  displayName: string;
  setDisplayName: (name: string) => void;
  fileData: ArrayBuffer | undefined;
  currentFile: File | undefined;
  avatarFileError: string | null;
  isAvatarUploading: boolean;
  isAvatarDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  getProfileImageUrl: () => string;
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasValidationError: boolean;
  displayNameError: string | undefined;
  currentMember: any;
}

export const useSpaceProfile = (
  options: UseSpaceProfileOptions
): UseSpaceProfileReturn => {
  const { spaceId, onSave: onSaveCallback } = options;
  const { currentPasskeyInfo } = usePasskeysContext();
  const { messageDB, submitChannelMessage } = useMessageDB();
  const queryClient = useQueryClient();

  const [currentMember, setCurrentMember] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [avatarFileError, setAvatarFileError] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Use proper display name validation (replaces basic validation)
  const displayNameValidation = useDisplayNameValidation(displayName);
  const hasValidationError = !!displayNameValidation.error;

  // Load current member data
  useEffect(() => {
    if (!currentPasskeyInfo?.address) return;

    (async () => {
      try {
        const member = await messageDB.getSpaceMember(spaceId, currentPasskeyInfo.address);
        setCurrentMember(member);
        // Initialize display name from member or fallback to global
        setDisplayName(member?.display_name || currentPasskeyInfo.displayName || '');
      } catch (error) {
        console.error('Failed to load space member:', error);
        // Fallback to global profile
        setDisplayName(currentPasskeyInfo.displayName || '');
      }
    })();
  }, [spaceId, currentPasskeyInfo?.address, messageDB]);

  // Dropzone for avatar upload
  const { getRootProps, getInputProps, isDragActive: isAvatarDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: FILE_SIZE_LIMITS.MAX_INPUT_SIZE, // 25MB
    onDropRejected: (fileRejections: FileRejection[]) => {
      setIsAvatarUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setAvatarFileError(t`File cannot be larger than 25MB`);
        } else {
          setAvatarFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsAvatarUploading(true);
      setAvatarFileError(null);
      setFileData(undefined);
      setCurrentFile(files[0]);
    },
    onDragEnter: () => {
      setIsAvatarUploading(true);
    },
    onDragLeave: () => {
      setIsAvatarUploading(false);
    },
    onFileDialogOpen: () => {
      setIsAvatarUploading(true);
    },
    onFileDialogCancel: () => {
      setIsAvatarUploading(false);
    },
  });

  // Process file to ArrayBuffer when file changes
  useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          const result = await processAvatarImage(currentFile);
          const arrayBuffer = await result.file.arrayBuffer();
          setFileData(arrayBuffer);
          setIsAvatarUploading(false);
          setAvatarFileError(null);
        } catch (error) {
          console.error('Error processing avatar image:', error);
          setAvatarFileError(
            error instanceof Error
              ? error.message
              : t`Unable to compress image. Please use a smaller image.`
          );
          setIsAvatarUploading(false);
        }
      })();
    }
  }, [currentFile]);

  // Display name validation is now handled by useDisplayNameValidation hook above

  const clearFileError = useCallback(() => {
    setAvatarFileError(null);
  }, []);

  const getProfileImageUrl = useCallback((): string => {
    if (fileData && currentFile) {
      return `data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')}`;
    }

    // Check if member has per-space avatar
    if (currentMember?.user_icon && !currentMember.user_icon.includes(DefaultImages.UNKNOWN_USER)) {
      return currentMember.user_icon;
    }

    // Fallback to global avatar
    if (
      currentPasskeyInfo?.pfpUrl &&
      !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)
    ) {
      return currentPasskeyInfo.pfpUrl;
    }

    return 'var(--unknown-icon)';
  }, [fileData, currentFile, currentMember, currentPasskeyInfo]);

  const onSave = useCallback(async () => {
    if (!currentPasskeyInfo || displayNameValidation.error) {
      return;
    }

    setIsSaving(true);
    try {
      // Validate inbox address exists
      const member = await messageDB.getSpaceMember(spaceId, currentPasskeyInfo.address);
      if (!member?.inbox_address) {
        throw new Error('Cannot update profile: missing inbox configuration');
      }

      // Prepare user icon - use new upload or keep existing
      let userIcon = member.user_icon || currentPasskeyInfo.pfpUrl || '';
      if (fileData && currentFile) {
        userIcon = `data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')}`;
      }

      // Get space's default channel
      const space = await messageDB.getSpace(spaceId);
      if (!space) {
        throw new Error('Space not found');
      }

      // Send update-profile message
      await submitChannelMessage(
        spaceId,
        space.defaultChannelId,
        {
          type: 'update-profile',
          senderId: currentPasskeyInfo.address,
          displayName: displayName.trim(),
          userIcon: userIcon,
        },
        queryClient,
        currentPasskeyInfo,
        undefined, // inReplyTo
        false, // skipSigning - must sign for security
        undefined // isSpaceOwner - not needed for profile updates
      );

      // Note: Cache is updated optimistically by MessageService.submitChannelMessage
      // No need to invalidate here - that would cause unnecessary refetch

      // Call the optional callback (which closes the modal)
      onSaveCallback?.();
    } catch (error) {
      console.error('Failed to update space profile:', error);

      // Show error toast
      showError(error instanceof Error ? error.message : t`Failed to update profile`);
    } finally {
      setIsSaving(false);
    }
  }, [
    currentPasskeyInfo,
    displayName,
    fileData,
    currentFile,
    spaceId,
    messageDB,
    submitChannelMessage,
    queryClient,
    onSaveCallback,
    displayNameValidation.error,
  ]);

  return {
    displayName,
    setDisplayName,
    fileData,
    currentFile,
    avatarFileError,
    isAvatarUploading,
    isAvatarDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    getProfileImageUrl,
    onSave,
    isSaving,
    hasValidationError,
    displayNameError: displayNameValidation.error,
    currentMember,
  };
};
