import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { processAvatarImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';
import { useMessageDB } from '../../../components/context/useMessageDB';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { UpdateProfileMessage } from '@quilibrium/quorum-shared';
import { buildSpaceMembersKey } from '../../queries/spaceMembers/buildSpaceMembersKey';
import { buildSpaceMembersFetcher } from '../../queries/spaceMembers/buildSpaceMembersFetcher';
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

  const displayNameValidation = useDisplayNameValidation(displayName);
  // Per-space name is optional, so empty is valid here (the "required" error
  // doesn't apply); all other rules still do.
  const displayNameError =
    displayName.trim().length === 0 ? undefined : displayNameValidation.error;
  const bioErrors = validateUserBio(bio);
  const hasValidationError = !!displayNameError || bioErrors.length > 0;

  // Load the member from the REACTIVE space-members query (same cache the
  // channel/message rows use), not a one-shot read. A profile update synced
  // from another device (e.g. a per-space name change made on mobile) writes
  // the member row and invalidates this query, so opening this modal before
  // that write lands no longer shows a stale/empty field that never refreshes.
  // Plain useQuery (not the suspense variant) so no Suspense boundary is needed
  // here; it shares the same queryKey/cache, so it stays in sync.
  const { data: spaceMembers } = useQuery({
    queryKey: buildSpaceMembersKey({ spaceId }),
    queryFn: buildSpaceMembersFetcher({ spaceId, messageDB }),
    enabled: !!spaceId && !!currentPasskeyInfo?.address,
    networkMode: 'always', // IndexedDB, not network
  });

  const ownMember = useMemo(() => {
    const addr = currentPasskeyInfo?.address;
    if (!addr || !spaceMembers) return undefined;
    return spaceMembers.find(
      (m) =>
        (m as { user_address?: string }).user_address === addr ||
        (m as { address?: string }).address === addr
    );
  }, [spaceMembers, currentPasskeyInfo?.address]);

  // Hydrate the editable fields from the member — but ONLY while the field is
  // still pristine (its current value equals the last-loaded baseline). Once
  // the user edits, the field diverges from baseline and we stop overwriting,
  // so a live sync update never clobbers in-progress typing. When the member
  // updates and the user hasn't touched the form, the field refreshes live.
  useEffect(() => {
    if (!currentPasskeyInfo?.address) return;
    // Per-space name/bio are optional overrides: init from the member only,
    // NOT the global name (that made an unset override look set and defeated
    // clearing). Empty = use my global / QNS name here.
    const memberDisplayName = ownMember?.display_name ?? '';
    const memberBio = ownMember?.bio ?? '';
    const memberUserIcon = ownMember?.user_icon ?? '';
    setCurrentMember(ownMember ?? null);
    setDisplayName((cur) => (cur === baseline.displayName ? memberDisplayName : cur));
    setBio((cur) => (cur === baseline.bio ? memberBio : cur));
    setBaseline({
      displayName: memberDisplayName,
      bio: memberBio,
      userIcon: memberUserIcon,
    });
    // baseline is intentionally omitted from deps: it's updated here and the
    // pristine check reads the latest value via the functional setState above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownMember, currentPasskeyInfo?.address]);

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

    // Two-state per-space avatar (follow-global model — supersedes the earlier
    // three-state '' = "cleared, show initials" concept):
    //   - non-empty per-space value -> OVERRIDE -> show it
    //   - '' or absent              -> follow global -> fall back to the
    //                                  global avatar (there is no per-space
    //                                  "blank"; only the global avatar can be
    //                                  empty, and its absence flows here)
    const perSpaceIcon = currentMember?.user_icon;
    if (perSpaceIcon && !perSpaceIcon.includes(DefaultImages.UNKNOWN_USER)) {
      return perSpaceIcon;
    }

    // No per-space override -> fall back to the global (public-profile) avatar
    if (
      currentPasskeyInfo?.pfpUrl &&
      !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)
    ) {
      return currentPasskeyInfo.pfpUrl;
    }

    return 'var(--unknown-icon)';
  }, [fileData, currentFile, currentMember, currentPasskeyInfo, markedForDeletion]);

  const onSave = useCallback(async () => {
    if (!currentPasskeyInfo || displayNameError || bioErrors.length > 0) {
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

      // Include a field ONLY when it changed. Two-state model: a per-space
      // field is sent only when the user set/changed an OVERRIDE; omitting it
      // means "no change / follow global". Do NOT send userIcon unconditionally
      // (it previously fell back to baseline, re-stamping the global value into
      // the per-space row on every save and faking an override). All three
      // fields now behave identically: send on change, omit otherwise.
      await submitChannelMessage(
        spaceId,
        space.defaultChannelId,
        {
          type: 'update-profile',
          senderId: currentPasskeyInfo.address,
          ...(changed.displayName !== undefined
            ? { displayName: changed.displayName }
            : {}),
          ...(changed.userIcon !== undefined
            ? { userIcon: changed.userIcon }
            : {}),
          ...(changed.bio !== undefined ? { bio: changed.bio } : {}),
        } as UpdateProfileMessage,
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
    displayNameError,
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
    displayNameError,
    currentMember,
  };
};
