// 情境對話 11–13（stage 10 ⑥ 版本一）：觀光景點買票入場、溫泉入場與規矩、打電話預約餐廳。
// 結構驗證、對話列表（13 個）、全程自動玩（兩個隨機價錢分支、付款分支、預約成功／客滿）、價錢理解題同總金額一致、
// 朗讀用 say、答錯進重溫。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  pg.setDefaultTimeout(4000);
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { window.__said = []; SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); }; SpeechSynthesis.prototype.cancel = function () {}; });
  const peek = () => pg.evaluate(() => window.App.Dialogue.peek());
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const TITLE = { sightseeing: '觀光景點：買票入場', onsen: '溫泉：入場與規矩', reserve: '打電話預約餐廳' };

  // ── 結構 ──
  await pg.goto(BASE + '/index.html');
  const data = await pg.evaluate(() => {
    const D = App.Content.DIALOGUES;
    return { ids: D.map((d) => d.id).join(), scenes: D.slice(10).map((d) => d.scene).join(), emojis: D.slice(10).map((d) => d.emoji).join(), problems: App.Dialogue.validate() };
  });
  assert(data.ids === 'ramen,fastfood,conbini,drugstore,station,taxi,hotel,directions,emergency,airport,sightseeing,onsen,reserve', '對話 13 個（原有 10 個順序不變，後加 sightseeing／onsen／reserve）');
  assert(data.scenes === 'sight,onsen,call' && data.emojis === '🏯,♨️,📞', '新對話的情境同圖示：sight 🏯、onsen ♨️、call 📞');
  assert(data.problems.length === 0, 'Dialogue.validate() 沒有問題 ' + data.problems);

  // ── 對話列表 ──
  await pg.locator('.tile,.mod-row', { hasText: '情境對話' }).click();
  const list = await pg.locator('#main').innerText();
  assert(list.includes('已完成 0 / 13 個') && list.includes(TITLE.sightseeing) && list.includes(TITLE.onsen) && list.includes(TITLE.reserve), '對話列表：已完成 0 / 13、有 3 個新對話');

  // ── 自動玩 ──
  async function play(id, { wrongFirst = false } = {}) {
    await pg.goto(BASE + '/index.html');
    await pg.locator('.tile,.mod-row', { hasText: '情境對話' }).click();
    await pg.locator('.tile,.mod-row', { hasText: TITLE[id] }).click();
    const visited = [];
    let wrongDone = false;
    for (let steps = 0; steps < 60; steps++) {
      const p = await peek();
      if (p.type === 'done') return { done: true, visited };
      if (p.type === 'u') {
        if (wrongFirst && !wrongDone) {
          const i = p.options.findIndex((o) => !o.ok);
          if (i >= 0) { await pg.locator('.dlg-opt').nth(i).click(); wrongDone = true; visited.push('wrong:' + p.options[i].l); }
        }
        const i = p.options.findIndex((o) => o.ok);
        visited.push(p.options[i].l);
        await pg.locator('.dlg-opt').nth(i).click();
      } else if (p.type === 'check') {
        if (wrongFirst && !wrongDone) {
          const j = p.options.findIndex((o) => o !== p.answer);
          await pg.locator('.dlg-opt').nth(j).click();
          wrongDone = true;
          visited.push('wrongcheck');
        }
        visited.push('check:' + p.answer);
        await pg.locator('.dlg-opt').nth(p.options.indexOf(p.answer)).click(); // by position: 「可以」is contained in 「不可以」
      } else await pg.waitForTimeout(60);
    }
    return { done: false, visited };
  }

  // 觀光景點：兩條價錢路線，理解題的票價同總金額一致
  const pairs = new Set();
  let all = true;
  for (let i = 0; i < 14 && pairs.size < 2; i++) {
    const r = await play('sightseeing');
    all = all && r.done;
    pairs.add(r.visited.filter((v) => /^check:\d/.test(v)).join(' → '));
  }
  assert(all && pairs.size === 2 && pairs.has('check:1,000 円 → check:2,000 円') && pairs.has('check:1,500 円 → check:3,000 円'), '觀光景點：全部走完；1,000 円→總共 2,000 円、1,500 円→總共 3,000 円 ' + [...pairs]);
  const said = await pg.evaluate(() => window.__said);
  assert(said.some((t) => /^大人は(せん|せんごひゃく)円です。$/.test(t)), '朗讀用 say：「大人はせん円です。」／「大人はせんごひゃく円です。」');

  // 溫泉：卡／現金分支都走得完
  const onsenPaths = new Set();
  let onsenAll = true;
  for (let i = 0; i < 14 && onsenPaths.size < 3; i++) {
    const r = await play('onsen');
    onsenAll = onsenAll && r.done;
    onsenPaths.add(r.visited.includes('check:只能付現金') ? 'cash-only' : r.visited.includes('shop-14') ? 'card-ok' : 'cash-direct');
  }
  assert(onsenAll && onsenPaths.has('cash-only') && onsenPaths.has('card-ok'), '溫泉：全部走完；「可以用卡」同「只收現金」兩條付款路線都出現 ' + [...onsenPaths]);

  // 預約：預約成功／客滿兩個結果
  const reserveEnds = new Set();
  let reserveAll = true;
  for (let i = 0; i < 16 && reserveEnds.size < 2; i++) {
    const r = await play('reserve');
    reserveAll = reserveAll && r.done;
    reserveEnds.add(r.visited.includes('call-11') ? 'full' : r.visited.includes('call-15') ? 'booked' : 'other');
  }
  assert(reserveAll && reserveEnds.has('full') && reserveEnds.has('booked'), '預約：全部走完；「預約成功」同「客滿」兩個結果都出現 ' + [...reserveEnds]);
  const said2 = await pg.evaluate(() => window.__said);
  assert(said2.includes('チャンです。') || said2.includes('お待ちしております。') || said2.includes('申し訳ありません、満席です。'), '預約：朗讀有對話句子');

  // 成績同重溫
  let s = await st();
  const stat = s.dialogue.stats;
  assert(['sightseeing', 'onsen', 'reserve'].every((k) => stat[k] && stat[k].plays >= 1), '三個新對話各有成績記錄 ' + JSON.stringify(Object.fromEntries(['sightseeing', 'onsen', 'reserve'].map((k) => [k, stat[k] && stat[k].plays]))));
  assert(['sightseeing', 'onsen', 'reserve'].every((k) => stat[k].perfect === stat[k].plays), '全部答對的玩法都算「一次過全對」');
  const w = await play('onsen', { wrongFirst: true });
  assert(w.done && w.visited.some((v) => v.startsWith('wrong')), '先答錯一次再答對：仍然走完 ' + w.visited.join(' → '));
  s = await st();
  const keys = Object.keys(s.review.items);
  assert(keys.length > 0 && keys.every((k) => /^[ps]:(rest|shop|onsen|trans|polite|call|sight|hotel)-/.test(k)), '答錯進口語／聽力重溫（s:／p: key）' + keys);

  // 對話列表：已玩數
  await pg.goto(BASE + '/index.html');
  await pg.locator('.tile,.mod-row', { hasText: '情境對話' }).click();
  assert((await pg.locator('#main').innerText()).includes('已完成 3 / 13 個'), '玩過 3 個新對話後：已完成 3 / 13');
  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '對話列表沒有橫向捲動');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
