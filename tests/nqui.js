const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});
 const pg=await ctx.newPage();const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await pg.addInitScript(()=>{window.__said=[];SpeechSynthesis.prototype.speak=function(u){window.__said.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};});
 await pg.goto(require('./lib').BASE+'/index.html');
 const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')||'null'));
 await pg.getByText('聽力練習',{exact:false}).first().click();
 assert(await pg.getByText('數字聽力').count()>=1,'menu has 數字聽力 card');
 // settings: level 一般 + 5 題
 await pg.locator('.card:has-text("數字聽力")').getByRole('button',{name:'一般'}).click();
 await pg.locator('.card:has-text("數字聽力")').getByRole('button',{name:'5 題'}).click();
 let s=await st();assert(s.numbers.prefs.level===2&&s.numbers.prefs.count===5,'prefs saved '+JSON.stringify(s.numbers.prefs));
 // deselect time & check prefs; reselect
 await pg.locator('.card:has-text("數字聽力")').getByRole('button',{name:'🕐 時間'}).click();
 s=await st();assert(!s.numbers.prefs.cats.includes('time'),'cat toggled off');
 await pg.locator('.card:has-text("數字聽力")').getByRole('button',{name:'🕐 時間'}).click();
 await pg.screenshot({path:require('./lib').OUT+'/menu.png',fullPage:true});
 await pg.getByRole('button',{name:'🔢 開始數字聽力'}).click();
 assert((await pg.locator('.mod-header h2').innerText())==='數字聽力','quiz title');
 let wrongCount=0, said0=null;
 for(let i=0;i<5;i++){
   assert(await pg.locator('.opt').count()===4,`q${i+1} has 4 options`);
   if(i===0){ said0=(await pg.evaluate(()=>window.__said))[0]; }
   await pg.locator('.opt').first().click();
   const title=await pg.locator('.fb-title').innerText();
   if(title.includes('答錯'))wrongCount++;
   const kana=await pg.locator('.feedback .phrase-kana').innerText();
   const said=await pg.evaluate(()=>window.__said);
   if(i===0)assert(said0===kana,`audio = kana shown in feedback (${said0})`);
   if(i===0){console.log('  feedback:',(await pg.locator('.feedback').innerText()).replace(/\n/g,' | '));}
   if(i===0){const small=await pg.evaluate(()=>[...document.querySelectorAll('button')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).map(e=>e.innerText.slice(0,15)));assert(small.length===0,'quiz buttons >=44px '+small);
     assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),'no overflow in quiz');
     await pg.screenshot({path:require('./lib').OUT+'/quiz.png'});}
   await pg.getByRole('button',{name:/下一題|查看結果/}).click();
 }
 assert(await pg.locator('.score').count()===1,'result screen');
 await pg.screenshot({path:require('./lib').OUT+'/result.png',fullPage:true});
 s=await st();
 const totals=Object.values(s.numbers.stats).reduce((a,x)=>[a[0]+x.c,a[1]+x.w],[0,0]);
 assert(totals[0]+totals[1]===5,'stats total 5: '+JSON.stringify(s.numbers.stats));
 assert(totals[1]===wrongCount,'wrong count matches '+wrongCount);
 const nKeys=Object.keys(s.review.items).filter(k=>k.startsWith('n:'));
 assert(nKeys.length===wrongCount,'n: review items = wrong answers '+nKeys.join(','));
 const act=s.daily.activity[Object.keys(s.daily.activity)[0]];assert(act&&act.a===5&&act.c===5-wrongCount,'activity '+JSON.stringify(act));
 assert(!errs.length,'no errors '+errs);
 await pg.evaluate(()=>0);
 console.log('wrong:',wrongCount,'keys:',nKeys);
 await b.close();
})();
