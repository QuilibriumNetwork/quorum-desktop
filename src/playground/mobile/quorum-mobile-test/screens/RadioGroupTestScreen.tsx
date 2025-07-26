import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RadioGroup } from '../components/primitives';

export const RadioGroupTestScreen: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔘 RadioGroup Primitive</Text>
          <Text style={styles.headerSubtitle}>
            Accessible radio button group with icon support and flexible layouts
          </Text>
        </View>

        {/* Theme Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme Selection</Text>
          <Text style={styles.sectionSubtitle}>Using emojis as temporary icons:</Text>
          <RadioGroup
            options={[
              { value: 'light', label: 'Light', icon: '☀️' },
              { value: 'dark', label: 'Dark', icon: '🌙' },
              { value: 'system', label: 'System', icon: '💻' },
            ]}
            value={selectedTheme}
            onChange={setSelectedTheme}
            direction="vertical"
          />
        </View>

        {/* Horizontal Layout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horizontal Layout</Text>
          <Text style={styles.sectionSubtitle}>Horizontal layout example:</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disabled Options</Text>
          <Text style={styles.sectionSubtitle}>Some options can be disabled:</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Without Icons</Text>
          <Text style={styles.sectionSubtitle}>Simple text-only radio group:</Text>
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
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📱 Mobile Testing Notes</Text>
          <Text style={styles.infoText}>
            • Web: Native HTML radio inputs with custom styling
          </Text>
          <Text style={styles.infoText}>
            • Mobile: Custom radio implementation with TouchableOpacity
          </Text>
          <Text style={styles.infoText}>
            • Icons use emojis temporarily (FontAwesome pending on mobile)
          </Text>
          <Text style={styles.infoText}>
            • Both horizontal and vertical layouts supported
          </Text>
          <Text style={styles.infoText}>
            • Touch targets optimized for mobile (min 44x44)
          </Text>
          <Text style={styles.infoText}>
            • Active state has accent color border and background
          </Text>
          <Text style={styles.infoText}>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
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
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
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