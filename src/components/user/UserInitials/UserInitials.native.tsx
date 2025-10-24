import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserInitialsProps } from './UserInitials.types';
import { getInitials, lightenColor, darkenColor } from '../../../utils/avatar';

export function UserInitials({
  name,
  backgroundColor,
  size = 40,
  testID,
  onPress
}: UserInitialsProps) {
  // Memoize initials calculation for performance
  const initials = useMemo(() => getInitials(name), [name]);

  // Memoize gradient colors for performance (only recalculates when backgroundColor changes)
  const gradientColors = useMemo(() => [
    lightenColor(backgroundColor, 5),
    darkenColor(backgroundColor, 10)
  ] as const, [backgroundColor]);

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
