/**
 * React Native Entry Point for Quorum Mobile App
 * 
 * This file serves as the mobile application entry point.
 * It will be implemented when mobile development begins.
 * 
 * For now, this is a placeholder structure that demonstrates
 * how the shared codebase will be used on mobile.
 */

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

// Future mobile entry point will look like this:
// import { NavigationContainer } from '@react-navigation/native';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { I18nProvider } from '@lingui/react';
// import { ThemeProvider } from '../src/components/primitives/theme';
// import { i18n } from '../src/i18n/i18n';
// import App from '../src/App'; // SAME App component as web!

export default function MobileApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quorum Mobile</Text>
      <Text style={styles.subtitle}>Coming Soon</Text>
      <Text style={styles.description}>
        The mobile version of Quorum will share 90% of its code with the web version,
        enabling rapid development and consistent features across platforms.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});