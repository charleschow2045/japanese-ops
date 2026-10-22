// 看得懂（stage 10 ⑦ 版本一＋二）— 畫面：主頁磚（可點、重溫數）、選單、看詞選意思、聽音選詞（朗讀＝該詞）、
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
    assert((await pg.locator('#main .opt').count()) === 4 && (await pg.locator('#main').innerText()).includes('這項是什麼意思'), `第 ${i + 1} 題：顯示片假名「${word}」、4 個意思選項`);
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
  assert(Object.keys(s.read.stats).length === 5 && keys.length === wrong && keys.every((k) => askedWords.includes(k.slice(2))), `記錄 5 項；答錯 ${wrong} 個進 r: 重溫`);
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
  assert((await pg.locator('.review-card').innerText()).includes(`今天需重溫 ${dueKeys.length} 項`), '重溫卡：今天需重溫 n 項');
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
  assert((await pg.locator('.tile', { hasText: '看得懂' }).innerText()).includes(`今天需重溫 ${dueKeys.length} 項`), '主頁「看得懂」磚顯示今天需重溫 n 項');
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

  // ── 模擬餐牌（版本二）──
  // answer the current menu question: right (or deliberately wrong) — works out the answer from App.Content.MENUS
  const answerMenu = (right) => pg.evaluate((wantRight) => {
    const MENUS = App.Content.MENUS;
    const prompt = document.querySelector('.card.accent.center').innerText;
    const names = [...document.querySelectorAll('.menu-line .menu-name')].map((n) => n.textContent);
    const menu = MENUS.find((m) => m.lines.every((l, k) => l.ja === names[k]));
    const ps = menu.lines.map((l) => l.price);
    const price = prompt.includes('多少錢');
    const type = price ? 'price' : prompt.includes('最貴') ? 'max' : prompt.includes('最便宜') ? 'min' : 'find';
    const line = type === 'max' ? ps.indexOf(Math.max(...ps)) : type === 'min' ? ps.indexOf(Math.min(...ps)) : menu.lines.findIndex((l) => prompt.includes('「' + l.yue + '」'));
    if (price) {
      const opts = [...document.querySelectorAll('.opt-grid .opt')];
      const idx = opts.findIndex((o) => o.textContent.trim() === menu.lines[line].price.toLocaleString('en-US') + '円');
      opts[wantRight ? idx : idx === 0 ? 1 : 0].click();
    } else document.querySelectorAll('button.menu-line')[wantRight ? line : (line + 1) % 5].click();
    return { type, menu: menu.id, line, tappable: !price, rows: names.length };
  }, right);

  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  const mcard = pg.locator('#main .card', { hasText: '看餐牌練習' }).last();
  assert((await mcard.locator('.chip').count()) === 6 + 3 && (await mcard.innerText()).includes('6 張餐牌・共 30 行'), '看餐牌練習卡：6 張餐牌 chip＋題數；共 30 行');
  assert((await pg.locator('#main').innerText()).includes('🍜 餐牌：認得'), '選單顯示「餐牌：認得 x / 30 行」');
  for (const lab of ['迴轉壽司', '定食屋', '居酒屋', '咖啡店', '烏冬・蕎麥麵店']) await pg.locator('#main .card', { hasText: '看餐牌練習' }).last().locator('.chip', { hasText: lab }).click();
  await pg.locator('#main .card', { hasText: '看餐牌練習' }).last().locator('.chip', { hasText: /^5 題$/ }).click();
  s = await st();
  assert(s.read.menu.prefs.menus.join() === 'ramen' && s.read.menu.prefs.count === 5, '選項儲存：只揀拉麵店、5 題 ' + JSON.stringify(s.read.menu.prefs));
  await btn('開始餐牌練習').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '餐牌練習', '標題：餐牌練習');
  const seenTypes = new Set();
  for (let i = 0; i < 5; i++) {
    assert((await pg.locator('.menu-board .menu-line').count()) === 5, `第 ${i + 1} 題：餐牌 5 行`);
    assert(!(await pg.locator('.menu-board').innerText()).includes('しょうゆ'), `第 ${i + 1} 題：答題前唔顯示讀音`);
    const r = await answerMenu(true);
    seenTypes.add(r.type);
    assert((await pg.locator('.fb-title').innerText()).includes('答對'), `第 ${i + 1} 題（${r.type}）：答對`);
    assert((await pg.locator('.menu-board .menu-read').count()) >= 10 && (await pg.locator('.menu-board').innerText()).includes('しょうゆラーメン'), `第 ${i + 1} 題：答完每行顯示讀音同中文`);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.score').innerText()) === '5 / 5', '餐牌 5 / 5');
  s = await st();
  assert(Object.keys(s.read.menu.stats).every((k) => k.startsWith('ramen:')) && Object.values(s.read.menu.stats).reduce((a, x) => a + x.c, 0) === 5, '記錄在 read.menu.stats（ramen:行），唔入片假名詞 stats');
  // wrong answers → m: review keys
  await btn('返回看得懂').click();
  const beforeKeys = Object.keys((await st()).review.items).filter((k) => k.startsWith('m:')).length;
  await btn('開始餐牌練習').click();
  const wrongOnes = [];
  for (let i = 0; i < 5; i++) {
    const r = await answerMenu(false);
    wrongOnes.push(`m:${r.menu}:${r.line}`);
    assert((await pg.locator('.fb-title').innerText()).includes('答錯'), `故意答錯第 ${i + 1} 題（${r.type}）`);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  s = await st();
  const mKeys = Object.keys(s.review.items).filter((k) => k.startsWith('m:'));
  assert(mKeys.length > beforeKeys && wrongOnes.every((k) => mKeys.includes(k)) && mKeys.every((k) => /^m:ramen:[0-4]$/.test(k)), '答錯 → 進重溫 m:ramen:行 ' + mKeys);
  // keep only the m: items so the 10-question 重溫 covers all of them
  await pg.evaluate(() => { const x = JSON.parse(localStorage.getItem('japaneseOps:v1')); Object.keys(x.review.items).forEach((k) => { if (!k.startsWith('m:')) delete x.review.items[k]; }); localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  const dueM = mKeys.length;
  assert((await pg.locator('.review-card').innerText()).includes('項'), '重溫卡計入餐牌題');
  await btn('開始重溫').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂重溫', '重溫（含餐牌題）');
  let rv = 0;
  while ((await pg.locator('.menu-board, .read-word, .hear-btn').count()) > 0 && rv < 12) {
    if ((await pg.locator('.menu-board').count()) > 0) await answerMenu(true);
    else {
      const prompt = await pg.locator('.card.accent.center').innerText();
      const isSee = prompt.includes('什麼意思');
      const word = isSee ? (await pg.locator('.read-word').first().innerText()).trim() : (await said()).slice(-1)[0];
      const it = await wordOf(word);
      await clickOpt(isSee ? it.meaning : it.word);
    }
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
    rv++;
  }
  s = await st();
  assert(rv === dueM && mKeys.every((k) => s.review.items[k] && s.review.items[k].box === 1), '重溫答對：餐牌項目升到 box 1（每次最多 10 題）');

  // 舊存檔（冇 read.menu）
  await pg.evaluate(() => { const x = App.Storage.loadState(); delete x.read.menu; localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  assert((await pg.locator('#main').innerText()).includes('看餐牌練習') && (await pg.locator('#main').innerText()).includes('6 張餐牌・共 30 行'), '舊存檔（冇 read.menu）：餐牌卡照常，補預設全部餐牌');

  // ── 舊存檔 ──
  await pg.evaluate(() => { const x = App.Storage.loadState(); delete x.read; localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  assert((await pg.locator('#main').innerText()).includes('0 / 120'), '舊存檔（冇 read）：照常打開，補預設值');

  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
