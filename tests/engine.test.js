const P=require('../src/engine.js');const assert=require('assert');
let p=P.newPulka(['А','Б','В']); // dealer 0 → active 1,2,0
assert.deepStrictEqual(P.activeOrder(p),[1,2,0]);
assert.deepStrictEqual(P.defendersOf(p,1),[2,0]);
// 6♣ сыграна, вистует один (2), взял 4 → пуля 2, висты 4*4=16
let d=P.score(p,{type:'game',declarer:1,contract:'6♣',whist:{first:'whist',second:'pass'},tricks:{1:6}});
assert.equal(d.pool[1],2); assert.equal(d.whists[2][1],16); assert.equal(d.whists[0][1],0);
// 6♣ ремиз на 1, один вистует: гора 1*2*2=4, консоляция 4 каждому, висты 5 взяток*4=20 пополам 10/10
d=P.score(p,{type:'game',declarer:1,contract:'6♣',whist:{first:'whist',second:'pass'},tricks:{1:5}});
assert.equal(d.gora[1],4); assert.equal(d.whists[2][1],4+10); assert.equal(d.whists[0][1],4+10);
// 6 сыграна, вистующий один взял 2 (<4): гора вистующему 2*2*1=4
d=P.score(p,{type:'game',declarer:1,contract:'6♥',whist:{first:'whist',second:'pass'},tricks:{1:8}});
assert.equal(d.gora[2],4); assert.equal(d.whists[2][1],8);
// два виста 7♦: 7 сыграна, 2 и 1 взятки, need 2 → нет штрафа
d=P.score(p,{type:'game',declarer:1,contract:'7♦',whist:{first:'whist',second:'whist'},tricks:{1:7,2:2,0:1}});
assert.equal(d.whists[2][1],16); assert.equal(d.whists[0][1],8); assert.equal(d.gora[2]+d.gora[0],0);
// полвиста на 6: висты 2*4=8 сказавшему
d=P.score(p,{type:'game',declarer:1,contract:'6♣',whist:{first:'pass',second:'half'},tricks:{}});
assert.equal(d.pool[1],2); assert.equal(d.whists[0][1],8);
assert.throws(()=>P.score(p,{type:'game',declarer:1,contract:'8♣',whist:{first:'pass',second:'half'},tricks:{}}));
// мизер
d=P.score(p,{type:'misere',declarer:0,tricks:2}); assert.equal(d.gora[0],40);
// распасы прогрессия
P.apply(p,{type:'raspas',tricks:{0:5,1:5,2:0}}); assert.equal(p.players[0].gora,10); assert.equal(p.players[2].pool,1);
P.apply(p,{type:'raspas',tricks:{0:3,1:4,2:3}}); assert.equal(p.players[0].gora,10+3*4);
P.apply(p,{type:'game',declarer:2,contract:'8♠',whist:{first:'pass',second:'pass'},tricks:{}}); assert.equal(p.raspasStep,0);
P.undo(p); assert.equal(p.raspasStep,2);
// 4 игрока: сдающий не играет
let q=P.newPulka(['А','Б','В','Г']); q.dealer=2; assert.deepStrictEqual(P.activeOrder(q),[3,0,1]); assert.deepStrictEqual(P.defendersOf(q,0),[1,3]);
// расчёт: сумма 0
let s=P.settle(p); assert.ok(Math.abs(s.reduce((a,b)=>a+b.total,0))<0.05);
const r={}; P.updateRatings(r,s); console.log(s, r); console.log('ok');

// выход из распасов: после 1-х — от 7-й, после 2-х — от 8-й, после 3-х — от 6-й, затем цикл заново
{
  const P2 = require('../src/engine.js'); const A = require('assert');
  const q = P2.newPulka(['А','Б','В']);
  const ras = () => { const act = P2.activeOrder(q); P2.apply(q, { type: 'raspas', tricks: { [act[0]]: 4, [act[1]]: 3, [act[2]]: 3 } }); };
  const game = (c) => ({ type: 'game', declarer: P2.activeOrder(q)[0], contract: c, whist: { first: 'pass', second: 'pass' }, tricks: {} });
  A.strictEqual(P2.exitLevel(q), 6);
  ras(); A.strictEqual(P2.exitLevel(q), 7);
  A.throws(() => P2.score(q, game('6♠')), /не ниже 7/);
  ras(); A.strictEqual(P2.exitLevel(q), 8);
  A.throws(() => P2.score(q, game('7БК')), /не ниже 8/);
  ras(); A.strictEqual(P2.exitLevel(q), 6); P2.score(q, game('6♣'));
  ras(); A.strictEqual(q.raspasStep, 1); A.strictEqual(P2.exitLevel(q), 7); // четвёртые = снова первые
  P2.apply(q, game('7♠')); A.strictEqual(q.raspasStep, 0); A.strictEqual(P2.exitLevel(q), 6);
  console.log('exit ok');
}

// распасы вчетвером: взятки сдающего из прикупа — только гора, без премии за ноль
{
  const P3 = require('../src/engine.js'); const A = require('assert');
  const q = P3.newPulka(['А','Б','В','Г']); q.dealer = 0; // играют 1,2,3
  let d = P3.score(q, { type: 'raspas', tricks: { 1: 4, 2: 0, 3: 5, 0: 1 } });
  A.strictEqual(d.gora[0], 2); A.strictEqual(d.pool[0], 0); A.strictEqual(d.pool[2], 1);
  d = P3.score(q, { type: 'raspas', tricks: { 1: 4, 2: 1, 3: 5 } });
  A.strictEqual(d.gora[0] + d.pool[0], 0);
  console.log('raspas4 ok');
}

// Сталинград: 6♠ — вистуют оба, даже если записано «пас»
{
  const P4 = require('../src/engine.js'); const A = require('assert');
  const q = P4.newPulka(['А','Б','В']);
  const [a, b] = P4.defendersOf(q, 1);
  const d = P4.score(q, { type: 'game', declarer: 1, contract: '6♠', whist: { first: 'pass', second: 'pass' }, tricks: { 1: 6, [a]: 3, [b]: 1 } });
  A.strictEqual(d.whists[a][1], 12); A.strictEqual(d.whists[b][1], 4); A.strictEqual(d.pool[1], 2);
  A.ok(P4.forcedWhist(q.rules, '6♠') && !P4.forcedWhist(q.rules, '6♣'));
  console.log('stalingrad ok');
}
