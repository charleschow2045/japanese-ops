// 我的卡片畫面（stage 10 ⑨）— 指給店員看列表最上面嘅「✏️ 我的卡片」：空狀態、新增（表單、必填、儲存）、
// 列表、全螢幕（大字配合、🔊 讀假名／冇假名讀原文、中文／讀音 chip、English chip 隱藏）、編輯、取消、
// 刪除前確認、20 張上限、上一張／下一張只喺我的卡片組內、備份往返、舊存檔、320px／深色。
// 資料／清理另見 customcard.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(5000);
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { window.__said = []; SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); }; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const main = () => pg.locator('#main').innerText();
  const btn = (name) => pg.locator('#main button').filter({ hasText: name }).first();
  const rows = () => pg.locator('.show-custom-row');
  const fillForm = async (ja, kana, note) => {
    const f = pg.locator('.show-input');
    if (ja !== undefined) await f.nth(0).fill(ja);
    if (kana !== undefined) await f.nth(1).fill(kana);
    if (note !== undefined) await f.nth(2).fill(note);
  };
  const save = () => pg.locator('#main button', { hasText: /^儲存$/ }).click();

  await pg.locator('.tile', { hasText: '指給店員看' }).click();
  await pg.waitForSelector('.mod-header');

  // ── 空狀態同位置 ──
  const heads = await pg.locator('#main .h-heading').allInnerTexts();
  assert(heads[0].includes('我的卡片') && heads[1].includes('我的酒店資料') && heads[2].includes('通用'), '「我的卡片」喺列表最上面（酒店資料之前）：' + heads.slice(0, 3).join('｜'));
  assert((await pg.locator('#main .chip').first().innerText()).includes('我的卡片'), '組別捷徑 chip：我的卡片排第一');
  assert((await main()).includes('還沒有卡片') && (await rows().count()) === 0 && (await btn('＋ 新增卡片').count()) === 1, '空狀態：說明文字、新增掣');
  assert((await pg.locator('.show-row').count()) === 35, '原有 35 張卡行數唔變（冇自訂卡）');

  // ── 新增：必填 ──
  await btn('＋ 新增卡片').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '新增卡片' && (await pg.locator('.show-input').count()) === 3, '新增表單：標題、三個輸入框');
  assert((await main()).includes('不會檢查日文是否正確'), '表單有「不會檢查日文」提示');
  assert((await pg.locator('.show-input').nth(0).getAttribute('maxlength')) === '200' && (await pg.locator('.show-input').nth(1).getAttribute('maxlength')) === '200' && (await pg.locator('.show-input').nth(2).getAttribute('maxlength')) === '100', '輸入框 maxlength 200／200／100');
  assert((await pg.locator('.show-input').nth(0).evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) >= 16, '輸入框字體 ≥ 16px（iOS 唔放大）');
  await save();
  assert((await pg.locator('[role=alert]').innerText()).includes('請輸入日文內容') && (await st()).show.custom.length === 0, '日文空白：提示、冇儲存');
  await fillForm(undefined, 'まど', '備註');
  await save();
  assert((await st()).show.custom.length === 0 && (await pg.locator('[role=alert]').count()) === 1, '只填假名同備註：仍然唔儲存');
  assert((await pg.locator('.show-input').nth(1).inputValue()) === 'まど', '出錯後已輸入嘅字仍然喺度');

  // ── 新增：儲存 ──
  await fillForm('窓側の席をお願いします。', 'まどがわのせきをおねがいします', '麻煩給我靠窗的座位');
  await save();
  let s = await st();
  assert(s.show.custom.length === 1 && s.show.custom[0].id === 'c-1' && s.show.custom[0].kana === 'まどがわのせきをおねがいします' && s.show.custom[0].note === '麻煩給我靠窗的座位', '儲存：c-1 三個欄位');
  assert((await rows().count()) === 1 && (await rows().first().innerText()).includes('窓側の席をお願いします。') && (await rows().first().innerText()).includes('麻煩給我靠窗的座位'), '列表出現新卡（日文＋備註）');
  assert((await pg.locator('.show-edit').count()) === 1, '每張卡有「編輯」掣');
  // 第二張：冇假名冇備註
  await btn('＋ 新增卡片').click();
  await fillForm('アレルギーがあります。');
  await save();
  s = await st();
  assert(s.show.custom.length === 2 && s.show.custom[1].id === 'c-2' && s.show.custom[1].kana === '' && s.show.custom[1].note === '', '第二張：假名同備註選填');

  // ── 全螢幕 ──
  await rows().first().locator('.show-row').click();
  await pg.waitForSelector('.show-viewer');
  assert((await pg.locator('.show-text').innerText()).includes('窓側の席をお願いします。'), '全螢幕：顯示日文');
  assert((await pg.locator('.show-count').innerText()).includes('我的卡片') && (await pg.locator('.show-count').innerText()).includes('1 / 2'), '全螢幕：標題「我的卡片 1 / 2」');
  assert((await pg.locator('.show-yue').innerText()) === '麻煩給我靠窗的座位', '全螢幕：中文備註喺底部（預設開）');
  const chips = await pg.locator('.show-viewer .chip').allInnerTexts();
  assert(chips.join() === '中文,讀音', '有假名嘅卡：只有「中文」「讀音」chip（冇 English）：' + chips.join());
  await pg.evaluate(() => (window.__said = []));
  await pg.locator('.show-say').click();
  assert((await pg.evaluate(() => window.__said)).join() === 'まどがわのせきをおねがいします', '🔊：有假名就讀假名');
  await pg.locator('.show-viewer .chip', { hasText: '讀音' }).click();
  assert((await pg.locator('.show-reading').innerText()).includes('まどがわのせきをおねがいします') && (await pg.locator('.show-rom').count()) === 0, '讀音 chip：顯示假名、冇拼音');
  await pg.locator('.show-viewer .chip', { hasText: '讀音' }).click();
  // 下一張（冇假名）
  await pg.locator('.show-arrow[aria-label="下一張"]').click();
  assert((await pg.locator('.show-count').innerText()).includes('2 / 2'), '下一張：2 / 2（只喺我的卡片入面切換）');
  assert((await pg.locator('.show-viewer .chip').allInnerTexts()).join() === '中文' && (await pg.locator('.show-yue').count()) === 0, '冇假名冇備註：只有「中文」chip、冇小字');
  await pg.evaluate(() => (window.__said = []));
  await pg.locator('.show-say').click();
  assert((await pg.evaluate(() => window.__said)).join() === 'アレルギーがあります。', '🔊：冇假名就讀原文');
  await pg.locator('.show-arrow[aria-label="下一張"]').click();
  assert((await pg.locator('.show-count').innerText()).includes('1 / 2'), '下一張：循環返 1 / 2');
  await pg.locator('.show-viewer button', { hasText: '關閉' }).click();
  assert((await pg.locator('.show-viewer').count()) === 0, '關閉');

  // ── 200 字配合畫面 ──
  await btn('＋ 新增卡片').click();
  await fillForm('あ'.repeat(200));
  await save();
  await rows().nth(2).locator('.show-row').click();
  await pg.waitForSelector('.show-viewer');
  await pg.waitForTimeout(300);
  const fits = async () => pg.evaluate(() => { const el = document.querySelector('.show-text'); const stage = el.parentElement; return el.scrollHeight <= stage.clientHeight && el.scrollWidth <= stage.clientWidth; });
  assert(await fits(), '200 字：375px 全螢幕放得下');
  await pg.setViewportSize({ width: 320, height: 600 });
  await pg.waitForTimeout(300);
  assert(await fits(), '200 字：320×600 放得下');
  await pg.setViewportSize({ width: 375, height: 760 });
  await pg.locator('.show-viewer button', { hasText: '關閉' }).click();

  // ── 編輯、取消 ──
  await pg.locator('.show-edit').first().click();
  assert((await pg.locator('.mod-header h2').innerText()) === '編輯卡片' && (await pg.locator('.show-input').nth(0).inputValue()) === '窓側の席をお願いします。' && (await pg.locator('.show-input').nth(2).inputValue()) === '麻煩給我靠窗的座位', '編輯：載入原有內容');
  assert((await btn('刪除這張卡片').count()) === 1, '編輯表單有刪除掣');
  await fillForm(undefined, '', '備註改咗');
  await save();
  s = await st();
  assert(s.show.custom.length === 3 && s.show.custom[0].kana === '' && s.show.custom[0].note === '備註改咗' && s.show.custom[0].ja === '窓側の席をお願いします。', '編輯：假名可以清空、備註更新、卡片數目不變');
  await pg.locator('.show-edit').nth(1).click();
  await fillForm('唔應該儲存');
  await pg.locator('#main button', { hasText: /^取消$/ }).click();
  assert((await st()).show.custom[1].ja === 'アレルギーがあります。' && (await rows().count()) === 3, '取消：唔儲存');
  await pg.locator('.show-edit').nth(1).click();
  await pg.locator('.mod-header .btn-back').click();
  assert((await rows().count()) === 3 && (await pg.locator('.mod-header h2').innerText()) === '指給店員看', '表單嘅「← 返回」：回到列表（唔離開模組）');

  // ── 刪除前確認 ──
  await pg.locator('.show-edit').nth(1).click();
  await btn('刪除這張卡片').click();
  assert((await main()).includes('確定要刪除這張卡片嗎') && (await st()).show.custom.length === 3, '刪除：先要確認，未刪');
  await pg.locator('#main button', { hasText: /^不刪除$/ }).click();
  assert((await st()).show.custom.length === 3 && (await pg.locator('.show-input').count()) === 3, '「不刪除」：卡片仲喺度，仍然喺表單');
  await btn('刪除這張卡片').click();
  await pg.locator('#main button', { hasText: /^確定刪除$/ }).click();
  s = await st();
  assert(s.show.custom.length === 2 && s.show.custom.map((c) => c.id).join() === 'c-1,c-3' && (await rows().count()) === 2, '確定刪除：只刪嗰張（剩 c-1、c-3）');

  // ── 20 張上限 ──
  while ((await st()).show.custom.length < 20) {
    await btn('＋ 新增卡片').click();
    await fillForm('テスト' + (await st()).show.custom.length);
    await save();
  }
  assert((await rows().count()) === 20 && (await btn('＋ 新增卡片').count()) === 0 && (await main()).includes('已達上限 20 張'), '20 張：冇新增掣、顯示上限提示');
  await pg.locator('.show-edit').nth(4).click();
  assert((await pg.locator('.show-input').count()) === 3, '滿咗仍然可以編輯');
  await pg.locator('#main button', { hasText: /^取消$/ }).click();

  // ── 離開、再入：卡片仍然喺度；唔會殘留表單／全螢幕 ──
  await pg.locator('.tab', { hasText: '設定' }).click();
  await pg.locator('.tab', { hasText: '主頁' }).click();
  await pg.locator('.tile', { hasText: '指給店員看' }).click();
  assert((await rows().count()) === 20, '離開再入：20 張仍然喺度');
  assert((await pg.locator('.show-viewer').count()) === 0, '冇殘留全螢幕');

  // ── 備份往返、舊存檔 ──
  const rt = await pg.evaluate(() => {
    const S = App.Storage;
    const state = JSON.parse(localStorage.getItem('japaneseOps:v1'));
    const p = S.parseBackup(JSON.stringify(S.buildBackup(state)));
    const o = JSON.parse(JSON.stringify(S.buildBackup(state))); delete o.data['japaneseOps:v1'].show.custom;
    const old = S.parseBackup(JSON.stringify(o));
    return { same: p.ok && JSON.stringify(p.state.show.custom) === JSON.stringify(state.show.custom), oldOk: old.ok && old.state.show.custom.length === 0 };
  });
  assert(rt.same, '備份往返：20 張卡片完全相同');
  assert(rt.oldOk, '舊備份（冇 custom）：照常還原，custom 補空');
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('japaneseOps:v1')); delete s.show.custom; localStorage.setItem('japaneseOps:v1', JSON.stringify(s)); });
  await pg.reload();
  await pg.locator('.tile', { hasText: '指給店員看' }).click();
  assert((await rows().count()) === 0 && (await main()).includes('還沒有卡片'), '舊存檔（冇 custom）：空狀態，唔爆');

  // ── 版面：320px、深色 ──
  await btn('＋ 新增卡片').click();
  await fillForm('長い文章です。'.repeat(14), 'ながいぶんしょうです。'.repeat(8), '備註'.repeat(40));
  await save();
  for (const [w, scheme] of [[375, 'light'], [320, 'light'], [375, 'dark'], [320, 'dark']]) {
    await pg.emulateMedia({ colorScheme: scheme });
    await pg.setViewportSize({ width: w, height: 700 });
    await pg.waitForTimeout(150);
    const m = await pg.evaluate(() => ({
      h: document.documentElement.scrollWidth > innerWidth,
      small: [...document.querySelectorAll('.show-edit,.show-custom-row .show-row')].filter((e) => e.getBoundingClientRect().height < 43.5).length,
      over: [...document.querySelectorAll('#show-g-custom *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length,
    }));
    assert(!m.h && m.small === 0 && m.over === 0, `${w}px ${scheme}：冇橫向捲動、掣 ≥ 44px、冇內容超出（${JSON.stringify(m)}）`);
  }
  const contrast = await pg.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const bgOf = (e) => { while (e) { const x = getComputedStyle(e).backgroundColor; if (x && !/rgba\(0, 0, 0, 0\)/.test(x)) return x; e = e.parentElement; } return 'rgb(255,255,255)'; };
    const bad = [];
    document.querySelectorAll('#show-g-custom *').forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const a = lum(getComputedStyle(e).color), c = lum(bgOf(e)); const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      if (r < 4.5) bad.push(e.className + ' ' + r.toFixed(2));
    });
    return bad;
  });
  assert(contrast.length === 0, '深色：我的卡片文字對比 ≥ 4.5 ' + contrast.slice(0, 3));

  assert(errs.length === 0, 'errs ' + JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
