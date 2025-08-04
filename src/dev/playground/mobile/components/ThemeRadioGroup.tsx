import React from 'react';
import { useTheme, type Theme } from './primitives/theme';
import { RadioGroup } from './primitives';
import { RadioOption } from './primitives/RadioGroup/types';

// Playground-specific: Lingui syntax has been converted to hardcoded strings
// Real mobile app will use full Lingui integration

export interface ThemeRadioGroupProps {
  horizontal?: boolean;
}

const ThemeRadioGroup: React.FC<ThemeRadioGroupProps> = ({
  horizontal,
}) => {
  const { theme, setTheme } = useTheme();

  // Define theme options with Icon primitive names
  const options: RadioOption<Theme>[] = [
    {
      value: 'light',
      label: 'Light', // In real app: t`Light`
      icon: 'sun', // Maps to Icon primitive
    },
    {
      value: 'dark',
      label: 'Dark', // In real app: t`Dark`
      icon: 'moon', // Maps to Icon primitive
    },
    {
      value: 'system',
      label: 'System', // In real app: t`System`
      icon: 'desktop', // Maps to Icon primitive
    },
  ];

  return (
    <RadioGroup
      options={options}
      value={theme}
      onChange={setTheme}
      direction={horizontal ? 'horizontal' : 'vertical'}
      iconOnly={horizontal} // Show only icons in horizontal mode
    />
  );
};

export default ThemeRadioGroup;
