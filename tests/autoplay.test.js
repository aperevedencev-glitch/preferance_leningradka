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
await p.evaluate(()=>{G.auto=true;BOT_DELAY=0;});
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
console.log(await p.evaluate(()=>JSON.stringify(G.final)));
}
await b.close()})()
