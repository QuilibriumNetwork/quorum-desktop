import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/primitives/theme';

// Import our primitives
import { FlexRow } from '@/primitives/FlexRow';
import { FlexColumn } from '@/primitives/FlexColumn';
import { FlexBetween } from '@/primitives/FlexBetween';
import { FlexCenter } from '@/primitives/FlexCenter';
import { ResponsiveContainer } from '@/primitives/ResponsiveContainer';
import Button from '@/primitives/Button';
import { Text, Title } from '@/primitives/Text';
import { Icon } from '@/primitives/Icon';
import {
  commonTestStyles,
  createThemedStyles,
} from '../styles/commonTestStyles';

/**
 * Mobile test screen for all primitives
 * Tests React Native implementations of cross-platform primitives
 */
export const PrimitivesTestScreen: React.FC = () => {
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
        contentContainerStyle={commonTestStyles.contentPaddingCompact}
      >
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow
            gap="md"
            align="center"
            style={{ alignItems: 'flex-start', marginBottom: 16 }}
          >
            <Icon name="tools" size="xl" style={{ marginTop: 2 }} />
            <Title>Layout Primitives Test</Title>
          </FlexRow>

          <Text size="base" variant="default" align="center">
            Testing Container, Flex components, and ResponsiveContainer
          </Text>
        </FlexColumn>

        {/* Button Primitive Section */}
        <View style={themedStyles.sectionCompact}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Button Primitive
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                Button Types:
              </Text>
            </View>
            <FlexRow gap="md" wrap style={{ paddingVertical: 8 }}>
              <Button type="primary" onClick={() => {}}>
                Primary
              </Button>
              <Button type="secondary" onClick={() => {}}>
                Secondary
              </Button>
              <Button type="light" onClick={() => {}}>
                Light
              </Button>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                Button Sizes:
              </Text>
            </View>
            <FlexRow gap="md" align="center" style={{ paddingVertical: 8 }}>
              <Button type="primary" size="normal" onClick={() => {}}>
                Normal Size
              </Button>
              <Button type="primary" size="small" onClick={() => {}}>
                Small Size
              </Button>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                Disabled State:
              </Text>
            </View>
            <FlexRow gap="md" style={{ paddingVertical: 8 }}>
              <Button type="primary" disabled onClick={() => {}}>
                Disabled Primary
              </Button>
              <Button type="secondary" disabled onClick={() => {}}>
                Disabled Secondary
              </Button>
            </FlexRow>
          </View>
        </View>

        {/* View Styling Section */}
        <View style={themedStyles.sectionCompact}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              View Styling
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                View with padding:
              </Text>
            </View>
            <View
              style={[
                {
                  padding: 16,
                  backgroundColor: theme.colors.surface[3],
                  borderRadius: 8,
                },
              ]}
            >
              <Text size="sm" variant="default">
                View with medium padding
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                View with margin and width:
              </Text>
            </View>
            <View
              style={[
                {
                  width: '100%',
                  margin: 8,
                  padding: 24,
                  backgroundColor: theme.colors.surface[4],
                  borderRadius: 8,
                },
              ]}
            >
              <Text size="sm" variant="default">
                Full width view with margin
              </Text>
            </View>
          </View>

        </View>

        {/* Flex Primitives Section */}
        <View style={themedStyles.sectionCompact}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Flex Primitives
            </Text>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                FlexRow with gap:
              </Text>
            </View>
            <FlexRow
              gap="md"
              style={[
                commonTestStyles.testGroup,
                {
                  backgroundColor: theme.colors.surface[2],
                  borderColor: theme.colors.border.default,
                  borderWidth: 1,
                  borderRadius: 8,
                },
              ]}
            >
              <View
                style={{
                  backgroundColor: theme.colors.surface[3],
                  padding: 8,
                  borderRadius: 4,
                  minWidth: 60,
                  alignItems: 'center',
                }}
              >
                <Text size="sm" variant="default">
                  Item 1
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: theme.colors.surface[3],
                  padding: 8,
                  borderRadius: 4,
                  minWidth: 60,
                  alignItems: 'center',
                }}
              >
                <Text size="sm" variant="default">
                  Item 2
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: theme.colors.surface[3],
                  padding: 8,
                  borderRadius: 4,
                  minWidth: 60,
                  alignItems: 'center',
                }}
              >
                <Text size="sm" variant="default">
                  Item 3
                </Text>
              </View>
            </FlexRow>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                FlexBetween:
              </Text>
            </View>
            <FlexBetween
              style={[
                commonTestStyles.testGroup,
                {
                  backgroundColor: theme.colors.surface[2],
                  borderColor: theme.colors.border.default,
                  borderWidth: 1,
                  borderRadius: 8,
                },
              ]}
            >
              <Text size="sm" variant="default">
                Left Content
              </Text>
              <Button type="secondary" size="small" onClick={() => {}}>
                Right Action
              </Button>
            </FlexBetween>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                FlexCenter:
              </Text>
            </View>
            <FlexCenter
              style={[
                commonTestStyles.testGroup,
                {
                  height: 60,
                  backgroundColor: theme.colors.surface[2],
                  borderColor: theme.colors.border.default,
                  borderWidth: 1,
                  borderRadius: 8,
                },
              ]}
            >
              <Text size="sm" variant="default">
                Centered Content
              </Text>
            </FlexCenter>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                FlexColumn with gap:
              </Text>
            </View>
            <FlexColumn
              gap="md"
              style={[
                commonTestStyles.testGroup,
                {
                  backgroundColor: theme.colors.surface[2],
                  borderColor: theme.colors.border.default,
                  borderWidth: 1,
                  borderRadius: 8,
                },
              ]}
            >
              <View
                style={{
                  backgroundColor: theme.colors.surface[3],
                  padding: 8,
                  borderRadius: 4,
                  minWidth: 60,
                  alignItems: 'center',
                }}
              >
                <Text size="sm" variant="default">
                  Item 1
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: theme.colors.surface[3],
                  padding: 8,
                  borderRadius: 4,
                  minWidth: 60,
                  alignItems: 'center',
                }}
              >
                <Text size="sm" variant="default">
                  Item 2
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: theme.colors.surface[3],
                  padding: 8,
                  borderRadius: 4,
                  minWidth: 60,
                  alignItems: 'center',
                }}
              >
                <Text size="sm" variant="default">
                  Item 3
                </Text>
              </View>
            </FlexColumn>
          </View>

          <View style={commonTestStyles.inputGroup}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" weight="medium" variant="default">
                FlexColumn with alignment:
              </Text>
            </View>
            <FlexColumn
              gap="sm"
              align="center"
              style={[
                commonTestStyles.testGroup,
                {
                  minHeight: 120,
                  backgroundColor: theme.colors.surface[2],
                  borderColor: theme.colors.border.default,
                  borderWidth: 1,
                  borderRadius: 8,
                },
              ]}
            >
              <Text size="sm" variant="default">
                Centered items
              </Text>
              <Button type="primary" size="small" onClick={() => {}}>
                Button
              </Button>
              <Text size="sm" variant="default">
                In column
              </Text>
            </FlexColumn>
          </View>
        </View>


        {/* ResponsiveContainer Section */}
        <View style={themedStyles.sectionCompact}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              ResponsiveContainer
            </Text>
          </View>
          <View
            style={{
              backgroundColor: theme.colors.utilities.warning + '20',
              borderColor: theme.colors.utilities.warning,
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Text size="sm" color={theme.colors.utilities.warning}>
              ResponsiveContainer is a layout primitive that works behind the
              scenes. On mobile, it provides SafeAreaView integration and proper
              content positioning.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
