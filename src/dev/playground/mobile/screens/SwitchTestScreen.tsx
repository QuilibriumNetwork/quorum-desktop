import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Switch } from '../components/primitives/Switch';

export const SwitchTestScreen: React.FC = () => {
  const theme = useTheme();
  const [basicSwitch, setBasicSwitch] = useState(false);
  const [disabledSwitchOff, setDisabledSwitchOff] = useState(false);
  const [disabledSwitchOn, setDisabledSwitchOn] = useState(true);

  const [mobileSwitch, setMobileSwitch] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text.strong }]}>
            Switch
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.main }]}>
            Cross-platform toggle switch with multiple sizes and variants
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>
            Basic Switch
          </Text>

          <View style={styles.switchRow}>
            <Switch
              value={basicSwitch}
              onChange={setBasicSwitch}
              accessibilityLabel="Basic Switch (OFF)"
            />
            <Text style={[styles.switchLabel, { color: theme.colors.text.main }]}>
              Basic Switch ({basicSwitch ? 'ON' : 'OFF'})
            </Text>
          </View>

          <View style={styles.switchRow}>
            <Switch
              value={disabledSwitchOff}
              onChange={setDisabledSwitchOff}
              disabled={true}
              accessibilityLabel="Disabled Switch (OFF)"
            />
            <Text style={[styles.switchLabel, { color: theme.colors.text.subtle }]}>
              Disabled Switch (OFF) - Cannot be toggled
            </Text>
          </View>

          <View style={styles.switchRow}>
            <Switch
              value={disabledSwitchOn}
              onChange={setDisabledSwitchOn}
              disabled={true}
              accessibilityLabel="Disabled Switch (ON)"
            />
            <Text style={[styles.switchLabel, { color: theme.colors.text.subtle }]}>
              Disabled Switch (ON) - Cannot be toggled
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.strong }]}>
            Mobile Switch Size
          </Text>

          <View style={styles.switchRow}>
            <Switch
              value={mobileSwitch}
              onChange={setMobileSwitch}
              accessibilityLabel="Mobile Switch"
            />
            <Text style={[styles.switchLabel, { color: theme.colors.text.main }]}>
              Standard Mobile Size (52×28px - matches platform guidelines)
            </Text>
          </View>
        </View>

        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <Text style={[styles.notesTitle, { color: theme.colors.text.strong }]}>
            📱 Mobile Testing Notes
          </Text>
          <Text style={[styles.notesText, { color: theme.colors.text.main }]}>
            • Web: Custom styled switch with smooth animations and accent color
            {'\n'}• Mobile: Custom switch component (no Android ripple effects)
            {'\n'}• Single size optimized for mobile (52×28px matches platform
            standards){'\n'}• Uses theme-aware surface colors (adapts to
            light/dark themes){'\n'}• Touch targets are optimized for mobile
            accessibility{'\n'}• Smooth animated transitions with proper spacing
            consistency
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
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
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchLabel: {
    marginLeft: 15,
    fontSize: 16,
    flex: 1,
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
  notesText: {
    fontSize: 14,
    // color removed - now uses theme colors dynamically
    lineHeight: 20,
  },
});
