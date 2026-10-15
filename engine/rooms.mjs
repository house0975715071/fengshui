// 內局：九宮房間配置的評分（施工合約 5.3，10/04 稽核後依第 11 節 D4、D5、D7、D9 調整）
//
// 起始 14 分，逐宮逐房間套規則加減，夾在 0～20。每一條命中都產生一個 item：
//   { palace, room, rule, delta, level, title, text, fix?, differ? }
// text 講「為什麼」：哪一宮（方位、代表家中誰、身體哪裡）、哪顆游年星或山向星、
// 五行怎麼生剋、水火怎麼削弱或壓住那一宮的磁場；fix 是可行的調整法。
// differ＝true：八宅、命卦、玄空看法不同的那一條（level 用「注意」，分數照規則）。
//
// 依據：八宅明鏡（門主灶；灶座宜壓凶方、火門宜向吉方）、陽宅三要、
//       沈氏玄空學（山星管人丁、向星管財；旺向喜動喜水、旺山喜靜喜實）、
//       青囊序（山上龍神不下水、水裡龍神不上山）、紫白訣（四一同宮）、飛星賦（五黃宜靜）。
// 文字都寫在這支檔裡；唯一例外是大門納衰氣的那一句（ROOM_FIX.大門納衰氣.byStar，知識庫有就用、沒有用這裡自己寫的）。
//
// 10/04 的決定（合約第 11 節）：
//   D4 這一宮的山星、向星（或流年星）有二黑、五黃 → 宮位五行那一條的化解改用金洩，
//      並寫「此宮有五黃（二黑），不用土、火、木、流水，宜靜不宜動」。中宮的廚房、廁所一律用金。
//   D5 灶座落在哪顆游年星只在八宅門主灶的「灶」計分；這裡對廚房只說明水火的影響（delta 0、level 注意）。
//   D7 臥室落游年凶方，但這一宮是戶主個人吉方、或山星生旺 → 不建議換房，改出「看法不同」那一條。
//      換房、動線的目標宮排除：已有該房間的宮、主臥宮、大門宮、客廳宮、山向星含二五的宮、戶主個人凶方。
//   D9 用「你」；游年星前面加「游年」；「當令」只指旺氣，旺氣＋生氣合稱「生旺」；不寫「損丁」這類斷語。
//
// 10/04 收尾：
//   S2 二黑、五黃宮（山向星或流年星）的做法不寫「燈常開、保持明亮、加強照明」（燈光屬火），只用金、宜靜。
//   S5 大門納衰氣／死氣／煞氣只給這顆向星那一句化解，不貼「一白用木、二五八用金…」整份通用清單。
//   S6 ctx.stoveMouth（灶口朝向，選填）有給時，廚房的游年那一條直接說灶口朝哪、要不要轉，不跟「見八宅一段」重複講。
//
// 10/04 第二輪：
//   H1 換房、動線、魚缸的目標宮另外排除流年二黑五黃（cells[宮].yearStar，跟 report 的 bedOptions 同一把尺）；
//      臥室類的目標再排除九宮評凶（cells[宮].luck＝'凶'）、山星死氣或煞氣的宮；也不換到神明廳那一宮。
//      神明廳在凶方要改安時，目標吉方同樣排除山向星或流年有二黑五黃的宮。
//   H3 二五宮（含流年）輸出的 fix：要動工、動土的那一句補註（流年有二五寫 NO_BUILD_YEAR，只有山向星二五寫 NO_BUILD_OWN）。
//      施工字眼見 BUILD_RE；「不、少、避免、忌」否定掉的不算。
//
// 10/04 第三輪：
//   Y1 大門納衰氣：門宮山星當運（現運旺氣）時不叫人在門口放水（旺山見水），知識庫 byStar 取 noWaterText，
//      自己寫的那一句也只留地墊顏色、保持安靜，並寫 DOOR_NO_WATER「門宮山星當運，不另加水」；door-facing-qi 帶 noWater。
//   Y3 流年與山向星都有二五：註記用合併的 NO_BUILD_BOTH；條件子句開頭的退路句（不能移時、移不了時…）不貼註記。
//   Y4 二五宮的宮位五行那幾條（kitchen-*、toilet-*）不再接金的做法，改寫「此宮有X，不用木（土）來化；
//      以除濕、通風、少用為主，金洩見二五那一條」（SEE_25），item 帶 merge25（報告合併成一條）。
//   Y6 換房、動線、魚缸的目標宮：匯出 targetOk(kind, 宮, env)，報告的 pickTargets 共用同一把尺。
//
// 10/04 第四輪：
//   Q1 每一條會扣分或給建議的 item 另帶 action：一句 15～28 字、能照做的短句（不帶句號），依該宮狀況給對的版本
//      （二五含流年 → 只用金、宜靜、不施工；山星當運或不宜放水 → 不放水；房間不同 → 講那個房間）；
//      不以「可以的話」「若…」開頭，也不是「…時」的條件子句。長度與開頭規矩見 ACTION_MIN／ACTION_MAX／ACTION_BAD_START。
//   Q2 匯出 waterOk(宮, env)／waterBlock／waterWhy（env 跟 targetOk 同形狀）：這一宮能不能再放水（魚缸、靜水、水景、流水）。
//      二五（含流年）、山星現運當旺、已有廁所而水過旺（坎）或水剋火（離）、九宮評凶而向星失令 → 不行。
//      內局的魚缸目標、大門 doorDrainFix、書房文昌都先問它；不行時用不放水的版本，並寫一句理由（waterWhy）。
//      door-facing-qi 的 noWater 改成「門宮不宜放水」（不只山星當運），另帶 waterWhy。
//   Q3 魚缸在二五宮（含流年）：fix 一律有「魚缸移出這一宮；移不了先關掉打氣、縮小水量」（FISH_OUT_25）；
//      向星生旺的那一條（fish-facing-good）遇二五改 delta 0、level 注意、differ。搬魚缸不算動工（BUILD_RE 排除「魚缸移出」）。
//   Q7 神明廳改安的吉方另排除臥室類、廁所、廚房的宮；全部排除時寫「神位先不移、背後靠實牆」。
//
// 10/04 第五輪：
//   B1 雙星同宮（山星、向星都是現運的當運星，九運雙星會坐／會向的那一宮）：
//      waterOk 不因山星當運擋水（「先見水、水外有山」）；魚缸向星那一條（fish-facing-good）改 0 分、注意、differ；
//      魚缸旺山那一條（fish-mountain-prosperous）不寫撤掉，改 FISH_BOTH_KEEP「魚缸保留，背後靠實牆或放高櫃（水外有山），打氣調小」。
//      兩條都帶 bothWang: true（報告取知識庫 ROOM_FIX.魚缸在旺山.bothWang 用）。
//   B2 魚缸所在宮不宜放水、原因是向星死氣煞氣（luck）或已有廁所之水（toilet）：另出 fish-water-bad
//      （luck −1 凶、toilet −0.5 注意），fix「魚缸移到 X；移不了先關掉打氣、縮小水量」（X＝targetOk('water') 的宮），action 同一件事；
//      廁所水宮裡向星生旺的魚缸（fish-facing-good）改 0 分、注意、differ。
//   B3 waterOk 的 luck 改成直接看向星死氣或煞氣（不靠九宮評等），理由句「此宮向星失令（死氣、煞氣）」（跟報告 WATER_WHY.bad 同一句）。
//   B4 臥室類「看法不同、不必換房」：ctx.sleepers 有睡這一宮的人就用他自己的命卦判，寫「睡這間的X命卦看…」；
//      沒有才退回戶主，寫「以戶主命卦暫代」。換房目標另排除睡這間的人個人凶方（跟報告 pickTargets('bed') 的 whoOf 一致）。
//
// 10/04 第六輪：
//   M1 normSleepers 收中宮（床在中宮的人不丟掉）。換房、床位的目標宮（moveTargets 的 bed 類）一律另排除
//      「床在原宮的所有人」的個人凶方（sleeperBad）——臥室兩條之外，廁所廚房壓當運山星那一條（套房）也一樣。
//   M2 臥室在游年星那一句改用 bedYnText(星, 房間)：「也利求子」只在主臥；小孩房用小孩版
//      （利成長活力、讀書精神／利健康、睡得安穩），不寫求子、夫妻、姻緣；長輩房、臥室不寫求子。
//      小孩房的山星生旺那一條也改「利孩子的健康與成長」（不寫人丁）。
//   M3 二五宮（山向星或流年星有二黑五黃）的臥室類在游年吉方（bedroom-younian-good）：不寫「身體較弱的家人睡這裡
//      尤其合適」這類推薦句，改寫「此宮有X，八宅與玄空看法不同」，標 differ、level 注意（分數照八宅 +0.5）。
//
// 10/04 第七輪：
//   G1 換房、床位的目標宮（bedTargetOk／moveTargets 的 bed 類）接受 ctx.claims＝{ 目標宮: 原宮 }（報告的登記表）：
//      已登記給別的原宮的目標宮不再給（原宮相同的可以；中宮的臥室、套房也一樣）。內局自己給出去的目標也登記
//      （依坎艮震巽離坤兌乾中的順序，先給先得），回傳 claims＝輸入的登記＋內局新登記的（不改呼叫的人傳進來的物件）。
//   G2 長輩版（BED_YN 的 elder／elderMain，八顆游年星都有）：長輩房，或 ctx.sleepers 裡睡這一宮的人有一位
//      年紀（age）≥ 55（ELDER_AGE）時，臥室、主臥用長輩版；不寫求子、事業衝刺、適合年輕人（ELDER_ROOM_BANNED）。
//      小孩房照小孩版（房間種類已指明；同一宮的長輩可能睡另一間）。山星生旺那兩句也改「利長輩的健康…」。

import { ALL_PALACES, PALACES, PALACE_INFO } from './compass.mjs?v=981ddbf2';
import { relation, STAR_WX } from './wuxing.mjs?v=981ddbf2';
import { YOUNIAN, younianStars } from './bazhai.mjs?v=981ddbf2';
import { qiOf, STAR_NAMES } from './xuankong.mjs?v=981ddbf2';
import * as REM from '../kb/remedies.mjs?v=981ddbf2';

/* ------------------------------------------------------------------ */
/* 房間代碼（合約第 4 節，key 的順序就是畫面上的順序）                    */
/* ------------------------------------------------------------------ */

export const ROOM_TYPES = {
  大門: { label: '大門', wx: null, kind: '氣口', single: true, icon: '門' },
  客廳: { label: '客廳', wx: null, kind: '起居', icon: '廳' },
  餐廳: { label: '餐廳', wx: null, kind: '起居', icon: '餐' },
  主臥: { label: '主臥', wx: null, kind: '臥室', single: true, icon: '主' },
  臥室: { label: '臥室', wx: null, kind: '臥室', icon: '臥' },
  小孩房: { label: '小孩房', wx: null, kind: '臥室', icon: '孩' },
  長輩房: { label: '長輩房', wx: null, kind: '臥室', icon: '長' },
  書房: { label: '書房', wx: '木', kind: '書房', icon: '書' },
  廚房: { label: '廚房', wx: '火', kind: '水火', single: true, icon: '灶' },
  廁所: { label: '廁所（含浴室）', wx: '水', kind: '水火', icon: '廁' },
  神明廳: { label: '神明廳', wx: '火', kind: '神位', single: true, icon: '神' },
  陽台: { label: '陽台', wx: null, kind: '採光', icon: '台' },
  樓梯: { label: '樓梯', wx: null, kind: '動線', icon: '梯' },
  電梯: { label: '電梯', wx: null, kind: '動線', icon: '電' },
  儲藏室: { label: '儲藏室', wx: null, kind: '收納', icon: '儲' },
  魚缸: { label: '魚缸', wx: '水', kind: '活水', icon: '魚' },
};

const ROOM_KEYS = Object.keys(ROOM_TYPES);

/** 臥室類（含主臥）。合約 5.3：游年吉凶那一條不含主臥（主臥在 5.2 算過），山星兩條含主臥。 */
export const BEDROOM_TYPES = ['主臥', '臥室', '小孩房', '長輩房'];

export const INTERIOR_BASE = 14;
export const INTERIOR_MAX = 20;
export const INTERIOR_EMPTY_SCORE = 10;

/** 第一個含這種房間的宮（順序：坎艮震巽離坤兌乾中）；都沒有回 null */
export function findPalace(rooms, type) {
  if (!rooms || typeof rooms !== 'object') return null;
  for (const p of ALL_PALACES) {
    if (Array.isArray(rooms[p]) && rooms[p].includes(type)) return p;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 分數表（合約 5.3，一格一格照抄；D5：廚房的游年兩條不計分）             */
/* ------------------------------------------------------------------ */

const WETFIRE_ON_GOOD = { 生氣: -3, 天醫: -3, 延年: -2.5, 伏位: -1.5 };
const WETFIRE_ON_BAD = { 絕命: 1.5, 五鬼: 1.5, 六煞: 1, 禍害: 1 };
const KITCHEN_PALACE = { 乾: -2.5, 兌: -2, 坎: -1.5, 離: -1, 震: -0.5, 巽: -0.5, 坤: 0, 艮: 0 };
const TOILET_PALACE = { 離: -1.5, 坤: -1, 艮: -1, 乾: -1, 兌: -1, 坎: -0.5, 震: 0, 巽: 0 };
const DOOR_QI = { 旺氣: 2, 生氣: 1.5, 進氣: 0.5, 退氣: 0, 衰氣: -0.5, 死氣: -1, 煞氣: -2.5 };

/* ------------------------------------------------------------------ */
/* 文字素材                                                             */
/* ------------------------------------------------------------------ */

const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const QI_PLAIN = {
  旺氣: '當運的星，力量最足',
  生氣: '下一運的星，氣正在上升',
  進氣: '再下一運的星，還算有力',
  退氣: '剛過運的星，餘氣還在但走下坡',
  衰氣: '退位兩運的星，力量已明顯轉弱',
  死氣: '失運已久的吉星，吉力已盡',
  煞氣: '失運已久的凶星，凶性顯露',
};
const SHENG_WANG = ['旺氣', '生氣'];

// 游年吉星：主什麼、被水火壓住之後（八宅明鏡「作灶」篇的說法，改成不武斷的語氣）
const YN_GOOD = {
  生氣: { main: '人丁、財運與進取心', pressed: '傳統上認為不利添丁，事業的衝勁也容易提不起來。' },
  天醫: { main: '健康、貴人與安穩的財', pressed: '傳統上認為身體調養較費力、貴人助力減少，健康上要多留意。' },
  延年: { main: '婚姻和合、人際與長壽', pressed: '傳統上認為夫妻感情與人際關係容易起摩擦。' },
  伏位: { main: '平穩守成、家運安定', pressed: '傳統上認為家運較不穩，積蓄較難守住。' },
};
// say＝接在「是這間房子的凶方，」後面的一句（D9：不寫「損丁」這類斷語）
const YN_BAD = {
  絕命: { say: '傳統上認為不利健康、人丁與財運', pressed: '凶性被壓住，傳統上認為反而利健康與人丁。' },
  五鬼: {
    say: '主火災盜賊、是非暗耗',
    pressed: '凶性被壓住，傳統上認為可減少怪事、是非與暗中破耗。',
    stove: '「灶壓五鬼」是八宅有名的吉配，傳統上認為可減少怪事與破耗。',
  },
  六煞: { say: '主桃花糾紛、人際破財', pressed: '凶性被壓住，傳統上認為感情糾紛與口舌官非較少。' },
  禍害: { say: '主口舌是非、疲倦小病', pressed: '凶性被壓住，傳統上認為是非與小毛病較少。' },
};

// 臥室落在游年八星（M2：依房間給不同的版本，見 bedYnText）
//   main＝這顆游年星主什麼（kidMain＝小孩房的說法，不寫感情、夫妻；elderMain＝長輩版的說法）；
//   fit＝臥室的那一句；master＝主臥（「也利求子」只在這裡）；elder＝長輩版（G2：八顆都有）；kid＝小孩房
const BED_YN = {
  生氣: { main: '游年生氣方主活力與進取', fit: '適合年輕人', master: '適合年輕人，也利求子', elder: '長輩睡這裡精神較好', kid: '利孩子成長活力、讀書精神' },
  天醫: { main: '游年天醫方主健康與貴人', fit: '身體較弱的家人睡這裡尤其合適', elder: '利長輩調養身體、睡得安穩', kid: '利孩子健康、睡得安穩' },
  延年: {
    main: '游年延年方主感情和合與人際', kidMain: '游年延年方主和睦與人際', elderMain: '游年延年方主長壽與人際和合',
    fit: '適合夫妻與長輩', elder: '利長輩與家人相處和睦', kid: '利孩子與家人相處和睦',
  },
  伏位: { main: '游年伏位方主安定平穩', fit: '睡眠較安穩', elder: '利長輩睡得安穩', kid: '利孩子心性安定、睡得安穩' },
  禍害: { main: '游年禍害方主口舌是非與小毛病', fit: '睡這裡容易覺得疲倦', elder: '長輩睡這裡容易覺得疲倦', kid: '孩子睡這裡容易覺得疲倦' },
  六煞: {
    main: '游年六煞方主感情糾紛與人際破耗', kidMain: '游年六煞方主人際糾紛與破耗', elderMain: '游年六煞方主人際糾紛與破耗',
    fit: '睡這裡心較不定', elder: '長輩睡這裡心較不定', kid: '孩子睡這裡心較不定',
  },
  五鬼: { main: '游年五鬼方主是非暗耗、心神不寧', fit: '睡這裡脾氣容易急', elder: '長輩睡這裡脾氣容易急', kid: '孩子睡這裡脾氣容易急' },
  絕命: { main: '游年絕命方是八宅裡凶性最重的方位', fit: '健康與精神上要多留意', elder: '長輩的健康與精神上要多留意', kid: '孩子的健康與精神上要多留意' },
};
/** M2：小孩房的條目不准出現的字（求子、夫妻、姻緣這類大人的事） */
export const KID_ROOM_BANNED = Object.freeze(['求子', '添丁', '夫妻', '姻緣', '婚姻', '桃花', '感情']);
/** G2：睡的人年紀到這個數（含）就用長輩版 */
export const ELDER_AGE = 55;
/** G2：長輩版的條目不准出現的字（求子、事業衝刺、適合年輕人這類） */
export const ELDER_ROOM_BANNED = Object.freeze(['求子', '添丁', '事業', '衝刺', '年輕人']);

/**
 * M2：臥室類落在游年星的那一句（帶句號）。room＝主臥｜臥室｜小孩房｜長輩房。
 *   「也利求子」只在主臥；小孩房用小孩版（不寫求子、夫妻、姻緣）；長輩房用長輩版。
 *   bare＝true：只回「主什麼」那一句，不帶推薦句（M3：二五宮的臥室不寫「…睡這裡尤其合適」）。
 *   opts（G2）：true 或 { elder: true }＝睡這一宮的人有長輩（年紀 ≥ ELDER_AGE）→ 臥室、主臥也用長輩版
 *   （不寫求子、事業衝刺、適合年輕人）；小孩房照小孩版。
 * 認不得的游年星回 ''。
 */
export function bedYnText(star, room = '臥室', bare = false, opts = false) {
  const t = BED_YN[star];
  if (!t) return '';
  const kid = room === '小孩房';
  const elder = !kid && (room === '長輩房' || opts === true || !!(opts && typeof opts === 'object' && opts.elder));
  let main = t.main;
  if (kid && t.kidMain) main = t.kidMain;
  else if (elder && t.elderMain) main = t.elderMain;
  if (bare) return `${main}。`;
  let fit = t.fit;
  if (kid) fit = t.kid;
  else if (elder) fit = t.elder || t.fit;
  else if (room === '主臥' && t.master) fit = t.master;
  return `${main}，${fit}。`;
}

/** G2：山星生旺那兩句的「利…」（小孩房、長輩版各一種；long＝山星生旺那一條，short＝看法不同裡的玄空那一句） */
function mountainBenefit(room, elder, long) {
  if (room === '小孩房') return '利孩子的健康與成長';
  if (elder) return long ? '利長輩的健康與睡眠安穩' : '利長輩的健康';
  return long ? '利健康、人丁與人際' : '利人丁健康';
}

// 臥室在游年凶方、又不換房時：歌訣「生氣降五鬼、天醫制絕命、延年壓六煞」配床頭
const BED_PAIR = {
  五鬼: '歌訣說「生氣降五鬼」，床頭可優先朝睡的人的個人生氣方。',
  絕命: '歌訣說「天醫制絕命」，床頭可優先朝睡的人的個人天醫方。',
  六煞: '歌訣說「延年壓六煞」，床頭可優先朝睡的人的個人延年方。',
  禍害: '床頭可優先朝睡的人的個人天醫方或延年方。',
};

const STUDY_YN = {
  生氣: '游年生氣方主進取與企圖心，利讀書考試、事業衝刺。',
  天醫: '游年天醫方主思緒安穩、有貴人，利專注思考與長期進修。',
  伏位: '游年伏位方主安定，坐得住、靜得下心，利長時間讀書辦公。',
};

const DOOR_QI_TEXT = {
  旺氣: '這是當運的旺星，大門把旺氣直接帶進屋，利財運與家運。',
  生氣: '這是下一運的星，氣正在上升，利財運，後勁也長。',
  進氣: '這是再下一運的星，還算有力，屬小吉。',
  退氣: '這是剛過運的星，餘氣還在但已走下坡，不加分也不扣分。',
  衰氣: '這顆星已退位兩運，大門納進來的氣轉弱，財運較難有起色。',
  死氣: '這顆星已經失運，大門納進來的氣偏衰，財運較難提振。',
  煞氣: '這顆星失運又帶煞，大門每天開合會去引動它，不利財運與家宅安寧。',
};

// B2：已有廁所又放魚缸（只有坎、離兩宮會擋水，見 waterBlockOf 的 toilet）
const TOILET_WATER = { 坎: '坎宮五行屬水，水上加水，水氣過旺', 離: '離宮五行屬火，廁所之水已在剋火' };
const TOILET_BODY = { 坎: '腎與泌尿方面要多留意', 離: '眼睛與心臟方面要多留意' };

const BOTH_SIDES_NOTE = '同一處另有扣分的條目，看的角度不同，兩邊並列供參考。';
const KITCHEN_YN_NOTE = '灶座的游年吉凶已在八宅門主灶計分，這裡只說明水火的影響、不重複計分。';
const BED_HEAD_FIX = '床頭朝睡的人的個人吉方（見居住者段落），床靠向房內個人吉方那一側。';

/* ------------------------------------------------------------------ */
/* 小工具                                                               */
/* ------------------------------------------------------------------ */

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** delta>0 吉、delta<0 凶（−0.5 用「注意」）、0 平 */
function levelOf(delta) {
  if (delta > 0) return '吉';
  if (delta === 0) return '平';
  return delta >= -0.5 ? '注意' : '凶';
}

function where(p) {
  return p === '中' ? '中宮（房子正中央）' : `${p}宮（${PALACE_INFO[p].dir}方）`;
}

/** 「艮宮在東北方，五行屬土，代表少男（小兒），對應身體的手指、鼻、脊背、關節。」 */
function palaceIntro(p) {
  const i = PALACE_INFO[p];
  return `${p}宮在${i.dir}方，五行屬${i.wx}，代表${i.member}，對應身體的${i.body}。`;
}

function periodName(period) {
  return CN_NUM[period] ? `${CN_NUM[period]}運` : '本運';
}

const starLabel = (n) => `${STAR_NAMES[n]}（屬${STAR_WX[n]}）`;

/** 這間房子的游年吉方／凶方（宅卦），回宮名陣列，依吉凶等級排序 */
function palacesOf(younian, luck) {
  return PALACES
    .filter((p) => YOUNIAN[younian[p]] && YOUNIAN[younian[p]].luck === luck)
    .sort((a, b) => YOUNIAN[younian[a]].rank - YOUNIAN[younian[b]].rank);
}

/** 游年吉方／凶方的方位清單，例如「東北、南、西、西北」 */
function dirsOf(younian, luck) {
  return palacesOf(younian, luck).map((p) => PALACE_INFO[p].dir).join('、');
}

/** 游年星與房間五行：只有「星被洩」「星被剋」這兩種關係才補一句（其他關係八宅不論，不硬湊） */
function younianWxNote(star, roomWx, isGood) {
  const swx = YOUNIAN[star].wx;
  const r = relation(swx, roomWx);
  if (r === '生出') {
    return `五行上游年${star}屬${swx}，${swx}生${roomWx}，${isGood ? '吉星的力量又被洩走一層' : '凶星的力量也跟著被洩掉'}。`;
  }
  if (r === '剋入') {
    return `五行上游年${star}屬${swx}，${roomWx}剋${swx}，${isGood ? '吉星直接受剋' : '凶星直接被剋住'}。`;
  }
  return '';
}

/** 飛星與房間五行：同上，只講星被洩、被剋 */
function flyWxNote(star, roomWx) {
  const swx = STAR_WX[star];
  const r = relation(swx, roomWx);
  if (r === '生出') return `${STAR_NAMES[star]}屬${swx}，${swx}生${roomWx}，旺氣又被洩走一層。`;
  if (r === '剋入') return `${STAR_NAMES[star]}屬${swx}，${roomWx}剋${swx}，旺星直接受剋。`;
  return '';
}

/** 這一宮山向星裡的二黑、五黃（only5＝只找五黃） */
function badEarth(c, only5 = false) {
  const hit = (s) => s === 5 || (!only5 && s === 2);
  const list = [];
  if (hit(c.m)) list.push({ which: '山星', star: c.m, qi: c.mQi });
  if (hit(c.f)) list.push({ which: '向星', star: c.f, qi: c.fQi });
  return list;
}

function badEarthNames(list) {
  return [...new Set(list.map((b) => STAR_NAMES[b.star]))].join('、');
}

function badEarthIntro(list) {
  const has2 = list.some((b) => b.star === 2);
  const has5 = list.some((b) => b.star === 5);
  if (has2 && has5) return '二黑俗稱病符星，五黃（廉貞）是飛星裡凶性最重的一顆，兩顆都屬土。';
  if (has2) return '二黑俗稱病符星，五行屬土。';
  return '五黃（廉貞）是飛星裡凶性最重的一顆，五行屬土。';
}

/** 二黑、五黃剛好生旺（一運、二運的二黑，四運、五運的五黃）時補一句，不改分數。D9：當令只指旺氣 */
function timelyNote(list, env) {
  if (!list.length || !list.every((b) => SHENG_WANG.includes(b.qi))) return '';
  const word = list.every((b) => b.qi === '旺氣') ? '正當令' : '屬生旺';
  return `不過${badEarthNames(list)}在${env.pn}${word}，凶性較輕，這一條可從寬看。`;
}

/** 「離宮（南方）的山星是九紫、向星是五黃。」山向星缺一邊時只講有的那一邊 */
function starsLine(c) {
  const parts = [];
  if (c.m) parts.push(`山星是${STAR_NAMES[c.m]}`);
  if (c.f) parts.push(`向星是${STAR_NAMES[c.f]}`);
  return `${where(c.p)}的${parts.join('、')}。`;
}

/** 飛星盤（山星、向星）有沒有二黑、五黃（D7 的換房排除用這個；流年另看 year25） */
const fly25 = (i) => i.m === 2 || i.m === 5 || i.f === 2 || i.f === 5;

/** 跟 report 的 is25 同一個判斷：二運的二黑、五運的五黃當運，不當凶星看 */
const is25 = (s, cur) => (s === 5 && cur !== 5) || (s === 2 && cur !== 2);

/** H1：流年二黑、五黃（用 cells[宮].yearStar 與現在的運判，跟 report 的 bedOptions 一致） */
const year25 = (i, period) => i.y !== null && is25(i.y, period);

/** H1：臥室類不換過去的宮：九宮評凶、山星死氣或煞氣（換過去等於從一個凶換到另一個凶） */
const badCell = (i) => i.luck === '凶' || i.mQi === '死氣' || i.mQi === '煞氣';

/* ---- H3：二五宮（含流年）宜靜，要動工的那一句補註 ---- */

export const NO_BUILD_YEAR = '（今年此方忌動土，明年再做）';
export const NO_BUILD_OWN = '（此方宜靜，動工前先擇日）';
/** Y3：流年與山向星都有二五時的合併註記（report 的 withBuildNote 用同一個常數） */
export const NO_BUILD_BOTH = '（今年此方忌動土；此方本身宜靜，日後動工先擇日）';
/** 三種註記（已經有其中一種的句子不再補） */
export const NO_BUILD_TAGS = Object.freeze([NO_BUILD_YEAR, NO_BUILD_OWN, NO_BUILD_BOTH]);
/**
 * Y3：條件子句開頭的退路句（「不能移時…」「移不了時…」「爐位動不了時…」）不貼註記：
 * 前一句已經講了要不要動工，退路句本身就是「不動工」的那個選項。
 */
export const FALLBACK_RE = /^[^，；：。！？]{0,8}?(?:不能|不了|無法|沒辦法)[^，；：。！？]{0,4}時/;

/**
 * 施工字眼：真的要動工、動土、拆改的做法（搬魚缸、挪床位、加窗簾這類不算）。
 * 外局（exterior.mjs）也用這一份。
 */
export const BUILD_RE = new RegExp([
  '矮牆', '屏障', '裝修', '改格局', '退縮', '種一排', '綠籬', '樹籬', '敲打', '動土', '施工', '釘牆', '翻修', '拆',
  '改安', '改到[^。]{0,24}安奉', '做玄關', '設玄關', '改成內轉', '石敢當', '氣密窗',
  // Q3：搬魚缸不是動工（「魚缸移出這一宮」不補動土註記）
  '(?<!魚缸)移出', '移離', '爐灶[^。，]{0,4}(?:避開|靠外牆)', '轉向宅的游年吉方',
].join('|'));
// 這些字出現在施工字眼前面（同一個逗號段裡）就是否定句：「這一宮避免敲打施工」「少敲打、少動土」
const BUILD_NEG = /不|少|避免|忌|勿|別|免/;

/** 這一句有沒有「沒被否定」的施工字眼（逐個逗號段看前面有沒有否定字） */
export function buildHit(sentence) {
  for (const clause of String(sentence || '').split(/(?<=[，；])/)) {
    const g = new RegExp(BUILD_RE.source, 'g');
    let m;
    while ((m = g.exec(clause))) {
      if (!BUILD_NEG.test(clause.slice(0, m.index))) return true;
      if (!m[0].length) g.lastIndex++;
    }
  }
  return false;
}

/** own 可以是 true／false，或一宮的 { m, f }（山向星有二黑、五黃就算） */
function ownFly25(own) {
  if (own && typeof own === 'object') return [own.m, own.f].some((s) => Number(s) === 2 || Number(s) === 5);
  return !!own;
}

/**
 * 二五宮用哪一句註記：
 *   流年有二五、山向星也有二五 → NO_BUILD_BOTH（Y3；第三個參數沒給時不判，維持舊的兩種）
 *   只有流年二五（今年才有）     → NO_BUILD_YEAR
 *   只有山向星二五              → NO_BUILD_OWN
 * own：這一宮山向星有沒有二五（true／false，或直接傳這一宮的 { m, f }）。
 */
export function noBuildTag(yearStar, period, own = false) {
  const y = validStar(yearStar);
  if (!(y !== null && is25(y, validStar(period)))) return NO_BUILD_OWN;
  return ownFly25(own) ? NO_BUILD_BOTH : NO_BUILD_YEAR;
}

/** 合約 8.8：一句話不超過 60 字（句號不算） */
const MAX_SENTENCE = 60;
const clen = (s) => [...String(s)].length;

/**
 * 把註記補在句尾。補上去超過 60 字時（Y3 的合併註記比較長），在施工字眼那一段前後斷句，
 * 註記貼在施工那一段：「灶口目前朝北方（…），可轉向宅的游年吉方（…）」→「灶口目前朝北方（…）。可轉向宅的游年吉方（…）（註記）」。
 */
function attachTag(s, tag) {
  const end = /[。！？]$/.test(s) ? s.slice(-1) : '';
  const body = end ? s.slice(0, -1) : s;
  if (clen(body.trim()) + clen(tag) <= MAX_SENTENCE) return `${body}${tag}${end}`;
  const parts = body.split(/(?<=，)/);
  const k = parts.findIndex((c) => buildHit(c));
  if (k < 0) return `${body}${tag}${end}`;
  const pre = parts.slice(0, k).join('').replace(/，$/, '');
  const hit = parts[k].replace(/，$/, '');
  const post = parts.slice(k + 1).join('');
  return `${pre ? `${pre}。` : ''}${hit}${tag}${post ? `。${post}` : ''}${end}`;
}

/** 把 fix 裡要動工的句子補上註記（已經有註記的句子不重複補；條件子句開頭的退路句不補） */
export function tagBuild(fix, tag) {
  if (typeof fix !== 'string' || !fix || !tag) return fix;
  return fix.split(/(?<=[。！？])/).map((s) => {
    if (!s.trim() || NO_BUILD_TAGS.some((t) => s.includes(t)) || FALLBACK_RE.test(s.trim()) || !buildHit(s)) return s;
    return attachTag(s, tag);
  }).join('');
}

/**
 * D4：這一宮的二黑、五黃（山星、向星，另看流年星）。沒有回 null。
 * { fly:[5,2], annual:5|2|null }
 */
function earth25Of(i) {
  const fly = [5, 2].filter((s) => i.m === s || i.f === s);
  const annual = (i.y === 5 || i.y === 2) && !fly.includes(i.y) ? i.y : null;
  return fly.length || annual ? { fly, annual } : null;
}

/** 「此宮有五黃，不用土、火、木、流水，宜靜不宜動。」 */
function earth25Note(e) {
  if (!e) return '';
  const parts = [];
  if (e.fly.length) parts.push(`此宮有${e.fly.map((s) => STAR_NAMES[s]).join('、')}`);
  if (e.annual) parts.push(`${e.fly.length ? '今年又逢' : '今年此宮逢'}流年${STAR_NAMES[e.annual]}`);
  return `${parts.join('，')}，不用土、火、木、流水，宜靜不宜動。`;
}

/* ---- 換房、動線的目標宮（D7） ---- */

const ORDER_QI = { 旺氣: 0, 生氣: 1 };
const hasBed = (L) => BEDROOM_TYPES.some((t) => L.includes(t));
const hasWetFire = (L) => L.includes('廁所') || L.includes('廚房');
const byQi = (env, key) => (a, b) => ORDER_QI[env.info[a][key]] - ORDER_QI[env.info[b][key]];

/**
 * G1：q 這一宮已登記給「別的原宮」（claims[q] 有值、而且不是 from）。from 沒給（不知道從哪一宮換過來）不看，
 * 跟報告 targetBlock「沒有原宮不看」一致。
 */
function claimedByOther(env, q, from) {
  const c = env && env.claims ? env.claims[q] : null;
  return !!c && !!from && c !== from;
}

/**
 * 臥室可以換過去的宮：不是大門宮、沒有臥室類（含主臥）、不是客廳、沒有廁所廚房與神明廳、
 * 山向星與流年星都沒有二五（H1）、九宮不是凶、山星不是死氣煞氣（H1）、不是戶主個人凶方、
 * 沒有登記給別的原宮（G1：from＝從哪一宮換過來）
 */
function bedTargetOk(env, q, from = env.from) {
  const L = env.layout[q];
  const i = env.info[q];
  return q !== env.door && !hasBed(L) && !L.includes('客廳') && !L.includes('神明廳') && !hasWetFire(L)
    && !fly25(i) && !year25(i, env.period) && !badCell(i) && !env.owner.bad.includes(q)
    && !claimedByOther(env, q, from);
}

/**
 * Q7：神明廳改安的目標宮（宅的游年吉方裡挑）：排除臥室類（含主臥）、廁所、廚房，
 * 山向星或流年有二黑五黃（H1；請神也是動，二五宜靜）。
 */
function altarTargetOk(env, q) {
  const i = env.info[q];
  const L = env.layout[q] || [];
  return !!i && !i.e25 && !fly25(i) && !year25(i, env.period) && !hasBed(L) && !hasWetFire(L);
}
/** Q7：游年吉方全被排除時的那一句（神位先不移） */
export const ALTAR_STAY = '其他游年吉方都不適合安神位（臥室、廁所、廚房，或有二黑五黃），神位先不移、背後靠實牆。';

/** 這一宮在這間房子是不是游年吉方／凶方 */
const ynLuck = (i, luck) => !!(i.yn && YOUNIAN[i.yn] && YOUNIAN[i.yn].luck === luck);

/** targetOk 認得的 kind */
export const TARGET_KINDS = Object.freeze(['bed', 'bed-yn', 'bed-xk', 'live', 'water']);

/**
 * 換房、動線、魚缸的目標宮能不能用（內部 env；Y6 的 targetOk 先把報告的形狀轉成這個）。
 * 共同排除（跟報告 X1 的 pickTargets 同一份）：中宮、大門宮、客廳、廚房廁所、神明廳、山向星或流年二五；
 * 再依 kind 各加條件（見 targetOk 的說明）。from＝從哪一宮換過來（G1：bed 類看登記表；沒給用 env.from）。
 */
function okTarget(kind, q, env, from = env.from) {
  if (!PALACES.includes(q) || !env.info[q]) return false;
  const i = env.info[q];
  const L = env.layout[q] || [];
  const common = q !== env.door && !L.includes('客廳') && !L.includes('神明廳') && !hasWetFire(L)
    && !fly25(i) && !year25(i, env.period);
  switch (kind) {
    case 'bed':
      return common && bedTargetOk(env, q, from);
    case 'bed-yn':
      return common && ynLuck(i, '吉') && bedTargetOk(env, q, from);
    case 'bed-xk':
      return common && ORDER_QI[i.mQi] !== undefined && bedTargetOk(env, q, from) && !ynLuck(i, '凶');
    case 'live':
      return common && ORDER_QI[i.fQi] !== undefined && !hasBed(L) && !env.owner.bad.includes(q);
    case 'water':
      // Q2：魚缸的新位置也要過 waterOk（目前的條件已涵蓋，這裡再問一次，免得兩把尺日後走樣）
      // B1：雙星同宮雖然 waterOk，搬「過去」還要另做「水外有山」，不當移入的目標（山星當運一律排除，跟報告 pickTargets('fish') 一致）
      return common && ORDER_QI[i.fQi] !== undefined && !hasBed(L) && !L.includes('魚缸') && !i.mWang
        && !waterBlockOf(i, L);
    default:
      return false;
  }
}

/* ---- Q2：這一宮能不能再放水（魚缸、靜水、水景、流水） ---- */

/**
 * 這一宮不宜再放水的原因（依序看，先中先回）；可以放水回 null。
 *   '25'       山星、向星或流年星有二黑、五黃（宜靜，不用流水）
 *   'mountain' 山星現運當旺、向星不當運（旺山見水，山上龍神不下水）。
 *              B1：山星、向星都當運（雙星同宮）不擋，取「先見水、水外有山」。
 *   'toilet'   已有廁所，而且水過旺（坎宮，宮屬水）或水剋火（離宮，宮屬火）
 *   'luck'     B3：向星屬死氣或煞氣（直接看向星，不靠九宮評等；跟報告 report.mjs 的 waterOk 同一把尺）
 * 回 { code, why }；why 是一句短的理由（不帶「不另加水」與句號），label 換掉開頭的「此宮」（大門用「門宮」）。
 * 理由的字跟報告 report.mjs 的 WATER_WHY 對齊（此宮山星當運／此宮已有廁所之水／此宮向星失令（死氣、煞氣）／此宮有X，只用金）。
 */
function waterBlockOf(i, L = [], label = '此宮') {
  if (!i) return { code: 'unknown', why: `${label}方位不明` };
  if (i.e25) return { code: '25', why: `${label}有${names25Of(i.e25)}，只用金` };
  if (i.mWang && !i.fWang) return { code: 'mountain', why: `${label}山星當運` };
  if ((L || []).includes('廁所')) {
    const wx = i.p && PALACE_INFO[i.p] ? PALACE_INFO[i.p].wx : null;
    if (wx === '水' || wx === '火') return { code: 'toilet', why: `${label}已有廁所之水` };
  }
  if (DEAD_QI.includes(i.fQi)) return { code: 'luck', why: `${label}向星失令（死氣、煞氣）` };
  return null;
}
/** B3：向星失令到不宜見水的兩種氣 */
const DEAD_QI = ['死氣', '煞氣'];

/** waterOk 的四種原因代碼 */
export const WATER_BLOCKS = Object.freeze(['25', 'mountain', 'toilet', 'luck']);

/**
 * Q2：這一宮不宜放水的原因。palace＝八宮或中宮；env＝跟 targetOk 一樣的形狀
 * （{ cells, rooms, doorPalace, period, younian?, ownerLucky? }，cells[宮] 可帶 yearStar、luck、mQi、fQi）。
 * label 換掉理由開頭的「此宮」（例如大門用「門宮」）。可以放水回 null；認不得的宮回 { code:'unknown' }。
 */
export function waterBlock(palace, env, label = '此宮') {
  const e = envOf(env);
  if (!ALL_PALACES.includes(palace) || !e.info[palace]) return { code: 'unknown', why: `${label}方位不明` };
  return waterBlockOf(e.info[palace], e.layout[palace] || [], label);
}

/** Q2：這一宮能不能再放水（魚缸、靜水、水景、流水）。true＝可以 */
export function waterOk(palace, env) {
  return !waterBlock(palace, env);
}

/** Q2：不宜放水時的理由句「門宮山星當運，不另加水」（沒有句號）；可以放水回 '' */
export function waterWhy(palace, env, label = '此宮') {
  const b = waterBlock(palace, env, label);
  return b ? `${b.why}，不另加水` : '';
}

/**
 * Y6：換房、動線、魚缸的目標宮能不能用——內局（moveTargets）與報告（pickTargets）共用同一把尺。
 * 每一種都排除（跟報告 X1 同一份）：中宮、大門宮、客廳、廁所廚房、神明廳、山向星或流年星有二黑五黃（H1）。
 * kind：
 *   'bed'    臥室類（含主臥）換過去的宮，只看排除條件：另排除已有臥室類（含主臥）的宮、
 *            九宮評凶、山星死氣或煞氣（H1）、戶主個人凶方（D7）
 *   'bed-yn' 'bed'＋宅的游年吉方
 *   'bed-xk' 'bed'＋山星生旺（旺氣、生氣）＋不是宅的游年凶方（免得八宅那邊又扣）
 *   'live'   客廳與常走的動線：向星生旺；另排除臥室類（含主臥）、戶主個人凶方
 *   'water'  魚缸：向星生旺、山星不當運；另排除臥室類（含主臥）、已有魚缸的宮
 * palace：八宮之一（中宮一律 false）。
 * env：報告的形狀 { cells, rooms, doorPalace, period, ownerLucky?, younian? }，或 evaluateRooms 自己的 env。
 *   cells[宮]＝{ m, f, mQi?, fQi?, yearStar?, luck?, younian? }（mQi／fQi 沒給用 period 算）；
 *   rooms＝{ 宮:[房間] }；doorPalace 沒給就找填了「大門」的宮；period＝現在的運；
 *   ownerLucky＝戶主個人吉凶方（跟 evaluateRooms 同三種寫法）；younian＝{ 宮:游年星 }（cells 沒帶 younian 時用）。
 *   G1（選填）：claims＝{ 目標宮: 原宮 }、from＝從哪一宮換過來（八宮或中宮）——bed 類另排除登記給別的原宮的宮；
 *   from 沒給就不看登記表（跟報告 targetBlock 一致）。
 * 回傳 true／false。
 */
export function targetOk(kind, palace, env) {
  return okTarget(kind, palace, envOf(env));
}

/** 報告的形狀 → 內部 env（已經是內部 env 就原樣回） */
function envOf(e) {
  if (e && e.layout && e.info && e.owner) return e;
  const x = e || {};
  const period = validStar(x.period !== undefined ? x.period : x.curPeriod);
  const younianMap = (x.younian && typeof x.younian === 'object') ? x.younian : {};
  const { layout } = normalizeRooms(x.rooms);
  const info = {};
  for (const p of ALL_PALACES) info[p] = palaceInfo(p, x.cells || {}, younianMap, period);
  const door = x.doorPalace !== undefined && x.doorPalace !== null ? x.doorPalace : findPalace(layout, '大門');
  return {
    layout, info, period, door: PALACES.includes(door) ? door : null, owner: normOwner(x.ownerLucky),
    // G1：登記表與原宮（選填）
    claims: normClaims(x.claims), from: ALL_PALACES.includes(x.from) ? x.from : null,
  };
}

/**
 * G1：換房、床位目標的登記表 { 目標宮: 原宮 }（報告的 people.claims 同一個形狀）。
 * 目標宮只收八宮、原宮收八宮與中宮；目標＝原宮、認不得的都略過。也收 Map。回一份新的物件（不改傳進來的）。
 */
function normClaims(x) {
  const out = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  const get = x instanceof Map ? (q) => x.get(q) : (q) => x[q];
  for (const q of PALACES) {
    const v = get(q);
    if (typeof v === 'string' && ALL_PALACES.includes(v) && v !== q) out[q] = v;
  }
  return out;
}

/**
 * 換房、動線的目標宮，最多兩個，回「坎宮（北方）、離宮（南方）」；沒得選回 ''。
 *   bed-yn：臥室換到宅的游年吉方
 *   bed-xk：臥室、床位放到山星生旺的宮（另外避開宅的游年凶方，免得八宅那邊又扣）
 *   live  ：客廳與常走的動線放到向星生旺的宮；生旺向星宮裡已經有客廳就不寫（已經做到了）
 *   water ：魚缸放到向星生旺、山星不當運的宮
 * 能不能用照 okTarget（＝匯出的 targetOk）；這裡只決定順序（游年吉凶等級、或山向星旺氣先於生氣）。
 * avoid（B4）：另外不當目標的宮（睡這間的人個人凶方）。
 * M1：臥室、床位（bed-yn、bed-xk）一律再排除「床在原宮 skip 的所有人」的個人凶方（含中宮），呼叫的人不必自己帶。
 * G1：臥室、床位另排除登記給別的原宮的宮（env.claims；原宮＝skip，含中宮）；給出去的目標（最多兩個）登記在 skip 名下，
 *     之後別的原宮不再拿到（呼叫的地方拿到的名單一定會寫進文字，所以在這裡登記）。
 */
function moveTargets(env, kind, skip, avoid = []) {
  let list = [];
  const bedKind = kind === 'bed-yn' || kind === 'bed-xk';
  const no = bedKind ? [...avoid, ...sleeperBad(env, skip)] : avoid;
  const ok = (q) => q !== skip && !no.includes(q) && okTarget(kind, q, env, skip);
  if (kind === 'bed-yn') {
    list = palacesOf(env.younian, '吉').filter(ok);
  } else if (kind === 'bed-xk') {
    list = PALACES.filter(ok).sort(byQi(env, 'mQi'));
  } else if (kind === 'live') {
    const already = ALL_PALACES.some((q) => ORDER_QI[env.info[q].fQi] !== undefined && env.layout[q].includes('客廳'));
    if (already) return '';
    list = PALACES.filter(ok).sort(byQi(env, 'fQi'));
  } else if (kind === 'water') {
    list = PALACES.filter(ok).sort(byQi(env, 'fQi'));
  }
  const top = list.slice(0, 2);
  // G1：給出去的臥室、床位目標登記在原宮名下（先給先得；同一原宮再要同一宮不擋）
  if (bedKind && env.claims) for (const q of top) if (!env.claims[q]) env.claims[q] = skip;
  return top.map((q) => where(q)).join('、');
}

/** Y1：門宮山星當運時，門口不叫人放水那一句（知識庫有就用知識庫的字串） */
export const DOOR_NO_WATER = REM.DOOR_NO_WATER || '門宮山星當運，不另加水';
// 叫人在門口「放水」的說法（地墊顏色不算）
const DOOR_WATER_RE = /靜水|水缽|魚缸|水景|流水|水養/;

/**
 * 知識庫 ROOM_FIX.大門納衰氣.byStar[星]：有就用，沒有回 ''。
 * 接受字串、字串陣列、或 { text, noWaterText } 物件（Y1；舊的 { method } 也收）；key 可以是數字或「七赤」這種星名。
 * noWater＝門宮不宜放水（Q2：waterOk 為 false）：用 noWaterText；拿到的那一句還在叫人放水（舊知識庫）就回 ''，
 * 改用 doorDrainFix 自己寫的。
 */
function kbDoorLine(star, noWater = false) {
  const fx = REM.ROOM_FIX && REM.ROOM_FIX.大門納衰氣;
  const by = fx && fx.byStar;
  if (!by || typeof by !== 'object') return '';
  let v = by[star];
  if (v === undefined) v = by[String(star)];
  if (v === undefined) v = by[STAR_NAMES[star]];
  let t = '';
  if (typeof v === 'string') t = v;
  else if (Array.isArray(v)) t = v.map(String).join('，');
  else if (v && typeof v === 'object') t = String((noWater && v.noWaterText) || v.text || v.method || '');
  t = t.trim();
  if (!t) return '';
  if (noWater && DOOR_WATER_RE.test(positiveOf(t))) return '';
  return /[。！？]$/.test(t) ? t : `${t}。`;
}

/** 拿掉「不放…、少用…、忌…」這類否定的片段，剩下的才是叫人去做的事 */
function positiveOf(s) {
  return String(s || '').replace(/(?:不用|不放|不擺|不加|少用|少放|避免|忌|不宜|不要)[^，。；：]*/g, '');
}

/**
 * 失運向星在大門：只給「這顆向星」那一句（依五行用「洩」的方式化解）；D4：這一宮有二黑、五黃時一律用金。
 * 沒有二五時優先用知識庫 byStar 的那一句，沒有才用下面自己寫的。
 * Y1＋Q2：dryWhy＝門宮不宜放水的理由句（waterWhy，例如 DOOR_NO_WATER「門宮山星當運，不另加水」）；有給時
 * 不叫人在門口放水，知識庫取 noWaterText（只講地墊顏色、保持安靜），金星（本來要放靜水的）再接這一句理由。
 */
function doorDrainFix(star, e25, dryWhy = '') {
  const name = STAR_NAMES[star];
  // 二五宜靜：用銅葫蘆、六帝錢這類不會響的金（知識庫 K2：不用風鈴、銅鈴）
  if (e25 && STAR_WX[star] !== '土') {
    return `門邊放銅葫蘆或六帝錢，門墊用白色、金屬色，用金洩土氣。${earth25Note(e25)}`;
  }
  const why = dryWhy && STAR_WX[star] === '金' ? `${dryWhy}。` : '';
  if (!e25) {
    const kb = kbDoorLine(star, !!dryWhy);
    if (kb) return `${kb}${why}`;
  }
  switch (STAR_WX[star]) {
    case '土': return `${name}屬土，用金來洩：門邊放銅葫蘆或六帝錢，門墊用白色、金屬色。${earth25Note(e25)}`;
    case '木': return `${name}屬木，用火來洩：門墊用紅色、紫色，玄關燈保持明亮。`;
    case '金': return `${name}屬金，用水來洩：門墊用黑色、深藍色。${why ? `${why}門口保持安靜。` : ''}`;
    case '水': return `${name}屬水，用木來洩：玄關擺綠色植物，門墊用綠色。`;
    case '火': return `${name}屬火，用土來洩：門墊用黃色、米色，玄關擺陶瓷器物。`;
    default: return '';
  }
}

/* ---- Q1：能照做的短句（action） ---- */

/** action 的長度（字數，不含句號）與不准的開頭 */
export const ACTION_MIN = 15;
export const ACTION_MAX = 28;
export const ACTION_BAD_START = /^(?:可以的話|若|如果|假如|萬一|要是|倘若)/;
/**
 * 動作的開頭（跟報告 report.mjs 的 ACTION_LEAD_RE 同一份白名單）：報告的 LINE 化解重點、退路動作都要這樣開頭，
 * 內局、外局的 action 一律從這裡挑開頭，報告就能直接用。
 */
export const ACTION_LEAD = /^(?:放|擺|改用|改放|掛|移|把|保持|關|加|換|拿掉|收|避免|床頭|床位|地墊|門墊|鋪|貼|裝|撤|縮小|蓋|拉上|清|廁所門|爐火|灶口|玄關)/;
/** 沒寫到的條目用這兩句墊底（測試會擋：每一條規則都要有自己的 action） */
export const ACTION_FALLBACK = Object.freeze({ calm: '放銅葫蘆或六帝錢，這一方保持安靜', plain: '保持這一方整潔通風，雜物不要堆在這裡' });
/** Q3：魚缸在二五宮（含流年）的那一句（fix 用全句、action 用不帶句號的版本） */
export const FISH_OUT_25 = '魚缸移出這一宮；移不了先關掉打氣、縮小水量';
/** Q3：二五宮魚缸那幾條的 action（動詞開頭） */
export const FISH_OUT_25_ACT = `把${FISH_OUT_25}`;
/** B1：雙星同宮的魚缸——不撤，取「先見水、水外有山」（fix 用全句、action 用動詞開頭的版本） */
export const FISH_BOTH_KEEP = '魚缸保留，背後靠實牆或放高櫃（水外有山），打氣調小';
export const FISH_BOTH_ACT = '放高櫃在魚缸背後（水外有山），打氣調小';
/** B2：魚缸移走那一句的後半（移不了的退路） */
export const FISH_MOVE_TAIL = '移不了先關掉打氣、縮小水量';

/** 大門納衰氣的 action：依門宮向星五行、二五、能不能放水 */
function doorAction(star, e25, dry) {
  if (e25) return '地墊用白色或金色，門邊放銅葫蘆或六帝錢';
  switch (STAR_WX[star]) {
    case '土': return '地墊用白色或金色，門邊放金屬擺件或銅器';
    case '木': return '地墊用紅色或紫色，玄關燈保持明亮';
    case '金': return dry ? '地墊用藍色或黑色，門口保持安靜、不另放水' : '地墊用藍色或黑色，門口放一杯靜水';
    case '水': return '地墊用綠色，門口放綠色闊葉盆栽';
    case '火': return '地墊用黃色或米色，門口放陶瓷擺件';
    default: return ACTION_FALLBACK.plain;
  }
}

/** 宮位五行那幾條（廚房、廁所）的 action；二五宮（Y4）一律寫「以…為主」 */
const PALACE_WX_ACT = {
  'kitchen-qian': '擺陶瓷器皿，廚房用黃、米色系、少用紅色',
  'kitchen-dui': '擺陶瓷器皿，廚房用黃、米色系、少用紅色',
  'kitchen-kan': '擺綠色植物，爐具與水槽之間留出檯面',
  'kitchen-li': '爐火不空燒，廚房擺陶瓷、用黃色米色系',
  'kitchen-wood': '保持廚房通風、爐火不空燒，色系用淺色',
  'kitchen-center': '改用白色、金屬色的檯面，爐火不空燒',
  'toilet-li': '擺耐陰綠色盆栽，廁所門常關、保持乾燥',
  'toilet-earth': '改用白色、金屬色系，廁所門常關、保持乾燥',
  'toilet-metal': '擺陶瓷器皿，廁所門常關、保持乾燥',
  'toilet-kan': '擺耐陰綠色盆栽，廁所除濕通風保持乾燥',
  'toilet-center': '廁所門常關、馬桶蓋蓋上，抽風機常開',
};
const KITCHEN_CALM_ACT = '爐火不空燒，廚房以通風、少用大火為主';
const TOILET_CALM_ACT = '廁所門常關，以除濕、通風、少用為主';
function palaceWxAction(rule, e25) {
  if (!e25) return PALACE_WX_ACT[rule] || '';
  if (rule === 'kitchen-kan') return '保持通風，爐具與水槽、冰箱留出檯面';
  return rule.startsWith('toilet') ? TOILET_CALM_ACT : KITCHEN_CALM_ACT;
}

/** 「坎宮（北方）、離宮（南方）」→ 第一個的方位「北方」 */
function firstDir(list) {
  const m = String(list || '').match(/([坎艮震巽離坤兌乾])宮/);
  return m ? `${PALACE_INFO[m[1]].dir}方` : '';
}

/* ------------------------------------------------------------------ */
/* 整理輸入                                                             */
/* ------------------------------------------------------------------ */

function normalizeRooms(rooms) {
  const layout = {};
  const unknown = [];
  let count = 0;
  for (const p of ALL_PALACES) {
    const raw = rooms && Array.isArray(rooms[p]) ? rooms[p] : [];
    const seen = [];
    for (const r of raw) {
      if (typeof r !== 'string' || !Object.prototype.hasOwnProperty.call(ROOM_TYPES, r)) {
        if (r !== null && r !== undefined && r !== '' && !unknown.includes(String(r))) unknown.push(String(r));
        continue;
      }
      if (!seen.includes(r)) seen.push(r);
    }
    seen.sort((a, b) => ROOM_KEYS.indexOf(a) - ROOM_KEYS.indexOf(b));
    layout[p] = seen;
    count += seen.length;
  }
  return { layout, unknown, count };
}

function validStar(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n : null;
}

/**
 * 戶主個人的四吉方、四凶方（D7）。接受 { good:['乾',…], bad:[…], stars?:{宮:星} }（evaluatePeople().ownerLucky），
 * 也接受 luckyDirs() 的形狀 { good:[{palace,dir,star}], bad:[…] }；沒傳就當不知道。
 */
function normOwner(ol) {
  const out = { known: false, good: [], bad: [], star: {} };
  if (!ol || typeof ol !== 'object') return out;
  for (const k of ['good', 'bad']) {
    const arr = Array.isArray(ol[k]) ? ol[k] : [];
    for (const x of arr) {
      const p = typeof x === 'string' ? x : (x && typeof x.palace === 'string' ? x.palace : null);
      if (!PALACES.includes(p) || out.good.includes(p) || out.bad.includes(p)) continue;
      out[k].push(p);
      if (x && typeof x === 'object' && typeof x.star === 'string' && YOUNIAN[x.star]) out.star[p] = x.star;
    }
  }
  // evaluatePeople().ownerLucky 另附 stars：{ 宮: 個人游年星 }
  if (ol.stars && typeof ol.stars === 'object') {
    for (const p of PALACES) {
      if (!out.star[p] && typeof ol.stars[p] === 'string' && YOUNIAN[ol.stars[p]]) out.star[p] = ol.stars[p];
    }
  }
  out.known = out.good.length + out.bad.length > 0;
  return out;
}

/** 一個人睡哪一宮：palace／bedPalace／bed.palace（evaluatePeople 的人是 bed.palace）；M1：中宮也收 */
function sleeperPalace(v) {
  for (const p of [v.palace, v.bedPalace, v.bed && typeof v.bed === 'object' ? v.bed.palace : null]) {
    if (ALL_PALACES.includes(p)) return p;
  }
  return null;
}

/**
 * B4：每一宮睡的人。接受三種寫法：
 *   - 陣列 [{ label, palace | bedPalace | bed:{palace}, lucky?, gua? }]（evaluatePeople().people 的每一位就是這個形狀）
 *   - evaluatePeople() 的回傳（有 people 陣列）
 *   - 物件 { 宮: 人 | [人] }（這時人可以不帶宮位）
 * 人的吉凶方：lucky（luckyDirs() 的 { good:[{palace,star}], bad }，或 { good:[宮], bad:[宮], stars? }）；
 * 沒有 lucky 但有 gua（八卦名）就用 gua 算；也收直接帶 good／bad 的人。不知道吉凶方的人不算（當沒填）。
 * 回 { 宮: [{ label, good:[宮], bad:[宮], star:{宮:個人游年星} }] }；收八宮與中宮（M1：床在中宮的人不丟掉，
 * people.mjs 的 sleepersOf 也收中宮）。
 */
function normSleepers(x) {
  const out = {};
  for (const [p, v] of sleeperEntries(x)) {
    let lk = v.lucky && typeof v.lucky === 'object' ? v.lucky : null;
    if (!lk && typeof v.gua === 'string' && younianStars(v.gua)) {
      const st = younianStars(v.gua);
      lk = {
        good: PALACES.filter((q) => YOUNIAN[st[q]].luck === '吉'),
        bad: PALACES.filter((q) => YOUNIAN[st[q]].luck === '凶'),
        stars: st,
      };
    }
    if (!lk && (Array.isArray(v.good) || Array.isArray(v.bad))) lk = v;
    const o = normOwner(lk);
    if (!o.known) continue;
    const label = typeof v.label === 'string' && v.label.trim() ? v.label.trim() : '家人';
    if (!out[p]) out[p] = [];
    out[p].push({ label, good: o.good, bad: o.bad, star: o.star });
  }
  return out;
}

/**
 * normSleepers 與 G2 共用：把三種寫法攤平成 [[宮, 人]]（宮收八宮與中宮；認不得宮位的人略過）。
 */
function sleeperEntries(x) {
  if (!x || typeof x !== 'object') return [];
  const list = [];
  if (Array.isArray(x)) for (const v of x) list.push([null, v]);
  else if (Array.isArray(x.people)) for (const v of x.people) list.push([null, v]);
  else {
    for (const p of ALL_PALACES) {
      const v = x[p];
      if (Array.isArray(v)) for (const y of v) list.push([p, y]);
      else if (v && typeof v === 'object') list.push([p, v]);
    }
  }
  const out = [];
  for (const [p0, v] of list) {
    if (!v || typeof v !== 'object') continue;
    const p = p0 || sleeperPalace(v);
    if (ALL_PALACES.includes(p)) out.push([p, v]);
  }
  return out;
}

/** G2：一個人的年紀（age，數字或數字字串；0～130 才收），認不得回 null */
function ageOf(v) {
  if (!v || v.age === null || v.age === undefined || v.age === '' || typeof v.age === 'boolean') return null;
  const a = Number(v.age);
  return Number.isFinite(a) && a >= 0 && a <= 130 ? a : null;
}

/**
 * G2：睡的人裡有長輩（年紀 ≥ ELDER_AGE）的宮，回宮名陣列（八宮與中宮）。
 * 跟 normSleepers 同三種寫法；這裡不要求知道命卦（只看年紀），沒帶 age 的人不算。
 * 傳的是 evaluatePeople() 的回傳時，people 與 sleepers（報告在 sleepers 帶 age）兩邊都看。
 */
function elderPalaces(x) {
  const out = [];
  const srcs = [x];
  if (x && typeof x === 'object' && !Array.isArray(x) && Array.isArray(x.people) && x.sleepers && typeof x.sleepers === 'object') {
    srcs.push(x.sleepers);
  }
  for (const s of srcs) {
    for (const [p, v] of sleeperEntries(s)) {
      const a = ageOf(v);
      if (a !== null && a >= ELDER_AGE && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/**
 * B4：這一宮的個人命卦看法。睡這一宮的人有填就只看他（們）；沒有才退回戶主（寫「以戶主命卦暫代」）。
 * 回 { source:'sleeper'|'owner', good（有人看是吉）, who:[個人吉方的人], bad:[睡這間的人的個人凶方] }。
 */
function personalView(env, p) {
  const sl = env.sleepers[p] || [];
  if (sl.length) {
    const who = sl.filter((s) => s.good.includes(p));
    return { source: 'sleeper', good: who.length > 0, who, bad: sleeperBad(env, p) };
  }
  const good = env.owner.good.includes(p);
  return { source: 'owner', good, who: good ? [{ label: '戶主', star: env.owner.star }] : [], bad: [] };
}

/** M1：床在這一宮（八宮或中宮）的所有人的個人凶方（聯集）；沒有人回 [] */
function sleeperBad(env, p) {
  const sl = (env && env.sleepers && env.sleepers[p]) || [];
  return [...new Set(sl.flatMap((s) => s.bad))];
}

/** 「方」字：個人游年星知道就寫「延年方」，不知道寫「吉方」 */
const personStar = (s, p) => (s.star && s.star[p] ? `${s.star[p]}方` : '吉方');

/**
 * B4：「看法不同」那一句的命卦部分。
 *   睡這間的人：「睡這間的配偶命卦看，這一宮是個人的延年方，屬吉。」（最多兩位）
 *   退回戶主：「以戶主命卦暫代（沒有填睡這間的人）：這一宮是戶主個人的延年方，屬吉。」
 */
function personalLine(view, p) {
  if (view.source === 'sleeper') {
    return view.who.slice(0, 2).map((s) => `睡這間的${s.label}命卦看，這一宮是個人的${personStar(s, p)}，屬吉。`).join('');
  }
  return `以戶主命卦暫代（沒有填睡這間的人）：這一宮是戶主個人的${personStar(view.who[0] || {}, p)}，屬吉。`;
}

/** 把一宮要用到的東西先算好：山向星、旺衰、游年星、流年星、是不是當運星、有沒有二黑五黃 */
function palaceInfo(p, cells, younianMap, period) {
  const c = (cells && cells[p]) || {};
  const m = validStar(c.m);
  const f = validStar(c.f);
  const y = validStar(c.yearStar);
  const mQi = m ? (c.mQi || (period ? qiOf(m, period) : null)) : null;
  const fQi = f ? (c.fQi || (period ? qiOf(f, period) : null)) : null;
  let yn = null;
  if (p !== '中') {
    yn = (typeof c.younian === 'string' && c.younian) || younianMap[p] || null;
    if (typeof yn !== 'string' || !Object.prototype.hasOwnProperty.call(YOUNIAN, yn)) yn = null;
  }
  const info = {
    p, m, f, y, mQi, fQi, yn,
    // H1：九宮逐宮的吉凶（report 的 cells 有帶；沒帶就只看山星死氣煞氣）
    luck: typeof c.luck === 'string' ? c.luck : null,
    mWang: m !== null && (period ? m === period : mQi === '旺氣'),
    fWang: f !== null && (period ? f === period : fQi === '旺氣'),
  };
  info.e25 = earth25Of(info);
  return info;
}

/* ------------------------------------------------------------------ */
/* 宮位五行那幾條的化解（D4）                                            */
/* ------------------------------------------------------------------ */

/**
 * Y4：二五宮（山向星或流年星有二黑、五黃）的宮位五行那一條，不再「原標題接金的做法」：
 * 只說這一宮不用原本那個五行來化，以除濕、通風、少用為主；金洩寫在二五那一條（報告合併成一條）。
 * no＝原本會用的五行（廚房多用土、坎宮廚房與廁所多用木）；kind＝'kitchen'｜'toilet'。
 */
export const SEE_25 = '金洩見二五那一條';
function names25Of(e) {
  const out = e.fly.map((s) => STAR_NAMES[s]);
  if (e.annual) out.push(`流年${STAR_NAMES[e.annual]}`);
  return out.join('、');
}
function palace25Fix(e, no, kind) {
  const how = kind === 'toilet' ? '除濕、通風、少用' : '通風、爐火不空燒、少用大火';
  return `此宮有${names25Of(e)}，不用${no}來化；以${how}為主，${SEE_25}。`;
}

/**
 * 廚房的宮位五行：normal＝沒有二黑五黃時的做法；有的話（Y4）只寫「此宮有X，不用土（木）來化…金洩見二五那一條」。
 * sitBad＝爐灶已坐游年凶方（灶壓凶方）：二五宮的乾宮就不寫「避開西北角」（八宅看爐位是好的，二五又宜靜，
 * report 會另寫「兩派看法不同、先不移爐」）。
 */
function kitchenPalaceFix(p, e25, sitBad = false) {
  switch (p) {
    case '乾':
      if (e25 && sitBad) return palace25Fix(e25, '土', 'kitchen');
      return e25
        ? `爐灶盡量避開屋子的西北角。${palace25Fix(e25, '土', 'kitchen')}`
        : '爐灶盡量避開屋子的西北角。不能移時用土來通關（火生土、土生金）：廚房用黃、米、咖啡色系，擺陶瓷器皿，少用紅色。';
    case '兌':
      return e25
        ? palace25Fix(e25, '土', 'kitchen')
        : '用土來通關（火生土、土生金）：廚房用黃、米、咖啡色系，擺陶瓷器皿，少用紅色。';
    case '坎':
      return e25
        ? `爐具與水槽、冰箱之間留出檯面，不緊貼、不正對。${palace25Fix(e25, '木', 'kitchen')}`
        : '用木來通關（水生木、木生火）：廚房擺綠色植物，用木質或綠色系的櫥櫃、配件。';
    case '離':
      return e25
        ? palace25Fix(e25, '土', 'kitchen')
        : '用土洩火（火生土）：廚房用黃、米色系，擺陶瓷器皿，避免大紅色。保持通風降溫，爐火不空燒。';
    case '震':
    case '巽':
      return e25
        ? palace25Fix(e25, '土', 'kitchen')
        : '廚房保持通風、爐火不空燒，色系用淺色或土色系來收斂火氣。';
    case '坤':
    case '艮':
      return e25 ? palace25Fix(e25, '土', 'kitchen') : undefined;
    case '中':
      // 中宮屬土，爐火在此火炎土燥：沒有二黑五黃也用金（跟知識庫 ROOM_FIX.中宮廚房 同一套）；有的話照 Y4
      return e25
        ? `爐灶盡量靠外牆、離開房子的正中心。${palace25Fix(e25, '土', 'kitchen')}`
        : '爐灶盡量靠外牆、離開房子的正中心。不能移時，保持通風、爐火不空燒。'
          + '中心區域用白色、金屬色的檯面與用品，用金洩去燥土之氣，少用紅色與黃色。';
    default:
      return undefined;
  }
}

/** 廁所的宮位五行：有二黑五黃時（Y4）只寫「此宮有X，不用木（土）來化；以除濕、通風、少用為主，金洩見二五那一條」 */
function toiletPalaceFix(p, e25) {
  switch (p) {
    case '離':
      return e25
        ? palace25Fix(e25, '木', 'toilet')
        : '用木來通關（水生木、木生火）：廁所擺耐陰的綠色盆栽，用綠色或木質配件。保持乾燥明亮，門常關。';
    case '坤':
    case '艮':
      return e25
        ? palace25Fix(e25, '木', 'toilet')
        : '用金來通關（土生金、金生水）：廁所用白色、金屬色系，放金屬置物架或銅製品。保持乾燥，門常關。';
    case '乾':
    case '兌':
      return e25
        ? palace25Fix(e25, '土', 'toilet')
        : '補土生金（土也能制水）：廁所用黃、米色系，放陶瓷器皿。保持乾燥，門常關。';
    case '坎':
      return e25
        ? palace25Fix(e25, '木', 'toilet')
        : '用木洩水（水生木）：擺耐陰的綠色盆栽。重點是除濕、通風、保持乾燥。';
    case '震':
    case '巽':
      return e25 ? palace25Fix(e25, '木', 'toilet') : undefined;
    case '中':
      // 中宮屬土、廁所屬水：沒有二黑五黃也用金通關（跟知識庫 ROOM_FIX.中宮廁所 同一套）；有的話照 Y4
      return e25
        ? `日後若能改格局，把廁所移出房子的中心。${palace25Fix(e25, '木', 'toilet')}`
        : '日後若能改格局，把廁所移出房子的中心。不能改時，門常關、馬桶蓋蓋上、抽風機常開，保持乾燥無異味。'
          + '放金屬置物架、白色用品，土生金、金生水來通關。';
    default:
      return undefined;
  }
}

/** Y4：這幾條宮位五行規則遇二五宮時改寫成「金洩見二五那一條」，item 帶 merge25（報告合併成一條） */
const PALACE_WX_RULES = new Set([
  'kitchen-qian', 'kitchen-dui', 'kitchen-kan', 'kitchen-li', 'kitchen-wood', 'kitchen-earth', 'kitchen-center',
  'toilet-li', 'toilet-earth', 'toilet-metal', 'toilet-kan', 'toilet-wood', 'toilet-center',
]);

/* ------------------------------------------------------------------ */
/* 逐房間套規則                                                         */
/* ------------------------------------------------------------------ */

function evalRoom(room, c, env, items) {
  const { p, m, f, mQi, fQi, yn, e25 } = c;
  const add = (rule, delta, title, text, fix, extra) => {
    const it = { palace: p, room, rule, delta, level: levelOf(delta), title, text };
    if (fix) it.fix = fix;
    if (extra) Object.assign(it, extra);
    items.push(it);
    return it;
  };
  const isToilet = room === '廁所';
  const isKitchen = room === '廚房';
  const roomWx = ROOM_TYPES[room].wx;
  const ynInfo = yn ? YOUNIAN[yn] : null;
  const ynLine = (luckWord) => `${where(p)}在八宅排到游年「${yn}」（${ynInfo.alias}星），是這間房子的${luckWord}方`;
  const goodDirs = dirsOf(env.younian, '吉');
  // 灶口：以宅的游年吉方為準（D5）；宅命不配時另一派以宅主命卦吉方為準，另起一句、不在同一句給兩個方位。
  // S6：有給灶口朝向（ctx.stoveMouth）就直接講朝哪、要不要轉，灶口只講一次；爐灶座落位置另外指向八宅一段。
  const goodParen = goodDirs ? `（${goodDirs}）` : '';
  const mouth = env.mouth;
  let mouthLine;
  if (mouth && mouth.ok) {
    mouthLine = `灶口朝${PALACE_INFO[mouth.palace].dir}方，是游年${mouth.star}吉方，合乎「火門宜向吉方」，維持即可。`;
  } else if (mouth) {
    mouthLine = `灶口目前朝${PALACE_INFO[mouth.palace].dir}方（游年${mouth.star}凶方），可轉向宅的游年吉方${goodParen}。`;
  } else {
    mouthLine = `灶口（爐具開關那一面）以宅的游年吉方${goodParen}為準。`;
  }
  const mouthOther = env.mismatch ? '另一派以宅主命卦的吉方為準（見居住者段落）。' : '';
  // Q1：廚房游年那一條的 action（灶口）；二五宮不轉灶口（轉向算動工），只講爐台與爐火
  let mouthAct;
  if (e25) mouthAct = '爐火不空燒、用完即關，爐台保持整潔通風';
  else if (mouth && mouth.ok) mouthAct = '灶口維持朝向游年吉方，爐台保持整潔';
  else if (mouth) mouthAct = goodDirs ? `灶口轉向宅的游年吉方（${goodDirs}）` : '灶口轉向宅的游年吉方，爐台保持整潔';
  else mouthAct = goodDirs ? `灶口朝宅的游年吉方（${goodDirs}）` : '灶口朝宅的游年吉方，爐台保持整潔';
  // Q2：這一宮能不能再放水
  const dry = waterBlockOf(c, env.layout[p]);

  /* ---- 廁所或廚房 × 游年星：水火減磁場（D5：廚房只說明、不計分） ---- */
  if ((isToilet || isKitchen) && ynInfo && ynInfo.luck === '吉') {
    const g = YN_GOOD[yn];
    const head = `${ynLine('吉')}，主${g.main}。`;
    if (isToilet) {
      const badDirs = dirsOf(env.younian, '凶');
      add('wetfire-younian-good', WETFIRE_ON_GOOD[yn], `廁所壓在游年${yn}吉方`,
        `${head}廁所屬水、是排穢的地方，壓在吉方，等於把這一方的好磁場洩掉。${younianWxNote(yn, roomWx, true)}${g.pressed}`,
        `廁所門常關、馬桶蓋蓋上，保持乾燥${e25 ? '' : '、明亮'}、通風。日後若有機會改格局，廁所放在游年凶方${badDirs ? `（${badDirs}）` : ''}較合適。`,
        { action: '廁所門常關、馬桶蓋蓋上，保持乾燥通風' });
    } else {
      // 灶口已知時：先講灶口（能照做的動作），再說爐灶座落位置見八宅一段；灶口未知時照原本的順序
      const fix = mouth
        ? `${mouthLine}爐灶座落位置的調法見八宅門主灶一段。${mouthOther}`
        : `爐灶座落位置的調法見八宅門主灶一段。${mouthLine}${mouthOther}`;
      add('wetfire-younian-good', 0, `廚房在游年${yn}吉方（不重複計分）`,
        `${head}廚房屬火，爐火長年在這裡燒，會耗掉吉星的磁場；八宅講「灶座宜壓凶方」，這裡壓反了。`
        + `${younianWxNote(yn, roomWx, true)}${KITCHEN_YN_NOTE}`,
        fix,
        { level: '注意', action: mouthAct });
    }
  }
  if ((isToilet || isKitchen) && ynInfo && ynInfo.luck === '凶') {
    const b = YN_BAD[yn];
    const head = `${ynLine('凶')}，${b.say}。`;
    if (isToilet) {
      add('wetfire-younian-bad', WETFIRE_ON_BAD[yn], `廁所壓住游年${yn}凶方`,
        `${head}廁所屬水、是排穢的地方，放在凶方剛好把凶星壓住，這就是八宅說的「壓凶」。`
        + `${younianWxNote(yn, roomWx, false)}${b.pressed}`);
    } else {
      add('wetfire-younian-bad', 0, `廚房坐游年${yn}凶方（不重複計分）`,
        `${head}廚房屬火，爐灶坐在凶方，正是八宅講的「灶座壓凶方」，用火把凶星的磁場壓住。`
        + `${younianWxNote(yn, roomWx, false)}${b.stove || b.pressed}${KITCHEN_YN_NOTE}`,
        `${mouthLine}${mouthOther}`,
        { level: '注意', action: mouthAct });
    }
  }

  /* ---- 廁所或廚房 × 當運向星、當運山星 ---- */
  if ((isToilet || isKitchen) && c.fWang) {
    const how = isToilet
      ? '廁所把這股旺氣跟著穢氣一起沖走，等於當運財星被污。'
      : '廚房的爐火把這股旺氣燒耗掉，等於當運財星被燒。';
    const alt = moveTargets(env, 'live', p);
    const fix = (isToilet ? '廁所門常關、保持乾淨乾燥，不要堆雜物。' : `爐台保持整潔，廚房門口與走道保持通暢${e25 ? '' : '明亮'}。`)
      + (alt ? `客廳與常走的動線，可安排在向星生旺的${alt}來補財氣。` : '');
    add('wetfire-facing-prosperous', -2, `${room}壓在當運向星（${STAR_NAMES[f]}）`,
      `玄空飛星的向星管財。${where(p)}的向星是${starLabel(f)}，正是${env.pn}的當運旺星。`
      + '旺向星要有門、路、水或開闊的空間來帶動，財氣才進得來。'
      + `${how}${flyWxNote(f, roomWx)}主財運打折，賺得到卻不容易留住。`, fix,
      { action: isToilet ? '廁所門常關、保持乾淨乾燥，不堆雜物' : '保持爐台整潔，廚房門口與走道保持通暢' });
  }
  if ((isToilet || isKitchen) && c.mWang) {
    const how = isToilet
      ? '廁所的水氣與穢氣讓這顆丁星坐不穩，等於旺山星落水。'
      : '廚房的火氣長年燻烤，這顆丁星不得安寧。';
    const alt = moveTargets(env, 'bed-xk', p);
    const fix = (isToilet ? '廁所門常關、保持乾燥。' : '爐火不空燒、保持通風。')
      + '這一宮靠牆可放厚重的櫃子，增加「實」的力量。'
      + (alt ? `臥室、床位可安排在山星生旺的${alt}。` : '');
    add('wetfire-mountain-prosperous', -1.5, `${room}壓在當運山星（${STAR_NAMES[m]}）`,
      `玄空飛星的山星管人丁與健康。${where(p)}的山星是${starLabel(m)}，正是${env.pn}的當運旺星。`
      + '旺山星要靠「靜」與「實」來養，例如實牆、高櫃、臥室。'
      + `${how}${flyWxNote(m, roomWx)}健康、人丁與人際上要多留意。`, fix,
      { action: isToilet ? '廁所門常關、保持乾燥，靠牆放厚重櫃子' : '爐火不空燒、保持通風，靠牆放厚重櫃子' });
  }

  /* ---- 廚房 ---- */
  if (isKitchen) {
    const bads = badEarth(c);
    if (bads.length) {
      add('kitchen-star-2-5', -2, `廚房的火助旺${badEarthNames(bads)}`,
        `${starsLine(c)}${badEarthIntro(bads)}廚房屬火，火生土，爐火等於天天替它添力。`
        + `傳統上認為不利健康，家人的身體與飲食衛生要多留意。${timelyNote(bads, env)}`,
        '爐灶旁放金屬器物（銅製品、六帝錢、金屬鍋具架），用金洩土氣。廚房少用大紅色與黃色，爐火不空燒；這一宮也避免敲打施工。',
        { action: '爐火不空燒，爐灶旁放銅製品或六帝錢' });
    }
    const fix = kitchenPalaceFix(p, e25, !!ynInfo && ynInfo.luck === '凶');
    if (p === '乾') {
      add('kitchen-qian', KITCHEN_PALACE.乾, '廚房在乾宮：火燒天門',
        `${palaceIntro(p)}乾宮也是八卦裡的「天門」。廚房屬火，火剋金，傳統稱為「火燒天門」。`
        + '主男主人壓力大、運勢受壓，頭部與呼吸系統要多留意。', fix);
    } else if (p === '兌') {
      add('kitchen-dui', KITCHEN_PALACE.兌, '廚房在兌宮：火剋金',
        `${palaceIntro(p)}廚房屬火，火剋金，這一宮的金氣受傷。`
        + '主家中年輕女性運勢受壓、口舌較多，口腔、喉嚨與呼吸系統要多留意。', fix);
    } else if (p === '坎') {
      add('kitchen-kan', KITCHEN_PALACE.坎, '廚房在坎宮：水火相沖',
        `${palaceIntro(p)}廚房屬火，坎水剋火，水火相沖、互相消耗。`
        + '主夫妻容易口角、情緒起伏，腎與心臟方面要多留意。', fix);
    } else if (p === '離') {
      add('kitchen-li', KITCHEN_PALACE.離, '廚房在離宮：火上加火',
        `${palaceIntro(p)}廚房也屬火，火上加火，火氣過旺。`
        + '主家人脾氣容易急躁，眼睛與心血管要多留意。', fix);
    } else if (p === '震' || p === '巽') {
      add('kitchen-wood', KITCHEN_PALACE[p], `廚房在${p}宮：木生火，火氣偏旺`,
        `${palaceIntro(p)}廚房屬火，木生火，這一宮的木氣被爐火洩掉，火氣偏旺。`
        + '影響輕微，留意家人性子較急、容易上火即可。', fix);
    } else if (p === '坤' || p === '艮') {
      add('kitchen-earth', KITCHEN_PALACE[p], `廚房在${p}宮：火生土，五行順`,
        `${palaceIntro(p)}廚房屬火，火生土，宮位五行相生，本身沒有衝突。`
        + '吉凶另看同一宮游年星與山向星的那幾條。', fix);
    } else if (p === '中') {
      add('kitchen-center', -3, '廚房在中宮：火燒中宮',
        '中宮是房子的正中央，等於整間房子的心臟位。爐火在正中心燒，傳統稱為「火燒中宮」，火氣往八方擴散。'
        + '主家人脾氣容易急躁、家運較不穩，心血管方面要多留意。', fix);
    }
  }

  /* ---- 廁所 ---- */
  if (isToilet) {
    const fix = toiletPalaceFix(p, e25);
    if (p === '離') {
      add('toilet-li', TOILET_PALACE.離, '廁所在離宮：水剋火',
        `${palaceIntro(p)}廁所屬水，水剋火，這一宮的火氣被澆熄。`
        + '主這一宮代表的中女運勢受壓，名聲喜慶之事較弱，眼睛與心臟要多留意。', fix);
    } else if (p === '坤' || p === '艮') {
      add('toilet-earth', TOILET_PALACE[p], `廁所在${p}宮：土水相剋`,
        `${palaceIntro(p)}廁所屬水，土剋水，水被土攪濁，穢氣不容易排乾淨。`
        + `主${PALACE_INFO[p].member}運勢受拖累，腸胃消化方面要多留意。`, fix);
    } else if (p === '乾' || p === '兌') {
      add('toilet-metal', TOILET_PALACE[p], `廁所在${p}宮：金生水，金氣被洩`,
        `${palaceIntro(p)}廁所屬水，金生水，這一宮的金氣被水洩走。`
        + `主${PALACE_INFO[p].member}較容易勞累、元氣不足，呼吸系統要多留意。`, fix);
    } else if (p === '坎') {
      add('toilet-kan', TOILET_PALACE.坎, '廁所在坎宮：水過旺',
        `${palaceIntro(p)}廁所也屬水，水上加水，水氣過旺而濕重。`
        + '影響輕微，留意腎與泌尿方面的保養，也要注意桃花是非。', fix);
    } else if (p === '震' || p === '巽') {
      add('toilet-wood', TOILET_PALACE[p], `廁所在${p}宮：水生木，五行順`,
        `${palaceIntro(p)}廁所屬水，水生木，宮位五行相生，本身沒有衝突。`
        + '吉凶另看同一宮游年星與山向星的那幾條。', fix);
    } else if (p === '中') {
      add('toilet-center', -4, '廁所在中宮：穢氣入中宮',
        '中宮是房子的正中央，等於整間房子的心臟，八方的氣都從這裡流轉。'
        + '廁所的穢氣與濕氣在正中心，會往八方擴散，全家人都受影響。'
        + '這是陽宅的大忌，傳統上認為不利全家的健康與財運。', fix);
    }
  }

  /* ---- 中宮的樓梯、電梯 ---- */
  if ((room === '樓梯' || room === '電梯') && p === '中') {
    // S2：中宮有二黑、五黃（山向星或流年星）→ 不帶燈的版本，只用金、宜靜不宜動
    let fix;
    if (e25) {
      fix = (room === '樓梯'
        ? '樓梯下方不堆雜物、保持整潔。梯口加屏風、矮櫃或門簾，讓氣流緩下來。樓梯旁放銅葫蘆或六帝錢，用金洩土氣。'
        : '電梯口保持整潔，正對電梯門的地方加屏風或矮櫃，緩衝氣流。電梯旁放銅製品或六帝錢，用金洩土氣。')
        + earth25Note(e25);
    } else {
      fix = room === '樓梯'
        ? '樓梯下方不堆雜物、保持明亮，燈可以常開。梯口加屏風、矮櫃或門簾，讓氣流緩下來。'
        : '電梯口保持明亮整潔，正對電梯門的地方加屏風或矮櫃，緩衝氣流。';
    }
    const stairAct = room === '樓梯'
      ? (e25 ? '保持梯下整潔，樓梯旁放銅葫蘆或六帝錢' : '保持樓梯下方淨空，梯口加屏風或矮櫃')
      : (e25 ? '保持電梯口整潔，旁邊放銅製品或六帝錢' : '保持電梯口整潔，對面加屏風或矮櫃');
    add('stairs-center', -2, `${room}在中宮：穿心煞`,
      '中宮是房子的正中央，氣要在這裡安穩地聚住，再分到八方。'
      + `${room}是上下流動最頻繁的地方，放在正中心，氣場天天被攪動。`
      + '傳統稱為「穿心煞」，主家運起伏、財氣不易聚、家人較難同心。',
      fix, { action: stairAct });
  }

  /* ---- 臥室類 ---- */
  if (BEDROOM_TYPES.includes(room)) {
    // B4：個人命卦看這一宮——睡這間的人有填就用他的，沒有才以戶主暫代
    const view = personalView(env, p);
    const ownerGood = view.good;
    const mountainGood = !!m && SHENG_WANG.includes(mQi);
    // G2：長輩版——長輩房，或睡這一宮的人有長輩（年紀 ≥ 55）；小孩房照小孩版
    const elder = room === '長輩房' || (room !== '小孩房' && env.elders.includes(p));
    // 游年吉凶：主臥不在這裡算（5.2 八宅門主灶已經算過）
    if (room !== '主臥' && ynInfo) {
      if (ynInfo.luck === '吉' && e25) {
        // M3：二五宮（山向星或流年星）——八宅看是吉方，玄空看二黑五黃宜靜：不寫推薦句，列看法不同（分數照八宅加）
        const n25 = names25Of(e25);
        add('bedroom-younian-good', 0.5, `${room}在游年${yn}吉方`,
          `${ynLine('吉')}。臥室是睡覺養氣、待最久的地方，八宅看放在吉方合適。${bedYnText(yn, room, true, elder)}`
          + `此宮有${n25}，八宅與玄空看法不同。`
          + `玄空看${n25}宜靜不宜動，睡的人健康上要多留意；分數照八宅加，兩邊並列，不替你選邊。`,
          undefined, { level: '注意', differ: true });
      } else if (ynInfo.luck === '吉') {
        add('bedroom-younian-good', 0.5, `${room}在游年${yn}吉方`,
          `${ynLine('吉')}。臥室是睡覺養氣、待最久的地方，放在吉方最合適。${bedYnText(yn, room, false, elder)}`);
      } else {
        const delta = (yn === '絕命' || yn === '五鬼') ? -1.5 : -1;
        if (ownerGood || mountainGood) {
          // D7：八宅宅卦說凶，個人命卦（B4：睡這間的人，沒有才以戶主暫代）或玄空山星說吉 → 不建議換房，列「看法不同」
          const parts = [`看法不同：八宅宅卦看，${where(p)}是游年${yn}，屬凶方。`];
          if (ownerGood) parts.push(personalLine(view, p));
          if (mountainGood) parts.push(`玄空看，山星${STAR_NAMES[m]}在${env.pn}屬${mQi}（${QI_PLAIN[mQi]}），${mountainBenefit(room, elder, false)}。`);
          parts.push('幾種看法角度不同，這裡並列，分數照八宅扣，不替你選邊。');
          add('bedroom-younian-bad', delta, `${room}在游年${yn}凶方`, parts.join(''),
            `不必為此換房。${BED_HEAD_FIX}${BED_PAIR[yn] || ''}`,
            { level: '注意', differ: true, action: '床頭朝睡的人的個人吉方，不必換房' });
        } else {
          const alt = moveTargets(env, 'bed-yn', p, view.bad);
          const who = view.source === 'sleeper' ? '睡的人或戶主個人凶方' : '戶主個人凶方';
          const fix = alt
            ? `這間房可改作儲藏室或客房，臥室換到游年吉方的${alt}。不能換房時，${BED_HEAD_FIX}`
            : `其他游年吉方都不適合當臥室（大門、客廳、已有臥室、五黃二黑、九宮凶宮或${who}），不建議換房。${BED_HEAD_FIX}${BED_PAIR[yn] || ''}`;
          add('bedroom-younian-bad', delta, `${room}在游年${yn}凶方`,
            `${ynLine('凶')}。臥室是睡覺養氣、待最久的地方，人長時間受凶星影響。${bedYnText(yn, room, false, elder)}`, fix,
            { action: alt ? `把${room}換到${firstDir(alt)}（游年吉方），不換就床頭朝個人吉方` : '床頭朝睡的人的個人吉方，床靠向吉方那側' });
        }
      }
    }
    if (mountainGood) {
      add('bedroom-mountain-good', 1, `${room}山星${STAR_NAMES[m]}${mQi}`,
        `玄空飛星的山星管人丁與健康。${where(p)}的山星是${starLabel(m)}，在${env.pn}屬${mQi}（${QI_PLAIN[mQi]}）。`
        + `臥室安靜、適合休息，正好把這顆山星養住，${mountainBenefit(room, elder, true)}。`);
    }
    if (m === 5 || m === 2) {
      const bads = [{ which: '山星', star: m, qi: mQi }];
      const noMove = ownerGood || mountainGood;
      const alt = noMove ? '' : moveTargets(env, 'bed-xk', p, view.bad);
      let tail = '';
      if (ownerGood) {
        // B4：睡這間的人有填就用他的命卦；沒有才以戶主暫代
        tail = view.source === 'sleeper'
          ? `睡這間的${view.who[0].label}命卦看，這一宮是個人的${personStar(view.who[0], p)}，八宅與玄空看法不同，不必為此換房。`
          : `以戶主命卦暫代，這一宮是戶主個人的${personStar(view.who[0] || {}, p)}，八宅與玄空看法不同，不必為此換房。`;
      } else if (alt) {
        tail = `可以的話，臥室換到山星生旺的${alt}。`;
      }
      add('bedroom-mountain-2-5', -1.5, `${room}山星${STAR_NAMES[m]}臨床`,
        '玄空飛星的山星管人丁與健康。'
        + (m === 2
          ? `${where(p)}的山星是二黑，俗稱病符星，五行屬土。`
          : `${where(p)}的山星是五黃（廉貞），是飛星裡凶性最重的一顆，五行屬土。`)
        + '臥室每天要睡上好幾個小時，人長時間受這顆星影響。'
        + `傳統上認為不利健康，睡在這裡的人身體要多留意。${timelyNote(bads, env)}`,
        '床頭附近放金屬製品（銅葫蘆、六帝錢、金屬擺件），用金洩土氣。房內少用大面積的紅色、黃色，少放發熱或會震動的電器。'
        + tail, { action: '床頭附近放銅葫蘆或六帝錢，房內少放電器' });
    }
  }

  /* ---- 書房 ---- */
  if (room === '書房') {
    if (yn && STUDY_YN[yn]) {
      add('study-younian', 1, `書房在游年${yn}方`, `${ynLine('吉')}。${STUDY_YN[yn]}`);
    }
    if ((m === 1 && f === 4) || (m === 4 && f === 1)) {
      // Q2：催文昌的水種富貴竹先問 waterOk；二五宮（流年）宜靜，連木也不用，書桌保持整潔即可
      let tail;
      let act;
      if (e25) {
        tail = `不過此宮有${names25Of(e25)}，宜靜不宜動，不用水種富貴竹催文昌，書桌保持整潔、少敲打即可。`;
        act = '保持書桌整潔，這一方少敲打、少動土';
      } else if (dry) {
        tail = `書桌可以擺在這一宮，傳統做法是放文昌筆來催文昌；${dry.why}，不用水種富貴竹。`;
        act = '放文昌筆，書桌擺在這一宮、保持整潔';
      } else {
        tail = '書桌可以擺在這一宮，傳統做法是放四支水種富貴竹或文昌筆來催文昌。';
        act = '放四支水養富貴竹，書桌擺在這一宮';
      }
      add('study-1-4', 1.5, '書房一四同宮：文昌位',
        `${starsLine(c)}一白屬水、四綠屬木，四綠又是文昌星，水生木，兩星相生。`
        + `紫白訣說「四一同宮，準發科名之顯」，利讀書、考試、文書與名聲。${tail}`, undefined, { action: act });
    }
  }

  /* ---- 神明廳 ---- */
  if (room === '神明廳') {
    if (ynInfo && ynInfo.luck === '吉') {
      add('altar-younian-good', 1, `神明廳在游年${yn}吉方`,
        `${ynLine('吉')}。神位是全家精神寄託的地方，安在吉方，傳統上認為家宅較安穩。`);
    } else if (ynInfo) {
      // H1：改安的目標吉方排除山向星或流年有二黑五黃的宮（請神也是動，二五宜靜）；
      // Q7：另排除臥室類（含主臥）、廁所、廚房的宮
      const altarTo = palacesOf(env.younian, '吉').filter((q) => altarTargetOk(env, q));
      const altarDirs = altarTo.map((q) => PALACE_INFO[q].dir).join('、');
      // H3：這一宮本身是二五宮時，請神那一句由 tagBuild 補註；流年二五另提醒明年請神前擇日
      const yearTag = e25 && noBuildTag(c.y, env.period) === NO_BUILD_YEAR;
      const when = e25 ? (yearTag ? '明年請神前，依習俗擇日處理。' : '') : '移動神位前，建議依習俗擇日處理。';
      let act;
      if (!altarDirs) act = '保持神位不移，神桌整潔、背後靠實牆';
      else if (e25) act = '保持神桌整潔，香爐燭台改用銅製';
      else act = `把神位改到${PALACE_INFO[altarTo[0]].dir}方（游年吉方）安奉，背後靠實牆`;
      add('altar-younian-bad', -1.5, `神明廳在游年${yn}凶方`,
        `${ynLine('凶')}。神位講究安在吉方，落在凶方，傳統上認為家宅較不安寧。`,
        altarDirs
          ? `神位可改到游年吉方（${altarDirs}）安奉，背後靠實牆，不要靠廁所或爐灶的牆。${when}`
          : `${ALTAR_STAY}神桌保持整潔，不要靠廁所或爐灶的牆。`,
        { action: act });
    }
    const bads = badEarth(c);
    if (bads.length) {
      add('altar-star-2-5', -1, `神明廳遇${badEarthNames(bads)}`,
        `${starsLine(c)}${badEarthIntro(bads)}神明廳每天點香、點燈，五行屬火，火生土，會助長這股土氣。`
        + `傳統上認為家宅較不安寧，家人的健康也要多留意。${timelyNote(bads, env)}`,
        '香爐、燭台等供具改用銅製或金屬材質，用金洩土氣；神明燈維持原本的亮度，不另外加燈。神桌保持整潔，這一宮避免敲打施工。',
        { action: '改用銅製的香爐、燭台，神桌保持整潔' });
    }
  }

  /* ---- 魚缸 ---- */
  if (room === '魚缸') {
    // Q3：二五宮（含流年）的魚缸，每一條的 fix 都先寫「魚缸移出這一宮；移不了先關掉打氣、縮小水量」
    const out25 = `${FISH_OUT_25}。`;
    // B1：雙星同宮（山星、向星都當運）——魚缸不撤，取「先見水、水外有山」（二五、廁所之水另依下面的規則）
    const both = !!(c.mWang && c.fWang);
    // B2：這一宮不宜放水，原因是向星失令（luck）或已有廁所之水（toilet）
    const dryFish = !e25 && dry && (dry.code === 'luck' || dry.code === 'toilet') ? dry : null;
    const keepBoth = both && !e25 && !dryFish;
    const bothFlag = both ? { bothWang: true } : null;
    if (f && SHENG_WANG.includes(fQi)) {
      if (e25) {
        // Q3：向星生旺見水利財，但這一宮有二黑五黃宜靜 → 看法不同，不加分
        add('fish-facing-good', 0, `魚缸在向星${STAR_NAMES[f]}${fQi}位，但此宮有${names25Of(e25)}`,
          `玄空飛星的向星管財，喜歡見水、見動。${where(p)}的向星是${starLabel(f)}，在${env.pn}屬${fQi}，見水本來利財。`
          + `不過此宮有${names25Of(e25)}，宜靜不宜動，魚缸的水流與打氣整天在動，會去引動它。`
          + '兩種看法不同，這裡並列，這一條不加分，不替你選邊。',
          `${out25}${earth25Note(e25)}`,
          { level: '注意', differ: true, action: FISH_OUT_25_ACT, ...bothFlag });
      } else if (dryFish) {
        // B2：廁所之水（坎宮水過旺、離宮水剋火）的宮，向星生旺的魚缸不算催財 → 看法不同，不加分
        add('fish-facing-good', 0, `魚缸在向星${STAR_NAMES[f]}${fQi}位，但此宮已有廁所之水`,
          `玄空飛星的向星管財，喜歡見水、見動。${where(p)}的向星是${starLabel(f)}，在${env.pn}屬${fQi}，見水本來利財。`
          + `不過這一宮已有廁所，${TOILET_WATER[p] || '水氣已重'}，再加魚缸水氣更重。`
          + '兩種看法不同，這裡並列，這一條不加分，不替你選邊；怎麼調見「魚缸不宜見水」那一條。',
          undefined, { level: '注意', differ: true, ...bothFlag });
      } else if (both) {
        // B1：向星當運見水利財，但山星也當運、見水不利丁 → 看法不同，不加分（三優由報告處理）
        add('fish-facing-good', 0, `魚缸在向星${STAR_NAMES[f]}${fQi}位，但山星也當運`,
          `玄空飛星的向星管財，喜歡見水、見動。${where(p)}的向星是${starLabel(f)}，在${env.pn}屬${fQi}，見水本來利財。`
          + `不過這一宮的山星${STAR_NAMES[m]}也當運，山星喜靜、喜實，見水不利人丁。`
          + '兩種看法不同，傳統做法是「先見水、水外有山」，見「旺山見水」那一條；這一條不加分，不替你選邊。',
          undefined, { level: '注意', differ: true, ...bothFlag });
      } else {
        add('fish-facing-good', 1.5, `魚缸在向星${STAR_NAMES[f]}${fQi}位：見水催財`,
          `玄空飛星的向星管財，喜歡見水、見動。${where(p)}的向星是${starLabel(f)}，在${env.pn}屬${fQi}（${QI_PLAIN[fQi]}）。`
          + '魚缸是流動的活水，放在這裡等於讓生旺的向星見水，利財運。'
          + (c.mWang ? '不過這一宮的山星也當運，見水利財卻不利丁，要跟「旺山見水」那一條一起看。' : ''));
      }
    }
    if (dryFish) {
      // B2：魚缸移到能放水的生旺向星宮（targetOk('water')）；沒得移就撤，撤不了先關打氣、縮小水量
      const alt = moveTargets(env, 'water', p);
      const isLuck = dryFish.code === 'luck';
      const text = isLuck
        ? `玄空飛星的向星管財，見水、見動就會被引動。${where(p)}的向星是${starLabel(f)}，在${env.pn}屬${fQi}（${QI_PLAIN[fQi]}）。`
          + '魚缸的活水把這顆失運的向星引動起來，傳統上認為反而不利財運，容易有破耗。'
        : `${where(p)}已有廁所，${TOILET_WATER[p] || '水氣已重'}。`
          + `再放魚缸，水氣更重，${TOILET_BODY[p] || '家人健康要多留意'}。`;
      const fix = alt
        ? `魚缸移到向星生旺的${alt}；${FISH_MOVE_TAIL}。${dryFish.why}，不另加水。`
        : `這間房子沒有合適的生旺向星位可放魚缸，建議撤掉；撤不了先關掉打氣、縮小水量。${dryFish.why}，不另加水。`;
      add('fish-water-bad', isLuck ? -1 : -0.5,
        isLuck ? `魚缸不宜見水：向星${STAR_NAMES[f]}${fQi}` : `魚缸不宜見水：${p}宮已有廁所之水`,
        text, fix,
        { action: alt ? `把魚缸移到${firstDir(alt)}，${FISH_MOVE_TAIL.replace('、縮小水量', '')}` : '撤掉魚缸，撤不了先關掉打氣、縮小水量', ...bothFlag });
    }
    if (c.mWang) {
      const alt = keepBoth ? '' : moveTargets(env, 'water', p);
      let fix;
      let act;
      if (e25) {
        fix = `${out25}${alt ? `魚缸可移到向星生旺的${alt}。` : ''}原位改放靜態、厚重的櫃子。`;
        act = FISH_OUT_25_ACT;
      } else if (keepBoth) {
        // B1：雙星同宮不撤，取「先見水、水外有山」（道理寫在本文；報告的 dryText 會在放水句後面補 BOTH_WATER，這裡不重複）
        fix = `${FISH_BOTH_KEEP}。`;
        act = FISH_BOTH_ACT;
      } else if (alt) {
        fix = `把魚缸移到向星生旺的${alt}。原位改放靜態、厚重的櫃子或山石類擺件。`;
        act = `把魚缸移到${firstDir(alt)}，原位放厚重櫃子`;
      } else {
        // Q2：旺山不見水，撤不了也不改成靜水（靜水還是水），只關打氣、縮小水量
        fix = '這間房子沒有合適的生旺向星位可放魚缸，建議撤掉，原位改放靜態、厚重的櫃子或山石類擺件。'
          + '撤不了先關掉打氣、縮小水量。';
        act = '撤掉魚缸，撤不了先關掉打氣、縮小水量';
      }
      add('fish-mountain-prosperous', -2, '魚缸在當運山星位：旺山見水',
        `玄空飛星的山星管人丁與健康，喜靜、喜實，不喜見水。${where(p)}的山星是${starLabel(m)}，正是${env.pn}的當運旺星。`
        + '古訣說「山上龍神不下水」，魚缸放在這裡，等於讓旺丁星落水。'
        + '傳統上認為不利人丁與健康，家人身體要多留意。'
        + (keepBoth ? '不過這一宮的向星也當運，見水利財，傳統做法是「先見水、水外有山」，魚缸不必撤掉。' : ''),
        fix, { action: act, ...bothFlag });
    }
    const fives = badEarth(c, true);
    if (fives.length) {
      add('fish-star-5', -1, '魚缸引動五黃',
        `${starsLine(c)}五黃（廉貞）是飛星裡凶性最重的一顆，宜靜不宜動。`
        + '魚缸的水流與打氣整天在動，等於一直去引動它。'
        + `傳統上認為不利健康與家運，要多留意。${timelyNote(fives, env)}`,
        `${out25}原位保持安靜，可放銅製品或六帝錢，用金洩土氣。`,
        { action: FISH_OUT_25_ACT });
    }
  }

  /* ---- 客廳 ---- */
  if (room === '客廳' && f && SHENG_WANG.includes(fQi)) {
    add('living-facing-good', 1, `客廳向星${STAR_NAMES[f]}${fQi}`,
      `玄空飛星的向星管財，喜歡開闊、有人走動。${where(p)}的向星是${starLabel(f)}，在${env.pn}屬${fQi}（${QI_PLAIN[fQi]}）。`
      + '客廳是全家活動、人氣最旺的地方，正好把這顆財星帶動起來。');
  }

  /* ---- 樓梯、電梯遇五黃 ---- */
  if (room === '樓梯' || room === '電梯') {
    const fives = badEarth(c, true);
    if (fives.length) {
      add('stairs-star-5', -1, `${room}引動五黃`,
        `${starsLine(c)}五黃（廉貞）是飛星裡凶性最重的一顆，宜靜不宜動。`
        + `${room}每天有人上下，動得頻繁，等於一直去引動它。`
        + `傳統上認為不利健康與家運，要多留意。${timelyNote(fives, env)}`,
        `${room === '樓梯' ? '樓梯間' : '電梯口'}放銅葫蘆或六帝錢，用金洩土氣，並保持整潔。這一宮避免敲打施工。`,
        { action: `保持${room === '樓梯' ? '樓梯間' : '電梯口'}整潔，放銅葫蘆或六帝錢` });
    }
  }
}

/** 大門宮的向星旺衰：大門是進氣口，納到什麼氣 */
function evalDoor(c, env, items) {
  const { p, f, fQi } = c;
  if (!f || DOOR_QI[fQi] === undefined) return false;
  const delta = DOOR_QI[fQi];
  let tail = DOOR_QI_TEXT[fQi];
  if (f === 5 && fQi === '煞氣') {
    tail = '五黃不當運時是飛星裡凶性最重的煞星，大門每天開合會去引動它。傳統上認為不利財運與家人健康，要多留意。';
  }
  let fix;
  // Q2：門宮能不能放水（二五、山星當運、已有廁所而水過旺或水剋火、向星死氣或煞氣）
  const wb = waterBlockOf(c, env.layout[p], '門宮');
  const dryWhy = wb ? `${wb.why}，不另加水` : '';
  if (delta < 0) {
    // 先寫能照做的動作，再寫原則（LINE 化解重點抓的是第一句）
    const alt = moveTargets(env, 'live', p);
    // S5：只給這顆向星那一句；S2：二五宮不寫「明亮」（那一句已經講過明亮也不再重複）
    // Y1＋Q2：門宮不宜放水時，不叫人在門口放水，並寫理由
    const drain = doorDrainFix(f, c.e25, dryWhy);
    fix = `${drain}門口保持${c.e25 || drain.includes('明亮') ? '' : '明亮'}整潔${drain.includes('不堆雜物') ? '' : '、不堆雜物'}；`
      + '大門位置難改，重點放在化解與補強。'
      + (alt ? `客廳與常走的動線可安排在向星生旺的${alt}來補財氣。` : '');
  }
  const it = {
    palace: p,
    room: '大門',
    rule: 'door-facing-qi',
    delta,
    level: levelOf(delta),
    title: `大門納${fQi}（向星${STAR_NAMES[f]}）`,
    text: '大門是整間房子的進氣口，每天開合進出，納到什麼氣最要緊。'
      + `大門在${where(p)}，這一宮的向星是${starLabel(f)}，在${env.pn}屬${fQi}。${tail}`,
    star: f,
    qi: fQi,
    // Y1＋Q2：門宮不宜放水（waterOk 為 false）→ 報告取知識庫 byStar 時用 noWaterText，理由句見 waterWhy
    noWater: !!wb,
  };
  if (wb) it.waterWhy = dryWhy;
  if (fix) {
    it.fix = fix;
    it.action = doorAction(f, c.e25, !!wb);
  }
  items.push(it);
  return true;
}

/* ------------------------------------------------------------------ */
/* 主函式                                                               */
/* ------------------------------------------------------------------ */

/**
 * 內局評分。
 * ctx = { cells, period, rooms, doorPalace, younian, ownerLucky?, stoveMouth? }
 *   cells[宮] 至少有 { m, f, mQi, fQi, younian }，可再帶 yearStar（D4：流年二黑五黃也改用金洩）；
 *   period＝現在的運（D1，report 傳 curPeriod；cells 的 mQi／fQi 也是用這一運判的）；
 *   younian＝{ 宮: 游年星 }（cells 裡沒有時用這個）；
 *   ownerLucky＝戶主個人的 { good:[宮], bad:[宮] }（也接受 luckyDirs() 的 {palace,star} 形狀；沒傳＝不知道）；
 *   stoveMouth＝灶口朝向（八宮之一，選填）：有給時廚房的游年那一條直接講灶口要不要轉（S6）；
 *   sleepers＝每一宮睡的人（選填，B4）：evaluatePeople().people（每人 bed.palace、lucky）、同形狀的陣列
 *     [{ label, palace|bedPalace|bed:{palace}, lucky|gua }]，或 { 宮: 人|[人] }。臥室類的「看法不同」用睡這間的人的命卦判，
 *     寫「睡這間的X命卦看…」；這一宮沒有人（或沒傳）才退回戶主（ownerLucky），寫「以戶主命卦暫代」。
 *     M1：宮位收八宮與中宮；換房、床位的目標宮另排除床在原宮的所有人的個人凶方。
 *     G2：每個人可帶 age（年紀，數字）；睡這一宮的人有一位 ≥ 55（ELDER_AGE），這一宮的臥室、主臥用長輩版
 *     （不寫求子、事業衝刺、適合年輕人）；長輩房一律長輩版；小孩房照小孩版。
 *   claims＝換房、床位目標的登記表 { 目標宮: 原宮 }（選填，G1；報告的 people.claims）：臥室、床位的目標（bed-yn、bed-xk，
 *     含中宮的臥室與套房）不給登記在別的原宮名下的宮；原宮相同的照給。傳進來的物件不會被改。
 * 回傳 { score, max:20, base:14, raw, items:[{ palace, room, rule, delta, level, title, text, fix?, differ? }], warnings:[], claims }
 *   claims（G1）＝傳進來的登記＋內局這次給出去的臥室、床位目標（{ 目標宮: 原宮 }，依坎艮震巽離坤兌乾中先給先得）；
 *   報告可以把它併回自己的登記表（已有的不蓋），中宮的換房目標也就有登記。
 *   M3：二五宮（含流年）臥室類在游年吉方（bedroom-younian-good）帶 differ: true、level 注意（delta 照 +0.5），
 *   本文寫「此宮有X，八宅與玄空看法不同」，不寫推薦句。
 *   raw＝還沒夾在 0～20 之前的分數（九宮全空時是 null）
 *   door-facing-qi 那一條另帶 star（大門宮向星）、qi（旺衰），報告要找這顆星的化解時用；
 *   另帶 noWater（Y1＋Q2：門宮不宜放水，取知識庫 byStar 時用 noWaterText）與 waterWhy（不宜放水的理由句，沒有句號）。
 *   二五宮的宮位五行那幾條（kitchen-*、toilet-*）另帶 merge25: true（Y4：fix 只寫「金洩見二五那一條」）。
 *   魚缸那幾條（fish-*）在雙星同宮（山星、向星都當運）另帶 bothWang: true（B1：知識庫取 ROOM_FIX.魚缸在旺山.bothWang）。
 *   fish-water-bad（B2）：魚缸所在宮向星死氣煞氣（−1 凶）或已有廁所之水（−0.5 注意），fix「魚缸移到…；移不了先關掉打氣、縮小水量」。
 *   Q1：delta<0 或有 fix 的條目（study-1-4 文中有建議也算）都帶 action：一句 15～28 字、能照做、沒有句號的短句。
 */
export function evaluateRooms(ctx = {}) {
  const input = ctx || {};
  const cells = input.cells || {};
  const younianMap = (input.younian && typeof input.younian === 'object') ? input.younian : {};
  const period = validStar(input.period);
  const warnings = [];
  const items = [];

  const { layout, unknown, count } = normalizeRooms(input.rooms);
  // G1：換房、床位目標的登記表（複本；內局給出去的目標再登記進來，回傳給報告）
  const claims = normClaims(input.claims);
  if (unknown.length) warnings.push(`有不認得的房間代碼（${unknown.join('、')}），已略過。`);
  if (count === 0) {
    warnings.push('內局未填：九宮都沒有填房間，內局以中間值 10 分計。');
    return { score: INTERIOR_EMPTY_SCORE, max: INTERIOR_MAX, base: INTERIOR_BASE, raw: null, items, warnings, claims };
  }

  const info = {};
  for (const p of ALL_PALACES) info[p] = palaceInfo(p, cells, younianMap, period);
  const younian = {};
  for (const p of PALACES) if (info[p].yn) younian[p] = info[p].yn;

  // 大門宮由呼叫的人決定；沒給就找填了「大門」的那一宮
  const door = input.doorPalace || findPalace(layout, '大門');
  const owner = normOwner(input.ownerLucky);
  const houseGood = palacesOf(younian, '吉');
  // 宅命不配：宅的吉方跟戶主個人的吉方完全沒有交集
  const mismatch = owner.known && houseGood.length > 0 && !owner.good.some((q) => houseGood.includes(q));
  // S6：灶口朝向（選填，八宮之一）；以宅的游年判吉凶（D5）
  let mouth = null;
  if (PALACES.includes(input.stoveMouth) && younian[input.stoveMouth]) {
    const star = younian[input.stoveMouth];
    mouth = { palace: input.stoveMouth, star, ok: YOUNIAN[star].luck === '吉' };
  }
  const env = {
    layout, info, younian, period, pn: periodName(period),
    door: PALACES.includes(door) ? door : null, owner, mismatch, mouth,
    // B4：每一宮睡的人（臥室類看法不同用他自己的命卦）；沒傳＝都不知道，退回戶主
    sleepers: normSleepers(input.sleepers),
    // G2：睡的人有長輩（年紀 ≥ 55）的宮
    elders: elderPalaces(input.sleepers),
    // G1：登記表（moveTargets 會往裡面登記）
    claims,
  };

  if (!PALACES.some((p) => info[p].yn)) warnings.push('沒有八宅游年星的資料，游年相關的規則沒有計分。');
  if (!ALL_PALACES.some((p) => info[p].m || info[p].f)) warnings.push('沒有飛星盤的資料，山星向星相關的規則沒有計分。');

  // 只能有一處的房間填了不只一宮：照樣逐宮計分，但提醒一下
  for (const key of ROOM_KEYS) {
    if (!ROOM_TYPES[key].single) continue;
    const n = ALL_PALACES.filter((p) => layout[p].includes(key)).length;
    if (n > 1) warnings.push(`「${key}」填了 ${n} 宮，每一宮都各自計分；跨兩宮時建議只填主要的那一宮。`);
  }

  // 大門宮的向星旺衰
  if (door === '中') {
    warnings.push('大門填在中宮，無法判斷大門納到哪一方的氣，這一條沒有計分；請改填大門實際所在的方位。');
  } else if (door && info[door]) {
    if (!evalDoor(info[door], env, items)) warnings.push('大門宮沒有向星資料，大門納氣這一條沒有計分。');
  } else {
    warnings.push('沒有指定大門在哪一宮，大門納氣這一條沒有計分。');
  }

  for (const p of ALL_PALACES) {
    for (const room of layout[p]) evalRoom(room, info[p], env, items);
  }

  // 同一處（同宮同房間）又有加分又有扣分：八宅、玄空、宮位五行看的角度不同，兩邊都列、不選邊（合約第 8 節第 7 點）
  const groups = new Map();
  for (const it of items) {
    const key = `${it.palace}|${it.room}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  for (const list of groups.values()) {
    if (!list.some((it) => it.delta > 0) || !list.some((it) => it.delta < 0)) continue;
    for (const it of list) {
      // M3：已經寫明「看法不同」的那一條（differ）不再重複補這一句
      if (it.delta > 0 && !it.differ && !it.text.includes('一起看')) it.text += BOTH_SIDES_NOTE;
    }
  }

  // H3：二五宮（山向星或流年星）宜靜：fix 裡要動工的句子補註（流年二五「今年忌動土」、只有山向星二五「先擇日」；
  // Y3：兩種都有用合併註記 NO_BUILD_BOTH）
  for (const it of items) {
    const i = info[it.palace];
    if (it.fix && i && i.e25) it.fix = tagBuild(it.fix, noBuildTag(i.y, period, fly25(i)));
    // Y4：二五宮的宮位五行那一條只寫「金洩見二五那一條」，報告要跟二五那一條合併
    if (i && i.e25 && PALACE_WX_RULES.has(it.rule)) it.merge25 = true;
    // Q1：會扣分或給建議的條目都帶 action（宮位五行那幾條依二五與否；其他在 evalRoom 已經給了）
    if (it.delta < 0 || it.fix) {
      if (!it.action && PALACE_WX_RULES.has(it.rule)) it.action = palaceWxAction(it.rule, i && i.e25);
      if (!it.action) it.action = i && i.e25 ? ACTION_FALLBACK.calm : ACTION_FALLBACK.plain;
    }
  }

  const raw = INTERIOR_BASE + items.reduce((a, it) => a + it.delta, 0);
  return {
    score: round1(clamp(raw, 0, INTERIOR_MAX)),
    max: INTERIOR_MAX,
    base: INTERIOR_BASE,
    raw: round1(raw),
    items,
    warnings,
    // G1：依坎艮震巽離坤兌乾排好（重跑、比對時順序固定）
    claims: normClaims(claims),
  };
}
