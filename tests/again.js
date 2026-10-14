// 數字聽力: play a 5-question round, check the result + stored numbers, then 再來一輪 and check again.
const { chromium } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch({ executablePath: require('./lib').CHROME });
  const pg = await (await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block' })).newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => {
    SpeechSynthesis.prototype.speak = function () {};
    SpeechSynthesis.prototype.cancel = function () {};
    localStorage.getItem('japaneseOps:v1') || localStorage.setItem('japaneseOps:v1', JSON.stringify({ numbers: { prefs: { cats: ['num'], level: 1, count: 5 }, stats: {} } }));
  });
  const st = () => pg.evaluate(() => JSON.parse(localStorage.getItem('japaneseOps:v1')));
  const answers = (s) => Object.values(s.numbers.stats).reduce((n, x) => n + x.c + x.w, 0);
  const wrongs = (s) => Object.values(s.numbers.stats).reduce((n, x) => n + x.w, 0);
  const corrects = (s) => Object.values(s.numbers.stats).reduce((n, x) => n + x.c, 0);
  const nKeys = (s) => Object.keys(s.review.items).filter((k) => k.startsWith('n:'));
  const today = (s) => (s.daily.activity[require('./lib').TODAY || new Date().toLocaleDateString('sv')] || { a: 0 }).a;

  await pg.goto(require('./lib').BASE + '/index.html');
  await pg.locator('.tile', { hasText: '數字・價錢' }).click();
  await pg.getByRole('button', { name: '🔢 開始數字聽力' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '數字聽力', 'quiz title 數字聽力');
  assert((await pg.locator('.caption').first().innerText()).includes('第 1 / 5 題'), 'round 1 starts at 第 1 / 5 題');

  // ---- round 1: answer 5, spreading over the four positions (score varies run to run; checks are consistency checks)
  const seen1 = [];
  for (let i = 0; i < 5; i++) {
    assert((await pg.locator('.opt').count()) === 4, `round 1 q${i + 1}: 4 options`);
    seen1.push((await pg.locator('.opt').allInnerTexts()).join('|'));
    await pg.locator('.opt').nth(i % 4).click();
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.result-hero').count()) === 1, 'round 1 result screen shown');
  const score1 = (await pg.locator('.score').innerText()).replace(/\s/g, '');
  let s = await st();
  assert(answers(s) === 5, 'round 1: 5 answers recorded (' + answers(s) + ')');
  assert(score1 === `${corrects(s)}/5`, `round 1: score ${score1} equals recorded correct answers (${corrects(s)})`);
  assert(nKeys(s).length <= wrongs(s) && (wrongs(s) === 0) === (nKeys(s).length === 0), `round 1: wrong answers (${wrongs(s)}) became 錯題重溫 items (${nKeys(s).length})`);
  assert(today(s) === 5, 'round 1: today activity = 5 (' + today(s) + ')');
  assert(new Set(seen1).size === 5, 'round 1: 5 different questions');
  const w1 = wrongs(s);
  const k1 = nKeys(s).length;

  // ---- 再來一輪
  await pg.getByRole('button', { name: '再來一輪' }).click();
  assert((await pg.locator('.mod-header h2').innerText()) === '數字聽力', 'round 2 is still 數字聽力');
  assert((await pg.locator('.caption').first().innerText()).includes('第 1 / 5 題'), 'round 2 starts again at 第 1 / 5 題');
  assert((await pg.locator('.opt').count()) === 4 && (await pg.locator('.fb-banner').count()) === 0, 'round 2: fresh question, 4 options, no old feedback');
  for (let i = 0; i < 5; i++) {
    await pg.locator('.opt').nth((i + 2) % 4).click();
    await pg.getByRole('button', { name: /下一題|查看結果/ }).click();
  }
  assert((await pg.locator('.result-hero').count()) === 1, 'round 2 result screen shown');
  const score2 = (await pg.locator('.score').innerText()).replace(/\s/g, '');
  s = await st();
  assert(answers(s) === 10, 'after round 2: 10 answers recorded (' + answers(s) + ')');
  assert(score2 === `${corrects(s) - (5 - w1)}/5`, `round 2: score ${score2} matches the answers added in round 2`);
  assert(wrongs(s) >= w1 && nKeys(s).length >= k1, 'review items never shrink while answering new questions');
  assert(today(s) === 10, 'today activity = 10 (' + today(s) + ')');
  assert(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no horizontal scroll');
  assert(errs.length === 0, 'no page errors ' + errs);
  await b.close();
})();
