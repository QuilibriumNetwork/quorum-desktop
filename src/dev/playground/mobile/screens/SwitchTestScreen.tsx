import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { Switch } from '../components/primitives/Switch';
import { Text } from '../components/primitives/Text';
import { Icon } from '../components/primitives/Icon';
import { commonTestStyles } from '../styles/commonTestStyles';

export const SwitchTestScreen: React.FC = () => {
  const theme = useTheme();
  const [basicSwitch, setBasicSwitch] = useState(false);
  const [disabledSwitchOff, setDisabledSwitchOff] = useState(false);
  const [disabledSwitchOn, setDisabledSwitchOn] = useState(true);

  const [mobileSwitch, setMobileSwitch] = useState(true);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.header}>
          <View style={commonTestStyles.titleContainer}>
            <Icon name="sliders" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <Text size="2xl" weight="bold" variant="strong">
              Switch
            </Text>
          </View>
          <View style={{ marginBottom: 24 }}>
            <Text size="base" variant="default" align="center">
              Cross-platform toggle switch with multiple sizes and variants
            </Text>
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Basic Switch
            </Text>
          </View>

          <View style={commonTestStyles.switchRow}>
            <Switch
              value={basicSwitch}
              onChange={setBasicSwitch}
              accessibilityLabel="Basic Switch (OFF)"
            />
            <View style={{ marginLeft: 12 }}>
              <Text size="sm" variant="default">
                Basic Switch ({basicSwitch ? 'ON' : 'OFF'})
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.switchRow}>
            <Switch
              value={disabledSwitchOff}
              onChange={setDisabledSwitchOff}
              disabled={true}
              accessibilityLabel="Disabled Switch (OFF)"
            />
            <View style={{ marginLeft: 12 }}>
              <Text size="sm" variant="subtle">
                Disabled Switch (OFF) - Cannot be toggled
              </Text>
            </View>
          </View>

          <View style={commonTestStyles.switchRow}>
            <Switch
              value={disabledSwitchOn}
              onChange={setDisabledSwitchOn}
              disabled={true}
              accessibilityLabel="Disabled Switch (ON)"
            />
            <View style={{ marginLeft: 12 }}>
              <Text size="sm" variant="subtle">
                Disabled Switch (ON) - Cannot be toggled
              </Text>
            </View>
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">
              Mobile Switch Size
            </Text>
          </View>

          <View style={commonTestStyles.switchRow}>
            <Switch
              value={mobileSwitch}
              onChange={setMobileSwitch}
              accessibilityLabel="Mobile Switch"
            />
            <View style={{ marginLeft: 12 }}>
              <Text size="sm" variant="default">
                Standard Mobile Size (52×28px - matches platform guidelines)
              </Text>
            </View>
          </View>
        </View>

        <View style={[commonTestStyles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <View style={commonTestStyles.titleContainer}>
            <Text size="base" weight="semibold" variant="strong">
              Mobile Notes
            </Text>
          </View>
          <Text size="sm" variant="default">
            • Web: Custom styled switch with smooth animations and accent color
          </Text>
          <Text size="sm" variant="default">
            • Mobile: Custom switch component (no Android ripple effects)
          </Text>
          <Text size="sm" variant="default">
            • Single size optimized for mobile (52×28px matches platform standards)
          </Text>
          <Text size="sm" variant="default">
            • Uses theme-aware surface colors (adapts to light/dark themes)
          </Text>
          <Text size="sm" variant="default">
            • Touch targets are optimized for mobile accessibility
          </Text>
          <Text size="sm" variant="default">
            • Smooth animated transitions with proper spacing consistency
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Most styles now centralized in commonTestStyles
// Only screen-specific styles remain here if needed
const styles = {
  switchLabel: {
    marginLeft: 15,
    flex: 1,
  },
};
