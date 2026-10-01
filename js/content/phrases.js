// 情境句子庫 content (stage 2): 基本禮貌 20、餐廳 21、購物 22 = 63 句.
// Every sentence was checked by the user (2026-10-01).
//
// Fields per sentence:
//   id      stable id (for stage 4 聽力／錯題重溫) — never renumber
//   ja      Japanese as displayed (and spoken by default)
//   kana    full reading (katakana words stay katakana)
//   romaji  Hepburn; long vowels as spelled (arigatou), particles as
//           pronounced (は→wa, を→o)
//   yue     廣東話意思
//   use     使用場合
//   who     "me" = 🗣️ 你講, "staff" = 👂 店員講, "both" = 🗣️👂
//   say     OPTIONAL pronunciation fix: text sent to text-to-speech
//           instead of `ja`. Only add when a sentence is misread on the
//           user's phone (e.g. a kanji read wrongly) — leave it out
//           otherwise. Reading the whole kana line is avoided on
//           purpose: all-hiragana confuses word splitting (は は).
//   replies OPTIONAL answer sentences shown under a question (問答組合);
//           they count as sentences of the scene too.
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const POLITE = [
    { id: "polite-01", ja: "すみません。", kana: "すみません", romaji: "sumimasen", yue: "唔該、唔好意思", use: "叫店員、借借、輕微道歉都用得", who: "me" },
    { id: "polite-02", ja: "ありがとうございます。", kana: "ありがとうございます", romaji: "arigatou gozaimasu", yue: "多謝", use: "最常用的多謝", who: "me" },
    { id: "polite-03", ja: "どうもありがとうございました。", kana: "どうもありがとうございました", romaji: "doumo arigatou gozaimashita", yue: "真係多謝晒", use: "人哋幫完你、離開時講", who: "me" },
    { id: "polite-04", ja: "おはようございます。", kana: "おはようございます", romaji: "ohayou gozaimasu", yue: "早晨", use: "朝早打招呼", who: "me" },
    { id: "polite-05", ja: "こんにちは。", kana: "こんにちは", romaji: "konnichiwa", yue: "你好", use: "日頭打招呼", who: "me" },
    { id: "polite-06", ja: "こんばんは。", kana: "こんばんは", romaji: "konbanwa", yue: "你好（夜晚打招呼）", use: "夜晚見面時講，唔係瞓覺嗰種「晚安」", who: "me" },
    { id: "polite-07", ja: "はい。", kana: "はい", romaji: "hai", yue: "係、好", use: "答「係」或者「好」", who: "me" },
    { id: "polite-08", ja: "いいえ。", kana: "いいえ", romaji: "iie", yue: "唔係", use: "答「唔係」", who: "me" },
    { id: "polite-09", ja: "大丈夫です。", kana: "だいじょうぶです", romaji: "daijoubu desu", yue: "冇問題、唔使喇", use: "婉拒（例如唔使袋），或者話自己冇事", who: "me" },
    { id: "polite-10", ja: "お願いします。", kana: "おねがいします", romaji: "onegai shimasu", yue: "唔該（麻煩你）", use: "請人幫手；指住樣嘢講就係「我要呢個」", who: "me" },
    { id: "polite-11", ja: "ごめんなさい。", kana: "ごめんなさい", romaji: "gomen nasai", yue: "對唔住", use: "真正做錯嘢時道歉", who: "me" },
    { id: "polite-12", ja: "日本語がわかりません。", kana: "にほんごがわかりません", romaji: "nihongo ga wakarimasen", yue: "我唔識日文", use: "聽唔明時講", who: "me" },
    { id: "polite-13", ja: "英語は話せますか。", kana: "えいごははなせますか", romaji: "eigo wa hanasemasu ka", yue: "你識唔識講英文？", use: "想轉用英文時問", who: "me" },
    { id: "polite-14", ja: "もう一度お願いします。", kana: "もういちどおねがいします", romaji: "mou ichido onegai shimasu", yue: "唔該講多次", use: "聽唔清楚時講", who: "me" },
    { id: "polite-15", ja: "もう少しゆっくり話してください。", kana: "もうすこしゆっくりはなしてください", romaji: "mou sukoshi yukkuri hanashite kudasai", yue: "唔該講慢少少", use: "對方講得太快時講", who: "me" },
    { id: "polite-16", ja: "わかりました。", kana: "わかりました", romaji: "wakarimashita", yue: "明白、知道喇", use: "表示聽明白", who: "me" },
    { id: "polite-17", ja: "ちょっと待ってください。", kana: "ちょっとまってください", romaji: "chotto matte kudasai", yue: "等一等", use: "請對方等陣，例如搵緊錢包", who: "me" },
    { id: "polite-18", ja: "トイレはどこですか。", kana: "トイレはどこですか", romaji: "toire wa doko desu ka", yue: "洗手間喺邊？", use: "任何地方都用得", who: "me" },
    { id: "polite-19", ja: "香港から来ました。", kana: "ホンコンからきました", romaji: "honkon kara kimashita", yue: "我由香港嚟", use: "人哋問你由邊度嚟時答", who: "me" },
    { id: "polite-20", ja: "どうぞ。", kana: "どうぞ", romaji: "douzo", yue: "請（請用、請入、你先）", use: "遞嘢俾人、讓位；店員都成日講", who: "both" },
  ];

  const RESTAURANT = [
    { id: "rest-01", ja: "いらっしゃいませ。", kana: "いらっしゃいませ", romaji: "irasshaimase", yue: "歡迎光臨", use: "入門口時店員講，唔使回應", who: "staff" },
    {
      id: "rest-02", ja: "何名様ですか。", kana: "なんめいさまですか", romaji: "nanmeisama desu ka", yue: "幾多位？", use: "入座前店員問", who: "staff",
      replies: [
        { id: "rest-03", ja: "二人です。", kana: "ふたりです", romaji: "futari desu", yue: "兩位", use: "答幾多位（一位 = ひとりです hitori desu）", who: "me" },
      ],
    },
    { id: "rest-04", ja: "予約していません。", kana: "よやくしていません", romaji: "yoyaku shite imasen", yue: "我冇訂位", use: "店員問有冇訂位時答", who: "me" },
    { id: "rest-05", ja: "メニューをください。", kana: "メニューをください", romaji: "menyuu o kudasai", yue: "唔該俾個餐牌我", use: "坐低後", who: "me" },
    { id: "rest-06", ja: "英語のメニューはありますか。", kana: "えいごのメニューはありますか", romaji: "eigo no menyuu wa arimasu ka", yue: "有冇英文餐牌？", use: "睇唔明日文餐牌時", who: "me" },
    { id: "rest-07", ja: "おすすめは何ですか。", kana: "おすすめはなんですか", romaji: "osusume wa nan desu ka", yue: "有咩推介？", use: "唔知食咩好時", who: "me" },
    { id: "rest-08", ja: "ご注文はお決まりですか。", kana: "ごちゅうもんはおきまりですか", romaji: "gochuumon wa okimari desu ka", yue: "決定好叫咩未？", use: "店員嚟落單時問", who: "staff" },
    { id: "rest-09", ja: "注文をお願いします。", kana: "ちゅうもんをおねがいします", romaji: "chuumon o onegai shimasu", yue: "唔該，我想落單", use: "叫店員過嚟落單（前面可以加「すみません」）", who: "me" },
    { id: "rest-10", ja: "これをください。", kana: "これをください", romaji: "kore o kudasai", yue: "我要呢個", use: "指住餐牌落單", who: "me" },
    { id: "rest-11", ja: "これを二つください。", kana: "これをふたつください", romaji: "kore o futatsu kudasai", yue: "呢個要兩份", use: "同一樣嘢要兩份", who: "me" },
    { id: "rest-12", ja: "お水をください。", kana: "おみずをください", romaji: "omizu o kudasai", yue: "唔該俾杯水我", use: "要水", who: "me" },
    { id: "rest-13", ja: "卵は入っていますか。", kana: "たまごははいっていますか", romaji: "tamago wa haitte imasu ka", yue: "有冇落蛋？", use: "有食物敏感時問（「卵」可以換做其他食材）", who: "me" },
    { id: "rest-21", ja: "卵アレルギーがあります。", kana: "たまごアレルギーがあります", romaji: "tamago arerugii ga arimasu", yue: "我對蛋敏感", use: "有食物敏感時講（「卵」可以換做其他食材）", who: "me" },
    { id: "rest-14", ja: "少々お待ちください。", kana: "しょうしょうおまちください", romaji: "shoushou omachi kudasai", yue: "請稍等", use: "店員叫你等一陣", who: "staff" },
    { id: "rest-15", ja: "お待たせしました。", kana: "おまたせしました", romaji: "omatase shimashita", yue: "唔好意思，要你等咗", use: "上菜或者輪到你時店員講", who: "staff" },
    {
      id: "rest-16", ja: "店内でお召し上がりですか、お持ち帰りですか。", kana: "てんないでおめしあがりですか、おもちかえりですか", romaji: "tennai de omeshiagari desu ka, omochikaeri desu ka", yue: "喺度食定拎走？", use: "快餐店、咖啡店落單時問", who: "staff",
      replies: [
        { id: "rest-17", ja: "店内でお願いします。", kana: "てんないでおねがいします", romaji: "tennai de onegai shimasu", yue: "喺度食", use: "答「喺度食定拎走？」", who: "me" },
        { id: "rest-18", ja: "持ち帰りでお願いします。", kana: "もちかえりでおねがいします", romaji: "mochikaeri de onegai shimasu", yue: "我要拎走（外賣）", use: "答「喺度食定拎走？」", who: "me" },
      ],
    },
    { id: "rest-19", ja: "お会計をお願いします。", kana: "おかいけいをおねがいします", romaji: "okaikei o onegai shimasu", yue: "唔該埋單", use: "食完想俾錢", who: "me" },
    { id: "rest-20", ja: "ごちそうさまでした。", kana: "ごちそうさまでした", romaji: "gochisousama deshita", yue: "多謝款待", use: "食完離開時同店員講", who: "me" },
  ];

  const SHOPPING = [
    { id: "shop-01", ja: "これはいくらですか。", kana: "これはいくらですか", romaji: "kore wa ikura desu ka", yue: "呢個幾多錢？", use: "問價錢", who: "me" },
    { id: "shop-02", ja: "見ているだけです。", kana: "みているだけです", romaji: "mite iru dake desu", yue: "我睇吓啫", use: "店員過嚟招呼時講", who: "me" },
    { id: "shop-03", ja: "試着してもいいですか。", kana: "しちゃくしてもいいですか", romaji: "shichaku shite mo ii desu ka", yue: "可唔可以試身？", use: "買衫褲鞋", who: "me" },
    { id: "shop-04", ja: "他の色はありますか。", kana: "ほかのいろはありますか", romaji: "hoka no iro wa arimasu ka", yue: "有冇第二隻色？", use: "揀顏色", who: "me" },
    { id: "shop-05", ja: "もっと大きいサイズはありますか。", kana: "もっとおおきいサイズはありますか", romaji: "motto ookii saizu wa arimasu ka", yue: "有冇大啲嘅尺碼？", use: "試完太細", who: "me" },
    { id: "shop-06", ja: "もっと小さいサイズはありますか。", kana: "もっとちいさいサイズはありますか", romaji: "motto chiisai saizu wa arimasu ka", yue: "有冇細啲嘅尺碼？", use: "試完太大", who: "me" },
    { id: "shop-07", ja: "薬はどこにありますか。", kana: "くすりはどこにありますか", romaji: "kusuri wa doko ni arimasu ka", yue: "藥喺邊度有？", use: "搵貨品（「薬」可以換做其他嘢）", who: "me" },
    { id: "shop-08", ja: "これにします。", kana: "これにします", romaji: "kore ni shimasu", yue: "我要呢個（決定買）", use: "揀好決定買", who: "me" },
    {
      id: "shop-09", ja: "免税できますか。", kana: "めんぜいできますか", romaji: "menzei dekimasu ka", yue: "可唔可以免稅？", who: "me",
      use: "問呢間店做唔做免稅／退稅（2026 年 11 月 1 日起，購物時先俾含稅價，出境時經海關確認後先退稅）",
    },
    { id: "shop-10", ja: "パスポートをお願いします。", kana: "パスポートをおねがいします", romaji: "pasupooto o onegai shimasu", yue: "唔該俾護照我睇", use: "辦免稅時店員講", who: "staff" },
    {
      id: "shop-11", ja: "ポイントカードはお持ちですか。", kana: "ポイントカードはおもちですか", romaji: "pointo kaado wa omochi desu ka", yue: "有冇積分卡？", use: "收銀時好常聽到", who: "staff",
      replies: [
        { id: "shop-12", ja: "持っていません。", kana: "もっていません", romaji: "motte imasen", yue: "冇（我冇呢樣嘢）", use: "答「有冇積分卡？」", who: "me" },
      ],
    },
    {
      id: "shop-13", ja: "お支払いはどうなさいますか。", kana: "おしはらいはどうなさいますか", romaji: "oshiharai wa dou nasaimasu ka", yue: "你點俾錢？", use: "收銀時問用現金定用卡", who: "staff",
      replies: [
        { id: "shop-15", ja: "現金でお願いします。", kana: "げんきんでおねがいします", romaji: "genkin de onegai shimasu", yue: "我用現金俾", use: "答「你點俾錢？」", who: "me" },
      ],
    },
    { id: "shop-14", ja: "カードで払えますか。", kana: "カードではらえますか", romaji: "kaado de haraemasu ka", yue: "可唔可以用卡俾錢？", use: "俾錢前問", who: "me" },
    {
      id: "shop-16", ja: "袋はご利用ですか。", kana: "ふくろはごりようですか", romaji: "fukuro wa goriyou desu ka", yue: "使唔使袋？", use: "收銀時問（膠袋通常要收錢）", who: "staff",
      replies: [
        { id: "shop-17", ja: "袋をください。", kana: "ふくろをください", romaji: "fukuro o kudasai", yue: "唔該俾個袋我", use: "答「使唔使袋？」（要袋）", who: "me" },
        { id: "shop-18", ja: "袋は大丈夫です。", kana: "ふくろはだいじょうぶです", romaji: "fukuro wa daijoubu desu", yue: "唔使袋", use: "答「使唔使袋？」（唔要袋）", who: "me" },
      ],
    },
    {
      id: "shop-19", ja: "温めますか。", kana: "あたためますか", romaji: "atatamemasu ka", yue: "使唔使叮熱？", use: "便利店買飯盒時問", who: "staff",
      replies: [
        { id: "shop-21", ja: "はい、お願いします。", kana: "はい、おねがいします", romaji: "hai, onegai shimasu", yue: "好，唔該", use: "答「使唔使叮熱？」（要叮熱）", who: "me" },
        { id: "shop-22", ja: "大丈夫です。", kana: "だいじょうぶです", romaji: "daijoubu desu", yue: "唔使喇", use: "答「使唔使叮熱？」（唔使叮熱）", who: "me" },
      ],
    },
    { id: "shop-20", ja: "レシートをください。", kana: "レシートをください", romaji: "reshiito o kudasai", yue: "唔該俾張收據我", use: "需要收據時", who: "me" },
  ];

  window.App.Content.PHRASE_SCENES = [
    { key: "polite", label: "基本禮貌", emoji: "🙇", phrases: POLITE },
    { key: "restaurant", label: "餐廳", emoji: "🍜", phrases: RESTAURANT },
    { key: "shopping", label: "購物", emoji: "🛍️", phrases: SHOPPING },
  ];
})();
