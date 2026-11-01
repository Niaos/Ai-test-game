/*
 * bots.js —— 对手算法库
 *  - makeAI(level)：默认敌人，三档难度（菜单里选）
 *  - random / greedy / swarm / turtle：算法实验场的基准对照组
 * 所有 bot 都是 decide(ctx) 形式，走与玩家代码完全相同的 API。
 */
(function (root) {
  'use strict';

  var PRESETS = {
    easy:   { name: '简单', every: 10, adv: 1.60, group: 2, scan: 2, defense: false },
    normal: { name: '普通', every: 6,  adv: 1.25, group: 3, scan: 2, defense: false },
    hard:   { name: '困难', every: 3,  adv: 1.00, group: 5, scan: 3, defense: true }
  };

  function byTroopsDesc(a, b) { return b.troops - a.troops; }
  function byTroopsAsc(a, b) { return a.troops - b.troops; }

  // ---------- 默认敌人：参数化 AI（三档难度） ----------
  function makeAI(level) {
    var P = PRESETS[level] || PRESETS.normal;
    var calls = 0;

    return function decideAI(ctx) {
      if (!ctx.mine.length) return;
      if (calls++ % P.every !== 0) return;

      // 1) 困难档：判断有没有守不住的地块，从附近调兵增援
      if (P.defense && ctx.incoming.length) {
        var threatBy = {};
        ctx.incoming.forEach(function (inc) {
          threatBy[inc.to] = (threatBy[inc.to] || 0) + inc.amount;
        });
        for (var id in threatBy) {
          var cell = null;
          for (var i = 0; i < ctx.mine.length; i++) if (ctx.mine[i].id === +id) cell = ctx.mine[i];
          if (!cell || threatBy[id] < cell.troops * 0.8) continue;
          var helpers = ctx.mine.filter(function (m) { return m.id !== cell.id && m.troops >= 20; })
            .sort(function (a, b) { return ctx.dist(a.id, cell.id) - ctx.dist(b.id, cell.id); });
          if (helpers.length && ctx.send(helpers[0].id, cell.id, 0.75)) return;
        }
      }

      // 2) 找性价比最高的目标（越弱越好、城池加分、玩家的地优先）
      var best = null, bestScore = -Infinity;
      for (var s = 0; s < ctx.mine.length; s++) {
        var src = ctx.mine[s];
        if (src.troops < 15) continue;
        for (var t = 0; t < ctx.cells.length; t++) {
          var target = ctx.cells[t];
          if (target.owner === ctx.me) continue;
          if (ctx.dist(src.id, target.id) > P.scan + 1) continue;
          var need = Math.ceil(target.troops * P.adv) + 4;
          if (src.troops < need) continue;
          var score = (target.type === 'city' ? 55 : 0) + (target.owner === 0 ? 30 : 0)
            - target.troops * 0.6 - ctx.dist(src.id, target.id) * 6;
          if (score > bestScore) { bestScore = score; best = { src: src, target: target, need: need }; }
        }
      }
      if (!best) return;

      // 3) 集结：目标附近的己方地块一起压上
      var group = [best.src];
      var others = ctx.mine.filter(function (m) { return m.id !== best.src.id && m.troops >= 18; })
        .sort(function (a, b) { return ctx.dist(a.id, best.target.id) - ctx.dist(b.id, best.target.id); });
      for (var g = 0; g < others.length && group.length < P.group; g++) group.push(others[g]);

      var total = group.reduce(function (sum, m) { return sum + Math.floor(m.troops * 0.8); }, 0);
      if (total < best.need) return;

      for (var k = 0; k < group.length; k++) {
        if (ctx.ordersLeft <= 0) break;
        var from = group[k];
        if (from.troops < 12) continue;
        ctx.send(from.id, best.target.id, 0.8);
      }
    };
  }

  // ---------- 基准对照组（算法实验场用） ----------
  var Bots = {};

  Bots.random = {
    key: 'random', name: '随机乱打',
    desc: '每次决策有一半概率随手挑一个地块出兵，用来验证「你的算法是不是真的优于瞎打」。',
    decide: function (ctx) {
      if (!ctx.mine.length) return;
      if (ctx.rand() > 0.5) return;
      var src = ctx.mine[(ctx.rand() * ctx.mine.length) | 0];
      if (!src || src.troops < 5) return;
      var pool = ctx.cells.filter(function (c) { return c.owner !== ctx.me && c.id !== src.id; });
      if (!pool.length) return;
      var target = pool[(ctx.rand() * pool.length) | 0];
      ctx.send(src.id, target.id, 0.5);
    }
  };

  Bots.greedy = {
    key: 'greedy', name: '贪心扩张',
    desc: '每次挑兵力最多的一批地块，去打「打得起且最弱」的目标，城池优先。',
    decide: function (ctx) {
      var mine = ctx.mine.slice().sort(byTroopsDesc);
      for (var i = 0; i < mine.length; i++) {
        var src = mine[i];
        if (src.troops < 25) continue;
        var best = null, bestScore = -Infinity;
        for (var j = 0; j < ctx.cells.length; j++) {
          var t = ctx.cells[j];
          if (t.owner === ctx.me) continue;
          if (t.troops >= src.troops * 0.7) continue;
          var score = -t.troops + (t.type === 'city' ? 40 : 0) + 10;
          if (score > bestScore) { bestScore = score; best = t; }
        }
        if (best && !ctx.send(src.id, best.id, 0.7)) return;
      }
    }
  };

  Bots.swarm = {
    key: 'swarm', name: '集火弱点',
    desc: '锁定全图最脆的目标，从最近的三块强力地块同时压上，容易滚雪球。',
    decide: function (ctx) {
      if (!ctx.mine.length) return;
      var targets = ctx.cells.filter(function (c) { return c.owner !== ctx.me; }).sort(byTroopsAsc);
      if (!targets.length) return;
      var target = targets[0];
      var candidates = ctx.mine.slice().sort(function (a, b) {
        return ctx.dist(a.id, target.id) - ctx.dist(b.id, target.id);
      });
      var sent = 0;
      for (var i = 0; i < candidates.length && sent < 3; i++) {
        var src = candidates[i];
        if (src.troops < 18) continue;
        if (!ctx.send(src.id, target.id, 0.9)) break;
        sent++;
      }
    }
  };

  Bots.turtle = {
    key: 'turtle', name: '龟缩防守',
    desc: '几乎不主动扩张，只补刀极弱的中立地，兵力被压制时回援。',
    decide: function (ctx) {
      if (!ctx.mine.length) return;
      for (var i = 0; i < ctx.incoming.length; i++) {
        var inc = ctx.incoming[i];
        var cell = null;
        for (var j = 0; j < ctx.mine.length; j++) if (ctx.mine[j].id === inc.to) cell = ctx.mine[j];
        if (cell && inc.amount >= cell.troops) {
          var helper = ctx.mine.filter(function (m) { return m.id !== cell.id && m.troops >= 20; })
            .sort(function (a, b) { return ctx.dist(a.id, cell.id) - ctx.dist(b.id, cell.id); })[0];
          if (helper) { ctx.send(helper.id, cell.id, 0.8); return; }
        }
      }
      var mine = ctx.mine.slice().sort(byTroopsDesc);
      for (var m = 0; m < mine.length; m++) {
        var src = mine[m];
        if (src.troops < 55) continue;
        var soft = null;
        for (var n = 0; n < ctx.neutrals.length; n++) {
          if (ctx.neutrals[n].troops < src.troops * 0.4) { soft = ctx.neutrals[n]; break; }
        }
        if (soft && ctx.send(src.id, soft.id, 0.6)) return;
      }
    }
  };

  var ORDER = ['random', 'greedy', 'swarm', 'turtle'];

  var api = {
    PRESETS: PRESETS,
    makeAI: makeAI,
    all: Bots,
    order: ORDER,
    list: ORDER.map(function (k) { return Bots[k]; }),
    get: function (key) { return Bots[key]; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Bots = api;
})(typeof window !== 'undefined' ? window : globalThis);
