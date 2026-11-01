/*
 * territory-ai.js —— 《沙场对决》领地攻防算法（参数化版本，供调参与验证使用）
 *
 * 决策思路（每 0.2s 一次，最多 4 条指令）：
 *   1. 威胁评估：把所有来袭部队按目标地块合并，算出每个地块的缺口
 *   2. 防守优先：守不住的地块从最近的有余力星球调兵增援（含城池加权）
 *   3. 进攻打分：对每个「出发地 × 目标」组合算性价比 = 收益 / (所需兵力 + 距离代价)
 *      收益 = 基础分 + 城池加成 + 敌方地块加成；所需兵力 = 守军 + 安全边际
 *   4. 留存守军：按比例保留兵力，避免把自己的星球打空被偷
 *   5. 晚期激进：己方地块数明显领先时降低留守比例，加速收尾
 *
 * 该文件导出 makeTerritoryAI(params)，用于 Node 端批量调参；
 * 最终交付给游戏编辑器的版本是把默认参数内联进去的独立 decide(ctx)。
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    keepMin: 4,            // 每个星球至少留多少兵
    reserveRatio: 0.10,    // 或按比例留（取二者较大）
    margin: 1,             // 攻城时多带的兵，抵消对方产量
    cityWeight: 3.2,       // 城池价值权重
    enemyWeight: 3.0,      // 敌方地块额外价值权重（比中立地优先）
    distPenalty: 2.8,      // 距离惩罚系数（远距离出兵性价比低）
    safeRatio: 1.05,       // 守军 > 来袭 × safeRatio 视为守得住
    reinforceRatio: 1.15,  // 增援目标：兵力补到来袭的 1.15 倍
    aggressiveAt: 2.0,     // 地块数领先倍数 → 进入激进模式
    aggressiveReserve: 0.12,
    borderReserve: 0.35,   // 靠近敌方的星球额外留守比例（防偷袭）
    borderRange: 1.5,      // 多近算"边境"
    counterWeight: 1.5     // 刚出兵的敌方星球（此刻空虚）额外价值
  };

  function makeTerritoryAI(overrides) {
    var P = {};
    for (var k in DEFAULTS) P[k] = DEFAULTS[k];
    if (overrides) for (var j in overrides) P[j] = overrides[j];

    return function decide(ctx) {
      if (!ctx.mine || !ctx.mine.length) return;

      // ---------- 1. 威胁评估 ----------
      var threat = {};
      for (var i = 0; i < ctx.incoming.length; i++) {
        var inc = ctx.incoming[i];
        var t = threat[inc.to] || (threat[inc.to] = { amount: 0, eta: 99 });
        t.amount += inc.amount;
        if (inc.eta < t.eta) t.eta = inc.eta;
      }

      var mineById = {};
      for (var m = 0; m < ctx.mine.length; m++) mineById[ctx.mine[m].id] = ctx.mine[m];

      // ---------- 2. 防守 ----------
      var busy = {}; // 已经下达过指令的出发地
      for (var id in threat) {
        if (ctx.ordersLeft <= 0) return;
        var cell = mineById[id];
        if (!cell) continue;
        var inc2 = threat[id];
        if (cell.troops > inc2.amount * P.safeRatio) continue; // 守得住

        var need = Math.ceil(inc2.amount * P.reinforceRatio) - cell.troops;
        if (need <= 0) continue;

        // 从最近、且自己没有挨打的有余力星球调兵
        var helpers = ctx.mine.filter(function (mm) {
          return mm.id !== cell.id && !busy[mm.id] && !threat[mm.id] &&
            mm.troops > P.keepMin + 8;
        }).sort(function (a, b) {
          return (ctx.dist(a.id, cell.id) - ctx.dist(b.id, cell.id)) ||
                 (b.troops - a.troops);
        });

        if (helpers.length) {
          var h = helpers[0];
          var spare = h.troops - P.keepMin;
          var send = Math.min(spare, need + 4);
          if (send >= 4) {
            var ratio = send / h.troops;
            if (ctx.send(h.id, cell.id, Math.min(1, ratio))) busy[h.id] = 1;
          }
        }
      }

      // ---------- 3. 进攻 / 扩张 ----------
      var myCount = ctx.mine.length;
      var enemyCount = 0;
      for (var e = 0; e < ctx.cells.length; e++) {
        if (ctx.cells[e].owner === 1) enemyCount++;
      }
      var aggressive = (enemyCount > 0 && myCount / Math.max(1, enemyCount) > P.aggressiveAt);
      var reserve = aggressive ? P.aggressiveReserve : P.reserveRatio;

      var srcs = ctx.mine.slice().filter(function (mm) {
        return !busy[mm.id];
      }).sort(function (a, b) { return b.troops - a.troops; });

      // 已被前面指令"预定"打掉的兵力，避免 4 条指令全砸同一个目标造成溢出浪费
      var planned = {};

      // 刚出兵的敌方星球此刻驻军空虚 → 反击价值更高
      var enemySent = {};
      for (var q = 0; q < ctx.incoming.length; q++) enemySent[ctx.incoming[q].from] = 1;

      // 敌方星球列表，用于判定"边境"
      var enemyPos = [];
      for (var ep = 0; ep < ctx.cells.length; ep++) {
        if (ctx.cells[ep].owner !== ctx.me && ctx.cells[ep].owner !== -1) enemyPos.push(ctx.cells[ep]);
      }

      for (var s = 0; s < srcs.length; s++) {
        if (ctx.ordersLeft <= 0) break;
        var src = srcs[s];
        if (busy[src.id]) continue;

        // 边境星球留更多兵，避免被集火秒掉
        var reserveLocal = reserve;
        for (var b = 0; b < enemyPos.length; b++) {
          if (ctx.dist(src.id, enemyPos[b].id) <= P.borderRange) {
            reserveLocal = Math.max(reserveLocal, P.borderReserve);
            break;
          }
        }

        var keep = Math.max(P.keepMin, src.troops * reserveLocal);
        var avail = src.troops - keep;
        if (avail < 8) continue;

        var best = null, bestScore = 0;
        for (var c = 0; c < ctx.cells.length; c++) {
          var target = ctx.cells[c];
          if (target.owner === ctx.me) continue;

          var remain = target.troops - (planned[target.id] || 0);
          var want = Math.max(1, remain) + P.margin + 1;
          if (want > avail) continue;

          var value = 1;
          if (target.type === 'city') value += P.cityWeight;
          if (target.owner !== -1) value += P.enemyWeight;
          if (enemySent[target.id]) value += P.counterWeight;
          var score = value / (want + P.distPenalty * ctx.dist(src.id, target.id));
          if (score > bestScore) { bestScore = score; best = { target: target, want: want }; }
        }

        if (best) {
          var ratio2 = Math.min(1, (best.want + 2) / src.troops);
          if (ctx.send(src.id, best.target.id, ratio2)) {
            busy[src.id] = 1;
            planned[best.target.id] = (planned[best.target.id] || 0) + Math.floor(src.troops * ratio2);
          }
        }
      }
    };
  }

  var api = { makeTerritoryAI: makeTerritoryAI, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TerritoryAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
