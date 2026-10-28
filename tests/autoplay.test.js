const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for (const n of [3,4]){
const p=await b.newPage({viewport:{width:1280,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
const html=require('fs').readFileSync(require('path').join(__dirname,'../dist/game.html'),'utf8');
await p.setContent(html);
await p.evaluate(()=>{window.__fast=true});
if(n===4) await p.click('#n4');
await p.selectOption('#target','10');
await p.click('#go');
await p.evaluate(()=>{G.auto=true;BOT_DELAY=0;
  // проверка распасов: 10 взяток, вчетвером сдающий — только из первых двух ходов
  window.__ras=[];const orig=PREF.apply;PREF.apply=(pk,h)=>{if(h.type==='raspas'){const s=Object.values(h.tricks).reduce((a,b)=>a+b,0);const act=PREF.activeOrder(pk);const dl=Object.keys(h.tricks).map(Number).filter(i=>!act.includes(i));window.__ras.push({s,dealerT:dl.map(i=>h.tricks[i])});if(s!==10||dl.some(i=>h.tricks[i]>2))throw new Error('raspas tricks '+JSON.stringify(h.tricks));}return orig(pk,h);};});
await p.evaluate(()=>loop());
let deals=0, types={};
for(let i=0;i<200;i++){
  try{await p.waitForFunction(()=>G&&G.d&&G.d.phase==='done'&&!looping,null,{timeout:60000});}catch(e){console.log('STUCK',await p.evaluate(()=>JSON.stringify({ph:G.d.phase,turn:G.d.turn,bid:G.d.bid,looping,w:G.d.whist,pause:G.d.pause,hands:Object.fromEntries(Object.entries(G.d.hands).map(([k,v])=>[k,v.length]))})),errs);break;}
  const t=await p.evaluate(()=>{const h=G.pulka.hands[G.pulka.hands.length-1].h;return h.type+(h.contract?':'+h.contract:'')+(h.whist?':'+h.whist.first+'/'+h.whist.second:'')});
  types[t.split(':').slice(0,1)+(t.includes('whist/')||t.includes('/whist')?'+вист':'')]=(types[t.split(':').slice(0,1)+(t.includes('whist/')||t.includes('/whist')?'+вист':'')]||0)+1;
  deals++;
  if(await p.evaluate(()=>G.pulka.closed)) break;
  await p.evaluate(()=>{newDeal();G.auto=true;BOT_DELAY=0;loop()});
}
await p.screenshot({path:`g${n}.png`});
console.log(n,'deals',deals,JSON.stringify(types),'closed',await p.evaluate(()=>G.pulka.closed),errs.join('|')||'no errors');
console.log('raspas checked',await p.evaluate(()=>JSON.stringify({n:__ras.length,dealerTricks:__ras.reduce((a,r)=>a+(r.dealerT[0]||0),0)})));
}
await b.close()})()
