// 模擬餐牌 content (stage 10 ⑦ 版本二, js/reading.js): 6 menus × 5 lines = 30 lines, checked by the user on
// 2026-10-22 (kanji spellings such as 海老／玉子／焼き鳥／生姜焼き定食 are kept on purpose: real menus write them).
// Prices are only illustrative, not a real shop's. Menu `label` is Chinese only (no Japanese title).
//
// Line: { ja, kana, romaji, yue, price }   — ja = what the menu shows, kana = reading (also what is spoken),
//                                            yue = 中文意思, price = yen (number).
// Questions (js/reading.js): 哪一行是「X」 / 最貴·最便宜的是哪一行 (only when the extreme is unique) / 「X」要多少錢.
// 錯題重溫 key "m:<menu id>:<line index 0–4>".
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const L = (ja, kana, romaji, yue, price) => ({ ja, kana, romaji, yue, price });

  const MENUS = [
    {
      id: "ramen", emoji: "🍜", label: "拉麵店",
      lines: [
        L("醤油ラーメン", "しょうゆラーメン", "shouyu raamen", "醬油拉麵", 850),
        L("味噌ラーメン", "みそラーメン", "miso raamen", "味噌拉麵", 900),
        L("餃子", "ぎょうざ", "gyouza", "煎餃子", 400),
        L("半チャーハン", "はんチャーハン", "han chaahan", "半份炒飯", 300),
        L("生ビール", "なまビール", "nama biiru", "生啤酒", 550),
      ],
    },
    {
      id: "sushi", emoji: "🍣", label: "迴轉壽司",
      lines: [
        L("まぐろ", "まぐろ", "maguro", "吞拿魚", 150),
        L("サーモン", "サーモン", "saamon", "三文魚", 150),
        L("海老", "えび", "ebi", "蝦", 130),
        L("玉子", "たまご", "tamago", "蛋（玉子燒）", 120),
        L("いか", "いか", "ika", "魷魚", 130),
      ],
    },
    {
      id: "teishoku", emoji: "🍱", label: "定食屋",
      lines: [
        L("唐揚げ定食", "からあげていしょく", "karaage teishoku", "炸雞定食", 850),
        L("焼き魚定食", "やきざかなていしょく", "yakizakana teishoku", "烤魚定食", 900),
        L("とんかつ定食", "とんかつていしょく", "tonkatsu teishoku", "炸豬排定食", 1000),
        L("生姜焼き定食", "しょうがやきていしょく", "shougayaki teishoku", "薑燒豬肉定食", 950),
        L("ご飯大盛り", "ごはんおおもり", "gohan oomori", "白飯加大", 100),
      ],
    },
    {
      id: "izakaya", emoji: "🏮", label: "居酒屋",
      lines: [
        L("焼き鳥", "やきとり", "yakitori", "烤雞肉串", 150),
        L("枝豆", "えだまめ", "edamame", "毛豆", 400),
        L("刺身盛り合わせ", "さしみもりあわせ", "sashimi moriawase", "刺身拼盤", 1200),
        L("生ビール", "なまビール", "nama biiru", "生啤酒", 550),
        L("ウーロン茶", "ウーロンちゃ", "uuroncha", "烏龍茶", 400),
      ],
    },
    {
      id: "cafe", emoji: "☕", label: "咖啡店",
      lines: [
        L("コーヒー", "コーヒー", "koohii", "咖啡", 450),
        L("カフェラテ", "カフェラテ", "kafe rate", "拿鐵咖啡", 520),
        L("紅茶", "こうちゃ", "koucha", "紅茶", 450),
        L("チーズケーキ", "チーズケーキ", "chiizu keeki", "芝士蛋糕", 550),
        L("サンドイッチ", "サンドイッチ", "sandoitchi", "三文治", 600),
      ],
    },
    {
      id: "udon", emoji: "🍜", label: "烏冬・蕎麥麵店",
      lines: [
        L("きつねうどん", "きつねうどん", "kitsune udon", "油豆腐烏冬", 600),
        L("天ぷらそば", "てんぷらそば", "tenpura soba", "天婦羅蕎麥麵", 800),
        L("ざるそば", "ざるそば", "zaru soba", "蕎麥涼麵", 650),
        L("親子丼", "おやこどん", "oyakodon", "雞肉雞蛋丼", 750),
        L("おにぎり", "おにぎり", "onigiri", "飯糰", 150),
      ],
    },
  ];

  window.App.Content.MENUS = MENUS;
})();
