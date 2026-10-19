// 五十音口訣（stage 10）：30 條資料（四種類型）、詳情頁顯示、形似漢字提示、今日新字課字卡、沒有口訣的字不顯示、不寫入存檔。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { SpeechSynthesis.prototype.speak = function () {}; SpeechSynthesis.prototype.cancel = function () {}; });
  await pg.goto(BASE + '/index.html');
  const main = () => pg.locator('#main').innerText();

  // ── 資料 ──
  const d = await pg.evaluate(() => {
    const C = App.Content, M = C.KANA_MNEMONICS, K = C.KANA;
    const glyphs = new Set(Object.values(K).flatMap((k) => [k.hira, k.kata].filter(Boolean)));
    const look = C.KANA_LOOKALIKES.flatMap((g) => g.chars);
    const by = {};
    M.forEach((m) => { by[m.kind] = (by[m.kind] || 0) + 1; });
    const text = (ch) => (C.KANA_MNEMONIC[ch] || {}).text;
    return {
      n: M.length, hira: M.filter((m) => /[ぁ-ん]/.test(m.char)).length, kata: M.filter((m) => /[ァ-ン]/.test(m.char)).length,
      unique: new Set(M.map((m) => m.char)).size, missing: M.filter((m) => !glyphs.has(m.char)).map((m) => m.char),
      empty: M.filter((m) => !m.emoji || !m.text || !m.text.startsWith(m.char)).map((m) => m.char),
      kinds: Object.keys(C.MNEMONIC_KINDS).sort().join(), used: Object.keys(by).sort().join(), by,
      badKind: M.filter((m) => !C.MNEMONIC_KINDS[m.kind]).length,
      lookalike: M.filter((m) => look.includes(m.char)).length,
      mi: text('ミ'), ro: text('ロ'), e: text('エ'), ni: text('ニ'), ha: text('ハ'), nu: text('ぬ'), me: text('め'), re: text('レ'), chi: text('ち'),
      kindOf: Object.fromEntries(['わ', 'ろ', 'レ', 'ひ', 'ぬ', 'の', 'ミ'].map((c) => [c, C.KANA_MNEMONIC[c].kind])),
      emoji: { ツ: C.KANA_MNEMONIC['ツ'].emoji, レ: C.KANA_MNEMONIC['レ'].emoji },
    };
  });
  assert(d.n === 30 && d.hira === 15 && d.kata === 15 && d.unique === 30, '30 條口訣：平假名 15、片假名 15、字不重複');
  assert(d.missing.length === 0 && d.empty.length === 0, '每個字都在五十音表、有 emoji、口訣文字以該字開頭 ' + d.missing + d.empty);
  assert(d.kinds === 'kanji,meaning,shape,sound' && d.badKind === 0, '四種類型：意義聯想、讀音聯想、形似漢字、字形');
  assert(d.by.kanji === 9 && d.by.meaning === 5 && d.by.sound === 9 && d.by.shape === 7, '各類型數目：形似漢字 9、意義 5、讀音 9、字形 7');
  assert(d.lookalike >= 24, '口訣以相似字分辨組裏的字為主（' + d.lookalike + ' / 30）');
  assert(d.mi.includes('mittsu') && !d.mi.includes('mitsu'), 'ミ：三つ（みっつ）拼音 mittsu');
  assert(d.ro === 'ロ 樣子像漢字「口」，讀 ro，和漢字「口」的讀音無關' && d.e === 'エ 樣子像漢字「工」，讀 e', 'ロ／エ：樣子像，不說「就是」');
  assert(d.ni === 'ニ 由漢字「二」演變而來，日文「二」讀 ni' && d.ha.startsWith('ハ 由漢字「八」演變而來'), 'ニ／ハ：由漢字演變而來');
  assert(d.nu.includes('小圈像麵條捲起') && d.me.includes('沒有小圈'), 'ぬ 末端小圈像麵條捲起；め 沒有小圈');
  assert(d.re === 'レ 像打勾，是「レモン」（remon，檸檬）的第一個字' && d.kindOf['レ'] === 'meaning' && d.emoji['レ'] === '🍋', 'レ：レモン、意義聯想、🍋');
  assert(d.chi === 'ち 像數字 5，下方的彎向右凸（さ 向左凸）' && d.emoji['ツ'] === '🐜', 'ち 向右凸（さ 向左凸）；ツ 用 🐜');
  assert(d.kindOf['わ'] === 'sound' && d.kindOf['ろ'] === 'sound' && d.kindOf['ひ'] === 'sound' && d.kindOf['ぬ'] === 'sound' && d.kindOf['の'] === 'shape' && d.kindOf['ミ'] === 'kanji', 'わ／ろ／ひ／ぬ＝讀音聯想；の＝字形；ミ＝形似漢字');

  // ── 詳情頁 ──
  const open = async (script, ch) => {
    await pg.locator('.tile', { hasText: '五十音' }).click();
    await pg.getByRole('button', { name: /字表/ }).first().click();
    await pg.locator('#main button', { hasText: new RegExp('^\\s*' + script + '\\s*$') }).click();
    await pg.locator('#main button').filter({ hasText: new RegExp('^\\s*' + ch) }).first().click();
  };
  await open('平假名', 'ぬ');
  assert((await pg.locator('.sheet .mnemo').count()) === 1 && (await pg.locator('.sheet .mnemo').innerText()).includes('讀音聯想'), '詳情頁（ぬ）：有口訣和類型「讀音聯想」');
  assert((await pg.locator('.sheet .mnemo-sub').count()) === 0, '非形似漢字類：沒有「只幫助記字形」提示');
  await pg.locator('.sheet-close').click();
  await pg.locator('#main button').filter({ hasText: /^\s*あ/ }).first().click();
  assert((await pg.locator('.sheet').count()) === 1 && (await pg.locator('.sheet .mnemo').count()) === 0, '沒有口訣的字（あ）：不顯示口訣區');
  await pg.locator('.sheet-close').click();
  await pg.locator('#main button', { hasText: /^\s*片假名\s*$/ }).click();
  await pg.locator('#main button').filter({ hasText: /^\s*ロ/ }).first().click();
  const ro = await pg.locator('.sheet .mnemo').innerText();
  assert(ro.includes('形似漢字') && ro.includes('只幫助記字形，讀音以日文為準'), '詳情頁（ロ）：形似漢字類附「只幫助記字形，讀音以日文為準」');
  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '詳情頁沒有橫向捲動');
  await pg.locator('.sheet-close').click();

  // ── 全部 30 個字都顯示，其他字都不顯示 ──
  const all = await pg.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const M = App.Content.KANA_MNEMONIC;
    const out = { shown: 0, wrong: [] };
    for (const script of ['平假名', '片假名']) {
      [...document.querySelectorAll('#main button')].find((x) => x.textContent.trim() === script).click();
      await sleep(120);
      const seen = new Set();
      const cells = [...document.querySelectorAll('#main button')].filter((x) => /^[ぁ-んァ-ン]/.test(x.textContent.trim()) && !x.classList.contains('chip'));
      for (const c of cells) {
        const ch = c.textContent.trim().slice(0, 1);
        if (seen.has(ch)) continue;
        seen.add(ch);
        c.click();
        await sleep(30);
        const sh = document.querySelector('.sheet');
        const has = !!(sh && sh.querySelector('.mnemo'));
        if (has) out.shown++;
        if (has !== !!M[ch]) out.wrong.push(ch);
        if (sh) sh.querySelector('.sheet-close').click();
        await sleep(20);
      }
    }
    return out;
  });
  assert(all.shown === 30 && all.wrong.length === 0, '字表詳情頁：剛好 30 個字有口訣 ' + all.wrong);

  // ── 今日新字課（路線第 3 天：な行・は行）字卡 ──
  await pg.evaluate(() => {
    const S = App.Storage, x = S.loadState(), days = { ...x.daily.days };
    delete days[S.todayLocal()];
    localStorage.setItem('japaneseOps:v1', JSON.stringify({ ...x, daily: { ...x.daily, days }, path: { mode: 'route', start: 3, doneDays: {}, skipDays: {}, promptSeen: true } }));
  });
  await pg.reload();
  await pg.locator('#main button', { hasText: /開始今日任務|繼續：/ }).first().click();
  await pg.getByRole('button', { name: /學習新字/ }).click();
  const lesson = await pg.evaluate(() => [...document.querySelectorAll('.lesson-card')].map((c) => [c.querySelector('.lesson-ch').textContent, !!c.querySelector('.lesson-mnemo')]));
  const with_ = lesson.filter((x) => x[1]).map((x) => x[0]).join('');
  assert(lesson.length === 10 && with_ === 'ぬねのはひふほ', '新字課（第 3 天）：10 張字卡，ぬ ね の は ひ ふ ほ 有口訣，其餘沒有（' + with_ + '）');
  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '新字課沒有橫向捲動');

  // ── 不寫入存檔 ──
  const raw = await pg.evaluate(() => localStorage.getItem('japaneseOps:v1'));
  assert(!/mnemo|口訣/.test(raw), '口訣是固定內容，不寫入存檔（備份不受影響）');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})().catch((e) => { console.log('ERR', e.message.slice(0, 300)); process.exit(1); });
