const { chromium } = require('./lib');
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const pg=await (await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'})).newPage();const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.addInitScript(()=>{window.__said=[];SpeechSynthesis.prototype.speak=function(u){window.__said.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};});
 await pg.goto(require('./lib').BASE+'/index.html');
 await pg.getByText('聽力練習',{exact:false}).first().click();
 await pg.getByRole('button',{name:'👂 開始聽力練習'}).click();
 console.log('phrase quiz title:',await pg.locator('.mod-header h2').innerText(),'opts',await pg.locator('.opt').count());
 await pg.locator('.opt').first().click();await pg.getByRole('button',{name:/下一題/}).click();
 // listening 再來一輪 for numbers keeps numbers
 await pg.getByText('← 返回').click().catch(()=>{});
 console.log('errs',errs);await b.close();})();
