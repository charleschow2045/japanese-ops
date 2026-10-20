// 數字：日期（stage 10 ⑤）— 畫面：讀音表新 5 組、⚠️ 特別讀法、朗讀餵假名（日期組合月日之間「、」）、
// 數字聽力「📅 日期」類別、答題記錄同錯題重溫 key、備份（新 kind／新 key）、路線第 21／28 天延伸連結。
// 資料與出題邏輯另見 numdate.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { window.__said = []; SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); }; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const said = () => pg.evaluate(() => window.__said);
  const wordRow = (t) => pg.locator('#main .ex-card').filter({ has: pg.locator('.ex-word', { hasText: t }) });

  // ── 讀音表 ──
  await pg.locator('.tile', { hasText: '數字' }).click();
  await pg.getByRole('button', { name: /讀音表/ }).first().click();
  const heads = await pg.locator('#main .h-heading').allInnerTexts();
  assert(heads.join('|') === '基本數字 0–10|11–99|百・千・萬|價錢（円）|時間：點（時）|時間：分|人數|物品數量|日期：月（1–12 月）|日期：日（1–31 日）|日期的說法|曜日（星期）|今日・明日・明後日', '讀音表 13 組（原有 8 組＋日期：月、日期：日、日期的說法、曜日、今日・明日・明後日）');
  assert((await pg.locator('#main .ex-card').count()) === 146, '讀音表共 146 行（原有 86＋新增 60）');
  assert((await pg.locator('#main .ex-card .irr').count()) === 16, '特別讀法標 ⚠️：3 個月＋13 個日');
  assert((await wordRow('4月').locator('.irr').count()) === 1 && (await wordRow('7月').first().innerText()).includes('不讀「なながつ」'), '4 月有 ⚠️；7 月備註「不讀「なながつ」」');
  assert((await wordRow('20日').locator('.irr').count()) === 1 && (await wordRow('11日').locator('.irr').count()) === 0, '20 日有 ⚠️，11 日沒有');
  const clickSay = async (t) => { await pg.evaluate(() => (window.__said = [])); await wordRow(t).first().click(); return (await said()).slice(-1)[0]; };
  assert((await clickSay('1日')) === 'ついたち', '朗讀 1日＝「ついたち」（餵假名，不是いちにち）');
  assert((await clickSay('7日')) === 'なのか' && (await clickSay('20日')) === 'はつか' && (await clickSay('4月')) === 'しがつ', '朗讀 7日／20日／4月 ＝ なのか／はつか／しがつ');
  assert((await clickSay('10月5日')) === 'じゅうがつ、いつか', '朗讀 10月5日＝「じゅうがつ、いつか」（月日之間「、」）');
  assert((await clickSay('何月何日')) === 'なんがつ、なんにち', '朗讀 何月何日＝「なんがつ、なんにち」');
  assert((await clickSay('今日')) === 'きょう' && (await clickSay('明日')) === 'あした' && (await clickSay('明後日')) === 'あさって', '朗讀 今日／明日／明後日 ＝ きょう／あした／あさって');
  assert((await clickSay('金曜日')) === 'きんようび' && (await clickSay('日曜日')) === 'にちようび', '朗讀 金曜日／日曜日 ＝ きんようび／にちようび');
  const seq = pg.locator('#main .btn-soft', { hasText: '連續聽' });
  assert((await seq.count()) === 4, '連續聽：基本數字、月、曜日、今日明日（日期：日沒有）');
  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '讀音表沒有橫向捲動');
  const small = await pg.evaluate(() => [...document.querySelectorAll('#main .ex-card')].filter((e) => e.getBoundingClientRect().height < 44).length);
  assert(small === 0, '讀音表每行 ≥ 44px');

  // ── 數字聽力「📅 日期」 ──
  await pg.locator('#main .btn-back, .mod-header .btn-back').first().click();
  const card = pg.locator('.card:has-text("數字聽力")');
  assert((await card.getByRole('button', { name: '📅 日期' }).count()) === 1 && (await st()).numbers.prefs.cats.includes('date'), '數字聽力有「📅 日期」類別；新存檔預設包括日期');
  for (const lab of ['💴 價錢', '🕐 時間', '🚉 月台・人數・分鐘', '🔢 純數字 0–99']) await card.getByRole('button', { name: lab }).click();
  await card.getByRole('button', { name: '進階' }).click();
  await card.getByRole('button', { name: '5 題' }).click();
  let s = await st();
  assert(s.numbers.prefs.cats.join() === 'date' && s.numbers.prefs.level === 3 && s.numbers.prefs.count === 5, '只選日期、進階、5 題 ' + JSON.stringify(s.numbers.prefs));
  assert((await pg.locator('#main').innerText()).includes('完整的月＋日'), '進階說明提到完整的月＋日');
  await pg.evaluate(() => (window.__said = []));
  await pg.getByRole('button', { name: '🔢 開始數字聽力' }).click();
  let wrong = 0;
  for (let i = 0; i < 5; i++) {
    const n = await pg.locator('.opt').count();
    const heard = (await said()).slice(-1)[0];
    assert(n === 4, `第 ${i + 1} 題 4 個選項`);
    await pg.locator('.opt').first().click();
    if ((await pg.locator('.fb-title').innerText()).includes('答錯')) wrong++;
    const kana = await pg.locator('.feedback .phrase-kana').innerText();
    if (kana !== heard) assert(false, `第 ${i + 1} 題：朗讀＝答案卡假名（${heard} / ${kana}）`);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert(true, '5 題朗讀都同答案卡假名一致');
  s = await st();
  const stat = s.numbers.stats;
  const answered = ['month', 'day', 'date'].reduce((a, k) => a + (stat[k] ? stat[k].c + stat[k].w : 0), 0);
  assert(answered === 5 && !stat.yen && !stat.num, '答題記入 month／day／date（共 5 題）');
  const keys = Object.keys(s.review.items).filter((k) => k.startsWith('n:'));
  assert(keys.length <= wrong && keys.every((k) => /^n:(month|day|date):[0-9:]+$/.test(k)), `答錯的題目進錯題重溫（key n:month|day|date:…）${keys}`);
  const back = await pg.evaluate((ks) => ks.map((k) => !!App.NumberQuiz.fromKey(k)), keys);
  assert(back.every(Boolean), '重溫 key 可以重新砌題');

  // ── 備份 ──
  const bk = await pg.evaluate(() => {
    const S = App.Storage;
    const x = S.loadState();
    const file = JSON.stringify(S.buildBackup(x, new Date().toISOString()));
    const ok = S.parseBackup(file).state;
    const o = JSON.parse(file);
    const d = o.data['japaneseOps:v1'];
    d.review.items['n:week:1'] = { box: 0, due: '2026-10-20' };
    d.review.items['n:date:10:5'] = { box: 1, due: '2026-10-21' };
    d.numbers.stats.week = { c: 1, w: 1 };
    d.numbers.prefs.cats = ['date', 'zzz', 'yen'];
    const t = S.parseBackup(JSON.stringify(o)).state;
    return { rtCats: ok.numbers.prefs.cats.join(), rtStats: Object.keys(ok.numbers.stats).sort().join(), tCats: t.numbers.prefs.cats.join(), tStats: Object.keys(t.numbers.stats).sort().join(), tRev: Object.keys(t.review.items).filter((k) => k.startsWith('n:')) };
  });
  assert(bk.rtCats === 'date' && /date|day|month/.test(bk.rtStats), '備份往返：保留 date 類別和 month／day／date 統計');
  assert(bk.tCats === 'date,yen' && !bk.tStats.includes('week') && !bk.tRev.includes('n:week:1') && bk.tRev.includes('n:date:10:5'), '竄改備份：未知類別／kind／key 被丟棄，n:date:10:5 保留');

  // ── 舊存檔：原有 4 個類別不變（不自動加日期） ──
  await pg.evaluate(() => {
    const x = App.Storage.loadState();
    x.numbers.prefs.cats = ['yen', 'time', 'things', 'num'];
    localStorage.setItem('japaneseOps:v1', JSON.stringify(x));
  });
  await pg.reload();
  assert((await st()).numbers.prefs.cats.join() === 'yen,time,things,num', '舊存檔的類別選擇保持不變（日期要自己剔）');

  // ── 路線：第 21、28 天的延伸連結 ──
  for (const day of [21, 28]) {
    await pg.evaluate((n) => {
      const S = App.Storage, x = S.loadState(), days = { ...x.daily.days };
      delete days[S.todayLocal()];
      const done = Object.fromEntries(Array.from({ length: n - 1 }, (_, i) => [i + 1, '2026-01-01']));
      localStorage.setItem('japaneseOps:v1', JSON.stringify({ ...x, daily: { ...x.daily, days }, path: { mode: 'route', start: 1, doneDays: done, skipDays: {}, promptSeen: true } }));
    }, day);
    await pg.reload();
    await pg.locator('#main button', { hasText: /開始今日任務|繼續：/ }).first().click();
    const link = pg.locator('#main .extra-link', { hasText: '日期（月・日）' });
    assert((await link.count()) === 1, `路線第 ${day} 天有「數字・價錢：讀音表「日期（月・日）」」連結`);
    await link.click();
    assert((await pg.locator('#main').innerText()).includes('讀音表'), `第 ${day} 天連結打開數字・價錢`);
    await pg.locator('.mod-header .btn-back').first().click();
    assert((await pg.locator('#main').innerText()).includes(`🗾 路線第 ${day} / 30 天`), `第 ${day} 天：返回回到每日任務`);
    await pg.locator('#main .btn-back').first().click();
  }

  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
