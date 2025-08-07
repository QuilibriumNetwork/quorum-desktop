import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/components/primitives/theme';
import { I18nProvider } from '@lingui/react';
import { i18n, initializeMobileI18n } from './i18n';
import { default as Button } from '../src/components/primitives/Button';
import { commonTestStyles, createThemedStyles } from './styles/commonTestStyles';
import {
  PrimitiveListScreen,
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
} from './screens';

type Screen =
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
  | 'icon';

// Themed App Content (must be inside ThemeProvider)
function ThemedAppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('list');
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);

  const renderBackButton = () => {
    if (currentScreen === 'list') return null;

    return (
      <View style={themedStyles.backBar}>
        <View style={commonTestStyles.backButtonContainer}>
          <Button
            type="secondary"
            iconName="arrow-left"
            onClick={() => setCurrentScreen('list')}
          >
            Back to Primitives
          </Button>
        </View>
      </View>
    );
  };

  const handleSelectPrimitive = (screen: string) => {
    setCurrentScreen(screen as Screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'list':
        return <PrimitiveListScreen onSelectPrimitive={handleSelectPrimitive} />;
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
      default:
        return <PrimitiveListScreen onSelectPrimitive={handleSelectPrimitive} />;
    }
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

