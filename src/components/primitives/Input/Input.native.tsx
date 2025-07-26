import React from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { InputNativeProps } from './types';
import { useTheme } from '../theme';

export const Input: React.FC<InputNativeProps> = ({
  value,
  placeholder,
  onChange,
  variant = 'default',
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

  const getInputStyles = () => {
    const baseStyles = [styles.input];

    if (variant === 'onboarding') {
      return [
        ...baseStyles,
        styles.inputOnboarding,
        {
          backgroundColor: '#ffffff',
          color: theme.colors.accent[700],
          borderColor: error ? theme.colors.danger : 'transparent',
        },
        error && styles.inputError,
        disabled && styles.inputDisabled,
      ];
    }

    return [
      ...baseStyles,
      {
        backgroundColor: theme.colors.surface[3],
        color: theme.colors.text.main,
        borderColor: error ? theme.colors.danger : 'transparent',
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
            ? theme.colors.accent[200]
            : theme.colors.text.muted
        }
        onChangeText={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
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
          style={[styles.errorMessage, { color: theme.colors.danger }]}
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
    fontSize: 14,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
