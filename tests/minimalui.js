// 近音詞分辨畫面（stage 10 ⑫）— 五十音選單新卡、對照卡（19 對）、練習設定（類別、題數，只喺 App 開著時記住）、
// 二選一題目（朗讀假名、答案卡並排兩個詞）、答錯進 q: 重溫並喺「聽力 錯題重溫」出題、進度頁「近音詞：掌握 x / 19 對」、
// 促音・長音頁嘅「練習」掣、路線第 7 天延伸連結、備份往返、舊存檔、320px／深色。
// 資料／出題邏輯另見 minimal.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  pg.setDefaultTimeout(6000);
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { window.__said = []; SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); }; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const said = () => pg.evaluate(() => window.__said);
  const main = () => pg.locator('#main').innerText();
  const chip = (name) => pg.locator('#main .chip').filter({ hasText: new RegExp('^' + name + '$') }).first();
  const next = () => pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  const toKana = async () => { await pg.locator('.tab', { hasText: '主頁' }).click(); await pg.locator('.tile', { hasText: '五十音' }).click(); };
  const toMinimal = async () => { await toKana(); await pg.locator('#main button', { hasText: '近音詞分辨' }).click(); await pg.waitForSelector('.pair-card'); };
  const pairs = () => pg.evaluate(() => App.Content.MINIMAL_PAIRS);

  // ── 入口 ──
  await toKana();
  const card = pg.locator('#main button', { hasText: '近音詞分辨' });
  assert((await card.count()) === 1 && (await card.innerText()).includes('聽一個詞，從兩個近音詞中選出聽到的'), '五十音選單有「🎧 近音詞分辨」卡');
  await card.click();
  assert((await pg.locator('.mod-header h2').innerText()) === '近音詞分辨', '打開近音詞分辨');
  let t = await main();
  assert(t.includes('0 / 19') && t.includes('未練習 19'), '掌握 0 / 19、未練習 19');
  assert((await pg.locator('#main .chip.active').allInnerTexts()).join() === ['長音', '促音', '清濁', '10 題'].join(), '預設：三類都揀、10 題');
  assert((await pg.locator('.pair-card').count()) === 19, '對照卡：19 對');
  assert(t.includes('19 對詞（這張卡的選擇只在 App 開啟期間記住）'), '提示：19 對詞、選擇只喺開啟期間記住');
  // 對照卡：撳詞朗讀假名
  await pg.evaluate(() => (window.__said = []));
  await pg.locator('.pair-card').first().locator('.word-btn').nth(1).click();
  assert((await said()).join() === 'おばあさん', '對照卡：撳「おばあさん」朗讀假名');

  // ── 練習：只揀清濁、5 題 ──
  await chip('長音').click();
  await chip('促音').click();
  assert((await main()).includes('5 對詞'), '只揀清濁：5 對詞');
  await chip('5 題').click();
  await pg.evaluate(() => (window.__said = []));
  await pg.locator('#main button', { hasText: '開始分辨' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '近音詞練習', '標題：近音詞練習');
  const P = await pairs();
  let wrongId = null;
  for (let i = 0; i < 5; i++) {
    const spoken = (await said())[(await said()).length - 1];
    assert((await pg.locator('#main .pair-opt').count()) === 2 && (await main()).includes('聽聽看是哪一個詞'), `第 ${i + 1} 題：2 個選項`);
    const words = await pg.locator('#main .pair-opt .pair-word').allInnerTexts();
    const pair = P.find((p) => p.cat === 'voice' && p.words.some((w) => w.word === spoken));
    assert(!!pair && words.slice().sort().join() === pair.words.map((w) => w.word).sort().join(), `第 ${i + 1} 題：朗讀「${spoken}」，選項正好係「${pair && pair.words.map((w) => w.word).join('／')}」`);
    const meaning = await pg.locator('#main .pair-opt').first().locator('.pair-mean').innerText();
    assert(meaning.length > 0, `第 ${i + 1} 題：選項有中文意思`);
    const idx = words.indexOf(spoken);
    if (i === 1) {
      await pg.locator('#main .pair-opt').nth(1 - idx).click(); // 故意答錯
      wrongId = pair.id;
      const fb = await pg.locator('.feedback').innerText();
      assert(fb.includes('答錯') && fb.includes('聽到的是') && fb.includes('聽到的') && fb.includes('濁音發音時喉嚨會震動'), '答錯：答案卡有「聽到的是」、標示聽到嗰個、分辨重點');
      assert((await pg.locator('.feedback .pair-fb').count()) === 2 && (await pg.locator('.feedback .pair-fb.heard').count()) === 1, '答案卡：兩個詞並排，聽到嗰個標示');
    } else {
      await pg.locator('#main .pair-opt').nth(idx).click();
      assert((await pg.locator('.fb-title').innerText()).includes('答對'), `第 ${i + 1} 題：答對`);
    }
    await next();
  }
  assert((await pg.locator('.score').innerText()) === '4 / 5', '結果 4 / 5');
  let s = await st();
  assert(Object.keys(s.pairs.stats).length >= 1 && s.pairs.stats[wrongId].w === 1 && !!s.review.items['q:' + wrongId] && s.review.items['q:' + wrongId].box === 0, '答錯進統計同 q:' + wrongId + ' 重溫');
  assert(Object.values(s.daily.activity).reduce((n, x) => n + x.a, 0) === 5, '5 題計入今日活動');
  assert(JSON.stringify(Object.keys(s.pairs)) === '["stats"]' && !JSON.stringify(s.kana.prefs).includes('minimal'), '存檔只有 pairs.stats，練習設定冇存檔');
  assert((await pg.locator('#main button', { hasText: '返回近音詞分辨' }).count()) === 1, '結果頁：返回近音詞分辨');
  await pg.locator('#main button', { hasText: '返回近音詞分辨' }).click();
  assert((await pg.locator('#main .chip.active').allInnerTexts()).join() === ['清濁', '5 題'].join(), '返回後：今次揀咗嘅類別／題數仍然記住');
  await pg.reload();
  await toMinimal();
  assert((await pg.locator('#main .chip.active').allInnerTexts()).join() === ['長音', '促音', '清濁', '10 題'].join(), '重新載入後：設定回復預設（唔存檔）');

  // ── 聽力 錯題重溫 ──
  await pg.locator('.tab', { hasText: '主頁' }).click();
  assert((await pg.locator('.tile', { hasText: '聽力' }).innerText()).includes('今天需重溫 1 句'), '主頁聽力磚：今天需重溫 1 句');
  await pg.locator('.tile', { hasText: '聽力' }).click();
  assert((await pg.locator('.review-card').innerText()).includes('近音詞 1'), '聽力重溫卡：近音詞 1');
  await pg.evaluate(() => (window.__said = []));
  await pg.locator('#main button', { hasText: '開始重溫' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '錯題重溫' && (await main()).includes('聽聽看是哪一個詞？（近音詞）') && (await pg.locator('#main .pair-opt').count()) === 2, '重溫：近音詞題、2 個選項');
  const sp = (await said())[0];
  const ws = await pg.locator('#main .pair-opt .pair-word').allInnerTexts();
  assert(ws.includes(sp), '重溫：朗讀嘅詞喺選項入面（' + sp + '）');
  await pg.locator('#main .pair-opt').nth(ws.indexOf(sp)).click();
  assert((await pg.locator('.fb-title').innerText()).includes('答對') && (await pg.locator('.feedback .pair-fb').count()) === 2, '重溫答對：答案卡兩個詞');
  await next();
  s = await st();
  assert(s.review.items['q:' + wrongId].box === 1, '重溫答對：升 box 1');
  assert((await pg.locator('.score').innerText()) === '1 / 1', '重溫結果 1 / 1');

  // ── 進度頁、掌握 ──
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); s.pairs.stats.l1 = { c: 3, w: 0, last: null }; s.pairs.stats.l2 = { c: 2, w: 0, last: null }; localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); });
  await pg.reload();
  await pg.locator('.tab', { hasText: '進度' }).click();
  t = await main();
  assert(t.includes('👂 近音詞：掌握 1 / 19 對'), '進度頁五十音區：近音詞：掌握 1 / 19 對');
  await toMinimal();
  const learning = Object.keys((await st()).pairs.stats).filter((k) => k !== 'l1').length;
  assert((await main()).includes('1 / 19') && (await main()).includes('學習中 ' + learning) && (await main()).includes('未練習 ' + (18 - learning)), `近音詞頁：1 / 19、學習中 ${learning}、未練習 ${18 - learning}`);

  // ── 促音・長音頁嘅練習掣 ──
  await toKana();
  await pg.locator('#main button', { hasText: '促音・長音' }).click();
  const pb = pg.locator('#main button', { hasText: '練習分辨近音詞' });
  assert((await pb.count()) === 1, '促音・長音頁有「🎧 練習分辨近音詞 →」');
  await pb.click();
  assert((await pg.locator('.mod-header h2').innerText()) === '近音詞分辨', '撳咗去近音詞分辨');

  // ── 路線第 7 天延伸連結 ──
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); s.path = { ...s.path, mode: 'route', start: 7, promptSeen: true }; s.daily.days = {}; localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); });
  await pg.reload();
  await pg.getByRole('button', { name: /開始今日任務|繼續：/ }).first().click();
  const link = pg.locator('#main .extra-link', { hasText: '近音詞分辨' });
  assert((await link.count()) === 1 && (await pg.locator('#main').innerText()).includes('第 7 / 30 天'), '路線第 7 天：今日延伸有「近音詞分辨」連結');
  await link.click();
  assert((await pg.locator('.mod-header h2').innerText()) === '近音詞分辨', '連結打開近音詞分辨');
  await pg.locator('.mod-header .btn-back').click();
  assert((await pg.locator('#main .extra-link').count()) >= 3, '「← 返回」回到每日任務');

  // ── 備份、舊存檔 ──
  const rt = await pg.evaluate(() => { const S = App.Storage; const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); const p = S.parseBackup(JSON.stringify(S.buildBackup(s))); const o = JSON.parse(JSON.stringify(S.buildBackup(s))); delete o.data['japaneseOps:v1'].pairs; const old = S.parseBackup(JSON.stringify(o)); return { same: p.ok && JSON.stringify(p.state.pairs) === JSON.stringify(s.pairs), oldOk: old.ok && JSON.stringify(old.state.pairs) === '{"stats":{}}' }; });
  assert(rt.same && rt.oldOk, '備份往返：近音詞統計保留；舊備份補預設');
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); delete s.pairs; localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); });
  await pg.reload();
  await toMinimal();
  assert((await main()).includes('0 / 19'), '舊存檔（冇 pairs）：照常打開，0 / 19');

  // ── 版面：320px、深色（選單、題目、答案卡）──
  await pg.locator('#main button', { hasText: '開始分辨' }).click();
  await pg.locator('#main .pair-opt').first().click();
  const check = async (label) => {
    for (const [w, scheme] of [[375, 'light'], [320, 'light'], [375, 'dark'], [320, 'dark']]) {
      await pg.emulateMedia({ colorScheme: scheme });
      await pg.setViewportSize({ width: w, height: 700 });
      await pg.waitForTimeout(120);
      const m = await pg.evaluate(() => ({
        h: document.documentElement.scrollWidth > innerWidth,
        small: [...document.querySelectorAll('#main button')].filter((e) => e.getBoundingClientRect().height < 43.5).length,
        over: [...document.querySelectorAll('#main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length,
      }));
      assert(!m.h && m.small === 0 && m.over === 0, `${label} ${w}px ${scheme}：冇橫向捲動、掣 ≥ 44px、冇內容超出（${JSON.stringify(m)}）`);
    }
    const bad = await pg.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const bgOf = (e) => { while (e) { const x = getComputedStyle(e).backgroundColor; if (x && !/rgba\(0, 0, 0, 0\)/.test(x)) return x; e = e.parentElement; } return 'rgb(255,255,255)'; };
      const out = [];
      document.querySelectorAll('#main *').forEach((e) => {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const a = lum(getComputedStyle(e).color), c = lum(bgOf(e)); const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
        if (r < 4.5) out.push(e.className + ' ' + r.toFixed(2));
      });
      return out;
    });
    assert(bad.length === 0, `${label}（深色 320px）：文字對比 ≥ 4.5 ${bad.slice(0, 3)}`);
  };
  await check('題目答案卡');
  await pg.emulateMedia({ colorScheme: 'light' });
  await pg.setViewportSize({ width: 375, height: 760 });

  assert(errs.length === 0, 'errs ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
