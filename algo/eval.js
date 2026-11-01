// eval.js —— 留出集评估：多尺寸 × 多对手 × 大量种子（每种子正反两局）
'use strict';
const path = require('path');
const Sim = require(path.join(__dirname, '../engine/sim.js'));
const Bots = require(path.join(__dirname, '../engine/bots.js'));
const AI = require(path.join(__dirname, 'territory-ai.js'));

const SIZES = [
  { key: '小 6×9', cols: 6, rows: 9, cities: 2 },
  { key: '标准 8×12', cols: 8, rows: 12, cities: 3 },
  { key: '大 10×15', cols: 10, rows: 15, cities: 4 }
];

const SEEDS = Number(process.argv[2] || 30);
const params = process.argv[3] ? JSON.parse(process.argv[3]) : Object.assign({}, AI.DEFAULTS);

function evalOne(opponentFactory, size) {
  let score = 0, games = 0, time = 0, illegal = 0;
  for (let i = 1; i <= SEEDS; i++) {
    const m = Sim.runMatch({
      seed: 7000 + i * 197,
      cols: size.cols, rows: size.rows, cities: size.cities,
      botAFactory: () => AI.makeTerritoryAI(params),
      botB: opponentFactory()
    });
    score += m.scoreA;
    games += 2;
    time += m.time;
    illegal += m.illegal;
  }
  return { rate: score / games, games, avgTime: time / (games / 2), illegal };
}

const OPPONENTS = [
  { key: 'easy',   name: '难度：简单',   f: () => Bots.makeAI('easy') },
  { key: 'normal', name: '难度：普通',   f: () => Bots.makeAI('normal') },
  { key: 'hard',   name: '难度：困难',   f: () => Bots.makeAI('hard') },
  { key: 'greedy', name: '基准：贪心',   f: () => Bots.get('greedy').decide },
  { key: 'swarm',  name: '基准：集火',   f: () => Bots.get('swarm').decide },
  { key: 'turtle', name: '基准：龟缩',   f: () => Bots.get('turtle').decide },
  { key: 'random', name: '基准：随机',   f: () => Bots.get('random').decide },
  { key: 'self',   name: '自我对弈',     f: () => AI.makeTerritoryAI(params) }
];

console.log(`评估种子数 ${SEEDS}（每格 = ${SEEDS} 个种子 × 正反两局 = ${SEEDS * 2} 局）\n`);

const header = ['对手'.padEnd(12)].concat(SIZES.map(s => s.key.padStart(11))).join(' ');
console.log(header);
console.log('-'.repeat(header.length + 6));

const overall = {};
for (const op of OPPONENTS) {
  let line = op.name.padEnd(12);
  let sum = 0, cnt = 0;
  for (const sz of SIZES) {
    const r = evalOne(op.f, sz);
    line += ((r.rate * 100).toFixed(0) + '%').padStart(12);
    sum += r.rate; cnt++;
  }
  overall[op.key] = sum / cnt;
  console.log(line);
}

console.log('\n=== 平均得分率 ===');
Object.keys(overall).forEach(k => {
  console.log('  ' + k.padEnd(8) + (overall[k] * 100).toFixed(1) + '%');
});

// 平均耗时（标准棋盘 + 困难 AI）
const t = evalOne(() => Bots.makeAI('hard'), SIZES[1]);
console.log(`\n标准棋盘 vs 困难：平均时长 ${t.avgTime.toFixed(0)}s，非法指令 ${t.illegal}`);
