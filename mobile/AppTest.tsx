import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/primitives/theme';
import { I18nProvider } from '@lingui/react';
import { i18n, initializeMobileI18n } from './i18n';
import { PasskeysProvider } from '@quilibrium/quilibrium-js-sdk-channels';
import { default as Button } from '@/primitives/Button';
import {
  commonTestStyles,
  createThemedStyles,
} from '@/styles/commonTestStyles';
// Import main menu
import { MainMenuScreen } from '@/test/MainMenuScreen';

// Import primitive test screens
import {
  PrimitivesMenuScreen,
  PrimitivesTestScreen,
  TextTestScreen,
  InputTestScreen,
  TextAreaTestScreen,
  SimpleButtonTestScreen,
  SwitchTestScreen,
  ModalTestScreen,
  SelectTestScreen,
  ColorSwatchTestScreen,
  RadioGroupTestScreen,
  TooltipTestScreen,
  IconTestScreen,
  CalloutTestScreen,
  FileUploadTestScreen,
  ScrollContainerTestScreen,
} from '@/test/primitives';

// Import business component test screens
import {
  BusinessMenuScreen,
  AuthenticationTestScreen,
  OnboardingTestScreen,
  LoginTestScreen,
  MaintenanceTestScreen,
  ClickToCopyTestScreen,
  ModalsTestScreen,
  MessageComposerTestScreen,
  IconPickerTestScreen,
} from '@/test/business';

type Section = 'main' | 'primitives' | 'business';
type PrimitiveScreen =
  | 'list'
  | 'basic'
  | 'text'
  | 'input'
  | 'textarea'
  | 'button'
  | 'switch'
  | 'modal'
  | 'select'
  | 'colorswatch'
  | 'radiogroup'
  | 'tooltip'
  | 'icon'
  | 'fileupload'
  | 'scrollcontainer';
type BusinessScreen =
  | 'list'
  | 'onboarding'
  | 'auth'
  | 'login'
  | 'maintenance'
  | 'copy'
  | 'modals'
  | 'spaces'
  | 'channel'
  | 'direct'
  | 'settings'
  | 'search'
  | 'messagecomposer'
  | 'iconpicker';

// Themed App Content (must be inside ThemeProvider)
function ThemedAppContent() {
  const [currentSection, setCurrentSection] = useState<Section>('main');
  const [currentPrimitiveScreen, setCurrentPrimitiveScreen] =
    useState<PrimitiveScreen>('list');
  const [currentBusinessScreen, setCurrentBusinessScreen] =
    useState<BusinessScreen>('list');
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  const renderBackButton = () => {
    if (currentSection === 'main') return null;

    const isOnList =
      (currentSection === 'primitives' && currentPrimitiveScreen === 'list') ||
      (currentSection === 'business' && currentBusinessScreen === 'list');

    const buttonText = isOnList
      ? 'Back to Main Menu'
      : currentSection === 'primitives'
        ? 'Back to Primitives'
        : 'Back to Business';

    const handleBack = () => {
      if (isOnList) {
        setCurrentSection('main');
      } else if (currentSection === 'primitives') {
        setCurrentPrimitiveScreen('list');
      } else {
        setCurrentBusinessScreen('list');
      }
    };

    return (
      <View style={themedStyles.backBar}>
        <View style={commonTestStyles.backButtonContainer}>
          <Button type="secondary" iconName="arrow-left" onClick={handleBack}>
            {buttonText}
          </Button>
        </View>
      </View>
    );
  };

  const handleSelectSection = (section: 'primitives' | 'business') => {
    setCurrentSection(section);
    if (section === 'primitives') {
      setCurrentPrimitiveScreen('list');
    } else {
      setCurrentBusinessScreen('list');
    }
  };

  const handleSelectPrimitive = (screen: string) => {
    setCurrentPrimitiveScreen(screen as PrimitiveScreen);
  };

  const handleSelectBusiness = (screen: string) => {
    setCurrentBusinessScreen(screen as BusinessScreen);
  };

  const renderScreen = () => {
    // Main menu
    if (currentSection === 'main') {
      return <MainMenuScreen onSelectSection={handleSelectSection} />;
    }

    // Primitives section
    if (currentSection === 'primitives') {
      switch (currentPrimitiveScreen) {
        case 'list':
          return (
            <PrimitivesMenuScreen onSelectPrimitive={handleSelectPrimitive} />
          );
        case 'basic':
          return <PrimitivesTestScreen />;
        case 'scrollcontainer':
          return <ScrollContainerTestScreen />;
        case 'text':
          return <TextTestScreen />;
        case 'input':
          return <InputTestScreen />;
        case 'textarea':
          return <TextAreaTestScreen />;
        case 'button':
          return <SimpleButtonTestScreen />;
        case 'switch':
          return <SwitchTestScreen />;
        case 'modal':
          return <ModalTestScreen />;
        case 'select':
          return <SelectTestScreen />;
        case 'colorswatch':
          return <ColorSwatchTestScreen />;
        case 'radiogroup':
          return <RadioGroupTestScreen />;
        case 'tooltip':
          return <TooltipTestScreen />;
        case 'icon':
          return <IconTestScreen />;
        case 'callout':
          return <CalloutTestScreen />;
        case 'fileupload':
          return <FileUploadTestScreen />;
        default:
          return (
            <PrimitivesMenuScreen onSelectPrimitive={handleSelectPrimitive} />
          );
      }
    }

    // Business section
    if (currentSection === 'business') {
      switch (currentBusinessScreen) {
        case 'list':
          return <BusinessMenuScreen onSelectFeature={handleSelectBusiness} />;
        case 'onboarding':
          return <OnboardingTestScreen />;
        case 'auth':
          return <AuthenticationTestScreen />;
        case 'login':
          return <LoginTestScreen />;
        case 'maintenance':
          return <MaintenanceTestScreen />;
        case 'copy':
          return <ClickToCopyTestScreen />;
        case 'modals':
          return (
            <ModalsTestScreen
              onGoBack={() => setCurrentBusinessScreen('list')}
            />
          );
        case 'messagecomposer':
          return <MessageComposerTestScreen />;
        case 'iconpicker':
          return <IconPickerTestScreen />;
        // Future screens will be added here
        default:
          return <BusinessMenuScreen onSelectFeature={handleSelectBusiness} />;
      }
    }

    return <MainMenuScreen onSelectSection={handleSelectSection} />;
  };

  return (
    <View
      style={[
        commonTestStyles.appContainer,
        { backgroundColor: theme.colors.bg.app },
      ]}
    >
      {renderBackButton()}
      {renderScreen()}
      <StatusBar style="auto" />
    </View>
  );
}

// Create QueryClient instance for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
    },
  },
});

// Main App component
export default function App() {
  useEffect(() => {
    // Initialize Lingui for mobile app (English only)
    initializeMobileI18n();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider i18n={i18n}>
            <ThemeProvider>
              <PasskeysProvider>
                <ThemedAppContent />
              </PasskeysProvider>
            </ThemeProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
