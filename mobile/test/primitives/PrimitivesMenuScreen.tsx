import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/components/primitives/theme';
import ThemeRadioGroup from '@/components/ui/ThemeRadioGroup';
import AccentColorSwitcher from '@/components/ui/AccentColorSwitcher';
import { Icon } from '@/components/primitives/Icon';
import { IconName } from '@/components/primitives/Icon/types';
import { FlexColumn, FlexRow, Text, Title } from '@/components/primitives';
import { commonTestStyles } from '@/styles/commonTestStyles';

interface PrimitiveItem {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
}

interface PrimitivesMenuScreenProps {
  onSelectPrimitive: (screen: string) => void;
}

export const PrimitivesMenuScreen: React.FC<PrimitivesMenuScreenProps> = ({
  onSelectPrimitive,
}) => {
  const theme = useTheme();
  const primitives: PrimitiveItem[] = [
    {
      id: 'basic',
      title: 'Layout',
      description:
        'Container, FlexRow, FlexColumn, FlexBetween, FlexCenter, and ResponsiveContainer',
      icon: 'sliders',
      onPress: () => onSelectPrimitive('basic'),
    },
    {
      id: 'scrollcontainer',
      title: 'ScrollContainer',
      description: 'Scrollable content container matching UserSettingsModal & SpaceEditor patterns',
      icon: 'clipboard',
      onPress: () => onSelectPrimitive('scrollcontainer'),
    },
    {
      id: 'input',
      title: 'Input',
      description: 'Cross-platform text input with error states and variants',
      icon: 'memo',
      onPress: () => onSelectPrimitive('input'),
    },
    {
      id: 'textarea',
      title: 'TextArea',
      description:
        'Multiline text input with auto-resize and onboarding variant',
      icon: 'memo',
      onPress: () => onSelectPrimitive('textarea'),
    },
    {
      id: 'button',
      title: 'Button',
      description: 'Complete button system with 11 variants and all sizes',
      icon: 'radio',
      onPress: () => onSelectPrimitive('button'),
    },
    {
      id: 'switch',
      title: 'Switch',
      description:
        'Toggle switches with proper spacing and consistent behavior',
      icon: 'sliders',
      onPress: () => onSelectPrimitive('switch'),
    },
    {
      id: 'modal',
      title: 'Modal',
      description: 'Cross-platform modal that transforms to drawer on mobile',
      icon: 'clipboard',
      onPress: () => onSelectPrimitive('modal'),
    },
    {
      id: 'select',
      title: 'Select',
      description: 'Dropdown/picker component with modal overlay for mobile',
      icon: 'clipboard',
      onPress: () => onSelectPrimitive('select'),
    },
    {
      id: 'colorswatch',
      title: 'ColorSwatch',
      description: 'Touch-optimized color picker for accent selection',
      icon: 'palette',
      onPress: () => onSelectPrimitive('colorswatch'),
    },
    {
      id: 'radiogroup',
      title: 'RadioGroup',
      description: 'Accessible radio button group with icon support',
      icon: 'radio',
      onPress: () => onSelectPrimitive('radiogroup'),
    },
    {
      id: 'tooltip',
      title: 'Tooltip',
      description: 'Cross-platform tooltip for info icons in modals',
      icon: 'comment-dots',
      onPress: () => onSelectPrimitive('tooltip'),
    },
    {
      id: 'icon',
      title: 'Icon',
      description: 'Cross-platform icon system using FontAwesome',
      icon: 'target',
      onPress: () => onSelectPrimitive('icon'),
    },
    {
      id: 'callout',
      title: 'Callout',
      description: 'Centralized messaging component with variants, sizes, and dismissible options',
      icon: 'info-circle',
      onPress: () => onSelectPrimitive('callout'),
    },
    {
      id: 'text',
      title: 'Text',
      description: 'Essential text component with variants, sizes, and weights',
      icon: 'pencil',
      onPress: () => onSelectPrimitive('text'),
    },
    {
      id: 'fileupload',
      title: 'FileUpload',
      description: 'Cross-platform file upload with native picker integration',
      icon: 'upload',
      onPress: () => onSelectPrimitive('fileupload'),
    },
  ];

  const renderPrimitiveCard = (primitive: PrimitiveItem) => (
    <TouchableOpacity
      key={primitive.id}
      style={[
        {
          backgroundColor: theme.colors.bg.card,
          borderColor: theme.colors.border.default,
          borderWidth: 1,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        },
      ]}
      onPress={primitive.onPress}
      activeOpacity={0.7}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
      >
        <Icon
          name={primitive.icon}
          size="lg"
          color={theme.colors.accent[500]}
          style={{ marginRight: 12 }}
        />
        <Text size="xl">{primitive.title}</Text>
      </View>
      <Text size="sm" variant="subtle">
        {primitive.description}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView contentContainerStyle={commonTestStyles.contentPadding}>
        <View style={commonTestStyles.header}>
          <FlexColumn gap="xs" align="center">
            <Text size="2xl" weight="bold">
              UI Primitives
            </Text>
            <Text size="sm" variant="subtle">
              Test individual primitive components in isolation
            </Text>
          </FlexColumn>

          <View
            style={[
              {
                backgroundColor: theme.colors.surface[2],
                borderRadius: 12,
                padding: 16,
                marginTop: 24,
                width: '100%', // Full width
              },
            ]}
          >
            <FlexColumn gap="md" align="center">
              <ThemeRadioGroup horizontal />
              <AccentColorSwitcher />
            </FlexColumn>
          </View>
        </View>

        <View>
          <View style={{ marginBottom: 12 }}>
            <Text size="2xl" variant="strong">
              Available Tests
            </Text>
            <Text size="sm">
              Tap any card to test that primitive on React Native
            </Text>
          </View>

          {primitives.map(renderPrimitiveCard)}
        </View>

        <View
          style={[
            commonTestStyles.infoSection,
            { backgroundColor: theme.colors.surface[3] },
          ]}
        >
          <View style={commonTestStyles.titleContainer}>
            <Title size="sm">Testing Notes</Title>
          </View>
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">
              •
            </Text>
            <View style={{ flex: 1 }}>
              <Text size="sm" variant="default">
                Each primitive has both web (.web.tsx) and mobile (.native.tsx)
                implementations
              </Text>
            </View>
          </FlexRow>
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">
              •
            </Text>
            <View style={{ flex: 1 }}>
              <Text size="sm" variant="default">
                Focus on Android testing - Expo web can be unreliable
              </Text>
            </View>
          </FlexRow>
          <FlexRow gap="xs" align="start">
            <Text size="sm" variant="default">
              •
            </Text>
            <View style={{ flex: 1 }}>
              <Text size="sm" variant="default">
                Use shake gesture to open developer menu if needed
              </Text>
            </View>
          </FlexRow>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
