// 「怎樣用」說明卡 (五十音 module pages: 字表, 片假名實例, 清濁對比).
// A collapsible card at the top of a page, written for a complete beginner. The first
// time a page is opened the card is expanded and the page is remembered as seen
// (state.help[key] = "seen", saved without a redraw); after that it starts collapsed.
// Opening or closing it by hand only lasts until the app is reloaded.
// Text: `**x**` = bold. Keys: table, kata, contrast, lookalike.
window.App = window.App || {};

(function () {
  const { h } = window.App.UI;

  const HELP = {
    table: {
      title: "怎樣用字表",
      lines: [
        "日文的音，大多是「子音＋母音」組成。字表的**每一橫排是同一個子音**，**每一直排是同一個母音**。",
        "例如：k（子音）＋ a（母音）＝ **か**；s ＋ u ＝ **す**；m ＋ o ＝ **も**。",
        "母音只有 5 個：a、i、u、e、o（あ、い、う、え、お）。每個字下面的羅馬拼音，就是「子音＋母音」。",
        "少數例外，不照上面的規則（字表上用琥珀色圓點 ● 標出）：し 讀 shi（不是 si）、ち 讀 chi、つ 讀 tsu、ふ 讀 fu（接近 hu 與 fu 之間）、じ 讀 ji、を 讀 o（只用作助詞）。",
        "「y」那一排只有 ya、yu、yo；「w」那一排只有 wa 和 を；ん（n）是單獨一個音，沒有母音。",
        "助詞「は」讀 wa、「へ」讀 e：これは＝kore wa，ここへ＝koko e。",
      ],
    },
    kata: {
      title: "片假名怎樣讀",
      lines: [
        "片假名主要用來寫**外來語**（從外國傳入的詞），所以很多詞讀出來接近英文原字。",
        "例如：**ホテル ＝ ho · te · ru**，聽起來就是 hotel。",
        "日文每個音節都要有母音，英文結尾的子音要補一個母音：l 後面補 u（ル）、t 後面補 o（ト）、k 後面補 u（ク）。所以 hotel 變成 ホテル，而不是「ホテ」。",
        "長音「ー」：把前面那個母音拉長一拍。**コーヒー ＝ ko·o·hi·i**（coffee）；**メニュー ＝ me·nyu·u**（menu）。",
        "先試著讀出聲，再想「這像哪個英文字？」，大部分都猜得到。不過也有例外，例如 パン（來自葡萄牙語）、ラーメン（來自中文）。",
        "每個詞下面會顯示英文原字，方便對照。",
      ],
    },
    contrast: {
      title: "清濁對比怎樣用",
      lines: [
        "「゛」（濁點）：加在か、さ、た、は行的右上角，把子音變成「聲帶震動」的版本：k→g、s→z、t→d、h→b。",
        "「゜」（半濁點）：只加在は行，h→p。",
        "分辨方法：用手輕按喉嚨，發 か 時喉嚨不震，發 が 時喉嚨會震。",
        "為甚麼廣東話用家要特別練習：廣東話的 b、d、g 其實是「不送氣」的清音，p、t、k 是「送氣」音，區別在氣流；日文的清音 か、た、ぱ 和濁音 が、だ、ば，區別在喉嚨有沒有震動。兩種分法不同，所以聽 か 和 が 時，很容易覺得「差不多」。",
        "例子：かぎ（鍵，鎖匙）和 かき（柿或牡蠣）；てんき（天氣）和 でんき（電燈、電力）。",
      ],
    },
    lookalike: {
      title: "相似字分辨怎樣用",
      lines: [
        "有些字長得很像，初學時最容易認錯，例如 **シ／ツ**、**ソ／ン**、**ぬ／め**。",
        "先看對照卡：每組字並排顯示，並寫出分辨重點。按字可以聽發音。",
        "練習有兩種：**聽音選字**（聽到一個音，選出是哪個字）和**看字選音**（看到一個字，選出它的讀音）。",
        "選項全部是同一組長得很像的字，所以要看清楚筆畫才能選對。答錯的字會加入錯題重溫，之後會再出現。",
      ],
    },
  };

  // `**bold**` → [text, <b>bold</b>, text…]
  function rich(text) {
    return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? h("b", null, part) : part));
  }

  const session = {}; // key → open? (this app session)
  function isOpen(key) {
    if (!(key in session)) {
      const first = !window.App.helpSeen(key);
      session[key] = first;
      if (first) window.App.helpMarkSeen(key); // from now on it starts collapsed
    }
    return session[key];
  }

  function card(key) {
    const def = HELP[key];
    const open = isOpen(key);
    return h(
      "div",
      { class: `help-card mb-4${open ? " open" : ""}` },
      h(
        "button",
        {
          class: "help-head",
          "aria-expanded": open ? "true" : "false",
          onclick: () => {
            session[key] = !open;
            window.App.render();
          },
        },
        h("span", { class: "grow" }, `📖 ${def.title}`),
        h("span", { class: "help-toggle" }, open ? "收起 ▴" : "展開 ▾")
      ),
      open && h("div", { class: "help-body" }, def.lines.map((line) => h("p", null, rich(line))))
    );
  }

  window.App.Help = { card, HELP };
})();
