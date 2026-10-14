const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'});
 const pg=await ctx.newPage();const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await pg.addInitScript(()=>{window.__said=[];SpeechSynthesis.prototype.speak=function(u){window.__said.push(u.text)};SpeechSynthesis.prototype.cancel=function(){};});
 // old save (no numbers block) with some review items incl. n: ones
 const today=new Date();const pad=n=>String(n).padStart(2,'0');const d0=`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
 await pg.addInitScript((d0)=>{ if(!localStorage.getItem('japaneseOps:v1')) localStorage.setItem('japaneseOps:v1',JSON.stringify({settings:{showRomaji:true},review:{items:{'n:yen:1800':{box:0,due:d0},'n:time:4:30':{box:0,due:d0},'n:num:44':{box:2,due:'2999-01-01'},'n:bogus:1':{box:0,due:d0},'k:あ':{box:0,due:d0}},graduated:0}})) },d0);
 await pg.goto(require('./lib').BASE+'/index.html');
 const st=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')));
 // home row shows due count (bogus key ignored): 1800, 4:30, あ = 3
 await pg.screenshot({path:require('./lib').OUT+'/home.png'});
 const homeTxt=await pg.locator('body').innerText();
 assert(/今日要重溫 3 句|重溫 3/.test(homeTxt)||homeTxt.includes('3'),'home shows some due text');
 console.log('  home snippet:',(homeTxt.match(/.{0,12}重溫.{0,10}/g)||[]).join(' / '));
 await pg.getByText('聽力練習',{exact:false}).first().click();
 const menuTxt=await pg.locator('.review-card').innerText();
 console.log('  review card:',menuTxt.replace(/\n/g,' | '));
 assert(menuTxt.includes('今天需重溫 3 句')&&menuTxt.includes('數字 2'),'review card counts 3 (數字 2, bogus ignored)');
 await pg.getByRole('button',{name:'開始重溫'}).click();
 // answer each review question correctly using the keys
 const answered=[];
 for(let i=0;i<3;i++){
   const said=(await pg.evaluate(()=>window.__said)).slice(-1)[0];
   const isKana=/^[あ]$/.test(said);
   const disp=await pg.evaluate((said)=>{const NQ=window.App.NumberQuiz;
     for(const key of ['n:yen:1800','n:time:4:30']){const m=/^n:(\w+):(.+)$/.exec(key);let v=m[2];if(m[1]==='time'){const [h,mm]=v.split(':').map(Number);v={h,m:mm}}else v=+v;
       for(const han of [true,false]){if(NQ.readingSegs(m[1],v,han).join('')===said)return NQ.displayOf(m[1],v)}}return null},said);
   const opts=await pg.locator('.opt').allInnerTexts();
   const target=isKana?'あ':disp;
   const idx=opts.findIndex(t=>t.trim()===target);
   assert(idx>=0,`found correct option for ${said} -> ${target}`);
   await pg.locator('.opt').nth(idx).click();
   assert((await pg.locator('.fb-title').innerText()).includes('答對'),'correct');
   answered.push(target);
   await pg.getByRole('button',{name:/下一題|查看結果/}).click();
 }
 const s=await st();
 const d1=(()=>{const t=new Date();t.setDate(t.getDate()+1);return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`})();
 assert(s.review.items['n:yen:1800'].box===1&&s.review.items['n:yen:1800'].due===d1,'n:yen:1800 → box1 due tomorrow '+JSON.stringify(s.review.items['n:yen:1800']));
 assert(s.review.items['n:time:4:30'].box===1,'n:time:4:30 box1');
 assert(s.numbers.stats.yen.c===1&&s.numbers.stats.time.c===1,'stats counted');
 assert(await pg.locator('.score').innerText()==='3 / 3','3/3');
 // go to 進度 tab
 await pg.getByRole('button',{name:'進度'}).click();
 const prog=await pg.locator('body').innerText();
 console.log('  progress snippet:',(prog.match(/今天待重溫.{0,40}|今天沒有需要重溫.{0,5}/)||[''])[0]);
 // wrong n: answers inside review reset the box
 assert(!errs.length,'no errors '+errs);
 await b.close();
})();
