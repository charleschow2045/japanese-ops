// 數字：日期（stage 10 ⑤）— 資料與出題（純 Node，不需要瀏覽器）：
// 月 1–12、日 1–31、日期組合、曜日、今日・明日・明後日；讀音表同出題產生器一致；拼音由假名推算；
// 「日期」類別三個 kind（month／day／date）各難度的範圍、選項、重溫 key。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const win = {};
win.window = win;
for (const f of ['js/content/numbers.js', 'js/numquiz.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), win);
const NQ = win.App.NumberQuiz;
const T = Object.fromEntries(win.App.Content.NUMBER_TOPICS.map((t) => [t.key, t]));
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ── 讀音表資料 ──
const month = T.month.rows, day = T.day.rows;
assert(month.length === 12 && day.length === 31, '月 12 行、日 31 行');
const MONTH_KANA = 'いちがつ にがつ さんがつ しがつ ごがつ ろくがつ しちがつ はちがつ くがつ じゅうがつ じゅういちがつ じゅうにがつ'.split(' ');
assert(month.every((r, i) => r.show === `${i + 1}月` && r.kana === MONTH_KANA[i]), '12 個月的讀音（4月しがつ、7月しちがつ、9月くがつ）');
const DAY_KANA = ('ついたち ふつか みっか よっか いつか むいか なのか ようか ここのか とおか じゅういちにち じゅうににち じゅうさんにち じゅうよっか じゅうごにち じゅうろくにち じゅうしちにち じゅうはちにち じゅうくにち はつか ' +
  'にじゅういちにち にじゅうににち にじゅうさんにち にじゅうよっか にじゅうごにち にじゅうろくにち にじゅうしちにち にじゅうはちにち にじゅうくにち さんじゅうにち さんじゅういちにち').split(' ');
assert(day.every((r, i) => r.show === `${i + 1}日` && r.kana === DAY_KANA[i]), '31 個日期的讀音');
const irrM = month.filter((r) => r.irregular).map((r) => r.show).join();
const irrD = day.filter((r) => r.irregular).map((r) => r.show).join();
assert(irrM === '4月,7月,9月', '特別讀法（月）：4、7、9 月 ' + irrM);
assert(irrD === '1日,2日,3日,4日,5日,6日,7日,8日,9日,10日,14日,20日,24日', '特別讀法（日）：1–10、14、20、24 日（共 13 個）');
assert(month[6].note === '不讀「なながつ」' && month[3].note === '不讀「よんがつ」' && month[8].note === '不讀「きゅうがつ」', '4／7／9 月備註（7 月＝不讀「なながつ」，用戶修正）');
assert(day[16].kana === 'じゅうしちにち' && day[26].kana === 'にじゅうしちにち' && day[18].kana === 'じゅうくにち' && day[28].kana === 'にじゅうくにち', '17、27 日讀しち；19、29 日讀く');
assert(day[16].note.includes('じゅうななにち') && day[26].note.includes('にじゅうななにち') && day[18].note.includes('じゅうきゅうにち') && day[28].note.includes('にじゅうきゅうにち'), '17／27／19／29 日備註寫另一種讀法');
assert(day[6].kana === 'なのか' && !day[6].note, '7 日只收「なのか」（不收なぬか）');
assert(day[0].note === '日期；「一天」讀いちにち' && day[19].note === '不讀「にじゅうにち」' && day[3].note === '不讀「よんにち」', '1 日（一天＝いちにち）、20 日、4 日備註');
assert(day[7].note === '和 4 日容易混' && day[13].note === '個位 4 讀「よっか」' && day[23].note === '個位 4 讀「よっか」', '8 日、14 日、24 日備註');

// ── 拼音由假名推算 ──
const strip = (r) => r.replace(/[’' ]/g, '');
const romOk = (rows) => rows.filter((r) => strip(r.romaji) !== strip(NQ.romajiOf(r.kana.replace(/ /g, '')))).map((r) => r.show + ' ' + r.romaji + ' ≠ ' + NQ.romajiOf(r.kana));
const badRom = [...romOk(month), ...romOk(day), ...romOk(T.datecombo.rows), ...romOk(T.today.rows)];
assert(badRom.length === 0, '月／日／組合／今日明日 嘅拼音由假名推算全部對得上 ' + badRom);

// ── 日期組合 ──
const combo = T.datecombo.rows;
assert(combo.length === 7, '日期組合 6 行＋何月何日');
const comboBad = combo.filter((r) => {
  const m = /^(\d+)月(\d+)日$/.exec(r.show);
  if (!m) return false;
  return r.kana !== `${MONTH_KANA[m[1] - 1]} ${DAY_KANA[m[2] - 1]}` || r.say !== `${MONTH_KANA[m[1] - 1]}、${DAY_KANA[m[2] - 1]}`;
}).map((r) => r.show);
assert(comboBad.length === 0, '組合讀音＝月＋日；朗讀用「、」分隔 ' + comboBad);
const nan = combo.find((r) => r.show === '何月何日');
assert(nan.kana === 'なんがつ なんにち' && nan.say === 'なんがつ、なんにち' && nan.romaji === 'nangatsu nannichi', '何月何日＝なんがつ なんにち');

// ── 曜日、今日・明日・明後日（用戶指定） ──
const wk = T.weekday.rows.map((r) => `${r.show} ${r.kana} ${r.romaji}`).join('／');
assert(wk === '日曜日 にちようび nichiyoubi／月曜日 げつようび getsuyoubi／火曜日 かようび kayoubi／水曜日 すいようび suiyoubi／木曜日 もくようび mokuyoubi／金曜日 きんようび kin’youbi／土曜日 どようび doyoubi', '曜日 7 行照用戶指定');
const td = T.today.rows.map((r) => `${r.show} ${r.kana} ${r.romaji}`).join('／');
assert(td === '今日 きょう kyou／明日 あした ashita／明後日 あさって asatte', '今日・明日・明後日照用戶指定');
assert(win.App.Content.NUMBER_TOPICS.map((t) => t.key).join() === 'basic,tens,big,yen,hour,minute,people,things,month,day,datecombo,weekday,today', '讀音表 13 組（原有 8 組不變，後加 5 組）');

// ── 出題產生器 ──
const gen = (kind) => {
  const out = [];
  if (kind === 'month') for (let m = 1; m <= 12; m++) out.push(m);
  else if (kind === 'day') for (let d = 1; d <= 31; d++) out.push(d);
  else for (const [m, n] of [[1, 31], [2, 29], [3, 31], [4, 30], [5, 31], [6, 30], [7, 31], [8, 31], [9, 30], [10, 31], [11, 30], [12, 31]]) for (let d = 1; d <= n; d++) out.push({ m, d });
  return out;
};
const readOf = (kind, v) => NQ.readingSegs(kind, v).join('');
assert(gen('month').every((m) => readOf('month', m) === MONTH_KANA[m - 1]) && gen('day').every((d) => readOf('day', d) === DAY_KANA[d - 1]), '產生器讀法同讀音表一致（12 個月、31 日）');
const dates = gen('date');
assert(dates.length === 366 && dates.every((v) => NQ.readingSegs('date', v).join('、') === `${MONTH_KANA[v.m - 1]}、${DAY_KANA[v.d - 1]}`), '366 個日期組合的讀法＝月＋日');
assert(new Set(dates.map((v) => NQ.readingSegs('date', v).join('、'))).size === 366, '366 個日期的讀音都唔同');
assert(!NQ.ok('date', 3, { m: 2, d: 30 }) && !NQ.ok('date', 3, { m: 4, d: 31 }) && !NQ.ok('date', 3, { m: 13, d: 1 }) && NQ.ok('date', 3, { m: 2, d: 29 }), '日期範圍：2月30日、4月31日、13月都不可以');
assert(!NQ.ok('date', 1, { m: 1, d: 1 }) && !NQ.ok('date', 2, { m: 1, d: 1 }), '完整日期只在進階出現');
assert(NQ.ok('day', 1, 10) && !NQ.ok('day', 1, 11) && NQ.ok('day', 2, 31) && !NQ.ok('day', 3, 32) && !NQ.ok('day', 3, 0), '日：入門 1–10、一般／進階 1–31');
assert(NQ.ok('month', 1, 12) && !NQ.ok('month', 1, 13) && !NQ.ok('month', 3, 0), '月：1–12');
assert(NQ.displayOf('month', 4) === '4月' && NQ.displayOf('day', 14) === '14日' && NQ.displayOf('date', { m: 10, d: 5 }) === '10月5日', '寫法：4月、14日、10月5日');

// ── 出題：選項 ──
let qn = 0, optBad = [];
for (const kind of ['month', 'day', 'date']) {
  for (const level of [1, 2, 3]) {
    if (kind === 'date' && level < 3) continue;
    for (let i = 0; i < 600; i++) {
      const v = NQ.sample(kind, level);
      if (!NQ.ok(kind, level, v)) { optBad.push(['sample', kind, level, JSON.stringify(v)]); continue; }
      const q = NQ.makeQuestion(kind, v, level);
      qn++;
      const vs = q.options.map((o) => o.vs);
      const disp = q.options.map((o) => o.display);
      if (q.options.length !== 4 || new Set(vs).size !== 4 || new Set(disp).size !== 4) optBad.push(['options', kind, level, q.display, vs.join('|')]);
      if (!vs.includes(q.vs)) optBad.push(['answer missing', kind, level, q.display]);
      const kanaSet = new Set(q.options.map((o) => {
        const p = o.vs.split(':').map(Number);
        const val = kind === 'date' ? { m: p[0], d: p[1] } : p[0];
        if (!NQ.ok(kind, level, val)) optBad.push(['out of range', kind, level, o.display]);
        return NQ.readingSegs(kind, val).join('、');
      }));
      if (kanaSet.size !== 4) optBad.push(['same reading', kind, level, q.display]);
      if (q.key !== `n:${kind}:${q.vs}`) optBad.push(['key', q.key]);
      if (kind === 'date' && !q.kana.includes('、')) optBad.push(['date kana has no 、', q.kana]);
      if (kind !== 'date' && q.kana.includes('、')) optBad.push(['unexpected 、', q.kana]);
      if (!/^[a-z ]+$/.test(q.romaji)) optBad.push(['romaji', q.romaji]);
    }
  }
}
assert(optBad.length === 0, `月／日／日期 ${qn} 題：4 個選項寫法同讀音都唔同、答案在內、全部在難度範圍內、拼音只含 a–z ` + JSON.stringify(optBad.slice(0, 3)));

// 易混選項：4日出題時，8日（よっか／ようか）要有機會成為選項
let hit8 = 0, hit10 = 0;
for (let i = 0; i < 400; i++) {
  const q = NQ.makeQuestion('day', 4, 2);
  if (q.options.some((o) => o.vs === '8')) hit8++;
  const q2 = NQ.makeQuestion('day', 20, 2);
  if (q2.options.some((o) => o.vs === '10')) hit10++;
}
assert(hit8 > 40 && hit10 > 40, `易混選項：4日常配8日（${hit8}/400）、20日常配10日（${hit10}/400）`);
let swap = 0;
for (let i = 0; i < 600; i++) {
  const q = NQ.makeQuestion('date', { m: 5, d: 10 }, 3);
  if (q.options.some((o) => o.vs === '10:5')) swap++;
}
assert(swap > 60, `日期選項包括「月日對調」（5月10日／10月5日）：${swap}/600`);

// ── 重溫 key ──
let keyBad = [];
for (const v of gen('month')) { const q = NQ.fromKey(`n:month:${v}`); if (!q || q.display !== `${v}月` || q.options.length !== 4) keyBad.push('month' + v); }
for (const v of gen('day')) { const q = NQ.fromKey(`n:day:${v}`); if (!q || q.display !== `${v}日` || q.options.length !== 4) keyBad.push('day' + v); }
for (const v of dates) { const q = NQ.fromKey(`n:date:${v.m}:${v.d}`); if (!q || q.display !== `${v.m}月${v.d}日` || q.options.length !== 4 || q.key !== `n:date:${v.m}:${v.d}`) keyBad.push(`date${v.m}:${v.d}`); }
assert(keyBad.length === 0, '重溫 key 可以重新砌題（12 月、31 日、366 個日期）' + keyBad.slice(0, 3));
const badKeys = ['n:date:2:30', 'n:date:4:31', 'n:date:13:1', 'n:date:10', 'n:date:10:5:1', 'n:day:32', 'n:day:0', 'n:month:13', 'n:month:0', 'n:month:4:1', 'n:date:a:b', 'n:week:1', 'n:date:'];
assert(badKeys.every((k) => NQ.fromKey(k) === null), '壞 key 全部拒絕 ' + badKeys.filter((k) => NQ.fromKey(k) !== null));
assert(NQ.fromKey('n:yen:1800') && NQ.fromKey('n:time:4:30') && NQ.fromKey('n:ban:3') && NQ.fromKey('n:num:14'), '原有 key 照舊可用');

// ── 一輪練習 ──
const kindsOf = (qs) => [...new Set(qs.map((q) => q.kind))].sort().join();
let roundBad = [];
for (const level of [1, 2, 3]) for (const count of [5, 10, 20]) {
  const qs = NQ.buildPractice({ cats: ['date'], level, count });
  const keys = qs.map((q) => q.key);
  if (new Set(keys).size !== keys.length) roundBad.push(['dup', level, count]);
  if (qs.length < Math.min(count, 5)) roundBad.push(['few', level, count, qs.length]);
  if (level < 3 && qs.some((q) => q.kind === 'date')) roundBad.push(['date at level', level]);
  if (level === 1 && qs.some((q) => q.kind === 'day' && Number(q.vs) > 10)) roundBad.push(['day>10 at level 1']);
}
assert(roundBad.length === 0, '日期一輪：不重複、題數夠、入門／一般只有月和日、入門日 ≤ 10 ' + JSON.stringify(roundBad.slice(0, 3)));
let kinds3 = '';
for (let i = 0; i < 20; i++) kinds3 = kindsOf([...(kinds3 ? [{ kind: kinds3 }] : []), ...NQ.buildPractice({ cats: ['date'], level: 3, count: 20 })]);
assert(/date/.test(kinds3) && /day/.test(kinds3) && /month/.test(kinds3), '進階：月、日、日期都會出');
const mix = NQ.buildPractice({ cats: ['yen', 'date'], level: 2, count: 10 });
assert(mix.some((q) => q.kind === 'yen') && mix.some((q) => q.kind === 'month' || q.kind === 'day'), '價錢＋日期：兩類輪流出');
assert(NQ.CATEGORIES.map((c) => c.key).join() === 'yen,time,things,num,date' && NQ.CATEGORIES[4].label === '📅 日期', '類別：原有 4 個＋「📅 日期」');
assert(NQ.KIND_LABEL.month === '月份' && NQ.KIND_LABEL.day === '日' && NQ.KIND_LABEL.date === '日期', '答案卡類別標籤');

console.log(bad ? `== ${bad} failed` : '== all ok');
if (bad) process.exitCode = 1;
