import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ResponsiveContainerProps } from './types';
import { useTheme } from '../theme';

/**
 * ResponsiveContainer React Native Implementation
 *
 * Provides proper layout for mobile screens.
 * Note: SafeAreaView will be added when React Native environment is available.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.sidebar }]}>
      <View style={[styles.content, { backgroundColor: colors.bg.sidebar }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 14, // Match web top offset
    paddingLeft: 16, // Standard mobile padding
    paddingRight: 16,
    borderTopLeftRadius: 12, // 0.75rem equivalent
  },
});
