import { useState, useEffect, useCallback } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { processAvatarImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useQueryClient } from '@tanstack/react-query';
import { showError } from '../../../utils/toast';
import { useDisplayNameValidation, validateUserBio } from '../validation';

export interface UseSpaceProfileOptions {
  spaceId: string;
  onSave?: () => void;
}

export interface UseSpaceProfileReturn {
  displayName: string;
  setDisplayName: (name: string) => void;
  bio: string;
  setBio: (bio: string) => void;
  bioErrors: string[];
  fileData: ArrayBuffer | undefined;
  currentFile: File | undefined;
  avatarFileError: string | null;
  isAvatarUploading: boolean;
  isAvatarDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  clearFile: () => void;
  markedForDeletion: boolean;
  markForDeletion: () => void;
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
  const [bio, setBio] = useState('');
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [avatarFileError, setAvatarFileError] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [markedForDeletion, setMarkedForDeletion] = useState<boolean>(false);
  // Snapshot of the loaded SpaceMember fields. Used by onSave to send only
  // fields that actually changed, so partial edits don't broadcast empty/stale
  // values that would clobber receivers' stored fields (mirrors mobile's
  // SpaceSettingsModal sender-side gate).
  const [baseline, setBaseline] = useState<{
    displayName: string;
    bio: string;
    userIcon: string;
  }>({ displayName: '', bio: '', userIcon: '' });

  // Use proper display name validation (replaces basic validation)
  const displayNameValidation = useDisplayNameValidation(displayName);
  const bioErrors = validateUserBio(bio);
  const hasValidationError = !!displayNameValidation.error || bioErrors.length > 0;

  // Load current member data
  useEffect(() => {
    if (!currentPasskeyInfo?.address) return;

    (async () => {
      try {
        const member = await messageDB.getSpaceMember(spaceId, currentPasskeyInfo.address);
        setCurrentMember(member);
        // Initialize display name from member or fallback to global
        const initialDisplayName = member?.display_name || currentPasskeyInfo.displayName || '';
        const initialBio = member?.bio ?? '';
        const initialUserIcon = member?.user_icon ?? '';
        setDisplayName(initialDisplayName);
        setBio(initialBio);
        setBaseline({
          displayName: initialDisplayName,
          bio: initialBio,
          userIcon: initialUserIcon,
        });
      } catch (error) {
        console.error('Failed to load space member:', error);
        // Fallback to global profile
        setDisplayName(currentPasskeyInfo.displayName || '');
        setBio('');
        setBaseline({ displayName: currentPasskeyInfo.displayName || '', bio: '', userIcon: '' });
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
      setMarkedForDeletion(false); // Reset deletion flag on new upload
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

  const clearFile = useCallback(() => {
    setFileData(undefined);
    setCurrentFile(undefined);
    setAvatarFileError(null);
    setIsAvatarUploading(false);
    setMarkedForDeletion(false);
  }, []);

  const markForDeletion = useCallback(() => {
    setFileData(undefined);
    setCurrentFile(undefined);
    setAvatarFileError(null);
    setIsAvatarUploading(false);
    setMarkedForDeletion(true);
  }, []);

  const getProfileImageUrl = useCallback((): string => {
    // If marked for deletion, show default
    if (markedForDeletion) {
      return 'var(--unknown-icon)';
    }

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
  }, [fileData, currentFile, currentMember, currentPasskeyInfo, markedForDeletion]);

  const onSave = useCallback(async () => {
    if (!currentPasskeyInfo || displayNameValidation.error || bioErrors.length > 0) {
      return;
    }

    setIsSaving(true);
    try {
      // Resolve the new userIcon from local state: a fresh upload becomes the
      // new value, a deletion becomes the empty string, otherwise the existing
      // baseline is kept untouched. We compare against baseline.userIcon below
      // to decide whether to broadcast it.
      let nextUserIcon: string;
      if (markedForDeletion) {
        nextUserIcon = '';
      } else if (fileData && currentFile) {
        nextUserIcon = `data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')}`;
      } else {
        nextUserIcon = baseline.userIcon;
      }

      // Build a change-only payload: include each field only when it differs
      // from the loaded baseline. This matches mobile's sender-side gate
      // (SpaceSettingsModal.tsx:459-467) so a bio-only edit doesn't broadcast
      // displayName/userIcon and clobber receivers' stored values on builds
      // without the receive-side upsert merge.
      const trimmedDisplayName = displayName.trim();
      const trimmedBio = bio.trim();
      const changed: {
        displayName?: string;
        userIcon?: string;
        bio?: string;
      } = {};
      if (trimmedDisplayName !== baseline.displayName) {
        changed.displayName = trimmedDisplayName;
      }
      if (nextUserIcon !== baseline.userIcon) {
        changed.userIcon = nextUserIcon;
      }
      if (trimmedBio !== baseline.bio) {
        // Bio uses presence-aware semantics on the receiver: an explicit empty
        // string is a deliberate clear, undefined means "no change".
        changed.bio = trimmedBio;
      }

      // Nothing actually changed — skip the broadcast and the modal-close
      // callback fires as if a save happened (matches mobile UX).
      if (Object.keys(changed).length === 0) {
        onSaveCallback?.();
        return;
      }

      // Get space's default channel
      const space = await messageDB.getSpace(spaceId);
      if (!space) {
        throw new Error('Space not found');
      }

      // Send update-profile message. `submitChannelMessage` requires the
      // `update-profile` payload to satisfy the UpdateProfileMessage type,
      // which today types displayName and userIcon as required strings.
      // The wire shape tolerates omitting them (mobile already does, and
      // canonicalize() over a partial object is well-defined); fall back to
      // baseline values for the typed fields when we're not actually
      // broadcasting them so the type-check passes and a receiver running
      // an older build still has something to overwrite-with-same.
      await submitChannelMessage(
        spaceId,
        space.defaultChannelId,
        {
          type: 'update-profile',
          senderId: currentPasskeyInfo.address,
          displayName: changed.displayName ?? baseline.displayName,
          userIcon: changed.userIcon ?? baseline.userIcon,
          ...(changed.bio !== undefined ? { bio: changed.bio } : {}),
        },
        queryClient,
        currentPasskeyInfo,
        undefined, // inReplyTo
        false, // skipSigning - must sign for security
        undefined // isSpaceOwner - not needed for profile updates
      );

      // Refresh the baseline so subsequent saves in the same modal session
      // compare against the just-broadcast values.
      setBaseline({
        displayName: trimmedDisplayName,
        bio: trimmedBio,
        userIcon: nextUserIcon,
      });

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
    bio,
    baseline,
    fileData,
    currentFile,
    spaceId,
    messageDB,
    submitChannelMessage,
    queryClient,
    onSaveCallback,
    displayNameValidation.error,
    bioErrors.length,
    markedForDeletion,
  ]);

  return {
    displayName,
    setDisplayName,
    bio,
    setBio,
    bioErrors,
    fileData,
    currentFile,
    avatarFileError,
    isAvatarUploading,
    isAvatarDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    clearFile,
    markedForDeletion,
    markForDeletion,
    getProfileImageUrl,
    onSave,
    isSaving,
    hasValidationError,
    displayNameError: displayNameValidation.error,
    currentMember,
  };
};
