// 看得懂（stage 10 ⑦ 版本一）— 資料與出題（純 Node，不需要瀏覽器）：
// 120 個片假名詞、兩種題型（看詞選意思／聽音選詞）嘅選項規則、一輪練習（加權、不重複、情境篩選）、
// 重溫 key r:、「認得」定義、紀錄（recordReadAnswer）同備份 sanitize。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
win.window = win;
win.App = { UI: { h() {}, jp() {}, inkButton() {}, modHeader() {}, chip() {} }, Speech: { speak() {}, isTTSSupported: () => true, speechNotice: () => null }, Feedback: {} };
for (const f of ['js/content/kana.js', 'js/storage.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), win);
win.App.Storage = win.App.Storage || {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/reading.js'), 'utf8'), win);
const R = win.App.Reading, S = win.App.Storage, W = win.App.Content.KATAKANA_EXAMPLES;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

const TODAY = S.todayLocal();
const fresh = (over = {}) => ({ read: { prefs: { scenes: null, mode: 'mix', count: 10 }, stats: {}, ...over }, review: { items: {}, graduated: 0 } });

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
for (let i = 0; i < 300; i++) if (R.buildPractice(wt).some((x) => x.item.word === 'タオル')) hit++;
assert(hit > 300 * 0.08, `加權：答錯多嘅「タオル」出現率 ${(hit / 3).toFixed(0)}%（隨機約 4%）`);

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

console.log(bad ? `== ${bad} failed` : '== all ok');
if (bad) process.exitCode = 1;
