const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});
 const pg=await ctx.newPage();const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await pg.addInitScript(()=>{window.__said=[];SpeechSynthesis.prototype.speak=function(u){window.__said.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};});
 const t=new Date();const pad=n=>String(n).padStart(2,'0');const d0=`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;
 await pg.addInitScript((d0)=>{ if(!localStorage.getItem('japaneseOps:v1')) localStorage.setItem('japaneseOps:v1',JSON.stringify({review:{items:{'n:yen:1800':{box:0,due:d0},'n:ban:3':{box:0,due:d0}},graduated:0}})) },d0);
 await pg.goto(require('./lib').BASE+'/index.html');
 await pg.getByText('開始今日任務').first().click();
 await pg.waitForTimeout(200);
 console.log('  daily page:',(await pg.locator('body').innerText()).replace(/\n+/g,' | ').slice(0,400));
 await pg.getByRole('button',{name:/錯題重溫|聽力重溫/}).first().click();
 await pg.waitForTimeout(200);
 console.log('  title:',await pg.locator('.mod-header h2').innerText().catch(()=>'?'));
 console.log('  said:',JSON.stringify(await pg.evaluate(()=>window.__said)));
 for(let i=0;i<2;i++){await pg.locator('.opt').first().click();await pg.getByRole('button',{name:/下一題|查看結果/}).click();}
 console.log('  result:',(await pg.locator('.score').innerText()));
 const done=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('japaneseOps:v1'));return s.daily.days[Object.keys(s.daily.days)[0]].done});
 console.log('  done flags',JSON.stringify(done));
 assert(!errs.length,'no errors '+errs);
 await b.close();
})();
