// 錄音測試畫面（stage 10 ⑩ 版本一）— 設定 → 🎙️ 錄音測試：入口、環境清單、錄音 3 秒（用 Chromium 假麥克風）、
// 播放、診斷結果文字、離開即放開麥克風、麥克風被拒絕／冇 API 嘅提示、備用方法（file input）、
// 純讀取（唔寫存檔、唔建 IndexedDB）、320px／深色。純函數另見 rectest.js（純 Node）。
const { chromium, BASE, CHROME } = require('./lib');
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

// every stream handed out by getUserMedia is remembered so the test can see whether its tracks were stopped
const TRACK_SPY = () => {
  window.__tracks = [];
  window.__said = [];
  SpeechSynthesis.prototype.speak = function (u) { window.__said.push(u.text); };
  SpeechSynthesis.prototype.cancel = function () {};
  const md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await orig(c); s.getTracks().forEach((t) => window.__tracks.push(t)); return s; };
  }
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const open = async (initScript, perms = ['microphone']) => {
    const ctx = await b.newContext({ viewport: { width: 375, height: 760 }, serviceWorkers: 'block', permissions: perms });
    const pg = await ctx.newPage();
    pg.setDefaultTimeout(6000);
    pg.errs = [];
    pg.on('pageerror', (e) => pg.errs.push(e.message));
    await pg.addInitScript(TRACK_SPY);
    if (initScript) await pg.addInitScript(initScript);
    await pg.goto(BASE + '/index.html');
    await pg.evaluate(() => localStorage.clear());
    await pg.reload();
    await pg.locator('.tab', { hasText: '設定' }).click();
    return pg;
  };
  const toTest = async (pg) => { await pg.locator('#main button', { hasText: /^開始測試$/ }).click(); await pg.waitForSelector('.rec-report'); };
  const report = (pg) => pg.locator('.rec-report').inputValue();
  const recBtn = (pg) => pg.locator('#main .btn-ink').first();

  // ── 入口 ──
  let pg = await open();
  const entry = pg.locator('#main .card', { hasText: '錄音測試（試驗）' });
  assert((await entry.count()) === 1 && (await entry.innerText()).includes('不會儲存或上傳任何錄音'), '設定頁有「🎙️ 錄音測試（試驗）」入口，說明唔儲存、唔上傳');
  const stateBefore = await pg.evaluate(() => localStorage.getItem('japaneseOps:v1'));
  await toTest(pg);
  assert((await pg.locator('.mod-header h2').innerText()) === '錄音測試', '打開錄音測試頁');

  // ── 環境 ──
  const env = await pg.locator('.rec-env').innerText();
  for (const k of ['開啟方式', '安全連線', 'getUserMedia', 'MediaRecorder', '可用的錄音格式', '麥克風權限狀態', '日文朗讀']) assert(env.includes(k), '環境清單有：' + k);
  assert((await pg.locator('.rec-env li').count()) === 7, '環境清單 7 行');
  let rep = await report(pg);
  assert(rep.startsWith('Japanese Ops 錄音測試') && rep.includes('瀏覽器：') && rep.endsWith('（還沒有測試）'), '診斷結果：標題、瀏覽器、「還沒有測試」');
  assert((await pg.locator('.rec-audio').count()) === 0, '未錄音：冇播放器');
  assert((await pg.locator('.rec-file input').count()) === 2 && (await pg.locator('.rec-file input').nth(0).getAttribute('capture')) !== null && (await pg.locator('.rec-file input').nth(1).getAttribute('capture')) === null, '備用方法 A 有 capture、B 冇');

  // ── 錄音 3 秒 ──
  await recBtn(pg).click();
  assert((await recBtn(pg).isDisabled()) && (await pg.locator('#rec-count').innerText()).length > 0, '錄音中：掣停用、有狀態文字');
  await pg.waitForFunction(() => document.querySelector('.rec-audio'), null, { timeout: 8000 });
  rep = await report(pg);
  assert(rep.includes('取得麥克風') && rep.includes('開始錄音') && rep.includes('已停止麥克風（音軌狀態：ended）') && rep.includes('錄音完成：格式'), '紀錄：取得麥克風、開始錄音、已停止麥克風、錄音完成');
  assert(/最大音量：\d+%/.test(rep), '紀錄：有最大音量');
  const size = Number((rep.match(/，(\d+) bytes/) || [])[1] || 0);
  assert(size > 0, '錄到資料 ' + size + ' bytes');
  assert(await pg.evaluate(() => window.__tracks.length > 0 && window.__tracks.every((t) => t.readyState === 'ended')), '錄完即停止所有音軌（放開麥克風）');
  assert(!(await recBtn(pg).isDisabled()), '錄完：掣恢復可按');
  assert((await pg.locator('.rec-audio').first().getAttribute('src')).startsWith('blob:'), '播放器用 blob 連結（只喺記憶體）');
  const dur = await pg.evaluate(() => new Promise((res) => { const a = document.querySelector('.rec-audio'); if (a.readyState >= 1) res(a.duration); else { a.addEventListener('loadedmetadata', () => res(a.duration)); setTimeout(() => res(-1), 3000); } }));
  assert(dur === -1 || dur === Infinity || (dur > 1 && dur < 6), '錄音長度約 3 秒（' + dur + '）');

  // ── 朗讀測試 ──
  await pg.locator('#main button', { hasText: 'あいうえお' }).click();
  assert((await pg.evaluate(() => window.__said)).join() === 'あいうえお', '朗讀測試：讀「あいうえお」');
  assert((await report(pg)).includes('按下「朗讀」測試'), '朗讀測試記入紀錄（唔重畫，播放器保留）');
  assert((await pg.locator('.rec-audio').count()) === 1, '朗讀後播放器仍然喺度');

  // ── 備用方法 ──
  await pg.locator('.rec-file input').nth(0).setInputFiles({ name: 'memo.m4a', mimeType: 'audio/mp4', buffer: Buffer.alloc(1234, 1) });
  rep = await report(pg);
  assert(rep.includes('備用方法 A：memo.m4a，audio/mp4，1234 bytes') && (await pg.locator('.rec-audio').count()) === 2, '備用方法 A：紀錄檔名／格式／大小，多一個播放器');
  await pg.locator('.rec-file input').nth(1).setInputFiles({ name: 'x.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(88, 1) });
  assert((await report(pg)).includes('備用方法 B：x.wav，audio/wav，88 bytes'), '備用方法 B：紀錄');

  // ── 再錄一次：舊錄音被取代 ──
  await recBtn(pg).click();
  await pg.waitForFunction(() => document.querySelector('.rec-audio') && !document.querySelector('#main .btn-ink').disabled, null, { timeout: 8000 });
  assert((await report(pg)).split('開始錄音').length === 2, '再錄：紀錄重新開始（只有一次「開始錄音」）');

  // ── 純讀取 ──
  assert((await pg.evaluate(() => localStorage.getItem('japaneseOps:v1'))) === stateBefore, '整個測試過程：存檔完全冇變');
  assert((await pg.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0))) === 0, '冇建立 IndexedDB');

  // ── 版面：320px、深色 ──
  for (const [w, scheme] of [[375, 'light'], [320, 'light'], [375, 'dark'], [320, 'dark']]) {
    await pg.emulateMedia({ colorScheme: scheme });
    await pg.setViewportSize({ width: w, height: 700 });
    await pg.waitForTimeout(150);
    const m = await pg.evaluate(() => ({
      h: document.documentElement.scrollWidth > innerWidth,
      small: [...document.querySelectorAll('#main button, .rec-file')].filter((e) => e.getBoundingClientRect().height < 43.5).length,
      over: [...document.querySelectorAll('#main *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length,
    }));
    assert(!m.h && m.small === 0 && m.over === 0, `${w}px ${scheme}：冇橫向捲動、掣 ≥ 44px、冇內容超出（${JSON.stringify(m)}）`);
  }
  const contrast = await pg.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const bgOf = (e) => { while (e) { const x = getComputedStyle(e).backgroundColor; if (x && !/rgba\(0, 0, 0, 0\)/.test(x)) return x; e = e.parentElement; } return 'rgb(255,255,255)'; };
    const bad = [];
    document.querySelectorAll('#main *').forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const a = lum(getComputedStyle(e).color), c = lum(bgOf(e)); const r = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      if (r < 4.5) bad.push(e.className + ' ' + r.toFixed(2));
    });
    return bad;
  });
  assert(contrast.length === 0, '深色：文字對比 ≥ 4.5 ' + contrast.slice(0, 3));
  await pg.emulateMedia({ colorScheme: 'light' });
  await pg.setViewportSize({ width: 375, height: 760 });

  // ── 返回：回到設定頁，再入來係乾淨嘅 ──
  await pg.locator('.mod-header .btn-back').click();
  assert((await pg.locator('.rec-report').count()) === 0 && (await entry.count()) === 1, '「← 返回」：回到設定頁');
  await toTest(pg);
  assert((await pg.locator('.rec-audio').count()) === 0 && (await report(pg)).endsWith('（還沒有測試）'), '再入：錄音同紀錄已清走');
  assert(pg.errs.length === 0, 'errs ' + JSON.stringify(pg.errs));
  await pg.context().close();

  // ── 錄音中離開（切換分頁）：馬上放開麥克風 ──
  pg = await open();
  await toTest(pg);
  await recBtn(pg).click();
  await pg.waitForFunction(() => window.__tracks.length > 0 && window.__tracks[0].readyState === 'live');
  await pg.locator('.tab', { hasText: '主頁' }).click();
  await pg.waitForTimeout(300);
  assert(await pg.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended')), '錄音中切換分頁：音軌即時停止');
  await pg.waitForTimeout(3500);
  await pg.locator('.tab', { hasText: '設定' }).click();
  assert((await pg.locator('.rec-report').count()) === 0, '離開後返設定：唔會殘留錄音頁');
  assert(pg.errs.length === 0, '離開後冇錯誤 ' + JSON.stringify(pg.errs));
  await pg.context().close();

  // ── 麥克風被拒絕 ──
  pg = await open(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); }; });
  await toTest(pg);
  await recBtn(pg).click();
  await pg.waitForFunction(() => document.querySelector('.rec-report').value.includes('取得麥克風失敗'));
  rep = await report(pg);
  assert(rep.includes('取得麥克風失敗：NotAllowedError：Permission denied') && !rep.includes('開始錄音'), '被拒絕：紀錄 NotAllowedError，冇開始錄音');
  assert(!(await recBtn(pg).isDisabled()) && (await pg.locator('.rec-audio').count()) === 0, '被拒絕：掣恢復可按、冇播放器');
  assert(pg.errs.length === 0, '被拒絕：冇未處理錯誤 ' + JSON.stringify(pg.errs));
  await pg.context().close();

  // ── 冇麥克風 API（例如舊版主畫面 App）──
  pg = await open(() => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); });
  await toTest(pg);
  const env2 = await pg.locator('.rec-env li').filter({ hasText: 'getUserMedia' }).innerText();
  assert(env2.includes('✕'), '冇 mediaDevices：環境清單 getUserMedia 打 ✕');
  assert((await report(pg)).includes('getUserMedia：沒有'), '診斷結果：getUserMedia 沒有');
  await recBtn(pg).click();
  await pg.waitForFunction(() => document.querySelector('.rec-report').value.includes('失敗：這個環境沒有'));
  assert((await report(pg)).includes('失敗：這個環境沒有 navigator.mediaDevices.getUserMedia') && !(await recBtn(pg).isDisabled()), '冇 API：提示原因、掣恢復可按');
  assert(pg.errs.length === 0, '冇 API：冇未處理錯誤 ' + JSON.stringify(pg.errs));
  await pg.context().close();

  await b.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
