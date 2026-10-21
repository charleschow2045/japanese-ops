// 換字練習（stage 10 ⑥ 版本二）— 資料與出題（純 Node，不需要瀏覽器）：
// 6 個句型、64 個組合、用戶核對過嘅詞庫；虛擬句子（日文／假名／拼音／中文／朗讀）；同現有句子庫一致嘅對照；
// 選項、一輪練習、重溫 key。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = {};
win.window = win;
win.App = { UI: { h() {}, jp() {}, chip() {}, inkButton() {} }, Speech: {} }; // js/swap.js only needs these at call time
for (const f of ['js/content/phrases.js', 'js/content/swap.js', 'js/swap.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), win);
const C = win.App.Content, S = win.App.Swap;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

// romaji ↔ kana check: reuse the regex generator of tests/cdata.js
const cd = fs.readFileSync(path.join(__dirname, 'cdata.js'), 'utf8');
const ctx = {};
vm.runInNewContext(cd.match(/const base=[\s\S]*?(?=const norm=)/)[0] + ';this.rx=rx;', ctx);
const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');

const P = C.SWAP_PATTERNS;
const byId = Object.fromEntries(P.map((p) => [p.id, p]));
assert(P.map((p) => p.id).join() === 'p1,p2,p3,p4,p5,p6', '6 個句型 p1–p6');
assert(P.map((p) => p.words.length).join() === '13,11,10,12,10,8' && P.reduce((n, p) => n + p.words.length, 0) === 64, '詞數 13／11／10／12／10／8，共 64 個組合');
assert(P.map((p) => p.label).join('') === '〇〇は入っていますか。〇〇アレルギーがあります。〇〇をください。〇〇はどこですか。〇〇までお願いします。〇〇はありますか。', '6 個句型文字');
assert(P.every((p) => new Set(p.words.map((w) => w.id)).size === p.words.length && p.words.every((w) => /^[a-z0-9]{1,20}$/.test(w.id))), '每個句型內詞 id 唔重複、只含 a–z／0–9');
assert(P.every((p) => new Set(p.words.map((w) => w.yue)).size === p.words.length && new Set(p.words.map((w) => w.kana)).size === p.words.length), '每個句型內詞嘅中文同讀音都唔重複（選項才可以分辨）');
assert(P.every((p) => p.yue.includes('{m}') && p.words.every((w) => w.ja && w.kana && w.romaji && w.yue)), '每個詞都有日文／假名／拼音／中文；句型中文有 {m}');

// 用戶核對過嘅詞庫（逐個 id：日文 假名 拼音 中文）
const list = (id) => byId[id].words.map((w) => `${w.ja} ${w.kana} ${w.romaji} ${w.yue}`).join('／');
assert(list('p2') === '卵 たまご tamago 蛋／牛乳 ぎゅうにゅう gyuunyuu 牛奶／乳製品 にゅうせいひん nyuuseihin 乳製品／小麦 こむぎ komugi 小麥／そば そば soba 蕎麥／落花生 らっかせい rakkasei 花生／えび えび ebi 蝦／かに かに kani 蟹／ナッツ ナッツ nattsu 堅果／大豆 だいず daizu 大豆／ごま ごま goma 芝麻', '句型 ②（11 個過敏食材）');
assert(list('p1') === list('p2') + '／豚肉 ぶたにく butaniku 豬肉／アルコール アルコール arukooru 酒精', '句型 ①＝11 個過敏食材＋豚肉＋アルコール');
assert(list('p3') === 'お水 おみず omizu 水／お茶 おちゃ ocha 茶／ビール ビール biiru 啤酒／コーヒー コーヒー koohii 咖啡／メニュー メニュー menyuu 餐牌／袋 ふくろ fukuro 袋子／レシート レシート reshiito 收據／領収書 りょうしゅうしょ ryoushuusho 正式收據／お箸 おはし ohashi 筷子／スプーン スプーン supuun 湯匙', '句型 ③（10 個）');
assert(list('p4') === 'トイレ トイレ toire 洗手間／駅 えき eki 車站／出口 でぐち deguchi 出口／入口 いりぐち iriguchi 入口／改札 かいさつ kaisatsu 閘口／バス停 バスてい basutei 巴士站／コンビニ コンビニ konbini 便利店／エレベーター エレベーター erebeetaa 升降機／券売機 けんばいき kenbaiki 售票機／交番 こうばん kouban 警崗／切符売り場 きっぷうりば kippu uriba 售票處／両替所 りょうがえじょ ryougaejo 兌換處', '句型 ④（12 個）');
assert(list('p5') === '駅 えき eki 車站／空港 くうこう kuukou 機場／ホテル ホテル hoteru 酒店／この住所 このじゅうしょ kono juusho 這個地址／新宿 しんじゅく shinjuku 新宿／渋谷 しぶや shibuya 澀谷／浅草 あさくさ asakusa 淺草／東京駅 とうきょうえき toukyou eki 東京車站／京都駅 きょうとえき kyouto eki 京都車站／大阪駅 おおさかえき oosaka eki 大阪車站', '句型 ⑤（10 個）');
assert(list('p6') === '英語のメニュー えいごのメニュー eigo no menyuu 英文餐牌／小さいサイズ ちいさいサイズ chiisai saizu 小碼／大きいサイズ おおきいサイズ ookii saizu 大碼／他の色 ほかのいろ hoka no iro 其他顏色／割引 わりびき waribiki 折扣／空いている部屋 あいているへや aite iru heya 空房／もっと安いもの もっとやすいもの motto yasui mono 更便宜的／席 せき seki 座位', '句型 ⑥（8 個）');

// ── 64 個虛擬句子 ──
const items = P.flatMap((p) => S.itemsOf(p.id));
assert(items.length === 64 && new Set(items.map((i) => i.p.id)).size === 64, '64 個虛擬句子，id 唔重複（p1:tamago 形式）');
const rom = items.filter((i) => { try { return !ctx.rx(i.p.kana).test(norm(i.p.romaji)); } catch (e) { return true; } }).map((i) => i.p.id);
assert(rom.length === 0, '64 句拼音由假名推算全部對得上 ' + rom);
const build = items.filter((i) => {
  const { pat, word } = i.p.swap, pp = byId[pat];
  return i.p.ja !== word.ja + pp.post || i.p.kana !== word.kana + pp.postKana || i.p.romaji !== `${word.romaji} ${pp.postRomaji}` || i.p.say !== word.kana + pp.post || i.p.yue !== pp.yue.replace('{m}', word.yue) || i.p.who !== 'me';
}).map((i) => i.p.id);
assert(build.length === 0, '句子組合規則：ja＝詞＋句型、kana、romaji、say（詞換成假名）、中文、who＝me ' + build);
assert(items.every((i) => i.scene.key === 'swap' && i.scene.emoji === '🔁' && i.p.use), '虛擬句子有情境標籤（🔁 換字練習）同使用場合');
const sayBad = items.filter((i) => !i.p.say.startsWith(i.p.swap.word.kana) || /[0-9]/.test(i.p.say)).map((i) => i.p.id);
assert(sayBad.length === 0, '朗讀文字：詞用假名開頭（卵→たまご、駅→えき、渋谷→しぶや）');
assert(S.item('p1', 'tamago').p.say === 'たまごは入っていますか。' && S.item('p5', 'shibuya').p.say === 'しぶやまでお願いします。' && S.item('p3', 'omizu').p.say === 'おみずをください。', '朗讀例子：たまごは入っていますか。／しぶやまでお願いします。／おみずをください。');

// 同現有句子庫嘅對照：相同嘅句子日文、假名、拼音要完全一樣
const lib = new Map();
C.PHRASE_SCENES.forEach((s) => s.phrases.forEach((p) => { lib.set(p.id, p); (p.replies || []).forEach((r) => lib.set(r.id, r)); }));
const same = [['p1', 'tamago', 'rest-13'], ['p2', 'tamago', 'rest-21'], ['p3', 'menyuu', 'rest-05'], ['p3', 'omizu', 'rest-12'], ['p4', 'toire', 'polite-18'], ['p6', 'hokanoiro', 'shop-04'], ['p6', 'waribiki', 'sight-04'], ['p6', 'eigomenyuu', 'rest-06']];
const diff = same.filter(([pat, wid, id]) => { const a = S.item(pat, wid).p, b = lib.get(id); return a.ja !== b.ja || a.kana !== b.kana || a.romaji !== b.romaji; }).map((x) => x.join(':'));
assert(diff.length === 0, '同句子庫現有句子一樣（rest-13／21／05／12、polite-18、shop-04、sight-04、rest-06）：日文、假名、拼音 ' + diff);

// ── 選項 ──
let optBad = [];
for (const it of items) {
  for (let r = 0; r < 20; r++) {
    const o = S.options(it);
    const ps = o.map((x) => x.p);
    if (o.length !== 4 || !ps.some((p) => p.id === it.p.id)) optBad.push(['count/answer', it.p.id]);
    if (new Set(ps.map((p) => p.yue)).size !== 4 || new Set(ps.map((p) => p.kana)).size !== 4) optBad.push(['dup', it.p.id]);
    if (ps.some((p) => p.swap.pat !== it.p.swap.pat)) optBad.push(['pattern', it.p.id]);
  }
}
assert(optBad.length === 0, '聽力選項：4 個、包括答案、中文同讀音都唔同、全部同一句型（64×20 次）' + JSON.stringify(optBad.slice(0, 3)));

// ── 一輪練習 ──
let roundBad = [];
for (const pats of [['p1'], ['p2', 'p3'], ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], ['p6']]) {
  for (const count of [5, 10, 20]) {
    const q = S.buildPractice({ pats, count });
    const ids = q.map((i) => i.p.id);
    const pool = P.filter((p) => pats.includes(p.id)).reduce((n, p) => n + p.words.length, 0);
    if (q.length !== count) roundBad.push(['length', pats.join(), count, q.length]);
    if (q.some((i) => !pats.includes(i.p.swap.pat))) roundBad.push(['pattern', pats.join(), count]);
    if (count <= pool && new Set(ids).size !== ids.length && pats.length === 1) roundBad.push(['dup', pats.join(), count]);
    if (pats.length === 6 && count >= 6 && new Set(q.map((i) => i.p.swap.pat)).size !== 6) roundBad.push(['turns', count]);
  }
}
assert(roundBad.length === 0, '一輪練習：題數正確、只出揀咗嘅句型、句型輪流、單一句型唔重複 ' + JSON.stringify(roundBad.slice(0, 3)));
assert(S.buildPractice({ pats: [], count: 10 }).length === 0, '冇揀句型：冇題目');
let rep = 0;
for (let i = 0; i < 60; i++) { const ids = S.buildPractice({ pats: ['p6'], count: 20 }).map((x) => x.p.id); if (ids.length === 20 && new Set(ids).size < 20) rep++; }
assert(rep === 60, '詞庫少過題數（8 個詞出 20 題）：會重複出現，不會少題');

// ── 重溫 key ──
const keyBad = [];
for (const it of items) for (const m of ['h', 's']) {
  const k = S.keyOf(m, it);
  const r = S.parseKey(k);
  if (k !== `w:${m}:${it.p.swap.pat}:${it.p.swap.wid}` || !r || r.mode !== m || r.item.p.id !== it.p.id) keyBad.push(k);
  if ((S.itemOfKey(k, m) || {}).p === undefined || S.itemOfKey(k, m === 'h' ? 's' : 'h')) keyBad.push('mode ' + k);
}
assert(keyBad.length === 0, '重溫 key w:h:／w:s:：往返正確（128 個），聽力 key 唔會當口語用 ' + keyBad.slice(0, 3));
const badKeys = ['w:x:p1:tamago', 'w:h:p7:tamago', 'w:h:p1:nothing', 'w:h:p1:', 'w:h:p1', 'h:p1:tamago', 'w:h:p1:TAMAGO', 'w:h:p1:tamago:1', 'p:rest-13', 'w:s:p9:eki', ''];
assert(badKeys.every((k) => S.parseKey(k) === null), '壞 key 全部拒絕 ' + badKeys.filter((k) => S.parseKey(k) !== null));
assert(S.parseKey('w:h:p4:eki').item.p.ja === '駅はどこですか。' && S.parseKey('w:s:p5:eki').item.p.ja === '駅までお願いします。', '同一個詞 id 喺唔同句型各自對應（駅）');

console.log(bad ? `== ${bad} failed` : '== all ok');
if (bad) process.exitCode = 1;
