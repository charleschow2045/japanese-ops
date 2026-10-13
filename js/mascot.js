// Mascot: Tabi (旅ねこ), an original little cat in a travel hat. Inline SVG, drawn here (no image
// files, no outside characters). Three moods: "hello" (greeting), "cheer" (right answer),
// "sorry" (wrong answer, encouraging). Colours are fixed on purpose: the cat looks the same in
// light and dark mode (its thin brown outline keeps the white fur visible on both).
// App.Mascot.node(mood, cls) → a <span class="mascot …"> holding the <svg> (aria-hidden: decorative).
window.App = window.App || {};

(function () {
  const { h } = window.App.UI;
  const STROKE = { c: "#7A4B2A", w: 2 };

function sv(inner){return `<svg viewBox="0 0 120 132" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`}
function sparkle(x,y,s,c){return `<path d="M${x} ${y-s} Q${x} ${y} ${x+s} ${y} Q${x} ${y} ${x} ${y+s} Q${x} ${y} ${x-s} ${y} Q${x} ${y} ${x} ${y-s}Z" fill="${c}"/>`}
function eyes(mood,ex,ey,ink){
  const [lx,rx]=ex;
  if(mood==="cheer") return `<path d="M${lx-6} ${ey+3} Q${lx} ${ey-8} ${lx+6} ${ey+3}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/><path d="M${rx-6} ${ey+3} Q${rx} ${ey-8} ${rx+6} ${ey+3}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
  const big = mood==="sorry"?5.8:5.2;
  let s=`<circle cx="${lx}" cy="${ey}" r="${big}" fill="${ink}"/><circle cx="${rx}" cy="${ey}" r="${big}" fill="${ink}"/><circle cx="${lx+1.9}" cy="${ey-2}" r="1.9" fill="#fff"/><circle cx="${rx+1.9}" cy="${ey-2}" r="1.9" fill="#fff"/>`;
  if(mood==="sorry") s+=`<path d="M${lx-7} ${ey-5} L${lx+6} ${ey-10}" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M${rx+7} ${ey-5} L${rx-6} ${ey-10}" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  return s;
}
function cat(mood,st){
  const S=`stroke="${st.c}" stroke-width="${st.w}" stroke-linejoin="round" stroke-linecap="round"`;
  const fur="#FFF6E8",ink="#2B1B3D",hat="#2F6FE0",band="#FFD84D",pink="#FFB3C7";
  let arms="",armsTop="";
  if(mood==="hello") { arms=`<ellipse cx="36" cy="106" rx="7" ry="12" transform="rotate(12 36 106)" fill="${fur}" ${S}/>`; armsTop=`<ellipse cx="104" cy="78" rx="7.5" ry="15" transform="rotate(-18 104 78)" fill="${fur}" ${S}/><path d="M114 56 q6 7 0 15" fill="none" stroke="${st.c}" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`; }
  if(mood==="cheer") { armsTop=`<ellipse cx="18" cy="84" rx="7.5" ry="14" transform="rotate(24 18 84)" fill="${fur}" ${S}/><ellipse cx="102" cy="84" rx="7.5" ry="14" transform="rotate(-24 102 84)" fill="${fur}" ${S}/>`; arms=`${sparkle(14,52,8,"#FFC400")}${sparkle(106,50,9,"#FF5C8A")}${sparkle(100,20,6,"#3FB6FF")}${sparkle(18,22,6,"#7A5CFF")}`; }
  if(mood==="sorry") arms=`<ellipse cx="36" cy="106" rx="7" ry="12" transform="rotate(12 36 106)" fill="${fur}" ${S}/><path d="M100 50 q6 9 0 13 q-6 -4 0 -13Z" fill="#7EC8FF"/>`;
  let mouth= mood==="cheer" ? `<path d="M51 76 Q60 93 69 76 Z" fill="#7A1F3D" ${S}/><ellipse cx="60" cy="85" rx="5" ry="3.2" fill="#FF8FA8"/>`
    : mood==="sorry" ? `<path d="M54 81 Q60 75 66 81" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<path d="M60 73 Q60 80 54 79 M60 73 Q60 80 66 79" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  return sv(`
   <path d="M84 116 Q112 116 104 88" fill="none" stroke="${st.c}" stroke-width="${9+2*st.w}" stroke-linecap="round"/><path d="M84 116 Q112 116 104 88" fill="none" stroke="${fur}" stroke-width="9" stroke-linecap="round"/>
   <ellipse cx="60" cy="108" rx="26" ry="19" fill="${fur}" ${S}/>
   <ellipse cx="47" cy="124" rx="9" ry="5" fill="${fur}" ${S}/><ellipse cx="73" cy="124" rx="9" ry="5" fill="${fur}" ${S}/>
   ${arms}
   <path d="M25 46 L27 16 L52 34 Z" fill="${fur}" ${S}/><path d="M95 46 L93 16 L68 34 Z" fill="${fur}" ${S}/>
   <path d="M31 40 L32 24 L45 34 Z" fill="${pink}"/><path d="M89 40 L88 24 L75 34 Z" fill="${pink}"/>
   <ellipse cx="60" cy="62" rx="38" ry="32" fill="${fur}" ${S}/>
   <ellipse cx="37" cy="52" rx="10" ry="8" fill="#F6A44C"/>
   <ellipse cx="60" cy="37" rx="30" ry="7" fill="${hat}" ${S}/>
   <path d="M41 36 Q41 11 60 11 Q79 11 79 36 Z" fill="${hat}" ${S}/>
   <path d="M41 32 Q60 40 79 32 L79 37 Q60 45 41 37 Z" fill="${band}"/>
   ${eyes(mood,[46,74],65,ink)}
   <circle cx="38" cy="75" r="6" fill="#FF9DB5" opacity=".6"/><circle cx="82" cy="75" r="6" fill="#FF9DB5" opacity=".6"/>
   <path d="M57 70 L63 70 L60 74 Z" fill="#E0587A"/>${mouth}
   <path d="M20 66 L34 69 M20 75 L34 74 M100 66 L86 69 M100 75 L86 74" stroke="${st.c}" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
   <path d="M44 93 Q60 100 76 93" fill="none" stroke="#E8443A" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="99" r="5" fill="#FFD84D" ${S}/>${armsTop}${mood==="sorry"?`<ellipse cx="74" cy="104" rx="7.5" ry="8.5" fill="${fur}" ${S}/>`:""}`);
}

  const MOODS = ["hello", "cheer", "sorry"];
  function svg(mood) {
    return cat(MOODS.includes(mood) ? mood : "hello", STROKE);
  }
  function node(mood, cls = "") {
    const el = h("span", { class: `mascot ${cls}`.trim(), "aria-hidden": "true" });
    el.innerHTML = svg(mood); // constant string built above, no user text
    return el;
  }

  window.App.Mascot = { svg, node, MOODS };
})();
