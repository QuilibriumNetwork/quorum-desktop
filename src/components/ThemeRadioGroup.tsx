import React from 'react';
import { useTheme } from './context/ThemeProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';

const iconMap = {
  light: faSun,
  dark: faMoon,
  system: faDesktop,
};

const options: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

const ThemeRadioGroup: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-3 mt-2 max-w-[300px]">
      {options.map((opt) => (
        <label
          key={opt}
          className={
            'flex items-center justify-between px-4 py-2 rounded-md border cursor-pointer ' +
            (theme === opt
              ? 'border-[var(--primary)] bg-[var(--surface-1)]'
              : 'border-[var(--surface-3)] hover:bg-[var(--surface-2)]')
          }
        >
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={iconMap[opt]} className="text-surface-9" />
            <span className="capitalize">{opt}</span>
          </div>

          <input
            type="radio"
            name="theme"
            value={opt}
            checked={theme === opt}
            onChange={() => setTheme(opt)}
            className="accent-[var(--primary)] w-4 h-4"
          />
        </label>
      ))}
    </div>
  );
};

export default ThemeRadioGroup;
