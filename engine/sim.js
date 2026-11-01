/*
 * sim.js —— 沙场对决 · 确定性模拟内核（支持可变棋盘尺寸）
 * 纯逻辑、无渲染依赖，浏览器与 Node 均可运行。
 *
 * 设计要点：
 *  1) 固定步长 0.05s（20 tick/秒），决策每 0.2s 一次 → 同种子同算法必得同结果。
 *  2) 地图与随机数全部走种子化 RNG（mulberry32），不使用 Math.random。
 *  3) 地图中心对称：驻军、城池均成对镜像布置，双方到最近城池距离一致。
 *  4) 双方同时决策（基于同一快照），落地顺序逐回合交替，消除先手偏差。
 */
(function (root) {
  'use strict';

  var CFG = {
    COLS: 8,                // 默认列数
    ROWS: 12,               // 默认行数
    DT: 0.05,
    DECISION_INTERVAL: 0.2,
    MAX_ORDERS: 4,
    TRAVEL: 0.30,
    CAP_NORMAL: 110,
    CAP_CITY: 180,
    RATE_NORMAL: 1.9,
    RATE_CITY: 3.4,
    TIME_LIMIT: 180,
    NEUTRAL: -1,
    BOARD_SIZES: {
      small: { cols: 6, rows: 9, label: '小 · 6×9', cities: 2 },
      normal: { cols: 8, rows: 12, label: '标准 · 8×12', cities: 3 },
      large: { cols: 10, rows: 15, label: '大 · 10×15', cities: 4 }
    }
  };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 中心对称镜像坐标
  function mirrorOf(c, r, cols, rows) { return { c: cols - 1 - c, r: rows - 1 - r }; }

  function startCells(cols, rows) {
    return {
      p0: [[0, rows - 2], [0, rows - 1], [1, rows - 1]],
      p1: [[cols - 1, 1], [cols - 1, 0], [cols - 2, 0]]
    };
  }

  // 按棋盘尺寸生成对称城池：从相对位置候选中挑 cityPairs 对，避开出生角落
  function buildCityPairs(cols, rows, count, rng) {
    var candidates = [
      [0.12, 0.72], [0.28, 0.42], [0.50, 0.62],
      [0.18, 0.50], [0.38, 0.78], [0.62, 0.28]
    ];
    var starts = startCells(cols, rows);
    var taken = {};
    starts.p0.concat(starts.p1).forEach(function (p) { taken[p[0] + ',' + p[1]] = 1; });

    var pairs = [];
    for (var i = 0; i < candidates.length && pairs.length < count; i++) {
      var f = candidates[(i + Math.floor(rng() * 3)) % candidates.length];
      var c = Math.max(1, Math.min(cols - 2, Math.round(f[0] * (cols - 1))));
      var r = Math.max(1, Math.min(rows - 2, Math.round(f[1] * (rows - 1))));
      var m = mirrorOf(c, r, cols, rows);
      if (!m) continue;
      if (taken[c + ',' + r] || taken[m.c + ',' + m.r]) continue;
      taken[c + ',' + r] = 1;
      taken[m.c + ',' + m.r] = 1;
      pairs.push([[c, r], [m.c, m.r]]);
    }
    return pairs;
  }

  // ---------- 建局 ----------
  // createGame(seed) 或 createGame({seed, cols, rows, cities})
  function createGame(seedOrOpts) {
    var opts = (typeof seedOrOpts === 'number') ? { seed: seedOrOpts } : (seedOrOpts || {});
    var seed = opts.seed >>> 0;
    var cols = opts.cols || CFG.COLS;
    var rows = opts.rows || CFG.ROWS;
    var cityCount = (opts.cities === undefined) ? 3 : opts.cities;

    var rng = mulberry32(seed);
    var cells = [];
    var r, c;

    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        cells.push({
          id: r * cols + c, c: c, r: r,
          owner: CFG.NEUTRAL, troops: 0,
          type: 'plain', cap: CFG.CAP_NORMAL, rate: CFG.RATE_NORMAL
        });
      }
    }

    // 中立驻军：镜像格共用同一个采样值 → 完全公平
    var sampled = {};
    for (var i = 0; i < cells.length; i++) {
      var cc = cells[i];
      var mid = (rows - 1 - cc.r) * cols + (cols - 1 - cc.c);
      var key = Math.min(cc.id, mid);
      if (!(key in sampled)) sampled[key] = Math.round(16 + rng() * 30);
      cc.troops = sampled[key];
    }

    // 城池（中心对称成对）
    var pairs = buildCityPairs(cols, rows, cityCount, rng);
    pairs.forEach(function (pair) {
      var val = Math.round(60 + rng() * 35);
      pair.forEach(function (p) {
        var x = cells[p[1] * cols + p[0]];
        if (!x) return;
        x.type = 'city';
        x.cap = CFG.CAP_CITY;
        x.rate = CFG.RATE_CITY;
        x.troops = val;
      });
    });

    // 出生地
    var starts = startCells(cols, rows);
    starts.p0.forEach(function (p) {
      var x = cells[p[1] * cols + p[0]];
      if (x) { x.owner = 0; x.troops = 42; }
    });
    starts.p1.forEach(function (p) {
      var x = cells[p[1] * cols + p[0]];
      if (x) { x.owner = 1; x.troops = 42; }
    });

    return {
      seed: seed,
      cols: cols,
      rows: rows,
      cells: cells,
      armies: [],
      tick: 0,
      time: 0,
      over: false,
      winner: null,
      reason: '',
      errors: [],
      orders: { 0: 0, 1: 0 },
      stats: { ordersP0: 0, ordersP1: 0, illegalP0: 0, illegalP1: 0, exceptions: 0 }
    };
  }

  function distCells(a, b) {
    var dc = a.c - b.c, dr = a.r - b.r;
    return Math.sqrt(dc * dc + dr * dr);
  }

  function recordError(g, player, msg) {
    g.errors.push({ time: +g.time.toFixed(2), player: player, msg: msg });
    if (player === 0) g.stats.illegalP0++; else g.stats.illegalP1++;
    if (g.errors.length > 200) g.errors.shift();
  }

  function launch(g, player, from, to, ratio) {
    var amount = Math.floor(from.troops * ratio);
    if (amount < 1) amount = 1;
    if (amount > from.troops) amount = from.troops;
    from.troops -= amount;
    var d = distCells(from, to);
    var travel = Math.max(CFG.DT, d * CFG.TRAVEL);
    g.armies.push({
      owner: player,
      from: from.id,
      to: to.id,
      amount: amount,
      total: travel,
      remaining: travel
    });
  }

  function trySend(g, player, fromId, toId, ratio) {
    var from = g.cells[fromId];
    var to = g.cells[toId];
    if (!from || !to) { recordError(g, player, '无效的地块 id: ' + fromId + ' → ' + toId); return false; }
    if (from.owner !== player) { recordError(g, player, '只能从自己的地块出兵: ' + fromId); return false; }
    if (from.id === to.id) { recordError(g, player, '目标不能是出发地块: ' + fromId); return false; }
    if (from.troops < 2) { recordError(g, player, '地块 ' + fromId + ' 兵力不足（<2）'); return false; }
    var r = (ratio === undefined || ratio === null) ? 1 : Number(ratio);
    if (!isFinite(r) || r <= 0 || r > 1) { recordError(g, player, 'ratio 必须在 (0,1] 内，收到: ' + ratio); return false; }
    launch(g, player, from, to, r);
    return true;
  }

  // ---------- 单步推进 ----------
  function step(g, dt) {
    dt = dt === undefined ? CFG.DT : dt;
    if (g.over) return;

    g.time += dt;
    g.tick++;

    for (var i = 0; i < g.cells.length; i++) {
      var c = g.cells[i];
      if (c.owner === CFG.NEUTRAL) continue;
      if (c.troops < c.cap) c.troops = Math.min(c.cap, c.troops + c.rate * dt);
    }

    for (var k = g.armies.length - 1; k >= 0; k--) {
      var a = g.armies[k];
      a.remaining -= dt;
      if (a.remaining > 0) continue;
      var target = g.cells[a.to];
      if (!target) { g.armies.splice(k, 1); continue; }
      if (target.owner === a.owner) {
        target.troops += a.amount;
      } else {
        target.troops -= a.amount;
        if (target.troops < 0) {
          target.owner = a.owner;
          target.troops = -target.troops;
        }
      }
      g.armies.splice(k, 1);
    }

    var p0 = 0, p1 = 0;
    for (var j = 0; j < g.cells.length; j++) {
      if (g.cells[j].owner === 0) p0++;
      else if (g.cells[j].owner === 1) p1++;
    }
    if (p0 === 0 || p1 === 0) {
      g.over = true;
      g.winner = p1 === 0 ? 0 : 1;
      g.reason = 'elimination';
    } else if (g.time >= CFG.TIME_LIMIT) {
      g.over = true;
      g.reason = 'timeout';
      if (p0 !== p1) {
        g.winner = p0 > p1 ? 0 : 1;
      } else {
        var t0 = 0, t1 = 0;
        for (var m = 0; m < g.cells.length; m++) {
          if (g.cells[m].owner === 0) t0 += g.cells[m].troops;
          else if (g.cells[m].owner === 1) t1 += g.cells[m].troops;
        }
        if (Math.round(t0) !== Math.round(t1)) g.winner = t0 > t1 ? 0 : 1;
        else g.winner = 'draw';
      }
    }
  }

  // ---------- 决策视图 ----------
  function snapshotCell(c) {
    return { id: c.id, c: c.c, r: c.r, owner: c.owner, troops: Math.round(c.troops), cap: c.cap, rate: c.rate, type: c.type };
  }

  function makeContext(g, player, rand, sink) {
    var mine = [], enemies = [], neutrals = [], all = [], incoming = [];
    for (var i = 0; i < g.cells.length; i++) {
      var c = g.cells[i];
      var v = snapshotCell(c);
      all.push(v);
      if (c.owner === player) mine.push(v);
      else if (c.owner === CFG.NEUTRAL) neutrals.push(v);
      else enemies.push(v);
    }
    for (var k = 0; k < g.armies.length; k++) {
      var a = g.armies[k];
      if (a.owner !== player && g.cells[a.to] && g.cells[a.to].owner === player) {
        incoming.push({ to: a.to, from: a.from, amount: a.amount, eta: +a.remaining.toFixed(2) });
      }
    }

    var ctx = {
      tick: g.tick,
      time: +g.time.toFixed(2),
      me: player,
      cols: g.cols,
      rows: g.rows,
      cells: all,
      mine: mine,
      enemies: enemies,
      neutrals: neutrals,
      incoming: incoming,
      ordersLeft: CFG.MAX_ORDERS,
      rand: rand,
      dist: function (a, b) { return +distCells(g.cells[a], g.cells[b]).toFixed(3); },
      eta: function (a, b) { return +(distCells(g.cells[a], g.cells[b]) * CFG.TRAVEL).toFixed(2); },
      send: function (fromId, toId, ratio) {
        if (ctx.ordersLeft <= 0) {
          recordError(g, player, '超出单次决策指令上限（' + CFG.MAX_ORDERS + ' 条）');
          return false;
        }
        var from = g.cells[fromId], to = g.cells[toId];
        if (!from || !to) { recordError(g, player, '无效的地块 id: ' + fromId + ' → ' + toId); return false; }
        if (from.owner !== player) { recordError(g, player, '只能从自己的地块出兵: ' + fromId); return false; }
        if (from.id === to.id) { recordError(g, player, '目标不能是出发地块: ' + fromId); return false; }
        var r = (ratio === undefined || ratio === null) ? 1 : Number(ratio);
        if (!isFinite(r) || r <= 0 || r > 1) { recordError(g, player, 'ratio 必须在 (0,1] 内，收到: ' + ratio); return false; }
        ctx.ordersLeft--;
        sink.push({ from: fromId, to: toId, ratio: r });
        if (player === 0) g.stats.ordersP0++; else g.stats.ordersP1++;
        return true;
      }
    };
    return ctx;
  }

  function applyOrders(g, player, sink) {
    var accepted = 0;
    for (var i = 0; i < sink.length; i++) {
      var o = sink[i];
      if (trySend(g, player, o.from, o.to, o.ratio)) accepted++;
    }
    sink.length = 0;
    return accepted;
  }

  // ---------- 跑完整一局（无渲染） ----------
  function runGame(opts) {
    var g = createGame({ seed: opts.seed, cols: opts.cols, rows: opts.rows, cities: opts.cities });
    var rand0 = mulberry32((opts.seed * 7919 + 11) >>> 0);
    var rand1 = mulberry32((opts.seed * 104729 + 7) >>> 0);
    var bot0 = opts.bot0 || (opts.bot0Factory ? opts.bot0Factory() : null);
    var bot1 = opts.bot1 || (opts.bot1Factory ? opts.bot1Factory() : null);
    var sink0 = [], sink1 = [];
    var acc = 0, round = 0;

    while (!g.over) {
      if (acc <= 1e-9) {
        var ctx0 = makeContext(g, 0, rand0, sink0);
        try { bot0(ctx0); } catch (e) {
          g.stats.exceptions++; recordError(g, 0, '算法异常: ' + (e && e.message ? e.message : String(e)));
        }
        var ctx1 = makeContext(g, 1, rand1, sink1);
        try { bot1(ctx1); } catch (e2) {
          g.stats.exceptions++; recordError(g, 1, '对手异常: ' + (e2 && e2.message ? e2.message : String(e2)));
        }
        if (round % 2 === 0) { applyOrders(g, 0, sink0); applyOrders(g, 1, sink1); }
        else { applyOrders(g, 1, sink1); applyOrders(g, 0, sink0); }
        round++;
        acc += CFG.DECISION_INTERVAL;
      }
      step(g, CFG.DT);
      acc -= CFG.DT;
    }

    var p0 = 0, p1 = 0;
    for (var i = 0; i < g.cells.length; i++) {
      if (g.cells[i].owner === 0) p0++;
      else if (g.cells[i].owner === 1) p1++;
    }
    return {
      seed: g.seed, winner: g.winner, reason: g.reason,
      time: +g.time.toFixed(2), cellsP0: p0, cellsP1: p1,
      stats: g.stats, errors: g.errors.slice(-5)
    };
  }

  function runMatch(opts) {
    var forward = runGame({ seed: opts.seed, cols: opts.cols, rows: opts.rows, cities: opts.cities, bot0: opts.botA, bot0Factory: opts.botAFactory, bot1: opts.botB });
    var reverse = runGame({ seed: opts.seed, cols: opts.cols, rows: opts.rows, cities: opts.cities, bot0: opts.botB, bot1: opts.botA, bot1Factory: opts.botAFactory });

    var scoreA = 0, scoreB = 0;
    function credit(winner, aIsPlayer0) {
      if (winner === 'draw') { scoreA += 0.5; scoreB += 0.5; return; }
      var aWon = (winner === 0) === aIsPlayer0;
      if (aWon) scoreA++; else scoreB++;
    }
    credit(forward.winner, true);
    credit(reverse.winner, false);

    return {
      seed: opts.seed, scoreA: scoreA, scoreB: scoreB,
      games: [forward, reverse],
      time: (forward.time + reverse.time) / 2,
      illegal: forward.stats.illegalP0 + forward.stats.illegalP1 + reverse.stats.illegalP0 + reverse.stats.illegalP1,
      exceptions: forward.stats.exceptions + reverse.stats.exceptions
    };
  }

  var api = {
    CFG: CFG,
    createGame: createGame,
    step: step,
    makeContext: makeContext,
    applyOrders: applyOrders,
    trySend: trySend,
    runGame: runGame,
    runMatch: runMatch,
    mulberry32: mulberry32,
    boardSize: function (key) { return CFG.BOARD_SIZES[key] || CFG.BOARD_SIZES.normal; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
