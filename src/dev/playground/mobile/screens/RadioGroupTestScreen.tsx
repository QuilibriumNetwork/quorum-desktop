import React, { useState } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import { RadioGroup } from '../components/primitives';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';
import { commonTestStyles } from '../styles/commonTestStyles';

export const RadioGroupTestScreen: React.FC = () => {
  const theme = useTheme();
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.header}>
          <View style={commonTestStyles.titleContainer}>
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
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
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
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
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
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
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
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
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
        <View style={[commonTestStyles.infoSection, { backgroundColor: theme.colors.surface[3] }]}>
          <View style={commonTestStyles.titleContainer}>
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

// All styles now centralized in commonTestStyles
