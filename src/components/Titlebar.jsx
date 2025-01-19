const CustomTitlebar = () => {
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
    return (
      <div className="flex-row">
        <button
          onClick={handleMinimize}
          className="flex-col items-center justify-center w-12 h-full hover:bg-gray-700"
        >
          <div className="w-4 h-4 text-gray-300">-</div>
        </button>

        <button
          onClick={handleMaximize}
          className="flex-col items-center justify-center w-12 h-full hover:bg-gray-700"
        >
          <div className="w-4 h-4 text-gray-300">[]</div>
        </button>

        <button
          onClick={handleClose}
          className="flex-col items-center justify-center w-12 h-full hover:bg-red-600"
        >
          <div className="w-4 h-4 text-gray-300">x</div>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-row items-center justify-between h-8 select-none z-[3000]">
      {window.electron.platform === 'darwin' ? macControls() : <></>}
      {/* App title/icon area */}
      <div
        className={
          'flex-row -webkit-app-region-drag text-center items-center grow px-4 ' +
          (window.electron.platform === 'darwin' ? 'pr-24' : 'pl-24')
        }
      >
        <span className="text-sm font-bold">Quorum</span>
      </div>
      {window.electron.platform !== 'darwin' ? controls() : <></>}
    </div>
  );
};

export default CustomTitlebar;
