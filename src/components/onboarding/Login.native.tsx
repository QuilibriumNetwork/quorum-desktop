import React from 'react';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import {
  Button,
  Container,
  FlexRow,
  FlexColumn,
  Spacer,
} from '@/components/primitives';
import {
  AuthScreenWrapper,
  AuthSpacer,
  AUTH_LAYOUT,
} from './OnboardingStyles.native';
// Use direct imports to avoid barrel export chain loading problematic hooks
import { useAuthenticationFlow } from '@/hooks/business/user/useAuthenticationFlow';
import { t } from '@lingui/core/macro';

interface LoginProps {
  setUser: React.Dispatch<
    React.SetStateAction<
      | {
          displayName: string;
          state: string;
          status: string;
          userIcon: string;
          address: string;
        }
      | undefined
    >
  >;
  onNavigateToOnboarding?: () => void;
}

export const Login: React.FC<LoginProps> = ({
  setUser,
  onNavigateToOnboarding,
}) => {
  // Business logic hook - shared with web version
  const authFlow = useAuthenticationFlow();

  // TODO: When real SDK is integrated for React Native:
  // 1. Import PasskeyModal from the SDK (once it's compatible with React Native)
  // 2. Add PasskeyModal component at the top of the render tree (like web version)
  // 3. Remove manual navigation and let PasskeyModal handle authentication automatically
  // 4. Connect setShowPasskeyPrompt to trigger the modal
  //
  // Current implementation uses manual navigation to onboarding as temporary solution
  // See: .agents/tasks/todo/mobile-dev/sdk-shim-temporary-solutions.md for full SDK integration plan

  const handleCreateNewAccount = () => {
    authFlow.startNewAccount();
    // TODO: When SDK is integrated, trigger PasskeyModal like web version:
    // setShowPasskeyPrompt({ value: true });
    // For now, navigate to onboarding manually
    onNavigateToOnboarding?.();
  };

  const handleImportExistingKey = () => {
    authFlow.startImportAccount();
    // TODO: When SDK is integrated, trigger PasskeyModal like web version:
    // setShowPasskeyPrompt({ value: true, importMode: true });
    // For now, navigate to onboarding manually
    onNavigateToOnboarding?.();
  };

  return (
    <AuthScreenWrapper>
      {/* TODO: Add PasskeyModal here once SDK is React Native compatible
            <PasskeyModal
              fqAppPrefix="Quorum"
              getUserRegistration={authFlow.getUserRegistration}
              uploadRegistration={authFlow.uploadRegistration}
            />
        */}

      <AuthSpacer />

      {/* Logo Section - using FlexRow with justify prop */}
      <FlexRow justify="center">
        <Image
          style={{ height: 64, width: 280 }}
          source={require('../../../mobile/assets/quorum.png')}
          contentFit="contain"
        />
      </FlexRow>

      {/* Spacer between logo and buttons */}
      <Spacer size="xl" />

      {/* Buttons Section - using FlexRow and Container with props */}
      <FlexRow justify="center">
        <Container
          width="full"
          maxWidth={AUTH_LAYOUT.MAX_CONTENT_WIDTH}
          padding={AUTH_LAYOUT.PADDING}
        >
          <FlexColumn gap="lg">
            {/* Create New Account Button */}
            <Button
              type="primary-white"
              fullWidthWithMargin
              onClick={handleCreateNewAccount}
            >
              {t`Create New Account`}
            </Button>

            {/* Import Existing Key Button */}
            <Button
              type="light-outline-white"
              fullWidthWithMargin
              onClick={handleImportExistingKey}
            >
              {t`Import Existing Key`}
            </Button>
          </FlexColumn>
        </Container>
      </FlexRow>

      <AuthSpacer />
    </AuthScreenWrapper>
  );
};
