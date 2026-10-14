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
 await pg.locator('.tile,.mod-row',{hasText:'指給店員看'}).click();
 // allergy builder
 const ac=pg.locator('.card.accent:has-text("過敏卡")');
 assert(await ac.getByRole('button',{name:'請先勾選'}).isDisabled(),'allergy: disabled until ticked');
 await ac.getByRole('button',{name:/^卵/}).click();
 let txt=await ac.innerText();assert(txt.includes('私は卵のアレルギーがあります。卵が入っていない料理はありますか。'),'single allergen sentence');
 assert(txt.includes('我對蛋過敏，有沒有不含蛋的菜？'),'single 中文');
 await ac.getByRole('button',{name:'給店員看'.length?/給店員看/:''}).click();
 assert((await pg.locator('.show-main').innerText())==='私は卵のアレルギーがあります。卵が入っていない料理はありますか。','viewer shows built sentence');
 await pg.getByRole('button',{name:'English'}).click();
 assert((await pg.locator('.show-en').innerText())==="I'm allergic to eggs. Do you have dishes without eggs?",'single English');
 await pg.getByRole('button',{name:'🔊 唸給對方聽'}).click();
 assert((await pg.evaluate(()=>window.__said)).slice(-1)[0]==='私はたまごのアレルギーがあります。たまごが入っていない料理はありますか。','speech uses kana for the item');
 await pg.getByRole('button',{name:'✕ 關閉'}).click();
 // multi
 await ac.getByRole('button',{name:/^落花生/}).click();await ac.getByRole('button',{name:/^くるみ/}).click();
 txt=await ac.innerText();
 assert(txt.includes('私は卵、落花生、くるみのアレルギーがあります。これらが入っていない料理はありますか。'),'multi allergen sentence: '+txt.split('\n').filter(l=>l.includes('私は')));
 let s=await st();assert(JSON.stringify(s.show.allergens)==='["egg","peanut","walnut"]','allergens saved');
 await ac.getByRole('button',{name:/給店員看/}).click();
 if(!(await pg.locator('.show-en').count()))await pg.getByRole('button',{name:'English'}).click();if(!(await pg.locator('.show-reading').count()))await pg.getByRole('button',{name:'讀音'}).click();
 const foot=await pg.locator('.show-foot').innerText();
 assert(foot.includes('I\'m allergic to eggs, peanuts, walnuts. Do you have dishes without them?')&&foot.includes('watashi wa tamago, rakkasei, kurumi no arerugii ga arimasu. korera ga haitte inai ryouri wa arimasu ka'),'multi English + romaji');
 await pg.getByRole('button',{name:'✕ 關閉'}).click();
 // deselect all → card unavailable again
 for(const n of [/^卵/,/^落花生/,/^くるみ/]) await ac.getByRole('button',{name:n}).click();
 assert(await ac.getByRole('button',{name:'請先勾選'}).isDisabled(),'back to disabled when none ticked');
 // avoid
 const vc=pg.locator('.card.accent:has-text("不吃卡")');
 await vc.getByRole('button',{name:/^豚肉/}).click();await vc.getByRole('button',{name:/^生もの/}).click();
 await vc.getByRole('button',{name:/給店員看/}).click();
 assert((await pg.locator('.show-main').innerText())==='豚肉、生ものは食べられません。','avoid sentence');
 await pg.getByRole('button',{name:'✕ 關閉'}).click();
 // saved cards
 const row=pg.locator('.show-row',{hasText:'この住所までお願いします'});
 assert(await row.evaluate(e=>e.classList.contains('disabled')),'address card disabled before input');
 const addr=pg.locator('textarea.show-input');
 await addr.fill('〒160-0022 東京都新宿区新宿1-1-1');
 await pg.locator('input.show-input').first().fill('ホテルさくら 新宿');
 await pg.locator('.mod-header h2').click(); // blur → change
 await pg.waitForTimeout(100);
 assert(await pg.evaluate(()=>document.activeElement!==null),'');
 s=await st();assert(s.show.saved.hotelAddress.includes('新宿区')&&s.show.saved.hotelName==='ホテルさくら 新宿','saved to storage');
 assert(!(await pg.locator('.show-row',{hasText:'この住所までお願いします'}).evaluate(e=>e.classList.contains('disabled'))),'address card enabled after input');
 assert(await pg.locator('.show-row.disabled').count()===1,'only phone card still disabled');
 // inputs keep their text after the redraw
 assert((await pg.locator('textarea.show-input').inputValue()).includes('新宿区')&&(await pg.locator('input.show-input').first().inputValue())==='ホテルさくら 新宿','inputs keep values');
 await pg.locator('.show-row',{hasText:'この住所までお願いします'}).click();await pg.waitForTimeout(150);
 assert((await pg.locator('.show-body').innerText()).includes('東京都新宿区'),'address shown big');
 assert((await pg.locator('.show-lead').innerText())==='この住所までお願いします。','lead phrase above address');
 const fits=await pg.evaluate(()=>{const t=document.querySelector('.show-text'),s=t.parentElement;return t.scrollHeight<=s.clientHeight&&t.scrollWidth<=s.clientWidth});
 assert(fits,'address card fits');
 await pg.screenshot({path:require('./lib').OUT+'/show-addr.png'});
 await pg.getByRole('button',{name:'🔊 唸給對方聽'}).click();
 assert((await pg.evaluate(()=>window.__said)).slice(-1)[0]==='この住所までお願いします。','🔊 reads the phrase, not the address');
 // next card skips empty phone card (name → ... ) navigation order among shown
 await pg.getByRole('button',{name:'下一張'}).click();
 assert((await pg.locator('.show-lead').innerText())==='ホテルまでお願いします。','next = hotel name card');
 await pg.getByRole('button',{name:'下一張'}).click();
 assert((await pg.locator('.show-main').innerText())==='ここで降ります。','empty phone card skipped');
 // tab switch while open (via script; the viewer covers the tab bar)
 await pg.evaluate(()=>document.querySelectorAll('.tab')[2].click());
 assert(await pg.locator('.show-viewer').count()===0,'switching tab closes viewer');
 await pg.evaluate(()=>document.querySelectorAll('.tab')[0].click());
 assert(await pg.locator('.show-viewer').count()===0,'back on home, no viewer');
 // sanitize / long input trimmed
 const long='あ'.repeat(500);
 await pg.locator('.tile,.mod-row',{hasText:'指給店員看'}).click();
 await pg.locator('input.show-input').nth(1).fill(long.slice(0,300)).catch(()=>{});
 assert(!errs.length,'no errors '+errs);
 await b.close();
})().catch(e=>{console.log(e);process.exit(1)});
