// 樓層：河圖數定樓層五行，跟戶主命卦（沒有戶主就用宅卦）的五行論生剋（施工合約 5.5）
//
// 河圖：一六共宗水、二七同道火、三八為朋木、四九為友金、五十同途土 —— 看樓層的尾數。
// 以「我」（戶主命卦五行；沒戶主用宅卦五行）看樓層：
//   生入（樓層生我）3、比和 2.5、剋出（我剋樓層）2、生出（我生樓層）1、剋入（樓層剋我）0；沒填樓層 1.5。
// notes 是不計分的白話提醒：頂樓、一樓、樓層五行跟宅卦五行的關係。
//
// 10/04 稽核 [25]：補氣、通關的色系不是全屋都用，只用在玄關或戶主臥室，
// 而且山星、向星（或流年星）有五黃、二黑的方位除外（D4：那裡只用金洩，不用土、火、木、流水）。
// 有傳 cells（九宮山向星，可再帶 yearStar）時，直接說出是哪幾個方位；玄關（大門宮）或主臥剛好在那裡就不寫那一處。
// 回傳的 places＝樓層化解實際建議的宮位（玄關＝大門宮、戶主臥室＝主臥宮；不知道在哪一宮的不列），給報告掛宮位用。

import { floorElement, relation, GUA_WX, SHENG, WX_COLOR, supporter } from './wuxing.mjs?v=981ddbf2';
import { ALL_PALACES, PALACE_INFO } from './compass.mjs?v=981ddbf2';

export const FLOOR_MAX = 3;
export const FLOOR_SCORE = { 生入: 3, 比和: 2.5, 剋出: 2, 生出: 1, 剋入: 0 };
export const FLOOR_UNKNOWN_SCORE = 1.5;

const HETU = { 水: '一六共宗', 火: '二七同道', 木: '三八為朋', 金: '四九為友', 土: '五十同途' };
const LEVEL = { 生入: '吉', 比和: '吉', 剋出: '平', 生出: '注意', 剋入: '凶' };

/** 接受 '坤'，也接受 { gua:'坤' }（mingGua()、houseGua() 的回傳） */
function guaName(x) {
  const g = typeof x === 'string' ? x : (x && typeof x.gua === 'string' ? x.gua : null);
  return g && g !== '中' && Object.prototype.hasOwnProperty.call(GUA_WX, g) ? g : null;
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** 「我」跟樓層的關係，白話兩句。who＝'戶主'｜'宅卦'；subj＝句子裡的主詞（人／這間房子） */
function relationLines(rel, self, floorWx, who) {
  const subj = who === '戶主' ? '人' : '這間房子';
  switch (rel) {
    case '生入':
      return `${floorWx}生${self}，樓層生${who}，是「生入」。樓層的氣來幫${subj}，住起來較省力、容易得助，是五種關係裡最理想的。`;
    case '比和':
      return `樓層與${who}同屬${self}，是「比和」。同氣相扶，住起來安穩平順。`;
    case '剋出':
      return `${self}剋${floorWx}，${who}剋樓層，是「剋出」。傳統說「我剋者為財」，${subj}能駕馭這一層的氣，只是較費心力。`;
    case '生出':
      return `${self}生${floorWx}，${who}生樓層，是「生出」。${subj}的氣被樓層洩走，住起來付出多、較容易累。`;
    case '剋入':
      return `${floorWx}剋${self}，樓層剋${who}，是「剋入」。${subj}受這一層的氣壓制，住起來壓力較大、較不順手。`;
    default:
      return '';
  }
}

const is25 = (v) => {
  const n = Number(v);
  return n === 2 || n === 5;
};

/**
 * 九宮裡山星、向星或流年星（yearStar）是二黑、五黃的宮（沒給 cells 回 null＝不知道）。
 * 回 { list:[宮], year }；year＝有宮是「只有流年星」二五（句子要寫到流年星）。
 */
function earthPalaces(cells) {
  if (!cells || typeof cells !== 'object') return null;
  const list = [];
  let year = false;
  for (const p of ALL_PALACES) {
    const c = cells[p];
    if (!c || typeof c !== 'object') continue;
    const fly = is25(c.m) || is25(c.f);
    const yr = is25(c.yearStar);
    if (fly || yr) list.push(p);
    if (yr && !fly) year = true;
  }
  return { list, year };
}

const dirName = (p) => (p === '中' ? '中宮' : `${PALACE_INFO[p].dir}方`);
const palaceOrNull = (p) => (typeof p === 'string' && ALL_PALACES.includes(p) ? p : null);

/**
 * 色系用在哪裡。wx＝要加的五行。回 { where, tail, none, places }：
 *   where＝「玄關或戶主臥室」這類位置；tail＝「…有五黃、二黑的方位除外」那一句；
 *   none＝玄關與主臥都落在二黑五黃的方位，這一項不用色系調；
 *   places＝實際建議的宮位（玄關＝大門宮、戶主臥室＝主臥宮；沒傳宮位的不列）。
 * 玄關（大門宮）的山星、向星或流年星有二五 → 不寫玄關；主臥同理。
 * 金不怕二黑五黃（金洩土），就不加除外那一句。
 */
function placeOf(wx, place) {
  const door = palaceOrNull(place.doorPalace);
  const master = palaceOrNull(place.masterPalace);
  const both = [...new Set([door, master].filter(Boolean))];
  if (wx === '金') return { where: '玄關或戶主臥室', tail: '', none: false, places: both };
  const avoid = earthPalaces(place.cells);
  if (!avoid) {
    return { where: '玄關或戶主臥室', tail: '山星、向星（或流年星）有五黃、二黑的方位除外。', none: false, places: both };
  }
  const spots = [];
  const places = [];
  if (!(door && avoid.list.includes(door))) {
    spots.push('玄關');
    if (door) places.push(door);
  }
  if (!(master && avoid.list.includes(master))) {
    spots.push('戶主臥室');
    if (master && !places.includes(master)) places.push(master);
  }
  if (!spots.length) return { where: '', tail: '', none: true, places: [] };
  const which = avoid.year ? '山星、向星或流年星' : '山星或向星';
  const tail = avoid.list.length ? `本宅${avoid.list.map(dirName).join('、')}的${which}有五黃、二黑，那裡不用。` : '';
  return { where: spots.join('或'), tail, none: false, places };
}

/**
 * 生出、剋入時的調整法：生出補「生我」的五行；剋入用通關的五行（樓層生它、它生我）。只用在玄關或戶主臥室。
 * 回 { text, places }；不用調回 null。
 */
function fixOf(rel, self, floorWx, place) {
  let wx;
  let how;
  if (rel === '生出') {
    wx = supporter(self);
    how = `${wx}生${self}，把被洩掉的氣補回來。`;
  } else if (rel === '剋入') {
    wx = SHENG[floorWx];
    how = `${floorWx}生${wx}、${wx}生${self}，把相剋化成相生。`;
  } else {
    return null;
  }
  const pl = placeOf(wx, place);
  if (pl.none) {
    return {
      text: `玄關與戶主臥室都在有五黃、二黑的方位，不用${wx}的色系。這一項改以床位、床頭取個人吉方來補。`,
      places: [],
    };
  }
  return { text: `${pl.where}可多用${wx}的色系（${WX_COLOR[wx]}色）與材質，不必全屋都用。${how}${pl.tail}`, places: pl.places };
}

/** 樓層五行跟宅卦五行的關係（不計分的提醒） */
function houseNote(houseGuaName, floorWx, place) {
  const hw = GUA_WX[houseGuaName];
  const rel = relation(hw, floorWx);
  const head = `樓層與宅卦：樓層屬${floorWx}，${houseGuaName}宅屬${hw}。`;
  const tail = '這一條只是提醒，不計分。';
  switch (rel) {
    case '生入': return `${head}${floorWx}生${hw}，樓層的氣助宅，順。${tail}`;
    case '比和': return `${head}兩者同屬${hw}，同氣相扶，順。${tail}`;
    case '剋出': return `${head}${hw}剋${floorWx}，宅能制住樓層，大致平穩。${tail}`;
    case '生出': return `${head}${hw}生${floorWx}，宅氣被樓層洩掉一些，略弱。${tail}`;
    case '剋入': {
      const mid = SHENG[floorWx];
      const pl = placeOf(mid, place);
      const use = pl.none
        ? '玄關與戶主臥室都在有五黃、二黑的方位，不另用色系通關。'
        : `${pl.where}可用${mid}的色系（${WX_COLOR[mid]}色）通關。${pl.tail}`;
      return `${head}${floorWx}剋${hw}，樓層壓宅。${use}${tail}`;
    }
    default: return '';
  }
}

/**
 * 樓層評分。
 * @param {{ floor?: number|null, totalFloors?: number|null, ownerGua?: string|{gua:string}|null, houseGua?: string|{gua:string}|null,
 *           cells?: Object, masterPalace?: string|null, doorPalace?: string|null }} input
 *   cells、masterPalace、doorPalace 選填：有給就把「五黃、二黑方位除外」講成具體方位（山星、向星、流年星 yearStar 都看），
 *   玄關（大門宮）或主臥落在那裡就不寫那一處。
 * @returns {{ score:number, max:3, floor:number|null, digit:number|null, wx:string|null, selfWx:string|null,
 *            selfSource:'戶主命卦'|'宅卦'|null, relation:string|null, level:string, text:string, fix?:string,
 *            places:string[], notes:string[] }}
 *   places＝fix 實際建議用色系的宮位（玄關＝大門宮、戶主臥室＝主臥宮）；沒有 fix、或宮位沒傳時是 []。
 */
export function evaluateFloor({ floor, totalFloors, ownerGua, houseGua, cells, masterPalace, doorPalace } = {}) {
  const place = { cells, masterPalace, doorPalace };
  const n = toInt(floor);
  const total = toInt(totalFloors);
  const owner = guaName(ownerGua);
  const house = guaName(houseGua);
  const notes = [];

  if (n === null) {
    return {
      score: FLOOR_UNKNOWN_SCORE, max: FLOOR_MAX, floor: null, digit: null, wx: null,
      selfWx: null, selfSource: null, relation: null, level: '平',
      text: '沒有填樓層，這一項以中間值 1.5 分計。填了樓層，才能用河圖數看樓層五行與戶主命卦的生剋。',
      places: [],
      notes,
    };
  }

  const wx = floorElement(n);
  const digit = Math.abs(n) % 10;
  const floorName = n > 0 ? `${n} 樓` : `地下 ${Math.abs(n)} 樓`;
  const hetuLine = `${floorName}的尾數是 ${digit}，河圖「${HETU[wx]}」屬${wx}，所以這一層的五行屬${wx}。`;

  const selfGua = owner || house;
  const selfSource = owner ? '戶主命卦' : (house ? '宅卦' : null);
  const selfWx = selfGua ? GUA_WX[selfGua] : null;

  let score = FLOOR_UNKNOWN_SCORE;
  let rel = null;
  let level = '平';
  let text;
  let fix;
  let places = [];

  if (selfWx) {
    rel = relation(selfWx, wx);
    score = FLOOR_SCORE[rel];
    level = LEVEL[rel];
    const who = owner ? '戶主' : '宅卦';
    const selfLine = owner
      ? `戶主的命卦是${owner}卦，五行屬${selfWx}。`
      : `沒有戶主的命卦，改用宅卦來看：這間是${house}宅，五行屬${selfWx}。`;
    text = `${hetuLine}${selfLine}${relationLines(rel, selfWx, wx, who)}`;
    const fx = fixOf(rel, selfWx, wx, place);
    if (fx) {
      fix = fx.text;
      places = fx.places;
    }
  } else {
    text = `${hetuLine}沒有戶主命卦與宅卦的資料，無法論生剋，這一項以中間值 1.5 分計。`;
  }

  /* ---- 不計分的提醒 ---- */
  if (total !== null && total > 0 && n > total) {
    notes.push('填的樓層比總樓層還高，請確認兩個數字有沒有填反。');
  }
  if (n < 0) {
    notes.push('這一戶在地下樓層。地下室採光與通風較弱、濕氣較重，傳統上認為陽氣不足，除濕與照明要做足。');
  }
  if (n === 1) {
    notes.push('這一戶在一樓。一樓貼近地面，地氣足、進出方便，但也最直接受路沖、車流與濕氣影響。外局（門前的路、對面的屋角）要看得更仔細。');
  }
  if (total !== null && total >= 2 && n === total) {
    notes.push(`這一戶在頂樓（全棟 ${total} 層）。頂樓採光通風好，但上方沒有遮蔽，風吹日曬直接受，傳統上認為氣較不易聚。屋頂的防水、隔熱要做好，四周有同高或更高的建築作靠較佳。`);
  }
  if (n >= 5) {
    notes.push('河圖數看的是樓層尾數。有些大樓的編號跳過 4 樓，門牌樓層與實際層數不同時，兩種算法可以都算來參考。');
  }
  if (house && selfSource !== '宅卦') {
    const hn = houseNote(house, wx, place);
    if (hn) notes.push(hn);
  }

  const out = {
    score, max: FLOOR_MAX, floor: n, digit, wx, selfWx, selfSource, relation: rel, level, text, places, notes,
  };
  if (fix) out.fix = fix;
  return out;
}
