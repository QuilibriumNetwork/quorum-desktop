import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { NativeButtonProps } from './types';
import { useCrossPlatformTheme } from '../theme/ThemeProvider';
import { Icon } from '../Icon';

const Button: React.FC<NativeButtonProps> = (props) => {
  const { colors } = useCrossPlatformTheme();

  const handlePress = () => {
    if (!props.disabled && props.onClick) {
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
          backgroundColor: 'transparent',
          borderColor: colors.accent.DEFAULT,
        });
        break;
      case 'light':
        style.push({
          backgroundColor: colors.accent[100],
          borderColor: colors.accent[100],
        });
        break;
      case 'light-outline':
        style.push({
          backgroundColor: 'transparent',
          borderColor: colors.accent[100],
          shadowOpacity: 0,
          elevation: 0,
        });
        break;
      case 'subtle':
        style.push({
          backgroundColor: colors.surface[6],
          borderColor: colors.surface[6],
        });
        break;
      case 'subtle-outline':
        style.push({
          backgroundColor: 'transparent',
          borderColor: colors.surface[6],
          shadowOpacity: 0,
          elevation: 0,
        });
        break;
      case 'danger':
        style.push({
          backgroundColor: colors.utilities.danger,
          borderColor: 'transparent',
        });
        break;
      case 'primary-white':
        style.push({
          backgroundColor: colors.white,
          borderColor: colors.white,
        });
        break;
      case 'secondary-white':
        style.push({
          backgroundColor: 'transparent',
          borderColor: colors.white,
          shadowOpacity: 0,
          elevation: 0,
        });
        break;
      case 'light-outline-white':
        style.push({
          backgroundColor: 'transparent',
          borderColor: 'rgba(255, 255, 255, 0.8)',
          shadowOpacity: 0,
          elevation: 0,
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
    } else if (size === 'large') {
      style.push(styles.large);
    }

    // Add icon-only specific styles
    if (props.iconOnly) {
      style.push(styles.iconOnly);
      if (size === 'small') {
        style.push(styles.iconOnlySmall);
      } else if (size === 'large') {
        style.push(styles.iconOnlyLarge);
      }
    }

    // Remove shadows for transparent background types (must come after size styles)
    if (
      type === 'secondary' ||
      type === 'light-outline' ||
      type === 'subtle-outline' ||
      type === 'secondary-white' ||
      type === 'light-outline-white'
    ) {
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

  const getTextColor = () => {
    const type = props.type || 'primary';

    if (props.disabled) {
      return colors.surface[8]; // Darker grey for disabled text
    }

    // Get text color based on button type
    switch (type) {
      case 'secondary':
        return colors.accent.DEFAULT;
      case 'light':
        return colors.accent[700];
      case 'light-outline':
        return colors.accent[100];
      case 'subtle':
        return colors.text.main;
      case 'subtle-outline':
        return colors.text.subtle;
      case 'primary-white':
        return '#0287f2'; // Hardcoded blue as in CSS
      case 'secondary-white':
      case 'light-outline-white':
        return colors.white;
      default:
        return colors.white;
    }
  };

  const getTextStyle = () => {
    const size = props.size || 'normal';
    let style = [styles.text];

    // Add size-specific text styles
    if (size === 'small') {
      style.push(styles.textSmall);
    } else if (size === 'large') {
      style.push(styles.textLarge);
    }

    // Add color
    style.push({ color: getTextColor() });

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
      <View style={styles.content}>
        {props.iconName && (
          <View style={!props.iconOnly ? styles.iconWithText : undefined}>
            <Icon
              name={props.iconName}
              size={
                props.size === 'small'
                  ? 'sm'
                  : props.size === 'large'
                    ? 'lg'
                    : 'md'
              }
              color={getTextColor()}
            />
          </View>
        )}
        {!props.iconOnly && (
          <Text style={getTextStyle()}>{props.children}</Text>
        )}
      </View>
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
  textLarge: {
    fontSize: 16,
  },
  large: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 26,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWithText: {
    marginRight: 8,
  },
  iconOnly: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: 22,
  },
  iconOnlySmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconOnlyLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
});

export default Button;
