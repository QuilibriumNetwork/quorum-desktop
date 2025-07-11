import * as React from 'react';

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
    document.documentElement.classList.add(`accent-${currentAccent}`);
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
          className={`w-8 h-8 rounded-full cursor-pointer border-2 ${activeAccent === color ? `border-accent-500` : 'border-transparent'} accent-${color}`}
          style={{ backgroundColor: `var(--accent-500)` }}
        ></div>
      ))}
    </div>
  );
};

export default AccentColorSwitcher;
