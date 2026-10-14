const { chromium } = require('./lib');
(async()=>{const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const pg=await (await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'})).newPage();
 await pg.addInitScript(()=>{SpeechSynthesis.prototype.speak=function(){};SpeechSynthesis.prototype.cancel=function(){};localStorage.getItem('japaneseOps:v1')||localStorage.setItem('japaneseOps:v1',JSON.stringify({numbers:{prefs:{cats:['num'],level:1,count:5},stats:{}}}))});
 await pg.goto(require('./lib').BASE+'/index.html');
 await pg.getByText('聽力練習',{exact:false}).first().click();
 await pg.getByRole('button',{name:'🔢 開始數字聽力'}).click();
 for(let i=0;i<5;i++){await pg.locator('.opt').first().click();await pg.getByRole('button',{name:/下一題|查看結果/}).click();}
 await pg.getByRole('button',{name:'再來一輪'}).click();
 console.log('again title:',await pg.locator('.mod-header h2').innerText(),'q1 of',await pg.locator('.caption').first().innerText());
 await b.close();})();
