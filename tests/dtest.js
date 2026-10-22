const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const S=require('./lib').OUT;
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 for (const scheme of ['light','dark']) {
  const ctx=await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block',colorScheme:scheme});const pg=await ctx.newPage();pg.setDefaultTimeout(5000);const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{SpeechSynthesis.prototype.speak=function(){};SpeechSynthesis.prototype.cancel=function(){};});
  await pg.goto(require('./lib').BASE+'/index.html');
  const audit=async(label)=>{
   const bad=await pg.evaluate(()=>{
    const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
    const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
    const bgOf=el=>{let e=el;let layers=[];while(e){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break}e=e.parentElement}
      let base={r:255,g:255,b:255};for(let i=layers.length-1;i>=0;i--){const l=layers[i];base={r:base.r*(1-l.a)+l.r*l.a,g:base.g*(1-l.a)+l.g*l.a,b:base.b*(1-l.a)+l.b*l.a}}return base};
    const out=[];
    document.querySelectorAll('#main *, #tabbar *').forEach(el=>{
     if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;
     const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return;
     const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
     const fg=parse(cs.color);const bg=bgOf(el);const a=fg.a;const f={r:fg.r*a+bg.r*(1-a),g:fg.g*a+bg.g*(1-a),b:fg.b*a+bg.b*(1-a)};
     const L1=lum(f),L2=lum(bg);const cr=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
     const size=parseFloat(cs.fontSize);const bold=parseInt(cs.fontWeight)>=700;const need=(size>=24||(size>=18.66&&bold))?3:4.5;
     const dis=el.closest('button:disabled');
     if(cr<need&&!dis)out.push(el.className+' "'+el.textContent.trim().slice(0,20)+'" '+cr.toFixed(2));
    });return out});
   console.log(scheme,label,'contrast issues:',bad.length);bad.slice(0,8).forEach(x=>console.log('   ',x));
  };
  const shot=async n=>pg.screenshot({path:`${S}/D-${scheme}-${n}.png`,fullPage:false});
  assert(await pg.locator('.tile').count()===8,scheme+': 8 home tiles');
  assert(await pg.locator('.tile.planned').count()===0,scheme+': no planned tile (看得懂 is live)');
  await shot('home'); await audit('home');
  await pg.locator('.tile',{hasText:'五十音'}).click(); await shot('kanamenu'); await audit('kana menu');
  await pg.locator('.tile,.mod-row',{hasText:'字表'}).first().click(); await shot('chart'); await audit('chart');
  await pg.locator('.tab',{hasText:'主頁'}).click();
  await pg.locator('.tile',{hasText:'聽力'}).click(); await shot('listening'); await audit('listening');
  await pg.locator('.tab',{hasText:'進度'}).click(); await shot('progress'); await audit('progress');
  await pg.locator('.tab',{hasText:'設定'}).click(); await shot('settings'); await audit('settings');
  // theme chips
  await pg.getByRole('button',{name:'🌙 深色'}).click();
  assert(await pg.evaluate(()=>document.documentElement.getAttribute('data-theme'))==='dark',scheme+': forced dark');
  assert(await pg.evaluate(()=>document.querySelector('meta[name=theme-color]').content)==='#0F1830',scheme+': meta dark');
  await shot('settings-dark-forced'); await audit('forced dark settings');
  await pg.getByRole('button',{name:'☀️ 淺色'}).click();
  assert(await pg.evaluate(()=>document.documentElement.getAttribute('data-theme'))==='light',scheme+': forced light');
  await pg.getByRole('button',{name:'跟隨手機'}).click();
  assert(await pg.evaluate(()=>document.documentElement.hasAttribute('data-theme'))===false,scheme+': auto removes attr');
  const st=await pg.evaluate(()=>JSON.parse(localStorage.getItem('japaneseOps:v1')));assert(st.settings.theme==='auto',scheme+': theme saved');
  assert(!(await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)),scheme+': no h-scroll');
  // show viewer stays light
  await pg.locator('.tab',{hasText:'主頁'}).click();
  await pg.locator('.tile',{hasText:'指給店員看'}).click();
  await shot('showlist'); await audit('show list');
  await pg.locator('.show-card,.mod-row,.card button',{hasText:'謝謝'}).first().click().catch(()=>{});
  const vb=await pg.evaluate(()=>{const v=document.querySelector('.show-viewer');return v?getComputedStyle(v).backgroundColor:null});
  console.log('  viewer bg',vb); if(vb){assert(vb==='rgb(255, 253, 246)',scheme+': viewer light');await shot('viewer');}
  assert(errs.length===0,scheme+': no page errors '+errs.join('|'));
  await ctx.close();
 }
 await b.close();
})();
