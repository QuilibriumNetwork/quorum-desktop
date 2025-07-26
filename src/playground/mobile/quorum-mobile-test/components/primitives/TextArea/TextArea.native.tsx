import React, { useState, useRef, useEffect } from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { TextAreaNativeProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

export const TextArea: React.FC<TextAreaNativeProps> = ({
  value,
  placeholder,
  onChange,
  variant = 'default',
  onBlur,
  onFocus,
  rows = 3,
  minRows = 1,
  maxRows = 10,
  autoResize = false,
  returnKeyType = 'default',
  autoComplete = 'off',
  multiline = true,
  error = false,
  errorMessage,
  disabled = false,
  noFocusStyle = false,
  autoFocus = false,
  style,
  testID,
  accessibilityLabel,
}) => {
  const theme = useTheme();
  const colors = getColors(theme.mode, theme.accentColor);
  const [isFocused, setIsFocused] = useState(false);
  const [textAreaHeight, setTextAreaHeight] = useState<number | undefined>(
    undefined
  );
  const textInputRef = useRef<TextInput>(null);

  const getBorderColor = () => {
    if (error) return colors.field.borderError;
    if (isFocused && !noFocusStyle) return colors.field.borderFocus;
    return colors.field.border;
  };

  // Auto-resize functionality for React Native
  const handleContentSizeChange = (event: any) => {
    if (autoResize) {
      const { height } = event.nativeEvent.contentSize;
      const lineHeight = 20; // Line height for React Native
      const paddingHeight = 20; // Top + bottom padding

      const minHeight = (minRows || 1) * lineHeight + paddingHeight;
      const maxHeight = (maxRows || 10) * lineHeight + paddingHeight;

      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, height + paddingHeight)
      );
      setTextAreaHeight(newHeight);
    }
  };

  const getTextAreaStyles = () => {
    const baseStyles = [styles.textArea];

    // Calculate height based on rows if not auto-resizing
    const calculatedHeight = autoResize
      ? textAreaHeight
      : Math.max(rows || 3, 1) * 20 + 20; // 20px line height + padding

    if (variant === 'onboarding') {
      return [
        ...baseStyles,
        styles.textAreaOnboarding,
        {
          backgroundColor: '#ffffff',
          color: colors.accent[700],
          borderColor: getBorderColor(),
          height: calculatedHeight,
        },
        error && styles.textAreaError,
        disabled && styles.textAreaDisabled,
      ];
    }

    return [
      ...baseStyles,
      {
        backgroundColor: colors.field.bg,
        color: colors.field.text,
        borderColor: getBorderColor(),
        height: calculatedHeight,
      },
      error && styles.textAreaError,
      disabled && styles.textAreaDisabled,
    ];
  };

  const containerStyle = [styles.container, style];

  const textAreaStyle = getTextAreaStyles();

  return (
    <View style={containerStyle}>
      <TextInput
        ref={textInputRef}
        style={textAreaStyle}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={
          variant === 'onboarding' ? colors.accent[200] : colors.field.placeholder
        }
        onChangeText={onChange}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onContentSizeChange={handleContentSizeChange}
        returnKeyType={returnKeyType}
        autoComplete={autoComplete}
        multiline={multiline}
        editable={!disabled}
        autoFocus={autoFocus}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        textAlignVertical="top" // Start text at top for multiline
      />
      {error && errorMessage && (
        <Text
          style={[styles.errorMessage, { color: colors.field.borderError }]}
          role="alert"
        >
          {errorMessage}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // No additional container styling needed
  },
  textArea: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    textAlignVertical: 'top',
  },
  textAreaOnboarding: {
    borderRadius: 16, // More rounded for onboarding
  },
  textAreaError: {
    borderWidth: 1,
    // borderColor set dynamically from theme
  },
  textAreaDisabled: {
    opacity: 0.6,
  },
  errorMessage: {
    fontSize: 14,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
