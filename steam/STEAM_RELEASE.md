# 沙场对决 · Steam 上架执行手册

目标：把游戏以 **Windows 内容 Depot** 形式上传到 Steamworks，并完成商店页配置。
当前使用测试 AppID **480**（Spacewar），拿到真实 AppID 后按 §2 替换即可。

```
steam/
├── assets/
│   ├── required/        ← 商店页必填素材（名称即用途与尺寸）
│   ├── optional/        ← 成就图标（彩色 + 灰版，先备好）
│   └── screenshots/     ← 5 张 1920×1080 实机截图
├── scripts/
│   ├── app_build_480.vdf      ← steamcmd 构建入口
│   ├── depot_build_481.vdf    ← depot 打包规则（排除项在此）
│   ├── prepare_depot.py       ← 从 electron-builder 产物生成 depot/
│   └── prepare_depot 生成的 depot/ 与 output/ 不入库
├── steamworks-integration/    ← 成就/云存档骨架（本期不接入）
└── STEAM_RELEASE.md           ← 本文件
```

---

## §1 前置条件（后台部分，网页操作）

1. 登录 <https://partner.steamgames.com>，进入你的应用（AppID 已有 ✓）
2. 左侧 **「技术信息」** 页确认：
   - **内容 Depot**：记下 Windows 内容 Depot 的数字 ID（默认一般为 AppID+1；
     如果不同，改 `depot_build_481.vdf` 的文件名和 `"DepotID"`）
   - 你的账号在该应用拥有 **「编辑应用元数据」+「构建上传」** 权限
3. 左侧 **「支持」→「安装」**：确认 Windows 平台已勾选

## §2 替换真实 AppID（3 处）

```
scripts/app_build_480.vdf   → 重命名为 app_build_<AppID>.vdf，改 "appid" "<AppID>"
scripts/depot_build_481.vdf → 重命名为 depot_build_<DepotID>.vdf，改 "DepotID"
scripts/prepare_depot.py    → 运行时参数传入真实 AppID
```

## §3 准备上传内容

把最新版游戏打出包（见 `desktop/BUILD.md`），然后：

```bash
cd steam/scripts
python prepare_depot.py <AppID>     # 生成 depot/（约 300 MB）
```

自检：`depot/沙场对决.exe` 存在、`depot/steam_appid.txt` 内容为 AppID。

## §4 上传（steamcmd）

1. 下载 steamcmd（官方直链，无需安装）：
   <https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip> → 解压到任意目录
2. 执行（cmd / PowerShell）：

   ```
   steamcmd.exe +login 你的Steam用户名 +run_app_build ..\scripts\app_build_480.vdf +quit
   ```

   - 首次登录会要求 **Steam Guard 验证码**（邮箱或手机令牌），输入一次即可
   - 若提示 `Timer expired` / 登录失败：Steam 令牌手机端确认一下登录请求
   - 上传约 300MB，完成后 `output\` 里会出现 build 清单日志
3. 提示 `Successfully committed build` 即成功。**默认分支不会自动上线**，
   需要到后台手动发布（§6）

> 网络提示：上传走 Steam CDN。若连接不稳，steamcmd 支持断点续传，重跑同一条命令即可。

## §5 商店页配置（后台「商店管理」）

### 5.1 图形素材上传对照

| 后台位置 | 上传文件 |
|---|---|
| 主宣传图（Header Capsule） | `required/header_capsule_920x430.jpg` |
| 小型宣传图（Small Capsule） | `required/small_capsule_462x174.jpg` |
| 大型宣传图（Main Capsule） | `required/main_capsule_1232x706.jpg` |
| 垂直宣传图（Vertical Capsule） | `required/vertical_capsule_748x896.jpg` |
| 页面背景（Page Background） | `required/page_background_1438x810.jpg` |
| 图书馆胶囊（Library Capsule） | `required/library_capsule_600x900.jpg` |
| 图书馆主图（Library Hero） | `required/library_hero_3840x1240.jpg` |
| 图书馆 Logo（Library Logo） | `required/library_logo_1280x720.png`（透明底） |
| 客户端图标（Client Icon） | `required/client_icon.ico` |
| 截图（Screenshots） | `screenshots/01~05.png`（建议顺序：01 鼠标模式 → 02 代码模式 → 05 主菜单 → 03 手册 → 04 结算） |

### 5.2 文案模板

- **一句话简介**：写代码指挥你的星球军团，对抗内置 AI 与其他程序员。
- **关于游戏**（可直接用 README.md 的「简介 + 三种玩法 + 引擎设计」三节）
- **标签**：策略 / 休闲 / 编程 / 人工智能 / 回合制战术 / 极简
- **系统需求**（最低）：
  - OS: Windows 10 64-bit
  - 处理器: 双核 1.6 GHz
  - 内存: 4 GB
  - 存储: 500 MB
  - 附注: 无独立显卡要求（Canvas 2D 渲染）
- **年龄分级问卷**：无暴力描写（抽象光点对战）、无不当内容，全选否即可

### 5.3 价格与发布

1. **定价**：建议先免费（测试期）或 ¥12 档位；改价随时可调
2. 提交商店页审核（通常 1-3 个工作日）
3. 审核通过后：**「构建」页 → 你的 build → 「设为可用/发布」** 推送到默认分支
4. 玩家端 Steam 客户端 10 分钟内可见

## §6 上架后验证清单

- [ ] Steam 库中安装，从客户端启动正常
- [ ] Shift+Tab 覆盖层可呼出（Electron 默认支持）
- [ ] 退出重进，设置/算法存档还在（localStorage 在 userData 下持久化）
- [ ] 商店页图片在各分辨率不糊（重点看 small capsule）
- [ ] 「保存我的算法换对手」功能在覆盖层浏览器内核下正常

## §7 之后补成就/云存档

见 `steamworks-integration/README.md`。核心三步：
`npm install steamworks.js` → 合入 `main.steam.js` 标注段 → `game-bridge.js` 进 index.html。
成就图标（4 组彩色+灰版）已在 `assets/optional/` 备好。

## §8 常见报错

| 报错 | 原因 / 处理 |
|---|---|
| `ERROR! Need MFA code` | 输入 Steam Guard 验证码（+set_steam_guard_code 也可） |
| `Access denied / build not owned` | 你的账号没有该 App 的构建权限，后台「安全」里加人 |
| `Invalid depot ID` | DepotID 与后台不一致，回 §2 核对 |
| `No depots in app` | 后台技术信息页没建 Windows 内容 Depot，先建再传 |
| vdf 解析失败 | 检查引号/括号是否成对，注释只能整行 `//` |
