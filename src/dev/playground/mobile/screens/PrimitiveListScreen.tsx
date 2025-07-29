import React from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      style={styles.card}
      onPress={primitive.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>{primitive.emoji}</Text>
        <Text style={styles.title}>{primitive.title}</Text>
      </View>
      <Text style={styles.description}>{primitive.description}</Text>
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🧱 Primitives Playground</Text>
          <Text style={styles.headerSubtitle}>
            Cross-platform primitive components for mobile architecture
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Tests</Text>
          <Text style={styles.sectionSubtitle}>
            Tap any card to test that primitive on React Native
          </Text>

          {primitives.map(renderPrimitiveCard)}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📱 Testing Notes</Text>
          <Text style={styles.infoText}>
            • Each primitive has both web (.web.tsx) and mobile (.native.tsx)
            implementations
          </Text>
          <Text style={styles.infoText}>
            • All primitives maintain identical APIs across platforms
          </Text>
          <Text style={styles.infoText}>
            • Focus on Android testing - Expo web can be unreliable
          </Text>
          <Text style={styles.infoText}>
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
    backgroundColor: '#f5f5f5',
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
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
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
    color: '#333',
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#666',
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
    color: '#1976d2',
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 6,
    lineHeight: 20,
  },
});
