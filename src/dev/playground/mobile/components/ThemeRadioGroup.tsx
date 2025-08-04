import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useTheme } from './primitives/theme';
import { RadioGroup } from './primitives';
import { RadioOption } from './primitives/RadioGroup/types';

// Use the primitive's theme type, but extend it for our UI
type ExtendedTheme = 'light' | 'dark' | 'system';

// Playground-specific: Lingui syntax has been converted to hardcoded strings
// Real mobile app will use full Lingui integration

export interface ThemeRadioGroupProps {
  horizontal?: boolean;
}

const ThemeRadioGroup: React.FC<ThemeRadioGroupProps> = ({
  horizontal,
}) => {
  // Use React state for extended theme management since primitives only support light/dark
  const [extendedTheme, setExtendedTheme] = React.useState<ExtendedTheme>('system');
  const primitiveTheme = useTheme();
  
  console.log('🔥 ThemeRadioGroup - Primitive theme context:', primitiveTheme);
  console.log('🔥 ThemeRadioGroup - Extended theme state:', extendedTheme);

  // Convert extended theme to primitive theme
  const resolvedTheme = extendedTheme === 'system' ? 'light' : extendedTheme;

  // Test if setTheme is actually a function
  const testSetTheme = () => {
    console.log('Testing primitive setTheme directly...');
    try {
      primitiveTheme.setTheme('dark');
      console.log('primitive setTheme call completed');
    } catch (error) {
      console.error('primitive setTheme failed:', error);
    }
  };

  // Define theme options with Icon primitive names
  const options: RadioOption<ExtendedTheme>[] = [
    {
      value: 'light',
      label: 'Light',
      icon: 'sun', // Maps to Icon primitive
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: 'moon', // Maps to Icon primitive
    },
    {
      value: 'system',
      label: 'System',
      icon: 'desktop', // Maps to Icon primitive
    },
  ];

  // Debug logging
  console.log('🔥 ThemeRadioGroup - Current extended theme:', extendedTheme);
  console.log('🔥 ThemeRadioGroup - Resolved theme for primitives:', resolvedTheme);
  console.log('🔥 ThemeRadioGroup - Primitive theme object:', primitiveTheme);

  // Temporary debugging - add a simple test view
  if (extendedTheme === undefined) {
    console.log('WARNING: extendedTheme is undefined!');
  }

  // Handle theme changes - update both local state and primitive theme
  const handleThemeChange = (newTheme: ExtendedTheme) => {
    console.log('🔥 ThemeRadioGroup - handleThemeChange called with:', newTheme);
    
    // Update local extended theme state
    setExtendedTheme(newTheme);
    
    // Update primitive theme (convert system to light for now)
    const primitiveThemeValue = newTheme === 'system' ? 'light' : newTheme;
    console.log('🔥 ThemeRadioGroup - Setting primitive theme to:', primitiveThemeValue);
    primitiveTheme.setTheme(primitiveThemeValue);
  };

  return (
    <View>
      <RadioGroup
        options={options}
        value={extendedTheme}
        onChange={handleThemeChange}
        direction={horizontal ? 'horizontal' : 'vertical'}
        name="theme"
      />
    </View>
  );
};

export default ThemeRadioGroup;
