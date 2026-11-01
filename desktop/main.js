const { app, BrowserWindow, Menu, globalShortcut, shell } = require('electron');
const path = require('path');

app.setAppUserModelId('com.shachang.showdown');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 920,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: '#06090f',
    title: '沙场对决',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // 阻止页面自己开新窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 全屏切换
  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  win.on('closed', () => globalShortcut.unregister('F11'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 单实例：重复双击时唤起已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
}
