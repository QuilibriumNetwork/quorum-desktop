import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const maxImageSize = 2 * 1024 * 1024; // 2MB

export interface FileUploadFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Hook for native file upload functionality  
 * Handles image selection, validation, and processing
 * Native-only implementation using react-native-image-picker
 */
export const useWebFileUpload = () => {
  const [currentFile, setCurrentFile] = useState<FileUploadFile | undefined>();
  const [fileData, setFileData] = useState<string | undefined>(); // base64 data
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Show image selection options
  const showImagePicker = useCallback(() => {
    if (isSelecting) return;

    Alert.alert(
      t`Select Profile Image`,
      t`Choose how you'd like to add your profile image`,
      [
        {
          text: t`Camera`,
          onPress: () => selectFromCamera(),
        },
        {
          text: t`Photo Library`,
          onPress: () => selectFromLibrary(),
        },
        {
          text: t`Cancel`,
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  }, [isSelecting]);

  // Select from camera
  const selectFromCamera = useCallback(() => {
    setIsSelecting(true);
    setFileError(null);

    const options = {
      mediaType: 'photo' as const,
      quality: 0.8,
      allowsEditing: true,
      maxWidth: 2048,
      maxHeight: 2048,
      includeBase64: true,
    };

    launchCamera(options, handleImageResponse);
  }, []);

  // Select from photo library
  const selectFromLibrary = useCallback(() => {
    setIsSelecting(true);
    setFileError(null);

    const options = {
      mediaType: 'photo' as const,
      quality: 0.8,
      allowsEditing: true,
      maxWidth: 2048,
      maxHeight: 2048,
      includeBase64: true,
    };

    launchImageLibrary(options, handleImageResponse);
  }, []);

  // Handle image picker response
  const handleImageResponse = useCallback((response: ImagePickerResponse) => {
    setIsSelecting(false);

    if (response.didCancel || response.errorMessage) {
      if (response.errorMessage) {
        setFileError(response.errorMessage);
      }
      return;
    }

    if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      
      // Check file size
      if (asset.fileSize && asset.fileSize > maxImageSize) {
        setFileError(
          i18n._(`File cannot be larger than {maxFileSize}`, {
            maxFileSize: `${maxImageSize / 1024 / 1024}MB`,
          })
        );
        return;
      }

      // Create file object
      const file: FileUploadFile = {
        uri: asset.uri || '',
        name: asset.fileName || `image_${Date.now()}.jpg`,
        size: asset.fileSize || 0,
        type: asset.type || 'image/jpeg',
      };

      setCurrentFile(file);
      setFileData(asset.base64 || undefined);
      setFileError(null);
    }
  }, []);

  // Generate data URL for image preview (compatible with web version)
  const getImageDataUrl = useCallback((): string | null => {
    if (!currentFile || !fileData) return null;
    
    return `data:${currentFile.type};base64,${fileData}`;
  }, [currentFile, fileData]);

  // Validation helpers (compatible with web version API)
  const hasValidFile = !!(currentFile && fileData);
  const canSaveFile = hasValidFile && !fileError;

  // Clear current file and reset state
  const clearFile = useCallback(() => {
    setCurrentFile(undefined);
    setFileData(undefined);
    setFileError(null);
  }, []);

  // Mock dropzone props for compatibility with web version
  const getRootProps = useCallback(() => ({
    onPress: showImagePicker,
  }), [showImagePicker]);

  const getInputProps = useCallback(() => ({}), []);

  return {
    // File state (compatible with web version)
    currentFile,
    fileData, 
    fileError,
    isDragActive: false, // Always false on mobile
    isSelecting,
    
    // Validation (compatible with web version)
    hasValidFile,
    canSaveFile,
    
    // Actions
    showImagePicker,
    selectFromCamera,
    selectFromLibrary,
    clearFile,
    
    // Dropzone compatibility props (for web compatibility)
    getRootProps,
    getInputProps,
    
    // Helpers (compatible with web version)
    getImageDataUrl,
    
    // Constants
    maxImageSize,
  };
};