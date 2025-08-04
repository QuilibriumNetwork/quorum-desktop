import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './components/primitives/theme';
import Button from './components/primitives/Button';
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

  const renderBackButton = () => {
    if (currentScreen === 'list') return null;

    return (
      <View style={[styles.backBar, { backgroundColor: theme.colors.bg.app }]}>
        <View style={styles.buttonContainer}>
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
    <View style={[styles.appContainer, { backgroundColor: theme.colors.bg.app }]}>
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

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    // backgroundColor removed - now uses theme.colors.bg.app dynamically
  },
  backBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    alignSelf: 'flex-start',
  },
});
