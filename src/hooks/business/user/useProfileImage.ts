import { useState, useEffect } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { t } from '@lingui/core/macro';
import { DefaultImages } from '../../../utils';
import { processAvatarImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';

export interface UseProfileImageOptions {
  onImageChange?: (fileData?: ArrayBuffer, file?: File) => void;
}

export interface UseProfileImageReturn {
  fileData: ArrayBuffer | undefined;
  currentFile: File | undefined;
  userIconFileError: string | null;
  isUserIconUploading: boolean;
  isDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  clearFile: () => void;
  getProfileImageUrl: () => string;
}

export const useProfileImage = (
  options: UseProfileImageOptions = {}
): UseProfileImageReturn => {
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [userIconFileError, setUserIconFileError] = useState<string | null>(
    null
  );
  const [isUserIconUploading, setIsUserIconUploading] =
    useState<boolean>(false);

  const { currentPasskeyInfo } = usePasskeysContext();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: FILE_SIZE_LIMITS.MAX_INPUT_SIZE, // 25MB
    onDropRejected: (fileRejections: FileRejection[]) => {
      setIsUserIconUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setUserIconFileError(t`File cannot be larger than 25MB`);
        } else {
          setUserIconFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsUserIconUploading(true);
      setUserIconFileError(null);
      // Clear previous file data immediately when new file is accepted
      setFileData(undefined);
      setCurrentFile(files[0]);
    },
    onDragEnter: () => {
      setIsUserIconUploading(true);
    },
    onDragLeave: () => {
      setIsUserIconUploading(false);
    },
    onFileDialogOpen: () => {
      setIsUserIconUploading(true);
    },
    onFileDialogCancel: () => {
      setIsUserIconUploading(false);
    },
  });

  // Process file to ArrayBuffer when file changes
  useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          // Compress image for optimal avatar size
          const result = await processAvatarImage(currentFile);
          const arrayBuffer = await result.file.arrayBuffer();
          setFileData(arrayBuffer);
          setIsUserIconUploading(false);
          setUserIconFileError(null); // Clear any previous errors
          options.onImageChange?.(arrayBuffer, result.file);
        } catch (error) {
          console.error('Error processing avatar image:', error);
          setUserIconFileError(error instanceof Error ? error.message : t`Unable to compress image. Please use a smaller image.`);
          setIsUserIconUploading(false);
        }
      })();
    }
  }, [currentFile, options]);

  const clearFileError = () => setUserIconFileError(null);

  const clearFile = () => {
    setFileData(undefined);
    setCurrentFile(undefined);
    setUserIconFileError(null);
    setIsUserIconUploading(false);
  };

  const getProfileImageUrl = (): string => {
    if (fileData && currentFile) {
      return `data:${currentFile.type};base64,${Buffer.from(fileData).toString('base64')}`;
    }

    if (
      currentPasskeyInfo?.pfpUrl &&
      !currentPasskeyInfo.pfpUrl.includes(DefaultImages.UNKNOWN_USER)
    ) {
      return currentPasskeyInfo.pfpUrl;
    }

    return 'var(--unknown-icon)';
  };

  return {
    fileData,
    currentFile,
    userIconFileError,
    isUserIconUploading,
    isDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    clearFile,
    getProfileImageUrl,
  };
};
