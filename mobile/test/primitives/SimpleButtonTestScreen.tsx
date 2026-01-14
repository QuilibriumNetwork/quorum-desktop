import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/primitives/theme';
import Button from '@/components/primitives/Button';
import { Icon } from '@/components/primitives/Icon';
import { Text, Paragraph, Title, Flex } from '@/components/primitives';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';

export const SimpleButtonTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <Flex direction="column" style={commonTestStyles.header}>
          <Flex gap="md" align="center" style={{ alignItems: 'flex-start' }}>
            <Icon name="radio" size="xl" style={{ marginTop: 2 }} />
            <Title>Simple Button Test</Title>
          </Flex>
          <Paragraph align="center">
            Testing Button primitive without flex layouts
          </Paragraph>
        </Flex>

        <View style={themedStyles.section}>
          <Title size="sm">Primary Variants</Title>

          <Flex direction="column" gap={12}>
            <Button type="primary" onClick={() => {}}>
              Primary
            </Button>

            <Button type="secondary" onClick={() => {}}>
              Secondary
            </Button>

            <Button type="light" onClick={() => {}}>
              Light
            </Button>

            <Button type="light-outline" onClick={() => {}}>
              Light Outline
            </Button>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Title size="sm">Subtle & Utility Variants</Title>

          <Flex direction="column" gap={12}>
            <Button type="subtle" onClick={() => {}}>
              Subtle
            </Button>

            <Button type="subtle-outline" onClick={() => {}}>
              Subtle Outline
            </Button>

            <Button type="danger" onClick={() => {}}>
              Danger
            </Button>

            <Button type="danger-outline" onClick={() => {}}>
              Danger Outline
            </Button>
          </Flex>
        </View>

        <View
          style={[
            commonTestStyles.section,
            { backgroundColor: theme.colors.accent[500] },
          ]}
        >
          <Title size="sm" color="white">
            White Variants (on colored bg)
          </Title>

          <Flex direction="column" gap={12}>
            <Button type="primary-white" onClick={() => {}}>
              Primary White
            </Button>

            <Button type="secondary-white" onClick={() => {}}>
              Secondary White
            </Button>

            <Button type="light-outline-white" onClick={() => {}}>
              Light Outline White
            </Button>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Title size="sm">Button Sizes</Title>

          <Flex direction="column" gap={12}>
            <Button type="primary" size="large" onClick={() => {}}>
              Large Size
            </Button>

            <Button type="primary" size="normal" onClick={() => {}}>
              Normal Size
            </Button>

            <Button type="primary" size="small" onClick={() => {}}>
              Small Size
            </Button>

            <Button type="primary" size="compact" onClick={() => {}}>
              Compact Size
            </Button>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Title size="sm">Buttons with Icons</Title>

          <Flex direction="column" gap={12}>
            <Button type="primary" iconName="plus" onClick={() => {}}>
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

            <Flex gap={8} style={{ alignItems: 'center' }}>
              <Button
                type="unstyled"
                iconName="arrow-right"
                iconOnly
                size="compact"
                onClick={() => {}}
              />
              <Button
                type="unstyled"
                iconName="close"
                iconOnly
                size="compact"
                onClick={() => {}}
              />
              <Paragraph>
                Compact icon-only buttons (like in pinned messages)
              </Paragraph>
            </Flex>
          </Flex>
        </View>

        <View style={themedStyles.section}>
          <Title size="sm">Disabled State</Title>

          <Flex direction="column" gap={12}>
            <Button type="primary" disabled onClick={() => {}}>
              Disabled Button
            </Button>
          </Flex>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
