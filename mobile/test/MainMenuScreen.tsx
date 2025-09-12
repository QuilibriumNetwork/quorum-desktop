import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container, FlexColumn, FlexRow, Text, Icon } from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { IconName } from '@/primitives/Icon/types';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';
import ThemeRadioGroup from '@/components/ThemeRadioGroup';
import AccentColorSwitcher from '@/components/AccentColorSwitcher';

interface MenuOption {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  color: string;
  onPress: () => void;
}

interface MainMenuScreenProps {
  onSelectSection: (section: 'primitives' | 'business') => void;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onSelectSection,
}) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  const menuOptions: MenuOption[] = [
    {
      id: 'primitives',
      title: 'UI Primitives',
      description:
        'Test individual primitive components like Button, Input, Modal, etc.',
      icon: 'sliders',
      color: theme.colors.accent[500],
      onPress: () => onSelectSection('primitives'),
    },
    {
      id: 'business',
      title: 'Business Components',
      description:
        'Test app features like Authentication, Chat, Settings using real business logic',
      icon: 'home',
      color: theme.colors.info,
      onPress: () => onSelectSection('business'),
    },
  ];

  const renderMenuCard = (option: MenuOption) => (
    <TouchableOpacity
      key={option.id}
      style={[
        {
          backgroundColor: theme.colors.bg.card,
          borderColor: theme.colors.border.default,
          borderWidth: 1,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
      ]}
      onPress={option.onPress}
      activeOpacity={0.7}
    >
      <FlexRow gap="md" align="center">
        <View style={{ flex: 1 }}>
          <Text size="xl" weight="semibold" style={{ marginBottom: 4 }}>
            {option.title}
          </Text>
          <Text size="sm" variant="subtle">
            {option.description}
          </Text>
        </View>
        <Icon name="chevron-right" size="lg" color={theme.colors.text.subtle} />
      </FlexRow>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[
        commonTestStyles.container,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          commonTestStyles.contentPadding,
          { paddingTop: 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={commonTestStyles.header}>
          <FlexColumn align="center" gap="xs">
            <Text size="3xl" weight="bold" color={theme.colors.accent[500]}>
              Quorum Mobile
            </Text>
            <Text size="xl" weight="normal" variant="subtle">
              Development Playground
            </Text>
          </FlexColumn>
        </View>

        <View style={{ marginTop: 40, marginBottom: 20 }}>
          {menuOptions.map(renderMenuCard)}
        </View>

        <View
          style={[
            {
              backgroundColor: theme.colors.surface[2],
              borderRadius: 12,
              padding: 16,
              marginTop: 20,
            },
          ]}
        >
          <FlexColumn gap="md" align="center">
            <ThemeRadioGroup horizontal />
            <AccentColorSwitcher />
          </FlexColumn>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
