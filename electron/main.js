const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow = null;
let backendProcess = null;

const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const isDev = process.env.NODE_ENV === 'development';

// ── Spawn the Node.js backend ─────────────────────────────────────────────────
function startBackend() {
  const backendPath = path.join(__dirname, '..', 'backend', 'server.js');

  backendProcess = spawn('node', [backendPath], {
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      // Force SQLite mode for the desktop app (no DATABASE_URL = SQLite)
      DATABASE_URL: undefined,
      ELECTRON_APP: 'true',
      ELECTRON_USER_DATA: app.getPath('userData'),
    },
    stdio: isDev ? 'inherit' : 'ignore',
  });

  backendProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`[Electron] Backend process exited with code ${code}`);
  });
}

// ── Create the main window ────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Sam Ogola & Co — Legal OS',
    backgroundColor: '#060e1c',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // show after ready-to-show
  });

  // Open external links in the default browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Helper to check if backend port is ready using net.Socket
  const checkPortReady = (port, timeoutMs) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('error', () => {
          socket.destroy();
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error('Timeout waiting for backend port'));
          } else {
            setTimeout(check, 250);
          }
        });
        socket.connect(port, '127.0.0.1');
      };
      check();
    });
  };

  try {
    await checkPortReady(BACKEND_PORT, 15000);
    mainWindow.loadURL(BACKEND_URL);
  } catch (err) {
    console.error('[Electron] Backend did not start in time:', err);
    mainWindow.loadFile(path.join(__dirname, 'error.html'));
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Kill the backend when all windows are closed
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('is-online', () => require('net').createConnection(80, 'google.com')
  .on('connect', function() { this.end(); return true; })
  .on('error', () => false)
);
