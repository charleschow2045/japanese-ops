const fs=require('fs'),vm=require('vm');
const win={};win.window=win;
for(const f of ['js/content/numbers.js','js/numquiz.js']) vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'..',f),'utf8'),win);
const NQ=win.App.NumberQuiz;let bad=0;const fail=(...a)=>{bad++;console.log('FAIL',...a)};
// 1) 2-A table vs generator
let checked=0;
for(const t of win.App.Content.NUMBER_TOPICS)for(const r of t.rows){
  let m,kind,v,han=false;
  if(/^\d+$/.test(r.show)){kind='num';v=+r.show}
  else if(m=/^([\d,]+)円$/.exec(r.show)){kind='yen';v=+m[1].replace(/,/g,'')}
  else if(m=/^(\d+)時半$/.exec(r.show)){kind='time';v={h:+m[1],m:30};han=true}
  else if(m=/^(\d+)時$/.exec(r.show)){kind='time';v={h:+m[1],m:0}}
  else if(m=/^(\d+)分$/.exec(r.show)){kind='fun';v=+m[1]}
  else if(m=/^(\d+)人$/.exec(r.show)){kind='nin';v=+m[1]}
  else continue;
  if(kind==='num'&&v===0){ if(NQ.readingSegs('num',0).join('')!=='ゼロ')fail('zero'); continue}
  if(kind==='num'&&v>99)continue; // 100+ in 百千萬 topic: compare as plain number below
  const got=NQ.readingSegs(kind,v,han).join('');checked++;
  if(got!==r.kana)fail('table',r.show,got,r.kana);
}
// big numbers topic rows (digits > 99 treated as yen-like plain numbers)
for(const t of win.App.Content.NUMBER_TOPICS.filter(t=>t.key==='big'))for(const r of t.rows){const v=+r.show.replace(/,/g,'');
  const segs=NQ.readingSegs('num',v);const got=segs.join('');checked++;if(got!==r.kana)fail('big',r.show,got,r.kana)}
console.log('table rows compared',checked);
// 2) spot readings
const spot=[['yen',14,'じゅうよえん'],['yen',600,'ろっぴゃくえん'],['yen',3000,'さんぜんえん'],['yen',10000,'いちまんえん'],['yen',12345,'いちまんにせんさんびゃくよんじゅうごえん'],['yen',100,'ひゃくえん'],['yen',1000,'せんえん'],['yen',10,'じゅうえん'],['yen',40,'よんじゅうえん'],['yen',9999,'きゅうせんきゅうひゃくきゅうじゅうきゅうえん'],['yen',8800,'はっせんはっぴゃくえん'],['yen',7777,'ななせんななひゃくななじゅうななえん'],['yen',104,'ひゃくよえん'],['fun',40,'よんじゅっぷん'],['fun',60,'ろくじゅっぷん'],['fun',14,'じゅうよんぷん'],['fun',11,'じゅういっぷん'],['fun',58,'ごじゅうはっぷん'],['ban',12,'じゅうにばんせん'],['ban',4,'よんばんせん'],['nin',10,'じゅうにん'],['num',99,'きゅうじゅうきゅう'],['num',0,'ゼロ'],['num',44,'よんじゅうよん']];
for(const [k,v,w] of spot){const g=NQ.readingSegs(k,v).join('');if(g!==w)fail('spot',k,v,g,w)}
const ts=[[{h:8,m:8},'はちじはっぷん'],[{h:9,m:15},'くじじゅうごふん'],[{h:4,m:0},'よじ'],[{h:7,m:45},'しちじよんじゅうごふん'],[{h:12,m:59},'じゅうにじごじゅうきゅうふん']];
for(const [v,w] of ts){const g=NQ.readingSegs('time',v,false).join('');if(g!==w)fail('time',JSON.stringify(v),g,w)}
if(NQ.readingSegs('time',{h:3,m:30},true).join('')!=='さんじはん')fail('han');
// 3) exhaustive domain: reading valid, injective
const doms={yen:[100,99999],num:[0,99],ban:[1,20],nin:[1,10],fun:[1,60]};
for(const [k,[a,b]] of Object.entries(doms)){const seen=new Map();
  for(let v=a;v<=b;v++){const segs=NQ.readingSegs(k,v);const kana=segs.join('');
   if(!/^[ぁ-んゼロー]+$/.test(kana))fail('kana chars',k,v,kana);
   const r=segs.map(NQ.romajiOf).join(' ');if(!/^[a-z ]+$/.test(r))fail('romaji',k,v,r);
   if(seen.has(kana))fail('dup reading',k,v,seen.get(kana));seen.set(kana,v)}}
console.log('exhaustive ok');
// 4) generated questions
for(const lv of [1,2,3])for(const k of ['yen','time','ban','nin','fun','num']){
  for(let i=0;i<1500;i++){const v=NQ.sample(k,lv);if(!NQ.ok(k,lv,v)){fail('sample not ok',k,lv,v);break}
    const q=NQ.makeQuestion(k,v,lv);
    if(q.options.length!==4)fail('opt count',k,lv,q.display,q.options.length);
    const ds=q.options.map(o=>o.display);if(new Set(ds).size!==4)fail('dup display',k,lv,ds);
    if(ds.filter(d=>d===q.display).length!==1)fail('target count',k,lv);
    // distinct readings
    const kanas=new Set(q.options.map(o=>{const m=o;return o.vs}));if(kanas.size!==4)fail('dup vs');
    q.options.forEach(o=>{ // every option valid at the level
      let val; if(k==='time'){const [h,mm]=o.vs.split(':').map(Number);val={h,m:mm}}else val=+o.vs;
      if(!NQ.ok(k,lv,val))fail('option not ok',k,lv,o.vs)});
    if(NQ.fromKey(q.key)===null)fail('key roundtrip',q.key);
  }}
// 5) practice builder + keys
for(const cats of [['yen'],['time'],['things'],['num'],['yen','time','things','num']])for(const count of [5,10,20]){
  const qs=NQ.buildPractice({cats,level:2,count});
  const keys=qs.map(q=>q.key);if(new Set(keys).size!==keys.length)fail('dup in round',cats,count);
  if(qs.length<Math.min(count,5))fail('too few',cats,count,qs.length)}
if(NQ.buildPractice({cats:[],level:1,count:5}).length!==0)fail('empty cats');
['n:yen:5','n:yen:abc','n:time:13:00','n:foo:1','n:ban:21','n:nin:0','n:yen:100000','p:x',''].forEach(k=>{if(NQ.fromKey(k)!==null)fail('bad key accepted',k)});
['n:yen:1800','n:time:4:30','n:ban:3','n:nin:3','n:fun:15','n:num:47','n:time:12:59'].forEach(k=>{if(!NQ.fromKey(k))fail('good key rejected',k)});
// romaji samples
const q=NQ.makeQuestion('yen',1800,1);console.log(q.display,q.kana,q.romaji);
const q2=NQ.makeQuestion('time',{h:9,m:15},2);console.log(q2.display,q2.kana,q2.romaji);
const q3=NQ.makeQuestion('yen',14,3);console.log(q3.display,q3.kana,q3.romaji);
console.log(NQ.makeQuestion('fun',40,3).romaji, '|', NQ.makeQuestion('yen',3,3).romaji);
console.log('bad',bad);
