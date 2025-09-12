import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  Text,
  Button,
  Icon,
} from '@/primitives';
import { useTheme } from '@/primitives/theme';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';
import { Login } from '@/components/onboarding/Login.native';
import { Onboarding } from '@/components/onboarding/Onboarding.native';

interface AuthenticationTestScreenProps {
  // Will add props as we develop the actual components
}

export const AuthenticationTestScreen: React.FC<
  AuthenticationTestScreenProps
> = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [currentView, setCurrentView] = useState<
    'menu' | 'login' | 'onboarding'
  >('menu');
  const [user, setUser] = useState<
    | {
        displayName: string;
        state: string;
        status: string;
        userIcon: string;
        address: string;
      }
    | undefined
  >(undefined);

  const handleResetFlow = () => {
    setUser(undefined);
    setCurrentView('menu');
  };

  const renderMenu = () => (
    <Container>
      <FlexColumn gap="lg">
        <Text size="xl" weight="bold" align="center">
          Authentication Flow Test
        </Text>

        <View
          style={{
            backgroundColor: theme.colors.surface[2],
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text size="sm" variant="subtle">
            Test the complete authentication flow: Login → Onboarding → Welcome.
            This mimics the actual app flow where users first see the Login
            screen, then proceed through the Onboarding process.
          </Text>
        </View>

        <FlexColumn gap="md">
          <Button
            type="primary"
            size="large"
            iconName="sign-in"
            onClick={() => setCurrentView('login')}
          >
            Start Authentication Flow
          </Button>
        </FlexColumn>

        {user && (
          <View
            style={{
              backgroundColor: theme.colors.success + '20',
              borderColor: theme.colors.success,
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
              marginTop: 20,
            }}
          >
            <FlexRow gap="sm" align="start">
              <Icon
                name="check-circle"
                size="md"
                color={theme.colors.success}
              />
              <View style={{ flex: 1 }}>
                <Text size="sm" weight="semibold" color={theme.colors.success}>
                  Authentication Complete!
                </Text>
                <Text size="sm" style={{ marginTop: 4 }}>
                  User: {user.displayName} ({user.address?.substring(0, 8)}...)
                </Text>
                <Button
                  type="secondary"
                  size="small"
                  onClick={handleResetFlow}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                >
                  Reset Flow
                </Button>
              </View>
            </FlexRow>
          </View>
        )}

        <View
          style={{
            backgroundColor: theme.colors.info + '20',
            borderColor: theme.colors.info,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginTop: 20,
          }}
        >
          <FlexRow gap="sm" align="start">
            <Icon name="info-circle" size="md" color={theme.colors.info} />
            <View style={{ flex: 1 }}>
              <Text size="sm" weight="semibold" color={theme.colors.info}>
                Implementation Status
              </Text>
              <Text size="sm" style={{ marginTop: 4 }}>
                ✅ Complete Login → Onboarding flow
              </Text>
              <Text size="sm">✅ Step indicator and progress tracking</Text>
              <Text size="sm">✅ Responsive layout with proper centering</Text>
              <Text size="sm" style={{ marginTop: 4 }}>
                🚧 SDK integration pending for full functionality
              </Text>
            </View>
          </FlexRow>
        </View>
      </FlexColumn>
    </Container>
  );

  const renderLogin = () => {
    // If user is already set (completed onboarding), show success
    if (user) {
      return (
        <Container padding={20}>
          <FlexColumn gap="md">
            <Text size="lg" weight="bold" align="center">
              Welcome to Quorum! 🎉
            </Text>
            <Text size="md" align="center">
              Authentication flow completed successfully
            </Text>
            <Text size="sm" variant="subtle" align="center">
              User: {user.displayName}
            </Text>
            <Button type="primary" onClick={handleResetFlow}>
              Start Over
            </Button>
            <Button type="secondary" onClick={() => setCurrentView('menu')}>
              Back to Menu
            </Button>
          </FlexColumn>
        </Container>
      );
    }

    // Show Login component
    return (
      <Login
        setUser={setUser}
        onNavigateToOnboarding={() => setCurrentView('onboarding')}
      />
    );
  };

  const renderOnboarding = () => {
    // If user is already set (completed onboarding), show success
    if (user) {
      return (
        <Container padding={20}>
          <FlexColumn gap="md">
            <Text size="lg" weight="bold" align="center">
              Welcome to Quorum! 🎉
            </Text>
            <Text size="md" align="center">
              Onboarding completed successfully
            </Text>
            <Text size="sm" variant="subtle" align="center">
              User: {user.displayName}
            </Text>
            <Button type="primary" onClick={handleResetFlow}>
              Start Over
            </Button>
            <Button type="secondary" onClick={() => setCurrentView('menu')}>
              Back to Menu
            </Button>
          </FlexColumn>
        </Container>
      );
    }

    // Show Onboarding component
    return <Onboarding setUser={setUser} />;
  };

  return (
    <>
      {currentView === 'menu' && (
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
            {renderMenu()}
          </ScrollView>
        </SafeAreaView>
      )}
      {currentView === 'login' && renderLogin()}
      {currentView === 'onboarding' && renderOnboarding()}
    </>
  );
};

// Updated: August 9, 2025 at 3:45 PM
