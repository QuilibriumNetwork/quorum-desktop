import React from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { InputNativeProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

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
  const colors = getColors('light', 'blue'); // Use default light theme with blue accent
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

  const containerStyle = [
    styles.container,
    style,
  ];

  const getBorderColor = () => {
    if (error) return colors.utilities.danger;
    if (isFocused && !noFocusStyle) return colors.accent.DEFAULT;
    return 'transparent';
  };

  const getInputStyles = () => {
    const baseStyles = [styles.input];
    
    if (variant === 'onboarding') {
      return [
        ...baseStyles,
        styles.inputOnboarding,
        {
          backgroundColor: '#ffffff',
          color: colors.accent[700],
          borderColor: getBorderColor(),
        },
        error && styles.inputError,
        disabled && styles.inputDisabled,
      ];
    }
    
    return [
      ...baseStyles,
      {
        backgroundColor: colors.bg.input,
        color: colors.text.main,
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
        placeholderTextColor={variant === 'onboarding' ? colors.accent[200] : colors.text.muted}
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
        <Text style={[styles.errorMessage, { color: colors.utilities.danger }]} role="alert">
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