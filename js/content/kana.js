// 五十音 content — stage 1a: 清音 (46)、濁音 (20)、半濁音 (5).
// 拗音、促音っ、長音ー come in stage 1b.
//
// Romaji: Revised Hepburn (shi/chi/tsu/fu/ji/zu; を = o).
//
// `yue` = 廣東話近似讀音. Only given where the match is close enough to be
// genuinely useful; null renders as 「廣東話冇對應，請聽發音」. Tone is
// ignored (only initial + final matter). `yueHint` disambiguates a
// character with several Cantonese readings. Deliberately null:
//   - e/ki/ko/su/tsu/te/nu/ne/hi/fu/he/mu/yu/ri/ru/re/n — no Cantonese
//     syllable is close enough (or the nearest one is a diphthong).
//   - every 濁音 (g/z/d/b): Japanese voiced consonants don't exist in
//     Cantonese; using 家/渣/打/巴 would teach が = か-ish, which is the
//     exact distinction the learner needs to hear. See CLAUDE.md 待確認內容.
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const K = (hira, kata, romaji, yue, extra = {}) => ({ hira, kata, romaji, yue, ...extra });

  const RA_NOTE = "ら行的 r 介於廣東話的 l 與英文的 r 之間，舌尖輕輕彈一下";
  const N_NOTE = "要用鼻音 n，不要讀成 l";
  // Same wording as ふ's note — used for ファ／フィ／フェ／フォ (stage 1b).
  const FU_NOTE = "介於 f 與 h 之間：上下唇不要碰在一起，輕輕吹氣";

  const KANA = {
    // ── 清音 ──
    a: K("あ", "ア", "a", "呀"),
    i: K("い", "イ", "i", "衣"),
    u: K("う", "ウ", "u", "烏", { note: "嘴唇不必撮圓，比廣東話的「烏」更扁" }),
    e: K("え", "エ", "e", null),
    o: K("お", "オ", "o", "柯"),

    ka: K("か", "カ", "ka", "卡"),
    ki: K("き", "キ", "ki", null),
    ku: K("く", "ク", "ku", "箍", { yueHint: "「鐵箍」的「箍」" }),
    ke: K("け", "ケ", "ke", "茄", { yueHint: "「番茄」的「茄」" }),
    ko: K("こ", "コ", "ko", null),

    sa: K("さ", "サ", "sa", "沙", { hiraNote: "請留意與「ち」的分別：さ 下方的彎向左凸，ち 向右凸（形似數字 5）" }),
    shi: K("し", "シ", "shi", "詩", {
      kataNote: "請留意與「ツ」的分別：シ 兩點在左邊、斜向排列，長筆由左下向右上挑",
    }),
    su: K("す", "ス", "su", null),
    se: K("せ", "セ", "se", "些"),
    so: K("そ", "ソ", "so", "梳", {
      kataNote: "請留意與「ン」的分別：ソ 短筆在上方、幾乎垂直向下，長筆由右上向左下撇",
    }),

    ta: K("た", "タ", "ta", "他"),
    chi: K("ち", "チ", "chi", "痴", { hiraNote: "請留意與「さ」的分別：ち 下方的彎向右凸（形似數字 5），さ 向左凸" }),
    tsu: K("つ", "ツ", "tsu", null, {
      note: "近似英文 cats 結尾的 ts 音",
      kataNote: "請留意與「シ」的分別：ツ 兩點在上方、橫向排列，長筆由右上向左下撇",
    }),
    te: K("て", "テ", "te", null),
    to: K("と", "ト", "to", "拖"),

    na: K("な", "ナ", "na", "拿", { note: N_NOTE }),
    ni: K("に", "ニ", "ni", "呢", { yueHint: "「呢個」的「呢」", note: N_NOTE }),
    nu: K("ぬ", "ヌ", "nu", null, { hiraNote: "請留意與「め」的分別：ぬ 末端有個小圈，め 沒有" }),
    ne: K("ね", "ネ", "ne", null, { hiraNote: "請留意與「れ」「わ」的分別：ね 末端有個小圈" }),
    no: K("の", "ノ", "no", "挪", { note: N_NOTE }),

    ha: K("は", "ハ", "ha", "哈", { note: "作助詞時讀作 wa，例如 こんにちは（konnichiwa）", hiraNote: "請留意與「ほ」的分別：ほ 上方多一畫" }),
    hi: K("ひ", "ヒ", "hi", null),
    fu: K("ふ", "フ", "fu", null, { note: "介於 f 與 h 之間：上下唇不要碰在一起，輕輕吹氣" }),
    he: K("へ", "ヘ", "he", null, { note: "作助詞（表示方向）時讀作 e", kataNote: "平假名 へ 與片假名 ヘ 寫法幾乎相同" }),
    ho: K("ほ", "ホ", "ho", "呵", { hiraNote: "請留意與「は」的分別：ほ 上方多一畫" }),

    ma: K("ま", "マ", "ma", "媽"),
    mi: K("み", "ミ", "mi", "咪", { yueHint: "「咪咪（小貓）」的「咪」" }),
    mu: K("む", "ム", "mu", null),
    me: K("め", "メ", "me", "咩", { hiraNote: "請留意與「ぬ」的分別：め 末端沒有小圈" }),
    mo: K("も", "モ", "mo", "摸"),

    ya: K("や", "ヤ", "ya", "也"),
    yu: K("ゆ", "ユ", "yu", null),
    yo: K("よ", "ヨ", "yo", "唷", { yueHint: "「哎唷」的「唷」" }),

    ra: K("ら", "ラ", "ra", "啦", { note: RA_NOTE }),
    ri: K("り", "リ", "ri", null, { note: RA_NOTE }),
    ru: K("る", "ル", "ru", null, { note: RA_NOTE, hiraNote: "請留意與「ろ」的分別：る 末端有個小圈，ろ 沒有" }),
    re: K("れ", "レ", "re", null, { note: RA_NOTE, hiraNote: "請留意與「わ」「ね」的分別：れ 末端向外撇" }),
    ro: K("ろ", "ロ", "ro", "囉", { note: RA_NOTE, hiraNote: "請留意與「る」的分別：ろ 末端沒有小圈" }),

    wa: K("わ", "ワ", "wa", "娃", { hiraNote: "請留意與「れ」「ね」的分別：わ 末端向內彎" }),
    wo: K("を", "ヲ", "o", "柯", {
      romajiAlt: "wo",
      note: "只用作助詞，讀音與「お」相同；片假名 ヲ 很少見",
    }),
    n: K("ん", "ン", "n", null, {
      note: "鼻音，不能單獨成字，幾乎不會出現在詞語開頭",
      kataNote: "請留意與「ソ」的分別：ン 短筆在左上、較橫，長筆由左下向右上挑",
    }),

    // ── 濁音 ──
    ga: K("が", "ガ", "ga", null),
    gi: K("ぎ", "ギ", "gi", null),
    gu: K("ぐ", "グ", "gu", null),
    ge: K("げ", "ゲ", "ge", null),
    go: K("ご", "ゴ", "go", null),

    za: K("ざ", "ザ", "za", null),
    ji: K("じ", "ジ", "ji", null),
    zu: K("ず", "ズ", "zu", null),
    ze: K("ぜ", "ゼ", "ze", null),
    zo: K("ぞ", "ゾ", "zo", null),

    da: K("だ", "ダ", "da", null),
    di: K("ぢ", "ヂ", "ji", null, { note: "很少使用，讀音與「じ」相同" }),
    du: K("づ", "ヅ", "zu", null, { note: "很少使用，讀音與「ず」相同" }),
    de: K("で", "デ", "de", null),
    do: K("ど", "ド", "do", null),

    ba: K("ば", "バ", "ba", null),
    bi: K("び", "ビ", "bi", null),
    bu: K("ぶ", "ブ", "bu", null),
    be: K("べ", "ベ", "be", null),
    bo: K("ぼ", "ボ", "bo", null),

    // ── 半濁音 ──
    pa: K("ぱ", "パ", "pa", "趴", { yueHint: "「趴下」的「趴」" }),
    pi: K("ぴ", "ピ", "pi", null),
    pu: K("ぷ", "プ", "pu", null),
    pe: K("ぺ", "ペ", "pe", null),
    po: K("ぽ", "ポ", "po", "婆"),

    // ── 拗音 (stage 1b) ── い段 + 細 ゃゅょ, one syllable.
    // ぢゃ／ぢゅ／ぢょ omitted (almost never used).
    kya: K("きゃ", "キャ", "kya", null),
    kyu: K("きゅ", "キュ", "kyu", null),
    kyo: K("きょ", "キョ", "kyo", null),
    sha: K("しゃ", "シャ", "sha", null),
    shu: K("しゅ", "シュ", "shu", null),
    sho: K("しょ", "ショ", "sho", null),
    cha: K("ちゃ", "チャ", "cha", "茶"),
    chu: K("ちゅ", "チュ", "chu", null),
    cho: K("ちょ", "チョ", "cho", "錯", { yueHint: "「錯誤」的「錯」" }),
    nya: K("にゃ", "ニャ", "nya", null),
    nyu: K("にゅ", "ニュ", "nyu", null),
    nyo: K("にょ", "ニョ", "nyo", null),
    hya: K("ひゃ", "ヒャ", "hya", null),
    hyu: K("ひゅ", "ヒュ", "hyu", null),
    hyo: K("ひょ", "ヒョ", "hyo", null),
    mya: K("みゃ", "ミャ", "mya", null),
    myu: K("みゅ", "ミュ", "myu", null),
    myo: K("みょ", "ミョ", "myo", null),
    rya: K("りゃ", "リャ", "rya", null),
    ryu: K("りゅ", "リュ", "ryu", null),
    ryo: K("りょ", "リョ", "ryo", null),
    gya: K("ぎゃ", "ギャ", "gya", null),
    gyu: K("ぎゅ", "ギュ", "gyu", null),
    gyo: K("ぎょ", "ギョ", "gyo", null),
    ja: K("じゃ", "ジャ", "ja", null),
    ju: K("じゅ", "ジュ", "ju", null),
    jo: K("じょ", "ジョ", "jo", null),
    bya: K("びゃ", "ビャ", "bya", null),
    byu: K("びゅ", "ビュ", "byu", null),
    byo: K("びょ", "ビョ", "byo", null),
    pya: K("ぴゃ", "ピャ", "pya", null),
    pyu: K("ぴゅ", "ピュ", "pyu", null),
    pyo: K("ぴょ", "ピョ", "pyo", null),

    // ── 外來語組合 (stage 1b) ── katakana only (hira = null).
    fa: K(null, "ファ", "fa", "花", { note: FU_NOTE }),
    fi: K(null, "フィ", "fi", null, { note: FU_NOTE }),
    fe: K(null, "フェ", "fe", null, { note: FU_NOTE }),
    fo: K(null, "フォ", "fo", "科", { note: FU_NOTE }),
    ti: K(null, "ティ", "ti", null),
    dhi: K(null, "ディ", "di", null),
    che: K(null, "チェ", "che", "車"),
    she: K(null, "シェ", "she", null),
    je: K(null, "ジェ", "je", null),
    wi: K(null, "ウィ", "wi", null),
    we: K(null, "ウェ", "we", null),
    who: K(null, "ウォ", "wo", "窩"),
  };

  // Total distinct characters (hira + kata counted separately; 外來語組合
  // only exist in katakana) — used for the 「答啱過 x / total」 counts.
  const KANA_TOTAL = Object.values(KANA).reduce((n, k) => n + (k.hira ? 1 : 0) + (k.kata ? 1 : 0), 0);

  // Chart layout: 5 slots per row (null = empty slot, as in the
  // standard 五十音 table).
  const ROWS = [
    { key: "a", group: "seion", cells: ["a", "i", "u", "e", "o"] },
    { key: "ka", group: "seion", cells: ["ka", "ki", "ku", "ke", "ko"] },
    { key: "sa", group: "seion", cells: ["sa", "shi", "su", "se", "so"] },
    { key: "ta", group: "seion", cells: ["ta", "chi", "tsu", "te", "to"] },
    { key: "na", group: "seion", cells: ["na", "ni", "nu", "ne", "no"] },
    { key: "ha", group: "seion", cells: ["ha", "hi", "fu", "he", "ho"] },
    { key: "ma", group: "seion", cells: ["ma", "mi", "mu", "me", "mo"] },
    { key: "ya", group: "seion", cells: ["ya", null, "yu", null, "yo"] },
    { key: "ra", group: "seion", cells: ["ra", "ri", "ru", "re", "ro"] },
    { key: "wa", group: "seion", cells: ["wa", null, null, null, "wo"] },
    { key: "n", group: "seion", cells: ["n", null, null, null, null] },
    { key: "ga", group: "dakuon", cells: ["ga", "gi", "gu", "ge", "go"] },
    { key: "za", group: "dakuon", cells: ["za", "ji", "zu", "ze", "zo"] },
    { key: "da", group: "dakuon", cells: ["da", "di", "du", "de", "do"] },
    { key: "ba", group: "dakuon", cells: ["ba", "bi", "bu", "be", "bo"] },
    { key: "pa", group: "handakuon", cells: ["pa", "pi", "pu", "pe", "po"] },
    // stage 1b — 拗音: 3 slots (ゃ ゅ ょ)
    { key: "kya", group: "yoon", cells: ["kya", "kyu", "kyo"] },
    { key: "sha", group: "yoon", cells: ["sha", "shu", "sho"] },
    { key: "cha", group: "yoon", cells: ["cha", "chu", "cho"] },
    { key: "nya", group: "yoon", cells: ["nya", "nyu", "nyo"] },
    { key: "hya", group: "yoon", cells: ["hya", "hyu", "hyo"] },
    { key: "mya", group: "yoon", cells: ["mya", "myu", "myo"] },
    { key: "rya", group: "yoon", cells: ["rya", "ryu", "ryo"] },
    { key: "gya", group: "yoon", cells: ["gya", "gyu", "gyo"] },
    { key: "ja", group: "yoon", cells: ["ja", "ju", "jo"] },
    { key: "bya", group: "yoon", cells: ["bya", "byu", "byo"] },
    { key: "pya", group: "yoon", cells: ["pya", "pyu", "pyo"] },
    // stage 1b — 外來語組合: 4 slots, katakana only
    { key: "fa", group: "gairaigo", cells: ["fa", "fi", "fe", "fo"] },
    { key: "ti", group: "gairaigo", cells: ["ti", "dhi", null, null] },
    { key: "che", group: "gairaigo", cells: ["che", "she", "je", null] },
    { key: "wi", group: "gairaigo", cells: ["wi", "we", "who", null] },
  ];

  const GROUPS = [
    { key: "seion", label: "清音", note: "基本 46 個" },
    {
      key: "dakuon",
      label: "濁音",
      note: "加上「゛」：k→g、s→z、t→d、h→b。廣東話沒有這類「濁音」，請聽發音，發音時喉嚨要震動",
    },
    { key: "handakuon", label: "半濁音", note: "加上「゜」：h→p" },
    // stage 1b. `cols` = chart columns; `kataOnly` = hidden in the 平假名
    // chart and skipped in 平假名 practice; `single` = one range chip for
    // the whole group; `contrast` = 聽對比 pairs shown under the chart.
    {
      key: "yoon",
      label: "拗音",
      note: "い段字（き、し、ち…）加上小寫 ゃ／ゅ／ょ，兩個字合起來讀成一個音",
      cols: 3,
      contrast: {
        labels: ["小寫 ょ（拗音）", "大寫 よ"],
        pairs: [
          [
            { word: "びょういん", romaji: "byouin", meaning: "醫院" },
            { word: "びよういん", romaji: "biyouin", meaning: "美容院" },
          ],
        ],
      },
    },
    {
      key: "gairaigo",
      label: "外來語組合",
      note: "只用於片假名外來語：假名加上小寫 ァ／ィ／ゥ／ェ／ォ，合起來讀成一個音（例如 チェックイン）",
      cols: 4,
      kataOnly: true,
      single: true,
    },
  ];

  // 促音・長音 (stage 1b): 聽對比 pairs + common words. Shown on their own
  // screen (js/sounds.js). Each word checked: kana ↔ romaji ↔ meaning.
  // Long vowels are romanised by repeating the vowel as spelled
  // (okaasan, otousan, koohii) — no macrons.
  const SOUND_TOPICS = [
    {
      key: "sokuon",
      title: "促音 っ／ッ",
      intro: [
        "小寫的 っ／ッ 不發音，而是停頓一拍。",
        "羅馬拼音會把下一個子音寫兩次，例如 kitte。",
      ],
      labels: ["無 っ", "有 っ"],
      pairs: [
        [
          { word: "きて", romaji: "kite", meaning: "來" },
          { word: "きって", romaji: "kitte", meaning: "郵票" },
        ],
        [
          { word: "さか", romaji: "saka", meaning: "斜路" },
          { word: "さっか", romaji: "sakka", meaning: "作家" },
        ],
        [
          { word: "おと", romaji: "oto", meaning: "聲音" },
          { word: "おっと", romaji: "otto", meaning: "丈夫" },
        ],
        [
          { word: "かこ", romaji: "kako", meaning: "過去" },
          { word: "かっこ", romaji: "kakko", meaning: "括號" },
        ],
      ],
      words: [
        { word: "きっぷ", romaji: "kippu", meaning: "車票" },
        { word: "ちょっと", romaji: "chotto", meaning: "一點點、稍等" },
        { word: "チケット", romaji: "chiketto", meaning: "票（門票）" },
        { word: "ロッカー", romaji: "rokkaa", meaning: "儲物櫃" },
      ],
    },
    {
      key: "chouon",
      title: "長音",
      intro: [
        "あ段＋あ、い段＋い、う段＋う：拉長一拍。",
        "え段＋い：多數讀成長音的「え」，例如 せんせい 讀作 see。",
        "お段＋う：讀成長音的「お」，例如 ありがとう 的「とう」讀作 too。",
        "片假名用「ー」表示拉長。",
      ],
      labels: ["短", "長"],
      pairs: [
        [
          { word: "おばさん", romaji: "obasan", meaning: "阿姨（中年女士）" },
          { word: "おばあさん", romaji: "obaasan", meaning: "婆婆（年長女士）" },
        ],
        [
          { word: "おじさん", romaji: "ojisan", meaning: "叔叔（中年男士）" },
          { word: "おじいさん", romaji: "ojiisan", meaning: "伯伯（年長男士）" },
        ],
        [
          { word: "ゆき", romaji: "yuki", meaning: "雪" },
          { word: "ゆうき", romaji: "yuuki", meaning: "勇氣" },
        ],
        [
          { word: "え", romaji: "e", meaning: "畫" },
          { word: "ええ", romaji: "ee", meaning: "是的" },
        ],
        [
          { word: "ビル", romaji: "biru", meaning: "大廈" },
          { word: "ビール", romaji: "biiru", meaning: "啤酒" },
        ],
      ],
      words: [
        { word: "おかあさん", romaji: "okaasan", meaning: "媽媽" },
        { word: "おとうさん", romaji: "otousan", meaning: "爸爸" },
        { word: "せんせい", romaji: "sensei", meaning: "老師" },
        { word: "ありがとう", romaji: "arigatou", meaning: "謝謝" },
      ],
    },
  ];

  // 片假名真實例子 — the first 23 use only 1a kana; the rest (stage 1b)
  // need 拗音／っ／ー／外來語組合. Each checked: katakana ↔ romaji ↔ meaning.
  const KATAKANA_EXAMPLES = [
    { word: "ホテル", romaji: "hoteru", meaning: "酒店", scene: "酒店" },
    { word: "フロント", romaji: "furonto", meaning: "酒店前台／接待處", scene: "酒店" },
    { word: "タオル", romaji: "taoru", meaning: "毛巾", scene: "酒店" },
    { word: "エアコン", romaji: "eakon", meaning: "冷氣", scene: "酒店" },
    { word: "テレビ", romaji: "terebi", meaning: "電視", scene: "酒店" },
    { word: "トイレ", romaji: "toire", meaning: "洗手間、廁所", scene: "指示牌" },
    { word: "ドア", romaji: "doa", meaning: "門", scene: "指示牌" },
    { word: "バス", romaji: "basu", meaning: "巴士", scene: "交通" },
    { word: "レジ", romaji: "reji", meaning: "收銀處", scene: "購物" },
    { word: "サイズ", romaji: "saizu", meaning: "尺碼、大小", scene: "購物" },
    { word: "マスク", romaji: "masuku", meaning: "口罩", scene: "購物" },
    { word: "カメラ", romaji: "kamera", meaning: "相機", scene: "購物" },
    { word: "パン", romaji: "pan", meaning: "麵包", scene: "餐廳" },
    { word: "パスタ", romaji: "pasuta", meaning: "意粉", scene: "餐廳" },
    { word: "ピザ", romaji: "piza", meaning: "薄餅（pizza）", scene: "餐廳" },
    { word: "サラダ", romaji: "sarada", meaning: "沙律", scene: "餐廳" },
    { word: "チキン", romaji: "chikin", meaning: "雞肉（例如炸雞）", scene: "餐廳" },
    { word: "ミルク", romaji: "miruku", meaning: "牛奶", scene: "餐廳" },
    { word: "ワイン", romaji: "wain", meaning: "葡萄酒（紅酒、白酒）", scene: "餐廳" },
    { word: "アイス", romaji: "aisu", meaning: "雪糕", scene: "餐廳" },
    { word: "トマト", romaji: "tomato", meaning: "番茄", scene: "超市" },
    { word: "メロン", romaji: "meron", meaning: "蜜瓜", scene: "超市" },
    { word: "レモン", romaji: "remon", meaning: "檸檬", scene: "超市" },

    // stage 1b — words needing 拗音／っ／ー／外來語組合
    { word: "メニュー", romaji: "menyuu", meaning: "餐牌", scene: "餐廳" },
    { word: "コーヒー", romaji: "koohii", meaning: "咖啡", scene: "餐廳" },
    { word: "アイスコーヒー", romaji: "aisukoohii", meaning: "凍咖啡", scene: "餐廳" },
    { word: "ホットコーヒー", romaji: "hottokoohii", meaning: "熱咖啡", scene: "餐廳" },
    { word: "ビール", romaji: "biiru", meaning: "啤酒", scene: "餐廳" },
    { word: "ジュース", romaji: "juusu", meaning: "果汁、甜飲品", scene: "餐廳" },
    { word: "ラーメン", romaji: "raamen", meaning: "拉麵", scene: "餐廳" },
    { word: "カレー", romaji: "karee", meaning: "咖喱", scene: "餐廳" },
    { word: "ステーキ", romaji: "suteeki", meaning: "牛扒", scene: "餐廳" },
    { word: "ケーキ", romaji: "keeki", meaning: "蛋糕", scene: "餐廳" },
    { word: "チョコレート", romaji: "chokoreeto", meaning: "朱古力", scene: "餐廳" },
    { word: "カフェ", romaji: "kafe", meaning: "咖啡店", scene: "餐廳" },
    { word: "フォーク", romaji: "fooku", meaning: "叉子", scene: "餐廳" },
    { word: "ティッシュ", romaji: "tisshu", meaning: "紙巾", scene: "餐廳" },
    { word: "ミネラルウォーター", romaji: "mineraruwootaa", meaning: "礦泉水", scene: "餐廳" },
    { word: "ファストフード", romaji: "fasutofuudo", meaning: "快餐", scene: "餐廳" },
    { word: "チェックイン", romaji: "chekkuin", meaning: "辦理入住", scene: "酒店" },
    { word: "チェックアウト", romaji: "chekkuauto", meaning: "退房", scene: "酒店" },
    { word: "ロビー", romaji: "robii", meaning: "大堂", scene: "酒店" },
    { word: "シャワー", romaji: "shawaa", meaning: "花灑、淋浴", scene: "酒店" },
    { word: "エレベーター", romaji: "erebeetaa", meaning: "升降機（電梯）", scene: "酒店" },
    { word: "ワイファイ", romaji: "waifai", meaning: "Wi-Fi", scene: "酒店" },
    { word: "タクシー", romaji: "takushii", meaning: "的士", scene: "交通" },
    { word: "チケット", romaji: "chiketto", meaning: "票（車票、門票）", scene: "交通" },
    { word: "ホーム", romaji: "hoomu", meaning: "月台（車站）", scene: "交通" },
    { word: "コインロッカー", romaji: "koinrokkaa", meaning: "投幣儲物櫃", scene: "交通" },
    { word: "キャンセル", romaji: "kyanseru", meaning: "取消", scene: "交通" },
    { word: "スーパー", romaji: "suupaa", meaning: "超級市場", scene: "購物" },
    { word: "デパート", romaji: "depaato", meaning: "百貨公司", scene: "購物" },
    { word: "エスカレーター", romaji: "esukareetaa", meaning: "扶手電梯", scene: "購物" },
    { word: "レシート", romaji: "reshiito", meaning: "收據", scene: "購物" },
    { word: "クレジットカード", romaji: "kurejittokaado", meaning: "信用卡", scene: "購物" },
    { word: "セール", romaji: "seeru", meaning: "減價", scene: "購物" },
    { word: "ディズニーランド", romaji: "dizuniirando", meaning: "迪士尼樂園", scene: "景點" },
    { word: "ジェットコースター", romaji: "jettokoosutaa", meaning: "過山車", scene: "景點" },
  ];

  window.App.Content.KANA = KANA;
  window.App.Content.KANA_TOTAL = KANA_TOTAL;
  window.App.Content.SOUND_TOPICS = SOUND_TOPICS;
  window.App.Content.KANA_ROWS = ROWS;
  window.App.Content.KANA_GROUPS = GROUPS;
  window.App.Content.KATAKANA_EXAMPLES = KATAKANA_EXAMPLES;
})();
