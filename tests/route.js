// 30 日入門路線（stage 10，版本一＋二＋三）：30 天資料、主頁一次性提示、起點選擇、路線模式的每日任務、一個日曆日最多解鎖一天、
// 路線地圖與「標記為已學過」、今日新字課、今日延伸連結（返回原頁）、結業卡、重新開始路線、進度頁路線區、第 29–30 天口語、備份、舊存檔。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { SpeechSynthesis.prototype.speak = function () {}; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const main = () => pg.locator('#main').innerText();
  const exact = (t) => pg.locator('#main button').filter({ hasText: new RegExp('^\\s*' + t + '\\s*$') });

  // ── 資料 ──
  const data = await pg.evaluate(() => {
    const C = App.Content, D = C.ROUTE_DAYS;
    const all = new Set(C.PHRASE_SCENES.flatMap((s) => s.phrases.flatMap((p) => [p.id, ...(p.replies || []).map((r) => r.id)])));
    const dlg = new Set(C.DIALOGUES.map((d) => d.id));
    const rows = new Set(C.KANA_ROWS.map((r) => r.key));
    const ids = D.flatMap((d) => d.sentences);
    return {
      n: D.length, days: D.every((d, i) => d.day === i + 1), sentences: ids.length, unique: new Set(ids).size,
      missing: ids.filter((i) => !all.has(i)), badDlg: D.filter((d) => d.dialogue && !dlg.has(d.dialogue)).map((d) => d.day),
      badRows: D.flatMap((d) => (d.kana ? d.kana.rows.filter((r) => !rows.has(r)) : [])),
      counts: Object.fromEntries(D.filter((d) => d.kana).map((d) => [d.day, App.Daily.routeNewChars(d).length])),
      mustMissing: C.MUST_HAVE.filter((id) => !ids.includes(id)),
      mustLastDay: Math.max(...C.MUST_HAVE.map((id) => D.find((d) => d.sentences.includes(id)).day)),
      dlgDays: D.filter((d) => d.dialogue).map((d) => d.day + ':' + d.dialogue).join(' '),
      review: D.filter((d) => d.review).map((d) => d.day + ':' + d.review).join(' '),
      taxfree: ids.filter((i) => ['shop-09', 'shop-10', 'shop-25', 'shop-26'].includes(i)),
      noSentenceDays: D.filter((d) => !d.sentences.length).map((d) => d.day).join(),
    };
  });
  assert(data.n === 30 && data.days, '30 天，day 由 1 到 30');
  assert(data.sentences === 142 && data.unique === 142 && data.missing.length === 0, '142 個句子 id：不重複、全部在句子庫 ' + data.missing);
  assert(data.badDlg.length === 0 && data.badRows.length === 0, '對話 id 和五十音行 key 都存在 ' + data.badDlg + data.badRows);
  assert(JSON.stringify(data.counts) === JSON.stringify({ 1: 10, 2: 10, 3: 10, 4: 13, 5: 3, 6: 20, 7: 5, 8: 33, 10: 10, 11: 10, 12: 10, 13: 16, 15: 25, 16: 33, 17: 12 }), '每天新字數（第 4 天 13、第 13 天 16、第 17 天 12，用戶更正）');
  assert(data.mustMissing.length === 0 && data.mustLastDay <= 24, '必學 30 句全部在第 24 天前教完');
  assert(data.dlgDays === '9:ramen 12:fastfood 14:conbini 17:station 19:taxi 21:hotel 23:directions 25:emergency 26:airport', '對話解鎖日 ' + data.dlgDays);
  assert(data.review === '9:hira 14:kata' && data.noSentenceDays === '29,30', '複習日（9 平、14 片）和無新句子的 29、30 天');
  assert(data.taxfree.length === 0, '路線不含免稅句子');

  // ── 主頁一次性提示卡（版本二）──
  assert((await main()).includes('新：30 日入門路線') && (await st()).path.promptSeen === false, '全新存檔：主頁有「新：30 日入門路線」提示卡');
  await pg.getByRole('button', { name: '之後再說' }).click();
  assert(!(await main()).includes('新：30 日入門路線') && (await st()).path.promptSeen === true, '按「之後再說」：提示卡消失並記住');
  await pg.reload();
  assert(!(await main()).includes('新：30 日入門路線'), '重新載入後提示卡不再出現');
  await pg.evaluate(() => { const x = JSON.parse(localStorage.getItem('japaneseOps:v1')); x.path.promptSeen = false; localStorage.setItem('japaneseOps:v1', JSON.stringify(x)); });
  await pg.reload();
  await pg.getByRole('button', { name: '看看' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '30 日入門路線' && (await st()).path.promptSeen === true, '按「看看」：直接打開起點畫面，提示卡視為已回應');
  await pg.locator('#main .btn-back').click(); // 起點 → 每日任務
  await pg.locator('#main .btn-back').click(); // 每日任務 → 主頁

  // ── 自由模式不變，有「開始路線」入口 ──
  await pg.locator('#main button', { hasText: /開始今日任務|繼續：/ }).first().click(); // fresh save: 錯題重溫 is auto-done, so the button may read 「繼續：今日新句子」
  let t = await main();
  assert(t.includes('30 日入門路線') && (await pg.getByRole('button', { name: '開始路線' }).count()) === 1, '自由模式：每日任務頂部有「30 日入門路線」入口');
  assert((await pg.locator('.task-title').allInnerTexts()).join('/') .includes('五十音熱身') && (await st()).path.mode === 'free', '自由模式的任務照舊（五十音熱身）');

  // ── 起點選擇 ──
  await pg.getByRole('button', { name: '開始路線' }).click();
  assert((await pg.getByRole('button', { name: '請先選擇起點' }).isDisabled()), '未選起點時確認鈕停用');
  assert((await pg.locator('#main .chip').count()) === 30, '自選：30 個日子的選擇');
  await pg.locator('#main .mode-opt', { hasText: '完全零基礎' }).click();
  assert((await main()).includes('第 1 天：打招呼') && (await main()).includes('あ行・か行（10 個）'), '預覽：第 1 天、あ行・か行（10 個）');
  await exact('從第 1 天開始').click();
  let s = await st();
  const today = await pg.evaluate(() => App.Storage.todayLocal());
  const d1 = s.daily.days[today];
  assert(s.path.mode === 'route' && s.path.start === 1 && d1.routeDay === 1, '開始後：mode=route、start=1、今天的計劃是路線第 1 天（沒有答題，所以立即重排）');
  assert(d1.newIds.length === 5 && d1.dialogueId === null && d1.kanaChars.length === 10 && d1.done.dialogue === true, '第 1 天：5 句新句子、10 個新字、沒有對話（自動完成）');
  t = await main();
  assert(t.includes('路線第 1 / 30 天') && t.includes('今日新字：あ行・か行（10 個）') && (await pg.locator('.route-dot').count()) === 30, '路線卡：第 1 / 30 天、今日新字、30 個進度點');
  assert((await pg.locator('.task-title').allInnerTexts()).some((x) => x.includes('五十音：今日新字 10 題')), '五十音任務變成「今日新字 10 題」');

  // ── 路線日的完成條件與逐日解鎖（純函數）──
  const r = await pg.evaluate(() => {
    const S = App.Storage, D = App.Daily, today = S.todayLocal(), yest = S.addDaysLocal(today, -1);
    const base = { ...S.loadState(), path: { mode: 'route', start: 1, doneDays: {} } };
    const e = D.ensureToday(base);
    const two = D.markDone(D.markDone(e, today, 'new'), today, 'speak');
    const three = D.markDone(two, today, 'kana');
    // next calendar day: today's plan becomes yesterday's
    const moved = JSON.parse(JSON.stringify(three)); moved.daily.days[yest] = moved.daily.days[today]; delete moved.daily.days[today];
    const next = D.ensureToday(moved);
    // not finished yesterday → the same route day again
    const moved2 = JSON.parse(JSON.stringify(two)); moved2.daily.days[yest] = moved2.daily.days[today]; delete moved2.daily.days[today];
    const again = D.ensureToday(moved2);
    return {
      e1: e.daily.days[today].routeDay, two: two.path.doneDays, three: three.path.doneDays, sameDay: D.ensureToday(three).daily.days[today].routeDay,
      next: next.daily.days[today].routeDay, again: again.daily.days[today].routeDay,
    };
  });
  assert(r.e1 === 1 && Object.keys(r.two).length === 0, '只完成新句子、口語兩項：路線日未完成');
  assert(r.three['1'] === today, '新句子、口語、五十音三項都完成 → 記下第 1 天完成');
  assert(r.sameDay === 1, '同一個日曆日內，不會解鎖下一天');
  assert(r.next === 2, '下一個日曆日：解鎖第 2 天');
  assert(r.again === 1, '昨天沒完成：今天仍是第 1 天（漏掉的日子不會被跳過）');

  // ── 路線地圖、標記為已學過、今日新字課（版本二）──
  await pg.getByRole('button', { name: '📍 路線地圖' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '路線地圖' && (await pg.locator('.route-row').count()) === 30, '路線地圖：30 天');
  assert((await pg.locator('.route-row .route-st').first().innerText()).includes('今天') && (await pg.locator('.route-row .route-st').nth(1).innerText()).includes('未解鎖'), '第 1 天是「今天」，第 2 天「未解鎖」');
  await pg.locator('.route-row-head').first().click();
  assert((await pg.locator('.route-row.open').innerText()).includes('こんにちは。') && (await pg.locator('.route-row.open .route-sentences li').count()) === 5, '展開第 1 天：顯示 5 句新句子');
  await pg.locator('.route-row-head').nth(4).click();
  assert((await pg.locator('.route-row.open .route-sentences li').count()) === 0 && (await pg.locator('.route-row.open').innerText()).includes('解鎖後會顯示完整內容'), '未解鎖的第 5 天只顯示摘要，不列出句子');
  await pg.getByRole('button', { name: /標記為已學過/ }).click();
  assert((await pg.locator('.confirm').innerText()).includes('確定把第 5 天標記為已學過'), '標記前要再確認');
  await pg.getByRole('button', { name: '取消' }).click();
  assert(!((await st()).path.skipDays || {})['5'], '取消：沒有略過');
  await pg.getByRole('button', { name: /標記為已學過/ }).click();
  await pg.getByRole('button', { name: '確定略過' }).click();
  assert(((await st()).path.skipDays || {})['5'] === today && (await pg.locator('.route-row').nth(4).locator('.route-st').innerText()).includes('已略過'), '確定略過：記入 skipDays，狀態變「已略過」');
  assert((await pg.locator('.route-dot.skipped').count()) === 1, '進度點出現「略過」顏色');
  await pg.locator('.route-row-head').nth(4).click(); // already open → close, reopen
  if ((await pg.locator('.route-row.open').count()) === 0) await pg.locator('.route-row-head').nth(4).click();
  await pg.getByRole('button', { name: /取消略過/ }).click();
  assert(Object.keys((await st()).path.skipDays || {}).length === 0, '取消略過：恢復');
  await pg.locator('.route-row-head').first().click();
  await pg.getByRole('button', { name: /標記為已學過/ }).click();
  await pg.getByRole('button', { name: '確定略過' }).click();
  s = await st();
  assert(s.path.skipDays['1'] && s.daily.days[today].routeDay === 2, '略過今天的路線日（今天未答題）：今天的計劃立即換成第 2 天');
  await pg.locator('#main .btn-back').click();
  assert((await pg.locator('.task-title').allInnerTexts()).some((x) => x.includes('五十音：今日新字')) && (await pg.getByRole('button', { name: '學習新字' }).count()) === 1, '今日新字日：五十音任務的按鈕是「學習新字」');
  await pg.getByRole('button', { name: '學習新字' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '今日新字' && (await pg.locator('.lesson-card').count()) === 10, '今日新字課：第 2 天（さ行・た行）10 張字卡');
  assert((await pg.locator('.lesson-card').first().innerText()).includes('sa') || (await pg.locator('.lesson-card').first().innerText()).includes('ta'), '字卡有拼音');
  await pg.getByRole('button', { name: '直接開始小測（10 題）' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '五十音・今日新字', '從新字課開始小測');
  await pg.locator('#main .btn-back').click();
  assert((await pg.locator('.mod-header h2').innerText()) === '今日任務', '離開小測回到任務列表（不是新字課）');
  // a bigger lesson: day 8 (拗音 33)
  await pg.getByRole('button', { name: '更換起點' }).click();
  await pg.locator('#main .chip', { hasText: /^8$/ }).click();
  await exact('從第 8 天開始').click();
  await pg.getByRole('button', { name: '學習新字' }).click();
  assert((await pg.locator('.lesson-card').count()) === 33, '第 8 天新字課：33 張拗音字卡');
  await pg.locator('#main .btn-back').click();
  // 路線地圖 also reachable in 自由模式 once there is progress; skipped days make nextRouteDay move on
  const sk = await pg.evaluate(() => {
    const S = App.Storage, D = App.Daily, today = S.todayLocal();
    const loaded = S.loadState();
    const days = { ...loaded.daily.days }; delete days[today]; // no plan yet today, so ensureToday builds one from the path below
    const base = D.ensureToday({ ...loaded, daily: { ...loaded.daily, days }, path: { mode: 'route', start: 1, doneDays: { 1: 'x' }, skipDays: { 2: 'x', 3: 'x' }, promptSeen: true } });
    const answered = { ...base, daily: { ...base.daily, activity: { [today]: { a: 2, c: 1 } } } };
    const rd = base.daily.days[today].routeDay;
    const kept = D.skipRouteDay(answered, rd);
    return {
      next: D.nextRouteDay(base), todayPlan: rd,
      keptPlan: kept.daily.days[today] === answered.daily.days[today] && !!kept.path.skipDays[rd],
      beforeStart: D.skipRouteDay({ ...base, path: { ...base.path, start: 10, skipDays: {} } }, 3).path.skipDays[3] === undefined,
      prompt: [D.showPrompt(S.loadState()), D.showPrompt({ path: { mode: 'route', promptSeen: false, doneDays: {}, skipDays: {} } }), D.showPrompt({ path: { mode: 'free', promptSeen: false, doneDays: { 1: 'x' }, skipDays: {} } })],
    };
  });
  assert(sk.next === 4 && sk.todayPlan === 4, '已完成和已略過的天數都被跳過（第 4 天）');
  assert(sk.keptPlan, '今天已有答題時略過今天的路線日：今天的計劃保留，只記入 skipDays');
  assert(sk.beforeStart === true, '起點之前的日子不能略過');
  assert(sk.prompt.join() === 'false,false,false', '提示卡不會在已開始路線、已有進度的人身上出現');

  // ── 更換起點／今天已有答題 ──
  const sw = await pg.evaluate(() => {
    const S = App.Storage, D = App.Daily, today = S.todayLocal();
    const base = D.ensureToday({ ...S.loadState(), path: { mode: 'free', start: 1, doneDays: { 1: '2026-01-01' } } });
    const fresh = D.applyPath(base, { mode: 'route', start: 10 });   // nothing answered → today's plan dropped and rebuilt
    const rebuilt = D.ensureToday(fresh);
    const answered = { ...base, daily: { ...base.daily, activity: { [today]: { a: 3, c: 2 } } } };
    const late = D.applyPath(answered, { mode: 'route', start: 18 });  // something answered → today stays, route from tomorrow
    return {
      freshRoute: rebuilt.daily.days[today].routeDay,
      kataOnly: rebuilt.daily.days[today].kanaChars.every((c) => /[ァ-ヶ]/.test(c)),
      lateKept: late.daily.days[today] === answered.daily.days[today],
      lateNext: D.nextRouteDay(late),
      skipDone: D.nextRouteDay({ path: { start: 1, doneDays: { 1: 'x', 2: 'x' } } }),
      finished: D.nextRouteDay({ path: { start: 1, doneDays: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, 'x'])) } }),
    };
  });
  assert(sw.freshRoute === 10 && sw.kataOnly, '沒有答題時更換起點：立即重排成第 10 天（片假名新字）');
  assert(sw.lateKept && sw.lateNext === 18, '今天已有答題：今天的計劃保留，路線從明天起（第 18 天）');
  assert(sw.skipDone === 3 && sw.finished === null, '已完成的天數會被跳過；30 天全部完成後沒有下一天');

  // ── 畫面操作：更換起點、回到自由模式 ──
  await pg.getByRole('button', { name: '更換起點' }).click();
  await pg.locator('#main .chip', { hasText: /^1$/ }).click();
  assert((await main()).includes('從第 1 天開始') || (await main()).includes('已經完成'), '更換起點畫面可自選日子');
  await pg.locator('#main .btn-back').click();
  await pg.getByRole('button', { name: '回到自由模式' }).click();
  s = await st();
  assert(s.path.mode === 'free' && (await pg.getByRole('button', { name: /開始路線|繼續路線/ }).count()) === 1, '回到自由模式：入口卡回來，任務回到自由選題');

  // ── 版本三：今日延伸連結、結業卡、重新開始路線、進度頁路線區、第 29–30 天口語 ──
  const seed = async (path) => {
    await pg.evaluate((p) => {
      const S = App.Storage; const x = S.loadState(); const d = { ...x.daily, days: { ...x.daily.days } };
      delete d.days[S.todayLocal()];
      localStorage.setItem('japaneseOps:v1', JSON.stringify({ ...x, daily: d, path: p }));
    }, path);
    await pg.reload();
  };
  const upTo = (n, date) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, date || '2026-01-01']));
  const openDaily = async () => { await pg.locator('#main button', { hasText: /開始今日任務|繼續：/ }).first().click(); };
  const tab = (name) => pg.locator('.tab-label', { hasText: name }).click();

  // 今日延伸連結（第 3 天：數字）→ 返回回到每日任務
  await seed({ mode: 'route', start: 1, doneDays: upTo(2), skipDays: {}, promptSeen: true });
  await openDaily();
  assert((await pg.locator('#main .extra-link').count()) >= 1 && (await main()).includes('🗾 路線第 3 / 30 天'), '今日延伸是連結（第 3 天）');
  await pg.locator('#main .extra-link').first().click();
  assert(!(await main()).includes('今日延伸'), '按延伸連結：打開目標模組（數字）');
  await pg.locator('#main .btn-back').first().click();
  assert((await main()).includes('🗾 路線第 3 / 30 天') && (await main()).includes('今日延伸'), '從路線卡進去，← 返回回到每日任務');

  // 路線地圖展開同一日 → 延伸連結 → 返回仍然係路線地圖、同一日展開
  await pg.getByRole('button', { name: '📍 路線地圖' }).click();
  await pg.locator('#main .route-row').nth(2).locator('.route-row-head').click();
  assert((await pg.locator('#main .route-row.open .extra-link').count()) >= 1, '地圖展開第 3 天（今天）：有延伸連結');
  await pg.locator('#main .route-row.open .extra-link').first().click();
  await pg.locator('#main .btn-back').first().click();
  assert((await main()).includes('路線地圖') && (await pg.locator('#main .route-row.open').count()) === 1 && (await pg.locator('#main .route-row').nth(2).getAttribute('class')).includes('open'), '從路線地圖進去，← 返回回到路線地圖並展開同一天');
  await pg.locator('#main .btn-back').first().click(); // 地圖 → 每日任務
  assert((await main()).includes('🗾 路線第 3 / 30 天'), '路線地圖 ← 返回：每日任務');

  // 結業卡（28 完成 + 2 略過）
  await seed({ mode: 'route', start: 1, doneDays: upTo(28), skipDays: { 29: '2026-01-02', 30: '2026-01-02' }, promptSeen: true });
  await openDaily();
  let fin = await main();
  assert(fin.includes('30 日入門路線結業') && fin.includes('完成 28 天') && fin.includes('略過 2 天'), '結業卡：完成 28 天、略過 2 天');
  assert(/情境對話：已玩 \d+ ?\/ ?13/.test(fin.replace(/\s+/g, ' ')) && fin.includes('藥妝店、觀光景點、溫泉、預約與電話的對話不在路線內'), '結業卡：「情境對話已玩 x/13」旁有「藥妝店、觀光景點、溫泉、預約與電話的對話不在路線內」');
  assert(fin.includes('必學 30 句') && fin.includes('五十音掌握') && fin.includes('句子熟練'), '結業卡：必學 30 句、五十音、句子熟練統計');
  assert((await pg.getByRole('button', { name: '回到自由模式' }).count()) === 1 && (await pg.getByRole('button', { name: '重新開始路線' }).count()) === 1, '結業卡（路線模式）：有「回到自由模式」和「重新開始路線」');

  // 重新開始路線：先取消，再確定
  await pg.getByRole('button', { name: '重新開始路線' }).click();
  assert((await main()).includes('確定重新開始？'), '重新開始路線：先出確認');
  await pg.getByRole('button', { name: '取消' }).click();
  s = await st();
  assert(Object.keys(s.path.doneDays).length === 28 && (await main()).includes('30 日入門路線結業'), '取消：路線紀錄不變，仍是結業卡');
  await pg.getByRole('button', { name: '重新開始路線' }).click();
  await pg.getByRole('button', { name: '確定重新開始' }).click();
  s = await st();
  assert(s.path.mode === 'route' && s.path.start === 1 && Object.keys(s.path.doneDays).length === 0 && Object.keys(s.path.skipDays).length === 0, '確定重新開始：doneDays／skipDays 清空、從第 1 天');

  // 結業後回到自由模式 → 卡只有兩個掣
  await seed({ mode: 'free', start: 1, doneDays: upTo(28), skipDays: { 29: '2026-01-02', 30: '2026-01-02' }, promptSeen: true });
  await openDaily();
  fin = await main();
  assert(fin.includes('30 日入門路線結業') && (await pg.getByRole('button', { name: '回到自由模式' }).count()) === 0 && (await pg.getByRole('button', { name: '重新開始路線' }).count()) === 1 && (await pg.getByRole('button', { name: '📍 路線地圖' }).count()) === 1, '結業後自由模式：只有「路線地圖」「重新開始路線」兩個掣');
  await pg.locator('#main .btn-back').first().click();

  // 路線起點畫面：有進度時有「重新開始路線」
  await seed({ mode: 'free', start: 1, doneDays: upTo(3), skipDays: {}, promptSeen: true });
  await openDaily();
  await pg.getByRole('button', { name: /開始路線|繼續路線/ }).first().click();
  assert((await pg.getByRole('button', { name: /重新開始路線/ }).count()) === 1, '起點畫面（有進度）：有「重新開始路線」');

  // 進度頁路線區：未開始 → 沒有；進行中；自由模式有進度；結業
  await seed({ mode: 'free', start: 1, doneDays: {}, skipDays: {}, promptSeen: true });
  await tab('進度');
  assert((await pg.getByRole('button', { name: '📍 路線地圖' }).count()) === 0 && !(await main()).includes('30 日入門路線'), '進度頁：未開始路線 → 不顯示路線區');
  await seed({ mode: 'route', start: 1, doneDays: upTo(4), skipDays: { 5: '2026-01-02' }, promptSeen: true });
  await tab('進度');
  let pgT = await main();
  assert(pgT.includes('已完成 4 天') && pgT.includes('略過 1 天') && (await pg.getByRole('button', { name: '📍 路線地圖' }).count()) === 1, '進度頁：進行中（已完成 4 天、略過 1 天、有路線地圖掣）');
  await pg.getByRole('button', { name: '📍 路線地圖' }).click();
  assert((await main()).includes('路線地圖') && (await pg.locator('#main .route-row').count()) === 30, '進度頁「路線地圖」掣：打開 30 行路線地圖');
  await seed({ mode: 'free', start: 1, doneDays: upTo(4), skipDays: {}, promptSeen: true });
  await tab('進度');
  assert((await main()).includes('自由模式') && (await pg.getByRole('button', { name: '📍 路線地圖' }).count()) === 1, '進度頁：自由模式但有進度 → 顯示路線區（自由模式）');
  await seed({ mode: 'route', start: 1, doneDays: upTo(30), skipDays: {}, promptSeen: true });
  await tab('進度');
  assert((await main()).includes('已結業') && (await main()).includes('藥妝店、觀光景點、溫泉、預約與電話的對話不在路線內'), '進度頁：結業顯示「已結業」和統計');

  // 第 29–30 天口語：優先必學 30 句（未熟練的）
  const sp = await pg.evaluate(() => {
    const S = App.Storage, D = App.Daily, M = new Set(App.Content.MUST_HAVE);
    const out = {};
    for (const n of [29, 30]) {
      const x = S.loadState();
      const days = { ...x.daily.days }; delete days[S.todayLocal()];
      const st = D.ensureToday({ ...x, daily: { ...x.daily, days }, path: { mode: 'route', start: n, doneDays: {}, skipDays: {}, promptSeen: true } });
      const plan = st.daily.days[S.todayLocal()];
      out[n] = { day: plan.routeDay, n: plan.speakIds.length, allMust: plan.speakIds.every((id) => M.has(id)) };
    }
    return out;
  });
  assert(sp[29].day === 29 && sp[30].day === 30 && sp[29].n > 0 && sp[30].n > 0 && sp[29].allMust && sp[30].allMust, '第 29／30 天口語：全部係必學 30 句（未熟練）');

  // ── 備份與舊存檔 ──
  const bk = await pg.evaluate(() => {
    const S = App.Storage;
    let x = S.loadState(); x = { ...x, path: { mode: 'route', start: 12, doneDays: { 1: '2026-10-01', 30: '2026-10-30' } } };
    const file = JSON.stringify(S.buildBackup(x, new Date().toISOString()));
    const ok = S.parseBackup(file).state.path;
    const o = JSON.parse(file); Object.assign(o.data['japaneseOps:v1'].path, { mode: 'x', start: 99, doneDays: { 0: '2026-01-01', 31: '2026-01-01', 5: 'bad', 7: '2026-01-07' } });
    const bad = S.parseBackup(JSON.stringify(o)).state.path;
    const o2 = JSON.parse(file); o2.data['japaneseOps:v1'].path = 'x';
    const old = JSON.parse(JSON.stringify(x)); delete old.path; localStorage.setItem('japaneseOps:v1', JSON.stringify(old));
    return { ok, bad, str: S.parseBackup(JSON.stringify(o2)).reason, old: S.loadState().path };
  });
  assert(bk.ok.mode === 'route' && bk.ok.start === 12 && Object.keys(bk.ok.doneDays).join() === '1,30', '備份往返保留路線進度');
  assert(bk.bad.mode === 'free' && bk.bad.start === 1 && Object.keys(bk.bad.doneDays).join() === '7', '竄改的路線資料被改回預設／丟棄');
  assert(bk.str === 'invalid' && bk.old.mode === 'free' && bk.old.start === 1, 'path 型別錯 → invalid；舊存檔補預設（自由模式）');

  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
