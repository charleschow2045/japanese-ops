const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const U=require('./lib').BASE+'/index.html';
(async()=>{const b=await chromium.launch({executablePath:require('./lib').CHROME});
 for(const w of [375,320]){
  const ctx=await b.newContext({viewport:{width:w,height:800},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{SpeechSynthesis.prototype.speak=function(){};if(!localStorage.getItem('japaneseOps:v1'))localStorage.setItem('japaneseOps:v1',JSON.stringify({kana:{stats:{'あ':{c:99999,w:0,last:'2026-10-01'}}},listen:{stats:{'polite-01':{c:12000,w:300,last:'2026-10-01',run:5}}},speak:{stats:{}}}))});
  await pg.goto(U);await pg.locator('.tab',{hasText:'進度'}).click();
  const nums=await pg.locator('.stat-n').evaluateAll(els=>els.map(e=>({t:e.textContent,fits:e.scrollWidth<=e.clientWidth+1,fs:parseFloat(getComputedStyle(e).fontSize)})));
  console.log('  ',w,JSON.stringify(nums.slice(0,4)));
  assert(nums.length===15,w+': 15 stat tiles (4 overview + 3 phrases + 2 dialogue + 3 看得懂 + 3 review)');
  assert(nums.every(n=>n.fits),w+': every big number fits its tile');
  assert(Math.min(...nums.map(n=>n.fs))>=30,w+': numbers ≥ 30px (was ~23px)');
  const accents=await pg.locator('#main .card.accent').evaluateAll(els=>els.map(e=>e.style.getPropertyValue('--a-solid')));
  assert(new Set(accents).size>=4,w+': progress sections use different colours '+[...new Set(accents)].length);
  assert(await pg.locator('.big-count').count()===2,w+': kana big counts');
  assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),w+': no h-scroll');
  // module header band on every module page
  for(const t of ['五十音','聽力練習','口語練習','數字・價錢','情境句子庫','情境對話','指給店員看']){
    await pg.locator('.tab',{hasText:'主頁'}).click();await pg.locator('.tile',{hasText:t}).click();
    const bg=await pg.evaluate(()=>{const e=document.querySelector('.mod-header');return e?getComputedStyle(e).backgroundColor:null});
    assert(bg&&bg!=='rgba(0, 0, 0, 0)',w+': '+t+' header band '+bg);
  }
  assert(errs.length===0,w+': no errors '+errs);
  await ctx.close();}
 await b.close()})();
