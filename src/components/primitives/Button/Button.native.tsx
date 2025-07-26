import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { NativeButtonProps } from './types';
import { useCrossPlatformTheme } from '../theme/ThemeProvider';

const Button: React.FC<NativeButtonProps> = (props) => {
  const { colors } = useCrossPlatformTheme();

  const handlePress = () => {
    if (!props.disabled) {
      // Add haptic feedback if enabled
      if (props.hapticFeedback) {
        // Note: Would require expo-haptics or similar
        // HapticFeedback.impactAsync(HapticFeedback.ImpactFeedbackStyle.Light);
      }
      props.onClick();
    }
  };

  const getButtonStyle = () => {
    const type = props.type || 'primary';
    const size = props.size || 'normal';

    let style = [styles.base];

    // Add type-specific styles using dynamic colors
    switch (type) {
      case 'primary':
        style.push({
          backgroundColor: colors.accent.DEFAULT,
          borderColor: colors.accent.DEFAULT,
        });
        break;
      case 'secondary':
        style.push({
          backgroundColor: colors.transparent,
          borderColor: colors.accent.DEFAULT,
        });
        break;
      case 'light':
        style.push({
          backgroundColor: colors.accent[100],
          borderColor: colors.accent[100],
        });
        break;
      case 'danger':
        style.push({
          backgroundColor: colors.utilities.danger,
          borderColor: colors.transparent,
        });
        break;
      default:
        style.push({
          backgroundColor: colors.accent.DEFAULT,
          borderColor: colors.accent.DEFAULT,
        });
    }

    // Add size-specific styles
    if (size === 'small') {
      style.push(styles.small);
    }

    // Remove shadows for transparent background types (must come after size styles)
    if (type === 'secondary') {
      style.push({
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      });
    }

    // Add disabled styles
    if (props.disabled) {
      style.push({
        backgroundColor: colors.surface[3],
        borderColor: colors.transparent,
        shadowOpacity: 0,
        elevation: 0,
      });
    }

    return style;
  };

  const getTextStyle = () => {
    const type = props.type || 'primary';
    const size = props.size || 'normal';

    let style = [styles.text];

    // Add size-specific text styles
    if (size === 'small') {
      style.push(styles.textSmall);
    }

    // Add type-specific text styles using dynamic colors
    switch (type) {
      case 'secondary':
        style.push({ color: colors.accent.DEFAULT });
        break;
      case 'light':
        style.push({ color: colors.accent[700] });
        break;
      default:
        style.push({ color: colors.white });
    }

    if (props.disabled) {
      style.push({ color: colors.surface[5] });
    }

    return style;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        ...getButtonStyle(),
        pressed && !props.disabled && styles.pressed,
      ]}
      onPress={handlePress}
      disabled={props.disabled}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
    >
      <Text style={getTextStyle()}>{props.children}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  small: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  textSmall: {
    fontSize: 12,
  },
});

export default Button;
