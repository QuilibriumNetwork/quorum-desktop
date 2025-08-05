import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import primitives for theme testing
import { FlexRow } from '../components/primitives/FlexRow';
import { FlexBetween } from '../components/primitives/FlexBetween';
import { FlexCenter } from '../components/primitives/FlexCenter';
import Button from '../components/primitives/Button';
import Modal from '../components/primitives/Modal';

// Import theme system
import { useTheme } from '../components/primitives/theme';
import { Text } from '../components/primitives/Text';
import { Icon } from '../components/primitives/Icon';
import { commonTestStyles } from '../styles/commonTestStyles';

/**
 * Mobile theme testing screen
 * Tests cross-platform theme system on React Native
 */
export const ThemeTestScreen: React.FC = () => {
  const theme = useTheme();
  const { currentTheme, accentColor, toggleTheme, setAccentColor } = theme;
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
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.titleContainer}>
          <Icon name="palette" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
          <Text size="2xl" weight="bold" variant="strong">
            Theme System Test
          </Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Testing cross-platform theme system on React Native
          </Text>
        </View>

        {/* Current Theme Info */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Current Theme
            </Text>
          </View>

          <FlexBetween style={{ paddingVertical: 8, marginBottom: 8 }}>
            <Text size="sm" weight="medium" variant="default">
              Mode:
            </Text>
            <Text size="sm" weight="semibold" variant="strong" style={{ textTransform: 'capitalize' }}>
              {currentTheme.mode}
            </Text>
          </FlexBetween>

          <FlexBetween style={{ paddingVertical: 8, marginBottom: 8 }}>
            <Text size="sm" weight="medium" variant="default">
              Accent Color:
            </Text>
            <Text size="sm" weight="semibold" color={theme.colors.accent[500]} style={{ textTransform: 'capitalize' }}>
              {accentColor}
            </Text>
          </FlexBetween>

          <View style={{ marginTop: 12 }}>
            <Button
              type="primary"
              onClick={toggleTheme}
            >
              Toggle {currentTheme.mode === 'light' ? 'Dark' : 'Light'} Mode
            </Button>
          </View>
        </View>

        {/* Accent Colors */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Accent Colors
            </Text>
          </View>

          <FlexRow gap="sm" wrap style={{ marginTop: 8 }}>
            {accentColors.map((color) => (
              <Button
                key={color.value}
                type={accentColor === color.value ? 'primary' : 'secondary'}
                onClick={() => setAccentColor(color.value as any)}
                style={{ minWidth: 80 }}
              >
                {color.name}
              </Button>
            ))}
          </FlexRow>
        </View>

        {/* Color Samples */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Color Samples
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            {/* Text Colors */}
            <View style={{ marginBottom: 16 }}>
              <Text size="base" weight="semibold" variant="strong">
                Text Colors
              </Text>
              <Text size="sm" weight="medium" color={theme.colors.text.strong} style={{ marginBottom: 4 }}>
                text-strong
              </Text>
              <Text size="sm" weight="medium" color={theme.colors.text.main} style={{ marginBottom: 4 }}>
                text-main
              </Text>
              <Text size="sm" weight="medium" color={theme.colors.text.subtle} style={{ marginBottom: 4 }}>
                text-subtle
              </Text>
              <Text size="sm" weight="medium" color={theme.colors.text.muted} style={{ marginBottom: 4 }}>
                text-muted
              </Text>
            </View>

            {/* Surface Colors */}
            <View style={{ marginBottom: 16 }}>
              <Text size="base" weight="semibold" variant="strong">
                Surface Colors
              </Text>
              <View style={[commonTestStyles.surfaceSample, { backgroundColor: theme.colors.surface[0] }]}>
                <Text size="xs" weight="medium" color={theme.colors.text.main}>
                  surface-0
                </Text>
              </View>
              <View style={[commonTestStyles.surfaceSample, { backgroundColor: theme.colors.surface[1] }]}>
                <Text size="xs" weight="medium" color={theme.colors.text.main}>
                  surface-1
                </Text>
              </View>
              <View style={[commonTestStyles.surfaceSample, { backgroundColor: theme.colors.surface[3] }]}>
                <Text size="xs" weight="medium" color={theme.colors.text.main}>
                  surface-3
                </Text>
              </View>
            </View>

            {/* Accent Colors */}
            <View style={{ marginBottom: 16 }}>
              <Text size="base" weight="semibold" variant="strong">
                Accent Variants
              </Text>
              <View style={[commonTestStyles.surfaceSample, { backgroundColor: theme.colors.accent[50] }]}>
                <Text size="xs" weight="medium" color={theme.colors.text.main}>
                  accent-50
                </Text>
              </View>
              <View style={[commonTestStyles.surfaceSample, { backgroundColor: theme.colors.accent[500] }]}>
                <Text size="xs" variant="default" color="white">
                  accent (500)
                </Text>
              </View>
              <View style={[commonTestStyles.surfaceSample, { backgroundColor: theme.colors.accent[900] }]}>
                <Text size="xs" variant="default" color="white">
                  accent-900
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Theme Modal Test */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Theme in Modal
            </Text>
          </View>
          <View style={{ marginBottom: 12 }}>
            <Text size="sm" variant="subtle">
              Test theme consistency within modal components
            </Text>
          </View>

          <Button
            type="primary"
            onClick={() => setShowThemeModal(true)}
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
        <View style={{ padding: 16 }}>
          <Text size="sm" variant="default" style={{ lineHeight: 20, marginBottom: 16 }}>
            This modal demonstrates theme consistency across components. The
            theme system ensures all colors and styles remain consistent.
          </Text>

          <View style={{ padding: 16, borderRadius: 8, marginBottom: 16, backgroundColor: theme.colors.surface[1] }}>
            <Text size="base" weight="semibold" variant="strong" style={{ marginBottom: 8 }}>
              Theme Demo
            </Text>
            <Text size="sm" variant="subtle" style={{ marginBottom: 4 }}>
              Current mode: {currentTheme.mode}
            </Text>
            <Text size="sm" color={theme.colors.accent[500]} style={{ marginBottom: 4 }}>
              Accent: {accentColor}
            </Text>
          </View>

          <FlexRow gap="md" justify="end" style={{ marginTop: 16 }}>
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

// All styles now centralized in commonTestStyles
