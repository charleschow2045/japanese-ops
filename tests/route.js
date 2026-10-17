// 30 日入門路線（stage 10，版本一）：30 天資料、起點選擇、路線模式的每日任務、一個日曆日最多解鎖一天、備份、舊存檔。
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

  // ── 自由模式不變，有「開始路線」入口 ──
  await pg.getByText('開始今日任務').first().click();
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
  assert(s.path.mode === 'free' && (await pg.getByRole('button', { name: '開始路線' }).count()) === 1, '回到自由模式：入口卡回來，任務回到自由選題');

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
