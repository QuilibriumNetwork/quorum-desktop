import { Icon } from './primitives';
import { useTheme } from './context/ThemeProvider';
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
    return (
      <div className="flex items-center gap-2 px-3 h-8">
        {/* Close button */}
        <div
          onClick={handleClose}
          className="w-3 h-3 flex items-center justify-center group"
        >
          <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600"></div>
        </div>

        {/* Minimize button */}
        <div
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center group"
        >
          <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600"></div>
        </div>

        {/* Maximize button */}
        <div
          onClick={handleMaximize}
          className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center group"
        >
          <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600"></div>
        </div>
      </div>
    );
  };
  const controls = () => {
    const isDark = resolvedTheme === 'dark';
    
    return (
      <div className="flex flex-row items-center gap-1 pr-2">
        <button
          onClick={handleMinimize}
          className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-0 border-0 focus:border-0 hover:border-0 text-main ${
            isDark 
              ? 'bg-gray-700 hover:bg-gray-600' 
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
        >
          <Icon name="minus" size="xs" color="currentColor" />
        </button>

        <button
          onClick={handleMaximize}
          className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-0 border-0 focus:border-0 hover:border-0 text-main ${
            isDark 
              ? 'bg-gray-700 hover:bg-gray-600' 
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
          style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
        >
          <Icon name="compress-alt" size="xs" color="currentColor" />
        </button>

        <button
          onClick={handleClose}
          className="flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer text-white focus:outline-none focus:ring-0 border-0 focus:border-0 hover:border-0"
          style={{ 
            border: 'none', 
            outline: 'none', 
            boxShadow: 'none',
            backgroundColor: '#ef4444',
            color: 'white'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#dc2626';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#ef4444';
          }}
        >
          <Icon name="times" size="xs" color="white" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-row items-center justify-between h-9 select-none z-[3000] bg-surface-00 flex-shrink-0 pt-0.5">
      {window.electron.platform === 'darwin' ? macControls() : <></>}
      {/* App title/icon area */}
      <div
        className={
          'flex-row -webkit-app-region-drag text-center items-center grow px-4 ' +
          (window.electron.platform === 'darwin' ? 'pr-24' : 'pl-24')
        }
      >
        <span className="text-sm font-bold text-main">Quorum</span>
      </div>
      {window.electron.platform !== 'darwin' ? controls() : <></>}
    </div>
  );
};

export default CustomTitlebar;
