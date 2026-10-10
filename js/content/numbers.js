// 數字・價錢・時間讀音表 (stage 8, step 2-A). Reading reference only — the
// listening quiz built on top of it comes in step 2-B.
//
// Each topic: { key, title, intro: [lines], rows: [{ show, kana, romaji, note? }] }
//   show    what a sign / price tag / clock shows (digits or kanji)
//   kana    the reading; this is also what text-to-speech is given, because
//           numbers read from digits are unreliable across voices
//   romaji  Hepburn, long vowels doubled (juu), っ doubles the next consonant
//   note    short Chinese reminder (written Chinese) shown beside the row
//
// Default readings (decided 2026-10-10): 0 = ゼロ, 4 = よん, 7 = なな,
// 9 = きゅう, 10分 = じゅっぷん; irregular counters (4時 よじ, 7時 しちじ,
// 9時 くじ, 4円 よえん, 4人 よにん) are listed as such.
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const NUMBER_TOPICS = [
    {
      key: "basic",
      title: "基本數字 0–10",
      intro: ["4 常讀「よん」，7 常讀「なな」，9 常讀「きゅう」。", "「し」「しち」「く」也聽得到，但多用在固定說法（例如 7 時＝しちじ）。"],
      sequence: true,
      rows: [
        { show: "0", kana: "ゼロ", romaji: "zero", note: "也可讀「れい」" },
        { show: "1", kana: "いち", romaji: "ichi" },
        { show: "2", kana: "に", romaji: "ni" },
        { show: "3", kana: "さん", romaji: "san" },
        { show: "4", kana: "よん", romaji: "yon", note: "也讀「し」" },
        { show: "5", kana: "ご", romaji: "go" },
        { show: "6", kana: "ろく", romaji: "roku" },
        { show: "7", kana: "なな", romaji: "nana", note: "也讀「しち」" },
        { show: "8", kana: "はち", romaji: "hachi" },
        { show: "9", kana: "きゅう", romaji: "kyuu", note: "也讀「く」" },
        { show: "10", kana: "じゅう", romaji: "juu" },
      ],
    },
    {
      key: "tens",
      title: "11–99",
      intro: ["十位數 ＋ 個位數：11 ＝ 十＋一，20 ＝ 二＋十，34 ＝ 三＋十＋四。"],
      rows: [
        { show: "11", kana: "じゅういち", romaji: "juuichi" },
        { show: "15", kana: "じゅうご", romaji: "juugo" },
        { show: "20", kana: "にじゅう", romaji: "nijuu" },
        { show: "34", kana: "さんじゅうよん", romaji: "sanjuuyon" },
        { show: "45", kana: "よんじゅうご", romaji: "yonjuugo" },
        { show: "79", kana: "ななじゅうきゅう", romaji: "nanajuukyuu" },
        { show: "99", kana: "きゅうじゅうきゅう", romaji: "kyuujuukyuu" },
      ],
    },
    {
      key: "big",
      title: "百・千・萬",
      intro: ["300、600、800、3,000、8,000 的讀音會變，要特別記。", "100 和 1,000 前面不加「一」；10,000 一定要說「いちまん」。"],
      rows: [
        { show: "100", kana: "ひゃく", romaji: "hyaku" },
        { show: "200", kana: "にひゃく", romaji: "nihyaku" },
        { show: "300", kana: "さんびゃく", romaji: "sanbyaku", note: "ひゃく → びゃく" },
        { show: "500", kana: "ごひゃく", romaji: "gohyaku" },
        { show: "600", kana: "ろっぴゃく", romaji: "roppyaku", note: "ひゃく → ぴゃく" },
        { show: "800", kana: "はっぴゃく", romaji: "happyaku", note: "ひゃく → ぴゃく" },
        { show: "1,000", kana: "せん", romaji: "sen" },
        { show: "2,000", kana: "にせん", romaji: "nisen" },
        { show: "3,000", kana: "さんぜん", romaji: "sanzen", note: "せん → ぜん" },
        { show: "5,000", kana: "ごせん", romaji: "gosen" },
        { show: "8,000", kana: "はっせん", romaji: "hassen", note: "はち → はっ" },
        { show: "10,000", kana: "いちまん", romaji: "ichiman", note: "「いち」不可省略" },
      ],
    },
    {
      key: "yen",
      title: "價錢（円）",
      intro: ["「円」讀「えん」。只有 4 円是「よえん」，其餘照數字讀。", "價錢由大到小逐段讀：1,200 円 ＝ せん・にひゃく・えん。"],
      rows: [
        { show: "4円", kana: "よえん", romaji: "yoen", note: "不是「よんえん」" },
        { show: "120円", kana: "ひゃくにじゅうえん", romaji: "hyaku nijuu en" },
        { show: "480円", kana: "よんひゃくはちじゅうえん", romaji: "yonhyaku hachijuu en" },
        { show: "1,200円", kana: "せんにひゃくえん", romaji: "sen nihyaku en" },
        { show: "1,800円", kana: "せんはっぴゃくえん", romaji: "sen happyaku en" },
        { show: "3,300円", kana: "さんぜんさんびゃくえん", romaji: "sanzen sanbyaku en" },
        { show: "5,500円", kana: "ごせんごひゃくえん", romaji: "gosen gohyaku en" },
        { show: "10,000円", kana: "いちまんえん", romaji: "ichiman en", note: "一萬円" },
      ],
    },
    {
      key: "hour",
      title: "時間：點（時）",
      intro: ["「時」讀「じ」。4 時＝よじ、7 時＝しちじ、9 時＝くじ 要特別記。", "半點說「はん」：3 時半 ＝ さんじはん。上午＝ごぜん，下午＝ごご。"],
      rows: [
        { show: "1時", kana: "いちじ", romaji: "ichiji" },
        { show: "2時", kana: "にじ", romaji: "niji" },
        { show: "3時", kana: "さんじ", romaji: "sanji" },
        { show: "4時", kana: "よじ", romaji: "yoji", note: "不是「よんじ」" },
        { show: "5時", kana: "ごじ", romaji: "goji" },
        { show: "6時", kana: "ろくじ", romaji: "rokuji" },
        { show: "7時", kana: "しちじ", romaji: "shichiji", note: "不是「ななじ」" },
        { show: "8時", kana: "はちじ", romaji: "hachiji" },
        { show: "9時", kana: "くじ", romaji: "kuji", note: "不是「きゅうじ」" },
        { show: "10時", kana: "じゅうじ", romaji: "juuji" },
        { show: "11時", kana: "じゅういちじ", romaji: "juuichiji" },
        { show: "12時", kana: "じゅうにじ", romaji: "juuniji" },
        { show: "3時半", kana: "さんじはん", romaji: "sanji han" },
        { show: "何時", kana: "なんじ", romaji: "nanji", note: "幾點" },
      ],
    },
    {
      key: "minute",
      title: "時間：分",
      intro: ["「分」有「ふん」和「ぷん」兩種讀法，要跟數字一起記。", "10、20、30 分用「じゅっぷん」（促音「っ」要停一下）。"],
      rows: [
        { show: "1分", kana: "いっぷん", romaji: "ippun" },
        { show: "2分", kana: "にふん", romaji: "nifun" },
        { show: "3分", kana: "さんぷん", romaji: "sanpun" },
        { show: "4分", kana: "よんぷん", romaji: "yonpun" },
        { show: "5分", kana: "ごふん", romaji: "gofun" },
        { show: "6分", kana: "ろっぷん", romaji: "roppun" },
        { show: "7分", kana: "ななふん", romaji: "nanafun" },
        { show: "8分", kana: "はっぷん", romaji: "happun", note: "也讀「はちふん」" },
        { show: "9分", kana: "きゅうふん", romaji: "kyuufun" },
        { show: "10分", kana: "じゅっぷん", romaji: "juppun" },
        { show: "15分", kana: "じゅうごふん", romaji: "juugofun" },
        { show: "20分", kana: "にじゅっぷん", romaji: "nijuppun" },
        { show: "30分", kana: "さんじゅっぷん", romaji: "sanjuppun", note: "也可說「はん」（半）" },
        { show: "何分", kana: "なんぷん", romaji: "nanpun", note: "幾分鐘" },
      ],
    },
    {
      key: "people",
      title: "人數",
      intro: ["1 人＝ひとり、2 人＝ふたり 是特別讀法；3 人起用「〜にん」。", "4 人＝よにん（不是よんにん）。"],
      rows: [
        { show: "1人", kana: "ひとり", romaji: "hitori" },
        { show: "2人", kana: "ふたり", romaji: "futari" },
        { show: "3人", kana: "さんにん", romaji: "sannin" },
        { show: "4人", kana: "よにん", romaji: "yonin", note: "不是「よんにん」" },
        { show: "5人", kana: "ごにん", romaji: "gonin" },
        { show: "7人", kana: "ななにん", romaji: "nananin", note: "也讀「しちにん」" },
      ],
    },
    {
      key: "things",
      title: "物品數量",
      intro: ["點餐、買東西時最常用「〜つ」（一個、兩個……），可用到十個。", "紙張、車票等薄身的東西用「〜枚（まい）」。"],
      rows: [
        { show: "一つ", kana: "ひとつ", romaji: "hitotsu" },
        { show: "二つ", kana: "ふたつ", romaji: "futatsu" },
        { show: "三つ", kana: "みっつ", romaji: "mittsu" },
        { show: "四つ", kana: "よっつ", romaji: "yottsu" },
        { show: "五つ", kana: "いつつ", romaji: "itsutsu" },
        { show: "六つ", kana: "むっつ", romaji: "muttsu" },
        { show: "七つ", kana: "ななつ", romaji: "nanatsu" },
        { show: "八つ", kana: "やっつ", romaji: "yattsu" },
        { show: "九つ", kana: "ここのつ", romaji: "kokonotsu" },
        { show: "十", kana: "とお", romaji: "too", note: "「十個」的讀法" },
        { show: "一枚", kana: "いちまい", romaji: "ichimai", note: "車票、毛巾" },
        { show: "二枚", kana: "にまい", romaji: "nimai" },
        { show: "三枚", kana: "さんまい", romaji: "sanmai" },
      ],
    },
  ];

  window.App.Content.NUMBER_TOPICS = NUMBER_TOPICS;
})();
