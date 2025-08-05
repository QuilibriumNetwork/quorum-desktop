import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { 
  Text, 
  Paragraph, 
  SectionHeading, 
  Label, 
  Caption, 
  Title, 
  InlineText 
} from '../components/primitives/Text';
import { FlexColumn } from '../components/primitives/FlexColumn';
import { Icon } from '../components/primitives/Icon';
import { commonTestStyles } from '../styles/commonTestStyles';

export const TextTestScreen: React.FC = () => {
  const theme = useTheme();
  
  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView
        style={commonTestStyles.container}
        contentContainerStyle={commonTestStyles.contentPaddingCompact}
      >
        <View style={commonTestStyles.header}>
          <View style={commonTestStyles.titleContainer}>
            <Icon name="pencil" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <Title>Text and Typography</Title>
          </View>
          <Paragraph align="center">
            Improved text primitives with automatic line height, spacing, and semantic components
          </Paragraph>
        </View>

        {/* Typography Components Demo */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>✨ Typography Components</SectionHeading>
          
          <Label>Title Component:</Label>
          <Title>This is a title with automatic spacing</Title>
          
          <Label>Section Heading:</Label>
          <SectionHeading>This is a section heading</SectionHeading>
          
          <Label>Paragraph Component:</Label>
          <Paragraph>
            This is a paragraph with automatic bottom margin. No more wrapping in View containers! 
            The text has proper line height for readability and consistent spacing.
          </Paragraph>
          
          <Label>Caption Component:</Label>
          <Caption>This is a caption with top margin automatically applied</Caption>
        </View>

        {/* Before/After Comparison */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Before vs After Comparison</SectionHeading>
          
          <Label>❌ Old Way (verbose View wrappers):</Label>
          <View style={{ backgroundColor: theme.colors.surface[3], padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Label:</Text>
            </View>
            <Text size="base" variant="default">Content text</Text>
            <View style={{ marginTop: 8 }}>
              <Text size="sm" variant="subtle">Helper text</Text>
            </View>
          </View>
          
          <Label>✅ New Way (semantic components):</Label>
          <View style={{ backgroundColor: theme.colors.surface[3], padding: 12, borderRadius: 8 }}>
            <Label>Label:</Label>
            <InlineText size="base" variant="default">Content text</InlineText>
            <Caption>Helper text</Caption>
          </View>
        </View>

        {/* Line Height & Spacing Demo */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Automatic Line Height & Spacing</SectionHeading>
          
          <Label>Multi-line text with default line height (1.4x):</Label>
          <Paragraph>
            This is a longer paragraph that demonstrates how the automatic line height works. 
            The text should be readable with proper spacing between lines, making it easier 
            to follow when reading multiple lines of content.
          </Paragraph>
          
          <Label>Custom line height example:</Label>
          <Text marginBottom={16} lineHeight={32}>
            This text has a custom line height of 32 pixels, showing how you can override 
            the default when needed for specific design requirements.
          </Text>
          
          <Label>Manual Spacing Control:</Label>
          <Text marginBottom={24}>Text with 24px bottom margin</Text>
          <Text marginTop={16} marginBottom={16}>Text with 16px top and bottom margins</Text>
          <Text>Regular text with no manual spacing</Text>
        </View>

        {/* Variants Section */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Text Variants</SectionHeading>

          <FlexColumn gap="md">
            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="default">
                Default variant - Regular text for content
              </Text>
            </View>

            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="strong">Strong variant - Important emphasis</Text>
            </View>

            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="subtle">
                Subtle variant - Secondary information
              </Text>
            </View>

            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="subtle">
                Muted variant - Less important details
              </Text>
            </View>

            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="error">Error variant - Error messages</Text>
            </View>

            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="success">Success variant - Success messages</Text>
            </View>

            <View style={[commonTestStyles.testGroup, { backgroundColor: theme.colors.surface[3] }]}>
              <Text variant="warning">Warning variant - Warning messages</Text>
            </View>
          </FlexColumn>
        </View>

        {/* Sizes Section */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Text Sizes</SectionHeading>

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
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Text Weights</SectionHeading>

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
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Text Alignment</SectionHeading>

          <FlexColumn gap="md">
            <View style={[commonTestStyles.alignmentBox, { backgroundColor: theme.colors.surface[3], borderColor: theme.colors.border.default }]}>
              <Text align="left">Left aligned text (default)</Text>
            </View>

            <View style={[commonTestStyles.alignmentBox, { backgroundColor: theme.colors.surface[3], borderColor: theme.colors.border.default }]}>
              <Text align="center">Center aligned text</Text>
            </View>

            <View style={[commonTestStyles.alignmentBox, { backgroundColor: theme.colors.surface[3], borderColor: theme.colors.border.default }]}>
              <Text align="right">Right aligned text</Text>
            </View>
          </FlexColumn>
        </View>

        {/* Interactive Section */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Interactive Text</SectionHeading>

          <FlexColumn gap="md">
            <View style={{ padding: 12, borderRadius: 8, backgroundColor: theme.colors.surface[3] }}>
              <Text
                variant="default"
                onPress={() => {}}
              >
                Tap this text to trigger an action
              </Text>
            </View>

            <View style={{ padding: 12, borderRadius: 8, backgroundColor: theme.colors.surface[3] }}>
              <Text
                variant="strong"
                color={theme.colors.accent[600]}
                onPress={() => {}}
              >
                Custom blue link-style text
              </Text>
            </View>
          </FlexColumn>
        </View>

        {/* Multiline Section */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Multiline & Truncation</SectionHeading>

          <FlexColumn gap="md">
            <View style={commonTestStyles.testGroup}>
              <Text numberOfLines={2}>
                This is a long text that will be truncated after two lines.
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. This
                text should be cut off with ellipsis.
              </Text>
            </View>

            <View style={commonTestStyles.testGroup}>
              <Text numberOfLines={1} variant="subtle">
                Single line truncation: This very long text will be truncated to
                a single line with ellipsis at the end no matter how long it is.
              </Text>
            </View>
          </FlexColumn>
        </View>

        {/* React Native Requirements */}
        <View style={[commonTestStyles.infoSection, { backgroundColor: theme.colors.surface[3] }]}>
          <SectionHeading>Mobile Notes & Improvements</SectionHeading>

          <Text variant="default" marginBottom={12}>
            ✅ Enhanced Text primitive now includes:
          </Text>
          
          <Text variant="default" marginBottom={8}>
            • Automatic line height (1.4x font size) for better readability
          </Text>
          <Text variant="default" marginBottom={8}>
            • Built-in spacing props (marginTop, marginBottom) to reduce View wrappers
          </Text>
          <Text variant="default" marginBottom={8}>
            • Semantic components: Paragraph, SectionHeading, Label, Caption, Title
          </Text>
          <Text variant="default" marginBottom={8}>
            • Custom lineHeight support for specific design needs
          </Text>
          <Text variant="default" marginBottom={8}>
            • Better Android alignment with includeFontPadding: false
          </Text>
          <Text variant="default" marginBottom={8}>
            • Maintains React Native compatibility and cross-platform consistency
          </Text>
          
          <Text variant="default" marginBottom={12} marginTop={16}>
            💡 Usage Guidelines:
          </Text>
          <Text variant="default" marginBottom={8}>
            • Use semantic components (Paragraph, Label, etc.) for common patterns
          </Text>
          <Text variant="default" marginBottom={8}>
            • Use marginTop/marginBottom props for custom spacing when needed
          </Text>
          <Text variant="default" marginBottom={8}>
            • InlineText has no automatic spacing for use within containers
          </Text>
          <Text variant="default">
            • This reduces View wrapper verbosity while maintaining proper spacing
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
