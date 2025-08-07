import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import primitives for theme testing
import { FlexRow, FlexColumn, FlexBetween, Button, Modal, Text, Paragraph, Label, Title, Icon, useTheme } from '@/primitives';
import ThemeRadioGroup from '../../src/components/ThemeRadioGroup';
import AccentColorSwitcher from '../../src/components/AccentColorSwitcher';
import { commonTestStyles, createThemedStyles } from '../styles/commonTestStyles';

/**
 * Mobile theme testing screen
 * Tests cross-platform theme system on React Native
 */
export const ThemeTestScreen: React.FC = () => {
  const themeContext = useTheme();
  const { resolvedTheme, accent, colors } = themeContext;
  const themedStyles = createThemedStyles(themeContext);
  const [showThemeModal, setShowThemeModal] = useState(false);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
          <Icon name="palette" size="xl" style={{ marginTop: 2 }} />
          <Title>Theme System Test</Title>
        </FlexRow>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Testing cross-platform theme system on React Native
          </Text>
        </View>

        {/* Current Theme Info */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Current Theme</Title>

          <FlexBetween style={{ paddingVertical: 8, marginBottom: 8 }}>
            <Text size="sm" weight="medium" variant="default">
              Mode:
            </Text>
            <Text size="sm" weight="semibold" variant="strong">
              {resolvedTheme}
            </Text>
          </FlexBetween>

          <FlexBetween style={{ paddingVertical: 8, marginBottom: 8 }}>
            <Text size="sm" weight="medium" variant="default">
              Accent Color:
            </Text>
            <Text size="sm" weight="semibold" color={colors.accent[500]}>
              {accent}
            </Text>
          </FlexBetween>

            <ThemeRadioGroup horizontal />
          </FlexColumn>
        </View>

        {/* Accent Colors */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Accent Colors</Title>

            <AccentColorSwitcher />
          </FlexColumn>
        </View>

        {/* Color Samples */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Color Samples</Title>

            <FlexColumn gap="lg">
              {/* Text Colors */}
              <FlexColumn gap="sm">
                <Label weight="semibold">Text Colors</Label>
                <Text size="sm" weight="medium" color={colors.text.strong}>
                  text-strong
                </Text>
                <Text size="sm" weight="medium" color={colors.text.main}>
                  text-main
                </Text>
                <Text size="sm" weight="medium" color={colors.text.subtle}>
                  text-subtle
                </Text>
                <Text size="sm" weight="medium" color={colors.text.muted}>
                  text-muted
                </Text>
              </FlexColumn>

              {/* Surface Colors */}
              <FlexColumn gap="sm">
                <Label weight="semibold">Surface Colors</Label>
                <View style={[commonTestStyles.surfaceSample, { backgroundColor: colors.surface[0] }]}>
                  <Text size="xs" weight="medium" color={colors.text.main}>
                    surface-0
                  </Text>
                </View>
                <View style={[commonTestStyles.surfaceSample, { backgroundColor: colors.surface[1] }]}>
                  <Text size="xs" weight="medium" color={colors.text.main}>
                    surface-1
                  </Text>
                </View>
                <View style={[commonTestStyles.surfaceSample, { backgroundColor: colors.surface[3] }]}>
                  <Text size="xs" weight="medium" color={colors.text.main}>
                    surface-3
                  </Text>
                </View>
              </FlexColumn>

              {/* Accent Colors */}
              <FlexColumn gap="sm">
                <Label weight="semibold">Accent Variants</Label>
                <View style={[commonTestStyles.surfaceSample, { backgroundColor: colors.accent[50] }]}>
                  <Text size="xs" weight="medium" color={colors.text.main}>
                    accent-50
                  </Text>
                </View>
                <View style={[commonTestStyles.surfaceSample, { backgroundColor: colors.accent[500] }]}>
                  <Text size="xs" variant="default" color="white">
                    accent (500)
                  </Text>
                </View>
                <View style={[commonTestStyles.surfaceSample, { backgroundColor: colors.accent[900] }]}>
                  <Text size="xs" variant="default" color="white">
                    accent-900
                  </Text>
                </View>
              </FlexColumn>
            </FlexColumn>
          </FlexColumn>
        </View>

        {/* Theme Modal Test */}
        <View style={themedStyles.section}>
          <FlexColumn gap="md">
            <Title size="sm">Theme in Modal</Title>
            <Paragraph size="sm" variant="subtle">
              Test theme consistency within modal components
            </Paragraph>

            <Button
              type="primary"
              onClick={() => setShowThemeModal(true)}
            >
              Open Themed Modal
            </Button>
          </FlexColumn>
        </View>
      </ScrollView>

      {/* Themed Modal */}
      <Modal
        title="Themed Modal"
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        size="medium"
      >
        <FlexColumn gap="md" style={{ padding: 16 }}>
          <Paragraph size="sm" variant="default">
            This modal demonstrates theme consistency across components. The
            theme system ensures all colors and styles remain consistent.
          </Paragraph>

          <View style={{ padding: 16, borderRadius: 8, backgroundColor: colors.surface[1] }}>
            <FlexColumn gap="xs">
              <Label weight="semibold">Theme Demo</Label>
              <Text size="sm" variant="subtle">
                Current mode: {resolvedTheme}
              </Text>
              <Text size="sm" color={colors.accent[500]}>
                Accent: {accent}
              </Text>
            </FlexColumn>
          </View>

          <FlexRow gap="md" justify="end">
            <Button type="secondary" onClick={() => setShowThemeModal(false)}>
              Close
            </Button>
            <View style={{ width: 200 }}>
              <ThemeRadioGroup horizontal />
            </View>
          </FlexRow>
        </FlexColumn>
      </Modal>
    </SafeAreaView>
  );
};


