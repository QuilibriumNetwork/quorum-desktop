import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container, FlexColumn, FlexRow, Text, Button, Icon } from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';

interface AuthenticationTestScreenProps {
  // Will add props as we develop the actual components
}

export const AuthenticationTestScreen: React.FC<AuthenticationTestScreenProps> = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [currentView, setCurrentView] = useState<'menu' | 'login' | 'onboarding'>('menu');

  const renderMenu = () => (
    <FlexColumn gap="lg" style={{ padding: 20 }}>
      <Text size="xl" weight="bold" style={{ textAlign: 'center' }}>
        Authentication Components
      </Text>
      
      <View
        style={{
          backgroundColor: theme.colors.surface[2],
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Text size="sm" variant="subtle">
          Test the authentication flow components here. Once Login.native.tsx and Onboarding.native.tsx are created, they will be integrated here for testing.
        </Text>
      </View>

      <FlexColumn gap="md">
        <Button
          type="primary"
          size="large"
          iconName="sign-in"
          onClick={() => setCurrentView('login')}
        >
          Test Login Component
        </Button>
        
        <Button
          type="secondary"
          size="large"
          iconName="user-plus"
          onClick={() => setCurrentView('onboarding')}
        >
          Test Onboarding Component
        </Button>
      </FlexColumn>

      <View
        style={{
          backgroundColor: theme.colors.warning + '20',
          borderColor: theme.colors.warning,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginTop: 20,
        }}
      >
        <FlexRow gap="sm" align="start">
          <Icon name="exclamation-triangle" size="md" color={theme.colors.warning} />
          <View style={{ flex: 1 }}>
            <Text size="sm" weight="semibold" color={theme.colors.warning}>
              Development Status
            </Text>
            <Text size="sm" style={{ marginTop: 4 }}>
              Login.native.tsx and Onboarding.native.tsx need to be created first. They will reuse:
            </Text>
            <Text size="sm" style={{ marginTop: 4 }}>
              • useAuthenticationFlow hook
            </Text>
            <Text size="sm">
              • useOnboardingFlow hook
            </Text>
            <Text size="sm">
              • useWebKeyBackup hook (adapted for mobile)
            </Text>
          </View>
        </FlexRow>
      </View>
    </FlexColumn>
  );

  const renderLogin = () => (
    <FlexColumn gap="md" style={{ padding: 20 }}>
      <Text size="lg" weight="bold">Login Component</Text>
      <Text size="sm" variant="subtle">
        Login.native.tsx will be displayed here once created
      </Text>
      <Button type="secondary" onClick={() => setCurrentView('menu')}>
        Back to Menu
      </Button>
    </FlexColumn>
  );

  const renderOnboarding = () => (
    <FlexColumn gap="md" style={{ padding: 20 }}>
      <Text size="lg" weight="bold">Onboarding Component</Text>
      <Text size="sm" variant="subtle">
        Onboarding.native.tsx will be displayed here once created
      </Text>
      <Button type="secondary" onClick={() => setCurrentView('menu')}>
        Back to Menu
      </Button>
    </FlexColumn>
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
        {currentView === 'menu' && renderMenu()}
        {currentView === 'login' && renderLogin()}
        {currentView === 'onboarding' && renderOnboarding()}
      </ScrollView>
    </SafeAreaView>
  );
};