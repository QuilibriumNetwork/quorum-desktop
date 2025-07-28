import React from 'react';
import { useTheme, Theme } from './context/ThemeProvider';
import { RadioGroup } from './primitives';
import { t } from '@lingui/core/macro';
import { RadioOption } from './primitives/RadioGroup/types';

const ThemeRadioGroup: React.FC<{ horizontal?: boolean }> = ({
  horizontal,
}) => {
  const { theme, setTheme } = useTheme();

  // Define theme options with Icon primitive names
  const options: RadioOption<Theme>[] = [
    { 
      value: 'light', 
      label: t`Light`, 
      icon: 'sun' // Maps to Icon primitive
    },
    { 
      value: 'dark', 
      label: t`Dark`, 
      icon: 'moon' // Maps to Icon primitive
    },
    { 
      value: 'system', 
      label: t`System`, 
      icon: 'desktop' // Maps to Icon primitive
    },
  ];

  return (
    <RadioGroup
      options={options}
      value={theme}
      onChange={setTheme}
      direction={horizontal ? 'horizontal' : 'vertical'}
      className="mt-2"
      name="theme"
    />
  );
};

export default ThemeRadioGroup;