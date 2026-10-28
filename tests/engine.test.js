const P=require('../src/engine.js');const assert=require('assert');
let p=P.newPulka(['А','Б','В']); // dealer 0 → active 1,2,0
assert.deepStrictEqual(P.activeOrder(p),[1,2,0]);
assert.deepStrictEqual(P.defendersOf(p,1),[2,0]);
// 6♠ сыграна, вистует один (2), взял 4 → пуля 2, висты 4*4=16
let d=P.score(p,{type:'game',declarer:1,contract:'6♠',whist:{first:'whist',second:'pass'},tricks:{1:6}});
assert.equal(d.pool[1],2); assert.equal(d.whists[2][1],16); assert.equal(d.whists[0][1],0);
// 6♠ ремиз на 1, один вистует: гора 1*2*2=4, консоляция 4 каждому, висты 5 взяток*4=20 пополам 10/10
d=P.score(p,{type:'game',declarer:1,contract:'6♠',whist:{first:'whist',second:'pass'},tricks:{1:5}});
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
P.apply(p,{type:'game',declarer:2,contract:'6♠',whist:{first:'pass',second:'pass'},tricks:{}}); assert.equal(p.raspasStep,0);
P.undo(p); assert.equal(p.raspasStep,2);
// 4 игрока: сдающий не играет
let q=P.newPulka(['А','Б','В','Г']); q.dealer=2; assert.deepStrictEqual(P.activeOrder(q),[3,0,1]); assert.deepStrictEqual(P.defendersOf(q,0),[1,3]);
// расчёт: сумма 0
let s=P.settle(p); assert.ok(Math.abs(s.reduce((a,b)=>a+b.total,0))<0.05);
const r={}; P.updateRatings(r,s); console.log(s, r); console.log('ok');
