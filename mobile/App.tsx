import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/primitives/theme';
import Button from '@/primitives/Button';
// Import Tailwind styles for web
import './styles/tailwind.css';
import { commonTestStyles, createThemedStyles } from './styles/commonTestStyles';
import { PrimitiveListScreen } from './screens/PrimitiveListScreen';
import { PrimitivesTestScreen } from './screens/PrimitivesTestScreen';
import { TextTestScreen } from './screens/TextTestScreen';
import { InputTestScreen } from './screens/InputTestScreen';
import { TextAreaTestScreen } from './screens/TextAreaTestScreen';
import { SimpleButtonTestScreen } from './screens/SimpleButtonTestScreen';
import { SwitchTestScreen } from './screens/SwitchTestScreen';
import { ModalTestScreen } from './screens/ModalTestScreen';
import { SelectTestScreen } from './screens/SelectTestScreen';
import { ColorSwatchTestScreen } from './screens/ColorSwatchTestScreen';
import { RadioGroupTestScreen } from './screens/RadioGroupTestScreen';
import { TooltipTestScreen } from './screens/TooltipTestScreen';
import { IconTestScreen } from './screens/IconTestScreen';

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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedAppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

