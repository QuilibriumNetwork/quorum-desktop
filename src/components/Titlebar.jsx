import { Icon, useTheme } from './primitives';
import { useEffect } from 'react';

const CustomTitlebar = () => {
  const { resolvedTheme } = useTheme();

  // Add electron class to body for CSS targeting
  useEffect(() => {
    document.body.classList.add('electron');
    return () => {
      document.body.classList.remove('electron');
    };
  }, []);
  const handleMinimize = () => {
    window.electron.windowControls.minimize();
  };

  const handleMaximize = () => {
    window.electron.windowControls.maximize();
  };

  const handleClose = () => {
    window.electron.windowControls.close();
  };

  const macControls = () => {
    const isDark = resolvedTheme === 'dark';

    return (
      <div className="flex items-center gap-2 px-3 h-8">
        {/* Close button */}
        <div
          onClick={handleClose}
          className="w-3 h-3 flex items-center justify-center group"
        >
          <div
            className={`w-3 h-3 rounded-full ${
              isDark
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          ></div>
        </div>

        {/* Minimize button */}
        <div
          onClick={handleMinimize}
          className="w-3 h-3 flex items-center justify-center group"
        >
          <div
            className={`w-3 h-3 rounded-full ${
              isDark
                ? 'bg-yellow-700 hover:bg-yellow-600'
                : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          ></div>
        </div>

        {/* Maximize button */}
        <div
          onClick={handleMaximize}
          className="w-3 h-3 flex items-center justify-center group"
        >
          <div
            className={`w-3 h-3 rounded-full ${
              isDark
                ? 'bg-green-700 hover:bg-green-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          ></div>
        </div>
      </div>
    );
  };
  const controls = () => {
    // Square hover backgrounds, no permanent fill. Transparent at rest; a
    // subtle surface-tinted square appears on hover. Close is the exception:
    // it stays transparent until hover, then turns danger-red. All colours
    // come from _colors.scss tokens (theme-aware), never raw Tailwind grays.
    const baseButton =
      'flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer focus:outline-none focus:ring-0 border-0 focus:border-0 hover:border-0';
    const buttonStyle = { border: 'none', outline: 'none', boxShadow: 'none' };

    // gap-1 + pr-2 keeps each hover square from touching its neighbour or the
    // window's right edge; items-center floats them inside the 36px bar.
    return (
      <div className="flex flex-row items-center gap-1 pr-2">
        <button
          onClick={handleMinimize}
          className={`${baseButton} text-subtle hover:bg-surface-2 hover:text-main`}
          style={buttonStyle}
        >
          <Icon name="minus" size="sm" color="currentColor" />
        </button>

        <button
          onClick={handleMaximize}
          className={`${baseButton} text-subtle hover:bg-surface-2 hover:text-main`}
          style={buttonStyle}
        >
          <Icon name="square" size="sm" color="currentColor" />
        </button>

        <button
          onClick={handleClose}
          className={`${baseButton} text-subtle hover:bg-danger hover:text-white`}
          style={buttonStyle}
        >
          <Icon name="close" size="sm" color="currentColor" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-row items-center justify-between h-9 select-none z-[3000] bg-app flex-shrink-0 border-b border-subtle">
      {window.electron.platform === 'darwin' ? macControls() : <></>}
      {/* Draggable region — empty (no title), fills the space between the
          mac dots (left) or window controls (right). */}
      <div className="flex-row -webkit-app-region-drag items-center grow h-full" />
      {window.electron.platform !== 'darwin' ? controls() : <></>}
    </div>
  );
};

export default CustomTitlebar;
