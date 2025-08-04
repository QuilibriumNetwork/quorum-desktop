import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { ColorSwatchNativeProps } from './types';
import { useTheme } from '../theme';
import { Icon } from '../Icon';

// Helper function to get hex color for accent colors
const getColorHex = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    blue: '#3b82f6', // blue-500
    purple: '#8b5cf6', // purple-500
    fuchsia: '#d946ef', // fuchsia-500
    orange: '#f97316', // orange-500
    green: '#22c55e', // green-500
    yellow: '#eab308', // yellow-500
  };
  return colorMap[color] || '#3b82f6';
};

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
  const themeColors = theme.colors;

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
          backgroundColor: getColorHex(color),
          borderColor: isActive ? getColorHex(color) : 'transparent',
          borderWidth: isActive ? 2 : 0, // No border when unchecked for perfect circle
          opacity: disabled ? 0.5 : 1,
          borderRadius: sizeStyle.width / 2, // Ensure perfect circle by using half the width
        },
        isActive && {
          shadowColor: getColorHex(color),
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 4,
        },
        style,
      ]}
    >
      {isActive && showCheckmark && (
        <Icon
          name="check"
          size={size === 'small' ? 'xs' : size === 'large' ? 'lg' : 'sm'}
          color="#ffffff"
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Ensure content doesn't break the circle
  },
});
