import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

const ACCENT_COLORS = [
  'blue',
  'purple',
  'fuchsia',
  'orange',
  'green',
  'yellow',
];

const AccentColorSwitcher: React.FC = () => {
  const [activeAccent, setActiveAccent] = React.useState('blue');

  React.useEffect(() => {
    const currentAccent = localStorage.getItem('accent-color') || 'blue';
    setActiveAccent(currentAccent);
  }, []);

  const setAccent = (color: string) => {
    ACCENT_COLORS.forEach((c) => {
      document.documentElement.classList.remove(`accent-${c}`);
    });
    document.documentElement.classList.add(`accent-${color}`);
    localStorage.setItem('accent-color', color);
    setActiveAccent(color);
  };

  return (
    <div className="flex gap-3">
      {ACCENT_COLORS.map((color) => (
        <div
          key={color}
          onClick={() => setAccent(color)}
          className={`w-8 h-8 rounded-full cursor-pointer border-2 flex items-center justify-center ${activeAccent === color ? `border-accent-500` : 'border-transparent'} accent-${color}`}
        >
          {activeAccent === color && (
            <FontAwesomeIcon icon={faCheck} className="text-white" />
          )}
        </div>
      ))}
    </div>
  );
};

export default AccentColorSwitcher;
