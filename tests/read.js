// 看得懂（stage 10 ⑦ 版本一＋二）— 資料與出題（純 Node，不需要瀏覽器）：
// 120 個片假名詞、兩種題型（看詞選意思／聽音選詞）嘅選項規則、一輪練習（加權、不重複、情境篩選）、
// 重溫 key r:、「認得」定義、紀錄（recordReadAnswer）同備份 sanitize。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
win.window = win;
win.App = { UI: { h() {}, jp() {}, inkButton() {}, modHeader() {}, chip() {} }, Speech: { speak() {}, isTTSSupported: () => true, speechNotice: () => null }, Feedback: {} };
for (const f of ['js/content/kana.js', 'js/content/menus.js', 'js/storage.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), win);
win.App.Storage = win.App.Storage || {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/reading.js'), 'utf8'), win);
const R = win.App.Reading, S = win.App.Storage, W = win.App.Content.KATAKANA_EXAMPLES;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

const ctxRx = (() => { const c = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'cdata.js'), 'utf8').match(/const base=[\s\S]*?(?=const norm=)/)[0] + ';this.rx=rx;', c); return c.rx; })();
const TODAY = S.todayLocal();
const fresh = (over = {}) => ({ read: { prefs: { scenes: null, mode: 'mix', count: 10 }, stats: {}, menu: { prefs: { menus: null, count: 10 }, stats: {} }, ...over }, review: { items: {}, graduated: 0 } });

// ── 資料 ──
assert(W.length === 120 && new Set(W.map((x) => x.word)).size === 120, '120 個片假名詞，唔重複');
const byScene = {};
W.forEach((x) => { byScene[x.scene] = (byScene[x.scene] || 0) + 1; });
assert(JSON.stringify(byScene) === JSON.stringify({ 酒店: 18, 指示牌: 9, 交通: 14, 購物: 10, 餐廳: 36, 超市: 10, 藥妝: 6, 服飾: 5, 景點: 12 }), '9 個情境各自嘅詞數 ' + JSON.stringify(byScene));
assert(R.scenes().join() === '酒店,指示牌,交通,購物,餐廳,超市,藥妝,服飾,景點', '情境次序');
assert(W.every((x) => x.word && x.romaji && x.meaning && x.en && x.scene), '每個詞都有寫法／拼音／中文／英文／情境');

// ── 看詞選意思 ──
let seeBad = [], sameScene = 0, seeN = 0;
for (const it of W) {
  for (let r = 0; r < 10; r++) {
    const q = R.question(it, 'see');
    const ms = q.options.map((o) => o.meaning);
    if (q.type !== 'see' || q.options.length !== 4 || !q.options.some((o) => o.word === it.word) || new Set(ms).size !== 4) seeBad.push(it.word);
    const sceneMates = W.filter((x) => x.scene === it.scene && x.meaning !== it.meaning).length;
    if (sceneMates >= 3) { seeN++; if (q.options.every((o) => o.scene === it.scene)) sameScene++; }
  }
}
assert(seeBad.length === 0, '看詞選意思：4 個選項、包括答案、中文意思都唔同（120×10 次）' + seeBad.slice(0, 3));
assert(sameScene === seeN && seeN > 0, '看詞選意思：情境內有足夠嘅詞時，錯誤選項都取同情境（' + sameScene + '/' + seeN + '）');

// ── 聽音選詞 ──
let hearBad = [], shared = 0, sharedRandom = 0, n = 0;
const sharedOf = (a, b) => { const cs = new Set(a.split('')); return b.split('').filter((c) => cs.has(c)).length; };
for (const it of W) {
  for (let r = 0; r < 10; r++) {
    const q = R.question(it, 'hear');
    const ws = q.options.map((o) => o.word), rs = q.options.map((o) => o.romaji);
    if (q.type !== 'hear' || q.options.length !== 4 || !ws.includes(it.word) || new Set(ws).size !== 4 || new Set(rs).size !== 4) hearBad.push(it.word);
    q.options.filter((o) => o.word !== it.word).forEach((o) => { shared += sharedOf(it.word, o.word); n++; });
  }
  W.filter((x) => x.word !== it.word).forEach((x) => { sharedRandom += sharedOf(it.word, x.word) / (W.length - 1); });
}
assert(hearBad.length === 0, '聽音選詞：4 個選項、包括答案、寫法同讀音都唔同（120×10 次）' + hearBad.slice(0, 3));
const avg = shared / n, base = sharedRandom / W.length;
assert(avg > base * 2, `聽音選詞：錯誤選項同答案共用字數（平均 ${avg.toFixed(2)}）明顯多過隨機（${base.toFixed(2)}）——選形近嘅詞`);
const jinzu = []; for (let i = 0; i < 40; i++) jinzu.push(...R.question(W.find((x) => x.word === 'ジーンズ'), 'hear').options.map((o) => o.word));
assert(jinzu.some((w) => w === 'ジュース'), '例子：ジーンズ 嘅選項會出現形近嘅 ジュース');

// ── 一輪練習 ──
const st = (mode, over) => { const s = fresh(over); s.read.prefs.mode = mode; return s; };
let roundBad = [];
for (const mode of ['see', 'hear', 'mix']) for (const count of [5, 10, 20]) {
  const s = st(mode); s.read.prefs.count = count;
  const q = R.buildPractice(s);
  const ws = q.map((x) => x.item.word);
  if (q.length !== count || new Set(ws).size !== count) roundBad.push(['count/dup', mode, count]);
  if (mode !== 'mix' && q.some((x) => x.type !== mode)) roundBad.push(['type', mode]);
  if (mode === 'mix' && count >= 10 && (q.filter((x) => x.type === 'see').length !== count / 2)) roundBad.push(['mix split', count]);
}
assert(roundBad.length === 0, '一輪練習：題數正確、不重複、題型跟設定、混合各佔一半 ' + JSON.stringify(roundBad.slice(0, 3)));
const small = st('see'); small.read.prefs.scenes = ['藥妝']; small.read.prefs.count = 10;
const sq = R.buildPractice(small);
assert(sq.length === 10 && sq.every((x) => x.item.scene === '藥妝'), '只揀「藥妝」（6 個詞）出 10 題：只出藥妝，詞會重複出現');
const none = st('see'); none.read.prefs.scenes = [];
assert(R.buildPractice(none).length === 0, '冇揀情境：冇題目');

// 加權：答錯多嘅詞出現得更多
const wt = st('see'); wt.read.prefs.count = 5;
wt.read.stats = { タオル: { c: 0, w: 5 } };
Object.values(W).forEach((x) => { if (x.word !== 'タオル') wt.read.stats[x.word] = { c: 5, w: 0 }; });
let hit = 0;
for (let i = 0; i < 3000; i++) if (R.buildPractice(wt).some((x) => x.item.word === 'タオル')) hit++;
assert(hit > 3000 * 0.08, `加權：答錯多嘅「タオル」出現率 ${(hit / 30).toFixed(0)}%（隨機約 4%）`);

// ── 認得 ──
const c0 = R.counts(fresh());
assert(c0.total === 120 && c0.known === 0 && c0.learning === 0 && c0.unseen === 120, '全新存檔：認得 0／學習中 0／未練習 120');
const s2 = fresh({ stats: { タオル: { c: 2, w: 0 }, ホテル: { c: 1, w: 0 }, スープ: { c: 3, w: 1 }, ドア: { c: 0, w: 1 } } });
s2.review.items['r:スープ'] = { box: 0, due: TODAY };
const c2 = R.counts(s2);
assert(c2.known === 1 && c2.learning === 3 && c2.unseen === 116, '認得＝答對 ≥ 2 次且唔喺重溫清單（タオル）；スープ 喺重溫所以只算學習中 ' + JSON.stringify(c2));

// ── 重溫 ──
const rv = fresh();
rv.review.items['r:タオル'] = { box: 0, due: TODAY };
rv.review.items['r:ホテル'] = { box: 1, due: '2000-01-01' };
rv.review.items['r:ドア'] = { box: 0, due: '2999-01-01' };
rv.review.items['r:不存在'] = { box: 0, due: TODAY };
rv.review.items['p:rest-01'] = { box: 0, due: TODAY };
assert(R.dueCount(rv) === 2, '重溫：只計今天到期、存在嘅 r: 項目（2 個）');
const rq = R.buildReview(rv);
assert(rq.length === 2 && rq.every((x) => ['タオル', 'ホテル'].includes(x.item.word)), '重溫出題：只出到期嘅詞');
for (let i = 0; i < 12; i++) rv.review.items['r:' + W[i + 10].word] = { box: 0, due: TODAY };
assert(R.buildReview(rv).length === 10, '重溫每次最多 10 題');

// ── 紀錄 ──
let s3 = S.loadState ? null : null;
const base3 = { ...fresh(), daily: { activity: {} }, settings: {}, flags: [] };
let a1;
try { a1 = S.recordReadAnswer({ ...base3, daily: { ...base3.daily, days: {}, activity: {}, learned: {}, cursor: 0 } }, 'タオル', false); } catch (e) { a1 = null; }
assert(a1 && a1.read.stats['タオル'].w === 1 && a1.read.stats['タオル'].c === 0 && a1.review.items['r:タオル'] && a1.review.items['r:タオル'].box === 0, '答錯：stats.w +1、進重溫 r:タオル（box 0、今日）');
const a2 = S.recordReadAnswer(a1, 'タオル', true);
assert(a2.read.stats['タオル'].c === 1 && a2.read.stats['タオル'].w === 1 && a2.review.items['r:タオル'].box === 0, '答對（練習）：stats.c +1；重溫項目唔升級（只有重溫入面答啱先升）');
const a3 = S.reviewCorrect(a2, 'r:タオル');
assert(a3.review.items['r:タオル'].box === 1, '重溫答對：升到 box 1');

// ── 備份 sanitize ──
const san = S.parseBackup ? S : null;
assert(!!san, 'Storage.parseBackup 存在');
const full = JSON.parse(JSON.stringify(S.buildBackup({ ...S.loadState(), read: { prefs: { scenes: ['酒店', '餐廳'], mode: 'hear', count: 20 }, stats: { タオル: { c: 2, w: 1, last: null } } }, review: { items: { 'r:タオル': { box: 1, due: '2026-10-23' } }, graduated: 0 } }, new Date().toISOString())));
const ok = S.parseBackup(JSON.stringify(full)).state;
assert(ok.read.prefs.mode === 'hear' && ok.read.prefs.count === 20 && ok.read.prefs.scenes.join() === '酒店,餐廳' && ok.read.stats['タオル'].c === 2 && ok.review.items['r:タオル'].box === 1, '備份往返：保留 prefs、stats、r: 重溫項目');
const tam = JSON.parse(JSON.stringify(full));
const d = tam.data['japaneseOps:v1'];
d.read.prefs = { scenes: ['酒店', 5, 'あ'.repeat(20), '酒店'], mode: 'zzz', count: 7 };
d.read.stats = { ドライヤー: { c: 2, w: 1 }, bad: { c: 'x', w: 1 }, ['あ'.repeat(40)]: { c: 1, w: 1 } };
d.review.items['r:' + 'あ'.repeat(40)] = { box: 0, due: '2026-10-22' };
const t = S.parseBackup(JSON.stringify(tam)).state;
assert(t.read.prefs.scenes.join() === '酒店' && t.read.prefs.mode === 'mix' && t.read.prefs.count === 10, '竄改備份：情境只收短字串並去重、題型／題數錯就用預設 ' + JSON.stringify(t.read.prefs));
assert(Object.keys(t.read.stats).join() === 'ドライヤー' && !t.review.items['r:' + 'あ'.repeat(40)], '竄改備份：壞 stats、過長 key 被丟棄');
const wrongType = JSON.parse(JSON.stringify(full)); wrongType.data['japaneseOps:v1'].read = 'x';
assert(S.parseBackup(JSON.stringify(wrongType)).reason === 'invalid', 'read 區塊型別錯 → invalid');
const oldFile = JSON.parse(JSON.stringify(full)); delete oldFile.data['japaneseOps:v1'].read;
const o2 = S.parseBackup(JSON.stringify(oldFile)).state;
assert(o2.read.prefs.mode === 'mix' && o2.read.prefs.scenes === null && o2.read.prefs.count === 10, '舊備份（冇 read）：補預設值');

// ═══ 版本二：模擬餐牌 ═══
const MN = win.App.Content.MENUS;
const fmt = (m) => m.lines.map((l) => `${l.ja} ${l.kana} ${l.romaji} ${l.yue} ${l.price}`).join('／');
assert(MN.map((m) => m.id).join() === 'ramen,sushi,teishoku,izakaya,cafe,udon' && MN.every((m) => m.lines.length === 5) && MN.length * 5 === 30, '6 張餐牌 × 5 行 ＝ 30 行');
assert(MN.map((m) => m.label).join() === '拉麵店,迴轉壽司,定食屋,居酒屋,咖啡店,烏冬・蕎麥麵店', '餐牌名稱（只有中文標籤）');
assert(fmt(MN[0]) === '醤油ラーメン しょうゆラーメン shouyu raamen 醬油拉麵 850／味噌ラーメン みそラーメン miso raamen 味噌拉麵 900／餃子 ぎょうざ gyouza 煎餃子 400／半チャーハン はんチャーハン han chaahan 半份炒飯 300／生ビール なまビール nama biiru 生啤酒 550', '拉麵店 5 行（用戶核對）');
assert(fmt(MN[1]) === 'まぐろ まぐろ maguro 吞拿魚 150／サーモン サーモン saamon 三文魚 150／海老 えび ebi 蝦 130／玉子 たまご tamago 蛋（玉子燒） 120／いか いか ika 魷魚 130', '迴轉壽司 5 行（海老、玉子 漢字寫法保留）');
assert(fmt(MN[2]) === '唐揚げ定食 からあげていしょく karaage teishoku 炸雞定食 850／焼き魚定食 やきざかなていしょく yakizakana teishoku 烤魚定食 900／とんかつ定食 とんかつていしょく tonkatsu teishoku 炸豬排定食 1000／生姜焼き定食 しょうがやきていしょく shougayaki teishoku 薑燒豬肉定食 950／ご飯大盛り ごはんおおもり gohan oomori 白飯加大 100', '定食屋 5 行');
assert(fmt(MN[3]) === '焼き鳥 やきとり yakitori 烤雞肉串 150／枝豆 えだまめ edamame 毛豆 400／刺身盛り合わせ さしみもりあわせ sashimi moriawase 刺身拼盤 1200／生ビール なまビール nama biiru 生啤酒 550／ウーロン茶 ウーロンちゃ uuroncha 烏龍茶 400', '居酒屋 5 行（焼き鳥 漢字寫法保留）');
assert(fmt(MN[4]) === 'コーヒー コーヒー koohii 咖啡 450／カフェラテ カフェラテ kafe rate 拿鐵咖啡 520／紅茶 こうちゃ koucha 紅茶 450／チーズケーキ チーズケーキ chiizu keeki 芝士蛋糕 550／サンドイッチ サンドイッチ sandoitchi 三文治 600', '咖啡店 5 行');
assert(fmt(MN[5]) === 'きつねうどん きつねうどん kitsune udon 油豆腐烏冬 600／天ぷらそば てんぷらそば tenpura soba 天婦羅蕎麥麵 800／ざるそば ざるそば zaru soba 蕎麥涼麵 650／親子丼 おやこどん oyakodon 雞肉雞蛋丼 750／おにぎり おにぎり onigiri 飯糰 150', '烏冬・蕎麥麵店 5 行');
const kanaCheck = [];
MN.forEach((m) => m.lines.forEach((l) => { if (/[ぁぃぅぇぉァィゥェォ]/.test(l.kana)) return; // small kana (カフェラテ) are checked below
  try { if (!ctxRx(l.kana).test(l.romaji.toLowerCase().replace(/[^a-z']/g, ''))) kanaCheck.push(l.ja); } catch (e) { kanaCheck.push(l.ja + ' ' + e.message); } }));
assert(kanaCheck.length === 0, '30 行拼音由假名推算全部對得上 ' + kanaCheck);
assert(MN[4].lines[1].kana === 'カフェラテ' && MN[4].lines[1].romaji === 'kafe rate', 'カフェラテ（小寫ェ）拼音 kafe rate');

// 最貴／最便宜只在唯一時先出
const ex = Object.fromEntries(MN.map((m) => [m.id, R.extremes(m)]));
assert(JSON.stringify(ex) === JSON.stringify({ ramen: { max: 1, min: 3 }, sushi: { max: -1, min: 3 }, teishoku: { max: 2, min: 4 }, izakaya: { max: 2, min: 0 }, cafe: { max: 4, min: -1 }, udon: { max: 1, min: 4 } }), '最貴／最便宜：壽司（150 有兩個）冇「最貴」、咖啡店（450 有兩個）冇「最便宜」 ' + JSON.stringify(ex));
assert(R.eligibleTypes(MN[1], 0).join() === 'find,price' && R.eligibleTypes(MN[1], 3).join() === 'find,price,min' && R.eligibleTypes(MN[0], 1).join() === 'find,price,max', '每行可以出嘅題型');

// 題目窮舉
let mBad = [], types = {};
for (const m of MN) for (let li = 0; li < 5; li++) for (const type of R.eligibleTypes(m, li)) for (let r = 0; r < 20; r++) {
  const q = R.menuQuestion(m, li, type);
  types[type] = (types[type] || 0) + 1;
  if (q.family !== 'menu' || q.menu !== m || q.line !== li) mBad.push(['shape', m.id, li, type]);
  if (type === 'price') {
    const o = q.options, ans = m.lines[li].price;
    if (o.length !== 4 || new Set(o).size !== 4 || !o.includes(ans) || o.join() !== [...o].sort((a, b) => a - b).join()) mBad.push(['price', m.id, li, o.join()]);
    const same = o.filter((p) => m.lines.some((l) => l.price === p)).length;
    if (same < Math.min(4, new Set(m.lines.map((l) => l.price)).size)) mBad.push(['price same menu first', m.id, li, o.join()]);
  } else if (q.options.join() !== '0,1,2,3,4') mBad.push(['rows', m.id, li, type]);
}
assert(mBad.length === 0, '餐牌題目：每行×每個可用題型 ×20（找行：5 行選項；價錢：4 個不同價錢、升序、包括答案、優先同餐牌）' + JSON.stringify(mBad.slice(0, 3)));
assert(types.find > 0 && types.price > 0 && types.max > 0 && types.min > 0, '四種題型都會出');

// 一輪
const ms = (prefs, count, stats) => { const s = fresh(); s.read.menu.prefs = { menus: prefs, count }; if (stats) s.read.menu.stats = stats; return s; };
const menusOf = (sel) => MN.filter((m) => sel === null || sel.includes(m.id));
let mr = [];
for (const count of [5, 10, 20]) for (const sel of [null, ['ramen'], ['sushi', 'cafe']]) {
  const q = R.buildMenuPractice(ms(sel, count));
  const keys = q.map((x) => `${x.menu.id}:${x.line}:${x.type}`);
  if (q.length !== count) mr.push(['length', count, sel]);
  if (sel && q.some((x) => !sel.includes(x.menu.id))) mr.push(['menu', sel]);
  const cap = menusOf(sel).reduce((n, m) => n + m.lines.reduce((k, _, li) => k + R.eligibleTypes(m, li).length, 0), 0);
  if (count <= cap && new Set(keys).size !== keys.length) mr.push(['dup', count, sel && sel.join()]); // repeats are only allowed once every (line, type) of the chosen menus has been asked
  if (sel === null && count >= 6 && new Set(q.map((x) => x.menu.id)).size !== 6) mr.push(['turns', count]);
  q.forEach((x) => { if (!R.eligibleTypes(x.menu, x.line).includes(x.type)) mr.push(['eligible', x.menu.id, x.line, x.type]); });
}
assert(mr.length === 0, '一輪餐牌練習：題數正確、只出揀咗嘅餐牌、餐牌輪流、同一行同一題型唔重複、題型一定可用 ' + JSON.stringify(mr.slice(0, 3)));
assert(R.buildMenuPractice(ms([], 10)).length === 0, '冇揀餐牌：冇題目');
let wHit = 0;
const wStats = {}; MN.forEach((m) => m.lines.forEach((_, i) => { wStats[`${m.id}:${i}`] = { c: 5, w: 0 }; })); wStats['ramen:2'] = { c: 0, w: 5 };
for (let i = 0; i < 3000; i++) if (R.buildMenuPractice(ms(['ramen'], 5, wStats)).some((x) => x.line === 2)) wHit++;
assert(wHit > 3000 * 0.5, `加權：答錯多嘅「餃子」出現率 ${(wHit / 30).toFixed(0)}%`);

// 認得（30 行）
const mc0 = R.menuCounts(fresh());
assert(mc0.total === 30 && mc0.known === 0 && mc0.learning === 0 && mc0.unseen === 30, '餐牌：全新存檔 認得 0／30 行');
const mcs = fresh(); mcs.read.menu.stats = { 'ramen:0': { c: 2, w: 0 }, 'ramen:1': { c: 3, w: 1 }, 'cafe:0': { c: 1, w: 0 } }; mcs.review.items['m:ramen:1'] = { box: 0, due: TODAY };
const mcc = R.menuCounts(mcs);
assert(mcc.known === 1 && mcc.learning === 2 && mcc.unseen === 27, '餐牌認得：答對 ≥ 2 且唔喺重溫（ramen:0）；ramen:1 喺重溫只算學習中 ' + JSON.stringify(mcc));

// 重溫（m: key 同 r: key 一齊）
const mv = fresh();
mv.review.items['m:ramen:2'] = { box: 0, due: TODAY };
mv.review.items['m:cafe:4'] = { box: 1, due: '2000-01-01' };
mv.review.items['m:cafe:9'] = { box: 0, due: TODAY };
mv.review.items['m:nope:1'] = { box: 0, due: TODAY };
mv.review.items['m:ramen:3'] = { box: 0, due: '2999-01-01' };
mv.review.items['r:タオル'] = { box: 0, due: TODAY };
assert(R.dueCount(mv) === 3, '重溫計數：今天到期嘅 m:（2 個有效）＋ r:（1 個）＝ 3；壞 key（行 9、唔存在嘅餐牌）同未到期唔計');
const mrv = R.buildReview(mv);
assert(mrv.length === 3 && mrv.filter((x) => x.family === 'menu').length === 2 && mrv.filter((x) => x.family === 'word').length === 1, '重溫出題：2 條餐牌題＋1 條片假名詞題');
assert(mrv.filter((x) => x.family === 'menu').every((x) => R.eligibleTypes(x.menu, x.line).includes(x.type)), '重溫嘅餐牌題型一定可用');

// 紀錄
const base4 = { ...fresh(), daily: { days: {}, activity: {}, learned: {}, cursor: 0 }, settings: {}, flags: [] };
const m1 = S.recordMenuAnswer(base4, 'ramen', 2, false);
assert(m1.read.menu.stats['ramen:2'].w === 1 && m1.review.items['m:ramen:2'] && m1.review.items['m:ramen:2'].box === 0 && Object.keys(m1.read.stats).length === 0, '答錯：menu.stats.w +1、進重溫 m:ramen:2（唔入片假名詞 stats）');
const m2 = S.recordMenuAnswer(m1, 'ramen', 2, true);
assert(m2.read.menu.stats['ramen:2'].c === 1 && m2.review.items['m:ramen:2'].box === 0 && S.reviewCorrect(m2, 'm:ramen:2').review.items['m:ramen:2'].box === 1, '答對（練習）：唔升級；重溫答對先升 box 1');

// 備份
const mfull = JSON.parse(JSON.stringify(S.buildBackup({ ...S.loadState(), read: { prefs: { scenes: null, mode: 'mix', count: 10 }, stats: {}, menu: { prefs: { menus: ['ramen', 'cafe'], count: 20 }, stats: { 'ramen:2': { c: 2, w: 1, last: null } } } }, review: { items: { 'm:ramen:2': { box: 1, due: '2026-10-23' } }, graduated: 0 } }, new Date().toISOString())));
const mok = S.parseBackup(JSON.stringify(mfull)).state;
assert(mok.read.menu.prefs.menus.join() === 'ramen,cafe' && mok.read.menu.prefs.count === 20 && mok.read.menu.stats['ramen:2'].c === 2 && mok.review.items['m:ramen:2'].box === 1, '備份往返：餐牌 prefs、stats、m: 重溫項目');
const mtam = JSON.parse(JSON.stringify(mfull));
const md = mtam.data['japaneseOps:v1'];
md.read.menu = { prefs: { menus: ['ramen', 5, 'x'.repeat(30), 'cafe', 'ramen'], count: 7 }, stats: { 'ramen:2': { c: 2, w: 0 }, 'ramen:9': { c: 1, w: 0 }, zzz: { c: 1, w: 1 }, 'cafe:1': { c: 'x', w: 1 } } };
md.review.items['m:ramen:9'] = { box: 1, due: '2026-10-23' };
md.review.items['m:Ramen:1'] = { box: 1, due: '2026-10-23' };
const mt = S.parseBackup(JSON.stringify(mtam)).state;
assert(mt.read.menu.prefs.menus.join() === 'ramen,cafe' && mt.read.menu.prefs.count === 10 && Object.keys(mt.read.menu.stats).join() === 'ramen:2', '竄改備份：餐牌 id 只收短英文字、去重；題數錯就用預設；壞 stats 鍵（行 9、亂鍵、型別錯）丟棄 ' + JSON.stringify(mt.read.menu));
assert(!mt.review.items['m:ramen:9'] && !mt.review.items['m:Ramen:1'], '竄改備份：壞 m: key 丟棄');
const mold = JSON.parse(JSON.stringify(mfull)); delete mold.data['japaneseOps:v1'].read.menu;
const mo = S.parseBackup(JSON.stringify(mold)).state;
assert(mo.read.menu.prefs.menus === null && mo.read.menu.prefs.count === 10 && Object.keys(mo.read.menu.stats).length === 0, '舊備份（冇 read.menu）：補預設值');

console.log(bad ? `== ${bad} failed` : '== all ok');
if (bad) process.exitCode = 1;
