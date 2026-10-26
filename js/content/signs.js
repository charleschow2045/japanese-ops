// 看得懂 (stage 10 ⑪): kanji signs you will meet while travelling (SIGNS, 44, 9 groups) and
// "false friends" — Japanese words whose meaning differs from what a Chinese reader guesses
// (FALSE_FRIENDS, 9). All checked by the user on 2026-10-25.
//
// SIGNS entry: { word, kana, romaji, meaning, detail?, where, scene, warn? }
//   meaning = the short 中文意思 shown as an answer option; detail = extra explanation (answer card only);
//   where = where it is seen; scene = group name (≤ 12 chars, the chip label); warn = a highlighted caution.
// FALSE_FRIENDS entry: { word, kana, romaji, meaning, detail, trapOpt, trap, where, scene }
//   meaning = real meaning (option); trapOpt = the meaning a Chinese reader wrongly guesses, short (a
//   fixed wrong option in the 看詞選意思 question); trap = the full explanation shown on the answer card.
// Both kinds share the 看得懂 stats / 重溫 machinery of the katakana words: state.read.stats[word],
// review key "r:<word>" (js/reading.js) — so words must be unique across SIGNS, FALSE_FRIENDS and
// KATAKANA_EXAMPLES. Romaji: Hepburn, long vowels written twice, ’ after ん before a vowel.
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const G = {
    exit: "出入口・通行",
    rail: "車站・交通",
    wc: "洗手間",
    shop: "營業・商店",
    pay: "價錢・付款",
    food: "餐廳",
    ban: "禁止・注意",
    onsen: "溫泉",
    help: "緊急・生活",
  };
  const SIGN_GROUPS = [G.exit, G.rail, G.wc, G.shop, G.pay, G.food, G.ban, G.onsen, G.help];

  const SIGNS = [
    // 出入口・通行
    { scene: G.exit, word: "出口", kana: "でぐち", romaji: "deguchi", meaning: "出口", where: "車站、商場、景點、停車場" },
    { scene: G.exit, word: "入口", kana: "いりぐち", romaji: "iriguchi", meaning: "入口", where: "車站、商場、景點、停車場" },
    { scene: G.exit, word: "非常口", kana: "ひじょうぐち", romaji: "hijouguchi", meaning: "緊急出口", detail: "發生火警等緊急情況時使用的出口", where: "酒店、商場、電車、戲院" },
    { scene: G.exit, word: "押", kana: "おす", romaji: "osu", meaning: "推", detail: "門要用推的", warn: "「押」＝推、「引」＝拉。中文很少用「押」解作推，要特別記住。", where: "門、販賣機、按鈕" },
    { scene: G.exit, word: "引", kana: "ひく", romaji: "hiku", meaning: "拉", detail: "門要用拉的", warn: "「押」＝推、「引」＝拉。中文很少用「押」解作推，要特別記住。", where: "門" },
    // 車站・交通
    { scene: G.rail, word: "改札口", kana: "かいさつぐち", romaji: "kaisatsuguchi", meaning: "閘口", detail: "檢票口，進出站的閘門；常簡稱「改札」", where: "車站" },
    { scene: G.rail, word: "乗り換え", kana: "のりかえ", romaji: "norikae", meaning: "轉乘", detail: "換車", where: "車站、路線圖、電車廣播" },
    { scene: G.rail, word: "乗り場", kana: "のりば", romaji: "noriba", meaning: "乘車處", detail: "巴士站、的士站、碼頭上車的地方，前面常有號碼（例如「3番乗り場」）", where: "車站、巴士總站、機場" },
    { scene: G.rail, word: "精算機", kana: "せいさんき", romaji: "seisanki", meaning: "補票機", detail: "車費不足時補差價的機器；停車場、醫院的結帳機也叫這個名字", where: "閘口旁、停車場、醫院" },
    { scene: G.rail, word: "指定席", kana: "していせき", romaji: "shiteiseki", meaning: "劃位座位", detail: "車票上有座位號碼", where: "新幹線、特急列車" },
    { scene: G.rail, word: "自由席", kana: "じゆうせき", romaji: "jiyuuseki", meaning: "不劃位座位", detail: "先到先坐", where: "新幹線、特急列車" },
    { scene: G.rail, word: "優先席", kana: "ゆうせんせき", romaji: "yuusenseki", meaning: "優先座位", detail: "關愛座，讓給有需要的人", where: "電車、巴士" },
    { scene: G.rail, word: "足元注意", kana: "あしもとちゅうい", romaji: "ashimoto chuui", meaning: "小心腳下", detail: "月台與車廂之間有空隙，或有階梯", where: "月台、車門口、樓梯" },
    { scene: G.rail, word: "発", kana: "はつ", romaji: "hatsu", meaning: "出發", detail: "由……開出，例如「東京発」＝由東京出發", where: "時刻表、車票" },
    { scene: G.rail, word: "着", kana: "ちゃく", romaji: "chaku", meaning: "抵達", detail: "例如「大阪着」＝抵達大阪", where: "時刻表、車票" },
    // 洗手間
    { scene: G.wc, word: "お手洗い", kana: "おてあらい", romaji: "otearai", meaning: "洗手間", detail: "廁所；也寫作「トイレ」「化粧室」", where: "車站、商場、餐廳、酒店" },
    { scene: G.wc, word: "男性", kana: "だんせい", romaji: "dansei", meaning: "男性", detail: "男廁或男性專用；也寫成「男」「男子」", where: "洗手間、更衣室" },
    { scene: G.wc, word: "女性", kana: "じょせい", romaji: "josei", meaning: "女性", detail: "女廁或女性專用；也寫成「女」「女子」", where: "洗手間、更衣室、電車（女性專用車廂）" },
    { scene: G.wc, word: "使用中", kana: "しようちゅう", romaji: "shiyouchuu", meaning: "使用中", detail: "有人在使用，例如洗手間的門", where: "洗手間、試衣間" },
    // 營業・商店
    { scene: G.shop, word: "営業中", kana: "えいぎょうちゅう", romaji: "eigyouchuu", meaning: "營業中", detail: "現在有開", where: "商店、餐廳門口" },
    {
      scene: G.shop,
      word: "準備中",
      kana: "じゅんびちゅう",
      romaji: "junbichuu",
      meaning: "暫停營業",
      detail: "店現在不接客：可能是午休、晚市前，或還沒開店",
      warn: "不是「快要開門」的意思，要看門口寫的營業時間。",
      where: "餐廳、拉麵店門口",
    },
    { scene: G.shop, word: "本日休業", kana: "ほんじつきゅうぎょう", romaji: "honjitsu kyuugyou", meaning: "今天休息", detail: "公休", where: "商店、餐廳門口" },
    { scene: G.shop, word: "定休日", kana: "ていきゅうび", romaji: "teikyuubi", meaning: "固定公休日", detail: "例如每週三", where: "營業時間牌、景點" },
    { scene: G.shop, word: "満席", kana: "まんせき", romaji: "manseki", meaning: "客滿", detail: "餐廳沒有空位", where: "餐廳門口、訂位網站" },
    // 價錢・付款
    { scene: G.pay, word: "無料", kana: "むりょう", romaji: "muryou", meaning: "免費", where: "景點、酒店、公共設施（例如「Wi-Fi 無料」）" },
    { scene: G.pay, word: "割引", kana: "わりびき", romaji: "waribiki", meaning: "折扣", detail: "優惠", where: "商店、車票、景點" },
    { scene: G.pay, word: "税込", kana: "ぜいこみ", romaji: "zeikomi", meaning: "含稅", detail: "價錢已包括消費稅", where: "價錢牌、餐牌、收據" },
    { scene: G.pay, word: "税別", kana: "ぜいべつ", romaji: "zeibetsu", meaning: "未含稅", detail: "結帳時另加消費稅；也寫「税抜」", where: "價錢牌、餐牌" },
    { scene: G.pay, word: "現金のみ", kana: "げんきんのみ", romaji: "genkin nomi", meaning: "只收現金", detail: "不能刷卡", where: "小店、餐廳、神社、販賣機" },
    { scene: G.pay, word: "両替所", kana: "りょうがえじょ", romaji: "ryougaejo", meaning: "兌換處", detail: "外幣兌換日圓的地方", where: "機場、大型車站、銀行" },
    // 餐廳
    { scene: G.food, word: "食券", kana: "しょっけん", romaji: "shokken", meaning: "餐券", detail: "先在售票機買券，再交給店員", where: "拉麵店、定食屋、牛丼店" },
    { scene: G.food, word: "先払い", kana: "さきばらい", romaji: "sakibarai", meaning: "先付款", detail: "付錢後才拿餐", where: "快餐店、拉麵店、咖啡店" },
    // 禁止・注意
    { scene: G.ban, word: "禁煙", kana: "きんえん", romaji: "kin’en", meaning: "禁止吸煙", where: "餐廳、車站、酒店、街上部分路段" },
    { scene: G.ban, word: "喫煙所", kana: "きつえんじょ", romaji: "kitsuenjo", meaning: "吸煙區", detail: "可以吸煙的地方", where: "車站、商場、街上" },
    { scene: G.ban, word: "撮影禁止", kana: "さつえいきんし", romaji: "satsuei kinshi", meaning: "禁止拍攝", where: "景點、美術館、神社、店內" },
    { scene: G.ban, word: "土足禁止", kana: "どそくきんし", romaji: "dosoku kinshi", meaning: "禁止穿鞋入內", detail: "要脫鞋", where: "旅館、神社、寺廟、溫泉設施" },
    { scene: G.ban, word: "立入禁止", kana: "たちいりきんし", romaji: "tachiiri kinshi", meaning: "禁止進入", where: "工地、景點、後台區域" },
    { scene: G.ban, word: "故障中", kana: "こしょうちゅう", romaji: "koshouchuu", meaning: "故障中", detail: "機器壞了，暫時不能用", where: "販賣機、電梯、售票機、洗手間" },
    // 溫泉
    { scene: G.onsen, word: "男湯", kana: "おとこゆ", romaji: "otokoyu", meaning: "男湯", detail: "男士浴場", where: "溫泉、澡堂入口" },
    { scene: G.onsen, word: "女湯", kana: "おんなゆ", romaji: "onnayu", meaning: "女湯", detail: "女士浴場", where: "溫泉、澡堂入口" },
    // 緊急・生活
    { scene: G.help, word: "交番", kana: "こうばん", romaji: "kouban", meaning: "派出所", detail: "街上的小型警崗，可問路、報案", where: "街上、車站附近" },
    { scene: G.help, word: "病院", kana: "びょういん", romaji: "byouin", meaning: "醫院", where: "街上、地圖" },
    { scene: G.help, word: "薬局", kana: "やっきょく", romaji: "yakkyoku", meaning: "藥房", where: "街上、藥妝店" },
    { scene: G.help, word: "案内所", kana: "あんないじょ", romaji: "annaijo", meaning: "詢問處", detail: "遊客資訊中心、詢問服務台", where: "車站、景點、機場" },
  ];

  const FRIEND_SCENE = "假朋友詞";
  const FALSE_FRIENDS = [
    { scene: FRIEND_SCENE, word: "手紙", kana: "てがみ", romaji: "tegami", meaning: "信件", detail: "寄給別人的信", trapOpt: "廁紙", trap: "廁紙（普通話的「手紙」是衛生紙）", where: "郵局、明信片、酒店信紙" },
    {
      scene: FRIEND_SCENE,
      word: "大丈夫",
      kana: "だいじょうぶ",
      romaji: "daijoubu",
      meaning: "沒問題、不要緊",
      detail: "也用來婉拒，「大丈夫です」＝不用了",
      trapOpt: "堂堂男子漢",
      trap: "「堂堂男子漢」（中文的「大丈夫」）",
      where: "店員問「袋は大丈夫ですか」；緊急情況「大丈夫ですか」（您還好嗎）",
    },
    {
      scene: FRIEND_SCENE,
      word: "勉強",
      kana: "べんきょう",
      romaji: "benkyou",
      meaning: "學習、讀書",
      detail: "在商店也可指「算便宜一點」（常聽於關西）",
      trapOpt: "勉勉強強、不情願",
      trap: "「勉勉強強、不情願」（中文的「勉強」）",
      where: "書店、學校；關西商店的「勉強しますよ」",
    },
    {
      scene: FRIEND_SCENE,
      word: "湯",
      kana: "ゆ",
      romaji: "yu",
      meaning: "熱水、浴池",
      detail: "也指澡堂、溫泉的浴池；喝的湯日文叫「スープ」或「汁」",
      trapOpt: "喝的湯",
      trap: "喝的湯（中文的「湯」）",
      where: "溫泉、澡堂門簾、旅館的「お湯」",
    },
    { scene: FRIEND_SCENE, word: "小人", kana: "しょうにん", romaji: "shounin", meaning: "兒童", detail: "票價分「大人／小人」", trapOpt: "品格低劣的人", trap: "品格低劣的人（中文的「小人」）", where: "車站、景點的票價表" },
    {
      scene: FRIEND_SCENE,
      word: "床",
      kana: "ゆか",
      romaji: "yuka",
      meaning: "地板",
      detail: "房間的地面；睡覺的床日文叫「ベッド」",
      trapOpt: "睡床",
      trap: "睡床（中文的「床」）",
      where: "酒店、旅館，例如「床に置かないでください」（請不要放在地板上）",
    },
    {
      scene: FRIEND_SCENE,
      word: "結構",
      kana: "けっこう",
      romaji: "kekkou",
      meaning: "夠了（也指「相當」）",
      detail: "「結構です」＝夠了、不用了；也可表示「相當」「很好」",
      trapOpt: "結構、構造",
      trap: "結構、構造（中文的「結構」）",
      where: "餐廳、商店店員問要不要加點、要不要袋子時",
    },
    { scene: FRIEND_SCENE, word: "怪我", kana: "けが", romaji: "kega", meaning: "受傷", detail: "受傷、傷口", trapOpt: "責怪我", trap: "「責怪我」（中文的「怪我」）", where: "醫院、藥房、緊急情況（「けがをしました」）" },
    { scene: FRIEND_SCENE, word: "新聞", kana: "しんぶん", romaji: "shinbun", meaning: "報紙", detail: "新聞報導日文叫「ニュース」", trapOpt: "新聞報導", trap: "新聞報導（中文的「新聞」）", where: "車站報攤、便利店、酒店大堂" },
  ];

  window.App.Content.SIGNS = SIGNS;
  window.App.Content.SIGN_GROUPS = SIGN_GROUPS;
  window.App.Content.FALSE_FRIENDS = FALSE_FRIENDS;
  window.App.Content.FRIEND_SCENE = FRIEND_SCENE;
})();
