// 近音詞分辨 (stage 10 ⑫): 19 minimal pairs for 長音 / 促音 / 清濁 listening practice.
// Checked by the user on 2026-10-26. The first 4 pairs of 長音 and 4 of 促音 are the same words as the
// listening-only 促音・長音 page (SOUND_TOPICS in js/content/kana.js); え／ええ stays there only (a single
// kana is hard for speech synthesis to read naturally).
//
// PAIR: { id, cat, words: [A, B] }   id: l1…l8 (長音), s1…s6 (促音), v1…v5 (清濁) — used in state.pairs.stats
//       and in the 重溫 key "q:<id>".  WORD: { word, romaji, meaning, kanji }
//   word  = what is shown and spoken (kana only — this is listening practice, so no kanji on screen)
//   kanji = the usual written form (data for checking only, not shown)
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const MINIMAL_CATS = [
    { key: "long", label: "長音", hint: "長音要多拉一拍，聽出「拉長」和「短」的分別。" },
    { key: "sokuon", label: "促音", hint: "促音（小寫的っ）要停頓一拍，再發下一個音。" },
    { key: "voice", label: "清濁", hint: "濁音發音時喉嚨會震動，清音不會。" },
  ];

  const W = (word, romaji, meaning, kanji) => ({ word, romaji, meaning, kanji });
  const P = (id, cat, a, b) => ({ id, cat, words: [a, b] });

  const MINIMAL_PAIRS = [
    // 長音
    P("l1", "long", W("おばさん", "obasan", "阿姨（中年女士）", "伯母さん"), W("おばあさん", "obaasan", "婆婆（年長女士）", "おばあさん")),
    P("l2", "long", W("おじさん", "ojisan", "叔叔（中年男士）", "叔父さん"), W("おじいさん", "ojiisan", "伯伯（年長男士）", "おじいさん")),
    P("l3", "long", W("ゆき", "yuki", "雪", "雪"), W("ゆうき", "yuuki", "勇氣", "勇気")),
    P("l4", "long", W("ビル", "biru", "大廈", "ビル"), W("ビール", "biiru", "啤酒", "ビール")),
    P("l5", "long", W("すき", "suki", "喜歡", "好き"), W("スキー", "sukii", "滑雪", "スキー")),
    P("l6", "long", W("いえ", "ie", "家、房子", "家"), W("いいえ", "iie", "不是、不用", "いいえ")),
    P("l7", "long", W("とり", "tori", "鳥", "鳥"), W("とおり", "toori", "街道、馬路", "通り")),
    P("l8", "long", W("ちず", "chizu", "地圖", "地図"), W("チーズ", "chiizu", "芝士", "チーズ")),
    // 促音
    P("s1", "sokuon", W("きて", "kite", "來", "来て"), W("きって", "kitte", "郵票", "切手")),
    P("s2", "sokuon", W("さか", "saka", "斜路", "坂"), W("さっか", "sakka", "作家", "作家")),
    P("s3", "sokuon", W("おと", "oto", "聲音", "音"), W("おっと", "otto", "丈夫", "夫")),
    P("s4", "sokuon", W("かこ", "kako", "過去", "過去"), W("かっこ", "kakko", "括號", "括弧")),
    P("s5", "sokuon", W("さき", "saki", "前面、先", "先"), W("さっき", "sakki", "剛才", "さっき")),
    P("s6", "sokuon", W("もと", "moto", "原本、根源", "元"), W("もっと", "motto", "更、再多一點", "もっと")),
    // 清濁
    P("v1", "voice", W("かぎ", "kagi", "鎖匙", "鍵"), W("かき", "kaki", "蠔（「柿」也讀かき）", "牡蠣")),
    P("v2", "voice", W("てんき", "tenki", "天氣", "天気"), W("でんき", "denki", "電、電燈", "電気")),
    P("v3", "voice", W("ぶた", "buta", "豬", "豚"), W("ふた", "futa", "蓋子", "蓋")),
    P("v4", "voice", W("ふじ", "fuji", "富士（富士山的「富士」）", "富士"), W("ぶじ", "buji", "平安無事", "無事")),
    P("v5", "voice", W("さる", "saru", "猴子", "猿"), W("ざる", "zaru", "竹篩（ざるそば的ざる）", "ざる")),
  ];

  window.App.Content.MINIMAL_CATS = MINIMAL_CATS;
  window.App.Content.MINIMAL_PAIRS = MINIMAL_PAIRS;
})();
