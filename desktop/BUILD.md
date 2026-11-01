# 沙场对决 · Windows 桌面版打包说明

## 交付物

- `dist/ShachangShowdown-Setup-1.0.0.exe` —— NSIS 安装程序（约 78 MB）
  - 双击安装，可选安装目录，自动创建桌面 + 开始菜单快捷方式，带卸载器
  - 静默安装：`ShachangShowdown-Setup-1.0.0.exe /S /D=D:\目标目录`（/D 必须是最后一个参数）
- 便携版：`dist/win-unpacked/沙场对决.exe`（在构建目录 C:\sw-build\dist 内，可直接运行）

## 已验证

| 项目 | 结果 |
| --- | --- |
| 便携版启动 | ✅ 主菜单正常渲染（Chromium 140 / Electron 38.2.0） |
| 静默安装到用户目录 | ✅ 文件完整、快捷方式创建 |
| 安装后运行 | ✅ 正常启动 |
| 静默卸载 | ✅ 目录、快捷方式、注册表卸载项全部清除 |

注意：测试时发现「安装到 C:\ 根目录」在沙箱环境下会失败，属测试环境限制；
正常双击安装（默认装到 `%LOCALAPPDATA%\Programs\沙场对决`）不受影响。

## 工程结构

```
desktop/
├── package.json      # electron-builder 配置（NSIS 目标、图标、中文产品名）
├── main.js           # Electron 主进程：1280x920 窗口、F11 全屏、单实例锁
├── make_icon.py      # 用 PIL 生成应用图标（星球 + 轨道环 + 三颗卫星）
└── build/icon.ico    # 应用图标
```

游戏本体（`index.html` + `engine/`）在构建前需复制到打包目录的 `app/` 下。

## 重新打包步骤

```bash
# 1. 同步最新游戏文件到打包目录
mkdir -p /c/sw-build/app
cp index.html /c/sw-build/app/
cp -r engine /c/sw-build/app/

# 2. 同步桌面工程
cp desktop/package.json desktop/main.js /c/sw-build/
cp desktop/build/icon.ico /c/sw-build/build/

# 3. 安装依赖（首次）并打包
cd /c/sw-build
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" \
ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/" \
CSC_IDENTITY_AUTO_DISCOVERY=false \
npm install && npx electron-builder --win

# 4. 产物在 C:\sw-build\dist\，复制回本项目 dist\ 即可
```

## 踩坑记录（重要）

1. **winCodeSign 解压失败**：官方归档含 macOS 符号链接，Windows 非管理员无法创建。
   解决：预置解压好的目录到
   `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`
   （剔除 darwin 子目录即可）。
2. **uninstaller 签名 spawn UNKNOWN**：本机 signtool 签名调用失败。
   解决：加环境变量 `CSC_IDENTITY_AUTO_DISCOVERY=false`（无证书本就不需要签名）。
3. **测试 exe 启动立即退出（rc=0/9）**：WorkBuddy 等宿主环境注入了
   `ELECTRON_RUN_AS_NODE=1` 和 `NODE_OPTIONS`，会让 Electron 二进制以纯 Node 模式启动。
   仅影响测试脚本，双击运行不受影响；脚本测试时需清掉这两个变量。
4. 下载全部走 npmmirror 镜像，避免 GitHub 直连超时。
