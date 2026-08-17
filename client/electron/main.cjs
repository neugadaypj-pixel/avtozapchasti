// Главный процесс Electron — настольное приложение для Windows/macOS/Linux.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'dist', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Открываем собранный фронтенд.
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Внешние ссылки открывать в браузере, а не внутри приложения.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
