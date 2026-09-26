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

  const RA_NOTE = "ら行嘅 r 介乎廣東話 l 同英文 r 之間，舌尖輕輕彈一下";
  const N_NOTE = "要用鼻音 n，唔好讀成 l";

  const KANA = {
    // ── 清音 ──
    a: K("あ", "ア", "a", "呀"),
    i: K("い", "イ", "i", "衣"),
    u: K("う", "ウ", "u", "烏", { note: "嘴唇唔使撮圓，比廣東話「烏」扁啲" }),
    e: K("え", "エ", "e", null),
    o: K("お", "オ", "o", "柯"),

    ka: K("か", "カ", "ka", "卡"),
    ki: K("き", "キ", "ki", null),
    ku: K("く", "ク", "ku", "箍", { yueHint: "鐵箍嘅箍" }),
    ke: K("け", "ケ", "ke", "茄", { yueHint: "番茄嘅茄" }),
    ko: K("こ", "コ", "ko", null),

    sa: K("さ", "サ", "sa", "沙", { hiraNote: "小心同「ち」：さ 下面個彎凸向左，ち 凸向右（似數字 5）" }),
    shi: K("し", "シ", "shi", "詩", {
      kataNote: "小心同「ツ」：シ 兩點喺左邊、打斜排，長筆由左下向右上挑",
    }),
    su: K("す", "ス", "su", null),
    se: K("せ", "セ", "se", "些"),
    so: K("そ", "ソ", "so", "梳", {
      kataNote: "小心同「ン」：ソ 短筆喺上面、差唔多直落，長筆由右上向左下撇",
    }),

    ta: K("た", "タ", "ta", "他"),
    chi: K("ち", "チ", "chi", "痴", { hiraNote: "小心同「さ」：ち 下面個彎凸向右（似數字 5），さ 凸向左" }),
    tsu: K("つ", "ツ", "tsu", null, {
      note: "有啲似英文 cats 尾嗰個 ts 音",
      kataNote: "小心同「シ」：ツ 兩點喺上面、橫排，長筆由右上向左下撇",
    }),
    te: K("て", "テ", "te", null),
    to: K("と", "ト", "to", "拖"),

    na: K("な", "ナ", "na", "拿", { note: N_NOTE }),
    ni: K("に", "ニ", "ni", "呢", { yueHint: "呢個嘅呢", note: N_NOTE }),
    nu: K("ぬ", "ヌ", "nu", null, { hiraNote: "小心同「め」：ぬ 尾有個小圈，め 冇" }),
    ne: K("ね", "ネ", "ne", null, { hiraNote: "小心同「れ」「わ」：ね 尾有個小圈" }),
    no: K("の", "ノ", "no", "挪", { note: N_NOTE }),

    ha: K("は", "ハ", "ha", "哈", { note: "做助詞時讀 wa，例如 こんにちは（konnichiwa）", hiraNote: "小心同「ほ」：ほ 上面多一劃" }),
    hi: K("ひ", "ヒ", "hi", null),
    fu: K("ふ", "フ", "fu", null, { note: "介乎 f 同 h 之間：上下唇唔掂埋，輕輕吹氣" }),
    he: K("へ", "ヘ", "he", null, { note: "做助詞（表示方向）時讀 e", kataNote: "平假名 へ 同片假名 ヘ 寫法差唔多一樣" }),
    ho: K("ほ", "ホ", "ho", "呵", { hiraNote: "小心同「は」：ほ 上面多一劃" }),

    ma: K("ま", "マ", "ma", "媽"),
    mi: K("み", "ミ", "mi", "咪", { yueHint: "咪咪（貓仔）嘅咪" }),
    mu: K("む", "ム", "mu", null),
    me: K("め", "メ", "me", "咩", { hiraNote: "小心同「ぬ」：め 尾冇小圈" }),
    mo: K("も", "モ", "mo", "摸"),

    ya: K("や", "ヤ", "ya", "也"),
    yu: K("ゆ", "ユ", "yu", null),
    yo: K("よ", "ヨ", "yo", "唷", { yueHint: "哎唷嘅唷" }),

    ra: K("ら", "ラ", "ra", "啦", { note: RA_NOTE }),
    ri: K("り", "リ", "ri", null, { note: RA_NOTE }),
    ru: K("る", "ル", "ru", null, { note: RA_NOTE, hiraNote: "小心同「ろ」：る 尾有個小圈，ろ 冇" }),
    re: K("れ", "レ", "re", null, { note: RA_NOTE, hiraNote: "小心同「わ」「ね」：れ 尾向外撇" }),
    ro: K("ろ", "ロ", "ro", "囉", { note: RA_NOTE, hiraNote: "小心同「る」：ろ 尾冇小圈" }),

    wa: K("わ", "ワ", "wa", "娃", { hiraNote: "小心同「れ」「ね」：わ 尾向內彎" }),
    wo: K("を", "ヲ", "o", "柯", {
      romajiAlt: "wo",
      note: "只用嚟做助詞，讀音同「お」一樣；片假名 ヲ 好少見",
    }),
    n: K("ん", "ン", "n", null, {
      note: "鼻音，自己唔成一個字，差唔多唔會喺字嘅開頭出現",
      kataNote: "小心同「ソ」：ン 短筆喺左上、橫啲，長筆由左下向右上挑",
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
    di: K("ぢ", "ヂ", "ji", null, { note: "好少用，讀音同「じ」一樣" }),
    du: K("づ", "ヅ", "zu", null, { note: "好少用，讀音同「ず」一樣" }),
    de: K("で", "デ", "de", null),
    do: K("ど", "ド", "do", null),

    ba: K("ば", "バ", "ba", null),
    bi: K("び", "ビ", "bi", null),
    bu: K("ぶ", "ブ", "bu", null),
    be: K("べ", "ベ", "be", null),
    bo: K("ぼ", "ボ", "bo", null),

    // ── 半濁音 ──
    pa: K("ぱ", "パ", "pa", "趴", { yueHint: "趴低嘅趴" }),
    pi: K("ぴ", "ピ", "pi", null),
    pu: K("ぷ", "プ", "pu", null),
    pe: K("ぺ", "ペ", "pe", null),
    po: K("ぽ", "ポ", "po", "婆"),
  };

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
  ];

  const GROUPS = [
    { key: "seion", label: "清音", note: "基本 46 個" },
    {
      key: "dakuon",
      label: "濁音",
      note: "加「゛」：k→g、s→z、t→d、h→b。廣東話冇呢類「濁」音，請聽發音，喉嚨要震",
    },
    { key: "handakuon", label: "半濁音", note: "加「゜」：h→p" },
  ];

  // 片假名真實例子 — stage 1a uses ONLY kana taught in 1a (no 拗音, っ, ー),
  // so e.g. メニュー／コーヒー／タクシー wait for stage 1b.
  // Each checked: katakana ↔ romaji ↔ meaning.
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
    { word: "サイズ", romaji: "saizu", meaning: "尺碼、大細", scene: "購物" },
    { word: "マスク", romaji: "masuku", meaning: "口罩", scene: "購物" },
    { word: "カメラ", romaji: "kamera", meaning: "相機", scene: "購物" },
    { word: "パン", romaji: "pan", meaning: "麵包", scene: "餐廳" },
    { word: "パスタ", romaji: "pasuta", meaning: "意粉", scene: "餐廳" },
    { word: "ピザ", romaji: "piza", meaning: "薄餅（pizza）", scene: "餐廳" },
    { word: "サラダ", romaji: "sarada", meaning: "沙律", scene: "餐廳" },
    { word: "チキン", romaji: "chikin", meaning: "雞（雞肉，例如炸雞）", scene: "餐廳" },
    { word: "ミルク", romaji: "miruku", meaning: "牛奶", scene: "餐廳" },
    { word: "ワイン", romaji: "wain", meaning: "葡萄酒（紅酒、白酒）", scene: "餐廳" },
    { word: "アイス", romaji: "aisu", meaning: "雪糕", scene: "餐廳" },
    { word: "トマト", romaji: "tomato", meaning: "番茄", scene: "超市" },
    { word: "メロン", romaji: "meron", meaning: "蜜瓜", scene: "超市" },
    { word: "レモン", romaji: "remon", meaning: "檸檬", scene: "超市" },
  ];

  window.App.Content.KANA = KANA;
  window.App.Content.KANA_ROWS = ROWS;
  window.App.Content.KANA_GROUPS = GROUPS;
  window.App.Content.KATAKANA_EXAMPLES = KATAKANA_EXAMPLES;
})();
