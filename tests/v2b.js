const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const U=require('./lib').BASE+'/index.html';
(async()=>{const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const mk=async(seed)=>{const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.addInitScript((seed)=>{SpeechSynthesis.prototype.speak=function(){};SpeechSynthesis.prototype.cancel=function(){};if(seed&&!localStorage.getItem('japaneseOps:v1'))localStorage.setItem('japaneseOps:v1',JSON.stringify(seed))},seed);return pg};
 // speaking self mode
 let pg=await mk({speak:{prefs:{mode:'self',count:5,sv:3,scenes:['polite']}}});await pg.goto(U);
 await pg.locator('.tile',{hasText:'口語練習'}).click();await pg.getByRole('button',{name:'🎤 開始口語練習'}).click();
 await pg.getByRole('button',{name:'顯示答案'}).click();await pg.getByRole('button',{name:'✅ 我讀對了'}).click();
 assert(await pg.locator('.fb-banner.ok').count()===1&&(await pg.locator('.fb-title').innerText())==='正確！','speaking self: ok banner 正確！');
 await pg.getByRole('button',{name:/下一題/}).click();
 await pg.getByRole('button',{name:'顯示答案'}).click();await pg.getByRole('button',{name:'❌ 要再練'}).click();
 assert(await pg.locator('.fb-banner.no').count()===1&&(await pg.locator('.fb-title').innerText())==='不正確','speaking self: no banner 不正確');
 assert((await pg.locator('main').innerText()).includes('加入「口語重溫」'),'speaking: review note kept');
 await pg.getByRole('button',{name:'🔁 再試（不計分）'}).click().catch(()=>{});
 for(let i=0;i<3;i++){const n=await pg.getByRole('button',{name:/下一題|查看結果/}).count();if(n)await pg.getByRole('button',{name:/下一題|查看結果/}).first().click();const r=await pg.getByRole('button',{name:'顯示答案'}).count();if(r){await pg.getByRole('button',{name:'顯示答案'}).click();await pg.getByRole('button',{name:'✅ 我讀對了'}).click();}}
 console.log('  speaking tail:',(await pg.locator('main').innerText()).slice(0,60).replace(/\n/g,' | '));
 assert(pg.errs.length===0,'speaking no errors '+pg.errs);
 // dialogue wrong choice
 pg=await mk(null);await pg.goto(U);
 await pg.locator('.tile',{hasText:'情境對話'}).click();
 await pg.locator('button',{hasText:'拉麵'}).first().click().catch(async()=>{await pg.locator('.mod-row,.card button').first().click()});
 await pg.waitForTimeout(300);
 const info=await pg.evaluate(()=>{const p=App.Dialogue.peek&&App.Dialogue.peek();return p?{type:p.type,opts:p.options&&p.options.map(o=>o.ok)}:null});
 console.log('  dialogue peek',JSON.stringify(info));
 if(info&&info.opts){const i=info.opts.findIndex(x=>x===false);if(i>=0){await pg.locator('.dlg-opt').nth(i).click();assert(await pg.locator('.fb-note').count()===1,'dialogue: wrong choice shows Tabi note');
  const t=await pg.locator('.fb-note').innerText();console.log('  note:',t);assert(t.length>3,'note has hint text');await pg.screenshot({path:require('./lib').OUT+'/v2_dlg_wrong.png'})}else console.log('  (first turn has no wrong option)')}
 assert(pg.errs.length===0,'dialogue no errors '+pg.errs);
 await b.close()})();
