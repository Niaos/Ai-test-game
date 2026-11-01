// tune.js —— 用困难 AI 当陪练，网格搜索 TerritoryAI 的关键参数
'use strict';
const path = require('path');
const Sim = require(path.join(__dirname, '../engine/sim.js'));
const Bots = require(path.join(__dirname, '../engine/bots.js'));
const AI = require(path.join(__dirname, 'territory-ai.js'));

const SIZES = [
  { cols: 6, rows: 9, cities: 2 },
  { cols: 8, rows: 12, cities: 3 },
  { cols: 10, rows: 15, cities: 4 }
];

const SPAR = [
  () => Bots.makeAI('hard'),
  () => Bots.get('greedy').decide,
  () => Bots.get('swarm').decide
];

function benchmark(params, sparring, seeds, sizes) {
  let score = 0, games = 0;
  const norm = (x) => (typeof x === 'string'
    ? (['easy', 'normal', 'hard'].includes(x) ? () => Bots.makeAI(x) : () => Bots.get(x).decide)
    : x);
  const list = (Array.isArray(sparring) ? sparring : [sparring]).map(norm);
  for (const opp of list) {
    for (const sz of sizes) {
      for (let i = 1; i <= seeds; i++) {
        const m = Sim.runMatch({
          seed: i * 131 + 17,
          cols: sz.cols, rows: sz.rows, cities: sz.cities,
          botAFactory: () => AI.makeTerritoryAI(params),
          botB: opp()
        });
        score += m.scoreA;
        games += 2;
      }
    }
  }
  return score / games;
}

const seeds = Number(process.argv[2] || 6);
const base = Object.assign({}, AI.DEFAULTS);

console.log('=== 初始参数 vs 三档 AI ===');
for (const lv of ['easy', 'normal', 'hard']) {
  console.log(`  vs ${lv}: ${(benchmark(base, lv, seeds, SIZES) * 100).toFixed(0)}%`);
}

// 坐标下降：逐个参数在候选值里挑最优（对手固定为 hard）
const SPACE = {
  keepMin: [4, 6, 8, 11, 14],
  reserveRatio: [0.1, 0.18, 0.25, 0.35, 0.45],
  margin: [1, 3, 4, 6, 9],
  cityWeight: [1.5, 2.4, 3.2, 4.5, 6],
  enemyWeight: [1.0, 1.6, 2.2, 3.0],
  distPenalty: [0.6, 1.0, 1.4, 2.0, 2.8],
  safeRatio: [0.7, 0.85, 1.0],
  reinforceRatio: [1.0, 1.15, 1.35],
  aggressiveAt: [1.4, 2.0, 2.8],
  aggressiveReserve: [0.06, 0.12, 0.2],
  borderReserve: [0.2, 0.35, 0.5, 0.65],
  borderRange: [1.5, 2.2, 3],
  counterWeight: [0, 1.0, 1.5, 2.5]
};

let best = Object.assign({}, base);
let bestScore = benchmark(best, SPAR, seeds, SIZES);
console.log(`\n=== 坐标下降（陪练：hard+greedy+swarm，${seeds} 组种子 × 3 尺寸）===`);
console.log(`起点 ${(bestScore * 100).toFixed(1)}%`);

for (let round = 1; round <= 2; round++) {
  let improved = false;
  for (const key of Object.keys(SPACE)) {
    let localBest = best[key], localScore = bestScore;
    for (const v of SPACE[key]) {
      if (v === best[key]) continue;
      const cand = Object.assign({}, best, { [key]: v });
      const s = benchmark(cand, SPAR, seeds, SIZES);
      if (s > localScore + 1e-9) { localScore = s; localBest = v; }
    }
    if (localBest !== best[key]) {
      console.log(`  R${round} ${key}: ${best[key]} → ${localBest}  (${(bestScore * 100).toFixed(1)}% → ${(localScore * 100).toFixed(1)}%)`);
      best[key] = localBest;
      bestScore = localScore;
      improved = true;
    }
  }
  if (!improved) { console.log(`  R${round} 无进一步提升，提前收敛`); break; }
}

console.log('\n=== 调优后参数 ===');
console.log(JSON.stringify(best, null, 2));
console.log(`\n对 hard 胜率: ${(bestScore * 100).toFixed(1)}%`);
for (const lv of ['easy', 'normal', 'hard', 'greedy', 'swarm']) {
  const opp = ['easy', 'normal', 'hard'].includes(lv) ? (() => Bots.makeAI(lv)) : (() => Bots.get(lv).decide);
  console.log(`  vs ${lv}: ${(benchmark(best, opp, seeds * 2, SIZES) * 100).toFixed(0)}%`);
}
