// 羅盤圖（SVG 字串產生器）
//
// 北固定在上、順時針。由外到內：度數刻度 → 24 山（陽紅陰墨）→ 八卦宮（卦名＋方位＋洛書數）→ 天池。
// 紅線＝向（大門朝外的方向）、墨線＝坐。向山、坐山、向宮會加底色。
// 這支是純函式（只回字串），瀏覽器把它塞進 <svg id="compass-svg"> 的 innerHTML，Node 測試也能直接驗。
import {
  MOUNTS, MOUNT_YINYANG, MOUNT_YUAN, PALACES, PALACE_INFO, norm, describeFacing,
} from './engine/compass.mjs?v=981ddbf2';

export const VIEW = 400;          // viewBox 邊長
const C = VIEW / 2;
const R = { outer: 196, tickS: 191, tickL: 186, deg: 178, mOut: 170, mIn: 138, gOut: 138, gIn: 98, pool: 98 };

const f1 = (n) => (Math.round(n * 10) / 10).toString();

/** 極座標 → 畫面座標（角度：北 0°、順時針） */
export function polar(deg, r) {
  const a = (norm(deg) * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
}

function line(deg, r1, r2, cls, extra = '') {
  const a = polar(deg, r1); const b = polar(deg, r2);
  return `<line class="${cls}" x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" ${extra}/>`;
}

/** 環形扇區（從 a1 順時針到 a2） */
function sector(a1, a2, r1, r2, cls) {
  const p1 = polar(a1, r2); const p2 = polar(a2, r2); const p3 = polar(a2, r1); const p4 = polar(a1, r1);
  const large = norm(a2 - a1) > 180 ? 1 : 0;
  return `<path class="${cls}" d="M${f1(p1.x)} ${f1(p1.y)} A${r2} ${r2} 0 ${large} 1 ${f1(p2.x)} ${f1(p2.y)} L${f1(p3.x)} ${f1(p3.y)} A${r1} ${r1} 0 ${large} 0 ${f1(p4.x)} ${f1(p4.y)} Z"/>`;
}

function text(deg, r, str, cls, extra = '') {
  const p = polar(deg, r);
  return `<text class="${cls}" x="${f1(p.x)}" y="${f1(p.y)}" text-anchor="middle" dominant-baseline="central" ${extra}>${str}</text>`;
}

/**
 * 產生羅盤 SVG 的內容（不含外層 <svg>）。
 * facingDeg 為 null／NaN 時只畫盤面不畫坐向線。
 */
export function compassMarkup(facingDeg) {
  const has = facingDeg !== null && facingDeg !== undefined && facingDeg !== '' && Number.isFinite(Number(facingDeg));
  const info = has ? describeFacing(Number(facingDeg)) : null;
  const out = [];

  // 內建樣式（style.css 可以用同名 class 蓋掉）
  out.push(`<style>
.cp-bg{fill:#f6efdd;stroke:#2a2420;stroke-width:1.6}
.cp-ring{fill:none;stroke:#2a2420;stroke-width:1}
.cp-tick{stroke:#2a2420;stroke-width:.7}
.cp-tick-l{stroke:#2a2420;stroke-width:1.1}
.cp-deg{font:600 8.5px/1 system-ui,sans-serif;fill:#5b5148}
.cp-sep{stroke:#2a2420;stroke-width:.6;opacity:.55}
.cp-sep-g{stroke:#2a2420;stroke-width:1.2}
.cp-mount{font:700 15px/1 "Noto Serif TC","PMingLiU","Songti TC",serif}
.cp-yang{fill:#b3261e}
.cp-yin{fill:#2a2420}
.cp-gua{font:700 19px/1 "Noto Serif TC","PMingLiU","Songti TC",serif;fill:#2a2420}
.cp-gua-sub{font:600 9px/1 system-ui,sans-serif;fill:#6b5f52}
.cp-hl-face{fill:#b3261e;opacity:.2}
.cp-hl-sit{fill:#2a2420;opacity:.16}
.cp-hl-palace{fill:#c9a24a;opacity:.22}
.cp-pool{fill:#fffaf0;stroke:#2a2420;stroke-width:1.2}
.cp-cross{stroke:#2a2420;stroke-width:.5;opacity:.35}
.cp-face-line{stroke:#b3261e;stroke-width:2.6;stroke-linecap:round}
.cp-sit-line{stroke:#2a2420;stroke-width:2.2;stroke-linecap:round;stroke-dasharray:5 4}
.cp-face-tip{fill:#b3261e}
.cp-c1{font:700 22px/1 "Noto Serif TC","PMingLiU",serif;fill:#b3261e}
.cp-c2{font:600 11px/1 system-ui,sans-serif;fill:#2a2420}
.cp-c3{font:600 10px/1 system-ui,sans-serif;fill:#6b5f52}
.cp-tag{font:700 11px/1 system-ui,sans-serif}
</style>`);

  out.push(`<circle class="cp-bg" cx="${C}" cy="${C}" r="${R.outer}"/>`);

  // 底色：向宮、向山、坐山
  if (info) {
    const pdeg = PALACE_INFO[info.facingPalace].deg;
    out.push(sector(pdeg - 22.5, pdeg + 22.5, R.gIn, R.gOut, 'cp-hl-palace'));
    out.push(sector(info.facing.center - 7.5, info.facing.center + 7.5, R.mIn, R.mOut, 'cp-hl-face'));
    out.push(sector(info.sitting.center - 7.5, info.sitting.center + 7.5, R.mIn, R.mOut, 'cp-hl-sit'));
  }

  // 度數刻度
  for (let d = 0; d < 360; d += 5) {
    const long = d % 15 === 0;
    out.push(line(d, long ? R.tickL : R.tickS, R.outer, long ? 'cp-tick-l' : 'cp-tick'));
  }
  for (let d = 0; d < 360; d += 30) out.push(text(d, R.deg, String(d), 'cp-deg'));

  // 環線
  for (const r of [R.mOut, R.mIn, R.gIn]) out.push(`<circle class="cp-ring" cx="${C}" cy="${C}" r="${r}"/>`);

  // 24 山
  MOUNTS.forEach((m, i) => {
    const center = i * 15;
    out.push(line(center - 7.5, R.mIn, R.mOut, 'cp-sep'));
    const yy = MOUNT_YINYANG[m] === '陽' ? 'cp-yang' : 'cp-yin';
    out.push(text(center, (R.mIn + R.mOut) / 2, m, `cp-mount ${yy}`, `data-mount="${m}" data-yuan="${MOUNT_YUAN[m]}"`));
  });

  // 八卦宮
  for (const p of PALACES) {
    const g = PALACE_INFO[p];
    out.push(line(g.deg - 22.5, R.gIn, R.mOut, 'cp-sep-g'));
    out.push(text(g.deg, R.gIn + 26, p, 'cp-gua', `data-palace="${p}"`));
    // 方位＋洛書數：沿著圓弧排（下半圈翻正，不會倒著看），才不會被天池蓋到
    const sp = polar(g.deg, R.gIn + 8.5);
    const rot = g.deg > 90 && g.deg < 270 ? g.deg + 180 : g.deg;
    out.push(text(g.deg, R.gIn + 8.5, `${g.dir}・${g.luo}`, 'cp-gua-sub', `transform="rotate(${rot} ${f1(sp.x)} ${f1(sp.y)})"`));
  }

  // 天池
  out.push(`<circle class="cp-pool" cx="${C}" cy="${C}" r="${R.pool}"/>`);
  out.push(line(0, -R.pool, R.pool, 'cp-cross'));
  out.push(line(90, -R.pool, R.pool, 'cp-cross'));

  if (info) {
    const fd = info.facingDeg;
    // 坐（虛線）與向（紅線＋箭頭）
    out.push(line(fd + 180, 0, R.outer - 2, 'cp-sit-line'));
    out.push(line(fd, 0, R.outer - 12, 'cp-face-line'));
    const tip = polar(fd, R.outer - 2); const l = polar(fd - 2.6, R.outer - 16); const r = polar(fd + 2.6, R.outer - 16);
    out.push(`<path class="cp-face-tip" d="M${f1(tip.x)} ${f1(tip.y)} L${f1(l.x)} ${f1(l.y)} L${f1(r.x)} ${f1(r.y)} Z"/>`);
    // 向、坐 標籤（放在天池內、線的兩端附近，避開中心文字）
    out.push(text(fd + 11, R.pool - 18, '向', 'cp-tag cp-yang'));
    out.push(text(fd + 180 + 11, R.pool - 18, '坐', 'cp-tag cp-yin'));
    // 中心文字
    out.push(`<circle cx="${C}" cy="${C}" r="46" fill="#fffaf0" opacity=".92"/>`);
    out.push(`<text class="cp-c1" x="${C}" y="${C - 14}" text-anchor="middle" dominant-baseline="central">${f1(fd)}°</text>`);
    out.push(`<text class="cp-c2" x="${C}" y="${C + 8}" text-anchor="middle" dominant-baseline="central">${info.name}</text>`);
    out.push(`<text class="cp-c3" x="${C}" y="${C + 24}" text-anchor="middle" dominant-baseline="central">${info.plain}</text>`);
  } else {
    out.push(`<text class="cp-c2" x="${C}" y="${C}" text-anchor="middle" dominant-baseline="central">輸入大門朝向</text>`);
  }
  return out.join('\n');
}

/** 完整的 <svg>（列印或測試用） */
export function compassSvg(facingDeg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-label="羅盤">${compassMarkup(facingDeg)}</svg>`;
}
