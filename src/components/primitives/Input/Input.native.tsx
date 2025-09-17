import React from 'react';
import { TextInput, View, Text, StyleSheet, Animated } from 'react-native';
import { InputNativeProps } from './types';
import { useTheme } from '../theme';

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
  onSubmitEditing,
  style,
  testID,
  accessibilityLabel,
  label,
  labelType = 'static',
  required = false,
  helperText,
}) => {
  const theme = useTheme();
  const colors = theme.colors;
  const [isFocused, setIsFocused] = React.useState(false);
  const animatedLabelPosition = React.useRef(
    new Animated.Value(value ? 1 : 0)
  ).current;

  const hasValue = value && value.length > 0;
  const showFloatingLabel = labelType === 'floating' && label;

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
    // Add top margin when floating label is active to prevent overlapping
    showFloatingLabel && (isFocused || hasValue) && { marginTop: 20 },
    style
  ];

  const getBorderColor = () => {
    if (error) return colors.utilities.danger;
    if (isFocused && !noFocusStyle) {
      if (variant === 'onboarding') return '#3aa9f8'; // Hardcoded brand blue-400
      return colors.field.borderFocus;
    }
    if (variant === 'bordered') return colors.field.border;
    if (variant === 'minimal') return 'transparent'; // minimal variant has transparent border (bottom border is handled separately)
    return 'transparent'; // filled and onboarding variants have transparent border by default
  };

  const getBackgroundColor = () => {
    if (variant === 'onboarding') return '#ffffff'; // Always white for onboarding
    if (variant === 'minimal') return 'transparent'; // Minimal variant has transparent background
    // All other variants use the same background colors
    if (isFocused && !disabled) return colors.field.bgFocus;
    return colors.field.bg;
  };

  // Animate label position for floating labels
  React.useEffect(() => {
    Animated.timing(animatedLabelPosition, {
      toValue: isFocused || hasValue ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, hasValue]);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const getInputStyles = () => {
    const baseStyles = [styles.input];

    // Add padding for floating label
    if (showFloatingLabel) {
      baseStyles.push(styles.inputWithFloatingLabel);
    }

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

    if (variant === 'minimal') {
      return [
        ...baseStyles,
        styles.inputMinimal,
        {
          backgroundColor: getBackgroundColor(),
          color: colors.field.text,
          borderColor: getBorderColor(),
          borderBottomColor: error ? colors.utilities.danger : (isFocused && !noFocusStyle ? colors.field.borderFocus : colors.field.border),
        },
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

  const getLabelColor = () => {
    if (error) return colors.text.danger;
    if (isFocused || hasValue) return colors.text.main; // When active, use main text color like static labels
    return colors.text.subtle;
  };

  return (
    <View style={containerStyle}>
      {/* Static Label */}
      {label && labelType === 'static' && (
        <Text style={[styles.staticLabel, { color: colors.text.main }]}>
          {label}
          {required && (
            <Text style={[styles.required, { color: colors.text.danger }]}>
              {' '}
              *
            </Text>
          )}
        </Text>
      )}

      {/* Input container for floating label */}
      <View style={showFloatingLabel ? styles.floatingContainer : undefined}>
        <TextInput
          style={inputStyle}
          value={value}
          placeholder={
            showFloatingLabel
              ? isFocused || hasValue
                ? '' // No placeholder when floating label is active
                : label // Use label as placeholder when inactive
              : placeholder // Normal placeholder for non-floating inputs
          }
          placeholderTextColor={
            variant === 'onboarding'
              ? '#6fc3ff' // Hardcoded brand blue-200
              : colors.field.placeholder
          }
          onChangeText={onChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onSubmitEditing={onSubmitEditing}
          keyboardType={getKeyboardType()}
          returnKeyType={returnKeyType}
          autoComplete={autoComplete}
          secureTextEntry={secureTextEntry || type === 'password'}
          editable={!disabled}
          autoFocus={autoFocus}
          testID={testID}
          accessibilityLabel={accessibilityLabel || label}
        />

        {/* Floating Label - only show when active (focused or has value) */}
        {showFloatingLabel && (isFocused || hasValue) && (
          <Text
            style={[
              styles.floatingLabel,
              {
                color: getLabelColor(),
                fontSize: 12,
                fontWeight: '600',
                top: -20, // Closer to the input field
                left: 0, // Align with left edge of input field
              },
            ]}
            pointerEvents="none"
          >
            {label.toUpperCase()}
            {required && (
              <Text style={[styles.required, { color: colors.text.danger }]}>
                {' '}
                *
              </Text>
            )}
          </Text>
        )}
      </View>

      {/* Helper text */}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: colors.text.subtle }]}>
          {helperText}
        </Text>
      )}

      {/* Error message */}
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
  inputWithFloatingLabel: {
    // Keep same padding as normal input
    // Floating label positions itself over the border
  },
  inputOnboarding: {
    borderRadius: 9999, // full pill shape like CSS border-radius: 9999px
  },
  inputMinimal: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    paddingHorizontal: 4, // Minimal padding for cleaner look
    paddingTop: 0,
    paddingBottom: 2, // Reduced bottom padding for tighter look
    height: 28, // Smaller height for minimal variant
  },
  inputError: {
    borderWidth: 1,
    // borderColor set dynamically from theme
  },
  inputDisabled: {
    opacity: 0.6,
  },
  staticLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  floatingContainer: {
    position: 'relative',
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    fontSize: 16,
    fontWeight: '400',
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
  },
  required: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
    textAlign: 'left',
  },
  errorMessage: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
    textAlign: 'left',
  },
});
