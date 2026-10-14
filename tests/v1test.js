const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__sp=[];SpeechSynthesis.prototype.speak=function(u){window.__sp.push(u.text)};SpeechSynthesis.prototype.cancel=function(){}});
 const U=require('./lib').BASE+'/index.html';
 await pg.goto(U);
 assert(await pg.locator('.hello-mascot svg').count()===1,'Tabi on home');
 assert(await pg.locator('.hello-mascot path[fill="#FFC400"]').count()===0,'hello mood at start (no sparkles)');
 assert((await pg.locator('.hello-bubble').innerText()).includes('還差 4 項')||(await pg.locator('.hello-bubble').innerText()).includes('今天也學一點吧'),'greeting line');
 assert(await pg.locator('.stars span').count()===5,'5 stars');
 assert(await pg.locator('.tile.live').count()===7&&await pg.locator('.tile.planned').count()===1,'7 live tiles + 1 planned');
 const mods=await pg.locator('.tile-title').allInnerTexts();console.log('  tiles:',mods.join(' / '));
 assert(mods.includes('數字・價錢'),'數字・價錢 tile');
 assert(await pg.locator('button.tile.planned').count()===0,'看得懂 is not a button');
 // numbers hub
 await pg.locator('.tile',{hasText:'數字・價錢'}).click();
 assert((await pg.locator('.mod-header h2').innerText())==='數字・價錢','hub header');
 assert(await pg.getByRole('button',{name:'查看讀音表'}).count()===1&&await pg.getByRole('button',{name:'🔢 開始數字聽力'}).count()===1,'hub: table + quiz cards');
 assert(await pg.getByRole('button',{name:'👂 開始聽力練習'}).count()===0,'hub has no sentence quiz');
 await pg.getByRole('button',{name:'查看讀音表'}).click();
 assert(await pg.locator('.ex-card').count()>50,'table opens');
 await pg.locator('.btn-back').click();
 assert((await pg.locator('.mod-header h2').innerText())==='數字・價錢','back from table → hub');
 await pg.getByRole('button',{name:'🔢 開始數字聽力'}).click();
 for(let i=0;i<10;i++){await pg.locator('.opt').first().click();await pg.getByRole('button',{name:/下一題|查看結果/}).click()}
 assert(await pg.locator('.score').count()===1,'number quiz from hub completes');
 const st=await pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')));
 assert(Object.values(st.numbers.stats).reduce((a,x)=>a+x.c+x.w,0)===10,'10 answers recorded');
 // back to hub then home
 await pg.getByRole('button',{name:/返回|← /}).first().click().catch(()=>{});
 await pg.goto(U);
 // listening menu still has number cards
 await pg.locator('.tile',{hasText:'聽力練習'}).click();
 assert(await pg.getByRole('button',{name:'🔢 開始數字聽力'}).count()===1&&await pg.getByRole('button',{name:'👂 開始聽力練習'}).count()===1,'聽力練習 menu unchanged');
 // all tasks done → cheer + 5 stars + 連續
 await pg.goto(U);
 await pg.evaluate(()=>{const S=App.Storage;let s=S.loadState();s=App.Daily.ensureToday(s);const t=S.todayLocal();['review','new','speak','dialogue','kana'].forEach(k=>{s=App.Daily.markDone(s,t,k)});S.saveState(s)});
 await pg.reload();
 assert(await pg.locator('.stars .on').count()===5,'5 filled stars when all done');
 assert(await pg.locator('.hello-mascot path[fill="#FFC400"]').count()===1,'cheer mood when all done (sparkles)');
 assert((await pg.locator('.hello-bubble').innerText()).includes('全部完成'),'all-done greeting');
 assert((await pg.locator('.streak b').innerText())==='1','streak = 1');
 assert(await pg.locator('.ring').getAttribute('aria-label')==='今日任務已完成 5 / 5','ring label');
 // tile heights/touch
 const hs=await pg.locator('.tile.live').evaluateAll(e=>e.map(x=>x.getBoundingClientRect().height));assert(Math.min(...hs)>=100,'tiles tall enough');
 assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no h-scroll');
 // old save: numbers/daily etc intact — state untouched by version 1
 assert(errs.length===0,'no errors '+errs);
 await b.close();})();
