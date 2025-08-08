import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/primitives/theme';
import { I18nProvider } from '@lingui/react';
import { i18n, initializeMobileI18n } from './i18n';
import { default as Button } from '@/primitives/Button';
import { commonTestStyles, createThemedStyles } from '@/styles/commonTestStyles';
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
  FileUploadTestScreen,
} from '@/test/primitives';

// Import business component test screens
import {
  BusinessMenuScreen,
  AuthenticationTestScreen,
} from '@/test/business';

type Section = 'main' | 'primitives' | 'business';
type PrimitiveScreen = 'list' | 'basic' | 'text' | 'input' | 'textarea' | 'button' | 'switch' | 'modal' | 'select' | 'colorswatch' | 'radiogroup' | 'tooltip' | 'icon' | 'fileupload';
type BusinessScreen = 'list' | 'auth' | 'spaces' | 'channel' | 'direct' | 'settings' | 'search';

// Themed App Content (must be inside ThemeProvider)
function ThemedAppContent() {
  const [currentSection, setCurrentSection] = useState<Section>('main');
  const [currentPrimitiveScreen, setCurrentPrimitiveScreen] = useState<PrimitiveScreen>('list');
  const [currentBusinessScreen, setCurrentBusinessScreen] = useState<BusinessScreen>('list');
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
          <Button
            type="secondary"
            iconName="arrow-left"
            onClick={handleBack}
          >
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
          return <PrimitivesMenuScreen onSelectPrimitive={handleSelectPrimitive} />;
        case 'basic':
          return <PrimitivesTestScreen />;
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
        case 'fileupload':
          return <FileUploadTestScreen />;
        default:
          return <PrimitivesMenuScreen onSelectPrimitive={handleSelectPrimitive} />;
      }
    }

    // Business section
    if (currentSection === 'business') {
      switch (currentBusinessScreen) {
        case 'list':
          return <BusinessMenuScreen onSelectFeature={handleSelectBusiness} />;
        case 'auth':
          return <AuthenticationTestScreen />;
        // Future screens will be added here
        default:
          return <BusinessMenuScreen onSelectFeature={handleSelectBusiness} />;
      }
    }

    return <MainMenuScreen onSelectSection={handleSelectSection} />;
  };

  return (
    <View style={[commonTestStyles.appContainer, { backgroundColor: theme.colors.bg.app }]}>
      {renderBackButton()}
      {renderScreen()}
      <StatusBar style="auto" />
    </View>
  );
}

// Main App component
export default function App() {
  useEffect(() => {
    // Initialize Lingui for mobile app (English only)
    initializeMobileI18n();
  }, []);

  return (
    <SafeAreaProvider>
      <I18nProvider i18n={i18n}>
        <ThemeProvider>
          <ThemedAppContent />
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

