// 相似字分辨（stage 10）：23 組資料、對照卡、兩種題型、選項只來自同一組、答題紀錄、加權抽題、備份、舊存檔。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { window.__said = []; SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); }; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const main = () => pg.locator('#main').innerText();

  // ── 資料 ──
  const data = await pg.evaluate(() => {
    const G = App.Content.KANA_LOOKALIKES, K = App.Content.KANA;
    const idOf = (s, ch) => Object.keys(K).find((id) => K[id][s] === ch);
    const bad = [];
    G.forEach((g) => {
      const ids = g.chars.map((c) => idOf(g.script, c));
      if (ids.some((x) => !x)) bad.push(g.id + ' char missing');
      const rom = ids.map((i) => i && K[i].romaji);
      if (new Set(rom).size !== rom.length) bad.push(g.id + ' duplicate romaji');
      if (!g.diff || g.chars.length < 2 || g.chars.length > 4) bad.push(g.id + ' shape');
    });
    const d = (id) => G.find((g) => g.id === id).diff;
    return { n: G.length, hira: G.filter((g) => g.script === 'hira').length, kata: G.filter((g) => g.script === 'kata').length, ids: new Set(G.map((g) => g.id)).size, bad, k08: d('k08'), k04: d('k04'), k09: d('k09'), h11: d('h11'), k05: d('k05'), k05chars: G.find((g) => g.id === 'k05').chars.join('') };
  });
  assert(data.n === 23 && data.hira === 11 && data.kata === 12 && data.ids === 23, '23 個分組：平假名 11、片假名 12、id 不重複');
  assert(data.bad.length === 0, '每組的字都存在、讀音不重複、2–4 個字、有分辨重點 ' + data.bad);
  assert(data.k08 === 'ス 第二筆從撇的中間向右下伸出、不穿過；ヌ 第二筆斜穿過第一筆，形似「又」', 'ヌ／ス 分辨重點照用戶修改');
  assert(data.k04 === 'ク 第二筆是橫完轉彎向下（像フ）；ケ 的橫畫不轉彎，另有一撇從橫畫中間向下伸出；タ 是 ク 中間多一短筆', 'ク／ケ／タ 分辨重點照用戶修改');
  assert(data.k09 === 'ア 第二筆是從中間向左下的長撇；マ 第二筆是一短點；ム 像一個三角形', 'マ／ム／ア 分辨重點照用戶修改');
  assert(data.h11 === 'は 右邊豎畫底部有小圈；け 沒有', 'け／は 新增一組');
  assert(data.k05chars === 'ウワフラ' && data.k05.includes('ラ 比 フ 上面多一短橫'), 'ウ／ワ／フ／ラ 加入 ラ 並有說明');

  // ── 入口與說明卡 ──
  await pg.locator('.tile', { hasText: '五十音' }).click();
  await pg.locator('.mod-row,.menu-card', { hasText: '相似字分辨' }).first().click();
  assert((await pg.locator('.mod-header h2').innerText()) === '相似字分辨', '五十音選單有「相似字分辨」卡，打開後標題正確');
  assert((await pg.locator('.help-card.open').count()) === 1 && (await pg.locator('.help-body').innerText()).includes('シ／ツ'), '說明卡第一次自動展開');
  assert((await st()).help.lookalike === 'seen', '說明卡記為已看過');

  // ── 設定與選組 ──
  const groupChips = () => pg.locator('.chip.row-chip').count();
  assert((await groupChips()) === 23, '預設「兩種」：23 個組別');
  await pg.locator('.chip', { hasText: /^片假名$/ }).first().click();
  assert((await groupChips()) === 12, '片假名：12 個組別');
  await pg.locator('.chip', { hasText: /^平假名$/ }).first().click();
  assert((await groupChips()) === 11, '平假名：11 個組別');
  await pg.getByRole('button', { name: '清除' }).click();
  assert((await main()).includes('請至少選擇一組') && (await pg.getByRole('button', { name: /開始分辨練習/ }).isDisabled()), '清除後提示並停用開始鈕');
  await pg.getByRole('button', { name: '全選' }).click();
  assert((await st()).kana.prefs.simGroups === null, '全選＝null（全部組別）');

  // ── 聽音選字（片假名、5 題）──
  await pg.locator('.chip', { hasText: /^片假名$/ }).first().click();
  await pg.locator('.chip', { hasText: /^5 題$/ }).first().click();
  await pg.locator('.chip', { hasText: '聽音選字' }).first().click();
  await pg.getByRole('button', { name: /開始分辨練習/ }).click();
  assert((await pg.evaluate(() => window.__said.length)) >= 1, '聽音選字：開始時播放第一個音');
  const groupSets = await pg.evaluate(() => App.Content.KANA_LOOKALIKES.filter((g) => g.script === 'kata').map((g) => g.chars.slice().sort().join('')));
  let okSets = true, sizes = new Set();
  for (let i = 0; i < 5; i++) {
    const labels = (await pg.locator('.opt').allInnerTexts()).map((t) => t.trim()).sort().join('');
    sizes.add(labels.length);
    if (!groupSets.includes(labels)) okSets = false;
    await pg.locator('.opt').first().click();
    if (i === 0) {
      assert((await pg.locator('.fb-banner').count()) === 1 && (await pg.locator('.sim-row .sim-btn').count()) >= 2 && (await main()).includes('💡'), '答完後顯示並排對照與分辨重點');
      assert((await pg.locator('.opt:disabled').count()) === (await pg.locator('.opt').count()), '答完後選項鎖定');
    }
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert(okSets, '每題的選項正好是同一組字（5 題）');
  assert((await main()).includes('/ 5') || /\d \/ 5/.test(await main()), '結果頁分數 x / 5');
  let s = await st();
  const answers = Object.values(s.kana.stats).reduce((n, x) => n + x.c + x.w, 0);
  const activity = Object.values(s.daily.activity).reduce((n, x) => n + x.a, 0);
  assert(answers === 5 && activity === 5, '5 次答題記進五十音統計和今日活動 ' + answers + '/' + activity);
  assert(s.kana.mistakes.every((c) => s.review.items['k:' + c]) && Object.keys(s.review.items).filter((k) => k.startsWith('k:')).length === s.kana.mistakes.length, '答錯的字進入錯題重溫（k:）');

  // ── 看字選音（平假名）──
  await pg.getByRole('button', { name: /返回對照卡/ }).click();
  await pg.locator('.chip', { hasText: /^平假名$/ }).first().click();
  await pg.locator('.chip', { hasText: '看字選音' }).first().click();
  await pg.getByRole('button', { name: /開始分辨練習/ }).click();
  assert((await pg.locator('.quiz-kana').count()) === 1, '看字選音：顯示大字');
  const hiraRom = await pg.evaluate(() => App.Content.KANA_LOOKALIKES.filter((g) => g.script === 'hira').map((g) => g.chars.map((c) => App.Content.KANA[Object.keys(App.Content.KANA).find((id) => App.Content.KANA[id].hira === c)].romaji).sort().join('|')));
  const lab = (await pg.locator('.opt').allInnerTexts()).map((t) => t.trim()).sort().join('|');
  assert(hiraRom.includes(lab), '看字選音：選項是同一組字的讀音');
  await pg.locator('.btn-back').click();
  assert((await pg.getByRole('button', { name: /開始分辨練習/ }).count()) === 1, '練習中按返回回到設定');

  // ── 抽題權重、二選一、備份、舊存檔 ──
  const r = await pg.evaluate(() => {
    const L = App.Lookalike, S = App.Storage;
    const mk = (prefs, mistakes, stats) => ({ prefs: { script: 'hira', rows: [], contrastRows: [], simScript: 'kata', simGroups: ['k03'], simCount: 20, simMode: 'see', ...prefs }, mistakes, stats });
    const freq = (kana, n) => { const f = {}; let rep = 0; for (let i = 0; i < n; i++) { const q = L.buildQuiz(kana); q.forEach((x, j) => { f[x.answer.ch] = (f[x.answer.ch] || 0) + 1; if (j && q[j - 1].answer.ch === x.answer.ch) rep++; }); } return { f, rep }; };
    const weighted = freq(mk({}, ['ツ'], { シ: { c: 5, w: 0 }, ン: { c: 5, w: 0 }, ソ: { c: 1, w: 0 }, ツ: { c: 0, w: 3 } }), 300);
    const pair = freq(mk({ simGroups: ['k08'] }, [], {}), 300);
    const three = freq(mk({ simGroups: ['k04'] }, [], {}), 100);
    let stt = S.loadState(); stt = { ...stt, kana: { ...stt.kana, prefs: { ...stt.kana.prefs, simScript: 'kata', simGroups: ['k01', 'h06'], simCount: 20, simMode: 'see' } } };
    const file = JSON.stringify(S.buildBackup(stt, new Date().toISOString()));
    const rt = S.parseBackup(file).state.kana.prefs;
    const o = JSON.parse(file); Object.assign(o.data['japaneseOps:v1'].kana.prefs, { simScript: 'x', simCount: 7, simMode: 5, simGroups: ['k01', 5, '', 'y'.repeat(30)] });
    const bad = S.parseBackup(JSON.stringify(o)).state.kana.prefs;
    const old = JSON.parse(JSON.stringify(stt)); ['simScript', 'simGroups', 'simCount', 'simMode'].forEach((k) => delete old.kana.prefs[k]); localStorage.setItem('japaneseOps:v1', JSON.stringify(old));
    const ol = S.loadState().kana.prefs;
    return { w: weighted.f, pairRep: pair.rep, threeRep: three.rep, rt: [rt.simScript, rt.simCount, rt.simMode, rt.simGroups.join()], bad: [bad.simScript, bad.simCount, bad.simMode, bad.simGroups.join()], ol: [ol.simScript, ol.simGroups, ol.simCount, ol.simMode] };
  });
  assert(r.w['ツ'] > r.w['シ'] * 1.5 && r.w['ソ'] > r.w['シ'], '加權抽題：答錯的字出現最多、未熟練的次之（ツ ' + r.w['ツ'] + ' ソ ' + r.w['ソ'] + ' シ ' + r.w['シ'] + '）');
  assert(r.pairRep > 0, '只有兩個不同的字時允許連續相同（避免答案可預測）');
  assert(r.threeRep === 0, '三個或以上的字時，同一個字不會連續出現');
  assert(JSON.stringify(r.rt) === '["kata",20,"see","k01,h06"]', '備份往返保留相似字設定');
  assert(JSON.stringify(r.bad) === '["both",10,"hear","k01"]', '竄改的設定被改回預設或丟棄');
  assert(JSON.stringify(r.ol) === '["both",null,10,"hear"]', '沒有相似字設定的舊存檔補預設值');

  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
