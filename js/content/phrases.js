// 情境句子庫 content. Stage 2: 基本禮貌 20、餐廳 21、購物 22 = 63 句
// (checked 2026-10-01). Stage 4: 交通 19、酒店 20、問路 18、緊急情況 21
// = 78 句 (checked 2026-10-03). Total 141.
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
    { id: "polite-01", ja: "すみません。", kana: "すみません", romaji: "sumimasen", yue: "麻煩您、不好意思", use: "呼喚店員、請人讓路、輕微道歉時都適用", who: "me" },
    { id: "polite-02", ja: "ありがとうございます。", kana: "ありがとうございます", romaji: "arigatou gozaimasu", yue: "謝謝", use: "最常用的道謝說法", who: "me" },
    { id: "polite-03", ja: "どうもありがとうございました。", kana: "どうもありがとうございました", romaji: "doumo arigatou gozaimashita", yue: "真的非常感謝", use: "受人幫助後、離開時說", who: "me" },
    { id: "polite-04", ja: "おはようございます。", kana: "おはようございます", romaji: "ohayou gozaimasu", yue: "早安", use: "早上問候時說", who: "me" },
    { id: "polite-05", ja: "こんにちは。", kana: "こんにちは", romaji: "konnichiwa", yue: "你好", use: "白天問候時說", who: "me" },
    { id: "polite-06", ja: "こんばんは。", kana: "こんばんは", romaji: "konbanwa", yue: "晚上好", use: "晚上見面時說，並非睡前的「晚安」", who: "me" },
    { id: "polite-07", ja: "はい。", kana: "はい", romaji: "hai", yue: "是、好", use: "回答「是」或「好」", who: "me" },
    { id: "polite-08", ja: "いいえ。", kana: "いいえ", romaji: "iie", yue: "不是", use: "回答「不是」", who: "me" },
    { id: "polite-09", ja: "大丈夫です。", kana: "だいじょうぶです", romaji: "daijoubu desu", yue: "沒問題、不必了", use: "婉拒（例如不需要購物袋），或表示自己沒事", who: "me" },
    { id: "polite-10", ja: "お願いします。", kana: "おねがいします", romaji: "onegai shimasu", yue: "麻煩您", use: "請人幫忙；指著物品說，即表示「我要這個」", who: "me" },
    { id: "polite-11", ja: "ごめんなさい。", kana: "ごめんなさい", romaji: "gomen nasai", yue: "對不起", use: "真正做錯事時道歉", who: "me" },
    { id: "polite-12", ja: "日本語がわかりません。", kana: "にほんごがわかりません", romaji: "nihongo ga wakarimasen", yue: "我不會日文", use: "聽不懂時說", who: "me" },
    { id: "polite-13", ja: "英語は話せますか。", kana: "えいごははなせますか", romaji: "eigo wa hanasemasu ka", yue: "你會說英文嗎？", use: "想改用英文時詢問", who: "me" },
    { id: "polite-14", ja: "もう一度お願いします。", kana: "もういちどおねがいします", romaji: "mou ichido onegai shimasu", yue: "麻煩您再說一次", use: "沒聽清楚時說", who: "me" },
    { id: "polite-15", ja: "もう少しゆっくり話してください。", kana: "もうすこしゆっくりはなしてください", romaji: "mou sukoshi yukkuri hanashite kudasai", yue: "麻煩您說慢一點", use: "對方說得太快時說", who: "me" },
    { id: "polite-16", ja: "わかりました。", kana: "わかりました", romaji: "wakarimashita", yue: "明白了、知道了", use: "表示聽懂了", who: "me" },
    { id: "polite-17", ja: "ちょっと待ってください。", kana: "ちょっとまってください", romaji: "chotto matte kudasai", yue: "請稍等", use: "請對方稍候，例如正在找錢包", who: "me" },
    { id: "polite-18", ja: "トイレはどこですか。", kana: "トイレはどこですか", romaji: "toire wa doko desu ka", yue: "洗手間在哪裡？", use: "任何場合都適用", who: "me" },
    { id: "polite-19", ja: "香港から来ました。", kana: "ホンコンからきました", romaji: "honkon kara kimashita", yue: "我來自香港", use: "被問到來自哪裡時回答", who: "me" },
    { id: "polite-20", ja: "どうぞ。", kana: "どうぞ", romaji: "douzo", yue: "請（請用、請進、您先請）", use: "遞東西給人、讓位時說；店員也經常說", who: "both" },
    // stage 7a (情境對話) — new sentences
    { id: "polite-21", ja: "ありがとうございました。", kana: "ありがとうございました", romaji: "arigatou gozaimashita", yue: "謝謝光臨", use: "店員在你離開時說，不必回應", who: "staff" },
    { id: "polite-22", ja: "かしこまりました。", kana: "かしこまりました", romaji: "kashikomarimashita", yue: "好的，明白了（店員的客氣說法）", use: "店員表示接受你的要求時說", who: "staff" },
    { id: "polite-23", ja: "はい、大丈夫です。", kana: "はい、だいじょうぶです", romaji: "hai, daijoubu desu", yue: "是的，可以（沒問題）", use: "店員回答「可以嗎？」時說", who: "staff" },
  ];

  const RESTAURANT = [
    { id: "rest-01", ja: "いらっしゃいませ。", kana: "いらっしゃいませ", romaji: "irasshaimase", yue: "歡迎光臨", use: "進門時店員說，不必回應", who: "staff" },
    {
      id: "rest-02", ja: "何名様ですか。", kana: "なんめいさまですか", romaji: "nanmeisama desu ka", yue: "請問幾位？", use: "入座前店員詢問", who: "staff",
      replies: [
        { id: "rest-03", ja: "二人です。", kana: "ふたりです", romaji: "futari desu", yue: "兩位", use: "回答人數（一位 = ひとりです hitori desu）", who: "me" },
      ],
    },
    { id: "rest-04", ja: "予約していません。", kana: "よやくしていません", romaji: "yoyaku shite imasen", yue: "我沒有訂位", use: "店員詢問是否有訂位時回答", who: "me" },
    { id: "rest-05", ja: "メニューをください。", kana: "メニューをください", romaji: "menyuu o kudasai", yue: "麻煩請給我餐牌", use: "入座後", who: "me" },
    { id: "rest-06", ja: "英語のメニューはありますか。", kana: "えいごのメニューはありますか", romaji: "eigo no menyuu wa arimasu ka", yue: "有英文餐牌嗎？", use: "看不懂日文餐牌時", who: "me" },
    { id: "rest-07", ja: "おすすめは何ですか。", kana: "おすすめはなんですか", romaji: "osusume wa nan desu ka", yue: "有什麼推薦？", use: "不知道吃什麼好時", who: "me" },
    { id: "rest-08", ja: "ご注文はお決まりですか。", kana: "ごちゅうもんはおきまりですか", romaji: "gochuumon wa okimari desu ka", yue: "請問決定好點什麼了嗎？", use: "店員前來點餐時詢問", who: "staff" },
    { id: "rest-09", ja: "注文をお願いします。", kana: "ちゅうもんをおねがいします", romaji: "chuumon o onegai shimasu", yue: "麻煩您，我想點餐", use: "請店員過來點餐（前面可加上「すみません」）", who: "me" },
    { id: "rest-10", ja: "これをください。", kana: "これをください", romaji: "kore o kudasai", yue: "我要這個", use: "指著餐牌點餐", who: "me" },
    { id: "rest-11", ja: "これを二つください。", kana: "これをふたつください", romaji: "kore o futatsu kudasai", yue: "這個要兩份", use: "同一樣東西要兩份", who: "me" },
    { id: "rest-12", ja: "お水をください。", kana: "おみずをください", romaji: "omizu o kudasai", yue: "麻煩請給我一杯水", use: "想要水時說", who: "me" },
    { id: "rest-13", ja: "卵は入っていますか。", kana: "たまごははいっていますか", romaji: "tamago wa haitte imasu ka", yue: "有放蛋嗎？", use: "有食物過敏時詢問（「卵」可換成其他食材）", who: "me" },
    { id: "rest-21", ja: "卵アレルギーがあります。", kana: "たまごアレルギーがあります", romaji: "tamago arerugii ga arimasu", yue: "我對蛋過敏", use: "有食物過敏時說（「卵」可換成其他食材）", who: "me" },
    { id: "rest-14", ja: "少々お待ちください。", kana: "しょうしょうおまちください", romaji: "shoushou omachi kudasai", yue: "請稍等", use: "店員請你稍候", who: "staff" },
    { id: "rest-15", ja: "お待たせしました。", kana: "おまたせしました", romaji: "omatase shimashita", yue: "不好意思，讓您久等了", use: "上菜或輪到你時店員說", who: "staff" },
    {
      id: "rest-16", ja: "店内でお召し上がりですか、お持ち帰りですか。", kana: "てんないでおめしあがりですか、おもちかえりですか", romaji: "tennai de omeshiagari desu ka, omochikaeri desu ka", yue: "店內用餐還是外賣？", use: "快餐店、咖啡店點餐時詢問", who: "staff",
      replies: [
        { id: "rest-17", ja: "店内でお願いします。", kana: "てんないでおねがいします", romaji: "tennai de onegai shimasu", yue: "店內用餐", use: "回答「店內用餐還是外賣？」", who: "me" },
        { id: "rest-18", ja: "持ち帰りでお願いします。", kana: "もちかえりでおねがいします", romaji: "mochikaeri de onegai shimasu", yue: "我要外賣", use: "回答「店內用餐還是外賣？」", who: "me" },
      ],
    },
    { id: "rest-19", ja: "お会計をお願いします。", kana: "おかいけいをおねがいします", romaji: "okaikei o onegai shimasu", yue: "麻煩您結帳", use: "用餐後想付款", who: "me" },
    { id: "rest-20", ja: "ごちそうさまでした。", kana: "ごちそうさまでした", romaji: "gochisousama deshita", yue: "謝謝招待", use: "用餐後離開時對店員說", who: "me" },
    // stage 7a — new sentences
    { id: "rest-22", ja: "一人です。", kana: "ひとりです", romaji: "hitori desu", yue: "一位", use: "回答人數", who: "me" },
    { id: "rest-23", ja: "ご予約はありますか。", kana: "ごよやくはありますか", romaji: "goyoyaku wa arimasu ka", yue: "請問有預約嗎？", use: "入座前或辦理入住時店員詢問", who: "staff" },
    { id: "rest-24", ja: "予約しています。", kana: "よやくしています", romaji: "yoyaku shite imasu", yue: "我有預約（訂位）", use: "回答店員「請問有預約嗎？」", who: "me" },
    { id: "rest-25", ja: "こちらへどうぞ。", kana: "こちらへどうぞ", romaji: "kochira e douzo", yue: "這邊請", use: "帶位時店員說", who: "staff" },
    { id: "rest-26", ja: "ラーメンがおすすめです。", kana: "ラーメンがおすすめです", romaji: "raamen ga osusume desu", yue: "推薦拉麵", use: "被問到推薦時店員回答（「ラーメン」可換成其他菜式）", who: "staff" },
    { id: "rest-27", ja: "はい、入っています。", kana: "はい、はいっています", romaji: "hai, haitte imasu", yue: "是的，有放", use: "被問到「有放蛋嗎？」時店員回答", who: "staff" },
    { id: "rest-28", ja: "いいえ、入っていません。", kana: "いいえ、はいっていません", romaji: "iie, haitte imasen", yue: "沒有放", use: "被問到「有放蛋嗎？」時店員回答", who: "staff" },
    { id: "rest-29", ja: "確認します。少々お待ちください。", kana: "かくにんします。しょうしょうおまちください", romaji: "kakunin shimasu. shoushou omachi kudasai", yue: "我確認一下，請稍等", use: "食物過敏等需要向廚房確認時店員說", who: "staff" },
    { id: "rest-30", ja: "全部で1,200円です。", kana: "ぜんぶでせんにひゃくえんです", romaji: "zenbu de sen nihyaku en desu", yue: "一共 1,200 日圓", use: "結帳時店員說（金額會變）", who: "staff" },
    { id: "rest-31", ja: "ご注文をどうぞ。", kana: "ごちゅうもんをどうぞ", romaji: "gochuumon o douzo", yue: "請點餐", use: "快餐店店員說", who: "staff" },
    { id: "rest-32", ja: "お飲み物はいかがですか。", kana: "おのみものはいかがですか", romaji: "onomimono wa ikaga desu ka", yue: "請問需要飲料嗎？", use: "快餐店店員詢問", who: "staff" },
    { id: "rest-33", ja: "コーヒーをください。", kana: "コーヒーをください", romaji: "koohii o kudasai", yue: "請給我咖啡", use: "點飲料（「コーヒー」可換成其他飲料）", who: "me" },
    { id: "rest-34", ja: "以上でよろしいですか。", kana: "いじょうでよろしいですか", romaji: "ijou de yoroshii desu ka", yue: "請問這樣就可以了嗎？", use: "點餐完畢時店員確認", who: "staff" },
  ];

  const SHOPPING = [
    { id: "shop-01", ja: "これはいくらですか。", kana: "これはいくらですか", romaji: "kore wa ikura desu ka", yue: "這個多少錢？", use: "詢問價錢", who: "me" },
    { id: "shop-02", ja: "見ているだけです。", kana: "みているだけです", romaji: "mite iru dake desu", yue: "我只是看看", use: "店員前來招呼時說", who: "me" },
    { id: "shop-03", ja: "試着してもいいですか。", kana: "しちゃくしてもいいですか", romaji: "shichaku shite mo ii desu ka", yue: "可以試穿嗎？", use: "購買衣服、褲子、鞋子時", who: "me" },
    { id: "shop-04", ja: "他の色はありますか。", kana: "ほかのいろはありますか", romaji: "hoka no iro wa arimasu ka", yue: "有沒有其他顏色？", use: "挑選顏色時", who: "me" },
    { id: "shop-05", ja: "もっと大きいサイズはありますか。", kana: "もっとおおきいサイズはありますか", romaji: "motto ookii saizu wa arimasu ka", yue: "有沒有大一點的尺碼？", use: "試穿後覺得太小", who: "me" },
    { id: "shop-06", ja: "もっと小さいサイズはありますか。", kana: "もっとちいさいサイズはありますか", romaji: "motto chiisai saizu wa arimasu ka", yue: "有沒有小一點的尺碼？", use: "試穿後覺得太大", who: "me" },
    { id: "shop-07", ja: "薬はどこにありますか。", kana: "くすりはどこにありますか", romaji: "kusuri wa doko ni arimasu ka", yue: "哪裡有藥？", use: "尋找商品（「薬」可換成其他東西）", who: "me" },
    { id: "shop-08", ja: "これにします。", kana: "これにします", romaji: "kore ni shimasu", yue: "我要這個（決定購買）", use: "選好後決定購買", who: "me" },
    {
      id: "shop-09", ja: "免税できますか。", kana: "めんぜいできますか", romaji: "menzei dekimasu ka", yue: "可以免稅嗎？", who: "me",
      use: "詢問這間店是否辦理免稅／退稅（2026 年 11 月 1 日起，購物時先支付含稅價，出境時經海關確認後才退稅）",
    },
    { id: "shop-10", ja: "パスポートをお願いします。", kana: "パスポートをおねがいします", romaji: "pasupooto o onegai shimasu", yue: "麻煩請出示護照", use: "辦理免稅時店員說", who: "staff" },
    {
      id: "shop-11", ja: "ポイントカードはお持ちですか。", kana: "ポイントカードはおもちですか", romaji: "pointo kaado wa omochi desu ka", yue: "有積分卡嗎？", use: "結帳時很常聽到", who: "staff",
      replies: [
        { id: "shop-12", ja: "持っていません。", kana: "もっていません", romaji: "motte imasen", yue: "沒有（我沒有這樣東西）", use: "回答「有積分卡嗎？」", who: "me" },
      ],
    },
    {
      id: "shop-13", ja: "お支払いはどうなさいますか。", kana: "おしはらいはどうなさいますか", romaji: "oshiharai wa dou nasaimasu ka", yue: "請問如何付款？", use: "結帳時詢問用現金還是信用卡", who: "staff",
      replies: [
        { id: "shop-15", ja: "現金でお願いします。", kana: "げんきんでおねがいします", romaji: "genkin de onegai shimasu", yue: "我用現金付款", use: "回答「請問如何付款？」", who: "me" },
      ],
    },
    { id: "shop-14", ja: "カードで払えますか。", kana: "カードではらえますか", romaji: "kaado de haraemasu ka", yue: "可以用卡付款嗎？", use: "付款前詢問", who: "me" },
    {
      id: "shop-16", ja: "袋はご利用ですか。", kana: "ふくろはごりようですか", romaji: "fukuro wa goriyou desu ka", yue: "需要袋子嗎？", use: "結帳時詢問（塑膠袋通常需要收費）", who: "staff",
      replies: [
        { id: "shop-17", ja: "袋をください。", kana: "ふくろをください", romaji: "fukuro o kudasai", yue: "麻煩請給我一個袋子", use: "回答「需要袋子嗎？」（需要）", who: "me" },
        { id: "shop-18", ja: "袋は大丈夫です。", kana: "ふくろはだいじょうぶです", romaji: "fukuro wa daijoubu desu", yue: "不需要袋子", use: "回答「需要袋子嗎？」（不需要）", who: "me" },
      ],
    },
    {
      id: "shop-19", ja: "温めますか。", kana: "あたためますか", romaji: "atatamemasu ka", yue: "需要加熱嗎？", use: "在便利店購買便當時詢問", who: "staff",
      replies: [
        { id: "shop-21", ja: "はい、お願いします。", kana: "はい、おねがいします", romaji: "hai, onegai shimasu", yue: "好的，麻煩您", use: "回答「需要加熱嗎？」（要加熱）", who: "me" },
        { id: "shop-22", ja: "大丈夫です。", kana: "だいじょうぶです", romaji: "daijoubu desu", yue: "不用了", use: "回答「需要加熱嗎？」（不用加熱）", who: "me" },
      ],
    },
    { id: "shop-20", ja: "レシートをください。", kana: "レシートをください", romaji: "reshiito o kudasai", yue: "麻煩請給我收據", use: "需要收據時說", who: "me" },
    // stage 7a — new sentences
    { id: "shop-23", ja: "カードでお願いします。", kana: "カードでおねがいします", romaji: "kaado de onegai shimasu", yue: "我用信用卡付款", use: "回答「請問如何付款？」", who: "me" },
    { id: "shop-24", ja: "あちらです。", kana: "あちらです", romaji: "achira desu", yue: "在那邊", use: "被問到商品或地點位置時店員回答", who: "staff" },
    { id: "shop-25", ja: "はい、できます。", kana: "はい、できます", romaji: "hai, dekimasu", yue: "是的，可以辦理", use: "被問到「可以免稅嗎？」時店員回答", who: "staff" },
    { id: "shop-26", ja: "すみません、免税はできません。", kana: "すみません、めんぜいはできません", romaji: "sumimasen, menzei wa dekimasen", yue: "不好意思，無法辦理免稅", use: "店員回答（不辦理免稅）", who: "staff" },
  ];

  // ── stage 4 (2026-10-03, checked by the user) ──

  const TRANSPORT = [
    { id: "trans-01", ja: "切符はどこで買えますか。", kana: "きっぷはどこでかえますか", romaji: "kippu wa doko de kaemasu ka", yue: "在哪裡買車票？", use: "在車站尋找售票機", who: "me" },
    { id: "trans-02", ja: "東京までの切符を一枚ください。", kana: "とうきょうまでのきっぷをいちまいください", romaji: "toukyou made no kippu o ichimai kudasai", yue: "麻煩您，我要一張前往東京的車票", use: "在售票處購票（「東京」可換成目的地）", who: "me" },
    { id: "trans-03", ja: "ICカードにチャージしたいです。", kana: "アイシーカードにチャージしたいです", romaji: "aishii kaado ni chaaji shitai desu", yue: "我想為交通卡增值", use: "Suica、ICOCA 等交通卡", who: "me" },
    { id: "trans-04", ja: "この電車は新宿に行きますか。", kana: "このでんしゃはしんじゅくにいきますか", romaji: "kono densha wa shinjuku ni ikimasu ka", yue: "這班電車有到新宿嗎？", use: "上車前確認（地名可替換）", who: "me" },
    { id: "trans-05", ja: "新宿行きは何番線ですか。", kana: "しんじゅくゆきはなんばんせんですか", romaji: "shinjuku yuki wa nanbansen desu ka", yue: "前往新宿的車在幾號月台？", use: "詢問月台", who: "me" },
    { id: "trans-06", ja: "次の電車は何時ですか。", kana: "つぎのでんしゃはなんじですか", romaji: "tsugi no densha wa nanji desu ka", yue: "下一班車是幾點？", use: "詢問班次", who: "me" },
    { id: "trans-07", ja: "終電は何時ですか。", kana: "しゅうでんはなんじですか", romaji: "shuuden wa nanji desu ka", yue: "末班車是幾點？", use: "晚上外出前詢問", who: "me" },
    { id: "trans-08", ja: "乗り換えは必要ですか。", kana: "のりかえはひつようですか", romaji: "norikae wa hitsuyou desu ka", yue: "需要轉車嗎？", use: "詢問路線", who: "me" },
    { id: "trans-09", ja: "どこで乗り換えますか。", kana: "どこでのりかえますか", romaji: "doko de norikaemasu ka", yue: "要在哪裡轉車？", use: "詢問路線", who: "me" },
    { id: "trans-10", ja: "何分かかりますか。", kana: "なんぷんかかりますか", romaji: "nanpun kakarimasu ka", yue: "需要幾分鐘？", use: "詢問車程", who: "me" },
    { id: "trans-11", ja: "渋谷に着いたら教えてください。", kana: "しぶやについたらおしえてください", romaji: "shibuya ni tsuitara oshiete kudasai", yue: "到了澀谷請告訴我", use: "搭乘巴士、的士時請司機提醒你（地名可替換）", who: "me" },
    { id: "trans-12", ja: "この席は空いていますか。", kana: "このせきはあいていますか", romaji: "kono seki wa aite imasu ka", yue: "這個座位有人坐嗎？", use: "在車上尋找座位", who: "me" },
    { id: "trans-13", ja: "まもなく電車が参ります。", kana: "まもなくでんしゃがまいります", romaji: "mamonaku densha ga mairimasu", yue: "列車即將到站", use: "月台廣播", who: "staff" },
    { id: "trans-14", ja: "次は東京です。", kana: "つぎはとうきょうです", romaji: "tsugi wa toukyou desu", yue: "下一站是東京", use: "車廂廣播", who: "staff" },
    {
      id: "trans-15", ja: "どちらまでですか。", kana: "どちらまでですか", romaji: "dochira made desu ka", yue: "請問要去哪裡？", use: "的士司機詢問", who: "staff",
      replies: [
        { id: "trans-16", ja: "この住所までお願いします。", kana: "このじゅうしょまでおねがいします", romaji: "kono juusho made onegai shimasu", yue: "麻煩您，請前往這個地址", use: "回答「請問要去哪裡？」，同時給司機看地址", who: "me" },
      ],
    },
    { id: "trans-17", ja: "空港まで、いくらぐらいかかりますか。", kana: "くうこうまで、いくらぐらいかかりますか", romaji: "kuukou made, ikura gurai kakarimasu ka", yue: "到機場大約要多少錢？", use: "上的士前詢問車費", who: "me" },
    { id: "trans-18", ja: "トランクを開けてください。", kana: "トランクをあけてください", romaji: "toranku o akete kudasai", yue: "麻煩您打開尾箱", use: "有行李時說", who: "me" },
    { id: "trans-19", ja: "ここで止めてください。", kana: "ここでとめてください", romaji: "koko de tomete kudasai", yue: "請在這裡停車", use: "的士下車時", who: "me" },
    // stage 7a — new sentences
    { id: "trans-20", ja: "あちらの券売機です。", kana: "あちらのけんばいきです", romaji: "achira no kenbaiki desu", yue: "在那邊的售票機", use: "被問到哪裡買票時回答", who: "staff" },
    { id: "trans-21", ja: "片道ですか、往復ですか。", kana: "かたみちですか、おうふくですか", romaji: "katamichi desu ka, oufuku desu ka", yue: "單程還是來回？", use: "買票時店員詢問", who: "staff" },
    { id: "trans-22", ja: "片道でお願いします。", kana: "かたみちでおねがいします", romaji: "katamichi de onegai shimasu", yue: "麻煩您，單程", use: "回答「單程還是來回？」", who: "me" },
    { id: "trans-23", ja: "往復でお願いします。", kana: "おうふくでおねがいします", romaji: "oufuku de onegai shimasu", yue: "麻煩您，來回", use: "回答「單程還是來回？」", who: "me" },
    { id: "trans-24", ja: "3番線です。", kana: "さんばんせんです", romaji: "sanbansen desu", yue: "三號月台", use: "被問到月台時回答（數字會變）", who: "staff" },
    { id: "trans-25", ja: "5番線です。", kana: "ごばんせんです", romaji: "gobansen desu", yue: "五號月台", use: "被問到月台時回答（數字會變）", who: "staff" },
    { id: "trans-26", ja: "渋谷駅までお願いします。", kana: "しぶやえきまでおねがいします", romaji: "shibuya eki made onegai shimasu", yue: "麻煩您載我到澀谷站", use: "對的士司機說目的地（地名可替換）", who: "me" },
    { id: "trans-27", ja: "10分ぐらいです。", kana: "じゅっぷんぐらいです", romaji: "juppun gurai desu", yue: "大約十分鐘", use: "司機回答車程（數字會變）", who: "staff" },
    { id: "trans-28", ja: "20分ぐらいです。", kana: "にじゅっぷんぐらいです", romaji: "nijuppun gurai desu", yue: "大約二十分鐘", use: "司機回答車程（數字會變）", who: "staff" },
    { id: "trans-29", ja: "すみません、現金のみです。", kana: "すみません、げんきんのみです", romaji: "sumimasen, genkin nomi desu", yue: "不好意思，只收現金", use: "司機回答「可以用卡付款嗎？」", who: "staff" },
    { id: "trans-30", ja: "1,800円です。", kana: "せんはっぴゃくえんです", romaji: "sen happyaku en desu", yue: "1,800 日圓", use: "的士下車時司機說（金額會變）", who: "staff" },
  ];

  const HOTEL = [
    { id: "hotel-01", ja: "チェックインをお願いします。", kana: "チェックインをおねがいします", romaji: "chekkuin o onegai shimasu", yue: "我想辦理入住", use: "到酒店櫃位時說", who: "me" },
    { id: "hotel-02", ja: "予約しています。", kana: "よやくしています", romaji: "yoyaku shite imasu", yue: "我有訂房", use: "辦理入住時說", who: "me" },
    {
      id: "hotel-03", ja: "パスポートをお見せください。", kana: "パスポートをおみせください", romaji: "pasupooto o omise kudasai", yue: "麻煩請出示護照", use: "辦理入住時職員說", who: "staff",
      replies: [
        { id: "hotel-04", ja: "はい、どうぞ。", kana: "はい、どうぞ", romaji: "hai, douzo", yue: "好的，給您", use: "回答「麻煩請出示護照」，並遞上護照", who: "me" },
      ],
    },
    { id: "hotel-05", ja: "こちらがお部屋の鍵です。", kana: "こちらがおへやのかぎです", romaji: "kochira ga oheya no kagi desu", yue: "這是您房間的鎖匙", use: "職員交付房卡時說", who: "staff" },
    { id: "hotel-06", ja: "チェックアウトは何時ですか。", kana: "チェックアウトはなんじですか", romaji: "chekkuauto wa nanji desu ka", yue: "幾點要退房？", use: "辦理入住時詢問", who: "me" },
    { id: "hotel-07", ja: "朝食は何時からですか。", kana: "ちょうしょくはなんじからですか", romaji: "choushoku wa nanji kara desu ka", yue: "早餐幾點開始？", use: "詢問早餐時間", who: "me" },
    { id: "hotel-08", ja: "Wi-Fiのパスワードを教えてください。", kana: "ワイファイのパスワードをおしえてください", romaji: "waifai no pasuwaado o oshiete kudasai", yue: "麻煩您告訴我 Wi-Fi 密碼", use: "詢問 Wi-Fi", who: "me" },
    {
      id: "hotel-09", ja: "荷物を預かってもらえますか。", kana: "にもつをあずかってもらえますか", romaji: "nimotsu o azukatte moraemasu ka", yue: "可以幫我寄存行李嗎？", use: "辦理入住前或退房後", who: "me",
      replies: [
        { id: "hotel-10", ja: "はい、お預かりします。", kana: "はい、おあずかりします", romaji: "hai, oazukari shimasu", yue: "好的，幫您保管", use: "職員回答「可以幫我寄存行李嗎？」", who: "staff" },
      ],
    },
    { id: "hotel-11", ja: "荷物を取りに来ました。", kana: "にもつをとりにきました", romaji: "nimotsu o tori ni kimashita", yue: "我來取回行李", use: "回來領取寄存的行李", who: "me" },
    { id: "hotel-12", ja: "部屋の鍵をなくしました。", kana: "へやのかぎをなくしました", romaji: "heya no kagi o nakushimashita", yue: "我弄丟了房間鎖匙（房卡）", use: "遺失房卡時說", who: "me" },
    { id: "hotel-13", ja: "エアコンが動きません。", kana: "エアコンがうごきません", romaji: "eakon ga ugokimasen", yue: "冷氣無法運作（壞了）", use: "房間問題", who: "me" },
    { id: "hotel-14", ja: "お湯が出ません。", kana: "おゆがでません", romaji: "oyu ga demasen", yue: "沒有熱水", use: "房間問題", who: "me" },
    { id: "hotel-15", ja: "隣の部屋がうるさいです。", kana: "となりのへやがうるさいです", romaji: "tonari no heya ga urusai desu", yue: "隔壁房間很吵", use: "房間問題", who: "me" },
    { id: "hotel-16", ja: "部屋を変えてもらえますか。", kana: "へやをかえてもらえますか", romaji: "heya o kaete moraemasu ka", yue: "可以換房間嗎？", use: "房間有問題時說", who: "me" },
    { id: "hotel-17", ja: "タオルをもう一枚ください。", kana: "タオルをもういちまいください", romaji: "taoru o mou ichimai kudasai", yue: "麻煩您多給我一條毛巾", use: "需要更多用品時說", who: "me" },
    { id: "hotel-18", ja: "タクシーを呼んでもらえますか。", kana: "タクシーをよんでもらえますか", romaji: "takushii o yonde moraemasu ka", yue: "可以幫我叫一輛的士嗎？", use: "請櫃位協助", who: "me" },
    { id: "hotel-19", ja: "チェックアウトをお願いします。", kana: "チェックアウトをおねがいします", romaji: "chekkuauto o onegai shimasu", yue: "我想退房", use: "退房時說", who: "me" },
    { id: "hotel-20", ja: "ごゆっくりどうぞ。", kana: "ごゆっくりどうぞ", romaji: "goyukkuri douzo", yue: "請慢慢享受（好好休息）", use: "職員的客氣話，不必回應", who: "staff" },
    // stage 7a — new sentences
    { id: "hotel-21", ja: "こちらにご記入をお願いします。", kana: "こちらにごきにゅうをおねがいします", romaji: "kochira ni gokinyuu o onegai shimasu", yue: "麻煩您在這裡填寫", use: "辦理入住時職員說", who: "staff" },
    { id: "hotel-22", ja: "11時です。", kana: "じゅういちじです", romaji: "juuichiji desu", yue: "十一點", use: "被問到退房時間時職員回答（時間會變）", who: "staff" },
    { id: "hotel-23", ja: "10時です。", kana: "じゅうじです", romaji: "juuji desu", yue: "十點", use: "被問到退房時間時職員回答（時間會變）", who: "staff" },
    { id: "hotel-24", ja: "7時からです。", kana: "しちじからです", romaji: "shichiji kara desu", yue: "從七點開始", use: "被問到早餐時間時職員回答（時間會變）", who: "staff" },
    { id: "hotel-25", ja: "8時からです。", kana: "はちじからです", romaji: "hachiji kara desu", yue: "從八點開始", use: "被問到早餐時間時職員回答（時間會變）", who: "staff" },
    { id: "hotel-26", ja: "すみません、満室です。", kana: "すみません、まんしつです", romaji: "sumimasen, manshitsu desu", yue: "不好意思，客滿了", use: "沒有訂房而酒店已滿時職員回答", who: "staff" },
  ];

  const DIRECTIONS = [
    {
      id: "dir-01", ja: "駅はどこですか。", kana: "えきはどこですか", romaji: "eki wa doko desu ka", yue: "車站在哪裡？", use: "尋找車站", who: "me",
      replies: [
        { id: "dir-02", ja: "この先です。", kana: "このさきです", romaji: "kono saki desu", yue: "就在前面", use: "回答「車站在哪裡？」", who: "staff" },
      ],
    },
    { id: "dir-03", ja: "ここへ行きたいです。", kana: "ここへいきたいです", romaji: "koko e ikitai desu", yue: "我想去這裡", use: "指著地圖或手機說", who: "me" },
    { id: "dir-04", ja: "この場所への行き方を教えてください。", kana: "このばしょへのいきかたをおしえてください", romaji: "kono basho e no ikikata o oshiete kudasai", yue: "麻煩您告訴我怎麼去這裡", use: "問路", who: "me" },
    { id: "dir-05", ja: "地図で教えてもらえますか。", kana: "ちずでおしえてもらえますか", romaji: "chizu de oshiete moraemasu ka", yue: "可以在地圖上指給我看嗎？", use: "聽不懂時請對方在地圖上指示", who: "me" },
    {
      id: "dir-06", ja: "歩いて行けますか。", kana: "あるいていけますか", romaji: "aruite ikemasu ka", yue: "走得到嗎？", use: "詢問距離", who: "me",
      replies: [
        { id: "dir-07", ja: "歩いて5分くらいです。", kana: "あるいてごふんくらいです", romaji: "aruite gofun kurai desu", yue: "走路大約五分鐘", use: "回答「走得到嗎？」", who: "staff" },
      ],
    },
    { id: "dir-08", ja: "ここから遠いですか。", kana: "ここからとおいですか", romaji: "koko kara tooi desu ka", yue: "從這裡過去遠不遠？", use: "詢問距離", who: "me" },
    { id: "dir-09", ja: "この近くにコンビニはありますか。", kana: "このちかくにコンビニはありますか", romaji: "kono chikaku ni konbini wa arimasu ka", yue: "附近有沒有便利店？", use: "尋找地方（「コンビニ」可替換）", who: "me" },
    { id: "dir-10", ja: "道に迷いました。", kana: "みちにまよいました", romaji: "michi ni mayoimashita", yue: "我迷路了", use: "求助時作為開場白", who: "me" },
    { id: "dir-11", ja: "まっすぐ行ってください。", kana: "まっすぐいってください", romaji: "massugu itte kudasai", yue: "一直走", use: "指路", who: "staff" },
    { id: "dir-12", ja: "右に曲がってください。", kana: "みぎにまがってください", romaji: "migi ni magatte kudasai", yue: "右轉", use: "指路", who: "staff" },
    { id: "dir-13", ja: "左に曲がってください。", kana: "ひだりにまがってください", romaji: "hidari ni magatte kudasai", yue: "左轉", use: "指路", who: "staff" },
    { id: "dir-14", ja: "二つ目の角を右です。", kana: "ふたつめのかどをみぎです", romaji: "futatsume no kado o migi desu", yue: "在第二個路口右轉", use: "指路", who: "staff" },
    { id: "dir-15", ja: "信号を渡ってください。", kana: "しんごうをわたってください", romaji: "shingou o watatte kudasai", yue: "在紅綠燈處過馬路", use: "指路", who: "staff" },
    { id: "dir-16", ja: "右側にあります。", kana: "みぎがわにあります", romaji: "migigawa ni arimasu", yue: "在右手邊", use: "指路", who: "staff" },
    { id: "dir-17", ja: "左側にあります。", kana: "ひだりがわにあります", romaji: "hidarigawa ni arimasu", yue: "在左手邊", use: "指路", who: "staff" },
    { id: "dir-18", ja: "反対側です。", kana: "はんたいがわです", romaji: "hantaigawa desu", yue: "在對面", use: "指路", who: "staff" },
  ];

  const EMERGENCY = [
    { id: "emer-01", ja: "助けてください。", kana: "たすけてください", romaji: "tasukete kudasai", yue: "救命／幫幫我", use: "緊急求助", who: "me" },
    { id: "emer-02", ja: "どうしましたか。", kana: "どうしましたか", romaji: "dou shimashita ka", yue: "發生什麼事了？", use: "職員或路人詢問你", who: "staff" },
    {
      id: "emer-03", ja: "大丈夫ですか。", kana: "だいじょうぶですか", romaji: "daijoubu desu ka", yue: "你沒事吧？", use: "別人關心你時說", who: "staff",
      replies: [
        { id: "emer-04", ja: "大丈夫です。", kana: "だいじょうぶです", romaji: "daijoubu desu", yue: "我沒事", use: "回答「你沒事吧？」", who: "me" },
      ],
    },
    { id: "emer-05", ja: "気分が悪いです。", kana: "きぶんがわるいです", romaji: "kibun ga warui desu", yue: "我不舒服", use: "身體不適", who: "me" },
    { id: "emer-06", ja: "ここが痛いです。", kana: "ここがいたいです", romaji: "koko ga itai desu", yue: "這裡痛", use: "指著疼痛的位置說", who: "me" },
    { id: "emer-07", ja: "頭が痛いです。", kana: "あたまがいたいです", romaji: "atama ga itai desu", yue: "頭痛", use: "身體不適", who: "me" },
    { id: "emer-08", ja: "お腹が痛いです。", kana: "おなかがいたいです", romaji: "onaka ga itai desu", yue: "肚子痛", use: "身體不適", who: "me" },
    { id: "emer-09", ja: "熱があります。", kana: "ねつがあります", romaji: "netsu ga arimasu", yue: "發燒", use: "身體不適", who: "me" },
    { id: "emer-10", ja: "病院はどこですか。", kana: "びょういんはどこですか", romaji: "byouin wa doko desu ka", yue: "醫院在哪裡？", use: "尋找醫院", who: "me" },
    { id: "emer-11", ja: "近くに薬局はありますか。", kana: "ちかくにやっきょくはありますか", romaji: "chikaku ni yakkyoku wa arimasu ka", yue: "附近有沒有藥房？", use: "尋找藥房", who: "me" },
    { id: "emer-12", ja: "救急車を呼んでください。", kana: "きゅうきゅうしゃをよんでください", romaji: "kyuukyuusha o yonde kudasai", yue: "麻煩您叫救護車", use: "日本救護車及火警電話：119", who: "me" },
    {
      id: "emer-13", ja: "火事ですか、救急ですか。", kana: "かじですか、きゅうきゅうですか", romaji: "kaji desu ka, kyuukyuu desu ka", yue: "是火警還是要叫救護車？", use: "撥打 119 時接線員的第一句提問", who: "staff",
      replies: [
        { id: "emer-14", ja: "救急です。", kana: "きゅうきゅうです", romaji: "kyuukyuu desu", yue: "要叫救護車", use: "回答上一句", who: "me" },
      ],
    },
    { id: "emer-15", ja: "警察を呼んでください。", kana: "けいさつをよんでください", romaji: "keisatsu o yonde kudasai", yue: "麻煩您報警", use: "緊急（日本報警電話：110）", who: "me" },
    { id: "emer-16", ja: "交番はどこですか。", kana: "こうばんはどこですか", romaji: "kouban wa doko desu ka", yue: "警崗在哪裡？", use: "尋找街頭警崗（遺失物品、問路都可前往）", who: "me" },
    { id: "emer-17", ja: "財布をなくしました。", kana: "さいふをなくしました", romaji: "saifu o nakushimashita", yue: "我的銀包不見了", use: "遺失物品", who: "me" },
    { id: "emer-18", ja: "パスポートをなくしました。", kana: "パスポートをなくしました", romaji: "pasupooto o nakushimashita", yue: "我的護照不見了", use: "遺失物品", who: "me" },
    { id: "emer-19", ja: "携帯電話を電車に忘れました。", kana: "けいたいでんわをでんしゃにわすれました", romaji: "keitai denwa o densha ni wasuremashita", yue: "我把手機遺留在火車上", use: "遺失物品（向車站職員說明）", who: "me" },
    { id: "emer-20", ja: "財布を盗まれました。", kana: "さいふをぬすまれました", romaji: "saifu o nusumaremashita", yue: "我的銀包被偷了", use: "報警時說", who: "me" },
    { id: "emer-21", ja: "英語を話せる人はいますか。", kana: "えいごをはなせるひとはいますか", romaji: "eigo o hanaseru hito wa imasu ka", yue: "有沒有會說英文的人？", use: "無法溝通時說", who: "me" },
    // stage 7a — new sentences
    { id: "emer-22", ja: "病院に行きますか。", kana: "びょういんにいきますか", romaji: "byouin ni ikimasu ka", yue: "要去醫院嗎？", use: "對方詢問你是否要就醫", who: "staff" },
    { id: "emer-23", ja: "救急車を呼びましょうか。", kana: "きゅうきゅうしゃをよびましょうか", romaji: "kyuukyuusha o yobimashou ka", yue: "要不要幫您叫救護車？", use: "對方主動提出幫忙叫救護車", who: "staff" },
    { id: "emer-24", ja: "お大事に。", kana: "おだいじに", romaji: "odaiji ni", yue: "請多保重", use: "對生病或受傷的人說", who: "staff" },
    { id: "emer-25", ja: "どこでなくしましたか。", kana: "どこでなくしましたか", romaji: "doko de nakushimashita ka", yue: "在哪裡弄丟的？", use: "報失物品時警察或職員詢問", who: "staff" },
    { id: "emer-26", ja: "駅の近くだと思います。", kana: "えきのちかくだとおもいます", romaji: "eki no chikaku da to omoimasu", yue: "我想是在車站附近", use: "回答遺失地點（「駅」可替換）", who: "me" },
    { id: "emer-27", ja: "わかりません。", kana: "わかりません", romaji: "wakarimasen", yue: "我不知道", use: "不清楚或聽不懂時說", who: "me" },
    { id: "emer-28", ja: "財布の色を教えてください。", kana: "さいふのいろをおしえてください", romaji: "saifu no iro o oshiete kudasai", yue: "請告訴我銀包的顏色", use: "報失銀包時警察詢問", who: "staff" },
    { id: "emer-29", ja: "黒です。", kana: "くろです", romaji: "kuro desu", yue: "是黑色的", use: "回答顏色（「黒」可換成其他顏色）", who: "me" },
    { id: "emer-30", ja: "茶色です。", kana: "ちゃいろです", romaji: "chairo desu", yue: "是棕色的", use: "回答顏色", who: "me" },
    { id: "emer-31", ja: "ここに名前と連絡先を書いてください。", kana: "ここになまえとれんらくさきをかいてください", romaji: "koko ni namae to renrakusaki o kaite kudasai", yue: "請在這裡寫下姓名與聯絡方式", use: "報失物品時警察要求填寫", who: "staff" },
    { id: "emer-32", ja: "見つかったら連絡します。", kana: "みつかったられんらくします", romaji: "mitsukattara renraku shimasu", yue: "找到後會與您聯絡", use: "報失物品後警察說明後續", who: "staff" },
  ];

  // Emergency numbers card shown at the top of 緊急情況 (user-supplied).
  // `tel` is the dialable form (tel: link); `show` is what's displayed.
  const EMERGENCY_INFO = {
    title: "緊急電話（按號碼即可撥打）",
    items: [
      { label: "報警", show: "110", tel: "110" },
      { label: "火警及救護車", show: "119", tel: "119" },
      { label: "JNTO 訪日旅客熱線（24 小時，有中文服務）", show: "050-3816-2787", tel: "+81-50-3816-2787" },
      { label: "香港入境處協助在外香港居民小組（24 小時，包括遺失護照）", show: "(852) 1868", tel: "+852-1868" },
    ],
  };

  window.App.Content.PHRASE_SCENES = [
    { key: "polite", label: "基本禮貌", emoji: "🙇", phrases: POLITE },
    { key: "restaurant", label: "餐廳", emoji: "🍜", phrases: RESTAURANT },
    { key: "shopping", label: "購物", emoji: "🛍️", phrases: SHOPPING },
    { key: "transport", label: "交通", emoji: "🚃", phrases: TRANSPORT },
    { key: "hotel", label: "酒店", emoji: "🏨", phrases: HOTEL },
    { key: "directions", label: "問路", emoji: "🗺️", phrases: DIRECTIONS },
    { key: "emergency", label: "緊急情況", emoji: "🚑", phrases: EMERGENCY, info: EMERGENCY_INFO },
  ];
})();
