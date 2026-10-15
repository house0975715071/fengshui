// 命卦（八宅東四命／西四命）與節氣年界
//
// 年界用立春：立春前出生算前一年。立春日期用通用節氣公式（壽星公式），
// 絕大多數年份正確，少數年份可能差一天；出生在 2/3～2/5 的人請對萬年曆。

const D = 0.2422;
// 21 世紀、20 世紀的節氣常數（小寒、立春、驚蟄、清明、立夏、芒種、小暑、立秋、白露、寒露、立冬、大雪）
const C21 = { 小寒: 5.4055, 立春: 3.87, 驚蟄: 5.63, 清明: 4.81, 立夏: 5.52, 芒種: 5.678, 小暑: 7.108, 立秋: 7.5, 白露: 7.646, 寒露: 8.318, 立冬: 7.438, 大雪: 7.18 };
const C20 = { 小寒: 6.11, 立春: 4.6295, 驚蟄: 6.3826, 清明: 5.59, 立夏: 6.318, 芒種: 6.5, 小暑: 7.928, 立秋: 8.35, 白露: 8.44, 寒露: 9.098, 立冬: 8.218, 大雪: 7.9 };
// 節 → 月份（國曆）
const JIE_MONTH = { 小寒: 1, 立春: 2, 驚蟄: 3, 清明: 4, 立夏: 5, 芒種: 6, 小暑: 7, 立秋: 8, 白露: 9, 寒露: 10, 立冬: 11, 大雪: 12 };
// 節 → 地支月（寅月＝1）
export const JIE_ORDER = ['立春', '驚蟄', '清明', '立夏', '芒種', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

/**
 * 某年某節氣的國曆日（只回日，月份看 JIE_MONTH）。
 * 壽星公式 [Y×D＋C]－L：1、2 月的節（小寒、立春）L＝[(Y−1)/4]，其餘的節 L＝[Y/4]。
 */
export function jieDay(year, jie) {
  const Y = year % 100;
  const C = (year >= 2000 ? C21 : C20)[jie];
  if (C === undefined) return null;
  const L = (jie === '小寒' || jie === '立春') ? Math.floor((Y - 1) / 4) : Math.floor(Y / 4);
  return Math.floor(Y * D + C) - L;
}

export function lichunDay(year) { return jieDay(year, '立春'); }

/** 出生年月日 → 八字年（立春前算前一年） */
export function solarYearByLichun(year, month, day) {
  if (!month || !day) return year;
  const lc = lichunDay(year);
  if (month < 2 || (month === 2 && day < lc)) return year - 1;
  return year;
}

/** 國曆日期 → 節氣月（1＝寅月，從立春起算）與該月所屬的「節氣年」 */
export function solarMonthIndex(year, month, day) {
  const y = solarYearByLichun(year, month, day);
  // 從這個節氣年的立春開始，找最後一個已經過了的節
  let idx = 1;
  for (let k = 0; k < JIE_ORDER.length; k++) {
    const jie = JIE_ORDER[k];
    let jy = y;
    let jm = JIE_MONTH[jie];
    if (jie === '小寒') { jy = y + 1; }
    const jd = jieDay(jy, jie);
    const passed = (year > jy) || (year === jy && (month > jm || (month === jm && day >= jd)));
    if (passed) idx = k + 1;
  }
  return { year: y, month: idx };
}

export const NUM_GUA = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兌', 8: '艮', 9: '離' };
export const GUA_NUM = { 坎: 1, 坤: 2, 震: 3, 巽: 4, 乾: 6, 兌: 7, 艮: 8, 離: 9 };
export const EAST4 = ['坎', '離', '震', '巽'];
export const WEST4 = ['乾', '坤', '艮', '兌'];
export function groupOf(gua) { return EAST4.includes(gua) ? '東四' : '西四'; }

/**
 * 命卦。gender：'M' 男、'F' 女。month/day 有給就會依立春調整年份。
 * 男：1900 年代 (100−YY) mod 9；2000 年代 (99−YY) mod 9
 * 女：1900 年代 (YY−4) mod 9；2000 年代 (YY+6) mod 9
 * 餘 0 作 9；餘 5 男作坤(2)、女作艮(8)。
 */
export function mingGua(year, gender, month, day) {
  const y = solarYearByLichun(Number(year), month, day);
  if (!Number.isFinite(y) || y < 1900 || y > 2099) return null;
  const yy = y % 100;
  const isF = gender === 'F';
  let n;
  if (isF) n = y >= 2000 ? (yy + 6) % 9 : (((yy - 4) % 9) + 9) % 9;
  else n = y >= 2000 ? (99 - yy) % 9 : (100 - yy) % 9;
  if (n === 0) n = 9;
  if (n === 5) n = isF ? 8 : 2;
  const gua = NUM_GUA[n];
  return { year: y, num: n, gua, group: groupOf(gua), label: `${gua}命（${groupOf(gua)}命）` };
}

/** 年干支（節氣年） */
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export function ganzhiYear(year) {
  const i = ((year - 4) % 60 + 60) % 60;
  return { stem: STEMS[i % 10], branch: BRANCHES[i % 12], branchIndex: i % 12, text: STEMS[i % 10] + BRANCHES[i % 12] };
}
