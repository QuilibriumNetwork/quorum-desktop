import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useTheme,
  Switch,
  Text,
  Paragraph,
  Label,
  Title,
  Icon,
  FlexRow,
  FlexColumn,
} from '@/primitives';
import { commonTestStyles, createThemedStyles } from '../styles/commonTestStyles';

export const SwitchTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [basicSwitch, setBasicSwitch] = useState(false);
  const [disabledSwitchOff, setDisabledSwitchOff] = useState(false);
  const [disabledSwitchOn, setDisabledSwitchOn] = useState(true);

  const [mobileSwitch, setMobileSwitch] = useState(true);

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="sliders" size="xl" style={{ marginTop: 2 }} />
            <Title>Switch</Title>
          </FlexRow>
          <Paragraph align="center">
            Cross-platform toggle switch with multiple sizes and variants
          </Paragraph>
        </FlexColumn>

        <View style={themedStyles.section}>
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

        <View style={themedStyles.section}>
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

        <View style={themedStyles.notesSection}>
          <FlexColumn gap="sm">
            <Title size="sm">Mobile Notes</Title>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Web: Custom styled switch with smooth animations and accent color</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Mobile: Custom switch component (no Android ripple effects)</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Single size optimized for mobile (52×28px matches platform standards)</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Uses theme-aware surface colors (adapts to light/dark themes)</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Touch targets are optimized for mobile accessibility</Text>
              </View>
            </FlexRow>
            
            <FlexRow gap="xs" align="start">
              <Text size="sm" variant="default">•</Text>
              <View style={{flex: 1}}>
                <Text size="sm" variant="default">Smooth animated transitions with proper spacing consistency</Text>
              </View>
            </FlexRow>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

