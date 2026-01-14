import React, { useState } from 'react';
import { Container, Flex, Text, Button } from '@/components/primitives';
import { Onboarding } from '@/components/onboarding/Onboarding.native';
import {
  AuthScreenWrapper,
  AuthTitle,
  AuthContent,
  AuthSpacer,
} from '@/components/onboarding/OnboardingStyles.native';

// Mock user type for testing
type User = {
  displayName: string;
  state: string;
  status: string;
  userIcon: string;
  address: string;
};

export const OnboardingTestScreen: React.FC = () => {
  const [user, setUser] = useState<User | undefined>();
  const [showOnboarding, setShowOnboarding] = useState(true);

  const resetOnboarding = () => {
    setUser(undefined);
    setShowOnboarding(true);
  };

  // Show onboarding in full-screen mode for accurate testing
  if (showOnboarding && !user) {
    return <Onboarding setUser={setUser} />;
  }

  // Success screen using the same styling as auth components
  return (
    <AuthScreenWrapper>
      <AuthSpacer />

      <AuthTitle>Onboarding Complete! 🎉</AuthTitle>

      {user && (
        <AuthContent centerContent>
          <Flex direction="column" gap="md" align="center">
            <Text
              size="lg"
              weight="medium"
              style={{ color: 'white', textAlign: 'center' }}
            >
              Welcome, {user.displayName}!
            </Text>
            <Text
              size="sm"
              style={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' }}
            >
              Address: {user.address}
            </Text>
            <Text
              size="sm"
              style={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' }}
            >
              Status: {user.status}
            </Text>
          </Flex>
        </AuthContent>
      )}

      <AuthContent centerContent>
        <Button
          type="primary-white"
          style={{ paddingHorizontal: 32, width: '100%', maxWidth: 320 }}
          onClick={resetOnboarding}
        >
          Test Onboarding Again
        </Button>
      </AuthContent>

      <AuthSpacer />
    </AuthScreenWrapper>
  );
};
