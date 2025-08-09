import React, { useState, useCallback } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  Text,
  Input,
  Button,
  Icon,
  FileUpload,
  useTheme,
} from '@/components/primitives';
// Use direct imports to avoid barrel export chain loading problematic hooks
import { useOnboardingFlow } from '@/hooks/business/user/useOnboardingFlow';
import { useKeyBackup } from '@/hooks/useKeyBackup';
import { useUploadRegistration } from '@/hooks/mutations/useUploadRegistration';
import { useQuorumApiClient } from '@/components/context/QuorumApiContext';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { DefaultImages } from '@/utils';
import { StyleSheet } from 'react-native';

interface OnboardingProps {
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
}

export const Onboarding: React.FC<OnboardingProps> = ({ setUser }) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // API context
  const { apiClient } = useQuorumApiClient();
  const uploadRegistration = useUploadRegistration();

  // Business logic hooks
  const onboardingFlow = useOnboardingFlow();
  const keyBackup = useKeyBackup();

  // TODO: When real SDK is integrated for React Native:
  // 1. Import PasskeyModal from the SDK (once it's compatible with React Native)
  // 2. Add PasskeyModal component at the top of the render tree (like web version)
  // 3. Remove manual uploadRegistration call from handleSaveDisplayName
  // 4. Let PasskeyModal handle getUserRegistration and uploadRegistration automatically
  // 
  // Current implementation uses SDK shim and manual registration as a temporary solution
  // See: .readme/tasks/todo/mobile-sdk-integration-issue.md for full SDK integration plan

  // FileUpload state management
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  const maxImageSize = 2 * 1024 * 1024; // 2MB

  // Handle file upload
  const handleFilesSelected = useCallback((files: any[]) => {
    if (files.length > 0) {
      const file = files[0];
      setProfileImage(file.uri);
      setFileError(null);
    }
  }, []);

  const handleFileError = useCallback((error: Error) => {
    setFileError(error.message);
    setProfileImage(null);
  }, []);

  // Get image data URL for saving
  const getImageDataUrl = useCallback((): string | null => {
    return profileImage;
  }, [profileImage]);

  // Validation helpers
  const hasValidFile = !!profileImage;

  // Handle key download and mark as exported
  const handleDownloadKey = async () => {
    try {
      await keyBackup.downloadKey();
      onboardingFlow.markKeyAsExported();
    } catch (error) {
      console.error('Error downloading key:', error);
    }
  };

  // Handle "I already saved mine" without confirmation
  const handleAlreadySaved = () => {
    onboardingFlow.markKeyAsExported();
  };

  // Handle display name save with user registration
  // NOTE: This manual registration is a temporary solution while using SDK shim
  // The web version handles this automatically through PasskeyModal
  // TODO: Remove this manual registration once PasskeyModal is available for React Native
  const handleSaveDisplayName = async () => {
    try {
      // Manually register user with the API (normally handled by PasskeyModal)
      if (onboardingFlow.currentPasskeyInfo) {
        await uploadRegistration({
          address: onboardingFlow.currentPasskeyInfo.address,
          registration: {
            username: onboardingFlow.displayName,
            address: onboardingFlow.currentPasskeyInfo.address,
            publicKey: onboardingFlow.currentPasskeyInfo.publicKey,
          },
        });
      }
      // Save to local state
      onboardingFlow.saveDisplayName();
    } catch (error) {
      console.error('Error saving display name:', error);
      // TODO: Add proper error handling UI when SDK is integrated
    }
  };

  // Handle profile photo save
  const handleSavePhoto = () => {
    const dataUrl = getImageDataUrl();
    onboardingFlow.saveProfilePhoto(dataUrl || undefined);
  };

  // Get current step title
  const getStepTitle = () => {
    switch (onboardingFlow.currentStep) {
      case 'key-backup':
        return t`Welcome to Quorum!`;
      case 'display-name':
        return t`Personalize your account`;
      case 'profile-photo':
        return onboardingFlow.currentPasskeyInfo?.pfpUrl && onboardingFlow.currentPasskeyInfo.displayName
          ? t`One of us, one of us!`
          : t`Personalize your account`;
      case 'complete':
        return t`You're all set!`;
      default:
        return t`Welcome to Quorum!`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TODO: Add PasskeyModal here once SDK is React Native compatible
          <PasskeyModal
            fqAppPrefix="Quorum"
            getUserRegistration={async (address) => (await apiClient.getUser(address)).data}
            uploadRegistration={uploadRegistration}
          />
      */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Container padding="lg" style={styles.titleSection}>
          <Text 
            size="2xl" 
            weight="semibold" 
            variant="strong" 
            align="center"
          >
            {getStepTitle()}
          </Text>
        </Container>

        {/* Key Backup Step */}
        {onboardingFlow.currentStep === 'key-backup' && (
          <Container padding="lg" style={styles.stepContainer}>
            <FlexColumn gap="lg">
              {/* Information Text */}
              <FlexColumn gap="md">
                <Text weight="semibold" variant="strong">
                  <Trans>Important first-time user information:</Trans>
                </Text>
                
                <Text variant="default">
                  <Trans>
                    Quorum is peer-to-peer and end-to-end encrypted. This means your messages stay private, but equally important, they only live on the network for the time required to reach you and your recipients.
                  </Trans>
                </Text>
                
                <Text variant="default">
                  <Trans>
                    If you uninstall the app from your device, you will lose your old messages and keys.
                  </Trans>
                </Text>
                
                <Text variant="default">
                  <Trans>
                    Click the button below to create a backup of your key info, because once it's gone, it's gone forever. You may be prompted to authenticate again.
                  </Trans>
                </Text>
              </FlexColumn>

              {/* Action Buttons */}
              <FlexColumn gap="md" align="stretch">
                <Button
                  type="primary"
                  onClick={handleDownloadKey}
                >
                  {t`Save User Key`}
                </Button>
                
                <Pressable onPress={handleAlreadySaved} style={styles.linkButton}>
                  <Text 
                    size="sm" 
                    variant="subtle" 
                    align="center"
                    style={styles.linkText}
                  >
                    <Trans>I already saved mine</Trans>
                  </Text>
                </Pressable>
              </FlexColumn>
            </FlexColumn>
          </Container>
        )}

        {/* Display Name Step */}
        {onboardingFlow.currentStep === 'display-name' && (
          <Container padding="lg" style={styles.stepContainer}>
            <FlexColumn gap="lg">
              {/* Information Text */}
              <FlexColumn gap="md">
                <Text variant="default" align="center">
                  <Trans>
                    Let your friends know who you are! Pick a friendly name to
                    display in your conversations, something easier to read than:
                  </Trans>
                </Text>
                
                <Container 
                  padding="md" 
                  style={styles.addressDisplay}
                >
                  <Text 
                    size="sm" 
                    variant="muted" 
                    style={styles.addressText}
                    numberOfLines={3}
                  >
                    {onboardingFlow.currentPasskeyInfo?.address}
                  </Text>
                </Container>
                
                <Text size="sm" variant="subtle" align="center">
                  <Trans>This information is only provided to the Spaces you join.</Trans>
                </Text>
              </FlexColumn>

              {/* Input and Button */}
              <FlexColumn gap="md" align="stretch">
                <Input
                  value={onboardingFlow.displayName}
                  onChangeText={onboardingFlow.setDisplayName}
                  placeholder="Bongocat"
                  style={styles.nameInput}
                />
                
                <Button
                  type="primary"
                  disabled={!onboardingFlow.canProceedWithName}
                  onClick={handleSaveDisplayName}
                >
                  <Trans>Set Display Name</Trans>
                </Button>
              </FlexColumn>
            </FlexColumn>
          </Container>
        )}

        {/* Profile Photo Step */}
        {onboardingFlow.currentStep === 'profile-photo' && (
          <Container padding="lg" style={styles.stepContainer}>
            <FlexColumn gap="lg" align="center">
              {/* Information Text */}
              <FlexColumn gap="md">
                <Text variant="default" align="center">
                  <Trans>
                    Make your account uniquely yours – set a contact photo. This information is only provided to the Spaces you join.
                  </Trans>
                </Text>
                
                <Text size="sm" variant="subtle" align="center">
                  <Trans>
                    Your profile image size must be {maxImageSize / 1024 / 1024}MB or less and must be a PNG, JPG, or JPEG file extension.
                  </Trans>
                </Text>
                
                {fileError && (
                  <Container 
                    padding="sm" 
                    style={styles.errorContainer}
                  >
                    <Text variant="error" size="sm" align="center">
                      {fileError}
                    </Text>
                  </Container>
                )}
              </FlexColumn>

              {/* Profile Image Display/Selector */}
              <FileUpload
                onFilesSelected={handleFilesSelected}
                onError={handleFileError}
                accept={{
                  'image/png': ['.png'],
                  'image/jpeg': ['.jpg', '.jpeg'],
                }}
                maxSize={maxImageSize}
                multiple={false}
                showCameraOption={true}
                allowsEditing={true}
              >
                <Container style={styles.imageSelector}>
                  <Image
                    source={{ 
                      uri: getImageDataUrl() || DefaultImages.UNKNOWN_USER 
                    }}
                    style={styles.profileImage}
                    contentFit="cover"
                    placeholder={DefaultImages.UNKNOWN_USER}
                  />
                  
                  {!hasValidFile && (
                    <Container style={styles.imageOverlay}>
                      <Icon 
                        name="file-image" 
                        size="lg" 
                        color={theme.colors.text.onAccent}
                      />
                      <Text 
                        size="sm" 
                        variant="strong" 
                        align="center"
                        color={theme.colors.text.onAccent}
                      >
                        <Trans>Tap to select</Trans>
                      </Text>
                    </Container>
                  )}
                </Container>
              </FileUpload>

              {/* Action Buttons */}
              <FlexColumn gap="md" align="stretch" style={styles.photoButtons}>
                <Button
                  type="primary"
                  disabled={fileError !== null}
                  onClick={handleSavePhoto}
                >
                  {hasValidFile ? t`Save Contact Photo` : t`Use Default Photo`}
                </Button>
                
                {hasValidFile && (
                  <Button
                    type="secondary"
                    onClick={handleSavePhoto}
                  >
                    <Trans>Skip Adding Photo</Trans>
                  </Button>
                )}
              </FlexColumn>
            </FlexColumn>
          </Container>
        )}

        {/* Complete Step */}
        {onboardingFlow.currentStep === 'complete' && (
          <Container padding="lg" style={styles.stepContainer}>
            <FlexColumn gap="lg" align="center">
              <Text variant="default" align="center">
                <Trans>You're all set. Welcome to Quorum!</Trans>
              </Text>
              
              <Button
                type="primary"
                onClick={() => onboardingFlow.completeOnboarding(setUser)}
              >
                <Trans>Let's gooooooooo</Trans>
              </Button>
            </FlexColumn>
          </Container>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  } as any,
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    paddingVertical: theme.spacing?.xl || 24,
  } as any,
  titleSection: {
    marginBottom: theme.spacing?.lg || 16,
  } as any,
  stepContainer: {
    backgroundColor: theme.colors.surface?.[2] || '#f5f5f5',
    marginHorizontal: theme.spacing?.md || 12,
    borderRadius: theme.borderRadius?.lg || 12,
  } as any,
  addressDisplay: {
    backgroundColor: theme.colors.surface?.[4] || '#e0e0e0',
    borderRadius: theme.borderRadius?.md || 8,
  } as any,
  addressText: {
    textAlign: 'center' as const,
  } as any,
  nameInput: {
    backgroundColor: theme.colors.surface?.[0] || '#ffffff',
  } as any,
  linkButton: {
    paddingVertical: theme.spacing?.sm || 8,
  } as any,
  linkText: {
    textDecorationLine: 'underline' as const,
  } as any,
  errorContainer: {
    backgroundColor: (theme.colors.utilities?.danger || '#ef4444') + '20',
    borderColor: theme.colors.utilities?.danger || '#ef4444',
    borderWidth: 1,
    borderRadius: theme.borderRadius?.sm || 4,
  } as any,
  imageSelector: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.surface?.[3] || '#d0d0d0',
  } as any,
  profileImage: {
    width: 200,
    height: 200,
  } as any,
  imageOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: (theme.colors.accent?.DEFAULT || '#3b82f6') + '80',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  } as any,
  photoButtons: {
    width: 300,
  } as any,
});