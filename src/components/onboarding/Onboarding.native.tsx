import React, { useState, useCallback, useEffect } from 'react';
import { Pressable, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Image } from 'expo-image';
import {
  Container,
  Text,
  Title,
  Paragraph,
  Input,
  Button,
  Icon,
  FileUpload,
} from '@/components/primitives';
import {
  AuthScreenWrapper,
  AuthTitle,
  AuthContent,
  AuthSpacer,
  AUTH_TEXT_STYLES,
  AUTH_CONTAINER_STYLES,
} from '../OnboardingStyles.native';
// Use direct imports to avoid barrel export chain loading problematic hooks
import { useOnboardingFlow } from '@/hooks/business/user/useOnboardingFlow';
import { useKeyBackup } from '@/hooks/useKeyBackup';
// TODO: Re-enable when PasskeyModal is available for React Native
// import { useUploadRegistration } from '@/hooks/mutations/useUploadRegistration';
// import { useQuorumApiClient } from '@/components/context/QuorumApiContext';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { DefaultImages } from '@/utils';

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

  // TODO: Re-enable API context when PasskeyModal is available for React Native
  // const { apiClient } = useQuorumApiClient();
  // const uploadRegistration = useUploadRegistration();

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
  const [isDragActive, setIsDragActive] = useState(false);
  
  const maxImageSize = 2 * 1024 * 1024; // 2MB
  
  // Keyboard handling
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

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
  const canSaveFile = hasValidFile && !fileError;

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
  // NOTE: This is a temporary solution while using SDK shim
  // The web version handles this automatically through PasskeyModal which also handles uploadRegistration
  // TODO: When PasskeyModal is available for React Native, remove this simplified version
  // and let PasskeyModal handle the registration automatically like the web version does
  const handleSaveDisplayName = async () => {
    try {
      // TODO: Manual API registration will be added once we determine the correct
      // UserRegistration interface structure from the real SDK
      // For now, just save to local state - registration will happen when full SDK is integrated
      console.warn('[Mobile] Skipping API user registration - will be handled by PasskeyModal when SDK is integrated');
      
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


  // Drag overlay component
  const dragOverlay = isDragActive ? (
    <Container style={AUTH_CONTAINER_STYLES.dragOverlay}>
      <Container style={AUTH_CONTAINER_STYLES.dragContent}>
        <Icon name="file-image" size="5xl" style={{ color: '#3b82f6', marginBottom: 24 }} />
        <Text size="xl" weight="semibold" style={{ color: '#111827' }}>
          {t`Drop your profile photo here`}
        </Text>
        <Text size="sm" style={{ color: '#6b7280', marginTop: 8 }}>
          {t`PNG, JPG or JPEG • Max 2MB`}
        </Text>
      </Container>
    </Container>
  ) : null;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <AuthScreenWrapper dragOverlay={dragOverlay}>
        {/* TODO: Add PasskeyModal here once SDK is React Native compatible
            <PasskeyModal
              fqAppPrefix="Quorum"
              getUserRegistration={async (address) => (await apiClient.getUser(address)).data}
              uploadRegistration={uploadRegistration}
            />
        */}
        
        <AuthSpacer />
      
      {/* Title Section - Only show for non-key-backup steps since key-backup has its own title */}
      {onboardingFlow.currentStep !== 'key-backup' && (
        <AuthTitle>
          {onboardingFlow.currentPasskeyInfo?.pfpUrl && onboardingFlow.currentPasskeyInfo.displayName
            ? t`One of us, one of us!`
            : t`Personalize your account`}
        </AuthTitle>
      )}
              
      {/* Key Backup Step */}
      {onboardingFlow.currentStep === 'key-backup' && (
        <>
          <AuthContent>
            {/* Title using Title helper */}
            <Title size="xl" align="center" color="white">
              {t`Welcome to Quorum!`}
            </Title>
            
            {/* Paragraph 1: Important information header */}
            <Paragraph weight="semibold" color="white" align="center">
              {t`Important first-time user information:`}
            </Paragraph>
            
            {/* Paragraph 2: P2P encryption explanation */}
            <Paragraph color="white" align="center">
              {t`Quorum is peer-to-peer and end-to-end encrypted. This means your messages stay private, but equally important, they only live on the network for the time required to reach you and your recipients.`}
            </Paragraph>
            
            {/* Paragraph 3: Device-specific warning */}
            <Paragraph weight="semibold" color="white" align="center">
              {t`If you uninstall the app from your device, you will lose your old messages and keys.`}
            </Paragraph>
            
            {/* Paragraph 4: Action instruction */}
            <Paragraph color="white" align="center">
              {t`Click the button below to create a backup of your key info, because once it's gone, it's gone forever. You may be prompted to authenticate again.`}
            </Paragraph>
          </AuthContent>
          
          <AuthContent>
            {/* Full width Save User Key button */}
            <Button
              type="primary-white"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={handleDownloadKey}
            >
              {t`Save User Key`}
            </Button>
            
            {/* More space above the link - centered */}
            <Container style={{ paddingTop: 48, alignItems: 'center' }}>
              <Pressable onPress={handleAlreadySaved}>
                <Text size="sm" style={AUTH_TEXT_STYLES.link}>
                  {t`I already saved mine`}
                </Text>
              </Pressable>
            </Container>
          </AuthContent>
        </>
      )}
              
      {/* Display Name Step */}
      {onboardingFlow.currentStep === 'display-name' && (
        <>
          <AuthContent>
            {/* Title - matching web version */}
            <Title size="lg" align="center" color="white">
              {t`Personalize your account`}
            </Title>
            
            {/* Instruction paragraph */}
            <Paragraph color="white" align="center">
              <Trans>
                Let your friends know who you are! Pick a friendly name to
                display in your conversations, something easier to read
                than:
              </Trans>
            </Paragraph>
            
            {/* Address display */}
            <Container style={AUTH_CONTAINER_STYLES.addressDisplay}>
              <Text size="sm" style={{ ...AUTH_TEXT_STYLES.address, flexWrap: 'wrap' }}>
                {onboardingFlow.currentPasskeyInfo?.address}
              </Text>
            </Container>
            
            {/* Disclaimer paragraph */}
            <Paragraph color="white" align="center">
              {t`This information is only provided to the Spaces you join.`}
            </Paragraph>
          </AuthContent>
          
          <AuthContent>
            {/* Input field with onboarding variant - pill shape, white bg */}
            <Input
              variant="onboarding"
              style={{ width: '100%', marginBottom: 16 }}
              value={onboardingFlow.displayName}
              onChange={onboardingFlow.setDisplayName}
              placeholder="Bongocat"
            />
            
            {/* Button with proper disabled state for onboarding */}
            <Button
              type={!onboardingFlow.canProceedWithName ? "disabled-onboarding" : "primary-white"}
              disabled={!onboardingFlow.canProceedWithName}
              style={{ width: '100%' }}
              onClick={handleSaveDisplayName}
            >
              {t`Set Display Name`}
            </Button>
          </AuthContent>
        </>
      )}
              
      {/* Profile Photo Step */}
      {onboardingFlow.currentStep === 'profile-photo' && (
        <>
          <AuthContent>
            {/* Title - matching web version */}
            <Title size="lg" align="center" color="white">
              {t`Personalize your account`}
            </Title>
            
            {/* Instruction paragraph */}
            <Paragraph color="white" align="center">
              <Trans>
                Make your account uniquely yours – set a contact photo. This information is only provided to the Spaces you join.
              </Trans>
            </Paragraph>
            
            {/* Size requirement paragraph */}
            <Paragraph size="sm" color="white" align="center">
              <Trans>
                Your profile image size must be 2MB or less and must be a PNG, JPG, or JPEG file extension.
              </Trans>
            </Paragraph>
            
            {/* Error display */}
            {fileError && (
              <Container style={AUTH_CONTAINER_STYLES.errorContainer}>
                <Paragraph size="sm" color="#ef4444" align="center">
                  {fileError}
                </Paragraph>
              </Container>
            )}
          </AuthContent>
          
          <AuthContent centerContent>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              onError={handleFileError}
              accept={{
                'image/png': ['.png'],
                'image/jpeg': ['.jpg', '.jpeg'],
              }}
              maxSize={maxImageSize}
              multiple={false}
              {...({ onDragActiveChange: setIsDragActive } as any)}
            >
              <Container style={{ 
                width: 200, 
                height: 200, 
                borderRadius: 100, 
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <Image
                  style={{ width: 200, height: 200 }}
                  source={{ uri: getImageDataUrl() || DefaultImages.UNKNOWN_USER }}
                  contentFit="cover"
                />
                
                {/* Tap overlay when no image selected */}
                {!hasValidFile && (
                  <Container style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Icon 
                      name="file-image" 
                      size="xl" 
                      style={{ color: 'white', marginBottom: 8 }}
                    />
                    <Paragraph size="sm" weight="semibold" color="white" align="center">
                      {t`Tap to select`}
                    </Paragraph>
                  </Container>
                )}
              </Container>
            </FileUpload>
          </AuthContent>
          
          <AuthContent centerContent>
            <Container style={{ alignItems: 'center', width: '100%' }}>
              {/* Skip button - only show when no file selected */}
              {!hasValidFile && (
                <Button
                  type="light-outline-white"
                  style={{ paddingHorizontal: 32 }}
                  onClick={handleSavePhoto}
                >
                  {t`Skip Adding Photo`}
                </Button>
              )}
              
              {/* Save button - only show when file is selected */}
              {hasValidFile && (
                <Button
                  type="primary-white"
                  disabled={!canSaveFile}
                  style={{
                    paddingHorizontal: 32,
                    width: '100%',
                    opacity: !canSaveFile ? 0.5 : 1
                  }}
                  onClick={handleSavePhoto}
                >
                  {t`Save Contact Photo`}
                </Button>
              )}
            </Container>
          </AuthContent>
        </>
      )}
              
      {/* Complete Step */}
      {onboardingFlow.currentStep === 'complete' && (
        <>
          <AuthContent>
            {/* Title - conditional based on user data like web version */}
            <Title size="lg" align="center" color="white">
              {onboardingFlow.currentPasskeyInfo?.pfpUrl && onboardingFlow.currentPasskeyInfo.displayName
                ? t`One of us, one of us!`
                : t`Personalize your account`}
            </Title>
            
            {/* Welcome message */}
            <Paragraph color="white" align="center">
              {t`You're all set. Welcome to Quorum!`}
            </Paragraph>
          </AuthContent>
          
          <AuthContent centerContent>
            <Button
              type="primary-white"
              style={{ width: '100%' }}
              onClick={() => onboardingFlow.completeOnboarding(setUser)}
            >
              {t`Let's gooooooooo`}
            </Button>
          </AuthContent>
        </>
      )}
      
        <AuthSpacer />
      </AuthScreenWrapper>
    </KeyboardAvoidingView>
  );
};

