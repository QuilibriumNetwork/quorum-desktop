import { useState, useEffect } from 'react';
import { useDropzone, DropzoneOptions, FileRejection } from 'react-dropzone';
import { t } from '@lingui/core/macro';
import { processAvatarImage, FILE_SIZE_LIMITS } from '../../../utils/imageProcessing';

export interface UseFileUploadOptions {
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  onDropAccepted?: (files: File[]) => void;
  onDropRejected?: (fileRejections: FileRejection[]) => void;
}

export interface UseFileUploadReturn {
  fileData: ArrayBuffer | undefined;
  currentFile: File | undefined;
  fileError: string | null;
  isUploading: boolean;
  isDragActive: boolean;
  getRootProps: () => any;
  getInputProps: () => any;
  clearFileError: () => void;
  clearFile: () => void;
  markedForDeletion: boolean;
  markForDeletion: () => void;
}

export const useFileUpload = (
  options: UseFileUploadOptions = {}
): UseFileUploadReturn => {
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [markedForDeletion, setMarkedForDeletion] = useState<boolean>(false);

  const {
    accept = {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple = false,
    maxSize = FILE_SIZE_LIMITS.MAX_INPUT_SIZE, // 25MB default
    onDropAccepted,
    onDropRejected,
  } = options;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    minSize: 0,
    maxSize,
    onDropRejected: (fileRejections) => {
      setIsUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setFileError(t`File cannot be larger than 25MB`);
        } else {
          setFileError(t`File rejected`);
        }
      }
      onDropRejected?.(fileRejections);
    },
    onDropAccepted: (files) => {
      setIsUploading(true);
      setFileError(null);
      // Clear previous file data immediately when new file is accepted
      setFileData(undefined);
      setCurrentFile(files[0]);
      setMarkedForDeletion(false); // Reset deletion flag on new upload
      onDropAccepted?.(files);
    },
    onDragEnter: () => {
      setIsUploading(true);
    },
    onDragLeave: () => {
      setIsUploading(false);
    },
    onFileDialogOpen: () => {
      setIsUploading(true);
    },
    onFileDialogCancel: () => {
      setIsUploading(false);
    },
  });

  // Process file to ArrayBuffer when file changes
  useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          // Compress image for optimal avatar size (assuming this is for avatars/icons)
          const result = await processAvatarImage(currentFile);
          const arrayBuffer = await result.file.arrayBuffer();
          setFileData(arrayBuffer);
          setFileError(null); // Clear any previous errors
          setIsUploading(false);
        } catch (error) {
          console.error('Error processing image:', error);
          setFileError(error instanceof Error ? error.message : t`Unable to compress image. Please use a smaller image.`);
          setIsUploading(false);
        }
      })();
    }
  }, [currentFile]);

  const clearFileError = () => setFileError(null);

  const clearFile = () => {
    setFileData(undefined);
    setCurrentFile(undefined);
    setFileError(null);
    setIsUploading(false);
    setMarkedForDeletion(false);
  };

  const markForDeletion = () => {
    setFileData(undefined);
    setCurrentFile(undefined);
    setFileError(null);
    setIsUploading(false);
    setMarkedForDeletion(true);
  };

  return {
    fileData,
    currentFile,
    fileError,
    isUploading,
    isDragActive,
    getRootProps,
    getInputProps,
    clearFileError,
    clearFile,
    markedForDeletion,
    markForDeletion,
  };
};
