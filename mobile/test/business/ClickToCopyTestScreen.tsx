import React, { useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  Text,
  Title,
  Paragraph,
  Button,
} from '@/primitives';
import { useTheme } from '@/primitives/theme';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';
import ClickToCopyContent from '@/components/ui/ClickToCopyContent';

export const ClickToCopyTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  const [copyCount, setCopyCount] = useState(0);

  const handleCopy = () => {
    setCopyCount((prev) => prev + 1);
    // Optional: Show feedback
    // Alert.alert('Copied!', 'Text has been copied to clipboard');
  };

  const sampleTexts = {
    short: 'Hello World!',
    medium:
      'This is a medium-length text that demonstrates copying functionality',
    long: 'This is a long text that demonstrates how the ClickToCopyContent component handles proper text wrapping and formatting while maintaining good usability',
    address: 'qubic1abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890',
    url: 'https://github.com/Quilibrium/quorum-desktop',
    code: '{"name": "quorum", "version": "1.0.0", "type": "desktop-app"}',
  };

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView
        contentContainerStyle={commonTestStyles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        <View style={commonTestStyles.header}>
          <FlexColumn gap="xs" align="center">
            <Title size="lg" align="center">
              ClickToCopyContent Test
            </Title>
            <Paragraph variant="subtle" align="center">
              Test cross-platform copy functionality
            </Paragraph>
            <Text size="sm" variant="muted">
              Total copies: {copyCount}
            </Text>
          </FlexColumn>
        </View>

        <FlexColumn gap="lg">
          {/* Basic Icon Click Tests */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 12 }}>
              Icon Click (Default)
            </Title>

            <FlexColumn gap="md">
              <ClickToCopyContent
                text={sampleTexts.short}
                onCopy={handleCopy}
                touchTrigger="click"
                tooltipText="Tap icon to copy"
              >
                <Text>Short text: {sampleTexts.short}</Text>
              </ClickToCopyContent>

              <ClickToCopyContent
                text={sampleTexts.medium}
                onCopy={handleCopy}
                touchTrigger="click"
                iconPosition="right"
                tooltipText="Tap to copy medium text"
              >
                <Text variant="subtle">Text with icon to the right</Text>
              </ClickToCopyContent>
            </FlexColumn>
          </View>

          {/* Copy On Content Click Tests */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 12 }}>
              Content Click Tests
            </Title>

            <FlexColumn gap="md">
              <ClickToCopyContent
                text="Tap anywhere on this text to copy it"
                onCopy={handleCopy}
                copyOnContentClick={true}
                touchTrigger="click"
                iconPosition="left"
                tooltipText="Tap anywhere to copy"
              >
                <Text>Tap anywhere on this text to copy it</Text>
              </ClickToCopyContent>

              <ClickToCopyContent
                text="Long press anywhere to copy"
                onCopy={handleCopy}
                copyOnContentClick={true}
                touchTrigger="long-press"
                longPressDuration={600}
                iconPosition="left"
                tooltipText="Long press anywhere to copy"
              >
                <Text>Long press anywhere to copy</Text>
              </ClickToCopyContent>
            </FlexColumn>
          </View>

          {/* Test Controls */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 12 }}>
              Test Controls
            </Title>

            <FlexColumn gap="sm">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCopyCount(0)}
                hapticFeedback={true}
              >
                Reset Copy Counter
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  Alert.alert(
                    'Info',
                    'This screen tests the ClickToCopyContent component with different configurations:\n\n• Icon click vs long press\n• Content click vs icon click\n• Different text variants\n• Various tooltip positions'
                  )
                }
                hapticFeedback={true}
              >
                Show Info
              </Button>
            </FlexColumn>
          </View>

          {/* Implementation Notes */}
          <View style={themedStyles.section}>
            <Title size="md" style={{ marginBottom: 8 }}>
              Implementation Notes
            </Title>

            <FlexColumn gap="xs">
              <Text size="sm" variant="subtle">
                • Uses adapter pattern for cross-platform clipboard
              </Text>
              <Text size="sm" variant="subtle">
                • Native version uses TouchableOpacity with proper gestures
              </Text>
              <Text size="sm" variant="subtle">
                • Supports both tap and long-press interactions
              </Text>
              <Text size="sm" variant="subtle">
                • Provides haptic feedback via expo-haptics
              </Text>
              <Text size="sm" variant="subtle">
                • Business logic shared between web and native
              </Text>
            </FlexColumn>
          </View>
        </FlexColumn>
      </ScrollView>
    </SafeAreaView>
  );
};
