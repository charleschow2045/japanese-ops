// 數字聽力 (stage 8, step 2-B): randomly generated listening questions for
// numbers, prices, times, platforms, people and minutes. The audio is the kana
// reading built here (same default readings as the 2-A 讀音表, see
// js/content/numbers.js); the 4 options are written forms (1,800円 / 4:30 …).
//
// Question: { type: "number", kind, vs, key, display, segs, kana, romaji, options: [{ vs, display }] }
//   kind  yen | time | ban (番線) | nin (人) | fun (分) | num (0–99)
//   vs    canonical value string ("1800", "4:30"); options compare by it
//   key   錯題重溫 key "n:<kind>:<vs>" — a wrong answer re-asks exactly this value
// Used by js/listening.js (menu, quiz, 錯題重溫); nothing here touches state.
window.App = window.App || {};

(function () {
  const CATEGORIES = [
    { key: "yen", label: "💴 價錢", kinds: ["yen"] },
    { key: "time", label: "🕐 時間", kinds: ["time"] },
    { key: "things", label: "🚉 月台・人數・分鐘", kinds: ["ban", "nin", "fun"] },
    { key: "num", label: "🔢 純數字 0–99", kinds: ["num"] },
  ];
  const LEVELS = [
    { key: 1, label: "入門", hint: "整百價錢、整點與半點、1–10" },
    { key: 2, label: "一般", hint: "10 的倍數價錢、5 分鐘一格" },
    { key: 3, label: "進階", hint: "個位數都有，價錢最高 99,999" },
  ];
  const KIND_LABEL = { yen: "價錢", time: "時間", ban: "月台", nin: "人數", fun: "分鐘", num: "數字" };

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const pad2 = (n) => String(n).padStart(2, "0");
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── readings ─────────────────────────────────────────────────────────
  // Each reading is a list of segments (shown with spaces in the romaji).

  const DIGIT = ["ゼロ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
  const HOUR = ["", "いちじ", "にじ", "さんじ", "よじ", "ごじ", "ろくじ", "しちじ", "はちじ", "くじ", "じゅうじ", "じゅういちじ", "じゅうにじ"];
  const NIN = ["", "ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "ななにん", "はちにん", "きゅうにん", "じゅうにん"];
  const FUN = ["", "いっぷん", "にふん", "さんぷん", "よんぷん", "ごふん", "ろっぷん", "ななふん", "はっぷん", "きゅうふん"];

  // 0–99,999. `four` = how a final digit 4 is read ("よ" before 円).
  function numSegs(n, four = "よん") {
    if (n === 0) return [DIGIT[0]];
    const segs = [];
    const man = Math.floor(n / 10000);
    let r = n % 10000;
    if (man) segs.push(DIGIT[man] + "まん");
    const sen = Math.floor(r / 1000);
    r %= 1000;
    if (sen) segs.push(sen === 1 ? "せん" : sen === 3 ? "さんぜん" : sen === 8 ? "はっせん" : DIGIT[sen] + "せん");
    const hyaku = Math.floor(r / 100);
    r %= 100;
    if (hyaku) segs.push(hyaku === 1 ? "ひゃく" : hyaku === 3 ? "さんびゃく" : hyaku === 6 ? "ろっぴゃく" : hyaku === 8 ? "はっぴゃく" : DIGIT[hyaku] + "ひゃく");
    const t = Math.floor(r / 10);
    const u = r % 10;
    const tens = t ? (t === 1 ? "じゅう" : DIGIT[t] + "じゅう") : "";
    const ones = u ? (u === 4 ? four : DIGIT[u]) : "";
    if (tens || ones) segs.push(tens + ones);
    return segs;
  }

  // Minutes (1–60): ふん／ぷん by the last digit, 10 20 30… = じゅっぷん.
  function funSegs(m) {
    const t = Math.floor(m / 10);
    const u = m % 10;
    if (u === 0) return [(t === 1 ? "" : DIGIT[t]) + "じゅっぷん"];
    return [(t === 0 ? "" : t === 1 ? "じゅう" : DIGIT[t] + "じゅう") + FUN[u]];
  }

  // `han` (time only): read :30 as 「はん」 instead of 「さんじゅっぷん」.
  function readingSegs(kind, v, han) {
    switch (kind) {
      case "yen": {
        const four = v % 10 === 4;
        const segs = numSegs(v, "よ");
        return four ? [...segs.slice(0, -1), segs[segs.length - 1] + "えん"] : [...segs, "えん"];
      }
      case "time": {
        const segs = [HOUR[v.h]];
        if (v.m === 30 && han) segs.push("はん");
        else if (v.m > 0) segs.push(...funSegs(v.m));
        return segs;
      }
      case "ban":
        return [...numSegs(v), "ばんせん"];
      case "nin":
        return [NIN[v]];
      case "fun":
        return funSegs(v);
      default:
        return numSegs(v);
    }
  }

  // Hepburn romaji of a kana segment (hiragana + ゼロ): long vowels doubled, っ doubles
  // the next consonant — same conventions as the rest of the app.
  const ROM = {
    あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko", さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
    た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to", な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo", ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", ん: "n",
    が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", だ: "da", で: "de", ど: "do",
    ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po", ゼ: "ze", ロ: "ro",
  };
  const YOON = { ゃ: "a", ゅ: "u", ょ: "o" };
  function romajiOf(kana) {
    let out = "";
    let doubled = false;
    for (let i = 0; i < kana.length; i++) {
      const c = kana[i];
      if (c === "っ") {
        doubled = true;
        continue;
      }
      let r = ROM[c] || "";
      if (YOON[kana[i + 1]]) {
        r = (r === "shi" ? "sh" : r === "chi" ? "ch" : r === "ji" ? "j" : r[0] + "y") + YOON[kana[i + 1]];
        i++;
      }
      if (doubled) {
        r = (r.startsWith("ch") ? "t" : r[0]) + r;
        doubled = false;
      }
      out += r;
    }
    return out;
  }

  // ── values ───────────────────────────────────────────────────────────

  const vsOf = (kind, v) => (kind === "time" ? `${v.h}:${pad2(v.m)}` : String(v));
  const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  function displayOf(kind, v) {
    switch (kind) {
      case "yen":
        return `${comma(v)}円`;
      case "time":
        return `${v.h}:${pad2(v.m)}`;
      case "ban":
        return `${v}番線`;
      case "nin":
        return `${v}人`;
      case "fun":
        return `${v}分`;
      default:
        return String(v);
    }
  }

  const isInt = Number.isInteger;
  // Is v a value this kind can have at this level (3 = everything allowed)?
  function ok(kind, level, v) {
    switch (kind) {
      case "yen":
        if (!isInt(v)) return false;
        return level === 1 ? v >= 100 && v <= 9900 && v % 100 === 0 : level === 2 ? v >= 10 && v <= 9990 && v % 10 === 0 : v >= 10 && v <= 99999;
      case "time":
        if (!v || !isInt(v.h) || !isInt(v.m) || v.h < 1 || v.h > 12 || v.m < 0 || v.m > 59) return false;
        return level === 1 ? v.m === 0 || v.m === 30 : level === 2 ? v.m % 5 === 0 : true;
      case "ban":
        return isInt(v) && v >= 1 && v <= (level === 1 ? 10 : 20);
      case "nin":
        return isInt(v) && v >= 1 && v <= 10;
      case "fun":
        return isInt(v) && (level === 3 ? v >= 1 && v <= 60 : v >= 1 && v <= 10 || (level === 2 && v % 5 === 0 && v <= 60));
      default:
        return isInt(v) && v >= 0 && v <= (level === 1 ? 20 : 99);
    }
  }

  function sample(kind, level) {
    switch (kind) {
      case "yen":
        if (level === 1) return (1 + rand(99)) * 100;
        if (level === 2) return pick([[1, 9], [10, 99], [100, 999]].map(([a, b]) => (a + rand(b - a + 1)) * 10));
        return pick([[100, 999], [1000, 9999], [10000, 99999]].map(([a, b]) => a + rand(b - a + 1)));
      case "time":
        return { h: 1 + rand(12), m: level === 1 ? pick([0, 30]) : level === 2 ? rand(12) * 5 : rand(60) };
      case "ban":
        return 1 + rand(level === 1 ? 10 : 20);
      case "nin":
        return 1 + rand(10);
      case "fun":
        return level === 1 ? 1 + rand(10) : level === 2 ? pick([1 + rand(10), (1 + rand(12)) * 5]) : 1 + rand(60);
      default:
        return rand(level === 1 ? 21 : 100);
    }
  }

  // The easiest level at which a value is allowed (for rebuilding 錯題重溫 questions).
  const levelFor = (kind, v) => [1, 2, 3].find((l) => ok(kind, l, v)) || 3;

  // ── wrong options ────────────────────────────────────────────────────
  // Look-alikes by ear / by eye: swapped neighbouring digits, digits that get
  // confused (1/7, 4/7/9, 3/8, 6/8), ±1 in one place, ± one step, ×10 / ÷10.

  const CONFUSED = { 1: [7], 7: [1, 4], 4: [7, 9], 9: [4], 3: [8], 8: [3, 6], 6: [8], 5: [2], 2: [5] };

  function digitVariants(n) {
    const s = String(n);
    const out = [];
    for (let i = 0; i < s.length; i++) {
      for (const d of CONFUSED[s[i]] || []) out.push(Number(s.slice(0, i) + d + s.slice(i + 1)));
      const dn = Number(s[i]);
      if (dn < 9) out.push(Number(s.slice(0, i) + (dn + 1) + s.slice(i + 1)));
      if (dn > 0) out.push(Number(s.slice(0, i) + (dn - 1) + s.slice(i + 1)));
      if (i + 1 < s.length && s[i] !== s[i + 1]) {
        const sw = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
        if (sw[0] !== "0") out.push(Number(sw));
      }
    }
    return out;
  }

  function candidates(kind, level, v) {
    if (kind === "time") {
      const c = [];
      const hs = [v.h === 12 ? 1 : v.h + 1, v.h === 1 ? 12 : v.h - 1, ...digitVariants(v.h).filter((h) => h >= 1 && h <= 12)];
      hs.forEach((h) => c.push({ h, m: v.m }));
      const ms = [v.m + 5, v.m - 5, v.m + 10, v.m - 10, v.m + 1, v.m - 1, ...digitVariants(v.m)];
      ms.forEach((m) => c.push({ h: v.h, m }));
      if (v.m === 0) c.push({ h: v.h, m: 30 });
      if (v.m === 30) c.push({ h: v.h, m: 0 });
      return c;
    }
    const steps = kind === "yen" ? (level === 1 ? [100, 1000] : level === 2 ? [10, 100] : [10, 100, 1000]) : [1, 2, 10];
    const c = digitVariants(v);
    steps.forEach((st) => c.push(v + st, v - st));
    if (kind === "yen") c.push(v * 10, Math.floor(v / 10));
    return c;
  }

  function pickOptions(kind, level, v) {
    const chosen = [];
    const seen = new Set([vsOf(kind, v)]);
    const add = (c) => {
      const k = vsOf(kind, c);
      if (chosen.length >= 3 || seen.has(k) || !ok(kind, level, c)) return;
      seen.add(k);
      chosen.push(c);
    };
    shuffle(candidates(kind, level, v)).forEach(add);
    for (let tries = 0; chosen.length < 3 && tries < 500; tries++) add(sample(kind, level));
    return shuffle([v, ...chosen]);
  }

  // ── questions ────────────────────────────────────────────────────────

  function makeQuestion(kind, v, level) {
    const segs = readingSegs(kind, v, Math.random() < 0.5);
    const vs = vsOf(kind, v);
    return {
      type: "number",
      kind,
      vs,
      key: `n:${kind}:${vs}`,
      display: displayOf(kind, v),
      segs,
      kana: segs.join(""),
      romaji: segs.map(romajiOf).join(" "),
      options: pickOptions(kind, level, v).map((o) => ({ vs: vsOf(kind, o), display: displayOf(kind, o) })),
    };
  }

  // prefs: { cats, level, count }. No repeats inside one round.
  function buildPractice(prefs) {
    const catKinds = CATEGORIES.filter((c) => prefs.cats.includes(c.key)).map((c) => c.kinds);
    if (!catKinds.length) return [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < prefs.count; i++) {
      for (let tries = 0; tries < 50; tries++) {
        // categories take turns, so a round mixes what was ticked
        const kind = pick(catKinds[i % catKinds.length]);
        const v = sample(kind, prefs.level);
        const key = `${kind}:${vsOf(kind, v)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(makeQuestion(kind, v, prefs.level));
        break;
      }
    }
    return out;
  }

  // "n:yen:1800" → question, or null when the key is not a value this app can ask.
  function fromKey(key) {
    const m = /^n:(yen|time|ban|nin|fun|num):([0-9:]{1,8})$/.exec(key || "");
    if (!m) return null;
    const kind = m[1];
    let v;
    if (kind === "time") {
      const t = /^(\d{1,2}):(\d{2})$/.exec(m[2]);
      if (!t) return null;
      v = { h: Number(t[1]), m: Number(t[2]) };
    } else {
      if (!/^\d{1,5}$/.test(m[2])) return null;
      v = Number(m[2]);
    }
    return ok(kind, 3, v) ? makeQuestion(kind, v, levelFor(kind, v)) : null;
  }

  // Everything below is exposed for the tests and for listening.js.
  window.App.NumberQuiz = { CATEGORIES, LEVELS, KIND_LABEL, buildPractice, fromKey, makeQuestion, readingSegs, romajiOf, displayOf, ok, sample };
})();
