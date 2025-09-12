import React from 'react';
import { Pressable, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
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
  const isImageUpload =
    accept && Object.keys(accept).some((key) => key.includes('image'));

  const handleImageSelection = async (useCamera: boolean = false) => {
    try {
      // Request permissions first
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          if (onError) {
            onError(new Error(t`Camera permission is required to take photos`));
          }
          return;
        }
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          if (onError) {
            onError(
              new Error(
                t`Photo library permission is required to select images`
              )
            );
          }
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: imageQuality || 0.8,
        allowsEditing,
        base64: true, // Enable base64 to get data URL
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) {
        return; // User cancelled, no error
      }

      if (result.assets && result.assets.length > 0) {
        const convertedFiles: FileUploadFile[] = result.assets.map((asset) => {
          // Create data URL if base64 is available
          const dataUrl = asset.base64
            ? `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`
            : asset.uri;

          return {
            uri: dataUrl, // Use data URL if available, otherwise use file URI
            name: asset.fileName || `image_${Date.now()}.jpg`,
            size: asset.fileSize || 0,
            type: asset.type || 'image/jpeg',
            // Note: ArrayBuffer not easily available in React Native,
            // but base64 is included in uri as data URL
          };
        });

        // Check file size if maxSize is specified
        if (maxSize) {
          const oversizedFiles = convertedFiles.filter(
            (file) => file.size > maxSize
          );
          if (oversizedFiles.length > 0 && onError) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            onError(
              new Error(t`File size too large. Maximum size: ${maxSizeMB}MB`)
            );
            return;
          }
        }

        onFilesSelected(convertedFiles);
      }
    } catch (error: any) {
      if (onError) {
        onError(new Error(error.message || t`Failed to open image picker`));
      }
    }
  };

  const handleDocumentSelection = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: multiple,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return; // User cancelled, no error
      }

      const assets = result.assets || [];
      const convertedFiles: FileUploadFile[] = assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || 'document',
        size: asset.size || 0,
        type: asset.mimeType || 'application/octet-stream',
      }));

      // Check file size if maxSize is specified
      if (maxSize) {
        const oversizedFiles = convertedFiles.filter(
          (file) => file.size > maxSize
        );
        if (oversizedFiles.length > 0 && onError) {
          const maxSizeMB = Math.round(maxSize / (1024 * 1024));
          onError(
            new Error(t`File size too large. Maximum size: ${maxSizeMB}MB`)
          );
          return;
        }
      }

      onFilesSelected(convertedFiles);
    } catch (error: any) {
      if (onError) {
        onError(new Error(error.message || t`Failed to select document`));
      }
    }
  };

  const handlePress = () => {
    if (disabled) return;

    // Haptic feedback when upload button is tapped
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
