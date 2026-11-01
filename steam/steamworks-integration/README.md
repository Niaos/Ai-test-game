# Steamworks 集成骨架（先上架、后补成就用）

本目录是**预留骨架**，当前游戏代码未接入。首次上架用不到它；
等商店页审核通过、决定加成就/云存档时，按下面步骤启用。

## 成就规划（对应已生成的图标）

| 成就 API 名 | 显示名 | 图标 | 触发点 |
|---|---|---|---|
| `ACH_FIRST_WIN` | 初战告捷 | `steam/assets/optional/ach_first_win.png` | 第一次赢下一局 |
| `ACH_CONQUEROR` | 版图统一 | `ach_conqueror.png` | 占领全图（大胜） |
| `ACH_CODER` | 算法工程师 | `ach_coder.png` | 代码模式完成一局 |
| `ACH_DOMINATOR` | 星域霸主 | `ach_dominator.png` | 困难难度获胜 |

> Steamworks 后台 → 技术信息 → 成就 里先创建同名成就并上传两张图标
> （彩色为已解锁图，`*_locked.png` 灰版为未解锁图），名字必须和上表一致。

## 启用步骤

1. 桌面工程 `desktop/` 里安装依赖：

   ```
   npm install steamworks.js
   ```

2. 把 `main.steam.js` 的内容合入 `desktop/main.js`（只复制 `steamworks` 相关段，
   见文件内注释标记）。

3. 把 `game-bridge.js` 插入 `index.html` 主脚本末尾（它监听结算事件激活成就）。

4. 开发期测试：把 `steam_appid.txt`（内容为 480 或真实 AppID）放在游戏根目录，
   同时保持 Steam 客户端已登录运行，`npm start` 即可连上测试 App 480（Spacewar）
   验证成就弹出。

5. 拿到真实 AppID 后：
   - `package.json` 里 `"build"` 配置无需改动
   - 删掉 depot 里的 `steam_appid.txt`（depot_build 脚本已自动排除）
   - steamworks.js 的 `init(480)` 改成 `init(真实AppID)`

## 常见坑

- **steamworks.js 初始化失败**：99% 是 Steam 客户端没开，或 steam_appid.txt
  不在进程工作目录。Electron 下建议 `process.chdir(path.dirname(app.getPath('exe')))`。
- **成就不弹**：后台成就设为「已发布」才会对玩家可见；测试时用 App 480 弹的是
  Spacewar 的成就位。
- **云存档**：需要把 localStorage 数据定期写到
  `app.getPath('userData')/save.json`，再在后台开启 Cloud 配置，参考
  `main.steam.js` 里的 `flushSave()`。
