const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{SpeechSynthesis.prototype.speak=function(){};SpeechSynthesis.prototype.cancel=function(){};localStorage.setItem('japaneseOps:v1',JSON.stringify({listen:{prefs:{scenes:['sight','onsen','call'],sv:3,count:20,staffOnly:false}},speak:{prefs:{scenes:['sight','onsen','call'],sv:3,count:20,mode:'self'}}}))});
 await pg.goto(require('./lib').BASE+'/index.html');
 await pg.locator('.tile',{hasText:'聽力'}).click();
 await pg.getByRole('button',{name:'👂 開始聽力練習'}).click();
 for(let i=0;i<20;i++){
  const opts=await pg.locator('.opt').allInnerTexts();
  if(opts.length!==4||new Set(opts).size!==4){assert(false,'q'+(i+1)+' options '+opts.join('|'));break}
  await pg.locator('.opt').first().click();
  await pg.getByRole('button',{name:/下一題|查看結果/}).click();
 }
 assert(await pg.locator('.score').count()===1,'listening 20Q over 3 new scenes: 4 distinct options each, finishes');
 // speaking self mode
 await pg.goto(require('./lib').BASE+'/index.html');await pg.locator('.tile',{hasText:'口語'}).click();
 await pg.getByRole('button',{name:'🎤 開始口語練習'}).click();
 const t=await pg.locator('main').innerText();assert(t.length>20&&!errs.length,'speaking starts with new scenes '+errs);
 await b.close();})();
