import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { ColorSwatchNativeProps } from './types';
import { useTheme } from '../theme';
import { getColors } from '../theme/colors';

export const ColorSwatch: React.FC<ColorSwatchNativeProps> = ({
  color,
  isActive = false,
  onPress,
  size = 'medium',
  showCheckmark = true,
  disabled = false,
  style,
  testID,
}) => {
  const theme = useTheme();
  const colors = getColors(theme.mode, color as any);
  const themeColors = getColors(theme.mode, theme.accentColor);

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { width: 24, height: 24 };
      case 'large':
        return { width: 40, height: 40 };
      default:
        return { width: 32, height: 32 };
    }
  };

  const sizeStyle = getSizeStyle();
  const checkmarkSize = size === 'small' ? 12 : size === 'large' ? 20 : 16;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      testID={testID}
      style={[
        styles.container,
        sizeStyle,
        {
          backgroundColor: colors.accent.DEFAULT,
          borderColor: isActive ? colors.accent[600] : colors.accent.DEFAULT,
          opacity: disabled ? 0.5 : 1,
          borderRadius: sizeStyle.width / 2, // Ensure perfect circle by using half the width
        },
        isActive && {
          shadowColor: colors.accent[600],
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 4,
        },
        style,
      ]}
    >
      {isActive && showCheckmark && (
        <Text style={[styles.checkmark, { fontSize: checkmarkSize }]}>✓</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Ensure content doesn't break the circle
  },
  checkmark: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
