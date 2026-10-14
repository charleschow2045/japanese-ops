const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const U=require('./lib').BASE+'/index.html';
async function mk(b,opts={}){const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block',...opts});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')pg.errs.push(m.text())});
 await pg.addInitScript(()=>{window.__sp=[];SpeechSynthesis.prototype.speak=function(u){window.__sp.push(u.text)};SpeechSynthesis.prototype.cancel=function(){}});return pg}
const sparkles=pg=>pg.locator('.fb-banner path[fill="#FFC400"]').count();
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 let pg=await mk(b);await pg.goto(U);
 // ---- kana 看字選音: answer right then wrong
 await pg.locator('.tile',{hasText:'五十音'}).click();
 await pg.getByRole('button',{name:'👀 看字選音'}).click();
 await pg.waitForSelector('.opt');
 // find correct option by reading ui? use app state: answer by trial — first click, inspect banner
 let rights=0,wrongs=0,sawOk=false,sawNo=false;
 for(let i=0;i<10;i++){
   await pg.locator('.opt').first().click();
   const ok=await pg.locator('.fb-banner.ok').count()===1, no=await pg.locator('.fb-banner.no').count()===1;
   assert(ok!==no,`q${i+1}: exactly one banner`);
   if(ok&&!sawOk){sawOk=true;assert((await pg.locator('.fb-title').innerText())==='答對了！','ok title');assert(await sparkles(pg)===1,'ok: Tabi cheers');assert(await pg.locator('.confetti i').count()===14,'ok: confetti 14');assert((await pg.locator('.fb-mark').innerText())==='✓','ok mark ✓');assert(await pg.locator('.fb-lead').count()===0,'ok: no lead')}
   if(no&&!sawNo){sawNo=true;assert((await pg.locator('.fb-title').innerText())==='答錯了','no title');assert(await sparkles(pg)===0&&await pg.locator('.fb-banner path[fill="#7EC8FF"]').count()===1,'no: Tabi encourages (sweat drop)');assert(await pg.locator('.confetti').count()===0,'no: no confetti');assert((await pg.locator('.fb-mark').innerText())==='✕','no mark ✕');assert((await pg.locator('.fb-lead').innerText())==='答案是：','no: lead');
     await pg.screenshot({path:require('./lib').OUT+'/v2_kana_no.png'});}
   if(ok&&rights===0)await pg.screenshot({path:require('./lib').OUT+'/v2_kana_ok.png'});
   ok?rights++:wrongs++;
   await pg.getByRole('button',{name:/下一題|查看結果/}).click();
 }
 console.log('  kana rights',rights,'wrongs',wrongs);
 assert(await pg.locator('.result-hero').count()===1,'result hero shown');
 const perfect=await pg.locator('.result-hero.perfect').count();
 console.log('  perfect?',perfect);
 await pg.screenshot({path:require('./lib').OUT+'/v2_kana_result.png'});
 assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no h-scroll');
 assert(pg.errs.length===0,'no errors '+pg.errs);

 // ---- reduced motion vs normal
 for(const rm of ['reduce','no-preference']){
   const p2=await mk(b,{reducedMotion:rm});await p2.goto(U);
   await p2.locator('.tile',{hasText:'五十音'}).click();await p2.getByRole('button',{name:'👀 看字選音'}).click();await p2.waitForSelector('.opt');
   await p2.locator('.opt').first().click();
   const an=await p2.evaluate(()=>({mark:getComputedStyle(document.querySelector('.fb-mark')).animationName,mas:getComputedStyle(document.querySelector('.fb-mascot')).animationName,conf:document.querySelector('.confetti i')?getComputedStyle(document.querySelector('.confetti i')).animationName:'-',title:getComputedStyle(document.querySelector('.fb-banner .fb-title')).animationName}));
   console.log('  ',rm,JSON.stringify(an));
   if(rm==='reduce')assert([an.mark,an.mas,an.title].every(x=>x==='none')&&(an.conf==='none'||an.conf==='-'),'reduced motion: no animation anywhere');
   else assert(an.mark==='fb-pop'&&an.title==='fb-rise'&&(an.mas==='fb-bounce'||an.mas==='fb-nod'),'normal: animations on');
 }

 // ---- listening practice (sentence) + perfect hero by forcing results
 pg=await mk(b);await pg.goto(U);
 await pg.locator('.tile',{hasText:'聽力練習'}).click();
 await pg.getByRole('button',{name:'👂 開始聽力練習'}).click();
 for(let i=0;i<10;i++){await pg.locator('.opt').first().click();assert(await pg.locator('.fb-banner').count()===1,'listening q'+(i+1)+' banner');
   if(i===0)assert((await pg.locator('.feedback').innerText()).length>20,'feedback body present');
   await pg.getByRole('button',{name:/下一題|查看結果/}).click()}
 assert(await pg.locator('.result-hero').count()===1,'listening result hero');
 // ---- number quiz banner
 await pg.goto(U);await pg.locator('.tile',{hasText:'數字・價錢'}).click();await pg.getByRole('button',{name:'🔢 開始數字聽力'}).click();
 await pg.locator('.opt').first().click();assert(await pg.locator('.fb-banner').count()===1,'number quiz banner');
 // ---- speaking self mode
 const p3=await mk(b);await p3.addInitScript(()=>localStorage.setItem('japaneseOps:v1',JSON.stringify({speak:{prefs:{mode:'self',count:5,sv:3}}})));await p3.goto(U);
 await p3.locator('.tile',{hasText:'口語練習'}).click();await p3.getByRole('button',{name:'🎤 開始口語練習'}).click();
 await p3.getByRole('button',{name:/我會讀|顯示答案|看答案|對答案/}).first().click().catch(()=>{});
 console.log('  speaking screen:',(await p3.locator('main').innerText()).slice(0,80).replace(/\n/g,' | '));
 await b.close();})();
