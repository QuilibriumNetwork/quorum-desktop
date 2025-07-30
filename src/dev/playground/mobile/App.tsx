import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CrossPlatformThemeProvider } from './components/primitives/theme';
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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('list');

  const renderBackButton = () => {
    if (currentScreen === 'list') return null;

    return (
      <View style={styles.backBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentScreen('list')}
        >
          <Text style={styles.backButtonText}>← Back to Primitives</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'list':
        return <PrimitiveListScreen onSelectPrimitive={setCurrentScreen} />;
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
        return <PrimitiveListScreen onSelectPrimitive={setCurrentScreen} />;
    }
  };

  return (
    <SafeAreaProvider>
      <CrossPlatformThemeProvider disableWebFeatures={true}>
        <View style={styles.appContainer}>
          {renderBackButton()}
          {renderScreen()}
          <StatusBar style="auto" />
        </View>
      </CrossPlatformThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
  },
});
