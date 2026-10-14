// Hepburn generator. Input marks: {は}{を}{へ} = particles (wa/o/e); "|" = word break (space in romaji, removed from kana)
const B={あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',を:'o',ん:'n',が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',ざ:'za',じ:'ji',ず:'zu',づ:'zu',ぜ:'ze',ぞ:'zo',だ:'da',で:'de',ど:'do',ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po'};
const SM={ゃ:'a',ゅ:'u',ょ:'o'};
const SMV={ぁ:'a',ぃ:'i',ぅ:'u',ぇ:'e',ぉ:'o'};
const k2h=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
// katakana special combos → romaji (after hira conversion)
const COMBO={'ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo','てぃ':'ti','でぃ':'di','ちぇ':'che','しぇ':'she','じぇ':'je','うぃ':'wi','うぇ':'we','うぉ':'wo','とぅ':'tu','どぅ':'du','つぁ':'tsa','ゔぁ':'va'};
function toRomaji(src0){
  const src=spaced(src0);
  const parts=[];let cur='';
  // handle particle markers
  const tokens=[];let i=0;
  while(i<src.length){const c=src[i];
    if(c==='{'){const j=src.indexOf('}',i);tokens.push({p:src.slice(i+1,j)});i=j+1}
    else if(c==='|'){tokens.push({sp:true});i++}
    else{tokens.push({k:c});i++}}
  let out='';let word='';const flush=()=>{if(word)out+=(out?' ':'')+word;word=''};
  const seq=[];tokens.forEach(t=>seq.push(t));
  // build kana string with particle placeholders
  let hira='';const map=[];
  for(const t of seq){ if(t.sp){map.push({sp:1});continue} if(t.p){map.push({p:t.p});continue} map.push({c:k2h(t.k),raw:t.k}) }
  // flatten into list of items: chars
  const items=map;
  let dbl=false;
  for(let n=0;n<items.length;n++){
    const it=items[n];
    if(it.sp){flush();continue}
    if(it.p){const r={は:'wa',を:'o',へ:'e'}[it.p];if(!r)throw new Error('bad particle '+it.p);flush();out+=(out?' ':'')+r;continue}
    if(it.c==='、'||it.c==='。'){if(it.c==='、')word+=',';flush();continue}
    if(it.c==='？'||it.c==='！'){continue}
    const c=it.c;
    if(c==='っ'){dbl=true;continue}
    if(c==='ー'){const v=word.replace(/[^aiueo]/g,'').slice(-1);word+=v;continue}
    // combos
    const nx=items[n+1]&&items[n+1].c;
    if(nx&&COMBO[c+nx]){let r=COMBO[c+nx];if(dbl){r=r[0]+r;dbl=false}word+=r;n++;continue}
    let r=B[c];if(r===undefined)throw new Error('? '+c+' in '+src);
    if(nx&&SM[nx]){const b=B[c];r=(b==='shi'?'sh':b==='chi'?'ch':b==='ji'?'j':b.slice(0,-1)+'y')+SM[nx];n++}
    if(dbl){r=r.startsWith('ch')?'t'+r:r[0]+r;dbl=false}
    // ん before vowel/y → n’
    if(c==='ん'){const nn=items[n+1];if(nn&&nn.c&&/^[あいうえおやゆよ]$/.test(nn.c))r='n’'}
    word+=r;
  }
  flush();return out;
}
// word-break rules so the romaji reads like the existing sentences ("kore wa ikura desu ka")
function spaced(src){
  let t=src;
  t=t.replace(/([^|])か$/,'$1|か');
  t=t.replace(/([^|])です/g,'$1|です');
  t=t.replace(/([^|])ください/g,'$1|ください');
  t=t.replace(/おねがい(?:\|)?します/g,'おねがい|します');
  t=t.replace(/([^|])(して|してい)(ます|ません)/g,(m,a,b,c)=>m);
  t=t.replace(/て(います|いません)/g,'て|$1');
  t=t.replace(/(い)(ます)(?=\||$)/g,(m)=>m);
  t=t.replace(/\|{2,}/g,'|');
  return t;
}
const kanaOf=src=>src.replace(/[{}|]/g,'');
module.exports={toRomaji,kanaOf};
if(require.main===module){
 const fs=require('fs'),vm=require('vm');const w={};w.window=w;
 for(const f of ['js/content/phrases.js','js/content/kana.js'])vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'..',f),'utf8'),w);
 // calibrate on katakana examples
 let bad=0;
 for(const e of w.App.Content.KATAKANA_EXAMPLES){const g=toRomaji(e.word);if(g!==e.romaji){bad++;console.log('word',e.word,'gen',g,'app',e.romaji)}}
 console.log('katakana examples mismatch',bad,'/',w.App.Content.KATAKANA_EXAMPLES.length);
}
