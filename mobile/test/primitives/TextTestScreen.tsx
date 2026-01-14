import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Paragraph,
  Label,
  Caption,
  Title,
  Flex,
  Icon,
  useTheme,
} from '@/components/primitives';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

export const TextTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView
        style={commonTestStyles.container}
        contentContainerStyle={commonTestStyles.contentPaddingCompact}
      >
        <Flex direction="column" style={commonTestStyles.header}>
          <Flex style={commonTestStyles.titleContainer}>
            <Icon name="pencil" size="xl" style={{ marginRight: 12 }} />
            <Title>Text and Typography</Title>
          </Flex>
          <Paragraph align="center">
            Improved text primitives with automatic line height, spacing, and
            semantic components
          </Paragraph>
        </Flex>

        {/* Typography Components Demo */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">✨ Typography Components</Title>

            <Flex direction="column" gap="sm">
              <Label>Title Component:</Label>
              <Title>This is a title with automatic spacing</Title>
              <Title size="sm">This is a small title</Title>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Paragraph Component:</Label>
              <Paragraph>
                This is a paragraph with automatic bottom margin. No more
                wrapping in View containers! The text has proper line height for
                readability and consistent spacing.
              </Paragraph>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Caption Component:</Label>
              <Caption>
                This is a caption with top margin automatically applied
              </Caption>
            </Flex>
          </Flex>
        </View>

        {/* Line Height & Spacing Demo */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Automatic Line Height & Spacing</Title>

            <Flex direction="column" gap="sm">
              <Label>Multi-line text with default line height (1.4x):</Label>
              <Paragraph>
                This is a longer paragraph that demonstrates how the automatic
                line height works. The text should be readable with proper
                spacing between lines, making it easier to follow when reading
                multiple lines of content.
              </Paragraph>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Custom line height example:</Label>
              <Text marginBottom={16} lineHeight={32}>
                This text has a custom line height of 32 pixels, showing how you
                can override the default when needed for specific design
                requirements.
              </Text>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Manual Spacing Control:</Label>
              <Flex direction="column" gap="xs">
                <Text marginBottom={24}>Text with 24px bottom margin</Text>
                <Text marginTop={16} marginBottom={16}>
                  Text with 16px top and bottom margins
                </Text>
                <Text>Regular text with no manual spacing</Text>
              </Flex>
            </Flex>
          </Flex>
        </View>

        {/* Variants Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Text Variants</Title>

            <Flex direction="column" gap="sm">
              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="default">
                  Default variant - Regular text for content
                </Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="strong">
                  Strong variant - Important emphasis
                </Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="subtle">
                  Subtle variant - Secondary information
                </Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="subtle">
                  Muted variant - Less important details
                </Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="error">Error variant - Error messages</Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="success">
                  Success variant - Success messages
                </Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="warning">
                  Warning variant - Warning messages
                </Text>
              </View>

              <View
                style={[
                  commonTestStyles.testGroup,
                  { backgroundColor: theme.colors.surface[3] },
                ]}
              >
                <Text variant="danger">
                  Danger variant - Critical alerts and errors
                </Text>
              </View>
            </Flex>
          </Flex>
        </View>

        {/* Sizes Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Text Sizes</Title>

            <Flex direction="column" gap="sm">
              <Text size="xs">Extra small text (xs) - 12px</Text>
              <Text size="sm">Small text (sm) - 14px</Text>
              <Text size="base">Base text (base) - 16px default</Text>
              <Text size="lg">Large text (lg) - 18px</Text>
              <Text size="xl">Extra large text (xl) - 20px</Text>
              <Text size="2xl">2X large text (2xl) - 24px</Text>
              <Text size="3xl">3X large text (3xl) - 30px</Text>
            </Flex>
          </Flex>
        </View>

        {/* Text Weights Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Text Weights</Title>

            <Flex direction="column" gap="sm">
              <Text weight="normal">
                Normal weight (400) - Default body text
              </Text>
              <Text weight="medium">
                Medium weight (500) - Slightly emphasized
              </Text>
              <Text weight="semibold">Semibold weight (600) - Headings</Text>
              <Text weight="bold">Bold weight (700) - Strong emphasis</Text>
            </Flex>
          </Flex>
        </View>

        {/* Title Sizes & Weights Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Title Component</Title>

            <Flex direction="column" gap="sm">
              <Label>Title with different sizes:</Label>
              <Title size="sm">Small title (sm)</Title>
              <Title size="lg">Large title (lg)</Title>
              <Title size="xl">Extra large title (xl)</Title>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Title with different weights:</Label>
              <Title weight="normal">Normal weight title</Title>
              <Title weight="medium">Medium weight title</Title>
              <Title weight="semibold">Semibold weight title</Title>
              <Title weight="bold">Bold weight title</Title>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Combined size and weight:</Label>
              <Title size="sm" weight="semibold">
                Small semibold (typical section heading)
              </Title>
              <Title size="lg" weight="bold">
                Large bold title
              </Title>
            </Flex>
          </Flex>
        </View>

        {/* Alignment Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Text Alignment</Title>

            <Flex direction="column" gap="sm">
              <View
                style={[
                  commonTestStyles.alignmentBox,
                  {
                    backgroundColor: theme.colors.surface[3],
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                <Text align="left">Left aligned text (default)</Text>
              </View>

              <View
                style={[
                  commonTestStyles.alignmentBox,
                  {
                    backgroundColor: theme.colors.surface[3],
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                <Text align="center">Center aligned text</Text>
              </View>

              <View
                style={[
                  commonTestStyles.alignmentBox,
                  {
                    backgroundColor: theme.colors.surface[3],
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                <Text align="right">Right aligned text</Text>
              </View>
            </Flex>
          </Flex>
        </View>

        {/* Interactive Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Interactive Text</Title>

            <Flex direction="column" gap="sm">
              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface[3],
                }}
              >
                <Text variant="default" onPress={() => {}}>
                  Tap this text to trigger an action
                </Text>
              </View>

              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface[3],
                }}
              >
                <Text
                  variant="strong"
                  color={theme.colors.accent[600]}
                  onPress={() => {}}
                >
                  Custom accent color link-style text
                </Text>
              </View>
            </Flex>
          </Flex>
        </View>

        {/* Link Styles Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Link Styles (Mobile)</Title>

            <Flex direction="column" gap="sm">
              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface[3],
                }}
              >
                <Text>
                  This paragraph contains a{' '}
                  <Text
                    href="https://example.com"
                    linkStyle="default"
                    size="base"
                  >
                    default link
                  </Text>{' '}
                  with accent color and medium weight.
                </Text>
              </View>

              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface[3],
                }}
              >
                <Text>
                  This paragraph has a{' '}
                  <Text
                    href="https://example.com"
                    linkStyle="simple"
                    size="base"
                  >
                    simple underlined link
                  </Text>{' '}
                  that inherits surrounding text color.
                </Text>
              </View>

              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface[3],
                }}
              >
                <Text variant="subtle">
                  Links work in different variants:{' '}
                  <Text
                    href="https://example.com"
                    linkStyle="default"
                    size="base"
                  >
                    accent color
                  </Text>{' '}
                  and{' '}
                  <Text
                    href="https://example.com"
                    linkStyle="simple"
                    size="base"
                  >
                    simple underlined
                  </Text>
                  .
                </Text>
              </View>

              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: theme.colors.surface[3],
                }}
              >
                <Text size="lg" weight="semibold">
                  Links in larger text:{' '}
                  <Text
                    href="https://example.com"
                    linkStyle="default"
                    size="lg"
                  >
                    accent styling
                  </Text>{' '}
                  and{' '}
                  <Text href="https://example.com" linkStyle="simple" size="lg">
                    simple underlined
                  </Text>
                  .
                </Text>
              </View>
            </Flex>

            <Flex direction="column" gap="sm">
              <Label>Link Style Properties:</Label>
              <Text size="sm" variant="subtle">
                • linkStyle="default": Accent color + medium weight (500)
              </Text>
              <Text size="sm" variant="subtle">
                • linkStyle="simple": Inherit color + underline decoration
              </Text>
              <Text size="sm" variant="subtle">
                • Both support href and onPress for navigation
              </Text>
              <Text size="sm" variant="subtle">
                • Proper accessibility with role="link"
              </Text>
            </Flex>
          </Flex>
        </View>

        {/* Multiline Section */}
        <View style={themedStyles.section}>
          <Flex direction="column" gap="md">
            <Title size="sm">Multiline Text</Title>

            <Flex direction="column" gap="sm">
              <View style={commonTestStyles.testGroup}>
                <Text numberOfLines={2}>
                  This is a long text that will be truncated after two lines.
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  This text should be cut off with ellipsis.
                </Text>
              </View>
            </Flex>
          </Flex>
        </View>

        {/* React Native Requirements */}
        <View
          style={[
            commonTestStyles.infoSection,
            { backgroundColor: theme.colors.surface[3] },
          ]}
        >
          <Flex direction="column" gap="md">
            <Title size="sm">Mobile Notes</Title>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Automatic line height (1.4x font size) for better readability
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Built-in spacing props (marginTop, marginBottom) to reduce
                  View wrappers
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Semantic components: Paragraph, Title (with size/weight
                  props), Label, Caption
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Custom lineHeight support for specific design needs
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Better Android alignment with includeFontPadding: false
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start" marginBottom="18">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Maintains React Native compatibility and cross-platform
                  consistency
                </Text>
              </View>
            </Flex>

            <Title size="sm">Usage Guidelines</Title>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Use semantic components (Paragraph, Label, etc.) for common
                  patterns
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  Use marginTop/marginBottom props for custom spacing when
                  needed
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  InlineText has no automatic spacing for use within containers
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text variant="default">•</Text>
              <View style={{ flex: 1 }}>
                <Text variant="default">
                  This reduces View wrapper verbosity while maintaining proper
                  spacing
                </Text>
              </View>
            </Flex>
          </Flex>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
