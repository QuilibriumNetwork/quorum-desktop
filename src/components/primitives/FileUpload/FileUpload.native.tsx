import React from 'react';
import { Pressable, Alert } from 'react-native';
import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';
import { launchImageLibrary, launchCamera, ImagePickerResponse, Asset, PhotoQuality } from 'react-native-image-picker';
import { FileUploadNativeProps, FileUploadFile } from './types';
import { t } from '@lingui/core/macro';

/**
 * Native FileUpload component using platform-specific pickers
 * Provides same API as web version but uses mobile-appropriate selection methods
 */
export const FileUpload: React.FC<FileUploadNativeProps> = ({
  onFilesSelected,
  accept,
  multiple = false,
  maxSize,
  disabled = false,
  onError,
  showCameraOption = false,
  imageQuality = 0.8,
  allowsEditing = true,
  children,
  testId,
}) => {
  const isImageUpload = accept && Object.keys(accept).some(key => key.includes('image'));

  const handleImageSelection = async (useCamera: boolean = false) => {
    const options = {
      mediaType: 'photo' as const,
      quality: (imageQuality || 0.8) as PhotoQuality,
      allowsEditing,
      maxWidth: 2048,
      maxHeight: 2048,
    };

    const callback = (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage && onError) {
          onError(new Error(response.errorMessage));
        }
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const convertedFiles: FileUploadFile[] = response.assets.map((asset: Asset) => ({
          uri: asset.uri || '',
          name: asset.fileName || `image_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          type: asset.type || 'image/jpeg',
        }));

        // Check file size if maxSize is specified
        if (maxSize) {
          const oversizedFiles = convertedFiles.filter(file => file.size > maxSize);
          if (oversizedFiles.length > 0 && onError) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            onError(new Error(t`File size too large. Maximum size: ${maxSizeMB}MB`));
            return;
          }
        }

        onFilesSelected(convertedFiles);
      }
    };

    try {
      if (useCamera) {
        launchCamera(options, callback);
      } else {
        launchImageLibrary(options, callback);
      }
    } catch (error: any) {
      if (onError) {
        onError(new Error(error.message || t`Failed to open image picker`));
      }
    }
  };

  const handleDocumentSelection = async () => {
    try {
      const results = await DocumentPicker.pick({
        type: DocumentPicker.types.allFiles,
        allowMultiSelection: multiple,
        presentationStyle: 'fullScreen',
      });

      const convertedFiles: FileUploadFile[] = results.map((result: DocumentPickerResponse) => ({
        uri: result.uri,
        name: result.name || 'document',
        size: result.size || 0,
        type: result.type || 'application/octet-stream',
      }));

      // Check file size if maxSize is specified
      if (maxSize) {
        const oversizedFiles = convertedFiles.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0 && onError) {
          const maxSizeMB = Math.round(maxSize / (1024 * 1024));
          onError(new Error(t`File size too large. Maximum size: ${maxSizeMB}MB`));
          return;
        }
      }

      onFilesSelected(convertedFiles);
    } catch (error: any) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled, this is normal
        return;
      }
      
      if (onError) {
        onError(new Error(error.message || t`Failed to select document`));
      }
    }
  };

  const handlePress = () => {
    if (disabled) return;

    if (isImageUpload && showCameraOption) {
      // Show options for images: Camera, Library, Cancel
      Alert.alert(
        t`Select Image`,
        t`Choose how you'd like to add an image`,
        [
          {
            text: t`Camera`,
            onPress: () => handleImageSelection(true),
          },
          {
            text: t`Photo Library`,
            onPress: () => handleImageSelection(false),
          },
          {
            text: t`Cancel`,
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } else if (isImageUpload) {
      // Image upload without camera option
      handleImageSelection(false);
    } else {
      // Document/file upload
      handleDocumentSelection();
    }
  };

  return (
    <Pressable 
      onPress={handlePress}
      disabled={disabled}
      testID={testId}
      style={({ pressed }: { pressed: boolean }) => ({
        opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      {children}
    </Pressable>
  );
};