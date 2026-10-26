// 近音詞分辨（stage 10 ⑫）— 純 Node，唔使瀏覽器：
// 19 對近音詞資料（用戶核對過嘅文字）、拼音由假名推算、同現有「促音・長音」頁嘅 8 對一致、
// 出題（二選一、選項次序隨機、聽到嘅係邊個）、一輪練習（類別、題數、唔連續同一對、加權）、掌握計數（≥ 3 次且唔喺重溫）、
// 答題紀錄（recordPairAnswer、q: 重溫）、存檔補預設、進度備份往返／舊備份／竄改備份。畫面另見 minimalui.js。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
win.window = win;
win.App = { UI: { h() {}, jp() {}, inkButton() {}, modHeader() {}, chip() {} }, Speech: { speak() {}, isTTSSupported: () => true, speechNotice: () => null }, Feedback: {} };
for (const f of ['js/content/kana.js', 'js/content/minimal.js', 'js/storage.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), win);
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/minimal.js'), 'utf8'), win);
const M = win.App.Minimal, S = win.App.Storage, C = win.App.Content;
const toRomaji = require('./rom.js').toRomaji;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const TODAY = S.todayLocal();
const fresh = () => JSON.parse(JSON.stringify(S.loadState()));
const PAIRS = C.MINIMAL_PAIRS;

// ── 資料 ──
assert(PAIRS.length === 19, '19 對');
const byCat = {};
PAIRS.forEach((p) => { byCat[p.cat] = (byCat[p.cat] || 0) + 1; });
assert(JSON.stringify(byCat) === JSON.stringify({ long: 8, sokuon: 6, voice: 5 }), '長音 8、促音 6、清濁 5：' + JSON.stringify(byCat));
assert(C.MINIMAL_CATS.map((c) => c.label).join() === '長音,促音,清濁', '類別：長音、促音、清濁');
assert(C.MINIMAL_CATS[0].hint === '長音要多拉一拍，聽出「拉長」和「短」的分別。' && C.MINIMAL_CATS[1].hint === '促音（小寫的っ）要停頓一拍，再發下一個音。' && C.MINIMAL_CATS[2].hint === '濁音發音時喉嚨會震動，清音不會。', '分辨重點文字（用戶批准嘅草稿）');
assert(new Set(PAIRS.map((p) => p.id)).size === 19 && PAIRS.every((p) => /^[lsv]\d{1,2}$/.test(p.id) && p.id[0] === { long: 'l', sokuon: 's', voice: 'v' }[p.cat]), 'id：l1–l8、s1–s6、v1–v5，唔重複');
assert(PAIRS.every((p) => p.words.length === 2 && p.words.every((w) => w.word && w.romaji && w.meaning && w.kanji) && p.words[0].word !== p.words[1].word), '每對兩個詞，都有假名／拼音／意思／漢字寫法');
assert(PAIRS.every((p) => p.words.every((w) => /^[ぁ-ゖァ-ヺー]+$/.test(w.word))), '畫面寫法只有假名（冇漢字）');
assert(new Set(PAIRS.flatMap((p) => p.words.map((w) => w.word))).size === 38, '38 個詞唔重複');
const norm = (s) => s.toLowerCase().replace(/[’' ]/g, '');
const romBad = PAIRS.flatMap((p) => p.words).filter((w) => { try { return norm(toRomaji(w.word)) !== norm(w.romaji); } catch (e) { return true; } });
assert(romBad.length === 0, '拼音由假名推算全部對得上 ' + romBad.map((w) => w.word + ':' + w.romaji).join(' '));
assert(PAIRS.every((p) => p.words[0].romaji !== p.words[1].romaji), '每對兩個詞拼音唔同');

// ── 用戶核對／修改嘅內容 ──
const P = (id) => PAIRS.find((p) => p.id === id);
const v5 = P('v5');
assert(v5.words[0].word === 'さる' && v5.words[0].romaji === 'saru' && v5.words[0].meaning === '猴子' && v5.words[0].kanji === '猿' && v5.words[1].word === 'ざる' && v5.words[1].romaji === 'zaru' && v5.words[1].meaning === '竹篩（ざるそば的ざる）', '清濁第 5 對：さる（猿）猴子／ざる 竹篩（ざるそば的ざる）');
assert(!PAIRS.some((p) => p.words.some((w) => w.word === 'ごはん' || w.word === 'こはん')), '冇「ごはん／こはん」');
assert(P('l1').words[0].kanji === '伯母さん' && P('l1').words[0].word === 'おばさん', '長音第 1 對：漢字寫法「伯母さん」（只係資料，畫面顯示假名）');
assert(!PAIRS.some((p) => p.words.some((w) => w.word === 'え' || w.word === 'ええ')), '「え／ええ」唔放入練習題');
assert(P('l5').words[1].word === 'スキー' && P('l8').words[1].word === 'チーズ' && P('v1').words[1].meaning === '蠔（「柿」也讀かき）' && P('s6').words[0].meaning === '原本、根源', '新詞對：すき／スキー、ちず／チーズ、かき（蠔，柿）、もと');

// ── 同現有「促音・長音」頁一致 ──
const topics = Object.fromEntries(C.SOUND_TOPICS.map((t) => [t.key, t]));
const same = (a, b) => a.word === b.word && a.romaji === b.romaji && a.meaning === b.meaning;
const longIds = ['l1', 'l2', 'l3', 'l4'], longIdx = [0, 1, 2, 4];
assert(longIds.every((id, i) => { const t = topics.chouon.pairs[longIdx[i]]; return same(P(id).words[0], t[0]) && same(P(id).words[1], t[1]); }), '長音 4 對（おばさん、おじさん、ゆき、ビル）同現有頁面逐字一致');
assert(['s1', 's2', 's3', 's4'].every((id, i) => { const t = topics.sokuon.pairs[i]; return same(P(id).words[0], t[0]) && same(P(id).words[1], t[1]); }), '促音 4 對同現有頁面逐字一致');

// ── 出題 ──
let orders = new Set(), qBad = [];
for (const p of PAIRS) {
  for (const side of [0, 1]) {
    for (let r = 0; r < 20; r++) {
      const q = M.question(p.id, side);
      if (q.type !== 'pair' || q.pair.id !== p.id || q.side !== side || q.options.length !== 2 || new Set(q.options.map((o) => o.word)).size !== 2) qBad.push(p.id);
      const right = q.options.filter((o) => M.isRight(q, o));
      if (right.length !== 1 || right[0].word !== p.words[side].word) qBad.push(p.id + ':right');
      orders.add(p.id + q.options[0].side);
    }
  }
}
assert(qBad.length === 0, '19×2×20 題：二選一、剛好一個正確、正確＝被朗讀嗰個 ' + qBad.slice(0, 3));
assert(PAIRS.every((p) => orders.has(p.id + '0') && orders.has(p.id + '1')), '選項次序隨機（每對兩種次序都出現）');
let spoken = [];
win.App.Speech.speak = (t) => spoken.push(t);
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/minimal.js'), 'utf8'), win); // reload so it picks up the spy
const M2 = win.App.Minimal;
M2.playQ(M2.question('s1', 1), { rate: 0.8 });
M2.playQ(M2.question('v3', 0), { rate: 0.8 }, 0.6);
assert(spoken.join() === 'きって,ぶた', '朗讀＝被考嗰個詞嘅假名');

// ── 一輪練習 ──
const st = fresh();
const q10 = M.buildPractice(st, { cats: null, count: 10 });
assert(q10.length === 10 && q10.every((q) => q.type === 'pair'), '預設：10 題');
assert(M.buildPractice(st, { cats: null, count: 20 }).length === 20 && M.buildPractice(st, { cats: null, count: 5 }).length === 5, '5／20 題');
const onlyV = M.buildPractice(st, { cats: ['voice'], count: 20 });
assert(onlyV.length === 20 && onlyV.every((q) => q.pair.cat === 'voice'), '只揀清濁：20 題都係清濁');
const two = M.buildPractice(st, { cats: ['long', 'sokuon'], count: 20 });
assert(two.every((q) => q.pair.cat !== 'voice') && two.some((q) => q.pair.cat === 'long') && two.some((q) => q.pair.cat === 'sokuon'), '揀長音＋促音：冇清濁');
assert(M.buildPractice(st, { cats: [], count: 10 }).length === 0, '冇揀類別：冇題目');
let consec = 0;
for (let r = 0; r < 200; r++) { const qs = M.buildPractice(st, { cats: null, count: 20 }); for (let i = 1; i < qs.length; i++) if (qs[i].pair.id === qs[i - 1].pair.id) consec++; }
assert(consec === 0, '唔會連續兩題同一對（200 輪 × 20 題）');
const both = new Set(); for (let r = 0; r < 100; r++) M.buildPractice(st, { cats: ['long'], count: 20 }).forEach((q) => both.add(q.pair.id + q.side));
assert(both.size === 16, '一對兩邊都會出（長音 8 對 × 2 邊 = 16）');
// weighting: wrong pair appears more
const wt = fresh();
PAIRS.forEach((p) => { wt.pairs.stats[p.id] = { c: 5, w: 0 }; });
wt.pairs.stats.l3 = { c: 0, w: 5 };
let hit = 0;
for (let i = 0; i < 3000; i++) if (M.buildPractice(wt, { cats: null, count: 5 }).some((q) => q.pair.id === 'l3')) hit++;
assert(hit / 3000 > 0.38, `加權：答錯多嘅 l3 出現率 ${(hit / 30).toFixed(0)}%（隨機約 26%）`);

// ── 掌握計數 ──
const c0 = M.counts(fresh());
assert(c0.total === 19 && c0.mastered === 0 && c0.learning === 0 && c0.unseen === 19, '全新存檔：掌握 0 / 19');
const s2 = fresh();
s2.pairs.stats = { l1: { c: 3, w: 0 }, l2: { c: 2, w: 0 }, l3: { c: 5, w: 1 }, s1: { c: 0, w: 1 } };
s2.review.items['q:l3'] = { box: 0, due: TODAY };
const c2 = M.counts(s2);
assert(c2.mastered === 1 && c2.learning === 3 && c2.unseen === 15, '掌握＝答對 ≥ 3 次且唔喺重溫（l1）；l2（2 次）、l3（喺重溫）、s1 學習中');

// ── 答題紀錄 ──
const r1 = S.recordPairAnswer(fresh(), 'l8', false);
assert(r1.pairs.stats.l8.c === 0 && r1.pairs.stats.l8.w === 1 && r1.review.items['q:l8'] && r1.review.items['q:l8'].box === 0 && r1.review.items['q:l8'].due === TODAY, '答錯：統計 w＋1，重溫 q:l8（box 0、今日）');
const r2 = S.recordPairAnswer(r1, 'l8', true);
assert(r2.pairs.stats.l8.c === 1 && r2.pairs.stats.l8.w === 1 && r2.review.items['q:l8'].box === 0, '答對（練習）：統計 c＋1，重溫唔變');
const r3 = S.reviewCorrect(r2, 'q:l8');
assert(r3.review.items['q:l8'] && r3.review.items['q:l8'].box === 1 && r3.review.items['q:l8'].due > TODAY, '重溫答對：升 box 1、之後到期');
const day = Object.values(r2.daily.activity).reduce((n, x) => n + x.a, 0);
assert(day === 2, '答題計入今日活動');
const fr = fresh();
assert(S.recordPairAnswer(fr, 'x9', true) === fr, '壞 id（x9）：原樣傳回');

// ── 存檔、備份 ──
assert(JSON.stringify(fresh().pairs) === '{"stats":{}}', '全新存檔：pairs.stats 空');
const store = { v: null };
const win2 = { localStorage: { getItem: () => store.v, setItem(_, v) { store.v = v; }, removeItem() {} } };
win2.window = win2; win2.App = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8'), win2);
const old = fresh(); delete old.pairs; store.v = JSON.stringify(old);
assert(JSON.stringify(win2.App.Storage.loadState().pairs) === '{"stats":{}}', '舊存檔（冇 pairs）：補預設');
const odd = fresh(); odd.pairs = { stats: { l1: { c: 2, w: 1, last: 'x' }, bad: { c: 1, w: 1 }, v9: { c: 'a', w: 1 }, s2: { c: -1, w: 0 }, __proto__: { c: 1, w: 1 } } }; store.v = JSON.stringify(odd);
assert(Object.keys(win2.App.Storage.loadState().pairs.stats).join() === 'l1', '存檔入面壞 id／壞數字被丟棄（剩 l1）');
const bk = fresh();
bk.pairs.stats = { l1: { c: 3, w: 1, last: '2026-10-26T00:00:00.000Z' }, v5: { c: 0, w: 2, last: '2026-10-26T00:00:00.000Z' } };
bk.review.items = { 'q:v5': { box: 0, due: TODAY }, 'q:l1': { box: 2, due: TODAY } };
const file = JSON.stringify(S.buildBackup(bk));
const back = S.parseBackup(file);
assert(back.ok && JSON.stringify(back.state.pairs.stats) === JSON.stringify(bk.pairs.stats) && back.state.review.items['q:v5'] && back.state.review.items['q:l1'].box === 2, '備份往返：近音詞統計同 q: 重溫保留');
const tamper = (fn) => { const o = JSON.parse(file); fn(o.data['japaneseOps:v1']); return S.parseBackup(JSON.stringify(o)); };
const noPairs = tamper((x) => { delete x.pairs; });
assert(noPairs.ok && JSON.stringify(noPairs.state.pairs) === '{"stats":{}}', '舊備份（冇 pairs）：照常還原，補預設');
assert(tamper((x) => { x.pairs = 'x'; }).ok === false && tamper((x) => { x.pairs = []; }).ok === false, 'pairs 型別錯：備份 invalid');
const evil = tamper((x) => { x.pairs.stats = { l1: { c: 1, w: 0 }, zz: { c: 1, w: 0 }, v99: { c: 1, w: 0 }, l2: { c: 'x', w: 0 } }; x.review.items['q:zz'] = { box: 0, due: TODAY }; x.review.items['q:s3'] = { box: 0, due: TODAY }; x.review.items['q:l1:extra'] = { box: 0, due: TODAY }; });
assert(evil.ok && Object.keys(evil.state.pairs.stats).sort().join() === 'l1,v99', '竄改備份：壞 key（zz）、壞數字（l2）被丟棄；格式啱但唔存在嘅 id（v99）無害，計數只數 19 對 ' + Object.keys(evil.state.pairs.stats));
assert(evil.ok && !evil.state.review.items['q:zz'] && !evil.state.review.items['q:l1:extra'] && !!evil.state.review.items['q:s3'], '竄改備份：壞嘅 q: 重溫 key 被丟棄，好嘅保留');

console.log(bad ? `\n${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
