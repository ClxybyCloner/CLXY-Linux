const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let tray = null;
let coreProcess = null;
const CORE_PORT = 10820;

function checkCoreHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${CORE_PORT}/api/status`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function startCoreIfNeeded() {
  const isRunning = await checkCoreHealth();
  if (isRunning) {
    console.log('[CLXY] Linux Core already running on port', CORE_PORT);
    return;
  }

  // Look for clxy-core binary
  const candidates = [
    path.join(__dirname, '..', 'core', 'clxy-core'),
    path.join(__dirname, 'core', 'clxy-core'),
    path.join(process.resourcesPath || '', 'core', 'clxy-core'),
    '/opt/clxy/clxy-core',
    'clxy-core'
  ];

  let coreBin = null;
  const fs = require('fs');
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      coreBin = c;
      break;
    }
  }

  if (coreBin) {
    console.log('[CLXY] Launching core from:', coreBin);
    coreProcess = spawn(coreBin, ['-app'], {
      detached: false,
      stdio: 'ignore'
    });
    coreProcess.unref();

    // Wait for core to answer
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (await checkCoreHealth()) break;
    }
  } else {
    console.warn('[CLXY] clxy-core binary not found in standard paths; assuming external daemon.');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 380,
    minHeight: 700,
    title: 'CLXY — CLONER X-RAY',
    backgroundColor: '#040612',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  mainWindow.loadURL(`http://127.0.0.1:${CORE_PORT}/app/`);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'logo.png');
  tray = new Tray(iconPath);
  tray.setToolTip('CLXY — CLONER X-RAY');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open CLXY',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  await startCoreIfNeeded();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (coreProcess) {
    coreProcess.kill('SIGTERM');
  }
});
