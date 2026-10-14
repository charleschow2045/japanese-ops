const { chromium } = require('./lib');
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{
 const b=await chromium.launch({executablePath:require('./lib').CHROME});
 const pg=await (await b.newContext({viewport:{width:375,height:760},serviceWorkers:'block'})).newPage();const errs=[];
 pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(require('./lib').BASE+'/index.html');
 const r=await pg.evaluate(()=>{
  const S=window.App.Storage;const out={};
  // fresh state has defaults
  const fresh=S.loadState();out.freshNumbers=JSON.stringify(fresh.numbers);
  // build a state with numbers progress
  let s=S.loadState();
  s=S.recordNumberAnswer(s,'yen','n:yen:1800',false);
  s=S.recordNumberAnswer(s,'time','n:time:4:30',true);
  s={...s,numbers:{...s.numbers,prefs:{cats:['yen','things'],level:3,count:20}}};
  const text=JSON.stringify(S.buildBackup(s));
  const parsed=S.parseBackup(text);out.ok=parsed.ok;
  out.stats=JSON.stringify(parsed.state&&parsed.state.numbers);
  out.reviewKey=!!(parsed.state&&parsed.state.review.items['n:yen:1800']);
  // tampered backups
  const tamper=(fn)=>{const o=JSON.parse(text);fn(o.data['japaneseOps:v1']);return S.parseBackup(JSON.stringify(o))};
  const t1=tamper(st=>{st.review.items['n:yen:abc']={box:0,due:'2026-10-10'};st.review.items['n:foo:1']={box:0,due:'2026-10-10'};st.review.items['n:time:4:30']={box:1,due:'2026-10-11'}});
  out.t1=JSON.stringify({ok:t1.ok,keys:t1.ok?Object.keys(t1.state.review.items):null});
  const t2=tamper(st=>{st.numbers={prefs:{cats:['yen','zzz'],level:9,count:7},stats:{yen:{c:1,w:2},__proto__:{c:1,w:1},bad:{c:1,w:1},num:{c:'x',w:1}}}});
  out.t2=JSON.stringify({ok:t2.ok,n:t2.ok?t2.state.numbers:null});
  const t3=tamper(st=>{st.numbers=[1,2]});out.t3=t3.ok?'accepted':t3.reason||t3.error||JSON.stringify(t3);
  const t4=tamper(st=>{delete st.numbers});out.t4=JSON.stringify({ok:t4.ok,n:t4.ok?t4.state.numbers.prefs:null});
  return out;});
 console.log(r);
 assert(r.ok===true&&r.reviewKey,'roundtrip keeps numbers + n: review');
 assert(r.stats.includes('"cats":["yen","things"]')&&r.stats.includes('"level":3')&&r.stats.includes('"count":20'),'prefs roundtrip');
 assert(!r.t1.includes('abc')&&!r.t1.includes('foo')&&r.t1.includes('n:time:4:30'),'bad n: keys dropped, good kept');
 assert(r.t2.includes('"cats":["yen"]')&&r.t2.includes('"level":1')&&r.t2.includes('"count":10')&&!r.t2.includes('bad')&&r.t2.includes('"yen":{"c":1,"w":2'),'bad numbers prefs/stats sanitized');
 assert(/invalid/.test(r.t3),'numbers wrong type → invalid');
 assert(r.t4.includes('"ok":true')&&r.t4.includes('"level":1'),'old backup without numbers → defaults');
 assert(!errs.length,'no errors '+errs);
 await b.close();})();
