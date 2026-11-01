// ============================================================
// 游戏侧桥接：监听结算事件解锁成就
// 用法：整段复制到 index.html 主 <script> 末尾（仅 Electron 环境生效）
// ============================================================
(function () {
  if (!window.steam || typeof window.steam.unlock !== 'function') return;

  // 结算时机：endGame() 更新 verdict 后。用 MutationObserver 盯结算标题
  var el = document.getElementById('verdict');
  if (!el) return;

  var fired = { win: false, big: false, code: false, hard: false };

  new MutationObserver(function () {
    var v = (el.textContent || '').trim();
    var A = window.__sw && window.__sw.app;
    var isWin = v.indexOf('大胜') >= 0 || v.indexOf('小胜') >= 0;
    if (!isWin) return;

    if (!fired.win) { fired.win = true; steam.unlock('ACH_FIRST_WIN'); }
    if (v.indexOf('大胜') >= 0 && !fired.big) { fired.big = true; steam.unlock('ACH_CONQUEROR'); }
    if (A && A.settings.mode === 'code' && !fired.code) { fired.code = true; steam.unlock('ACH_CODER'); }
    if (A && A.settings.level === 'hard' && !fired.hard) { fired.hard = true; steam.unlock('ACH_DOMINATOR'); }
  }).observe(el, { childList: true, characterData: true, subtree: true });

  console.log('[steam] achievement bridge ready');
})();
