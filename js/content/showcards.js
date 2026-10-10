// 「指給店員看」大字卡 content (stage 8 item 3). 37 cards, script checked by the
// user on 2026-10-10 (step 3-A). Shown full screen to staff: no speaking needed.
//
// Card kinds (see js/show.js):
//   fixed    { id, ja, kana, romaji, yue, en }
//   ref      { id, ref: "<句子庫 id>", en } — ja/kana/romaji/yue come from 句子庫,
//            so a 🚩 / `say` fix there applies here too
//   saved    { id, type: "saved", field, ja, kana, romaji, yue, en } — the phrase plus
//            something the user typed (state.show.saved[field]), shown big
//   allergy / avoid { id, type } — built from the ticked items below
// `yue` = 中文意思 (written Chinese), `en` = small English line (off by default).
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const SHOW_GROUPS = [
    {
      key: "general",
      label: "通用",
      emoji: "🗣️",
      cards: [
        { id: "show-gen-01", ja: "私は日本語が話せません。", kana: "わたしはにほんごがはなせません", romaji: "watashi wa nihongo ga hanasemasen", yue: "我不會說日文", en: "I can't speak Japanese." },
        { id: "show-gen-02", ja: "ここに書いてください。", kana: "ここにかいてください", romaji: "koko ni kaite kudasai", yue: "請寫在這裡", en: "Please write it here." },
        { id: "show-gen-03", ja: "翻訳アプリを使ってもいいですか。", kana: "ほんやくアプリをつかってもいいですか", romaji: "honyaku apuri o tsukatte mo ii desu ka", yue: "可以使用翻譯 App 嗎？", en: "May I use a translation app?" },
        { id: "show-gen-04", ja: "写真を撮ってもいいですか。", kana: "しゃしんをとってもいいですか", romaji: "shashin o totte mo ii desu ka", yue: "可以拍照嗎？", en: "May I take a photo?" },
        { id: "show-gen-05", ja: "トイレをお借りできますか。", kana: "トイレをおかりできますか", romaji: "toire o okari dekimasu ka", yue: "請問可以借用洗手間嗎？", en: "May I use the restroom?" },
        { id: "show-gen-06", ref: "polite-15", en: "Please speak more slowly." },
      ],
    },
    {
      key: "restaurant",
      label: "餐廳",
      emoji: "🍜",
      cards: [
        { id: "show-rest-allergy", type: "allergy" },
        {
          id: "show-rest-01",
          ja: "重度のアレルギーです。少量でも危険ですので、確認をお願いします。",
          kana: "じゅうどのアレルギーです。しょうりょうでもきけんですので、かくにんをおねがいします",
          romaji: "juudo no arerugii desu. shouryou demo kiken desu node, kakunin o onegai shimasu",
          yue: "我的過敏很嚴重，即使少量也很危險，麻煩您確認",
          en: "My allergy is severe. Even a small amount is dangerous, so please check.",
        },
        { id: "show-rest-avoid", type: "avoid" },
        {
          id: "show-rest-02",
          ja: "ベジタリアンです。肉と魚が入っていない料理はありますか。",
          kana: "ベジタリアンです。にくとさかながはいっていないりょうりはありますか",
          romaji: "bejitarian desu. niku to sakana ga haitte inai ryouri wa arimasu ka",
          yue: "我吃素，有沒有不含肉和魚的菜？",
          en: "I'm vegetarian. Do you have dishes without meat or fish?",
        },
        { id: "show-rest-03", ja: "だしにも肉や魚を使っていますか。", kana: "だしにもにくやさかなをつかっていますか", romaji: "dashi ni mo niku ya sakana o tsukatte imasu ka", yue: "湯底也有用肉或魚嗎？", en: "Is meat or fish also used in the broth?" },
        { id: "show-rest-04", ja: "わさび抜きでお願いします。", kana: "わさびぬきでおねがいします", romaji: "wasabi nuki de onegai shimasu", yue: "麻煩不要加芥末", en: "No wasabi, please." },
        { id: "show-rest-05", ja: "辛くしないでください。", kana: "からくしないでください", romaji: "karaku shinaide kudasai", yue: "請不要做成辣的", en: "Please don't make it spicy." },
        { id: "show-rest-06", ja: "お会計は別々でお願いします。", kana: "おかいけいはべつべつでおねがいします", romaji: "okaikei wa betsubetsu de onegai shimasu", yue: "麻煩分開結帳", en: "Separate bills, please." },
      ],
    },
    {
      key: "shopping",
      label: "購物",
      emoji: "🛍️",
      cards: [
        { id: "show-shop-01", ja: "免税手続きをお願いします。", kana: "めんぜいてつづきをおねがいします", romaji: "menzei tetsuzuki o onegai shimasu", yue: "麻煩辦理免稅手續", en: "I'd like to do the tax-free procedure." },
        { id: "show-shop-02", ja: "領収書をください。", kana: "りょうしゅうしょをください", romaji: "ryoushuusho o kudasai", yue: "請給我收據", en: "May I have a receipt?" },
        { id: "show-shop-03", ja: "袋は要りません。", kana: "ふくろはいりません", romaji: "fukuro wa irimasen", yue: "我不需要購物袋", en: "I don't need a bag." },
        { id: "show-shop-04", ja: "プレゼント用に包んでもらえますか。", kana: "プレゼントようにつつんでもらえますか", romaji: "purezento you ni tsutsunde moraemasu ka", yue: "可以幫我包裝成禮物嗎？", en: "Could you gift-wrap this?" },
        { id: "show-shop-05", ja: "試着室はどこですか。", kana: "しちゃくしつはどこですか", romaji: "shichakushitsu wa doko desu ka", yue: "試衣間在哪裡？", en: "Where is the fitting room?" },
        { id: "show-shop-06", ja: "タッチ決済は使えますか。", kana: "タッチけっさいはつかえますか", romaji: "tatchi kessai wa tsukaemasu ka", yue: "可以用感應式付款嗎？", en: "Can I use contactless payment?" },
      ],
    },
    {
      key: "transport",
      label: "交通",
      emoji: "🚕",
      cards: [
        {
          id: "show-trans-address",
          type: "saved",
          field: "hotelAddress",
          ja: "この住所までお願いします。",
          kana: "このじゅうしょまでおねがいします",
          romaji: "kono juusho made onegai shimasu",
          yue: "麻煩到這個地址",
          en: "Please take me to this address.",
        },
        {
          id: "show-trans-name",
          type: "saved",
          field: "hotelName",
          ja: "ホテルまでお願いします。",
          kana: "ホテルまでおねがいします",
          romaji: "hoteru made onegai shimasu",
          yue: "麻煩到這間酒店",
          en: "Please take me to this hotel.",
        },
        {
          id: "show-trans-tel",
          type: "saved",
          field: "hotelTel",
          ja: "このホテルに電話してもらえますか。",
          kana: "このホテルにでんわしてもらえますか",
          romaji: "kono hoteru ni denwa shite moraemasu ka",
          yue: "可以幫我打電話給這間酒店嗎？",
          en: "Could you call this hotel?",
        },
        { id: "show-trans-01", ja: "ここで降ります。", kana: "ここでおります", romaji: "koko de orimasu", yue: "我在這裡下車", en: "I'll get off here." },
        { id: "show-trans-02", ja: "荷物を預けたいです。", kana: "にもつをあずけたいです", romaji: "nimotsu o azuketai desu", yue: "我想寄存行李", en: "I'd like to leave my luggage." },
        { id: "show-trans-03", ja: "切符をなくしました。", kana: "きっぷをなくしました", romaji: "kippu o nakushimashita", yue: "我弄丟了車票", en: "I lost my ticket." },
      ],
    },
    {
      key: "hotel",
      label: "酒店",
      emoji: "🏨",
      cards: [
        {
          id: "show-hotel-01",
          ja: "チェックイン前ですが、荷物を預かってもらえますか。",
          kana: "チェックインまえですが、にもつをあずかってもらえますか",
          romaji: "chekkuin mae desu ga, nimotsu o azukatte moraemasu ka",
          yue: "還沒到入住時間，可以先幫我寄存行李嗎？",
          en: "It's before check-in time, but could you hold my luggage?",
        },
        { id: "show-hotel-02", ja: "部屋の鍵が使えません。", kana: "へやのかぎがつかえません", romaji: "heya no kagi ga tsukaemasen", yue: "房間的鎖匙（房卡）打不開", en: "My room key doesn't work." },
        { id: "show-hotel-03", ref: "hotel-18", en: "Could you call a taxi for me?" },
      ],
    },
    {
      key: "emergency",
      label: "緊急情況",
      emoji: "🚑",
      cards: [
        { id: "show-emer-01", ja: "医者を呼んでください。", kana: "いしゃをよんでください", romaji: "isha o yonde kudasai", yue: "請幫我叫醫生", en: "Please call a doctor." },
        { id: "show-emer-02", ja: "病院に連れて行ってください。", kana: "びょういんにつれていってください", romaji: "byouin ni tsurete itte kudasai", yue: "請帶我去醫院", en: "Please take me to a hospital." },
        { id: "show-emer-03", ja: "持病があります。", kana: "じびょうがあります", romaji: "jibyou ga arimasu", yue: "我有長期病患", en: "I have a chronic condition." },
        { id: "show-emer-04", ja: "薬のアレルギーがあります。", kana: "くすりのアレルギーがあります", romaji: "kusuri no arerugii ga arimasu", yue: "我對藥物過敏", en: "I have a drug allergy." },
        { id: "show-emer-05", ja: "通訳をお願いします。", kana: "つうやくをおねがいします", romaji: "tsuuyaku o onegai shimasu", yue: "麻煩找人翻譯", en: "Please get an interpreter." },
        { id: "show-emer-06", ref: "emer-12", en: "Please call an ambulance." },
        { id: "show-emer-07", ref: "emer-15", en: "Please call the police." },
        { id: "show-emer-08", ref: "emer-18", en: "I lost my passport." },
      ],
    },
  ];

  // Ticked in the 過敏卡 (id is what gets saved in state.show.allergens).
  const SHOW_ALLERGENS = [
    { id: "egg", ja: "卵", kana: "たまご", romaji: "tamago", yue: "蛋", en: "eggs" },
    { id: "dairy", ja: "乳製品", kana: "にゅうせいひん", romaji: "nyuuseihin", yue: "乳製品", en: "dairy" },
    { id: "wheat", ja: "小麦", kana: "こむぎ", romaji: "komugi", yue: "小麥", en: "wheat" },
    { id: "soba", ja: "そば", kana: "そば", romaji: "soba", yue: "蕎麥", en: "buckwheat (soba)" },
    { id: "peanut", ja: "落花生", kana: "らっかせい", romaji: "rakkasei", yue: "花生", en: "peanuts" },
    { id: "shrimp", ja: "えび", kana: "えび", romaji: "ebi", yue: "蝦", en: "shrimp" },
    { id: "crab", ja: "かに", kana: "かに", romaji: "kani", yue: "蟹", en: "crab" },
    { id: "nuts", ja: "ナッツ類", kana: "ナッツるい", romaji: "nattsurui", yue: "堅果", en: "tree nuts" },
    { id: "walnut", ja: "くるみ", kana: "くるみ", romaji: "kurumi", yue: "核桃", en: "walnuts" },
    { id: "soy", ja: "大豆", kana: "だいず", romaji: "daizu", yue: "大豆", en: "soy" },
    { id: "sesame", ja: "ごま", kana: "ごま", romaji: "goma", yue: "芝麻", en: "sesame" },
  ];

  // Ticked in the 不吃卡 (state.show.avoid).
  const SHOW_AVOID = [
    { id: "pork", ja: "豚肉", kana: "ぶたにく", romaji: "butaniku", yue: "豬肉", en: "pork" },
    { id: "beef", ja: "牛肉", kana: "ぎゅうにく", romaji: "gyuuniku", yue: "牛肉", en: "beef" },
    { id: "chicken", ja: "鶏肉", kana: "とりにく", romaji: "toriniku", yue: "雞肉", en: "chicken" },
    { id: "fish", ja: "魚", kana: "さかな", romaji: "sakana", yue: "魚", en: "fish" },
    { id: "shellfish", ja: "えび・かに", kana: "えび・かに", romaji: "ebi, kani", yue: "蝦、蟹", en: "shrimp and crab" },
    { id: "raw", ja: "生もの", kana: "なまもの", romaji: "namamono", yue: "生食", en: "raw food" },
    { id: "spicy", ja: "辛いもの", kana: "からいもの", romaji: "karai mono", yue: "辣的食物", en: "spicy food" },
  ];

  window.App.Content.SHOW_GROUPS = SHOW_GROUPS;
  window.App.Content.SHOW_ALLERGENS = SHOW_ALLERGENS;
  window.App.Content.SHOW_AVOID = SHOW_AVOID;
})();
