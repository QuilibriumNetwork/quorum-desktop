import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { 
  View, 
  TouchableOpacity,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  KeyboardAvoidingView,
  // @ts-ignore - TypeScript config doesn't recognize React Native modules in this environment
  Platform 
} from 'react-native';
import { Button, Icon, Text } from '../primitives';
import { MessageTextInput } from './MessageTextInput.native';
import { i18n } from '@lingui/core';

interface MessageComposerProps {
  // Textarea props
  value: string;
  onChange: (value: string) => void;
  placeholder: string;

  // File upload props - adapted for mobile
  onFileSelect?: () => void; // Native file picker instead of dropzone
  fileData?: ArrayBuffer;
  clearFile: () => void;

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

export const MessageComposer = forwardRef<
  MessageComposerRef,
  MessageComposerProps
>(
  (
    {
      value,
      onChange,
      placeholder,
      onFileSelect,
      fileData,
      clearFile,
      onSubmitMessage,
      onShowStickers,
      hasStickers = true,
      inReplyTo,
      fileError,
      mapSenderToUser,
      setInReplyTo,
    },
    ref
  ) => {
    const textareaRef = useRef<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);

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
      textareaRef.current?.blur();
    };

    const renderFilePreview = () => {
      if (!fileData) return null;

      return (
        <View style={{ marginHorizontal: 12, marginTop: 8 }}>
          <View style={{
            padding: 8,
            borderRadius: 8,
            backgroundColor: 'var(--color-bg-surface-3)',
            alignSelf: 'flex-start',
            position: 'relative'
          }}>
            <Button
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                padding: 4,
                paddingHorizontal: 8,
                backgroundColor: 'var(--color-bg-surface-7)',
                borderRadius: 20,
                zIndex: 1
              }}
              type="subtle"
              size="small"
              onPress={clearFile}
            >
              <Icon name="x" size="xs" />
            </Button>
            {/* TODO: Implement proper image preview for React Native when real SDK is available */}
            <View style={{
              width: 140,
              height: 140,
              backgroundColor: 'var(--color-bg-surface-5)',
              borderRadius: 4,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Icon name="image" size="lg" color="var(--color-text-subtle)" />
            </View>
          </View>
        </View>
      );
    };

    const renderErrorAndReply = () => {
      if (!fileError && !inReplyTo) return null;

      return (
        <View style={{ width: '100%', marginLeft: 11, marginTop: 8, marginBottom: 0 }}>
          {fileError && (
            <Text 
              size="sm" 
              color="var(--color-text-danger)"
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
                backgroundColor: 'var(--color-bg-surface-4)',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Text size="xs" color="var(--color-text-subtle)">
                {i18n._('Replying to {user}', {
                  user: mapSenderToUser(inReplyTo.content.senderId).displayName,
                })}
              </Text>
              <Button
                type="unstyled"
                onPress={() => setInReplyTo?.(undefined)}
              >
                <Icon
                  name="times"
                  size="sm"
                  color="var(--color-text-subtle)"
                />
              </Button>
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
            alignItems: 'flex-start',
            marginLeft: 11,
            marginVertical: 8,
            padding: 8,
            borderRadius: 8,
            borderTopLeftRadius: inReplyTo ? 0 : 8,
            borderTopRightRadius: inReplyTo ? 0 : 8,
            backgroundColor: 'var(--color-bg-chat-input)',
          }}
        >
          {/* Left side - emoji/sticker picker buttons (hidden when expanded) */}
          {!isExpanded && (
            <>
              <View style={{ marginRight: 8 }}>
                <Button
                  type="subtle"
                  onPress={onFileSelect}
                  size="small"
                  iconName="plus"
                  iconOnly
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16
                  }}
                />
              </View>

              {hasStickers && (
                <View style={{ marginRight: 8 }}>
                  <Button
                    type="subtle"
                    onPress={onShowStickers}
                    size="small"
                    iconName="smile"
                    iconOnly
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16
                    }}
                  />
                </View>
              )}
            </>
          )}

          {/* Collapse button (shown when expanded) */}
          {isExpanded && (
            <TouchableOpacity
              onPress={handleCollapse}
              style={{
                width: 32,
                height: 32,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8
              }}
              activeOpacity={0.7}
            >
              <Icon name="chevron-right" size="sm" color="var(--color-text-subtle)" />
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
            maxRows={5}
            style={{
              flex: 1,
              marginRight: 8
            }}
          />

          {/* Send button (always on the right) - Matches web version styling */}
          <TouchableOpacity
            onPress={onSubmitMessage}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'var(--color-bg-accent)',
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0
            }}
            activeOpacity={0.6}
          >
            {/* Custom send arrow - triangular shape like the SVG */}
            <View style={{
              width: 0,
              height: 0,
              borderLeftWidth: 8,
              borderRightWidth: 0,
              borderTopWidth: 5,
              borderBottomWidth: 5,
              borderLeftColor: 'white',
              borderRightColor: 'transparent',
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              marginLeft: 2 // Slight offset to center visually
            }} />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ width: '100%', paddingRight: 24 }}>
        {renderErrorAndReply()}
        {renderFilePreview()}
        {renderInputRow()}
      </View>
    );
  }
);

export { MessageComposer as default };