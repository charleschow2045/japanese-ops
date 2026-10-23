// 旅行準備度畫面（stage 10 ⑧）— 進度頁「🧳 旅行準備度」：喺概覽下面、16 項清單、已達標 n / 16 項（唔打總分）、
// 建議先做、「前往 →」打開模組而「← 返回」返回進度頁、四組可收起、深色／320px、純讀取（唔改存檔）。
// 資料／門檻另見 readiness.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(5000);
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { SpeechSynthesis.prototype.speak = function () {}; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const seed = async (fn) => {
    await pg.evaluate((src) => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')) || App.Storage.loadState(); new Function('s', src)(s); localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); }, fn);
    await pg.reload();
  };
  const toProgress = async () => { await pg.getByRole('button', { name: '進度' }).click(); await pg.waitForSelector('.ready-total'); };
  const total = () => pg.locator('.ready-total').innerText();
  const rowOf = (label) => pg.locator('.ready-row').filter({ hasText: label }).first();
  const goOf = (label) => rowOf(label).locator('.ready-go');
  const heading = () => pg.locator('.mod-header h2').innerText();

  // 全新存檔（跟住 reload 令 localStorage 有 state）
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  await seed('s.settings.travelDate = "";');
  await toProgress();

  // ── 位置同結構 ──
  const heads = await pg.locator('#main .h-heading').allInnerTexts();
  const iOv = heads.findIndex((x) => x.includes('概覽')), iRd = heads.findIndex((x) => x.includes('旅行準備度'));
  assert(iOv >= 0 && iRd === iOv + 1, '「旅行準備度」喺「概覽」下面（' + heads.slice(0, 4).join('｜') + '）');
  assert((await total()) === '已達標 0 / 16 項', '全新存檔：已達標 0 / 16 項');
  assert((await pg.locator('.ready-row').count()) === 16 && (await pg.locator('.ready-group').count()) === 4, '16 項、4 組');
  const main = await pg.locator('#main').innerText();
  assert(!/\d+\s*分/.test(await pg.locator('.ready-total').locator('xpath=..').innerText()) && main.includes('不是能力測驗'), '清單式：冇總分；有「不是能力測驗」說明');
  assert((await pg.locator('.ready-group .ready-head').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ')).join('｜').includes('說得出、聽得懂 0 / 6'), '組標題有 0 / 6');
  const nextNote = pg.locator('.note.gold', { hasText: '建議先做' });
  assert((await nextNote.innerText()).includes('建議先做：📌 必學 30 句熟練'), '建議先做：必學 30 句');
  assert((await pg.locator('.ready-row .ready-ico').first().getAttribute('aria-label')) === '未開始', '圖示有 aria-label');
  assert((await rowOf('平假名掌握').innerText()).includes('目標 84') && (await rowOf('平假名掌握').innerText()).includes('/ 104'), '平假名：目標 84 / 104');
  assert((await rowOf('緊急情況句子熟練').innerText()).includes('報警 110、火警及救護車 119'), '緊急情況建議有 110／119');
  assert((await rowOf('旅行日期已設定').innerText()).includes('旅行日期') && !(await pg.locator('#main').innerText()).includes('出發日期'), '用「旅行日期」，唔出現「出發日期」');

  // ── 前往 → 返回（每個模組）──
  const cases = [
    ['必學 30 句熟練', '必學 30 句'],
    ['餐廳句子熟練', '情境句子庫'],
    ['其他 8 個情境句子熟練', '今日任務'],
    ['重點對話玩過', '情境對話'],
    ['平假名掌握', '五十音'],
    ['認得的片假名詞', '看得懂'],
    ['價錢（數字聽力）', '數字・價錢'],
    ['酒店資料已填', '指給店員看'],
    ['7 天內備份過', '進度備份'],
  ];
  for (const [label, title] of cases) {
    await goOf(label).click();
    const txt = await pg.locator('#main').innerText();
    assert(txt.includes(title) && !(await pg.locator('.ready-total').count()), `前往「${label}」→ ${title}`);
    await pg.getByRole('button', { name: /返回/ }).first().click();
    await pg.waitForSelector('.ready-total');
    assert((await total()) === '已達標 0 / 16 項', `「← 返回」回到進度頁（${label}）`);
  }
  // 建議先做嘅「前往」
  await nextNote.locator('.ready-go').click();
  assert((await pg.locator('#main').innerText()).includes('必學 30 句'), '「建議先做」嘅前往：必學 30 句');
  await pg.getByRole('button', { name: /返回/ }).first().click();
  await pg.waitForSelector('.ready-total');

  // ── 設定（旅行日期）：開設定，冇返回掣，轉返進度分頁 ──
  await goOf('旅行日期已設定').click();
  assert((await pg.locator('#main').innerText()).includes('旅行日期'), '旅行日期 → 設定頁');
  await toProgress();

  // ── 收起／展開 ──
  const head0 = pg.locator('.ready-head').first();
  await head0.click();
  assert((await pg.locator('.ready-row').count()) === 10 && (await head0.getAttribute('aria-expanded')) === 'false', '收起第一組：剩 10 項');
  await head0.click();
  assert((await pg.locator('.ready-row').count()) === 16 && (await head0.getAttribute('aria-expanded')) === 'true', '展開：16 項');

  // ── 達標／進行中 ──
  await seed('s.numbers.stats = { yen: { c: 18, w: 2 }, time: { c: 4, w: 4 } }; s.show.saved.hotelName = "Hotel A"; s.settings.travelDate = "2099-12-31"; s.backup = { lastExportAt: new Date().toISOString() };');
  await toProgress();
  assert((await total()) === '已達標 3 / 16 項', '價錢＋備份＋旅行日期達標：已達標 3 / 16 項');
  assert((await rowOf('價錢（數字聽力）').getAttribute('class')).includes('st-done') && (await rowOf('價錢（數字聽力）').locator('.ready-go').count()) === 0, '達標：打剔、冇建議冇前往掣');
  assert((await rowOf('時間（數字聽力）').getAttribute('class')).includes('st-doing') && (await rowOf('時間（數字聽力）').locator('.ready-go').count()) === 1, '進行中：半圓、有前往掣');
  assert((await rowOf('酒店資料已填').innerText()).includes('已填 1 / 3 欄'), '酒店：已填 1 / 3 欄');
  assert((await rowOf('旅行日期已設定').innerText()).includes('還有'), '旅行日期：顯示倒數');
  assert((await pg.locator('.ready-head').first().innerText()).includes('0 / 6') && (await pg.locator('.ready-head').nth(2).innerText()).includes('1 / 3'), '組內達標數');

  // ── 純讀取：打開、收起、前往返回都唔改存檔 ──
  const keep = (s) => JSON.stringify(['numbers', 'kana', 'listen', 'speak', 'review', 'show', 'backup', 'settings', 'dialogue', 'read', 'favs'].map((k) => s[k]));
  const s0 = keep(await st());
  await pg.locator('.ready-head').nth(1).click();
  await pg.locator('.ready-head').nth(1).click();
  await goOf('時間（數字聽力）').click();
  await pg.getByRole('button', { name: /返回/ }).first().click();
  await pg.waitForSelector('.ready-total');
  assert(keep(await st()) === s0, '睇／收起／前往／返回：學習紀錄、設定、備份時間冇變');

  // ── 版面：320px、深色 ──
  for (const [w, scheme] of [[375, 'light'], [320, 'light'], [375, 'dark'], [320, 'dark']]) {
    await pg.emulateMedia({ colorScheme: scheme });
    await pg.setViewportSize({ width: w, height: 700 });
    await pg.waitForTimeout(150);
    const m = await pg.evaluate(() => ({
      h: document.documentElement.scrollWidth > innerWidth,
      small: [...document.querySelectorAll('.ready-head,.ready-go')].filter((e) => e.getBoundingClientRect().height < 44 - 0.5).length,
      over: [...document.querySelectorAll('.ready-row *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length,
    }));
    assert(!m.h && m.small === 0 && m.over === 0, `${w}px ${scheme}：冇橫向捲動、掣 ≥ 44px、冇內容超出（${JSON.stringify(m)}）`);
  }
  // 深色對比（文字 ≥ 4.5）
  const contrast = await pg.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const bgOf = (e) => { while (e) { const x = getComputedStyle(e).backgroundColor; if (x && !/rgba\(0, 0, 0, 0\)/.test(x)) return x; e = e.parentElement; } return 'rgb(255,255,255)'; };
    const bad = [];
    document.querySelectorAll('.ready-total,.ready-head,.ready-label,.ready-row .muted,.ready-row p.xs,.ready-go,.ready-ico').forEach((e) => {
      const a = lum(getComputedStyle(e).color), c = lum(bgOf(e)); const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      if (r < 4.5) bad.push(e.className + ' ' + r.toFixed(2));
    });
    return bad;
  });
  assert(contrast.length === 0, '深色：文字對比 ≥ 4.5 ' + contrast.slice(0, 3));

  // ── 舊存檔（冇 backup／show 欄位）唔爆 ──
  await pg.emulateMedia({ colorScheme: 'light' });
  await pg.setViewportSize({ width: 375, height: 760 });
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); delete s.backup; delete s.show; delete s.numbers; delete s.dialogue; localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); });
  await pg.reload();
  await toProgress();
  assert((await pg.locator('.ready-row').count()) === 16, '舊存檔（缺欄位）：仍然 16 項');

  assert(errs.length === 0, 'errs ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
