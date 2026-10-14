const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const OLD=["polite","restaurant","shopping","transport","hotel","directions","emergency"];
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const mk=async(seed)=>{const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);
   pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
   await pg.addInitScript((seed)=>{SpeechSynthesis.prototype.speak=function(){};SpeechSynthesis.prototype.cancel=function(){};if(seed&&!localStorage.getItem('japaneseOps:v1'))localStorage.setItem('japaneseOps:v1',JSON.stringify(seed))},seed);return pg};
 const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')));
 // 1) fresh install
 let pg=await mk(null);await pg.goto(require('./lib').BASE+'/index.html');
 const home=await pg.locator('main').innerText();
 assert(home.includes('11 個旅行情境')&&home.includes('與店員一問一答'),'home text: 11 個旅行情境 / 情境對話');
 await pg.locator('.tile,.mod-row',{hasText:'情境句子庫'}).click();
 const rows=await pg.locator('.tile,.mod-row').allInnerTexts();
 assert(rows.length===11&&rows[7].includes('機場入境')&&rows[7].includes('26 句'),'scene list: 11 scenes, 機場入境 8th with 26 句 → '+rows[7].replace(/\n/g,' '));
 await pg.locator('.tile,.mod-row',{hasText:'機場入境'}).click();
 assert(await pg.locator('.phrase').count()>=10,'scene page lists cards');
 const t=await pg.locator('main').innerText();
 assert(t.includes('這是手信')&&t.includes('自用的')&&t.includes('jibun’you desu')&&t.includes('免稅手續'),'scene page shows 手信 / 自用的 / jibun’you desu / 免稅 sentence');
 assert(!t.includes('二維碼')&&!t.includes('免稅品'),'no QR / 免稅品 sentence');
 let s=await st(pg);console.log('  fresh prefs',JSON.stringify(s.listen.prefs.scenes.slice(-2)),s.listen.prefs.sv,s.speak.prefs.sv);
 assert(s.listen.prefs.scenes.includes('airport')&&s.speak.prefs.scenes.includes('airport')&&s.listen.prefs.sv===3,'fresh state: airport ticked in 聽力 and 口語');
 // filters
 await pg.getByRole('button',{name:'👂 店員說'}).click();
 assert(await pg.locator('.phrase').count()>0,'staff filter works');
 // listening menu chips
 await pg.goto(require('./lib').BASE+'/index.html');await pg.locator('.tile,.mod-row',{hasText:'聽力練習'}).click();
 assert(await pg.getByRole('button',{name:/機場入境/}).count()>=1,'聽力練習 has 機場入境 chip');
 assert(!pg.errs.length,'fresh: no errors '+pg.errs);
 // 2) old save: all 7 ticked, no sv → airport added once
 pg=await mk({settings:{},listen:{prefs:{scenes:OLD,count:5,staffOnly:false}},speak:{prefs:{scenes:OLD,count:5,mode:'self'}}});
 await pg.goto(require('./lib').BASE+'/index.html');await pg.locator('.tile,.mod-row',{hasText:'聽力練習'}).click();
 s=await st(pg);
 // loadState normalizes but only saves on change; trigger a save via toggling a chip
 await pg.getByRole('button',{name:/機場入境/}).click();
 s=await st(pg);
 assert(!s.listen.prefs.scenes.includes('airport')&&s.listen.prefs.sv===3,'old save: airport was ticked on load; user un-ticks it → saved without airport, sv=3');
 await pg.reload();await pg.locator('.tile,.mod-row',{hasText:'聽力練習'}).click();
 const on=await pg.locator('.chip.active',{hasText:'機場入境'}).count();
 assert(on===0,'un-ticked 機場入境 stays un-ticked after reload (not re-added)');
 // speak prefs got migrated in memory: check by opening 口語
 await pg.goto(require('./lib').BASE+'/index.html');await pg.locator('.tile,.mod-row',{hasText:'口語練習'}).click();
 assert(await pg.locator('.chip.active',{hasText:'機場入境'}).count()===1,'old save: 口語 情境 gets 機場入境 ticked');
 // 3) old save where user had un-ticked something → airport NOT added
 pg=await mk({listen:{prefs:{scenes:OLD.filter(k=>k!=='hotel'),count:10,staffOnly:false}}});
 await pg.goto(require('./lib').BASE+'/index.html');await pg.locator('.tile,.mod-row',{hasText:'聽力練習'}).click();
 assert(await pg.locator('.chip.active',{hasText:'機場入境'}).count()===0&&await pg.locator('.chip.active',{hasText:'酒店'}).count()===0,'old save with 酒店 un-ticked: 機場入境 not added, choice kept');
 // 4) progress page + daily plan include the new scene
 pg=await mk(null);await pg.goto(require('./lib').BASE+'/index.html');await pg.getByRole('button',{name:'進度'}).click();
 const pt=await pg.locator('main').innerText();
 console.log('  progress:',(pt.match(/.{0,40}215.{0,20}/)||['(no 215)'])[0].replace(/\n/g,' '),'| scene:',pt.includes('機場入境'));
 assert(pt.includes('機場入境')&&pt.includes('303'),'進度頁 lists 機場入境 and totals 303');
 // daily: simulate cursor to airport
 const plan=await pg.evaluate(()=>{const S=window.App.Storage;let s=S.loadState();s={...s,daily:{...s.daily,cursor:7,days:{}}};const r=window.App.Daily.ensureToday(s);return r.daily.days[S.todayLocal()].newIds});
 assert(plan.every(id=>id.startsWith('air-'))&&plan.length>0,'daily 今日新句子 can pick 機場入境 sentences: '+plan.join(','));
 // 5) backup roundtrip + old backup
 const bk=await pg.evaluate(()=>{const S=window.App.Storage;const s=S.loadState();const t=JSON.stringify(S.buildBackup(s));const r=S.parseBackup(t);
   const o=JSON.parse(t);const st=o.data['japaneseOps:v1'];delete st.listen.prefs.sv;delete st.speak.prefs.sv;st.listen.prefs.scenes=["polite","restaurant","shopping","transport","hotel","directions","emergency"];const r2=S.parseBackup(JSON.stringify(o));
   return {ok:r.ok,sv:r.state.listen.prefs.sv,old:r2.ok&&r2.state.listen.prefs.scenes.includes('airport'),oldsv:r2.state.listen.prefs.sv}});
 assert(bk.ok&&bk.sv===3&&bk.old&&bk.oldsv===3,'backup: roundtrip keeps sv; old-format backup gets 機場入境 added '+JSON.stringify(bk));
 assert(!pg.errs.length,'no errors '+pg.errs);
 await b.close();})().catch(e=>{console.log('ERR',e.message.slice(0,300));process.exit(1)});
