import * as React from 'react';
import { ColorSwatch } from './primitives';

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
        <ColorSwatch
          key={color}
          color={color}  // Pass color name, not hex value
          isActive={activeAccent === color}  // Use isActive prop
          onPress={() => setAccent(color)}   // Use onPress prop
          size="large"
        />
      ))}
    </div>
  );
};

export default AccentColorSwitcher;