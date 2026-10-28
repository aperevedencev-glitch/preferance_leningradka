const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1280,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
const html=require('fs').readFileSync(require('path').join(__dirname,'../dist/game.html'),'utf8');
await p.setContent(html);
await p.click('#go');await p.evaluate(()=>{BOT_DELAY=50});
let shot=0;
for(let i=0;i<400;i++){
  await p.waitForTimeout(80);
  const st=await p.evaluate(()=>({ph:G.d.phase,looping}));
  if(st.looping) continue;
  if(st.ph==='done'){await p.screenshot({path:'h_done.png'});break;}
  if(await p.$('[data-bid="6♠"]')){ await p.click('[data-bid="6♠"]'); continue;}
  if(await p.$('[data-bid=""]')){ await p.click('[data-bid=""]'); continue;}
  if(await p.$('#discardOk')){ const cs=await p.$$('.hand .card.ok'); await cs[0].click(); const cs2=await p.$$('.hand .card.ok:not(.sel)'); await cs2[0].click(); if(!shot++) await p.screenshot({path:'h_discard.png'}); await p.click('#discardOk'); continue;}
  if(await p.$('#declOk')){ await p.click('#declOk'); continue;}
  if(await p.$('[data-w="whist"]')){ await p.click('[data-w="whist"]'); continue;}
  if(await p.$('[data-w="ret"]')){ await p.click('[data-w="ret"]'); continue;}
  const ok=await p.$('.hand .card.ok'); if(ok){ await p.screenshot({path:'h_play.png'}); await ok.click(); continue;}
}
console.log(errs.join('|')||'no errors', await p.evaluate(()=>G.d.phase), await p.evaluate(()=>JSON.stringify(G.d.result)));
await p.setViewportSize({width:390,height:844});await p.screenshot({path:'h_mobile.png',fullPage:true});
console.log(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth));
await b.close()})()
