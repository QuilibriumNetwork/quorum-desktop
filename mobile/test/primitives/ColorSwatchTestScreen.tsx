import React, { useState } from 'react';
import { ScrollView, View, SafeAreaView, StatusBar } from 'react-native';
import { useTheme } from '@/components/primitives/theme';
import { ColorSwatch } from '@/components/primitives/ColorSwatch';
import { Icon } from '@/components/primitives/Icon';
import { Text, Paragraph, Label, Caption, Title } from '@/components/primitives';
import { Flex, FlexCenter } from '@/components/primitives';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

export const ColorSwatchTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [activeColor, setActiveColor] = useState('blue');
  const [sizeDemo, setSizeDemo] = useState('');

  const colors = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'];

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <StatusBar
        barStyle={
          theme.resolvedTheme === 'dark' ? 'light-content' : 'dark-content'
        }
        backgroundColor={theme.colors.bg.app}
      />
      <ScrollView
        contentContainerStyle={commonTestStyles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Flex direction="column" style={commonTestStyles.header}>
          <Flex gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="palette" size="xl" style={{ marginTop: 2 }} />
            <Title>ColorSwatch</Title>
          </Flex>
          <Paragraph align="center">
            Touch-optimized color picker for accent selection
          </Paragraph>
        </Flex>

        {/* Basic Usage */}
        <View style={themedStyles.section}>
          <Title size="sm">Basic Usage</Title>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Click to select colors:</Label>
            <Flex style={commonTestStyles.colorRow}>
              {colors.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  isActive={activeColor === color}
                  onPress={() => setActiveColor(color)}
                />
              ))}
            </Flex>
          </Flex>
        </View>

        {/* Size Variants */}
        <View style={themedStyles.section}>
          <Title size="sm">Size Variants</Title>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Small Size:</Label>
            <Flex style={commonTestStyles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="small"
                  isActive={sizeDemo === `small-${color}`}
                  onPress={() => setSizeDemo(`small-${color}`)}
                />
              ))}
            </Flex>
          </Flex>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Medium Size (Default):</Label>
            <Flex style={commonTestStyles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="medium"
                  isActive={sizeDemo === `medium-${color}`}
                  onPress={() => setSizeDemo(`medium-${color}`)}
                />
              ))}
            </Flex>
          </Flex>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Large Size:</Label>
            <Flex style={commonTestStyles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="large"
                  isActive={sizeDemo === `large-${color}`}
                  onPress={() => setSizeDemo(`large-${color}`)}
                />
              ))}
            </Flex>
          </Flex>
        </View>

        {/* States */}
        <View style={themedStyles.section}>
          <Title size="sm">States</Title>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Active State:</Label>
            <Flex align="center" style={commonTestStyles.stateRow}>
              <ColorSwatch color="blue" isActive={true} onPress={() => {}} />
              <Text size="sm" variant="subtle">
                Shows ✓ checkmark
              </Text>
            </Flex>
          </Flex>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Disabled State:</Label>
            <Flex align="center" style={commonTestStyles.stateRow}>
              <ColorSwatch color="purple" disabled={true} onPress={() => {}} />
              <Text size="sm" variant="subtle">
                50% opacity, no interaction
              </Text>
            </Flex>
          </Flex>

          <Flex direction="column" style={commonTestStyles.subSection}>
            <Label>Active without checkmark:</Label>
            <Flex align="center" style={commonTestStyles.stateRow}>
              <ColorSwatch
                color="orange"
                isActive={true}
                showCheckmark={false}
                onPress={() => {}}
              />
              <Text size="sm" variant="subtle">
                Border/shadow only
              </Text>
            </Flex>
          </Flex>
        </View>

        {/* All Colors Grid */}
        <View style={themedStyles.section}>
          <Title size="sm">All Theme Colors</Title>
          <Label>Complete color palette:</Label>

          <Flex wrap style={commonTestStyles.colorGrid}>
            {colors.map((color) => (
              <Flex direction="column"
                key={color}
                align="center"
                style={commonTestStyles.colorItem}
              >
                <ColorSwatch
                  color={color}
                  isActive={false}
                  onPress={() => {}}
                />
                <Text size="sm" variant="subtle">
                  {color}
                </Text>
              </Flex>
            ))}
          </Flex>
        </View>

        {/* Implementation Notes */}
        <View style={themedStyles.notesSection}>
          <Flex direction="column" gap="sm">
            <Title size="sm">Mobile Notes</Title>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Uses TouchableOpacity for native press feedback
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Dynamic colors from theme system
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Shadow effects for active state visibility
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Touch targets optimized for mobile (min 24x24)
                </Text>
              </View>
            </Flex>

            <Flex gap="xs" align="start">
              <Text size="sm" variant="default">
                •
              </Text>
              <View style={{ flex: 1 }}>
                <Text size="sm" variant="default">
                  Will integrate with AccentColorSwitcher component
                </Text>
              </View>
            </Flex>
          </Flex>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
