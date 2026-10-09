// 情境對話 content (stage 7a). Every Japanese line is a 句子庫 sentence
// referenced by id (js/content/phrases.js) — text, kana, romaji, meaning
// and audio all come from there, so a 🚩 fix or a `say` override applies
// to dialogues too. Chinese here is 書面語.
//
// Node types (nodes live in `nodes`, keyed by id; `start` is the first):
//   S   { t:"s", lines:[ids], next, check? }     對方說（依次播放）
//       { t:"s", pick:[{lines, next, check?}] }  對方隨機選一個回答 — [隨機]
//   U   { t:"u", options:[{l, ok:true, next} | {l, ok:false, why}] }
//                                                你選回應；ok:false = 干擾項（不合適）
//   M   { t:"menu", prompt, options:[{label, next}] }   開始時選情況（不計分）
//   END { t:"end" }
//   check = { ask, answer, others:[...] }  ❓理解題：對方說完後問「對方說了什麼」
//
// Rules the validator (run when testing) enforces: every id exists; every
// `next` exists; a staff node never leads straight into another staff
// node (audio would cut off) — merge them into one node's `lines`.
window.App = window.App || {};
window.App.Content = window.App.Content || {};

(function () {
  const S = (lines, next, check) => (check ? { t: "s", lines, next, check } : { t: "s", lines, next });
  const P = (pick) => ({ t: "s", pick });
  const U = (options) => ({ t: "u", options });
  const o = (l, next) => ({ l, ok: true, next });
  const x = (l, why) => ({ l, ok: false, why });
  const chk = (ask, answer, others) => ({ ask, answer, others });
  const END = { t: "end" };
  const SORRY = "沒有做錯事，不需要道歉。";

  const D = [];

  // 1 ─────────────────────────────────────────────────────────────
  D.push({
    id: "ramen", title: "拉麵店用餐", scene: "restaurant", emoji: "🍜",
    intro: "你走進一間拉麵店，想吃午餐。",
    start: "a",
    nodes: {
      a: S(["rest-01", "rest-02"], "b"),
      b: U([o("rest-22", "c"), o("rest-03", "c"), x("rest-18", "對方問的是人數，不是用餐方式。")]),
      c: S(["rest-23"], "d"),
      d: U([o("rest-04", "e1"), o("rest-24", "f"), x("rest-17", "對方問的是有沒有預約。")]),
      e1: P([
        { lines: ["polite-23", "rest-25", "rest-08"], next: "h" },
        { lines: ["rest-14"], next: "e2" },
      ]),
      e2: U([o("polite-16", "e3"), x("rest-19", "還沒有用餐，不需要結帳。")]),
      e3: S(["rest-25", "rest-08"], "h"),
      f: S(["rest-25", "rest-08"], "h"),
      h: U([o("rest-10", "k"), o("rest-11", "k"), o("rest-07", "h2"), o("rest-13", "h3")]),
      h2: S(["rest-26"], "h2u"),
      h2u: U([o("rest-10", "k"), x("rest-19", "還沒有用餐，不需要結帳。")]),
      h3: P([
        { lines: ["rest-27"], next: "h3a" },
        { lines: ["rest-28"], next: "h3b" },
      ]),
      h3a: U([o("rest-21", "h3c"), x("rest-10", "對方說有放蛋，而你是因為過敏才詢問，應該先說明過敏。")]),
      h3c: S(["rest-29", "rest-15"], "l"),
      h3b: U([o("rest-10", "k"), x("rest-21", "對方說沒有放蛋，不需要再說明過敏。")]),
      k: S(["rest-15"], "l"),
      l: U([o("rest-19", "m"), x("rest-10", "已經上菜了，現在是結帳的時候。")]),
      m: S(["rest-30"], "n", chk("總共要付多少錢？", "1,200 日圓", ["1,020 日圓", "2,100 日圓"])),
      n: U([o("shop-23", "n1"), o("shop-15", "n2"), x("rest-17", "對方問的是付款方式。")]),
      n1: S(["polite-23"], "p"),
      n2: S(["polite-22"], "p"),
      p: U([o("rest-20", "q"), x("polite-11", SORRY)]),
      q: S(["polite-21"], "end"),
      end: END,
    },
  });

  // 2 ─────────────────────────────────────────────────────────────
  D.push({
    id: "fastfood", title: "快餐店：店內用餐還是外賣？", scene: "restaurant", emoji: "🍔",
    intro: "你在快餐店的櫃檯前點餐。",
    start: "a",
    nodes: {
      a: S(["rest-01", "rest-31"], "b"),
      b: U([o("rest-10", "c"), o("rest-11", "c"), x("rest-19", "還沒有點餐，不需要結帳。")]),
      c: S(["rest-32"], "d"),
      d: U([o("rest-33", "d1"), o("polite-09", "e"), x("rest-17", "對方問的是飲料，不是用餐方式。")]),
      d1: S(["polite-22", "rest-16"], "f", chk("對方問了什麼？", "店內用餐還是外賣？", ["請問幾位？", "需要袋子嗎？"])),
      e: S(["rest-16"], "f", chk("對方問了什麼？", "店內用餐還是外賣？", ["請問幾位？", "需要袋子嗎？"])),
      f: U([o("rest-17", "g"), o("rest-18", "g"), x("rest-03", "對方問的不是人數。")]),
      g: S(["rest-34"], "h"),
      h: U([o("shop-21", "i"), o("polite-09", "i"), x("rest-18", "對方問的是還有沒有其他需要，不是用餐方式。")]),
      i: S(["shop-13"], "j"),
      j: U([o("shop-15", "k"), o("shop-23", "k"), x("rest-20", "還沒有付款，現在不是道別的時候。")]),
      k: S(["rest-15"], "l"),
      l: U([o("polite-02", "end"), x("polite-11", SORRY)]),
      end: END,
    },
  });

  // 3 ─────────────────────────────────────────────────────────────
  D.push({
    id: "conbini", title: "便利店買便當", scene: "shopping", emoji: "🏪",
    intro: "你在便利店櫃檯結帳，買了一盒便當。",
    start: "a",
    nodes: {
      a: S(["rest-01", "shop-19"], "b", chk("對方問了什麼？", "需要加熱嗎？", ["需要袋子嗎？", "有積分卡嗎？"])),
      b: U([o("shop-21", "b1"), o("shop-22", "b2"), x("shop-12", "對方問的是加熱，不是積分卡。")]),
      b1: S(["rest-14", "shop-16"], "d"),
      b2: S(["polite-22", "shop-16"], "d"),
      d: U([o("shop-17", "e"), o("shop-18", "e"), x("shop-12", "對方問的是袋子，不是積分卡。")]),
      e: S(["shop-11"], "f"),
      f: U([o("shop-12", "g"), x("shop-18", "對方問的是積分卡，不是袋子。")]),
      g: S(["shop-13"], "h"),
      h: U([o("shop-15", "j"), o("shop-23", "j"), o("shop-14", "i1")]),
      i1: S(["polite-23"], "i2"),
      i2: U([o("shop-23", "j"), o("shop-15", "j")]),
      j: S(["polite-22"], "k"),
      k: U([o("shop-20", "l"), x("polite-11", SORRY)]),
      l: S(["polite-21"], "end"),
      end: END,
    },
  });

  // 4 ─────────────────────────────────────────────────────────────
  D.push({
    id: "drugstore", title: "藥妝店與免稅", scene: "shopping", emoji: "💊",
    intro: "你在藥妝店購物，想辦理免稅。",
    start: "a",
    nodes: {
      a: S(["rest-01"], "b"),
      b: U([o("shop-07", "c"), o("shop-02", "d"), x("shop-20", "還沒有購買，不需要收據。")]),
      c: S(["shop-24"], "e"),
      d: S(["hotel-20"], "e"),
      e: U([o("shop-08", "f"), x("shop-17", "還沒有決定要買哪一件。")]),
      f: S(["polite-22"], "g"),
      g: U([o("shop-09", "h"), x("shop-14", "你現在想先確認的是免稅。")]),
      h: P([
        { lines: ["shop-25", "shop-10"], next: "i" },
        { lines: ["shop-26"], next: "m" },
      ]),
      i: U([o("hotel-04", "j"), x("polite-16", "對方要你出示護照，應該遞上護照。")]),
      j: S(["rest-14", "shop-13"], "p"),
      m: U([o("polite-16", "n"), x("hotel-04", "對方說無法辦理免稅，不需要出示護照。")]),
      n: S(["shop-13"], "p"),
      p: U([o("shop-23", "q"), o("shop-15", "q")]),
      q: S(["polite-21"], "end"),
      end: END,
    },
  });

  // 5 ─────────────────────────────────────────────────────────────
  D.push({
    id: "station", title: "車站買車票與問月台", scene: "transport", emoji: "🚉",
    intro: "你在車站，想買一張去東京的車票，再問清楚月台。",
    start: "a",
    nodes: {
      a: U([o("trans-01", "b"), x("trans-19", "這是搭的士時說的，你現在還在車站。")]),
      b: S(["trans-20"], "c"),
      c: U([o("trans-02", "d"), x("trans-18", "這是搭的士時說的。")]),
      d: S(["trans-21"], "e", chk("對方問了什麼？", "單程還是來回？", ["要買幾張？", "要去哪裡？"])),
      e: U([o("trans-22", "f"), o("trans-23", "f"), x("rest-17", "對方問的是單程或來回。")]),
      f: S(["polite-22"], "g"),
      g: U([o("trans-05", "h"), x("trans-19", "這是搭的士時說的。")]),
      h: P([
        { lines: ["trans-24"], next: "i", check: chk("要在幾號月台搭車？", "三號月台", ["五號月台", "八號月台"]) },
        { lines: ["trans-25"], next: "i", check: chk("要在幾號月台搭車？", "五號月台", ["三號月台", "八號月台"]) },
      ]),
      i: U([o("polite-02", "j"), x("polite-11", SORRY)]),
      j: S(["polite-21"], "end"),
      end: END,
    },
  });

  // 6 ─────────────────────────────────────────────────────────────
  D.push({
    id: "taxi", title: "搭的士", scene: "transport", emoji: "🚕",
    intro: "你在車站外上了一輛的士，行李放在後面。",
    start: "a",
    nodes: {
      a: S(["trans-15"], "b", chk("對方問了什麼？", "請問要去哪裡？", ["請問幾位？", "需要袋子嗎？"])),
      b: U([o("trans-16", "c"), o("trans-26", "c"), x("trans-19", "還沒有出發，不需要說停車。")]),
      c: S(["polite-22"], "d"),
      // 第 3 步：選了開尾箱 → 對方回應後再選一次（只餘「何分かかりますか」）
      d: U([o("trans-18", "c2"), o("trans-10", "f"), x("trans-19", "還沒有到達目的地。")]),
      c2: S(["polite-22"], "d2"),
      d2: U([o("trans-10", "f"), x("trans-19", "還沒有到達目的地。")]),
      f: P([
        { lines: ["trans-27"], next: "g", check: chk("大約要多久？", "約十分鐘", ["約二十分鐘", "約三十分鐘"]) },
        { lines: ["trans-28"], next: "g", check: chk("大約要多久？", "約二十分鐘", ["約十分鐘", "約三十分鐘"]) },
      ]),
      g: U([o("trans-19", "h"), x("polite-02", "還沒有到達，不需要現在道謝。")]),
      h: S(["trans-30"], "i", chk("車資是多少？", "1,800 日圓", ["1,080 日圓", "8,100 日圓"])),
      i: U([o("shop-14", "j"), x("shop-17", "這裡不是購物，不需要袋子。")]),
      j: P([
        { lines: ["polite-23"], next: "k1" },
        { lines: ["trans-29"], next: "k2" },
      ]),
      k1: U([o("shop-23", "l"), o("shop-15", "l")]),
      k2: U([o("shop-15", "l"), x("shop-23", "對方說只收現金，不能用信用卡。")]),
      l: S(["polite-22"], "m"),
      m: U([o("polite-02", "n"), x("polite-11", SORRY)]),
      n: S(["polite-21"], "end"),
      end: END,
    },
  });

  // 7 ─────────────────────────────────────────────────────────────
  D.push({
    id: "hotel", title: "酒店辦理入住", scene: "hotel", emoji: "🏨",
    intro: "你來到酒店櫃位，辦理入住。",
    start: "a",
    nodes: {
      a: U([o("hotel-01", "b"), x("hotel-19", "你剛到達，是辦理入住，不是退房。")]),
      b: S(["rest-23"], "c"),
      c: U([o("hotel-02", "d"), o("rest-04", "x1"), x("hotel-16", "還沒有入住，不需要換房。")]),
      x1: S(["hotel-26"], "x2"),
      x2: U([o("polite-16", "end"), x("hotel-04", "對方說客滿，不需要出示護照。")]),
      d: S(["hotel-03"], "e"),
      e: U([o("hotel-04", "f"), x("polite-16", "對方要你出示護照，應先遞上護照。")]),
      f: S(["hotel-21"], "g"),
      g: U([o("polite-16", "h"), x("hotel-04", "護照已經遞出，現在是要你填寫資料。")]),
      h: S(["hotel-05"], "i"),
      i: U([o("hotel-06", "j"), x("hotel-12", "你剛拿到鎖匙，沒有遺失。")]),
      j: P([
        { lines: ["hotel-22"], next: "k", check: chk("幾點要退房？", "十一點", ["十點", "十二點"]) },
        { lines: ["hotel-23"], next: "k", check: chk("幾點要退房？", "十點", ["十一點", "十二點"]) },
      ]),
      k: U([o("hotel-07", "l"), x("hotel-13", "你還沒有進房間，冷氣還沒有問題。")]),
      l: P([
        { lines: ["hotel-24"], next: "m", check: chk("早餐幾點開始？", "七點", ["八點", "九點"]) },
        { lines: ["hotel-25"], next: "m", check: chk("早餐幾點開始？", "八點", ["七點", "九點"]) },
      ]),
      m: U([o("hotel-09", "n"), x("hotel-19", "你剛辦完入住，不是退房。")]),
      n: S(["hotel-10", "hotel-20"], "end"),
      end: END,
    },
  });

  // 8 ─────────────────────────────────────────────────────────────
  // 理解題的選項配合每個隨機分支的實際指示（正確答案 = 該分支的指示）。
  const WAY_FWD = "一直走，在第二個路口右轉";
  const WAY_R = "右轉，目的地在右手邊";
  const WAY_L = "左轉，目的地在左手邊";
  D.push({
    id: "directions", title: "問路到車站", scene: "directions", emoji: "🗺️",
    intro: "你在街上迷路了，向路人問路。",
    start: "a",
    nodes: {
      a: U([o("dir-10", "b"), x("emer-01", "只是迷路，不需要緊急求助。")]),
      b: S(["emer-02"], "c"),
      c: U([o("dir-01", "d"), o("dir-03", "d"), x("shop-01", "你想問的是路，不是價錢。")]),
      d: P([
        { lines: ["dir-11", "dir-14"], next: "e", check: chk("要往哪個方向走？", WAY_FWD, [WAY_R, WAY_L]) },
        { lines: ["dir-12", "dir-16"], next: "e", check: chk("要往哪個方向走？", WAY_R, [WAY_FWD, WAY_L]) },
        { lines: ["dir-13", "dir-17"], next: "e", check: chk("要往哪個方向走？", WAY_L, [WAY_FWD, WAY_R]) },
        { lines: ["dir-02"], next: "e", check: chk("要往哪個方向走？", "就在前面", ["要右轉", "要左轉"]) },
      ]),
      e: U([o("dir-06", "f"), x("trans-06", "你想問的是步行距離，不是電車班次。")]),
      f: S(["dir-07"], "g"),
      g: U([o("polite-02", "end"), x("polite-11", SORRY)]),
      end: END,
    },
  });

  // 9 ─────────────────────────────────────────────────────────────
  D.push({
    id: "emergency", title: "緊急情況", scene: "emergency", emoji: "🚑",
    intro: "你遇到緊急情況，需要協助。",
    start: "menu",
    nodes: {
      menu: {
        t: "menu",
        prompt: "你想練習哪個情況？",
        options: [
          { label: "A　身體不適（有人關心你）", next: "a" },
          { label: "B　遺失銀包（到警崗報失）", next: "x" },
          { label: "C　自己撥打 119 叫救護車", next: "k" },
        ],
      },
      // 9A 身體不適
      a: S(["emer-02"], "b"),
      b: U([
        o("emer-05", "c"), o("emer-07", "c"), o("emer-08", "c"), o("emer-09", "c"),
        x("emer-17", "你是身體不適，不是遺失物品。"),
      ]),
      c: S(["emer-22"], "d", chk("對方問了什麼？", "要去醫院嗎？", ["要不要叫救護車？", "在哪裡弄丟的？"])),
      d: U([o("shop-21", "e"), o("polite-09", "f"), x("emer-17", "對方問的是是否去醫院，不是遺失物品。")]),
      e: S(["emer-23"], "e2"),
      e2: U([o("emer-12", "e3"), o("polite-09", "f"), x("emer-15", "你需要的是救護車，不是警察。")]),
      e3: S(["polite-22", "emer-24"], "end"),
      f: S(["emer-24"], "end"),
      // 9B 遺失銀包
      x: S(["emer-02"], "x1"),
      x1: U([o("emer-17", "x2"), x("emer-12", "你要報失的是銀包，不需要救護車。")]),
      x2: S(["emer-25"], "x3"),
      x3: U([o("emer-26", "x4"), o("emer-27", "x4"), x("polite-02", "對方在問地點，還不是道謝的時候。")]),
      x4: S(["emer-28"], "x5", chk("對方想知道什麼？", "銀包的顏色", ["銀包的價錢", "銀包的牌子"])),
      x5: U([o("emer-29", "x6"), o("emer-30", "x6"), x("emer-26", "對方問的是顏色，不是地點。")]),
      x6: S(["emer-31"], "x7"),
      x7: U([o("polite-16", "x8"), x("emer-27", "對方是要你填寫資料，不是問你知不知道。")]),
      x8: S(["emer-32"], "x9"),
      x9: U([o("polite-02", "end"), x("polite-11", SORRY)]),
      // 9C 自己撥打 119
      k: S(["emer-13"], "k2", chk("對方問了什麼？", "是火警還是要叫救護車？", ["要去醫院嗎？", "在哪裡弄丟的？"])),
      k2: U([o("emer-14", "k3"), x("emer-17", "對方問的是火警還是救護車。")]),
      k3: S(["polite-22"], "end"),
      end: END,
    },
  });

  window.App.Content.DIALOGUES = D;
})();
