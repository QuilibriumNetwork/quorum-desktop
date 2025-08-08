import React from 'react';
import { ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Container,
  FlexColumn,
  FlexRow,
  FlexBetween,
  Text,
  Input,
  Button,
  Icon,
} from '@/primitives';
import { useTheme } from '@/primitives/theme';
import {
  useOnboardingFlow,
  useWebKeyBackup,
  useWebFileUpload,
} from '@/hooks';
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

  // Business logic hooks
  const onboardingFlow = useOnboardingFlow();
  const keyBackup = useWebKeyBackup();
  const fileUpload = useWebFileUpload();

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

  // Handle profile photo save
  const handleSavePhoto = () => {
    const dataUrl = fileUpload.getImageDataUrl();
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
                  disabled={keyBackup.isDownloading}
                >
                  {keyBackup.isDownloading ? t`Saving...` : t`Save User Key`}
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
                  onClick={onboardingFlow.saveDisplayName}
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
                    Your profile image size must be {fileUpload.maxImageSize / 1024 / 1024}MB or less and must be a PNG, JPG, or JPEG file extension.
                  </Trans>
                </Text>
                
                {fileUpload.fileError && (
                  <Container 
                    padding="sm" 
                    style={styles.errorContainer}
                  >
                    <Text variant="error" size="sm" align="center">
                      {fileUpload.fileError}
                    </Text>
                  </Container>
                )}
              </FlexColumn>

              {/* Profile Image Display/Selector */}
              <Pressable 
                onPress={fileUpload.showImagePicker}
                style={styles.imageSelector}
                disabled={fileUpload.isSelecting}
              >
                <Image
                  source={{ 
                    uri: fileUpload.getImageDataUrl() || DefaultImages.UNKNOWN_USER 
                  }}
                  style={styles.profileImage}
                />
                
                {!fileUpload.hasValidFile && (
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
              </Pressable>

              {/* Action Buttons */}
              <FlexColumn gap="md" align="stretch" style={styles.photoButtons}>
                <Button
                  type="primary"
                  disabled={fileUpload.fileError !== null}
                  onClick={handleSavePhoto}
                >
                  {fileUpload.hasValidFile ? t`Save Contact Photo` : t`Use Default Photo`}
                </Button>
                
                {fileUpload.hasValidFile && (
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  titleSection: {
    marginBottom: theme.spacing.lg,
  },
  stepContainer: {
    backgroundColor: theme.colors.surface[2],
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  addressDisplay: {
    backgroundColor: theme.colors.surface[4],
    borderRadius: theme.borderRadius.md,
  },
  addressText: {
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: theme.colors.surface[0],
  },
  linkButton: {
    paddingVertical: theme.spacing.sm,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  errorContainer: {
    backgroundColor: theme.colors.utilities.danger + '20',
    borderColor: theme.colors.utilities.danger,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
  },
  imageSelector: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface[3],
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent.DEFAULT + '80',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  photoButtons: {
    width: '100%',
    maxWidth: 300,
  },
});