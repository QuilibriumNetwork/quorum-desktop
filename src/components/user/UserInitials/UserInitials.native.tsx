import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserInitialsProps } from './UserInitials.types';
import { getInitials } from '../../../utils/avatar';

export function UserInitials({
  name,
  backgroundColor,
  size = 40,
  testID,
  onPress
}: UserInitialsProps) {
  // Memoize initials calculation for performance
  const initials = useMemo(() => getInitials(name), [name]);

  // Memoize style object to prevent recreation on every render
  const containerStyle = useMemo(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
  }), [size, backgroundColor]);

  // Memoize font size for performance
  const textStyle = useMemo(() => ({
    fontSize: size * 0.4
  }), [size]);

  const ViewComponent = onPress ? require('react-native').TouchableOpacity : View;

  return (
    <ViewComponent
      testID={testID}
      style={[styles.container, containerStyle]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.text, textStyle]}>
        {initials}
      </Text>
    </ViewComponent>
  );
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
