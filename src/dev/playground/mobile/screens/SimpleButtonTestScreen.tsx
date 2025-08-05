import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import Button from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { Text, SectionHeading, Paragraph, FlexColumn, FlexRow } from '../components/primitives';
import { commonTestStyles } from '../styles/commonTestStyles';

export const SimpleButtonTestScreen: React.FC = () => {
  const theme = useTheme();
  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <FlexColumn style={commonTestStyles.header}>
          <FlexRow align="center">
            <Icon name="radio" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
            <Text size="2xl" weight="bold" variant="strong">Simple Button Test</Text>
          </FlexRow>
          <Paragraph align="center">
            Testing Button primitive without flex layouts
          </Paragraph>
        </FlexColumn>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Primary Variants</SectionHeading>

          <FlexColumn gap={12}>
            <Button
              type="primary"
              onClick={() => {}}
            >
              Primary
            </Button>

            <Button
              type="secondary"
              onClick={() => {}}
            >
              Secondary
            </Button>

            <Button type="light" onClick={() => {}}>
              Light
            </Button>

            <Button
              type="light-outline"
              onClick={() => {}}
            >
              Light Outline
            </Button>
          </FlexColumn>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Subtle & Utility Variants</SectionHeading>

          <FlexColumn gap={12}>
            <Button type="subtle" onClick={() => {}}>
              Subtle
            </Button>

            <Button
              type="subtle-outline"
              onClick={() => {}}
            >
              Subtle Outline
            </Button>

            <Button type="danger" onClick={() => {}}>
              Danger
            </Button>
          </FlexColumn>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.accent[500] }]}>
          <SectionHeading color="white">White Variants (on colored bg)</SectionHeading>

          <FlexColumn gap={12}>
            <Button
              type="primary-white"
              onClick={() => {}}
            >
              Primary White
            </Button>

            <Button
              type="secondary-white"
              onClick={() => {}}
            >
              Secondary White
            </Button>

            <Button
              type="light-outline-white"
              onClick={() => {}}
            >
              Light Outline White
            </Button>
          </FlexColumn>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Button Sizes</SectionHeading>

          <FlexColumn gap={12}>
            <Button
              type="primary"
              size="large"
              onClick={() => {}}
            >
              Large Size
            </Button>

            <Button
              type="primary"
              size="normal"
              onClick={() => {}}
            >
              Normal Size
            </Button>

            <Button
              type="primary"
              size="small"
              onClick={() => {}}
            >
              Small Size
            </Button>
          </FlexColumn>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Buttons with Icons</SectionHeading>

          <FlexColumn gap={12}>
            <Button
              type="primary"
              iconName="plus"
              onClick={() => {}}
            >
              Add Item
            </Button>

            <Button
              type="primary"
              iconName="edit"
              iconOnly
              onClick={() => {}}
            />

            <Button
              type="secondary"
              iconName="save"
              size="large"
              onClick={() => {}}
            >
              Save Document
            </Button>

            <Button
              type="primary"
              iconName="download"
              iconOnly
              size="large"
              onClick={() => {}}
            />
          </FlexColumn>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <SectionHeading>Disabled State</SectionHeading>

          <FlexColumn gap={12}>
            <Button
              type="primary"
              disabled
              onClick={() => {}}
            >
              Disabled Button
            </Button>
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
