// 旅行準備度（stage 10 ⑧）— 純 Node，唔使瀏覽器：
// 16 項、4 組、各項目標（平假名 84／片假名 70、重點情境 ceil(40%)、其他情境 ceil(25%) 等）、
// 狀態（達標／進行中／未開始）、「建議先做」次序、數字題 20 題＋80%、備份 7 日、酒店三欄、旅行日期、
// 建議文字同用戶批准嘅一模一樣，同 readiness() 唔改動 state。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
win.window = win;
win.App = { UI: { h() {}, jp() {}, inkButton() {}, modHeader() {}, chip() {}, accentVars() {} }, Speech: { speak() {}, isTTSSupported: () => true, speechNotice: () => null }, Feedback: {} };
const load = (f) => vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), win);
['js/content/kana.js', 'js/content/menus.js', 'js/storage.js', 'js/content/phrases.js', 'js/content/route.js', 'js/content/dialogues.js', 'js/content/numbers.js', 'js/content/showcards.js', 'js/content/swap.js', 'js/reading.js', 'js/daily.js', 'js/progress.js'].forEach(load);
const S = win.App.Storage, P = win.App.Progress, D = win.App.Daily;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const TODAY = S.todayLocal();
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const fresh = () => JSON.parse(JSON.stringify(S.defaultState ? S.defaultState() : S.loadState()));

const base = fresh();
const before = JSON.stringify(base);
const r0 = P.readiness(base);
assert(JSON.stringify(base) === before, 'readiness() 唔改動 state');
assert(r0.total === 16 && r0.items.length === 16, '共 16 項');
assert(r0.groups.map((g) => g.items.length).join() === '6,4,3,3', '四組：6、4、3、3 項');
assert(r0.groups.map((g) => g.title).join('｜') === '🗣️ 說得出、聽得懂｜🔤 認得出｜🔢 數字｜🎒 旅行前準備', '四組標題');
assert(r0.reached === 0 || r0.reached === r0.items.filter((x) => x.done).length, '「已達標」＝達標項數');
const byId = (r, id) => r.items.find((x) => x.id === id);

// ── 目標 ──
assert(byId(r0, 'must').target === 24, '必學 30 句目標 24（30 句嘅 80%）');
assert(byId(r0, 'hira').target === 84 && byId(r0, 'hira').detail.includes('/ 104'), '平假名目標 ≥ 84 / 104');
assert(byId(r0, 'kata').target === 70 && byId(r0, 'kata').detail.includes('/ 116'), '片假名目標 70 / 116（60% 進位）');
assert(byId(r0, 'words').target === 60 && byId(r0, 'menu').target === 15, '片假名詞 60／餐牌 15 行');
['restaurant', 'transport', 'emergency'].forEach((k) => {
  const it = byId(r0, k);
  const total = Number(it.detail.match(/\/ (\d+)/)[1]);
  assert(it.target === Math.ceil(total * 0.4), `${k}：目標＝ceil(${total}×40%)＝${it.target}`);
});
const o = byId(r0, 'other');
assert(o.target === Math.ceil(Number(o.detail.match(/\/ (\d+)/)[1]) * 0.25) && o.label.includes('8 個'), `其他 8 個情境：目標＝ceil(25%)＝${o.target}`);
assert(byId(r0, 'dialogues').target === 7, '重點對話 7 個');
assert(['yen', 'time', 'date'].every((k) => byId(r0, k).target === 20), '數字三項：答 20 題');
assert(byId(r0, 'hotel').target === 3 && byId(r0, 'backup').target === 1 && byId(r0, 'travel').target === 1, '旅行前準備三項');

// ── 全新存檔 ──
assert(r0.items.filter((x) => x.done).length === 0 && r0.reached === 0, '全新存檔：0 項達標');
assert(r0.next && r0.next.id === 'must', '全新存檔：建議先做＝必學 30 句（第一項未達標）');
assert(r0.items.every((x) => x.status === 'todo' && x.pct === 0), '全新存檔：全部「未開始」、進度 0');

// ── 建議文字（用戶批准嘅原文）──
const hint = (id) => byId(r0, id).hint;
assert(hint('emergency') === '多練緊急情況句子，並記住日本緊急電話：報警 110、火警及救護車 119。', '緊急情況建議（含 110／119）');
assert(hint('other') === '每天完成每日任務，新句子會逐個情境輪流出現。', '其他情境建議');
assert(hint('travel') === '到設定輸入旅行日期，會顯示倒數。' && !JSON.stringify(r0).includes('出發日期'), '旅行日期用語，冇「出發日期」');
assert(hint('backup') === '到設定匯出進度備份（還沒有備份過）。', '備份建議（未備份過）');
assert(hint('dialogues').startsWith('還沒玩的重點對話：') && hint('dialogues').split('、').length === 7, '重點對話建議列出 7 個未玩');
assert(r0.items.every((x) => x.hint && x.go), '未達標項目都有建議同「前往」');
const goOf = Object.fromEntries(r0.items.map((x) => [x.id, x.go]));
assert(goOf.must === 'phrases:must' && goOf.restaurant === 'phrases' && goOf.other === 'daily' && goOf.dialogues === 'dialogue' && goOf.hira === 'kana' && goOf.words === 'reading' && goOf.yen === 'numbers' && goOf.hotel === 'show' && goOf.backup === 'backup' && goOf.travel === 'settings', '「前往」目標');

// ── 數字：20 題＋80% ──
const num = (stats) => { const s = fresh(); s.numbers.stats = stats; return P.readiness(s); };
assert(byId(num({ yen: { c: 16, w: 4 } }), 'yen').done, '價錢：20 題、80% → 達標');
assert(!byId(num({ yen: { c: 15, w: 5 } }), 'yen').done && byId(num({ yen: { c: 15, w: 5 } }), 'yen').status === 'doing', '價錢：20 題、75% → 未達標（進行中）');
assert(!byId(num({ yen: { c: 10, w: 0 } }), 'yen').done && byId(num({ yen: { c: 10, w: 0 } }), 'yen').pct === 0.5, '價錢：只答 10 題 → 50%');
assert(byId(num({ yen: { c: 10, w: 0 } }), 'yen').detail.includes('已答 10 題・答對率 100%'), '價錢：顯示已答同答對率');
const t = byId(num({ time: { c: 9, w: 1 }, fun: { c: 8, w: 2 } }), 'time');
assert(t.done && t.value === 20, '時間：time＋fun 合併計（20 題、85%）');
const d = byId(num({ month: { c: 7, w: 1 }, day: { c: 6, w: 1 }, date: { c: 5, w: 0 } }), 'date');
assert(d.value === 20 && d.done, '日期：month＋day＋date 合併計（20 題、90%）');
assert(byId(num({}), 'yen').detail.startsWith('還沒練習'), '未練習：顯示「還沒練習」');

// ── 假名／句子／看得懂 門檻 ──
const KANA = win.App.Content.KANA;
const kanaState = (sc, n) => { const s = fresh(); Object.values(KANA).filter((k) => k[sc]).slice(0, n).forEach((k) => { s.kana.stats[k[sc]] = { c: 2, w: 0 }; }); return P.readiness(s); };
assert(!byId(kanaState('hira', 83), 'hira').done && byId(kanaState('hira', 83), 'hira').status === 'doing', '平假名 83 個：未達標（79.8%）');
assert(byId(kanaState('hira', 84), 'hira').done, '平假名 84 個：達標');
assert(!byId(kanaState('kata', 69), 'kata').done && byId(kanaState('kata', 70), 'kata').done, '片假名 69 未達標、70 達標');
const mistaken = fresh(); Object.values(KANA).slice(0, 90).forEach((k) => { if (k.hira) mistaken.kana.stats[k.hira] = { c: 2, w: 0 }; }); mistaken.kana.mistakes = [KANA[Object.keys(KANA)[0]].hira];
assert(byId(P.readiness(mistaken), 'hira').value === Object.values(KANA).slice(0, 90).filter((k) => k.hira).length - 1, '平假名：喺錯題清單入面嘅唔計掌握');
const mustIds = win.App.Content.MUST_HAVE;
const mustState = (n) => { const s = fresh(); mustIds.slice(0, n).forEach((id) => { const x = D.allSentences().find((y) => y.p.id === id); s.listen.stats[id] = { c: 2, w: 0, run: 2 }; if (x.mine) s.speak.stats[id] = { c: 1, w: 0, run: 1 }; }); return P.readiness(s); };
assert(byId(mustState(23), 'must').value === 23 && !byId(mustState(23), 'must').done && byId(mustState(24), 'must').done, '必學 30 句：23 句未達標、24 句達標');
const sceneState = (key, n) => { const s = fresh(); D.allSentences().filter((x) => win.App.Content.PHRASE_SCENES[x.si].key === key).slice(0, n).forEach((x) => { s.listen.stats[x.p.id] = { c: 2, w: 0, run: 2 }; if (x.mine) s.speak.stats[x.p.id] = { c: 1, w: 0, run: 1 }; }); return P.readiness(s); };
assert(!byId(sceneState('restaurant', 17), 'restaurant').done && byId(sceneState('restaurant', 18), 'restaurant').done, '餐廳：17 句未達標、18 句達標');
assert(!byId(sceneState('emergency', 14), 'emergency').done && byId(sceneState('emergency', 15), 'emergency').done, '緊急情況：14 句未達標、15 句達標');
const readState = (nWords) => { const s = fresh(); win.App.Content.KATAKANA_EXAMPLES.slice(0, nWords).forEach((w) => { s.read.stats[w.word] = { c: 2, w: 0 }; }); return P.readiness(s); };
assert(byId(readState(59), 'words').value === 59 && !byId(readState(59), 'words').done && byId(readState(60), 'words').done, '片假名詞：59 未達標、60 達標');

// ── 旅行前準備 ──
const prep = (fn) => { const s = fresh(); fn(s); return P.readiness(s); };
assert(byId(prep((s) => { s.show.saved.hotelName = 'A'; }), 'hotel').value === 1, '酒店：填 1 欄');
assert(byId(prep((s) => { s.show.saved.hotelName = 'A'; s.show.saved.hotelAddress = ' '; s.show.saved.hotelTel = '1'; }), 'hotel').value === 2, '酒店：空白唔計，填 2 欄');
assert(byId(prep((s) => { s.show.saved.hotelName = 'A'; s.show.saved.hotelAddress = 'B'; s.show.saved.hotelTel = 'C'; }), 'hotel').done, '酒店：三欄都填 → 達標');
assert(byId(prep((s) => { s.backup = { lastExportAt: ago(0) }; }), 'backup').done, '備份：今日 → 達標');
assert(byId(prep((s) => { s.backup = { lastExportAt: ago(7) }; }), 'backup').done, '備份：7 日前 → 仍達標');
const b8 = byId(prep((s) => { s.backup = { lastExportAt: ago(8) }; }), 'backup');
assert(!b8.done && b8.hint === '到設定匯出進度備份（超過 7 天沒有備份）。', '備份：8 日前 → 未達標，建議文字不同');
const future = new Date(); future.setDate(future.getDate() + 30);
const pad = (n) => String(n).padStart(2, '0');
const fd = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;
assert(byId(prep((s) => { s.settings.travelDate = fd; }), 'travel').done, '旅行日期：已設定 → 達標');
assert(byId(prep((s) => { s.settings.travelDate = fd; }), 'travel').detail.includes('還有 30 天'), '旅行日期：顯示倒數');
assert(byId(prep((s) => { s.settings.travelDate = '2020-01-01'; }), 'travel').done, '旅行日期：已過去亦算已設定（可更新）');
assert(!byId(prep((s) => { s.settings.travelDate = ''; }), 'travel').done, '旅行日期：未設定 → 未達標');

// ── 重點對話 ──
const dl = prep((s) => { s.dialogue.stats = { ramen: { plays: 2 }, taxi: { plays: 1 }, other: { plays: 9 } }; });
const dit = byId(dl, 'dialogues');
assert(dit.value === 2 && dit.status === 'doing' && !dit.hint.includes('拉麵店') && !dit.hint.includes('的士'), '重點對話：玩過 2 個唔再列入建議；非重點對話唔計');
assert(byId(prep((s) => { s.dialogue.stats = Object.fromEntries(['ramen', 'station', 'taxi', 'hotel', 'directions', 'emergency', 'airport'].map((id) => [id, { plays: 1 }])); }), 'dialogues').done, '重點對話：7 個都玩過 → 達標');

// ── 建議先做：第一項未達標 ──
const nx = prep((s) => { s.numbers.stats = { yen: { c: 20, w: 0 } }; s.settings.travelDate = fd; });
assert(nx.next.id === 'must', '建議先做：仍然係排最前嘅未達標項');
assert(nx.reached === 2, '已達標項數（價錢＋旅行日期）＝ 2');
const allDone = prep((s) => {
  s.numbers.stats = { yen: { c: 20, w: 0 }, time: { c: 20, w: 0 }, month: { c: 20, w: 0 } };
  s.show.saved = { ...s.show.saved, hotelName: 'A', hotelAddress: 'B', hotelTel: 'C' };
  s.backup = { lastExportAt: ago(0) };
  s.settings.travelDate = fd;
  s.dialogue.stats = Object.fromEntries(['ramen', 'station', 'taxi', 'hotel', 'directions', 'emergency', 'airport'].map((id) => [id, { plays: 1 }]));
});
assert(allDone.reached === 7 && allDone.items.filter((x) => x.done).map((x) => x.id).join() === 'dialogues,yen,time,date,hotel,backup,travel', '除句子同假名外全部達標：7 項');
assert(allDone.next && allDone.next.id === 'must', '建議先做仍然係必學 30 句');

console.log(bad ? `\n${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
