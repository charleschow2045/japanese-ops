// 換字練習（stage 10 ⑥ 版本二）— 畫面：聽力／口語選單嘅換字卡、詞庫、聽力 5 題（朗讀＝假名＋句型）、
// 口語（自己對答案）、答題記錄同 w:h:／w:s: 重溫 key、聽力重溫／口語重溫、進度頁、備份、舊存檔。
// 資料與出題邏輯另見 swap.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  pg.setDefaultTimeout(5000);
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => {
    window.__said = [];
    SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); };
    SpeechSynthesis.prototype.cancel = function () {};
  });
  await pg.goto(BASE + '/index.html');
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const said = () => pg.evaluate(() => window.__said);
  const card = (t) => pg.locator('#main .card', { hasText: t }).last();
  const chipIn = (c, name) => c.locator('.chip').filter({ hasText: name }).first();
  const btn = (name) => pg.locator('#main button', { hasText: name }).first();

  // 新存檔預設值
  let s = await st();
  assert(s.swap && s.swap.prefs.pats.join() === 'p1,p2,p3,p4,p5,p6' && s.swap.prefs.count === 10 && Object.keys(s.swap.stats).length === 0, '新存檔：swap 預設 6 個句型、10 題、冇統計');

  // ── 聽力選單 ──
  await pg.locator('.tile', { hasText: '聽力練習' }).click();
  let c = card('換字練習（聽力）');
  assert((await c.count()) === 1 && (await c.locator('.chip').count()) >= 6 + 3, '聽力選單：換字練習卡（6 個句型 chip＋題數）');
  assert((await c.innerText()).includes('〇〇は入っていますか。（13）') && (await c.innerText()).includes('64 個組合'), '句型 chip 顯示詞數；共 64 個組合');
  // 詞庫
  await chipIn(c, '〇〇はどこですか。').last().click(); // the 詞庫 chip row comes after the 句型 chips
  assert((await card('換字練習（聽力）').locator('.ex-card').count()) === 12, '查看詞庫：句型 ④ 列出 12 個詞');
  await pg.evaluate(() => (window.__said = []));
  await card('換字練習（聽力）').locator('.ex-card', { hasText: '改札' }).click();
  assert((await said()).slice(-1)[0] === 'かいさつ', '詞庫撳一行：朗讀假名（かいさつ）');
  await chipIn(card('換字練習（聽力）'), '〇〇はどこですか。').last().click();
  assert((await card('換字練習（聽力）').locator('.ex-card').count()) === 0, '再撳一次收起詞庫');

  // 揀句型：只留 p1、p3；5 題
  c = card('換字練習（聽力）');
  for (const [id, t] of [['p2', '〇〇アレルギー'], ['p4', '〇〇はどこ'], ['p5', '〇〇までお願い'], ['p6', '〇〇はありますか']]) {
    await card('換字練習（聽力）').locator('.chip').filter({ hasText: t }).first().click();
  }
  await card('換字練習（聽力）').locator('.chip', { hasText: /^5 題$/ }).click();
  s = await st();
  assert(s.swap.prefs.pats.join() === 'p1,p3' && s.swap.prefs.count === 5, '選項儲存：只揀 p1、p3、5 題 ' + JSON.stringify(s.swap.prefs));
  await card('換字練習（聽力）').locator('.chip').filter({ hasText: '〇〇アレルギー' }).first().click();
  assert((await st()).swap.prefs.pats.includes('p2'), '句型 chip：再撳一次加返 p2');
  await card('換字練習（聽力）').locator('.chip').filter({ hasText: '〇〇アレルギー' }).first().click();
  assert(!(await st()).swap.prefs.pats.includes('p2'), '句型 chip：再撳一次取消 p2');

  // ── 聽力 5 題 ──
  await pg.evaluate(() => (window.__said = []));
  await btn('開始換字聽力').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '換字練習（聽力）', '標題：換字練習（聽力）');
  let wrong = 0;
  for (let i = 0; i < 5; i++) {
    assert((await pg.locator('.opt').count()) === 4, `第 ${i + 1} 題 4 個選項`);
    const heard = (await said()).slice(-1)[0];
    assert(/^(.+)(は入っていますか。|をください。)$/.test(heard) && !/[卵牛乳小麦豚肉水茶袋箸]/.test(heard.replace(/入|お願/g, '')), `第 ${i + 1} 題朗讀：詞用假名（${heard}）`);
    await pg.locator('.opt').first().click();
    if ((await pg.locator('.fb-title').innerText()).includes('答錯')) wrong++;
    const kana = await pg.locator('.feedback').innerText();
    assert(kana.includes('換字練習'), `第 ${i + 1} 題答案卡顯示「🔁 換字練習」`);
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.score').count()) === 1, '結果頁');
  s = await st();
  const answered = Object.values(s.swap.stats).reduce((a, x) => a + x.c + x.w, 0);
  const keys = Object.keys(s.review.items).filter((k) => k.startsWith('w:'));
  assert(answered === 5 && Object.keys(s.listen.stats || {}).length === 0 && keys.length <= wrong && keys.every((k) => /^w:h:p[13]:[a-z]+$/.test(k)), `記錄 5 題在 swap.stats（唔入句子聽力統計）；答錯進 w:h: 重溫 ${keys}`);

  // ── 聽力重溫 ──
  if (keys.length) {
    await btn('返回聽力練習').click();
    assert((await pg.locator('.review-card').innerText()).includes(`換字 ${keys.length}`), '聽力重溫卡顯示「換字 n」');
    await btn('開始重溫').click();
    for (let i = 0; i < keys.length; i++) {
      const heard = (await said()).slice(-1)[0];
      const yue = await pg.evaluate((h) => {
        const it = App.Swap.patterns().flatMap((p) => App.Swap.itemsOf(p.id)).find((x) => x.p.say === h);
        return it && it.p.yue;
      }, heard);
      await pg.locator('.opt').filter({ hasText: new RegExp('^\\s*' + yue + '\\s*$') }).first().click();
      assert((await pg.locator('.fb-title').innerText()).includes('答對'), `重溫第 ${i + 1} 題：答對`);
      await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
    }
    s = await st();
    assert(keys.every((k) => s.review.items[k] && s.review.items[k].box === 1), '重溫答對：全部升到 box 1');
  }

  // ── 口語（自己對答案）──
  await pg.evaluate(() => { const x = JSON.parse(localStorage.getItem('japaneseOps:v1')); x.speak.prefs.mode = 'self'; localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile', { hasText: '口語練習' }).click();
  assert((await card('換字練習（口語）').count()) === 1, '口語選單：換字練習（口語）卡');
  await btn('開始換字口語').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '換字練習（口語）', '標題：換字練習（口語）');
  let sw = 0;
  for (let i = 0; i < 5; i++) {
    const t = await pg.locator('#main').innerText();
    assert(t.includes('🔁 換字練習・') && !t.includes('正確答案'), `口語第 ${i + 1} 題：顯示中文意思，未顯示答案`);
    await pg.getByRole('button', { name: '顯示答案' }).click();
    if (i % 2 === 0) { await pg.getByRole('button', { name: /要再練/ }).click(); sw++; } else await pg.getByRole('button', { name: /我讀對了/ }).click();
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.score').innerText()) === '2 / 5', '口語結果 2 / 5');
  s = await st();
  const sk = Object.keys(s.review.items).filter((k) => k.startsWith('w:s:'));
  assert(sk.length > 0 && sk.length <= sw && Object.keys(s.speak.stats || {}).length === 0, `口語答錯進 w:s: 重溫（唔入句子口語統計） ${sk}`);

  // ── 口語重溫 ──
  await btn('返回口語練習').click();
  assert((await pg.locator('.review-card').innerText()).includes(`今天需重溫 ${sk.length} 句`), '口語重溫卡數目包括換字');
  await btn('開始口語重溫').click();
  for (let i = 0; i < sk.length; i++) {
    await pg.getByRole('button', { name: '顯示答案' }).click();
    await pg.getByRole('button', { name: /我讀對了/ }).click();
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  s = await st();
  assert(sk.every((k) => s.review.items[k] && s.review.items[k].box === 1), '口語重溫答對：升到 box 1');

  // ── 進度頁 ──
  await pg.evaluate(() => { const x = JSON.parse(localStorage.getItem('japaneseOps:v1')); Object.keys(x.review.items).forEach((k) => { x.review.items[k].due = '2000-01-01'; }); localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tab-label', { hasText: '進度' }).click();
  const total = Object.keys((await st()).review.items).filter((k) => k.startsWith('w:')).length;
  assert((await pg.locator('#main').innerText()).includes(`換字 ${total}`), `進度頁「今天待重溫」顯示換字 ${total}`);

  // ── 備份 ──
  const before = await st();
  const bk = await pg.evaluate(() => {
    const S = App.Storage, x = S.loadState();
    const file = JSON.stringify(S.buildBackup(x, new Date().toISOString()));
    const ok = S.parseBackup(file).state;
    const o = JSON.parse(file), d = o.data['japaneseOps:v1'];
    d.review.items['w:h:p9:eki'] = { box: 0, due: '2026-10-21' };
    d.review.items['w:x:p1:eki'] = { box: 0, due: '2026-10-21' };
    d.review.items['w:s:p4:eki'] = { box: 1, due: '2026-10-22' };
    d.swap.stats.p9 = { c: 1, w: 1 };
    d.swap.stats.p2 = { c: 3, w: 1 };
    d.swap.prefs.pats = ['p2', 'p8', 'zzz', 'p2'];
    d.swap.prefs.count = 7;
    const t = S.parseBackup(JSON.stringify(o)).state;
    const o2 = JSON.parse(file); o2.data['japaneseOps:v1'].swap = 'x';
    const old = JSON.parse(JSON.stringify(x)); delete old.swap; localStorage.setItem('japaneseOps:v1', JSON.stringify(old));
    return {
      rtPats: ok.swap.prefs.pats.join(), rtStats: Object.keys(ok.swap.stats).sort().join(), rtRev: Object.keys(ok.review.items).filter((k) => k.startsWith('w:')).length,
      tPats: t.swap.prefs.pats.join(), tCount: t.swap.prefs.count, tStats: Object.keys(t.swap.stats).sort().join(), tRev: Object.keys(t.review.items).filter((k) => k.startsWith('w:')).sort().join(),
      bad: S.parseBackup(JSON.stringify(o2)).reason, oldSwap: S.loadState().swap,
    };
  });
  assert(bk.rtPats === before.swap.prefs.pats.join() && bk.rtStats === Object.keys(before.swap.stats).sort().join(), '備份往返：保留句型選擇同 swap 統計 ' + bk.rtPats + ' / ' + bk.rtStats);
  assert(bk.rtRev === Object.keys(before.review.items).filter((k) => k.startsWith('w:')).length, '備份往返：w: 重溫項目數目一樣');
  assert(bk.tPats === 'p2' && bk.tCount === 10 && bk.tStats.includes('p2') && !bk.tStats.includes('p9'), '竄改備份：句型 id 只收 p1–p6、題數錯就用預設、未知句型統計被丟棄 ' + JSON.stringify([bk.tPats, bk.tCount, bk.tStats]));
  assert(bk.tRev.includes('w:s:p4:eki') && !bk.tRev.includes('w:h:p9:eki') && !bk.tRev.includes('w:x:p1:eki'), '竄改備份：合法 w: key 保留，壞 key 丟棄 ' + bk.tRev);
  assert(bk.bad === 'invalid', 'swap 型別錯 → invalid');
  assert(bk.oldSwap.prefs.pats.join() === 'p1,p2,p3,p4,p5,p6' && bk.oldSwap.prefs.count === 10, '舊存檔（冇 swap）：補預設值');

  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
