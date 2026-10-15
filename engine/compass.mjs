// 羅盤：24 山、八卦宮位、度數換算、兼向與空亡判斷
//
// 度數一律用「磁北＝0°、順時針」。傳統羅盤的地盤正針本來就是磁北，所以不做磁偏角修正。
// 「向」＝站在大門內、面朝門外量到的度數（大門是進氣口）；「坐」＝向加 180°。

export const MOUNTS = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
  '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
// 第 i 山的中心度數 = i × 15，範圍 ±7.5°（子山 352.5°～7.5°）

export const MOUNT_YINYANG = {
  壬: '陽', 子: '陰', 癸: '陰',
  丑: '陰', 艮: '陽', 寅: '陽',
  甲: '陽', 卯: '陰', 乙: '陰',
  辰: '陰', 巽: '陽', 巳: '陽',
  丙: '陽', 午: '陰', 丁: '陰',
  未: '陰', 坤: '陽', 申: '陽',
  庚: '陽', 酉: '陰', 辛: '陰',
  戌: '陰', 乾: '陽', 亥: '陽',
};

// 每卦三山：地元龍（第一山）、天元龍（中間）、人元龍（第三山）
export const MOUNT_YUAN = {
  壬: '地', 子: '天', 癸: '人',
  丑: '地', 艮: '天', 寅: '人',
  甲: '地', 卯: '天', 乙: '人',
  辰: '地', 巽: '天', 巳: '人',
  丙: '地', 午: '天', 丁: '人',
  未: '地', 坤: '天', 申: '人',
  庚: '地', 酉: '天', 辛: '人',
  戌: '地', 乾: '天', 亥: '人',
};

export const MOUNT_PALACE = {
  壬: '坎', 子: '坎', 癸: '坎',
  丑: '艮', 艮: '艮', 寅: '艮',
  甲: '震', 卯: '震', 乙: '震',
  辰: '巽', 巽: '巽', 巳: '巽',
  丙: '離', 午: '離', 丁: '離',
  未: '坤', 坤: '坤', 申: '坤',
  庚: '兌', 酉: '兌', 辛: '兌',
  戌: '乾', 乾: '乾', 亥: '乾',
};

// 八宮順時針（從北開始）
export const PALACES = ['坎', '艮', '震', '巽', '離', '坤', '兌', '乾'];
export const ALL_PALACES = ['坎', '艮', '震', '巽', '離', '坤', '兌', '乾', '中'];

export const PALACE_INFO = {
  坎: { dir: '北', en: 'N', luo: 1, wx: '水', deg: 0, member: '中男', body: '腎、耳、血液、泌尿', matter: '事業、智慧、人緣桃花' },
  艮: { dir: '東北', en: 'NE', luo: 8, wx: '土', deg: 45, member: '少男（小兒）', body: '手指、鼻、脊背、關節', matter: '子孫、田產、守成' },
  震: { dir: '東', en: 'E', luo: 3, wx: '木', deg: 90, member: '長男', body: '足、肝、聲帶', matter: '事業、創業、名聲' },
  巽: { dir: '東南', en: 'SE', luo: 4, wx: '木', deg: 135, member: '長女', body: '股、膽、氣管', matter: '文昌、財運、人際' },
  離: { dir: '南', en: 'S', luo: 9, wx: '火', deg: 180, member: '中女', body: '眼、心臟、血壓', matter: '名聲、喜慶、文明' },
  坤: { dir: '西南', en: 'SW', luo: 2, wx: '土', deg: 225, member: '母親（女主人）', body: '腹、脾胃', matter: '人緣、田產、婚姻' },
  兌: { dir: '西', en: 'W', luo: 7, wx: '金', deg: 270, member: '少女', body: '口、喉、肺', matter: '口才、財、娛樂' },
  乾: { dir: '西北', en: 'NW', luo: 6, wx: '金', deg: 315, member: '父親（男主人）', body: '頭、肺、骨骼', matter: '官祿、權威、貴人' },
  中: { dir: '中宮', en: 'C', luo: 5, wx: '土', deg: null, member: '全家', body: '脾胃、整體', matter: '全局氣場' },
};

export const PALACE_BY_LUO = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兌', 8: '艮', 9: '離' };

/** 把任何度數收到 0～360 */
export function norm(deg) {
  let d = Number(deg) % 360;
  if (Number.isNaN(d)) return 0;
  if (d < 0) d += 360;
  return d;
}

/** 對面的度數（向 ↔ 坐） */
export function opposite(deg) { return norm(deg + 180); }

/** 兩個度數的最短夾角（-180～180，正＝順時針） */
export function diff(a, b) {
  let d = norm(b) - norm(a);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** 這個度數落在哪一山：山名、中心度、偏離中心幾度（正＝順時針） */
export function mountAt(deg) {
  const d = norm(deg);
  const index = Math.round(d / 15) % 24;
  const center = index * 15;
  return { mount: MOUNTS[index], index, center, offset: diff(center, d), palace: MOUNT_PALACE[MOUNTS[index]] };
}

/** 這個度數落在哪一宮（八宮，每宮 45°） */
export function palaceAt(deg) {
  const d = norm(deg);
  return PALACES[Math.round(d / 45) % 8];
}

/** 以某一宮為中心，「相鄰」順時針／逆時針的宮 */
export function palaceShift(palace, steps) {
  const i = PALACES.indexOf(palace);
  if (i < 0) return palace;
  return PALACES[(((i + steps) % 8) + 8) % 8];
}

/** 這一山的鄰居（順時針 next、逆時針 prev） */
export function mountNeighbors(index) {
  return { prev: MOUNTS[(index + 23) % 24], next: MOUNTS[(index + 1) % 24] };
}

/**
 * 兼向判斷。沈氏玄空的習慣：
 *   偏離山中線 ≤ 3°   → 正向，用下卦
 *   3° ＜ 偏離 ＜ 6.5° → 兼向，用替卦（本系統下卦、替卦兩盤都列）
 *   偏離 ≥ 6.5°        → 騎在兩山交界線上：同卦兩山之間是「小空亡」，跨卦是「大空亡（出卦）」
 */
export function jianInfo(deg) {
  const m = mountAt(deg);
  const abs = Math.abs(m.offset);
  const nb = mountNeighbors(m.index);
  const towards = m.offset >= 0 ? nb.next : nb.prev;
  let kind = '正向';
  let kongwang = null;
  if (abs > 3 && abs < 6.5) kind = '兼向';
  if (abs >= 6.5) {
    kind = '騎線';
    kongwang = MOUNT_PALACE[towards] === m.palace ? '小空亡' : '大空亡';
  }
  return { ...m, abs, towards, kind, kongwang, label: kind === '正向' ? m.mount : `${m.mount}兼${towards}` };
}

/** 坐向完整描述 */
export function describeFacing(facingDeg) {
  const facing = jianInfo(facingDeg);
  const sitting = jianInfo(opposite(facingDeg));
  const fp = PALACE_INFO[facing.palace];
  const sp = PALACE_INFO[sitting.palace];
  return {
    facingDeg: norm(facingDeg),
    sittingDeg: opposite(facingDeg),
    facing,
    sitting,
    name: `${sitting.mount}山${facing.mount}向`,
    fullName: `坐${sitting.label}向${facing.label}`,
    plain: `坐${sp.dir}朝${fp.dir}`,
    facingPalace: facing.palace,
    sittingPalace: sitting.palace,
    yuan: MOUNT_YUAN[sitting.mount],
    kind: facing.kind,
    kongwang: facing.kongwang,
  };
}

/** 給下拉選單用：24 山名稱＋中心度數 */
export function mountOptions() {
  return MOUNTS.map((m, i) => ({ mount: m, deg: i * 15, palace: MOUNT_PALACE[m], yinyang: MOUNT_YINYANG[m], yuan: MOUNT_YUAN[m] }));
}

/** 八方位中文（給外局／床頭選項用） */
export const DIR_NAMES = { 坎: '北', 艮: '東北', 震: '東', 巽: '東南', 離: '南', 坤: '西南', 兌: '西', 乾: '西北' };
export function palaceFromDir(dirName) {
  const found = Object.entries(DIR_NAMES).find(([, v]) => v === dirName);
  return found ? found[0] : null;
}
