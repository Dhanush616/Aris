import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

// Setup explicit hardware IPC bridging for OS level file selection ignoring HTTP limits
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Executable Files', extensions: ['exe'] }]
  });
  if (canceled) return null;
  return filePaths[0];
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Aris', // Force Aris heading
    backgroundColor: '#000000', // Pre-fill with black background to match app
    // The user requested standard Windows framing, so we won't set frame: false.
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Hide the default electron menubar completely to prioritize the App's UI
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // In development mode, load from the active Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production mode, load the bundled static index.html built by Vite
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
