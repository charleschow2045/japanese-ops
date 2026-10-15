const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const OLD=["polite","restaurant","shopping","transport","hotel","directions","emergency"];
const NEW3=['sight','onsen','call'];
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const mk=async(seed)=>{const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);
   pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
   await pg.addInitScript((seed)=>{window.__sp=[];SpeechSynthesis.prototype.speak=function(u){window.__sp.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};if(seed&&!localStorage.getItem('japaneseOps:v1'))localStorage.setItem('japaneseOps:v1',JSON.stringify(seed))},seed);return pg};
 const st=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')));
 const U=require('./lib').BASE+'/index.html';
 // 1 fresh
 let pg=await mk(null);await pg.goto(U);
 const home=await pg.locator('main').innerText();
 assert(home.includes('11 個旅行情境'),'home text 11 個旅行情境');
 await pg.locator('.tile',{hasText:'情境句子庫'}).click();
 const rows=await pg.locator('.tile,.mod-row').allInnerTexts();
 assert(rows.length===13,'2 cards + 11 scenes listed ('+rows.length+')');
 console.log('  last 3:',rows.slice(-3).map(r=>r.replace(/\n/g,' ')).join(' / '));
 assert(rows[10].includes('觀光景點')&&rows[10].includes('16 句')&&rows[11].includes('溫泉')&&rows[11].includes('12 句')&&rows[12].includes('預約與電話')&&rows[12].includes('12 句'),'new scene rows & counts');
 assert(rows[3].includes('43 句')&&rows[4].includes('34 句'),'restaurant 43, shopping 34');
 await pg.locator('.tile,.mod-row',{hasText:'預約與電話'}).click();
 assert(await pg.locator('.phrase').count()>=10,'call scene lists cards');
 const t=await pg.locator('main').innerText();assert(t.includes('今晚兩位可以預約嗎')&&t.includes('請告訴我您的姓名'),'call scene Q&A shown');
 // call-04 spoken with say
 await pg.locator('.phrase',{hasText:'七點'}).first().getByRole('button',{name:/聽/}).first().click();
 const sp=await pg.evaluate(()=>window.__sp);console.log('  spoken',JSON.stringify(sp));
 assert(sp.includes('しちじでお願いします。'),'call-04 🔊 speaks しちじ (say)');
 assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),'no h-scroll');
 let s=await st(pg);
 assert(NEW3.every(k=>s.listen.prefs.scenes.includes(k)&&s.speak.prefs.scenes.includes(k))&&s.listen.prefs.sv===3,'fresh: new scenes ticked, sv=3');
 await pg.goto(U);await pg.locator('.tile',{hasText:'聽力'}).click();
 for(const n of ['觀光景點','溫泉','預約與電話']) assert(await pg.getByRole('button',{name:new RegExp(n)}).count()>=1,'聽力 chip '+n);
 await pg.goto(U);await pg.locator('.tile',{hasText:'口語'}).click();
 for(const n of ['觀光景點','溫泉','預約與電話']) assert(await pg.getByRole('button',{name:new RegExp(n)}).count()>=1,'口語 chip '+n);
 assert(!pg.errs.length,'fresh no errors '+pg.errs);
 // 2 sv-less save, 7 ticked → airport + 3 new
 pg=await mk({settings:{},listen:{prefs:{scenes:OLD,count:5,staffOnly:false}},speak:{prefs:{scenes:OLD,count:5,mode:'self'}}});
 await pg.goto(U);await pg.locator('.tile',{hasText:'聽力'}).click();
 for(const n of ['機場入境','觀光景點','溫泉','預約與電話']) assert(await pg.locator('.chip.active',{hasText:n}).count()===1,'old (7 ticked) save: '+n+' ticked');
 // 3 sv=2 save with all 8 → +3 new
 pg=await mk({listen:{prefs:{scenes:[...OLD,'airport'],sv:2,count:10,staffOnly:false}},speak:{prefs:{scenes:[...OLD,'airport'],sv:2,count:10,mode:'self'}}});
 await pg.goto(U);await pg.locator('.tile',{hasText:'聽力'}).click();
 for(const n of ['觀光景點','溫泉','預約與電話']) assert(await pg.locator('.chip.active',{hasText:n}).count()===1,'sv2 (8 ticked): '+n+' ticked');
 await pg.getByRole('button',{name:/溫泉/}).click();s=await st(pg);
 assert(!s.listen.prefs.scenes.includes('onsen')&&s.listen.prefs.sv===3,'user un-ticks 溫泉 → saved, sv=3');
 await pg.reload();await pg.locator('.tile',{hasText:'聽力'}).click();assert(await pg.locator('.chip.active',{hasText:'溫泉'}).count()===0,'un-ticked 溫泉 stays off after reload');
 // 4 sv=2 save with airport unticked → nothing added
 pg=await mk({listen:{prefs:{scenes:OLD,sv:2,count:10,staffOnly:false}}});
 await pg.goto(U);await pg.locator('.tile',{hasText:'聽力'}).click();
 assert(await pg.locator('.chip.active',{hasText:'機場入境'}).count()===0&&await pg.locator('.chip.active',{hasText:'觀光景點'}).count()===0,'sv2 with 機場入境 un-ticked: nothing added');
 // 5 sv=2 save with one old scene unticked → nothing added
 pg=await mk({listen:{prefs:{scenes:[...OLD.filter(k=>k!=='hotel'),'airport'],sv:2,count:10,staffOnly:false}}});
 await pg.goto(U);await pg.locator('.tile',{hasText:'聽力'}).click();
 assert(await pg.locator('.chip.active',{hasText:'觀光景點'}).count()===0,'sv2 with 酒店 un-ticked: new scenes not added');
 // 6 progress + daily + backup
 pg=await mk(null);await pg.goto(U);await pg.getByRole('button',{name:'進度'}).click();
 const pt=await pg.locator('main').innerText();
 assert(pt.includes('303')&&pt.includes('觀光景點')&&pt.includes('溫泉')&&pt.includes('預約與電話'),'進度頁 303 + new scenes');
 const plan=await pg.evaluate(()=>{const S=window.App.Storage;let s=S.loadState();s={...s,daily:{...s.daily,cursor:8,days:{}}};const r=window.App.Daily.ensureToday(s);return r.daily.days[S.todayLocal()].newIds});
 assert(plan.length>0&&plan.every(id=>id.startsWith('sight-')),'daily new sentences can come from 觀光景點: '+plan.join(','));
 const bk=await pg.evaluate(()=>{const S=window.App.Storage;const s=S.loadState();const t=JSON.stringify(S.buildBackup(s));const r=S.parseBackup(t);
   const o=JSON.parse(t);const st=o.data['japaneseOps:v1'];st.listen.prefs.sv=2;st.listen.prefs.scenes=["polite","restaurant","shopping","transport","hotel","directions","emergency"];const r2=S.parseBackup(JSON.stringify(o));
   return {ok:r.ok,sv:r.state.listen.prefs.sv,sv2:r2.state.listen.prefs.sv,scenes2:r2.state.listen.prefs.scenes.length}});
 assert(bk.ok&&bk.sv===3,'backup roundtrip keeps sv 3');
 assert(bk.scenes2===7&&bk.sv2===3,'old-format backup with airport un-ticked (sv 2): nothing added '+JSON.stringify(bk));
 // 7 show cards → refs
 await pg.goto(U);await pg.locator('.tile',{hasText:'指給店員看'}).click();
 const rowsShow=await pg.locator('main').innerText();
 for(const x of ['辛くしないでください','お会計は別々でお願いします','プレゼント用に包んでもらえますか','領収書をください','タッチ決済は使えますか','切符をなくしました','部屋の鍵が使えません','薬のアレルギーがあります','試着室はどこですか'])
   assert(rowsShow.includes(x),'show list still has '+x);
 const ref=await pg.evaluate(()=>{const G=window.App.Content.SHOW_GROUPS;const all=G.flatMap(g=>g.cards);const refs=all.filter(c=>c.ref).map(c=>c.id);return {n:all.length,refs:refs.length,ids:refs.join(',')}});
 console.log('  show',JSON.stringify(ref));assert(ref.n===37&&ref.refs===14,'37 show cards, 14 refs');
 await pg.locator('button:has(.show-row-ja)',{hasText:'領収書'}).click();
 assert(await pg.locator('.show-viewer').count()===1&&(await pg.locator('.show-text').innerText()).includes('領収書をください'),'ref card opens full-screen with library text');
 assert(!pg.errs.length,'no errors '+pg.errs);
 await b.close();})().catch(e=>{console.log('ERR',e.message.slice(0,400));process.exit(1)});
