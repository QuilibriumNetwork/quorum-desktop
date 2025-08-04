import React from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import ThemeRadioGroup from '../components/ThemeRadioGroup';
import AccentColorSwitcher from '../components/AccentColorSwitcher';
import { Icon } from '../components/primitives/Icon';
import { IconName } from '../components/primitives/Icon/types';
import { Text } from '../components/primitives/Text';

interface PrimitiveItem {
  id: string;
  title: string;
  description: string;
  icon: IconName;
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
      icon: 'sliders',
      onPress: () => onSelectPrimitive('basic'),
    },
    {
      id: 'input',
      title: 'Input',
      description: 'Cross-platform text input with error states and variants',
      icon: 'memo',
      onPress: () => onSelectPrimitive('input'),
    },
    {
      id: 'textarea',
      title: 'TextArea',
      description:
        'Multiline text input with auto-resize and onboarding variant',
      icon: 'memo',
      onPress: () => onSelectPrimitive('textarea'),
    },
    {
      id: 'button',
      title: 'Button',
      description: 'Complete button system with 11 variants and all sizes',
      icon: 'radio',
      onPress: () => onSelectPrimitive('button'),
    },
    {
      id: 'switch',
      title: 'Switch',
      description:
        'Toggle switches with proper spacing and consistent behavior',
      icon: 'sliders',
      onPress: () => onSelectPrimitive('switch'),
    },
    {
      id: 'modal',
      title: 'Modal',
      description: 'Cross-platform modal that transforms to drawer on mobile',
      icon: 'clipboard',
      onPress: () => onSelectPrimitive('modal'),
    },
    {
      id: 'select',
      title: 'Select',
      description: 'Dropdown/picker component with modal overlay for mobile',
      icon: 'clipboard',
      onPress: () => onSelectPrimitive('select'),
    },
    {
      id: 'colorswatch',
      title: 'ColorSwatch',
      description: 'Touch-optimized color picker for accent selection',
      icon: 'palette',
      onPress: () => onSelectPrimitive('colorswatch'),
    },
    {
      id: 'radiogroup',
      title: 'RadioGroup',
      description: 'Accessible radio button group with icon support',
      icon: 'radio',
      onPress: () => onSelectPrimitive('radiogroup'),
    },
    {
      id: 'tooltip',
      title: 'Tooltip',
      description: 'Cross-platform tooltip for info icons in modals',
      icon: 'comment-dots',
      onPress: () => onSelectPrimitive('tooltip'),
    },
    {
      id: 'icon',
      title: 'Icon',
      description: 'Cross-platform icon system using FontAwesome',
      icon: 'target',
      onPress: () => onSelectPrimitive('icon'),
    },
    {
      id: 'text',
      title: 'Text',
      description: 'Essential text component with variants, sizes, and weights',
      icon: 'pencil',
      onPress: () => onSelectPrimitive('text'),
    },
  ];

  const renderPrimitiveCard = (primitive: PrimitiveItem) => (
    <TouchableOpacity
      key={primitive.id}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.card,
          borderColor: theme.colors.border.default,
        },
      ]}
      onPress={primitive.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Icon
          name={primitive.icon}
          size="lg"
          color={theme.colors.accent[500]}
          style={{ marginRight: 12 }}
        />
        <Text size="xl" variant="strong">
          {primitive.title}
        </Text>
      </View>
      <Text size="sm" variant="default">
        {primitive.description}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.bg.app }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Icon
              name="tools"
              size="xl"
              color={theme.colors.text.strong}
              style={{ marginRight: 12 }}
            />
            <Text size="3xl" variant="strong">
              Primitives Playground
            </Text>
          </View>
          <Text>
            Cross-platform primitive components for mobile architecture
          </Text>

          <View
            style={[
              styles.themeSection,
              { backgroundColor: theme.colors.surface[2] },
            ]}
          >
            <Text size="sm" variant="default">
              Theme
            </Text>
            <ThemeRadioGroup horizontal />
            <AccentColorSwitcher />
          </View>
        </View>

        <View>
          <View style={{ marginBottom: 12 }}>
            <Text size="2xl" variant="strong">
              Available Tests
            </Text>
            <Text variant="subtle">
              Tap any card to test that primitive on React Native
            </Text>
          </View>

          {primitives.map(renderPrimitiveCard)}
        </View>

        <View
          style={[
            styles.infoSection,
            { backgroundColor: theme.colors.surface[3] },
          ]}
        >
          <View style={styles.titleContainer}>
            <Text size="sm" variant="strong">
              Testing Notes
            </Text>
          </View>
          <Text size="sm" variant="default">
            • Each primitive has both web (.web.tsx) and mobile (.native.tsx)
            implementations
          </Text>
          <Text size="sm" variant="default">
            • All primitives maintain identical APIs across platforms
          </Text>
          <Text size="sm" variant="default">
            • Focus on Android testing - Expo web can be unreliable
          </Text>
          <Text size="sm" variant="default">
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    // color removed - now uses theme.colors.text.strong dynamically
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
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 12,
  },
  themeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    // color removed - now uses theme.colors.text.strong dynamically
    textAlign: 'center',
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
    // backgroundColor removed - now uses theme colors dynamically
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
