const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const pg=await (await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'})).newPage();const errs=[];
 pg.setDefaultTimeout(4000);
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__said=[];SpeechSynthesis.prototype.speak=function(u){window.__said.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};});
 const peek=()=>pg.evaluate(()=>window.App.Dialogue.peek());
 const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')));
 async function play(branch,wrongFirst){
   await pg.goto(require('./lib').BASE+'/index.html');
   await pg.locator('.tile,.mod-row',{hasText:'情境對話'}).click();
   await pg.locator('.tile,.mod-row',{hasText:'機場入境'}).click();
   await pg.locator('.dlg-opt').nth(branch).click();
   let steps=0;const visited=[];let wrongDone=false;
   while(steps++<40){
     const p=await peek();
     if(p.type==='done')return {visited,done:true};
     if(p.type==='u'){
       if(wrongFirst&&!wrongDone){const i=p.options.findIndex(o=>!o.ok);if(i>=0){await pg.locator('.dlg-opt').nth(i).click();wrongDone=true;visited.push('wrong:'+p.options[i].l);}}
       const i=p.options.findIndex(o=>o.ok);visited.push(p.options[i].l);await pg.locator('.dlg-opt').nth(i).click();
     } else if(p.type==='check'){
       if(wrongFirst&&!wrongDone){const j=p.options.findIndex(o=>o!==p.answer);await pg.locator('.dlg-opt').nth(j).click();wrongDone=true;visited.push('wrongcheck')}
       await pg.locator('.dlg-opt').nth(p.options.indexOf(p.answer)).click();visited.push('check');
     } else await pg.waitForTimeout(60);
   }
   return {visited,done:false};
 }
 const names=['A 入境審查','B 海關','C 兌換'];
 for(let br=0;br<3;br++){const r=await play(br,false);assert(r.done,`${names[br]} completes: ${r.visited.join(' → ')}`)}
 const outcomes=new Set();
 for(let i=0;i<10;i++){const r=await play(1,false);outcomes.add(r.visited.includes('air-13')||r.visited.includes('air-14')?'inspected':'waved');if(outcomes.size===2&&i>2)break}
 assert(outcomes.size===2,'B: both outcomes happen '+[...outcomes]);
 let s=await st();console.log('  stats',JSON.stringify(s.dialogue.stats.airport));
 assert(s.dialogue.stats.airport&&s.dialogue.stats.airport.perfect===s.dialogue.stats.airport.plays&&s.dialogue.stats.airport.plays>=5,'all clean plays are perfect');
 const w=await play(0,true);assert(w.done,'A with wrong first picks completes: '+w.visited.join(' → '));
 s=await st();const keys=Object.keys(s.review.items);console.log('  review keys',keys.join(','));
 assert(keys.length>0&&keys.every(k=>/^[ps]:(air|polite|hotel)-/.test(k)),'wrong picks → p:/s: review keys');
 const said=await pg.evaluate(()=>window.__said);
 assert(!said.includes('ありがとうございました。'),'airport dialogue never uses polite-21 (this page: spoken lines)');
 assert(!errs.length,'no errors '+errs);
 await b.close();})().catch(e=>{console.log('ERR',e.message.slice(0,200));process.exit(1)});
