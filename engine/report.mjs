// 報告整合（施工合約第 3、5.1、5.2、6、8、11 節）：analyze(input) → 一份完整的陽宅堪輿報告
//
// 流程：正規化輸入 → 坐向與元運 → 玄空（下卦＋替卦，盤運與現運分開）→ 八宅門主灶 → 流年流月 → 居住者
//       → 九宮合併 → 內局／外局／樓層 → 分數與等第 → 三優三注意 → 各段落 → 化解清單 → LINE 文字。
// 原則：
//   - analyze 不丟例外：欄位缺就用預設並寫進 warnings；真的出錯也回傳完整形狀（多一個 error 欄位）。
//   - 不用 Date：今天的日期由呼叫的人放在 input.date；沒帶就略過流年段並寫 warning。
//   - 合約 11 節 D1：飛星盤依入住（或大修）那一運起（天心不換）；星的旺衰、當運山向星、零正神一律用
//     現在的運 curPeriod（由 date 的節氣年推；沒有 date 用盤運）。交運時格局分用 periodFit(盤, 現運)。
//   - 用語：八宅的游年星寫「游年生氣」，玄空的生氣寫「生氣（下一運之星）」；九星一律用主名（一白…），
//     別名（貪狼…）只當副稱。宮位白話一律取 kb/stars.mjs 的 PALACE_TEXT。專有名詞第一次出現補一句白話（GLOSS）。
//   - 文字照合約第 8 節：不寫保證式的話、不做醫療生死斷言、不勸買勸賣、凶的盡量附 fix、派別衝突兩邊都列。
//   - 10/04 收尾 R1～R22：入住年在未來不論交運（compass.futureMoveIn）；九宮卡二五宮只用金；樓層色系掛到玄關／主臥那一宮；
//     同一宮門墊顏色只留一條、「少用 X」與另一條的 X 不並存；門上起伏位 cells.doorYounian；倒騎龍相反的化解標 conflict、
//     不進 LINE；三優三注意的「看法不同」只標在不同派別之間；LINE 入住年另起一行（report.periodNote）。
//   - 10/04 最後一輪 T1～T21：二五宮不用會響的金（NOISY_25）、不寫宜動／見水／明亮／做臥室；下水上山先看向宮坐宮；
//     換房排除凶宮與死煞山星；入囚的中宮卡以開闊為先；大門化解用 byStar；同宮相剋只在「別條」時說明、整條被拿光就併入；
//     二五宮的動作不動工（T15）；九宮卡與化解清單不互剋；元運年份依入住年所在的 180 年循環；化解細項相似的只留完整的一句。
//   - 10/04 G0～G9：build 最後跑一致性閘門 consistencyGate（依宮位收集各段建議句：二五宜靜、同宮不互剋、動作可照做，
//     違規的「改寫」不只報錯）；auditReport(report) 用同一套規則列出違規（測試與 smoke 掃描用）。
//     G1 指定元運時年份取離參考年最近的一輪；G3 格局段遇二五寫「（此宮有X，宜靜，見九宮卡）」；G4 入囚中宮拆兩句、輕量金；
//     G5 大門填在中宮 doorSource＝'中宮'；G6 以「時」結尾的條件子句不當名詞片段；G8 吉宮九宮卡的建議也過條件句與同宮比對。
//   - 10/04 X1～X10：
//     X1 「把房間／床位／動線移到哪一宮」統一用 pickTargets(kind, ctx)（排除規則一份，內局 rooms.mjs 的 targetOk 一起看）；
//        主臥換房、居住者移床（people.mjs 收 bedPlan）、內局與化解清單的換房動線魚缸、格局段上山下水都用它；
//        床位所在宮是宅卦吉方或現運山星生旺時不寫移床，改「看法不同」只給床頭。閘門再掃一次，不在名單的目標改寫。
//     X2 二五宮（含流年）的化解收成一條：標題「此宮有五黃（流年）、另有…」，只用金、宜靜；原本的問題寫「另有X：以…為主」。
//     X3 LINE 化解重點與三優同一宮、或內局外局有看法不同的條目 → 行尾補「（看法不同）」。
//     X4 動土提醒：退路句（不能移時…）不貼、「X避開這一宮」不算施工、流年與山向星都有二五用合併註記。
//     X5 閘門規則 2 改家族層級（肯定家族對上別條的否定家族也算衝突；刪五行做法時原理句與殘句一起刪；不指向自己）。
//     X6 併條時接手那一條的做法會生旺被併問題的凶源，就不併，改寫「這一項暫無不相剋的做法，先以…為主」。
//     X7 大門納衰氣的通用句改成點名宮位（pickTargets('living')），沒有就拿掉。X8 「大門在此」這類條件句依房間判斷。
//     X9 入囚中宮有二五時不寫「有水」「明亮」。X10 auditReport 加 X1、X2、X3、X5 的檢查。
//   - 10/04 Z1～Z8：
//     Z1 化解清單粗體動作與 LINE 化解重點的動作改查 ACTIONS 表（key＝規則代碼，value＝(a)=>短句，依二五、山星當運、
//        能不能放水、房間給不同版本）；規則條目自己帶 action 的優先。表沒有才退回從句子挑（concreteOf），而且退路結果
//        要以白名單動詞開頭（ACTION_LEAD_RE），不然改用通用動作。閘門加：動作不得「放」接非物品、不含「的話」「當運」、
//        不以「時」結尾、不超過 30 字（動土提醒的括號不算）。
//     Z2 放水統一看 waterOk(宮, 報告)：二五（含流年）、山星當運、已有廁所又水過旺／水剋火、九宮凶且向星失令 → 不放水，
//        各段的放水句改成不放水的版本並補一句理由（WATER_WHY）；閘門加「不能放水的宮不得有肯定的放水句」。
//     Z3 positiveHit 也看關鍵字後面（同子句接移開、移走、撤掉、拿掉、收起、移出、關掉＝否定）；二五宮的魚缸那一句保留，
//        合併後的二五化解提到魚缸；向星生旺的魚缸落在二五宮不算優點、標看法不同。
//     Z4 主臥的換房計畫（bedOptions 的 targets／swaps）也交給居住者 bedPlan：戶主床在主臥時兩段同一套；
//        auditReport 加「同一人同一宮不能同時對調／換到與不建議移床」。
//     Z5 pickTargets 加 altar（排除臥室類、廁所、廚房、二五）；kind＝bed 而睡的是小孩（或小孩房）時排除 COMBOS[組合].kidBad 的宮；
//        X1 的移動目標也認「改到」「神位」。
//     Z6 朱雀逼壓那一條的做法同時歸到大門宮檢查。Z7 理氣＝玄空（看法不同的派別比對）；LINE 三注意同宮在三優、
//        標了看法不同的化解重點、或看法不同清單裡也標。Z8 中宮（任一宮）有二五時九宮卡的宮位白話不寫「明亮」。
//   - 10/04 A1～A11：
//     A1 concreteOf 只在名詞片段以物品結尾（PUT_ITEM_RE）時補「放」；片段含生、旺、建議、明年、前、的話、當運、撤掉 → 丟掉
//        （改走查表或通用動作）；actionLint 另擋「放」後面接這些字、句中有「若」「如果」的條件句。二五宮神位那一行用內局的 action。
//     A2 「主臥與 X 方的 Y 對調」：X 方那間的人搬進主臥原宮也要過 targetBlock('bed')（kidBad、二五含流年、九宮凶、
//        那個人的個人凶方）；不合格就不列對調，改床頭床位做法。auditReport 加這一條（swapAudit）。
//     A3 交給內局的 ctx 帶 sleepers（people.mjs 的 sleepersOf：每一宮睡的人與他的個人吉凶方）；
//        auditReport 加「居住者段與內局段同一個人同一宮不能一吉一凶」（sleeperAudit）。
//     A4 動作查表加同宮檢查：該宮有 kitchen-wood／kitchen-li／kitchen-dui、大門游年五鬼、或別條「少用紅色」這類否定火的條目 →
//        火的動作改不加火的版本（a.noFire）；一般化：動作的五行若是同宮別條否定的家族，改用不相剋的備案或通用動作。
//     A5 dryOne 判斷放水前先把「…」裡的字換成佔位符（引用別條化解的名稱不是放水句）；閘門規則 5 同一把尺。
//     A6 waterOk：山星當運但向星也當運（雙星同宮）不擋水，放水句補「先見水、水外有山」（BOTH_WATER）。
//     A7 cellLuck：兩星都失令（不是兩顆死煞）寫「兩星都失令（衰、退），凶性較輕」；waterOk 的凶宮改看向星是不是死氣或煞氣。
//     A8 大門：門宮向星失令時，八宅門的做法排除會生旺那顆向星的五行，也排除跟玄空門宮做法相剋的五行；
//        排除到八宅那一條的五行時，兩條都列並標「看法不同」，八宅那一條改不帶五行的做法，玄空那一條照列（不寫「先不用」）。
//     A9 ACTIONS.stove 帶方位（灶座凶方、灶口吉方）；大門那一條的退路不收灶口、床頭、床位的句子。
//     A10 LINE 的行頭沒有「X方・」、宮名寫在標題裡（「廚房在乾宮，火燒天門」）的行也認得宮位（dirPalaceOf）。
//     A11 evaluateExterior 也收 rooms（零神見山、旺向見山的放水判斷看廁所），exterior 的 item.action 本身就對。
//   - 10/04 L1～L6：
//     L1 爐灶移位的目標統一用 stoveTargets(src)：宅卦凶方依凶度（絕命、五鬼、六煞、禍害）依序挑，排除山向星有二五的宮
//        （不含流年）、有臥室類（或有人睡）的宮、大門宮、神明廳宮、中宮、廁所宮；只因流年二五的宮可以列，但寫明
//        「今年此方忌動土，明年再做」。ACTIONS.stove、八宅段、化解清單、LINE 都點名方位；全部排除時不叫人移爐，
//        只寫灶口轉向（或保持朝向）游年吉方並點名方位。auditReport 加 stoveAudit。
//     L2 移床、換房的「睡的人」＝床在那一宮的所有人（同床的配偶也算；whoOf 合併 opt.who 與 sleepersAt）；
//        個人吉方能去的宮都落在同床者的個人凶方時不寫移床，改「看法不同」只調床頭。同一份報告的移床、換房目標
//        先登記（people.claims＝{ 目標宮: 原宮 }），一宮只分給一間房（主臥 → 居住者 → 內局臥室的順序）。
//        auditReport 加「兩間臥室換進同一宮」「同床者移到凶方」（moveAudit）。
//     L3 二五宮（含流年）又有臥室類或有人睡：知識庫的「不宜久坐、久睡」（avoidStay）改寫成「床頭附近放銅葫蘆、
//        房內保持安靜」；同宮評吉的床位、臥室文字（八宅主臥、內局、居住者）不寫推薦句（身體較弱的人尤其合適、
//        也利求子…），補「此宮有X，八宅與玄空看法不同」。auditReport 加 bed25Audit。
//     L4 dirPalaceOf：行頭（去掉序號）是「東北／東南／西北／西南／東／西／南／北方」就取那一宮（「②東方見路沖」）。
//     L5 小孩的床位、床頭用小孩版（people.mjs）。L6 同一條裡同一句重複的只留一次（替卦推法、閘門），auditReport 加 dupAudit。
//   - 10/04 F1～F4：
//     F1 stoveBlock／stoveTargets 再排除現運當運向星的宮、當運山星的宮、乾宮（火燒天門）；兌宮（火剋金）、坎宮（水火相沖）
//        不排除，目標後加「此方另有火剋金（水火相沖），兩派看法不同」（STOVE_PALACE_NOTE）；stoveAudit 同步檢查。
//     F2 LINE 改由 lineCompose 產生，同時回三優三注意標好「看法不同」的版本，放在 highlights.marked（畫面用同一份，
//        refreshLine 每次重產 LINE 都更新）；auditReport 加 markAudit。二五宮的八宅主臥評吉 level 改「注意」、不進三優。
//     F3 長輩版床位床頭在 people.mjs；people.sleepers 帶 age 給內局判長輩版。
//     F4 claim() 與 moveAudit 的原宮收中宮；內局中宮那幾條（含中宮臥室）的換房目標也走 fitMoves／claims（moveChecked）。
// 純 ES module，瀏覽器與 Node 都能 import；不用 node: 模組、不用 DOM。

import {
  ALL_PALACES, PALACES, PALACE_INFO, PALACE_BY_LUO, MOUNT_YINYANG, MOUNT_PALACE,
  describeFacing, norm, palaceFromDir,
} from './compass.mjs?v=981ddbf2';
import { solarYearByLichun, solarMonthIndex, JIE_ORDER } from './ming.mjs?v=981ddbf2';
import {
  houseGua, younianStars, YOUNIAN, luckyDirs, evaluateDoor, evaluateMaster, evaluateStove,
} from './bazhai.mjs?v=981ddbf2';
import {
  periodOf, periodRange, PERIOD_NAMES, chart, periodFit, cellsFor, PRISON_TEXT, PATTERN_INFO, qiOf, QI_ORDER,
  yearStar, yearChart, monthStar, monthChart, taisui, STAR_NAMES, STAR_ALIAS,
} from './xuankong.mjs?v=981ddbf2';
import { ROOM_TYPES, findPalace, evaluateRooms } from './rooms.mjs?v=981ddbf2';
// X1／X4：內局平行施工中的新匯出（targetOk、NO_BUILD_BOTH、FALLBACK_RE）有就用，沒有用這支自己的
import * as RM from './rooms.mjs?v=981ddbf2';
import { EXT_TYPES, BEASTS, beastPalaces, evaluateExterior } from './exterior.mjs?v=981ddbf2';
import { evaluateFloor } from './floor.mjs?v=981ddbf2';
import { evaluatePeople, sleepersOf as sleepersMap, BED_25_FIX, ELDER_AGE } from './people.mjs?v=981ddbf2';
import { SHENG, WX_COLOR, STAR_WX, supporter } from './wuxing.mjs?v=981ddbf2';
import { PALACE_TEXT, YOUNIAN_TEXT } from '../kb/stars.mjs?v=981ddbf2';
import { COMBOS, comboOf } from '../kb/combos.mjs?v=981ddbf2';
import * as REM from '../kb/remedies.mjs?v=981ddbf2';

// 知識庫（K3 平行施工中）：with25、byPalace、forDoor、AVOID_25、WITH25 有就用，沒有就退回舊做法
const { STAR_REMEDY, YOUNIAN_REMEDY, ROOM_FIX, GENERAL_NOTES } = REM;
const KB_AVOID_25 = Array.isArray(REM.AVOID_25) ? REM.AVOID_25 : [];
const KB_WITH25 = REM.WITH25 && Array.isArray(REM.WITH25.items) ? REM.WITH25 : null;
// T1：二黑五黃宜靜，會響會動的金（風鈴、銅鈴、鈴鐺…）也不用；知識庫有 NOISY_25 就一併採用
const NOISY_25 = uniqList(['風鈴', '銅鈴', '鈴鐺', ...(Array.isArray(REM.NOISY_25) ? REM.NOISY_25 : [])]);
function uniqList(arr) { return [...new Set(arr.filter((w) => typeof w === 'string' && w))]; }

/* ------------------------------------------------------------------ */
/* 常數                                                                 */
/* ------------------------------------------------------------------ */

export const SECTION_IDS = [
  'orientation', 'pattern', 'bazhai', 'palaces', 'interior', 'exterior',
  'floor', 'people', 'annual', 'remedies', 'method',
];

export const SECTION_TITLES = {
  orientation: '坐向與元運',
  pattern: '玄空格局',
  bazhai: '八宅門主灶',
  palaces: '九宮逐宮',
  interior: '內局',
  exterior: '外局',
  floor: '樓層',
  people: '居住者',
  annual: '流年流月',
  remedies: '化解',
  method: '門派與限制',
};

const SECTION_INTRO = {
  orientation: '這一段確認房子的坐向、用哪一個元運起盤，以及八宅的宅卦。',
  pattern: '這一段看沈氏玄空的飛星盤：山星管人丁健康，向星管財，看當運的星落在哪裡。',
  bazhai: '這一段看八宅派的門、主、灶：大門、主臥、爐灶各落在哪一顆游年星。',
  palaces: '這一段逐宮看：八宅游年星、玄空山向星的組合與旺衰，以及這一宮現在放了什麼。',
  interior: '這一段看屋內的房間配置：廁所廚房的水火、臥室書房的位置，對照游年星與山向星。',
  exterior: '這一段看屋外形勢：前朱雀、後玄武、左青龍、右白虎，再對照零正神、當運山向星與形煞。',
  floor: '這一段用河圖數看樓層的五行，跟戶主命卦（沒有就用宅卦）論生剋。',
  people: '這一段看每位居住者的命卦、東西四命、跟宅配不配，以及床位與床頭。',
  annual: '這一段看今年與本月的流年流月飛星，以及太歲、歲破、三煞；流年每年立春換位。',
  remedies: '這一段把前面各段的凶項依宮位整理成化解清單，同樣的做法只列一次。',
  method: '這一段說明本報告用了哪些方法、分數怎麼來，以及使用上的限制。',
};

/** 等第（合約第 5 節）：grade 是短稱，label 是畫面上的全稱，text 是一句白話 */
export const GRADES = [
  { min: 85, grade: '上吉', label: '上吉', text: '格局整體很好，把吉方用好、維持現況即可。' },
  { min: 70, grade: '吉', label: '吉', text: '格局整體不錯，針對幾個注意項目稍作調整即可。' },
  { min: 55, grade: '中平', label: '中平', text: '吉凶參半，照化解清單逐項調整，可以改善不少。' },
  { min: 40, grade: '欠佳', label: '欠佳（宜化解）', text: '凶項偏多，宜依化解清單逐項處理。' },
  { min: 0, grade: '凶', label: '凶（須大幅調整）', text: '凶項多且重，須大幅調整格局與動線，再依化解清單逐項處理。' },
];

/** D11：九宮凶宮有 3 個以上時，總評改寫成這一句（n＝凶宮數） */
const GRADE_WARN = {
  上吉: (n) => `格局整體很好，但有 ${n} 個方位要注意，見九宮逐宮與化解清單。`,
  吉: (n) => `格局整體不錯，但有 ${n} 個方位要注意，見九宮逐宮與化解清單。`,
  中平: (n) => `吉凶參半，而且有 ${n} 個方位要注意，照化解清單逐項調整。`,
  欠佳: (n) => `凶項偏多，而且有 ${n} 個方位要注意，宜依化解清單逐項處理。`,
  凶: (n) => `凶項多且重，有 ${n} 個方位要注意，須大幅調整格局與動線。`,
};

/** R18：「欠佳」時先處理哪一塊——依五項分數比例最低的那一項；八宅門主灶要真的有凶項才講大門、主臥、爐灶 */
const PART_FOCUS = {
  xuankong: '宜先看玄空格局的化解（當運山星、向星所在的宮與中宮）',
  interior: '宜優先調整屋內的房間配置（廁所、廚房、臥室）',
  exterior: '宜優先處理屋外的形煞與四獸',
  floorPeople: '宜優先調整床位、床頭與樓層的色系',
};
function gradeFocus(parts, bz, xk = {}) {
  const sorted = [...parts].filter((p) => p.max > 0).sort((a, b) => a.score / a.max - b.score / b.max);
  for (const p of sorted) {
    // T19：玄空最低時先看是什麼拖低的——騎線先重量度數；伏吟反吟佔大半是盤局結構，先處理各宮二五
    if (p.id === 'xuankong') {
      if (xk.kongwang) return '宜先重量大門度數（向度騎線）';
      // 「扣分」指分數明細裡的減項（入囚、伏吟反吟、空亡）；格局基本分本身不算扣分
      const xp = Array.isArray(xk.parts) ? xk.parts.slice(1) : [];
      const loss = xp.filter((x) => x.delta < 0).reduce((a, x) => a - x.delta, 0);
      const fy = xp.filter((x) => /伏吟|反吟/.test(x.label) && x.delta < 0).reduce((a, x) => a - x.delta, 0);
      if (fy > 0 && fy * 2 > loss) return '玄空格局屬盤局結構，宜先處理各宮二五';
    }
    if (p.id === 'bazhai') {
      const bad = [];
      if (bz.door && YOUNIAN[bz.door.star] && YOUNIAN[bz.door.star].luck === '凶') bad.push('大門');
      if (bz.master && YOUNIAN[bz.master.star] && YOUNIAN[bz.master.star].luck === '凶' && !bz.masterView) bad.push('主臥');
      if (bz.stove && (!bz.stove.sitOk || (bz.stove.mouth && !bz.stove.mouth.ok))) bad.push('爐灶');
      if (!bad.length) continue;
      return `宜優先處理${bad.length > 1 ? `${bad.slice(0, -1).join('、')}與${bad[bad.length - 1]}` : bad[0]}`;
    }
    if (PART_FOCUS[p.id]) return PART_FOCUS[p.id];
  }
  return '宜依化解清單逐項處理';
}

/** D11：總分條下面固定的一句 */
export const SCORE_NOTE = '九宮逐宮吉凶另列，不計入總分。';

export const FINAL_LINE = '※ 風水分析僅供參考，不作為買賣或投資依據。';

/** G5：大門填在中宮時的說法（報告、warning、LINE 共用）；九宮沒填大門另一種說法 */
export const DOOR_CENTER_NOTE = '大門填在中宮無法定方位，以向宮計';
const DOOR_NONE_NOTE = '九宮裡沒有填大門，大門宮暫以向宮計';
/** 這份輸入的大門是不是「以向宮計」（沒填，或填在中宮） */
const doorByFacing = (input) => !!input && (input.doorSource === '向宮' || input.doorSource === '中宮');

/**
 * D9：專有名詞第一次出現時補的一句白話（依序找；match 任一個字詞出現就算出現）。
 * 報告的 sections 由上往下找第一個出現的地方，在那一句後面補上 text。
 */
export const GLOSS = [
  { key: '宅卦', match: ['宅卦'], text: '宅卦是依坐山（或大門）定出這間房子屬八卦的哪一卦。' },
  { key: '伏位', match: ['伏位'], text: '伏位是宅卦本身那一方，八宅從這裡起算。' },
  { key: '游年', match: ['游年'], text: '游年是八宅把八個方位排成四吉四凶，各配一顆星。' },
  { key: '命卦', match: ['命卦'], text: '命卦是依出生年與性別算出的個人卦，用來看個人的吉凶方。' },
  { key: '下卦', match: ['下卦'], text: '下卦是向度在山的中線附近時，照運盤原本的星起盤。' },
  { key: '替卦', match: ['替卦'], text: '替卦是向度偏離山的中線較多時，改用替星起盤的方法。' },
  { key: '四獸', match: ['四獸', '朱雀', '玄武', '青龍', '白虎'], text: '四獸是面朝門外看：前朱雀、後玄武、左青龍、右白虎。' },
  { key: '零正神', match: ['零神', '正神'], text: '正神是當運數所在的方位，宜見山；零神在它的對面，宜見水。' },
  { key: '入囚', match: ['入囚'], text: '入囚是當運的星飛進中宮，被困住、發揮不出來。' },
  { key: '換天心', match: ['換天心'], text: '換天心是大修、換大門或翻新屋頂，讓新運之氣進來，改用新運起盤。' },
];

/** LINE 文字裡的術語短註（第一次出現時加括號） */
const LINE_GLOSS = [
  { re: /游年(生氣|天醫|延年|伏位|禍害|六煞|五鬼|絕命)/, note: '（八宅的吉凶方位星）' },
  { re: /替卦盤/, note: '（兼向用的起盤法）' },
  { re: /下卦盤/, note: '（正向用的起盤法）' },
  { re: /入囚/, note: '（當運星飛進中宮被困住）' },
  { re: /換天心/, note: '（大修換氣改用新運）' },
  { re: /灶壓凶方」?/, note: '（爐灶放凶方把凶氣壓住）' },
  { re: /二五交加/, note: '（病符星與五黃同宮）' },
  { re: /伏吟/, note: '（盤局重複，事多反覆）' },
  { re: /反吟/, note: '（盤局對沖，事多反覆）' },
  { re: /倒騎龍/, note: '（坐後見水、向前見山）' },
  { re: /零神(?:方)?(?:見山|見水|見路|下水)?/, note: '（零神＝當運宜見水的方位）' },
  { re: /正神(?:方)?(?:見山|見水|見路|下水)?/, note: '（正神＝當運宜見山的方位）' },
];

const PERSON_MAX = 6;
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
const BRANCH_MONTH = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const YUAN_NAME = { 地: '地元龍', 天: '天元龍', 人: '人元龍' };
const ROOM_KEYS = Object.keys(ROOM_TYPES);
const EXT_KEYS = Object.keys(EXT_TYPES);
const LINE_MAX = 60;

// 替卦口訣（坤壬乙訣），key＝替星
const TI_VERSE = {
  1: '子癸並甲申，貪狼一路行',
  2: '壬卯乙未坤，五位是巨門',
  6: '乾亥辰巽巳，連戌武曲名',
  7: '酉辛丑艮丙，天星說破軍',
  9: '寅午庚丁上，右弼四星臨',
};

const NINE_NOTE = '九紫趕吉助凶，遇凶星同宮會助其凶。';
/** G8：吉宮九宮卡的建議放在本文最後，以這個字頭開始（閘門以它到結尾為建議句） */
const CARD_ADVICE = '建議：';

const PATTERN_LEVEL = {
  旺山旺向: '吉', 雙星會向: '吉', 雙星會坐: '平', 到山不到向: '平', 到向不到山: '平',
  上山下水: '凶', 上山: '凶', 下水: '凶', 令星不到: '平', 其他: '平',
};
const PATTERN_HL = {
  旺山旺向: { delta: 3, text: '玄空格局是旺山旺向，丁財兩旺的上格' },
  雙星會向: { delta: 1.5, text: '玄空格局是雙星會向，利財' },
  雙星會坐: { delta: 1, text: '玄空格局是雙星會坐，利人丁健康' },
  到山不到向: { delta: 0.5, text: '玄空格局是到山不到向，利人丁健康' },
  到向不到山: { delta: 0.5, text: '玄空格局是到向不到山，利財' },
  上山下水: { delta: -3, text: '玄空格局是上山下水，傳統認為丁財兩失，宜靠形勢與擺設補救' },
  下水: { delta: -2, text: '玄空格局是下水（當運山星到向方），傳統認為不利人丁' },
  上山: { delta: -2, text: '玄空格局是上山（當運向星到坐方），傳統認為不利財運' },
  令星不到: { delta: 0, text: '' },
  其他: { delta: 0, text: '' },
};
const PATTERN_FIX = {
  上山下水: '屋內把臥室放在當運山星所在的宮，大門、客廳放在當運向星所在的宮。屋外坐方見水、向方見山（倒騎龍的形勢）可反為吉用。',
  下水: '臥室、床位放在當運山星所在的向方，背靠實牆。向方屋外有高樓或山，可以接住山星。',
  上山: '坐方多開窗、保持通透，可作客廳或常走的動線。坐後屋外有水或開闊空地，可以接住向星。',
  雙星會坐: '坐方宜「先見水、水外有山」：屋外坐方見水、水外有高樓最佳。屋內坐方可常開門窗或作客廳，背靠實牆。',
  雙星會向: '向方宜「先見水、水後有山」：門前開闊或有水，遠處有高樓。屋內向方作客廳、玄關，保持明亮。',
};
const PATTERN_ACTION = {
  上山下水: '臥室放在當運山星宮，大門、客廳用當運向星宮',
  下水: '臥室與床位放在向方，背靠實牆',
  上山: '坐方多開窗、保持通透，作客廳或常走的動線',
};
// T3／G4：拆成三句，中宮有二黑五黃時只拿掉「宜明亮通風。」那一句；挑高、天井那一句補動土提醒（prisonFixOf）
const PRISON_FIX = '中宮保持開闊、少堆雜物。宜明亮通風。能做挑高、天井或開放空間，傳統認為可以「囚不住」。';
const PRISON_ACTION = '中宮保持開闊、不堆雜物';
// T5：令星入囚時中宮九宮卡的第一句
const PRISON_CARD_NOTE = '此宮令星入囚，以開闊為先，見格局段。';
// T5：入囚又有二黑五黃時，金洩只放一點，不堆厚重擺件
const METAL_LIGHT = '放一組六帝錢或小銅葫蘆即可，量不必多。';
const FUYIN_FIX = '這是盤局本身的結構，擺設只能減輕。五黃、二黑所到的宮位少動土，各宮依星的五行洩化。';
const KONG_FIX = '先遠離鐵門、電器與磁鐵，換兩三個位置重量一次。確定騎線時，傳統做法是微調大門或玄關的角度，讓向度回到一山之內。';
const KONG_ACTION = '遠離鐵門與電器，換兩三個位置重量一次';
const DAOQI = {
  上山下水: {
    text: '本宅外局坐方見水、向方見山，已是倒騎龍形勢，可反為吉用。',
    hl: '玄空上山下水，但外局坐水向山已是倒騎龍形勢，可反為吉用',
    line: '外局坐方見水、向方見山，已是倒騎龍形勢，可反為吉用',
  },
  下水: {
    text: '本宅向方屋外有高樓或山，可以接住跑到向方的山星，反而能用。',
    hl: '玄空下水，但向方屋外有高樓或山接住山星，反而能用',
    line: '向方屋外有高樓或山接住山星，下水反而能用',
  },
  上山: {
    text: '本宅坐方屋外有水或開闊空地，可以接住跑到坐方的向星，反而能用。',
    hl: '玄空上山，但坐方屋外有水或空地接住向星，反而能用',
    line: '坐方屋外有水或空地接住向星，上山反而能用',
  },
};

const ANNUAL_BAD = {
  5: { level: '凶', what: '五黃是災病星，所到之方宜靜不宜動，當年忌動土、敲打、裝修。' },
  2: { level: '凶', what: '二黑是病符星，所到之方要留意健康與小病，宜靜、宜用金洩。' },
  3: { level: '注意', what: '三碧是是非星，所到之方易有口角爭執與官非，宜安靜、用火性物品洩。' },
  7: { level: '注意', what: '七赤是破軍星，所到之方要留意破財、失竊與口舌，宜用靜水洩。' },
};
// R1：三碧、七赤落到有二黑五黃的宮時，本文拿掉「用火／用靜水洩」那半句（後面另接「此宮已有…只用金、宜靜」）
const ANNUAL_BAD_25 = {
  3: '三碧是是非星，所到之方易有口角爭執與官非。',
  7: '七赤是破軍星，所到之方要留意破財、失竊與口舌。',
};
// 紫白訣：一白、六白、八白（三白）加九紫為吉；四綠另列文昌
const ANNUAL_GOOD = { 9: '喜慶、名聲', 1: '人緣、智慧與升遷', 8: '置產、財運', 6: '權位、貴人與正財', 4: '文昌、讀書考試' };
const ANNUAL_GOOD_ON25 = {
  9: '九紫屬火，火生土，會助長二黑、五黃。',
  8: '八白屬土，跟二黑、五黃的土氣相疊，凶星更旺。',
  1: '一白屬水，被土星所剋，吉力難以發揮。',
  6: '六白屬金，雖能洩土氣，這一方仍宜靜不宜動。',
  4: '四綠屬木，木剋土反而激起凶性，不宜硬用。',
};
const ANNUAL_ON25_FIX = '這一方今年少動、少敲打，不必刻意加強使用。放銅葫蘆或六帝錢，用金洩土氣。';

// 內局規則 → 化解知識庫（ROOM_FIX 的 key）
const RULE_ROOM_FIX = {
  'kitchen-qian': '火燒天門',
  'kitchen-kan': '水火相沖',
  'kitchen-center': '中宮廚房',
  'toilet-center': '中宮廁所',
  'stairs-center': '穿心樓梯',
  'bedroom-younian-bad': '臥室在凶方',
  'bedroom-mountain-2-5': '臥室逢五黃二黑',
  'door-facing-qi': '大門納衰氣',
  'fish-mountain-prosperous': '魚缸在旺山',
};
// 只有八宅「壓吉」那一條對到 ROOM_FIX 的廁所壓吉／廚房壓吉；壓到當運山向星是玄空的事，用規則自己的 fix
const WETFIRE_RULES = ['wetfire-younian-good'];
const STAR25_RULES = ['kitchen-star-2-5', 'altar-star-2-5', 'fish-star-5', 'stairs-star-5'];

const WANG_RULES = ['wangshan-shi', 'wangshan-shui', 'wangxiang-shui', 'wangxiang-shi'];
const ZL_RULES = ['zhengshen-shi', 'zhengshen-shui', 'lingshen-shui', 'lingshen-shi'];
const EXT_BOTH_NOTE = '這一宮山星、向星都當運，傳統講究「先見水、水外有山」才能兼顧。';

// 大門落在游年凶方時，能照做的動作（依凶星五行洩氣；宮裡有二黑五黃時一律改金）
// T1：不用銅鈴（會響會動，跟二五「宜靜不宜動」矛盾），一律用銅葫蘆、六帝錢
const DOOR_ACTION = {
  絕命: '門墊改用藍色或黑色，玄關放一杯靜水',
  五鬼: '門墊改用黃色或米色，玄關少用紅色與長明燈',
  六煞: '玄關擺綠色盆栽，門邊不放水景',
  禍害: '門邊放銅葫蘆或六帝錢，門墊用白色',
};
const DOOR_METAL = '門邊放銅葫蘆或六帝錢，門墊用白色';
// T9：門墊顏色八宅與玄空不同時補的一句
const DOOR_MAT_DIFFER = '門墊顏色八宅與玄空做法不同，化解清單以較重的一項為準。';
// T14：灶已坐游年凶方（灶壓凶方）時，火燒天門改用不動工的做法
const QIAN_STOVE_ACTION = '爐灶旁放金屬鍋具架、銅製品，補乾宮的金';
const QIAN_STOVE_NOTE = '八宅看這個爐位是「灶壓凶方」，兩派看法不同，先不移爐。';
const STOVE_MOVE_RE = /西北角|移出西北|不屬西北|把爐具移|爐灶移出|移離/;
// T15：二五宮（含流年）的動作不動工；這些字算施工（G0：挑高、天井也算）
// X4：「X避開這一宮」是叫人別把房間放這裡，不算施工
const CONSTRUCT_RE = /設矮牆|屏障|裝修|移|避開(?!這一宮|此宮|這一方|此方|這個方位|這裡)|改格局|退縮|(?<![這各那一多兩三幾每此])種|敲打|動土|施工|釘牆|改安|挑高|天井/;
const NO_BUILD_YEAR = '（今年此方忌動土，明年再做）';
const NO_BUILD_OWN = '（此方宜靜，動工前先擇日）';
// X4：流年與山向星都有二五時的合併註記（跟內局 rooms.mjs 同一句）
const NO_BUILD_BOTH = typeof RM.NO_BUILD_BOTH === 'string' && RM.NO_BUILD_BOTH ? RM.NO_BUILD_BOTH : '（今年此方忌動土；此方本身宜靜，日後動工先擇日）';
const NO_BUILD_NOTES = [NO_BUILD_YEAR, NO_BUILD_OWN, NO_BUILD_BOTH];
// L1：爐灶移位的目標宮只因流年二五時，寫在目標後面的那一句（括號裡跟宮名一起，不跟 NO_BUILD_NOTES 搞混）
const STOVE_YEAR_NOTE = '今年此方忌動土，明年再做';
// X4：條件子句開頭的退路句（不能移時、移不了時、動不了時、無法移時…）本身就是不動工的選項，不貼提醒
const FALLBACK_RE = RM.FALLBACK_RE instanceof RegExp ? RM.FALLBACK_RE : /^[^，；：。！？]{0,8}?(?:不能|不了|無法|沒辦法)[^，；：。！？]{0,4}時/;
const METAL_ACTION = '放銅葫蘆或六帝錢，這一方保持安靜、不動土';
// Z3：二五宮的魚缸（宜靜不宜動）
const FISH_25_LINE = '魚缸移出這一宮；移不了先關掉打氣、縮小水量。';
const METAL_ITEM = '放銅葫蘆、六帝錢或金屬擺件，配白色、金色、銀色的布品。';

/* ------------------------------------------------------------------ */
/* 小工具                                                               */
/* ------------------------------------------------------------------ */

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const numLike = (v) => (typeof v === 'number' || typeof v === 'string') && !blank(v);
const sn = (n) => STAR_NAMES[n] || '－';
const qiLabel = (q) => (q === '生氣' ? '生氣（下一運之星）' : (q || '－'));
const fmtNum = (n) => String(Math.round((Number(n) || 0) * 100) / 100);
/** PATTERN_INFO 的 luck 如「中（旺丁）」放進括號時改成「中，旺丁」；「損丁／損財」改成不武斷的說法（D9） */
const flatLuck = (s) => String(s || '')
  .replace(/損丁/g, '不利人丁').replace(/損財/g, '不利財運')
  .replace(/（([^（）]+)）/g, '，$1');
const signed = (n) => (n > 0 ? `+${fmtNum(n)}` : n < 0 ? `−${fmtNum(-n)}` : '0');
const endDot = (s) => {
  const t = String(s === null || s === undefined ? '' : s).trim();
  return !t || /[。！？]$/.test(t) ? t : `${t}。`;
};
/** 切成句子（每句保留結尾的「。」） */
const sentences = (s) => String(s || '').split(/(?<=[。！？])/).map((x) => x.trim()).filter(Boolean);
/** L6：同一段裡一模一樣的句子只留第一次（不是整句一樣的不動） */
const dedupeSentences = (s) => {
  const list = sentences(s);
  const out = [...new Set(list)];
  return out.length === list.length ? String(s || '') : out.join('');
};
/** 去掉標點空白，用來判斷兩句話是不是在講同一件事 */
const bare = (s) => String(s || '').replace(/[，。、；：（）「」『』\s]/g, '');
const uniq = (arr) => [...new Set(arr.filter((x) => x !== null && x !== undefined && x !== ''))];
const charLen = (s) => [...String(s)].length;
const is25 = (s, cur) => (s === 5 && cur !== 5) || (s === 2 && cur !== 2);

/** 「南方（離宮）」；中宮寫「中宮（房子正中央）」 */
function where(p) {
  if (p === '中') return '中宮（房子正中央）';
  return PALACE_INFO[p] ? `${PALACE_INFO[p].dir}方（${p}宮）` : '全宅';
}
/** 「南方」；中宮寫「中宮」；沒有宮位寫「全宅」 */
function dirOf(p) {
  if (p === '中') return '中宮';
  return PALACE_INFO[p] ? `${PALACE_INFO[p].dir}方` : '全宅';
}

function toInt(v, lo, hi) {
  if (!numLike(v)) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) return null;
  return n;
}

function toPalace(v, allowCenter = false) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (PALACES.includes(s)) return s;
  if (allowCenter && (s === '中' || s === '中宮')) return '中';
  return palaceFromDir(s.replace(/方$/, '')) || null;
}

/**
 * T18：p 運的起訖年，取「開始年不晚於參考年」的最近一輪（三元九運 180 年一循環）。
 * 入住 2045（一運）→ 2044–2063；指定九運、入住 2045 → 2024–2043；沒有參考年用 1864 起的那一輪。
 * G1：指定元運（nearest＝true）時改取「離參考年最近」的那一輪（年份落在區間裡距離 0），只在開始年 1864～2100 之間挑：
 *   指定九運＋入住 2020 → 2024–2043；指定八運＋入住 1980 → 2004–2023；不會出現 1864 以前或 2100 以後的區間。
 */
const RANGE_FIRST = 1864;
const RANGE_LAST_START = 2100;
function periodRangeNear(p, ref, nearest = false) {
  const base = periodRange(p);
  if (!Number.isInteger(ref)) return base;
  if (!nearest) {
    const start = base.start + 180 * Math.floor((ref - base.start) / 180);
    return { start, end: start + 19 };
  }
  const dist = (s) => (ref < s ? s - ref : ref > s + 19 ? ref - (s + 19) : 0);
  let best = Math.max(base.start, RANGE_FIRST);
  for (let s = best + 180; s <= RANGE_LAST_START; s += 180) if (dist(s) < dist(best)) best = s;
  return { start: best, end: best + 19 };
}

function daysIn(y, m) {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** 叫別人的模組；萬一丟例外就用 fallback，並寫一條 warning（analyze 不能丟例外） */
function safe(fn, fallback, warnings, what) {
  try {
    const r = fn();
    return r === undefined || r === null ? fallback : r;
  } catch (e) {
    warnings.push(`${what}計算時發生錯誤，這一項以中間值計。`);
    return fallback;
  }
}

/** 八宅用語統一：標題裡的「生氣」等游年星前面加「游年」，跟玄空的生氣分開 */
function younianTitle(title) {
  let t = String(title || '');
  t = t.replace(/個人「/g, '個人游年「');
  t = t.replace(/(^|[^年])「(生氣|天醫|延年|伏位|禍害|六煞|五鬼|絕命)」/g, '$1游年「$2」');
  return t;
}
/** 玄空用語統一：「一白生氣」「大門納生氣」這種寫法補成「生氣（下一運之星）」，免得跟八宅生氣方混淆 */
function qiTitle(title) {
  return String(title || '')
    .replace(/(一白|二黑|三碧|四綠|五黃|六白|七赤|八白|九紫)生氣(?!（)/g, '$1生氣（下一運之星）')
    .replace(/納生氣（向星/g, '納生氣（下一運之星，向星');
}
const fixTitle = (t) => qiTitle(younianTitle(t));
/** D7：床頭朝向一律寫「個人 X 方」 */
const personalHead = (s) => String(s || '')
  .replace(/床頭([^，。；]{0,3}?)朝(?!個人)(向)?(生氣|天醫|延年|伏位|吉)方/g, '床頭$1朝$2個人$3方');
/** D9：一律用「你」 */
const youText = (s) => String(s || '').replace(/您/g, '你');

/** 三優三注意與化解清單用：標題前面補方位 */
function brief(title, palace) {
  const t = String(title || '');
  if (!palace || !(PALACE_INFO[palace])) return t;
  const d = dirOf(palace);
  // X2：「此宮有…」那一條一定補方位（標題裡的「另有廁所在坤宮」不算講了方位）
  if (t.startsWith(d) || (t.includes(`${palace}宮`) && !t.startsWith('此宮有'))) return t;
  return `${d}・${t}`;
}

/* ------------------------------------------------------------------ */
/* 化解文字的處理（D4、[19]、[24]、[26]、[31]）                          */
/* ------------------------------------------------------------------ */

// 否定語：「少用紅色」「不用陶瓷」這種是禁忌，不算建議
const NEG_RE = /(少用|不用|避免|忌|不宜|不放|不要|減少|移開|不加|不點|不必|拿掉|少放|不再|勿|不擺|收起|以免|不可|不喜|不建議|不適合)/;
const NEG_TAIL = /(不|少|勿|忌|免|別|無)$/;
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// D4：二黑五黃宮只用金，土、火、木、水的建議都拿掉（知識庫的 AVOID_25 一併採用）
// R12：植栽、綠籬、樹籬也算木；「燈常開」「常開燈」也算火
const BAD25_RE = new RegExp([
  '陶瓷', '陶土', '陶器', '(?<!五)黃(?:色|、|褐|米|水晶)', '米色', '米、', '咖啡', '土色', '紅色', '紅、', '紅紫', '大紅', '紫色',
  '植物', '盆栽', '植栽', '綠籬', '樹籬', '綠色', '木質', '流水', '水景', '魚缸', '燈光加強', '加強照明', '長明燈', '長亮', '暖色燈', '亮燈',
  '燈.{0,4}常開', '常開燈',
  '靜水', '水缽', '水養', '藍色', '黑色',
  ...KB_AVOID_25.filter((w) => typeof w === 'string' && w && !/^用/.test(w)).map(escRe),
  // T1：會響會動的金也不用（G0：任何「鈴」都算）
  ...NOISY_25.map(escRe), '鈴',
].join('|'));
// T3：二五宮（含流年）宜靜：不寫「可做／宜做臥室」「見水」「開門開窗」「見光、見動、宜動」「明亮」
// G0／G3：「臥室放在…」「宜有（門路或）水」也算叫人做臥室、見水
const ACTIVE25_RE = /(?:可|宜|適合|可以)?(?:做|作|當作|當成|設|改作|改成|改為)[^，。；]{0,8}?(?:臥室|主臥)|臥室[^，。；]{0,6}?放在|宜有(?:門路或)?水|有門路或水|見水|開門|開窗|見光|見動|宜動|明亮/;
// T7：二五宮以金洩為先，「少放金屬、少用白色」這類否定句拿掉（金屬尖角、利器、銅鈴的禁忌照留）
const METAL_NEG_RE = /白色|金色|銀色|銅(?!鈴)|金屬(?![尖利])/;
const METAL_TERMS = ['白色', '金色', '銀色', '銅葫蘆', '六帝錢'];
/** 這一段裡有沒有「被否定的」金（少放金屬、不用白色…） */
function negMetal(text) {
  for (const clause of clausesOf(text)) {
    const g = new RegExp(METAL_NEG_RE.source, 'g');
    let m;
    while ((m = g.exec(clause))) {
      if (negatedAt(clause, m.index, m[0].length)) return true;
    }
  }
  return false;
}
// 用土、火、木、水的五行原理句（R14：「金生水來通關」的水是被生出來的，不算用水）
const METHOD25_RE = /用(?:土|火|木|水)(?!晶)|(?<!生)(?:土|火|木|水)來(?:洩|通關|生|補)|補土|以土|以火|以木|以水/;
// 五行家族（同宮互剋檢查用）。R4：火只認紅紫色、暖色燈、長明燈與明講用火；「加強照明、亮燈、保持明亮」是採光，不算火
const FAMILY = {
  金: /銅|金屬|六帝錢|五帝錢|白色|金色|銀色/,
  木: /植物|盆栽|植栽|綠籬|樹籬|綠色|木質|富貴竹|竹製/,
  火: /紅色|紅、|紅紫|大紅|紫色|暖色燈|長明燈|火性|用火(?:洩|通關|來)|(?<!洩)火(?:來)?(?:洩|通關)|以火/,
  土: /陶瓷|陶土|陶器|(?<!五)黃(?:色|、|褐|米|水晶)|米色|咖啡|土色|石材|玉石/,
  // X5：用水洩、水洩、見水、可見水也算用水（跟靜水、水景、魚缸、水缽同一類）
  水: /靜水|流水|水景|魚缸|藍色|黑色|水缽|水養|用水(?:來)?洩|(?<![用以])水洩|見水/,
};
const KE = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
// X5：「不用火、不用水、少用紅色」這種否定的五行（明講「不用X」的那一種；顏色、器物走 FAMILY 加否定字）
const NEG_FAM_RE = /(?:不用|少用|不加|忌用|避免用)((?:[金木水火土](?:[、與和及或](?=[金木水火土]))?)+)(?![色晶屬])/g;
// X5：刪掉某五行的做法時，同一句裡跟著那個做法的殘句（「常換水」）一起刪
const RESIDUE_RE = {
  水: /常換水|換水|水要常換|水要乾淨|保持水質|水不可混濁/,
  木: /澆水|修剪|枯葉|常換盆/,
  火: /燈要常亮|定時開燈|燈不要熄/,
};
// X5：只剩「X屬金」這種原理的殘句
const PRINCIPLE_ONLY_RE = /^[^，；。]{0,12}屬[金木水火土][，；。]?$/;
// R7：同宮「少用／忌 X」與另一條肯定句的 X 互相矛盾時要比對的字（逐字比，不用五行家族，免得「金屬利器」被當成金）
const TERMS = ['紅色', '紫色', '粉紅', '黃色', '米色', '咖啡', '白色', '金色', '銀色', '藍色', '黑色', '綠色',
  '陶瓷', '石材', '植物', '盆栽', '魚缸', '水景', '流水', '靜水', '長明燈', '暖色燈', '銅葫蘆', '六帝錢', '銅鈴'];
// 地墊、門墊的顏色（R7：同一宮只留一條）
const MAT_RE = /(門墊|地墊)/;
const MAT_COLOR_RE = /(門墊|地墊)[^，；。]{0,12}(白|金|銀|藍|黑|綠|紅|紫|黃|米|咖啡)|(白|金|銀|藍|黑|綠|紅|紫|黃|米|咖啡)色?[^，；。]{0,10}(門墊|地墊)/;
// 能照做的動作 vs 原理、前言（R3：「乾宮屬金、代表男主人」這種開頭也是原理）
const PRINCIPLE_RE = new RegExp([
  '^(這是|這一宮|這一方有|此宮|這一方又有|中宮本來|大門位置難改|重點|依|傳統|作法同|做法同|五行|若|如果|只有|兩星|當令|失令|得令|生旺時|風水|不必|其他|飛星賦|紫白訣|玄空秘旨|玄機賦|古訣|歌訣|山星管|向星管|代表|今年此宮|同一方位|八宅看)',
  // T7、T8：系統補的說明句（併入、相剋、相反、見上一條）不當動作
  '併入|相剋，這裡|用法相反|見上一條|見上面',
  '可反為吉用', '只用金洩', '不建議換房',
  '^[^，。]{0,12}屬[金木水火土](（[^）]*）)?[，；、]',
  '^[^，。]{0,10}(是|落在)[^，。]{0,10}[，；]',
  '^用[金木水火土]來?(洩|通關|生|補|制)[^，。]*$',
].join('|'));
// R13：「不要、少、取、補、正對」等也是動詞
const VERB_RE = /(放|擺|掛|移|換|改|關|蓋|開|鋪|保持|加|設|避開|避|轉|朝|清|拉開|拉上|靠|收|縮小|裝|貼|種|遮擋|少開|少用|少動|不堆|不放|不要|少|取|補|正對|防|拿掉|調整|重量|勤|除濕|通風|檢查|擇日|留|退縮|配|用|安排|做|作)/;
// 名詞片段判斷再多看這幾個字：有「宜、不…」的是一句話，不是名詞清單（X8：「在此、要」也是）
const SENTENCE_RE = /(宜|不(?!鏽)|即可|住到|住在|在此|要)/;
// [24] R20：這一句是前言，不能當動作（來源是 rooms.mjs 大門納衰氣的 fix）
const PREFACE_RE = /[；，]?\s*大門位置難改，重點放在化解與補強([。；，]|$)/g;
const stripPreface = (s) => String(s || '').replace(PREFACE_RE, (m, end) => (/^[；，]/.test(m) ? (end === '' ? '' : '。') : ''))
  .replace(/。。/g, '。').replace(/^。/, '');

const clausesOf = (s) => String(s).split(/(?<=[，；])/);
/**
 * 字串判斷的快取（同一句知識庫文字在一份報告、一輪掃描裡會被判很多次）。只放純函式的結果，呼叫的人不准改回傳值。
 */
function memo1(fn, max = 20000) {
  const cache = new Map();
  return (s) => {
    const k = String(s === null || s === undefined ? '' : s);
    let v = cache.get(k);
    if (v === undefined) {
      v = fn(k);
      if (cache.size >= max) cache.clear();
      cache.set(k, v);
    }
    return v;
  };
}
// Z3：關鍵字後面同一子句接「移開、移走、撤掉、拿掉、收起、移出、關掉」也算否定（「魚缸移出這一宮」不是叫你放魚缸）
// 「魚缸移到別宮」「搬到」對這一宮來說也是拿走
const POST_NEG_RE = /^[^，；。]{0,4}?(?:移開|移走|撤掉|撤走|拿掉|收起|移出|關掉|移到|搬到)/;
/** 子句裡 idx 起、長 len 的命中是不是被否定（前面有否定字，或 Z3 後面接移開、撤掉、關掉…） */
function negatedAt(clause, idx, len) {
  const pre = clause.slice(0, idx);
  if (NEG_RE.test(pre) || NEG_TAIL.test(pre)) return true;
  return POST_NEG_RE.test(clause.slice(idx + len));
}
/** 這一段裡有沒有「不是被否定」的命中 */
function positiveHit(text, re) {
  for (const clause of clausesOf(text)) {
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(clause))) {
      if (!negatedAt(clause, m.index, m[0].length)) return true;
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  return false;
}
/** X2：「另有「零神方見水」：…」引號裡是問題的名稱，判斷五行與建議時不算 */
const unquoteNames = (s) => String(s === null || s === undefined ? '' : s).replace(/另有「[^」]*」/g, '另有');
const familiesOf = memo1(familiesOfRaw);
function familiesOfRaw(text) {
  const t = unquoteNames(text);
  return Object.keys(FAMILY).filter((f) => positiveHit(t, FAMILY[f]));
}
/** X5：被否定的五行家族（「少用紅色」＝火、「不用火、水」＝火與水、「不放水景」＝水） */
const negFamiliesOf = memo1(negFamiliesOfRaw);
function negFamiliesOfRaw(text) {
  const out = new Set();
  for (const clause of clausesOf(unquoteNames(text))) {
    for (const f of Object.keys(FAMILY)) {
      // 金：「不放刀劍與金屬尖銳物」「不用銅鈴」是忌利器、忌會響的，不算少用金（跟 negMetal 同一把尺）
      const g = new RegExp((f === '金' ? METAL_NEG_RE : FAMILY[f]).source, 'g');
      let m;
      while ((m = g.exec(clause))) {
        if (negatedAt(clause, m.index, m[0].length)) out.add(f);
        if (m[0].length === 0) g.lastIndex++;
      }
    }
    for (const m of clause.matchAll(NEG_FAM_RE)) for (const ch of m[1]) if (KE[ch]) out.add(ch);
  }
  return [...out];
}

/**
 * D4：二黑五黃宮的化解句子，拿掉土、火、木、流水的建議（只拿掉建議，不拿掉「少用、忌」這種禁忌）。
 * 回傳 { text, removed }；整句都不能用時 text＝''。
 */
const clean25 = memo1(clean25Raw);
function clean25Raw(sentence) {
  const s = String(sentence || '').trim();
  if (!s) return { text: '', removed: false };
  const dot = /。$/.test(s);
  const body = s.replace(/。$/, '');
  const cls = clausesOf(body);
  // 原理句是用土火木、或帶「：」標籤的那段要用土火木 → 整句拿掉
  if (cls.some((c) => positiveHit(c, METHOD25_RE) || (c.includes('：') && positiveHit(c.slice(c.indexOf('：') + 1), BAD25_RE)))) {
    return { text: '', removed: true };
  }
  // T1 會響的金、T3 宜動見水明亮做臥室、T7 否定金的句子，都跟二五「只用金、宜靜」矛盾
  const keep = cls.filter((c) => !positiveHit(c, BAD25_RE) && !positiveHit(c, ACTIVE25_RE) && !negMetal(c));
  if (keep.length === cls.length) return { text: s, removed: false };
  let t = keep.join('').replace(/^[，；\s]+/, '').replace(/[，；\s]+$/, '').replace(/^(並|或|也|再|以及)/, '');
  if (!t || !VERB_RE.test(t)) return { text: '', removed: true };
  return { text: dot ? endDot(t) : t, removed: true };
}

/**
 * [19][26]：條件句依 cells 直接判斷。
 *   「想補水氣可擺小型水景，但這一宮有當運山星或五黃時不宜擺。」→ 條件成立：整句拿掉；不成立：拿掉「但…不宜擺」。
 *   「這一宮山星也當運時就不宜擺水。」（獨立一句）→ 條件成立：連同前一句擺水的建議一起拿掉；不成立：只拿掉這句。
 *   「五運當令時不必化解…」→ 現在不是五運就拿掉。
 */
// X8：「大門在此／臥室在此／若大門在這一宮…」這種看房間的條件句
const ROOM_HERE_RE = /(?:若|如果)?(大門|主臥|臥室|廚房|爐灶|廁所|浴室|書房|客廳|神明廳|神位|魚缸|樓梯|電梯)(?:正)?(?:設)?在(?:此宮|此方|這一宮|這一方|此)(?:時)?/;
const ROOM_HERE_MAP = {
  主臥: ['主臥'], 臥室: ['主臥', '臥室', '小孩房', '長輩房'], 廚房: ['廚房'], 爐灶: ['廚房'], 廁所: ['廁所'], 浴室: ['廁所'],
  書房: ['書房'], 客廳: ['客廳'], 神明廳: ['神明廳'], 神位: ['神明廳'], 魚缸: ['魚缸'], 樓梯: ['樓梯'], 電梯: ['電梯'],
};
/** X8：這一宮有沒有那個房間（大門看 isDoor：大門以向宮計也算） */
function roomHere(word, c) {
  const rs = (c && Array.isArray(c.rooms)) ? c.rooms : [];
  if (word === '大門') return !!(c && c.isDoor) || rs.includes('大門');
  return (ROOM_HERE_MAP[word] || [word]).some((r) => rs.includes(r));
}
/** X8：依房間判斷「X在此」條件句：沒有那個房間 → null（整句拿掉）；有 → 拿掉開頭的條件子句 */
function roomConditional(s, c) {
  const m = String(s).match(ROOM_HERE_RE);
  if (!m) return s;
  if (!c || !Array.isArray(c.rooms)) return s;
  if (!roomHere(m[1], c)) return null;
  const lead = String(s).match(new RegExp(`^${escRe(m[0])}[，；]\\s*`));
  return lead ? String(s).slice(lead[0].length) : s;
}

function resolveConditional(list, cell, cur) {
  return resolveConditionalIdx(list, cell, cur).map((x) => x.t);
}
/** 同 resolveConditional，另外回每一句來自 list 的第幾條（{ i, t }），改寫過的句子也找得回原位 */
function resolveConditionalIdx(list, cell, cur) {
  const out = [];
  const c = cell || {};
  const condOf = (s) => {
    let any = false;
    let hit = false;
    if (/當運山星|山星也當運|山星當運/.test(s)) { any = true; if (c.m === cur) hit = true; }
    if (/五黃/.test(s)) { any = true; if (c.m === 5 || c.f === 5) hit = true; }
    if (/二黑/.test(s)) { any = true; if (c.m === 2 || c.f === 2) hit = true; }
    return { any, hit };
  };
  const water = /(可|可以)?擺[^，。]*?(水景|魚缸|流水)/;
  list.forEach((raw, i) => {
    let s = String(raw || '').trim();
    if (!s) return;
    // X8：「大門在此」這類條件句依這一宮的房間判斷
    const rc = roomConditional(s, cell);
    if (rc === null) return;
    s = String(rc).trim();
    if (!s) return;
    const pm = s.match(/^([一二三四五六七八九])運[^，。]{0,6}?當令時/);
    if (pm) {
      if (CN.indexOf(pm[1]) !== cur) return;
      out.push({ i, t: s });
      return;
    }
    if (/時(就)?不宜(擺|放)/.test(s)) {
      const { any, hit } = condOf(s);
      if (!any) { out.push({ i, t: s }); return; }
      const cls = clausesOf(s.replace(/。$/, ''));
      const condIdx = cls.findIndex((x) => /時(就)?不宜(擺|放)/.test(x));
      const before = cls.slice(0, condIdx).join('');
      if (water.test(before)) {
        // 同一句裡有擺水的建議
        if (hit) return;
        const t = before.replace(/[，；\s]+$/, '');
        if (t) out.push({ i, t: endDot(t) });
        return;
      }
      // 獨立的條件句
      if (hit && out.length && water.test(out[out.length - 1].t)) out.pop();
      return;
    }
    out.push({ i, t: s });
  });
  return out;
}

/**
 * 「依凶星五行洩氣：絕命用藍黑色、五鬼用黃色陶瓷、六煞用綠色木質、禍害用金屬白色」這種各星通用清單：
 * 只留這一宮游年星那一段（「禍害方用金屬白色洩氣」）；這一宮不是清單裡的星就整句拿掉。
 */
function pickStarClause(s, star) {
  const t = String(s || '');
  const m = t.match(/^([^：]*)：((?:(?:生氣|天醫|延年|伏位|禍害|六煞|五鬼|絕命)用[^、。]+、?){2,})。?$/);
  if (!m) return t;
  const part = m[2].split('、').find((x) => star && x.startsWith(`${star}用`));
  if (!part) return '';
  return `${star}方${part.slice(star.length)}，依凶星五行洩氣。`;
}

// T7、T17：說明句（「見上一條」「那一條」「X屬土」「已有…」）不是名詞片段，不能接成「可用…」或在前面補「放」
const DESC_RE = /見上|見下|見八宅|見格局|那一條|上一條|屬[金木水火土]|是|代表|已有|已經|相剋|相生|較重要|併入/;

// G6：以「時」結尾的一段是條件子句（「門被沖時」「爐位動不了時」），不是名詞片段、也不是動作
const COND_END_RE = /時$/;
/** G6：拿掉開頭的條件子句（「門被沖時，門內設玄關或屏風」→「門內設玄關或屏風」）；整句都是條件子句回空字串 */
function stripLeadCond(s) {
  let t = String(s || '').trim();
  for (;;) {
    const m = t.match(/^([^，；。（）]*時)[，；]\s*/);
    if (!m) break;
    t = t.slice(m[0].length).trim();
  }
  return COND_END_RE.test(t.replace(/[。！？]$/, '')) ? '' : t;
}

/** 是不是名詞片段（「銅葫蘆」「六帝錢」「金屬擺件、銅器」這種），用來串成一句 */
function isFragment(s) {
  const t = String(s || '').replace(/。$/, '');
  if (!t || /[，；。：]/.test(t)) return false;
  if (COND_END_RE.test(t)) return false;
  const core = t.replace(/（[^）]*）/g, '').replace(/擺件|擺鐘|擺設|掛飾|用品|開關|放置/g, '');
  return !VERB_RE.test(core) && !SENTENCE_RE.test(core) && !DESC_RE.test(core);
}

// A1：名詞片段要以物品結尾才補「放」（物品白名單）；片段裡有這些字是說明或條件，不是物品，整段丟掉
const PUT_ITEM_RE = /(?:銅葫蘆|葫蘆|六帝錢|五帝錢|帝錢|銅錢|擺件|擺設|擺飾|銅器|銅製品|金屬擺件|金屬製品|器物|器皿|陶瓷|盆栽|植物|富貴竹|文昌筆|櫃|高櫃|書櫃|矮櫃|鞋櫃|屏風|門簾|窗簾|地墊|門墊|布品|燈|鏡|山石|石材|水晶)(?:（[^）]*）)?$/;
const PUT_DROP_RE = /生|旺|建議|明年|前|的話|當運|撤掉|可以/;

/** [24]：從一句化解裡挑出「能照做的動作」；原理、前言回空字串 */
function concreteOf(s) {
  let t = String(s || '').trim().replace(/[。！？]$/, '');
  if (!t) return '';
  if (t.includes('：')) {
    const after = t.slice(t.lastIndexOf('：') + 1).trim();
    if (after) t = after;
  }
  t = t.replace(/^其餘元運，?/, '');
  // G6：開頭以「時」結尾的條件子句（不能移時、門被沖時…）拿掉，取後面的做法
  t = stripLeadCond(t);
  if (!t || PRINCIPLE_RE.test(t)) return '';
  // 開頭是名詞清單（「銅葫蘆、六枚銅錢、白色擺設，量不必多…」）→ 只取清單、前面補「放」
  const head = t.split(/[，；]/)[0];
  if (isFragment(head)) {
    // A1：片段含生、旺、建議、明年、前、的話、當運、撤掉 → 不是物品（「明年請神前」「建議撤掉」），丟掉改走查表或通用動作
    if (charLen(head) > 30 || PUT_DROP_RE.test(head.replace(/（[^）]*）/g, ''))) return '';
    if (/^(白|紅|黃|綠|藍|黑|金色|銀色)/.test(head)) return `改用${head}`;
    // A1：只有以物品名詞結尾才補「放」
    return PUT_ITEM_RE.test(head) ? `放${head}` : '';
  }
  if (!VERB_RE.test(t)) return '';
  return t;
}

/** 片段用「、」串成一句（每句不超過 55 字），完整句子照原樣 */
function joinItems(items) {
  const out = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    let cur = [];
    let first = true;
    for (const f of buf) {
      const next = [...cur, f];
      if (cur.length && charLen(`${first ? '可用' : '也可用'}${next.join('、')}。`) > 55) {
        out.push(`${first ? '可用' : '也可用'}${cur.join('、')}。`);
        first = false;
        cur = [f];
      } else {
        cur = next;
      }
    }
    if (cur.length) out.push(`${first ? '可用' : '也可用'}${cur.join('、')}。`);
    buf = [];
  };
  for (const it of items) {
    if (isFragment(it)) buf.push(String(it).replace(/。$/, ''));
    else { flush(); out.push(endDot(it)); }
  }
  flush();
  return out.join('');
}

/** 知識庫一條化解的文字：method＋前 n 條（可過濾） */
function remedyText(kb, n = 2, keep = () => true) {
  if (!kb) return '';
  return endDot(kb.method) + joinItems([...kb.items].filter(keep).slice(0, n));
}

/** 知識庫條目的 with25（{ method, items }）；沒有就回 null */
function with25Of(kb) {
  const w = kb && kb.with25;
  return w && typeof w === 'object' && Array.isArray(w.items) && w.items.length ? w : null;
}

/**
 * [26]：知識庫的分宮清單（「在坤、艮宮：…」）只留這一宮那一條。
 * 知識庫有 byPalace 就用它；沒有就從清單裡挑出這一宮的那一條並去掉前綴。
 */
// T6：大門納衰氣那兩條各星通用的清單（「一白用木、二五八用金…」「門口地墊依…選色」）
const DOOR_GENERIC_RE = /^依門宮向星化解|^門口地墊依/;
function kbItemsFor(kb, palace, star = null, noWater = false) {
  const raw = [...(kb.items || [])].map(String);
  const re = /^在([坎艮震巽離坤兌乾中、]+)宮[：:]/;
  const out = [];
  let placed = false;
  // T6：知識庫有 byStar（大門納衰氣）又知道門宮向星 → 通用清單換成這顆星那一句
  // Y1：byStar 的一條可能是 { text, noWaterText }；門宮山星當運（noWater）時用 noWaterText
  const bs = kb.byStar && typeof kb.byStar === 'object' && star ? (kb.byStar[star] || kb.byStar[String(star)] || null) : null;
  const byStar = bs && typeof bs === 'object' && !Array.isArray(bs)
    ? String((noWater && bs.noWaterText) || bs.text || bs)
    : bs;
  let starPlaced = false;
  for (const x of raw) {
    if (byStar && DOOR_GENERIC_RE.test(x)) {
      if (!starPlaced) { out.push(String(byStar)); starPlaced = true; }
      continue;
    }
    const m = x.match(re);
    if (!m) { out.push(x); continue; }
    if (placed) continue;
    if (kb.byPalace && typeof kb.byPalace === 'object') {
      placed = true;
      if (palace && kb.byPalace[palace]) out.push(String(kb.byPalace[palace]));
      continue;
    }
    if (palace && m[1].split('、').includes(palace)) { out.push(x.slice(m[0].length)); placed = true; }
  }
  return out;
}

/** [15]：大門、主臥落在凶方時，用 forDoor（知識庫沒有就拿掉「把這一方用作廁所、儲藏、灶座」那一條） */
const NOT_FOR_DOOR = /廁所|儲藏|灶座落/;
function doorRemedy(star) {
  const kb = YOUNIAN_REMEDY[star];
  if (!kb) return null;
  const items = Array.isArray(kb.forDoor) && kb.forDoor.length
    ? [...kb.forDoor].map(String)
    : [...kb.items].map(String).filter((x) => !NOT_FOR_DOOR.test(x));
  const method = String(kb.doorMethod || kb.method || '')
    .split('；').filter((c) => !NOT_FOR_DOOR.test(c)).join('；');
  const out = { method: endDot(method.replace(/[；，]$/, '')), items };
  if (with25Of(kb)) out.with25 = kb.with25;
  return out;
}

/* ------------------------------------------------------------------ */
/* Z2：這一宮能不能放水（waterOk）                                        */
/* ------------------------------------------------------------------ */

// 叫人放水的說法：靜水、水缽、魚缸、水景、流水、水養植物、可見水、宜有門路或水、用水洩…（地墊布品的藍黑色不算放水；
// 「門前開闊或有水」這種屋外形勢的說法不算，入囚「天井或有水」由 prisonText 自己處理）
const WATER_PUT_RE = /靜水|清水|水缽|魚缸|水景|流水|水養|水種|水培|水生植物|一杯水|(?:可|宜)見水|宜有(?:門路或)?水|用水(?:來)?(?:洩|通關)|以水(?:來)?(?:洩|通關)|(?<![用以生])水(?:來)?洩/;
// 拿掉放水的子句之後，跟著它的殘句（「想補水氣」「常換水」）也拿掉
const WATER_RESIDUE_RE = /水氣|補水|引水|換水|水要|水質|水量/;
// Z2：真的在「用水」的說法（水的家族扣掉「見水」這種講道理的）
const WATER_FAM_USE_RE = /靜水|流水|水景|魚缸|藍色|黑色|水缽|水養|用水(?:來)?洩|(?<![用以])水洩/;
/** Z2：不能放水時補的那一句（二五宮另有「只用金」的說法，不再補） */
export const WATER_WHY = Object.freeze({
  mountain: '此宮山星當運，不另加水。',
  toilet: '此宮已有廁所之水，不另加水。',
  // A7：直接看向星是不是死氣或煞氣（不靠九宮評等），跟內局 rooms.mjs 的 waterOk 同一把尺
  bad: '此宮向星失令（死氣、煞氣），不另加水。',
});
/** A6：山星、向星都當運（雙星同宮）的宮可以放水，但要「先見水、水外有山」 */
export const BOTH_WATER = '此宮山星向星都當運，放水要「先見水、水外有山」，水的後方靠實牆或高櫃。';
/** A5：「…」裡是別條化解或問題的名稱，判斷放水前先換成佔位符（判完再換回來） */
const QUOTE_RE = /「[^」]*」/g;
function maskQuotes(s0) {
  const qs = [];
  const t = String(s0 === null || s0 === undefined ? '' : s0).replace(QUOTE_RE, (m) => { qs.push(m); return `〔${qs.length - 1}〕`; });
  return { t, back: (x) => String(x).replace(/〔(\d+)〕/g, (m, i) => (qs[Number(i)] !== undefined ? qs[Number(i)] : m)) };
}
/** A5：這一句（引號裡的名稱不算）有沒有肯定的放水 */
const waterPut = (s) => positiveHit(maskQuotes(s).t, WATER_PUT_RE);
/** 這一宮有沒有「水過旺／水剋火」的廁所（坎宮、離宮的廁所，或內局那一條的標題） */
function toiletWaterAt(src, p) {
  const items = (src && src.interior && Array.isArray(src.interior.items)) ? src.interior.items : [];
  if (items.some((it) => it && it.palace === p && it.room === '廁所' && /水過旺|水剋火/.test(String(it.title || '')))) return true;
  return p === '坎' || p === '離';
}
/**
 * Z2：這一宮不能放水的理由（空字串＝可以放水）。src：報告，或 build 的 ctx。
 * 依序：二五（含流年）→ 山星現運當旺 → 已有廁所又水過旺／水剋火 → 九宮評凶而且向星失令（不是旺氣、生氣）。
 */
function waterWhy(p, src) {
  const env = targetEnv(src);
  const c = env.cells[p];
  if (!c) return '';
  if (has25(env.cells, p, env.cur)) return `此宮有${names25(env.cells, p, env.cur)}，只用金，不另加水。`;
  // A6：山星當運但向星也當運（雙星同宮）不擋，改「先見水、水外有山」
  if (c.m === env.cur && c.f !== env.cur) return WATER_WHY.mountain;
  const rs = env.rooms[p] || [];
  if (rs.includes('廁所') && toiletWaterAt(src, p)) return WATER_WHY.toilet;
  // A7：凶宮判斷直接看向星是不是死氣或煞氣
  if (c.fQi === '死氣' || c.fQi === '煞氣') return WATER_WHY.bad;
  return '';
}
/** Z2：這一宮能不能放水 */
export function waterOk(p, src) {
  return !waterWhy(p, src);
}
/** A6：這一宮是不是山星、向星都當運（可以放水，但要先見水、水外有山） */
function bothWangAt(p, src) {
  const env = targetEnv(src);
  const c = env.cells[p];
  return !!c && c.m === env.cur && c.f === env.cur && !has25(env.cells, p, env.cur);
}
/** Z2：一句話拿掉放水的子句（連殘句）；整句都不能用回 ''。A5：「…」裡的名稱先換成佔位符，不當放水句 */
const dryOne = memo1((s0) => {
  const raw = String(s0 || '').trim();
  const { t: s, back } = maskQuotes(raw);
  if (!s || !positiveHit(s, WATER_PUT_RE)) return raw;
  const dot = /[。！？]$/.test(s);
  // A5：「另有〔名稱〕：擺小型流水，…」——冒號前面的標籤（引用的名稱）留著，只拿掉冒號後面放水的那一段
  const cls = clausesOf(s.replace(/[。！？]$/, '')).map((c) => {
    const k = c.indexOf('：');
    if (k < 0 || !positiveHit(c, WATER_PUT_RE) || positiveHit(c.slice(0, k), WATER_PUT_RE)) return c;
    return { label: c.slice(0, k + 1) };
  });
  const keep = cls.map((c) => (typeof c === 'string' ? c : c.label))
    .filter((c, i) => typeof cls[i] !== 'string' || (!positiveHit(c, WATER_PUT_RE) && !WATER_RESIDUE_RE.test(c)));
  const t = keep.join('').replace(/^[，；、\s]+/, '').replace(/[，；、：\s]+$/, '').replace(/^(並|或|也|再|以及|但)/, '');
  if (!t || COND_END_RE.test(t) || PRINCIPLE_ONLY_RE.test(t) || /：$/.test(t)) return '';
  if (!VERB_RE.test(t) && !/宜|主|要/.test(t)) return '';
  return back(dot ? endDot(t) : t);
});
/**
 * Z2：一段建議裡的放水句，這一宮不能放水時改成不放水的版本，並補一句理由（二五宮另有只用金的說法，不補）。
 * 回 { text, removed }。
 */
function dryText(text, p, src) {
  const t = String(text || '');
  if (!t || !p) return { text: t, removed: false };
  const why = waterWhy(p, src);
  if (!why) {
    // A6：雙星同宮可以放水，叫人放水的地方補「先見水、水外有山」
    if (bothWangAt(p, src) && sentences(t).some(waterPut) && !t.includes(BOTH_WATER)) return { text: `${t}${BOTH_WATER}`, removed: false };
    return { text: t, removed: false };
  }
  let removed = false;
  const out = [];
  for (const s of sentences(t)) {
    const d = dryOne(s);
    if (d !== s) removed = true;
    if (d) out.push(d);
  }
  if (!removed) return { text: t, removed: false };
  const env = targetEnv(src);
  if (!has25(env.cells, p, env.cur) && !out.some((s) => s.includes(why.replace(/。$/, '')))) out.push(why);
  return { text: out.join(''), removed: true };
}

/* ------------------------------------------------------------------ */
/* Z1：化解動作表（ACTIONS）                                              */
/* ------------------------------------------------------------------ */

// 退路（從句子挑動作）時，動作一定要以這些字開頭，不然丟掉改用通用動作
const ACTION_LEAD_RE = /^(?:放|擺|改用|改放|掛|移|把|保持|關|加|換|拿掉|收|避免|床頭|床位|地墊|門墊|鋪|貼|裝|撤|縮小|蓋|拉上|清|廁所門|爐火|灶口|玄關)/;
// 動作的白話規矩：「放」後面要接物品
// 「放」後面接的是動詞（放拉上、放保持…）也不行（名詞片段補「放」補錯）
const PUT_BAD_RE = /^放(?:可以|可|門宮|此宮|此方|這一?宮|這一?方|山星|向星|傳統|當運|生旺|在|到|於|著|過|一起|拉上|拉開|保持|關|把|加|掛|移|換|改|擺|避)/;
/**
 * Z1：動作的白話規矩（空字串＝通過）：不得「放」接非物品、不含「的話」「當運」、不以「時」結尾、不超過 30 字。
 * 動土提醒的括號（今年此方忌動土…）不算字數。
 */
function actionLint(a) {
  let t = String(a || '').trim().replace(/[。！？]$/, '');
  for (const n of NO_BUILD_NOTES) t = t.split(n).join('');
  // L1：爐灶移位目標的流年註記（「凶方（西北，今年此方忌動土，明年再做）」）也不算字數
  t = t.split(`，${STOVE_YEAR_NOTE}`).join('');
  // F1：兌、坎目標的「此方另有火剋金（水火相沖），兩派看法不同」也不算字數
  for (const n of Object.values(STOVE_PALACE_NOTE)) t = t.split(`，${n}`).join('');
  t = t.trim();
  if (!t) return '沒有動作';
  if (PUT_BAD_RE.test(t)) return '「放」接的不是物品';
  // A1：「放明年請神前」「放建議撤掉」「放西方的向星生旺」這種「放」後面接的是說明、條件
  if (/^放/.test(t) && PUT_DROP_RE.test(t.slice(1).split(/[，；]/)[0].replace(/（[^）]*）/g, ''))) return '「放」接的不是物品';
  // A1：句中有「若」「如果」的條件句（「廁所門若正對爐具，…」）不當動作
  if (/若|如果/.test(t)) return '含條件句（若、如果）';
  if (/的話/.test(t)) return '含「的話」';
  if (/當運/.test(t)) return '含「當運」';
  if (/時$/.test(t)) return '以「時」結尾';
  if (charLen(t) > 30) return '超過 30 字';
  return '';
}
/** Z1：退路挑出來的動作能不能用（白名單開頭＋白話規矩＋可照做） */
const leadOk = (a) => !!a && ACTION_LEAD_RE.test(String(a).trim()) && !actionProblem(a);

// 形煞的動作（依形煞種類）
const SHA_ACTION = {
  路沖: '門口設玄關櫃或屏風，擋住直沖的氣',
  天斬煞: '面向天斬的窗加窗簾，平時少開',
  反弓路: '面路的窗加窗簾，門口放屏風緩衝',
  壁刀: '面向壁刀的窗加窗簾或霧面貼',
  電塔變電: '面向電塔的窗加窗簾，床遠離那一側',
  高架橋: '面向高架橋的窗加窗簾、裝氣密窗',
  尖角屋角: '面向尖角的窗加窗簾或霧面貼',
  廟宇教堂: '面向廟宇的窗加窗簾，床不正對那一側',
  醫院殯葬: '面向醫院殯葬的窗加窗簾，平時少開',
};
// 大門納衰氣：依門宮向星的五行洩（二五宮一律金）
const DOOR_QI_ACTION = {
  木: '門墊用紅色或紫色，玄關燈保持明亮',
  水: '玄關擺綠色闊葉盆栽，門墊用綠色',
  火: '門墊用黃色或米色，玄關擺陶瓷器物',
  土: DOOR_METAL,
};
const CELL_ACTION = {
  土: '放銅葫蘆或六帝錢，這一方保持安靜',
  木: '擺紅色或紫色擺件，少放綠色植物',
  水: '擺綠色闊葉盆栽，少放魚缸與水景',
  火: '擺陶瓷或黃色擺件，少用紅色與長明燈',
};
// A4：同宮要收斂火氣時，火的動作改用這幾句（不加火）
const DOOR_QI_CALM = '門墊用素色，玄關保持明亮、不堆雜物';
const CELL_CALM_WOOD = '保持這一方安靜整潔，不堆雜物';

/* ---- A4：同宮要收斂火氣（廚房在震巽離兌、大門游年五鬼、或別條明講少用紅色） ---- */
const FIRE_QUIET_RULES = ['kitchen-wood', 'kitchen-li', 'kitchen-dui'];
/**
 * A4：這一宮有沒有「收斂火氣、少用紅色」的條目。skip＝自己那幾條規則（不算自己）。
 * 看內局、外局的條目（規則名、fix 與 action 裡否定火的說法）與八宅的大門游年五鬼。
 */
function fireQuiet(ctx, p, skip = []) {
  if (!ctx || !p) return false;
  const sk = Array.isArray(skip) ? skip : [skip];
  const its = [...((ctx.interior && ctx.interior.items) || []), ...((ctx.exterior && ctx.exterior.items) || [])]
    .filter((it) => it && it.palace === p && !sk.includes(it.rule));
  if (its.some((it) => FIRE_QUIET_RULES.includes(it.rule))) return true;
  const dr = ctx.door || (ctx.bazhai && ctx.bazhai.door) || null;
  if (dr && dr.palace === p && dr.star === '五鬼' && !sk.includes('door')) return true;
  return its.some((it) => negFamiliesOf(`${it.fix || ''}${it.action ? `。${it.action}` : ''}`).includes('火'));
}

/* ---- A8：大門的八宅做法與門宮向星 ---- */
const DOOR_PLAIN = '玄關保持乾淨整潔，門口不堆雜物';
/**
 * A8：大門落在游年凶方時，八宅那一條的五行（e8＝洩游年凶星的五行）能不能用：
 *   門宮向星失令（不在生旺）→ 排除會生旺那顆向星的五行（向星三碧失令就不用水）；
 *   門宮向星衰死煞（內局有「大門納…」那一條）→ 另排除跟玄空那一條的五行（ex）相剋的五行。
 * 回 { palace, star, f, fQi, e8, ex, feeds, clash, excluded, avoid:Set }；不是凶門、門宮有二五（兩派都只用金）回 null。
 */
function doorViewOf(ctx) {
  const door = ctx && (ctx.door || (ctx.bazhai && ctx.bazhai.door));
  if (!door || !door.palace || !YOUNIAN[door.star] || YOUNIAN[door.star].luck !== '凶') return null;
  const cells = ctx.cells || {};
  const p = door.palace;
  const c = cells[p];
  const cur = ctx.curPeriod || (ctx.xuankong && ctx.xuankong.curPeriod);
  if (!c || !cur || has25(cells, p, cur)) return null;
  const e8 = SHENG[YOUNIAN[door.star].wx];
  const fwx = STAR_WX[c.f];
  const feeder = SHENG_QI.includes(c.fQi) ? null : (Object.keys(SHENG).find((x) => SHENG[x] === fwx) || null);
  const items = (ctx.interior && ctx.interior.items) || [];
  const dq = items.find((it) => it && it.rule === 'door-facing-qi' && it.palace === p && it.delta < 0);
  const ex = dq ? SHENG[fwx] : null;
  const avoid = new Set();
  if (feeder) avoid.add(feeder);
  if (ex) for (const x of Object.keys(KE)) if (KE[x] === ex || KE[ex] === x) avoid.add(x);
  return {
    palace: p, star: door.star, f: c.f, fQi: c.fQi, e8, ex,
    feeds: feeder === e8, clash: !!ex && (KE[e8] === ex || KE[ex] === e8), excluded: avoid.has(e8), avoid,
  };
}
/** A8：八宅那一條被排除時的說明（不寫「用X來洩」「不用X」，免得被同宮比對當成用了或否定了某一行） */
function doorDifferNote(dv) {
  const head = dv.ex
    ? `八宅依游年${dv.star}取${dv.e8}，玄空依門宮向星${sn(dv.f)}取${dv.ex}，${dv.e8}與${dv.ex}${dv.clash ? '相剋' : '不合'}，兩派看法不同。`
    : `門宮向星${sn(dv.f)}失令，八宅依游年${dv.star}取${dv.e8}，${dv.e8}卻會生旺${sn(dv.f)}，兩派看法不同。`;
  return `${head}這一條改以玄關整潔為主，暫不擺${dv.e8}屬的物品，兩條都列、不替你選邊。`;
}
/** A8：一段大門的做法拿掉用到被排除五行的句子（連殘句） */
function doorAvoidText(text, dv) {
  const out = [];
  for (const s of sentences(text)) {
    if (!familiesOf(s).some((f) => dv.avoid.has(f))) { out.push(s); continue; }
    const dot = /。$/.test(s);
    const cls = clausesOf(s.replace(/。$/, '')).filter((c) => !familiesOf(c).some((f) => dv.avoid.has(f))
      && !PRINCIPLE_ONLY_RE.test(c.trim()) && !Object.keys(RESIDUE_RE).some((f) => dv.avoid.has(f) && RESIDUE_RE[f].test(c)));
    const t = cls.join('').replace(/^[，；\s]+/, '').replace(/[，；、\s]+$/, '');
    if (t && VERB_RE.test(t) && !/^[^，；]*：$/.test(t)) out.push(dot ? endDot(t) : t);
  }
  return out.join('');
}

/**
 * Z1：規則代碼 → 動作（15～28 字、能照做）。a＝actCtx() 的結果：
 *   { ctx, p, c, cur, is25, mWang, water, rooms, room, star, feature, rule, pattern, plan, floorAction, differ }
 * 依該宮二五、山星當運、能不能放水、房間狀況給不同版本；回 '' 表示表裡沒有（呼叫的人走退路）。
 */
export const ACTIONS = Object.freeze({
  kong: () => KONG_ACTION,
  pattern: (a) => patternFixOf(a.ctx, a.pattern).action || '',
  prison: (a) => (a.is25 ? '放一組六帝錢，中宮保持開闊、安靜' : '中宮保持開闊、不堆雜物，動線通暢'),
  fuyin: () => '二五所到的宮少動土，各宮依星的五行洩化',
  door: (a) => {
    if (a.is25) return DOOR_METAL;
    // A8：八宅的五行會生旺失令的門宮向星、或跟玄空門宮那一條相剋 → 不帶五行的做法（兩條都列、看法不同）
    const dv = a.ctx && a.p ? doorViewOf(a.ctx) : null;
    if (dv && dv.palace === a.p && dv.excluded) return DOOR_PLAIN;
    if (a.star === '絕命' && !a.water) return '門墊改用藍色或黑色，玄關保持乾淨整潔';
    // A6：雙星同宮可以放水，取「先見水、水外有山」
    if (a.star === '絕命' && a.both) return '玄關放一杯靜水，水的後方靠實牆或高櫃';
    return DOOR_ACTION[a.star] || DOOR_METAL;
  },
  master: (a) => masterFixOf(a.ctx).action,
  // A9：帶方位——灶座移到游年凶方、灶口朝游年吉方（取最吉的兩方）
  // L1：凶方只取 stoveTargets 排好的（排除二五、臥室、大門、神位、廁所、中宮）；全部排除時只講灶口
  stove: (a) => stoveActionOf(a.ctx),
  'stove-mouth': (a) => `灶口轉向游年吉方（${goodDirsText(a.ctx.lucky)}）`,
  cell: (a) => {
    if (a.is25 || !a.c) return METAL_ACTION;
    const wx = STAR_WX[worstStar(a.c)];
    if (wx === '金') return a.water ? '放一杯靜水，這一方少放金屬利器' : '這一方保持安靜，少放金屬利器';
    // A4：同宮要收斂火氣，不擺紅紫色
    if (wx === '木' && a.noFire) return CELL_CALM_WOOD;
    return CELL_ACTION[wx] || METAL_ACTION;
  },
  'annual-5': () => METAL_ACTION,
  'annual-2': () => METAL_ACTION,
  merge25: (a) => {
    if (a.p === '中' && a.prison) return '放一組六帝錢，中宮保持開闊、安靜';
    const rs = a.rooms || [];
    if (rs.includes('魚缸')) return '魚缸先關掉打氣、縮小水量，放銅葫蘆';
    if (a.c && a.c.isDoor) return DOOR_METAL;
    if (rs.includes('廚房')) return '爐灶旁放銅葫蘆或六帝錢，爐火不空燒';
    if (rs.includes('廁所')) return '放銅葫蘆或六帝錢，廁所門常關、保持乾燥';
    if (rs.some((r) => BED_ROOMS.includes(r))) return '床頭附近放銅葫蘆或六帝錢，房內保持安靜';
    if (rs.includes('神明廳')) return '香爐燭台改用銅製品，神桌保持整潔';
    if (rs.includes('樓梯') || rs.includes('電梯')) return '梯口放銅葫蘆或六帝錢，保持整潔安靜';
    return METAL_ACTION;
  },
  floor: (a) => a.floorAction || '',
  'people-bed': (a) => {
    const pl = a.plan || {};
    if (a.differ) return '床頭轉向個人吉方，不必為此移床';
    if (pl.master) return masterFixOf(a.ctx).action;
    const t = Array.isArray(pl.targets) ? pl.targets : [];
    if (t.length) return `床移到${dirOf(t[0])}，移不了先轉床頭`;
    return '床頭轉向個人吉方，床靠吉方那一側';
  },
  'people-head': () => '床頭轉向個人吉方，床頭靠實牆',
  // 內局
  'wetfire-younian-good': (a) => (a.room === '廚房' ? '爐火不空燒，廚房保持通風整潔' : '廁所門常關、馬桶蓋蓋上，保持乾燥'),
  'wetfire-facing-prosperous': (a) => (a.room === '廚房' ? '爐台保持整潔，廚房走道保持通暢' : '廁所門常關、保持乾淨乾燥，不堆雜物'),
  'wetfire-mountain-prosperous': (a) => `${a.room === '廚房' ? '爐火不空燒、保持通風' : '廁所門常關、保持乾燥'}${a.p === '中' ? '' : '，靠牆放厚重櫃子'}`,
  'kitchen-star-2-5': () => '爐灶旁放銅葫蘆或六帝錢，爐火不空燒',
  'kitchen-qian': (a) => (qianStoveOk(a.ctx) ? QIAN_STOVE_ACTION : '裝修時爐灶避開西北角，先用黃米色陶瓷'),
  'kitchen-dui': () => '廚房改用黃米咖啡色系，擺陶瓷器皿',
  'kitchen-kan': () => '爐具與水槽之間留檯面，擺綠色植物',
  'kitchen-li': () => '廚房保持通風、爐火不空燒，避免大紅色',
  'kitchen-wood': () => '廚房保持通風、爐火不空燒，用淺色系',
  'kitchen-earth': () => '廚房保持通風整潔，爐火不空燒',
  'kitchen-center': () => '爐灶靠外牆，中心區改用白色金屬色用品',
  'toilet-li': () => '廁所擺耐陰綠色盆栽，門常關、保持乾燥',
  'toilet-earth': () => '廁所放金屬置物架或銅製品，門常關',
  'toilet-metal': () => '廁所改用黃米色系、放陶瓷器皿，門常關',
  'toilet-kan': () => '廁所擺耐陰綠色盆栽，保持除濕通風',
  'toilet-wood': () => '廁所門常關，保持乾燥通風',
  'toilet-center': () => '廁所門常關、馬桶蓋蓋上，抽風機常開',
  'stairs-center': (a) => (a.room === '電梯' ? '電梯口加屏風或矮櫃，緩衝氣流' : '樓梯口加屏風或矮櫃，梯下不堆雜物'),
  'stairs-star-5': (a) => `${a.room === '電梯' ? '電梯口' : '樓梯間'}放銅葫蘆或六帝錢，保持整潔`,
  'bedroom-younian-bad': (a) => (a.differ ? '床頭朝睡的人的個人吉方，不必為此換房' : '床頭朝個人吉方，床靠房內吉方那一側'),
  'bedroom-mountain-2-5': () => '床頭附近放銅葫蘆或六帝錢，房內保持安靜',
  'altar-younian-bad': (a) => {
    const t = pickTargets('altar', a.ctx, { from: a.p, base: 'house' });
    return t.length ? `神位擇日改到${dirOf(t[0])}，背後靠實牆` : '神桌保持整潔，背後靠實牆、不靠廁所';
  },
  'altar-star-2-5': () => '香爐燭台改用銅製品，神桌保持整潔',
  'fish-mountain-prosperous': (a) => {
    // A6（內局 B1）：雙星同宮不撤，取「先見水、水外有山」
    if (a.both) return '把高櫃放在魚缸背後（水外有山），打氣調小';
    const t = pickTargets('fish', a.ctx, { from: a.p });
    const tail = a.p === '中' ? '原位保持開闊' : '原位放厚重櫃子';
    return t.length ? `魚缸移到${dirOf(t[0])}，${tail}` : `魚缸撤掉或先關掉打氣，${tail}`;
  },
  'fish-star-5': () => '魚缸先關掉打氣、縮小水量，放銅葫蘆',
  // 內局 B2：魚缸所在宮不宜放水（向星死氣煞氣、已有廁所之水）——規則條目自己帶 action，表裡的是備案
  'fish-water-bad': (a) => {
    const t = pickTargets('fish', a.ctx, { from: a.p });
    return t.length ? `魚缸移到${dirOf(t[0])}，移不了先關掉打氣` : '撤掉魚缸，撤不了先關掉打氣、縮小水量';
  },
  'door-facing-qi': (a) => {
    if (a.is25) return DOOR_METAL;
    const wx = STAR_WX[a.star || (a.c && a.c.f)];
    if (wx === '金') return a.water ? '門口放一杯靜水，門墊用藍色或黑色' : '門墊用黑色或深藍色，門口保持安靜';
    // A4：同宮要收斂火氣（廚房在震巽離兌、大門游年五鬼、別條少用紅色）→ 不加火
    if (wx === '木' && a.noFire) return DOOR_QI_CALM;
    return DOOR_QI_ACTION[wx] || DOOR_METAL;
  },
  // 外局
  'xuanwu-kong': () => '坐方靠牆放高櫃或書櫃，補「靠山」',
  'zhuque-bipo': (a) => (a.c && a.c.isDoor ? '門口設玄關櫃或屏風，緩衝前方壓迫' : '向方窗戶加窗簾或霧面貼，減少壓迫感'),
  'baihu-angtou': () => '白虎方的窗加窗簾、少開，保持安靜',
  'baihu-dong': () => '白虎方的窗加窗簾，少從那一側進出',
  'qinglong-bu': () => '青龍方多開窗、保持通暢，多走動',
  'zhengshen-shui': () => '面水那一側的窗加窗簾或霧面貼',
  'lingshen-shi': (a) => (a.water && a.c && !SHENG_QI.includes(a.c.mQi) ? '屋內這一方擺小型水景，保持通透' : '屋內這一方保持通風、不堆雜物'),
  'wangshan-shui': () => '面水的窗加窗簾，屋內靠牆放高櫃',
  // A6：雙星同宮可以放水，取「先見水、水外有山」
  'wangxiang-shi': (a) => (a.water ? (a.both ? '屋內這一方擺小型流水，後方靠實牆或高櫃' : '屋內這一方擺小型流水，保持開闊') : '屋內這一方保持開闊、動線通暢'),
  sha: (a) => SHA_ACTION[a.feature] || '面向形煞的窗加窗簾或霧面貼',
  'sha-52': (a) => (a.is25 ? METAL_ACTION : (SHA_ACTION[a.feature] || '面向形煞的窗加窗簾或霧面貼')),
  'sha-door': () => '門口設玄關櫃或屏風，讓氣迴旋再入',
});

/** Z1：查表要用的東西（p＝宮位；extra：room、star、feature、rule、pattern、plan、floorAction、differ…） */
function actCtx(ctx, p, extra = {}) {
  const cur = ctx.curPeriod;
  const c = p && ctx.cells ? ctx.cells[p] || null : null;
  const fit = ctx.fit || {};
  return {
    ctx, p, c, cur,
    is25: !!p && has25(ctx.cells, p, cur),
    mWang: !!c && c.m === cur,
    water: !p || waterOk(p, ctx),
    // A6：雙星同宮（可以放水，但要先見水、水外有山）
    both: !!p && bothWangAt(p, ctx),
    // A4：同宮要收斂火氣（不算自己這一條規則）
    noFire: !!p && fireQuiet(ctx, p, extra.rule ? [extra.rule] : []),
    rooms: p && ctx.input && ctx.input.rooms ? (ctx.input.rooms[p] || []) : [],
    prison: !!(fit.prison && (fit.prison.mountain || fit.prison.facing)),
    ...extra,
  };
}
/**
 * Z1：規則代碼查動作。item.action（規則自己帶的）優先；表沒有回 ''。
 * 查到的動作要過白話規矩（actionLint）；這一宮不能放水時不收放水的動作。
 */
function actionFor(rule, a, own = '') {
  const ok = (s) => {
    const t = String(s || '').trim().replace(/[。！？]$/, '');
    if (!t || actionProblem(t)) return '';
    if (a && a.p && !a.water && positiveHit(t, WATER_PUT_RE)) return '';
    return t;
  };
  const mine = ok(own);
  if (mine) return mine;
  const f = ACTIONS[rule];
  if (typeof f !== 'function') return '';
  try {
    return ok(f(a));
  } catch (e) {
    return '';
  }
}
/** Z1：通用動作（表沒有、退路也挑不到時）：二五宮用金；大門那幾條保持玄關整潔；其他依凶源五行，沒有就保持整潔安靜 */
function genericAction(p, wx, src, rules = []) {
  const env = targetEnv(src);
  if (p && has25(env.cells, p, env.cur)) return METAL_ACTION;
  if (Array.isArray(rules) && rules.some((r) => r === 'door' || r === 'door-facing-qi')) return DOOR_PLAIN;
  return (CALM_BY_WX[wx] || CALM_DEFAULT).act;
}
/** A9：大門那一條（八宅門）的退路動作不收灶口、床頭、床位、爐灶的句子（知識庫門凶星的細項有「灶口朝吉方來補」） */
const DOOR_OFF_RE = /灶口|床頭|床位|爐灶|爐具/;
function offTopic(rules, a) {
  return Array.isArray(rules) && rules.includes('door') && !rules.includes('merge25') && DOOR_OFF_RE.test(String(a || ''));
}

/* ------------------------------------------------------------------ */
/* 1. 正規化輸入                                                         */
/* ------------------------------------------------------------------ */

/**
 * 補預設、清掉不認得的房間與外局代碼、度數收在 0～360、找出大門宮／主臥宮／灶宮。
 * warnings（選填）：傳一個陣列進來，整理時發現的問題會推進去。
 * 回傳的物件就是合約第 3 節的輸入形狀，另外多這些欄位：
 *   doorPalace（大門宮；九宮沒填大門或填在中宮時＝向宮）、doorSource（'房間'｜'向宮'｜'中宮'）、masterPalace、stovePalace、
 *   facingDefault（度數沒填或格式不對，暫用 180°）。options 多一個 wuTi（'none' 五黃無替｜'self' 取本山替星）。
 */
export function normalizeInput(raw, warnings = []) {
  const out = Array.isArray(warnings) ? warnings : [];
  const warn = (s) => { if (!out.includes(s)) out.push(s); };
  const src = isObj(raw) ? raw : {};
  if (!isObj(raw)) warn('沒有收到輸入資料，全部以預設值計算。');

  // 向度
  let facingDeg = 180;
  let facingDefault = false;
  const fdn = numLike(src.facingDeg) ? Number(src.facingDeg) : NaN;
  if (Number.isFinite(fdn)) {
    facingDeg = Math.round(norm(fdn) * 100) / 100;
    if (facingDeg >= 360) facingDeg = 0;
  } else {
    facingDefault = true;
    warn('沒有填大門朝向的度數（或格式不對），暫以 180°（坐北朝南）計算；請回第 1 步量好再看報告。');
  }

  // 元運、入住年
  let period = null;
  if (!blank(src.period) && src.period !== 'auto' && src.period !== 0 && src.period !== '0') {
    period = toInt(src.period, 1, 9);
    if (period === null) warn('元運只能是 1～9，已改成自動判斷。');
  }
  let moveInYear = null;
  if (!blank(src.moveInYear)) {
    moveInYear = toInt(src.moveInYear, 1800, 2200);
    if (moveInYear === null) warn('入住年的格式不對（要 4 位數的西元年），已當作沒填。');
  }

  // 樓層
  let floor = null;
  if (!blank(src.floor)) {
    floor = toInt(src.floor, -20, 300);
    if (floor === 0) floor = null;
    if (floor === null) warn('樓層的格式不對，已當作沒填。');
  }
  let totalFloors = null;
  if (!blank(src.totalFloors)) {
    totalFloors = toInt(src.totalFloors, 1, 300);
    if (totalFloors === null) warn('總樓層的格式不對，已當作沒填。');
  }

  // 流年基準日
  let date = null;
  if (src.date !== null && src.date !== undefined) {
    const d = isObj(src.date) ? src.date : {};
    const y = toInt(d.y, 1900, 2100);
    const m = toInt(d.m, 1, 12);
    const dd = toInt(d.d, 1, 31);
    if (y && m && dd && dd <= daysIn(y, m)) date = { y, m, d: dd };
    else warn('今天的日期格式不對，流年流月一段略過。');
  }

  // 居住者
  let rawPeople = [];
  if (Array.isArray(src.people)) rawPeople = src.people;
  else if (!blank(src.people)) warn('居住者資料的格式不對，已略過。');
  if (rawPeople.length > PERSON_MAX) {
    warn(`居住者最多 ${PERSON_MAX} 位，第 ${PERSON_MAX + 1} 位以後已略過。`);
    rawPeople = rawPeople.slice(0, PERSON_MAX);
  }
  const people = rawPeople.map((p, i) => {
    const o = isObj(p) ? p : {};
    const label = typeof o.label === 'string' && o.label.trim()
      ? o.label.trim().slice(0, 12)
      : (i === 0 ? '戶主' : `成員${i + 1}`);
    let gender = null;
    if (o.gender === 'M' || o.gender === 'm' || o.gender === '男') gender = 'M';
    else if (o.gender === 'F' || o.gender === 'f' || o.gender === '女') gender = 'F';
    return {
      label,
      year: toInt(o.year, 1800, 2200),
      month: toInt(o.month, 1, 12),
      day: toInt(o.day, 1, 31),
      gender,
      bedPalace: toPalace(o.bedPalace, true),
      bedHead: toPalace(o.bedHead, false),
    };
  });

  // 房間
  const srcRooms = isObj(src.rooms) ? src.rooms : {};
  const rooms = {};
  const badRooms = [];
  for (const k of Object.keys(srcRooms)) {
    if (ALL_PALACES.includes(k)) continue;
    const v = srcRooms[k];
    if (Array.isArray(v) ? v.length : !blank(v)) warn(`房間資料裡有不認得的宮位「${k}」，已略過。`);
  }
  for (const p of ALL_PALACES) {
    const arr = Array.isArray(srcRooms[p]) ? srcRooms[p] : [];
    const list = [];
    for (const r of arr) {
      if (typeof r === 'string' && has(ROOM_TYPES, r)) {
        if (!list.includes(r)) list.push(r);
      } else if (!blank(r) && !badRooms.includes(String(r))) {
        badRooms.push(String(r));
      }
    }
    list.sort((a, b) => ROOM_KEYS.indexOf(a) - ROOM_KEYS.indexOf(b));
    rooms[p] = list;
  }
  if (badRooms.length) warn(`有不認得的房間代碼（${badRooms.join('、')}），已略過。`);

  // 外局
  const srcExt = isObj(src.exterior) ? src.exterior : {};
  const exterior = {};
  const badExt = [];
  for (const k of Object.keys(srcExt)) {
    if (PALACES.includes(k)) continue;
    const v = srcExt[k];
    if (Array.isArray(v) ? v.length : !blank(v)) {
      warn(k === '中' ? '外局不看中宮，中宮填的外局已略過。' : `外局資料裡有不認得的宮位「${k}」，已略過。`);
    }
  }
  for (const p of PALACES) {
    const arr = Array.isArray(srcExt[p]) ? srcExt[p] : [];
    const list = [];
    for (const k of arr) {
      if (typeof k === 'string' && has(EXT_TYPES, k)) {
        if (!list.includes(k)) list.push(k);
      } else if (!blank(k) && !badExt.includes(String(k))) {
        badExt.push(String(k));
      }
    }
    list.sort((a, b) => EXT_KEYS.indexOf(a) - EXT_KEYS.indexOf(b));
    exterior[p] = list;
  }
  if (badExt.length) warn(`外局有不認得的代碼（${badExt.join('、')}），已略過。`);

  // 灶口
  const stoveMouth = toPalace(src.stoveMouth, false);
  if (!blank(src.stoveMouth) && !stoveMouth) warn('灶口朝向只能是八個方位之一，已當作沒填。');

  // 選項
  const opt = isObj(src.options) ? src.options : {};
  const bazhaiMode = opt.bazhaiMode === 'door' ? 'door' : 'sit';
  if (!blank(opt.bazhaiMode) && opt.bazhaiMode !== 'door' && opt.bazhaiMode !== 'sit') {
    warn('八宅模式只能是坐山立極或門上起伏位，已改用坐山立極。');
  }
  let tigua = 'auto';
  if (opt.tigua === 'on' || opt.tigua === true) tigua = 'on';
  else if (opt.tigua === 'off' || opt.tigua === false) tigua = 'off';
  else if (!blank(opt.tigua) && opt.tigua !== 'auto') warn('替卦設定只能是自動、用替卦或用下卦，已改成自動。');
  let wuTi = 'none';
  if (opt.wuTi === 'self') wuTi = 'self';
  else if (!blank(opt.wuTi) && opt.wuTi !== 'none') warn('替卦遇五黃的設定只能是五黃無替或取本山替星，已改用五黃無替。');

  // 大門宮、主臥宮、灶宮
  const cx = describeFacing(facingDeg);
  const fp = cx.facingPalace;
  let doorPalace = findPalace(rooms, '大門');
  let doorSource = '房間';
  if (doorPalace === '中') {
    // G5：大門填在中宮另記 doorSource＝'中宮'（報告與 LINE 寫「大門填在中宮無法定方位，以向宮計」，不寫「九宮沒填大門」）
    warn(`${DOOR_CENTER_NOTE}（${PALACE_INFO[fp].dir}方${fp}宮）。`);
    doorPalace = fp;
    doorSource = '中宮';
  }
  if (!doorPalace) {
    doorPalace = fp;
    doorSource = '向宮';
  }
  const masterPalace = findPalace(rooms, '主臥');
  const stovePalace = findPalace(rooms, '廚房');

  return {
    facingDeg,
    facingDefault,
    period,
    moveInYear,
    floor,
    totalFloors,
    date,
    people,
    rooms,
    stoveMouth,
    exterior,
    options: { bazhaiMode, tigua, wuTi },
    doorPalace,
    doorSource,
    masterPalace,
    stovePalace,
  };
}

/* ------------------------------------------------------------------ */
/* 2. 玄空：起星推法的白話（讓懂行的人能驗算）                            */
/* ------------------------------------------------------------------ */

function deriveText(ch, role) {
  const isM = role === 'm';
  const center = isM ? ch.mountainCenter : ch.facingCenter;
  const palace = isM ? ch.sitP : ch.faceP;
  const own = isM ? ch.sitM : ch.faceM;
  const side = isM ? '坐' : '向';
  const roleName = isM ? '山星' : '向星';
  const n = center.from;
  const ref = center.refMount;
  const yy = MOUNT_YINYANG[ref];
  const way = center.forward ? '順飛' : '逆飛';
  const s = [];
  if (n === 5) {
    s.push(`運盤${side}宮（${palace}宮）是五，五居中宮沒有卦，改看${side}山${own}本身，${own}屬${yy}。`);
  } else {
    const gua = PALACE_BY_LUO[n];
    const yuanName = YUAN_NAME[ch.yuan] || '';
    s.push(`運盤${side}宮（${palace}宮）是${CN[n]}，${CN[n]}屬${gua}卦。`);
    s.push(`${side}山${own}是${yuanName}，${gua}卦的${yuanName}是${ref}山，${ref}屬${yy}。`);
  }
  if (ch.tigua) {
    if (center.wuNoTi) {
      s.push(`替卦：五黃無替，仍以五入中，順逆看${own}山本身，所以${roleName}五入中${way}。`);
    } else if (center.replaced) {
      s.push(`替卦：${ref}山依口訣「${TI_VERSE[center.star] || ''}」取${sn(center.star)}（${STAR_ALIAS[center.star]}）。`);
      s.push(`改以${CN[center.star]}入中，順逆仍看${ref}山（${yy}），所以${roleName}${CN[center.star]}入中${way}。`);
      if (n === 5) s.push('五黃取本山替星是另一派的做法，通行教本多採五黃無替。');
    } else {
      s.push(`替卦：${ref}山依口訣仍是${sn(n)}，無替可尋，與下卦相同，${roleName}${CN[n]}入中${way}。`);
    }
  } else {
    s.push(`陽順陰逆，所以${roleName}${CN[n]}入中${way}。`);
  }
  return s.join('');
}

function chartBrief(ch) {
  const m = ch.mountainCenter;
  const f = ch.facingCenter;
  return `山星${CN[m.star]}入中${m.forward ? '順' : '逆'}飛、向星${CN[f.star]}入中${f.forward ? '順' : '逆'}飛，格局${ch.pattern}`;
}

/** 星在某一張盤（{宮:星}）的哪一宮 */
function palaceOfStar(board, star) {
  if (!board) return null;
  return ALL_PALACES.find((p) => board[p] === star) || null;
}

/* ------------------------------------------------------------------ */
/* 3. 九宮吉凶（用現在的運重判的 mQi／fQi；comboOf 的 luck 只當參考）     */
/* ------------------------------------------------------------------ */

function cellLuck(c, period) {
  const T = ['旺氣', '生氣'];
  const D = ['死氣', '煞氣'];
  if (T.includes(c.mQi) && T.includes(c.fQi)) return { luck: '吉', why: '山星向星都生旺' };
  if ((c.m === 5 || c.f === 5) && period !== 5) return { luck: '凶', why: '含五黃，五黃不當運以凶論' };
  if (D.includes(c.mQi) && D.includes(c.fQi)) return { luck: '凶', why: '山星向星都屬死氣或煞氣' };
  // A7：兩星都不在生旺（但不是兩顆死煞）→ 照實寫兩星的旺衰，不寫「旺衰互見」
  if (!T.includes(c.mQi) && !T.includes(c.fQi)) {
    const qs = uniq([c.mQi, c.fQi]).map((q) => String(q).replace(/氣$/, ''));
    return { luck: '平', why: `兩星都失令（${qs.join('、')}），凶性較輕` };
  }
  return { luck: '平', why: '旺衰互見，吉凶要看實際怎麼用' };
}

/** 凶宮要化解時，挑哪一顆星的化解法：先五黃、再二黑、再旺衰最差的 */
function worstStar(c) {
  if (c.m === 5 || c.f === 5) return 5;
  if (c.m === 2 || c.f === 2) return 2;
  const rank = (q) => QI_ORDER.indexOf(q);
  return rank(c.mQi) >= rank(c.fQi) ? c.m : c.f;
}

/** 凶宮的輕重：二五同宮最重、再五黃、再二黑；同樣輕重時大門、坐、向優先 */
function cellRank(c) {
  const s = [c.m, c.f];
  const r = s.includes(2) && s.includes(5) ? 0 : s.includes(5) ? 1 : s.includes(2) ? 2 : 3;
  return r * 2 + (c.isDoor || c.isSit || c.isFace ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* 4. 主流程                                                            */
/* ------------------------------------------------------------------ */

/**
 * 產生完整報告（合約第 6 節＋第 11 節）。絕不丟例外。
 */
export function analyze(rawInput, opts) {
  try {
    return build(rawInput, opts);
  } catch (err) {
    return fallbackReport(rawInput, err);
  }
}

/** opts.gate＝false：不跑 G0 閘門（只給測試比對「閘門前有違規、閘門後沒有」用；畫面不用） */
function build(raw, opts = {}) {
  const warnings = [];
  const warn = (s) => { if (s && !warnings.includes(s)) warnings.push(s); };
  const input = normalizeInput(raw, warnings);
  const cx = describeFacing(input.facingDeg);

  /* ---- 流年基準日 → 節氣年月 ---- */
  let solar = null;
  if (input.date) {
    const { y, m, d } = input.date;
    const sy = solarYearByLichun(y, m, d);
    const sm = solarMonthIndex(y, m, d);
    solar = { year: sy, month: sm.month, monthYear: sm.year };
  }

  /* ---- 元運：指定 > 入住年 > 今年 ---- */
  let period;
  let periodSource;
  if (input.period) {
    period = input.period;
    periodSource = '指定';
  } else if (input.moveInYear) {
    period = periodOf(input.moveInYear);
    periodSource = '入住年';
  } else if (solar) {
    period = periodOf(solar.year);
    periodSource = '今年';
    warn(`沒有填入住年，元運暫用今年推算為${CN[period]}運；舊房子請補填入住或大修的年份。`);
  } else {
    period = 9;
    periodSource = '預設';
    warn('沒有入住年也沒有今天的日期，元運暫以九運（2024–2043）計算。');
  }
  // R2：入住年比今天還晚 → 提醒確認；不論交運（盤與旺衰都用入住那一運），不寫現已入、換天心
  // T18：用西元年比（input.date.y），入住年是西元年；立春前同一年入住不算「比今天晚」
  const futureMoveIn = !!(solar && input.date && input.moveInYear && input.moveInYear > input.date.y);
  // 同一年立春前（節氣年還是去年）：不算未來，但現運也不能倒回去年那一運
  const sameYearBeforeLichun = !!(solar && input.moveInYear && !futureMoveIn && input.moveInYear > solar.year);
  // T18：指定元運時，「暫以…論」寫指定的那一運
  const basisWord = periodSource === '指定' ? `指定的${CN[period]}運` : '入住那一運';
  if (futureMoveIn) {
    warn(`入住年比今天晚，請確認（填的是 ${input.moveInYear} 年，今年是 ${input.date.y} 年）；這份報告暫以${basisWord}起盤、判旺衰。`);
  }
  // D1：現在的運（旺衰、當運山向星、零正神都用這個）；沒有日期（或入住年在未來）就用盤運
  const curPeriod = solar && !futureMoveIn && !sameYearBeforeLichun ? periodOf(solar.year) : period;
  const changed = curPeriod !== period;
  // T18：元運年份依參考年所在的 180 年循環（入住 2045 是 2044–2063，不是 1864–1883）
  const refYear = input.moveInYear || (solar ? solar.year : null);
  const compass = {
    ...cx,
    period,
    periodName: PERIOD_NAMES[period],
    // G1：指定元運取離參考年最近的一輪（入住年、今年推的運本來就包含參考年）
    periodRange: periodRangeNear(period, refYear, periodSource === '指定'),
    periodBasis: basisWord,
    periodSource,
    curPeriod,
    curPeriodName: PERIOD_NAMES[curPeriod],
    tentative: !!input.facingDefault,
    futureMoveIn,
  };

  /* ---- 玄空：下卦主盤＋（兼向、騎線時）替卦盤 ---- */
  const wuTi = input.options.wuTi;
  const main = chart(input.facingDeg, period, { tigua: false });
  const jian = cx.kind === '兼向' || cx.kind === '騎線';
  const ti = jian ? chart(input.facingDeg, period, { tigua: true, wuTi }) : null;
  const tgMode = input.options.tigua;
  const useTi = !!ti && tgMode !== 'off';
  const active = useTi ? ti : main;
  const activeName = useTi ? '替卦' : '下卦';
  const tiSame = !!ti && !ti.mountainCenter.replaced && !ti.facingCenter.replaced;

  // D2：替卦遇運盤五黃（五黃無替 vs 取本山替星）
  const tiNone = !ti ? null : (wuTi === 'none' ? ti : chart(input.facingDeg, period, { tigua: true, wuTi: 'none' }));
  const wuHit = !!tiNone && !!(tiNone.mountainCenter.wuNoTi || tiNone.facingCenter.wuNoTi);
  const wuAltChart = wuHit ? chart(input.facingDeg, period, { tigua: true, wuTi: wuTi === 'none' ? 'self' : 'none' }) : null;

  // D1：建宅格局與現運格局
  const buildFit = periodFit(active, period);
  const currentFit = changed ? periodFit(active, curPeriod) : buildFit;
  const fit = changed ? currentFit : buildFit;
  const wuAltPattern = wuAltChart ? periodFit(wuAltChart, changed ? curPeriod : period).pattern : null;
  const curCells = cellsFor(active, curPeriod);
  const zhengshen = PALACE_BY_LUO[curPeriod] || null;
  const lingshen = PALACE_BY_LUO[10 - curPeriod] || null;

  // [26]：上山下水（或上山、下水）時看外局能不能反為吉用
  const formsAt = (p) => (input.exterior[p] || []).map((k) => EXT_TYPES[k] && EXT_TYPES[k].form);
  const sitForms = formsAt(cx.sittingPalace);
  const faceForms = formsAt(cx.facingPalace);
  const sitWater = sitForms.includes('真水') || sitForms.includes('虛水');
  const faceShi = faceForms.includes('實');
  let daoqilong = null;
  if (fit.pattern === '上山下水' && sitWater && faceShi) daoqilong = { pattern: '上山下水', ...DAOQI.上山下水 };
  else if (fit.pattern === '下水' && faceShi) daoqilong = { pattern: '下水', ...DAOQI.下水 };
  else if (fit.pattern === '上山' && (sitWater || sitForms.includes('虛'))) daoqilong = { pattern: '上山', ...DAOQI.上山 };

  const xkParts = [];
  xkParts.push({ label: `格局基本分（${fit.pattern}）`, delta: fit.info.score });
  if (fit.prison.mountain) xkParts.push({ label: '山星入囚', delta: -3 });
  if (fit.prison.facing) xkParts.push({ label: '向星入囚', delta: -3 });
  if (active.fuyin.mountain) xkParts.push({ label: `山盤${active.fuyin.mountain}`, delta: -3 });
  if (active.fuyin.facing) xkParts.push({ label: `向盤${active.fuyin.facing}`, delta: -3 });
  if (active.heshiAll) xkParts.push({ label: active.heshiAll, delta: 2 });
  if (active.sanban) xkParts.push({ label: active.sanban, delta: 2 });
  if (cx.kongwang === '大空亡') xkParts.push({ label: '大空亡', delta: -6 });
  if (cx.kongwang === '小空亡') xkParts.push({ label: '小空亡', delta: -3 });
  const xkRaw = xkParts.reduce((a, p) => a + p.delta, 0);
  const xkScore = round1(clamp(xkRaw, 0, 25));

  const xkNotes = [];
  xkNotes.push(`以${activeName}盤為主：${chartBrief(active)}。`);
  if (changed) {
    xkNotes.push(`盤依入住時的${CN[period]}運起，現已入${CN[curPeriod]}運，格局分改以${CN[curPeriod]}運的令星計，是${fit.pattern}。`);
  }
  if (fit.prison.mountain) xkNotes.push(`${CN[fit.period]}運的山星入囚（令星在中宮），扣 3 分。`);
  if (fit.prison.facing) xkNotes.push(`${CN[fit.period]}運的向星入囚（令星在中宮），扣 3 分。`);
  if (active.fuyin.mountain) xkNotes.push(`山盤${active.fuyin.mountain}（五入中${active.fuyin.mountain === '伏吟' ? '順' : '逆'}飛），扣 3 分。`);
  if (active.fuyin.facing) xkNotes.push(`向盤${active.fuyin.facing}（五入中${active.fuyin.facing === '伏吟' ? '順' : '逆'}飛），扣 3 分。`);
  if (active.heshiAll) xkNotes.push(`${active.heshiAll}，加 2 分。`);
  if (active.sanban) xkNotes.push(`${active.sanban}，加 2 分。`);
  if (ti) {
    if (tiSame) {
      xkNotes.push(wuHit && wuTi === 'none' ? '替卦遇五黃無替，仍以五入中，與下卦相同。' : '替卦無替可尋，與下卦相同。');
    } else {
      const rp = [];
      if (ti.mountainCenter.replaced) rp.push(`山星由${CN[ti.mountainCenter.from]}替為${CN[ti.mountainCenter.star]}`);
      if (ti.facingCenter.replaced) rp.push(`向星由${CN[ti.facingCenter.from]}替為${CN[ti.facingCenter.star]}`);
      if (ti.mountainCenter.wuNoTi) rp.push('山星五黃無替');
      if (ti.facingCenter.wuNoTi) rp.push('向星五黃無替');
      xkNotes.push(`替卦：${rp.join('、')}。`);
    }
  }
  if (useTi && wuHit && wuAltPattern) {
    xkNotes.push(wuTi === 'none'
      ? `另一派取本山替星入中，格局會是${wuAltPattern}（參考，不計分）。`
      : `通行教本多採五黃無替，格局會是${wuAltPattern}（參考，不計分）。`);
  }
  if (tgMode === 'on' && !ti) xkNotes.push('向度在正向範圍內，只用下卦，替卦設定不適用。');
  if (tgMode === 'off' && ti) xkNotes.push('依設定以下卦盤為主，替卦盤另列參考。');
  if (cx.kongwang) xkNotes.push(`向度騎線（${cx.kongwang}），扣 ${cx.kongwang === '大空亡' ? 6 : 3} 分，建議重量。`);
  if (curPeriod === 5) xkNotes.push('五運零正神寄宮各家說法不同，本系統不論。');
  if (daoqilong) xkNotes.push(daoqilong.text);

  /* ---- 八宅：宅卦、游年、門主灶（D6：大門一律以坐山卦的游年判） ---- */
  const house = houseGua(cx.sittingPalace, input.doorPalace, input.options.bazhaiMode);
  const otherMode = input.options.bazhaiMode === 'door' ? 'sit' : 'door';
  const altHouse = houseGua(cx.sittingPalace, input.doorPalace, otherMode);
  const stars = younianStars(house.gua) || {};
  const sitStars = younianStars(cx.sittingPalace) || {};
  const lucky = luckyDirs(house.gua);
  const door = evaluateDoor(sitStars, input.doorPalace);
  const master = input.masterPalace && input.masterPalace !== '中' ? evaluateMaster(stars, input.masterPalace) : null;
  const stove = input.stovePalace && input.stovePalace !== '中'
    ? evaluateStove(stars, input.stovePalace, input.stoveMouth)
    : null;
  const doorScore = door ? door.score : 4.5;
  const masterScore = master ? round1((master.score / 9) * 8) : 4;
  const stoveScore = stove ? stove.score : 4;
  if (!door) warn('沒有大門宮的游年星，八宅「門」以 4.5 分計。');
  if (!input.masterPalace) warn('沒有填主臥，八宅「主」以 4 分計。');
  else if (input.masterPalace === '中') warn('主臥填在中宮，中宮沒有游年星可論，八宅「主」以 4 分計。');
  if (!input.stovePalace) warn('沒有填廚房，八宅「灶」以 4 分計。');
  else if (input.stovePalace === '中') warn('廚房填在中宮，中宮沒有游年星可論，八宅「灶」以 4 分計。');
  const bazhai = {
    house,
    mode: input.options.bazhaiMode,
    stars,
    doorStars: sitStars,
    doorBasis: 'sit',
    lucky,
    door,
    master,
    stove,
    parts: { door: doorScore, master: masterScore, stove: stoveScore },
    score: round1(clamp(doorScore + masterScore + stoveScore, 0, 25)),
    max: 25,
  };

  /* ---- 流年流月 ---- */
  let year = null;
  let month = null;
  if (solar) {
    const ts = taisui(solar.year);
    const sitM = cx.sitting.mount;
    const faceM = cx.facing.mount;
    year = {
      year: solar.year,
      ganzhi: ts.ganzhi,
      star: yearStar(solar.year),
      board: yearChart(solar.year),
      taisui: ts.taisui,
      suipo: ts.suipo,
      sansha: { ...ts.sansha, palaces: uniq(ts.sansha.mounts.map((m) => MOUNT_PALACE[m])) },
      // D3：用 24 山比坐山、向山（太歲可坐不可向；三煞可向不可坐）
      sitFace: {
        sitMount: sitM,
        faceMount: faceM,
        sitTaisui: sitM === ts.taisui.mount,
        faceTaisui: faceM === ts.taisui.mount,
        sitSansha: ts.sansha.mounts.includes(sitM),
        faceSansha: ts.sansha.mounts.includes(faceM),
      },
    };
    month = {
      index: solar.month,
      name: `${BRANCH_MONTH[solar.month - 1]}月`,
      jie: JIE_ORDER[solar.month - 1],
      star: monthStar(solar.monthYear, solar.month),
      board: monthChart(solar.monthYear, solar.month),
    };
  } else {
    warn('沒有帶入今天的日期，流年流月一段略過。');
  }

  const xuankong = {
    active,
    activeName,
    main,
    ti,
    useTi,
    pattern: fit.pattern,
    patternInfo: PATTERN_INFO[fit.pattern] || PATTERN_INFO.令星不到,
    buildPattern: buildFit.pattern,
    currentPattern: currentFit.pattern,
    curPeriod,
    changed,
    buildFit,
    currentFit,
    prison: currentFit.prison,
    wuTi,
    wuNoTi: wuHit,
    wuAltPattern,
    daoqilong: daoqilong ? { pattern: daoqilong.pattern, text: daoqilong.text } : null,
    score: xkScore,
    max: 25,
    parts: xkParts,
    notes: xkNotes,
    zhengshen,
    lingshen,
    year,
    month,
  };

  /* ---- 九宮合併（旺衰用現在的運） ---- */
  const bp = beastPalaces(input.facingDeg);
  const beastOf = {};
  for (const b of BEASTS) beastOf[bp[b]] = b;
  const cells = {};
  for (const p of ALL_PALACES) {
    const c = curCells[p];
    const yn = p === '中' ? null : (stars[p] || null);
    const lk = cellLuck(c, curPeriod);
    cells[p] = {
      palace: p,
      name: PALACE_TEXT[p].title,
      dir: PALACE_INFO[p].dir,
      luo: PALACE_INFO[p].luo,
      wx: PALACE_INFO[p].wx,
      younian: yn,
      younianInfo: yn ? YOUNIAN[yn] : null,
      // R8／D6：門上起伏位時，大門那一宮另外標「大門本身以坐山論」的游年星；其他情形 null（跟 younian 一樣就不重複）
      doorYounian: input.options.bazhaiMode === 'door' && p === input.doorPalace && p !== '中' ? (sitStars[p] || null) : null,
      yun: c.yun,
      m: c.m,
      f: c.f,
      mQi: c.mQi,
      fQi: c.fQi,
      heshi: c.heshi,
      yearStar: year ? year.board[p] : null,
      monthStar: month ? month.board[p] : null,
      rooms: input.rooms[p].slice(),
      ext: p === '中' ? [] : input.exterior[p].slice(),
      combo: comboOf(c.m, c.f, curPeriod),
      luck: lk.luck,
      luckWhy: lk.why,
      isDoor: p === input.doorPalace,
      isSit: p === cx.sittingPalace,
      isFace: p === cx.facingPalace,
      beast: beastOf[p] || null,
    };
  }

  /* ---- 居住者（內局換房要排除戶主個人凶方，所以排在內局前面） ---- */
  // Z4：先不帶 bedPlan 算一次，拿到每個人的命卦與床位（主臥換房計畫 bedOptions 要排除睡的人的個人凶方），
  //     再帶 bedPlan 算正式的；床在主臥那一宮、八宅又給了主臥換房計畫 → 居住者段用同一套（換到、對調或不建議）
  // L3：有二黑五黃（山向星或流年）的宮——居住者段吉方床位不寫推薦句，改寫看法不同
  const palace25 = Object.fromEntries(ALL_PALACES.filter((p) => has25(cells, p, curPeriod)).map((p) => [p, desc25(cells, p, curPeriod)]));
  const peopleArgs = { people: input.people, houseGroup: house.group, masterPalace: input.masterPalace, date: input.date, palace25 };
  const people0 = safe(() => evaluatePeople(peopleArgs), { score: 4, max: 7, people: [], warnings: [] }, [], '居住者');
  const owner0 = (people0.people || []).find((x) => x.isOwner) || null;
  const ownerStars = owner0 && owner0.gua ? (younianStars(owner0.gua) || {}) : null;

  /* ---- D7：主臥在宅卦凶方，但為戶主個人吉方或現運山星生旺 → 看法不同 ---- */
  let masterView = null;
  if (master && YOUNIAN[master.star].luck === '凶') {
    const c = cells[master.palace];
    const ownerStar = ownerStars ? ownerStars[master.palace] || null : null;
    const ownerGood = !!ownerStar && YOUNIAN[ownerStar].luck === '吉';
    const mGood = c.mQi === '旺氣' || c.mQi === '生氣';
    if (ownerGood || mGood) masterView = { ownerStar, ownerGood, mGood, m: c.m, mQi: c.mQi };
  }
  // L2：移床、換房目標的登記（{ 目標宮: 原宮 }），一宮只分給一間房；依主臥 → 居住者 → 內局臥室的順序登記
  const claims = {};
  // F4：原宮收中宮（中宮的臥室也會排換房目標）；目標只能是八宮
  const claim = (from, list) => {
    for (const q of list || []) if (PALACES.includes(q) && ALL_PALACES.includes(from) && !claims[q]) claims[q] = from;
  };
  const bedCtx = { input, cells, curPeriod, lucky, people: people0, claims };
  // Z4：主臥換房計畫（宅卦吉方 targets、只能對調的 swaps），八宅段與居住者段共用
  const masterPlan = master && YOUNIAN[master.star].luck === '凶' && !masterView ? bedOptions(bedCtx) : null;
  // 八宅段、居住者段都只列前兩個
  if (masterPlan) claim(input.masterPalace, masterPlan.targets.slice(0, 2));

  // X1：床在個人凶方時，移床的目標用 pickTargets('bed')；床位所在宮是宅卦吉方或現運山星生旺 → 看法不同、只給床頭
  // L2：睡的人＝床在這一宮的所有人（同床的配偶也算），名單以這一宮第一位睡的人的個人吉方排序（同床的人拿到同一份）；
  //     自己的吉方能去、但落在同床者個人凶方 → 看法不同、只調床頭；排好的目標登記，別間房不再排進來
  const bedPlan = (info) => {
    const p = info && info.palace;
    if (!PALACES.includes(p) || !cells[p]) return null;
    if (masterPlan && p === input.masterPalace) {
      return { targets: masterPlan.targets.slice(), swaps: masterPlan.swaps.map((s) => ({ ...s })), differ: null, master: true };
    }
    const c = cells[p];
    const hs = stars[p];
    const houseGood = !!(hs && YOUNIAN[hs] && YOUNIAN[hs].luck === '吉');
    const mGood = SHENG_QI.includes(c.mQi);
    if (houseGood || mGood) {
      const v = [];
      if (houseGood) v.push(`八宅宅卦看，這一宮是宅的游年${hs}方，屬吉。`);
      if (mGood) v.push(`玄空看，這一宮山星${sn(c.m)}屬${qiLabel(c.mQi)}，利人丁健康。`);
      return { targets: [], differ: v.join('') };
    }
    // Z5：小孩（稱呼含「小孩」）睡的床不移到 COMBOS kidBad 的宮
    const me = { label: info.label, lucky: info.lucky, bed: { palace: p } };
    const at = sleepersAt(targetEnv(bedCtx), p);
    const isMe = (x) => x.label === info.label && luckyKey(x.lucky) === luckyKey(info.lucky);
    const others = at.filter((x) => !isMe(x));
    const first = at.length ? (isMe(at[0]) ? me : at[0]) : me;
    const who = [first, ...[me, ...others].filter((x) => x !== first)];
    const targets = pickTargets('bed', bedCtx, { from: p, who, base: 'person' });
    if (!targets.length && others.length) {
      // 只看自己能去的宮（不管同床的人）——有的話就是同床者的個人凶方擋住的
      const solo = pickTargets('bed', bedCtx, { from: p, who: [me], base: 'person', solo: true });
      const hit = solo.filter((q) => others.some((x) => badPalacesOf([x]).includes(q)));
      if (hit.length) {
        const names = uniq(others.filter((x) => hit.some((q) => badPalacesOf([x]).includes(q))).map((x) => x.label)).join('、');
        return {
          targets: [],
          differ: `${info.label}個人吉方能當睡房的${where(hit[0])}${hit.length > 1 ? '等' : ''}，是同睡這一宮的${names}的個人凶方。`,
        };
      }
    }
    claim(p, targets.slice(0, 2));
    return { targets, differ: null };
  };
  const people = safe(
    () => evaluatePeople({ ...peopleArgs, bedPlan }),
    { score: 4, max: 7, people: [], warnings: [] }, warnings, '居住者',
  );
  // L2：移床、換房目標的登記跟著報告走（閘門、auditReport 重查時用同一份）
  if (people && typeof people === 'object') people.claims = claims;
  const owner = (people.people || []).find((x) => x.isOwner) || null;
  const ownerLucky = owner && owner.lucky
    ? { good: owner.lucky.good.map((g) => g.palace), bad: owner.lucky.bad.map((g) => g.palace) }
    : null;

  /* ---- 規則模組 ---- */
  const roomCount = ALL_PALACES.reduce((a, p) => a + input.rooms[p].length, 0);
  const extCount = PALACES.reduce((a, p) => a + input.exterior[p].length, 0);
  if (input.doorSource === '向宮' && roomCount > 0) {
    warn(`${DOOR_NONE_NOTE}（${PALACE_INFO[cx.facingPalace].dir}方${cx.facingPalace}宮）。`);
  }
  // T10：灶口朝向也交給內局（S6：廚房那一條直接講灶口要不要轉）
  const roomCtx = { cells, period: curPeriod, rooms: input.rooms, doorPalace: input.doorPalace, younian: stars, stoveMouth: input.stoveMouth };
  if (ownerLucky) roomCtx.ownerLucky = ownerLucky;
  // A3：每一宮睡的人（由居住者的床位算），臥室類用實際睡的人的命卦判
  roomCtx.sleepers = (people && people.sleepers) || sleepersMap(people && people.people);
  const interior = safe(
    () => evaluateRooms(roomCtx),
    { score: 10, max: 20, items: [], warnings: [] }, warnings, '內局',
  );
  // A11：外局也拿到房間（零神見山、旺向見山要不要建議放水，看這一宮有沒有廁所），exterior 的 item.action 本身就對
  const exterior = safe(
    () => evaluateExterior({
      facingDeg: input.facingDeg, cells, period: curPeriod, exterior: input.exterior,
      doorPalace: input.doorPalace, zhengshen, lingshen, rooms: input.rooms,
    }),
    { score: 12, max: 20, beasts: {}, items: [], warnings: [] }, warnings, '外局',
  );
  const floor = safe(
    () => evaluateFloor({
      floor: input.floor, totalFloors: input.totalFloors, ownerGua: owner ? owner.gua : null, houseGua: house.gua,
      cells, masterPalace: input.masterPalace, doorPalace: input.doorPalace,
    }),
    { score: 1.5, max: 3, wx: null, relation: null, level: '平', text: '樓層無法計算，以中間值 1.5 分計。', notes: [] }, warnings, '樓層',
  );
  for (const w of [...(interior.warnings || []), ...(exterior.warnings || []), ...(people.warnings || [])]) warn(w);

  /* ---- 分數 ---- */
  const part = (id, label, score, max) => ({ id, label, score: round1(clamp(Number(score) || 0, 0, max)), max });
  const parts = [
    part('xuankong', '玄空格局', xkScore, 25),
    part('bazhai', '八宅門主灶', bazhai.score, 25),
    part('interior', '內局', interior.score, 20),
    part('exterior', '外局', exterior.score, 20),
    part('floorPeople', '樓層與命宅', (Number(floor.score) || 0) + (Number(people.score) || 0), 10),
  ];
  const total = Math.round(clamp(parts.reduce((a, p) => a + p.score, 0), 0, 100));
  const g = GRADES.find((x) => total >= x.min) || GRADES[GRADES.length - 1];
  const badPalaces = ALL_PALACES.filter((p) => cells[p].luck === '凶');
  let gradeText = badPalaces.length >= 3 && GRADE_WARN[g.grade] ? GRADE_WARN[g.grade](badPalaces.length) : g.text;
  // R18：「欠佳」不固定寫「宜優先處理大門、臥室與爐灶」，依比例最低的那一項改寫
  if (g.grade === '欠佳') {
    const focus = gradeFocus(parts, { door, master, stove, masterView }, { kongwang: cx.kongwang, parts: xkParts });
    gradeText = badPalaces.length >= 3
      ? `凶項偏多，而且有 ${badPalaces.length} 個方位要注意，${focus}。`
      : `凶項偏多，${focus}，再依化解清單逐項調整。`;
  }
  const score = {
    total, max: 100, grade: g.grade, gradeLabel: g.label, gradeText, parts,
    note: SCORE_NOTE, badPalaces: badPalaces.length,
  };

  /* ---- D10：未填、以中間值計的項目 ---- */
  const missing = [];
  if (roomCount === 0) missing.push('內局');
  else {
    if (!master) missing.push('主臥');
    if (!stove) missing.push('廚房');
  }
  if (extCount === 0) missing.push('外局');
  if (!owner) missing.push('居住者');
  if (input.floor === null) missing.push('樓層');
  if (periodSource === '今年' || periodSource === '預設') missing.push('入住年');
  // R21：入住年不是「以中間值計」，另給一句（LINE 與畫面分開寫）
  const periodNote = periodSource === '今年' ? '入住年未填，以今年推算元運'
    : periodSource === '預設' ? '入住年未填，元運暫以九運計' : null;

  const ctx = {
    input, cx, compass, period, periodSource, curPeriod, changed, solar,
    main, ti, active, activeName, useTi, tiSame, tgMode, xkParts, xkRaw, xkScore,
    buildFit, currentFit, fit, wuTi, wuHit, wuAltPattern, daoqilong,
    house, altHouse, stars, sitStars, lucky, door, master, stove, bazhai, doorScore, masterScore, stoveScore,
    masterView, masterPlan, ownerStars, ownerLucky,
    year, month, cells, interior, exterior, people, owner, floor, score, badPalaces,
  };

  /* ---- 段落、化解、三優三注意、LINE ---- */
  const remedyEntries = buildRemedies(ctx);
  ctx.remedyEntries = remedyEntries;
  const sections = [
    buildOrientation(ctx),
    buildPattern(ctx),
    buildBazhai(ctx),
    buildPalaces(ctx),
    buildInterior(ctx),
    buildExterior(ctx),
    buildFloor(ctx),
    buildPeople(ctx),
    buildAnnual(ctx),
    buildRemedySection(ctx),
    buildMethod(ctx),
  ];
  const highlights = buildHighlights(ctx);
  const remedies = remedyEntries.map((e) => ({
    palace: e.palace, dir: e.dir, problem: e.problem, problems: e.problems.slice(), method: e.method, items: e.items.slice(),
    action: e.action, actionFrom: e.actionFrom || 'table', altAction: e.altAction || '', concrete: e.concrete, avoid: e.avoid.slice(), delta: e.delta, sources: e.srcs.slice(), structural: e.structural,
    conflict: e.conflict || null,
    // X1：居住者那幾條是誰的床（閘門檢查移床目標用）；X2：二五宮併成的那一條
    who: e.who || null,
    merged25: !!e.merged25,
    // Z1：這一條來自哪些規則（查動作表用）；Z5：哪一種房間（小孩房換房要排除 kidBad 的宮）
    rules: (e.rules || []).slice(),
    room: e.room || null,
    wx: e.wx || null,
  }));

  const report = {
    input,
    compass,
    bazhai,
    xuankong,
    cells,
    interior,
    exterior,
    floor,
    people,
    score,
    sections,
    remedies,
    highlights,
    warnings,
    missing,
    periodNote,
    lineText: '',
  };
  // F2：LINE 與畫面的三優三注意（highlights.marked）同一套標記
  refreshLine(report);
  // G0：一致性閘門——各段對同一宮的建議依二五宜靜、同宮不互剋、動作可照做改寫（改完重產 LINE）
  if (!(opts && opts.gate === false)) consistencyGate(report);
  // D9：專有名詞的白話放在閘門之後補（閘門不會拿掉說明句，也不會把說明句當建議）
  applyGlossary(report.sections);
  return report;
}

/* ------------------------------------------------------------------ */
/* 5. 各段落                                                            */
/* ------------------------------------------------------------------ */

function section(id, items) {
  return { id, title: SECTION_TITLES[id], intro: SECTION_INTRO[id], items };
}

function mk(level, title, text, extra = {}) {
  const it = { level, title, text };
  if (extra.palace) it.palace = extra.palace;
  if (extra.fix) it.fix = extra.fix;
  for (const k of ['delta', 'rule', 'room', 'school', 'avoid']) if (extra[k] !== undefined) it[k] = extra[k];
  return it;
}

/** D9：專有名詞第一次出現時，在那一句後面補一句白話 */
function insertAfter(s, term, gloss) {
  const t = String(s || '');
  const i = t.indexOf(term);
  if (i < 0) return null;
  const j = t.indexOf('。', i);
  if (j < 0) return `${endDot(t)}${gloss}`;
  return t.slice(0, j + 1) + gloss + t.slice(j + 1);
}
function applyGlossary(sections) {
  for (const gl of GLOSS) {
    let done = false;
    for (const sec of sections) {
      if (done) break;
      const hitIn = (s) => gl.match.find((w) => String(s || '').includes(w));
      const w0 = hitIn(sec.intro);
      if (w0) {
        sec.intro = insertAfter(sec.intro, w0, gl.text) || sec.intro;
        done = true;
        break;
      }
      for (const it of sec.items) {
        const wt = hitIn(it.text);
        const wTitle = hitIn(it.title);
        const wf = hitIn(it.fix);
        if (wTitle && !wt) { it.text = `${gl.text}${it.text}`; done = true; break; }
        if (wt) { it.text = insertAfter(it.text, wt, gl.text) || it.text; done = true; break; }
        if (wf) { it.fix = insertAfter(it.fix, wf, gl.text) || it.fix; done = true; break; }
      }
    }
  }
}

/* ---- 坐向與元運 ---- */
function buildOrientation(ctx) {
  const { input, cx, compass, period, periodSource, curPeriod, changed, solar, house, altHouse, useTi, ti } = ctx;
  const items = [];
  const deg = fmtNum(input.facingDeg);
  const fm = cx.facing.mount;
  const fp = cx.facingPalace;
  const sp = cx.sittingPalace;

  items.push(mk(input.facingDefault ? '注意' : '平', `${cx.fullName}（${cx.plain}）${input.facingDefault ? '・暫定' : ''}`,
    (input.facingDefault ? '沒有填大門朝向的度數，坐向暫以 180° 計，是暫定的，請實際量測後再看。' : '')
    + `站在大門內、面朝門外量到 ${deg}°，向在${fm}山、坐在${cx.sitting.mount}山，稱為${cx.name}。`
    + `羅盤一圈分 24 山，每山 15°；向方在${where(fp)}，坐方在${where(sp)}。`
    + (input.doorSource === '房間'
      ? `大門在${where(input.doorPalace)}。`
      : `${input.doorSource === '中宮' ? DOOR_CENTER_NOTE : DOOR_NONE_NOTE}。`)));

  const abs = fmtNum(cx.facing.abs);
  const tw = cx.facing.towards;
  if (cx.kind === '正向') {
    items.push(mk('平', '正向（用下卦）',
      `向度離${fm}山的中線 ${abs}°，在 3° 以內屬「正向」，沈氏玄空用下卦起盤。`));
  } else if (cx.kind === '兼向') {
    items.push(mk('平', `兼向：${fm}兼${tw}`,
      `向度離${fm}山的中線 ${abs}°，偏向${tw}山。偏離 3°～6.5° 屬「兼向」，沈氏玄空改用替卦起盤。`
      + `本報告下卦、替卦兩盤都算，${useTi ? '以替卦盤為主' : '依你的設定以下卦盤為主'}。`));
  } else {
    const big = cx.kongwang === '大空亡';
    items.push(mk('凶', `騎線：${cx.kongwang}`,
      `向度離${fm}山的中線 ${abs}°，已騎在${fm}、${tw}兩山的交界線上。`
      + (big
        ? '兩山分屬不同卦，稱「大空亡」（出卦），傳統認為氣雜不清，是立向的大忌。'
        : '兩山同屬一卦，稱「小空亡」，傳統認為氣稍雜、吉凶較難應驗。')
      + `玄空格局因此扣 ${big ? 6 : 3} 分；替卦盤${ti ? (useTi ? '已採用' : '另列參考') : '一併列出'}。`,
      { fix: KONG_FIX, palace: fp }));
  }

  const r = compass.periodRange;
  let pText = '三元九運每 20 年換一運，房子以入住（或大修）那一年所屬的運起盤。';
  let pLevel = '平';
  if (periodSource === '指定') {
    pText += `元運是你手動指定的${CN[period]}運。`;
    if (input.moveInYear && periodOf(input.moveInYear) !== period) {
      pText += `依入住年推算應是${CN[periodOf(input.moveInYear)]}運，兩者不同，請確認。`;
      pLevel = '注意';
    }
  } else if (periodSource === '入住年') {
    pText += `依入住年 ${input.moveInYear} 年推算，屬${CN[period]}運。`;
  } else if (periodSource === '今年') {
    pText += `沒有填入住年，暫用今年推算為${CN[period]}運；舊房子請補填入住或大修的年份。`;
    pLevel = '注意';
  } else {
    pText += '沒有入住年也沒有今天的日期，暫以九運（2024–2043）計算。';
    pLevel = '注意';
  }
  if (compass.futureMoveIn) {
    // R2：入住年在未來，不論交運
    pText += `入住年比今天晚，請確認；這份報告暫以${compass.periodBasis || '入住那一運'}起盤，星的旺衰也用${CN[period]}運判。`;
    pLevel = '注意';
  } else if (changed) {
    pText += `目前已進入${CN[curPeriod]}運，還沒有換天心，所以盤仍依${CN[period]}運起。`
      + `星的旺衰、當運山向星與零正神，改用現在的${CN[curPeriod]}運來判。`;
    pLevel = '注意';
  }
  items.push(mk(pLevel, `${compass.periodName}（${r.start}–${r.end}）${changed ? `・現已入${CN[curPeriod]}運` : ''}`, pText));

  const modeName = house.mode === 'door' ? '門上起伏位' : '坐山立極';
  const otherName = house.mode === 'door' ? '坐山立極' : '門上起伏位';
  const how = house.mode === 'door'
    ? `大門在${where(input.doorPalace)}，以門為伏位`
    : `坐方在${where(sp)}，以坐為伏位`;
  let hText = `八宅以${modeName}定宅卦：${how}，所以是${house.gua}宅，屬${house.group}宅。`
    + '坎、離、震、巽為東四宅，乾、坤、艮、兌為西四宅。';
  if (altHouse.gua !== house.gua) {
    hText += `若改用${otherName}，宅卦會是${altHouse.gua}宅（${altHouse.group}宅）；兩種立法各有傳承，報告以你選的為準。`;
  } else {
    hText += `改用${otherName}也是${house.gua}宅，兩種立法結論一致。`;
  }
  items.push(mk('平', `宅卦：${house.gua}宅（${house.group}宅）`, hText));

  if (solar && solar.year !== (input.date && input.date.y)) {
    items.push(mk('平', '流年以立春換年',
      `今天在立春之前，流年仍算 ${solar.year} 年；流年一段依此計算。`));
  }
  return section('orientation', items);
}

/* ---- 玄空格局 ---- */

/**
 * R16：下水、上山的化解動作要先看現場能不能照做。
 *   下水（當運山星到向方）：向宮已有大門、客廳、二黑五黃或形煞 → 不叫你把臥室搬到向方，改「屋外有高樓接住、屋內床頭靠實牆」。
 *   上山（當運向星到坐方）：坐宮已有臥室、神明廳、二黑五黃或形煞 → 不叫你把坐方改作客廳動線，改「屋外有水或空地接住、屋內保持通透」。
 * 回 { fix, action, busy:[原因] }；其他格局照 PATTERN_FIX／PATTERN_ACTION。
 */
function patternFixOf(ctx, pat) {
  const { cx, cells, input, curPeriod } = ctx;
  // Z1：動作點名方位，不寫「當運山星宮」這種要再查一次的說法
  const baseAction = {
    上山下水: '床頭靠實牆，中宮保持開闊、不堆雜物',
    下水: `臥室與床位放在${dirOf(cx.facingPalace)}，背靠實牆`,
    上山: `${dirOf(cx.sittingPalace)}多開窗、保持通透，多走動`,
  };
  const base = { fix: PATTERN_FIX[pat], action: baseAction[pat] || PATTERN_ACTION[pat], busy: [], done: null };
  // G3：雙星會坐／會向的那一宮有二黑五黃（多半是流年）→ 不寫見水、開門窗、作客廳，改「（此宮有X，宜靜，見九宮卡）」
  if (pat === '雙星會坐' || pat === '雙星會向') {
    const p = pat === '雙星會坐' ? cx.sittingPalace : cx.facingPalace;
    if (!has25(cells, p, curPeriod)) return base;
    const side = pat === '雙星會坐' ? '坐方' : '向方';
    return { fix: `${side}在${where(p)}${calm25Note(cells, p, curPeriod)}。屋內這一方不堆雜物，屋外形勢見外局段。`, action: undefined, busy: [], done: null };
  }
  // G3：上山下水——當運山星宮、當運向星宮各自看有沒有二黑五黃，有的那一宮不叫你做臥室、放大門客廳
  // X1：臥室、客廳動線放不放得過去也用 pickTargets（已經在那裡的寫「合乎做法」，不行的寫原因、不叫你搬）
  if (pat === '上山下水') {
    const mp = palaceOfStar(ctx.active && ctx.active.mountain, curPeriod);
    const fp = palaceOfStar(ctx.active && ctx.active.facing, curPeriod);
    if (!PALACES.includes(mp) || !PALACES.includes(fp)) return base;
    const env = targetEnv(ctx);
    const m25 = has25(cells, mp, curPeriod);
    const f25 = has25(cells, fp, curPeriod);
    const mrs = (input.rooms && input.rooms[mp]) || [];
    const frs = (input.rooms && input.rooms[fp]) || [];
    const mBed = mrs.find((r) => BED_ROOMS.includes(r));
    const fDone = frs.includes('客廳') ? '客廳' : (input.doorPalace === fp && input.doorSource === '房間' ? '大門' : null);
    const mOk = !m25 && !mBed && pickTargets('bed', ctx).includes(mp);
    const fOk = !f25 && !fDone && pickTargets('living', ctx).includes(fp);
    let a;
    if (m25) a = `當運山星在${where(mp)}${calm25Note(cells, mp, curPeriod)}。`;
    else if (mBed) a = `${mBed}已在當運山星所在的${where(mp)}，合乎做法。`;
    else if (mOk) a = `屋內把臥室放在當運山星所在的${where(mp)}。`;
    else a = `當運山星在${where(mp)}，這一宮${targetBlock('bed', mp, env)}，不宜改做臥室；屋內這一方保持安靜、靠牆放高櫃。`;
    let b;
    if (f25) b = `當運向星在${where(fp)}${calm25Note(cells, fp, curPeriod)}。`;
    else if (fDone) b = `${fDone}已在當運向星所在的${where(fp)}，合乎做法。`;
    else if (fOk) b = `客廳與常走的動線放在當運向星所在的${where(fp)}。`;
    else b = `當運向星在${where(fp)}，這一宮${targetBlock('living', fp, env)}，不宜改作客廳；這一方保持通暢、不堆雜物。`;
    const acts = [];
    if (mOk) acts.push(`臥室用${dirOf(mp)}`);
    if (fOk) acts.push(`客廳與常走的動線用${dirOf(fp)}`);
    return {
      fix: `${a}${b}屋外坐方見水、向方見山（倒騎龍的形勢）可反為吉用。`,
      action: acts.length ? acts.join('，') : `${dirOf(mp)}與${dirOf(fp)}保持安靜、不堆雜物`,
      busy: [],
      done: null,
    };
  }
  if (pat !== '下水' && pat !== '上山') return base;
  const p = pat === '下水' ? cx.facingPalace : cx.sittingPalace;
  const rs = (input.rooms && input.rooms[p]) || [];
  const busy = [];
  // T2：下水看向宮（大門含「大門以向宮計」、客廳、廚房、廁所）；上山看坐宮（臥室、神明廳、廚房、廁所）
  const doorHere = input.doorPalace === p;
  const doorWord = doorHere ? (doorByFacing(input) ? '大門（以向宮計）' : '大門') : null;
  let done = null;
  if (pat === '下水') {
    // X1：向宮已經有臥室類（主臥優先）就是合乎做法
    done = rs.includes('主臥') ? '主臥' : (rs.find((r) => OTHER_BEDS.includes(r)) || null);
    if (doorWord) busy.push(doorWord);
    for (const r of ['客廳', '廚房', '廁所']) if (rs.includes(r)) busy.push(r);
  } else {
    if (rs.includes('客廳')) done = '客廳';
    else if (doorHere && input.doorSource === '房間') done = '大門';
    for (const r of ['主臥', '臥室', '小孩房', '長輩房', '神明廳', '廚房', '廁所']) if (rs.includes(r)) busy.push(r);
  }
  // 山向星或流年星的二黑五黃（宜靜，跟「做臥室、宜動」都不合）
  let has25Here = false;
  const c = cells[p];
  if (c) {
    const s25 = uniq([c.m, c.f].filter((s) => is25(s, curPeriod)).map(sn));
    if (c.yearStar && is25(c.yearStar, curPeriod)) s25.push(`流年${sn(c.yearStar)}`);
    if (s25.length) { busy.push(s25.join('、')); has25Here = true; }
  }
  const sha = ((input.exterior && input.exterior[p]) || []).filter((k) => EXT_TYPES[k] && EXT_TYPES[k].sha).map((k) => EXT_TYPES[k].label);
  if (sha.length) busy.push(`形煞（${sha.join('、')}）`);
  if (done) {
    const other = busy.length ? `這一宮另有${busy.join('、')}，擺設照化解清單${has25Here ? '、宜靜' : ''}。` : '';
    if (pat === '下水') {
      return {
        fix: `主臥已在${dirOf(p)}（向方），合乎做法，床頭靠實牆即可。${other}向方屋外宜有高樓或山接住山星。`,
        action: `${done}已在${dirOf(p)}，床頭靠實牆即可`,
        busy: [done, ...busy],
        done,
      };
    }
    return {
      fix: `${done}已在${dirOf(p)}（坐方），合乎做法。${other}${has25Here ? '' : '坐方保持通透、不堆雜物。'}坐後屋外有水或開闊空地，可以接住向星。`,
      action: `${done}已在${dirOf(p)}，${has25Here ? '保持整潔安靜' : '保持通透即可'}`,
      busy: [done, ...busy],
      done,
    };
  }
  if (pat === '下水' && !busy.length) {
    // X1：向宮能不能放臥室也看 pickTargets（神明廳、九宮凶、個人凶方…）；可以的話寫明是哪一宮
    const why = targetBlock('bed', p, targetEnv(ctx));
    if (why) {
      return {
        fix: `${dirOf(p)}（向方）${why}，不宜把臥室放在這裡。向方屋外宜有高樓或山接住山星；屋內床頭靠實牆。`,
        action: `${dirOf(p)}靠牆放高櫃，床頭靠實牆`,
        busy: [why.replace(/^(是|有|已有)/, '')],
        why,
        done,
      };
    }
    return {
      fix: `臥室、床位放在當運山星所在的${where(p)}（向方），背靠實牆。向方屋外有高樓或山，可以接住山星。`,
      action: base.action,
      busy,
      done,
    };
  }
  if (!busy.length) return base;
  if (pat === '下水') {
    return {
      fix: `${dirOf(p)}（向方）已有${busy.join('、')}，不宜把臥室放在這裡。向方屋外宜有高樓或山接住山星；屋內床頭靠實牆。`,
      action: `${dirOf(p)}靠牆放高櫃，床頭靠實牆`,
      busy,
      done,
    };
  }
  if (has25Here) {
    // G3：坐方有二黑五黃，不寫「屋外宜有水」「保持通透」，改「（此宮有X，宜靜，見九宮卡）」
    return {
      fix: `${dirOf(p)}（坐方）已有${busy.join('、')}，不宜改作客廳或常走的動線${calm25Note(cells, p, curPeriod)}。屋內坐方不堆雜物。`,
      action: `${dirOf(p)}保持整潔安靜、不堆雜物`,
      busy,
      done,
    };
  }
  return {
    fix: `${dirOf(p)}（坐方）已有${busy.join('、')}，不宜改作客廳或常走的動線。坐方屋外宜有水或開闊空地接住向星；屋內坐方保持通透、不堆雜物。`,
    action: `${dirOf(p)}保持通透、不堆雜物`,
    busy,
    done,
  };
}

/** Z8：宮位白話拿掉「明亮」（「宜乾淨、明亮、安靜」→「宜乾淨、安靜」） */
const noBright = (s) => String(s || '').replace(/、明亮、/g, '、').replace(/、明亮(?=[，。；])/g, '').replace(/明亮、/g, '');

/** G3：格局段遇到這一宮有二黑五黃（山向星或流年）時的說法 */
function calm25Note(cells, p, cur) {
  return `（此宮有${names25(cells, p, cur)}，宜靜，見九宮卡）`;
}

/** X4：註記參數可以是註記本身，或舊的 true（流年）／false（山向星） */
const noteArg = (n) => (typeof n === 'string' && NO_BUILD_NOTES.includes(n) ? n : (n ? NO_BUILD_YEAR : NO_BUILD_OWN));
/**
 * 施工字眼的句子補動土提醒（流年二五「今年此方忌動土，明年再做」；山向星二五「此方宜靜，動工前先擇日」；
 * X4：兩種都有用合併註記）。note 可以是註記字串或舊的 true／false。已經有別的註記就換成對的那一句。
 */
function withBuildNote(s, note) {
  const want = noteArg(note);
  const t = String(s || '');
  if (t.includes(want)) return t;
  const had = NO_BUILD_NOTES.find((x) => t.includes(x));
  if (had) return t.split(had).join(want);
  const dot = /[。！？]$/.test(t);
  return `${t.replace(/[。！？]$/, '')}${want}${dot ? '。' : ''}`;
}
/** X4：這一宮該用哪一句動土提醒（流年與山向星都有二五＝合併註記） */
function buildNoteOf(cells, p, cur) {
  const c = cells && cells[p];
  if (!c) return NO_BUILD_OWN;
  const yr = !!(c.yearStar && is25(c.yearStar, cur));
  const own = [c.m, c.f].some((s) => is25(s, cur));
  if (yr && own) return NO_BUILD_BOTH;
  return yr ? NO_BUILD_YEAR : NO_BUILD_OWN;
}
/** X4：這一句有沒有真的要動工（退路句、註記本身、否定句不算；「X避開這一宮」不算） */
const constructHit = memo1((s) => {
  let t = unquoteNames(s).trim().replace(/^另有[：，]?/, '');
  for (const n of NO_BUILD_NOTES) t = t.split(n).join('');
  if (!t || FALLBACK_RE.test(t)) return false;
  return positiveHit(t, CONSTRUCT_RE);
});

/** G4：入囚的中宮做法；中宮有二黑五黃時只拿掉「宜明亮通風。」，挑高、天井那一句補動土提醒 */
function prisonFixOf(cells, cur) {
  if (!has25(cells, '中', cur)) return PRISON_FIX;
  const note = buildNoteOf(cells, '中', cur);
  return sentences(PRISON_FIX)
    .filter((s) => !positiveHit(s, ACTIVE25_RE))
    .map((s) => (constructHit(s) ? withBuildNote(s, note) : s))
    .join('');
}

/** X9：入囚的說明（PRISON_TEXT）；中宮有二黑五黃（含流年）時宜靜，不寫「有水可以囚不住」 */
function prisonText(k, cells, cur, src = null) {
  const t = String(PRISON_TEXT[k] || '');
  // Z2：中宮不能放水（山星入囚＝山星當運在中宮、廁所水…）時也不寫「有水可以囚不住」
  const dry = has25(cells, '中', cur) || (src ? !waterOk('中', src) : false);
  if (!dry) return t;
  return t.replace(/、天井或有水/g, '或天井').replace(/(?:或|、)?有水/g, '');
}

function fitWhere(board, p) {
  const at = palaceOfStar(board, p);
  return at === '中' ? '中宮（入囚）' : where(at);
}

function buildPattern(ctx) {
  const {
    period, curPeriod, changed, main, ti, active, activeName, useTi, tiSame, tgMode, xkParts, xkRaw, xkScore,
    buildFit, fit, wuTi, wuHit, wuAltPattern, daoqilong,
  } = ctx;
  const items = [];
  const cur = curPeriod;
  const daoFix = (pat) => {
    if (daoqilong && daoqilong.pattern === pat) return undefined;
    return patternFixOf(ctx, pat).fix;
  };

  if (!changed) {
    const pat = fit.pattern;
    const info = PATTERN_INFO[pat] || PATTERN_INFO.令星不到;
    let level = PATTERN_LEVEL[pat] || '平';
    let text = info.text;
    if (daoqilong && daoqilong.pattern === pat) { text += daoqilong.text; level = '平'; }
    items.push(mk(level, `${activeName}盤格局：${pat}（${flatLuck(info.luck)}）`,
      `${text}格局基本分 ${info.score} 分。`, daoFix(pat) ? { fix: daoFix(pat) } : {}));
  } else {
    // D1：交運——建宅格局、現運令星落點、換天心
    const bPat = buildFit.pattern;
    const bInfo = PATTERN_INFO[bPat] || PATTERN_INFO.令星不到;
    items.push(mk('平', `入住時（${CN[period]}運）：${bPat}（${flatLuck(bInfo.luck)}）`,
      `盤依入住那一運起，天心不換。以${CN[period]}運的令星${sn(period)}看，`
      + `山星在${fitWhere(active.mountain, period)}、向星在${fitWhere(active.facing, period)}，是${bPat}。`
      + '交運之後，原本的旺星已經退氣，這個格局只當參考。'));
    const pat = fit.pattern;
    const info = PATTERN_INFO[pat] || PATTERN_INFO.令星不到;
    let level = PATTERN_LEVEL[pat] || '平';
    let text = `現在已入${CN[cur]}運，令星是${sn(cur)}。`
      + `山星${sn(cur)}在${fitWhere(active.mountain, cur)}、向星${sn(cur)}在${fitWhere(active.facing, cur)}，所以是${pat}。`
      + info.text;
    if (daoqilong && daoqilong.pattern === pat) { text += daoqilong.text; level = '平'; }
    items.push(mk(level, `現在${CN[cur]}運：${pat}（${flatLuck(info.luck)}）`,
      `${text}格局分以現在的${CN[cur]}運計，基本分 ${info.score} 分。`, daoFix(pat) ? { fix: daoFix(pat) } : {}));
    items.push(mk('注意', `交運：盤是${CN[period]}運起，現已入${CN[cur]}運`,
      `這間房子的盤是${CN[period]}運起的，現在已入${CN[cur]}運，還沒有換天心。`
      + `沒有大修之前，盤照舊、旺衰改以${CN[cur]}運判。`,
      { fix: `要讓${CN[cur]}運之氣進來，傳統做法是擇日大修：拆換大門、翻新屋頂或全屋重新裝修，之後改用${CN[cur]}運起盤。` }));
  }

  // 入囚（D1、[1]）；X9：中宮有二黑五黃時「有水可以囚不住」拿掉「有水」
  for (const [k, label] of [['mountain', '山星'], ['facing', '向星']]) {
    if (!fit.prison[k]) continue;
    items.push(mk('凶', `${label}入囚（${CN[fit.period]}運）`,
      `${prisonText(k, ctx.cells, cur, ctx)}玄空格局扣 3 分。`, { palace: '中', fix: prisonFixOf(ctx.cells, cur) }));
  }

  // D2：替卦遇五黃
  if (useTi && wuHit && wuAltPattern) {
    const side = [];
    if (active.yun[active.sitP] === 5) side.push('坐');
    if (active.yun[active.faceP] === 5) side.push('向');
    const where2 = side.length ? side.join('、') : '坐向';
    items.push(mk('平', wuTi === 'none' ? '替卦遇五黃：五黃無替' : '替卦遇五黃：取本山替星（另一派）',
      wuTi === 'none'
        ? `運盤${where2}宮是五黃，通行做法是五黃無替，仍以五入中，看本山陰陽定順逆。`
          + `另一派取本山替星入中，格局會是${wuAltPattern}，只當參考、不計分。`
        : `依你的設定，運盤${where2}宮的五黃取本山替星入中（另一派）。`
          + `通行教本多採五黃無替，仍以五入中，格局會是${wuAltPattern}，只當參考、不計分。`));
  }

  // 當運星、生氣星的位置（用現在的運）
  const next = (cur % 9) + 1;
  const mp = palaceOfStar(active.mountain, cur);
  const fp = palaceOfStar(active.facing, cur);
  const mpn = palaceOfStar(active.mountain, next);
  const fpn = palaceOfStar(active.facing, next);
  // T2：下水、上山的向宮／坐宮已經有東西（或主臥、客廳已在那裡）時，這一句不再叫你做臥室、宜動，改指回格局那一條
  const pfx = (fit.pattern === '下水' || fit.pattern === '上山') && !(daoqilong && daoqilong.pattern === fit.pattern)
    ? patternFixOf(ctx, fit.pattern) : null;
  const seeAbove = items.length && items[items.length - 1].fix === (pfx && pfx.fix) ? '見上一條' : '見上面格局那一條';
  const busyNote = pfx && pfx.busy.length
    ? (pfx.why ? `（${pfx.why}，${seeAbove}）`
      : `（已有${uniq(pfx.busy.map((b) => b.replace(/（[^）]*）/g, ''))).join('、')}，${seeAbove}）`) : '';
  // X1：當運山星那一宮放不了臥室（pickTargets 不收、也還沒有臥室）就不寫「宜做臥室」
  const bedHere = (q) => ((ctx.input.rooms && ctx.input.rooms[q]) || []).some((r) => BED_ROOMS.includes(r));
  const bedOk = (q) => bedHere(q) || pickTargets('bed', ctx).includes(q);
  // G3：當運山向星落點那一宮有二黑五黃（含流年）→「（此宮有X，宜靜，見九宮卡）」，不寫宜做臥室、宜動、宜有水
  const cells = ctx.cells;
  let wText;
  if (mp === '中') wText = `${CN[cur]}運的當運山星（${sn(cur)}）在中宮，屬山星入囚。`;
  else if (busyNote && fit.pattern === '下水' && mp === ctx.cx.facingPalace) wText = `${CN[cur]}運的當運山星（${sn(cur)}）在${where(mp)}，管人丁健康${busyNote}。`;
  else if (has25(cells, mp, cur)) wText = `${CN[cur]}運的當運山星（${sn(cur)}）在${where(mp)}，管人丁健康${calm25Note(cells, mp, cur)}。`;
  else wText = `${CN[cur]}運的當運山星（${sn(cur)}）在${where(mp)}，管人丁健康，宜靜、宜實${bedOk(mp) ? '、宜做臥室' : ''}。`;
  if (fp === '中') wText += '當運向星在中宮，屬向星入囚。';
  else if (busyNote && fit.pattern === '上山' && fp === ctx.cx.sittingPalace) wText += `當運向星在${where(fp)}，管財${busyNote}。`;
  else if (has25(cells, fp, cur)) wText += `當運向星在${where(fp)}，管財${calm25Note(cells, fp, cur)}。`;
  // Z2：這一宮不能放水（山星也當運、廁所水…）→ 不寫「宜有水」，補一句理由
  else if (!waterOk(fp, ctx)) wText += `當運向星在${where(fp)}，管財，宜動、宜開闊、宜有門路。${waterWhy(fp, ctx)}`;
  else wText += `當運向星在${where(fp)}，管財，宜動、宜開闊、宜有門路或水。`;
  wText += `下一運的${sn(next)}屬生氣（下一運之星），山星在${dirOf(mpn)}、向星在${dirOf(fpn)}，屬次吉。`;
  if (cur === 9 || next === 9) wText += NINE_NOTE;
  items.push(mk('平', changed ? `現在${CN[cur]}運的當運山星、向星在哪裡` : '當運山星、向星在哪裡', wText));

  // 旺衰七級（用現在的運）
  const groups = QI_ORDER.map((q) => {
    const list = [];
    for (let s = 1; s <= 9; s++) if (qiOf(s, cur) === q) list.push(sn(s));
    return list.length ? `${list.join('、')}屬${q}` : '';
  }).filter(Boolean);
  items.push(mk('平', `${CN[cur]}運九星的旺衰`,
    '沈氏玄空把星的旺衰分七級：旺氣、生氣（下一運之星）、進氣、退氣、衰氣、死氣、煞氣。'
    + '旺氣與生氣合稱「生旺」。'
    + `${CN[cur]}運：${groups.join('；')}。`
    + (changed ? `盤雖是${CN[period]}運起，旺衰以現在的${CN[cur]}運判。` : '')));

  // 起星推法
  items.push(mk('平', `山星：${CN[active.mountainCenter.star]}入中${active.mountainCenter.forward ? '順' : '逆'}飛（${activeName}）`,
    deriveText(active, 'm')));
  items.push(mk('平', `向星：${CN[active.facingCenter.star]}入中${active.facingCenter.forward ? '順' : '逆'}飛（${activeName}）`,
    deriveText(active, 'f')));

  // 下卦與替卦
  if (ti) {
    let t = `下卦：${chartBrief(main)}。`;
    if (tiSame) {
      t += wuHit && wuTi === 'none'
        ? '替卦：入中星都無替（五黃無替），替卦盤與下卦盤相同。'
        : '替卦：兩顆入中星都無替可尋，替卦盤與下卦盤相同。';
    } else {
      t += `替卦：${chartBrief(ti)}。`;
      t += useTi
        ? `本報告以替卦盤為主（${tgMode === 'on' ? '依你的設定' : '向度偏離山中線超過 3°，依沈氏習慣用替卦'}），九宮飛星圖畫的是替卦盤。`
        : '依你的設定以下卦盤為主，九宮飛星圖畫的是下卦盤。';
      // L6：山星、向星兩段取同一座山的替星時（另一派五黃取本山），「替卦：X山依口訣…」那一句只講一次
      if (!useTi) {
        items.push(mk('平', '替卦盤的推法（參考）', dedupeSentences(`${deriveText(ti, 'm')}${deriveText(ti, 'f')}`)));
      } else {
        items.push(mk('平', '下卦盤的推法（參考）', dedupeSentences(`${deriveText(main, 'm')}${deriveText(main, 'f')}`)));
      }
    }
    if (changed) t += `以上格局都是以入住時的${CN[period]}運論。`;
    items.push(mk('平', '下卦盤與替卦盤', t));
  } else if (tgMode === 'on') {
    items.push(mk('平', '替卦設定不適用',
      '向度在正向範圍內（偏離 3° 以內），沈氏玄空只用下卦，替卦設定不適用。'));
  }

  // 伏吟反吟、合十、三般卦
  for (const [k, label] of [['mountain', '山盤'], ['facing', '向盤']]) {
    const v = active.fuyin[k];
    if (!v) continue;
    const t = v === '伏吟'
      ? `${label}是五入中順飛，九宮的星與洛書原位相同，古稱「伏吟」。傳統認為主事多反覆、人丁財運不易推進。`
      : `${label}是五入中逆飛，九宮的星都是對宮的洛書數，古稱「反吟」。傳統認為主事多反覆、聚散無常。`;
    items.push(mk('凶', `${label}${v}`, `${t}玄空格局扣 3 分。`, { fix: FUYIN_FIX }));
  }
  if (active.heshiAll) {
    const isM = active.heshiAll.startsWith('山');
    items.push(mk('吉', active.heshiAll,
      `每一宮的${isM ? '山星' : '向星'}加運星都是十，傳統稱「合十」，主氣通而吉，${isM ? '利人丁健康' : '利財'}。玄空格局加 2 分。`));
  }
  if (active.sanban === '父母三般卦') {
    items.push(mk('吉', '父母三般卦',
      '每一宮的運星、山星、向星都落在一四七、二五八或三六九同一組，稱「父母三般卦」。傳統認為三元之氣連通，主吉。玄空格局加 2 分。'));
  } else if (active.sanban === '連珠三般卦') {
    items.push(mk('吉', '連珠三般卦',
      '每一宮的運星、山星、向星是連續的三個數（九接一），稱「連珠三般卦」。傳統認為三元之氣連通，主吉。玄空格局加 2 分。'));
  }

  // 零神正神（用現在的運）
  if (cur === 5 || !PALACES.includes(PALACE_BY_LUO[cur])) {
    items.push(mk('平', '零神與正神', '五運零正神寄宮各家說法不同，本系統不論。'));
  } else {
    items.push(mk('平', '零神與正神',
      `${CN[cur]}運正神在${where(PALACE_BY_LUO[cur])}：宜見山、見高樓，忌見水。`
      + `零神在${where(PALACE_BY_LUO[10 - cur])}：宜見水、見路，忌見高山高樓。外局一段會依屋外形勢評分。`));
  }

  // 分數明細
  const detail = xkParts.map((p, i) => (i === 0 ? `${p.label} ${fmtNum(p.delta)}` : `${p.label} ${signed(p.delta)}`)).join('、');
  items.push(mk('平', `玄空格局 ${fmtNum(xkScore)} 分（滿分 25）`,
    `${detail}，合計 ${fmtNum(xkRaw)}，收在 0～25 之間。`));
  return section('pattern', items);
}

/* ---- 八宅門主灶 ---- */
function goodDirsText(lucky, n = 0) {
  const list = n > 0 ? lucky.good.slice(0, n) : lucky.good;
  return list.map((g) => g.dir).join('、');
}

const MOUTH_KB_RE = /把灶口[^。]*轉向游年/;
/** 灶口的做法：一句講完（afterMove＝前面已經講過「移爐位」，這一句用「爐位動不了時」開頭） */
function stoveMouthFix(lucky, afterMove) {
  return `${afterMove ? '爐位動不了時，' : ''}把灶口（爐具開關那一面）轉向游年吉方（${goodDirsText(lucky)}）。`;
}
/**
 * R22：灶壓吉方的做法：原理＋移爐位＋灶口（灶口那一句用具體方位，不再另起一句重講）。
 * L1：移爐那一句點名目標宮（stoveTargets）；沒有合適的目標就不叫人移爐，只講灶口。
 */
function stoveSitFix(ctx) {
  const kb = stoveKbOf(ctx);
  // F1：移爐那一句後面另起的「西方另有火剋金，兩派看法不同」不佔名額
  const all = kb.items.filter((x) => !/^壓到的若是/.test(x));
  const items = all.slice(0, 2 + all.filter((x) => STOVE_NOTE_SENT_RE.test(x)).length);
  return endDot(kb.method) + joinItems(items);
}
/** F1：移爐目標另起一句的兩派註記（「西方另有火剋金，兩派看法不同」） */
const STOVE_NOTE_SENT_RE = /^(?:東北|東南|西北|西南|東|西|南|北)方另有(?:火剋金|水火相沖)，兩派看法不同。?$/;

/* ---- L1：爐灶移位的目標 ---- */
const STOVE_STARS = ['絕命', '五鬼', '六煞', '禍害'];
/**
 * F1：爐灶移到兌宮（火剋金）、坎宮（水火相沖）不排除，但目標後面要加這一句（八宅灶壓凶方 vs 宮位五行）。
 * 寫在目標的括號裡（「西方（兌宮，此方另有火剋金，兩派看法不同）」「凶方（西，此方另有火剋金，兩派看法不同）」）。
 */
export const STOVE_PALACE_NOTE = Object.freeze({ 兌: '此方另有火剋金，兩派看法不同', 坎: '此方另有水火相沖，兩派看法不同' });
/**
 * L1：爐灶移到 p 這一宮為什麼不行（可以回 ''）：中宮、山向星有二黑五黃（不含流年）、有臥室類或有人睡、
 * 大門宮、神明廳宮、廁所宮。src：報告，或 build 的 ctx。
 * F1：再排除現運當運向星的宮（f＝現運，爐火燒當運財星）、當運山星的宮（m＝現運，爐火燻當運丁星）、乾宮（火燒天門）——
 * 照建議移過去之後，內局不能又出現 wetfire-facing-prosperous、wetfire-mountain-prosperous、kitchen-qian。
 */
function stoveBlock(p, src) {
  const env = src && src.cells && src.rooms && 'cur' in src ? src : targetEnv(src);
  if (!PALACES.includes(p)) return '是中宮';
  const c = env.cells[p] || {};
  const own = uniq([c.m, c.f].filter((s) => is25(s, env.cur)).map(sn));
  if (own.length) return `山向星有${own.join('、')}`;
  if (c.f !== null && c.f !== undefined && c.f === env.cur) return '向星當運';
  if (c.m !== null && c.m !== undefined && c.m === env.cur) return '山星當運';
  if (p === '乾') return '火燒天門';
  const rs = env.rooms[p] || [];
  const bed = rs.find((r) => BED_ROOMS.includes(r));
  if (bed) return `有${bed}`;
  if (sleepersAt(env, p).length) return '有人睡';
  if (p === env.door) return '是大門所在';
  if (rs.includes('神明廳')) return '有神明廳';
  if (rs.includes('廁所')) return '有廁所';
  return '';
}
/**
 * L1：爐灶移位的目標，依凶度（絕命、五鬼、六煞、禍害）排好、排除 stoveBlock 不合格的宮。
 * 回 [{ palace, dir, star, yearOnly }]；yearOnly＝這一宮只因流年二黑五黃（可以列，要寫「今年此方忌動土，明年再做」）。
 */
export function stoveTargets(src) {
  const env = targetEnv(src);
  const lk = env.lucky;
  if (!lk || !Array.isArray(lk.bad)) return [];
  return lk.bad.slice().sort((a, b) => STOVE_STARS.indexOf(a.star) - STOVE_STARS.indexOf(b.star))
    .filter((g) => PALACES.includes(g.palace) && !stoveBlock(g.palace, env))
    .map((g) => ({ palace: g.palace, dir: g.dir, star: g.star, yearOnly: has25(env.cells, g.palace, env.cur) }));
}
/**
 * L1：「西北方（乾宮）」；只因流年二五的寫「西北方（乾宮，今年此方忌動土，明年再做）」。
 * F1：兌宮、坎宮在括號裡再補「此方另有火剋金（水火相沖），兩派看法不同」。
 */
const stovePlace = (t) => {
  const notes = [t.yearOnly ? STOVE_YEAR_NOTE : '', STOVE_PALACE_NOTE[t.palace] || ''].filter(Boolean);
  return notes.length ? `${dirOf(t.palace)}（${t.palace}宮，${notes.join('，')}）` : where(t.palace);
};
/** F1：短動作裡的一個目標（「西」「西，今年此方忌動土，明年再做」「西，此方另有火剋金，兩派看法不同」） */
const stoveShort = (t) => [t.dir, t.yearOnly ? STOVE_YEAR_NOTE : '', STOVE_PALACE_NOTE[t.palace] || ''].filter(Boolean).join('，');
/**
 * L1：取代知識庫「裝修時把爐具移到游年凶方座落」的那一句（點名最多兩宮）；沒有目標回 []。
 * 回句子陣列（不帶句號）：一般只有一句；F1：兌、坎的「兩派看法不同」放進括號會超過字數時，另起一句
 * 「西方另有火剋金，兩派看法不同」（跟在移爐那一句後面）。
 */
function stoveMoveText(tg, room = 59) {
  if (!Array.isArray(tg) || !tg.length) return [];
  const head = '裝修時把爐具移到游年凶方的';
  const two = `${head}${tg.slice(0, 2).map(stovePlace).join('或')}座落`;
  // 一句不超過 60 字（room＝扣掉閘門會補的動土提醒、句號之後還能用的字數）：太長就只寫最凶的那一個
  if (charLen(two) <= room) return [two];
  const one = `${head}${stovePlace(tg[0])}座落`;
  const pn = STOVE_PALACE_NOTE[tg[0].palace];
  if (charLen(one) <= room || !pn) return [one];
  // F1：括號裡只留流年的註記，兩派看法不同另起一句
  const bare = `${head}${stovePlace(tg[0]).replace(`，${pn}`, '')}座落`;
  return [bare, `${dirOf(tg[0].palace)}${pn.replace(/^此方/, '')}`];
}
/** L1：灶的短動作——能今年做的凶方優先；只剩流年二五的寫明年再做；沒有目標只講灶口（點名方位） */
function stoveActionOf(ctx) {
  const lk = ctx && (ctx.lucky || (ctx.bazhai && ctx.bazhai.lucky));
  if (!lk || !Array.isArray(lk.good) || !lk.good.length) return '灶口轉向游年吉方';
  const tg = stoveTargets(ctx);
  const clean = tg.filter((t) => !t.yearOnly);
  const mouth = `灶口朝吉方（${goodDirsText(lk, 2)}）`;
  // F1：兌、坎（火剋金、水火相沖）的目標要帶「兩派看法不同」——第一個就是兌坎時只列它；第二個才是兌坎時只列第一個
  if (clean.length) {
    const two = clean.slice(0, 2);
    const list = STOVE_PALACE_NOTE[two[0].palace] ? [stoveShort(two[0])]
      : two.filter((t) => !STOVE_PALACE_NOTE[t.palace]).map((t) => t.dir);
    return `裝修時爐具移到凶方（${list.join('、')}），${mouth}`;
  }
  if (tg.length) return `裝修時爐具移到凶方（${stoveShort(tg[0])}），${mouth}`;
  const st = ctx.stove || (ctx.bazhai && ctx.bazhai.stove);
  return st && st.mouth && st.mouth.ok
    ? `灶口保持朝游年吉方（${goodDirsText(lk)}），用完即關火`
    : `灶口轉向游年吉方（${goodDirsText(lk)}）`;
}
/** L1：游年凶方都不能移爐時的原理句（取代知識庫「移爐位為上」） */
const STOVE_WHY = [
  [/^山向星有/, '二黑五黃'], [/^有(?:主臥|臥室|小孩房|長輩房)$|^有人睡$/, '臥室'], [/^是大門/, '大門'], [/^有神明廳/, '神位'], [/^有廁所/, '廁所'],
  // F1：當運向星、當運山星、火燒天門
  [/^(?:向星|山星)當運$/, '當運山向星'], [/^火燒天門$/, '火燒天門'],
];
function stoveNoMoveMethod(ctx, mouthOk) {
  const env = targetEnv(ctx);
  const why = uniq(((env.lucky && env.lucky.bad) || []).map((g) => {
    const w = stoveBlock(g.palace, env);
    const hit = STOVE_WHY.find(([re]) => re.test(w));
    return hit ? hit[1] : '';
  }));
  return '八宅講究灶座壓凶、灶口朝游年吉方；爐灶在吉星宮會洩吉。'
    + `這間房子的游年凶方都不適合移爐${why.length ? `（${why.join('、')}）` : ''}，`
    + `${mouthOk ? '灶口已朝吉方，維持即可' : '以調整灶口朝向為主'}。`;
}
/**
 * L1：灶壓吉方那一條的知識庫（ROOM_FIX.廚房壓吉）報告版：移爐那一句點名目標宮；沒有目標時不叫人移爐，
 * 原理句改寫、灶口那一句點名方位（灶口已朝吉方就不再列）。回 { ...知識庫, method, items, targets }。
 */
function stoveKbOf(ctx) {
  const kb = ROOM_FIX.廚房壓吉;
  const tg = stoveTargets(ctx);
  const st = ctx.stove || (ctx.bazhai && ctx.bazhai.stove);
  const mouthOk = !!(st && st.mouth && st.mouth.ok);
  const lucky = ctx.lucky || (ctx.bazhai && ctx.bazhai.lucky);
  // 爐灶那一宮有二黑五黃時，閘門會在施工句後面補動土提醒，句長要留位置
  const cur = ctx.curPeriod || (ctx.xuankong && ctx.xuankong.curPeriod);
  const note = st && ctx.cells && has25(ctx.cells, st.palace, cur) ? charLen(buildNoteOf(ctx.cells, st.palace, cur)) : 0;
  const items = [...kb.items].map(String).filter((x) => !/戶主的吉方/.test(x)).flatMap((x) => {
    if (/^裝修時把爐具移到游年凶方/.test(x)) return stoveMoveText(tg, 59 - note);
    if (MOUTH_KB_RE.test(x)) return mouthOk ? [] : [stoveMouthFix(lucky, tg.length > 0).replace(/。$/, '')];
    return [x];
  }).filter(Boolean);
  // 原理句拆成兩句（「移爐位為上」那一句在二五宮會被補動土提醒，整句才不會超過 60 字）
  const method = tg.length ? String(kb.method).replace(/洩吉，移爐位為上/, '洩吉。移爐位為上') : stoveNoMoveMethod(ctx, mouthOk);
  return { ...kb, method, items, targets: tg };
}

const OTHER_BEDS = ['臥室', '小孩房', '長輩房'];
const BED_ROOMS = ['主臥', ...OTHER_BEDS];

/* ---- X1：「移到哪一宮」統一用 pickTargets ---- */

/** pickTargets 認得的 kind；每一種「已有該房」看哪幾種房間 */
export const TARGET_KINDS = Object.freeze(['bed', 'master', 'study', 'living', 'fish', 'altar']);
const KIND_ROOMS = { bed: BED_ROOMS, master: BED_ROOMS, study: ['書房'], living: ['客廳'], fish: ['魚缸'], altar: ['神明廳'] };
/** Z5：這一宮的山向星組合對小孩不利（知識庫 COMBOS[組合].kidBad；沒有這個旗標就當沒有） */
function kidBadAt(c) {
  const k = c && c.combo && c.combo.key;
  const cb = k && COMBOS[k];
  return !!(cb && cb.kidBad);
}
/** Z5：睡的是不是小孩（稱呼含「小孩」，或房間是小孩房） */
const kidOf = (who, opt) => (opt && opt.room === '小孩房') || who.some((x) => x && /小孩/.test(String(x.label || '')));
// 內局 rooms.mjs 的 targetOk 用的 kind（有匯出就一起看，兩邊同一把尺）
const RM_KIND = { bed: 'bed', master: 'bed', living: 'live', fish: 'water' };
const SHENG_QI = ['旺氣', '生氣'];

/** 報告或 build 的 ctx → pickTargets 要的東西（兩種形狀都收） */
function targetEnv(src) {
  const s = src || {};
  const input = s.input || {};
  const cells = s.cells || {};
  const xk = s.xuankong || {};
  const cur = s.curPeriod || xk.curPeriod || (s.compass && s.compass.period) || 9;
  const pp = s.people && Array.isArray(s.people.people) ? s.people.people : [];
  const lucky = s.lucky || (s.bazhai && s.bazhai.lucky) || null;
  // 報告沒帶 input（auditReport 的複本）時，房間與大門從 cells 讀
  const rooms = input.rooms || Object.fromEntries(ALL_PALACES.map((p) => [p, (cells[p] && Array.isArray(cells[p].rooms)) ? cells[p].rooms : []]));
  const door = input.doorPalace || ALL_PALACES.find((p) => cells[p] && cells[p].isDoor) || null;
  // L2：移床、換房目標的登記（{ 目標宮: 原宮 }）；build 的 ctx 直接帶，報告放在 people.claims
  const claims = (isObj(s.claims) && s.claims) || (s.people && isObj(s.people.claims) ? s.people.claims : null);
  return { cells, rooms, door, cur, people: pp, owner: pp.find((x) => x.isOwner) || null, lucky, claims };
}
/** 床位在這一宮的人（bed.palace；戶主沒填床位時是主臥宮） */
const sleepersAt = (env, p) => (p ? env.people.filter((x) => x && x.bed && x.bed.palace === p) : []);
/**
 * 睡的人：opt.who 有給就用；主臥＝戶主＋床在那一宮的人；臥室類＝床在原本那一宮的人，沒有就戶主；客廳動線看戶主。
 * L2：臥室類（bed）一律再併入「床在原本那一宮的所有人」（同床的配偶也算）；opt.solo＝true 時只看 opt.who。
 */
function whoOf(kind, env, opt) {
  if (Array.isArray(opt.who)) {
    const w = opt.who.filter(Boolean);
    if (kind !== 'bed' || opt.solo || !opt.from) return w;
    const at = sleepersAt(env, opt.from);
    return [...w, ...at.filter((x) => !w.includes(x))];
  }
  const at = sleepersAt(env, opt.from);
  if (kind === 'master') return uniq([env.owner, ...at]);
  if (kind === 'bed') return at.length ? at : (env.owner ? [env.owner] : []);
  if (kind === 'living') return env.owner ? [env.owner] : [];
  return [];
}
const badPalacesOf = (who) => uniq(who.flatMap((x) => (x && x.lucky && Array.isArray(x.lucky.bad) ? x.lucky.bad.map((g) => (typeof g === 'string' ? g : g.palace)) : [])));
/** L2：一個人的吉方排列（認同一個人用：稱呼可能重複，再比命卦的吉方） */
const luckyKey = (lk) => (lk && Array.isArray(lk.good) ? lk.good.map((g) => (typeof g === 'string' ? g : g.palace)).join('') : '');

/**
 * X1：kind 換到 p 這一宮為什麼不行（可以回 ''）。排除規則只有這一份：
 *   原本的位置、中宮、已有該房的宮（臥室類看所有臥室）、大門宮、客廳宮、廚房廁所宮、神明廳宮、
 *   山向星或流年含二五的宮；臥室類另排除九宮評凶、山星死氣煞氣、睡的人個人凶方；
 *   客廳動線、魚缸要向星生旺、不進臥室；魚缸另排除山星當運（旺山見水）；客廳動線排除戶主個人凶方。
 *   內局 rooms.mjs 有匯出 targetOk 時一起看（同一把尺）。
 */
function targetBlock(kind, p, env, opt = {}) {
  if (!PALACES.includes(p)) return '是中宮';
  if (opt.from && p === opt.from) return '是原本的位置';
  const rs = env.rooms[p] || [];
  const c = env.cells[p] || {};
  const own = KIND_ROOMS[kind] || [];
  const hasOwn = rs.find((r) => own.includes(r));
  if (hasOwn) return `已有${hasOwn}`;
  if (kind === 'altar') {
    // Z5：神位改安——排除臥室類、廁所、廚房、二五（含流年）的宮（客廳、大門那一宮可以安神位）
    const bedHere = rs.find((r) => BED_ROOMS.includes(r));
    if (bedHere) return `有${bedHere}`;
    for (const r of ['廚房', '廁所']) if (rs.includes(r)) return `有${r}`;
    if (has25(env.cells, p, env.cur)) return `有${names25(env.cells, p, env.cur)}`;
    return '';
  }
  if (p === env.door) return '是大門所在';
  for (const r of ['客廳', '廚房', '廁所', '神明廳']) if (rs.includes(r)) return `有${r}`;
  // L2：這一宮已經排給另一間房（主臥、別人的床、別的臥室）——一宮只分給一間房；沒有原宮（格局段的泛稱）不看
  if ((kind === 'bed' || kind === 'master') && opt.from && env.claims && env.claims[p] && env.claims[p] !== opt.from) {
    return `已排給${dirOf(env.claims[p])}那一間`;
  }
  if ((kind === 'living' || kind === 'fish') && rs.some((r) => BED_ROOMS.includes(r))) return '有臥室';
  if (has25(env.cells, p, env.cur)) return `有${names25(env.cells, p, env.cur)}`;
  if (kind === 'bed' || kind === 'master') {
    if (c.luck === '凶') return '九宮評凶';
    if (c.mQi === '死氣' || c.mQi === '煞氣') return `山星屬${c.mQi}`;
  }
  if ((kind === 'living' || kind === 'fish') && !SHENG_QI.includes(c.fQi)) return '向星不生旺';
  if (kind === 'fish' && c.m === env.cur) return '山星當運';
  const who = whoOf(kind, env, opt);
  // Z5：小孩睡的床（或小孩房）不移到山向組合對小孩不利的宮
  if (kind === 'bed' && kidBadAt(c) && kidOf(who, opt)) return '山向組合對小孩不利';
  const bad = badPalacesOf(who);
  if (bad.includes(p)) return '是個人凶方';
  if (typeof RM.targetOk === 'function' && RM_KIND[kind]) {
    try {
      const ok = RM.targetOk(RM_KIND[kind], p, {
        cells: env.cells, rooms: env.rooms, doorPalace: env.door, period: env.cur, ownerLucky: { good: [], bad },
      });
      if (ok === false) return '不合內局的換房規則';
    } catch (e) { /* 內局還沒接好就只看這裡的規則 */ }
  }
  return '';
}

/**
 * X1：「把某房間／床位／動線移到哪一宮」的名單（依序）。kind：bed（臥室、床位）、master（主臥）、study（書房、書桌）、
 * living（客廳與常走的動線）、fish（魚缸）、altar（神位；Z5：排除臥室類、廁所、廚房、二五）。src：報告，或 build 的 ctx。
 * opt：from（原本那一宮，不當目標）、who（睡的人，[{ label, lucky:{bad:[…]} }]）、base（'house' 只挑宅卦吉方、'person' 只挑 who[0] 的個人吉方）、
 *      room（Z5：房間種類；'小孩房' 跟睡的人稱呼含「小孩」一樣，排除 COMBOS kidBad 的宮）。
 * 臥室類、書房依山星生旺排前；客廳動線、魚缸依向星生旺排前；同一級照原本順序。
 */
export function pickTargets(kind, src, opt = {}) {
  if (!TARGET_KINDS.includes(kind)) return [];
  const env = targetEnv(src);
  const o = opt || {};
  let base = PALACES.slice();
  if (o.base === 'house' && env.lucky && Array.isArray(env.lucky.good)) base = env.lucky.good.map((g) => g.palace);
  else if (o.base === 'person') {
    const w = Array.isArray(o.who) && o.who[0] && o.who[0].lucky;
    base = w && Array.isArray(w.good) ? w.good.map((g) => (typeof g === 'string' ? g : g.palace)) : [];
  }
  const key = kind === 'living' || kind === 'fish' ? 'fQi' : 'mQi';
  const rank = (p) => { const q = env.cells[p] && env.cells[p][key]; return q === '旺氣' ? 0 : q === '生氣' ? 1 : 2; };
  return base.filter((p) => !targetBlock(kind, p, env, o))
    .map((p, i) => [p, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
}

/**
 * D7＋R9：主臥換房的候選宮（宅卦吉方，用 pickTargets('master')）。只因為「已有臥室／小孩房／長輩房」被排除的吉方
 * 另外回在 swaps（只能寫「與該宮臥室對調」）。回 { targets:[宮], swaps:[{ palace, room }] }
 */
function bedOptions(ctx) {
  const { lucky, cells, input } = ctx;
  const from = input.masterPalace;
  const targets = pickTargets('master', ctx, { from, base: 'house' });
  const swaps = [];
  const env = targetEnv(ctx);
  for (const p of lucky.good.map((g) => g.palace)) {
    const rs = input.rooms[p] || [];
    const bed = rs.find((x) => OTHER_BEDS.includes(x));
    if (!bed || p === from || rs.includes('主臥')) continue;
    // 拿掉那間臥室再看一次，其他條件都過才可以對調
    const env2 = { ...env, rooms: { ...env.rooms, [p]: rs.filter((x) => !BED_ROOMS.includes(x)) } };
    if (targetBlock('master', p, env2, { from })) continue;
    // A2：反過來，那間房睡的人搬進主臥原宮 from 也要合格（kidBad、二五含流年、九宮凶、山星死煞、那個人的個人凶方）
    if (swapBackBlock(env, from, p, bed)) continue;
    swaps.push({ palace: p, room: bed });
  }
  const rank = (p) => (cells[p] && (cells[p].mQi === '旺氣' ? 0 : cells[p].mQi === '生氣' ? 1 : 2));
  swaps.sort((a, b) => rank(a.palace) - rank(b.palace));
  return { targets, swaps };
}

/**
 * A2：「主臥與 p 的 room 對調」時，p 那間房睡的人搬進主臥原宮 from 合不合格（可以回 ''）。
 * 用 targetBlock('bed', from, …)：主臥那一宮先拿掉「主臥」再看；睡的人＝床位在 p 的人（沒有就只看房間種類，小孩房照樣排除 kidBad）。
 */
function swapBackBlock(env, from, p, room) {
  if (!PALACES.includes(from)) return '主臥不在八宮';
  const env3 = { ...env, rooms: { ...env.rooms, [from]: (env.rooms[from] || []).filter((x) => x !== '主臥') } };
  return targetBlock('bed', from, env3, { who: sleepersAt(env, p), room, from: p });
}

/* ---- X1：文字裡「移到／換到／放在…宮（方）」的目標 ---- */

// Z5：「改到」（神位改到…）也算
const MOVE_VERB_RE = /移到|換到|放在|安排在|搬到|改到/g;
const PAL_REF_RE = /([坎艮震巽離坤兌乾])宮|(東北|東南|西北|西南|東|西|南|北)方/g;
// Z5：括號裡只寫方位字的清單「（東、南）」（只給神位改安用）
const BARE_DIR = '(?:東北|東南|西北|西南|東|西|南|北)';
const BARE_DIR_LIST_RE = new RegExp(`（(${BARE_DIR}(?:、${BARE_DIR})*)）`);
const DIR_TO_PALACE = Object.fromEntries(PALACES.map((p) => [PALACE_INFO[p].dir, p]));
/** 一段字的主詞是哪一種（看動詞前面最近的字） */
function moveKindOf(pre) {
  const t = String(pre || '');
  const hits = [
    ['fish', Math.max(t.lastIndexOf('魚缸'), t.lastIndexOf('水族'))], ['master', t.lastIndexOf('主臥')],
    ['bed', Math.max(t.lastIndexOf('臥室'), t.lastIndexOf('床'), t.lastIndexOf('小孩房'), t.lastIndexOf('長輩房'))],
    ['living', Math.max(t.lastIndexOf('客廳'), t.lastIndexOf('動線'), t.lastIndexOf('大門'))],
    ['study', Math.max(t.lastIndexOf('書房'), t.lastIndexOf('書桌'), t.lastIndexOf('讀書'))],
    // Z5：神位、神明廳、神桌
    ['altar', Math.max(t.lastIndexOf('神位'), t.lastIndexOf('神明'), t.lastIndexOf('神桌'))],
  ].filter((x) => x[1] >= 0);
  if (!hits.length) return null;
  // 「臥室、床位」「大門、客廳」這種並列取最後出現的那一個所屬的種類；主臥優先於臥室（「主臥」也含「臥」）
  hits.sort((a, b) => b[1] - a[1]);
  return hits[0][0];
}
/**
 * X1：一段文字裡講到的「移到／換到／放在／安排在／搬到 …宮（方）」。回 [{ kind, palaces, sent, start, end }]。
 * 否定的（不宜放在、不要移到…）不算；「這一方／這一宮」對到 here（呼叫的人給的宮位）。
 */
function moveMentions(text, here = null) {
  const out = [];
  for (const sent of sentences(text)) {
    for (const cl of clausesOf(sent.replace(/[。！？]$/, ''))) {
      const g = new RegExp(MOVE_VERB_RE.source, 'g');
      let m;
      while ((m = g.exec(cl))) {
        const pre = cl.slice(0, m.index);
        if (NEG_RE.test(pre) || NEG_TAIL.test(pre) || /不宜|不要|別|勿/.test(pre)) continue;
        const kind = moveKindOf(pre) || moveKindOf(sent.slice(0, sent.indexOf(cl)));
        if (!kind) continue;
        const after = cl.slice(m.index + m[0].length);
        const ps = [];
        for (const r of after.matchAll(PAL_REF_RE)) {
          const p = r[1] || DIR_TO_PALACE[r[2]];
          if (p && !ps.includes(p)) ps.push(p);
        }
        // Z5：神位「改到游年吉方（東、南）」這種只寫方位字的清單
        if (!ps.length && kind === 'altar') {
          const bl = after.match(BARE_DIR_LIST_RE);
          if (bl) for (const d of bl[1].split('、')) if (DIR_TO_PALACE[d] && !ps.includes(DIR_TO_PALACE[d])) ps.push(DIR_TO_PALACE[d]);
        }
        if (!ps.length && here && /^(?:這一方|這一宮|此方|此宮)/.test(after)) ps.push(here);
        if (ps.length) out.push({ kind, palaces: ps, sent, verb: m[0] });
      }
    }
  }
  return out;
}
/** X1：這一段的移動目標有沒有不在 pickTargets 名單裡的（回 [{ kind, palace, sent }]） */
function badMoves(text, src, opt = {}, here = null) {
  const bad = [];
  for (const mv of moveMentions(text, here)) {
    const ok = pickTargets(mv.kind, src, opt);
    for (const p of mv.palaces) if (!ok.includes(p)) bad.push({ kind: mv.kind, palace: p, sent: mv.sent });
  }
  return bad;
}
const PAL_ITEM = '(?:[坎艮震巽離坤兌乾]宮（[^）]{1,4}）|(?:東北|東南|西北|西南|東|西|南|北)方（[坎艮震巽離坤兌乾]宮）|(?:東北|東南|西北|西南|東|西|南|北)方|[坎艮震巽離坤兌乾]宮)';
const PAL_LIST_RE = new RegExp(`${PAL_ITEM}(?:[、或]${PAL_ITEM})*`, 'g');
/** 一個「坎宮（北方）」「北方（坎宮）」「北方」項目指哪一宮 */
function palOfItem(s) {
  const m = String(s).match(/([坎艮震巽離坤兌乾])宮/);
  if (m) return m[1];
  const d = String(s).match(/^(東北|東南|西北|西南|東|西|南|北)方/);
  return d ? DIR_TO_PALACE[d[1]] : null;
}
/**
 * X1：把一段文字裡不在 pickTargets 名單的移動目標改掉：名單裡還有的留下；一個都不剩就整句換成不移的說法
 * （臥室類「不建議換房」、魚缸「建議撤掉」、客廳動線與書房整句拿掉），後面接的退路句（不能換房時，…）拿掉條件子句。
 */
function fitMoves(text, src, opt = {}, here = null) {
  const t = String(text || '');
  if (!t || !moveMentions(t, here).length) return t;
  const out = [];
  let dropNextCond = false;
  for (const sent of sentences(t)) {
    let s = sent;
    if (dropNextCond && FALLBACK_RE.test(s)) {
      s = s.replace(/^[^，；：。！？]*時[，；]\s*/, '');
      dropNextCond = false;
      if (s) out.push(s);
      continue;
    }
    dropNextCond = false;
    const mvs = moveMentions(s, here);
    if (!mvs.length) { out.push(s); continue; }
    let gone = null;
    for (const mv of mvs) {
      const ok = pickTargets(mv.kind, src, opt);
      if (mv.palaces.every((p) => ok.includes(p))) continue;
      const keep = mv.palaces.filter((p) => ok.includes(p));
      if (keep.length) {
        // 名單裡還有的留下：把「坎宮（北方）、離宮（南方）」這種清單裡不在名單的那幾個拿掉
        s = s.replace(PAL_LIST_RE, (lst) => {
          const items = lst.split(/[、或]/);
          if (!items.some((x) => mv.palaces.includes(palOfItem(x)))) return lst;
          const left = items.filter((x) => keep.includes(palOfItem(x)));
          return left.length ? left.join(lst.includes('或') && !lst.includes('、') ? '或' : '、') : lst;
        });
        // Z5：神位「（東、南）」這種清單
        if (mv.kind === 'altar') {
          s = s.replace(new RegExp(BARE_DIR_LIST_RE.source, 'g'), (whole, lst) => {
            const items = lst.split('、');
            if (!items.some((x) => mv.palaces.includes(DIR_TO_PALACE[x]))) return whole;
            const left = items.filter((x) => keep.includes(DIR_TO_PALACE[x]));
            return left.length ? `（${left.join('、')}）` : whole;
          });
        }
      } else {
        gone = mv;
        break;
      }
    }
    if (!gone) { out.push(s); continue; }
    const moveVerb = /換到|移到|搬到/.test(gone.verb);
    if ((gone.kind === 'bed' || gone.kind === 'master') && moveVerb) {
      out.push('沒有合適的房間可以換過去，不建議換房，重點放在床位與床頭。');
      dropNextCond = true;
    } else if (gone.kind === 'fish' && moveVerb) {
      out.push('這間房子沒有合適的生旺向星位可放魚缸，建議撤掉，原位保持安靜。');
    } else if (gone.kind === 'altar' && /改到|移到|換到|搬到/.test(gone.verb)) {
      // Z5：神位沒有合適的吉方可以改安
      out.push('其他吉方都不適合安神位（臥室、廁所、廚房或二黑五黃），神位先不移，神桌保持整潔、背後靠實牆。');
    }
    // 「可安排在…」這種順帶的建議、客廳動線、書房：整句拿掉
  }
  return out.join('');
}

/**
 * R10：主臥「看法不同」的總結句。依實際跟八宅相反（看吉）的派別數寫「兩種」或「三種」；
 * 玄空不支持吉時寫「八宅與玄空都偏凶，只有命卦看是吉」；一律寫「各派都列」。
 */
function masterViewSummary(mv) {
  const good = [];
  if (mv.ownerGood) good.push('命卦');
  if (mv.mGood) good.push('玄空');
  const bad = ['八宅'];
  if (mv.ownerStar && !mv.ownerGood) bad.push('命卦');
  if (!mv.mGood) bad.push('玄空');
  const n = good.length + 1;
  const kinds = n >= 3 ? '三種' : '兩種';
  const tail = `${kinds}看法不同，各派都列、不替你選邊，所以不建議為這一條換房。`;
  if (good.length >= 2) return `八宅看是凶，${good.join('與')}看是吉，${tail}`;
  if (bad.length >= 2) return `${bad.join('與')}都偏凶，只有${good[0]}看是吉，${tail}`;
  return `八宅看是凶，${good[0]}看是吉，${tail}`;
}

function masterFixOf(ctx) {
  const { master, masterView, owner } = ctx;
  if (!master) return { fix: '', action: '', items: [] };
  const goodPlain = owner && owner.lucky ? owner.lucky.good.map((x) => x.dir).join('、') : '';
  if (masterView) {
    const fix = '不必急著換房。'
      + (goodPlain ? `床位與床頭取戶主的個人吉方（${goodPlain}），床頭靠實牆。` : '床頭靠實牆、朝睡的人的個人吉方。')
      + '房內保持安靜整潔，少放發熱或會震動的電器。';
    return {
      fix,
      action: goodPlain ? '床位與床頭取戶主個人吉方，不必急著換房' : '床頭靠實牆、房內保持安靜，不必急著換房',
      items: [],
    };
  }
  // Z4：跟居住者段同一份計畫（build 先算好的 masterPlan）
  const { targets, swaps } = ctx.masterPlan || bedOptions(ctx);
  const kb = ROOM_FIX.臥室在凶方 || { items: [] };
  const rest = [...kb.items].map(String).filter((x) => !/換房|換到/.test(x)).slice(0, 3).map((x) => personalHead(x));
  if (targets.length) {
    const t = targets.slice(0, 2).map(where).join('、');
    return {
      fix: `可以的話，主臥換到${t}。換不了時，床位與床頭配個人吉方來補。${joinItems(rest)}`,
      action: `主臥換到${targets.slice(0, 2).map(dirOf).join('或')}，換不了就床頭朝個人吉方`,
      items: rest,
    };
  }
  if (swaps.length) {
    // R9：吉方都已有人睡，只能寫「與該宮的臥室對調」
    const s = swaps[0];
    return {
      fix: `可以的話，主臥與${where(s.palace)}的${s.room}對調。換不了時，床位與床頭配個人吉方來補。${joinItems(rest)}`,
      action: `主臥與${dirOf(s.palace)}的${s.room}對調，換不了就床頭朝個人吉方`,
      items: rest,
    };
  }
  return {
    fix: `這間房子沒有合適的房間可換，不建議換房，重點放在床位與床頭。${joinItems(rest)}`,
    action: '床頭朝個人吉方，床盡量靠向個人吉方那一側',
    items: rest,
  };
}

function buildBazhai(ctx) {
  const {
    input, cx, house, lucky, door, master, masterView, stove, doorScore, masterScore, stoveScore, bazhai, cells, owner,
  } = ctx;
  const items = [];
  const sp = cx.sittingPalace;

  // 門（D6：兩種立法都以坐山卦的游年判大門）
  if (door) {
    const yi = YOUNIAN[door.star];
    let t = `大門在${where(door.palace)}，落在八宅游年的${door.star}（${yi.alias}）。${YOUNIAN_TEXT[door.star].door}`;
    if (input.doorSource === '向宮') t += '九宮裡沒有填大門，這裡暫以向宮計。';
    else if (input.doorSource === '中宮') t += `${DOOR_CENTER_NOTE}。`;
    if (house.mode === 'door') {
      t += `門上起伏位時，宅卦由大門起，主臥與灶看${house.gua}卦的游年。`
        + `大門本身仍以坐山論：從坐方${sp}卦起游年，門落在${door.star}。`;
    }
    t += `八宅「門」得 ${fmtNum(doorScore)} 分（滿分 9）。`;
    let dr = yi.luck === '凶' ? doorRemedy(door.star) : null;
    const door25 = has25(cells, door.palace, ctx.curPeriod);
    if (dr && dr.with25 && door25) dr = dr.with25;
    let doorFix = dr ? personalHead(endDot(dr.method) + joinItems([...dr.items].map(String).slice(0, 3))) : undefined;
    // T9：八宅門星與玄空門宮向星的化解五行不同（門墊顏色會打架）→ 補一句以較重的為準
    // A8：八宅的五行會生旺失令的門宮向星、或跟玄空門宮那一條相剋 → 拿掉那一行的做法，兩派都列、標看法不同
    const dv = doorFix ? doorViewOf(ctx) : null;
    if (doorFix && dv && dv.excluded) {
      doorFix = `${doorAvoidText(doorFix, dv)}${doorDifferNote(dv)}`;
    } else if (doorFix) {
      const dq = (ctx.interior.items || []).find((it) => it.rule === 'door-facing-qi' && it.delta < 0 && it.palace === door.palace);
      const qStar = dq ? (dq.star || cells[door.palace].f) : null;
      if (qStar) {
        const bzWx = door25 ? '金' : SHENG[yi.wx];
        const xkWx = door25 ? '金' : SHENG[STAR_WX[qStar]];
        if (bzWx && xkWx && bzWx !== xkWx) doorFix += DOOR_MAT_DIFFER;
      }
    }
    // Z2：門宮不能放水（山星當運、廁所水、向星死煞）時，「玄關放一杯靜水」改成不放水的版本並說明
    if (doorFix) doorFix = dryText(doorFix, door.palace, ctx).text || undefined;
    items.push(mk(yi.luck === '吉' ? '吉' : '凶', `大門在${dirOf(door.palace)}：游年${door.star}（${yi.level}）`, personalHead(t),
      { palace: door.palace, fix: doorFix }));
  } else {
    items.push(mk('注意', '大門無法判斷', `沒有大門宮的游年星，八宅「門」以 ${fmtNum(doorScore)} 分計。`));
  }

  // 兩種立法的差別（D6）
  items.push(mk('平', '坐山立極與門上起伏位',
    '坐山立極以坐山定宅卦，門、主、灶都看坐山卦的游年。'
    + '門上起伏位以大門定宅卦，主臥與灶看門卦的游年。'
    + '大門本身兩種立法都看坐山，傳統說「門以宅坐論」。'
    + `本報告用的是${house.mode === 'door' ? '門上起伏位' : '坐山立極'}。`));

  // 主（D7）
  if (master) {
    const yi = YOUNIAN[master.star];
    // L3：吉方的主臥落在二五宮（含流年）——不寫推薦句（添丁、最合適…），補「此宮有X，八宅與玄空看法不同」
    const good25 = yi.luck === '吉' && has25(cells, master.palace, ctx.curPeriod);
    let bedText = masterView ? '' : personalHead(YOUNIAN_TEXT[master.star].bedroom);
    if (good25) bedText = `${stripRecBed(bedText)}此宮有${desc25(cells, master.palace, ctx.curPeriod)}，八宅與玄空看法不同。`;
    // 10/04 收尾：睡主臥的人全是長輩（稱呼長輩或年滿 55）——不寫添丁、年輕夫妻、事業、姻緣這類推薦句
    const mss = ctx.people && ctx.people.sleepers && ctx.people.sleepers[master.palace];
    const elderOnly = Array.isArray(mss) && mss.length > 0
      && mss.every((x) => /長輩/.test(String(x.label || '')) || (Number.isFinite(x.age) && x.age >= ELDER_AGE));
    if (elderOnly && !good25 && bedText) bedText = `${stripRecBed(bedText)}長輩睡這裡，以睡得安穩、精神好為重。`;
    const t = `主臥在${where(master.palace)}，落在游年${master.star}。${bedText}`
      + `八宅「主」得 ${fmtNum(masterScore)} 分（滿分 8）。`;
    const mf = yi.luck === '凶' ? masterFixOf(ctx) : null;
    // F2：二五宮（含流年）的主臥評吉——八宅吉、玄空二五宜靜，level 改「注意」（三優也不列）
    items.push(mk(yi.luck === '吉' ? (good25 ? '注意' : '吉') : '凶', `主臥在${dirOf(master.palace)}：游年${master.star}（${yi.level}）`, t,
      { palace: master.palace, fix: mf && mf.fix ? mf.fix : (good25 ? BED_25_FIX : undefined) }));
    if (masterView) {
      const v = [`八宅看宅卦，主臥在游年${master.star}，屬凶。`];
      if (masterView.ownerStar) {
        v.push(`看戶主命卦，這一方是個人${masterView.ownerStar}，屬${YOUNIAN[masterView.ownerStar].luck}。`);
      }
      v.push(`玄空看這一宮山星${sn(masterView.m)}屬${qiLabel(masterView.mQi)}，${masterView.mGood ? '山星生旺，利人丁健康' : '山星不算生旺'}。`);
      v.push(masterViewSummary(masterView));
      items.push(mk('注意', `主臥：看法不同（${dirOf(master.palace)}）`, v.join(''), { palace: master.palace }));
    }
  } else if (input.masterPalace === '中') {
    items.push(mk('注意', '主臥在中宮', '主臥填在中宮，中宮沒有游年星可論，八宅「主」以 4 分（中間值）計。', { palace: '中' }));
  } else {
    items.push(mk('注意', '主臥未填', '九宮裡沒有填主臥，八宅「主」以 4 分（中間值）計。到第 3 步勾選主臥就能評分。'));
  }

  // 灶（D5：灶口以宅卦游年吉方為準）
  if (stove) {
    const yi = YOUNIAN[stove.star];
    let t = `爐灶座落在${where(stove.palace)}，是游年${stove.star}。${YOUNIAN_TEXT[stove.star].stove}`;
    if (stove.mouth) {
      t += `灶口朝${PALACE_INFO[stove.mouth.palace].dir}方，是游年${stove.mouth.star}，`
        + (stove.mouth.ok ? '合乎「火門宜向吉方」。' : '朝向凶方，傳統認為不宜。');
    } else {
      t += `沒有填灶口朝向，灶口以中間值計；灶口宜朝游年吉方（${goodDirsText(lucky)}）。`;
    }
    t += '灶口這裡指爐具開關旋鈕那一面，另一派以瓦斯進氣方向為準。';
    if (owner && owner.match === false) t += '另一派以戶主命卦的吉方定灶口，你的宅命不配，兩派方位不同，請自行斟酌。';
    t += `八宅「灶」得 ${fmtNum(stoveScore)} 分（滿分 8）。`;
    const fixes = [];
    const mouthBad = !!(stove.mouth && !stove.mouth.ok);
    // R22：灶壓吉又灶口朝凶時，「轉向游年（宅）吉方」與「轉向游年吉方（…）」合併成一句
    // L1：移爐那一句點名目標宮（排除二五、臥室、大門、神位、廁所）；都不行就只講灶口
    if (!stove.sitOk) fixes.push(stoveSitFix(ctx));
    else if (mouthBad) fixes.push(stoveMouthFix(lucky, false));
    const lv = stoveScore >= 6 ? '吉' : stoveScore <= 2 ? '凶' : '注意';
    const head = stove.mouth ? `、灶口朝游年${stove.mouth.star}` : '';
    const sitWord = stove.sitOk ? '灶壓凶方' : '壓到吉方';
    items.push(mk(lv, `爐灶坐游年${stove.star}（${sitWord}）${head}`, t,
      { palace: stove.palace, fix: fixes.length ? fixes.join('') : undefined }));
  } else if (input.stovePalace === '中') {
    items.push(mk('注意', '廚房在中宮', '廚房在中宮，八宅沒有游年星可論，「灶」以 4 分計；中宮廚房的扣分見內局一段。', { palace: '中' }));
  } else {
    items.push(mk('注意', '廚房未填', '九宮裡沒有填廚房，八宅「灶」以 4 分（中間值）計。'));
  }

  // 大門：八宅與玄空看法不同
  if (door && cells[door.palace]) {
    const c = cells[door.palace];
    const yi = YOUNIAN[door.star];
    const xkGood = ['旺氣', '生氣', '進氣'].includes(c.fQi);
    const xkBad = ['衰氣', '死氣', '煞氣'].includes(c.fQi);
    if ((yi.luck === '吉' && xkBad) || (yi.luck === '凶' && xkGood)) {
      items.push(mk('注意', '大門：八宅與玄空看法不同',
        `八宅看大門在游年${door.star}，屬${yi.luck}；玄空看大門宮的向星${sn(c.f)}屬${qiLabel(c.fQi)}，${xkGood ? '偏吉' : '偏凶'}。`
        + '兩派看的角度不同，兩邊都列，不替你選邊。', { palace: door.palace }));
    }
  }

  // 四吉方四凶方
  items.push(mk('平', `${house.gua}宅的四吉方、四凶方`,
    `四吉方：${lucky.good.map((x) => `游年${x.star}在${x.dir}`).join('、')}。`
    + `四凶方：${lucky.bad.map((x) => `游年${x.star}在${x.dir}`).join('、')}。`
    + '門、主臥、書房、神位宜在吉方；廁所、儲藏、爐灶座落宜在凶方來壓。'));

  items.push(mk('平', `八宅門主灶 ${fmtNum(bazhai.score)} 分（滿分 25）`,
    `門 ${fmtNum(doorScore)}（滿分 9）＋主臥 ${fmtNum(masterScore)}（滿分 8）＋灶 ${fmtNum(stoveScore)}（滿分 8）＝ ${fmtNum(bazhai.score)} 分。`));
  return section('bazhai', items);
}

/* ---- 九宮逐宮 ---- */

/**
 * R5：九宮卡的組合建議遇到二黑五黃（山向星或流年星）：拿掉土、火、木、水的建議（clean25），
 * 流年帶來的二五加「今年此宮逢流年X，只用金」，剩下沒有金的做法就補一句金洩。
 */
function palaceFix25(fix, c, cur, { light = false } = {}) {
  const yr = c.yearStar && is25(c.yearStar, cur) ? c.yearStar : null;
  const own = uniq([c.m, c.f].filter((s) => is25(s, cur)).map(sn));
  let removed = false;
  let src = sentences(fix);
  // T3：流年二五飛到時，「可做臥室」「見水」「開門開窗」「宜動」「明亮」這種句子整句拿掉（吉宮的催旺話不再成立）
  if (yr) {
    const before = src.length;
    src = src.filter((s) => !positiveHit(s, ACTIVE25_RE));
    if (src.length !== before) removed = true;
  }
  let list = src.map((s) => {
    const r = clean25(s);
    if (r.removed) removed = true;
    return r.text;
  }).filter(Boolean);
  // 流年二五飛到時，「不必化解」「想催旺」這種吉宮的話不再成立
  if (yr) list = list.filter((s) => !/^(不必化解|想催旺|可催旺)/.test(s));
  const note = yr ? `今年此宮逢流年${sn(yr)}，只用金、宜靜不宜動。`
    : (own.length && removed ? `此宮有${own.join('、')}，只用金洩、宜靜不宜動。` : '');
  // R19：「只用金」只講一次
  if (note) list = list.filter((s) => !/只用金/.test(s));
  const out = note ? [note, ...list] : list;
  // T7：補金之前，同一段不能還留著「少放金屬、少用白色」（clean25 已拿掉，這裡再保險一次）
  const kept = out.filter((s) => !negMetal(s));
  if (!kept.some((s) => positiveHit(s, FAMILY.金))) kept.push(light ? METAL_LIGHT : METAL_ITEM);
  return kept.join('');
}

/**
 * T5：令星入囚時中宮九宮卡的做法：以開闊為先（PRISON_FIX），組合建議拿掉「厚重、陶瓷、擺設」與「用土洩當運星」這類，
 * 前面加「此宮令星入囚，以開闊為先，見格局段」。中宮又有二黑五黃時，照 D4 只用金，但金只放一點。
 */
function prisonCardFix(fix, c, cur, p25) {
  const W = STAR_WX[cur];
  const D = W ? SHENG[W] : null;
  const drop = new RegExp(['厚重', '陶瓷', '擺設', '擺件', ...(D ? [`用${D}(?:來)?洩`, `${D}洩${W}`] : [])].join('|'));
  const rest = sentences(fix).filter((s) => !drop.test(s));
  if (p25) {
    // G4：中宮有二黑五黃——入囚的做法只拿掉「宜明亮通風」，挑高天井補動土提醒；組合建議照 D4 只用金，金只放一點
    const note = buildNoteOf({ 中: c }, '中', cur);
    const restFix = rest.length ? palaceFix25(rest.join(''), c, cur, { light: true }) : palaceFix25('', c, cur, { light: true });
    const tail = sentences(restFix).filter((s) => !/厚重/.test(s))
      .map((s) => (constructHit(s) ? withBuildNote(s, note) : s));
    if (!tail.some((s) => positiveHit(s, FAMILY.金))) tail.push(METAL_LIGHT);
    // 組合建議裡一般的金（METAL_ITEM）換成輕量的
    return `${PRISON_CARD_NOTE}${prisonFixOf({ 中: c }, cur)}${tail.map((s) => (s === METAL_ITEM ? METAL_LIGHT : s)).join('')}`;
  }
  return `${PRISON_CARD_NOTE}${PRISON_FIX}${rest.join('')}`;
}

/**
 * T16：九宮卡的做法跟化解清單同一宮的做法五行相剋（非二五宮）：只留不相剋的句子；整段都相剋時改寫成
 * 「這一宮另有「X」的化解（見化解清單），五行相剋，這裡的做法先不用」。
 */
function cardVsRemedies(fix, p, entries) {
  const others = (entries || []).filter((e) => e.palace === p && !(e.srcs.length === 1 && e.srcs[0] === 'palaces'));
  if (!others.length) return fix;
  const fams = new Map();
  for (const e of others) {
    for (const t of [e.method, ...e.items, e.action]) {
      for (const f of familiesOf(t)) if (!fams.has(f)) fams.set(f, e);
    }
  }
  if (!fams.size) return fix;
  let hitBy = null;
  const keep = sentences(fix).filter((s) => {
    const bad = familiesOf(s).find((f) => [...fams.keys()].some((k) => KE[k] === f || KE[f] === k));
    if (!bad) return true;
    if (!hitBy) {
      const k = [...fams.keys()].find((x) => KE[x] === bad || KE[bad] === x);
      hitBy = fams.get(k);
    }
    return false;
  });
  if (!hitBy) return fix;
  const tell = `這一宮另有「${hitBy.problems[0]}」的化解（見化解清單），五行相剋，這裡相剋的做法先不用。`;
  return keep.length ? `${keep.join('')}${tell}` : tell.replace('這裡相剋的做法', '這裡的做法');
}

function buildPalaces(ctx) {
  const { period, curPeriod, changed, cells, badPalaces, fit } = ctx;
  const prisonNow = !!(fit && fit.prison && (fit.prison.mountain || fit.prison.facing));
  const items = [];
  const good = ALL_PALACES.filter((p) => cells[p].luck === '吉');
  items.push(mk(badPalaces.length >= 3 ? '注意' : '平', `九宮：凶 ${badPalaces.length} 宮、吉 ${good.length} 宮`,
    `${SCORE_NOTE}凶宮的化解見化解清單。`
    + (badPalaces.length ? `評為凶的方位：${badPalaces.map(dirOf).join('、')}。` : '')
    + (changed ? `盤依入住時的${CN[period]}運起，旺衰以現在的${CN[curPeriod]}運判。` : '')));
  for (const p of ALL_PALACES) {
    const c = cells[p];
    const pt = PALACE_TEXT[p];
    // Z8：這一宮有二黑五黃（含流年）時，宮位白話的「宜乾淨、明亮、安靜」改成「宜乾淨、安靜」（二五宜靜，不寫明亮）
    const s = [has25(cells, p, curPeriod) ? noBright(pt.text) : pt.text];
    if (p === '中') s.push('八宅：中宮不排游年星。');
    else if (c.younian) {
      const yi = YOUNIAN[c.younian];
      s.push(`八宅：這一宮是游年${c.younian}（${yi.alias}），屬${yi.luck}，等級${yi.level}。`);
    }
    // R8：門上起伏位時，大門本身以坐山論的游年星另外寫一句
    if (c.doorYounian && c.isDoor) s.push(`大門本身以坐山論，落游年${c.doorYounian}（見八宅段）。`);
    s.push(`玄空：山星${sn(c.m)}屬${qiLabel(c.mQi)}，向星${sn(c.f)}屬${qiLabel(c.fQi)}，運星是${sn(c.yun)}。`);
    const key = c.combo.key;
    const comboFix = key && COMBOS[key] ? COMBOS[key].fix : '';
    let ctext = c.combo.text || '';
    let fix;
    const tail = `建議：${comboFix}`;
    const p25 = has25(cells, p, curPeriod);
    const prisonHere = p === '中' && prisonNow;
    if ((c.luck !== '吉' || p25 || prisonHere) && comboFix && ctext.endsWith(tail)) {
      ctext = ctext.slice(0, -tail.length);
      fix = comboFix;
    }
    // T21：條件句（「五運當令時不必化解」「當運山星時不宜擺水」）先依本宅判斷
    if (fix) {
      fix = resolveConditional(sentences(fix), c, curPeriod)
        .map((s) => s.replace(/^其餘元運[，、]?/, '')).join('');
    }
    if (prisonHere) {
      // T5：令星入囚的中宮以開闊為先
      fix = prisonCardFix(fix || '', c, curPeriod, p25);
    } else if (fix && p25) {
      // R5：這一宮有二黑五黃（含流年）→ 組合的建議用 clean25 過濾，補金洩；流年帶來的要明講
      fix = palaceFix25(fix, c, curPeriod);
    }
    // T16：非二五宮，卡片的做法跟化解清單同宮的做法五行相剋 → 只留不相剋的
    if (fix && !p25) fix = cardVsRemedies(fix, p, ctx.remedyEntries);
    // Z2：這一宮不能放水（山星當運、廁所水、凶宮失令）→ 通關、洩氣的放水句改成不放水的版本
    if (fix) fix = dryText(fix, p, ctx).text;
    if (!fix) fix = undefined;
    // G8：吉宮（沒有拿出來的）「建議：」也跑條件句判斷與同宮比對；放在本文最後（閘門以「建議：」到結尾為建議句）
    let advice = '';
    if (comboFix && ctext.endsWith(tail)) {
      ctext = ctext.slice(0, -tail.length);
      advice = resolveConditional(sentences(comboFix), c, curPeriod)
        .map((x) => x.replace(/^其餘元運[，、]?/, '')).join('');
      if (advice) advice = cardVsRemedies(advice, p, ctx.remedyEntries);
      if (advice) advice = dryText(advice, p, ctx).text;
    }
    if (c.combo.title) s.push(`山向組合：${c.combo.title}。`);
    if (ctext) s.push(ctext);
    if (c.m === 9 || c.f === 9) s.push(NINE_NOTE);
    // A7：理由本身可能帶括號（兩星都失令（衰、退）），用冒號接，不括號套括號
    s.push(`依兩星在${CN[curPeriod]}運的旺衰，這一宮評為「${c.luck}」：${c.luckWhy}。`);
    if (c.combo.luck && c.combo.luck !== c.luck) s.push(`組合本身的總評是「${c.combo.luck}」，看的角度不同，僅供參考。`);
    s.push(c.rooms.length ? `目前這一宮有：${c.rooms.join('、')}。` : '目前這一宮沒有填房間。');
    if (p !== '中' && c.ext.length) s.push(`屋外這一方有：${c.ext.map((k) => EXT_TYPES[k].label).join('、')}。`);
    const tags = [];
    if (c.isDoor) tags.push('大門所在');
    if (c.isSit) tags.push('坐方');
    if (c.isFace) tags.push('向方');
    if (c.beast) tags.push(`${c.beast}位`);
    if (tags.length) s.push(`這一宮是${tags.join('、')}。`);
    if (advice) s.push(`${CARD_ADVICE}${advice}`);
    const title = `${pt.title}｜山星${sn(c.m)}・向星${sn(c.f)}${c.younian ? `｜游年${c.younian}` : ''}`;
    items.push(mk(c.luck, title, s.join(''), { palace: p, fix }));
  }
  return section('palaces', items);
}

/* ---- 內局 ---- */

/**
 * T14：爐灶在乾宮、而且八宅看是灶壓凶方（灶坐游年凶方）→ 不叫你把爐灶移出西北。
 * L1：灶壓吉方、但游年凶方都不適合移爐（stoveTargets 是空的）→ 一樣不叫你移（移出西北也沒有地方去）。
 */
function qianStoveOk(ctx) {
  const st = ctx && (ctx.stove || (ctx.bazhai && ctx.bazhai.stove));
  if (!(st && st.palace === '乾')) return false;
  return !!st.sitOk || !stoveTargets(ctx).length;
}
/** 火燒天門不移爐時的說明：灶壓凶方（T14）或沒有合適的凶方（L1） */
const QIAN_NOWHERE_NOTE = '游年凶方都不適合移爐（見八宅段的爐灶），先不移爐。';
function qianNote(ctx) {
  const st = ctx && (ctx.stove || (ctx.bazhai && ctx.bazhai.stove));
  return st && st.sitOk ? QIAN_STOVE_NOTE : QIAN_NOWHERE_NOTE;
}
/** T14：拿掉「避開西北角、把爐具移出西北」這幾段，留下不動工的做法 */
function dropStoveMove(list) {
  const out = [];
  for (const raw of list) {
    const s = String(raw || '').trim();
    if (!s) continue;
    if (!STOVE_MOVE_RE.test(s)) { out.push(s); continue; }
    const dot = /。$/.test(s);
    const cls = clausesOf(s.replace(/。$/, '')).filter((c) => !STOVE_MOVE_RE.test(c));
    let t = cls.join('').replace(/^[，；\s]+/, '').replace(/[，；\s]+$/, '')
      .replace(/^(否則|不能移時|移不了時|不然)，?/, '').replace(/；否則/g, '；');
    if (!t || !VERB_RE.test(t)) continue;
    out.push(dot ? endDot(t) : t);
  }
  return out.map((s) => s.replace(/^(不能移時|否則)，?/, ''));
}
function qianNoMoveFix(fix, ctx = null) {
  const kept = dropStoveMove(sentences(fix));
  const metal = kept.some((s) => positiveHit(s, FAMILY.金)) ? '' : `${QIAN_STOVE_ACTION}。`;
  return `${ctx ? qianNote(ctx) : QIAN_STOVE_NOTE}${metal}${kept.join('')}`;
}

/**
 * X1：內局一條的報告版本（不改 interior.items 本身）：
 *   - fix 的前言、床頭說法、火燒天門遇灶壓凶方照舊處理；
 *   - 臥室山星二五（bedroom-mountain-2-5）落在宅卦游年吉方：不寫換房，改「看法不同」（level 注意）；
 *   - 換房、動線、魚缸的目標宮不在 pickTargets 名單的改掉（fitMoves）。
 * 回 { fix, level, text, differ }
 */
function interiorView(it, ctx) {
  // L2：同一條只算一次（化解清單先算、內局段再拿同一份），換房目標的登記才不會前後不一
  const memo = ctx.interiorViews || (ctx.interiorViews = new Map());
  if (memo.has(it)) return memo.get(it);
  const v = interiorViewRaw(it, ctx);
  // L2：這一條講到的換房、移床目標登記給這一宮（之後別間房不再排進來）；F4：中宮的臥室也登記
  const p = it.palace;
  const env = ALL_PALACES.includes(p) && v.fix ? targetEnv(ctx) : null;
  if (env && env.claims) {
    for (const mv of moveMentions(v.fix)) {
      if (mv.kind !== 'bed' && mv.kind !== 'master') continue;
      for (const q of mv.palaces) if (PALACES.includes(q) && q !== p && !env.claims[q]) env.claims[q] = p;
    }
  }
  memo.set(it, v);
  return v;
}
function interiorViewRaw(it, ctx) {
  let fix = it.fix ? stripPreface(personalHead(youText(it.fix))) : '';
  // T14：火燒天門遇灶壓凶方，不叫你把爐灶移出西北
  if (fix && it.rule === 'kitchen-qian' && qianStoveOk(ctx)) fix = qianNoMoveFix(fix, ctx);
  let level = it.level;
  let text = youText(it.text);
  let differ = it.differ === true || /^看法不同/.test(String(it.text));
  const p = it.palace;
  const yn = PALACES.includes(p) ? ctx.stars[p] : null;
  if (it.rule === 'bedroom-mountain-2-5' && yn && YOUNIAN[yn] && YOUNIAN[yn].luck === '吉' && !/不必為此換房/.test(fix)) {
    const kept = sentences(fix).filter((s) => !moveMentions(s).length);
    fix = `${kept.join('')}不必為此換房。`;
    text = `${text}看法不同：八宅宅卦看，這一宮是宅的游年${yn}吉方，跟玄空看法不同，這裡並列，分數照玄空扣。`;
    level = '注意';
    differ = true;
  }
  // Z5：神位改安的目標用 pickTargets('altar')（排除臥室、廁所、廚房、二五），點名到宮
  if (it.rule === 'altar-younian-bad' && PALACES.includes(p)) {
    const t = pickTargets('altar', ctx, { from: p, base: 'house' }).slice(0, 2);
    const when = /擇日|請神/.test(fix) ? (sentences(fix).find((s) => /擇日|請神/.test(s)) || '') : '移動神位前，建議依習俗擇日處理。';
    fix = t.length
      ? `神位可改到游年吉方的${t.map(where).join('或')}安奉，背後靠實牆，不要靠廁所或爐灶的牆。${when}`
      : '其他游年吉方都不適合安神位（臥室、廁所、廚房或二黑五黃），神位先不移。神桌保持整潔、背後靠實牆，不要靠廁所或爐灶的牆。';
  }
  // Z3：向星生旺的魚缸落在二五宮，不算催財（五黃二黑宜靜），改注意、標看法不同
  if (it.rule === 'fish-facing-good' && PALACES.includes(p) && has25(ctx.cells, p, ctx.curPeriod) && it.delta >= 0) {
    if (!/看法不同/.test(text)) {
      text = `${text}看法不同：這一宮另有${names25(ctx.cells, p, ctx.curPeriod)}，宜靜不宜動，魚缸的水流打氣會引動它，催財的說法這裡先不用。`;
    }
    level = '注意';
    differ = true;
  }
  // F4：中宮的臥室類也過一次（換房目標照 pickTargets，已排給別間的宮不再給中宮那一間）
  if (fix && moveChecked(p, it.room)) fix = fitMoves(fix, ctx, { from: p, room: it.room });
  // Z4：臥室類換房跟睡在這一宮的人的床位計畫一致——有人「不建議移床」就不寫換房；有人要移床就不寫「不建議換房」
  if (fix && PALACES.includes(p) && BED_ROOMS.includes(it.room)) fix = bedRoomFix(fix, p, ctx);
  // Z2：這一宮不能放水時，放水的做法改成不放水的版本
  if (fix && PALACES.includes(p)) fix = dryText(fix, p, ctx).text;
  return { fix, level, text, differ };
}

/**
 * F4：內局這一條的換房、移床目標要不要照 pickTargets 檢查（原宮＝這一條的宮）：八宮與中宮都要——
 * 中宮的臥室換房也走 claims（已排給別間的宮不再給中宮那一間）；中宮其他房間講到「臥室、床位可安排在…」也一樣登記、一樣檢查。
 */
function moveChecked(p) {
  return ALL_PALACES.includes(p);
}
/** Z4：床在這一宮的人（戶主沒填床位時以主臥宮計） */
function sleepersOf(ctx, p) {
  const pp = (ctx.people && Array.isArray(ctx.people.people)) ? ctx.people.people : [];
  return pp.filter((x) => x && x.bed && x.bed.palace === p);
}
/** Z4：某人床位的計畫是「不移」（看法不同、或沒得選） */
const bedNoMove = (x) => !!(x && x.bed && x.bed.ok === false
  && (x.bed.differ || (x.bed.plan && !x.bed.plan.targets.length && !x.bed.plan.swaps.length)));
/** Z4：某人床位的計畫是「移」（換到、對調） */
const bedMove = (x) => !!(x && x.bed && x.bed.ok === false && !x.bed.differ && x.bed.plan
  && (x.bed.plan.targets.length || x.bed.plan.swaps.length));
const NO_MOVE_SAY_RE = /不建議(?:移床|換房)|不必(?:為此)?(?:移床|換房)|不必急著換房/;
/** Z4：這一段有沒有講換房、移床、對調（有目標宮的才算） */
const moveSay = (t) => !!t && (/對調/.test(String(t)) || moveMentions(String(t)).some((m) => m.kind === 'bed' || m.kind === 'master'));
/** Z4：內局臥室那幾條的換房說法，跟睡在這一宮的人的床位計畫對齊 */
function bedRoomFix(fix, p, ctx) {
  const who = sleepersOf(ctx, p);
  if (!who.length) return fix;
  let out = sentences(fix);
  if (who.some(bedNoMove)) {
    const kept = out.filter((s) => !moveMentions(s).length && !/對調/.test(s));
    if (kept.length !== out.length) {
      out = kept.map((s) => s.replace(/^(?:不能換房時|換不了時|暫時換不了時|不能換時)[，,]?/, ''));
      out.push(who.some(bedMove) ? '臥室本身先不換，各人的床位見居住者段落。' : '睡在這裡的人床位見居住者段落，不必為此換房。');
    }
  }
  // 有人要移床（同一宮另有人不移也一樣）：拿掉「不建議換房／不必換房」，改指向居住者段落
  if (who.some(bedMove)) {
    const before = out.join('');
    out = out.map((s) => (NO_MOVE_SAY_RE.test(s)
      ? s.replace(/[^，。；]*(?:不建議(?:移床|換房)|不必(?:為此)?(?:移床|換房)|不必急著換房)[^，。；]*[，；]?/g, '')
      : s))
      .map((s) => s.replace(/^[，；\s]+/, '').replace(/[，；、\s]+(?=。|$)/g, ''))
      .filter((s) => s && s !== '。' && !/^[^，。；]*（[^）]*）。?$/.test(s) && !/^其他游年吉方都不適合當臥室/.test(s));
    if (out.join('') !== before && !out.some((x) => /見居住者段落/.test(x) && /先不換/.test(x))) out.push('臥室本身先不換，床位怎麼移見居住者段落。');
  }
  return out.join('');
}

function buildInterior(ctx) {
  const { interior } = ctx;
  const items = [];
  const list = interior.items || [];
  if (!list.length && (interior.warnings || []).some((w) => w.includes('內局未填'))) {
    items.push(mk('注意', '內局未填',
      `九宮都沒有填房間，內局以中間值 ${fmtNum(interior.score)} 分計。到第 3 步點九宮格勾選房間，就能逐宮評分。`));
    return section('interior', items);
  }
  items.push(mk('平', `內局 ${fmtNum(interior.score)} 分（滿分 20）`,
    `起始 14 分，逐宮逐房間依規則加減，共 ${list.length} 條，合計 ${fmtNum(interior.raw !== undefined && interior.raw !== null ? interior.raw : interior.score)}，收在 0～20 之間。`));
  for (const it of list) {
    // R20：「大門位置難改，重點放在化解與補強」是前言（來源 rooms.mjs 大門納衰氣），不放在「怎麼調」裡
    // X1：換房、動線、魚缸的目標照 pickTargets
    const v = interiorView(it, ctx);
    items.push(mk(v.level, fixTitle(it.title), v.text,
      { palace: it.palace, fix: v.fix || undefined, delta: it.delta, rule: it.rule, room: it.room }));
  }
  return section('interior', items);
}

/* ---- 外局 ---- */
function buildExterior(ctx) {
  const { exterior, cells, curPeriod } = ctx;
  const items = [];
  const list = (exterior.items || []).map((it) => ({ ...it }));
  const empty = !list.length && (exterior.warnings || []).some((w) => w.includes('外局未填'));
  if (empty) {
    items.push(mk('注意', '外局未填',
      `八方都沒有填屋外形勢，外局以中間值 ${fmtNum(exterior.score)} 分計。到第 4 步點八方勾選，就能評分。`));
    return section('exterior', items);
  }
  items.push(mk('平', `外局 ${fmtNum(exterior.score)} 分（滿分 20）`,
    `起始 12 分，依四獸、零正神、當運山向星與形煞逐條加減，合計 ${fmtNum(exterior.raw !== undefined ? exterior.raw : exterior.score)}，收在 0～20 之間。`));

  const beasts = exterior.beasts || {};
  const bLines = BEASTS.filter((b) => beasts[b] && beasts[b].palace)
    .map((b) => `${b}在${where(beasts[b].palace)}：${endDot(beasts[b].verdict)}`);
  if (bLines.length) items.push(mk('平', '四獸形勢', bLines.join('')));

  // 雙星會坐／會向的宮：見山見水一加一減 → 合併成一句
  const merged = [];
  for (const p of PALACES) {
    const c = cells[p];
    if (!c || c.m !== curPeriod || c.f !== curPeriod) continue;
    const wang = list.filter((it) => it.palace === p && WANG_RULES.includes(it.rule));
    if (!(wang.some((it) => it.delta > 0) && wang.some((it) => it.delta < 0))) continue;
    for (const it of wang) it.text = String(it.text).replace(EXT_BOTH_NOTE, '');
    merged.push(mk('注意', `${dirOf(p)}：當運山星向星同宮，見山見水一加一減`,
      `${where(p)}的山星、向星都是${CN[curPeriod]}運的當運星：見山利丁、見水利財，分數一加一減相抵。`
      + '形勢上要「先見水、水外有山」才能兼顧。', { palace: p, delta: 0 }));
  }

  // 同屬理氣、零正神與當運山向星看法相反 → 兩條都列，補一句
  const zlNotes = [];
  for (const p of PALACES) {
    const zl = list.filter((it) => it.palace === p && ZL_RULES.includes(it.rule));
    const wg = list.filter((it) => it.palace === p && WANG_RULES.includes(it.rule));
    const pairs = [];
    for (const a of zl) {
      const sameKind = (x) => (/shi$/.test(x.rule) === /shi$/.test(a.rule));
      const b = wg.find((x) => sameKind(x) && x.delta !== 0 && a.delta !== 0 && (x.delta > 0) !== (a.delta > 0));
      if (b) pairs.push(`「${a.title}」${signed(a.delta)}對「${b.title}」${signed(b.delta)}`);
    }
    if (pairs.length) {
      zlNotes.push(mk('注意', `${dirOf(p)}：零正神與當運山向星看法相反`,
        `${where(p)}：${pairs.join('；')}。`
        + '兩條同屬玄空理氣，各算各的分，請依現場遠近、高低與水的清濁再斟酌。', { palace: p, delta: 0 }));
    }
  }

  for (const it of list) {
    let fix = it.fix ? youText(it.fix) : undefined;
    if (fix && it.palace && cells[it.palace]) {
      fix = resolveConditional(sentences(fix), cells[it.palace], curPeriod).join('') || undefined;
      // Z2：這一宮不能放水時（零神見山、旺向見山的「擺小型水景、流水」），改成不放水的版本
      if (fix) fix = dryText(fix, it.palace, ctx).text || undefined;
    }
    items.push(mk(it.level, fixTitle(it.title), youText(it.text),
      { palace: it.palace, fix, delta: it.delta, rule: it.rule, school: it.school }));
  }
  items.push(...merged, ...zlNotes);
  return section('exterior', items);
}

/* ---- 樓層 ---- */
function buildFloor(ctx) {
  const { floor } = ctx;
  const items = [];
  let title;
  if (floor.floor === null || floor.floor === undefined) title = '樓層未填';
  else {
    const fname = floor.floor > 0 ? `${floor.floor} 樓` : `地下 ${Math.abs(floor.floor)} 樓`;
    title = `${fname}屬${floor.wx || '－'}${floor.relation ? `（${floor.relation}）` : ''}`;
  }
  // R6：色系用在哪裡，跟化解清單一致（玄關或主臥那一宮已有相剋、顏色不同或二黑五黃時不寫那一處）
  const fix = ctx.floorPlan && ctx.floorPlan.sectionFix ? ctx.floorPlan.sectionFix : floor.fix;
  items.push(mk(floor.level || '平', title,
    `${floor.text || ''}樓層這一項得 ${fmtNum(floor.score)} 分（滿分 3）。`, { fix }));
  for (const n of floor.notes || []) items.push(mk('平', '樓層提醒', n));
  return section('floor', items);
}

/* ---- 居住者 ---- */
function buildPeople(ctx) {
  const { people } = ctx;
  const items = [];
  const list = people.people || [];
  const pp = people.parts || { match: 2.5, bed: 0.75, head: 0.75 };
  items.push(mk('平', `居住者 ${fmtNum(people.score)} 分（滿分 7）`,
    `計分只看戶主：宅命 ${fmtNum(pp.match)}（相配 4、不配 1.5、未填 2.5）＋床位 ${fmtNum(pp.bed)}＋床頭 ${fmtNum(pp.head)}。`
    + '床位、床頭在個人吉方各 1.5，未填各 0.75；其他成員只列評語，不計分。'));
  if (!list.length) {
    items.push(mk('注意', '居住者未填',
      '沒有可以計算的居住者，命宅以中間值計。到第 2 步填出生年與性別，就能看命卦與床位。'));
    return section('people', items);
  }
  for (const person of list) {
    for (const it of person.items || []) {
      const t = fixTitle(it.title);
      const title = t.startsWith(person.label) ? t : `${person.label}｜${t}`;
      const palace = /^床位/.test(it.title) && person.bed && person.bed.palace ? person.bed.palace : undefined;
      items.push(mk(it.level, title, youText(it.text), { fix: it.fix ? youText(it.fix) : undefined, palace }));
    }
  }
  return section('people', items);
}

/* ---- 流年流月 ---- */
function roomsAt(cells, p) {
  return cells[p] ? cells[p].rooms : [];
}
/** 這一宮的山向星（或流年星）有沒有不當運的二黑、五黃 */
function has25(cells, p, cur, withYear = true) {
  const c = cells[p];
  if (!c) return false;
  const list = [c.m, c.f];
  if (withYear && c.yearStar) list.push(c.yearStar);
  return list.some((s) => is25(s, cur));
}
function names25(cells, p, cur) {
  const c = cells[p];
  if (!c) return '';
  const out = [];
  for (const s of [c.m, c.f]) if (is25(s, cur)) out.push(sn(s));
  if (c.yearStar && is25(c.yearStar, cur)) out.push(`流年${sn(c.yearStar)}`);
  return uniq(out).join('、');
}

function buildAnnual(ctx) {
  const { year, month, cells, input, curPeriod } = ctx;
  const items = [];
  if (!year) {
    items.push(mk('注意', '沒有日期，流年流月略過',
      '沒有帶入今天的日期，這一段略過。由畫面產生報告時會自動帶入今天。'));
    return section('annual', items);
  }
  const d = input.date;
  items.push(mk('平', `${year.year} 年（${year.ganzhi}）流年${sn(year.star)}入中`,
    `流年飛星以立春換年，${d.y}/${d.m}/${d.d} 屬${year.ganzhi}年，${sn(year.star)}入中宮順飛。`
    + '流年星每年換位，吉凶要看它「加臨」在房子原有的山向星上。'));

  // 凶星
  for (const s of [5, 2, 3, 7]) {
    const p = palaceOfStar(year.board, s);
    if (!p) continue;
    const info = ANNUAL_BAD[s];
    const rs = roomsAt(cells, p);
    // R1：三碧、七赤落到山向星含二黑五黃的宮，本文也不寫「用火／用靜水洩」，改寫只用金、宜靜
    const on25 = (s === 3 || s === 7) && has25(cells, p, curPeriod, false);
    // Z2：流年七赤落到不能放水的宮（山星當運、廁所水、凶宮失令），不寫「用靜水洩」，改一句理由
    const dry7 = s === 7 && !on25 && !waterOk(p, ctx);
    const t = [`流年${sn(s)}${p === '中' ? '入中宮，牽動全屋' : `飛到${where(p)}`}。`,
      on25 ? `${ANNUAL_BAD_25[s]}此宮已有${names25(cells, p, curPeriod)}，只用金、宜靜。`
        : dry7 ? `${ANNUAL_BAD_25[7]}${waterWhy(p, ctx)}這一方門窗關好、少放金屬利器。` : info.what];
    if (rs.length) t.push(`這一宮有${rs.join('、')}，常用的地方影響較明顯。`);
    if (rs.includes('大門')) t.push('大門每天開合，會引動這顆星。');
    if (rs.includes('主臥')) t.push('主臥每天睡上好幾個小時，人長時間受影響。');
    if (rs.includes('廚房') && (s === 5 || s === 2)) t.push('廚房的爐火會生旺土星（火生土），用火與飲食衛生要多留意。');
    const c = cells[p];
    if ((s === 5 || s === 2) && c) {
      const hit = [];
      if (c.m === 5 || c.m === 2) hit.push(`山星${sn(c.m)}`);
      if (c.f === 5 || c.f === 2) hit.push(`向星${sn(c.f)}`);
      if (hit.length) t.push(`這一宮本來就有${hit.join('、')}，流年再飛到，凶性疊加，宜優先化解。`);
    }
    let fix = remedyText(STAR_REMEDY[s], 3);
    if ((s === 3 || s === 7) && has25(cells, p, curPeriod, false)) {
      const w = with25Of(STAR_REMEDY[s]);
      fix = w ? remedyText(w, 3) : `這一方有${names25(cells, p, curPeriod)}，只用金洩。${ANNUAL_ON25_FIX}`;
    }
    // Z2：這一宮不能放水 → 「一杯靜水、小水缽」這類拿掉，補一句理由
    fix = dryText(fix, p, ctx).text;
    items.push(mk(info.level, `流年${sn(s)}${p === '中' ? '入中宮' : `到${dirOf(p)}`}`, t.join(''),
      { palace: p, fix }));
  }

  // 吉星（[10][21]：一白、六白、八白、九紫；落到二黑五黃宮改成注意項）
  const gl = [];
  for (const s of [9, 1, 8, 6]) {
    const p = palaceOfStar(year.board, s);
    if (!p) continue;
    const rs = roomsAt(cells, p);
    if (has25(cells, p, curPeriod, false)) {
      items.push(mk('注意', `流年${sn(s)}到${dirOf(p)}，遇${names25(cells, p, curPeriod)}`,
        `流年${sn(s)}（${ANNUAL_GOOD[s]}）飛到${where(p)}，但這一宮本來有${names25(cells, p, curPeriod)}。`
        + ANNUAL_GOOD_ON25[s],
        { palace: p, fix: ANNUAL_ON25_FIX }));
      continue;
    }
    gl.push(`流年${sn(s)}（${ANNUAL_GOOD[s]}）到${dirOf(p)}${rs.length ? `（${rs.join('、')}）` : ''}。`);
  }
  if (gl.length) {
    gl.push('吉星所到的方位，今年宜多使用、保持明亮整潔。');
    items.push(mk('吉', '今年吉星的方位', gl.join('')));
  } else {
    items.push(mk('平', '今年吉星的方位', '今年的吉星都落在有二黑、五黃的方位，見上面的注意項。'));
  }
  // 四綠文昌另列
  {
    const p = palaceOfStar(year.board, 4);
    if (p) {
      if (has25(cells, p, curPeriod, false)) {
        items.push(mk('注意', `流年四綠文昌到${dirOf(p)}，遇${names25(cells, p, curPeriod)}`,
          `流年四綠（文昌）飛到${where(p)}，但這一宮本來有${names25(cells, p, curPeriod)}。${ANNUAL_GOOD_ON25[4]}`,
          { palace: p, fix: ANNUAL_ON25_FIX }));
      } else {
        // X1：書桌放不放得過來看 pickTargets('study')；已經是書房就說正好在這一方
        const rs = roomsAt(cells, p);
        let desk;
        if (rs.includes('書房')) desk = '書房正好在這一方，今年讀書、辦公的時間可以多待在這裡。';
        else if (pickTargets('study', ctx).includes(p)) desk = '書桌或孩子讀書的位置可以放在這一方。';
        else desk = `這一方${targetBlock('study', p, targetEnv(ctx))}，不必把書桌搬過來；讀書的位置以書桌朝個人吉方為主。`;
        items.push(mk('吉', `流年四綠文昌到${dirOf(p)}`,
          `流年四綠（文昌）飛到${where(p)}，今年利讀書考試與文書。${desk}`,
          { palace: p }));
      }
    }
  }

  // 太歲、歲破、三煞（D3：24 山比坐山、向山）
  const ts = year.taisui;
  const sp = year.suipo;
  const sh = year.sansha;
  const sf = year.sitFace || {};
  let tt = `${year.ganzhi}年太歲在${ts.dir}方（${ts.mount}），歲破在${sp.dir}方（${sp.mount}），`
    + `三煞在${sh.dir}方（${sh.mounts.join('、')}三山）。`
    + '傳統上這三方當年不宜動土、裝修與敲打。';
  const notes = [];
  let bad = false;
  if (sf.sitTaisui) notes.push(`本宅坐${sf.sitMount}山是坐太歲（向歲破），傳統說「太歲可坐不可向」，坐太歲可用。`);
  if (sf.faceTaisui) { notes.push(`本宅向${sf.faceMount}山是向太歲（坐歲破），傳統認為忌，今年修造要特別謹慎。`); bad = true; }
  if (sf.sitSansha) { notes.push(`本宅坐${sf.sitMount}山是坐三煞，傳統說「三煞可向不可坐」，坐三煞忌，今年坐方不宜動土。`); bad = true; }
  if (sf.faceSansha) notes.push(`本宅向${sf.faceMount}山是向三煞，傳統說三煞可向，向三煞可用。`);
  if (notes.length) tt += notes.join('');
  else tt += '本宅的坐山、向山都沒有碰到太歲、歲破與三煞。';
  items.push(mk(bad ? '凶' : '注意', `${year.ganzhi}年：太歲${ts.dir}、歲破${sp.dir}、三煞${sh.dir}`, tt,
    { fix: bad ? '今年坐向兩方避免大動土；真要裝修，依習俗擇日處理。' : '要裝修時避開這三個方位，或依習俗擇日處理。' }));

  // 本月
  if (month) {
    const m5 = palaceOfStar(month.board, 5);
    const m2 = palaceOfStar(month.board, 2);
    const y5 = palaceOfStar(year.board, 5);
    const y2 = palaceOfStar(year.board, 2);
    let mt = `本月是${month.name}（${month.jie}起算），月星${sn(month.star)}入中。`
      + `月五黃到${dirOf(m5)}、月二黑到${dirOf(m2)}。`;
    if (m5 && (m5 === y5 || m5 === y2)) mt += `月五黃與流年${m5 === y5 ? '五黃' : '二黑'}同到${dirOf(m5)}，這個月這一方尤其宜靜。`;
    if (m2 && m2 !== m5 && (m2 === y5 || m2 === y2)) mt += `月二黑與流年${m2 === y5 ? '五黃' : '二黑'}同到${dirOf(m2)}，這個月這一方要多留意健康。`;
    const key = [];
    for (const p of uniq([m5, m2])) {
      const rs = roomsAt(cells, p).filter((r) => ['大門', '主臥', '廚房'].includes(r));
      if (rs.length) key.push(`${dirOf(p)}是${rs.join('、')}`);
    }
    if (key.length) mt += `本宅${key.join('，')}，這個月更要留意。`;
    items.push(mk('注意', `${month.name}：月星${sn(month.star)}入中`, mt,
      { fix: '月五黃、月二黑所到的方位，這個月少敲打、少動土，可放銅製品或六帝錢洩土氣。' }));
  }
  return section('annual', items);
}

/* ---- 化解 ---- */
function kbForInterior(it, cells) {
  if (RULE_ROOM_FIX[it.rule]) {
    const kb = ROOM_FIX[RULE_ROOM_FIX[it.rule]];
    // A6（內局 B1）：雙星同宮的魚缸不撤，知識庫有 bothWang 就用那一版（先見水、水外有山）
    if (it.bothWang === true && kb && kb.bothWang && Array.isArray(kb.bothWang.items)) {
      return { key: `ROOM:${RULE_ROOM_FIX[it.rule]}:both`, kb: kb.bothWang };
    }
    return { key: `ROOM:${RULE_ROOM_FIX[it.rule]}`, kb };
  }
  if (WETFIRE_RULES.includes(it.rule)) {
    const k = it.room === '廚房' ? '廚房壓吉' : '廁所壓吉';
    return { key: `ROOM:${k}`, kb: ROOM_FIX[k] };
  }
  if (STAR25_RULES.includes(it.rule)) {
    const c = cells[it.palace];
    const s = c && (c.m === 5 || c.f === 5) ? 5 : 2;
    return { key: `STAR:${s}`, kb: STAR_REMEDY[s] };
  }
  // 神明廳在凶方：用規則自己的「移神位」做法；YOUNIAN_REMEDY 的「把這一方當廁所、灶座」對神位不適用
  return { key: null, kb: null };
}

// X2：宮位五行那幾條（二五宮時併進二五那一條，只交代一句「另有X：以…為主」）
const PALACE_WX_RULE_RE = /^(kitchen|toilet)-(qian|dui|kan|li|wood|earth|metal|center)$/;
// X2：二五那幾條（併成一條時寫進「此宮有…」，不另寫「另有」）
const IS25_RULES = new Set([...STAR25_RULES, 'bedroom-mountain-2-5']);
/** X6：內局一條的凶源五行（房間本身；大門納氣看門宮向星；二五那幾條是土） */
function wxOfInterior(it, cells) {
  if (IS25_RULES.has(it.rule)) return '土';
  if (it.rule === 'door-facing-qi') {
    const s = it.star || (cells[it.palace] && cells[it.palace].f);
    return STAR_WX[s] || null;
  }
  const t = ROOM_TYPES[it.room];
  return t && t.wx ? t.wx : null;
}
/**
 * X7：大門納衰氣那兩句通用的話（「另有門在旺氣、生氣的向星宮…」「生旺向星所在的窗多開…」）改成點名宮位，
 * 名單用 pickTargets('living')（排除大門宮、廚房廁所、臥室、二五、戶主個人凶方…）；沒有就整句拿掉（回 ''）。
 */
const DOOR_QI_BACK_RE = /另有門在旺氣、生氣的向星宮/;
const DOOR_QI_WIN_RE = /生旺向星所在的窗多開/;
function namedDoorQi(s, ctx, from) {
  const t = String(s || '');
  if (!DOOR_QI_BACK_RE.test(t) && !DOOR_QI_WIN_RE.test(t)) return t;
  const list = pickTargets('living', ctx, { from: from || null }).slice(0, 2);
  if (!list.length) return '';
  const names = list.map(where).join('、');
  if (DOOR_QI_BACK_RE.test(t)) return `${names}的向星生旺，那一方若有後門或陽台落地門，平日多由那裡進出`;
  return `${names}的向星生旺，那一方的窗多開、保持明亮；衰死方少開`;
}
// X6：沒有不相剋的做法時先以什麼為主（依凶源五行）
const CALM_BY_WX = {
  火: { what: '通風、爐火不空燒、少用火', act: '保持通風，爐火不空燒' },
  水: { what: '除濕、通風、少用', act: '保持乾燥通風，門常關' },
  木: { what: '整潔、少堆放', act: '保持整潔，不堆雜物' },
  金: { what: '整潔、少敲打', act: '保持整潔安靜，少敲打' },
  土: { what: '整潔安靜、少動土', act: '保持整潔安靜，不動土' },
};
const CALM_DEFAULT = { what: '整潔安靜', act: '保持整潔安靜' };

function buildRemedies(ctx) {
  const {
    cx, fit, active, door, master, masterView, stove, lucky, cells, interior, exterior, floor, people, year, masterScore,
    curPeriod, daoqilong,
  } = ctx;
  const cur = curPeriod;
  const probs = [];
  const add = (o) => probs.push({ palace: null, fix: '', kb: null, kbKey: null, src: '', action: '', structural: false, conflict: null, star: null, noMove: false, ...o });

  // Z1：每一條帶規則代碼（rule），動作一律查 ACTIONS 表（規則條目自己帶 action 的優先）
  //     actionFrom：'rule'＝規則條目自己帶的、'table'＝查表；後面退路挑的是 'fallback'、通用的是 'generic'
  const act = (rule, p, extra = {}, own = '') => {
    const a = actCtx(ctx, p, { rule, ...extra });
    let mine = own ? actionFor('', a, own) : '';
    // A4：規則自帶的動作用到火、同宮又要收斂火氣 → 改用查表的不加火版本
    if (mine && a.noFire && familiesOf(mine).includes('火')) mine = '';
    const t = actionFor(rule, a);
    // 規則自帶的動作跟同宮較重的那一條相剋時，退回查表的那一句（altAction）
    if (mine) return { action: mine, actionFrom: 'rule', altAction: t && t !== mine ? t : '' };
    return { action: t, actionFrom: t ? 'table' : '', altAction: '' };
  };
  if (cx.kongwang) {
    add({ palace: null, problem: `向度騎線（${cx.kongwang}）`, fix: KONG_FIX, kbKey: 'KONG', delta: cx.kongwang === '大空亡' ? -6 : -3, src: 'pattern', rule: 'kong', ...act('kong', null) });
  }
  if (PATTERN_ACTION[fit.pattern] && !(daoqilong && daoqilong.pattern === fit.pattern)) {
    // R16：下水、上山的動作先看向宮／坐宮能不能照做
    const pf = patternFixOf(ctx, fit.pattern);
    add({ problem: `玄空格局${fit.pattern}`, fix: pf.fix, kbKey: 'PAT', delta: fit.pattern === '上山下水' ? -3 : -2, src: 'pattern', rule: 'pattern', ...act('pattern', null, { pattern: fit.pattern }) });
  }
  for (const [k, label] of [['mountain', '山星'], ['facing', '向星']]) {
    if (fit.prison[k]) add({ palace: '中', problem: `${label}入囚`, fix: prisonFixOf(cells, cur), kbKey: 'PRISON', delta: -3, src: 'pattern', rule: 'prison', ...act('prison', '中') });
  }
  for (const [k, label] of [['mountain', '山盤'], ['facing', '向盤']]) {
    if (active.fuyin[k]) add({ problem: `${label}${active.fuyin[k]}`, fix: FUYIN_FIX, kbKey: 'FUYIN', delta: -3, src: 'pattern', structural: true, rule: 'fuyin', ...act('fuyin', null) });
  }

  // A8：八宅門的五行會生旺失令的門宮向星、或跟玄空門宮那一條相剋 → 兩條都列、標看法不同；八宅那一條不帶那個五行
  const dview = doorViewOf(ctx);
  const doorA8 = !!(dview && dview.excluded);
  if (door && YOUNIAN[door.star].luck === '凶') {
    let dr = doorRemedy(door.star);
    if (doorA8 && dr) dr = { method: doorDifferNote(dview), items: dr.items.map((x) => doorAvoidText(x, dview)).filter(Boolean) };
    // 二黑五黃宮只用金（D4）；Z2：門宮不能放水時絕命不放靜水
    add({ palace: door.palace, problem: `大門在游年${door.star}${doorA8 ? '（看法不同）' : ''}`, kb: dr, kbKey: `DOOR:${door.star}${doorA8 ? ':A8' : ''}`, delta: door.score - 5, src: 'bazhai', rule: 'door', ...act('door', door.palace, { star: door.star }), wx: YOUNIAN[door.star].wx });
  }
  if (master && YOUNIAN[master.star].luck === '凶') {
    const mf = masterFixOf(ctx);
    const mwx = YOUNIAN[master.star].wx;
    const ma = act('master', master.palace);
    if (masterView) {
      add({ palace: master.palace, problem: `主臥在游年${master.star}（看法不同）`, fix: mf.fix, kbKey: 'MASTER', delta: masterScore - 4, src: 'bazhai', rule: 'master', ...ma, wx: mwx });
    } else {
      add({ palace: master.palace, problem: `主臥在游年${master.star}`, fix: mf.fix, kbKey: 'MASTER', delta: masterScore - 4, src: 'bazhai', rule: 'master', ...ma, wx: mwx });
    }
  }
  // L1：移爐那一句點名目標宮（stoveTargets）；沒有合適的目標就不叫人移爐
  const stoveKb = stove && !stove.sitOk ? stoveKbOf(ctx) : null;
  if (stoveKb) {
    add({ palace: stove.palace, problem: `爐灶壓在游年${stove.star}吉方`, kb: stoveKb, kbKey: 'ROOM:廚房壓吉', delta: -2, src: 'bazhai', rule: 'stove', ...act('stove', stove.palace) });
  }
  if (stove && stove.mouth && !stove.mouth.ok) {
    // R22：灶也壓吉時併進同一條（知識庫那句「轉向游年（宅）吉方」由這句帶具體方位的取代）
    add({
      palace: stove.palace, problem: `灶口朝游年${stove.mouth.star}`, fix: stoveMouthFix(lucky, !!stoveKb && stoveKb.targets.length > 0),
      kb: stoveKb, kbKey: stoveKb ? 'ROOM:廚房壓吉' : null, delta: -2, src: 'bazhai', rule: 'stove-mouth', ...act('stove-mouth', stove.palace),
    });
  }

  // 凶宮：用 combos 針對這一對山向星寫的 fix
  for (const p of ALL_PALACES) {
    const c = cells[p];
    if (c.luck !== '凶') continue;
    const fix = COMBOS[c.combo.key] ? COMBOS[c.combo.key].fix : '';
    const s = worstStar(c);
    const own25 = [c.m, c.f].some((x) => is25(x, cur));
    const ca = act('cell', p);
    if (fix) {
      add({ palace: p, problem: c.combo.title || `山星${sn(c.m)}、向星${sn(c.f)}`, fix, delta: -1, src: 'palaces', wx: STAR_WX[s], is25: own25, rule: 'cell', ...ca });
    } else {
      add({ palace: p, problem: `山星${sn(c.m)}、向星${sn(c.f)}`, kb: STAR_REMEDY[s], kbKey: `STAR:${s}`, delta: -1, src: 'palaces', wx: STAR_WX[s], is25: own25, rule: 'cell', ...ca });
    }
  }

  for (const it of interior.items || []) {
    if (!(it.delta < 0)) continue;
    const { key, kb } = kbForInterior(it, cells);
    // X1：報告版本（換房動線魚缸的目標照 pickTargets；臥室山星二五在宅卦吉方改看法不同）
    const v = interiorView(it, ctx);
    // A8：玄空門宮那一條跟八宅門相剋 → 兩條都標看法不同（玄空這一條照列，不寫「先不用」）
    const differ = v.differ || (doorA8 && !!dview.ex && it.rule === 'door-facing-qi' && it.palace === dview.palace);
    const title = fixTitle(it.title);
    // T14：火燒天門遇灶壓凶方（八宅看爐位是好的）→ 不叫你移爐，改用不動工的做法
    const qianKeep = it.rule === 'kitchen-qian' && qianStoveOk(ctx);
    const star = it.rule === 'door-facing-qi' ? (it.star || (cells[it.palace] && cells[it.palace].f) || null) : null;
    add({
      palace: it.palace, problem: differ && !title.includes('看法不同') ? `${title}（看法不同）` : title,
      // R20：「大門位置難改，重點放在化解與補強」是前言，不進化解清單
      fix: v.fix, kb, kbKey: key, delta: it.delta, src: 'interior',
      // T6：大門納衰氣帶門宮向星，知識庫 byStar 取這顆星那一句（Y1：門宮山星當運取 noWaterText）
      star,
      noWater: it.rule === 'door-facing-qi' && it.noWater === true,
      noMove: qianKeep,
      // Z1：規則條目自己帶 action 的優先，沒有才查表
      // T14：火燒天門遇灶壓凶方是報告這邊的兩派判斷，動作照表（金屬鍋具架、銅製品），不用規則自帶的
      // Z4：報告版本的 fix 已經不寫換房（看法不同、睡的人不移床）時，規則自帶的換房動作也不用
      // L2：規則自帶的動作講到的換房目標不在名單（已排給別間房、同床者凶方）時也不用
      ...act(it.rule, it.palace, { room: it.room, star, differ }, qianKeep || (moveSay(it.action) && !moveSay(v.fix))
        || (moveChecked(it.palace, it.room) && badMoves(String(it.action || ''), ctx, { from: it.palace, room: it.room }).length > 0) ? '' : it.action),
      // X6：凶源的五行（房間本身；大門納氣看門宮向星；二五那幾條是土）
      wx: wxOfInterior(it, cells),
      // X2：二五宮的宮位五行那幾條（內局標 merge25，或規則名）
      palaceWx: it.merge25 === true || PALACE_WX_RULE_RE.test(String(it.rule)),
      is25: IS25_RULES.has(it.rule),
      room: it.room,
      rule: it.rule,
    });
  }
  for (const it of exterior.items || []) {
    // T11：白虎昂頭時補青龍的那一條（qinglong-bu，掛青龍宮、不計分）也進化解清單
    if (!(it.delta < 0) && it.rule !== 'qinglong-bu') continue;
    // R11：倒騎龍成立時，坐方見水、向方見山那幾條扣分跟倒騎龍的看法相反
    const conflict = daoqiConflict(ctx, it) ? '倒騎龍' : null;
    let fix = it.fix ? youText(it.fix) : '';
    if (fix && PALACES.includes(it.palace)) fix = fitMoves(fix, ctx, { from: it.palace });
    const feature = it.feature || (Array.isArray(it.features) ? it.features[0] : null) || null;
    const ext = feature && EXT_TYPES[feature] ? EXT_TYPES[feature] : null;
    add({
      palace: it.palace, problem: fixTitle(it.title), fix, delta: it.delta, src: 'exterior', conflict,
      wx: ext && ext.wx ? ext.wx : null, is25: /五黃|二黑/.test(String(it.title)),
      rule: it.rule, ...act(it.rule, it.palace, { feature }, it.action),
    });
  }
  // R6：樓層的色系調整掛到實際位置（玄關＝大門宮、戶主臥室＝主臥宮），等各宮化解排好後再放（見下面 floorEntries）
  const floorPlan = floorPlanOf(ctx);
  for (const person of people.people || []) {
    for (const it of person.items || []) {
      if (it.level !== '凶' || !it.fix) continue;
      const isBed = /^床位/.test(it.title);
      const palace = isBed && person.bed && PALACES.includes(person.bed.palace) ? person.bed.palace : null;
      const rule = isBed ? 'people-bed' : 'people-head';
      // X1：移床目標的檢查要知道是誰睡（who）；Z4：動作照這個人的床位計畫
      add({
        palace, problem: `${person.label}${fixTitle(it.title)}`, fix: youText(it.fix), delta: person.isOwner ? -1.5 : -0.5, src: 'people', who: person.label,
        rule, ...act(rule, palace, { plan: person.bed && person.bed.plan, differ: !!(person.bed && person.bed.differ) }),
      });
    }
  }
  if (year) {
    for (const s of [5, 2]) {
      const p = palaceOfStar(year.board, s);
      if (!p) continue;
      add({ palace: p, problem: `${year.year} 年流年${sn(s)}`, kb: STAR_REMEDY[s], kbKey: `STAR:${s}`, delta: -1, src: 'annual', rule: `annual-${s}`, ...act(`annual-${s}`, p), wx: '土', is25: true });
    }
  }

  // 依「宮位＋化解法」合併；沒有知識庫對應的，同宮同做法才合併
  const groups = new Map();
  for (const pr of probs) {
    const key = `${pr.palace || '全宅'}|${pr.kbKey || `FIX:${pr.fix || pr.problem}`}`;
    if (!groups.has(key)) {
      groups.set(key, {
        palace: pr.palace, problems: [], fixes: [], kb: pr.kb || null, delta: 0, srcs: [], action: '', structural: true, conflict: null, star: null, noMove: false,
        wx: null, palaceWx: true, is25: true, who: null, rooms: [], rules: [],
      });
    }
    const gr = groups.get(key);
    if (pr.rule && !gr.rules.includes(pr.rule)) gr.rules.push(pr.rule);
    if (!gr.problems.includes(pr.problem)) gr.problems.push(pr.problem);
    if (pr.fix && !gr.fixes.includes(pr.fix)) gr.fixes.push(pr.fix);
    gr.delta += pr.delta;
    if (!gr.srcs.includes(pr.src)) gr.srcs.push(pr.src);
    if (pr.action && !gr.action) { gr.action = pr.action; gr.actionFrom = pr.actionFrom || 'table'; gr.altAction = pr.altAction || ''; }
    gr.structural = gr.structural && pr.structural;
    if (pr.conflict && !gr.conflict) gr.conflict = pr.conflict;
    if (pr.star && !gr.star) gr.star = pr.star;
    if (pr.noMove) gr.noMove = true;
    // X6、X2、X1：凶源五行、宮位五行那幾條、二五那幾條、誰睡的
    if (pr.noWater) gr.noWater = true;
    if (pr.wx && !gr.wx) gr.wx = pr.wx;
    gr.palaceWx = gr.palaceWx && !!pr.palaceWx;
    gr.is25 = gr.is25 && !!pr.is25;
    if (pr.who && !gr.who) gr.who = pr.who;
    if (pr.room && !gr.rooms.includes(pr.room)) gr.rooms.push(pr.room);
  }

  // 每一組：先排出「做法」與「細項」，條件句依 cells 判斷
  const entries = [...groups.values()].map((gr) => {
    const cell = gr.palace ? cells[gr.palace] : null;
    const fixSents = gr.fixes.flatMap(sentences);
    let list = [];
    let methodRole = true;
    let avoid = [];
    let used25 = false;
    if (gr.kb) {
      // D4：這一宮有二黑五黃、知識庫又有 with25 → 整條改用 with25
      const w25 = gr.palace && has25(cells, gr.palace, cur) ? with25Of(gr.kb) : null;
      const kbMethod = w25 ? w25.method : gr.kb.method;
      const kbRaw = w25 ? [...w25.items].map(String) : kbItemsFor(gr.kb, gr.palace, gr.star, gr.noWater);
      used25 = !!w25;
      const said = fixSents.map(bare).join('|');
      // D7：規則自己說「不必為此換房」時，知識庫的換房建議不再列
      const noMove = fixSents.some((s) => /不必.{0,4}換房|不建議.{0,6}換房/.test(s));
      // R22：規則自己已經講了帶方位的灶口轉向，知識庫那句籠統的就不再列
      const saidMouth = fixSents.some((s) => MOUTH_KB_RE.test(s));
      const kbItems = kbRaw.map((x) => namedDoorQi(x, ctx, gr.palace)).filter((x) => {
        const b = bare(x);
        if (noMove && /換房|換到/.test(x)) return false;
        if (saidMouth && MOUTH_KB_RE.test(x)) return false;
        return b && !said.includes(b.slice(0, Math.min(6, b.length)));
      });
      list = [{ t: endDot(kbMethod), role: 'method' }, ...fixSents.map((t) => ({ t, role: 'item' })), ...kbItems.map((t) => ({ t, role: 'kb' }))];
      if (gr.kb.avoid) avoid = sentences(gr.kb.avoid);
      // L3：「不宜久坐、久睡」（知識庫 avoidStay）只在這一宮沒有臥室類、也沒有人睡時列；有的話改「床頭附近放銅葫蘆」（見下面）
      if (typeof gr.kb.avoidStay === 'string' && gr.kb.avoidStay && !bedHereAt(ctx, gr.palace)) avoid.push(endDot(gr.kb.avoidStay));
    } else {
      list = fixSents.map((t, i) => ({ t, role: i === 0 ? 'method' : 'item' }));
      if (!list.length) methodRole = false;
    }
    if (cell) {
      // X8：條件句改寫過的（「若大門在這一宮，…」拿掉條件）也留在原來的位置
      list = resolveConditionalIdx(list.map((x) => x.t), cell, cur).map(({ i, t }) => ({ ...list[i], t }));
      // [26]：「絕命用藍黑色、五鬼用黃色陶瓷…」這種各星通用清單，只留這一宮的游年星那一段
      list = list.map((x) => ({ ...x, t: pickStarClause(x.t, cell.younian) })).filter((x) => x.t);
    }
    // Z2：這一宮不能放水（二五、山星當運、廁所水、凶宮失令）→ 放水的句子改成不放水的版本，補一句理由（二五另有只用金的說法）
    let dryWhy = '';
    if (gr.palace && waterWhy(gr.palace, ctx)) {
      let removed = false;
      list = list.map((x) => {
        const d = dryOne(x.t);
        if (d !== x.t) removed = true;
        return { ...x, t: d };
      }).filter((x) => x.t);
      if (removed && !has25(cells, gr.palace, cur)) dryWhy = waterWhy(gr.palace, ctx);
    }
    // T14：火燒天門遇灶壓凶方，知識庫的「移出西北」也拿掉，補一句兩派看法不同
    // L1：游年凶方都不適合移爐時也一樣不移，補「先不移爐」那一句
    if (gr.noMove) {
      list = list.map((x) => ({ ...x, t: dropStoveMove([x.t])[0] || '' })).filter((x) => x.t);
      const note = qianNote(ctx);
      if (!list.some((x) => x.t.includes('灶壓凶方') || x.t.includes(note))) list.splice(list.length ? 1 : 0, 0, { t: note, role: 'item' });
    }
    // T12：灶的細項先「裝修時把爐具移到游年凶方座落」，再「爐位動不了時，把灶口…」
    {
      const iMouth = list.findIndex((x) => /^爐位動不了時/.test(x.t));
      const iMove = list.findIndex((x) => /^裝修時把爐具移/.test(x.t));
      if (iMouth >= 0 && iMove > iMouth) {
        const [mv] = list.splice(iMove, 1);
        list.splice(iMouth, 0, mv);
      }
    }
    // 禁忌另放 avoid（[31]）
    const keep = [];
    for (const x of list) {
      if (x.role !== 'method' && /^(忌|不宜|避免)/.test(x.t)) avoid.push(endDot(x.t));
      else keep.push(x);
    }
    // R11：跟倒騎龍看法相反的那幾條，補一句說明
    const notes = gr.conflict === '倒騎龍' ? [DAOQI_CONFLICT_NOTE] : [];
    if (dryWhy) notes.push(dryWhy);
    // Z2：預先查好的動作也不能叫人放水
    const action = gr.action && gr.palace && positiveHit(gr.action, WATER_PUT_RE) && !waterOk(gr.palace, ctx) ? '' : gr.action;
    return { ...gr, action, list: keep, avoid: uniq(avoid), notes, methodRole, used25 };
  });

  // D4：二黑五黃宮只用金（濾掉土、火、木、水），補金洩；同宮互剋只留一套（[19]）
  // R7：另外逐字比對「少用／忌 X」與另一條肯定句的 X，矛盾時拿掉比較不重要的那一句
  const byPalace = new Map();
  for (const e of entries) {
    if (!e.palace) continue;
    if (!byPalace.has(e.palace)) byPalace.set(e.palace, []);
    byPalace.get(e.palace).push(e);
  }
  for (const [p, list] of byPalace) {
    const hit25 = has25(cells, p, cur);
    // A8：八宅門與玄空門宮相剋（兩條都列、看法不同）的那一宮，玄空門宮那一條先排，不被八宅那幾條寫成「先不用」
    const a8First = (e) => (doorA8 && dview.ex && p === dview.palace && (e.rules || []).includes('door-facing-qi') ? 0 : 1);
    const ordered = [...list].sort((a, b) => a8First(a) - a8First(b) || a.delta - b.delta);
    // T6：每一行用過的五行記下是哪一條給的（null＝D4 二五只用金的規定，不是別條化解）
    const kept = new Map(hit25 ? [['金', null]] : []);
    // Z2：不能放水的宮，放水的句子前面已經拿掉；剩下「當運山星見水」這種講道理的句子不算用水
    const dryHere = !!waterWhy(p, ctx);
    const famsIn = (t) => {
      const fs0 = familiesOf(t);
      return dryHere && fs0.includes('水') && !positiveHit(unquoteNames(t), WATER_FAM_USE_RE) ? fs0.filter((x) => x !== '水') : fs0;
    };
    const posSeen = new Set();
    const negSeen = new Set();
    let metalGiven = false;
    const needMetal = [];
    for (const e of ordered) {
      let removed = false;
      if (hit25) {
        e.list = e.list.map((x) => {
          const r = clean25(x.t);
          if (r.removed) removed = true;
          return { ...x, t: r.text };
        }).filter((x) => x.t);
        // T7：二五宮以金洩為先，禁忌裡「少放金屬、少用白色」這類也不留（金屬尖角、利器、銅鈴照留）
        e.avoid = e.avoid.filter((s) => !negMetal(s));
      }
      // 同宮互剋：跟前面（比較重要的）做法相剋的句子拿掉
      let clash = null;
      let contra = null;
      e.list = e.list.filter((x) => {
        const fams = famsIn(x.t);
        const bad = fams.find((f) => [...kept.keys()].some((k) => KE[k] === f || KE[f] === k));
        if (bad) {
          const by = [...kept.keys()].find((k) => KE[k] === bad || KE[bad] === k);
          const from = kept.get(by);
          // T6：只有被比對的那一句來自「別條」化解時才寫說明；同一條自己前後矛盾就安靜拿掉
          if (!clash && from && from !== e) clash = { f: bad, by, from };
          return false;
        }
        const tm = termsOf(x.t);
        const hit = [...tm.pos].find((w) => negSeen.has(w)) || [...tm.neg].find((w) => posSeen.has(w));
        if (hit) {
          if (!contra) contra = hit;
          return false;
        }
        for (const f of fams) if (!kept.has(f)) kept.set(f, e);
        return true;
      });
      e.avoid = e.avoid.filter((s) => {
        const hit = [...termsOf(s).neg].find((w) => posSeen.has(w));
        if (hit && !contra) contra = hit;
        return !hit;
      });
      for (const x of e.list) {
        const tm = termsOf(x.t);
        for (const w of tm.pos) posSeen.add(w);
        // T7：二五宮的金不收進「否定」（金洩優先，不讓「少放白色」擋掉後面的金）
        for (const w of tm.neg) if (!(hit25 && METAL_TERMS.includes(w))) negSeen.add(w);
      }
      for (const s of e.avoid) for (const w of termsOf(s).neg) if (!(hit25 && METAL_TERMS.includes(w))) negSeen.add(w);
      if (hit25) {
        if (e.used25 || e.list.some((x) => positiveHit(x.t, FAMILY.金))) metalGiven = true;
        else if (removed) needMetal.push(e);
      }
      // 預先指定的動作（大門、灶…）跟較重要的那一條相剋時，改從留下來的做法裡挑
      const clashAct = (a) => familiesOf(a).some((f) => [...kept.entries()].some(([k, from]) => from && from !== e && (KE[k] === f || KE[f] === k)));
      if (e.action && clashAct(e.action)) {
        // Z1：規則自帶的動作相剋 → 先退回查表的那一句
        if (e.altAction && !clashAct(e.altAction)) { e.action = e.altAction; e.actionFrom = 'table'; } else e.action = '';
      }
      e.clash = clash;
      e.contra = contra;
      if (clash) {
        // A8：拿來比的是先排的玄空門宮那一條（不一定比較重）→ 照實寫
        const byDoor = a8First(clash.from) === 0 && clash.from.delta > e.delta;
        e.notes.push(byDoor
          ? `同一方位玄空門宮那一條用${clash.by}，${clash.f}與${clash.by}相剋，兩派看法不同，這裡的${clash.f}做法先不用。`
          : `同一方位已有用${clash.by}的做法（較重要的一項），${clash.f}與${clash.by}相剋，這裡的${clash.f}做法先不用。`);
      }
      if (contra) {
        e.notes.push('同一方位較重要的那一項對同一樣東西的用法相反，這裡跟著那一項，相反的那一句先不列。');
      }
    }
    // T8：一條化解的內容全被同宮互剋（或相反）拿掉 → 整條併進同宮較重、還有內容的那一條，不把系統說明當動作
    for (const e of ordered) {
      if (e.list.length || e.merged || !(e.clash || e.contra)) continue;
      const host = ordered.find((o) => o !== e && !o.merged && o.list.length);
      if (!host) continue;
      // X6：接手那一條的做法會生旺被併那一條的凶源（木生火、金生水…）就不併，改寫「暫無不相剋的做法，先以…為主」
      const hostFams = uniq(host.list.flatMap((x) => familiesOf(x.t)));
      if (e.wx && hostFams.some((f) => SHENG[f] === e.wx)) {
        const calm = CALM_BY_WX[e.wx] || CALM_DEFAULT;
        e.list = [{ t: `這一項暫無不相剋的做法，先以${calm.what}為主。`, role: 'method' }];
        e.action = calm.act;
        e.feeds = true;
        continue;
      }
      for (const pb of e.problems) if (!host.problems.includes(pb)) host.problems.push(pb);
      host.delta += e.delta;
      for (const s of e.srcs) if (!host.srcs.includes(s)) host.srcs.push(s);
      host.avoid = uniq([...host.avoid, ...e.avoid]);
      host.structural = host.structural && e.structural;
      if (e.conflict && !host.conflict) host.conflict = e.conflict;
      const why = e.clash ? '原本的做法跟這一條五行相剋' : e.contra ? '原本的做法跟這一條用法相反' : '';
      host.notes.push(`「${e.problems[0]}」也落在這一方，${why ? `${why}，` : ''}一併照這一條處理。`);
      e.merged = host;
    }
    // 二黑五黃宮：拿掉東西的那幾條補金洩；整宮都沒提到金時，補在最重要的那一條
    if (hit25) {
      const live = ordered.filter((e) => !e.merged);
      const targets = needMetal.filter((e) => !e.merged);
      const tg = targets.length ? targets : (metalGiven ? [] : live.slice(0, 1));
      const note = `這一方有${names25(cells, p, cur)}，只用金洩，宜靜不宜動，不用土、火、木與水。`;
      for (const e of tg) {
        // R19：同一條已經講過「只用金」就不再補這句
        if (!e.list.some((x) => /只用金/.test(x.t))) e.notes.unshift(note);
        // T7：補金之前，同一條不能還有否定金的句子
        e.list = e.list.filter((x) => !negMetal(x.t));
        if (!metalGiven) {
          const extra = KB_WITH25 ? [...KB_WITH25.items].map(String) : [METAL_ITEM];
          for (const t of extra) if (!e.list.some((x) => bare(x.t) === bare(t))) e.list.push({ t, role: 'kb' });
          metalGiven = true;
        } else if (!e.list.some((x) => positiveHit(x.t, FAMILY.金))) {
          e.list.push({ t: METAL_ITEM, role: 'item' });
        }
      }
    }
  }
  // T8：併掉的那幾條不再單獨列
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].merged) entries.splice(i, 1);

  // R6：樓層的色系調整掛到玄關（大門宮）、戶主臥室（主臥宮）；那一宮已有相剋、顏色不同或二黑五黃時不寫那一處
  entries.push(...floorEntries(ctx, floorPlan, entries));

  // X2：二五宮（含流年）同一宮的化解收成一條（跟倒騎龍看法相反的那幾條照舊分開，本來就不進 LINE）
  merge25Entries(entries, ctx);

  // A4：同宮別條否定的五行（「少用紅色」＝火、「不放魚缸」＝水）與要收斂火氣的宮；動作不用這些五行（二五宮只用金，不看）
  const negOfEntry = new Map(entries.map((e) => [e, new Set([...(e.list || []).map((x) => x.t), ...(e.avoid || []), e.action || '']
    .flatMap((t) => negFamiliesOf(t)))]));
  const avoidFamsOf = (e) => {
    const s = new Set();
    if (!e.palace || has25(cells, e.palace, cur)) return s;
    for (const o of entries) if (o !== e && o.palace === e.palace) for (const f of negOfEntry.get(o) || []) s.add(f);
    if (fireQuiet(ctx, e.palace, e.rules || [])) s.add('火');
    return s;
  };
  const order = (p) => (p ? ALL_PALACES.indexOf(p) + 1 : 0);
  const out = entries
    .map((e) => {
      const mIdx = e.methodRole ? e.list.findIndex((x) => x.role === 'method') : -1;
      let method = mIdx >= 0 ? e.list[mIdx].t : '';
      const rest = e.list.filter((x, i) => i !== mIdx).map((x) => x.t);
      if (!method && !e.kb && rest.length) method = rest.shift();
      if (!method) method = e.notes.length ? e.notes.shift() : '依下面的做法調整。';
      // R19：「只用金」在同一條只講一次
      let onlyMetal = /只用金/.test(method);
      let items = uniq([...e.notes, ...rest].map((x) => (isFragment(x) ? String(x).replace(/。$/, '') : endDot(x))))
        .filter((x) => {
          if (bare(x) === bare(method)) return false;
          if (!/只用金/.test(x)) return true;
          if (onlyMetal) return false;
          onlyMetal = true;
          return true;
        });
      // T20：細項裡講同一件事的（雙字重疊多）只留較完整的一句；跟做法那一句相似又比較短的也不重列
      items = dedupeSimilar(items, method);
      const hit25 = !!e.palace && has25(cells, e.palace, cur);
      // L3：二五宮又有臥室類（或有人睡）——不寫「不宜久坐、久睡」，改「床頭附近放銅葫蘆、房內保持安靜」
      let avoidOut = e.avoid;
      if (bedHereAt(ctx, e.palace)) {
        avoidOut = stripStay(e.avoid);
        // T20：跟既有細項講同一件事（「銅葫蘆」）就只留較完整的這一句
        if (hit25 && ![method, ...items].some((x) => /床頭附近放銅葫蘆/.test(x))) items = dedupeSimilar([...items, BED_25_FIX], method);
      }
      const yr25 = hit25 && !!(cells[e.palace].yearStar && is25(cells[e.palace].yearStar, cur));
      // T1、T3：二五宮的動作也要過 clean25（不用會響的金、不寫宜動明亮）
      const fit25 = (a) => (hit25 ? clean25(a).text.replace(/。$/, '') : a);
      // Z1：動作先用表查到的（規則代碼 → ACTIONS）；查表的動作要過白話規矩
      // A4：動作的五行是同宮別條否定的（或這一宮要收斂火氣）→ 先換查表的備案，不行再走退路
      const avoidF = avoidFamsOf(e);
      const famOk = (a) => !familiesOf(a).some((f) => avoidF.has(f));
      let action = e.action ? fit25(e.action) : '';
      let actionFrom0 = e.actionFrom || 'table';
      if (action && actionProblem(action)) action = '';
      if (action && !famOk(action)) {
        const alt = e.altAction && !actionProblem(e.altAction) && famOk(e.altAction) ? fit25(e.altAction) : '';
        action = alt;
        actionFrom0 = 'table';
      }
      let concrete = !!action;
      let actionFrom = action ? actionFrom0 : '';
      // Z1：退路——規則自己的 fix 先當動作候選，其次才是知識庫的 method 與細項；「不放…」這種禁忌最後才用；
      //     一律要以白名單動詞開頭（leadOk），而且這一宮不能放水時不收放水的
      const own = e.kb ? e.list.filter((x) => x.role === 'item').map((x) => x.t) : [];
      const kbRest = e.kb ? e.list.filter((x, i) => i !== mIdx && x.role !== 'item').map((x) => x.t) : rest;
      const dryOk = (a) => !(e.palace && positiveHit(a, WATER_PUT_RE) && !waterOk(e.palace, ctx));
      // A9：大門那一條的退路不收灶口、床頭、床位的句子
      const offOk = (a) => !offTopic(e.rules, a);
      const cands = uniq([...own, method, ...kbRest].map(concreteOf).map((a) => (a ? fit25(a) : '')).filter(Boolean))
        .filter((a) => leadOk(a) && dryOk(a) && famOk(a) && offOk(a));
      const positive = (a) => !/^(不|少|別|勿)/.test(a) && !NEG_RE.test(a.split('，')[0]);
      if (!action) {
        // 「原位改放…」要先搬走才成立，排在最後
        action = cands.find((a) => positive(a) && !/^原位/.test(a)) || cands.find(positive) || cands[0] || '';
        concrete = !!action;
        if (action) actionFrom = 'fallback';
      }
      // T15：二五宮（含流年）宜靜，動作先挑不用動工的；都要動工時註明今年先不做（X4：兩種都有用合併註記）
      if (hit25 && action && constructHit(action)) {
        // 「原位改放…」是搬走之後才成立的做法，不搬就不能單獨拿來當動作
        const calm = cands.find((a) => positive(a) && !constructHit(a) && !/^原位/.test(a));
        if (calm) { action = calm; actionFrom = 'fallback'; }
        else action = withBuildNote(action, buildNoteOf(cells, e.palace, cur));
      }
      void yr25;
      // Z1：表沒有、退路也挑不到 → 通用動作（二五用金、其他依凶源五行保持整潔通風），LINE 化解重點不列（concrete=false）
      if (!action) { action = genericAction(e.palace, e.wx, ctx, e.rules); actionFrom = 'generic'; }
      return {
        palace: e.palace,
        dir: e.palace ? (e.palace === '中' ? '中宮' : `${PALACE_INFO[e.palace].dir}方`) : '全宅',
        // X2：二五宮併成一條的標題「此宮有X、另有Y」
        problem: e.title || e.problems.join('、'),
        problems: e.problems,
        who: e.who || null,
        merged25: !!e.merged25,
        method: endDot(method),
        action,
        actionFrom,
        altAction: e.altAction && e.altAction !== action ? e.altAction : '',
        items,
        avoid: avoidOut,
        delta: round1(e.delta),
        srcs: e.srcs,
        structural: !!e.structural,
        concrete,
        conflict: e.conflict || null,
        rules: e.rules || [],
        room: (e.rooms && e.rooms.length === 1) ? e.rooms[0] : null,
        wx: e.wx || null,
      };
    })
    .sort((a, b) => order(a.palace) - order(b.palace) || a.delta - b.delta);
  // R7：同一宮的門墊／地墊顏色只留最重的那一條，其他改寫「門墊顏色見上一條」
  dedupeMats(out);
  ctx.floorPlan = floorPlan;
  return out;
}

/** L3：這一宮有沒有臥室類（主臥、臥室、小孩房、長輩房）或有人睡（居住者的床位） */
function bedHereAt(src, p) {
  if (!p) return false;
  const env = targetEnv(src);
  return (env.rooms[p] || []).some((r) => BED_ROOMS.includes(r)) || sleepersAt(env, p).length > 0;
}
/** L3：二五宮評吉的床位、臥室不准出現的推薦句（身體較弱的人尤其合適、也利求子…） */
const REC_BED_RE = /尤其合適|最合適|最適合|利求子|添丁|求姻緣|首選|利事業衝刺|適合年輕人|適合夫妻/;
// 拿掉推薦子句用的（比 REC_BED_RE 寬：適合、合適、事業、夫妻這類「給誰睡」的話一起拿）
const REC_CLAUSE_RE = /適合|合適|求子|添丁|姻緣|首選|事業|夫妻/;
/**
 * L3：一段床位、臥室的文字拿掉推薦子句（逐句逐子句；整句都是推薦就整句拿掉）。
 * wide＝false 時只拿 REC_BED_RE 那幾種（閘門改別人的文字用，「八宅看放在吉方合適」這種說明留著）。
 */
function stripRecBed(text, wide = true) {
  const hit = (c) => REC_BED_RE.test(c) || (wide && REC_CLAUSE_RE.test(c));
  const out = [];
  for (const s of sentences(text)) {
    if (!hit(s)) { out.push(s); continue; }
    const t = clausesOf(s.replace(/[。！？]$/, '')).filter((c) => !hit(c)).join('')
      .replace(/^[，；\s]+/, '').replace(/[，；、\s]+$/, '').replace(/^(也|並|或|又)/, '');
    if (t) out.push(endDot(t));
  }
  return out.join('');
}
/** L3：「不宜久坐、久睡」那一句（或那一段子句） */
const STAY_RE = /久坐|久睡/;
/** L3：拿掉禁忌裡「不宜久坐、久睡」那一段（同一句的其他禁忌留著） */
function stripStay(list) {
  const out = [];
  for (const s of list || []) {
    if (!STAY_RE.test(s)) { out.push(s); continue; }
    const dot = /。$/.test(s);
    const t = clausesOf(String(s).replace(/。$/, '')).filter((c) => !STAY_RE.test(c)).join('')
      .replace(/^[，；\s]+/, '').replace(/[，；、\s]+$/, '').replace(/^(也|並|或)/, '');
    if (t) out.push(dot ? endDot(t) : t);
  }
  return out;
}

/** A1：二五宮神位那一條，內局規則自己帶的 action（過二五宜靜、不動工、白話規矩；不行回 ''） */
function altarActionAt(ctx, p, rules) {
  const it = ((ctx.interior && ctx.interior.items) || []).find((x) => x && x.palace === p && /^altar-/.test(String(x.rule))
    && (rules || []).includes(x.rule) && x.action);
  if (!it) return '';
  const a = clean25(String(it.action).replace(/[。！？]$/, '')).text.replace(/。$/, '');
  return a && !actionProblem(a) && !forbid25(a) && !constructHit(a) && !moveMentions(a).length ? a : '';
}

/* ---- X2：二五宮的化解收成一條 ---- */

/** X2：「五黃（流年）」「二黑（山星、向星）」這種說法（只列不當運的二黑五黃） */
function desc25(cells, p, cur) {
  const c = (cells && cells[p]) || {};
  const out = [];
  for (const s of [5, 2]) {
    if (!is25(s, cur)) continue;
    const roles = [];
    if (c.m === s) roles.push('山星');
    if (c.f === s) roles.push('向星');
    if (c.yearStar === s) roles.push('流年');
    if (roles.length) out.push(`${sn(s)}（${roles.join('、')}）`);
  }
  return out.join('、');
}
/** X2：問題的短稱（「廁所在坎宮：水過旺」→「廁所在坎宮」） */
const shortProblem = (pb) => String(pb || '').replace(/（看法不同）/g, '').replace(/[「」]/g, '').split('：')[0].trim();
// X2：「另有X：…」那一句不收的系統說明
const MERGE_SKIP_RE = /只用金|此宮有|這一方有|見二五|先不用|先不列|一併照|見化解清單|見上一條|見八宅|見格局/;
// X2：講二黑五黃本身的問題（流年二五、山向星組合「山八向五」、引動五黃…），寫在標題「此宮有…」裡
const PROB25_RE = /五黃|二黑|年流年|[山向][二五]/;

/**
 * X2：二五宮（山向星或流年有二黑五黃）同一宮所有化解收成一條：
 *   標題「此宮有五黃（流年）、另有廁所在坎宮」；做法只用金、宜靜（二五那幾條留下來的金，沒有就補金）；
 *   原本的問題各寫一句「另有X：以除濕、通風、少用為主」（宮位五行那幾條）或「另有X：它自己不用動工的做法」。
 *   跟倒騎龍看法相反的（conflict）照舊分開。入囚的中宮金只放一點。
 */
function merge25Entries(entries, ctx) {
  const { cells, curPeriod: cur, fit } = ctx;
  const prisonNow = !!(fit && fit.prison && (fit.prison.mountain || fit.prison.facing));
  for (const p of ALL_PALACES) {
    if (!has25(cells, p, cur)) continue;
    const es = entries.filter((e) => e.palace === p && !e.conflict);
    if (!es.length) continue;
    const prim = es.filter((e) => e.is25);
    const others = es.filter((e) => !e.is25);
    const note = buildNoteOf(cells, p, cur);
    const light = p === '中' && prisonNow;
    // 二五那幾條留下來的做法（金、宜靜）；入囚的中宮不放厚重的
    const items = [];
    for (const e of prim) {
      for (const x of e.list) {
        const t = String(x.t || '');
        if (!t || MERGE_SKIP_RE.test(t) || forbid25(t)) continue;
        if (light && HEAVY_RE.test(t)) continue;
        items.push(constructHit(t) ? withBuildNote(t, note) : t);
      }
    }
    if (!items.some((t) => positiveHit(t, FAMILY.金))) items.push(light ? METAL_LIGHT : METAL_ITEM);
    // Z3：這一宮有魚缸 → 合併後的化解要講魚缸（移出這一宮；移不了先關掉打氣、縮小水量）
    const roomsHere = (ctx.input && ctx.input.rooms && ctx.input.rooms[p]) || cells[p].rooms || [];
    if (roomsHere.includes('魚缸') && !items.some((t) => /魚缸/.test(t))) {
      items.push(withBuildNote(FISH_25_LINE, note));
    }
    // 原本的問題：各一句「另有X：…」
    const lines = [];
    for (const e of others) {
      const differ = e.problems.some((pb) => /看法不同/.test(pb));
      // 問題名稱放在「」裡（「白虎見動」是名稱不是建議）
      const short = `「${shortProblem(e.problems[0])}」${differ ? '（看法不同）' : ''}`;
      if (e.feeds) {
        const calm = CALM_BY_WX[e.wx] || CALM_DEFAULT;
        lines.push(`另有${short}：先以${calm.what}為主。`);
        continue;
      }
      if (e.palaceWx) {
        const m = e.list.map((x) => x.t).join('').match(/以([^。；，]+?)為主/);
        const how = m ? m[1] : (CALM_BY_WX[e.wx] || CALM_DEFAULT).what;
        lines.push(`另有${short}：以${how}為主。`);
        continue;
      }
      const isPeople = e.srcs.includes('people');
      // A1：神位在二五宮那一行，用內局規則自己帶的 action（神桌整潔、香爐燭台改銅製），不從句子裡抽（「放明年請神前」）
      const altarAct = (e.rules || []).some((r) => /^altar-/.test(r)) ? altarActionAt(ctx, p, e.rules) : '';
      if (altarAct) {
        lines.push(`另有${short}：${altarAct}。`);
        continue;
      }
      // Z1：查表（或規則自帶）的動作本身就是動作，不再過 concreteOf（免得被當成名詞片段補成「放…」）
      const own = e.action && !actionProblem(e.action) ? [String(e.action).replace(/[。！？]$/, '')] : [];
      const cands = uniq([...own, ...e.list.map((x) => concreteOf(x.t))].filter(Boolean))
        .map((a) => clean25(a).text.replace(/。$/, ''))
        .filter((a) => a && !MERGE_SKIP_RE.test(a) && !forbid25(a) && !actionProblem(a)
          && !(isPeople && moveMentions(a).length)
          && !(familiesOf(a).length && familiesOf(a).every((f) => f === '金'))
          && !(light && HEAVY_RE.test(a)));
      let act = cands.find((a) => !constructHit(a)) || '';
      if (!act && cands.length) act = withBuildNote(cands[0], note);
      lines.push(act ? `另有${short}：${act}。` : `另有${short}，做法同上（金洩、宜靜）。`);
    }
    // 先前已經併進別條（T8）的問題也各交代一句（二五那幾項寫在標題「此宮有…」裡，不另寫）
    const said = new Set(others.map((e) => e.problems[0]));
    for (const e of es) {
      for (const pb of e.problems) {
        if (said.has(pb) || (prim.includes(e) && pb === e.problems[0]) || PROB25_RE.test(pb)) continue;
        said.add(pb);
        lines.push(`另有「${shortProblem(pb)}」${/看法不同/.test(pb) ? '（看法不同）' : ''}，做法同上（金洩、宜靜）。`);
      }
    }
    // 標題：二五那一項在前，另有的問題列第一個（多的寫「等」）；居住者那幾條帶稱呼，不放進標題
    const names = uniq(others.filter((e) => !(e.srcs.length === 1 && e.srcs[0] === 'people')).flatMap((e) => e.problems.map(shortProblem)));
    const title = `此宮有${desc25(cells, p, cur)}${names.length ? `、另有${names[0]}${names.length > 1 ? '等' : ''}` : ''}`;
    let srcs = uniq(es.flatMap((e) => e.srcs));
    if (srcs.some((s) => s !== 'people')) srcs = srcs.filter((s) => s !== 'people');
    const merged = {
      palace: p,
      title,
      problems: uniq([title, ...es.flatMap((e) => e.problems)]),
      list: [
        { t: `這一方有${names25(cells, p, cur)}，只用金洩，宜靜不宜動，不用土、火、木與水。`, role: 'method' },
        ...uniq(items).map((t) => ({ t, role: 'item' })),
        ...uniq(lines).map((t) => ({ t, role: 'item' })),
      ],
      avoid: uniq(es.flatMap((e) => e.avoid)).filter((s) => !negMetal(s)),
      notes: [],
      delta: es.reduce((a, e) => a + e.delta, 0),
      srcs,
      // Z1：二五合併的動作查表（依房間：魚缸、大門、廚房、廁所、臥室、神位、樓梯；入囚的中宮金只放一點）
      action: actionFor('merge25', actCtx(ctx, p, { rule: 'merge25', prison: light })) || (light ? '放一組六帝錢，中宮保持開闊、安靜' : METAL_ACTION),
      actionFrom: 'table',
      structural: false,
      conflict: null,
      kb: null,
      methodRole: true,
      used25: true,
      merged25: true,
      who: null,
      rules: uniq(['merge25', ...es.flatMap((e) => e.rules || [])]),
      rooms: [],
    };
    const at = entries.indexOf(es[0]);
    for (const e of es) entries.splice(entries.indexOf(e), 1);
    entries.splice(Math.min(at, entries.length), 0, merged);
  }
}

/* ---- 化解的小工具（R6、R7、R11） ---- */

const DAOQI_CONFLICT_NOTE = '本宅外局已是倒騎龍形勢，這一條與倒騎龍看法不同，各派都列，請自行斟酌。';
// R11：倒騎龍成立時，坐方見水（上山那一半）、向方見山（下水那一半）會被這幾條規則扣分
const DAOQI_SIT_RULES = ['xuanwu-kong', 'zhengshen-shui', 'wangshan-shui'];
const DAOQI_FACE_RULES = ['zhuque-bipo', 'lingshen-shi', 'wangxiang-shi'];
function daoqiConflict(ctx, it) {
  const d = ctx.daoqilong;
  if (!d || !it) return false;
  const sitSide = d.pattern === '上山下水' || d.pattern === '上山';
  const faceSide = d.pattern === '上山下水' || d.pattern === '下水';
  if (sitSide && it.palace === ctx.cx.sittingPalace && DAOQI_SIT_RULES.includes(it.rule)) return true;
  if (faceSide && it.palace === ctx.cx.facingPalace && DAOQI_FACE_RULES.includes(it.rule)) return true;
  return false;
}

/** R7：一段文字裡肯定（pos）與否定（neg）的關鍵字 */
const termsOf = memo1(termsOfRaw);
function termsOfRaw(text) {
  const pos = new Set();
  const neg = new Set();
  for (const clause of clausesOf(unquoteNames(text))) {
    for (const w of TERMS) {
      let i = clause.indexOf(w);
      while (i >= 0) {
        if (negatedAt(clause, i, w.length)) neg.add(w);
        else pos.add(w);
        i = clause.indexOf(w, i + 1);
      }
    }
  }
  return { pos, neg };
}

// 顏色屬哪一行（R6 的顏色矛盾檢查用）
const COLOR_FAMILY = {
  金: /白色|金色|銀色|金屬色/,
  木: /綠色|青色|青綠/,
  火: /紅色|紫色|粉紅|紅紫/,
  土: /黃色|米色|咖啡|黃褐/,
  水: /藍色|黑色|黑藍/,
};

/** R6：樓層色系的五行與白話（floor 有 fixWx 就用；沒有就依生出、剋入自己推） */
function floorPlanOf(ctx) {
  const { floor } = ctx;
  if (!floor || !floor.fix || !(floor.level === '凶' || floor.level === '注意')) return null;
  const rel = floor.relation;
  let wx = typeof floor.fixWx === 'string' && WX_COLOR[floor.fixWx] ? floor.fixWx : null;
  let how = '';
  if (rel === '生出' && floor.selfWx) {
    wx = wx || supporter(floor.selfWx);
    how = `${wx}生${floor.selfWx}，把被洩掉的氣補回來。`;
  } else if (rel === '剋入' && floor.wx && floor.selfWx) {
    wx = wx || SHENG[floor.wx];
    how = `${floor.wx}生${wx}、${wx}生${floor.selfWx}，把相剋化成相生。`;
  }
  return {
    wx, how, relation: rel, delta: (Number(floor.score) || 0) - 1.5, fix: floor.fix,
    problem: `樓層五行${rel || ''}`, spots: [], skipped: [], sectionFix: null,
  };
}

/** R6：這一宮能不能用 wx 的色系；不能就回原因 */
function floorSpotBlock(p, wx, entries, ctx) {
  const { cells, curPeriod } = ctx;
  if (wx !== '金' && has25(cells, p, curPeriod)) return `有${names25(cells, p, curPeriod)}`;
  const texts = [];
  for (const e of entries) {
    if (e.palace !== p) continue;
    texts.push(...e.list.map((x) => x.t), e.action || '', ...e.avoid);
  }
  const pos = new Set();
  const neg = new Set();
  const colors = new Set();
  for (const t of texts) {
    for (const f of familiesOf(t)) pos.add(f);
    for (const clause of clausesOf(t)) {
      for (const f of Object.keys(COLOR_FAMILY)) {
        const m = clause.match(COLOR_FAMILY[f]);
        if (!m) continue;
        const pre = clause.slice(0, m.index);
        if (NEG_RE.test(pre) || NEG_TAIL.test(pre)) neg.add(f);
        else colors.add(f);
      }
      for (const f of Object.keys(FAMILY)) {
        const m = clause.match(FAMILY[f]);
        if (m && (NEG_RE.test(clause.slice(0, m.index)) || NEG_TAIL.test(clause.slice(0, m.index)))) neg.add(f);
      }
    }
  }
  const ke = [...pos].find((f) => KE[f] === wx || KE[wx] === f);
  if (ke) return `已有用${ke}的做法，${ke}與${wx}相剋`;
  if (neg.has(wx)) return `已寫少用${wx}的東西`;
  const other = [...colors].find((f) => f !== wx);
  if (other) return `已指定${WX_COLOR[other]}系的顏色`;
  return null;
}

/** R6：樓層色系的化解條目（掛到實際位置）；也把畫面「樓層」一段用的 fix 一起算好放在 plan.sectionFix */
function floorEntries(ctx, plan, entries) {
  if (!plan) return [];
  const base = { kb: null, srcs: ['floor'], structural: false, conflict: null, avoid: [], notes: [], methodRole: true, used25: false, rules: ['floor'], actionFrom: 'table' };
  if (!plan.wx) {
    return [{ ...base, palace: null, problems: [plan.problem], fixes: [plan.fix], delta: plan.delta, action: '',
      list: sentences(plan.fix).map((t, i) => ({ t, role: i === 0 ? 'method' : 'item' })) }];
  }
  const { input } = ctx;
  const color = `${WX_COLOR[plan.wx]}色`;
  const spots = [];
  const addSpot = (name, palace) => {
    const same = spots.find((s) => palace && s.palace === palace);
    if (same) same.names.push(name);
    else spots.push({ names: [name], palace });
  };
  addSpot('玄關', input.doorPalace || null);
  addSpot('戶主臥室', input.masterPalace || null);
  const out = [];
  for (const s of spots) {
    const name = s.names.join('與');
    const why = s.palace ? floorSpotBlock(s.palace, plan.wx, entries, ctx) : null;
    if (why) { plan.skipped.push({ name, palace: s.palace, why }); continue; }
    plan.spots.push({ name, palace: s.palace });
    out.push({
      ...base, palace: s.palace, problems: [plan.problem], fixes: [], delta: plan.delta,
      action: `${name}多用${plan.wx}的色系（${color}）`,
      list: [
        { t: `${name}可多用${plan.wx}的色系（${color}）與材質，不必全屋都用。`, role: 'method' },
        ...(plan.how ? [{ t: plan.how, role: 'item' }] : []),
      ],
    });
  }
  const skipText = plan.skipped.map((s) => `${s.name}（${s.palace ? dirOf(s.palace) : ''}）${s.why}，不寫這一處。`).join('');
  if (!plan.spots.length) {
    out.push({
      ...base, palace: null, problems: [plan.problem], fixes: [], delta: plan.delta,
      action: '床位、床頭取個人吉方來補',
      list: [
        { t: `玄關與戶主臥室都不適合再加${plan.wx}的色系。`, role: 'method' },
        { t: skipText, role: 'item' },
        { t: '這一項改以床位、床頭取個人吉方來補。', role: 'item' },
      ],
    });
    plan.sectionFix = `${skipText}這一項改以床位、床頭取個人吉方來補。`;
  } else if (plan.skipped.length) {
    plan.sectionFix = `${plan.spots.map((s) => s.name).join('或')}可多用${plan.wx}的色系（${color}）與材質，不必全屋都用。${plan.how}${skipText}`;
  }
  return out;
}

/** R7：去掉一句裡講門墊、地墊顏色的那一段；回 { text, hit } */
function stripMatClause(s) {
  let t = String(s || '');
  let hit = false;
  if (/的布品與地墊/.test(t)) { t = t.replace(/的布品與地墊/g, '的布品'); hit = true; }
  if (/地墊、布品/.test(t)) { t = t.replace(/地墊、布品/g, '布品'); hit = true; }
  if (/、地墊/.test(t) && MAT_COLOR_RE.test(t)) { t = t.replace(/、地墊/g, ''); hit = true; }
  const out = [];
  for (const sent of sentences(t)) {
    const dot = /。$/.test(sent);
    const cls = clausesOf(sent.replace(/。$/, ''));
    const keep = cls.filter((c) => !MAT_COLOR_RE.test(c));
    if (keep.length !== cls.length) hit = true;
    let body = keep.join('').replace(/^[，；\s]+/, '').replace(/[，；\s]+$/, '');
    if (!body) continue;
    if (keep.length !== cls.length && !VERB_RE.test(body) && !isFragment(body)) continue;
    if (/：$/.test(body)) continue;
    out.push(dot || /[。！？]$/.test(body) ? endDot(body) : body);
  }
  return { text: out.join(''), hit };
}

function dedupeMats(list) {
  const keeper = new Map();
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.palace) continue;
    const texts = [e.method, ...e.items, e.action];
    if (!texts.some((t) => MAT_COLOR_RE.test(t) || /的布品與地墊/.test(t))) continue;
    const k = keeper.get(e.palace);
    if (!k) {
      keeper.set(e.palace, e);
      // 同一條裡講了兩次門墊顏色（規則的 fix 與知識庫各一句）→ 只留第一句
      let seen = MAT_COLOR_RE.test(e.method);
      e.items = e.items.map((x) => {
        if (!MAT_COLOR_RE.test(x)) return x;
        if (!seen) { seen = true; return x; }
        return stripMatClause(x).text;
      }).filter(Boolean);
      continue;
    }
    const word = (texts.join('').match(MAT_RE) || ['門墊'])[0];
    const ref = list[i - 1] === k ? '上一條' : `上面「${k.problems[0]}」那一條`;
    const m = stripMatClause(e.method);
    const items = e.items.map((x) => stripMatClause(x).text).filter(Boolean);
    e.method = m.text || items.shift() || `${word}顏色見${ref}。`;
    e.items = uniq([...items, `${word}顏色見${ref}。`].filter((x) => bare(x) !== bare(e.method)));
    if (MAT_COLOR_RE.test(e.action)) {
      const a = e.action.split('，').filter((c) => !MAT_COLOR_RE.test(c)).join('，');
      if (a && !actionProblem(a)) e.action = a;
      else {
        // Z1：退路挑的動作要以白名單動詞開頭；挑不到用通用動作
        const alt = [e.method, ...e.items].map(concreteOf).find((x) => x && leadOk(x) && !MAT_COLOR_RE.test(x) && !/顏色見/.test(x) && !offTopic(e.rules, x));
        if (alt) { e.action = alt; e.actionFrom = 'fallback'; } else { e.action = genericAction(e.palace, e.wx, null, e.rules); e.concrete = false; e.actionFrom = 'generic'; }
      }
    }
  }
}

function buildRemedySection(ctx) {
  return section('remedies', remedySectionItems(ctx.remedyEntries || []));
}

/** 化解段的條目（G0 閘門改寫化解清單之後也用這個重排，跟 report.remedies 一致） */
function remedySectionItems(entries) {
  const items = [];
  if (!entries.length) {
    items.push(mk('吉', '目前沒有需要化解的凶項', '各段落沒有明顯的凶項；吉方保持明亮、整潔、常使用，就是最好的催旺。'));
  }
  for (const e of entries) {
    const head = e.palace ? (e.palace === '中' ? '中宮' : `${e.dir}（${e.palace}宮）`) : '全宅';
    const fixText = joinItems(e.items);
    items.push(mk(e.delta <= -1 ? '凶' : '注意', `${head}：${e.problem}`, e.method || '依下面的做法調整。',
      {
        palace: e.palace || undefined,
        fix: fixText || undefined,
        delta: e.delta,
        avoid: e.avoid.length ? e.avoid.join('') : undefined,
      }));
  }
  items.push(mk('平', '化解通則', GENERAL_NOTES.map(endDot).join('')));
  return items;
}

/* ---- 門派與限制 ---- */
function buildMethod(ctx) {
  const { house, activeName } = ctx;
  const modeName = house.mode === 'door' ? '門上起伏位' : '坐山立極';
  const items = [
    mk('平', '八宅', `依《八宅明鏡》《陽宅三要》，以坐山立極或門上起伏位定宅卦，看門、主、灶與各房間落在哪一顆游年星。本報告用的是${modeName}；大門吉凶兩種立法都以坐山論。`),
    mk('平', '玄空飛星', `依《沈氏玄空學》，以入住（或大修）那一年的元運起盤。正向用下卦，兼向超過 3° 用替卦，兩盤都列；本報告以${activeName}盤為主。`),
    mk('平', '交運與五黃', '星的旺衰、當運山向星與零正神，用現在所屬的元運判。替卦遇運盤五黃，預設五黃無替，另一派取本山替星只當參考。'),
    mk('平', '形勢四獸', '屋外形勢以四獸來看：前朱雀、後玄武、左青龍、右白虎。高樓當山看、道路當虛水看，形煞另外扣分。'),
    mk('平', '河圖樓層', '樓層以河圖數取尾數的五行：一六水、二七火、三八木、四九金、五十土，再跟戶主命卦論生剋。'),
    mk('平', '名稱對照', '八宅的「游年生氣」是方位，玄空的「生氣」是下一運之星，兩者不同。旺氣與生氣合稱生旺。九星用主名，別名（貪狼、巨門等）只當副稱。'),
    mk('平', '分數怎麼來', '滿分 100：玄空格局 25、八宅門主灶 25、內局 20、外局 20、樓層與命宅 10。分數是依固定規則加減的參考值，不是機率。九宮逐宮吉凶另列，不計入總分。'),
    mk('平', '門派不同', '不同門派結論可能不同：八宅的吉方在玄空不一定吉，形勢與理氣也常相反。報告兩邊都列，不替你選邊。'),
    mk('注意', '使用限制', '風水結論不作為買賣保證，也不要寫進房屋廣告。身體不適請先就醫，法律與建築安全請找專業人員。'),
    mk('平', '量測與資料', '度數以站在大門內、面朝門外量到的磁北度數為準，量時遠離鐵門與電器。出生年與格局只在瀏覽器記憶體計算，不上傳、不儲存。'),
  ];
  return section('method', items);
}

/* ------------------------------------------------------------------ */
/* 6. 三優三注意                                                         */
/* ------------------------------------------------------------------ */

/** R17：內局規則屬哪一派（游年＝八宅；宮位五行、中宮＝宮位；其餘看山向星＝玄空） */
function interiorSchool(rule) {
  const r = String(rule || '');
  if (/younian/.test(r)) return '八宅';
  if (/-(qian|kan|dui|li|wood|earth|metal|center)$/.test(r)) return '宮位';
  return '玄空';
}
/** R17：哪兩派的一吉一凶算「看法不同」 */
// T14：宮位五行（火燒天門）對八宅（灶壓凶方）也算不同派別
const DIFFER_PAIRS = [['八宅', '玄空'], ['形勢', '玄空'], ['命卦', '八宅'], ['宮位', '八宅']];
// Z7：外局的「理氣」（零正神、當運山向星）就是玄空，比對派別時當同一派
const schoolOf = (s) => (s === '理氣' ? '玄空' : s);
function schoolsDiffer(a0, b0) {
  const a = schoolOf(a0);
  const b = schoolOf(b0);
  return DIFFER_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function buildHighlights(ctx) {
  const {
    fit, active, cx, door, master, masterView, stove, doorScore, masterScore, stoveScore, interior, exterior, floor, owner,
    cells, badPalaces, daoqilong, changed, curPeriod,
  } = ctx;
  const cand = [];
  const add = (delta, text, pri, meta = {}) => { if (text && delta) cand.push({ delta, text, pri, ...meta }); };

  const pat = fit.pattern;
  if (daoqilong && daoqilong.pattern === pat) add(2, daoqilong.hl, 0, { kind: 'pattern', school: '玄空' });
  else if (PATTERN_HL[pat] && PATTERN_HL[pat].text) {
    add(PATTERN_HL[pat].delta, `${PATTERN_HL[pat].text}${changed ? `（以現在${CN[curPeriod]}運論）` : ''}`, 0, { kind: 'pattern', school: '玄空' });
  }
  if (fit.prison.facing) add(-3, '向星入囚（當運向星飛進中宮），傳統認為財氣受困', 0, { kind: 'prison', palace: '中', school: '玄空' });
  if (fit.prison.mountain) add(-3, '山星入囚（當運山星飛進中宮），傳統認為人丁健康受困', 0, { kind: 'prison', palace: '中', school: '玄空' });
  for (const [k, label] of [['mountain', '山盤'], ['facing', '向盤']]) {
    if (active.fuyin[k]) add(-3, `${label}${active.fuyin[k]}，傳統認為事多反覆，跟格局吉凶分開看`, 0, { kind: 'fuyin', school: '玄空' });
  }
  if (active.heshiAll) add(2, `${active.heshiAll}，氣通而吉`, 0, { school: '玄空' });
  if (active.sanban) add(2, `${active.sanban}，三元之氣連通`, 0, { school: '玄空' });
  if (cx.kongwang) add(cx.kongwang === '大空亡' ? -6 : -3, `向度騎線（${cx.kongwang}），建議重量`, 0, { school: '玄空' });

  if (door) {
    add(doorScore - 5, `${dirOf(door.palace)}・大門在游年${door.star}（${YOUNIAN[door.star].level}）`, 1,
      { palace: door.palace, room: '大門', topic: 'yn', school: '八宅' });
  }
  if (master) {
    let t = `${dirOf(master.palace)}・主臥在游年${master.star}（${YOUNIAN[master.star].level}）`;
    if (masterView) {
      t = masterView.ownerGood
        ? `${dirOf(master.palace)}・主臥在游年${master.star}，但是戶主個人${masterView.ownerStar}方（看法不同）`
        : `${dirOf(master.palace)}・主臥在游年${master.star}，但山星${sn(masterView.m)}生旺（看法不同）`;
    }
    // F2：主臥評吉但這一宮有二黑五黃（含流年）——八宅段 level 是「注意」，不進三優
    const good25 = YOUNIAN[master.star].luck === '吉' && has25(cells, master.palace, curPeriod);
    if (!good25) add(round1(masterScore - 4), t, 1, { palace: master.palace, room: '主臥', topic: 'yn', fixed: !!masterView, school: '八宅' });
  }
  if (stove) {
    const t = stove.sitOk
      ? `爐灶坐游年${stove.star}，合乎「灶壓凶方」${stove.mouth ? (stove.mouth.ok ? '，灶口也朝吉方' : '，但灶口朝凶方') : ''}`
      : `爐灶壓在游年${stove.star}吉方，吉氣被耗`;
    add(stoveScore - 4, `${dirOf(stove.palace)}・${t}`, 1, { palace: stove.palace, room: '廚房', topic: 'yn', school: '八宅' });
  }

  for (const it of interior.items || []) {
    if (!it.delta) continue;
    // Z3：向星生旺的魚缸落在二五宮不算優點（五黃二黑宜靜，見內局那一條的看法不同）
    if (it.rule === 'fish-facing-good' && it.delta > 0 && has25(cells, it.palace, curPeriod)) continue;
    // D7：內局那一條本身就是「看法不同」（八宅宅卦凶、命卦或玄空吉）→ 三注意也標出來，不只列單一派
    const differ = it.differ === true || /^看法不同/.test(String(it.text));
    const t = brief(fixTitle(it.title), it.palace);
    add(it.delta, differ && !t.includes('看法不同') ? `${t}（看法不同）` : t, 3,
      { palace: it.palace, room: it.room, topic: /younian/.test(String(it.rule)) ? 'yn' : it.rule, school: interiorSchool(it.rule) });
  }
  for (const it of exterior.items || []) {
    if (!it.delta || it.rule === 'schools-differ') continue;
    // R11：跟倒騎龍看法相反的那幾條也在三注意註明
    const t = brief(fixTitle(it.title), it.palace);
    add(it.delta, it.delta < 0 && daoqiConflict(ctx, it) ? `${t}（與倒騎龍看法不同）` : t, 2,
      { palace: it.palace, topic: it.rule, school: it.school || '形勢' });
  }

  if (floor.relation && floor.floor !== null && floor.floor !== undefined) {
    const who = floor.selfSource === '宅卦' ? '宅卦' : '戶主';
    const FT = {
      生入: `樓層五行生${who}（生入），樓層的氣來幫`,
      比和: `樓層與${who}五行比和，同氣相扶`,
      剋出: `${who}剋樓層（剋出），能駕馭但較費心`,
      生出: `${who}的氣被樓層洩（生出），較容易累`,
      剋入: `樓層五行剋${who}（剋入），住起來壓力較大`,
    };
    add(round1((Number(floor.score) || 0) - 1.5), FT[floor.relation], 4, { school: '樓層' });
  }
  if (owner) {
    if (owner.match === true) add(1.5, '戶主命卦與宅同組（宅命相配）', 5, { school: '命卦' });
    if (owner.match === false) add(-1.5, '戶主命卦與宅不同組，床位床頭宜取個人吉方', 5, { school: '命卦' });
    // L3：床位那一宮有二黑五黃 → 八宅與玄空看法不同
    if (owner.bed && owner.bed.ok === true) add(0.75, `戶主床位在個人游年吉方${owner.bed.note25 ? '（看法不同）' : ''}`, 5, { school: '命卦' });
    // X1：床位所在宮是宅卦吉方或山星生旺時，命卦看凶、八宅或玄空看吉 → 標看法不同
    if (owner.bed && owner.bed.ok === false) {
      add(-1.5, `戶主床位在個人游年凶方${owner.bed.differ ? '（看法不同）' : ''}`, 5, { school: '命卦' });
    }
  }

  // D11：凶宮 3 個以上時，九宮凶宮也列為候選
  const cellCand = [];
  if (badPalaces.length >= 3) {
    for (const p of badPalaces) {
      const c = cells[p];
      const title = c.combo.title || `山星${sn(c.m)}向星${sn(c.f)}`;
      const tag = title.includes(`山${CN[c.m]}向${CN[c.f]}`) ? '' : `（山${CN[c.m]}向${CN[c.f]}）`;
      const t = `${dirOf(p)}・${title}${tag}，九宮評凶`;
      const o = { delta: -0.9, text: t, pri: 6, palace: p, kind: 'cell', rank: cellRank(c), school: '玄空' };
      cand.push(o);
      cellCand.push(o);
    }
    cellCand.sort((a, b) => a.rank - b.rank);
  }

  const pick = (sign) => {
    const list = cand.filter((c) => (sign > 0 ? c.delta > 0 : c.delta < 0))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.pri - b.pri);
    const out = [];
    const seen = new Set();
    for (const c of list) {
      if (out.length >= 3) break;
      // 同宮同房間、同一件游年的事只列一次（[22]）
      const k = c.topic === 'yn' && c.palace ? `${c.palace}|${c.room}|yn` : c.text;
      if (seen.has(k) || seen.has(c.text)) continue;
      seen.add(k);
      seen.add(c.text);
      out.push(c);
    }
    return out;
  };
  const good = pick(1);
  const bad = pick(-1);
  if (cellCand.length && !bad.some((c) => c.kind === 'cell')) {
    const best = cellCand.find((c) => !bad.some((b) => b.text === c.text));
    if (best) {
      if (bad.length < 3) bad.push(best);
      else bad[2] = best;
    }
  }
  // 同一宮一吉一凶：兩條分屬不同派別（八宅對玄空、形勢對理氣、命卦對宅卦）才標「看法不同」（[22]、R17）；
  // 形煞對上吉項、同一派別的一吉一凶、兩條都吉都不標
  const mark = (c) => {
    if (c.text.includes('看法不同')) return c.text;
    return c.text.endsWith('）') ? `${c.text.slice(0, -1)}，看法不同）` : `${c.text}（看法不同）`;
  };
  const clash = (a, b) => !!a.palace && a.palace === b.palace && schoolsDiffer(a.school, b.school);
  const goodOut = good.map((g) => (bad.some((b) => clash(g, b)) ? mark(g) : g.text));
  const badOut = bad.map((b) => (good.some((g) => clash(b, g)) ? mark(b) : b.text));
  return { good: goodOut, bad: badOut };
}

/* ------------------------------------------------------------------ */
/* 6b. G0 一致性閘門                                                     */
/* ------------------------------------------------------------------ */
//
// 依宮位（八宮＋中宮）收集各段落對該宮的建議句：格局段（當運山向星落點、雙星會坐會向、上山下水、入囚）、
// 九宮卡（fix 與本文最後的「建議：」）、流年段（fix 與本文的建議句）、內局、外局、八宅段、居住者床位、
// 化解清單（method／items／action）、三優三注意、LINE 化解重點。三條規則：
//   規則 1（二五宜靜）：該宮山星、向星或流年星有二黑或五黃（非當運）→ 肯定句不得有土、火、木、流水、燈光加強、
//          明亮、開門開窗、見動、宜動、做臥室、見水、鈴；施工字眼的句子補「（今年此方忌動土，明年再做）」
//          （流年二五）或「（此方宜靜，動工前先擇日）」（山向星二五）。入囚的中宮不放「厚重」金屬，改輕量金。
//   規則 2（同宮不互剋）：同一宮各段落的肯定做法五行不得相剋、不得「一邊少用 X、一邊用 X」；以化解清單裡
//          最重的那一條為準（依序：化解清單 → 八宅 → 內局 → 外局 → 居住者 → 流年 → 格局 → 九宮卡），
//          其他段落改寫成「這一方另有「X」的化解（見化解清單），這裡的做法先不用」。
//   規則 3（動作可照做）：化解清單與 LINE 的動作不得以「時」結尾、不得是條件子句或名詞片段，否則改取下一個具體做法。
// consistencyGate 會「改寫」；auditReport 用同一套規則只列違規（改寫之後應該是空的）。

const GATE_ORDER = { bazhai: 1, interior: 2, exterior: 3, people: 4, annual: 5, pattern: 6, palaces: 7 };
// 本文（不是 fix）只看「建議句」
const ADVICE_RE = /宜|可以|可(?:用|放|擺|做|作|當|改)|建議|最好|多用|保持|不妨/;
// 內局、外局、八宅、居住者的本文多半是說明（「左青龍宜動」「零神宜見水」是在講理論），只看明講「可以、建議」的句子
const TEXT_ADVICE_RE = /可以|可(?:用|放|擺|做|作)|建議|不妨|最好|多用/;
// 系統補的說明句（另有…的化解、先不用、見化解清單、見九宮卡、見上一條、一併照這一條處理）不當建議
const SYS_NOTE_RE = /做法先不用|先不列|一併照這一條處理|見化解清單|見九宮卡|見上一條|見上面|見格局段|見八宅段/;
const BUILD_NOTE_RE = new RegExp(NO_BUILD_NOTES.map(escRe).join('|'));
const GLOSS_TEXTS = new Set(GLOSS.map((gl) => gl.text));
const LINE_GLOSS_NOTES = LINE_GLOSS.map((gl) => gl.note);
const DIR_PALACE = Object.freeze({ 中宮: '中', ...Object.fromEntries(PALACES.map((p) => [`${PALACE_INFO[p].dir}方`, p])) });
const D4_SRC = Object.freeze({ kind: 'd4', key: 'd4', label: '二黑五黃只用金' });
/** X5：一個字（紅色、魚缸…）屬哪一家 */
const familyOfTerm = (w) => Object.keys(FAMILY).find((f) => FAMILY[f].test(w)) || null;
const HEAVY_RE = /厚重/;

/** 規則 1：二五宮不准出現的肯定句 */
const forbid25 = memo1(forbid25Raw);
function forbid25Raw(s0) {
  // X2：「另有「白虎見動」：…」引號裡是問題的名稱，不是建議
  const s = unquoteNames(s0);
  return positiveHit(s, BAD25_RE) || positiveHit(s, ACTIVE25_RE) || positiveHit(s, METHOD25_RE);
}
/**
 * 規則 1：有施工字眼（肯定句）卻沒補動土提醒。note 有給時要是那一句（X4：流年與山向星都有二五要用合併註記）；
 * 退路句（不能移時…）、「X避開這一宮」不算施工。
 */
function needsBuildNote(s, note) {
  const t = String(s || '');
  if (!constructHit(t)) return false;
  return note === undefined ? !NO_BUILD_NOTES.some((n) => t.includes(n)) : !t.includes(noteArg(note));
}
/** 規則 3：動作能不能照做（空字串＝可以） */
function actionProblem(a) {
  const t = String(a || '').trim().replace(/[。！？]$/, '');
  if (!t) return '沒有動作';
  if (COND_END_RE.test(t)) return '以「時」結尾';
  if (/^(若|如果|假如|萬一|要是)/.test(t)) return '是條件子句';
  const first = t.split(/[，；]/)[0];
  if (COND_END_RE.test(first)) return '開頭是條件子句';
  if (isFragment(t)) return '是名詞片段';
  // Z1：「放」接非物品、「的話」「當運」、超過 30 字（動土提醒不算）
  return actionLint(t);
}
/**
 * 「①東方・…」「中宮・…」開頭的方位 → 宮。
 * A10：行頭沒有「X方・」、宮名寫在標題裡（「③廚房在乾宮，火燒天門 → …」）也認得：看「 → 」前面那一段，只提到一個宮才算。
 */
function dirPalaceOf(s) {
  const t = String(s || '');
  const m = t.match(/^[①②③④⑤⑥]?([東西南北]{1,2}方|中宮)・/);
  if (m) return DIR_PALACE[m[1]] || null;
  // L4：行頭（去掉序號）就是方位（「②東方見路沖」「西北方有高架橋」）→ 那一宮；兩個字的方位先比
  const lead = t.replace(/^[①②③④⑤⑥]/, '').match(/^(東北|東南|西北|西南|東|西|南|北)方/);
  if (lead) return DIR_PALACE[`${lead[1]}方`] || null;
  const head = t.replace(/^[①②③④⑤⑥]/, '').split(' → ')[0];
  const hits = new Set();
  for (const x of head.matchAll(/([坎艮震巽離坤兌乾])宮/g)) hits.add(x[1]);
  if (/中宮/.test(head)) hits.add('中');
  return hits.size === 1 ? [...hits][0] : null;
}
/** 一句話裡只提到一個「（X宮）」（或中宮）→ 那一宮 */
function palaceInSentence(s) {
  const hits = new Set();
  for (const m of String(s || '').matchAll(/（([坎艮震巽離坤兌乾])宮）/g)) hits.add(m[1]);
  if (!hits.size && /中宮/.test(s)) hits.add('中');
  return hits.size === 1 ? [...hits][0] : null;
}
/** 格局段沒有標宮位的條目：句子裡寫明宮位就用它；現運格局那一條依格局判（會坐、上山＝坐方；會向、下水＝向方） */
function patternPalaceOf(it, s, g) {
  const direct = palaceInSentence(s);
  if (direct) return direct;
  if (!/^(下卦盤格局|替卦盤格局|現在.運)：/.test(String(it.title || ''))) return null;
  if (g.pattern === '雙星會坐' || g.pattern === '上山') return g.sit || null;
  if (g.pattern === '雙星會向' || g.pattern === '下水') return g.face || null;
  return null;
}

function gateCtx(report) {
  const cells = report.cells || {};
  const xk = report.xuankong || {};
  const cx = report.compass || {};
  const cur = xk.curPeriod || cx.period || 9;
  const p25 = {};
  const yr25 = {};
  const names = {};
  const note = {};
  for (const p of ALL_PALACES) {
    p25[p] = has25(cells, p, cur);
    yr25[p] = !!(cells[p] && cells[p].yearStar && is25(cells[p].yearStar, cur));
    names[p] = p25[p] ? names25(cells, p, cur) : '';
    // X4：這一宮的動土提醒用哪一句（流年與山向星都有二五＝合併註記）
    note[p] = buildNoteOf(cells, p, cur);
  }
  // Z2：每一宮不能放水的理由（空字串＝可以）；Z6：大門宮
  const dry = {};
  for (const p of ALL_PALACES) dry[p] = waterWhy(p, report);
  const door = ALL_PALACES.find((p) => cells[p] && cells[p].isDoor) || null;
  return {
    cells, cur, p25, yr25, names, note, pattern: xk.pattern, sit: cx.sittingPalace, face: cx.facingPalace,
    prison: !!(xk.prison && (xk.prison.mountain || xk.prison.facing)), dry, door,
  };
}

const cardAdviceAt = (text) => String(text || '').lastIndexOf(CARD_ADVICE);

/** 各段落裡掛在某一宮的建議（fix、九宮卡的「建議：」、流年與格局落點的本文） */
function gateUnits(report, g) {
  const units = [];
  for (const sec of report.sections || []) {
    const order = GATE_ORDER[sec.id];
    if (!order) continue;
    (sec.items || []).forEach((it, idx) => {
      let palaceOf;
      if (it.palace && ALL_PALACES.includes(it.palace)) {
        const p = it.palace;
        palaceOf = () => p;
      } else if (sec.id === 'pattern') {
        palaceOf = (s) => patternPalaceOf(it, s, g);
      } else return;
      const base = { sec: sec.id, it, order, idx, delta: Number.isFinite(it.delta) ? it.delta : 0, label: it.title, palaceOf };
      const mine = [];
      // advice：本文只看哪些句子（null＝整段都是建議）
      if (it.fix) mine.push({ ...base, field: 'fix', advice: null });
      if (sec.id === 'palaces' && cardAdviceAt(it.text) >= 0) mine.push({ ...base, field: 'card', advice: null });
      if (sec.id === 'annual' && it.palace) mine.push({ ...base, field: 'text', advice: ADVICE_RE });
      if (sec.id === 'pattern' && /當運山星、向星在哪裡/.test(String(it.title))) mine.push({ ...base, field: 'text', advice: ADVICE_RE });
      if (['bazhai', 'interior', 'exterior', 'people'].includes(sec.id) && it.palace) mine.push({ ...base, field: 'text', advice: TEXT_ADVICE_RE });
      units.push(...mine);
      // Z6：朱雀逼壓的做法（門口、向方窗戶）同時歸到大門宮檢查
      if (sec.id === 'exterior' && it.rule === 'zhuque-bipo' && g.door && g.door !== it.palace) {
        const dp = g.door;
        for (const u of mine) units.push({ ...u, palaceOf: () => dp, alsoDoor: true });
      }
    });
  }
  return units;
}
function unitGet(u) {
  if (u.field === 'card') {
    const i = cardAdviceAt(u.it.text);
    return i >= 0 ? u.it.text.slice(i + CARD_ADVICE.length) : '';
  }
  return String(u.it[u.field] || '');
}
function unitSet(u, v) {
  if (u.field === 'card') {
    const i = cardAdviceAt(u.it.text);
    if (i >= 0) u.it.text = v ? `${u.it.text.slice(0, i)}${CARD_ADVICE}${v}` : u.it.text.slice(0, i);
    return;
  }
  if (u.field === 'fix') {
    if (v) u.it.fix = v;
    else delete u.it.fix;
    return;
  }
  if (v) u.it[u.field] = v;
}
function unitTag(u) {
  const f = u.field === 'card' ? '建議' : u.field;
  return `${SECTION_TITLES[u.sec] || u.sec}「${u.label}」.${f}`;
}
/** 規則 2 的改寫句 */
function gateTell(c, partial, g, p) {
  const tail = partial ? '這裡相剋的做法先不用。' : '這裡的做法先不用。';
  if (c.from.kind === 'remedy') return `這一方另有「${c.from.label}」的化解（見化解清單），${tail}`;
  if (c.from.kind === 'd4') return `這一方有${g.names[p] || '二黑、五黃'}，只用金，${tail}`;
  return `這一方另有「${c.from.label}」的做法（見${SECTION_TITLES[c.from.sec] || '上面'}段），${tail}`;
}

/**
 * 閘門本體：apply＝true 時改寫報告，false 時只列違規。回傳違規清單（字串）。
 */
function gateWalk(report, apply) {
  const viol = [];
  if (!report || typeof report !== 'object' || !report.cells || !Array.isArray(report.sections)) return viol;
  const g = gateCtx(report);
  const units = gateUnits(report, g);
  const at = (p) => (p ? dirOf(p) : '全宅');
  // A6：雙星同宮的「先見水、水外有山」是說明，不當建議比對
  const skip = (s) => GLOSS_TEXTS.has(s) || SYS_NOTE_RE.test(s) || s === BOTH_WATER;

  /* ---- 規則 4（X1）：「移到／換到／放在…宮」的目標都要在 pickTargets 的名單裡（先改，後面的規則看改好的字） ---- */
  const peopleByLabel = new Map(((report.people && report.people.people) || []).map((x) => [x.label, x]));
  const whoOfLabel = (label) => (label && peopleByLabel.has(label) ? [peopleByLabel.get(label)] : undefined);
  const moveFix = (text, opt, here, where) => {
    const t = String(text || '');
    const bad = badMoves(t, report, opt, here);
    if (!bad.length) return t;
    for (const b of bad) viol.push(`[X1 移動目標] ${where}：${b.kind} 移到 ${b.palace} 不在名單：${b.sent}`);
    return apply ? fitMoves(t, report, opt, here) : t;
  };
  for (const sec of report.sections || []) {
    if (sec.id === 'method' || sec.id === 'remedies') continue;
    for (const it of sec.items || []) {
      // 流年、格局、九宮卡的宮位是講「這一方」本身（目標），不是原本的位置
      const fromHere = !['annual', 'pattern', 'palaces'].includes(sec.id);
      // F4：原本的位置收中宮（中宮的臥室換房也看 claims）；「這一方」只對八宮
      const p = it.palace && (fromHere ? moveChecked(it.palace) : PALACES.includes(it.palace)) ? it.palace : null;
      const label = sec.id === 'people' ? String(it.title || '').split('｜')[0] : null;
      // Z5：內局臥室那幾條帶房間種類（小孩房排除 kidBad 的宮）
      const opt = { from: fromHere ? p : null, who: whoOfLabel(label), room: sec.id === 'interior' ? it.room : undefined };
      for (const f of ['text', 'fix']) {
        if (!it[f]) continue;
        const v = moveFix(it[f], opt, fromHere ? null : p, `${SECTION_TITLES[sec.id] || sec.id}「${it.title}」.${f}`);
        if (apply && v !== it[f]) {
          if (v) it[f] = v;
          else if (f === 'fix') delete it.fix;
        }
      }
    }
  }
  for (const e of report.remedies || []) {
    const p = e.palace && moveChecked(e.palace) ? e.palace : null;
    const opt = { from: p, who: whoOfLabel(e.who), room: e.room || undefined };
    const where = `化解「${e.problem}」`;
    const m = moveFix(e.method, opt, null, `${where}.method`);
    const its = (e.items || []).map((x) => moveFix(x, opt, null, `${where}.items`)).filter(Boolean);
    const a = moveFix(e.action, opt, null, `${where}.action`);
    if (!apply) continue;
    e.method = m || e.method;
    e.items = its;
    e.action = a;
  }

  /* ---- 規則 1：二五宜靜、施工補提醒、入囚中宮不放厚重金屬 ---- */
  // Z6：extra＝大門宮那一遍（朱雀逼壓的做法同時歸到大門宮）只查二五宜靜與入囚，動土提醒照原本那一宮
  const rule1 = (text, palaceOf, advice, where, extra = false) => {
    const out = [];
    let heavy = false;
    for (const s of sentences(text)) {
      const p = palaceOf(s);
      if (!p || skip(s) || (advice && !advice.test(s))) { out.push(s); continue; }
      let t = s;
      if (g.p25[p] && forbid25(t)) {
        viol.push(`[規則1 二五宜靜] ${at(p)} ${where}：${s}`);
        t = clean25(t).text;
      }
      // X4：退路句、「X避開這一宮」不算施工；流年與山向星都有二五用合併註記（貼錯的換成對的）
      if (t && !extra && g.p25[p] && needsBuildNote(t, g.note[p])) {
        viol.push(`[規則1 動土提醒] ${at(p)} ${where}：${t}`);
        t = withBuildNote(t, g.note[p]);
      }
      if (t && p === '中' && g.prison && positiveHit(t, HEAVY_RE)) {
        viol.push(`[規則1 入囚輕量金] 中宮 ${where}：${t}`);
        t = '';
        heavy = true;
      }
      if (t) out.push(t);
    }
    return { text: out.join(''), heavy };
  };
  const empty25 = (p) => `這一方有${g.names[p]}，只用金、宜靜不宜動，放銅葫蘆或六帝錢即可。`;
  for (const u of units) {
    const before = unitGet(u);
    const r = rule1(before, u.palaceOf, u.advice, unitTag(u), !!u.alsoDoor);
    if (!apply || r.text === before) continue;
    const p = u.it.palace;
    const fallback = p && g.p25[p] ? empty25(p) : (u.field === 'text' ? '這一方的做法見化解清單。' : '');
    unitSet(u, r.text || fallback);
  }
  // Z6：朱雀逼壓那一條的做法也歸到大門宮
  const remPalaces = (e) => {
    const ps = e.palace ? [e.palace] : [];
    if (e.palace && !e.merged25 && Array.isArray(e.rules) && e.rules.includes('zhuque-bipo') && g.door && g.door !== e.palace) ps.push(g.door);
    return ps;
  };
  for (const e of report.remedies || []) {
    remPalaces(e).forEach((p, k) => {
      const pof = () => p;
      const where = `化解「${e.problem}」`;
      const m = rule1(e.method, pof, null, `${where}.method`, k > 0);
      const its = (e.items || []).map((x) => rule1(x, pof, null, `${where}.items`, k > 0));
      const a = rule1(e.action, pof, null, `${where}.action`, k > 0);
      if (!apply) return;
      e.method = m.text || (g.p25[p] ? `這一方有${g.names[p]}，只用金洩，宜靜不宜動。` : e.method);
      e.items = its.map((x) => x.text).filter(Boolean);
      e.action = a.text;
      // G4：入囚的中宮拿掉厚重金屬之後，補一句輕量金
      if ((m.heavy || its.some((x) => x.heavy) || a.heavy) && ![e.method, ...e.items].some((x) => positiveHit(x, FAMILY.金))) {
        e.items.push(METAL_LIGHT);
      }
    });
  }

  /* ---- 規則 5（Z2）：不能放水的宮（二五、山星當運、廁所水、凶宮失令）不得有肯定的放水句 ---- */
  const ruleW = (text, palaceOf, advice, where) => {
    const out = [];
    const told = new Set();
    for (const s of sentences(text)) {
      const p = palaceOf(s);
      // A5：「…」裡的名稱不算放水句（跟 dryOne 同一把尺）
      if (!p || !g.dry[p] || skip(s) || (advice && !advice.test(s)) || !waterPut(s)) { out.push(s); continue; }
      viol.push(`[Z2 不放水] ${at(p)} ${where}（${g.dry[p].replace(/。$/, '')}）：${s}`);
      const d = dryOne(s);
      if (d) out.push(d);
      if (!g.p25[p]) told.add(p);
    }
    return { out, told };
  };
  const whyLine = (p, list) => (!list.some((x) => x.includes(g.dry[p].replace(/。$/, ''))) ? [g.dry[p]] : []);
  for (const u of units) {
    const before = unitGet(u);
    const r = ruleW(before, u.palaceOf, u.advice, unitTag(u));
    for (const p of r.told) r.out.push(...whyLine(p, r.out));
    const t = r.out.join('');
    if (!apply || t === before) continue;
    const p = u.it.palace;
    unitSet(u, t || (p && g.p25[p] ? empty25(p) : (u.field === 'text' ? '這一方的做法見化解清單。' : '')));
  }
  for (const e of report.remedies || []) {
    for (const p of remPalaces(e)) {
      if (!g.dry[p]) continue;
      const pof = () => p;
      const where = `化解「${e.problem}」`;
      const m = ruleW(e.method, pof, null, `${where}.method`);
      const its = (e.items || []).map((x) => ruleW(x, pof, null, `${where}.items`));
      const told = new Set([...m.told, ...its.flatMap((x) => [...x.told])]);
      const waterAct = positiveHit(String(e.action || ''), WATER_PUT_RE);
      if (waterAct) viol.push(`[Z2 不放水] ${at(p)} ${where}.action：${e.action}`);
      if (!apply) continue;
      const items = its.map((x) => x.out.join('')).filter(Boolean);
      for (const q of told) items.push(...whyLine(q, [m.out.join(''), ...items]));
      e.method = m.out.join('') || (g.p25[p] ? `這一方有${g.names[p]}，只用金洩，宜靜不宜動。` : (items.shift() || g.dry[p]));
      e.items = uniq(items).filter((x) => bare(x) !== bare(e.method));
      // 動作叫人放水 → 交給規則 3 另挑
      if (waterAct) e.action = '';
    }
  }
  // 三優三注意多半是現況（「旺向星見水」是屋外已經有水），只看裡面的建議句（宜、可以…）
  const hl = report.highlights || {};
  for (const key of ['good', 'bad']) {
    (hl[key] || []).forEach((t, i) => {
      const p = dirPalaceOf(t);
      if (!p || !g.p25[p] || !ADVICE_RE.test(t) || !forbid25(t)) return;
      viol.push(`[規則1 二五宜靜] ${at(p)} 三優三注意：${t}`);
      if (!apply) return;
      const kept = String(t).split('，').filter((c) => !forbid25(c)).join('，');
      hl[key][i] = `${kept || `${dirOf(p)}・`}${calm25Note(g.cells, p, g.cur)}`;
    });
  }

  /* ---- 規則 2：同宮不互剋（化解清單最重的為準）；X5：家族層級（肯定對上別條的否定也算），不指向自己 ---- */
  const K = {};
  const kOf = (p) => K[p] || (K[p] = {
    fams: new Map(g.p25[p] ? [['金', D4_SRC]] : []), negFams: new Map(), pos: new Map(), neg: new Map(), negMetal: null,
  });
  const metalTerm = (p, w) => g.p25[p] && METAL_TERMS.includes(w);
  // X5：二五宮的金照舊豁免（只用金，否定金的句子規則 1 已經拿掉）
  const metalFam = (p, f) => g.p25[p] && f === '金';
  // X5：不指向自己——同一段同一項（key 相同）、或段落那一條就是化解清單這一條的來源（同一個問題），都不算「別條」
  const normLabel = (s) => String(s || '').replace(/（看法不同）/g, '').replace(/｜/g, '').trim();
  const other = (from, src) => !!from && from.key !== src.key
    && !(from.origins && src.kind === 'section' && from.origins.has(normLabel(src.label)));
  const clashOf = (s, p, src) => {
    const k = kOf(p);
    const fams = familiesOf(s);
    for (const f of fams) {
      for (const [kf, from] of k.fams) if (other(from, src) && (KE[kf] === f || KE[f] === kf)) return { from, why: `${f}與${kf}相剋`, fam: f };
    }
    // X5：肯定的家族對上同宮別條的否定家族（「少用紅色」對「暖色燈」）
    for (const f of fams) {
      if (metalFam(p, f)) continue;
      const from = k.negFams.get(f);
      if (other(from, src)) return { from, why: `一邊少用${f}、一邊用${f}`, fam: f };
    }
    for (const f of negFamiliesOf(s)) {
      if (metalFam(p, f)) continue;
      const from = k.fams.get(f);
      if (other(from, src)) return { from, why: `一邊用${f}、一邊少用${f}`, fam: null };
    }
    const tm = termsOf(s);
    for (const w of tm.pos) {
      const from = k.neg.get(w);
      if (other(from, src)) return { from, why: `一邊少用${w}、一邊用${w}`, fam: familyOfTerm(w) };
    }
    for (const w of tm.neg) {
      if (metalTerm(p, w)) continue;
      const from = k.pos.get(w);
      if (other(from, src)) return { from, why: `一邊用${w}、一邊少用${w}`, fam: null };
    }
    // 「不用金屬硬剋」對上別條「放銅葫蘆」也算一邊少用、一邊用（二五宮只用金，否定金的句子規則 1 已經拿掉）
    if (!g.p25[p]) {
      const fm = k.fams.get('金');
      if (other(fm, src) && negMetal(s)) return { from: fm, why: '一邊用金屬、一邊少用金屬', fam: null };
      if (other(k.negMetal, src) && fams.includes('金')) return { from: k.negMetal, why: '一邊少用金屬、一邊用金屬', fam: '金' };
    }
    return null;
  };
  const keepIn = (s, p, src) => {
    const k = kOf(p);
    for (const f of familiesOf(s)) if (!k.fams.has(f)) k.fams.set(f, src);
    for (const f of negFamiliesOf(s)) if (!metalFam(p, f) && !k.negFams.has(f)) k.negFams.set(f, src);
    const tm = termsOf(s);
    for (const w of tm.pos) if (!k.pos.has(w)) k.pos.set(w, src);
    for (const w of tm.neg) if (!metalTerm(p, w) && !k.neg.has(w)) k.neg.set(w, src);
    if (!g.p25[p] && !k.negMetal && negMetal(s)) k.negMetal = src;
  };
  const actionBad = new Set();
  const srcOf = new Map();
  (report.remedies || []).forEach((e, ei) => {
    if (!e.palace) return;
    const p = e.palace;
    const src = {
      kind: 'remedy', key: `remedy|${ei}`, label: (Array.isArray(e.problems) && e.problems[0]) || String(e.problem).split('、')[0],
      // 只看這一條本來的問題（第一個）；併進來的別條問題不算同一條（它們的做法是因為相剋才被拿掉的）
      origins: new Set([normLabel((Array.isArray(e.problems) && e.problems[0]) || e.problem)]),
    };
    srcOf.set(e, src);
    const where = `化解「${e.problem}」`;
    const droppedFams = new Set();
    const mKeep = [];
    for (const s of sentences(e.method)) {
      const c = skip(s) ? null : clashOf(s, p, src);
      if (c) {
        viol.push(`[規則2 同宮互剋] ${at(p)} ${where}.method（${c.why}，對「${c.from.label}」）：${s}`);
        if (c.fam) droppedFams.add(c.fam);
        continue;
      }
      mKeep.push(s);
    }
    let iKeep = [];
    for (const x of e.items || []) {
      const c = skip(x) ? null : clashOf(x, p, src);
      if (c) {
        viol.push(`[規則2 同宮互剋] ${at(p)} ${where}.items（${c.why}，對「${c.from.label}」）：${x}`);
        if (c.fam) droppedFams.add(c.fam);
        continue;
      }
      iKeep.push(x);
    }
    // X5：刪掉某五行的做法之後，跟著它的殘句（常換水）一起刪
    if (droppedFams.size) {
      const residue = (x) => [...droppedFams].some((f) => RESIDUE_RE[f] && RESIDUE_RE[f].test(x) && !familiesOf(x).length);
      const before = iKeep.length;
      iKeep = iKeep.filter((x) => !residue(x) && !PRINCIPLE_ONLY_RE.test(String(x).trim()));
      if (iKeep.length !== before) viol.push(`[規則2 同宮互剋] ${at(p)} ${where}.items（刪掉${[...droppedFams].join('、')}的做法後留下殘句）`);
    }
    for (const s of [...mKeep, ...iKeep]) if (!skip(s)) keepIn(s, p, src);
    for (const s of e.avoid || []) {
      for (const w of termsOf(s).neg) if (!metalTerm(p, w) && !kOf(p).neg.has(w)) kOf(p).neg.set(w, src);
      for (const f of negFamiliesOf(s)) if (!metalFam(p, f) && !kOf(p).negFams.has(f)) kOf(p).negFams.set(f, src);
      if (!g.p25[p] && !kOf(p).negMetal && negMetal(s)) kOf(p).negMetal = src;
    }
    const ac = e.action ? clashOf(e.action, p, src) : null;
    if (ac) {
      viol.push(`[規則2 同宮互剋] ${at(p)} ${where}.action（${ac.why}，對「${ac.from.label}」）：${e.action}`);
      actionBad.add(e);
    } else if (e.action) keepIn(e.action, p, src);
    if (!apply) return;
    if (mKeep.length !== sentences(e.method).length || iKeep.length !== (e.items || []).length) {
      // 拿掉之後只剩系統說明（或什麼都不剩）：做法改成「先照那一條處理」，動作給一句不相剋的靜態做法
      const real = [...mKeep, ...iKeep].filter((s) => !skip(s) && concreteOf(s));
      if (!real.length) {
        e.method = g.p25[p] ? `這一方有${g.names[p]}，只用金洩，宜靜不宜動。` : '這一項的做法跟同一方位較重要的化解相剋，先照那一條處理。';
        e.items = [...mKeep, ...iKeep].filter((s) => bare(s) !== bare(e.method));
        // Z1：查表的那一句（altAction）不相剋就用它，不然用通用的靜態做法
        const alt = e.altAction && !clashOf(e.altAction, p, src) && !actionProblem(e.altAction) ? e.altAction : '';
        e.action = alt || (g.p25[p] ? METAL_ACTION : '這一方保持整潔安靜');
        e.actionFrom = alt || g.p25[p] ? 'table' : 'generic';
        e.concrete = !!(alt || g.p25[p]);
        actionBad.delete(e);
        return;
      }
      e.method = mKeep.join('') || (iKeep.length ? endDot(iKeep.shift()) : `${g.p25[p] ? `這一方有${g.names[p]}，只用金洩，宜靜不宜動。` : '依下面的做法調整。'}`);
      e.items = iKeep;
    }
  });
  const ordered = [...units].sort((a, b) => a.order - b.order || a.delta - b.delta || a.idx - b.idx);
  for (const u of ordered) {
    // X5：同一條（同段同一項）的 fix、本文、建議互相不算「別條」
    const src = { kind: 'section', key: `${u.sec}|${u.idx}`, label: u.label, sec: u.sec };
    const text = unitGet(u);
    const out = [];
    const dropped = new Map();
    const keptN = new Map();
    for (const s of sentences(text)) {
      const p = u.palaceOf(s);
      if (!p || skip(s) || (u.advice && !u.advice.test(s))) { out.push(s); continue; }
      const c = clashOf(s, p, src);
      if (c) {
        viol.push(`[規則2 同宮互剋] ${at(p)} ${unitTag(u)}（${c.why}，對「${c.from.label}」）：${s}`);
        if (!dropped.has(p)) dropped.set(p, c);
        // 只拿掉相剋的那幾段（「七赤是破軍星，…，宜用靜水洩」留前面的說明）；跟在後面的「以免…」一起拿掉
        // X5：同一句裡跟著那個五行做法的原理句（「X屬金」）與殘句（「常換水」）也一起拿掉
        const dot = /。$/.test(s);
        const cls = clausesOf(s.replace(/。$/, ''));
        const fams = new Set();
        const hitC = cls.map((x) => {
          const cc = clashOf(x, p, src);
          if (cc && cc.fam) fams.add(cc.fam);
          return !!cc;
        });
        if (c.fam) fams.add(c.fam);
        let prevDrop = false;
        const rest = cls.filter((x, i) => {
          const residue = [...fams].some((f) => RESIDUE_RE[f] && RESIDUE_RE[f].test(x) && !familiesOf(x).length);
          const principle = PRINCIPLE_ONLY_RE.test(x.trim());
          const drop = hitC[i] || residue || principle || (prevDrop && /^(以免|免得|否則|才能|才不會)/.test(x));
          prevDrop = drop;
          return !drop;
        }).join('')
          .replace(/^[，；\s]+/, '').replace(/[，；、\s]+$/, '').replace(/^(並|或|也|再|以及)/, '');
        if (rest && rest.length < s.length && (VERB_RE.test(rest) || /是|主|要/.test(rest)) && !PRINCIPLE_ONLY_RE.test(rest)) {
          const t = dot ? endDot(rest) : rest;
          out.push(t);
          if (!u.advice || u.advice.test(t)) { keepIn(t, p, src); keptN.set(p, (keptN.get(p) || 0) + 1); }
        }
        continue;
      }
      keepIn(s, p, src);
      keptN.set(p, (keptN.get(p) || 0) + 1);
      out.push(s);
    }
    if (apply && dropped.size) {
      for (const [p, c] of dropped) out.push(gateTell(c, (keptN.get(p) || 0) > 0, g, p));
      unitSet(u, out.join(''));
    }
  }
  // A6：放水的那一句被拿掉之後，「先見水、水外有山」那一句也不留（沒有要放的水）
  if (apply) {
    for (const u of units) {
      const tx = unitGet(u);
      if (!tx.includes(BOTH_WATER)) continue;
      if (sentences(tx).some((s) => s !== BOTH_WATER && waterPut(s))) continue;
      unitSet(u, tx.split(BOTH_WATER).join(''));
    }
  }

  /* ---- 規則 3：化解清單的動作能照做（也重新確認規則 1、2） ---- */
  for (const e of report.remedies || []) {
    const p = e.palace;
    const self = srcOf.get(e) || null;
    // 規則 1（二五、厚重）與規則 3（時、條件子句、名詞片段）；clash＝跟同宮較重的化解相剋
    const why = (a) => {
      const pr = actionProblem(a);
      if (pr) return pr;
      if (p && g.p25[p] && forbid25(a)) return '二五宮叫人用土火木水或動';
      if (p && g.p25[p] && needsBuildNote(a, g.note[p])) return '施工沒有補動土提醒';
      if (p === '中' && g.prison && positiveHit(a, HEAVY_RE)) return '入囚中宮放厚重金屬';
      // Z2：不能放水的宮，動作不叫人放水
      if (p && g.dry[p] && positiveHit(a, WATER_PUT_RE)) return '不能放水的宮叫人放水';
      return '';
    };
    const clash = (a) => !!(p && self && clashOf(a, p, self));
    const w0 = actionBad.has(e) ? '跟同宮較重的化解相剋' : why(e.action);
    if (!w0) continue;
    if (!actionBad.has(e)) viol.push(`[規則3 動作可照做] ${at(p)} 化解「${e.problem}」.action（${w0}）：${e.action}`);
    if (!apply) continue;
    // Z1：退路挑的動作一律要以白名單動詞開頭（leadOk）
    // A4：同宮別條否定的五行、要收斂火氣的宮，退路也不挑那一行（跟化解清單排動作時同一把尺）
    const avoidF = new Set();
    if (p && !g.p25[p]) {
      for (const o of report.remedies || []) {
        if (o === e || o.palace !== p) continue;
        for (const t of [o.method, ...(o.items || []), ...(o.avoid || []), o.action]) for (const f of negFamiliesOf(t)) avoidF.add(f);
      }
      if (fireQuiet(report, p, e.rules || [])) avoidF.add('火');
    }
    const famOk = (a) => !familiesOf(a).some((f) => avoidF.has(f));
    // A9：大門那一條不收灶口、床頭的句子
    const cands = uniq([...(e.items || []), e.method].map(concreteOf).filter(Boolean))
      .filter((a) => leadOk(a) && !/^原位/.test(a) && !/^(不|少|別|勿)/.test(a) && !clash(a)
        && !(p && g.dry[p] && positiveHit(a, WATER_PUT_RE)) && !offTopic(e.rules, a) && famOk(a));
    // Z1：查表的那一句（規則自帶的動作壞掉或相剋時的備案）先試
    const alt = e.altAction && !why(e.altAction) && !clash(e.altAction) && famOk(e.altAction) && !(p && g.p25[p] && constructHit(e.altAction)) ? e.altAction : '';
    // 二五宮先挑不用動工的；都要動工就補提醒（X4：流年與山向星都有二五用合併註記）
    let pick = alt || cands.find((a) => !why(a) && !(p && g.p25[p] && constructHit(a)));
    if (!pick) {
      const b = cands.find((a) => !actionProblem(a) && !(p && g.p25[p] && forbid25(a)) && !(p === '中' && g.prison && positiveHit(a, HEAVY_RE)));
      if (b) pick = p && g.p25[p] && needsBuildNote(b, g.note[p]) ? withBuildNote(b, g.note[p]) : b;
    }
    if (!pick && p && g.p25[p]) pick = METAL_ACTION;
    if (pick) {
      e.action = pick;
      e.concrete = true;
      e.actionFrom = pick === METAL_ACTION || pick === alt ? 'table' : 'fallback';
    } else {
      // Z1：挑不到就用通用動作（不從做法那一句硬抽）
      e.action = genericAction(p, e.wx, report, e.rules);
      e.concrete = false;
      e.actionFrom = 'generic';
    }
  }

  /* ---- L3：二五宮評吉的床位不寫推薦句、要標看法不同，不跟「不宜久睡」並存；L6：同一條同一句只留一次 ---- */
  viol.push(...bed25Walk(report, apply), ...dupWalk(report, apply));
  return viol;
}

/** LINE 文字的檢查（化解重點的動作、二五宮、入囚那一行） */
function lineAudit(report, g) {
  const v = [];
  const raw = String(report.lineText || '').split('\n');
  const lines = [];
  for (const l of raw) {
    if (l.startsWith('　') && lines.length) lines[lines.length - 1] += l.slice(1);
    else lines.push(l);
  }
  const plain = (l) => LINE_GLOSS_NOTES.reduce((s, n) => s.split(n).join(''), l);
  let inFix = false;
  let inGood = false;
  let inBad = false;
  const fixAt = [];
  const goodAt = [];
  const badAt = [];
  for (const l0 of lines) {
    if (l0 === '化解重點：') { inFix = true; continue; }
    if (l0 === '三個優點：') { inGood = true; continue; }
    if (l0 === '三個要注意：') { inBad = true; continue; }
    if (l0 === '') { inFix = false; inGood = false; inBad = false; continue; }
    const l = plain(l0);
    if (/入囚/.test(l) && g.p25.中 && positiveHit(l, /明亮|有水/)) v.push(`[規則1 二五宜靜] LINE 入囚那一行：${l0}`);
    if (!/^[①②③④⑤⑥]/.test(l)) continue;
    const p = dirPalaceOf(l);
    if (inFix) {
      const act = l.split(' → ')[1] || '';
      const why = actionProblem(act.replace(/（看法不同）$/, ''));
      if (why) v.push(`[規則3 動作可照做] LINE（${why}）：${l0}`);
      // Z2：不能放水的宮，化解重點不叫人放水
      if (p && g.dry[p] && positiveHit(act, WATER_PUT_RE)) v.push(`[Z2 不放水] LINE ${dirOf(p)}（${g.dry[p].replace(/。$/, '')}）：${l0}`);
      if (p && g.p25[p] && forbid25(act)) v.push(`[規則1 二五宜靜] LINE ${dirOf(p)}：${l0}`);
      if (p && g.p25[p] && needsBuildNote(act, g.note[p])) v.push(`[規則1 動土提醒] LINE ${dirOf(p)}：${l0}`);
      // X1：化解重點的動作講到換房、移床，目標也要在名單裡
      for (const b of badMoves(act, report, { from: p })) v.push(`[X1 移動目標] LINE ${b.kind} 移到 ${b.palace} 不在名單：${l0}`);
      // X2：二五宮的化解重點要是併好的那一條（「此宮有…」）
      if (p && g.p25[p]) {
        const head = (l.split(' → ')[0] || '').replace(/^[①②③④⑤⑥]?[^・]*・/, '');
        if (!/^此宮有/.test(head)) v.push(`[X2 二五宮合併] LINE ${dirOf(p)} 的化解重點不是「此宮有…」那一條：${l0}`);
      }
      if (p) fixAt.push({ p, l0 });
    } else {
      if (p && g.p25[p] && ADVICE_RE.test(l) && forbid25(l)) v.push(`[規則1 二五宜靜] LINE 三優三注意 ${dirOf(p)}：${l0}`);
      if (inGood && p) goodAt.push({ p, l0 });
      if (inBad && p) badAt.push({ p, l0 });
    }
  }
  // X3：化解重點與三優同一宮、或內局外局有看法不同的條目 → 兩行都要標「看法不同」
  const differ = differPalaces(report);
  for (const { p, l0 } of fixAt) {
    if ((goodAt.some((x) => x.p === p) || differ.has(p)) && !l0.includes('看法不同')) v.push(`[X3 看法不同] LINE 化解重點 ${dirOf(p)} 沒標看法不同：${l0}`);
  }
  for (const { p, l0 } of goodAt) {
    if ((fixAt.some((x) => x.p === p) || differ.has(p)) && !l0.includes('看法不同')) v.push(`[X3 看法不同] LINE 三優 ${dirOf(p)} 沒標看法不同：${l0}`);
  }
  // Z7：三注意同一宮在三優、標了看法不同的化解重點、或看法不同清單裡 → 也要標
  for (const { p, l0 } of badAt) {
    const hit = goodAt.some((x) => x.p === p) || differ.has(p) || fixAt.some((x) => x.p === p && x.l0.includes('看法不同'));
    if (hit && !l0.includes('看法不同')) v.push(`[Z7 看法不同] LINE 三注意 ${dirOf(p)} 沒標看法不同：${l0}`);
  }
  // X2：二五宮的化解清單只有一條「此宮有…」（跟倒騎龍看法相反的那幾條另列）
  for (const p of ALL_PALACES) {
    if (!g.p25[p]) continue;
    const es = (report.remedies || []).filter((e) => e.palace === p && !e.conflict);
    if (es.length > 1) v.push(`[X2 二五宮合併] ${dirOf(p)} 有 ${es.length} 條化解：${es.map((e) => e.problem).join('｜')}`);
    for (const e of es) if (!/^此宮有/.test(String(e.problem))) v.push(`[X2 二五宮合併] ${dirOf(p)} 的化解標題不是「此宮有…」：${e.problem}`);
  }
  return v;
}

/**
 * Z4：同一人同一宮不能同時「對調／換到」與「不建議移床」。看：居住者段（那個人床位那一條）、八宅段主臥（戶主）、
 * 化解清單（居住者那幾條、主臥那一條）、內局臥室類（睡在那一宮的人）。回違規字串陣列。
 */
function bedAudit(report) {
  const v = [];
  const cells = report.cells || {};
  const pp = (report.people && Array.isArray(report.people.people)) ? report.people.people : [];
  const owner = pp.find((x) => x && x.isOwner) || null;
  const masterP = ALL_PALACES.find((p) => cells[p] && Array.isArray(cells[p].rooms) && cells[p].rooms.includes('主臥')) || null;
  const sleepers = (p) => pp.filter((x) => x && x.bed && x.bed.palace === p);
  const says = new Map();
  const moveSay = (s) => /對調/.test(s) || moveMentions(s).some((m) => m.kind === 'bed' || m.kind === 'master');
  const put = (label, p, text, where) => {
    if (!label || !p || !text) return;
    const k = `${label}|${p}`;
    const o = says.get(k) || { label, p, move: [], no: [] };
    for (const s of sentences(text)) {
      if (NO_MOVE_SAY_RE.test(s)) o.no.push(`${where}：${s}`);
      else if (moveSay(s)) o.move.push(`${where}：${s}`);
    }
    says.set(k, o);
  };
  for (const sec of report.sections || []) {
    for (const it of sec.items || []) {
      if (!it.palace || !PALACES.includes(it.palace)) continue;
      const body = `${it.fix || ''}`;
      if (sec.id === 'people' && /^床位/.test(String(it.title).split('｜').slice(1).join('｜'))) {
        put(String(it.title).split('｜')[0], it.palace, body, `居住者「${it.title}」`);
      } else if (sec.id === 'bazhai' && /^主臥在/.test(String(it.title)) && owner && it.palace === masterP) {
        put(owner.label, it.palace, body, `八宅「${it.title}」`);
      } else if (sec.id === 'interior' && /^bedroom-/.test(String(it.rule || ''))) {
        for (const x of sleepers(it.palace)) put(x.label, it.palace, body, `內局「${it.title}」`);
      }
    }
  }
  for (const e of report.remedies || []) {
    if (!e.palace || !PALACES.includes(e.palace)) continue;
    const body = [e.method, ...(e.items || []), e.action].join('');
    if (e.who) put(e.who, e.palace, body, `化解「${e.problem}」`);
    else if (Array.isArray(e.rules) && e.rules.includes('master') && owner && !e.merged25) put(owner.label, e.palace, body, `化解「${e.problem}」`);
  }
  for (const o of says.values()) {
    if (o.move.length && o.no.length) v.push(`[Z4 床位一致] ${o.label} ${dirOf(o.p)}：一邊「${o.move[0]}」、一邊「${o.no[0]}」`);
  }
  return v;
}

/**
 * A2：「主臥與 X 方（Y宮）的 Z 對調」——兩邊都要合格：主臥搬到 X 方（targetBlock('master')，那間臥室先拿掉），
 * X 方那間的人搬進主臥原宮（swapBackBlock：kidBad、二五含流年、九宮凶、山星死煞、那個人的個人凶方）。
 * 看各段落、化解清單與 LINE。回違規字串陣列。
 */
const SWAP_RE = /主臥與(東北|東南|西北|西南|東|西|南|北)方(?:（[坎艮震巽離坤兌乾]宮）)?的(臥室|小孩房|長輩房)對調/g;
function swapAudit(report) {
  const v = [];
  const env = targetEnv(report);
  const from = ALL_PALACES.find((p) => env.rooms[p] && env.rooms[p].includes('主臥')) || null;
  const texts = [];
  for (const sec of report.sections || []) for (const it of sec.items || []) texts.push([`${SECTION_TITLES[sec.id] || sec.id}「${it.title}」`, `${it.text || ''}${it.fix || ''}`]);
  for (const e of report.remedies || []) texts.push([`化解「${e.problem}」`, [e.method, ...(e.items || []), e.action].join('。')]);
  texts.push(['LINE', String(report.lineText || '').replace(/\n　/g, '')]);
  const seen = new Set();
  for (const [where, t] of texts) {
    for (const m of String(t).matchAll(SWAP_RE)) {
      const p = DIR_TO_PALACE[m[1]];
      const k = `${p}|${m[2]}`;
      if (seen.has(k)) continue;
      let why = '';
      if (!from) why = '沒有主臥';
      else {
        const rs = env.rooms[p] || [];
        const env2 = { ...env, rooms: { ...env.rooms, [p]: rs.filter((x) => !BED_ROOMS.includes(x)) } };
        const fw = targetBlock('master', p, env2, { from });
        const bw = swapBackBlock(env, from, p, m[2]);
        why = fw ? `主臥搬到${dirOf(p)}不合格（${fw}）` : bw ? `${dirOf(p)}的人搬進主臥原宮不合格（${bw}）` : '';
      }
      if (why) { seen.add(k); v.push(`[A2 對調] ${where}：${m[0]}（${why}）`); }
    }
  }
  return v;
}

/**
 * A3：居住者段與內局段，同一個人同一宮不能一吉一凶——居住者段那個人床位那一條（吉／凶／看法不同）對上
 * 內局那一宮臥室類的游年那一條（bedroom-younian-*，主臥不在這裡算）。回違規字串陣列。
 */
function sleeperAudit(report) {
  const v = [];
  const pp = (report.people && Array.isArray(report.people.people)) ? report.people.people : [];
  const peopleSec = (report.sections || []).find((s) => s.id === 'people');
  const interiorSec = (report.sections || []).find((s) => s.id === 'interior');
  if (!peopleSec || !interiorSec) return v;
  for (const x of pp) {
    const p = x && x.bed ? x.bed.palace : null;
    if (!PALACES.includes(p)) continue;
    const pit = peopleSec.items.find((it) => it.palace === p && String(it.title).startsWith(`${x.label}｜床位`));
    if (!pit || !['吉', '凶'].includes(pit.level)) continue;
    for (const it of interiorSec.items) {
      if (it.palace !== p || !/^bedroom-younian/.test(String(it.rule || '')) || it.room === '主臥') continue;
      if ((pit.level === '吉' && it.level === '凶') || (pit.level === '凶' && it.level === '吉')) {
        v.push(`[A3 居住者與內局] ${x.label} ${dirOf(p)}：居住者段「${pit.title}」${pit.level}、內局「${it.title}」${it.level}`);
      }
    }
  }
  return v;
}

/* ---- L1～L6 的檢查（auditReport 用；L3、L6 在閘門裡也會改寫） ---- */

/** LINE 化解重點那幾行（續行併回去） */
function lineFixLines(report) {
  return lineBlockLines(report, '化解重點：');
}
/** LINE 某一段（「三個優點：」「三個要注意：」「化解重點：」）的條列行，續行併回去 */
function lineBlockLines(report, header) {
  const out = [];
  let on = false;
  for (const l of String(report.lineText || '').split('\n')) {
    if (l === header) { on = true; continue; }
    if (l === '') on = false;
    if (!on) continue;
    if (/^[①②③④⑤⑥]/.test(l)) out.push(l);
    else if (l.startsWith('　') && out.length) out[out.length - 1] += l.slice(1);
  }
  return out;
}
/**
 * F2：畫面的三優三注意（highlights.marked）跟 LINE 那兩段逐條一致：條數相同、每一條有沒有「看法不同」相同，
 * 拿掉「看法不同」之後跟 highlights 原本那一條是同一件事。
 */
function markAudit(report) {
  const v = [];
  const hl = (report && report.highlights) || {};
  const mk = hl.marked;
  if (!mk || !Array.isArray(mk.good) || !Array.isArray(mk.bad)) {
    if ((hl.good || []).length || (hl.bad || []).length) v.push('[F2 看法不同標記] 沒有 highlights.marked（畫面用的標記版）');
    return v;
  }
  const strip = (s) => String(s || '').replace(/（看法不同）$/, '').replace(/，看法不同）$/, '）');
  for (const [key, header, name] of [['good', '三個優點：', '三優'], ['bad', '三個要注意：', '三注意']]) {
    const lines = lineBlockLines(report, header);
    const list = mk[key];
    if (lines.length !== list.length) v.push(`[F2 看法不同標記] ${name}畫面 ${list.length} 條、LINE ${lines.length} 條`);
    list.forEach((t, i) => {
      const l = lines[i] || '';
      if (/看法不同/.test(t) !== /看法不同/.test(l)) v.push(`[F2 看法不同標記] ${name}第 ${i + 1} 條畫面「${t}」與 LINE「${l}」標記不一致`);
      const raw = (hl[key] || [])[i];
      if (raw !== undefined && strip(t) !== strip(raw)) v.push(`[F2 看法不同標記] ${name}第 ${i + 1} 條標記版「${t}」跟原本「${raw}」不是同一條`);
    });
  }
  return v;
}

/** 逗號切子句，括號裡的逗號不切 */
function parenClauses(s) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (const ch of String(s || '')) {
    if (ch === '（') depth++;
    else if (ch === '）' && depth > 0) depth--;
    buf += ch;
    if (depth === 0 && (ch === '，' || ch === '；')) { out.push(buf); buf = ''; }
  }
  if (buf) out.push(buf);
  return out;
}
// L1：爐灶移位的說法（「把爐具移到…」「爐具移到凶方（…）」）；「移離房屋中心」「不屬西北宮的位置」不算點名
const STOVE_VERB_RE = /(爐具|爐灶|爐位|灶座)[^，；。（]{0,6}?(移到|搬到|改到|移至)/;
const BARE_DIR_RE = /^(東北|東南|西北|西南|東|西|南|北)$/;
/**
 * L1：一段文字裡的爐灶移位目標。回 [{ palaces:[宮], noted:Set(宮), named, sent }]：
 * noted＝目標後面寫了「今年此方忌動土，明年再做」；named＝有點名方位（「移到游年凶方座落」沒點名）。
 */
function stoveMoves(text) {
  const out = [];
  for (const sent of sentences(text)) {
    for (const cl of parenClauses(sent.replace(/[。！？]$/, ''))) {
      const m = cl.match(STOVE_VERB_RE);
      if (!m) continue;
      const pre = cl.slice(0, m.index);
      if (NEG_RE.test(pre) || NEG_TAIL.test(pre) || /不宜|不要|別|勿/.test(pre)) continue;
      const after = cl.slice(m.index + m[0].length);
      if (/^不屬|^離/.test(after)) continue;
      const ps = [];
      const noted = new Set();
      // F1：目標括號裡（或同一條另起一句）寫了「此方另有火剋金（水火相沖），兩派看法不同」
      const differ = new Set();
      const put = (q, note) => {
        if (!q) return;
        if (!ps.includes(q)) ps.push(q);
        if (note && note.includes(STOVE_YEAR_NOTE)) noted.add(q);
        if (note && STOVE_PALACE_NOTE[q] && note.includes(STOVE_PALACE_NOTE[q])) differ.add(q);
      };
      // 「凶方（西北、西南）」「凶方（西北，今年此方忌動土，明年再做）」
      for (const g of after.matchAll(/凶方（([^）]*)）/g)) {
        const [list, ...rest] = g[1].split('，');
        for (const d of list.split('、')) if (BARE_DIR_RE.test(d)) put(DIR_TO_PALACE[d], rest.join('，'));
      }
      // 「西北方（乾宮，今年此方忌動土，明年再做）」「西北方（乾宮）」「乾宮」
      for (const r of after.matchAll(/(東北|東南|西北|西南|東|西|南|北)方(?:（([^）]*)）)?|([坎艮震巽離坤兌乾])宮/g)) {
        put(r[3] || DIR_TO_PALACE[r[1]], r[2] || '');
      }
      // F1：另起一句的寫法（「西方另有火剋金，兩派看法不同」）也算
      for (const q of ps) {
        const pn = STOVE_PALACE_NOTE[q];
        if (pn && String(text).includes(`${dirOf(q)}${pn.replace(/^此方/, '')}`)) differ.add(q);
      }
      out.push({ palaces: ps, noted, differ, named: ps.length > 0, sent });
    }
  }
  return out;
}
/**
 * L1：爐灶移位目標不得是 stoveBlock 不合格的宮（山向星二五、臥室類或有人睡、大門、神明廳、中宮、廁所；
 * F1 另加當運向星、當運山星、乾宮）；只因流年二五的目標要寫「今年此方忌動土，明年再做」；
 * 兌宮、坎宮的目標要寫「此方另有火剋金（水火相沖），兩派看法不同」；沒點名的「移到游年凶方」也不行。看各段落、化解清單與 LINE。
 */
function stoveAudit(report) {
  const v = [];
  const env = targetEnv(report);
  const texts = [];
  for (const sec of report.sections || []) for (const it of sec.items || []) texts.push([`${SECTION_TITLES[sec.id] || sec.id}「${it.title}」`, `${it.text || ''}${it.fix || ''}`]);
  for (const e of report.remedies || []) texts.push([`化解「${e.problem}」`, [e.method, ...(e.items || []), e.action].join('。')]);
  for (const l of lineFixLines(report)) texts.push([`LINE ${l}`, l.split(' → ')[1] || '']);
  for (const [where, t] of texts) {
    for (const mv of stoveMoves(t)) {
      if (!mv.named) { v.push(`[L1 爐灶移位] ${where} 沒有點名目標宮：${mv.sent}`); continue; }
      for (const q of mv.palaces) {
        const why = stoveBlock(q, env);
        if (why) v.push(`[L1 爐灶移位] ${where} 目標${dirOf(q)}${why}：${mv.sent}`);
        else if (has25(env.cells, q, env.cur) && !mv.noted.has(q)) v.push(`[L1 爐灶移位] ${where} 目標${dirOf(q)}有流年二黑五黃，沒寫今年忌動土：${mv.sent}`);
        if (!why && STOVE_PALACE_NOTE[q] && !(mv.differ && mv.differ.has(q))) {
          v.push(`[F1 爐灶移位] ${where} 目標${dirOf(q)}沒寫「${STOVE_PALACE_NOTE[q]}」：${mv.sent}`);
        }
      }
    }
  }
  return v;
}

/**
 * L2：移床、換房——①同一宮不能同時排給兩間房（原宮不同）；②目標不能是床在原宮的任何一人（主臥另加戶主）的個人凶方。
 * 看八宅段、內局段、居住者段、化解清單與 LINE 化解重點（格局段「臥室宜放在…」這種沒有原宮的不算）。
 */
function moveAudit(report) {
  const v = [];
  const env = targetEnv(report);
  const byTarget = new Map();
  const seen = new Set();
  const check = (from, text, where) => {
    // F4：原宮收中宮（中宮的臥室換房一樣不能搶別間已排的宮）
    if (!ALL_PALACES.includes(from)) return;
    for (const mv of moveMentions(text)) {
      if (mv.kind !== 'bed' && mv.kind !== 'master') continue;
      const sl = sleepersAt(env, from);
      const ppl = mv.kind === 'master' ? uniq([env.owner, ...sl].filter(Boolean)) : sl;
      for (const q of mv.palaces) {
        if (q === from) continue;
        const hurt = ppl.filter((x) => badPalacesOf([x]).includes(q));
        const k = `${from}|${q}|${hurt.map((x) => x.label).join()}`;
        if (hurt.length && !seen.has(k)) {
          seen.add(k);
          v.push(`[L2 同床凶方] ${where}：從${dirOf(from)}移到${dirOf(q)}，是${uniq(hurt.map((x) => x.label)).join('、')}的個人凶方：${mv.sent}`);
        }
        if (!byTarget.has(q)) byTarget.set(q, new Map());
        if (!byTarget.get(q).has(from)) byTarget.get(q).set(from, where);
      }
    }
  };
  for (const sec of report.sections || []) {
    if (!['bazhai', 'interior', 'people'].includes(sec.id)) continue;
    for (const it of sec.items || []) if (it.palace) check(it.palace, `${it.text || ''}${it.fix || ''}`, `${SECTION_TITLES[sec.id]}「${it.title}」`);
  }
  for (const e of report.remedies || []) if (e.palace) check(e.palace, [e.method, ...(e.items || []), e.action].join('。'), `化解「${e.problem}」`);
  for (const l of lineFixLines(report)) {
    const p = dirPalaceOf(l);
    if (p) check(p, l.split(' → ')[1] || '', `LINE ${l}`);
  }
  for (const [q, m] of byTarget) {
    if (m.size > 1) v.push(`[L2 一宮一房] ${dirOf(q)}同時排給${[...m.keys()].map(dirOf).join('、')}的房間：${[...m.values()].join('｜')}`);
  }
  return v;
}

/** L3：評吉的床位、臥室條目（八宅主臥評吉、內局臥室在游年吉方、居住者床位在個人吉方） */
function goodBedItem(secId, it) {
  // F2：二五宮的主臥評吉 level 改「注意」，一樣要過這一條（不寫推薦句、標看法不同）
  if (secId === 'bazhai') return /^主臥在/.test(String(it.title)) && (it.level === '吉' || (it.level === '注意' && /：游年(?:生氣|天醫|延年|伏位)/.test(String(it.title))));
  if (secId === 'interior') return it.rule === 'bedroom-younian-good';
  // 床位那一句「是個人的「X」方，屬吉」（看法不同那一段的「宅卦看…屬吉」不算）
  if (secId === 'people') return /^床位/.test(String(it.title).split('｜').slice(1).join('｜')) && /個人的「[^」]+」方，屬吉/.test(String(it.text));
  return false;
}
/**
 * L3：①二五宮（含流年）評吉的床位、臥室不寫推薦句、要標「看法不同」；②同一宮不能一邊「不宜久坐、久睡」、
 * 一邊評吉的床位沒有標註。apply＝true 時改寫（拿掉推薦句、補「此宮有X，八宅與玄空看法不同」、拿掉久坐久睡）。
 */
function bed25Walk(report, apply) {
  const v = [];
  if (!report || !report.cells || !Array.isArray(report.sections)) return v;
  const cells = report.cells;
  const cur = (report.xuankong && report.xuankong.curPeriod) || (report.compass && report.compass.period) || 9;
  const good = new Map();
  for (const sec of report.sections) {
    if (!['bazhai', 'interior', 'people'].includes(sec.id)) continue;
    for (const it of sec.items || []) {
      const p = it.palace;
      if (!p || !ALL_PALACES.includes(p) || !goodBedItem(sec.id, it)) continue;
      const where = `${SECTION_TITLES[sec.id]}「${it.title}」`;
      if (has25(cells, p, cur)) {
        const rec = REC_BED_RE.test(String(it.text));
        const noted = /看法不同/.test(`${it.title}${it.text}`);
        if (rec || !noted) {
          v.push(`[L3 二五宮床位] ${dirOf(p)} ${where}${rec ? '有推薦句' : '沒標看法不同'}：${it.text}`);
          if (apply) {
            let t = rec ? stripRecBed(it.text, false) : String(it.text);
            if (!/看法不同/.test(`${it.title}${t}`)) t = `${t}此宮有${desc25(cells, p, cur)}，八宅與玄空看法不同。`;
            it.text = t;
          }
        }
      }
      if (!good.has(p)) good.set(p, []);
      good.get(p).push({ where, it });
    }
  }
  // 「不宜久坐、久睡」：同宮有評吉的床位沒標註 → 違規；這一宮有臥室類或有人睡 → 也不寫（改床頭附近放銅葫蘆）
  for (const e of report.remedies || []) {
    const p = e.palace;
    if (!p || !ALL_PALACES.includes(p)) continue;
    const stay = [...(e.avoid || []), e.method, ...(e.items || [])].filter((s) => STAY_RE.test(String(s || '')));
    if (!stay.length) continue;
    const bare0 = (good.get(p) || []).filter((x) => !/看法不同/.test(`${x.it.title}${x.it.text}`));
    const bedHere = bedHereAt(report, p);
    if (!bare0.length && !bedHere) continue;
    if (bare0.length) v.push(`[L3 久睡與吉床] ${dirOf(p)} 化解「${e.problem}」寫「${stay[0]}」，${bare0[0].where}評吉沒有標註`);
    if (bedHere) v.push(`[L3 久睡與臥室] ${dirOf(p)} 有臥室或有人睡，化解「${e.problem}」還寫「${stay[0]}」`);
    if (!apply) continue;
    e.avoid = stripStay(e.avoid || []);
    e.items = stripStay(e.items || []);
    e.method = stripStay([e.method])[0] || e.method;
    if (has25(cells, p, cur) && ![e.method, ...e.items].some((x) => /床頭附近放銅葫蘆/.test(String(x || '')))) e.items = dedupeSimilar([...e.items, BED_25_FIX], e.method);
  }
  return v;
}

/** L6：同一條（段落的本文、怎麼調；化解清單的做法）裡一模一樣的句子只留一次。apply＝true 時改寫 */
function dupWalk(report, apply) {
  const v = [];
  for (const sec of report.sections || []) {
    for (const it of sec.items || []) {
      for (const f of ['text', 'fix']) {
        if (!it[f]) continue;
        const d = dedupeSentences(it[f]);
        if (d === it[f]) continue;
        v.push(`[L6 重複句] ${SECTION_TITLES[sec.id] || sec.id}「${it.title}」.${f}：${it[f]}`);
        if (apply) it[f] = d;
      }
    }
  }
  for (const e of report.remedies || []) {
    const d = dedupeSentences(e.method);
    if (e.method && d !== e.method) {
      v.push(`[L6 重複句] 化解「${e.problem}」.method：${e.method}`);
      if (apply) e.method = d;
    }
  }
  return v;
}

/**
 * X3：內局、外局（含八宅段的主臥看法不同）有「看法不同／看法相反」條目的宮
 * A10：LINE 認得中宮（「向星入囚（…中宮）」）之後，中宮的看法不同也要算
 */
function differPalaces(report) {
  const out = new Set();
  for (const sec of report.sections || []) {
    if (!['interior', 'exterior', 'bazhai'].includes(sec.id)) continue;
    for (const it of sec.items || []) {
      if (it.palace && ALL_PALACES.includes(it.palace) && /看法不同|看法相反/.test(`${it.title || ''}${it.text || ''}`)) out.add(it.palace);
    }
  }
  for (const key of ['interior', 'exterior']) {
    for (const it of (report[key] && report[key].items) || []) {
      if (it && ALL_PALACES.includes(it.palace) && (it.differ === true || it.rule === 'schools-differ')) out.add(it.palace);
    }
  }
  return out;
}

/**
 * G0：一致性閘門（build 的最後跑）。改寫各段落、化解清單、LINE，回傳改了哪些（違規清單）。
 */
export function consistencyGate(report) {
  try {
    // 一次就收斂（測試會用 auditReport 再走一次確認沒有剩下的違規）
    const v = gateWalk(report, true);
    const sec = (report.sections || []).find((s) => s.id === 'remedies');
    if (sec && Array.isArray(report.remedies)) sec.items = remedySectionItems(report.remedies);
    refreshLine(report);
    return v;
  } catch (e) {
    return [];
  }
}

/**
 * G0：用閘門同一套規則檢查一份報告，回傳違規（字串陣列；空陣列＝通過）。不改報告。
 */
export function auditReport(report) {
  try {
    if (!report || typeof report !== 'object' || report.error) return [];
    const copy = JSON.parse(JSON.stringify({ ...report, input: null }));
    const g = gateCtx(copy);
    // A2 對調兩邊都合格、A3 居住者段與內局段不一吉一凶；L1 爐灶移位目標、L2 一宮一房與同床凶方（L3、L6 在 gateWalk 裡）
    // F2：畫面的三優三注意與 LINE 的看法不同標記一致（markAudit）
    return [...gateWalk(copy, false), ...lineAudit(copy, g), ...bedAudit(copy), ...swapAudit(copy), ...sleeperAudit(copy),
      ...stoveAudit(copy), ...moveAudit(copy), ...markAudit(copy)];
  } catch (e) {
    return [`檢查時發生錯誤：${e && e.message ? e.message : e}`];
  }
}

/* ------------------------------------------------------------------ */
/* 7. LINE 純文字                                                        */
/* ------------------------------------------------------------------ */

/** 一行超過 60 字就在逗號處折成兩行 */
function wrapLine(line) {
  const out = [];
  let rest = String(line);
  while (charLen(rest) > LINE_MAX) {
    const chars = [...rest];
    let cut = -1;
    for (let i = Math.min(chars.length - 1, LINE_MAX - 2); i > 8; i--) {
      if (chars[i] === '，' || chars[i] === '、' || chars[i] === '；') { cut = i; break; }
    }
    if (cut < 0) cut = LINE_MAX - 2;
    out.push(chars.slice(0, cut + 1).join(''));
    rest = `　${chars.slice(cut + 1).join('')}`;
  }
  out.push(rest);
  return out;
}

/** LINE 的術語第一次出現時加括號短註（加了會超過 60 字的那一行就跳過，找下一次出現） */
function lineGloss(lines) {
  const out = lines.slice();
  for (const g of LINE_GLOSS) {
    // R15：有沒有加過短註，直接比對短註文字本身
    if (out.some((l) => l.includes(g.note))) continue;
    for (let i = 0; i < out.length; i++) {
      const line = out[i];
      const m = line.match(g.re);
      if (!m) continue;
      const at = glossAt(line, m.index, m.index + m[0].length);
      const next = line.slice(0, at) + g.note + line.slice(at);
      if (charLen(next) > LINE_MAX) continue;
      out[i] = next;
      break;
    }
  }
  return out;
}

/**
 * R15：短註插在哪裡。術語在括號裡（「…未換天心）」）→ 插在括號結束後；
 * 後面緊接著別的括號（「二五交加（山五向二）」）→ 插在那個括號結束後。不會括號套括號。
 */
function glossAt(line, start, end) {
  const before = line.slice(0, start);
  let depth = (before.match(/（/g) || []).length - (before.match(/）/g) || []).length;
  let j = end;
  while (depth > 0 && j < line.length) {
    if (line[j] === '（') depth++;
    else if (line[j] === '）') depth--;
    j++;
  }
  while (line[j] === '（') {
    let d = 0;
    do {
      if (line[j] === '（') d++;
      else if (line[j] === '）') d--;
      j++;
    } while (d > 0 && j < line.length);
  }
  return j;
}

/** LINE 化解重點的動作：最多兩個逗號段，不帶冒號 */
function shortAction(s, max = 32) {
  // R20：「大門位置難改，重點放在化解與補強」是前言，不當動作
  let t = stripPreface(String(s || '')).replace(/[。！？]$/, '').replace(/：/g, '，');
  // T15：括號裡的逗號（「（今年此方忌動土，明年再做）」）不切
  const raw = [];
  let buf = '';
  let depth = 0;
  for (const ch of t) {
    if (ch === '（') depth++;
    else if (ch === '）' && depth > 0) depth--;
    if (ch === '，' && depth === 0) { raw.push(buf); buf = ''; } else buf += ch;
  }
  raw.push(buf);
  const parts = raw.filter((x) => x && !/^(大門位置難改|重點放在)/.test(x));
  // G6：第一段是條件子句（「爐位動不了時」「門被沖時」）就取後一段；整句只有條件子句不當動作
  while (parts.length && COND_END_RE.test(parts[0])) parts.shift();
  if (!parts.length) return '';
  t = parts.slice(0, 2).join('，');
  if (charLen(t) > max) t = parts[0] || '';
  return t;
}

/**
 * G0：LINE 化解重點的動作——依序試 action、細項、做法；縮短之後要能照做（規則 3：不以「時」結尾、
 * 不是條件子句或名詞片段），二五宮不叫人用土火木水、不叫人動（規則 1），要動工的補提醒。都不行回空字串。
 */
function lineActionOf(e, cells, cur, max = 32, src = null) {
  const p = e && e.palace;
  const c25 = !!p && has25(cells || {}, p, cur);
  const note = c25 ? buildNoteOf(cells, p, cur) : NO_BUILD_OWN;
  // Z1：先用化解清單的動作（查表來的）；退路從細項、做法挑的要以白名單動詞開頭
  // A9：大門那一條的退路不收灶口、床頭的句子
  const back = [...(e.items || []).map(concreteOf), concreteOf(e.method || '')].filter((a) => a && ACTION_LEAD_RE.test(a) && !offTopic(e.rules, a));
  const cands = uniq([e.action, ...back]);
  // Z2：這一宮不能放水
  const dry = !!p && !!src && !waterOk(p, src);
  for (const a of cands) {
    if (!a) continue;
    let sa = shortAction(a, max);
    if (!sa || actionProblem(sa)) continue;
    if (p === '中' && positiveHit(sa, HEAVY_RE)) continue;
    if (c25 && forbid25(sa)) continue;
    if (dry && positiveHit(sa, WATER_PUT_RE)) continue;
    // X4：流年與山向星都有二五用合併註記
    if (c25 && needsBuildNote(sa, note)) sa = withBuildNote(sa, note);
    return sa;
  }
  return '';
}

/** 兩字詞（bigram）重疊率：重疊的個數 ÷ 較短那一句的個數 */
function gramOverlap(a, b) {
  const grams = (s) => {
    const t = [...bare(s)];
    const out = new Set();
    for (let i = 0; i < t.length - 1; i++) out.add(t[i] + t[i + 1]);
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.size || !gb.size) return 0;
  let common = 0;
  for (const g of ga) if (gb.has(g)) common++;
  return common / Math.min(ga.size, gb.size);
}

// T13：開頭是同一個房間（「廁所門常關…」「廁所放金屬置物架…」）就算同一類動作
const ROOM_LEAD_RE = /^(廁所|廚房|爐灶|爐具|爐台|主臥|臥室|床頭|大門|門口|門邊|玄關|魚缸|樓梯|電梯|神位|神明)/;

/**
 * R19＋T13：兩個動作是不是在講同一件事——雙字重疊 0.4 以上、開頭是同一個房間，或同樣都是放金屬洩土。
 */
function similarAction(a, b) {
  if (!bare(a) || !bare(b)) return false;
  if (gramOverlap(a, b) >= 0.4) return true;
  const la = (bare(a).match(ROOM_LEAD_RE) || [])[1];
  const lb = (bare(b).match(ROOM_LEAD_RE) || [])[1];
  if (la && la === lb) return true;
  const fa = familiesOf(a);
  const fb = familiesOf(b);
  return fa.length === 1 && fb.length === 1 && fa[0] === '金' && fb[0] === '金';
}

/**
 * T20：化解細項去重——雙字重疊一半以上的兩句只留較完整（較長）的那一句，位置取先出現的；
 * 跟做法（method）那一句相似、又沒有比它完整的，也不重列。只看文字重疊，不用「都是金」那一條（銅葫蘆、六帝錢要並列）。
 */
function dedupeSimilar(items, method = '') {
  const out = [];
  for (const x of items) {
    if (method && gramOverlap(x, method) >= 0.5 && charLen(bare(x)) <= charLen(bare(method))) continue;
    const i = out.findIndex((y) => gramOverlap(x, y) >= 0.5);
    if (i < 0) { out.push(x); continue; }
    if (charLen(bare(x)) > charLen(bare(out[i]))) out[i] = x;
  }
  return out;
}

/**
 * 給 LINE 貼的純文字（不用 markdown）：標題、坐向與元運、格局、總分與五項、未填提醒、三優、三注意、
 * 化解重點 3～5 條（問題 → 做法），最後一行固定「※ 風水分析僅供參考，不作為買賣或投資依據。」
 * 不放出生年、不放人名。每一行不超過 60 字、最多一個冒號。
 * F2：回 { text, good, bad }——good／bad 是 LINE 那兩段標好「看法不同」的三優三注意（不含序號），畫面用同一份。
 */
function lineCompose(report) {
  try {
    const r = report || {};
    const cx = r.compass || {};
    const xk = r.xuankong || {};
    const bz = r.bazhai || {};
    const sc = r.score || { parts: [] };
    const hl = r.highlights || { good: [], bad: [] };
    const SRC_TEXT = { 指定: '手動指定', 入住年: '依入住年起盤', 今年: '暫用今年推算', 預設: '暫以九運計' };

    const head = [];
    head.push('【陽宅堪輿報告】');
    if (cx.fullName) {
      head.push(`坐向：${cx.fullName}（${cx.plain}，${fmtNum(cx.facingDeg)}°${cx.tentative ? '，暫定，請實際量測' : ''}）`);
    }
    if (cx.periodName) {
      const pr = cx.periodRange || {};
      head.push(`元運：${cx.periodName}（${pr.start}–${pr.end}），${SRC_TEXT[cx.periodSource] || ''}`);
    }
    if (xk.changed && xk.curPeriod) {
      head.push(`現已入${CN[xk.curPeriod]}運（盤為${CN[cx.period]}運，未換天心）${xk.buildPattern ? `，入住時是${xk.buildPattern}` : ''}`);
    }
    if (xk.pattern) {
      const ex = [];
      const fy = (xk.active && xk.active.fuyin) || {};
      if (fy.mountain) ex.push(`山盤${fy.mountain}`);
      if (fy.facing) ex.push(`向盤${fy.facing}`);
      if (xk.active && xk.active.heshiAll) ex.push('全局合十');
      if (xk.active && xk.active.sanban) ex.push(xk.active.sanban);
      if (cx.kongwang) ex.push(cx.kongwang);
      const info = xk.patternInfo || {};
      const pat = `${xk.changed ? '現在' : ''}${xk.pattern}（${flatLuck(info.luck)}）`;
      head.push(`玄空：${xk.activeName || ''}盤，${pat}${ex.length ? `，${ex.join('、')}` : ''}`);
    }
    const pz = xk.prison || {};
    if (pz.mountain || pz.facing) {
      const who = [pz.mountain ? '山星' : '', pz.facing ? '向星' : ''].filter(Boolean).join('、');
      const what = pz.facing && pz.mountain ? '人丁與財氣' : pz.facing ? '財氣' : '人丁健康';
      // G4：中宮有二黑五黃時不寫明亮
      const c25 = has25(r.cells || {}, '中', xk.curPeriod || cx.period);
      head.push(`${who}入囚，傳統認為${what}受困，中宮宜開闊${c25 ? '、保持安靜' : '明亮'}`);
    }
    if (xk.daoqilong && DAOQI[xk.daoqilong.pattern]) head.push(DAOQI[xk.daoqilong.pattern].line);
    if (bz.house) {
      const seg = [`${bz.house.gua}宅（${bz.house.group}宅）`];
      if (bz.door) seg.push(`大門游年${bz.door.star}`);
      if (bz.master) seg.push(`主臥游年${bz.master.star}`);
      if (bz.stove) seg.push(`爐灶坐游年${bz.stove.star}`);
      head.push(`八宅：${seg.join('，')}`);
    }
    head.push(`總分：${sc.total} 分，${sc.gradeLabel || sc.grade || ''}`);
    head.push((sc.parts || []).map((p) => `${p.label} ${fmtNum(p.score)}／${p.max}`).join('、'));
    head.push(`${SCORE_NOTE.replace(/。$/, '')}${Number.isInteger(sc.badPalaces) ? `（凶宮 ${sc.badPalaces} 個）` : ''}`);
    const miss = Array.isArray(r.missing) ? r.missing : [];
    const doorFromFacing = r.input && r.input.doorSource === '向宮';
    // G5：大門填在中宮另一種說法，不寫「九宮沒填大門」
    const doorCenter = r.input && r.input.doorSource === '中宮';
    // R21：入住年不是「以中間值計」，另起一行
    const midMiss = miss.filter((x) => x !== '入住年');
    if (midMiss.length) {
      head.push(`※ 未填、以中間值計：${midMiss.join('、')}${doorFromFacing ? '；大門以向宮計' : ''}`);
      if (doorCenter) head.push(`※ ${DOOR_CENTER_NOTE}`);
    } else if (doorFromFacing) head.push('※ 九宮沒填大門，大門以向宮計');
    else if (doorCenter) head.push(`※ ${DOOR_CENTER_NOTE}`);
    if (cx.futureMoveIn) head.push(`※ 入住年比今天晚，請確認；暫以${cx.periodBasis || '入住那一運'}論`);
    if (miss.includes('入住年')) {
      head.push(`※ ${r.periodNote || (cx.periodSource === '預設' ? '入住年未填，元運暫以九運計' : '入住年未填，以今年推算元運')}`);
    }

    // X3：同一宮已是優點、或內局外局有看法不同的條目 → 化解重點與三優那一行都標「看法不同」
    const differ = differPalaces(r);
    const goodP = new Set((hl.good || []).map(dirPalaceOf).filter(Boolean));
    const markDiffer = (t) => {
      const s = String(t);
      if (s.includes('看法不同')) return s;
      return s.endsWith('）') ? `${s.slice(0, -1)}，看法不同）` : `${s}（看法不同）`;
    };
    // F2：三優三注意標好「看法不同」的版本（畫面用同一份：highlights.marked）
    const goodMarked = (fixP) => (hl.good || []).map((t) => {
      const p = dirPalaceOf(t);
      return p && (fixP.has(p) || differ.has(p)) ? markDiffer(t) : String(t);
    });
    // Z7：三注意那一行同宮若在三優、標了看法不同的化解重點、或看法不同清單裡，也標「看法不同」
    const badMarked = (fixDiffer) => (hl.bad || []).map((t) => {
      const p = dirPalaceOf(t);
      return p && (goodP.has(p) || differ.has(p) || fixDiffer.has(p)) ? markDiffer(t) : String(t);
    });
    const goodLines = (list) => ['', '三個優點：', ...(list.length ? list.map((t, i) => `${CIRCLED[i]}${t}`) : ['目前沒有明顯的加分項目。'])];
    const badLines = (list) => ['', '三個要注意：', ...(list.length ? list.map((t, i) => `${CIRCLED[i]}${t}`) : ['目前沒有明顯的扣分項目。'])];

    // 化解重點：最嚴重的 3～5 條（不含居住者那幾條，避免帶到稱呼；不含伏吟反吟這類結構性無解項）
    // R11：跟倒騎龍看法相反的那幾條（e.conflict）不放進 LINE 化解重點
    const entries = (r.remedies || [])
      .filter((e) => e && e.problem && !e.structural && e.concrete !== false && !e.conflict
        && !(Array.isArray(e.sources) && e.sources.includes('people')))
      .map((e) => ({ ...e }))
      .sort((a, b) => (a.delta || 0) - (b.delta || 0));
    const cellsR = r.cells || {};
    const curR = xk.curPeriod || cx.period;
    const fixLines = (n) => {
      const out = [];
      const used = [];
      for (const e of entries) {
        if (out.length >= n) break;
        const p0 = (Array.isArray(e.problems) && e.problems[0]) || String(e.problem).split('、')[0];
        const p = brief(String(p0).replace(/：/g, '，'), e.palace);
        // G0 規則 1、3：動作縮短之後也要能照做、二五宮不叫人動，不行就換下一個做法
        const sa = lineActionOf(e, cellsR, curR, 32, r);
        if (!sa) continue;
        // R19：同一宮、動作相似的只留一條
        if (used.some((u) => u.palace && u.palace === e.palace && similarAction(u.act, sa))) continue;
        used.push({ palace: e.palace, act: sa });
        // X3：這一宮已是優點、或有看法不同的條目 → 行尾補「（看法不同）」
        // F1：動作本身已經寫了「兩派看法不同」（爐灶移到兌坎）就不再補，免得連著兩個括號
        const want = e.palace && (goodP.has(e.palace) || differ.has(e.palace)) && !p.includes('看法不同');
        const tailOf = (a) => (want && !a.includes('看法不同') ? '（看法不同）' : '');
        let line = `${CIRCLED[out.length]}${p} → ${sa}${tailOf(sa)}`;
        if (charLen(line) > LINE_MAX) {
          const s12 = lineActionOf(e, cellsR, curR, 12, r);
          if (s12) line = `${CIRCLED[out.length]}${p} → ${s12}${tailOf(s12)}`;
        }
        out.push({ line, palace: e.palace, differ: line.includes('看法不同') });
      }
      return out;
    };

    const tail = [];
    const yr = xk.year;
    if (yr && yr.board) {
      const p5 = palaceOfStar(yr.board, 5);
      const p2 = palaceOfStar(yr.board, 2);
      tail.push('', `今年（${yr.ganzhi}）流年五黃在${dirOf(p5)}、二黑在${dirOf(p2)}，這兩方宜靜、忌動土。`);
      const sf = yr.sitFace || {};
      if (sf.sitSansha) tail.push(`今年坐${sf.sitMount}山逢三煞（三煞可向不可坐），坐方不宜動土。`);
      if (sf.faceTaisui) tail.push(`今年向${sf.faceMount}山是向太歲（太歲可坐不可向），修造要謹慎。`);
    }

    const compose = (n, extra) => {
      const fx = fixLines(n);
      const fixBlock = fx.length ? ['', '化解重點：', ...fx.map((x) => x.line)] : ['', '化解重點：', '目前沒有需要化解的凶項。'];
      const gm = goodMarked(new Set(fx.map((x) => x.palace).filter(Boolean)));
      const bm = badMarked(new Set(fx.filter((x) => x.differ && x.palace).map((x) => x.palace)));
      const body = lineGloss([...head, ...goodLines(gm), ...badLines(bm), ...fixBlock, ...tail, ...(extra || [])]);
      return { text: [...body.flatMap(wrapLine), '', FINAL_LINE].join('\n'), good: gm, bad: bm };
    };
    let out = compose(5);
    if (out.text.length > 1000) out = compose(4);
    if (out.text.length > 1000) out = compose(3);
    if (out.text.length < 500) {
      out = compose(5, ['', sc.gradeText || '', '分數是依固定規則加減的參考值，不是機率；不同門派的結論可能不同。'].filter((x, i) => i === 0 || x));
    }
    return out;
  } catch (e) {
    return { text: `【陽宅堪輿報告】\n報告文字產生時發生錯誤，請重新產生一次。\n\n${FINAL_LINE}`, good: null, bad: null };
  }
}

/**
 * 給 LINE 貼的純文字（見 lineCompose）。
 */
export function toLineText(report) {
  return lineCompose(report).text;
}

/**
 * F2：畫面的三優三注意跟 LINE 用同一套「看法不同」標記——回 { good:[字串], bad:[字串] }（跟 LINE 那兩段逐條同一句，
 * 不含序號、不含 LINE 的術語短註與折行）。產生不出來時退回 highlights 原本的字串。
 */
export function markedHighlights(report) {
  const hl = (report && report.highlights) || {};
  const c = lineCompose(report);
  return {
    good: Array.isArray(c.good) ? c.good : (hl.good || []).map(String),
    bad: Array.isArray(c.bad) ? c.bad : (hl.bad || []).map(String),
  };
}

/** F2：重產 LINE 文字，同時把三優三注意的標記版放在 highlights.marked（畫面用） */
function refreshLine(report) {
  const c = lineCompose(report);
  report.lineText = c.text;
  if (report.highlights && typeof report.highlights === 'object') {
    const hl = report.highlights;
    report.highlights.marked = {
      good: Array.isArray(c.good) ? c.good : (hl.good || []).map(String),
      bad: Array.isArray(c.bad) ? c.bad : (hl.bad || []).map(String),
    };
  }
}

/**
 * 測試用：文字處理的小工具（只讀，不影響報告）。tests/report.test.mjs 用它鎖住 R3、R4、R12～R15 這幾條字詞規則。
 */
export const TEXT_RULES = Object.freeze({
  familiesOf, clean25, concreteOf, isFragment, joinItems, lineGloss, shortAction, similarAction, stripPreface, termsOf,
  dedupeSimilar, negMetal, periodRangeNear, kbItemsFor,
  // G0／G6：閘門用的判斷（測試鎖字詞規則用）
  forbid25, needsBuildNote, actionProblem, stripLeadCond, withBuildNote, prisonFixOf,
  // X1～X9
  moveMentions, badMoves, fitMoves, negFamiliesOf, constructHit, buildNoteOf, desc25, roomConditional, prisonText,
  differPalaces, NO_BUILD_BOTH, NO_BUILD_YEAR, NO_BUILD_OWN,
  // Z1～Z8
  positiveHit, actionLint, leadOk, ACTION_LEAD_RE, WATER_PUT_RE, waterWhy, dryOne, dryText, schoolsDiffer, noBright, bedAudit,
  actCtx, actionFor, genericAction, lineActionOf,
  // A1～A11
  dirPalaceOf, swapAudit, sleeperAudit, doorViewOf, fireQuiet, maskQuotes, cellLuck, PUT_ITEM_RE,
  // L1～L6
  stoveTargets, stoveBlock, stoveMoves, stoveAudit, moveAudit, dedupeSentences, stripRecBed, stripStay, REC_BED_RE,
  STOVE_YEAR_NOTE, lineFixLines,
  // F1、F2、F4
  STOVE_PALACE_NOTE, markAudit, lineBlockLines, markedHighlights, moveChecked,
  bed25Audit: (r) => bed25Walk(JSON.parse(JSON.stringify({ ...r, input: null })), false),
  dupAudit: (r) => dupWalk(r, false),
});

/* ------------------------------------------------------------------ */
/* 8. 萬一出錯：回傳完整形狀的空報告                                       */
/* ------------------------------------------------------------------ */

function fallbackReport(raw, err) {
  let input = null;
  try { input = normalizeInput(raw, []); } catch (e) { input = null; }
  const msg = err && err.message ? String(err.message) : String(err);
  const sections = SECTION_IDS.map((id) => section(id, [
    mk('注意', '這一段沒有產生', '計算時發生錯誤，這一段暫時無法顯示；請檢查輸入資料後再試一次。'),
  ]));
  const parts = [
    { id: 'xuankong', label: '玄空格局', score: 0, max: 25 },
    { id: 'bazhai', label: '八宅門主灶', score: 0, max: 25 },
    { id: 'interior', label: '內局', score: 0, max: 20 },
    { id: 'exterior', label: '外局', score: 0, max: 20 },
    { id: 'floorPeople', label: '樓層與命宅', score: 0, max: 10 },
  ];
  return {
    input,
    compass: null,
    bazhai: null,
    xuankong: null,
    cells: {},
    interior: null,
    exterior: null,
    floor: null,
    people: null,
    score: { total: 0, max: 100, grade: '無法判斷', gradeLabel: '無法判斷', gradeText: '計算時發生錯誤，請檢查輸入資料。', parts, note: SCORE_NOTE, badPalaces: 0 },
    sections,
    remedies: [],
    highlights: { good: [], bad: [], marked: { good: [], bad: [] } },
    warnings: ['計算時發生錯誤，報告沒有產生完整內容。'],
    missing: [],
    lineText: `【陽宅堪輿報告】\n計算時發生錯誤，請檢查輸入資料後再試一次。\n\n${FINAL_LINE}`,
    periodNote: null,
    error: msg,
  };
}

/* ------------------------------------------------------------------ */
/* 9. 示範資料                                                          */
/* ------------------------------------------------------------------ */

/**
 * 示範資料：向 184°（午兼丁，兼向 → 替卦）、2025 入住（九運）、7 樓／14 樓、戶主 1980 男、配偶 1983 女。
 * 大門朝南，客廳在前，主臥西北、廚房東北、廁所北與西南、書房東、陽台東南、臥室西、餐廳居中。
 * date 留空，由呼叫的人帶今天（例：analyze({ ...DEMO_INPUT, date: { y, m, d } })）。
 */
export const DEMO_INPUT = {
  facingDeg: 184,
  period: null,
  moveInYear: 2025,
  floor: 7,
  totalFloors: 14,
  date: null,
  people: [
    { label: '戶主', year: 1980, month: null, day: null, gender: 'M', bedPalace: null, bedHead: '兌' },
    { label: '配偶', year: 1983, month: null, day: null, gender: 'F', bedPalace: '乾', bedHead: '兌' },
  ],
  rooms: {
    坎: ['廁所'],
    艮: ['廚房'],
    震: ['書房'],
    巽: ['陽台'],
    離: ['大門', '客廳'],
    坤: ['廁所'],
    兌: ['臥室'],
    乾: ['主臥'],
    中: ['餐廳'],
  },
  stoveMouth: '震',
  exterior: {
    坎: ['高樓'],
    艮: ['平直道路'],
    震: ['高樓'],
    巽: ['尖角屋角'],
    離: ['平直道路', '開闊明堂'],
    坤: ['公園綠地'],
    兌: [],
    乾: [],
  },
  options: { bazhaiMode: 'sit', tigua: 'auto', wuTi: 'none' },
};

/** 示範資料的深拷貝，順便帶入日期（畫面按「示範」時用，避免改到 DEMO_INPUT 本身） */
export function demoInput(date = null) {
  const copy = JSON.parse(JSON.stringify(DEMO_INPUT));
  copy.date = date && typeof date === 'object' ? { y: date.y, m: date.m, d: date.d } : null;
  return copy;
}
