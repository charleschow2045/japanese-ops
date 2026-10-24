// 錄音測試（stage 10 ⑩ 版本一）— 純 Node，唔使瀏覽器：錄音格式揀選（pickMime）、音量量度（peakPercent）、
// 診斷結果文字（buildReport）。畫面另見 rectestui.js（Playwright）。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = {};
win.window = win;
win.App = { UI: { h() {}, modHeader() {}, inkButton() {} }, Speech: { speak() {}, isTTSSupported: () => true } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/rectest.js'), 'utf8'), win);
const R = win.App.RecTest;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };

// ── pickMime ──
assert(R.MIME_CANDIDATES.join() === 'audio/webm;codecs=opus,audio/mp4,audio/webm,audio/ogg;codecs=opus,audio/mp4;codecs=mp4a.40.2', '候選格式次序');
assert(R.pickMime(() => true) === 'audio/webm;codecs=opus', '全部支援：揀 webm／opus');
assert(R.pickMime((m) => m === 'audio/mp4') === 'audio/mp4', '只支援 mp4（iPhone 18.4 之前）：揀 audio/mp4');
assert(R.pickMime((m) => m.startsWith('audio/mp4')) === 'audio/mp4', 'mp4 系列：揀 audio/mp4');
assert(R.pickMime(() => false) === '', '全部唔支援：回傳空字串（交俾瀏覽器預設）');
assert(R.pickMime((m) => { if (m === 'audio/webm;codecs=opus') throw new Error('x'); return m === 'audio/mp4'; }) === 'audio/mp4', 'isTypeSupported 拋錯：跳過呢個格式');

// ── peakPercent ──
assert(R.peakPercent(new Uint8Array(1024).fill(128)) === 0, '靜音（全部 128）＝ 0%');
assert(R.peakPercent(new Uint8Array([128, 128, 192, 128])) === 50, '最大偏離 64／128 ＝ 50%');
assert(R.peakPercent(new Uint8Array([0, 255, 128])) === 100, '滿幅 ＝ 100%');
assert(R.peakPercent(new Uint8Array([130, 126, 129])) === 2, '細聲（偏離 2）＝ 2%');
assert(R.peakPercent(new Uint8Array(0)) === 0, '空資料 ＝ 0%');

// ── buildReport ──
const env = { ios: true, standalone: true, secure: true, hasGUM: true, hasMR: true, types: [{ mime: 'audio/mp4', ok: true }, { mime: 'audio/webm', ok: false }], perm: 'prompt', tts: true, ua: 'UA-STRING' };
const rep = R.buildReport(env, ['[0.0s] a', '[3.0s] b']);
const lines = rep.split('\n');
assert(lines[0] === 'Japanese Ops 錄音測試' && lines[1] === '開啟方式：iPhone／iPad｜主畫面 App（獨立視窗）', '報告：標題同開啟方式');
assert(rep.includes('getUserMedia：有') && rep.includes('MediaRecorder：有') && rep.includes('安全連線（https）：是'), '報告：API 有無');
assert(rep.includes('audio/mp4 ✓｜audio/webm ✕'), '報告：每個格式 ✓／✕');
assert(rep.includes('麥克風權限狀態：prompt') && rep.includes('日文朗讀：有') && rep.includes('瀏覽器：UA-STRING'), '報告：權限、朗讀、瀏覽器');
assert(lines.includes('--- 紀錄 ---') && lines[lines.length - 2] === '[0.0s] a' && lines[lines.length - 1] === '[3.0s] b', '報告：紀錄列喺最後，次序照舊');
const rep2 = R.buildReport({ ...env, ios: false, standalone: false, hasGUM: false, hasMR: false, types: [], perm: undefined, secure: false, tts: false }, []);
assert(rep2.includes('開啟方式：其他裝置｜瀏覽器分頁') && rep2.includes('getUserMedia：沒有') && rep2.includes('MediaRecorder：沒有') && rep2.includes('安全連線（https）：否'), '報告：冇 API、非 https、瀏覽器分頁');
assert(rep2.includes('麥克風權限狀態：不明') && rep2.includes('錄音格式：（無法檢查）') && rep2.endsWith('（還沒有測試）'), '報告：權限不明、冇格式、冇紀錄');

console.log(bad ? `\n${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
