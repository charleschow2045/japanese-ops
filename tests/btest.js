const { chromium } = require('./lib');
const S=require('./lib').OUT;
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__spoken=[];SpeechSynthesis.prototype.speak=function(u){window.__spoken.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};});
 await pg.goto(require('./lib').BASE+'/index.html');
 // data checks
 const r=await pg.evaluate(()=>{
  const E=App.Content.KATAKANA_EXAMPLES;const K=App.Content.KANA;
  const kata=new Set(Object.values(K).map(k=>k.kata).filter(Boolean));
  const unknown=[];
  E.forEach(e=>{for(const c of e.word){if(c==='ー'||c==='ッ')continue;if(!kata.has(c)&&!'ャュョァィゥェォ'.includes(c))unknown.push(e.word+c)}});
  const romOK=E.every(e=>/^[a-z’]+$/.test(e.romaji));
  return {n:E.length,uniq:new Set(E.map(e=>e.word)).size,noEn:E.filter(e=>!e.en).length,unknown,romOK,scenes:[...new Set(E.map(e=>e.scene))]}});
 console.log(JSON.stringify(r));
 assert(r.n===120&&r.uniq===120&&r.noEn===0,'120 unique words, all with English');
 assert(r.unknown.length===0,'only taught kana '+r.unknown.join(','));assert(r.romOK,'romaji letters only');
 await pg.locator('.tile',{hasText:'五十音'}).click();
 await pg.locator('.tile,.mod-row',{hasText:'片假名實例'}).click();
 assert(await pg.locator('.ex-card').count()===120,'120 cards on page');
 assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),'no h-scroll');
 const lip=pg.locator('.ex-card',{hasText:'リップクリーム'});assert(/lip balm/.test(await lip.innerText())&&/潤唇膏/.test(await lip.innerText()),'lip cream card');
 const op=pg.locator('.ex-card',{hasText:'オープン'});assert(/開張、開業（也指營業中）/.test(await op.innerText()),'open meaning');
 const rent=pg.locator('.ex-card',{hasText:'レンタカー'});const rt=await rent.innerText();assert(/rent-a-car/.test(rt)&&!/和製/.test(rt),'rent-a-car no note');
 assert((await pg.locator('.ex-card',{hasText:'バンドエイド'}).count())===0,'no バンドエイド');
 await lip.click();assert((await pg.evaluate(()=>window.__spoken)).includes('リップクリーム'),'tap speaks word');
 await pg.screenshot({path:`${S}/B-examples.png`});
 // card heights ≥ 44
 const hs=await pg.locator('.ex-card').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));assert(Math.min(...hs)>=44,'cards ≥44px');
 // detail page of a kata char lists examples
 await pg.locator('button',{hasText:'返回'}).first().click();
 await pg.locator('.tile,.mod-row',{hasText:'字表'}).first().click();
 await pg.getByRole('button',{name:'片假名'}).first().click();
 await pg.locator('.kana-cell',{hasText:'ス'}).first().click();
 const det=await pg.locator('.sheet-wrap').innerText();console.log('  ス detail has',(det.match(/スリッパ|スーツケース|スープ/g)||[]).join(','));
 assert(/スリッパ/.test(det),'ス detail lists new example');
 assert(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();
})();
