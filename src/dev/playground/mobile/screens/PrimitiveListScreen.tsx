import React from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import ThemeRadioGroup from '../components/ThemeRadioGroup';

interface PrimitiveItem {
  id: string;
  title: string;
  description: string;
  emoji: string;
  onPress: () => void;
}

interface PrimitiveListScreenProps {
  onSelectPrimitive: (screen: string) => void;
}

export const PrimitiveListScreen: React.FC<PrimitiveListScreenProps> = ({
  onSelectPrimitive,
}) => {
  const theme = useTheme();
  const primitives: PrimitiveItem[] = [
    {
      id: 'basic',
      title: 'Layout',
      description:
        'Container, FlexRow, FlexColumn, FlexBetween, FlexCenter, and ResponsiveContainer',
      emoji: '📐',
      onPress: () => onSelectPrimitive('basic'),
    },
    {
      id: 'input',
      title: 'Input',
      description: 'Cross-platform text input with error states and variants',
      emoji: '📝',
      onPress: () => onSelectPrimitive('input'),
    },
    {
      id: 'textarea',
      title: 'TextArea',
      description:
        'Multiline text input with auto-resize and onboarding variant',
      emoji: '📄',
      onPress: () => onSelectPrimitive('textarea'),
    },
    {
      id: 'button',
      title: 'Button',
      description: 'Complete button system with 11 variants and all sizes',
      emoji: '🔘',
      onPress: () => onSelectPrimitive('button'),
    },
    {
      id: 'switch',
      title: 'Switch',
      description:
        'Toggle switches with proper spacing and consistent behavior',
      emoji: '🔛',
      onPress: () => onSelectPrimitive('switch'),
    },
    {
      id: 'modal',
      title: 'Modal',
      description: 'Cross-platform modal that transforms to drawer on mobile',
      emoji: '📋',
      onPress: () => onSelectPrimitive('modal'),
    },
    {
      id: 'select',
      title: 'Select',
      description: 'Dropdown/picker component with modal overlay for mobile',
      emoji: '📋',
      onPress: () => onSelectPrimitive('select'),
    },
    {
      id: 'colorswatch',
      title: 'ColorSwatch',
      description: 'Touch-optimized color picker for accent selection',
      emoji: '🎨',
      onPress: () => onSelectPrimitive('colorswatch'),
    },
    {
      id: 'radiogroup',
      title: 'RadioGroup',
      description: 'Accessible radio button group with icon support',
      emoji: '🔘',
      onPress: () => onSelectPrimitive('radiogroup'),
    },
    {
      id: 'tooltip',
      title: 'Tooltip',
      description: 'Cross-platform tooltip for info icons in modals',
      emoji: '💬',
      onPress: () => onSelectPrimitive('tooltip'),
    },
    {
      id: 'icon',
      title: 'Icon',
      description: 'Cross-platform icon system using FontAwesome',
      emoji: '🎯',
      onPress: () => onSelectPrimitive('icon'),
    },
    {
      id: 'text',
      title: 'Text',
      description: 'Essential text component with variants, sizes, and weights',
      emoji: '✏️',
      onPress: () => onSelectPrimitive('text'),
    },
  ];

  const renderPrimitiveCard = (primitive: PrimitiveItem) => (
    <TouchableOpacity
      key={primitive.id}
      style={[styles.card, { backgroundColor: theme.colors.bg.card, borderColor: theme.colors.border.default }]}
      onPress={primitive.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>{primitive.emoji}</Text>
        <Text style={[styles.title, { color: theme.colors.text.strong }]}>{primitive.title}</Text>
      </View>
      <Text style={[styles.description, { color: theme.colors.text.main }]}>{primitive.description}</Text>
      <View style={styles.arrow}>
        <Text style={[styles.arrowText, { color: theme.colors.text.subtle }]}>→</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.strong }]}>🧱 Primitives Playground</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.main }]}>
            Cross-platform primitive components for mobile architecture
          </Text>
          
          <View style={styles.themeSection}>
            <Text style={[styles.themeSectionTitle, { color: theme.colors.text.strong }]}>🎨 Theme</Text>
            <Text style={[styles.themeSectionSubtitle, { color: theme.colors.text.subtle }]}>
              Change the theme for the entire playground
            </Text>
            <ThemeRadioGroup horizontal />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>Available Tests</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.text.subtle }]}>
            Tap any card to test that primitive on React Native
          </Text>

          {primitives.map(renderPrimitiveCard)}
        </View>

        <View style={styles.infoSection}>
          <Text style={[styles.infoTitle, { color: theme.colors.text.strong }]}>📱 Testing Notes</Text>
          <Text style={[styles.infoText, { color: theme.colors.text.main }]}>
            • Each primitive has both web (.web.tsx) and mobile (.native.tsx)
            implementations
          </Text>
          <Text style={[styles.infoText, { color: theme.colors.text.main }]}>
            • All primitives maintain identical APIs across platforms
          </Text>
          <Text style={[styles.infoText, { color: theme.colors.text.main }]}>
            • Focus on Android testing - Expo web can be unreliable
          </Text>
          <Text style={[styles.infoText, { color: theme.colors.text.main }]}>
            • Use shake gesture to open developer menu if needed
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
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    // color removed - now uses theme.colors.text.strong dynamically
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    // color removed - now uses theme.colors.text.main dynamically
    textAlign: 'center',
    lineHeight: 22,
  },
  themeSection: {
    marginTop: 24,
    alignItems: 'center',
    backgroundColor: 'white', // Keep white for theme section container
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  themeSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    // color removed - now uses theme.colors.text.strong dynamically
    marginBottom: 4,
  },
  themeSectionSubtitle: {
    fontSize: 14,
    // color removed - now uses theme.colors.text.subtle dynamically
    textAlign: 'center',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    // color removed - now uses theme.colors.text.strong dynamically
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    // color removed - now uses theme.colors.text.subtle dynamically
    marginBottom: 16,
  },
  card: {
    // backgroundColor removed - now uses theme.colors.bg.card dynamically
    // borderColor added dynamically in component
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 24,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    // color removed - now uses theme.colors.text.strong dynamically
    flex: 1,
  },
  description: {
    fontSize: 14,
    // color removed - now uses theme.colors.text.main dynamically
    lineHeight: 20,
    marginBottom: 4,
  },
  arrow: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  arrowText: {
    fontSize: 20,
    // color removed - now uses theme.colors.text.subtle dynamically
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#e3f2fd', // Keep info section blue background
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    // color removed - now uses theme.colors.text.strong dynamically
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    // color removed - now uses theme.colors.text.main dynamically
    marginBottom: 6,
    lineHeight: 20,
  },
});
