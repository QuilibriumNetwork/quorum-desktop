import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { t } from '@lingui/core/macro';

export interface UseSpaceFileUploadsOptions {
  onIconFileError?: (error: string | null) => void;
  onBannerFileError?: (error: string | null) => void;
}

export interface UseSpaceFileUploadsReturn {
  // Icon upload
  iconData: ArrayBuffer | undefined;
  currentIconFile: File | undefined;
  iconFileError: string | null;
  isIconUploading: boolean;
  isIconDragActive: boolean;
  getIconRootProps: () => any;
  getIconInputProps: () => any;
  clearIconFileError: () => void;
  
  // Banner upload
  bannerData: ArrayBuffer | undefined;
  currentBannerFile: File | undefined;
  bannerFileError: string | null;
  isBannerUploading: boolean;
  isBannerDragActive: boolean;
  getBannerRootProps: () => any;
  getBannerInputProps: () => any;
  clearBannerFileError: () => void;
}

export const useSpaceFileUploads = (
  options: UseSpaceFileUploadsOptions = {}
): UseSpaceFileUploadsReturn => {
  const { onIconFileError, onBannerFileError } = options;

  // Icon upload state
  const [iconData, setIconData] = useState<ArrayBuffer | undefined>();
  const [currentIconFile, setCurrentIconFile] = useState<File | undefined>();
  const [iconFileError, setIconFileError] = useState<string | null>(null);
  const [isIconUploading, setIsIconUploading] = useState<boolean>(false);

  // Banner upload state
  const [bannerData, setBannerData] = useState<ArrayBuffer | undefined>();
  const [currentBannerFile, setCurrentBannerFile] = useState<File | undefined>();
  const [bannerFileError, setBannerFileError] = useState<string | null>(null);
  const [isBannerUploading, setIsBannerUploading] = useState<boolean>(false);

  // Icon dropzone
  const {
    getRootProps: getIconRootProps,
    getInputProps: getIconInputProps,
    isDragActive: isIconDragActive,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      setIsIconUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          const error = t`File cannot be larger than 1MB`;
          setIconFileError(error);
          onIconFileError?.(error);
        } else {
          const error = t`File rejected`;
          setIconFileError(error);
          onIconFileError?.(error);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsIconUploading(true);
      setIconFileError(null);
      onIconFileError?.(null);
      setIconData(undefined);
      setCurrentIconFile(files[0]);
    },
    onDragEnter: () => {
      setIsIconUploading(true);
    },
    onDragLeave: () => {
      setIsIconUploading(false);
    },
    onFileDialogOpen: () => {
      setIsIconUploading(true);
    },
    onFileDialogCancel: () => {
      setIsIconUploading(false);
    },
  });

  // Banner dropzone
  const {
    getRootProps: getBannerRootProps,
    getInputProps: getBannerInputProps,
    isDragActive: isBannerDragActive,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    minSize: 0,
    maxSize: 1 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      setIsBannerUploading(false);
      for (const rejection of fileRejections) {
        if (rejection.errors.some((err) => err.code === 'file-too-large')) {
          const error = t`File cannot be larger than 1MB`;
          setBannerFileError(error);
          onBannerFileError?.(error);
        } else {
          const error = t`File rejected`;
          setBannerFileError(error);
          onBannerFileError?.(error);
        }
      }
    },
    onDropAccepted: (files) => {
      setIsBannerUploading(true);
      setBannerFileError(null);
      onBannerFileError?.(null);
      setBannerData(undefined);
      setCurrentBannerFile(files[0]);
    },
    onDragEnter: () => {
      setIsBannerUploading(true);
    },
    onDragLeave: () => {
      setIsBannerUploading(false);
    },
    onFileDialogOpen: () => {
      setIsBannerUploading(true);
    },
    onFileDialogCancel: () => {
      setIsBannerUploading(false);
    },
  });

  // Process icon file
  useEffect(() => {
    if (currentIconFile) {
      (async () => {
        try {
          const arrayBuffer = await currentIconFile.arrayBuffer();
          setIconData(arrayBuffer);
          setIsIconUploading(false);
        } catch (error) {
          console.error('Error reading icon file:', error);
          const errorMsg = t`Error reading file`;
          setIconFileError(errorMsg);
          onIconFileError?.(errorMsg);
          setIsIconUploading(false);
        }
      })();
    }
  }, [currentIconFile, onIconFileError]);

  // Process banner file
  useEffect(() => {
    if (currentBannerFile) {
      (async () => {
        try {
          const arrayBuffer = await currentBannerFile.arrayBuffer();
          setBannerData(arrayBuffer);
          setIsBannerUploading(false);
        } catch (error) {
          console.error('Error reading banner file:', error);
          const errorMsg = t`Error reading file`;
          setBannerFileError(errorMsg);
          onBannerFileError?.(errorMsg);
          setIsBannerUploading(false);
        }
      })();
    }
  }, [currentBannerFile, onBannerFileError]);

  const clearIconFileError = () => {
    setIconFileError(null);
    onIconFileError?.(null);
  };

  const clearBannerFileError = () => {
    setBannerFileError(null);
    onBannerFileError?.(null);
  };

  return {
    iconData,
    currentIconFile,
    iconFileError,
    isIconUploading,
    isIconDragActive,
    getIconRootProps,
    getIconInputProps,
    clearIconFileError,
    
    bannerData,
    currentBannerFile,
    bannerFileError,
    isBannerUploading,
    isBannerDragActive,
    getBannerRootProps,
    getBannerInputProps,
    clearBannerFileError,
  };
};