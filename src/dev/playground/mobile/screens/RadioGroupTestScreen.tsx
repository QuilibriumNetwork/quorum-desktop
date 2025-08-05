import React, { useState } from 'react';
import {
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  useTheme,
  RadioGroup,
  Icon,
  SectionHeading,
  Label,
  Paragraph,
  FlexColumn,
  FlexRow,
  Text
} from '../components/primitives';
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
          <FlexColumn gap="lg" align="center">
            <FlexRow gap="md" align="center">
              <Icon name="radio" size="xl" color={theme.colors.text.strong} />
              <SectionHeading color="strong">RadioGroup</SectionHeading>
            </FlexRow>
            <Paragraph align="center">
              Accessible radio button group with icon support and flexible layouts
            </Paragraph>
          </FlexColumn>
        </View>

        {/* Theme Selection */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading color="strong">Theme Selection</SectionHeading>
            <Label color="strong">Using FontAwesome icons:</Label>
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
          </FlexColumn>
        </View>

        {/* Horizontal Layout */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading color="strong">Horizontal Layout</SectionHeading>
            <Label color="strong">Horizontal layout example:</Label>
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
          </FlexColumn>
        </View>

        {/* Disabled Options */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading color="strong">Disabled Options</SectionHeading>
            <Label color="strong">
              Some options can be disabled:
            </Label>
            <RadioGroup
              options={[
                { value: 'basic', label: 'Basic Plan' },
                { value: 'pro', label: 'Pro Plan', disabled: true },
                { value: 'enterprise', label: 'Enterprise', disabled: true },
              ]}
              value="basic"
              onChange={() => {}}
            />
          </FlexColumn>
        </View>

        {/* Without Icons */}
        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <FlexColumn gap="md">
            <SectionHeading color="strong">Without Icons</SectionHeading>
            <Label color="strong">
              Simple text-only radio group:
            </Label>
            <RadioGroup
              options={[
                { value: 'option1', label: 'Option 1' },
                { value: 'option2', label: 'Option 2' },
                { value: 'option3', label: 'Option 3' },
              ]}
              value={selectedOption}
              onChange={setSelectedOption}
            />
          </FlexColumn>
        </View>

        {/* Testing Notes */}
        <View style={[commonTestStyles.infoSection, { backgroundColor: theme.colors.surface[3] }]}>
          <FlexColumn gap="sm">
            <SectionHeading color="strong">Mobile Notes</SectionHeading>
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
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
