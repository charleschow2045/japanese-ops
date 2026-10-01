# Japanese Ops — 日文旅行會話學習 App

## 項目目標
為一位完全零基礎的香港成人（母語廣東話，懂繁體中文，懂英文）製作日文學習網頁 App。
唯一目標：**去日本旅行時可以應付基本會話**（點餐、購物、交通、酒店、問路、緊急情況）。
不以 JLPT 考試為目標，不教深入文法。

## 技術規格
- **純 HTML/CSS/JS，不依賴任何外部 CDN**：無 build step，無後端，無框架
  - 不用 React、Babel、Tailwind 或任何網上載入嘅檔案；所有 CSS、JavaScript、字體都放喺 repo 入面
    （方便做離線 PWA）。**唔好加 `<script src="https://…">` 或 `<link href="https://…">`**
  - （2026-09-26 由 React + Babel 改寫。English Ops / Chinese Ops 仍然係 React + Babel CDN，
    所以只係外觀一致，程式碼唔可以直接抄過嚟）
  - 結構：`index.html`、`css/app.css`、`js/*.js`（普通 `<script>` 按次序載入，全部掛喺 `window.App`）、
    `fonts/`（自己 host 嘅字體）；所有路徑用相對路徑
  - 畫面做法：`js/ui.js` 嘅 `h()` 用嚟砌 DOM；state 一變就成個畫面重新 render（`App.render()`）
- 部署於 GitHub Pages（repo：japanese-ops），日後可能搬到自購網站，所以不要依賴 GitHub 專屬功能
- **手機優先設計**：主要在手機上使用（包括旅行途中），按鈕要夠大，單手可操作
- **導航：底部 tab 列**（主頁／設定），固定喺畫面底部，照顧 iPhone safe-area
- 進度及設定儲存在 localStorage（key：`japaneseOps:v1`）
- 發音：Web Speech API（SpeechSynthesis，lang = "ja-JP"）
- 口語練習：Web Speech API（SpeechRecognition，lang = "ja-JP"）
- 若瀏覽器不支援語音功能，要顯示清楚提示，其他功能照常運作
- 與 English Ops / Chinese Ops 保持相近的設計風格和操作方式
- **顏色和字體跟 english-ops 一致**（「探險護照」系統）：
  - 顏色（`css/app.css` 頂部 CSS 變數）：`--paper` #EFE6D3（牛皮紙底色）、`--ink` #233142（字）、
    `--stamp` #A83A3A（印章紅，主要按鈕／重點）、`--gold` #B8923A（成就／分數）；
    模組顏色分兩個色系：`mapBlue`（#2F6B7A 系）和 `forestGreen`（#3F6B4A 系），
    每個模組用 `--a-solid`／`--a-dark`／`--a-tint`／`--a-border`／`--a-on` 設定（見 `js/ui.js` 嘅 `MODULE_ACCENTS`）
  - 字體：標題用 "Special Elite"，內文用 "Baloo 2"，兩個都放喺 `fonts/`（`@font-face`）；
    中文同日文用裝置內建字體（Noto CJK 每個幾 MB，太大唔 host）；日文字一律加 `lang="ja"` 同 class `jp`
  - 元件樣式同 english-ops 嘅 `PaperCard`／`InkButton`／`PaperBackButton` 睇落一樣，
    喺 CSS 叫 `.card`／`.btn-ink`／`.btn-back`

## 內容規則（非常重要）
- 所有日文句子必須是自然、標準的日文，使用禮貌體（です／ます）
- 每句都要顯示四行：日文原文、假名讀音、羅馬拼音、廣東話口語解釋
- 羅馬拼音可以開關（設定頁），方便日後逐步戒掉
- 羅馬拼音用平文式（Hepburn）：shi、chi、tsu、fu、ji、zu；を 寫 o
- 解釋用繁體中文、廣東話口語，例如：
  - すみません ／ sumimasen ／ 唔該、唔好意思
  - これはいくらですか ／ kore wa ikura desu ka ／ 呢個幾多錢？
  - トイレはどこですか ／ toire wa doko desu ka ／ 洗手間喺邊？
- **廣東話近似讀音**（五十音用）：
  - 只給有把握的；沒有對應的顯示「廣東話冇對應，請聽發音」
  - 一律標明係「近似讀音」，只取聲母韻母、唔理聲調，以發音為準
  - 設定頁有開關可以隱藏
  - 一字多音嘅漢字要加提示，例如「咪（咪高峰嘅咪）」
- 對任何句子的準確性不肯定時，不要加入，列在本檔案最底的「待確認內容」
- 加入內容後，逐句自我檢查一次（日文、假名、拼音、中文意思是否對應）

## 功能模組
1. **五十音**：平假名、片假名字卡；看字選音、聽音選字；片假名優先配合真實例子（餐牌、商品、車站）
2. **情境句子庫**：按情境分類——基本禮貌、餐廳、購物、交通、酒店、問路、緊急情況；每句可按鍵聽發音
3. **聽力練習**：播放句子，選擇正確意思
4. **口語練習**：顯示中文意思，用戶讀出日文，用語音辨識比對並給簡單回饋
5. **看得明**：真實生活片假名詞彙（例如 メニュー、ラーメン、コーヒー、ホテル）的認讀練習
6. **情境對話**：預設劇本的分支對話（例如店員問「店內用還是外賣？」，用戶選擇回應）
7. **每日任務及進度**：每日 15–20 分鐘的任務；記錄已學句子；錯題自動重溫（間隔重複）

## 開發階段（每次只做一個階段）
（2026-09-26 調整：階段 1 分成 1a／1b；加入離線 PWA 階段，排喺階段 2 之後，所以原本嘅階段 3–6 順延為 4–7）
- 階段 1a：基本框架（主頁、底部 tab 導航、設定、localStorage）+ 五十音：清音、濁音、半濁音
  （含廣東話近似讀音及其開關；片假名實例只用 1a 教過嘅假名，即唔含拗音、っ、ー）
- 階段 1b：五十音：拗音、促音っ、長音ー、片假名外來語組合（チェ、ティ、ファ…）；片假名實例加入含呢啲寫法嘅詞（例如 メニュー、コーヒー）
  **1a 和 1b 都要在階段 2 之前完成**
- 階段 2：情境句子庫（先做基本禮貌、餐廳、購物三個情境）+ 發音
- 階段 3：離線使用（PWA：manifest、service worker、可加到主畫面，旅行途中冇網都用到）
- 階段 4：聽力練習 + 錯題重溫
- 階段 5：其餘情境（交通、酒店、問路、緊急情況）
- 階段 6：口語練習（語音辨識）
- 階段 7：情境對話 + 每日任務及進度頁

## 工作規則
- 每次開始前先讀本檔案，並說明計劃做甚麼，等我確認才動手
- 每次只做一個階段或一個功能，不要一次過改動整個 App
- 已經正常運作的部分，除非我要求，不要重寫
- 完成後列出我要測試的項目（在手機和電腦上各應該試甚麼）
- 完成一個階段後，更新本檔案的「進度記錄」
- 回覆用繁體中文

## 進度記錄
- **階段 1a — 完成（2026-09-26）**；同日由 React + Babel 改寫成純 HTML/CSS/JS（功能、內容、外觀不變）
  - 檔案結構（`index.html` 用普通 `<script>` 按次序載入，冇任何外部網址）：
    - `css/app.css`：全部樣式（取代 Tailwind），頂部係顏色 CSS 變數同 `@font-face`
    - `fonts/`：`Baloo2.woff2`（SIL OFL，`Baloo2-OFL.txt`）、`SpecialElite.woff2`（Apache 2.0，
      `SpecialElite-LICENSE.txt`），只含拉丁字母子集，兩個加埋約 86KB
    - `js/storage.js`：`MODULES`（7 個模組，只有 `kana` 係 `implemented`）、
      `loadState`／`saveState`／`clearState`、`recordKanaAnswer`。state 形狀：
      `{ settings: { showRomaji, showYue, voiceURI, rate }, kana: { stats, mistakes, prefs } }`；
      `kana.stats` 以字本身做 key（あ 同 ア 分開計）：`{ c, w, last }`；
      `kana.mistakes` = 答錯而之後未答啱過嘅字（為階段 4 錯題重溫預留，1a 只記錄、喺字表顯示紅點）；
      `kana.prefs` = 練習用嘅文字（hira／kata／both）同範圍（行 key）。讀取時會同預設值合併，舊存檔唔會壞
    - `js/ui.js`：`h(tag, attrs, ...children)` 砌 DOM（`on…` 係事件、`style` 可以係 object 連 CSS 變數）；
      `MODULE_ACCENTS` + `accentVars(key)`（喺外層元素設定 `--a-*` 變數，入面嘅 chip／`.btn-ink.accent`／
      `.card.accent` 自動用模組顏色）；`jp()`、`inkButton()`、`backButton()`、`modHeader()`、`chip()`、`toggle()`
    - `js/speech.js`：`speak(text, settings)`（lang ja-JP，揀用戶設定嘅語音，否則第一個日文語音）、
      `onVoicesChanged(cb)`（語音遲咗載入時重畫）、`speechNotice()`（冇日文語音／唔支援時嘅提示）。
      **發音一定要喺撳掣嘅 handler 入面觸發**（iOS Safari 規定），所以聽音選字第一題係喺選單撳掣嗰下已經建立題目同播音
    - `js/content/kana.js`：`KANA`（1a 時 71 個：清音 46、濁音 20、半濁音 5；1b 新增見下面；每個有平假名、片假名、
      Hepburn 拼音、`yue` 廣東話近似讀音或 null、提示）、`KANA_ROWS`（字表排位）、`KANA_GROUPS`、
      `KATAKANA_EXAMPLES`（23 個，只用 1a 教過嘅假名）
    - `js/kana.js`：選單 → 字表（撳字發音 + 詳情彈出頁，片假名會列出含呢個字嘅實例）、
      看字選音、聽音選字（每輪 10 題）、片假名實例。畫面狀態放喺模組內嘅 `ui` object；
      `render(ctx)` 回傳 `{ main, overlay }`（詳情頁要放喺 `#overlay`，先可以蓋住底部 tab）
    - `js/home.js`、`js/settings.js`、`js/app.js`（state、底部 tab：主頁／設定；撳「主頁」一定返模組列表；
      `App.render(opts)` 成個畫面重畫；元素有 `data-autoscroll` 就喺重畫後捲到佢，例如答題後嘅解釋卡）
  - 出題規則：3 個錯誤選項嘅讀音一定同答案唔同、互相亦唔同，所以 お／を、じ／ぢ、ず／づ 唔會同時出現喺同一題；
    範圍內唔同讀音少過 4 個就唔俾開始。已自動測試 40 題，冇重複讀音
  - 廣東話近似讀音：71 個入面有 31 個有（清音 29、半濁音 ぱ／ぽ 2）；濁音全部顯示「廣東話冇對應，請聽發音」（原因見檔案頂部註解同下面待確認）
  - 本機預覽：`.claude/launch.json` 嘅 `japanese-ops`（port 5800，用 `StaticServer.exe`；PowerShell 版 server 試過卡死）
- **清濁對比 — 完成（2026-09-29）**（五十音選單第 3 張卡「👂 清濁對比」）
  - `js/contrast.js`（`App.Contrast.render(ctx, back)` / `reset()`，由 `js/kana.js` 嘅 `ui.view === "contrast"` 調用）：
    - 對比表：か／が、さ／ざ、た／だ、は／ば／ぱ 4 張卡，每個元音一組（共 20 組）；撳一組用
      `speakSequence()` 順序讀出（例如「か…が」）；每個字下面有羅馬拼音（跟「顯示羅馬拼音」開關）；
      た行卡附「ぢ、づ 好少用，讀音同 じ、ず 一樣」。顯示平假名定片假名跟五十音「練邊種？」（兩樣 = 平假名）
    - 分辨練習：每輪 10 題，播一個字，答案掣同時顯示字同類別（清音／濁音；は行多一個半濁音）；
      答完顯示答案、類別、拼音、廣東話近似讀音，可以「再聽」或「重聽整組」。ぢ／づ 包括喺題目入面
    - 練習範圍 = `kana.prefs.contrastRows`（か・さ・た・は行 key，預設全部；舊存檔讀取時自動補上）；
      「兩樣」時每題隨機用平假名或片假名
    - 記錄：答嘅係「播放嗰個字」，經 `ctx.onAnswer` 寫入同一個 `kana.stats`／`kana.mistakes`，
      所以錯題紅點、「答啱過」數字同其他練習共用
  - 配對由 `KANA_ROWS` 推算（同一元音位置），冇重複假名資料；`kana.js` 只加咗選單卡、view 分支，
    同埋 export `helpers`（`shuffle`／`romajiText`／`yueLine`／`speakButton`／`QUIZ_LENGTH`）俾 contrast.js 用
  - `js/speech.js` 新增 `speakSequence(texts, settings)`：喺同一下撳掣入面將幾個 utterance 排隊（iOS 可以），
    語音同速度規則同 `speak()` 一樣；原有 `speak()` 冇改
  - 已自動測試：20 組讀音次序、選項數目同類別、答錯寫入紅點、只揀一行時只出嗰行、兩樣會混合、
    羅馬拼音開關、舊存檔兼容、原有功能冇受影響
- **階段 1b — 完成（2026-10-01）**
  - `js/content/kana.js` 新增（原有 71 個假名同 23 個詞一行都冇改，只係加喺後面）：
    - 拗音 33 個（きゃ…ぴょ，平假名＋片假名；ぢゃ／ぢゅ／ぢょ 極少用，冇加）
    - 外來語組合 12 個，只有片假名（`hira: null`）：ファ フィ フェ フォ ティ ディ チェ シェ ジェ ウィ ウェ ウォ。
      內部 id：ディ = `dhi`、ウォ = `who`（因為 `di`／`wo` 已經係 ぢ／を）
    - 廣東話近似讀音：ちゃ「茶」、ちょ「錯」（錯誤嘅錯）、ファ「花」、フォ「科」、チェ「車」、ウォ「窩」，其餘 null；
      ファ／フィ／フェ／フォ 加同 ふ 一樣嘅 note（`FU_NOTE`）
    - `KANA_GROUPS` 加 `yoon`（`cols: 3`，`contrast`：びょういん／びよういん）同 `gairaigo`
      （`cols: 4`、`kataOnly`：平假名字表唔顯示、平假名練習跳過；`single`：練習範圍得一粒 chip）
    - `SOUND_TOPICS`：促音（4 組對比 + 4 個例子）、長音（5 組對比 + 4 個例子）
    - `KATAKANA_EXAMPLES` 加 35 個 1b 詞（共 58 個，新場景「景點」）；エレベーター 意思寫「升降機（𨋢）」，
      因為有啲手機顯示唔到「𨋢」
    - `KANA_TOTAL` = 220（平假名 104 + 片假名 116），主頁同練習嘅「答啱過 x / 220」用佢
  - **羅馬拼音規則**：長音照假名寫兩次母音，唔用橫線（okaasan、otousan、koohii）；っ 將下一個子音寫兩次（kitte）
  - 新畫面 `js/sounds.js`（五十音選單第 4 張卡「⏸️ 促音・長音」）：規則說明、聽對比（每個字可以單獨撳，
    「連續聽」用 `speakSequence()` 順序讀兩個）、常見例子。只聽，冇練習題（用戶決定）。
    `App.Sounds.pairList()` 亦俾字表拗音卡用
  - `js/kana.js`：字表按組別 `cols` 排格；`buildPool` 跳過唔存在嘅字；`pickDistractors` 優先揀同組別嘅錯誤選項
    （拗音題就出拗音選項）；詳情頁嘅實例配對用 `containsSound()`（シ 唔會配 シャワー）；
    外來語組合詳情頁顯示「只用喺片假名外來語」
  - 已自動測試：86 個詞嘅羅馬拼音同假名逐字對應（用 app 自己嘅假名表 + っ／ー 規則計出嚟比較）、
    字表數目、拗音／外來語練習（選項同組、冇重複讀音、兩樣會混合）、平假名跳過外來語組合、紅點同進度、
    1a 練習同清濁對比冇受影響
- **階段 2 — 完成（2026-10-01）**：情境句子庫（基本禮貌 20、餐廳 21、購物 22 = 63 句，全部經用戶逐句核對）
  - `js/content/phrases.js`：`PHRASE_SCENES`（`polite`／`restaurant`／`shopping`），每句
    `{ id, ja, kana, romaji, yue, use, who, say?, replies? }`：
    - `id` 固定唔改號（例如 `rest-16`），留俾階段 4 聽力／錯題重溫用；後加嘅句用新號（`rest-21`、`shop-21`、`shop-22`）
    - `who`：`me` 🗣️ 你講／`staff` 👂 店員講／`both`（只有 どうぞ）
    - `say`（可選）= **發音修正**：有就讀 `say`，冇就讀 `ja`（原句）。只喺用戶手機實測讀錯嗰句先加。
      唔好全句讀假名（全平假名令語音引擎難分詞，例如「たまごははいって」嘅「はは」）
    - `replies`（可選）= 問答組合嘅答句，顯示喺問句下面，亦計入句數。組合：
      餐廳 何名様→二人です、店内／お持ち帰り→店内で／持ち帰りで；
      購物 ポイントカード→持っていません、お支払い→現金で、袋→袋をください／袋は大丈夫です、
      温めますか→はい、お願いします／大丈夫です
    - 可以換字嘅句（卵、薬）暫時只讀原句（用戶決定）
  - `js/phrases.js`（`App.Phrases.render(ctx)`／`reset()`，由 `js/app.js` 嘅 `nav.view === "phrases"` 調用，
    模組顏色 `MODULE_ACCENTS.phrases`）：情境列表 → 情境頁（篩選：全部／🗣️ 我講／👂 店員講；
    問答組合只要問句或者任何答句符合就顯示）→ 句子卡：日文、假名（同日文一樣就唔重複）、拼音（跟開關）、
    廣東話意思、使用場合；「🔊 聽」用設定語音同速度；「🐢 慢慢聽」固定 0.6；問答組合有「連續聽：問 → 答」
  - 階段 2 **唔記錄學習進度**（用戶決定）；記錄同錯題重溫留到階段 4 同階段 7
  - 已自動測試：63 句嘅拼音由假名推算得返（は 可以係 wa、を = o）、日文句入面嘅假名同讀音一致、id 唔重複、
    句數、篩選數目、🔊／🐢／連續聽讀嘅文字同速度、`say` 修正生效但畫面照顯示原句、拼音開關、五十音冇受影響
  - **下一步**：用戶會用手機逐句聽，讀錯嘅句加 `say`；之後按計劃係階段 3（離線 PWA）

## 待確認內容
- **濁音（が／ざ／だ／ば 行）嘅廣東話近似讀音**：暫時全部顯示「冇對應」。可以用廣東話不送氣音做近似
  （例如 が≈家、だ≈打、ば≈巴），但廣東話呢啲音唔「濁」，怕學咗之後分唔到 か／が。要唔要加，請決定
- **え／こ／す／ひ 等冇俾近似讀音嘅字**：最接近嘅廣東話字都唔夠準（例如 ひ≈希 係複元音），所以暫時唔加
- **App 顯示名稱**：暫時用「Japanese Ops」＋副題「日文旅行會話」，同 english-ops 改名做 English Quest 嘅做法唔同，可以再改
