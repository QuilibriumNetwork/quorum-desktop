import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import primitives for theme testing
import { FlexRow } from '../components/primitives/FlexRow';
import { FlexBetween } from '../components/primitives/FlexBetween';
import { FlexCenter } from '../components/primitives/FlexCenter';
import Button from '../components/primitives/Button';
import Modal from '../components/primitives/Modal';

// Import theme system
import { useTheme } from '../components/primitives/theme';

/**
 * Mobile theme testing screen
 * Tests cross-platform theme system on React Native
 */
export const ThemeTestScreen: React.FC = () => {
  const { currentTheme, accentColor, toggleTheme, setAccentColor } = useTheme();
  const [showThemeModal, setShowThemeModal] = useState(false);

  const accentColors = [
    { name: 'Blue', value: 'blue' },
    { name: 'Purple', value: 'purple' },
    { name: 'Fuchsia', value: 'fuchsia' },
    { name: 'Orange', value: 'orange' },
    { name: 'Green', value: 'green' },
    { name: 'Yellow', value: 'yellow' },
  ];

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors['bg-app'] },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: currentTheme.colors['text-strong'] },
            ]}
          >
            Theme System Test
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: currentTheme.colors['text-main'] },
            ]}
          >
            Testing cross-platform theme system on React Native
          </Text>
        </View>

        {/* Current Theme Info */}
        <View
          style={[
            styles.section,
            { backgroundColor: currentTheme.colors['bg-sidebar'] },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors['text-strong'] },
            ]}
          >
            Current Theme
          </Text>

          <FlexBetween style={styles.themeInfo}>
            <Text
              style={[
                styles.label,
                { color: currentTheme.colors['text-main'] },
              ]}
            >
              Mode:
            </Text>
            <Text
              style={[
                styles.value,
                { color: currentTheme.colors['text-strong'] },
              ]}
            >
              {currentTheme.mode}
            </Text>
          </FlexBetween>

          <FlexBetween style={styles.themeInfo}>
            <Text
              style={[
                styles.label,
                { color: currentTheme.colors['text-main'] },
              ]}
            >
              Accent Color:
            </Text>
            <Text
              style={[styles.value, { color: currentTheme.colors['accent'] }]}
            >
              {accentColor}
            </Text>
          </FlexBetween>

          <Button
            type="primary"
            onClick={toggleTheme}
            style={styles.actionButton}
          >
            Toggle {currentTheme.mode === 'light' ? 'Dark' : 'Light'} Mode
          </Button>
        </View>

        {/* Accent Colors */}
        <View
          style={[
            styles.section,
            { backgroundColor: currentTheme.colors['bg-sidebar'] },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors['text-strong'] },
            ]}
          >
            Accent Colors
          </Text>

          <FlexRow gap="sm" wrap style={styles.colorGrid}>
            {accentColors.map((color) => (
              <Button
                key={color.value}
                type={accentColor === color.value ? 'primary' : 'secondary'}
                onClick={() => setAccentColor(color.value as any)}
                style={styles.colorButton}
              >
                {color.name}
              </Button>
            ))}
          </FlexRow>
        </View>

        {/* Color Samples */}
        <View
          style={[
            styles.section,
            { backgroundColor: currentTheme.colors['bg-sidebar'] },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors['text-strong'] },
            ]}
          >
            Color Samples
          </Text>

          <View style={styles.colorSamples}>
            {/* Text Colors */}
            <View style={styles.colorGroup}>
              <Text
                style={[
                  styles.groupTitle,
                  { color: currentTheme.colors['text-strong'] },
                ]}
              >
                Text Colors
              </Text>
              <Text
                style={[
                  styles.colorSample,
                  { color: currentTheme.colors['text-strong'] },
                ]}
              >
                text-strong
              </Text>
              <Text
                style={[
                  styles.colorSample,
                  { color: currentTheme.colors['text-main'] },
                ]}
              >
                text-main
              </Text>
              <Text
                style={[
                  styles.colorSample,
                  { color: currentTheme.colors['text-subtle'] },
                ]}
              >
                text-subtle
              </Text>
              <Text
                style={[
                  styles.colorSample,
                  { color: currentTheme.colors['text-muted'] },
                ]}
              >
                text-muted
              </Text>
            </View>

            {/* Surface Colors */}
            <View style={styles.colorGroup}>
              <Text
                style={[
                  styles.groupTitle,
                  { color: currentTheme.colors['text-strong'] },
                ]}
              >
                Surface Colors
              </Text>
              <View
                style={[
                  styles.surfaceSample,
                  { backgroundColor: currentTheme.colors['surface-0'] },
                ]}
              >
                <Text
                  style={[
                    styles.surfaceLabel,
                    { color: currentTheme.colors['text-main'] },
                  ]}
                >
                  surface-0
                </Text>
              </View>
              <View
                style={[
                  styles.surfaceSample,
                  { backgroundColor: currentTheme.colors['surface-1'] },
                ]}
              >
                <Text
                  style={[
                    styles.surfaceLabel,
                    { color: currentTheme.colors['text-main'] },
                  ]}
                >
                  surface-1
                </Text>
              </View>
              <View
                style={[
                  styles.surfaceSample,
                  { backgroundColor: currentTheme.colors['surface-3'] },
                ]}
              >
                <Text
                  style={[
                    styles.surfaceLabel,
                    { color: currentTheme.colors['text-main'] },
                  ]}
                >
                  surface-3
                </Text>
              </View>
            </View>

            {/* Accent Colors */}
            <View style={styles.colorGroup}>
              <Text
                style={[
                  styles.groupTitle,
                  { color: currentTheme.colors['text-strong'] },
                ]}
              >
                Accent Variants
              </Text>
              <View
                style={[
                  styles.surfaceSample,
                  { backgroundColor: currentTheme.colors['accent-50'] },
                ]}
              >
                <Text
                  style={[
                    styles.surfaceLabel,
                    { color: currentTheme.colors['text-main'] },
                  ]}
                >
                  accent-50
                </Text>
              </View>
              <View
                style={[
                  styles.surfaceSample,
                  { backgroundColor: currentTheme.colors['accent'] },
                ]}
              >
                <Text style={[styles.surfaceLabel, { color: 'white' }]}>
                  accent (500)
                </Text>
              </View>
              <View
                style={[
                  styles.surfaceSample,
                  { backgroundColor: currentTheme.colors['accent-900'] },
                ]}
              >
                <Text style={[styles.surfaceLabel, { color: 'white' }]}>
                  accent-900
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Theme Modal Test */}
        <View
          style={[
            styles.section,
            { backgroundColor: currentTheme.colors['bg-sidebar'] },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors['text-strong'] },
            ]}
          >
            Theme in Modal
          </Text>
          <Text
            style={[
              styles.description,
              { color: currentTheme.colors['text-subtle'] },
            ]}
          >
            Test theme consistency within modal components
          </Text>

          <Button
            type="primary"
            onClick={() => setShowThemeModal(true)}
            style={styles.actionButton}
          >
            Open Themed Modal
          </Button>
        </View>
      </ScrollView>

      {/* Themed Modal */}
      <Modal
        title="Themed Modal"
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        size="medium"
      >
        <View style={styles.modalContent}>
          <Text
            style={[
              styles.modalText,
              { color: currentTheme.colors['text-main'] },
            ]}
          >
            This modal demonstrates theme consistency across components. The
            theme system ensures all colors and styles remain consistent.
          </Text>

          <View
            style={[
              styles.modalThemeDemo,
              { backgroundColor: currentTheme.colors['surface-1'] },
            ]}
          >
            <Text
              style={[
                styles.modalDemoTitle,
                { color: currentTheme.colors['text-strong'] },
              ]}
            >
              Theme Demo
            </Text>
            <Text
              style={[
                styles.modalDemoText,
                { color: currentTheme.colors['text-subtle'] },
              ]}
            >
              Current mode: {currentTheme.mode}
            </Text>
            <Text
              style={[
                styles.modalDemoText,
                { color: currentTheme.colors['accent'] },
              ]}
            >
              Accent: {accentColor}
            </Text>
          </View>

          <FlexRow gap="md" justify="end" style={styles.modalActions}>
            <Button type="secondary" onClick={() => setShowThemeModal(false)}>
              Close
            </Button>
            <Button type="primary" onClick={toggleTheme}>
              Toggle Theme
            </Button>
          </FlexRow>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeInfo: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionButton: {
    marginTop: 12,
  },
  colorGrid: {
    marginTop: 8,
  },
  colorButton: {
    minWidth: 80,
  },
  colorSamples: {
    gap: 16,
  },
  colorGroup: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  colorSample: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  surfaceSample: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  surfaceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 18,
  },
  modalContent: {
    padding: 16,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalThemeDemo: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalDemoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDemoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  modalActions: {
    marginTop: 16,
  },
});
