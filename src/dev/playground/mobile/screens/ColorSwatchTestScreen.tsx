import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../components/primitives/theme';
import { ColorSwatch } from '../components/primitives/ColorSwatch';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';

export const ColorSwatchTestScreen: React.FC = () => {
  const theme = useTheme();
  const [activeColor, setActiveColor] = useState('blue');
  const [sizeDemo, setSizeDemo] = useState('');

  const colors = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <StatusBar barStyle={theme.resolvedTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={theme.colors.bg.app} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Icon name="palette" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <Text size="2xl" weight="bold" variant="strong">ColorSwatch</Text>
          </View>
          <View style={{ marginBottom: 24 }}>
            <Text size="base" variant="default" align="center">
              Touch-optimized color picker for accent selection
            </Text>
          </View>
        </View>

        {/* Basic Usage */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Basic Usage</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Click to select colors:</Text>
            </View>
            <View style={styles.colorRow}>
              {colors.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  isActive={activeColor === color}
                  onPress={() => setActiveColor(color)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Size Variants */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Size Variants</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Small Size:</Text>
            </View>
            <View style={styles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="small"
                  isActive={sizeDemo === `small-${color}`}
                  onPress={() => setSizeDemo(`small-${color}`)}
                />
              ))}
            </View>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Medium Size (Default):</Text>
            </View>
            <View style={styles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="medium"
                  isActive={sizeDemo === `medium-${color}`}
                  onPress={() => setSizeDemo(`medium-${color}`)}
                />
              ))}
            </View>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Large Size:</Text>
            </View>
            <View style={styles.colorRow}>
              {colors.slice(0, 3).map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  size="large"
                  isActive={sizeDemo === `large-${color}`}
                  onPress={() => setSizeDemo(`large-${color}`)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* States */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">States</Text>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Active State:</Text>
            </View>
            <View style={styles.stateRow}>
              <ColorSwatch color="blue" isActive={true} onPress={() => {}} />
              <Text size="sm" variant="subtle">Shows ✓ checkmark</Text>
            </View>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Disabled State:</Text>
            </View>
            <View style={styles.stateRow}>
              <ColorSwatch color="purple" disabled={true} onPress={() => {}} />
              <Text size="sm" variant="subtle">50% opacity, no interaction</Text>
            </View>
          </View>

          <View style={styles.subSection}>
            <View style={{ marginBottom: 8 }}>
              <Text size="sm" variant="strong">Active without checkmark:</Text>
            </View>
            <View style={styles.stateRow}>
              <ColorSwatch
                color="orange"
                isActive={true}
                showCheckmark={false}
                onPress={() => {}}
              />
              <Text size="sm" variant="subtle">Border/shadow only</Text>
            </View>
          </View>
        </View>

        {/* All Colors Grid */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">All Theme Colors</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Complete color palette:</Text>
          </View>

          <View style={styles.colorGrid}>
            {colors.map((color) => (
              <View key={color} style={styles.colorItem}>
                <ColorSwatch
                  color={color}
                  isActive={false}
                  onPress={() => {}}
                />
                <Text size="sm" variant="subtle">{color}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Implementation Notes */}
        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <View style={styles.titleContainer}>
            <Text size="base" weight="semibold" variant="strong">Mobile Notes</Text>
          </View>
          <Text size="sm" variant="default">
            • Uses TouchableOpacity for native press feedback
          </Text>
          <Text size="sm" variant="default">
            • ✓ character used temporarily (FontAwesome pending)
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removed - now uses theme.colors.bg.app dynamically
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    // color removed - now uses theme colors dynamically
  },
  subtitle: {
    fontSize: 16,
    // color removed - now uses theme colors dynamically
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
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
    fontSize: 18,
    fontWeight: '600',
    // color removed - now uses theme colors dynamically
    marginBottom: 16,
  },
  subSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    // color removed - now uses theme colors dynamically
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 12,
    // color removed - now uses theme colors dynamically
    marginTop: 8,
    fontStyle: 'italic',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stateText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },
  colorItem: {
    alignItems: 'center',
    gap: 8,
  },
  colorName: {
    fontSize: 12,
    // color removed - now uses theme colors dynamically
  },
  notesSection: {
    // backgroundColor removed - now uses theme colors dynamically
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    // color removed - now uses theme colors dynamically
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    marginBottom: 6,
    lineHeight: 20,
  },
});
