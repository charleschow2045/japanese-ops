const fs=require('fs'),vm=require('vm');
const win={};win.window=win;
for(const f of ['js/content/phrases.js','js/content/dialogues.js','js/content/showcards.js']) vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'..',f),'utf8'),win);
const C=win.App.Content;let bad=0;const tags={};const fail=(t,...a)=>{bad++;tags[t]=(tags[t]||0)+1;console.log('FAIL',t,...a)};
const pass=(tag,label)=>{if(!tags[tag])console.log('ok  ',label)};
const base={あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'(ha|wa)',ひ:'hi',ふ:'fu',へ:'(he|e)',ほ:'ho',ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',を:'(o|wo)',ん:"n'?",が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',ざ:'za',じ:'ji',ず:'zu',づ:'zu',ぜ:'ze',ぞ:'zo',だ:'da',で:'de',ど:'do',ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po'};
const yoon={ゃ:'a',ゅ:'u',ょ:'o'};
const kata2hira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
function rx(kana){kana=kata2hira(kana).replace(/[。、？！\s・]/g,'');let out='',dbl=false;
 for(let i=0;i<kana.length;i++){const c=kana[i];if(c==='っ'){dbl=true;continue}
  if(c==='ー'){const lv=out.replace(/\(.*?\)|n'\?/g,'').slice(-1);out+=lv;continue}
  let r=base[c];if(r===undefined)throw new Error('? '+c+' in '+kana);const nx=kana[i+1];
  if(yoon[nx]){const b=base[c];r=(b==='shi'?'sh':b==='chi'?'ch':b==='ji'?'j':b[0]+'y')+yoon[nx];i++}
  if(dbl){r=r.startsWith('ch')?'t'+r:r[0]+r;dbl=false}
  out+=r}
 return new RegExp('^'+out+'$')}
const norm=s=>s.toLowerCase().replace(/[^a-z']/g,'');
const all=[];C.PHRASE_SCENES.forEach(s=>s.phrases.forEach(p=>{all.push({p,scene:s.key});(p.replies||[]).forEach(r=>all.push({p:r,scene:s.key}))}));
const ids=new Set();const per={};
all.forEach(({p,scene})=>{if(ids.has(p.id))fail('dup id',p.id);ids.add(p.id);per[scene]=(per[scene]||0)+1
  try{if(!rx(p.kana).test(norm(p.romaji)))fail('romaji',p.id,p.kana,p.romaji)}catch(e){const T=require('./rom.js').toRomaji;const fx=x=>norm(x).replace(/wa/g,'ha').replace(/o(?=[^aiueo]|$)/g,'o');if(fx(T(p.kana))!==fx(p.romaji))fail('conv',p.id,e.message)}
  let pos=0;const k=p.kana.replace(/[、。？！]/g,'');for(const seg of p.ja.replace(/[、。？！]/g,'').split(/[^぀-ヿー]+/).filter(Boolean)){const j=k.indexOf(seg,pos);if(j<0){fail('ja/kana',p.id,seg);break}pos=j+seg.length}
  for(const f of ['ja','kana','romaji','yue','use','who'])if(!p[f])fail('missing',p.id,f);
  if(!['me','staff','both'].includes(p.who))fail('who',p.id);
  if(/[ぁ-んァ-ヶー一-龥]/.test(p.yue)&&/[唔冇喺俾嘢啲撳嚟咗嘅啱]/.test(p.yue+p.use))fail('colloquial',p.id,p.yue,p.use)});
pass('dup id','315 sentence ids are unique ('+ids.size+')');
pass('romaji','romaji matches kana (regex rules)');
pass('conv','romaji matches kana (generator, small kana + particles)');
pass('ja/kana','every kana/katakana run in ja appears in kana');
pass('missing','required fields present on every sentence (ja kana romaji yue use who)');
pass('who','who is me / staff / both');
pass('colloquial','no Cantonese colloquial characters in yue / use');
const want={polite:29,restaurant:43,shopping:34,transport:38,hotel:32,directions:24,emergency:37,airport:26,sight:21,onsen:15,call:16};
for(const[k,v]of Object.entries(want))if(per[k]!==v)fail('count',k,per[k],v);
if(all.length!==315)fail('count','315 total',all.length);
pass('count','sentence counts per scene (11 scenes, 315 total)');
const g=id=>all.find(x=>x.p.id===id).p;
if(g('call-04').say!=='しちじでお願いします。')fail('call-04','call-04 say');
pass('call-04','call-04 say = しちじでお願いします。');
if(all.some(x=>x.p.ja.includes('禁煙席')))fail('rest','smoking Q&A must not exist');
if(g('rest-35').ja!=='窓側の席をお願いします。')fail('rest','rest-35 shifted');
if(g('rest-43').ja!=='セットにしてください。')fail('rest','rest-43 = セット');
if(g('rest-40').ja!=='辛くしないでください。'||g('rest-41').ja!=='お会計は別々でお願いします。')fail('rest','rest-40/41');
pass('rest','restaurant renumbering (no smoking Q&A, rest-35..43)');
const says=all.filter(x=>x.p.say).map(x=>x.p.id).join(',');
if(says!=='rest-30,trans-24,trans-25,trans-27,trans-28,trans-30,hotel-22,hotel-23,hotel-24,hotel-25,dir-07,sight-17,sight-18,sight-19,sight-20,onsen-13,onsen-14,call-04')fail('say','say ids: '+says);
pass('say','18 sentences carry a say fix (12 + 6 new price sentences)');
const hs=['hotel-22','hotel-23','hotel-24','hotel-25'].map(i=>g(i).say).join('|');
if(hs!=='じゅういち時です。|じゅう時です。|しちじからです。|はち時からです。')fail('hotel','hotel-22..25 say changed: '+hs);
pass('hotel','hotel-24 say = しちじからです。（全假名）；hotel-22/23/25 維持原樣');
const digits=all.filter(x=>/^(sight|onsen|call)-/.test(x.p.id)||/^(polite-2[4-9]|rest-(3[5-9]|4[0-3])|shop-(2[7-9]|3\d)|trans-3[1-8]|hotel-(2[7-9]|3\d)|dir-(19|2\d)|emer-3[3-7])$/.test(x.p.id)).filter(x=>/[0-9]/.test(x.p.ja));
const digitIds=digits.map(x=>x.p.id).join();
if(digitIds!=='sight-17,sight-18,sight-19,sight-20,onsen-13,onsen-14'||digits.some(x=>!x.p.say))fail('digits','arabic digits only in the 6 price sentences (all with say): '+digitIds);
pass('digits','no arabic numerals in the 88 sentences of 階段 9C; the only digits in sight/onsen/call are the 6 price sentences (each has say)');
// stage 10 (6) version 1: 12 new sentences
const nw={'sight-17':['大人は1,000円です。','おとなはせんえんです','otona wa sen en desu','大人はせん円です。'],'sight-18':['大人は1,500円です。','おとなはせんごひゃくえんです','otona wa sen gohyaku en desu','大人はせんごひゃく円です。'],'sight-19':['2,000円です。','にせんえんです','nisen en desu','にせん円です。'],'sight-20':['3,000円です。','さんぜんえんです','sanzen en desu','さんぜん円です。'],'sight-21':['こちらがチケットです。','こちらがチケットです','kochira ga chiketto desu'],'onsen-13':['800円です。','はっぴゃくえんです','happyaku en desu','はっぴゃく円です。'],'onsen-14':['1,000円です。','せんえんです','sen en desu','せん円です。'],'onsen-15':['はい、お貸しできます。','はい、おかしできます','hai, okashi dekimasu'],'call-13':['お電話ありがとうございます。','おでんわありがとうございます','odenwa arigatou gozaimasu'],'call-14':['はい、承ります。','はい、うけたまわります','hai, uketamawarimasu'],'call-15':['チャンです。','チャンです','chan desu'],'call-16':['お待ちしております。','おまちしております','omachi shite orimasu']};
const nwBad=Object.entries(nw).filter(([id,v])=>{const p=g(id);return p.ja!==v[0]||p.kana!==v[1]||p.romaji!==v[2]||(p.say||'')!==(v[3]||'')}).map(([id])=>id);
if(nwBad.length)fail('new12','new sentence text differs: '+nwBad);
const nwWho=Object.keys(nw).filter(id=>g(id).who!==(id==='call-15'?'me':'staff'));
if(nwWho.length)fail('new12','who wrong: '+nwWho);
pass('new12','12 new sentences (sight-17..21, onsen-13..15, call-13..16): ja / kana / romaji / say as approved; call-15 is the only 🗣️');
if(!g('shop-25').use.includes('例如免稅、刷卡'))fail('shop25','shop-25 use text');
pass('shop25','shop-25 use = 被問到可否辦理（例如免稅、刷卡）時店員回答');
// show cards: every ref points at a real sentence
const refs=C.SHOW_GROUPS.flatMap(g=>g.cards).filter(c=>c.ref);
refs.forEach(c=>{if(!ids.has(c.ref))fail('ref','show card ref missing',c.id,c.ref)});
if(refs.length!==14)fail('ref','14 ref cards expected, got '+refs.length);
pass('ref','14 show-card refs all resolve to library ids');
if(C.SHOW_GROUPS.flatMap(g=>g.cards).length!==37)fail('show','37 show cards');
pass('show','37 show cards');
// 必學 30 句: ids exist, unique, 21 you say + 9 you understand
const must=C.MUST_HAVE||[];
if(must.length!==30||new Set(must).size!==30)fail('must','MUST_HAVE must be 30 unique ids, got '+must.length+'/'+new Set(must).size);
const missingMust=must.filter(i=>!ids.has(i));
if(missingMust.length)fail('must','MUST_HAVE ids not in the library: '+missingMust);
const mine=must.filter(i=>['me','both'].includes(g(i).who)).length;
if(mine!==21||must.length-mine!==9)fail('must','必學 should be 21 me/both + 9 staff, got '+mine+' + '+(must.length-mine));
pass('must','必學 30 句：30 個 id 唔重複、全部喺句子庫、21 句你說 + 9 句聽懂');
console.log(bad?'FAILED '+bad:'data OK');process.exit(bad?1:0);
