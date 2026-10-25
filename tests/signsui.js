// 漢字標示・假朋友詞畫面（stage 10 ⑪）— 看得懂選單新卡、進度行、兩種題型、答案卡（假名、在哪裡看到、
// 準備中「暫停營業」提醒、假朋友「中文讀者容易誤會成」）、聽音選詞朗讀假名、假朋友誤會義選項、
// 答錯進 r: 重溫並喺重溫流程出題、進度頁、備份往返、舊存檔、320px／深色。
// 資料／選項規則另見 signs.js（純 Node）。
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
  const card = () => pg.locator('#main .card', { hasText: '漢字標示・假朋友詞' }).filter({ has: pg.locator('button.btn-ink') }).first();
  const chip = (name) => card().locator('.chip').filter({ hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
  const next = () => pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  const GROUPS = ['出入口・通行', '車站・交通', '洗手間', '營業・商店', '價錢・付款', '餐廳', '禁止・注意', '溫泉', '緊急・生活'];
  const only = async (names) => {
    // all chips on (null = all) → turn everything off except `names`
    const all = [...GROUPS, '⚠️ 假朋友詞'];
    for (const n of all) {
      const active = (await chip(n).getAttribute('aria-pressed')) === 'true';
      if (active !== names.includes(n)) await chip(n).click();
    }
  };
  const data = () => pg.evaluate(() => ({ signs: App.Content.SIGNS, friends: App.Content.FALSE_FRIENDS }));

  // ── 主頁磚、選單卡 ──
  const tile = pg.locator('.tile', { hasText: '看得懂' });
  assert((await tile.innerText()).includes('片假名詞、餐牌、標示'), '主頁磚說明：片假名詞、餐牌、標示');
  await tile.click();
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂', '打開「看得懂」');
  assert((await card().count()) === 1 && (await card().innerText()).includes('準備中'), '選單有「🚏 漢字標示・假朋友詞」卡');
  const chips = await card().locator('.chip').allInnerTexts();
  assert(chips.length === 3 + 9 + 1 + 3 && chips.includes('⚠️ 假朋友詞') && chips.includes('洗手間'), '卡內 chip：3 題型＋9 組＋假朋友＋3 題數 = 16：' + chips.length);
  assert((await card().locator('.chip.active').count()) === 1 + 9 + 1 + 1, '預設：混合、全部範圍、10 題');
  const t = await pg.locator('#main').innerText();
  assert(t.includes('可出題：53 個') && t.includes('🚏 漢字標示：認得 0 / 44・⚠️ 假朋友詞：認得 0 / 9'), '可出題 53 個；進度行 0 / 44、0 / 9');
  assert(t.includes('0 / 120'), '片假名詞進度（0 / 120）仍然喺度');
  assert((await pg.locator('#main .chip.active').filter({ hasText: '兩種混合' }).count()) === 1, '片假名詞卡嘅「兩種混合」冇受影響');

  // ── 準備中：看詞選意思 ──
  await only(['營業・商店']);
  await chip('👀 看詞選意思').click();
  assert((await pg.locator('#main').innerText()).includes('可出題：5 個'), '只揀「營業・商店」：可出題 5 個');
  await chip('5 題').click();
  await card().locator('button.btn-ink').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '標示・假朋友練習', '標題：標示・假朋友練習');
  for (let i = 0; i < 5; i++) {
    const word = await pg.locator('.read-word').innerText();
    assert((await pg.locator('#main .opt').count()) === 4 && (await pg.locator('#main').innerText()).includes('這個標示是什麼意思'), `第 ${i + 1} 題「${word}」：4 個選項、問「這個標示是什麼意思」`);
    assert((await said()).length === 0, `第 ${i + 1} 題：答題前唔播音`);
    const d = await data();
    const it = d.signs.find((x) => x.word === word);
    const opts = await pg.locator('#main .opt').allInnerTexts();
    const idx = opts.findIndex((o) => o.trim() === it.meaning);
    assert(idx >= 0, `「${word}」嘅正確意思「${it.meaning}」喺選項入面`);
    await pg.locator('#main .opt').nth(idx).click();
    const fb = await pg.locator('.feedback').innerText();
    assert(fb.includes('答對') && fb.includes(it.kana) && fb.includes(it.meaning) && fb.includes('常見於：' + it.where), `「${word}」答案卡：假名、意思、常見於`);
    await next();
  }

  // 專門抽準備中：只揀營業・商店，20 題
  await pg.getByRole('button', { name: /返回看得懂/ }).click();
  await chip('20 題').click();
  await card().locator('button.btn-ink').click();
  let junFb = '';
  for (let i = 0; i < 20 && !junFb; i++) {
    const word = await pg.locator('.read-word').innerText();
    await pg.locator('#main .opt').first().click();
    if (word === '準備中') junFb = await pg.locator('.feedback').innerText();
    await next();
  }
  assert(junFb.includes('暫停營業') && junFb.includes('店現在不接客') && junFb.includes('不是「快要開門」') && junFb.includes('じゅんびちゅう'), '準備中：答案卡有「暫停營業」、解釋、提醒、假名');
  await pg.locator('.mod-header .btn-back').click(); // 中途返回選單

  // ── 聽音選詞：朗讀假名 ──
  await only(['車站・交通']);
  await chip('👂 聽音選詞').click();
  await chip('5 題').click();
  await pg.evaluate(() => (window.__said = []));
  await card().locator('button.btn-ink').click();
  const d1 = await data();
  const heard1 = (await said())[0];
  const hit = d1.signs.find((x) => x.kana === heard1);
  assert(!!hit && hit.scene === '車站・交通', '聽音選詞：朗讀嘅係假名（' + heard1 + '）');
  const texts = (await pg.locator('#main .opt').allInnerTexts()).map((x) => x.trim());
  assert(texts.length === 4 && new Set(texts).size === 4 && texts.includes(hit.word), '聽音選詞：4 個寫法、包括答案：' + texts.join('／'));
  await pg.locator('#main .opt', { hasText: new RegExp('^' + hit.word + '$') }).click();
  assert((await pg.locator('.fb-title').innerText()).includes('答對'), '聽音選詞：選對 → 答對了');
  await next();
  await pg.locator('.mod-header .btn-back').click(); // 中途返回選單
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂', '中途返回：回到看得懂選單');

  // ── 假朋友：誤會義固定喺選項 ──
  await only(['⚠️ 假朋友詞']);
  await chip('👀 看詞選意思').click();
  await chip('20 題').click();
  assert((await pg.locator('#main').innerText()).includes('可出題：9 個'), '只揀假朋友詞：可出題 9 個');
  await card().locator('button.btn-ink').click();
  const d2 = await data();
  let trapSeen = 0, wrongTrap = false, trapWord = '', yuka = '';
  for (let i = 0; i < 20; i++) {
    const word = await pg.locator('.read-word').innerText();
    const it = d2.friends.find((x) => x.word === word);
    const opts = (await pg.locator('#main .opt').allInnerTexts()).map((x) => x.trim());
    assert(opts.length === 4 && opts.includes(it.meaning) && opts.includes(it.trapOpt), `假朋友「${word}」：選項包括真意思「${it.meaning}」同誤會義「${it.trapOpt}」`);
    if (opts.includes(it.trapOpt)) trapSeen++;
    assert((await pg.locator('#main').innerText()).includes('這個詞在日文是什麼意思'), `假朋友「${word}」：提示「這個詞在日文是什麼意思」`);
    if (!wrongTrap) {
      // 故意揀誤會義一次：答錯，答案卡講明誤會點樣
      await pg.locator('#main .opt').nth(opts.indexOf(it.trapOpt)).click();
      const fb = await pg.locator('.feedback').innerText();
      assert(fb.includes('答錯') && fb.includes('中文讀者容易誤會成') && fb.includes(it.trap) && fb.includes('日文的意思：' + it.meaning), `揀誤會義：答錯，答案卡有「中文讀者容易誤會成：${it.trap}」`);
      wrongTrap = true;
      trapWord = word;
    } else {
      await pg.locator('#main .opt').nth(opts.indexOf(it.meaning)).click();
      if (word === '床') yuka = await pg.locator('.feedback').innerText();
    }
    await next();
  }
  assert(trapSeen === 20, '20 題全部都有誤會義選項');
  const s1 = await st();
  const rKeys = Object.keys(s1.review.items).filter((k) => k.startsWith('r:'));
  assert(!!s1.read.stats[trapWord] && s1.read.stats[trapWord].w === 1 && !!s1.review.items['r:' + trapWord] && s1.review.items['r:' + trapWord].box === 0, '揀誤會義：統計 w＝1，重溫 r:' + trapWord + ' 喺 box 0');
  if (yuka) assert(yuka.includes('ゆか') && yuka.includes('yuka') && yuka.includes('地板') && yuka.includes('睡床') && yuka.includes('床に置かないでください'), '「床」答案卡：ゆか／yuka／地板／睡床／床に置かないでください');

  // ── 重溫流程 ──
  await pg.getByRole('button', { name: /返回看得懂/ }).click();
  assert((await pg.locator('.review-card').innerText()).includes(`今天需重溫 ${rKeys.length} 項`), `重溫卡：今天需重溫 ${rKeys.length} 項`);
  await pg.locator('#main button', { hasText: '開始重溫' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '看得懂重溫', '重溫標題');
  const rw = await pg.locator('.read-word').count() ? await pg.locator('.read-word').innerText() : '(hear)';
  const opts2 = (await pg.locator('#main .opt').allInnerTexts()).map((x) => x.trim());
  assert(opts2.length === 4, '重溫題目 4 個選項（' + rw + '）');

  // ── 進度頁、備份、舊存檔 ──
  await pg.locator('.tab', { hasText: '進度' }).click();
  const cnt = await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); return [App.Reading.signCounts(s), App.Reading.friendCounts(s)]; });
  assert((await pg.locator('#main').innerText()).includes(`🚏 漢字標示：認得 ${cnt[0].known} / 44・⚠️ 假朋友詞：認得 ${cnt[1].known} / 9`), `進度頁「看得懂」區塊有標示／假朋友行（${cnt[0].known} / 44、${cnt[1].known} / 9）`);
  const rt = await pg.evaluate(() => { const S = App.Storage; const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); const p = S.parseBackup(JSON.stringify(S.buildBackup(s))); return { ok: p.ok, same: p.ok && JSON.stringify(p.state.read.stats) === JSON.stringify(s.read.stats) && JSON.stringify(Object.keys(p.state.review.items)) === JSON.stringify(Object.keys(s.review.items)) }; });
  assert(rt.ok && rt.same, '備份往返：漢字詞統計同重溫保留');
  assert(Object.keys(s1.read).sort().join() === 'menu,prefs,stats', '存檔結構冇新增欄位（read 只有 menu／prefs／stats）');

  // ── 版面：320px、深色 ──
  await pg.locator('.tab', { hasText: '主頁' }).click();
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  for (const [w, scheme] of [[375, 'light'], [320, 'light'], [375, 'dark'], [320, 'dark']]) {
    await pg.emulateMedia({ colorScheme: scheme });
    await pg.setViewportSize({ width: w, height: 700 });
    await pg.waitForTimeout(150);
    const m = await pg.evaluate(() => ({
      h: document.documentElement.scrollWidth > innerWidth,
      small: [...document.querySelectorAll('#main button')].filter((e) => e.getBoundingClientRect().height < 43.5).length,
      over: [...document.querySelectorAll('#main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length,
    }));
    assert(!m.h && m.small === 0 && m.over === 0, `${w}px ${scheme}：看得懂選單冇橫向捲動、掣 ≥ 44px、冇內容超出（${JSON.stringify(m)}）`);
  }
  const contrast = await pg.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const bgOf = (e) => { while (e) { const x = getComputedStyle(e).backgroundColor; if (x && !/rgba\(0, 0, 0, 0\)/.test(x)) return x; e = e.parentElement; } return 'rgb(255,255,255)'; };
    const bad = [];
    document.querySelectorAll('#main *').forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const a = lum(getComputedStyle(e).color), c = lum(bgOf(e)); const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      if (r < 4.5) bad.push(e.className + ' ' + r.toFixed(2));
    });
    return bad;
  });
  assert(contrast.length === 0, '深色：看得懂選單文字對比 ≥ 4.5 ' + contrast.slice(0, 3));
  await pg.emulateMedia({ colorScheme: 'light' });
  await pg.setViewportSize({ width: 375, height: 760 });

  // ── 舊存檔（冇 read.menu／read）──
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); delete s.read; localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); });
  await pg.reload();
  await pg.locator('.tile', { hasText: '看得懂' }).click();
  assert((await card().count()) === 1 && (await pg.locator('#main').innerText()).includes('可出題：53 個'), '舊存檔（冇 read）：選單照常');

  assert(errs.length === 0, 'errs ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
