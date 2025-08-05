import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/primitives/theme';
import Button from '../components/primitives/Button';
import { Icon } from '../components/primitives/Icon';
import { Text } from '../components/primitives/Text';
import { commonTestStyles } from '../styles/commonTestStyles';

export const SimpleButtonTestScreen: React.FC = () => {
  const theme = useTheme();
  return (
    <SafeAreaView style={[commonTestStyles.container, { backgroundColor: theme.colors.bg.app }]}>
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.titleContainer}>
          <Icon name="radio" size="xl" color={theme.colors.text.strong} style={{ marginRight: 12 }} />
          <Text size="2xl" weight="bold" variant="strong">Simple Button Test</Text>
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text size="base" variant="default" align="center">
            Testing Button primitive without flex layouts
          </Text>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Primary Variants</Text>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              onClick={() => {}}
            >
              Primary
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="secondary"
              onClick={() => {}}
            >
              Secondary
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button type="light" onClick={() => {}}>
              Light
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="light-outline"
              onClick={() => {}}
            >
              Light Outline
            </Button>
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Subtle & Utility Variants</Text>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button type="subtle" onClick={() => {}}>
              Subtle
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="subtle-outline"
              onClick={() => {}}
            >
              Subtle Outline
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button type="danger" onClick={() => {}}>
              Danger
            </Button>
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.accent[500] }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" color="white">
              White Variants (on colored bg)
            </Text>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary-white"
              onClick={() => {}}
            >
              Primary White
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="secondary-white"
              onClick={() => {}}
            >
              Secondary White
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="light-outline-white"
              onClick={() => {}}
            >
              Light Outline White
            </Button>
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Button Sizes</Text>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              size="large"
              onClick={() => {}}
            >
              Large Size
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              size="normal"
              onClick={() => {}}
            >
              Normal Size
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              size="small"
              onClick={() => {}}
            >
              Small Size
            </Button>
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Buttons with Icons</Text>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              iconName="plus"
              onClick={() => {}}
            >
              Add Item
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              iconName="edit"
              iconOnly
              onClick={() => {}}
            />
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="secondary"
              iconName="save"
              size="large"
              onClick={() => {}}
            >
              Save Document
            </Button>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              iconName="download"
              iconOnly
              size="large"
              onClick={() => {}}
            />
          </View>
        </View>

        <View style={[commonTestStyles.section, { backgroundColor: theme.colors.bg.card }]}>
          <View style={{ marginBottom: 16 }}>
            <Text size="lg" weight="semibold" variant="strong">Disabled State</Text>
          </View>

          <View style={commonTestStyles.buttonContainer}>
            <Button
              type="primary"
              disabled
              onClick={() => {}}
            >
              Disabled Button
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// All styles now centralized in commonTestStyles
