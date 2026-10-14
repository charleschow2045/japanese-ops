# Japanese Ops 自動測試

用 Playwright（Chromium）喺本機開 app 做測試；唔係 app 檔案，**唔會**放入 `sw.js` 嘅 `FILES`，亦唔計入「離線清單檢查」。

## 點執行

```bash
tests/run.sh                 # 全部 20 個
tests/run.sh c2 v3test       # 只跑指定嘅（唔使 .js）
```

- 要有 Node 同 Playwright（`npm i -g playwright`，或喺 repo 根目錄 `npm i playwright`）同一個 Chromium
  （預設用 `/opt/pw-browsers/chromium`，否則用 Playwright 自己嘅；可以用 `CHROMIUM=/path/to/chrome` 指定）
- `run.sh` 會自己用 `python3 -m http.server`（port `PORT`，預設 5804）開伺服器，跑完收返；
  如果已經有伺服器，設 `BASE_URL=http://localhost:xxxx`
- 單獨跑一個：`node tests/c2.js`（要先有伺服器；截圖會寫去 OS 暫存資料夾，唔會寫入 repo）
- 輸出：每個測試一行 `ok=通過數 fail=失敗數`，失敗嗰啲會列出 `FAIL …`；全部通過 exit code 0

## 測試清單

| 檔案 | 內容 |
|---|---|
| `cdata` | 303 句嘅資料（15 項）：id 唔重複、假名同日文對應、拼音由假名推算、各情境句數、`say` 12 句、hotel-22～25 冇動、指給店員看 14 張 `ref` 都搵到句子 |
| `nq` | 數字聽力出題（價錢／時間／番線…）窮舉（24 項）：讀音表對照、特別讀法、讀音唔重複、選項、範圍、key |
| `reg` | 聽力練習基本流程（15 項）：開始、答題、回饋、下一題、記錄一次答題、返回 |
| `again` | 數字聽力兩輪（23 項）：第 1 輪 5 題→結果分數＝記錄、答題數、錯題重溫數、今日活動；「再來一輪」重新由第 1 題開始，第 2 輪後累計 10 題 |
| `helpt` | 三張「怎樣用」說明卡、字表行列標示、片假名實例 120 個英文 |
| `btest` | 片假名實例 120 個詞、三項指定修改 |
| `air2` | 情境集版本 `sv`、舊存檔遷移、進度頁句子總數、備份 |
| `c2` `c3` | 新增情境（觀光景點／溫泉／預約與電話）、`sv` 3 遷移、指給店員看 `ref` 卡、聽力 20 題 |
| `dlg1` | 情境對話全部分支 |
| `show2` | 指給店員看（過敏卡、酒店資料、全螢幕畫面） |
| `nqbk` `nqrev` `nqdaily` `nqui` | 數字聽力：備份、錯題重溫、每日任務、畫面 |
| `dtest` | 深色／淺色模式、外觀設定、主頁 8 塊磚、`theme-color`、各頁對比度審計 |
| `v1test` | 版本一：主頁（Tabi、星星、連續天數、數字・價錢磚） |
| `v2test` `v2b` | 版本二：答題回饋、彩紙、減少動態效果、結果頁、口語回饋、對話答錯提示 |
| `v3test` | 版本三：進度頁大數字磚、模組顏色橫幅 |

## 加新測試／改測試

- 每個檢查都要輸出 `ok  …` 或 `FAIL …`（`run.sh` 靠呢啲行計數；淨係 `console.log` 結果會顯示 ok=0）
- 新增 `tests/xxx.js`，開頭用 `const { chromium, CHROME, BASE, OUT } = require('./lib')`（舊檔用 `require('./lib').BASE` 嘅寫法），
  `assert` 失敗時 `console.log('FAIL', …)` 並設 `process.exitCode = 1`，`run.sh` 就會計入
- **內容數字改咗（句數、詞數、磚數…）要同步更新相關測試**，唔好等測試過期
- `lib.js`：`BASE`、`CHROME`、`OUT`（截圖資料夾）、`ROOT`；`rom.js`：拼音產生器（`cdata` 用）
