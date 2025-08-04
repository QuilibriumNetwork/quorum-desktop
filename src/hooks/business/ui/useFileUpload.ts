import { useState, useEffect } from 'react';
import { useDropzone, DropzoneOptions, FileRejection } from 'react-dropzone';
import { t } from '@lingui/core/macro';

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
}

export const useFileUpload = (
  options: UseFileUploadOptions = {}
): UseFileUploadReturn => {
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const {
    accept = {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple = false,
    maxSize = 1 * 1024 * 1024, // 1MB default
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
          setFileError(t`File cannot be larger than 1MB`);
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
          const arrayBuffer = await currentFile.arrayBuffer();
          setFileData(arrayBuffer);
          setIsUploading(false);
        } catch (error) {
          console.error('Error reading file:', error);
          setFileError(t`Error reading file`);
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
  };
};
