// 五行生剋、九星五行、八卦五行、河圖樓層五行

export const WX = ['木', '火', '土', '金', '水'];
export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };   // 我剋

export const STAR_WX = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' };
export const GUA_WX = { 坎: '水', 艮: '土', 震: '木', 巽: '木', 離: '火', 坤: '土', 兌: '金', 乾: '金', 中: '土' };

export const WX_COLOR = { 木: '青綠', 火: '紅紫', 土: '黃褐', 金: '白金', 水: '黑藍' };
export const WX_SHAPE = { 木: '長條直立', 火: '尖角', 土: '方正', 金: '圓形', 水: '波浪曲線' };

/**
 * 從 a 的角度看 b：
 *   比和：同五行     生出：a 生 b（a 被洩）   生入：b 生 a（a 得助）
 *   剋出：a 剋 b（a 耗力）  剋入：b 剋 a（a 受傷）
 */
export function relation(a, b) {
  if (!a || !b) return null;
  if (a === b) return '比和';
  if (SHENG[a] === b) return '生出';
  if (SHENG[b] === a) return '生入';
  if (KE[a] === b) return '剋出';
  if (KE[b] === a) return '剋入';
  return null;
}

/** 關係對 a 來說是好是壞：生入／比和 +，生出 略−，剋出 略−，剋入 − */
export const RELATION_SCORE = { 生入: 2, 比和: 1, 剋出: -0.5, 生出: -1, 剋入: -2 };

export function relationText(a, b) {
  const r = relation(a, b);
  const map = {
    比和: `${a}${b}比和，同氣相扶`,
    生出: `${a}生${b}，${a}的力量被洩掉`,
    生入: `${b}生${a}，${a}得到幫助`,
    剋出: `${a}剋${b}，耗力但能制住對方`,
    剋入: `${b}剋${a}，${a}受傷`,
  };
  return r ? map[r] : '';
}

/** 河圖數：一六水、二七火、三八木、四九金、五十土（看樓層尾數） */
export function floorElement(floor) {
  const n = Math.trunc(Number(floor));
  if (!Number.isFinite(n) || n === 0) return null;
  const d = ((Math.abs(n) % 10) + 10) % 10;
  return { 1: '水', 6: '水', 2: '火', 7: '火', 3: '木', 8: '木', 4: '金', 9: '金', 5: '土', 0: '土' }[d];
}

/** 剋我的是誰、我生的是誰（化解用） */
export function controller(wx) { return Object.keys(KE).find((k) => KE[k] === wx); }
export function drainer(wx) { return SHENG[wx]; }
export function supporter(wx) { return Object.keys(SHENG).find((k) => SHENG[k] === wx); }
