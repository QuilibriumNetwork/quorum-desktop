import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../components/primitives/theme';
import { ColorSwatch } from '../components/primitives/ColorSwatch';

export const ColorSwatchTestScreen: React.FC = () => {
  const theme = useTheme();
  const [activeColor, setActiveColor] = useState('blue');
  const [sizeDemo, setSizeDemo] = useState('');

  const colors = ['blue', 'purple', 'fuchsia', 'orange', 'green', 'yellow'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text.strong }]}>🎨 ColorSwatch</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
            Touch-optimized color picker for accent selection
          </Text>
        </View>

        {/* Basic Usage */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Basic Usage</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Click to select colors:</Text>
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
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Size Variants</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Small Size</Text>
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
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Medium Size (Default)</Text>
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
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Large Size</Text>
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
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>States</Text>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Active State</Text>
            <View style={styles.stateRow}>
              <ColorSwatch color="blue" isActive={true} onPress={() => {}} />
              <Text style={styles.stateText}>Shows ✓ checkmark</Text>
            </View>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Disabled State</Text>
            <View style={styles.stateRow}>
              <ColorSwatch color="purple" disabled={true} onPress={() => {}} />
              <Text style={styles.stateText}>50% opacity, no interaction</Text>
            </View>
          </View>

          <View style={styles.subSection}>
            <Text style={[styles.label, { color: theme.colors.text.main }]}>Active without checkmark</Text>
            <View style={styles.stateRow}>
              <ColorSwatch
                color="orange"
                isActive={true}
                showCheckmark={false}
                onPress={() => {}}
              />
              <Text style={styles.stateText}>Border/shadow only</Text>
            </View>
          </View>
        </View>

        {/* All Colors Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>All Theme Colors</Text>
          <Text style={[styles.label, { color: theme.colors.text.main }]}>Complete color palette</Text>

          <View style={styles.colorGrid}>
            {colors.map((color) => (
              <View key={color} style={styles.colorItem}>
                <ColorSwatch
                  color={color}
                  isActive={false}
                  onPress={() => {}}
                />
                <Text style={styles.colorName}>{color}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Implementation Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>📱 Mobile Implementation</Text>
          <Text style={styles.noteText}>
            • Uses TouchableOpacity for native press feedback
          </Text>
          <Text style={styles.noteText}>
            • ✓ character used temporarily (FontAwesome pending)
          </Text>
          <Text style={styles.noteText}>
            • Dynamic colors from theme system
          </Text>
          <Text style={styles.noteText}>
            • Shadow effects for active state visibility
          </Text>
          <Text style={styles.noteText}>
            • Touch targets optimized for mobile (min 24x24)
          </Text>
          <Text style={styles.noteText}>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    // color removed - now uses theme colors dynamically
    marginBottom: 8,
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
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 6,
    lineHeight: 20,
  },
});
