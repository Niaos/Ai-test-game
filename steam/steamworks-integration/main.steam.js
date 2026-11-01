// ============================================================
// Steamworks 集成骨架 —— 用法见同目录 README.md
// 只需把标注 [MERGE] 的段落合入 desktop/main.js，并安装 steamworks.js
// ============================================================
// [MERGE] 段 1：主进程顶部
//
//   const { app, ipcMain } = require('electron');
//   let steam = null;
//   const STEAM_APPID = 480;           // TODO: 拿到真实 AppID 后替换
//
//   function initSteam() {
//     try {
//       const steamworks = require('steamworks.js');
//       steam = steamworks.init(STEAM_APPID);
//       steam.localplayer.getName();   // 探活
//       console.log('[steam] init ok:', steam.localplayer.getName());
//     } catch (e) {
//       console.warn('[steam] init failed (无 Steam 客户端? 游戏照常运行):', e.message);
//       steam = null;
//     }
//   }
//
//   app.whenReady().then(initSteam);
//
//   // 渲染进程 → 主进程：解锁成就
//   ipcMain.handle('steam-achievement', (_e, apiName) => {
//     if (!steam) return false;
//     try { steam.achievement.activate(apiName); return true; }
//     catch (e) { console.warn('[steam] ach fail', apiName, e.message); return false; }
//   });
//   ipcMain.handle('steam-stats', () => steam ? {
//     name: steam.localplayer.getName(), id: String(steam.localplayer.getSteamId().steamId64),
//   } : null);
//
// ------------------------------------------------------------
// [MERGE] 段 2：preload.js（新建或合入）
//
//   const { contextBridge, ipcRenderer } = require('electron');
//   contextBridge.exposeInMainWorld('steam', {
//     unlock: (name) => ipcRenderer.invoke('steam-achievement', name),
//     who:   () => ipcRenderer.invoke('steam-stats'),
//   });
//
//   // package.json 里加: "build": { ..., "files": ["main.js", "preload.js", "app/**/*"] }
//   // BrowserWindow 加: webPreferences: { preload: path.join(__dirname, 'preload.js') }
// ------------------------------------------------------------
