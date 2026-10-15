// 沈氏玄空飛星：元運、下卦／替卦起星、山向盤、旺衰、四大格局、伏吟反吟、零正神、流年流月
//
// 起盤規則（沈氏玄空學）：
//   1. 元運數入中順飛 → 運盤。
//   2. 運盤在坐宮的星入中為山星、在向宮的星入中為向星。
//   3. 順逆：看入中那顆星所屬卦、跟坐山（向山）同元的那一山之陰陽，陽順陰逆。
//      五入中時沒有卦可查，改看坐山（向山）本身的陰陽。
//   4. 替卦（兼向超過 3°）：同一山改用「坤壬乙訣」的替星入中，順逆仍看原山；
//      替星跟原星相同（無替可尋）就用下卦。
import {
  PALACES, PALACE_INFO, PALACE_BY_LUO, MOUNTS, MOUNT_PALACE, MOUNT_YUAN, MOUNT_YINYANG,
  describeFacing,
} from './compass.mjs?v=981ddbf2';
import { ganzhiYear } from './ming.mjs?v=981ddbf2';
import { STAR_WX } from './wuxing.mjs?v=981ddbf2';

export const STAR_NAMES = { 1: '一白', 2: '二黑', 3: '三碧', 4: '四綠', 5: '五黃', 6: '六白', 7: '七赤', 8: '八白', 9: '九紫' };
export const STAR_ALIAS = { 1: '貪狼', 2: '巨門', 3: '祿存', 4: '文曲', 5: '廉貞', 6: '武曲', 7: '破軍', 8: '左輔', 9: '右弼' };

/** 某一年屬第幾運（三元九運，1864 甲子起上元一運） */
export function periodOf(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;
  return ((Math.floor((y - 1864) / 20) % 9) + 9) % 9 + 1;
}
export function periodRange(p) {
  const start = 1864 + 20 * (p - 1);
  return { start, end: start + 19 };
}
export const PERIOD_NAMES = { 1: '上元一運', 2: '上元二運', 3: '上元三運', 4: '中元四運', 5: '中元五運', 6: '中元六運', 7: '下元七運', 8: '下元八運', 9: '下元九運' };

/** 某星入中，順飛（forward）或逆飛 → 九宮各得何星 */
export function fly(center, forward = true) {
  const out = { 中: center };
  for (const p of PALACES) {
    const d = PALACE_INFO[p].luo - 5;
    let s = forward ? center + d : center - d;
    s = (((s - 1) % 9) + 9) % 9 + 1;
    out[p] = s;
  }
  return out;
}

/** 洛書數 n 之卦，在某元（地／天／人）的那一山 */
export function mountOf(luo, yuan) {
  const palace = PALACE_BY_LUO[luo];
  if (!palace || palace === '中') return null;
  return MOUNTS.find((m) => MOUNT_PALACE[m] === palace && MOUNT_YUAN[m] === yuan) || null;
}

// 替卦口訣：子癸並甲申，貪狼一路行；壬卯乙未坤，五位是巨門；乾亥辰巽巳，連戌武曲名；
//           酉辛丑艮丙，天星說破軍；寅午庚丁上，右弼四星臨。
export const TI_STAR = {
  子: 1, 癸: 1, 甲: 1, 申: 1,
  壬: 2, 卯: 2, 乙: 2, 未: 2, 坤: 2,
  乾: 6, 亥: 6, 辰: 6, 巽: 6, 巳: 6, 戌: 6,
  酉: 7, 辛: 7, 丑: 7, 艮: 7, 丙: 7,
  寅: 9, 午: 9, 庚: 9, 丁: 9,
};

/**
 * 下卦或替卦起盤。
 *   tigua：true 用替卦（坤壬乙訣）。
 *   wuTi：替卦遇運盤五黃到山或到向時怎麼辦（派別不同）——
 *     'none'（預設）五黃無替：仍以五入中，只用本山陰陽定順逆；
 *     'self' 另一派：取坐山（向山）本身的替星入中。
 */
export function chart(facingDeg, period, { tigua = false, wuTi = 'none' } = {}) {
  const cx = describeFacing(facingDeg);
  const sitM = cx.sitting.mount;
  const faceM = cx.facing.mount;
  const sitP = cx.sittingPalace;
  const faceP = cx.facingPalace;
  const yun = fly(period, true);
  const yuan = MOUNT_YUAN[sitM];

  function starFor(palace, ownMount) {
    const n = yun[palace];
    const refMount = n === 5 ? ownMount : mountOf(n, yuan);
    let star = n;
    let replaced = false;
    let wuNoTi = false;
    if (tigua) {
      if (n === 5 && wuTi !== 'self') {
        wuNoTi = true; // 五黃無替
      } else {
        const t = TI_STAR[refMount];
        if (t && t !== n) { star = t; replaced = true; }
      }
    }
    return { star, forward: MOUNT_YINYANG[refMount] === '陽', refMount, replaced, from: n, wuNoTi };
  }

  const m = starFor(sitP, sitM);
  const f = starFor(faceP, faceM);
  const mountain = fly(m.star, m.forward);
  const facing = fly(f.star, f.forward);

  const fit = periodFit({ mountain, facing, sitP, faceP }, period);
  const pattern = fit.pattern;
  const cells = {};
  for (const p of [...PALACES, '中']) {
    cells[p] = {
      palace: p,
      yun: yun[p],
      m: mountain[p],
      f: facing[p],
      mQi: qiOf(mountain[p], period),
      fQi: qiOf(facing[p], period),
      heshi: mountain[p] + facing[p] === 10 || mountain[p] + yun[p] === 10 || facing[p] + yun[p] === 10,
    };
  }

  return {
    period, tigua, wuTi, facingDeg: cx.facingDeg, name: cx.name, fullName: cx.fullName, plain: cx.plain,
    sitP, faceP, sitM, faceM, yuan,
    yun, mountain, facing, cells,
    mountainCenter: m, facingCenter: f,
    pattern,
    fit,
    fuyin: fuyinOf(mountain, facing),
    heshiAll: heshiAll(yun, mountain, facing),
    sanban: sanbanOf(cells),
    zhengshen: PALACE_BY_LUO[period],
    lingshen: PALACE_BY_LUO[10 - period],
  };
}

export function detectPattern({ mountain, facing, period, sitP, faceP }) {
  const sm = mountain[sitP], sf = facing[sitP], fm = mountain[faceP], ff = facing[faceP];
  if (sm === period && ff === period) return '旺山旺向';
  if (sf === period && fm === period) return '上山下水';
  if (fm === period && ff === period) return '雙星會向';
  if (sm === period && sf === period) return '雙星會坐';
  return '其他';
}

/** 令星 p 在某一盤落在哪：'sit' 坐方、'face' 向方、'center' 中宮（入囚）、'other' 其他宮 */
function locate(board, p, sitP, faceP) {
  if (board[sitP] === p) return 'sit';
  if (board[faceP] === p) return 'face';
  if (board['中'] === p) return 'center';
  return 'other';
}

/**
 * 以某一運的令星 p 來看這張盤（p 可以是建宅運，也可以是現在的運——交運後看旺衰用）。
 *   四大格局之外再細分：到山不到向、到向不到山、下水（山星下水）、上山（向星上山）、令星不到；
 *   名稱依青囊奧語「山上龍神不下水，水裡龍神不上山」：旺山星到向方為下水，旺向星到坐方為上山。
 *   令星落在中宮＝入囚（山星入囚不利人丁、向星入囚不利財），每一顆扣 3 分。
 * 回傳 { period, pattern, mLoc, fLoc, prison:{ mountain, facing }, score, info }
 */
export function periodFit({ mountain, facing, sitP, faceP }, p) {
  const mLoc = locate(mountain, p, sitP, faceP);
  const fLoc = locate(facing, p, sitP, faceP);
  let pattern;
  if (mLoc === 'sit' && fLoc === 'face') pattern = '旺山旺向';
  else if (mLoc === 'face' && fLoc === 'sit') pattern = '上山下水';
  else if (mLoc === 'face' && fLoc === 'face') pattern = '雙星會向';
  else if (mLoc === 'sit' && fLoc === 'sit') pattern = '雙星會坐';
  else if (mLoc === 'sit') pattern = '到山不到向';
  else if (fLoc === 'face') pattern = '到向不到山';
  else if (mLoc === 'face') pattern = '下水'; // 山星下水：旺山星跑到向方
  else if (fLoc === 'sit') pattern = '上山'; // 向星上山：旺向星跑到坐方
  else pattern = '令星不到';
  const prison = { mountain: mLoc === 'center', facing: fLoc === 'center' };
  const info = PATTERN_INFO[pattern];
  const score = Math.max(0, info.score - 3 * (Number(prison.mountain) + Number(prison.facing)));
  return { period: p, pattern, mLoc, fLoc, prison, score, info };
}

/** 用另一個運（例如現在的運）重新判每一宮山向星的旺衰，盤本身不變 */
export function cellsFor(ch, p) {
  const out = {};
  for (const k of Object.keys(ch.cells)) {
    const c = ch.cells[k];
    out[k] = { ...c, mQi: qiOf(c.m, p), fQi: qiOf(c.f, p) };
  }
  return out;
}

export const PRISON_TEXT = {
  mountain: '山星入囚：當運的山星飛進中宮，傳統認為人丁健康的旺氣被困住；中宮若是開闊空間、天井或有水，可以「囚不住」。',
  facing: '向星入囚：當運的向星飛進中宮，傳統認為財氣被困住、財運停滯；中宮若是開闊空間、天井或有水，可以「囚不住」。',
};

export const PATTERN_INFO = {
  旺山旺向: { score: 25, luck: '上吉', text: '旺山旺向（到山到向）：當運山星到坐、向星到向，丁財兩旺的上格。坐後要有實（山、高樓、靠），向前要有虛（水、路、明堂），才能把這個格局真正用出來。' },
  雙星會向: { score: 18, luck: '吉（旺財）', text: '雙星會向：當運山星與向星都到向方，旺財但人丁較弱。向方最好「先見水、水後有山（或建築）」，財丁才能兼顧；坐後空也不算大忌。' },
  雙星會坐: { score: 15, luck: '中（旺丁）', text: '雙星會坐：當運山星與向星都到坐方，旺丁、利健康與人際，財運偏弱。坐後最好「先見水、水後有山」；一般住宅坐後是實牆則丁旺財平。' },
  上山下水: { score: 6, luck: '凶', text: '上山下水：旺山星跑到向、旺向星跑到坐，丁財兩失的敗格。除非坐後見水、向前見山（倒騎龍的形勢）才能反為吉用，否則要靠格局擺設與後天化解。' },
  到山不到向: { score: 12, luck: '中（旺丁）', text: '到山不到向：當運山星到坐方、向星沒到向方，旺丁、利健康，財運平平。坐後宜有實；向方要靠格局與擺設補財氣。' },
  到向不到山: { score: 13, luck: '中（旺財）', text: '到向不到山：當運向星到向方、山星沒到坐方，利財運，人丁健康平平。向前宜開闊見水；坐後要穩、宜有靠。' },
  下水: { score: 7, luck: '欠佳（不利人丁）', text: '下水（山星下水）：當運山星跑到向方，傳統認為不利人丁健康；向方若有高樓或山可以接住山星，反而能用。' },
  上山: { score: 7, luck: '欠佳（不利財運）', text: '上山（向星上山）：當運向星跑到坐方，傳統認為不利財運；坐後若有水或開闊空地可以接住向星，反而能用。' },
  令星不到: { score: 9, luck: '平', text: '令星不到：當運的山星、向星都不在坐方與向方，格局平平，要逐宮看山向星配合。' },
  其他: { score: 9, luck: '平', text: '令星不到：當運的山星、向星都不在坐方與向方，格局平平，要逐宮看山向星配合。' },
};

/**
 * 氣的旺衰（相對於元運），照沈氏玄空的分級：
 *   當運＝旺氣、下一運＝生氣、下二運＝進氣（次生氣）、
 *   上一運＝退氣、上二運＝衰氣、更早的：吉星（一四六八九）為死氣、凶星（二三五七）為煞氣；
 *   五黃除五運外一律煞氣。
 */
export function qiOf(star, period) {
  const d = (((star - period) % 9) + 9) % 9;
  if (d === 0) return '旺氣';
  if (star === 5) return '煞氣';
  if (d === 1) return '生氣';
  if (d === 2) return '進氣';
  if (d === 8) return '退氣';
  if (d === 7) return '衰氣';
  return [2, 3, 7].includes(star) ? '煞氣' : '死氣';
}
export const QI_SCORE = { 旺氣: 5, 生氣: 4, 進氣: 3, 退氣: 1, 衰氣: 0, 死氣: -1, 煞氣: -3 };
export const QI_ORDER = ['旺氣', '生氣', '進氣', '退氣', '衰氣', '死氣', '煞氣'];

/** 吉星／凶星的本性（跟旺衰分開看） */
export function starNature(star) {
  if ([1, 6, 8].includes(star)) return '吉星';
  if (star === 9) return '吉星';
  if (star === 4) return '中性';
  return '凶星';
}

/** 山盤或向盤跟洛書同位＝伏吟（五入中順飛）；全部對沖＝反吟（五入中逆飛） */
export function fuyinOf(mountain, facing) {
  const check = (board) => {
    if (board['中'] !== 5) return null;
    const same = PALACES.every((p) => board[p] === PALACE_INFO[p].luo);
    if (same) return '伏吟';
    const opp = PALACES.every((p) => board[p] + PALACE_INFO[p].luo === 10);
    return opp ? '反吟' : null;
  };
  return { mountain: check(mountain), facing: check(facing) };
}

/** 全局合十（山盤或向盤跟運盤每宮都合十） */
export function heshiAll(yun, mountain, facing) {
  const all = (a, b) => [...PALACES, '中'].every((p) => a[p] + b[p] === 10);
  if (all(mountain, yun)) return '山盤與運盤全局合十';
  if (all(facing, yun)) return '向盤與運盤全局合十';
  return null;
}

/**
 * 三般卦：
 *   父母三般＝每宮運、山、向都落在 147／258／369 同一組；
 *   連珠三般＝每宮運、山、向是連續三個數（九接一，例如 891、912）。
 */
export function sanbanOf(cells) {
  const group = (s) => ((s - 1) % 3);
  const list = Object.values(cells);
  if (list.every((c) => group(c.yun) === group(c.m) && group(c.m) === group(c.f))) return '父母三般卦';
  const nx = (s) => (s % 9) + 1;
  const chain = (c) => {
    const set = new Set([c.yun, c.m, c.f]);
    if (set.size !== 3) return false;
    return [...set].some((k) => set.has(nx(k)) && set.has(nx(nx(k))));
  };
  if (list.every(chain)) return '連珠三般卦';
  return null;
}

/* ---------------- 流年、流月、太歲 ---------------- */

/** 流年飛星（以立春換年）。2024 甲辰三碧、2025 二黑、2026 一白、2027 九紫 */
export function yearStar(year) {
  const s = (((2024 - Number(year) + 3) % 9) + 9) % 9;
  return s === 0 ? 9 : s;
}
export function yearChart(year) { return fly(yearStar(year), true); }

/** 流月飛星。monthIndex：1＝寅月（立春起）…12＝丑月 */
export function monthStar(year, monthIndex) {
  const b = ganzhiYear(year).branchIndex; // 0 子
  const start = [0, 3, 6, 9].includes(b) ? 8 : [1, 4, 7, 10].includes(b) ? 5 : 2;
  const s = (((start - (monthIndex - 1)) % 9) + 9) % 9;
  return s === 0 ? 9 : s;
}
export function monthChart(year, monthIndex) { return fly(monthStar(year, monthIndex), true); }

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRANCH_DIR = { 子: '坎', 丑: '艮', 寅: '艮', 卯: '震', 辰: '巽', 巳: '巽', 午: '離', 未: '坤', 申: '坤', 酉: '兌', 戌: '乾', 亥: '乾' };

/** 太歲、歲破、三煞 */
export function taisui(year) {
  const g = ganzhiYear(year);
  const b = g.branchIndex;
  const sui = BRANCHES[b];
  const po = BRANCHES[(b + 6) % 12];
  let sansha;
  if ([8, 0, 4].includes(b)) sansha = { palace: '離', mounts: ['巳', '午', '未'], dir: '南' };
  else if ([2, 6, 10].includes(b)) sansha = { palace: '坎', mounts: ['亥', '子', '丑'], dir: '北' };
  else if ([11, 3, 7].includes(b)) sansha = { palace: '兌', mounts: ['申', '酉', '戌'], dir: '西' };
  else sansha = { palace: '震', mounts: ['寅', '卯', '辰'], dir: '東' };
  return {
    ganzhi: g.text,
    taisui: { mount: sui, palace: BRANCH_DIR[sui], dir: PALACE_INFO[BRANCH_DIR[sui]].dir },
    suipo: { mount: po, palace: BRANCH_DIR[po], dir: PALACE_INFO[BRANCH_DIR[po]].dir },
    sansha,
  };
}

export { STAR_WX };
