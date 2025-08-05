import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useTheme,
  Switch,
  Text,
  SectionHeading,
  Paragraph,
  Label,
  Icon,
  FlexRow,
  FlexColumn,
} from '../components/primitives';
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
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow style={commonTestStyles.titleContainer}>
            <Icon name="sliders" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <SectionHeading>Switch</SectionHeading>
          </FlexRow>
          <Paragraph align="center">
            Cross-platform toggle switch with multiple sizes and variants
          </Paragraph>
        </FlexColumn>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Label>
            Basic Switch
          </Label>

          <FlexColumn gap="lg">
            <FlexRow gap="sm" align="center">
              <Switch
                value={basicSwitch}
                onChange={setBasicSwitch}
                accessibilityLabel="Basic Switch (OFF)"
              />
              <Text size="sm" variant="default">
                Basic Switch ({basicSwitch ? 'ON' : 'OFF'})
              </Text>
            </FlexRow>

            <FlexRow gap="sm" align="center">
              <Switch
                value={disabledSwitchOff}
                onChange={setDisabledSwitchOff}
                disabled={true}
                accessibilityLabel="Disabled Switch (OFF)"
              />
              <Text size="sm" variant="subtle">
                Disabled Switch (OFF) - Cannot be toggled
              </Text>
            </FlexRow>

            <FlexRow gap="sm" align="center">
              <Switch
                value={disabledSwitchOn}
                onChange={setDisabledSwitchOn}
                disabled={true}
                accessibilityLabel="Disabled Switch (ON)"
              />
              <Text size="sm" variant="subtle">
                Disabled Switch (ON) - Cannot be toggled
              </Text>
            </FlexRow>
          </FlexColumn>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <Label>
            Mobile Switch Size
          </Label>

          <FlexRow gap="sm" align="center">
            <Switch
              value={mobileSwitch}
              onChange={setMobileSwitch}
              accessibilityLabel="Mobile Switch"
            />
            <Text size="sm" variant="default">
              Standard Mobile Size (52×28px - matches platform guidelines)
            </Text>
          </FlexRow>
        </View>

        <View style={[commonTestStyles.notesSection, { backgroundColor: theme.colors.surface[3] }]}>
          <FlexColumn gap="md">
            <Label>Mobile Notes</Label>
            <Text size="sm" variant="default">• Web: Custom styled switch with smooth animations and accent color</Text>
            <Text size="sm" variant="default">• Mobile: Custom switch component (no Android ripple effects)</Text>
            <Text size="sm" variant="default">• Single size optimized for mobile (52×28px matches platform standards)</Text>
            <Text size="sm" variant="default">• Uses theme-aware surface colors (adapts to light/dark themes)</Text>
            <Text size="sm" variant="default">• Touch targets are optimized for mobile accessibility</Text>
            <Text size="sm" variant="default">• Smooth animated transitions with proper spacing consistency</Text>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

