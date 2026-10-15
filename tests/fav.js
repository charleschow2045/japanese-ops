// 句子庫（stage 10）：⭐ 收藏、搜尋、📌 必學 30 句、進度頁一行、備份帶 favs、舊存檔升級。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { SpeechSynthesis.prototype.speak = function () {}; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const favs = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')).favs);
  const main = () => pg.locator('#main').innerText();

  await pg.locator('.tile', { hasText: '情境句子庫' }).click();
  let t = await main();
  assert(t.includes('必學 30 句') && t.includes('已熟練 0 / 30'), '句子庫首頁有「必學 30 句（已熟練 0 / 30）」卡');
  assert(t.includes('我的收藏'), '句子庫首頁有「我的收藏」卡');

  // 搜尋
  await pg.locator('.search-input').fill('トイレ');
  assert((await pg.locator('.phrase-card').count()) === 2 && (await main()).includes('找到 2 句'), '搜尋「トイレ」找到 2 句（polite-18、dir-19）');
  assert((await pg.locator('.search-input').evaluate((e) => e === document.activeElement)), '輸入時輸入框保持焦點（沒有整頁重畫）');
  await pg.locator('.search-input').fill('とれ');
  assert((await pg.locator('.phrase-card').count()) >= 1, '平假名「とれ」也找到（片假名視為平假名）');
  await pg.locator('.search-input').fill('洗手間');
  assert((await pg.locator('.phrase-card').count()) === 2, '用中文意思搜尋');
  await pg.locator('.search-input').fill('メニュー ください');
  assert((await pg.locator('.phrase-card').count()) === 1, '多個詞要全部符合（只剩 rest-05）');
  await pg.locator('.search-input').fill('zzzqq');
  assert((await main()).includes('找不到符合的句子'), '找不到時顯示提示');
  await pg.locator('.search-input').fill('です');
  assert(/找到 \d+ 句，顯示前 60 句/.test(await main()) && (await pg.locator('.phrase-card').count()) === 60, '結果超過 60 句時只顯示前 60 句');

  // ⭐ 收藏
  await pg.locator('.search-input').fill('トイレ');
  await pg.locator('.fav-btn').first().click();
  assert(JSON.stringify(await favs()) === '["polite-18"]', '按 ☆ 後 state.favs = [polite-18]');
  assert((await pg.locator('.search-input').inputValue()) === 'トイレ' && (await pg.locator('.phrase-card').count()) === 2, '收藏後搜尋字和結果仍在');
  assert((await pg.locator('.fav-btn.on').count()) === 1 && (await pg.locator('.fav-btn.on').getAttribute('aria-pressed')) === 'true', '已收藏的句子顯示 ⭐（aria-pressed）');
  await pg.locator('.search-input').fill('');
  await pg.locator('.tile, button', { hasText: '我的收藏' }).first().click();
  assert((await pg.locator('.phrase-card').count()) === 1, '我的收藏列出 1 句');
  await pg.locator('.fav-btn').first().click();
  assert((await favs()).length === 0 && (await main()).includes('還沒有收藏'), '在收藏列表按 ⭐ 取消收藏，列表變空並顯示提示');

  // 必學
  await pg.locator('.btn-back').click();
  await pg.locator('button', { hasText: '必學 30 句' }).first().click();
  assert((await pg.locator('.phrase-card').count()) === 30 && (await pg.locator('.must-tag').count()) === 30, '必學列表 30 句，每句都有「必學」標籤');
  assert((await pg.locator('.phrase-ja').first().innerText()) === 'すみません。', '必學列表第一句是 polite-01');
  await pg.locator('.btn-back').click();
  await pg.locator('button', { hasText: '餐廳' }).first().click();
  assert((await pg.locator('.must-tag').count()) === 8 && (await pg.locator('.fav-btn').count()) === 43, '餐廳頁：8 句必學標籤、43 顆星');

  // 進度頁
  await pg.locator('.tab').nth(1).click();
  assert((await main()).includes('📌 必學 30 句：熟練 0 / 30'), '進度頁句子庫區有必學一行');

  // 備份與舊存檔
  const r = await pg.evaluate(() => {
    const S = App.Storage;
    let st = S.toggleFav(S.toggleFav(S.loadState(), 'rest-10'), 'emer-12');
    const p = S.parseBackup(JSON.stringify(S.buildBackup(st, new Date().toISOString())));
    const bad = JSON.parse(JSON.stringify(S.buildBackup(st, new Date().toISOString())));
    bad.data['japaneseOps:v1'].favs = 'x';
    const old = JSON.parse(JSON.stringify(st)); delete old.favs; localStorage.setItem('japaneseOps:v1', JSON.stringify(old));
    return { ok: p.ok, favs: p.state.favs, badFavs: S.parseBackup(JSON.stringify(bad)).reason, oldFavs: S.loadState().favs };
  });
  assert(r.ok && JSON.stringify(r.favs) === '["rest-10","emer-12"]', '備份往返保留 favs');
  assert(r.badFavs === 'invalid', 'favs 型別錯的備份被拒絕');
  assert(JSON.stringify(r.oldFavs) === '[]', '沒有 favs 的舊存檔載入為空列表');

  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})();
