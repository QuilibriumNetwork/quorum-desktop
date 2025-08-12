import React from 'react';
import { ScrollView, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container, FlexColumn, FlexRow, Text, Icon, Title } from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { IconName } from '@/primitives/Icon/types';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';

interface BusinessFeature {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  status: 'ready' | 'in-progress' | 'planned';
  onPress: () => void;
}

interface BusinessMenuScreenProps {
  onSelectFeature: (feature: string) => void;
}

export const BusinessMenuScreen: React.FC<BusinessMenuScreenProps> = ({
  onSelectFeature,
}) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  const handlePlannedFeature = (title: string) => {
    Alert.alert(
      'Coming Soon',
      `${title} is planned for development. Start with Authentication first!`,
      [{ text: 'OK' }]
    );
  };

  const features: BusinessFeature[] = [
    {
      id: 'auth',
      title: 'Authentication Flow',
      description: 'Complete Login → Onboarding flow with step indicator and responsive design',
      icon: 'shield',
      status: 'ready',
      onPress: () => onSelectFeature('auth'),
    },
    {
      id: 'maintenance',
      title: 'Maintenance Screen',
      description: 'Maintenance screen with consistent auth layout and styling',
      icon: 'tools',
      status: 'ready',
      onPress: () => onSelectFeature('maintenance'),
    },
    {
      id: 'spaces',
      title: 'Space Navigation',
      description: 'Space list and navigation using useSpaceOrdering hook',
      icon: 'dots',
      status: 'planned',
      onPress: () => handlePlannedFeature('Space Navigation'),
    },
    {
      id: 'channel',
      title: 'Channel View',
      description: 'Channel messages and interactions using useChannelMessages',
      icon: 'hashtag',
      status: 'planned',
      onPress: () => handlePlannedFeature('Channel View'),
    },
    {
      id: 'direct',
      title: 'Direct Messages',
      description: 'DM conversations using useDirectMessageData hook',
      icon: 'comment-dots',
      status: 'planned',
      onPress: () => handlePlannedFeature('Direct Messages'),
    },
    {
      id: 'copy',
      title: 'Click To Copy',
      description: 'Cross-platform copy component with gesture support and adapter pattern',
      icon: 'clipboard',
      status: 'ready',
      onPress: () => onSelectFeature('copy'),
    },
    {
      id: 'modals',
      title: 'Modal Components',
      description: 'Cross-platform modal testing with bottom sheet and swipe gestures',
      icon: 'compress-alt',
      status: 'ready',
      onPress: () => onSelectFeature('modals'),
    },
    {
      id: 'settings',
      title: 'User Settings',
      description: 'Profile and app settings using useUserSettings hook',
      icon: 'cog',
      status: 'planned',
      onPress: () => handlePlannedFeature('User Settings'),
    },
    {
      id: 'search',
      title: 'Global Search',
      description: 'Search functionality using useGlobalSearchState hook',
      icon: 'search',
      status: 'planned',
      onPress: () => handlePlannedFeature('Global Search'),
    },
    {
      id: 'messagecomposer',
      title: 'Message Composer',
      description: 'Native message composer with mobile-specific features and layout',
      icon: 'edit',
      status: 'ready',
      onPress: () => onSelectFeature('messagecomposer'),
    },
  ];

  const getStatusColor = (status: BusinessFeature['status']) => {
    switch (status) {
      case 'ready':
        return theme.colors.success;
      case 'in-progress':
        return theme.colors.warning;
      case 'planned':
        return theme.colors.text.subtle;
    }
  };

  const getStatusText = (status: BusinessFeature['status']) => {
    switch (status) {
      case 'ready':
        return 'Ready to Test';
      case 'in-progress':
        return 'In Development';
      case 'planned':
        return 'Planned';
    }
  };

  const renderFeatureCard = (feature: BusinessFeature) => (
    <TouchableOpacity
      key={feature.id}
      style={[
        {
          backgroundColor: theme.colors.bg.card,
          borderColor: feature.status === 'ready' 
            ? theme.colors.accent[500] 
            : theme.colors.border.default,
          borderWidth: feature.status === 'ready' ? 2 : 1,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          opacity: feature.status === 'planned' ? 0.7 : 1,
        },
      ]}
      onPress={feature.onPress}
      activeOpacity={0.7}
    >
      <FlexRow gap="md" align="start">
        <Icon
          name={feature.icon}
          size="lg"
          color={feature.status === 'ready' ? theme.colors.accent[500] : theme.colors.text.subtle}
          style={{ marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <FlexRow gap="sm" align="center" style={{ marginBottom: 4 }}>
            <Text size="lg" weight="medium">
              {feature.title}
            </Text>
            <View
              style={{
                backgroundColor: `${getStatusColor(feature.status)}20`,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text size="xs" weight="semibold" color={getStatusColor(feature.status)}>
                {getStatusText(feature.status)}
              </Text>
            </View>
          </FlexRow>
          <Text size="sm" variant="subtle">
            {feature.description}
          </Text>
        </View>
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
        contentContainerStyle={commonTestStyles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        <View style={commonTestStyles.header}>
          <FlexColumn gap="xs" align="center">
            <Text size="2xl" weight="bold">
              Business Components
            </Text>
            <Text size="sm" variant="subtle">
              Test real app features with business logic
            </Text>
          </FlexColumn>
        </View>

        <View>
          {features.map(renderFeatureCard)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};