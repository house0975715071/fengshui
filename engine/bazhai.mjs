// 八宅派：宅卦、八方游年星、門主灶、命卦相配
//
// 游年星用爻變推：以伏位卦為本，
//   生氣＝變上爻、天醫＝變中下爻、延年＝三爻全變、伏位＝不變、
//   絕命＝變中爻、五鬼＝變上中爻、六煞＝變上下爻、禍害＝變下爻。
// 推出來跟大游年歌（乾六天五禍絕延生…）逐字一致，tests 裡有逐卦核對。

import { PALACES, PALACE_INFO } from './compass.mjs?v=981ddbf2';
import { EAST4, groupOf } from './ming.mjs?v=981ddbf2';

// 三爻：bit2＝上爻、bit1＝中爻、bit0＝下爻；1 陽 0 陰
export const GUA_BITS = { 乾: 0b111, 兌: 0b011, 離: 0b101, 震: 0b001, 巽: 0b110, 坎: 0b010, 艮: 0b100, 坤: 0b000 };
const BITS_GUA = Object.fromEntries(Object.entries(GUA_BITS).map(([g, b]) => [b, g]));

export const YOUNIAN_MASK = { 伏位: 0b000, 生氣: 0b100, 天醫: 0b011, 延年: 0b111, 絕命: 0b010, 五鬼: 0b110, 六煞: 0b101, 禍害: 0b001 };

export const YOUNIAN = {
  生氣: { alias: '貪狼', wx: '木', luck: '吉', level: '上吉', score: 9, rank: 1,
    meaning: '旺丁旺財、積極進取、生育與事業之星', fit: '大門、主臥、書房、灶口朝向', avoid: '廁所、儲藏、雜物' },
  天醫: { alias: '巨門', wx: '土', luck: '吉', level: '中吉', score: 8, rank: 2,
    meaning: '健康、貴人、財富安穩之星', fit: '臥室（尤其病弱者）、餐廳、灶口朝向', avoid: '廁所、廚房爐灶座落' },
  延年: { alias: '武曲', wx: '金', luck: '吉', level: '中吉', score: 8, rank: 3,
    meaning: '婚姻和合、人際長壽之星', fit: '主臥（夫妻）、大門、客廳', avoid: '廁所、廚房' },
  伏位: { alias: '輔弼', wx: '木', luck: '吉', level: '小吉', score: 6, rank: 4,
    meaning: '平穩守成、安定小財之星', fit: '臥室、神位、書房', avoid: '廁所' },
  禍害: { alias: '祿存', wx: '土', luck: '凶', level: '小凶', score: 3, rank: 5,
    meaning: '口舌是非、疲倦小病、官非之星', fit: '廁所、儲藏、廚房爐灶座落（壓制）', avoid: '大門、主臥、灶口朝向' },
  六煞: { alias: '文曲', wx: '水', luck: '凶', level: '中凶', score: 2, rank: 6,
    meaning: '桃花糾紛、人際破財、酒色之星', fit: '廁所、廚房、儲藏', avoid: '大門、主臥、灶口朝向' },
  五鬼: { alias: '廉貞', wx: '火', luck: '凶', level: '大凶', score: 1, rank: 7,
    meaning: '火災盜賊、怪事是非、暗耗破財之星', fit: '廁所、廚房爐灶座落（灶壓五鬼反吉）、儲藏', avoid: '大門、主臥、神位、灶口朝向' },
  絕命: { alias: '破軍', wx: '金', luck: '凶', level: '至凶', score: 0, rank: 8,
    meaning: '傳統上認為不利健康、人丁與財運之星', fit: '廁所、儲藏、雜物間', avoid: '大門、主臥、神位、書房、灶口朝向' },
};
export const YOUNIAN_ORDER = ['生氣', '天醫', '延年', '伏位', '禍害', '六煞', '五鬼', '絕命'];
export const LUCKY = ['生氣', '天醫', '延年', '伏位'];

/** 以某卦為伏位，八宮各是哪一顆游年星 */
export function younianStars(gua) {
  const base = GUA_BITS[gua];
  if (base === undefined) return null;
  const out = {};
  for (const [star, mask] of Object.entries(YOUNIAN_MASK)) {
    out[BITS_GUA[base ^ mask]] = star;
  }
  return out; // { 坎:'…', 艮:'…', … }
}

/** 某卦的四吉方、四凶方 */
export function luckyDirs(gua) {
  const stars = younianStars(gua);
  const good = [];
  const bad = [];
  for (const p of PALACES) (LUCKY.includes(stars[p]) ? good : bad).push({ palace: p, dir: PALACE_INFO[p].dir, star: stars[p] });
  good.sort((a, b) => YOUNIAN[a.star].rank - YOUNIAN[b.star].rank);
  bad.sort((a, b) => YOUNIAN[a.star].rank - YOUNIAN[b.star].rank);
  return { good, bad };
}

/**
 * 宅卦。mode：
 *   'sit'  坐山立極（八宅明鏡正統）：宅卦＝坐山所屬卦，伏位在坐方
 *   'door' 門上起伏位（大樓公寓常用）：宅卦＝大門所在宮位之卦，伏位在門
 */
export function houseGua(sittingPalace, doorPalace, mode = 'sit') {
  const gua = mode === 'door' && doorPalace && doorPalace !== '中' ? doorPalace : sittingPalace;
  return { gua, group: groupOf(gua), label: `${gua}宅（${groupOf(gua)}宅）`, mode };
}

/** 門、主、灶三要評價 */
export function evaluateDoor(stars, doorPalace) {
  if (!doorPalace || doorPalace === '中') return null;
  const star = stars[doorPalace];
  const info = YOUNIAN[star];
  return { palace: doorPalace, star, info, score: info.score, ok: info.luck === '吉' };
}

export function evaluateMaster(stars, masterPalace) {
  if (!masterPalace || masterPalace === '中') return null;
  const star = stars[masterPalace];
  const info = YOUNIAN[star];
  return { palace: masterPalace, star, info, score: info.score, ok: info.luck === '吉' };
}

/** 灶：座落宜凶方（壓制凶星）、灶口（火門）宜朝吉方 */
export function evaluateStove(stars, stovePalace, mouthPalace) {
  if (!stovePalace || stovePalace === '中') return null;
  const sitStar = stars[stovePalace];
  const sitOk = YOUNIAN[sitStar].luck === '凶';
  let mouth = null;
  if (mouthPalace && mouthPalace !== '中') {
    const mStar = stars[mouthPalace];
    mouth = { palace: mouthPalace, star: mStar, ok: YOUNIAN[mStar].luck === '吉', info: YOUNIAN[mStar] };
  }
  const score = (sitOk ? 4 : (YOUNIAN[sitStar].rank <= 2 ? 0 : 1)) + (mouth ? (mouth.ok ? 4 : 0) : 2);
  return { palace: stovePalace, star: sitStar, sitOk, info: YOUNIAN[sitStar], mouth, score };
}

/** 人與宅是否相配（東四命住東四宅） */
export function matchPersonHouse(personGua, houseGroup) {
  const pg = groupOf(personGua);
  return { personGroup: pg, match: pg === houseGroup };
}

export { EAST4 };
