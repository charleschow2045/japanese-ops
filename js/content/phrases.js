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

  // ── stage 4 (2026-10-03, checked by the user) ──

  const TRANSPORT = [
    { id: "trans-01", ja: "切符はどこで買えますか。", kana: "きっぷはどこでかえますか", romaji: "kippu wa doko de kaemasu ka", yue: "喺邊度買車飛？", use: "車站搵售票機", who: "me" },
    { id: "trans-02", ja: "東京までの切符を一枚ください。", kana: "とうきょうまでのきっぷをいちまいください", romaji: "toukyou made no kippu o ichimai kudasai", yue: "唔該一張去東京嘅車飛", use: "售票處買飛（「東京」可以換做目的地）", who: "me" },
    { id: "trans-03", ja: "ICカードにチャージしたいです。", kana: "アイシーカードにチャージしたいです", romaji: "aishii kaado ni chaaji shitai desu", yue: "我想增值交通卡", use: "Suica、ICOCA 等交通卡", who: "me" },
    { id: "trans-04", ja: "この電車は新宿に行きますか。", kana: "このでんしゃはしんじゅくにいきますか", romaji: "kono densha wa shinjuku ni ikimasu ka", yue: "呢班車去唔去新宿？", use: "上車前確認（地名可以換）", who: "me" },
    { id: "trans-05", ja: "新宿行きは何番線ですか。", kana: "しんじゅくゆきはなんばんせんですか", romaji: "shinjuku yuki wa nanbansen desu ka", yue: "去新宿喺幾號月台？", use: "問月台", who: "me" },
    { id: "trans-06", ja: "次の電車は何時ですか。", kana: "つぎのでんしゃはなんじですか", romaji: "tsugi no densha wa nanji desu ka", yue: "下一班車幾點？", use: "問班次", who: "me" },
    { id: "trans-07", ja: "終電は何時ですか。", kana: "しゅうでんはなんじですか", romaji: "shuuden wa nanji desu ka", yue: "尾班車幾點？", use: "夜晚出街前問", who: "me" },
    { id: "trans-08", ja: "乗り換えは必要ですか。", kana: "のりかえはひつようですか", romaji: "norikae wa hitsuyou desu ka", yue: "使唔使轉車？", use: "問路線", who: "me" },
    { id: "trans-09", ja: "どこで乗り換えますか。", kana: "どこでのりかえますか", romaji: "doko de norikaemasu ka", yue: "喺邊度轉車？", use: "問路線", who: "me" },
    { id: "trans-10", ja: "何分かかりますか。", kana: "なんぷんかかりますか", romaji: "nanpun kakarimasu ka", yue: "要幾多分鐘？", use: "問車程", who: "me" },
    { id: "trans-11", ja: "渋谷に着いたら教えてください。", kana: "しぶやについたらおしえてください", romaji: "shibuya ni tsuitara oshiete kudasai", yue: "到咗澀谷話我知", use: "搭巴士、的士時請司機提你（地名可以換）", who: "me" },
    { id: "trans-12", ja: "この席は空いていますか。", kana: "このせきはあいていますか", romaji: "kono seki wa aite imasu ka", yue: "呢個位有冇人坐？", use: "車上搵位", who: "me" },
    { id: "trans-13", ja: "まもなく電車が参ります。", kana: "まもなくでんしゃがまいります", romaji: "mamonaku densha ga mairimasu", yue: "列車即將到站", use: "月台廣播", who: "staff" },
    { id: "trans-14", ja: "次は東京です。", kana: "つぎはとうきょうです", romaji: "tsugi wa toukyou desu", yue: "下一站係東京", use: "車廂廣播", who: "staff" },
    {
      id: "trans-15", ja: "どちらまでですか。", kana: "どちらまでですか", romaji: "dochira made desu ka", yue: "去邊度？", use: "的士司機問", who: "staff",
      replies: [
        { id: "trans-16", ja: "この住所までお願いします。", kana: "このじゅうしょまでおねがいします", romaji: "kono juusho made onegai shimasu", yue: "唔該去呢個地址", use: "答「去邊度？」，同時俾司機睇地址", who: "me" },
      ],
    },
    { id: "trans-17", ja: "空港まで、いくらぐらいかかりますか。", kana: "くうこうまで、いくらぐらいかかりますか", romaji: "kuukou made, ikura gurai kakarimasu ka", yue: "去機場大約幾多錢？", use: "上的士前問車費", who: "me" },
    { id: "trans-18", ja: "トランクを開けてください。", kana: "トランクをあけてください", romaji: "toranku o akete kudasai", yue: "唔該開尾箱", use: "有行李時", who: "me" },
    { id: "trans-19", ja: "ここで止めてください。", kana: "ここでとめてください", romaji: "koko de tomete kudasai", yue: "喺度停", use: "的士落車", who: "me" },
  ];

  const HOTEL = [
    { id: "hotel-01", ja: "チェックインをお願いします。", kana: "チェックインをおねがいします", romaji: "chekkuin o onegai shimasu", yue: "我想辦入住", use: "到酒店櫃位", who: "me" },
    { id: "hotel-02", ja: "予約しています。", kana: "よやくしています", romaji: "yoyaku shite imasu", yue: "我有訂房", use: "Check-in 時講", who: "me" },
    {
      id: "hotel-03", ja: "パスポートをお見せください。", kana: "パスポートをおみせください", romaji: "pasupooto o omise kudasai", yue: "唔該俾護照睇", use: "Check-in 時職員講", who: "staff",
      replies: [
        { id: "hotel-04", ja: "はい、どうぞ。", kana: "はい、どうぞ", romaji: "hai, douzo", yue: "好，俾你", use: "答「唔該俾護照睇」，遞護照", who: "me" },
      ],
    },
    { id: "hotel-05", ja: "こちらがお部屋の鍵です。", kana: "こちらがおへやのかぎです", romaji: "kochira ga oheya no kagi desu", yue: "呢個係你房間嘅鎖匙", use: "職員俾房卡時講", who: "staff" },
    { id: "hotel-06", ja: "チェックアウトは何時ですか。", kana: "チェックアウトはなんじですか", romaji: "chekkuauto wa nanji desu ka", yue: "幾點要退房？", use: "Check-in 時問", who: "me" },
    { id: "hotel-07", ja: "朝食は何時からですか。", kana: "ちょうしょくはなんじからですか", romaji: "choushoku wa nanji kara desu ka", yue: "早餐幾點開始？", use: "問早餐時間", who: "me" },
    { id: "hotel-08", ja: "Wi-Fiのパスワードを教えてください。", kana: "ワイファイのパスワードをおしえてください", romaji: "waifai no pasuwaado o oshiete kudasai", yue: "唔該話我知 Wi-Fi 密碼", use: "問 Wi-Fi", who: "me" },
    {
      id: "hotel-09", ja: "荷物を預かってもらえますか。", kana: "にもつをあずかってもらえますか", romaji: "nimotsu o azukatte moraemasu ka", yue: "可唔可以幫我寄存行李？", use: "Check-in 前或者 check-out 後", who: "me",
      replies: [
        { id: "hotel-10", ja: "はい、お預かりします。", kana: "はい、おあずかりします", romaji: "hai, oazukari shimasu", yue: "好，幫你保管", use: "職員答「可唔可以幫我寄存行李？」", who: "staff" },
      ],
    },
    { id: "hotel-11", ja: "荷物を取りに来ました。", kana: "にもつをとりにきました", romaji: "nimotsu o tori ni kimashita", yue: "我嚟攞返行李", use: "返嚟攞寄存嘅行李", who: "me" },
    { id: "hotel-12", ja: "部屋の鍵をなくしました。", kana: "へやのかぎをなくしました", romaji: "heya no kagi o nakushimashita", yue: "我唔見咗房間鎖匙（房卡）", use: "唔見咗房卡", who: "me" },
    { id: "hotel-13", ja: "エアコンが動きません。", kana: "エアコンがうごきません", romaji: "eakon ga ugokimasen", yue: "冷氣唔郁（壞咗）", use: "房間問題", who: "me" },
    { id: "hotel-14", ja: "お湯が出ません。", kana: "おゆがでません", romaji: "oyu ga demasen", yue: "冇熱水", use: "房間問題", who: "me" },
    { id: "hotel-15", ja: "隣の部屋がうるさいです。", kana: "となりのへやがうるさいです", romaji: "tonari no heya ga urusai desu", yue: "隔籬房好嘈", use: "房間問題", who: "me" },
    { id: "hotel-16", ja: "部屋を変えてもらえますか。", kana: "へやをかえてもらえますか", romaji: "heya o kaete moraemasu ka", yue: "可唔可以換房？", use: "房間有問題時", who: "me" },
    { id: "hotel-17", ja: "タオルをもう一枚ください。", kana: "タオルをもういちまいください", romaji: "taoru o mou ichimai kudasai", yue: "唔該俾多條毛巾", use: "要多啲用品", who: "me" },
    { id: "hotel-18", ja: "タクシーを呼んでもらえますか。", kana: "タクシーをよんでもらえますか", romaji: "takushii o yonde moraemasu ka", yue: "可唔可以幫我叫架的士？", use: "請櫃位幫手", who: "me" },
    { id: "hotel-19", ja: "チェックアウトをお願いします。", kana: "チェックアウトをおねがいします", romaji: "chekkuauto o onegai shimasu", yue: "我想退房", use: "退房時", who: "me" },
    { id: "hotel-20", ja: "ごゆっくりどうぞ。", kana: "ごゆっくりどうぞ", romaji: "goyukkuri douzo", yue: "請慢慢享受（好好休息）", use: "職員客氣說話，唔使回應", who: "staff" },
  ];

  const DIRECTIONS = [
    {
      id: "dir-01", ja: "駅はどこですか。", kana: "えきはどこですか", romaji: "eki wa doko desu ka", yue: "車站喺邊？", use: "搵車站", who: "me",
      replies: [
        { id: "dir-02", ja: "この先です。", kana: "このさきです", romaji: "kono saki desu", yue: "前面就係", use: "答「車站喺邊？」", who: "staff" },
      ],
    },
    { id: "dir-03", ja: "ここへ行きたいです。", kana: "ここへいきたいです", romaji: "koko e ikitai desu", yue: "我想去呢度", use: "指住地圖或者手機", who: "me" },
    { id: "dir-04", ja: "この場所への行き方を教えてください。", kana: "このばしょへのいきかたをおしえてください", romaji: "kono basho e no ikikata o oshiete kudasai", yue: "唔該話我知點去呢度", use: "問路", who: "me" },
    { id: "dir-05", ja: "地図で教えてもらえますか。", kana: "ちずでおしえてもらえますか", romaji: "chizu de oshiete moraemasu ka", yue: "可唔可以喺地圖指俾我睇？", use: "聽唔明時請對方指地圖", who: "me" },
    {
      id: "dir-06", ja: "歩いて行けますか。", kana: "あるいていけますか", romaji: "aruite ikemasu ka", yue: "行唔行得到？", use: "問遠近", who: "me",
      replies: [
        { id: "dir-07", ja: "歩いて5分くらいです。", kana: "あるいてごふんくらいです", romaji: "aruite gofun kurai desu", yue: "行大約五分鐘", use: "答「行唔行得到？」", who: "staff" },
      ],
    },
    { id: "dir-08", ja: "ここから遠いですか。", kana: "ここからとおいですか", romaji: "koko kara tooi desu ka", yue: "由呢度去遠唔遠？", use: "問遠近", who: "me" },
    { id: "dir-09", ja: "この近くにコンビニはありますか。", kana: "このちかくにコンビニはありますか", romaji: "kono chikaku ni konbini wa arimasu ka", yue: "附近有冇便利店？", use: "搵地方（「コンビニ」可以換）", who: "me" },
    { id: "dir-10", ja: "道に迷いました。", kana: "みちにまよいました", romaji: "michi ni mayoimashita", yue: "我蕩失路", use: "求助時開頭講", who: "me" },
    { id: "dir-11", ja: "まっすぐ行ってください。", kana: "まっすぐいってください", romaji: "massugu itte kudasai", yue: "一直行", use: "指路", who: "staff" },
    { id: "dir-12", ja: "右に曲がってください。", kana: "みぎにまがってください", romaji: "migi ni magatte kudasai", yue: "轉右", use: "指路", who: "staff" },
    { id: "dir-13", ja: "左に曲がってください。", kana: "ひだりにまがってください", romaji: "hidari ni magatte kudasai", yue: "轉左", use: "指路", who: "staff" },
    { id: "dir-14", ja: "二つ目の角を右です。", kana: "ふたつめのかどをみぎです", romaji: "futatsume no kado o migi desu", yue: "第二個街口轉右", use: "指路", who: "staff" },
    { id: "dir-15", ja: "信号を渡ってください。", kana: "しんごうをわたってください", romaji: "shingou o watatte kudasai", yue: "喺紅綠燈過馬路", use: "指路", who: "staff" },
    { id: "dir-16", ja: "右側にあります。", kana: "みぎがわにあります", romaji: "migigawa ni arimasu", yue: "喺右手邊", use: "指路", who: "staff" },
    { id: "dir-17", ja: "左側にあります。", kana: "ひだりがわにあります", romaji: "hidarigawa ni arimasu", yue: "喺左手邊", use: "指路", who: "staff" },
    { id: "dir-18", ja: "反対側です。", kana: "はんたいがわです", romaji: "hantaigawa desu", yue: "喺對面", use: "指路", who: "staff" },
  ];

  const EMERGENCY = [
    { id: "emer-01", ja: "助けてください。", kana: "たすけてください", romaji: "tasukete kudasai", yue: "救命／幫幫我", use: "緊急求助", who: "me" },
    { id: "emer-02", ja: "どうしましたか。", kana: "どうしましたか", romaji: "dou shimashita ka", yue: "咩事呀？", use: "職員或者途人問你", who: "staff" },
    {
      id: "emer-03", ja: "大丈夫ですか。", kana: "だいじょうぶですか", romaji: "daijoubu desu ka", yue: "你冇事吖嘛？", use: "人哋關心你", who: "staff",
      replies: [
        { id: "emer-04", ja: "大丈夫です。", kana: "だいじょうぶです", romaji: "daijoubu desu", yue: "我冇事", use: "答「你冇事吖嘛？」", who: "me" },
      ],
    },
    { id: "emer-05", ja: "気分が悪いです。", kana: "きぶんがわるいです", romaji: "kibun ga warui desu", yue: "我唔舒服", use: "身體不適", who: "me" },
    { id: "emer-06", ja: "ここが痛いです。", kana: "ここがいたいです", romaji: "koko ga itai desu", yue: "呢度痛", use: "指住痛嘅位置", who: "me" },
    { id: "emer-07", ja: "頭が痛いです。", kana: "あたまがいたいです", romaji: "atama ga itai desu", yue: "頭痛", use: "身體不適", who: "me" },
    { id: "emer-08", ja: "お腹が痛いです。", kana: "おなかがいたいです", romaji: "onaka ga itai desu", yue: "肚痛", use: "身體不適", who: "me" },
    { id: "emer-09", ja: "熱があります。", kana: "ねつがあります", romaji: "netsu ga arimasu", yue: "發燒", use: "身體不適", who: "me" },
    { id: "emer-10", ja: "病院はどこですか。", kana: "びょういんはどこですか", romaji: "byouin wa doko desu ka", yue: "醫院喺邊？", use: "搵醫院", who: "me" },
    { id: "emer-11", ja: "近くに薬局はありますか。", kana: "ちかくにやっきょくはありますか", romaji: "chikaku ni yakkyoku wa arimasu ka", yue: "附近有冇藥房？", use: "搵藥房", who: "me" },
    { id: "emer-12", ja: "救急車を呼んでください。", kana: "きゅうきゅうしゃをよんでください", romaji: "kyuukyuusha o yonde kudasai", yue: "唔該叫白車", use: "日本救護車及火警電話：119", who: "me" },
    {
      id: "emer-13", ja: "火事ですか、救急ですか。", kana: "かじですか、きゅうきゅうですか", romaji: "kaji desu ka, kyuukyuu desu ka", yue: "火警定叫白車？", use: "打 119 時接線員第一句會問", who: "staff",
      replies: [
        { id: "emer-14", ja: "救急です。", kana: "きゅうきゅうです", romaji: "kyuukyuu desu", yue: "叫白車", use: "答上一句", who: "me" },
      ],
    },
    { id: "emer-15", ja: "警察を呼んでください。", kana: "けいさつをよんでください", romaji: "keisatsu o yonde kudasai", yue: "唔該報警", use: "緊急（日本報警電話：110）", who: "me" },
    { id: "emer-16", ja: "交番はどこですか。", kana: "こうばんはどこですか", romaji: "kouban wa doko desu ka", yue: "警崗喺邊？", use: "搵街頭警崗（遺失物品、問路都可以去）", who: "me" },
    { id: "emer-17", ja: "財布をなくしました。", kana: "さいふをなくしました", romaji: "saifu o nakushimashita", yue: "我唔見咗銀包", use: "遺失物品", who: "me" },
    { id: "emer-18", ja: "パスポートをなくしました。", kana: "パスポートをなくしました", romaji: "pasupooto o nakushimashita", yue: "我唔見咗護照", use: "遺失物品", who: "me" },
    { id: "emer-19", ja: "携帯電話を電車に忘れました。", kana: "けいたいでんわをでんしゃにわすれました", romaji: "keitai denwa o densha ni wasuremashita", yue: "我將手機留咗喺火車上面", use: "遺失物品（去車站職員處講）", who: "me" },
    { id: "emer-20", ja: "財布を盗まれました。", kana: "さいふをぬすまれました", romaji: "saifu o nusumaremashita", yue: "我個銀包俾人偷咗", use: "報警時講", who: "me" },
    { id: "emer-21", ja: "英語を話せる人はいますか。", kana: "えいごをはなせるひとはいますか", romaji: "eigo o hanaseru hito wa imasu ka", yue: "有冇識講英文嘅人？", use: "溝通唔到時", who: "me" },
  ];

  // Emergency numbers card shown at the top of 緊急情況 (user-supplied).
  // `tel` is the dialable form (tel: link); `show` is what's displayed.
  const EMERGENCY_INFO = {
    title: "緊急電話（撳號碼直接打出）",
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
