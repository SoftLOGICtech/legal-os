const { app, BrowserWindow, shell, ipcMain } = require('electron');
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
  process.env.ELECTRON_USER_DATA = app.getPath('userData');
  
  // Default cloud sync fallback so advocates don't need system env config
  if (!process.env.REMOTE_BACKEND_URL) {
    process.env.REMOTE_BACKEND_URL = 'https://legalosburner-production.up.railway.app';
  }

  try {
    const fs = require('fs');
    const distPath = path.join(__dirname, '..', 'dashboard', 'dist');
    console.log('[Electron] Checking frontend path:', distPath);
    if (fs.existsSync(distPath)) {
      console.log('[Electron] Frontend files found:', fs.readdirSync(distPath));
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
    const cloudHost = 'perceptive-luck-production-9f80.up.railway.app';
    const cloudUrl = `https://${cloudHost}`;
    
    console.log('[Electron] Detecting connection to Railway Cloud...');
    const isCloudOnline = await checkCloudReady(cloudHost, 2000);
    
    if (isCloudOnline) {
      console.log('[Electron] Cloud online. Loading latest updates directly...');
      mainWindow.loadURL(cloudUrl);
      mainWindow.webContents.once('did-finish-load', () => {
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          new Notification({
            title: 'Legal OS Updated',
            body: 'Connected to the cloud. Latest features applied successfully.'
          }).show();
        }
      });
    } else {
      console.log('[Electron] Cloud offline. Booting offline local database...');
      await checkPortReady(BACKEND_PORT, 15000);
      mainWindow.loadURL(BACKEND_URL);
    }
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

  app.whenReady().then(() => {
    startBackend();
    createWindow();

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
