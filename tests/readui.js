// 看得懂（stage 10 ⑦ 版本一）— 畫面：主頁磚（可點、重溫數）、選單、看詞選意思、聽音選詞（朗讀＝該詞）、
// 答案卡、結果頁、紀錄同 r: 重溫、重溫流程、進度頁「看得懂」、路線第 14 天延伸連結、舊存檔。
// 資料與出題邏輯另見 read.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  pg.setDefaultTimeout(5000);
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { window.__said = []; SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); }; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const said = () => pg.evaluate(() => window.__said);
  const btn = (name) => pg.locator('#main button', { hasText: name }).first();
  const chipBy = (name) => pg.locator('#main .chip').filter({ hasText: name }).first();
  // click the option whose whole text is `text` (a meaning such as 「酒店」 is contained in 「酒店前台／接待處」)
  const clickOpt = async (text) => {
    const i = (await pg.locator('#main .opt').allInnerTexts()).findIndex((x) => x.trim() === text);
    if (i < 0) throw new Error('option not found: ' + text);
    await pg.locator('#main .opt').nth(i).click();
  };
  const wordOf = (w) => pg.evaluate((x) => App.Content.KATAKANA_EXAMPLES.find((e) => e.word === x), w);

  // ── 主頁磚 ──
  const tile = pg.locator('.tile', { hasText: '看得懂' });
  assert((await tile.evaluate((e) => e.tagName)) === 'BUTTON' && (await tile.evaluate((e) => e.classList.contains('live'))), '主頁「看得懂」磚：可點（唔再係「規劃中」）');
  assert((await tile.innerText()).includes('認讀片假名詞'), '磚說明：認讀片假名詞');
  await tile.click();
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂', '打開「看得懂」');
  let t = await pg.locator('#main').innerText();
  assert(t.includes('0 / 120') && t.includes('未練習 120') && t.includes('可出題的詞：120 個'), '選單：認得 0 / 120、可出題 120 個');
  assert((await pg.locator('#main .chip.active').filter({ hasText: '兩種混合' }).count()) === 1, '預設題型：兩種混合');
  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '選單沒有橫向捲動');

  // ── 看詞選意思（5 題）──
  await chipBy('看詞選意思').click();
  await chipBy(/^5 題$/).click();
  let s = await st();
  assert(s.read.prefs.mode === 'see' && s.read.prefs.count === 5, '選項儲存：看詞選意思、5 題');
  await pg.evaluate(() => (window.__said = []));
  await btn('開始練習').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '片假名詞練習', '標題：片假名詞練習');
  let wrong = 0;
  const askedWords = [];
  for (let i = 0; i < 5; i++) {
    const word = (await pg.locator('.read-word').first().innerText()).trim();
    askedWords.push(word);
    assert((await pg.locator('#main .opt').count()) === 4 && (await pg.locator('#main').innerText()).includes('這個詞是什麼意思'), `第 ${i + 1} 題：顯示片假名「${word}」、4 個意思選項`);
    assert((await said()).length === 0, `第 ${i + 1} 題：答題前唔播音（先靠眼睛認）`);
    const it = await wordOf(word);
    if (i % 2 === 0) { // answer correctly
      await clickOpt(it.meaning);
    } else { // answer wrong
      const w = (await pg.locator('#main .opt').allInnerTexts()).findIndex((x) => x.trim() !== it.meaning);
      await pg.locator('#main .opt').nth(w).click();
      wrong++;
    }
    const fb = await pg.locator('.feedback').innerText();
    assert(fb.includes(it.meaning) && fb.includes(it.romaji) && fb.includes(it.en), `第 ${i + 1} 題答案卡：意思、拼音、英文原字`);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.score').innerText()) === `${5 - wrong} / 5`, '結果頁分數');
  s = await st();
  const keys = Object.keys(s.review.items).filter((k) => k.startsWith('r:'));
  assert(Object.keys(s.read.stats).length === 5 && keys.length === wrong && keys.every((k) => askedWords.includes(k.slice(2))), `記錄 5 個詞；答錯 ${wrong} 個進 r: 重溫`);
  assert(Object.keys(s.listen.stats || {}).length === 0 && Object.keys(s.speak.stats || {}).length === 0, '唔入句子聽力／口語統計');

  // ── 聽音選詞 ──
  await btn('返回看得懂').click();
  await chipBy('聽音選詞').click();
  await pg.evaluate(() => (window.__said = []));
  await btn('開始練習').click();
  for (let i = 0; i < 5; i++) {
    const heard = (await said()).slice(-1)[0];
    const it = await wordOf(heard);
    assert(!!it && (await pg.locator('#main').innerText()).includes('哪一個是剛才聽到的詞') && (await pg.locator('#main .opt').count()) === 4, `第 ${i + 1} 題：朗讀「${heard}」，4 個寫法選項`);
    const texts = (await pg.locator('#main .opt').allInnerTexts()).map((x) => x.trim());
    assert(new Set(texts).size === 4 && texts.includes(heard), `第 ${i + 1} 題：選項寫法唔同、包括答案`);
    await clickOpt(heard);
    assert((await pg.locator('.fb-title').innerText()).includes('答對'), `第 ${i + 1} 題：選對 → 答對了`);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.score').innerText()) === '5 / 5', '聽音選詞 5 / 5');

  // ── 重溫 ──
  await btn('返回看得懂').click();
  const due = (await st()).review.items;
  const dueKeys = Object.keys(due).filter((k) => k.startsWith('r:'));
  assert((await pg.locator('.review-card').innerText()).includes(`今天需重溫 ${dueKeys.length} 個詞`), '重溫卡：今天需重溫 n 個詞');
  assert((await pg.locator('.review-card .btn-ink').isDisabled()) === false, '有待重溫：「開始重溫」可按');
  await chipBy('看詞選意思').click();
  await btn('開始重溫').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂重溫', '標題：看得懂重溫');
  for (let i = 0; i < dueKeys.length; i++) {
    const word = (await pg.locator('.read-word').first().innerText()).trim();
    const it = await wordOf(word);
    await clickOpt(it.meaning);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  s = await st();
  assert(dueKeys.every((k) => s.review.items[k] && s.review.items[k].box === 1), '重溫答對：全部升到 box 1，明天再出現');

  // ── 主頁重溫數、進度頁 ──
  await pg.evaluate(() => { const x = JSON.parse(localStorage.getItem('japaneseOps:v1')); Object.keys(x.review.items).forEach((k) => { x.review.items[k].due = '2000-01-01'; }); localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  assert((await pg.locator('.tile', { hasText: '看得懂' }).innerText()).includes(`今天需重溫 ${dueKeys.length} 個詞`), '主頁「看得懂」磚顯示今天需重溫 n 個詞');
  await pg.locator('.tab-label', { hasText: '進度' }).click();
  const pt = await pg.locator('#main').innerText();
  assert(pt.includes('🪧 看得懂') && pt.includes('認得的片假名詞') && pt.includes(`看得懂 ${dueKeys.length}）`), '進度頁：看得懂區塊同「今天待重溫…看得懂 n」');

  // ── 路線第 14 天延伸連結 ──
  await pg.evaluate(() => {
    const S = App.Storage, x = S.loadState(), days = { ...x.daily.days };
    delete days[S.todayLocal()];
    const done = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [i + 1, '2026-01-01']));
    localStorage.setItem('japaneseOps:v1', JSON.stringify({ ...x, daily: { ...x.daily, days }, path: { mode: 'route', start: 1, doneDays: done, skipDays: {}, promptSeen: true } }));
  });
  await pg.goto(BASE + '/index.html');
  await pg.locator('#main button', { hasText: /開始今日任務|繼續：/ }).first().click();
  const link = pg.locator('#main .extra-link', { hasText: '看得懂：片假名詞' });
  assert((await link.count()) === 1 && (await pg.locator('#main').innerText()).includes('🗾 路線第 14 / 30 天'), '路線第 14 天有「看得懂：片假名詞」延伸連結');
  await link.click();
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂', '連結打開「看得懂」');
  await pg.locator('.mod-header .btn-back').first().click();
  assert((await pg.locator('#main').innerText()).includes('🗾 路線第 14 / 30 天'), '← 返回回到每日任務');

  // ── 舊存檔 ──
  await pg.evaluate(() => { const x = App.Storage.loadState(); delete x.read; localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  assert((await pg.locator('#main').innerText()).includes('0 / 120'), '舊存檔（冇 read）：照常打開，補預設值');

  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
