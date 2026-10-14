const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{SpeechSynthesis.prototype.speak=function(){};SpeechSynthesis.prototype.cancel=function(){};});
 await pg.goto(require('./lib').BASE+'/index.html');
 const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')||'null'));
 await pg.locator('.tile,.mod-row',{hasText:'五十音'}).click();
 // 字表
 await pg.locator('.menu-card,.mod-row',{hasText:'字表'}).first().click();
 assert(await pg.locator('.help-card.open').count()===1,'字表: card auto-expanded on first open');
 assert((await pg.locator('.help-body').innerText()).includes('k（子音）＋ a（母音）＝ か'),'字表: card text');
 let s=await st();assert(s.help&&s.help.table==='seen','字表: marked seen');
 // labels
 const heads=await pg.locator('.kana-head').first().innerText();console.log('  head:',heads.replace(/\n/g,' '));
 assert(/a\s*あ\s*i\s*い\s*u\s*う\s*e\s*え\s*o\s*お/.test(heads.replace(/\n/g,' ')),'字表: column labels a i u e o');
 const rowLabels=await pg.locator('.kana-rowhead').allInnerTexts();assert(rowLabels.slice(0,10).join(',')===',k,s,t,n,h,m,y,r,w','字表: row labels '+rowLabels.slice(0,10).join(','));
 const exc=await pg.locator('.kana-cell.exc').count();console.log('  exceptions (hira):',exc);
 assert(exc===8 || exc>=7,'字表: exception cells marked');
 const excChars=await pg.locator('.kana-cell.exc .jp').allInnerTexts();console.log('  ',excChars.join(''));
 // toggle collapse
 await pg.locator('.help-head').click();assert(await pg.locator('.help-card.open').count()===0&&await pg.locator('.help-body').count()===0,'字表: tap collapses');
 await pg.locator('.help-head').click();assert(await pg.locator('.help-card.open').count()===1,'字表: tap expands');
 // katakana table: groups yoon labels and gairaigo no labels
 await pg.getByRole('button',{name:'片假名'}).first().click();
 const yoon=await pg.locator('.kana-head').nth(3).innerText();console.log('  yoon head:',yoon.replace(/\n/g,' '));
 assert((await pg.locator('.kana-head').count())===4,'字表: 4 header rows (清音 濁音 半濁音 拗音; none for 外來語組合)');
 assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),'字表: no horizontal overflow');
 await pg.screenshot({path:require('./lib').OUT+'/chartA.png',fullPage:false});
 // reload → collapsed
 await pg.reload();await pg.locator('.tile,.mod-row',{hasText:'五十音'}).click();await pg.locator('.menu-card,.mod-row',{hasText:'字表'}).first().click();
 assert(await pg.locator('.help-card.open').count()===0,'字表: collapsed after reload');
 await pg.locator('.help-head').click();assert(await pg.locator('.help-card.open').count()===1,'字表: can expand again');
 // examples
 await pg.getByText('← 返回').first().click();
 await pg.locator('.menu-card,.mod-row',{hasText:'片假名實例'}).first().click();
 assert(await pg.locator('.help-card.open').count()===1&&(await pg.locator('.help-body').innerText()).includes('ホテル ＝ ho · te · ru'),'片假名實例: card auto-expanded');
 assert((await pg.locator('.ex-en').first().innerText())==='hotel','片假名實例: English original shown');
 assert(await pg.locator('.ex-en').count()===120,'片假名實例: 120 English lines');
 await pg.screenshot({path:require('./lib').OUT+'/kataA.png'});
 // contrast
 await pg.getByText('← 返回').first().click();
 await pg.locator('.menu-card,.mod-row',{hasText:'清濁對比'}).first().click();
 assert(await pg.locator('.help-card.open').count()===1&&(await pg.locator('.help-body').innerText()).includes('濁點'),'清濁對比: card auto-expanded');
 s=await st();assert(s.help.table==='seen'&&s.help.kata==='seen'&&s.help.contrast==='seen','all three marked seen '+JSON.stringify(s.help));
 // backup roundtrip + tamper
 const r=await pg.evaluate(()=>{const S=window.App.Storage;const st=S.loadState();const t=JSON.stringify(S.buildBackup(st));const ok=S.parseBackup(t);
   const o=JSON.parse(t);o.data['japaneseOps:v1'].help={table:'seen',kata:'x',bad:'seen',__proto__:{x:1}};const r2=S.parseBackup(JSON.stringify(o));
   const o3=JSON.parse(t);delete o3.data['japaneseOps:v1'].help;const r3=S.parseBackup(JSON.stringify(o3));
   return {ok:ok.ok&&JSON.stringify(ok.state.help),t:r2.ok&&JSON.stringify(r2.state.help),none:r3.ok&&JSON.stringify(r3.state.help)}});
 console.log('  backup',JSON.stringify(r));
 assert(r.ok.includes('contrast')&&r.t==='{"table":"seen"}'&&r.none==='{}','backup keeps/sanitizes help flags');
 // buttons >=44
 const small=await pg.evaluate(()=>[...document.querySelectorAll('.help-head')].filter(e=>e.getBoundingClientRect().height<44).length);assert(small===0,'help header >=44px');
 assert(!errs.length,'no errors '+errs);
 await b.close();})().catch(e=>{console.log('ERR',e.message.slice(0,300));process.exit(1)});
