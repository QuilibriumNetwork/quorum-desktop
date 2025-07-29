import React from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { InputNativeProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

export const Input: React.FC<InputNativeProps> = ({
  value,
  placeholder,
  onChange,
  variant = 'filled',
  onBlur,
  onFocus,
  type = 'text',
  keyboardType = 'default',
  returnKeyType = 'done',
  autoComplete = 'off',
  secureTextEntry = false,
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
  const [isFocused, setIsFocused] = React.useState(false);

  // Map type to keyboardType if not explicitly provided
  const getKeyboardType = () => {
    if (keyboardType !== 'default') return keyboardType;

    switch (type) {
      case 'email':
        return 'email-address';
      case 'number':
        return 'numeric';
      case 'tel':
        return 'phone-pad';
      case 'url':
        return 'url';
      default:
        return 'default';
    }
  };

  const containerStyle = [styles.container, style];

  const getBorderColor = () => {
    if (error) return colors.utilities.danger;
    if (isFocused && !noFocusStyle) {
      if (variant === 'onboarding') return '#3aa9f8'; // Hardcoded brand blue-400
      return colors.field.borderFocus;
    }
    if (variant === 'bordered') return colors.field.border;
    return 'transparent'; // filled and onboarding variants have transparent border by default
  };

  const getBackgroundColor = () => {
    if (variant === 'onboarding') return '#ffffff'; // Always white for onboarding
    // All variants use the same background colors
    if (isFocused && !disabled) return colors.field.bgFocus;
    return colors.field.bg;
  };

  const getInputStyles = () => {
    const baseStyles = [styles.input];

    if (variant === 'onboarding') {
      return [
        ...baseStyles,
        styles.inputOnboarding,
        {
          backgroundColor: getBackgroundColor(),
          color: '#034081', // Hardcoded brand blue-700
          borderColor: getBorderColor(),
        },
        error && styles.inputError,
        disabled && styles.inputDisabled,
      ];
    }

    return [
      ...baseStyles,
      {
        backgroundColor: getBackgroundColor(),
        color: colors.field.text,
        borderColor: getBorderColor(),
      },
      error && styles.inputError,
      disabled && styles.inputDisabled,
    ];
  };

  const inputStyle = getInputStyles();

  return (
    <View style={containerStyle}>
      <TextInput
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={
          variant === 'onboarding'
            ? '#6fc3ff' // Hardcoded brand blue-200
            : colors.field.placeholder
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
        keyboardType={getKeyboardType()}
        returnKeyType={returnKeyType}
        autoComplete={autoComplete}
        secureTextEntry={secureTextEntry || type === 'password'}
        editable={!disabled}
        autoFocus={autoFocus}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
      {error && errorMessage && (
        <Text
          style={[styles.errorMessage, { color: colors.text.danger }]}
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
  input: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: 42,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputOnboarding: {
    borderRadius: 9999, // full pill shape like CSS border-radius: 9999px
  },
  inputError: {
    borderWidth: 1,
    // borderColor set dynamically from theme
  },
  inputDisabled: {
    opacity: 0.6,
  },
  errorMessage: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
