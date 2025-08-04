import React, { useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { RadioGroup } from '../components/primitives';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';

export const RadioGroupTestScreen: React.FC = () => {
  const theme = useTheme();
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Icon name="radio" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <Text size="2xl" weight="bold" variant="strong">RadioGroup</Text>
          </View>
          <View style={{ marginBottom: 24 }}>
            <Text size="base" variant="default" align="center">
              Accessible radio button group with icon support and flexible layouts
            </Text>
          </View>
        </View>

        {/* Theme Selection */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Theme Selection</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Using FontAwesome icons:</Text>
          </View>
          <RadioGroup
            options={[
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
              { value: 'system', label: 'System', icon: 'desktop' },
            ]}
            value={selectedTheme}
            onChange={setSelectedTheme}
            direction="vertical"
          />
        </View>

        {/* Horizontal Layout */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Horizontal Layout</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">Horizontal layout example:</Text>
          </View>
          <RadioGroup
            options={[
              { value: 'option1', label: 'Option 1' },
              { value: 'option2', label: 'Option 2' },
              { value: 'option3', label: 'Option 3' },
            ]}
            value={selectedSize}
            onChange={setSelectedSize}
            direction="horizontal"
          />
        </View>

        {/* Disabled Options */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Disabled Options</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">
              Some options can be disabled:
            </Text>
          </View>
          <RadioGroup
            options={[
              { value: 'basic', label: 'Basic Plan' },
              { value: 'pro', label: 'Pro Plan', disabled: true },
              { value: 'enterprise', label: 'Enterprise', disabled: true },
            ]}
            value="basic"
            onChange={() => {}}
          />
        </View>

        {/* Without Icons */}
        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Without Icons</Text>
          </View>
          <View style={{ marginBottom: 8 }}>
            <Text size="sm" variant="strong">
              Simple text-only radio group:
            </Text>
          </View>
          <RadioGroup
            options={[
              { value: 'option1', label: 'Option 1' },
              { value: 'option2', label: 'Option 2' },
              { value: 'option3', label: 'Option 3' },
            ]}
            value={selectedOption}
            onChange={setSelectedOption}
          />
        </View>

        {/* Testing Notes */}
        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface[3] }]}>
          <View style={styles.titleContainer}>
            <Text size="base" weight="semibold" variant="strong">Mobile Notes</Text>
          </View>
          <Text size="sm" variant="default">
            • Web: Native HTML radio inputs with custom styling
          </Text>
          <Text size="sm" variant="default">
            • Mobile: Custom radio implementation with TouchableOpacity
          </Text>
          <Text size="sm" variant="default">
            • Icons now use FontAwesome icon system
          </Text>
          <Text size="sm" variant="default">
            • Both horizontal and vertical layouts supported
          </Text>
          <Text size="sm" variant="default">
            • Touch targets optimized for mobile (min 44x44)
          </Text>
          <Text size="sm" variant="default">
            • Active state has accent color border and background
          </Text>
          <Text size="sm" variant="default">
            • Ready for ThemeRadioGroup integration
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    // color removed - now uses theme colors dynamically
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    // color removed - now uses theme colors dynamically
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    // backgroundColor removed - now uses theme.colors.bg.card dynamically
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    marginBottom: 16,
    lineHeight: 20,
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
    // color removed - now uses theme colors dynamically
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    marginBottom: 6,
    lineHeight: 20,
  },
});
