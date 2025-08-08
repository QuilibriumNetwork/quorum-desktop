import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container, FlexColumn, Text, Button } from '@/primitives';
import { useTheme } from '@/primitives/theme';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';
import { Onboarding } from '@/components/onboarding/Onboarding.native';

// Mock user type for testing
type User = {
  displayName: string;
  state: string;
  status: string;
  userIcon: string;
  address: string;
};

export const OnboardingTestScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [user, setUser] = useState<User | undefined>();
  const [showOnboarding, setShowOnboarding] = useState(true);

  const resetOnboarding = () => {
    setUser(undefined);
    setShowOnboarding(true);
  };

  if (showOnboarding && !user) {
    return (
      <Onboarding setUser={setUser} />
    );
  }

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
        <Container padding="lg" style={themedStyles.card}>
          <FlexColumn gap="lg" align="center">
            <Text size="2xl" weight="bold">
              Onboarding Complete! 🎉
            </Text>
            
            {user && (
              <FlexColumn gap="md" align="center">
                <Text size="lg" weight="medium">
                  Welcome, {user.displayName}!
                </Text>
                <Text size="sm" variant="subtle">
                  Address: {user.address}
                </Text>
                <Text size="sm" variant="subtle">
                  Status: {user.status}
                </Text>
              </FlexColumn>
            )}
            
            <Button
              type="secondary"
              onClick={resetOnboarding}
            >
              Test Onboarding Again
            </Button>
          </FlexColumn>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
};