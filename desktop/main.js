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
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
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

ipcMain.handle('clxy-update-app', async (event, targetVersion) => {
  console.log('[CLXY Updater] Starting update to version:', targetVersion);
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ version: targetVersion });
    const req = http.request({
      hostname: '127.0.0.1',
      port: CORE_PORT,
      path: '/api/update/download',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', async () => {
        if (res.statusCode !== 200) {
          return reject(new Error('Download failed: ' + body));
        }

        // Poll for ready state
        let ready = false;
        for (let i = 0; i < 120; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const st = await new Promise((resSt) => {
            http.get(`http://127.0.0.1:${CORE_PORT}/api/status`, (r) => {
              let d = '';
              r.on('data', c => d += c);
              r.on('end', () => {
                try { resSt(JSON.parse(d)); } catch (_) { resSt(null); }
              });
            }).on('error', () => resSt(null));
          });
          if (st && st.update) {
            if (st.update.state === 'ready') {
              ready = true;
              break;
            } else if (st.update.state === 'failed') {
              return reject(new Error(st.update.error || 'Update download failed'));
            }
          }
        }
        if (!ready) {
          return reject(new Error('Update download timed out'));
        }

        // Install update passing Electron's PID so updater swaps files smoothly
        const installData = JSON.stringify({
          version: targetVersion,
          pid: process.pid,
          args: []
        });
        const instReq = http.request({
          hostname: '127.0.0.1',
          port: CORE_PORT,
          path: '/api/update/install',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(installData)
          }
        }, (instRes) => {
          if (instRes.statusCode === 200) {
            console.log('[CLXY Updater] Install scheduled. Quitting Electron to allow replacement...');
            resolve(true);
            setTimeout(() => {
              app.isQuitting = true;
              app.quit();
            }, 500);
          } else {
            reject(new Error('Install request failed'));
          }
        });
        instReq.on('error', reject);
        instReq.write(installData);
        instReq.end();
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
});

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
