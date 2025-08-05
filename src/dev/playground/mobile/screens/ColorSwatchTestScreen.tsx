import React, { useState } from 'react';
import {
  ScrollView,
  View,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../components/primitives/theme';
import { ColorSwatch } from '../components/primitives/ColorSwatch';
import { Icon } from '../components/primitives/Icon';
import { Text, SectionHeading, Paragraph, Label, Caption } from '../components/primitives';
import { FlexRow, FlexColumn, FlexCenter } from '../components/primitives';
import { commonTestStyles } from '../styles/commonTestStyles';

export const ColorSwatchTestScreen: React.FC = () => {
  const theme = useTheme();
  const [activeColor, setActiveColor] = useState('blue');
  const [sizeDemo, setSizeDemo] = useState('');

  const colors = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'];

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <StatusBar barStyle={theme.resolvedTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={theme.colors.bg.app} />
      <ScrollView
        contentContainerStyle={commonTestStyles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow gap="sm" align="center" style={commonTestStyles.titleContainer}>
            <Icon name="palette" size="xl" color={theme.colors.text.strong} />
            <Text size="2xl" weight="bold" variant="strong">ColorSwatch</Text>
          </FlexRow>
          <Paragraph align="center">
            Touch-optimized color picker for accent selection
          </Paragraph>
        </FlexColumn>

        {/* Basic Usage */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Basic Usage</SectionHeading>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Click to select colors:</Label>
            <FlexRow style={commonTestStyles.colorRow}>
              {colors.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  isActive={activeColor === color}
                  onPress={() => setActiveColor(color)}
                />
              ))}
            </FlexRow>
          </FlexColumn>
        </View>

        {/* Size Variants */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Size Variants</SectionHeading>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Small Size:</Label>
            <FlexRow style={commonTestStyles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="small"
                  isActive={sizeDemo === `small-${color}`}
                  onPress={() => setSizeDemo(`small-${color}`)}
                />
              ))}
            </FlexRow>
          </FlexColumn>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Medium Size (Default):</Label>
            <FlexRow style={commonTestStyles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="medium"
                  isActive={sizeDemo === `medium-${color}`}
                  onPress={() => setSizeDemo(`medium-${color}`)}
                />
              ))}
            </FlexRow>
          </FlexColumn>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Large Size:</Label>
            <FlexRow style={commonTestStyles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="large"
                  isActive={sizeDemo === `large-${color}`}
                  onPress={() => setSizeDemo(`large-${color}`)}
                />
              ))}
            </FlexRow>
          </FlexColumn>
        </View>

        {/* States */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>States</SectionHeading>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Active State:</Label>
            <FlexRow align="center" style={commonTestStyles.stateRow}>
              <ColorSwatch color="blue" isActive={true} onPress={() => {}} />
              <Text size="sm" variant="subtle">Shows ✓ checkmark</Text>
            </FlexRow>
          </FlexColumn>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Disabled State:</Label>
            <FlexRow align="center" style={commonTestStyles.stateRow}>
              <ColorSwatch color="purple" disabled={true} onPress={() => {}} />
              <Text size="sm" variant="subtle">50% opacity, no interaction</Text>
            </FlexRow>
          </FlexColumn>

          <FlexColumn style={commonTestStyles.subSection}>
            <Label>Active without checkmark:</Label>
            <FlexRow align="center" style={commonTestStyles.stateRow}>
              <ColorSwatch
                color="orange"
                isActive={true}
                showCheckmark={false}
                onPress={() => {}}
              />
              <Text size="sm" variant="subtle">Border/shadow only</Text>
            </FlexRow>
          </FlexColumn>
        </View>

        {/* All Colors Grid */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>All Theme Colors</SectionHeading>
          <Label>Complete color palette:</Label>

          <FlexRow wrap style={commonTestStyles.colorGrid}>
            {colors.map((color) => (
              <FlexColumn key={color} align="center" style={commonTestStyles.colorItem}>
                <ColorSwatch
                  color={color}
                  isActive={false}
                  onPress={() => {}}
                />
                <Text size="sm" variant="subtle">{color}</Text>
              </FlexColumn>
            ))}
          </FlexRow>
        </View>

        {/* Implementation Notes */}
        <View style={[commonTestStyles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <Text size="base" weight="semibold" variant="strong">Mobile Notes</Text>
          <Text size="sm" variant="default">
            • Uses TouchableOpacity for native press feedback
          </Text>
          <Text size="sm" variant="default">
            • Dynamic colors from theme system
          </Text>
          <Text size="sm" variant="default">
            • Shadow effects for active state visibility
          </Text>
          <Text size="sm" variant="default">
            • Touch targets optimized for mobile (min 24x24)
          </Text>
          <Text size="sm" variant="default">
            • Will integrate with AccentColorSwitcher component
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
