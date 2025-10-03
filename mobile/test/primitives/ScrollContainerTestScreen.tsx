import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/primitives/theme';
import { ScrollContainer } from '@/components/primitives';
import { Icon } from '@/components/primitives/Icon';
import { Text, Paragraph, Title, FlexColumn, FlexRow } from '@/components/primitives';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

export const ScrollContainerTestScreen: React.FC = () => {
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
        contentContainerStyle={commonTestStyles.contentPadding}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="clipboard" size="xl" style={{ marginTop: 2 }} />
            <Title>ScrollContainer Test</Title>
          </FlexRow>
          <Paragraph align="center">
            Testing ScrollContainer primitive with 3 minimal examples + 1 full content example
          </Paragraph>
          <Text size="xs" variant="subtle" align="center" style={{ marginTop: 8 }}>
            📝 Nested scrolling: Tap and drag directly inside the bordered containers below
          </Text>
        </FlexColumn>

        {/* Example 1: Normal sm - DEFINITELY SCROLLABLE */}
        <View style={themedStyles.section}>
          <Title size="sm">Normal sm (25 items - definitely scrollable)</Title>
          <ScrollContainer height="sm">
            {Array.from({ length: 25 }, (_, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 20,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.default,
                  minHeight: 60, // Ensure each item takes meaningful height
                }}
              >
                <Text size="sm" weight="medium">Item {i + 1}</Text>
                <Text size="xs" variant="subtle" style={{ marginTop: 4 }}>
                  This item has more content to ensure scrolling is needed
                </Text>
              </View>
            ))}
          </ScrollContainer>
        </View>

        {/* Example 2: No border sm */}
        <View style={themedStyles.section}>
          <Title size="sm">No border sm</Title>
          <ScrollContainer
            height="sm"
            showBorder={false}
            style={{ backgroundColor: theme.colors.bg.card }}
          >
            {Array.from({ length: 15 }, (_, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.default,
                }}
              >
                <Text size="sm">Item {i + 1}</Text>
              </View>
            ))}
          </ScrollContainer>
        </View>

        {/* Example 3: Normal border (not rounded) sm */}
        <View style={themedStyles.section}>
          <Title size="sm">Normal border (not rounded) sm</Title>
          <ScrollContainer height="sm" borderRadius="none">
            {Array.from({ length: 15 }, (_, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.default,
                }}
              >
                <Text size="sm">Item {i + 1}</Text>
              </View>
            ))}
          </ScrollContainer>
        </View>

        {/* Example 4: Full content sm - LONG SCROLLABLE CONTENT */}
        <View style={themedStyles.section}>
          <Title size="sm">Full content sm (long article - definitely scrollable)</Title>
          <ScrollContainer height="sm">
            <View style={{ padding: 16 }}>
              <FlexColumn gap={16}>
                <View>
                  <Text size="md" weight="bold" style={{ marginBottom: 8 }}>
                    ScrollContainer Usage Guide
                  </Text>
                  <Text size="sm" style={{ lineHeight: 20 }}>
                    This demonstrates using ScrollContainer for full content without item separators.
                    You can include paragraphs, headings, images, or any other content. This example
                    has been made longer to ensure scrolling is definitely needed.
                  </Text>
                </View>

                <View>
                  <Text size="sm" weight="medium" style={{ marginBottom: 4 }}>
                    Why Use ScrollContainer?
                  </Text>
                  <Text size="sm" style={{ lineHeight: 20 }}>
                    The content flows naturally without borders or separators between elements.
                    This is perfect for articles, documentation, or any continuous content. The
                    primitive handles cross-platform scrolling behavior consistently.
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: theme.colors.bg.card,
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text size="xs" variant="subtle" style={{ lineHeight: 18 }}>
                    Code example: ScrollContainer can contain any content structure. It works
                    with nested components, custom layouts, and mixed content types seamlessly.
                  </Text>
                </View>

                <View>
                  <Text size="sm" weight="medium" style={{ marginBottom: 4 }}>
                    Cross-Platform Benefits
                  </Text>
                  <Text size="sm" style={{ lineHeight: 20 }}>
                    More paragraphs continue seamlessly. The ScrollContainer handles the scrolling
                    while you focus on your content structure. On web it uses CSS overflow, on
                    mobile it uses React Native ScrollView.
                  </Text>
                </View>

                <View>
                  <Text size="sm" weight="medium" style={{ marginBottom: 4 }}>
                    Height Options Available
                  </Text>
                  <Text size="sm" style={{ lineHeight: 20 }}>
                    You can use xs (200px), sm (280px), md (400px), lg (500px), xl (600px),
                    auto, or custom pixel values. Each height option provides consistent
                    behavior across platforms.
                  </Text>
                </View>

                <View>
                  <Text size="sm" weight="medium" style={{ marginBottom: 4 }}>
                    Styling Options
                  </Text>
                  <Text size="sm" style={{ lineHeight: 20 }}>
                    You can control borders (showBorder prop) and border radius (none, sm, md, lg).
                    The default styling matches existing app patterns from UserSettingsModal and
                    SpaceEditor components.
                  </Text>
                </View>

                <View>
                  <Text size="sm" weight="medium" style={{ marginBottom: 4 }}>
                    Testing Scrolling
                  </Text>
                  <Text size="sm" style={{ lineHeight: 20 }}>
                    This content should definitely require scrolling within the sm height (280px).
                    Try scrolling up and down - it should work smoothly in the Android emulator
                    just like other scrollable components such as modal sheets.
                  </Text>
                </View>
              </FlexColumn>
            </View>
          </ScrollContainer>
        </View>

        {/* ScrollContainer Options Section */}
        <View style={themedStyles.section}>
          <Title size="sm">ScrollContainer Options</Title>
          <FlexColumn gap={8} style={{ marginTop: 16 }}>
            <Text size="sm" variant="subtle">
              • Height options: xs (200px), sm (280px), md (400px), lg (500px), xl (600px), auto, custom
            </Text>
            <Text size="sm" variant="subtle">
              • showBorder: Toggle border visibility (default: true)
            </Text>
            <Text size="sm" variant="subtle">
              • borderRadius: none, sm, md, lg (default: lg)
            </Text>
            <Text size="sm" variant="subtle">
              • Matches UserSettingsModal & SpaceEditor styles
            </Text>
            <Text size="sm" variant="subtle">
              • Cross-platform (web: CSS overflow, mobile: ScrollView)
            </Text>
            <Text size="sm" variant="subtle">
              • Consistent with existing app patterns
            </Text>
            <Text size="sm" variant="subtle">
              • Accessibility support for both platforms
            </Text>
            <Text size="sm" variant="subtle">
              • Semantic styling (border-surface-6, rounded-lg equivalent)
            </Text>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};