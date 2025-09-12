import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  KeyboardAvoidingView,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  Platform,
} from 'react-native';
import { Icon, Text, FileUpload } from '../primitives';
import { useTheme } from '../primitives/theme';
import { MessageTextInput } from './MessageTextInput.native';
import { i18n } from '@lingui/core';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

interface MessageComposerProps {
  // Textarea props
  value: string;
  onChange: (value: string) => void;
  placeholder: string;

  // File upload props - adapted for mobile
  fileData?: ArrayBuffer;
  clearFile: () => void;
  onFileError?: (error: string) => void;
  onFileSelect?: (fileData: ArrayBuffer, fileType: string) => void;

  // Actions
  onSubmitMessage: () => void;
  onShowStickers: () => void;
  hasStickers?: boolean;

  // Reply-to and error handling
  inReplyTo?: any;
  fileError?: string | null;
  mapSenderToUser?: (senderId: string) => { displayName?: string };
  setInReplyTo?: (inReplyTo: any) => void;
}

export interface MessageComposerRef {
  focus: () => void;
}

// Custom SendIcon component using the provided SVG
const SendIcon = ({
  size = 20,
  color = 'white',
}: {
  size?: number;
  color?: string;
}) => {
  // Calculate proportional height based on the 5:4 aspect ratio (100:80)
  const height = (size * 80) / 100;

  return (
    <Svg width={size} height={height} viewBox="0 0 100 80">
      <Path d="M0 80L25 40.4181L0 0L100 40.4181L0 80Z" fill={color} />
    </Svg>
  );
};

export const MessageComposer = forwardRef<
  MessageComposerRef,
  MessageComposerProps
>(
  (
    {
      value,
      onChange,
      placeholder,
      fileData,
      clearFile,
      onSubmitMessage,
      onShowStickers,
      hasStickers = true,
      inReplyTo,
      fileError,
      mapSenderToUser,
      setInReplyTo,
      onFileError,
      onFileSelect,
    },
    ref
  ) => {
    const theme = useTheme();
    const textareaRef = useRef<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // File upload configuration
    const maxImageSize = 2 * 1024 * 1024; // 2MB
    const acceptedFileTypes = {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
    };

    // Convert data URL to ArrayBuffer (for compatibility with existing interface)
    const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
      const base64 = dataUrl.split(',')[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    };

    // Get data URL from ArrayBuffer (for image preview)
    const arrayBufferToDataUrl = (
      buffer: ArrayBuffer,
      mimeType: string = 'image/jpeg'
    ): string => {
      const bytes = new Uint8Array(buffer);
      const binary = bytes.reduce(
        (acc, byte) => acc + String.fromCharCode(byte),
        ''
      );
      const base64 = btoa(binary);
      return `data:${mimeType};base64,${base64}`;
    };

    // Handle file selection from FileUpload
    const handleFilesSelected = (files: any[]) => {
      if (files.length > 0) {
        const file = files[0];
        try {
          // Convert data URL to ArrayBuffer for compatibility
          const arrayBuffer = dataUrlToArrayBuffer(file.uri);
          // Pass to parent component
          onFileSelect?.(arrayBuffer, file.type);
        } catch (error) {
          onFileError?.(i18n._('Failed to process image'));
        }
      }
    };

    // Handle file upload errors
    const handleFileError = (error: Error) => {
      onFileError?.(error.message);
    };

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    const handleFocus = () => {
      setIsExpanded(true);
    };

    const handleCollapse = () => {
      console.log('Collapse button clicked');
      setIsExpanded(false);
      // Keep keyboard open - don't blur the input
      // textareaRef.current?.blur();
    };

    const renderFilePreview = () => {
      if (!fileData) return null;

      return (
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              position: 'relative',
            }}
          >
            {/* Image preview with proper ArrayBuffer to data URL conversion */}
            <Image
              style={{
                width: 140,
                height: 140,
                borderRadius: 8,
              }}
              source={{ uri: arrayBufferToDataUrl(fileData) }}
              contentFit="cover"
            />
            {/* Close button positioned inside the top-right corner of the image */}
            <TouchableOpacity
              onPress={() => {
                // Haptic feedback for delete action
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                clearFile();
              }}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.colors.surface[6],
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1,
              }}
              activeOpacity={0.7}
            >
              <Icon name="x" size="xs" color={theme.colors.text.main} />
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    const renderErrorAndReply = () => {
      if (!fileError && !inReplyTo) return null;

      return (
        <View style={{ width: '100%', marginTop: 8, marginBottom: -8 }}>
          {fileError && (
            <Text
              size="sm"
              color={theme.colors.text.danger}
              style={{ marginLeft: 4, marginTop: 12, marginBottom: 4 }}
            >
              {fileError}
            </Text>
          )}
          {inReplyTo && mapSenderToUser && setInReplyTo && (
            <View
              style={{
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 4,
                backgroundColor: theme.colors.surface[4],
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text size="xs" color={theme.colors.text.subtle}>
                {i18n._('Replying to {user}', {
                  user: mapSenderToUser(inReplyTo.content.senderId).displayName,
                })}
              </Text>
              <TouchableOpacity
                onPress={() => setInReplyTo?.(undefined)}
                style={{
                  padding: 4,
                  borderRadius: 4,
                }}
                activeOpacity={0.7}
              >
                <Icon name="times" size="sm" color={theme.colors.text.subtle} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    };

    const renderInputRow = () => {
      return (
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 8,
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 12,
            borderTopLeftRadius: inReplyTo ? 0 : 12,
            borderTopRightRadius: inReplyTo ? 0 : 12,
            backgroundColor: theme.colors.bg['chat-input'],
          }}
        >
          {/* Left side - emoji/sticker picker buttons (hidden when expanded) */}
          {!isExpanded && (
            <>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                onError={handleFileError}
                accept={acceptedFileTypes}
                maxSize={maxImageSize}
                multiple={false}
                showCameraOption={true}
                imageQuality={0.8}
                allowsEditing={true}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: theme.colors.surface[5],
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  <Icon name="plus" size="sm" color={theme.colors.text.main} />
                </View>
              </FileUpload>

              {hasStickers && (
                <TouchableOpacity
                  onPress={() => {
                    // Haptic feedback for sticker button
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onShowStickers();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: theme.colors.surface[5],
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name="smile" size="sm" color={theme.colors.text.main} />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Collapse button (shown when expanded) */}
          {isExpanded && (
            <TouchableOpacity
              onPress={handleCollapse}
              style={{
                width: 24,
                height: 32,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.7}
            >
              <Icon
                name="chevron-right"
                size="sm"
                color={theme.colors.text.muted}
              />
            </TouchableOpacity>
          )}

          {/* MessageTextInput - Custom input optimized for messaging */}
          <MessageTextInput
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onFocus={handleFocus}
            placeholder={placeholder}
            minRows={1}
            maxRows={8}
            style={{
              flex: 1,
              marginRight: 8,
            }}
          />

          {/* Send button (always on the right) - Uses custom SendIcon */}
          <TouchableOpacity
            onPress={onSubmitMessage}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.colors.accent.DEFAULT,
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0,
            }}
            activeOpacity={0.6}
          >
            <SendIcon size={18} color="white" />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ width: '100%' }}>
        {renderErrorAndReply()}
        {renderFilePreview()}
        {renderInputRow()}
      </View>
    );
  }
);

export { MessageComposer as default };
