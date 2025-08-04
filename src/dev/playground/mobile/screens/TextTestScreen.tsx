import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Text } from '../components/primitives/Text';
import { FlexRow } from '../components/primitives/FlexRow';
import { FlexColumn } from '../components/primitives/FlexColumn';

export const TextTestScreen: React.FC = () => {
  const theme = useTheme();
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text size="2xl" weight="bold">
            Text Primitive Test
          </Text>
          <Text variant="subtle" style={{ marginTop: 8 }}>
            Essential text component for React Native compatibility
          </Text>
        </View>

        {/* Variants Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text size="lg" weight="semibold" style={styles.sectionTitle}>
            Text Variants
          </Text>

          <FlexColumn gap="md">
            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="default">
                Default variant - Regular text for content
              </Text>
            </View>

            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="strong">Strong variant - Important emphasis</Text>
            </View>

            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="subtle">
                Subtle variant - Secondary information
              </Text>
            </View>

            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="muted">
                Muted variant - Less important details
              </Text>
            </View>

            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="error">Error variant - Error messages</Text>
            </View>

            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="success">Success variant - Success messages</Text>
            </View>

            <View style={[styles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="warning">Warning variant - Warning messages</Text>
            </View>
          </FlexColumn>
        </View>

        {/* Sizes Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text size="lg" weight="semibold" style={styles.sectionTitle}>
            Text Sizes
          </Text>

          <FlexColumn gap="sm">
            <Text size="xs">Extra small text (xs) - 12px</Text>
            <Text size="sm">Small text (sm) - 14px</Text>
            <Text size="base">Base text (base) - 16px default</Text>
            <Text size="lg">Large text (lg) - 18px</Text>
            <Text size="xl">Extra large text (xl) - 20px</Text>
            <Text size="2xl">2X large text (2xl) - 24px</Text>
            <Text size="3xl">3X large text (3xl) - 30px</Text>
          </FlexColumn>
        </View>

        {/* Weights Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text size="lg" weight="semibold" style={styles.sectionTitle}>
            Text Weights
          </Text>

          <FlexColumn gap="md">
            <Text weight="normal">Normal weight (400) - Default body text</Text>
            <Text weight="medium">
              Medium weight (500) - Slightly emphasized
            </Text>
            <Text weight="semibold">Semibold weight (600) - Headings</Text>
            <Text weight="bold">Bold weight (700) - Strong emphasis</Text>
          </FlexColumn>
        </View>

        {/* Alignment Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text size="lg" weight="semibold" style={styles.sectionTitle}>
            Text Alignment
          </Text>

          <FlexColumn gap="md">
            <View style={[styles.alignmentBox, { backgroundColor: theme.colors.surface[3], borderColor: theme.colors.border.default }]}>
              <Text align="left">Left aligned text (default)</Text>
            </View>

            <View style={[styles.alignmentBox, { backgroundColor: theme.colors.surface[3], borderColor: theme.colors.border.default }]}>
              <Text align="center">Center aligned text</Text>
            </View>

            <View style={[styles.alignmentBox, { backgroundColor: theme.colors.surface[3], borderColor: theme.colors.border.default }]}>
              <Text align="right">Right aligned text</Text>
            </View>
          </FlexColumn>
        </View>

        {/* Interactive Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text size="lg" weight="semibold" style={styles.sectionTitle}>
            Interactive Text
          </Text>

          <FlexColumn gap="md">
            <Text
              variant="default"
              onPress={() => {}}
              style={[styles.tappableText, { backgroundColor: theme.colors.surface[3] }]}
            >
              Tap this text to trigger an action
            </Text>

            <Text
              variant="strong"
              color={theme.colors.accent[600]}
              onPress={() => {}}
              style={[styles.tappableText, { backgroundColor: theme.colors.surface[3] }]}
            >
              Custom blue link-style text
            </Text>
          </FlexColumn>
        </View>

        {/* Multiline Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text size="lg" weight="semibold" style={styles.sectionTitle}>
            Multiline & Truncation
          </Text>

          <FlexColumn gap="md">
            <View style={styles.testGroup}>
              <Text numberOfLines={2}>
                This is a long text that will be truncated after two lines.
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. This
                text should be cut off with ellipsis.
              </Text>
            </View>

            <View style={styles.testGroup}>
              <Text numberOfLines={1} variant="subtle">
                Single line truncation: This very long text will be truncated to
                a single line with ellipsis at the end no matter how long it is.
              </Text>
            </View>
          </FlexColumn>
        </View>

        {/* React Native Requirements */}
        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface[3] }]}>
          <Text size="lg" weight="semibold" style={[styles.infoTitle, { color: theme.colors.text.strong }]}>
            📱 Why Text Primitive is Critical
          </Text>

          <FlexColumn gap="sm" style={{ marginTop: 12 }}>
            <FlexRow gap="sm">
              <Text style={{ color: theme.colors.text.main }}>•</Text>
              <Text style={{ flex: 1, color: theme.colors.text.main }}>
                React Native requires ALL text to be wrapped in Text components
              </Text>
            </FlexRow>

            <FlexRow gap="sm">
              <Text style={{ color: theme.colors.text.main }}>•</Text>
              <Text style={{ flex: 1, color: theme.colors.text.main }}>
                Raw text in View components will crash the app on mobile
              </Text>
            </FlexRow>

            <FlexRow gap="sm">
              <Text style={{ color: theme.colors.text.main }}>•</Text>
              <Text style={{ flex: 1, color: theme.colors.text.main }}>
                Provides consistent typography across web and mobile
              </Text>
            </FlexRow>

            <FlexRow gap="sm">
              <Text style={{ color: theme.colors.text.main }}>•</Text>
              <Text style={{ flex: 1, color: theme.colors.text.main }}>
                Enables proper text selection and accessibility
              </Text>
            </FlexRow>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removed - now uses theme.colors.bg.app dynamically
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  section: {
    // backgroundColor removed - now uses theme.colors.bg.card dynamically
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
    marginBottom: 16,
  },
  testGroup: {
    padding: 12,
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 8,
  },
  alignmentBox: {
    padding: 12,
    // backgroundColor and borderColor removed - now uses theme colors dynamically
    borderRadius: 8,
    borderWidth: 1,
  },
  tappableText: {
    padding: 12,
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 8,
    textDecorationLine: 'underline',
  },
  infoSection: {
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    // color removed - now uses theme colors dynamically
  },
});
