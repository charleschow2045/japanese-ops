// 漢字標示・假朋友詞（stage 10 ⑪）— 純 Node，唔使瀏覽器：
// 44 個標示（9 組）同 9 個假朋友詞嘅資料（用戶核對過嘅文字）、拼音由假名推算、詞唔重複（同片假名詞都唔撞）、
// 兩種題型嘅選項規則、假朋友「中文誤會義」一定喺選項、歧義選項（出口／緊急出口）、一輪練習、認得計數、
// 重溫 key r:<詞>、備份 sanitize 接受漢字詞。畫面另見 signsui.js（Playwright）。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
win.window = win;
win.App = { UI: { h() {}, jp() {}, inkButton() {}, modHeader() {}, chip() {} }, Speech: { speak() {}, isTTSSupported: () => true, speechNotice: () => null }, Feedback: {} };
for (const f of ['js/content/kana.js', 'js/content/menus.js', 'js/content/signs.js', 'js/storage.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), win);
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/reading.js'), 'utf8'), win);
const R = win.App.Reading, S = win.App.Storage, C = win.App.Content;
const SG = C.SIGNS, FF = C.FALSE_FRIENDS;
const toRomaji = require('./rom.js').toRomaji;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const TODAY = S.todayLocal();
const fresh = () => JSON.parse(JSON.stringify(S.loadState()));
const by = (list, w) => list.find((x) => x.word === w);

// ── 資料 ──
assert(SG.length === 44, '標示 44 個');
assert(FF.length === 9, '假朋友詞 9 個');
const groupCount = {};
SG.forEach((x) => { groupCount[x.scene] = (groupCount[x.scene] || 0) + 1; });
assert(JSON.stringify(groupCount) === JSON.stringify({ '出入口・通行': 5, '車站・交通': 10, '洗手間': 4, '營業・商店': 5, '價錢・付款': 6, '餐廳': 2, '禁止・注意': 6, '溫泉': 2, '緊急・生活': 4 }), '9 組各自嘅數目 ' + JSON.stringify(groupCount));
assert(C.SIGN_GROUPS.join() === '出入口・通行,車站・交通,洗手間,營業・商店,價錢・付款,餐廳,禁止・注意,溫泉,緊急・生活', '組別次序');
assert(C.SIGN_GROUPS.every((g) => g.length <= 12), '組名 ≤ 12 字（備份 scenes 白名單）');
const katWords = new Set(C.KATAKANA_EXAMPLES.map((x) => x.word));
const all = [...SG, ...FF];
assert(new Set(all.map((x) => x.word)).size === 53 && all.every((x) => !katWords.has(x.word)), '53 個詞唔重複，亦唔同片假名詞撞（共用 r: 重溫 key）');
assert(all.every((x) => x.word && x.kana && x.romaji && x.meaning && x.where && x.scene && x.word.length <= 30), '每個詞都有寫法／假名／拼音／意思／在哪裡看到／組別');
assert(SG.every((x) => x.meaning.length <= 12), '標示嘅選項意思夠短（≤ 12 字）');
assert(new Set(SG.map((x) => x.meaning)).size === 44, '44 個標示嘅選項意思都唔同');
assert(all.every((x) => /^[ぁ-ゖー]+$/.test(x.kana)), '假名欄只有平假名');
const norm = (s) => s.toLowerCase().replace(/[’' ]/g, '');
const romBad = all.filter((x) => { try { return norm(toRomaji(x.kana)) !== norm(x.romaji); } catch (e) { return true; } });
assert(romBad.length === 0, '拼音由假名推算全部對得上 ' + romBad.map((x) => x.word + ':' + x.romaji).join(' '));
assert(by(SG, '禁煙').romaji === 'kin’en', '「ん＋母音」用 ’（kin’en）');

// ── 用戶核對／指定嘅內容 ──
const jun = by(SG, '準備中');
assert(jun.meaning === '暫停營業' && jun.warn.includes('不是「快要開門」') && jun.scene === '營業・商店', '準備中：意思「暫停營業」＋提醒唔係「快要開門」');
assert(by(SG, '案内所').word.includes('内') && !by(SG, '案内所').word.includes('內') && by(SG, '案内所').scene === '緊急・生活' && by(SG, '案内所').meaning === '詢問處', '案内所：「内」唔係「內」、詢問處、緊急・生活');
assert(by(SG, '優先席').scene === '車站・交通' && by(SG, '優先席').meaning === '優先座位' && by(SG, '優先席').romaji === 'yuusenseki', '優先席：車站・交通、優先座位');
assert(by(SG, '使用中').scene === '洗手間' && by(SG, '使用中').kana === 'しようちゅう' && by(SG, '使用中').detail.includes('洗手間'), '使用中：洗手間、有人使用');
assert(by(SG, '両替所').scene === '價錢・付款' && by(SG, '両替所').meaning === '兌換處' && by(SG, '両替所').romaji === 'ryougaejo', '両替所：價錢・付款、兌換處');
assert(by(SG, '改札口').detail.includes('改札') && by(SG, '押').warn.includes('引') && by(SG, '引').warn.includes('押'), '改札口簡稱「改札」；押／引互相提醒');
assert(!FF.some((x) => x.word === '走る') && !!by(FF, '床'), '假朋友：冇「走る」，有「床」');
const yuka = by(FF, '床');
assert(yuka.kana === 'ゆか' && yuka.romaji === 'yuka' && yuka.meaning === '地板' && yuka.trapOpt === '睡床' && yuka.where.includes('酒店、旅館') && yuka.where.includes('床に置かないでください'), '床：ゆか／yuka／地板／睡床／酒店、旅館＋「床に置かないでください」');
assert(by(FF, '手紙').trap === '廁紙（普通話的「手紙」是衛生紙）' && by(FF, '手紙').trapOpt === '廁紙', '手紙：誤會成「廁紙（普通話的「手紙」是衛生紙）」');
assert(by(FF, '勉強').detail.includes('算便宜一點'), '勉強：保留「算便宜」用法');
assert(FF.every((x) => x.trapOpt && x.trap && x.detail && x.scene === '假朋友詞') && new Set(FF.map((x) => x.meaning)).size === 9 && new Set(FF.map((x) => x.trapOpt)).size === 9, '假朋友：每個都有誤會義；意思同誤會義都唔重複');
assert(FF.every((x) => x.meaning !== x.trapOpt), '真意思同誤會義唔同');

// ── 看詞選意思 ──
let seeBad = [], sceneOk = 0, sceneN = 0, clash = [];
for (const it of SG) {
  for (let r = 0; r < 15; r++) {
    const q = R.question(it, 'see');
    const ms = q.options.map((o) => o.meaning);
    if (q.type !== 'see' || q.options.length !== 4 || new Set(ms).size !== 4 || q.options.filter((o) => o.word === it.word).length !== 1) seeBad.push(it.word);
    q.options.filter((o) => o.word !== it.word).forEach((o) => { if (o.meaning.includes(it.meaning) || it.meaning.includes(o.meaning)) clash.push(it.word + '/' + o.meaning); });
    const mates = SG.filter((x) => x.scene === it.scene && x.word !== it.word).length;
    if (mates >= 3) { sceneN++; if (q.options.every((o) => o.scene === it.scene)) sceneOk++; }
  }
}
assert(seeBad.length === 0, '標示看詞選意思：4 個選項、包括答案、意思都唔同（44×15 次）' + seeBad.slice(0, 3));
assert(clash.length === 0, '標示看詞選意思：錯誤選項唔會包含／被包含於答案（出口／緊急出口、含稅／未含稅）' + clash.slice(0, 3));
assert(sceneN > 0 && sceneOk === sceneN, '組內有足夠嘅詞時，錯誤選項取同組（' + sceneOk + '/' + sceneN + '）');
const amb = []; for (let i = 0; i < 60; i++) { amb.push(...R.question(by(SG, '出口'), 'see').options.map((o) => o.meaning)); amb.push(...R.question(by(SG, '税込'), 'see').options.map((o) => o.meaning)); }
assert(!amb.includes('緊急出口') && !amb.includes('未含稅'), '出口 唔會同時出「緊急出口」、含稅 唔會同時出「未含稅」');

// ── 假朋友：看詞選意思 ──
let ffBad = [], trapMiss = 0;
for (const it of FF) {
  for (let r = 0; r < 40; r++) {
    const q = R.question(it, 'see');
    const ms = q.options.map((o) => o.meaning);
    if (q.options.length !== 4 || new Set(ms).size !== 4 || q.options.filter((o) => o.word === it.word).length !== 1) ffBad.push(it.word);
    if (!ms.includes(it.trapOpt)) trapMiss++;
    if (q.options.filter((o) => o.isTrap).length !== 1) ffBad.push(it.word + ':trap');
  }
}
assert(ffBad.length === 0, '假朋友看詞選意思：4 個選項、包括答案、剛好一個誤會義選項 ' + ffBad.slice(0, 3));
assert(trapMiss === 0, '假朋友看詞選意思：「中文誤會義」每次都喺選項入面（9×40 次）');
const tq = R.question(by(FF, '床'), 'see');
const trapOpt = tq.options.find((o) => o.isTrap);
assert(trapOpt.meaning === '睡床' && trapOpt.word !== '床', '誤會義選項：「睡床」，唔係正確答案');

// ── 聽音選詞（標示＋假朋友）──
let hearBad = [], shared = 0, sharedRandom = 0, n = 0;
const sharedOf = (a, b) => { const cs = new Set(a.split('')); return b.split('').filter((c) => cs.has(c)).length; };
for (const it of all) {
  const list = FF.includes(it) ? FF : SG;
  for (let r = 0; r < 10; r++) {
    const q = R.question(it, 'hear');
    const ws = q.options.map((o) => o.word), rs = q.options.map((o) => o.romaji);
    if (q.type !== 'hear' || q.options.length !== 4 || !ws.includes(it.word) || new Set(ws).size !== 4 || new Set(rs).size !== 4 || !q.options.every((o) => list.includes(o))) hearBad.push(it.word);
    q.options.filter((o) => o.word !== it.word).forEach((o) => { shared += sharedOf(it.word, o.word); n++; });
  }
  list.filter((x) => x.word !== it.word).forEach((x) => { sharedRandom += sharedOf(it.word, x.word) / (list.length - 1); });
}
assert(hearBad.length === 0, '聽音選詞：4 個選項、包括答案、寫法同讀音都唔同、選項來自同一份清單（53×10 次）' + hearBad.slice(0, 3));
assert(shared / n > (sharedRandom / all.length) * 1.5, `聽音選詞：錯誤選項同答案共用字數（${(shared / n).toFixed(2)}）多過隨機（${(sharedRandom / all.length).toFixed(2)}）`);
const hh = []; for (let i = 0; i < 40; i++) hh.push(...R.question(by(SG, '出口'), 'hear').options.map((o) => o.word));
assert(hh.includes('入口') && hh.includes('非常口'), '例子：出口 嘅選項會出現形近嘅 入口、非常口');
const hh2 = []; for (let i = 0; i < 40; i++) hh2.push(...R.question(by(SG, '男湯'), 'hear').options.map((o) => o.word));
assert(hh2.includes('女湯'), '例子：男湯 嘅選項會出現 女湯');

// ── 一輪練習 ──
const st = fresh();
const pool0 = R.signPool();
assert(pool0.length === 53, '預設範圍：全部 53 個（44 標示＋9 假朋友）');
let q10 = R.buildSignPractice(st);
assert(q10.length === 10 && new Set(q10.map((q) => q.item.word)).size === 10, '一輪 10 題，唔重複');
assert(q10.filter((q) => q.type === 'see').length === 5 && q10.filter((q) => q.type === 'hear').length === 5, '混合：看詞、聽音各一半');
assert(q10.every((q) => q.family === 'word' && all.includes(q.item)), '題目 family＝word（共用答題、統計、重溫）');

// ── 認得計數 ──
const c0 = R.signCounts(fresh()), f0 = R.friendCounts(fresh());
assert(c0.total === 44 && c0.known === 0 && c0.unseen === 44 && f0.total === 9 && f0.unseen === 9, '全新存檔：標示 0 / 44、假朋友 0 / 9');
const s2 = fresh();
s2.read.stats = { 出口: { c: 2, w: 0 }, 入口: { c: 1, w: 0 }, 準備中: { c: 3, w: 1 }, 手紙: { c: 2, w: 0 }, 湯: { c: 0, w: 1 } };
s2.review.items['r:準備中'] = { box: 0, due: TODAY };
const c2 = R.signCounts(s2), f2 = R.friendCounts(s2);
assert(c2.known === 1 && c2.learning === 2 && c2.unseen === 41, '標示：出口認得；入口、準備中（喺重溫）學習中');
assert(f2.known === 1 && f2.learning === 1 && f2.unseen === 7, '假朋友：手紙認得；湯學習中');
assert(R.counts(s2).total === 120 && R.counts(s2).known === 0, '片假名詞嘅計數唔受影響（仍然 120）');

// ── 答題紀錄同重溫 ──
const w1 = S.recordReadAnswer(fresh(), '手紙', false);
assert(w1.read.stats['手紙'].w === 1 && w1.review.items['r:手紙'] && w1.review.items['r:手紙'].box === 0, '答錯：記入統計＋重溫 r:手紙');
const dueSt = fresh();
dueSt.review.items = { 'r:出口': { box: 0, due: TODAY }, 'r:床': { box: 1, due: TODAY }, 'r:ホテル': { box: 0, due: TODAY }, 'r:唔存在': { box: 0, due: TODAY } };
assert(R.dueCount(dueSt) === 3, '重溫：標示、假朋友、片假名詞都計（壞 key 唔計）：' + R.dueCount(dueSt));
const rv = R.buildReview(dueSt);
assert(rv.length === 3 && rv.some((q) => q.item.word === '床') && rv.some((q) => q.item.word === '出口') && rv.every((q) => q.options.length === 4), '重溫題目：3 題，每題 4 個選項');

// ── 備份 ──
const bk = fresh();
bk.read.stats = { 出口: { c: 2, w: 0, last: '2026-10-25T00:00:00.000Z' }, 手紙: { c: 0, w: 1, last: '2026-10-25T00:00:00.000Z' } };
bk.review.items = { 'r:手紙': { box: 0, due: TODAY }, 'r:非常口': { box: 2, due: TODAY } };
const back = S.parseBackup(JSON.stringify(S.buildBackup(bk)));
assert(back.ok && back.state.read.stats['出口'].c === 2 && back.state.review.items['r:手紙'] && back.state.review.items['r:非常口'].box === 2, '備份往返：漢字詞嘅統計同重溫都保留');

console.log(bad ? `\n${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
