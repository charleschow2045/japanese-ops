// 換字練習 content (stage 10 ⑥ 版本二): fixed sentence patterns with one slot, e.g. 〇〇は入っていますか。
// The slot word is swapped each question (聽力: hear the sentence → pick the 中文意思; 口語: see the 中文 → say it).
//
// Pattern: { id, label, post, postKana, postRomaji, yue, words: [word] }
//   post        the Japanese text after the slot ("は入っていますか。")
//   postKana    its reading (no punctuation, same style as 句子庫 `kana`)
//   postRomaji  its Hepburn (は = wa, を = o)
//   yue         中文 template, `{m}` = the word's `yue`
// Word: { id, ja, kana, romaji, yue }   — `id` is stable (used in 錯題重溫 keys "w:h:<pattern>:<id>").
//
// Sentence built from a pattern + word (js/swap.js):
//   ja = word.ja + post, kana = word.kana + postKana, romaji = word.romaji + " " + postRomaji,
//   say (text-to-speech) = word.kana + post  — the slot word is read from its kana so a kanji word
//   (卵, 駅, 渋谷 …) cannot be misread; the rest of the sentence is spoken as written.
// Words were checked by the user on 2026-10-21 (64 combinations).
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const W = (id, ja, kana, romaji, yue) => ({ id, ja, kana, romaji, yue });

  // The 11 allergen foods are shared by patterns ① and ②.
  const ALLERGEN = [
    W("tamago", "卵", "たまご", "tamago", "蛋"),
    W("gyuunyuu", "牛乳", "ぎゅうにゅう", "gyuunyuu", "牛奶"),
    W("nyuuseihin", "乳製品", "にゅうせいひん", "nyuuseihin", "乳製品"),
    W("komugi", "小麦", "こむぎ", "komugi", "小麥"),
    W("soba", "そば", "そば", "soba", "蕎麥"),
    W("rakkasei", "落花生", "らっかせい", "rakkasei", "花生"),
    W("ebi", "えび", "えび", "ebi", "蝦"),
    W("kani", "かに", "かに", "kani", "蟹"),
    W("nattsu", "ナッツ", "ナッツ", "nattsu", "堅果"),
    W("daizu", "大豆", "だいず", "daizu", "大豆"),
    W("goma", "ごま", "ごま", "goma", "芝麻"),
  ];

  const SWAP_PATTERNS = [
    {
      id: "p1",
      label: "〇〇は入っていますか。",
      post: "は入っていますか。",
      postKana: "ははいっていますか",
      postRomaji: "wa haitte imasu ka",
      yue: "有放{m}嗎？",
      words: [...ALLERGEN, W("butaniku", "豚肉", "ぶたにく", "butaniku", "豬肉"), W("arukooru", "アルコール", "アルコール", "arukooru", "酒精")],
    },
    {
      id: "p2",
      label: "〇〇アレルギーがあります。",
      post: "アレルギーがあります。",
      postKana: "アレルギーがあります",
      postRomaji: "arerugii ga arimasu",
      yue: "我對{m}過敏",
      words: ALLERGEN,
    },
    {
      id: "p3",
      label: "〇〇をください。",
      post: "をください。",
      postKana: "をください",
      postRomaji: "o kudasai",
      yue: "請給我{m}",
      words: [
        W("omizu", "お水", "おみず", "omizu", "水"),
        W("ocha", "お茶", "おちゃ", "ocha", "茶"),
        W("biiru", "ビール", "ビール", "biiru", "啤酒"),
        W("koohii", "コーヒー", "コーヒー", "koohii", "咖啡"),
        W("menyuu", "メニュー", "メニュー", "menyuu", "餐牌"),
        W("fukuro", "袋", "ふくろ", "fukuro", "袋子"),
        W("reshiito", "レシート", "レシート", "reshiito", "收據"),
        W("ryoushuusho", "領収書", "りょうしゅうしょ", "ryoushuusho", "正式收據"),
        W("ohashi", "お箸", "おはし", "ohashi", "筷子"),
        W("supuun", "スプーン", "スプーン", "supuun", "湯匙"),
      ],
    },
    {
      id: "p4",
      label: "〇〇はどこですか。",
      post: "はどこですか。",
      postKana: "はどこですか",
      postRomaji: "wa doko desu ka",
      yue: "{m}在哪裡？",
      words: [
        W("toire", "トイレ", "トイレ", "toire", "洗手間"),
        W("eki", "駅", "えき", "eki", "車站"),
        W("deguchi", "出口", "でぐち", "deguchi", "出口"),
        W("iriguchi", "入口", "いりぐち", "iriguchi", "入口"),
        W("kaisatsu", "改札", "かいさつ", "kaisatsu", "閘口"),
        W("basutei", "バス停", "バスてい", "basutei", "巴士站"),
        W("konbini", "コンビニ", "コンビニ", "konbini", "便利店"),
        W("erebeetaa", "エレベーター", "エレベーター", "erebeetaa", "升降機"),
        W("kenbaiki", "券売機", "けんばいき", "kenbaiki", "售票機"),
        W("kouban", "交番", "こうばん", "kouban", "警崗"),
        W("kippuuriba", "切符売り場", "きっぷうりば", "kippu uriba", "售票處"),
        W("ryougaejo", "両替所", "りょうがえじょ", "ryougaejo", "兌換處"),
      ],
    },
    {
      id: "p5",
      label: "〇〇までお願いします。",
      post: "までお願いします。",
      postKana: "までおねがいします",
      postRomaji: "made onegai shimasu",
      yue: "麻煩您，到{m}",
      words: [
        W("eki", "駅", "えき", "eki", "車站"),
        W("kuukou", "空港", "くうこう", "kuukou", "機場"),
        W("hoteru", "ホテル", "ホテル", "hoteru", "酒店"),
        W("juusho", "この住所", "このじゅうしょ", "kono juusho", "這個地址"),
        W("shinjuku", "新宿", "しんじゅく", "shinjuku", "新宿"),
        W("shibuya", "渋谷", "しぶや", "shibuya", "澀谷"),
        W("asakusa", "浅草", "あさくさ", "asakusa", "淺草"),
        W("toukyou", "東京駅", "とうきょうえき", "toukyou eki", "東京車站"),
        W("kyouto", "京都駅", "きょうとえき", "kyouto eki", "京都車站"),
        W("oosaka", "大阪駅", "おおさかえき", "oosaka eki", "大阪車站"),
      ],
    },
    {
      id: "p6",
      label: "〇〇はありますか。",
      post: "はありますか。",
      postKana: "はありますか",
      postRomaji: "wa arimasu ka",
      yue: "有{m}嗎？",
      words: [
        W("eigomenyuu", "英語のメニュー", "えいごのメニュー", "eigo no menyuu", "英文餐牌"),
        W("chiisai", "小さいサイズ", "ちいさいサイズ", "chiisai saizu", "小碼"),
        W("ookii", "大きいサイズ", "おおきいサイズ", "ookii saizu", "大碼"),
        W("hokanoiro", "他の色", "ほかのいろ", "hoka no iro", "其他顏色"),
        W("waribiki", "割引", "わりびき", "waribiki", "折扣"),
        W("aiteiruheya", "空いている部屋", "あいているへや", "aite iru heya", "空房"),
        W("mottoyasui", "もっと安いもの", "もっとやすいもの", "motto yasui mono", "更便宜的"),
        W("seki", "席", "せき", "seki", "座位"),
      ],
    },
  ];

  window.App.Content.SWAP_PATTERNS = SWAP_PATTERNS;
})();
