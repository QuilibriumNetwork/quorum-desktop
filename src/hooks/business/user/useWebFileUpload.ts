import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const maxImageSize = 2 * 1024 * 1024; // 2MB

/**
 * Hook for web-specific file upload functionality  
 * Handles drag/drop, file validation, and image processing
 * Web-only implementation using react-dropzone
 */
export const useWebFileUpload = () => {
  const [fileData, setFileData] = useState<ArrayBuffer | undefined>();
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);

  // Configure dropzone for image uploads
  const { getRootProps, getInputProps, acceptedFiles, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: maxImageSize,
    maxFiles: 1,
    multiple: false,
    onDropRejected: (fileRejections) => {
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          setFileError(
            i18n._(`File cannot be larger than {maxFileSize}`, {
              maxFileSize: `${maxImageSize / 1024 / 1024}MB`,
            })
          );
        } else {
          setFileError(t`File rejected`);
        }
      }
    },
    onDropAccepted: (files) => {
      setFileError(null);
      // Clear previous file data immediately when new file is accepted
      setFileData(undefined);
      setCurrentFile(files[0]);
    },
  });

  // Process file into ArrayBuffer when file changes
  useEffect(() => {
    if (currentFile) {
      (async () => {
        try {
          const arrayBuffer = await currentFile.arrayBuffer();
          setFileData(arrayBuffer);
        } catch (error) {
          console.error('Error reading file:', error);
          setFileError(t`Error reading file`);
        }
      })();
    }
  }, [currentFile]);

  // Generate data URL for image preview
  const getImageDataUrl = useCallback((): string | null => {
    if (!currentFile || !fileData) return null;
    
    return 'data:' + 
      currentFile.type + 
      ';base64,' + 
      Buffer.from(fileData).toString('base64');
  }, [currentFile, fileData]);

  // Validation helpers
  const hasValidFile = !!(currentFile && fileData);
  const canSaveFile = hasValidFile && !fileError;

  // Clear current file and reset state
  const clearFile = useCallback(() => {
    setCurrentFile(undefined);
    setFileData(undefined);
    setFileError(null);
  }, []);

  return {
    // File state
    currentFile,
    fileData, 
    fileError,
    isDragActive,
    
    // Validation
    hasValidFile,
    canSaveFile,
    
    // Dropzone props
    getRootProps,
    getInputProps,
    
    // Helpers
    getImageDataUrl,
    clearFile,
    
    // Constants
    maxImageSize,
  };
};