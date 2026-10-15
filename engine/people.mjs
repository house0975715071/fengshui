// 居住者：命卦、東西四命、宅命相配、個人四吉方四凶方、床位與床頭（施工合約 5.5）
//
// 計分只看戶主（people 的第一位），合計 0～7：
//   宅命相配 4／不配 1.5／沒填戶主 2.5
//   床位（bedPalace，戶主沒填就用主臥宮）在戶主「個人」吉方 +1.5、凶方 +0、不知道 +0.75
//   床頭（bedHead）朝戶主個人吉方 +1.5、凶方 +0、不知道 +0.75
// 其他成員不計分，但每一位都列：命卦、東西四命、跟宅配不配、四吉方四凶方、床位床頭評語。
//
// 依據：八宅明鏡（東四命配東四宅、西四命配西四宅；宅命不配時以個人命卦調床位與朝向）。
// 命卦用立春換年（有填月、日才調整）。文字不放出生年、不放人名。
//
// 10/04 X1：床在個人凶方時「移到哪一宮」不再自己寫，改問報告傳進來的 bedPlan（報告用 pickTargets('bed') 排好）：
//   bedPlan({ label, isOwner, palace, star, lucky, source }) → { targets:[宮], differ:''|null }
//   differ 有字（床位所在宮是宅卦吉方、或現運山星生旺）→ level「注意」、標「看法不同」，不寫移床，只給床頭朝向；
//   targets 有 → 「可以的話，把床移到個人吉方的北方（坎宮）…」；沒有 → 不建議移床，只給床頭。沒傳 bedPlan 照舊。
//   分數不變（床位在個人凶方照樣 0 分）。
// 10/04 Z4：bedPlan 可以回 { targets, swaps:[{ palace, room }], master:true }——床在主臥、八宅段給了主臥換房計畫：
//   居住者段用同一套（「主臥換到…」「主臥與…的臥室對調」或「不建議移床」），不另外算個人吉方的移床目標。
//   用過的計畫放在 bed.plan＝{ targets, swaps, master }（報告查動作表、閘門比對用）；看法不同時 bed.differ＝true。
// 10/04 A3：evaluatePeople 另回 sleepers＝{ [宮]: [{ label, isOwner, lucky:{ good, bad, stars } }] }（每一宮睡的人），
//   報告交給內局 evaluateRooms 的 ctx.sleepers，臥室類用實際睡的人的命卦判（見 sleepersOf）。
// 10/04 L3：evaluatePeople 收 palace25＝{ [宮]: '五黃（流年）' }（報告依山向星與流年星算好的二黑五黃）：
//   床位在個人吉方、而這一宮有二黑五黃 → 不寫「身體較弱的人尤其合適」「也利求子」這類推薦句，
//   改寫「此宮有X，八宅與玄空看法不同」，level「注意」、標題標「看法不同」，bed.note25＝X（分數照個人命卦）。
// 10/04 L5：稱呼含「小孩」時床位、床頭用小孩版（延年：利家人和睦、人緣；生氣：利成長活力、讀書精神；
//   天醫：利健康、睡得安穩；伏位：睡得安穩），不寫求子、求姻緣、夫妻、事業衝刺（KID_BANNED）。
// 10/04 L2：bedPlan 由報告用「床在這一宮的所有人」排目標（同床的配偶也算），本檔介面不變。
// 10/04 F3：長輩版——稱呼含「長輩」或（報告日期的年 − 出生年）≥ 55（ELDER_AGE）時，床位、床頭不寫求子、事業衝刺、
//   姻緣（ELDER_BANNED），改寫睡得安穩、精神較好、利健康；稱呼含「小孩」仍用小孩版。person.textFor 標用哪一版。

import { PALACES, PALACE_INFO } from './compass.mjs?v=981ddbf2';
import { mingGua } from './ming.mjs?v=981ddbf2';
import { younianStars, luckyDirs, YOUNIAN } from './bazhai.mjs?v=981ddbf2';
import { GUA_WX } from './wuxing.mjs?v=981ddbf2';

export const PEOPLE_MAX = 7;

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// 床位落在個人八星：main＝這顆星主什麼；fit＝推薦句（大人）；kid＝小孩版（L5）；kidMain＝小孩版的主句（不寫感情）
// F3：elder＝長輩版（稱呼含「長輩」或年滿 55）；elderMain＝長輩版的主句（不寫求子、事業衝刺、姻緣）
// L3：二五宮的吉方床位只用 main，不接推薦句
const BED_TEXT = {
  生氣: { main: '生氣方主活力與進取', elderMain: '生氣方主活力與精神', fit: '睡這裡精神較好，利事業衝刺，也利求子', kid: '利孩子成長活力、讀書精神', elder: '睡這裡精神較好，利健康' },
  天醫: { main: '天醫方主健康與貴人', fit: '睡這裡較安穩，身體較弱的人尤其合適', kid: '利孩子健康、睡得安穩', elder: '睡得安穩，利健康調養' },
  延年: { main: '延年方主感情和合與人際', kidMain: '延年方主和睦與人際', elderMain: '延年方主和睦與人際', fit: '利夫妻相處，也利求姻緣', kid: '利家人和睦、人緣', elder: '睡得安穩，利家人和睦' },
  伏位: { main: '伏位方主安定平穩', fit: '睡這裡心較定，屬守成之位', kid: '睡得安穩', elder: '睡這裡心較定，睡得安穩' },
  禍害: { main: '禍害方主口舌是非與小毛病', fit: '睡這裡較容易覺得疲倦、心煩', kid: '孩子睡這裡較容易覺得疲倦、心煩' },
  六煞: { main: '六煞方主感情困擾與人際破耗', kidMain: '六煞方主人際糾紛與破耗', elderMain: '六煞方主人際糾紛與破耗', fit: '睡這裡心較不定', kid: '孩子睡這裡心較不定' },
  五鬼: { main: '五鬼方主是非暗耗、心神不寧', fit: '睡這裡脾氣容易急', kid: '孩子睡這裡脾氣容易急' },
  絕命: { main: '絕命方是八宅裡凶性最重的方位', fit: '健康與精神上要多留意', kid: '孩子的健康與精神上要多留意' },
};

/** L5：小孩的床位、床頭不准出現的字（求子、求姻緣、夫妻、事業衝刺這類大人的事） */
export const KID_BANNED = Object.freeze(['求子', '添丁', '姻緣', '夫妻', '婚姻', '事業', '桃花', '感情']);
/** F3：長輩的床位、床頭不准出現的字（求子、事業衝刺、姻緣這類；改寫睡得安穩、精神較好、利健康） */
export const ELDER_BANNED = Object.freeze(['求子', '添丁', '姻緣', '事業', '衝刺', '桃花']);
/** F3：年滿幾歲用長輩版（報告日期的年 − 出生年） */
export const ELDER_AGE = 55;

/** L3：二五宮的床位（宜靜）——床頭附近放銅葫蘆、房內保持安靜 */
export const BED_25_FIX = '床頭附近放銅葫蘆，房內保持安靜。';

/** L5：稱呼含「小孩」就用小孩版 */
const isKid = (label) => /小孩/.test(String(label || ''));
/**
 * F3：長輩版——稱呼含「長輩」，或（報告日期的年 − 出生年）≥ 55。小孩版優先（稱呼含「小孩」就不算長輩）。
 * 年份用填的出生年（國曆）；沒有報告日期時只看稱呼。
 */
export function isElder(label, year, date) {
  if (isKid(label)) return false;
  if (/長輩/.test(String(label || ''))) return true;
  const y = Number(year);
  const now = date && Number(date.y);
  return Number.isInteger(y) && Number.isInteger(now) && now - y >= ELDER_AGE;
}

/**
 * 床位落在個人某顆游年星的那一句（帶句號）。kid＝小孩版；elder＝長輩版（F3）；bare＝只回主句（L3：二五宮的吉方不接推薦句）。
 */
export function bedText(star, { kid = false, elder = false, bare = false } = {}) {
  const t = BED_TEXT[star];
  if (!t) return '';
  const main = kid && t.kidMain ? t.kidMain : (!kid && elder && t.elderMain ? t.elderMain : t.main);
  if (bare) return `${main}。`;
  const fit = kid ? t.kid : (elder && t.elder ? t.elder : t.fit);
  return `${main}，${fit}。`;
}

// 床頭朝向個人八星
const HEAD_TEXT = {
  生氣: '頭朝個人生氣方，主精神好、有衝勁，利事業與求子。',
  天醫: '頭朝個人天醫方，主睡得安穩，利健康調養。',
  延年: '頭朝個人延年方，主感情和合，利夫妻與人際。',
  伏位: '頭朝個人伏位方，主安定平穩。',
  禍害: '頭朝個人禍害方，傳統上認為容易心煩、口舌多、小毛病多。',
  六煞: '頭朝個人六煞方，傳統上認為容易有感情困擾、睡不安穩。',
  五鬼: '頭朝個人五鬼方，傳統上認為容易心神不寧、多夢、脾氣急。',
  絕命: '頭朝個人絕命方，是八宅裡較忌諱的朝向，健康上要多留意。',
};
// L5：小孩版的床頭（不寫事業、求子、夫妻、感情）
const HEAD_TEXT_KID = {
  ...HEAD_TEXT,
  生氣: '頭朝個人生氣方，主精神好、有朝氣，利讀書。',
  天醫: '頭朝個人天醫方，主睡得安穩，利健康。',
  延年: '頭朝個人延年方，主心情和順，利與家人和睦相處。',
  六煞: '頭朝個人六煞方，傳統上認為容易心神不定、睡不安穩。',
};
// F3：長輩版的床頭（不寫求子、事業衝刺、姻緣；寫睡得安穩、精神較好、利健康）
const HEAD_TEXT_ELDER = {
  ...HEAD_TEXT,
  生氣: '頭朝個人生氣方，主精神較好，利健康。',
  天醫: '頭朝個人天醫方，主睡得安穩，利健康調養。',
  延年: '頭朝個人延年方，主心情和順、睡得安穩，利家人和睦。',
  伏位: '頭朝個人伏位方，主安定平穩、睡得安穩。',
  六煞: '頭朝個人六煞方，傳統上認為容易心神不定、睡不安穩。',
};

function normGroup(houseGroup) {
  const s = typeof houseGroup === 'string' ? houseGroup.slice(0, 2) : '';
  return s === '東四' || s === '西四' ? s : null;
}

function validPalace(p) {
  return typeof p === 'string' && PALACES.includes(p) ? p : null;
}

const dirList = (list) => list.map((g) => `${g.dir}（${g.star}）`).join('、');
const dirOfStar = (list, star) => {
  const hit = list.find((g) => g.star === star);
  return hit ? hit.dir : null;
};

/** 一個人的完整評語；資料不能用時回 { skip: 警告文字 } */
function evalPerson(raw, index, ctx) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const isOwner = index === 0;
  const label = (typeof src.label === 'string' && src.label.trim()) || (isOwner ? '戶主' : `成員${index + 1}`);

  const year = Number(src.year);
  if (src.year === null || src.year === undefined || src.year === '' || !Number.isInteger(year)) {
    return { skip: `${label}沒有填出生年，無法算命卦，已略過。` };
  }
  if (year < 1900 || year > 2099) {
    return { skip: `${label}的出生年不在 1900–2099 的範圍內，無法算命卦，已略過。` };
  }
  if (src.gender !== 'M' && src.gender !== 'F') {
    return { skip: `${label}沒有填性別，無法算命卦，已略過。` };
  }

  const month = Number.isInteger(Number(src.month)) && Number(src.month) >= 1 && Number(src.month) <= 12 ? Number(src.month) : null;
  let day = Number.isInteger(Number(src.day)) && Number(src.day) >= 1 && Number(src.day) <= 31 ? Number(src.day) : null;
  if (!month) day = null;
  // 1 月出生不管幾號都在立春前；只填月份沒填日期時，1 月照樣往前算一年，2 月無法判斷
  const dayForCalc = month === 1 && !day ? 15 : day;
  const mg = mingGua(year, src.gender, month || undefined, dayForCalc || undefined);
  if (!mg) {
    return { skip: `${label}的出生年換算立春後超出 1900–2099 的範圍，無法算命卦，已略過。` };
  }

  const personWarnings = [];
  if (ctx.date && Number.isInteger(Number(ctx.date.y)) && year > Number(ctx.date.y)) {
    personWarnings.push(`${label}的出生年比今天的年份還晚，請確認有沒有填錯。`);
  }

  const gua = mg.gua;
  const group = mg.group;
  const wx = GUA_WX[gua];
  const stars = younianStars(gua);
  const lucky = luckyDirs(gua);
  const goodDirs = dirList(lucky.good);
  const badDirs = dirList(lucky.bad);
  const goodPlain = lucky.good.map((g) => g.dir).join('、');
  const shengqiDir = dirOfStar(lucky.good, '生氣');
  const tianyiDir = dirOfStar(lucky.good, '天醫');
  const yannianDir = dirOfStar(lucky.good, '延年');
  const match = ctx.houseGroup ? group === ctx.houseGroup : null;
  const items = [];

  /* ---- 命卦 ---- */
  let guaText = `${label}的命卦是${gua}卦，洛書數 ${mg.num}，五行屬${wx}，屬於${group}命。`;
  const adjusted = mg.year !== year;
  if (adjusted) guaText += '出生在立春之前，依傳統以前一年起算命卦。';
  if (!month) {
    guaText += '沒有填出生月日。若是國曆 1 月到 2 月初（立春前）出生，命卦要用前一年算，請補填確認。';
  } else if (month === 2 && !day) {
    guaText += '2 月出生但沒有填日期。立春（約 2 月 3 日到 5 日）前出生要用前一年算，請補填確認。';
  } else if (month === 2 && day >= 3 && day <= 5) {
    guaText += '出生日很接近立春，立春日期每年差一天左右，請對照萬年曆確認。';
  }
  items.push({ level: '平', title: `${label}：${gua}命（${group}命）`, text: guaText });

  /* ---- 宅命相配 ---- */
  if (match === true) {
    items.push({
      level: '吉',
      title: `宅命相配：${group}命住${ctx.houseGroup}宅`,
      text: `${label}是${group}命，這間是${ctx.houseGroup}宅，命與宅同一組。`
        + '房子的四個吉方跟個人的四個吉方是同一組方位，好用的方位多，住起來較順。',
    });
  } else if (match === false) {
    items.push({
      level: '注意',
      title: `宅命不配：${group}命住${ctx.houseGroup}宅`,
      text: `${label}是${group}命，這間是${ctx.houseGroup}宅，命與宅不同組。`
        + '房子的吉方剛好落在個人的凶方，這種情況很常見，重點放在個人的床位與朝向。'
        // D5：灶口以宅卦游年吉方為準（八宅門主灶一段），宅命不配時另一派以宅主命卦吉方為準，另起一句
        + (isOwner ? '灶口朝向本報告以宅的游年吉方為準；另一派以宅主命卦的吉方為準。' : ''),
      fix: `床位安排在個人吉方（${goodPlain}），床頭也朝個人吉方。書桌、辦公桌面向個人生氣方（${shengqiDir}）。`,
    });
  } else {
    items.push({ level: '平', title: '宅命是否相配：無法判斷', text: '沒有宅卦的資料，無法判斷命與宅是否相配。' });
  }

  /* ---- 四吉方四凶方 ---- */
  items.push({
    level: '平',
    title: `${label}的四吉方、四凶方`,
    text: `四吉方：${goodDirs}。四凶方：${badDirs}。`
      + '床位、床頭、書桌與常坐的位置，盡量取吉方、避開凶方。',
  });

  /* ---- 床位 ---- */
  const bed = {
    palace: null, dir: null, source: null, star: null, luck: null, ok: null,
    head: null, headDir: null, headStar: null, headLuck: null, headOk: null, differ: false, plan: null, note25: null,
  };
  const kid = isKid(label);
  // F3：長輩（稱呼含「長輩」或年滿 55）床位、床頭用長輩版
  const elder = isElder(label, year, ctx.date);
  const rawBed = src.bedPalace === '中' ? '中' : validPalace(src.bedPalace);
  const masterBed = ctx.masterPalace === '中' ? '中' : validPalace(ctx.masterPalace);
  let bedPalace = rawBed;
  if (bedPalace) bed.source = 'bedPalace';
  else if (isOwner && masterBed) { bedPalace = masterBed; bed.source = 'masterPalace'; }

  const sleepFix = `把床移到個人吉方的房間，其中個人天醫方（${tianyiDir}）、個人延年方（${yannianDir}）最適合睡覺。`
    + '暫時不能換房時，先把床頭轉向個人吉方。';
  // X1：只給床頭的做法（不移床時用）
  const headOnly = `床頭轉向個人吉方（${goodPlain}），優先選個人天醫方（${tianyiDir}）、個人延年方（${yannianDir}），`
    + '床靠向房內個人吉方那一側。';
  const placeName = (q) => `${PALACE_INFO[q].dir}方（${q}宮）`;

  if (bedPalace === '中') {
    bed.palace = '中';
    bed.dir = '中宮';
    items.push({
      level: '平',
      title: '床位在中宮',
      text: `${label}的床位在房子正中央（中宮），八宅沒有對應的方位星，這一項無法判斷吉凶。`
        + `床頭朝向仍可取個人吉方（${goodPlain}）。`,
    });
  } else if (bedPalace) {
    const star = stars[bedPalace];
    const ok = YOUNIAN[star].luck === '吉';
    Object.assign(bed, { palace: bedPalace, dir: PALACE_INFO[bedPalace].dir, star, luck: YOUNIAN[star].luck, ok });
    const lead = bed.source === 'masterPalace'
      ? `${label}沒有另外填床位，以主臥所在的${bedPalace}宮（${bed.dir}方）來看`
      : `${label}的床位在${bedPalace}宮（${bed.dir}方）`;
    // L3：這一宮有二黑五黃（山向星或流年星）→ 吉方床位不接推薦句，改寫看法不同
    const n25 = ok && ctx.palace25 && typeof ctx.palace25[bedPalace] === 'string' && ctx.palace25[bedPalace]
      ? ctx.palace25[bedPalace] : null;
    const it = {
      level: ok ? '吉' : '凶',
      title: `床位在個人「${star}」方`,
      text: `${lead}，是個人的「${star}」方，屬${ok ? '吉' : '凶'}。${bedText(star, { kid, elder, bare: !!n25 })}`,
    };
    if (n25) {
      it.level = '注意';
      it.title = `床位在個人「${star}」方（看法不同）`;
      it.text += `此宮有${n25}，八宅與玄空看法不同。`;
      it.fix = BED_25_FIX;
      bed.note25 = n25;
    }
    if (!ok) {
      let plan = null;
      if (typeof ctx.bedPlan === 'function') {
        try {
          plan = ctx.bedPlan({ label, isOwner, palace: bedPalace, star, lucky, source: bed.source });
        } catch (e) {
          plan = null;
        }
      }
      if (plan && typeof plan.differ === 'string' && plan.differ) {
        // X1：床位所在宮是宅卦吉方或現運山星生旺 → 看法不同，不寫移床，只給床頭
        it.level = '注意';
        it.title = `床位在個人「${star}」方（看法不同）`;
        it.text += `看法不同：${plan.differ}幾種看法角度不同，這裡並列，分數照個人命卦算，不必為此移床。`;
        it.fix = `不必為此移床。${headOnly}`;
        bed.differ = true;
      } else if (plan) {
        const t = (Array.isArray(plan.targets) ? plan.targets : [])
          .filter((q) => PALACES.includes(q) && q !== bedPalace).slice(0, 2);
        const sw = (Array.isArray(plan.swaps) ? plan.swaps : [])
          .filter((s) => s && PALACES.includes(s.palace) && s.palace !== bedPalace && typeof s.room === 'string');
        if (plan.master) {
          // Z4：床在主臥、八宅段給了主臥換房計畫 → 同一套（換到、對調或不建議）
          it.fix = t.length
            ? `可以的話，主臥換到宅的游年吉方${t.map(placeName).join('或')}（見八宅段）。暫時換不了時，${headOnly}`
            : sw.length
              ? `可以的話，主臥與${placeName(sw[0].palace)}的${sw[0].room}對調（見八宅段）。暫時換不了時，${headOnly}`
              : `宅的游年吉方都沒有合適的房間可換（見八宅段），不建議移床。${headOnly}`;
        } else {
          it.fix = t.length
            ? `可以的話，把床移到個人吉方的${t.map(placeName).join('或')}。暫時移不了時，${headOnly}`
            : `個人吉方的房間都不適合當睡房（已有房間、二黑五黃、凶宮或大門客廳），不建議移床。${headOnly}`;
        }
        bed.plan = { targets: t, swaps: plan.master ? sw.map((s) => ({ palace: s.palace, room: s.room })) : [], master: !!plan.master };
      } else {
        it.fix = sleepFix;
      }
    }
    items.push(it);
  } else {
    items.push({
      level: '平',
      title: '床位未填',
      text: `沒有填${label}的床位，這一項無法判斷。床位建議取個人吉方：${goodDirs}。`,
    });
  }

  /* ---- 床頭 ---- */
  const head = validPalace(src.bedHead);
  if (head) {
    const star = stars[head];
    const ok = YOUNIAN[star].luck === '吉';
    Object.assign(bed, { head, headDir: PALACE_INFO[head].dir, headStar: star, headLuck: YOUNIAN[star].luck, headOk: ok });
    const it = {
      level: ok ? '吉' : '凶',
      title: `床頭朝個人「${star}」方`,
      text: `${label}的床頭朝${bed.headDir}方（躺下時頭頂指的方向），是個人的「${star}」方，屬${ok ? '吉' : '凶'}。${(kid ? HEAD_TEXT_KID : elder ? HEAD_TEXT_ELDER : HEAD_TEXT)[star]}`,
    };
    if (!ok) {
      it.fix = `把床頭轉向個人吉方（${goodPlain}），優先選個人生氣方（${shengqiDir}）、個人天醫方（${tianyiDir}）、個人延年方（${yannianDir}）。`
        + '床頭要靠實牆，不要靠廁所或爐灶的牆。';
    }
    items.push(it);
  } else {
    items.push({
      level: '平',
      title: '床頭朝向未填',
      text: `沒有填${label}的床頭朝向，這一項無法判斷。床頭建議朝個人吉方：${goodDirs}。`,
    });
  }

  /* ---- 書桌與座位 ---- */
  items.push({
    level: '平',
    title: '書桌與座位朝向',
    text: `${label}的${kid ? '書桌' : '書桌、辦公桌'}，坐下來面向個人生氣方（${shengqiDir}）最合適。`
      + `其次是個人天醫方（${tianyiDir}）與個人延年方（${yannianDir}）。`,
  });

  return {
    person: {
      label,
      index,
      isOwner,
      gua,
      num: mg.num,
      wx,
      group,
      guaLabel: mg.label,
      lichunAdjusted: adjusted,
      match,
      lucky,
      // F3：床位、床頭用哪一版文字（'kid' 小孩版｜'elder' 長輩版｜'adult'）
      textFor: kid ? 'kid' : elder ? 'elder' : 'adult',
      // F3：報告日期的年 − 出生年（沒有日期＝null）；只當資料給內局判長輩版（sleepers.age），不寫進文字
      age: ctx.date && Number.isInteger(Number(ctx.date.y)) ? Number(ctx.date.y) - year : null,
      desk: { star: '生氣', dir: shengqiDir },
      bed,
      items,
    },
    warnings: personWarnings,
  };
}

/**
 * 居住者評分。
 * @param {{ people?: Array, houseGroup?: '東四'|'西四', masterPalace?: string|null, date?: {y:number,m:number,d:number},
 *           bedPlan?: Function, palace25?: Object }} input  bedPlan 見檔頭 X1（報告傳進來的移床名單）；
 *           palace25 見檔頭 L3（{ 宮: '五黃（流年）' }，有二黑五黃的宮）
 * @returns {{ score:number, max:7, parts:{match:number,bed:number,head:number}, ownerFound:boolean,
 *            ownerLucky:{good:string[],bad:string[],stars:Object}|null,
 *            sleepers:{[宮]:Array<{label,isOwner,lucky:{good,bad,stars},age?}>},
 *            people:Array<{label,gua,group,match,lucky:{good,bad},bed,items}>, warnings:string[] }}
 */
export function evaluatePeople({ people, houseGroup, masterPalace, date, bedPlan, palace25 } = {}) {
  const list = Array.isArray(people) ? people : [];
  const ctx = {
    houseGroup: normGroup(houseGroup), masterPalace, date, bedPlan: typeof bedPlan === 'function' ? bedPlan : null,
    palace25: palace25 && typeof palace25 === 'object' ? palace25 : null,
  };
  const warnings = [];
  const out = [];
  let owner = null;

  list.forEach((raw, i) => {
    const r = evalPerson(raw, i, ctx);
    if (r.skip) { warnings.push(r.skip); return; }
    warnings.push(...r.warnings);
    out.push(r.person);
    if (i === 0) owner = r.person;
  });

  if (!list.length) warnings.push('沒有填居住者，命宅相配以中間值計。');
  else if (!owner) warnings.push('戶主（第一位）的資料不完整，命宅相配以中間值計。');
  if (list.length && !ctx.houseGroup) warnings.push('沒有宅卦的資料，無法判斷宅命是否相配。');

  // 計分只看戶主
  const parts = { match: 2.5, bed: 0.75, head: 0.75 };
  if (owner) {
    if (owner.match === true) parts.match = 4;
    else if (owner.match === false) parts.match = 1.5;
    if (owner.bed.ok !== null) parts.bed = owner.bed.ok ? 1.5 : 0;
    if (owner.bed.headOk !== null) parts.head = owner.bed.headOk ? 1.5 : 0;
  }
  const score = round1(clamp(parts.match + parts.bed + parts.head, 0, PEOPLE_MAX));

  // 戶主個人的四吉方、四凶方（宮名），給內局 evaluateRooms 的 ctx.ownerLucky 直接用（D7）；沒有戶主＝null
  const ownerLucky = owner
    ? {
      good: owner.lucky.good.map((g) => g.palace),
      bad: owner.lucky.bad.map((g) => g.palace),
      stars: Object.fromEntries([...owner.lucky.good, ...owner.lucky.bad].map((g) => [g.palace, g.star])),
    }
    : null;

  return { score, max: PEOPLE_MAX, parts, ownerFound: !!owner, ownerLucky, sleepers: sleepersOf(out), people: out, warnings };
}

/**
 * 10/04 A3：每一宮睡的人（由床位 bedPalace 算；戶主沒填床位時是主臥宮）。
 * 回 { [宮]: [{ label, isOwner, lucky:{ good:[宮], bad:[宮], stars:{ 宮: 個人游年星 } } }] }，沒有人睡的宮不列。
 * 內局 evaluateRooms 的 ctx.sleepers 用它：臥室類改用「實際睡這一宮的人」的命卦判，
 * 居住者段與內局段同一個人不會一邊說吉、一邊說凶。
 */
export function sleepersOf(list) {
  const out = {};
  for (const x of Array.isArray(list) ? list : []) {
    const p = x && x.bed ? x.bed.palace : null;
    if (!p || !(p === '中' || PALACES.includes(p)) || !x.lucky) continue;
    const good = (x.lucky.good || []).map((g) => g.palace);
    const bad = (x.lucky.bad || []).map((g) => g.palace);
    const stars = Object.fromEntries([...(x.lucky.good || []), ...(x.lucky.bad || [])].map((g) => [g.palace, g.star]));
    // F3：年紀（有報告日期才有）交給內局判長輩版（rooms.mjs G2 看 sleepers 的 age）
    const age = Number.isInteger(x.age) ? { age: x.age } : {};
    (out[p] || (out[p] = [])).push({ label: x.label, isOwner: !!x.isOwner, lucky: { good, bad, stars }, ...age });
  }
  return out;
}
