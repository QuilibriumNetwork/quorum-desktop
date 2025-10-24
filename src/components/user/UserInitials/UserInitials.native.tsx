import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserInitialsProps } from './UserInitials.types';
import { getInitials, lightenColor, darkenColor } from '../../../utils/avatar';

// Unknown user gradient colors (light theme - matches web CSS)
// Light theme: surface-10 base (#939399) with +5% / -10% lightness
const UNKNOWN_GRADIENT_LIGHT = '#9d9da3';
const UNKNOWN_GRADIENT_DARK = '#7a7a7f';

export function UserInitials({
  name,
  backgroundColor,
  size = 40,
  testID,
  onPress
}: UserInitialsProps) {
  // Memoize initials calculation for performance
  const initials = useMemo(() => getInitials(name), [name]);

  // Check if this is an unknown user (performance: O(1) string comparison)
  const isUnknown = initials === '?';

  // Memoize gradient colors for performance (only recalculates when backgroundColor changes)
  // Use grey gradient for unknown users, colored gradient for known users
  const gradientColors = useMemo(() => {
    if (isUnknown) {
      return [UNKNOWN_GRADIENT_LIGHT, UNKNOWN_GRADIENT_DARK] as const;
    }
    return [
      lightenColor(backgroundColor, 5),
      darkenColor(backgroundColor, 10)
    ] as const;
  }, [backgroundColor, isUnknown]);

  // Memoize style object to prevent recreation on every render
  const containerStyle = useMemo(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
  }), [size]);

  // Memoize font size for performance
  const textStyle = useMemo(() => ({
    fontSize: size * 0.4
  }), [size]);

  const gradientContent = (
    <LinearGradient
      colors={gradientColors}
      style={[styles.container, containerStyle]}
      testID={testID}
    >
      <Text style={[styles.text, textStyle]}>
        {initials}
      </Text>
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {gradientContent}
      </TouchableOpacity>
    );
  }

  return gradientContent;
}

// React Native StyleSheet using dp units
const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: undefined, // Let RN handle line height
  },
});
