// electron/main.cjs
const {
  app,
  session,
  BrowserWindow,
  ipcMain,
  shell,
  protocol,
  clipboard,
} = require('electron');
const path = require('path');

// Simple development mode check
const isDev =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// Dev server URL (override with ELECTRON_DEV_URL when Vite picks a non-default port).
const devUrl = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';

// Add these IPC handlers
ipcMain.on('minimize-window', () => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) window.minimize();
});

ipcMain.on('maximize-window', () => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  const window = BrowserWindow.getFocusedWindow();
  if (window) window.close();
});

ipcMain.handle('openLogin', () => {
  shell.openExternal('http://localhost:5173');
});

// --- Sensitive clipboard copy with reliable auto-clear ---
// The renderer's navigator.clipboard cannot clear the clipboard once the
// window loses focus (Chromium enforces document focus for both read and
// write). The main-process clipboard module has no such restriction, so the
// whole copy + delayed compare-and-clear lifecycle lives here. Pattern matches
// Bitwarden desktop: only clear if the clipboard still holds the value we
// wrote, so we never wipe something the user copied in the meantime.
// Note: on Linux/Wayland the compositor may still restrict background
// clipboard access; Windows/macOS are reliable.
const SENSITIVE_CLIPBOARD_CLEAR_MS = 60_000;
let pendingSensitiveValue = null;
let pendingClearTimer = null;

function clearSensitiveClipboardIfUnchanged() {
  if (pendingClearTimer) {
    clearTimeout(pendingClearTimer);
    pendingClearTimer = null;
  }
  if (pendingSensitiveValue === null) return;
  try {
    if (clipboard.readText() === pendingSensitiveValue) {
      clipboard.clear();
    }
  } finally {
    pendingSensitiveValue = null;
  }
}

ipcMain.handle('clipboard:copy-secret', (_event, text) => {
  if (typeof text !== 'string' || text.length === 0 || text.length > 4096) {
    throw new Error('Invalid clipboard payload');
  }
  if (pendingClearTimer) clearTimeout(pendingClearTimer);
  clipboard.writeText(text);
  pendingSensitiveValue = text;
  pendingClearTimer = setTimeout(
    clearSensitiveClipboardIfUnchanged,
    SENSITIVE_CLIPBOARD_CLEAR_MS
  );
  return SENSITIVE_CLIPBOARD_CLEAR_MS;
});

// Don't leave a secret on the clipboard when the app exits before the timer fires.
app.on('before-quit', clearSensitiveClipboardIfUnchanged);

// App/taskbar icon. In dev the asset lives in public/; in a packaged build
// Vite copies public/ into dist/web/. Used for the runtime window + taskbar
// (packaged installer/exe icons come from electron-builder's build.icon).
const windowIcon = path.join(
  __dirname,
  isDev ? '../../public/icon-512.png' : '../../dist/web/icon-512.png'
);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    icon: windowIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webAuthnEnabled: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: isDev ? false : true, // Disable web security in dev mode
    },
  });

  mainWindow.loadURL(
    isDev
      ? devUrl
      : `file://${path.join(__dirname, '../../dist/web/index.html')}`,
    {}
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();

    // Bypass CORS in development
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        callback({
          requestHeaders: { ...details.requestHeaders, Origin: '*' },
        });
      }
    );

    mainWindow.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Access-Control-Allow-Origin': ['*'],
            'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
            'Access-Control-Allow-Headers': ['*'],
          },
        });
      }
    );
  }
}

// Windows groups taskbar entries by AppUserModelID. Without an explicit ID,
// Electron apps show the generic Electron icon in the taskbar even when the
// BrowserWindow icon is set. Must match electron-builder's appId.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.quilibrium.quorum');
}

app.whenReady().then(createWindow);
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('quorum', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('quorum');
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
