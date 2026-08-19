const { app, BrowserWindow, shell, ipcMain, Menu, MenuItem } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow = null;
let backendProcess = null;

const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const isDev = process.env.NODE_ENV === 'development';

// ── Start the Node.js backend ─────────────────────────────────────────────────
function startBackend() {
  process.env.PORT = String(BACKEND_PORT);
  process.env.DATABASE_URL = ''; // Force SQLite
  process.env.ELECTRON_APP = 'true';
  const userDataPath = app.getPath('userData');
  process.env.ELECTRON_USER_DATA = userDataPath;
  
  if (!process.env.REMOTE_BACKEND_URL) {
    process.env.REMOTE_BACKEND_URL = 'https://legal-os-lea2.onrender.com';
  }

  const fs = require('fs');

  // 1. Ensure userData directory exists
  if (!fs.existsSync(userDataPath)) {
    try {
      fs.mkdirSync(userDataPath, { recursive: true });
    } catch (e) {}
  }

  // 2. Check for local config file in userData
  const configPath = path.join(userDataPath, 'legal_os_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (conf.GROQ_SOCA_API_KEY && !process.env.GROQ_SOCA_API_KEY) process.env.GROQ_SOCA_API_KEY = conf.GROQ_SOCA_API_KEY;
      if (conf.GROQ_PDF_API_KEY && !process.env.GROQ_PDF_API_KEY) process.env.GROQ_PDF_API_KEY = conf.GROQ_PDF_API_KEY;
      if (conf.JWT_SECRET && !process.env.JWT_SECRET) process.env.JWT_SECRET = conf.JWT_SECRET;
    } catch (e) {
      console.warn('[Electron] Error reading legal_os_config.json:', e.message);
    }
  }

  // 3. Fallback to bundled backend/.env if available
  const possibleEnvFiles = [
    path.join(__dirname, '..', 'backend', '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(process.resourcesPath || '', 'backend', '.env')
  ];

  for (const envFile of possibleEnvFiles) {
    if (fs.existsSync(envFile)) {
      try {
        const envContent = fs.readFileSync(envFile, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key] && val) {
              process.env[key] = val;
            }
          }
        });
        console.log(`[Electron] Injected environment keys from: ${envFile}`);
        break;
      } catch (e) {}
    }
  }

  try {
    const distPath = path.join(__dirname, '..', 'dashboard', 'dist');
    console.log('[Electron] Checking frontend path:', distPath);
    if (fs.existsSync(distPath)) {
      console.log('[Electron] Frontend files found:', fs.readdirSync(distPath).length, 'files');
    } else {
      console.error('[Electron] Frontend path does NOT exist!');
    }
    
    require(path.join(__dirname, '..', 'backend', 'server.js'));
    console.log('[Electron] Backend server started successfully inside main process.');
  } catch (err) {
    console.error('[Electron] Failed to start backend inside main process:', err);
  }
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

  // Enable keyboard reload shortcuts (F5, Ctrl+R, Ctrl+Shift+R)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r') || (input.meta && input.key.toLowerCase() === 'r')) {
        if (input.shift) {
          mainWindow.webContents.reloadIgnoringCache();
        } else {
          mainWindow.webContents.reload();
        }
        event.preventDefault();
      }
    }
  });

  // Right-click context menu with Refresh option
  mainWindow.webContents.on('context-menu', (e, params) => {
    const contextMenu = new Menu();
    contextMenu.append(new MenuItem({
      label: '🔄 Refresh Legal OS',
      accelerator: 'CmdOrCtrl+R',
      click: () => mainWindow.webContents.reload()
    }));
    contextMenu.append(new MenuItem({
      label: '⚡ Hard Reload & Clear Cache',
      accelerator: 'CmdOrCtrl+Shift+R',
      click: () => mainWindow.webContents.reloadIgnoringCache()
    }));
    contextMenu.append(new MenuItem({
      label: '🚀 Check for Updates...',
      click: () => manualCheckForUpdates(mainWindow)
    }));
    contextMenu.append(new MenuItem({ type: 'separator' }));
    contextMenu.append(new MenuItem({ role: 'cut' }));
    contextMenu.append(new MenuItem({ role: 'copy' }));
    contextMenu.append(new MenuItem({ role: 'paste' }));
    contextMenu.append(new MenuItem({ role: 'selectAll' }));
    if (isDev) {
      contextMenu.append(new MenuItem({ type: 'separator' }));
      contextMenu.append(new MenuItem({
        label: 'Inspect Element',
        click: () => mainWindow.webContents.inspectElement(params.x, params.y)
      }));
    }
    contextMenu.popup({ window: mainWindow, x: params.x, y: params.y });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Helper to check if cloud frontend is reachable using net.Socket on port 443 (HTTPS)
  const checkCloudReady = (host, timeoutMs = 2000) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      const handleFail = () => {
        socket.destroy();
        resolve(false);
      };
      socket.once('error', handleFail);
      socket.once('timeout', handleFail);
      socket.connect(443, host);
    });
  };

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
    console.log('[Electron] Waiting for local backend server...');
    await checkPortReady(BACKEND_PORT, 15000);
    console.log('[Electron] Local backend is ready. Loading Legal OS interface...');
    mainWindow.loadURL(BACKEND_URL);

    // Detect cloud sync status in background
    const cloudHost = 'legalosburner-production.up.railway.app';
    checkCloudReady(cloudHost, 3000).then((isCloudOnline) => {
      const { Notification } = require('electron');
      if (isCloudOnline) {
        console.log('[Electron] Railway Cloud is reachable. Background sync active.');
        if (Notification.isSupported()) {
          new Notification({
            title: 'Legal OS — Cloud Sync Active',
            body: 'Connected to secure firm cloud. Data synchronizing in background.'
          }).show();
        }
      } else {
        console.log('[Electron] Operating in local offline mode.');
        if (Notification.isSupported()) {
          new Notification({
            title: 'Legal OS — Local Offline Mode',
            body: 'Operating offline with local database. Will auto-sync when online.'
          }).show();
        }
      }
    });
  } catch (err) {
    console.error('[Electron] Failed to load application:', err);
    mainWindow.loadFile(path.join(__dirname, 'error.html'));
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Electron] Another instance is already running. Quitting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function startCalendarReminderWatcher() {
    let sqlite3;
    try {
      sqlite3 = require('sqlite3').verbose();
    } catch (e) {
      console.error('[Electron Watcher] Failed to load sqlite3 for notifications:', e.message);
      return;
    }
    
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    const fs = require('fs');
    if (!fs.existsSync(dbPath)) {
      console.log('[Electron Watcher] SQLite file not found yet. Skipping check...');
      return;
    }

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('[Electron Watcher] Failed to connect to SQLite:', err.message);
        return;
      }
      
      const now = new Date();
      const targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const nowStr = now.toISOString();

      db.all(
        `SELECT id, event_title, event_date, notes FROM court_calendar 
         WHERE event_date >= ? AND event_date <= ? AND (reminder_sent = 0 OR reminder_sent IS NULL)`,
        [nowStr, targetTime],
        (err, rows) => {
          if (err) {
            console.error('[Electron Watcher] Query error:', err.message);
            db.close();
            return;
          }

          if (rows && rows.length > 0) {
            const { Notification } = require('electron');
            rows.forEach(row => {
              if (Notification.isSupported()) {
                new Notification({
                  title: `📅 Court Schedule Reminder`,
                  body: `${row.event_title} is scheduled on ${new Date(row.event_date).toLocaleString('en-KE')}.`
                }).show();
              }
              
              // Mark as notified
              db.run(`UPDATE court_calendar SET reminder_sent = 1 WHERE id = ?`, [row.id]);
            });
          }
          db.close();
        }
      );
    });
  }

  let isManualUpdateCheck = false;

  function initAutoUpdater(win) {
    if (isDev) {
      console.log('[AutoUpdater] Skipping auto-updater in local development mode.');
      return;
    }
    try {
      const { autoUpdater } = require('electron-updater');
      const { dialog } = require('electron');

      autoUpdater.logger = console;
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Checking GitHub releases for newer version...');
      });

      autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] Update found:', info.version);
        isManualUpdateCheck = false;
        dialog.showMessageBox(win, {
          type: 'info',
          title: '⚖️ Legal OS Update Available',
          message: `A new update (v${info.version}) is available!`,
          detail: `Your current version: v${app.getVersion()}\nRelease Date: ${info.releaseDate ? new Date(info.releaseDate).toLocaleDateString() : 'Latest'}\n\nWould you like to download and install this update now?`,
          buttons: ['⬇️ Download & Update Now', 'Remind Me Later'],
          defaultId: 0,
          cancelId: 1
        }).then((result) => {
          if (result.response === 0) {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '⚖️ Downloading Update',
              message: `Downloading Legal OS v${info.version}...`,
              detail: 'The update is downloading in the background. You will receive a prompt when it is ready to restart.',
              buttons: ['OK']
            });
            autoUpdater.downloadUpdate();
          }
        });
      });

      autoUpdater.on('update-not-available', (info) => {
        console.log('[AutoUpdater] App is up to date:', info?.version || app.getVersion());
        if (isManualUpdateCheck) {
          dialog.showMessageBox(win, {
            type: 'info',
            title: '⚖️ Legal OS Up to Date',
            message: `Legal OS is running the latest version (v${app.getVersion()}).`,
            detail: 'No newer releases found on GitHub.'
          });
          isManualUpdateCheck = false;
        }
      });

      autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent || 0);
        console.log(`[AutoUpdater] Download: ${percent}% (${(progressObj.transferred / 1048576).toFixed(1)} MB / ${(progressObj.total / 1048576).toFixed(1)} MB)`);
        if (win && !win.isDestroyed()) {
          win.setProgressBar(percent / 100);
        }
      });

      autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Update successfully downloaded:', info.version);
        if (win && !win.isDestroyed()) {
          win.setProgressBar(-1);
        }
        dialog.showMessageBox(win, {
          type: 'info',
          title: '⚖️ Legal OS Update Ready',
          message: `Legal OS v${info.version} has finished downloading!`,
          detail: 'Would you like to restart now to complete the installation?',
          buttons: ['🚀 Restart & Install Now', 'Install on Next Launch'],
          defaultId: 0,
          cancelId: 1
        }).then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall(false, true);
          }
        });
      });

      autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] Error encountered:', err.message);
        if (win && !win.isDestroyed()) {
          win.setProgressBar(-1);
        }
        if (isManualUpdateCheck) {
          dialog.showMessageBox(win, {
            type: 'warning',
            title: '⚖️ Update Check Notice',
            message: 'Unable to check for updates at this moment.',
            detail: `GitHub status: ${err.message || 'No release package found'}\n\nCurrent version: v${app.getVersion()}`
          });
          isManualUpdateCheck = false;
        }
      });

      // Automatic silent check 10 seconds after launch
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(e => {
          console.log('[AutoUpdater] Background check notice:', e.message);
        });
      }, 10000);

    } catch (e) {
      console.warn('[AutoUpdater] electron-updater module init warning:', e.message);
    }
  }

  function manualCheckForUpdates(win) {
    if (isDev) {
      const { dialog } = require('electron');
      dialog.showMessageBox(win, {
        type: 'info',
        title: '⚖️ Legal OS Dev Mode',
        message: `Running Legal OS v${app.getVersion()} (Development Mode)`,
        detail: 'Auto-updates are only active in packaged desktop builds.'
      });
      return;
    }
    try {
      const { autoUpdater } = require('electron-updater');
      isManualUpdateCheck = true;
      autoUpdater.checkForUpdates().catch((err) => {
        const { dialog } = require('electron');
        dialog.showMessageBox(win, {
          type: 'info',
          title: '⚖️ Legal OS Version',
          message: `Current Version: v${app.getVersion()}`,
          detail: `GitHub Auto-Updater status: ${err.message || 'Latest version active.'}`
        });
        isManualUpdateCheck = false;
      });
    } catch (e) {
      const { dialog } = require('electron');
      dialog.showMessageBox(win, {
        type: 'info',
        title: '⚖️ Legal OS Version',
        message: `Running Legal OS v${app.getVersion()}`
      });
    }
  }

  app.whenReady().then(() => {
    startBackend();
    createWindow();

    // Initialize auto-updater with main window
    initAutoUpdater(mainWindow);

    // Start background watcher for reminders
    setTimeout(startCalendarReminderWatcher, 15000);
    setInterval(startCalendarReminderWatcher, 600000); // check every 10 minutes

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    // no-op since backend runs in main process
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('is-online', () => require('net').createConnection(80, 'google.com')
  .on('connect', function() { this.end(); return true; })
  .on('error', () => false)
);
