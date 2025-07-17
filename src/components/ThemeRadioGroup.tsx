import React, { useEffect } from 'react';
import { useTheme, Theme } from './context/ThemeProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';
import { t } from '@lingui/core/macro';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type ThemeOption = { text: string; icon: IconDefinition };

const ThemeRadioGroup: React.FC<{ horizontal?: boolean }> = ({
  horizontal,
}) => {
  const { theme, setTheme } = useTheme();

  const options: { [key: string]: ThemeOption } = {
    light: { text: t`light`, icon: faSun },
    dark: { text: t`dark`, icon: faMoon },
    system: { text: t`system`, icon: faDesktop },
  };

  return (
    <div
      className={`mt-2 ${
        horizontal ? 'flex flex-row gap-4' : 'flex flex-col gap-3 max-w-[300px]'
      }`}
    >
      {Object.entries(options).map(([key, opt]) => (
        <label
          key={key}
          className={
            'flex items-center justify-between px-4 py-2 rounded-md border cursor-pointer ' +
            (theme === key
              ? 'border-accent bg-[var(--surface-3)]'
              : 'border-[var(--surface-3)] hover:bg-[var(--surface-3)]')
          }
        >
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={opt.icon} className="text-surface-9" />
            <span className="capitalize mr-3">{opt.text}</span>
          </div>

          <input
            type="radio"
            name="theme"
            value={key}
            checked={theme === key}
            onChange={() => setTheme(key as Theme)}
            className="accent-[var(--accent)] w-4 h-4"
          />
        </label>
      ))}
    </div>
  );
};

export default ThemeRadioGroup;
