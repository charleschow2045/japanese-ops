// 我的卡片（stage 10 ⑨）— 純 Node，唔使瀏覽器：
// 新增／編輯／刪除（saveCustomCard／deleteCustomCard）、上限 20 張、字數上限（日文 200／假名 200／備註 100）、
// 空白日文唔收、id 編號、清理（cleanCustomCards）、舊存檔補預設、進度備份往返、舊備份、竄改備份。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const win = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
win.window = win;
win.App = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8'), win);
const S = win.App.Storage;
let bad = 0;
const assert = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const fresh = () => JSON.parse(JSON.stringify(S.loadState()));
const L = S.CUSTOM_LIMITS;

assert(S.CUSTOM_MAX === 20 && L.ja === 200 && L.kana === 200 && L.note === 100, '上限：20 張、日文 200／假名 200／備註 100');
assert(Array.isArray(fresh().show.custom) && fresh().show.custom.length === 0, '全新存檔：custom 係空陣列');

// ── 新增 ──
let s = fresh();
const a = S.saveCustomCard(s, { ja: '窓側の席をお願いします。', kana: 'まどがわのせきをおねがいします', note: '麻煩給我靠窗的座位' });
assert(a.ok && a.id === 'c-1' && a.state.show.custom.length === 1, '新增：第一張 id＝c-1');
assert(JSON.stringify(a.state.show.custom[0]) === JSON.stringify({ id: 'c-1', ja: '窓側の席をお願いします。', kana: 'まどがわのせきをおねがいします', note: '麻煩給我靠窗的座位' }), '新增：三個欄位照存');
assert(JSON.stringify(s.show.custom) === '[]', '新增：唔改原本 state（不可變）');
const b = S.saveCustomCard(a.state, { ja: 'アレルギーがあります。' });
assert(b.ok && b.id === 'c-2' && b.state.show.custom[1].kana === '' && b.state.show.custom[1].note === '', '新增：假名同備註選填，冇填就係空字串');
const e1 = S.saveCustomCard(b.state, { ja: '   ' });
assert(!e1.ok && e1.reason === 'empty' && e1.state === b.state, '日文空白：唔收（reason empty）');
assert(!S.saveCustomCard(b.state, { ja: '', kana: 'あ' }).ok, '只填假名唔收');

// ── 字數上限 ──
const long = S.saveCustomCard(fresh(), { ja: 'あ'.repeat(300), kana: 'い'.repeat(300), note: 'う'.repeat(300) });
assert(long.state.show.custom[0].ja.length === 200 && long.state.show.custom[0].kana.length === 200 && long.state.show.custom[0].note.length === 100, '超長：日文截 200、假名截 200、備註截 100');
const ctl = S.saveCustomCard(fresh(), { ja: 'ab\u0001c\u0000d\u007fe\nf', kana: '', note: '' });
assert(ctl.state.show.custom[0].ja === 'abcde\nf', '控制字元去走（換行保留）');

// ── 編輯 ──
const ed = S.saveCustomCard(b.state, { id: 'c-1', ja: '窓側の席でお願いします。', kana: '', note: '改咗' });
assert(ed.ok && ed.id === 'c-1' && ed.state.show.custom.length === 2 && ed.state.show.custom[0].ja === '窓側の席でお願いします。' && ed.state.show.custom[0].kana === '' && ed.state.show.custom[1].id === 'c-2', '編輯：只改嗰張，次序同其他卡不變，假名可以清空');
assert(S.saveCustomCard(b.state, { id: 'c-9', ja: 'x' }).reason === 'missing', '編輯唔存在嘅 id：reason missing');
assert(S.saveCustomCard(b.state, { id: 'c-1', ja: ' ' }).reason === 'empty', '編輯時日文清空：唔收');

// ── 刪除、id ──
const del = S.deleteCustomCard(b.state, 'c-1');
assert(del.show.custom.length === 1 && del.show.custom[0].id === 'c-2', '刪除：只刪嗰張');
assert(S.deleteCustomCard(b.state, 'c-9').show.custom.length === 2, '刪除唔存在嘅 id：冇變');
assert(S.saveCustomCard(del, { ja: 'x' }).id === 'c-3', '之後新增：id 接最大編號 +1（c-3）');
assert(S.saveCustomCard(S.deleteCustomCard(b.state, 'c-2'), { ja: 'x' }).id === 'c-2', '刪走最大編號之後，新增會重用 c-2');

// ── 上限 20 張 ──
let full = fresh();
for (let i = 0; i < 20; i++) full = S.saveCustomCard(full, { ja: '卡' + i }).state;
assert(full.show.custom.length === 20 && full.show.custom[19].id === 'c-20', '加到 20 張');
const over = S.saveCustomCard(full, { ja: '第 21 張' });
assert(!over.ok && over.reason === 'full' && over.state === full, '第 21 張：唔收（reason full）');
assert(S.saveCustomCard(full, { id: 'c-5', ja: '改第 5 張' }).ok, '滿咗仍然可以編輯');
assert(S.saveCustomCard(S.deleteCustomCard(full, 'c-7'), { ja: '補一張' }).ok, '刪一張之後又可以新增');

// ── 清理（讀存檔、備份都用）──
const dirty = S.cleanCustomCards([
  { id: 'c-1', ja: 'a'.repeat(500), kana: 5, note: 'n'.repeat(300) },
  { id: 'bad', ja: 'x' }, { id: 'c-1', ja: 'dup' }, null, 'str', [], { id: 'c-2', ja: '  ' },
  { id: '__proto__', ja: 'x' }, { id: 'c-3', ja: 'ok\u0001z' }, { id: 'c-1234567890', ja: 'x' }, { ja: 'noid' }, { id: 'c-4', ja: 5 },
]);
assert(dirty.map((c) => c.id).join() === 'c-1,c-3', '清理：壞 id、重複 id、空日文、非物件、型別錯全部丟棄（剩 c-1、c-3）');
assert(dirty[0].ja.length === 200 && dirty[0].kana === '' && dirty[0].note.length === 100 && dirty[1].ja === 'okz', '清理：截字數、型別錯當空、控制字元去走');
assert(S.cleanCustomCards('x').length === 0 && S.cleanCustomCards(null).length === 0 && S.cleanCustomCards({}).length === 0, '清理：唔係陣列就當冇');
assert(S.cleanCustomCards(Array.from({ length: 50 }, (_, i) => ({ id: 'c-' + (i + 1), ja: 'x' }))).length === 20, '清理：超過 20 張只留前 20');

// ── 舊存檔 ──
const oldSave = JSON.parse(JSON.stringify(fresh())); delete oldSave.show.custom;
const store = { v: JSON.stringify(oldSave) };
const win2 = { localStorage: { getItem: () => store.v, setItem(_, v) { store.v = v; }, removeItem() {} } };
win2.window = win2; win2.App = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8'), win2);
assert(JSON.stringify(win2.App.Storage.loadState().show.custom) === '[]', '舊存檔（冇 custom）：補空陣列，其他 show 資料照舊');
const withBad = JSON.parse(JSON.stringify(fresh())); withBad.show.custom = 'oops';
store.v = JSON.stringify(withBad);
assert(JSON.stringify(win2.App.Storage.loadState().show.custom) === '[]', '存檔入面 custom 型別錯：當冇');

// ── 進度備份 ──
let st = fresh();
st = S.saveCustomCard(st, { ja: '窓側の席をお願いします。', kana: 'まどがわのせきをおねがいします', note: '靠窗' }).state;
st = S.saveCustomCard(st, { ja: 'アレルギーがあります。' }).state;
const file = JSON.stringify(S.buildBackup(st));
const parsed = S.parseBackup(file);
assert(parsed.ok && JSON.stringify(parsed.state.show.custom) === JSON.stringify(st.show.custom), '備份往返：自訂卡片完全相同');
const tamper = (fn) => { const o = JSON.parse(file); fn(o.data['japaneseOps:v1']); return S.parseBackup(JSON.stringify(o)); };
const noCustom = tamper((x) => { delete x.show.custom; });
assert(noCustom.ok && JSON.stringify(noCustom.state.show.custom) === '[]' && noCustom.state.show.saved.hotelName === st.show.saved.hotelName, '舊備份（冇 custom）：照常還原，custom 補空陣列');
const wrong = tamper((x) => { x.show.custom = 'x'; });
assert(wrong.ok && wrong.state.show.custom.length === 0, '備份 custom 型別錯：當冇，備份仍然有效');
const evil = tamper((x) => { x.show.custom = [{ id: '__proto__', ja: 'x' }, { id: 'c-1', ja: 'a'.repeat(999), kana: {}, note: [] }, { id: 'c-1', ja: 'dup' }, { id: 'c-2', ja: 'ok' }]; });
assert(evil.ok && evil.state.show.custom.map((c) => c.id).join() === 'c-1,c-2' && evil.state.show.custom[0].ja.length === 200 && evil.state.show.custom[0].kana === '' && evil.state.show.custom[0].note === '', '竄改備份：壞項丟棄、超長截斷、型別錯當空');
const many = tamper((x) => { x.show.custom = Array.from({ length: 80 }, (_, i) => ({ id: 'c-' + (i + 1), ja: 'x' })); });
assert(many.ok && many.state.show.custom.length === 20, '竄改備份：超過 20 張只留 20');
assert(evil.state.show.custom.every((c) => Object.keys(c).join() === 'id,ja,kana,note') && !('polluted' in {}), '每張卡只有 id／ja／kana／note 四個欄位');

console.log(bad ? `\n${bad} 項失敗` : '\n全部通過');
process.exit(bad ? 1 : 0);
