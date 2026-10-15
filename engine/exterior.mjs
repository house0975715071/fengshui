// 外局：屋外形勢（四獸）、玄空零神正神、當運山向星、形煞
//
// 依據：
//   形勢（巒頭）—— 《葬書》四靈「玄武垂頭、朱雀翔舞、青龍蜿蜒、白虎馴頫」；
//                   「高一寸為山，低一寸為水」（高樓當山看、道路當虛水看）。
//   理氣（玄空）—— 《沈氏玄空學》「山上龍神不下水，水裡龍神不上山」；
//                   零神正神：正神方（當運數所在）宜山忌水，零神方（正神對宮）宜水忌山。
// 兩派對同一宮結論相反時，兩條都列、各算各的分，另加一條「兩派看法不同」的說明，不選邊。
//
// 分數照 docs/contract.md 第 5.4 節：起始 12，逐條加減，最後收在 0～20。
// 化解（fix）都是傳統作法，用意是減輕影響，寫法一律不打包票。
//
// 10/04 稽核後（合約第 11 節）：
//   D8 龍動虎靜：白虎方有平直道路／高架橋／路沖 −1（baihu-dong，白虎宜靜而見動）；
//      青龍方有平直道路／環抱路／河流水池 +0.5（qinglong-dong，青龍宜動）；
//      大門落在青龍方或白虎方另列一條說明（door-side，不計分）。
//   D4 這一宮的山星、向星（或流年星）有二黑、五黃時，化解只用金：不用土（陶瓷石材）、火（燈火紅色）、
//      木（植物）、流水，並寫「宜靜不宜動」。形煞有 fix25（有二五時的做法）。
//   條件句（「這一宮有當運山星時不宜擺水」這類）一律先依飛星盤判斷，再輸出結論。
//   D9 用「你」；煞名跟外局名稱重複時不再寫「屬於…」。
//
// 10/04 收尾：
//   S3 白虎昂頭：白虎那一條（掛白虎宮）只講右側怎麼靜下來；補青龍的做法另出一條 qinglong-bu
//      （掛青龍宮、delta 0、level 注意），依青龍宮自己的飛星判斷要不要用植栽。白虎宮有二五時白虎那一條只寫金洩與宜靜。
//   S4 四獸一句話：白虎見動已經寫過的高架橋、路沖，形煞那一段不再重複「另見…」。
//   二五宮的做法不寫「保持明亮、加強照明」（燈光屬火）。
//
// 10/04 第二輪：
//   H2 路沖、反弓路不在大門那一方：窗加窗簾少開、床位書桌避開沖射線、傳統可放凸面鏡或石敢當（fixSide）；
//      玄關、屏風、門前矮牆只在大門宮講。二五宮的版本不寫施工、只用金、宜靜（fixSide25、fix25）。
//   H3 二五宮（含流年）輸出的 fix：要動工的句子補「（今年此方忌動土，明年再做）」或「（此方宜靜，動工前先擇日）」，
//      施工字眼與判斷跟內局共用（rooms.mjs 的 tagBuild、noBuildTag）。二五宮的固定做法先寫不動工的，要動工的另起一句。
//
// 10/04 第三輪：
//   Y2 零神見山（lingshen-shi）：這一宮山星生旺（旺氣、生氣）時，fix 改寫「屋內保持通風、不堆雜物，不擺水景」
//      （不寫明亮、動線順暢）；item 標 differ: true、level 注意（零神見山 vs 旺山見山是兩派），分數照扣。
//   Y3 流年與山向星都有二五：註記用 rooms.mjs 的 NO_BUILD_BOTH。
//
// 10/04 第四輪：
//   Q1 每一條會扣分或給建議的 item 另帶 action：一句 15～28 字、能照做的短句（不帶句號），依該宮狀況給對的版本
//      （二五含流年 → 只用金、宜靜、不施工；不宜放水 → 不放水；大門在不在這一方 → 講門或講窗）。
//      形煞的四種版本寫在 EXT_TYPES 的 action／action25／actionSide／actionSide25。
//   Q2 零神見山、旺向見山要不要建議屋內擺水，先問 rooms.mjs 的 waterOk（二五、山星當運、已有廁所而水過旺或水剋火、
//      向星死氣或煞氣，B3）；不行時寫不放水的版本並附理由。ctx 可另帶 rooms（廁所那一條要用；沒帶就不看廁所）。
//   Q4 朱雀逼壓：大門就在朱雀宮才講大門、玄關、門前退縮（二五看向宮＝門宮）；大門不在朱雀宮改寫
//      「向方窗戶保持乾淨、不堆高物遮擋視線，坐著時有開闊感」，不寫玄關、門前退縮（二五看向宮）。
//   Q5 「傳統也會…」這類接在前一句後面的半句，一律改成完整句「傳統做法可在…」。
//
// 10/04 第五輪：
//   B1 雙星同宮（山星、向星都是現運的當運星）：rooms.mjs 的 waterOk 不因山星當運擋水。旺向見山、零神見山落在這種宮
//      （而且可以放水）時，屋外的山正好在水外，屋內這一方可擺小型水景／流水（WX_SHI_BOTH、LS_SHI_BOTH），
//      取「先見水、水外有山」；零神見山仍標 differ、注意，分數照扣。
//   B3 waterOk 的 luck 改看向星死氣煞氣（rooms.mjs），這裡跟著用。
//   B5 ctx.rooms（報告會傳）有坎、離宮的廁所時，零神見山、旺向見山用不放水的版本並寫理由；fix 與 action 共用
//      lsPlan／wxPlan 同一個判斷，不會一邊放水一邊不放。

import { PALACES, PALACE_INFO, PALACE_BY_LUO, palaceAt, palaceShift, norm } from './compass.mjs?v=981ddbf2';
import { STAR_NAMES, qiOf } from './xuankong.mjs?v=981ddbf2';
// H3：二五宮要動工的句子補註，跟內局同一份施工字眼與註記；Q2：能不能放水跟內局同一把尺
import { tagBuild, noBuildTag, waterBlock, ACTION_FALLBACK } from './rooms.mjs?v=981ddbf2';

/**
 * 外局代碼（17 種，順序固定）。
 *   form：實＝當「山」看；真水＝真的有水；虛水＝道路車流；虛＝空曠低平；形煞類為 null。
 *   sha ：形煞的名稱，不是煞就 null。
 *   fix25：（形煞才有）煞所在的宮有二黑、五黃時改用的做法，拿掉植物、陶瓷石材、燈火（D4）。
 *   fixSide／fixSide25：（路沖、反弓路才有，H2）煞不在大門那一方時的做法；fix／fix25 是在大門那一方的。
 *   action／action25／actionSide／actionSide25：（形煞才有，Q1）對應上面四種做法的一句短動作（15～28 字、沒有句號）。
 *   wx  ：五行。高樓取直長為木、山取土、水與道路取水、尖角電塔取火、刀刃取金；
 *         「開闊明堂」取平坦為土、「醫院殯葬」取陰寒為水，這兩個是取象，古籍沒有定論。
 */
export const EXT_TYPES = {
  高樓: {
    label: '高樓', form: '實', sha: null, wx: '木',
    harm: '高樓在風水上當「山」看。在背後是靠山、在左右是護衛，貼近門前則成逼壓。',
    fix: '在門前造成逼壓時，玄關加強照明、門前保持淨空。主要採光改用視野較開的一面。',
  },
  山丘: {
    label: '山丘', form: '實', sha: null, wx: '土',
    harm: '山管人丁。在背後主有靠、住得安穩；太近、太高或山形破碎，則有壓迫與陰濕的問題。',
    fix: '山在屋後或左右多半是助力，不需化解。貼近門前時，門口保持明亮，並做好排水防潮。',
  },
  河流水池: {
    label: '河流／水池', form: '真水', sha: null, wx: '水',
    harm: '水管財。環抱、緩流、清澈的水利聚財；直沖、反弓、湍急或污濁的水，主財來財去。',
    fix: '水落在不利的方位時，那一側的窗加窗簾或霧面貼，少從那裡納氣。屋內同方位不再擺水景。',
  },
  平直道路: {
    label: '平直道路', form: '虛水', sha: null, wx: '水',
    harm: '道路是「虛水」，車流帶動氣。橫過門前、車速平緩主氣順；又快又直則氣散不聚。',
    fix: '臨大馬路可用氣密窗、窗簾和陽台植栽擋噪音與車燈。大門內留玄關，讓氣緩一緩再進屋。',
  },
  環抱路: {
    label: '環抱路', form: '虛水', sha: null, wx: '水',
    harm: '道路彎彎地抱住房子，像腰帶圍身，傳統叫「玉帶環腰」，主聚氣、利財、人和。',
    fix: '屬吉的形勢，不需化解。面向環抱路的門窗保持明亮通暢，才納得到這股氣。',
  },
  開闊明堂: {
    label: '開闊明堂', form: '虛', sha: null, wx: '土',
    harm: '門前開闊平坦的空間叫「明堂」，氣能停留聚集，主前景開展、利財。落在屋後則變成背後無靠。',
    fix: '在門前屬吉，不需化解。落在屋後時，床頭與座位靠實牆，後窗加窗簾補「靠」。',
  },
  公園綠地: {
    label: '公園綠地', form: '虛', sha: null, wx: '木',
    harm: '綠地生氣旺、視野開，在門前可當明堂。樹木太密、陰暗潮濕時，氣反而偏陰。',
    fix: '多數情況屬吉。林木遮光時，面向綠地的房間加強採光與除濕，窗前大樹適度修剪。',
  },
  空地低窪: {
    label: '空地／低窪', form: '虛', sha: null, wx: '水',
    harm: '俗話說「低一寸為水」，低窪空地當虛的水看。在向方能納氣；在屋後則是坐空，不易守成。',
    fix: '落在屋後時，那一側擺高櫃、以實牆當靠。低窪處注意排水，避免積水潮濕。空地日後蓋了建築，形勢會變，要重看。',
  },
  // H2：路沖、反弓路的做法分「在大門那一方」（fix／fix25）與「不在大門那一方」（fixSide／fixSide25）。
  //     玄關、屏風、門前矮牆只在大門宮講；二五宮的版本不寫施工，只用金、宜靜（e25Note 另接在後面）。
  路沖: {
    label: '路沖', form: null, sha: '路沖煞', wx: '水',
    harm: '道路筆直對著房子沖來，氣又急又直。傳統認為主意外、破耗、家人不安寧。',
    fix: '門前設矮牆、屏障或種一排綠籬，擋住直沖之氣。大門內做玄關或屏風，讓氣轉折再進屋。傳統做法可在沖射處立石敢當。',
    fix25: '大門內放屏風，讓氣轉折再進屋。門邊放銅葫蘆或六帝錢，用金洩土氣，門口保持整潔、安靜。',
    fixSide: '面向那一側的窗加窗簾、少開，床位書桌避開沖射線；傳統做法可在該側外牆上方放凸面鏡或石敢當。',
    fixSide25: '面向那一側的窗加窗簾、少開，床位書桌避開沖射線。窗邊放銅葫蘆或六帝錢，用金洩土氣。',
    action: '玄關加屏風，讓直沖的氣轉折再進屋',
    action25: '放屏風在大門內，門邊放銅葫蘆或六帝錢',
    actionSide: '拉上面向沖射那側的窗簾，床位書桌避開沖射線',
    actionSide25: '拉上面向沖射那側的窗簾，窗邊放銅葫蘆',
  },
  反弓路: {
    label: '反弓路', form: null, sha: '反弓煞', wx: '水',
    harm: '道路或河流的彎弓外側頂向房子，氣被甩走。傳統認為主破財、離散、易有意外。',
    fix: '門前設矮牆、屏障或種一排綠籬，擋住被甩開的氣。大門內做玄關或屏風，讓氣轉個彎再進屋，玄關加強照明。面向反弓的窗加窗簾。傳統做法可在窗外掛凸面鏡把氣散開。',
    fix25: '大門內放屏風，讓氣轉個彎再進屋。面向反弓的窗加窗簾、少開。門邊放銅葫蘆或六帝錢，用金洩土氣。',
    fixSide: '面向那一側的窗加窗簾、少開，床位書桌避開沖射線；傳統做法可在該側外牆上方放凸面鏡或石敢當。',
    fixSide25: '面向那一側的窗加窗簾、少開，床位書桌避開沖射線。窗邊放銅葫蘆或六帝錢，用金洩土氣。',
    action: '玄關加屏風，讓甩開的氣轉個彎再進屋',
    action25: '放屏風在大門內，面向反弓的窗拉上窗簾',
    actionSide: '拉上面向反弓那側的窗簾，床位書桌避開沖射線',
    actionSide25: '拉上面向反弓那側的窗簾，窗邊放銅葫蘆',
  },
  壁刀: {
    label: '壁刀', form: null, sha: '壁刀煞', wx: '金',
    harm: '鄰棟牆面的側邊像刀刃直切過來。傳統認為易有利器之傷、意外與口舌是非，安全上要多留意。',
    fix: '被切到的那一側掛凸面鏡，或用盆栽、綠籬、百葉窗遮擋。該側少開窗，床位與書桌避開那條切線。',
    fix25: '被切到的那一側掛凸面鏡，或用百葉窗、厚窗簾遮擋。該側少開窗，床位與書桌避開那條切線。',
    action: '掛凸面鏡在被切到的那側，床位書桌避開切線',
    action25: '掛凸面鏡在被切到的那側，該側少開窗',
  },
  天斬煞: {
    label: '天斬煞', form: null, sha: '天斬煞', wx: '金',
    harm: '兩棟高樓之間的狹長縫隙正對房子，風從縫中直灌過來。傳統認為不利健康、易有意外。',
    fix: '正對縫隙的窗加厚窗簾，平時少開。窗邊可擺銅製品（銅葫蘆、銅麒麟）或闊葉盆栽擋風。床與座位不要正對那道縫。',
    fix25: '正對縫隙的窗加厚窗簾，平時少開。窗邊可擺銅製品（銅葫蘆、銅麒麟）擋風。床與座位不要正對那道縫。',
    action: '拉上正對縫隙那扇窗的厚窗簾，窗邊擺銅製品',
    action25: '拉上正對縫隙那扇窗的厚窗簾，窗邊擺銅製品',
  },
  尖角屋角: {
    label: '尖角／屋角', form: null, sha: '尖角煞', wx: '火',
    harm: '鄰屋的牆角、屋角或招牌尖角對著門窗，叫尖角沖射。傳統認為主口角是非、情緒煩躁、小傷。',
    fix: '被沖的窗加窗簾或擺闊葉盆栽遮擋，傳統作法是窗外掛凸面鏡。門被沖時，門內設玄關或屏風。',
    fix25: '被沖的窗加窗簾遮擋，傳統作法是窗外掛凸面鏡。門被沖時，門內先放屏風擋一擋，日後再做玄關。',
    action: '拉上被沖那扇窗的窗簾，窗外掛凸面鏡擋煞',
    action25: '拉上被沖那扇窗的窗簾，窗外掛凸面鏡擋煞',
  },
  電塔變電: {
    label: '電塔／變電所', form: null, sha: '火形煞', wx: '火',
    harm: '高壓電塔、變電所、基地台形尖屬火，稱火形煞。傳統認為使人心神不寧，睡眠與健康要多留意。',
    fix: '臥室、書房安排在遠離那一側的房間，面向電塔的窗加窗簾。電塔屬火，該側可用土來洩，例如陶瓷、石材、黃褐色擺設。',
    fix25: '臥室、書房安排在遠離那一側的房間，面向電塔的窗加窗簾。該側改放銅製品、金屬擺件，不用陶瓷石材。',
    action: '把臥室書房排在遠離電塔那一側，窗加窗簾',
    action25: '拉上面向電塔的窗簾，該側放銅製品',
  },
  高架橋: {
    label: '高架橋', form: null, sha: '鐮刀煞／攔腰煞', wx: '水',
    harm: '高架橋車流又快又吵。彎弓朝外像鐮刀叫「鐮刀煞」，橫過樓層高度叫「攔腰煞」，主氣散、難安寧。',
    fix: '用氣密窗、厚窗簾隔絕噪音與車燈。陽台種一排植栽當緩衝。臥室安排在背對高架橋的一側。',
    fix25: '面向高架橋的窗加厚窗簾，隔絕噪音與車燈。臥室安排在背對高架橋的一側。日後可再加裝氣密窗。',
    action: '拉上面向高架橋的厚窗簾，臥室排在背側',
    action25: '拉上面向高架橋的厚窗簾，臥室排在背側',
  },
  廟宇教堂: {
    label: '廟宇／教堂', form: null, sha: '孤煞', wx: '火',
    harm: '俗話說「神前廟後」不宜住家。廟宇、教堂、宮壇氣場特殊，傳統稱孤煞，主住的人較孤單、情緒起伏。',
    fix: '大門與主窗不要正對廟門或屋脊。玄關做內轉或加屏風，讓氣轉個彎。面向廟宇的窗加窗簾，屋內保持明亮。',
    fix25: '大門與主窗不要正對廟門或屋脊。門內加屏風，讓氣轉個彎。日後可再把玄關改成內轉。面向廟宇的窗加窗簾。',
    action: '避免大門主窗正對廟門，門內加屏風轉個彎',
    action25: '避免大門主窗正對廟門，門內加屏風轉個彎',
  },
  醫院殯葬: {
    label: '醫院／殯葬設施', form: null, sha: '陰煞', wx: '水',
    harm: '醫院、殯儀館、墓地一帶陰氣較重，傳統稱陰煞。主心情低落、運勢較悶，健康上要多留意。',
    fix: '提升屋內陽氣：加強採光與照明，保持通風乾爽。面向那一側的窗加窗簾，玄關可留一盞長明燈。',
    fix25: '面向那一側的窗加窗簾，保持通風乾爽。陽氣靠其他方位的採光來補，這一方不加燈火。',
    action: '拉上面向那一側的窗簾，屋內加強採光通風',
    action25: '拉上面向那一側的窗簾，保持通風乾爽',
  },
};

export const EXT_KEYS = Object.keys(EXT_TYPES);

/** 四獸：面朝門外，前朱雀、後玄武、左青龍、右白虎 */
export const BEASTS = ['朱雀', '玄武', '青龍', '白虎'];
export const BEAST_INFO = {
  朱雀: { side: '前', short: '大門正前方', long: '也就是大門正前方的向方' },
  玄武: { side: '後', short: '房子背後', long: '也就是房子背後的坐方' },
  青龍: { side: '左', short: '面朝門外的左手邊', long: '也就是面朝門外時的左手邊' },
  白虎: { side: '右', short: '面朝門外的右手邊', long: '也就是面朝門外時的右手邊' },
};

/**
 * 四獸各在哪一宮。facingDeg＝站在大門內、面朝門外量到的度數。
 * 朱雀＝向宮、玄武＝坐宮、青龍＝向 −90°（左手邊）、白虎＝向 +90°（右手邊）。
 */
export function beastPalaces(facingDeg) {
  const front = palaceAt(norm(facingDeg));
  return {
    朱雀: front,
    玄武: palaceShift(front, 4),
    青龍: palaceShift(front, -2),
    白虎: palaceShift(front, 2),
  };
}

/* ---------------- 評分 ---------------- */

const START = 12;
const MAX = 20;
const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const REL_POS = ['正前方', '右前方', '右側', '右後方', '正後方', '左後方', '左側', '左前方'];

// 形煞的基本扣分；路沖落在大門宮改扣 4（已含「煞在大門宮」那 1 分）
const SHA_DELTA = {
  路沖: -3, 天斬煞: -3, 反弓路: -2.5, 壁刀: -2.5,
  電塔變電: -2, 高架橋: -2, 尖角屋角: -1.5, 廟宇教堂: -1.5, 醫院殯葬: -1.5,
};
const ROAD_AT_DOOR = -4;

// 「兩派看法不同」那一句用的短稱
const SHORT = {
  高樓: '高樓', 山丘: '山丘', 河流水池: '水', 平直道路: '道路', 環抱路: '環抱路',
  開闊明堂: '明堂', 公園綠地: '綠地', 空地低窪: '空地',
};

// 固定的做法；會因這一宮的飛星而不同的（零神見山、旺山下水、旺向見山、朱雀逼壓、白虎昂頭），
// 在 evaluateExterior 裡先依飛星盤判斷再組句（不把判斷丟給使用者）。
const FIX = {
  kong: '床頭、書桌、沙發靠實牆，背後那一側少開大窗。後窗加厚窗簾，或擺高櫃當「靠山」。屋後有空間的話，種一排較高的樹籬。',
  kong25: '床頭、書桌、沙發靠實牆，背後那一側少開大窗。後窗加厚窗簾，或擺高櫃當「靠山」。',
  bipo: '大門內外保持明亮整潔，玄關不堆雜物並加強照明。門前能退縮留出小前庭更好。客廳主窗改用視野較開的一面。',
  bipo25: '大門內外保持整潔，玄關不堆雜物。門前能退縮留出小前庭更好。客廳主窗改用視野較開的一面。',
  // Q4：大門不在朱雀宮時只講向方的窗，不寫玄關、門前退縮
  bipoWin: '向方窗戶保持乾淨、不堆高物遮擋視線，坐著時有開闊感。客廳主窗改用視野較開的一面。',
  // 白虎昂頭（掛白虎宮）：只講右側；補青龍另出一條（qinglong-bu，掛青龍宮）
  baihu: '右手邊（白虎方）的窗少開，或加窗簾遮擋。吵雜、常動的電器不要放在右側。',
  baihu25: '右手邊（白虎方）放銅製品或六帝錢，用金洩土氣；吵雜、常動的電器不要放在右側。',
  baihuDong: '右手邊（白虎方）的窗用氣密窗或厚窗簾，隔開車流與噪音。屋內右側少放會響、會動的電器，保持安靜。',
  // H3：二五宮先做不動工的，要動工的另起一句（evaluateExterior 最後會補註）
  baihuDong25: '右手邊（白虎方）的窗加厚窗簾，隔開車流與噪音，平時少開。屋內右側少放會響、會動的電器，保持安靜。日後可再加裝氣密窗。',
  doorBaihu: '大門內設玄關或屏風，讓氣轉個彎再進屋。門邊右側不放會響、會動的東西，保持安靜。',
  doorBaihu25: '大門內放屏風，讓氣轉個彎再進屋。門邊右側不放會響、會動的東西，保持安靜。日後可再做玄關。',
  zsShui: '面向這片水的窗加窗簾或霧面貼，少從這一側採光納氣。屋內這個方位不要再擺魚缸、水景。',
  // 二五宜靜：只用不會響的金（知識庫 K2：不用風鈴、銅鈴）
  sha52: '屋內這個方位保持安靜，少敲打、少動土。可擺六帝錢、銅葫蘆等金屬物來洩土氣。避免紅色與火燭類擺設。',
  shaDoor: '大門內設玄關或屏風，讓氣轉個彎再進屋。門口保持明亮整潔，鞋櫃雜物不要堆在門邊。',
  shaDoor25: '大門內放屏風，讓氣轉個彎再進屋。門口保持整潔，鞋櫃雜物不要堆在門邊。日後可再做玄關。',
};

/**
 * Q1：四獸、零正神、山向星、形煞附加條目的短動作（15～28 字、沒有句號）。
 * 「25」結尾的是這一宮有二黑五黃（含流年）時用的：只用金、宜靜、不施工。
 */
export const EXT_ACT = Object.freeze({
  kong: '床頭、書桌、沙發靠實牆，後窗加厚窗簾',
  bipo: '玄關不堆雜物、加強照明，門口保持整潔',
  bipo25: '玄關不堆雜物，大門內外保持整潔安靜',
  bipoWin: '保持向方窗戶乾淨，不堆高物遮擋視線',
  baihu: '保持右側安靜，白虎方的窗少開、加窗簾',
  baihu25: '放銅葫蘆或六帝錢在右側，右側保持安靜',
  longBu: '擺高櫃或較高家具在左側青龍方，補足氣勢',
  longBu25: '擺高櫃在左側青龍方，櫃上放銅製品',
  baihuDong: '加裝右側的氣密窗或厚窗簾，隔開車流噪音',
  baihuDong25: '拉上右側的厚窗簾、平時少開，保持安靜',
  doorBaihu: '放屏風在大門內讓氣轉彎，門邊右側保持安靜',
  zsShui: '拉上面向這片水的窗簾，屋內不擺水景',
  lsWang: '保持屋內通風、不堆雜物，不擺水景',
  ls25: '保持這一方通風、不堆雜物，宜靜不宜動',
  lsPlain: '保持屋內這一方明亮通風，動線順暢',
  lsWater: '保持屋內這一方明亮通風，可擺小型水景',
  lsDry: '保持屋內這一方明亮通風，不另擺水',
  // B1：雙星同宮見山，屋內放水、屋外的山在水外
  lsBoth: '擺小型水景在屋內這一方，取「水外有山」',
  wxBoth: '擺小型流水在屋內這一方，取「水外有山」',
  wsShui: '拉上面向這片水的窗簾，屋內擺高櫃補「山」',
  wx25: '保持這一方的窗通風，窗前不堆雜物',
  wxDry: '保持這一方的窗常開通風，窗前不堆雜物',
  wxWater: '保持窗前淨空，屋內可擺小型流水引動向星',
  sha52: '擺六帝錢或銅葫蘆，這一方保持安靜',
  shaDoor: '保持門口整潔，大門內設玄關或屏風',
  shaDoor25: '放屏風在大門內，鞋櫃雜物不堆在門邊',
});

/** 白虎昂頭時補青龍的做法（掛青龍宮）；青龍宮有二五就不用植栽、綠籬，改高櫃加金 */
function longBuFix(pl, e25Text) {
  const head = `左側青龍方（${pl}宮）`;
  if (e25Text) return `${head}可擺高櫃或較高的家具，把青龍方的氣勢補起來，櫃上放銅製品，用金洩土氣。${e25Text}`;
  return `${head}可加高植栽或擺高櫃，把青龍方的氣勢補起來。屋外有空間的話，左側可種一排較高的綠籬。`;
}

// Y2：零神見山遇山星生旺——兩派看法不同；做法只寫不動的，不寫明亮、動線順暢，不擺水景
const SHENG_WANG = ['旺氣', '生氣'];
export const LS_SHI_WANG = '屋內保持通風、不堆雜物，不擺水景。';
// B1：雙星同宮（山星、向星都當運）見山——屋外的山正好在水外，屋內這一方放水，取「先見水、水外有山」。
// 道理寫在本文（BOTH_NOTE）；報告的 dryText 會在放水句後面補 BOTH_WATER，fix 這裡只寫做法、不重複那一句。
export const LS_SHI_BOTH = '屋外的山正好在水外，屋內這一方可擺小型水景，保持通風、不堆雜物。';
export const WX_SHI_BOTH = '屋外已有山，屋內這一方可擺小型流水或魚缸。';
const BOTH_NOTE = '這一宮山星、向星都當運，傳統講究「先見水、水外有山」才能兼顧。';
const LS_SHI_DIFFER = '零神見山與旺山見山兩種看法不同，這裡並列、分數照零神扣，不替你選邊。';

// 龍動虎靜（D8）：會「動」的外局
const TIGER_DONG = ['平直道路', '高架橋', '路沖'];
const DRAGON_DONG = ['平直道路', '環抱路', '河流水池'];

const EMPTY_VERDICT = '這一方沒有填外局，形勢上不加不減。';
const NO_FACING_VERDICT = '沒有大門朝向的度數，無法判斷四獸方位。';

function round1(x) { return Math.round(x * 10) / 10; }
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function levelOf(delta) {
  if (delta > 0) return '吉';
  if (delta < 0) return delta >= -0.5 ? '注意' : '凶';
  return '平';
}
function labelsOf(keys) { return keys.map((k) => EXT_TYPES[k].label).join('、'); }
// 四獸「一句話」用：最多列兩樣，超過就加「等」，免得句子太長
function listOf(keys, max = 2) { return labelsOf(keys.slice(0, max)) + (keys.length > max ? '等' : ''); }
function shortOf(keys) { return (SHORT[keys[0]] || EXT_TYPES[keys[0]].label) + (keys.length > 1 ? '等' : ''); }
function where(p) { return `${PALACE_INFO[p].dir}方（${p}宮）`; }
/** 煞名跟外局名稱重複（天斬煞／天斬煞、路沖／路沖煞、壁刀／壁刀煞…）時，不再寫「屬於…」 */
function shaNameRepeats(t) {
  const core = String(t.sha).replace(/煞$/, '');
  return t.label.includes(core) || t.sha.includes(t.label);
}

/**
 * 外局評分。
 * ctx＝{ facingDeg, cells, period, exterior, doorPalace, zhengshen, lingshen, rooms? }
 *   rooms（選填，Q2）：內局的 { 宮:[房間] }；零神見山、旺向見山要不要建議擺水時，看這一宮有沒有廁所（水過旺、水剋火）。
 * 回傳 { score, max:20, beasts, items, warnings }（另附 start、raw 供除錯）。
 * items 每筆 { palace, feature, features, delta, level, title, text, fix?, action?, rule, school, differ? }。
 *   differ＝true（Y2）：零神見山遇山星生旺，兩派看法不同（level 注意，分數照扣），報告標「看法不同」。
 *   action（Q1）：delta<0 或有 fix 的條目都有，一句 15～28 字、能照做、沒有句號的短句。
 */
export function evaluateExterior(ctx) {
  const c = ctx || {};
  const warnings = [];
  const pn = c.period === null || c.period === undefined || c.period === '' ? NaN : Number(c.period);
  const period = Number.isInteger(pn) && pn >= 1 && pn <= 9 ? pn : null;
  const yunName = period ? `${CN_NUM[period]}運` : '本運';
  const cells = c.cells && typeof c.cells === 'object' ? c.cells : null;
  const fd = c.facingDeg;
  const hasFacing = fd !== null && fd !== undefined && fd !== '' && Number.isFinite(Number(fd));
  const bp = hasFacing ? beastPalaces(Number(fd)) : null;
  const beastAt = {};
  if (bp) for (const b of BEASTS) beastAt[bp[b]] = b;

  // ---- 整理輸入：只收八宮、只收認得的代碼、同宮重複的只算一次 ----
  const ext = {};
  const unknown = [];
  let count = 0;
  for (const p of PALACES) {
    const raw = c.exterior && Array.isArray(c.exterior[p]) ? c.exterior[p] : [];
    const list = [];
    for (const k of raw) {
      if (!EXT_KEYS.includes(k)) {
        if (!unknown.includes(String(k))) unknown.push(String(k));
        continue;
      }
      if (!list.includes(k)) list.push(k);
    }
    list.sort((a, b) => EXT_KEYS.indexOf(a) - EXT_KEYS.indexOf(b));
    ext[p] = list;
    count += list.length;
  }

  const beasts = {};
  for (const b of BEASTS) {
    const p = bp ? bp[b] : null;
    beasts[b] = {
      palace: p,
      dir: p ? PALACE_INFO[p].dir : null,
      features: p ? ext[p].slice() : [],
      verdict: bp ? EMPTY_VERDICT : NO_FACING_VERDICT,
      delta: 0,
    };
  }

  // ---- 八宮都沒填：中間值 ----
  if (count === 0) {
    warnings.push('外局未填，以中間值計');
    if (unknown.length) warnings.push(`外局有不認得的代碼，已略過：${unknown.join('、')}`);
    return { score: START, max: MAX, start: START, raw: START, beasts, items: [], warnings };
  }
  if (unknown.length) warnings.push(`外局有不認得的代碼，已略過：${unknown.join('、')}`);
  if (!bp) warnings.push('沒有大門朝向的度數，四獸（前後左右）的形勢沒有計算。');

  // ---- 小工具 ----
  const byForm = (p, form) => ext[p].filter((k) => EXT_TYPES[k].form === form);
  const cellOf = (p) => {
    const cell = cells && cells[p];
    if (!cell) return null;
    const m = Number(cell.m);
    const f = Number(cell.f);
    if (!(m >= 1 && m <= 9) || !(f >= 1 && f <= 9)) return null;
    return {
      m, f,
      mQi: cell.mQi || (period ? qiOf(m, period) : null),
      fQi: cell.fQi || (period ? qiOf(f, period) : null),
    };
  };
  const starOne = (star, qi) => (qi ? `${STAR_NAMES[star]}（${qi}）` : STAR_NAMES[star]);
  const starSentence = (p) => {
    const cell = cellOf(p);
    return cell ? `這一宮的飛星是山星${starOne(cell.m, cell.mQi)}、向星${starOne(cell.f, cell.fQi)}。` : '';
  };
  const beastClause = (p) => (beastAt[p] ? `，同時是${beastAt[p]}位（${BEAST_INFO[beastAt[p]].short}）` : '');
  const relPos = (p) => REL_POS[(PALACES.indexOf(p) - PALACES.indexOf(bp.朱雀) + 8) % 8];

  // D4：這一宮的二黑、五黃（山星、向星，另看流年星）。沒有回 null。
  const e25Of = (p) => {
    const cell = cells && cells[p];
    if (!cell) return null;
    const m = Number(cell.m);
    const f = Number(cell.f);
    const y = Number(cell.yearStar);
    const fly = [5, 2].filter((s) => m === s || f === s);
    const annual = (y === 5 || y === 2) && !fly.includes(y) ? y : null;
    return fly.length || annual ? { fly, annual } : null;
  };
  const e25Note = (e) => {
    if (!e) return '';
    const parts = [];
    if (e.fly.length) parts.push(`此宮有${e.fly.map((s) => STAR_NAMES[s]).join('、')}`);
    if (e.annual) parts.push(`${e.fly.length ? '今年又逢' : '今年此宮逢'}流年${STAR_NAMES[e.annual]}`);
    return `${parts.join('，')}，不用土、火、木、流水，宜靜不宜動。`;
  };
  // 零神見山：要不要建議屋內擺水，先看這一宮的飛星。
  // Y2：山星生旺（旺氣、生氣）時，玄空另一個看法是「旺山見山」反而好 → 只寫不動的做法，不寫明亮、動線順暢，不擺水景
  const mShengWang = (p) => {
    const cell = cellOf(p);
    return !!cell && SHENG_WANG.includes(cell.mQi);
  };
  // Q2：這一宮能不能再放水（跟內局同一把尺；ctx.rooms 有帶才看廁所那一條）
  // B5：報告會傳 rooms（內局的 { 宮:[房間] }）；坎、離有廁所的宮，零神見山、旺向見山都用不放水的版本，action 同一個判斷
  const dryOf = (p) => waterBlock(p, { cells: cells || {}, rooms: c.rooms, doorPalace, period });
  // B1：雙星同宮（山星、向星都當運）——waterOk 不因山星當運擋水，屋外的山在水外，取「先見水、水外有山」
  const bothWang = (p) => {
    const cell = cellOf(p);
    return !!cell && !!period && cell.m === period && cell.f === period;
  };
  /**
   * 零神見山的做法要寫哪一種（fix 與 action 共用，免得兩邊各判各的）：
   *   'both'  雙星同宮、可以放水 → 屋內擺小型水景（先見水、水外有山）
   *   'wang'  山星生旺（Y2）→ 只寫不動的做法、不擺水景（有二五再接二五那一句）
   *   '25'    二五宮 → 通風、不堆雜物、宜靜
   *   'plain' 沒有飛星資料
   *   'dry'   不宜放水（廁所之水、向星失令；山星當運已在 wang）→ 寫理由、不擺水景
   *   'water' 可以放水 → 可擺小型水景
   */
  const lsPlan = (p) => {
    const cell = cellOf(p);
    if (mShengWang(p)) return bothWang(p) && !e25Of(p) && !dryOf(p) ? 'both' : 'wang';
    if (e25Of(p)) return '25';
    if (!cell) return 'plain';
    return dryOf(p) ? 'dry' : 'water';
  };
  const fixLsShi = (p) => {
    const e = e25Of(p);
    const base = '屋內這個方位保持明亮通風、動線順暢。';
    switch (lsPlan(p)) {
      case 'both': return LS_SHI_BOTH;
      case 'wang': {
        // Y2 照舊；B5：不宜放水的原因不是「山星當運」本身（廁所之水、向星失令）時，理由寫出來
        const dry = e ? null : dryOf(p);
        return dry && dry.code !== 'mountain'
          ? `${LS_SHI_WANG}${dry.why}，不另加水。`
          : `${LS_SHI_WANG}${e ? e25Note(e) : ''}`;
      }
      case '25': return `屋內這個方位保持通風、不堆雜物。${e25Note(e)}`;
      case 'plain': return base;
      case 'dry': return `${base}${dryOf(p).why}，不擺水景。`;
      default: return `${base}想補水氣，可擺小型水景。`;
    }
  };
  const actLsShi = (p) => ({
    both: EXT_ACT.lsBoth, wang: EXT_ACT.lsWang, 25: EXT_ACT.ls25, plain: EXT_ACT.lsPlain, dry: EXT_ACT.lsDry, water: EXT_ACT.lsWater,
  })[lsPlan(p)];
  // 旺山星下水：補「山」用的東西，有二五時不用陶瓷石材
  const fixWsShui = (p) => {
    const e = e25Of(p);
    return '面向這片水的窗加窗簾遮擋。'
      + (e
        ? `屋內這個方位擺高櫃、書櫃等厚重家具補「山」，不用陶瓷石材。不要再放魚缸、水景。${e25Note(e)}`
        : '屋內這個方位擺高櫃、石材或陶瓷等厚重的東西補「山」。不要再放魚缸、水景。');
  };
  // 旺向星見山：能不能擺水引動向星，先看有沒有二五，再問 waterOk（Q2）。
  // 旺向星見山的宮向星一定當運，山星也當運＝雙星同宮（B1）：屋外的山在水外，可以放水（先見水、水外有山）；
  // 不宜放水（廁所之水，B5）就寫理由、不擺水。fix 與 action 共用 wxPlan。
  const wxPlan = (p) => {
    if (e25Of(p)) return '25';
    const cell = cellOf(p);
    if (cell && dryOf(p)) return 'dry';
    return bothWang(p) ? 'both' : 'water';
  };
  const fixWxShi = (p) => {
    const base = '這一方的窗保持明亮、常開通風，窗前不堆雜物。';
    switch (wxPlan(p)) {
      // 二五宮：不寫明亮（燈火）與常開（動），只留通風與整潔
      case '25': return `這一方的窗保持通風，窗前不堆雜物。${e25Note(e25Of(p))}`;
      case 'dry': return `${base}${dryOf(p).why}，不擺水，靠開窗與走動來引動向星。`;
      case 'both': return `${base}${WX_SHI_BOTH}`;
      default: return `${base}屋內該位置可擺小型流水或魚缸引動向星。`;
    }
  };
  const actWxShi = (p) => ({ 25: EXT_ACT.wx25, dry: EXT_ACT.wxDry, both: EXT_ACT.wxBoth, water: EXT_ACT.wxWater })[wxPlan(p)];
  // 形煞：煞所在的宮有二五時改用 fix25。
  // H2：路沖、反弓路不在大門那一方時用 fixSide（窗簾、床位書桌避開沖射線、凸面鏡或石敢當），
  //     玄關、屏風、門前矮牆只在大門宮講；二五宮用 fixSide25（不施工、只用金、宜靜）。
  const shaFix = (t, p, atDoor) => {
    const e = e25Of(p);
    if (t.fixSide && !atDoor) return e ? `${t.fixSide25}${e25Note(e)}` : t.fixSide;
    return e && t.fix25 ? `${t.fix25}${e25Note(e)}` : t.fix;
  };
  // Q1：形煞的短動作，跟 shaFix 同一套分法
  const shaAct = (t, p, atDoor) => {
    const e = e25Of(p);
    if (t.actionSide && !atDoor) return e ? t.actionSide25 : t.actionSide;
    return (e ? t.action25 : t.action) || t.action;
  };

  // 大門宮：指定的；沒指定 → 向宮（龍邊虎邊、形煞在大門方都要用）
  let doorPalace = null;
  if (PALACES.includes(c.doorPalace)) doorPalace = c.doorPalace;
  else if ((c.doorPalace === null || c.doorPalace === undefined) && bp) doorPalace = bp.朱雀;

  // 零神、正神（五運寄宮不定，引擎給的是「中」，這裡就不評）
  let zs = c.zhengshen !== undefined && c.zhengshen !== null ? c.zhengshen : (period ? PALACE_BY_LUO[period] : null);
  let ls = c.lingshen !== undefined && c.lingshen !== null ? c.lingshen : (period ? PALACE_BY_LUO[10 - period] : null);
  if (!PALACES.includes(zs)) zs = null;
  if (!PALACES.includes(ls)) ls = null;
  if (period === 5 && (!zs || !ls)) {
    warnings.push('五運的零神、正神寄在坤艮兩宮，前後十年不同，這裡沒有評零正神。');
  }

  // 這一方在房子的哪裡、是四獸的誰、是不是零正神
  const posSentence = (p) => {
    const parts = [];
    if (beastAt[p]) parts.push(`這一方是${beastAt[p]}位（${BEAST_INFO[beastAt[p]].short}）`);
    else if (bp) parts.push(`這一方在房子的${relPos(p)}`);
    if (p === zs) parts.push(`${parts.length ? '也是' : '這一方是'}${yunName}的正神方`);
    if (p === ls) parts.push(`${parts.length ? '也是' : '這一方是'}${yunName}的零神方`);
    return parts.length ? `${parts.join('，')}。` : '';
  };

  const items = [];
  const add = (o) => {
    const item = {
      palace: o.palace,
      feature: o.features.length ? o.features[0] : null,
      features: o.features.slice(),
      delta: o.delta,
      level: o.level || levelOf(o.delta),
      title: o.title,
      text: o.text.filter(Boolean).join(''),
    };
    if (o.fix) item.fix = o.fix;
    if (o.action) item.action = o.action;
    item.rule = o.rule;
    item.school = o.school;
    item._cls = o.cls || null;
    item._brief = o.brief || '';
    items.push(item);
    return item;
  };

  // ================= 一、形勢派：四獸 =================
  if (bp) {
    // --- 玄武（坐方）：有實＝有靠；見水或空而沒有實＝坐空 ---
    {
      const p = bp.玄武;
      const shi = byForm(p, '實');
      const kong = ext[p].filter((k) => EXT_TYPES[k].form === '真水' || k === '空地低窪' || k === '開闊明堂');
      const head = `${where(p)}是玄武位，${BEAST_INFO.玄武.long}。`;
      if (shi.length) {
        add({
          rule: 'xuanwu-shi', school: '形勢', cls: '實', palace: p, features: shi, delta: 2,
          title: '玄武有靠',
          text: [head, starSentence(p), `背後有${labelsOf(shi)}可靠，形勢上叫「有靠」。`, '主住得安穩、容易得到長輩與貴人扶持，屬吉。'],
          brief: `玄武有${shortOf(shi)}是「有靠」（吉）`,
        });
        beasts.玄武.delta += 2;
        beasts.玄武.verdict = `背後有${listOf(shi)}可靠，坐得穩。`;
      } else if (kong.length) {
        add({
          rule: 'xuanwu-kong', school: '形勢', cls: '虛', palace: p, features: kong, delta: -2,
          title: '玄武坐空',
          text: [head, starSentence(p), `背後是${labelsOf(kong)}，沒有高樓或山可靠，形勢上叫「坐空」。`, '主人事較浮動、不易守成，屬凶。'],
          fix: e25Of(p) ? `${FIX.kong25}${e25Note(e25Of(p))}` : FIX.kong,
          action: EXT_ACT.kong,
          brief: `玄武見${shortOf(kong)}是「坐空」（凶）`,
        });
        beasts.玄武.delta -= 2;
        beasts.玄武.verdict = `背後是${listOf(kong)}，沒有靠山，屬於「坐空」。`;
      } else if (ext[p].length) {
        beasts.玄武.verdict = '背後沒有明顯的靠山，也不算坐空，形勢平平。';
      }
    }

    // --- 朱雀（向方）：明堂開闊、水聚為吉；高物貼前為逼壓 ---
    {
      const p = bp.朱雀;
      const ming = ext[p].filter((k) => ['河流水池', '環抱路', '開闊明堂', '公園綠地'].includes(k));
      const shi = byForm(p, '實');
      const head = `${where(p)}是朱雀位，${BEAST_INFO.朱雀.long}。`;
      if (ming.length) {
        add({
          rule: 'zhuque-mingtang', school: '形勢', cls: '虛', palace: p, features: ming, delta: 2,
          title: '朱雀明堂開闊',
          text: [
            head, starSentence(p),
            `門前有${labelsOf(ming)}，氣能停、能聚，形勢上是「明堂開闊」。`,
            ming.includes('環抱路') ? '環抱的道路又叫「玉帶環腰」，更能把氣留住。' : '',
            ming.includes('河流水池') ? '門前的水以緩流、環抱、清澈為佳。' : '',
            '主前景開展、機會多、利進財，屬吉。',
          ],
          brief: `朱雀見${shortOf(ming)}是明堂開闊（吉）`,
        });
        beasts.朱雀.delta += 2;
      }
      if (shi.length) {
        // Q4：大門就在朱雀宮（向宮＝門宮，二五看這一宮）才講大門、玄關、門前退縮；
        //     大門不在朱雀宮只講向方的窗（二五看向宮），不寫玄關、門前退縮
        const doorIn = doorPalace === p;
        const eF = e25Of(p);
        let bipoFix;
        let bipoAct;
        if (doorIn) {
          bipoFix = eF ? `${FIX.bipo25}${e25Note(eF)}` : FIX.bipo;
          bipoAct = eF ? EXT_ACT.bipo25 : EXT_ACT.bipo;
        } else {
          bipoFix = eF ? `${FIX.bipoWin}${e25Note(eF)}` : FIX.bipoWin;
          bipoAct = EXT_ACT.bipoWin;
        }
        add({
          rule: 'zhuque-bipo', school: '形勢', cls: '實', palace: p, features: shi, delta: -2,
          title: '朱雀逼壓',
          text: [
            head, starSentence(p),
            `門前被${labelsOf(shi)}擋住，形勢上叫「朱雀逼壓」，明堂打不開。`,
            '主發展受限、壓力較大，屬凶。',
            '若離得遠、又不高過本宅太多，傳統當「案山」看，影響就輕。',
          ],
          fix: bipoFix,
          action: bipoAct,
          brief: `朱雀有${shortOf(shi)}是前方逼壓（凶）`,
        });
        beasts.朱雀.delta -= 2;
      }
      if (ming.length && shi.length) {
        beasts.朱雀.verdict = `門前有${listOf(ming)}，但也有${listOf(shi)}，要看遠近高低。`;
      } else if (ming.length) {
        beasts.朱雀.verdict = `門前有${listOf(ming)}，明堂開闊、能聚氣。`;
      } else if (shi.length) {
        beasts.朱雀.verdict = `門前被${listOf(shi)}擋住，明堂受壓。`;
      } else if (ext[p].length) {
        beasts.朱雀.verdict = '門前沒有明顯的明堂，也沒有高物逼壓，形勢平平。';
      }
    }

    // --- 青龍（左）、白虎（右）：龍宜高、虎宜低；龍宜動、虎宜靜（D8） ---
    {
      const pl = bp.青龍;
      const pr = bp.白虎;
      const long = byForm(pl, '實');
      const hu = byForm(pr, '實');
      const longDong = ext[pl].filter((k) => DRAGON_DONG.includes(k));
      const huDong = ext[pr].filter((k) => TIGER_DONG.includes(k));
      if (long.length) {
        add({
          rule: 'qinglong-shi', school: '形勢', cls: '實', palace: pl, features: long, delta: 1,
          title: '青龍有力',
          text: [
            `${where(pl)}是青龍位，${BEAST_INFO.青龍.long}。`, starSentence(pl),
            `左邊有${labelsOf(long)}護衛，形勢上叫「青龍有力」。`,
            '主貴人得力、事業與男性成員得助，屬吉。',
          ],
          brief: `青龍有${shortOf(long)}是左有護衛（吉）`,
        });
        beasts.青龍.delta += 1;
        beasts.青龍.verdict = `左邊有${listOf(long)}護衛，青龍有力。`;
      } else if (hu.length) {
        beasts.青龍.verdict = '左邊沒有高物，右邊卻有，龍弱虎強，左側宜補高。';
      } else if (longDong.length) {
        beasts.青龍.verdict = `左邊沒有高物，但有${listOf(longDong)}，合乎「青龍宜動」。`;
      } else if (ext[pl].length) {
        beasts.青龍.verdict = '左邊沒有高物護衛，青龍方較平。';
      }
      if (longDong.length) {
        add({
          rule: 'qinglong-dong', school: '形勢', cls: '虛', palace: pl, features: longDong, delta: 0.5,
          title: '青龍見動',
          text: [
            `${where(pl)}是青龍位，${BEAST_INFO.青龍.long}。`, starSentence(pl),
            `左邊有${labelsOf(longDong)}，氣在流動。`,
            '形勢上講「左青龍宜動、右白虎宜靜」，青龍方見路、見水，傳統認為利貴人與進取，屬小吉。',
          ],
          brief: `青龍見${shortOf(longDong)}是青龍宜動（吉）`,
        });
        beasts.青龍.delta += 0.5;
        if (long.length || hu.length) beasts.青龍.verdict = `${beasts.青龍.verdict.slice(0, -1)}；另有${listOf(longDong)}，合乎「青龍宜動」。`;
      }

      if (hu.length && !long.length) {
        // S3：白虎這一條掛白虎宮、只講右側；白虎宮有二五時只寫金洩與宜靜
        const eR = e25Of(pr);
        add({
          rule: 'baihu-angtou', school: '形勢', cls: '實', palace: pr, features: hu, delta: -1.5,
          title: '白虎昂頭',
          text: [
            `${where(pr)}是白虎位，${BEAST_INFO.白虎.long}。`, starSentence(pr),
            `右邊有${labelsOf(hu)}，左邊青龍方卻沒有高物，形勢上叫「白虎昂頭」。`,
            '俗話說「寧可青龍高萬丈，不可白虎抬頭望」。',
            '主口舌是非、小人較多，安全上要多留意，屬凶。',
            `左邊青龍方怎麼補，另列在${where(pl)}那一條。`,
          ],
          fix: eR ? `${FIX.baihu25}${e25Note(eR)}` : FIX.baihu,
          action: eR ? EXT_ACT.baihu25 : EXT_ACT.baihu,
          brief: `白虎有${shortOf(hu)}是白虎昂頭（凶）`,
        });
        beasts.白虎.delta -= 1.5;
        beasts.白虎.verdict = `右邊有${listOf(hu)}而左邊沒有，屬於「白虎昂頭」。`;
        // 補青龍：另出一條掛青龍宮（不計分），做法依青龍宮自己的飛星判斷
        const eL = e25Of(pl);
        add({
          rule: 'qinglong-bu', school: '形勢', cls: null, palace: pl, features: [], delta: 0, level: '注意',
          title: '青龍方宜補高',
          text: [
            `${where(pl)}是青龍位，${BEAST_INFO.青龍.long}。`, starSentence(pl),
            `右邊白虎方（${pr}宮）有${labelsOf(hu)}，左邊這一方卻沒有高物，龍弱虎強。`,
            '形勢上講「龍宜高、虎宜低」，把青龍方的氣勢補起來，可以平衡白虎昂頭。',
            '這一條是配合白虎昂頭的做法，不另計分。',
          ],
          fix: longBuFix(pl, eL ? e25Note(eL) : ''),
          action: eL ? EXT_ACT.longBu25 : EXT_ACT.longBu,
        });
      } else if (hu.length) {
        beasts.白虎.verdict = `右邊有${listOf(hu)}，左邊青龍也有靠，龍虎相稱。`;
      } else if (huDong.length) {
        beasts.白虎.verdict = `右邊有${listOf(huDong)}，白虎宜靜而見動。`;
      } else if (ext[pr].length) {
        beasts.白虎.verdict = '右邊沒有高物，白虎低伏，合乎「虎宜低」。';
      }
      if (huDong.length) {
        add({
          rule: 'baihu-dong', school: '形勢', cls: huDong.includes('平直道路') ? '虛' : null,
          palace: pr, features: huDong, delta: -1,
          title: '白虎見動',
          text: [
            `${where(pr)}是白虎位，${BEAST_INFO.白虎.long}。`, starSentence(pr),
            `右邊有${labelsOf(huDong)}，車流整天在動。`,
            '形勢上講「左青龍宜動、右白虎宜靜」，白虎見動，傳統認為口舌是非與意外較多，屬凶。',
          ],
          fix: e25Of(pr) ? `${FIX.baihuDong25}${e25Note(e25Of(pr))}` : FIX.baihuDong,
          action: e25Of(pr) ? EXT_ACT.baihuDong25 : EXT_ACT.baihuDong,
          brief: `白虎見${shortOf(huDong)}是白虎宜靜而見動（凶）`,
        });
        beasts.白虎.delta -= 1;
        if (hu.length) beasts.白虎.verdict = `${beasts.白虎.verdict.slice(0, -1)}；另有${listOf(huDong)}，白虎宜靜而見動。`;
      }

      // 大門開在龍邊或虎邊：只說明，不計分
      if (doorPalace && (doorPalace === pl || doorPalace === pr)) {
        const isLong = doorPalace === pl;
        add({
          rule: 'door-side', school: '形勢', cls: null, palace: doorPalace, features: ext[doorPalace].slice(0, 1),
          delta: 0, level: isLong ? '平' : '注意',
          title: isLong ? '大門開在青龍方' : '大門開在白虎方',
          text: isLong
            ? [`大門在${where(doorPalace)}，是青龍位（${BEAST_INFO.青龍.short}）。`,
              '形勢上講「開門宜開青龍邊」，大門開在龍邊，傳統認為較好。這一條只說明，不計分。']
            : [`大門在${where(doorPalace)}，是白虎位（${BEAST_INFO.白虎.short}）。`,
              '形勢上講「開門忌開白虎口」，白虎宜靜，大門開在虎邊，傳統認為較不利。這一條只說明，不計分。'],
          fix: isLong ? undefined : (e25Of(doorPalace) ? `${FIX.doorBaihu25}${e25Note(e25Of(doorPalace))}` : FIX.doorBaihu),
          action: isLong ? undefined : EXT_ACT.doorBaihu,
        });
        const b = isLong ? '青龍' : '白虎';
        const v = beasts[b].verdict === EMPTY_VERDICT ? '' : beasts[b].verdict;
        beasts[b].verdict = `${v}${isLong ? '大門開在這一側（龍邊）。' : '大門開在這一側（虎邊），傳統忌開白虎口。'}`;
      }
    }
  }

  // ================= 二、理氣派：零神、正神 =================
  if (zs) {
    const shi = byForm(zs, '實');
    const shui = byForm(zs, '真水');
    const head = [
      `${where(zs)}是${yunName}的正神方${beastClause(zs)}。`,
      '正神是當運數所在的方位，宜見山、見高樓，忌見水。',
      starSentence(zs),
    ];
    if (shi.length) {
      add({
        rule: 'zhengshen-shi', school: '理氣', cls: '實', palace: zs, features: shi, delta: 1.5,
        title: '正神方見山',
        text: [...head, `此方有${labelsOf(shi)}，合乎「正神見山」，主人丁與根基穩，屬吉。`],
        brief: '此方是正神、見山得位（吉）',
      });
    }
    if (shui.length) {
      add({
        rule: 'zhengshen-shui', school: '理氣', cls: '虛', palace: zs, features: shui, delta: -2,
        title: '正神下水',
        text: [...head, `此方有${labelsOf(shui)}，叫「正神下水」。`, '傳統認為當運的旺氣落進水裡，不利財運與人丁，屬凶。'],
        fix: FIX.zsShui,
        action: EXT_ACT.zsShui,
        brief: '此方是正神、見水是正神下水（凶）',
      });
    }
  }
  if (ls) {
    const shi = byForm(ls, '實');
    const zhen = byForm(ls, '真水');
    const xu = byForm(ls, '虛水');
    const head = [
      `${where(ls)}是${yunName}的零神方${beastClause(ls)}。`,
      '零神在正神的正對面，宜見水、見路，忌見高山高樓。',
      starSentence(ls),
    ];
    if (zhen.length) {
      add({
        rule: 'lingshen-shui', school: '理氣', cls: '虛', palace: ls, features: [...zhen, ...xu], delta: 2,
        title: '零神方見水',
        text: [...head, `此方有${labelsOf(zhen)}，合乎「零神見水」，主催旺財氣，屬吉。`],
        brief: '此方是零神、見水催財（吉）',
      });
    } else if (xu.length) {
      add({
        rule: 'lingshen-shui', school: '理氣', cls: '虛', palace: ls, features: xu, delta: 1,
        title: '零神方見路',
        text: [...head, `此方有${labelsOf(xu)}，道路是「虛水」，也算零神見水。`, '力量比真水小一些，主利財，屬吉。'],
        brief: '此方是零神、見路也算見水（吉）',
      });
    }
    if (shi.length) {
      // Y2：這一宮山星生旺 → 零神見山（凶）與旺山見山（吉）是兩派，標 differ、level 注意，分數照扣
      const wang = mShengWang(ls);
      const lc = wang ? cellOf(ls) : null;
      const it = add({
        rule: 'lingshen-shi', school: '理氣', cls: '實', palace: ls, features: shi, delta: -1,
        level: wang ? '注意' : undefined,
        title: '零神方見山',
        text: [
          ...head, `此方有${labelsOf(shi)}，零神方本該低平見水，卻被高物填實。`, '傳統認為財氣較難進來，屬凶。',
          wang ? `不過這一宮山星${STAR_NAMES[lc.m]}在${yunName}屬${lc.mQi}，另一個看法是山星生旺喜見山，反而利人丁。` : '',
          wang ? LS_SHI_DIFFER : '',
          // B1：雙星同宮（可以放水）——做法是屋內放水、屋外的山在水外
          lsPlan(ls) === 'both' ? BOTH_NOTE : '',
        ],
        fix: fixLsShi(ls),
        action: actLsShi(ls),
        brief: '此方是零神、不宜見山（凶）',
      });
      if (wang) it.differ = true;
    }
  }

  // ================= 三、理氣派：當運山星、當運向星 =================
  if (cells && period) {
    for (const p of PALACES) {
      const cell = cellOf(p);
      if (!cell) continue;
      const both = cell.m === period && cell.f === period;
      const bothNote = both ? '這一宮山星、向星都當運，傳統講究「先見水、水外有山」才能兼顧。' : '';
      const shi = byForm(p, '實');
      const zhen = byForm(p, '真水');
      const xuShui = byForm(p, '虛水');
      const xu = byForm(p, '虛');

      if (cell.m === period) {
        const head = [
          `${where(p)}的山星是${STAR_NAMES[cell.m]}，正是${yunName}的當運星${beastClause(p)}。`,
          '山星管人丁與健康，喜歡見山、見高樓。',
          `這一宮的向星是${starOne(cell.f, cell.fQi)}。`,
        ];
        if (shi.length) {
          add({
            rule: 'wangshan-shi', school: '理氣', cls: '實', palace: p, features: shi, delta: 2,
            title: '旺山星見山',
            text: [...head, `此方有${labelsOf(shi)}，合乎「山上龍神不下水」。`, '主人丁、健康與人和，屬吉。', bothNote],
            brief: '當運山星在此、見山旺丁（吉）',
          });
        }
        if (zhen.length) {
          add({
            rule: 'wangshan-shui', school: '理氣', cls: '虛', palace: p, features: zhen, delta: -2,
            title: '旺山星下水',
            text: [...head, `此方有${labelsOf(zhen)}，犯了「山上龍神下水」。`, '傳統認為不利人丁與健康，屬凶。', bothNote],
            fix: fixWsShui(p),
            action: EXT_ACT.wsShui,
            brief: '當運山星在此、見水不利人丁（凶）',
          });
        }
      }

      if (cell.f === period) {
        const head = [
          `${where(p)}的向星是${STAR_NAMES[cell.f]}，正是${yunName}的當運星${beastClause(p)}。`,
          '向星管財，喜歡見水、見路、見開闊。',
          `這一宮的山星是${starOne(cell.m, cell.mQi)}。`,
        ];
        if (zhen.length) {
          add({
            rule: 'wangxiang-shui', school: '理氣', cls: '虛', palace: p, features: [...zhen, ...xuShui, ...xu], delta: 2,
            title: '旺向星見水',
            text: [...head, `此方有${labelsOf(zhen)}，合乎「水裡龍神不上山」。`, '真水力量足，主進財順，屬吉。', bothNote],
            brief: '當運向星在此、見水旺財（吉）',
          });
        } else if (xuShui.length) {
          add({
            rule: 'wangxiang-shui', school: '理氣', cls: '虛', palace: p, features: [...xuShui, ...xu], delta: 1.5,
            title: '旺向星見路',
            text: [...head, `此方有${labelsOf(xuShui)}，道路是「虛水」，也能引動旺向星。`, '力量次於真水，主利財，屬吉。', bothNote],
            brief: '當運向星在此、見路旺財（吉）',
          });
        } else if (xu.length) {
          add({
            rule: 'wangxiang-shui', school: '理氣', cls: '虛', palace: p, features: xu, delta: 1,
            title: '旺向星見空',
            text: [...head, `此方有${labelsOf(xu)}，空曠開闊能納氣，旺向星得用。`, '力量比見水、見路輕一些，屬吉。', bothNote],
            brief: '當運向星在此、開闊納氣（吉）',
          });
        }
        if (shi.length) {
          add({
            rule: 'wangxiang-shi', school: '理氣', cls: '實', palace: p, features: shi, delta: -2,
            title: '旺向星見山',
            text: [...head, `此方有${labelsOf(shi)}擋著，犯了「水裡龍神上山」。`, '傳統認為旺財之氣被擋，不利財運，屬凶。', bothNote],
            fix: fixWxShi(p),
            action: actWxShi(p),
            brief: '當運向星在此、見山擋財（凶）',
          });
        }
      }
    }
  } else {
    warnings.push('沒有飛星盤或元運資料，當運山星、向星的外局規則沒有計算。');
  }

  // ================= 四、形煞 =================
  for (const p of PALACES) {
    const shas = ext[p].filter((k) => EXT_TYPES[k].sha);
    if (!shas.length) continue;
    const cell = cellOf(p);
    const isDoor = p === doorPalace;
    // 這一宮的山星或向星是五黃、二黑 → 每個煞再扣 1（同一個煞只扣一次）
    const badStars = [5, 2].filter((s) => cell && (cell.m === s || cell.f === s));
    const badNames = badStars.map((s) => STAR_NAMES[s]).join('、');
    // 二運的二黑、五運的五黃是當運旺星：分數照合約一樣扣，文字註明凶性較輕
    const badWhy = badStars
      .map((s) => (s === 5 ? '五黃是災病星' : '二黑是病符星') + (s === period ? '（當運時凶性較輕）' : ''))
      .join('、');

    for (const k of shas) {
      const t = EXT_TYPES[k];
      const roadAtDoor = k === '路沖' && isDoor;
      add({
        rule: 'sha', school: '形煞', palace: p, features: [k], delta: roadAtDoor ? ROAD_AT_DOOR : SHA_DELTA[k],
        title: `${PALACE_INFO[p].dir}方見${t.label}`,
        text: [
          `${where(p)}有${t.label}${shaNameRepeats(t) ? '' : `，屬於${t.sha}`}。`,
          posSentence(p),
          roadAtDoor ? '這裡又是大門所在的方位，路直沖進氣口，影響加重。' : '',
          starSentence(p),
          t.harm,
          '此方見煞，屬凶，宜化解。',
        ],
        fix: shaFix(t, p, isDoor),
        action: shaAct(t, p, isDoor),
      });
      if (badStars.length) {
        add({
          rule: 'sha-52', school: '形煞', palace: p, features: [k], delta: -1,
          title: `${t.label}引動${badNames}`,
          text: [
            `${where(p)}有${t.label}。`,
            posSentence(p),
            starSentence(p),
            `其中${badWhy}，最怕被外面的煞氣引動。`,
            `此方見${t.label}，等於煞氣沖動凶星，健康與安全要多留意，屬凶。`,
          ],
          fix: FIX.sha52,
          action: EXT_ACT.sha52,
        });
      }
      if (isDoor && k !== '路沖') {
        add({
          rule: 'sha-door', school: '形煞', palace: p, features: [k], delta: -1,
          title: `${t.label}在大門方`,
          text: [
            `${where(p)}是大門所在的方位，大門是全屋的進氣口。`,
            posSentence(p),
            starSentence(p),
            `此方見${t.label}，煞氣直接從門口進屋，影響比其他方位重，屬凶。`,
          ],
          fix: e25Of(p) ? FIX.shaDoor25 : FIX.shaDoor,
          action: e25Of(p) ? EXT_ACT.shaDoor25 : EXT_ACT.shaDoor,
        });
      }
    }

    // 四獸的一句話裡補一筆「這一方另有煞」。S4：前面（白虎見動）已經寫過的高架橋、路沖不再重複
    const b = beastAt[p];
    if (b) {
      const cur = beasts[b].verdict === EMPTY_VERDICT ? '' : beasts[b].verdict;
      const fresh = shas.filter((k) => !cur.includes(EXT_TYPES[k].label));
      if (fresh.length) {
        const v = cur.slice(0, -1);
        beasts[b].verdict = v ? `${v}；另見${listOf(fresh)}，要留意。` : `這一方見${listOf(fresh)}，要留意。`;
      }
    }
  }

  // ================= 五、兩派看法不同 =================
  // 同一宮、同一類東西（實／虛水），形勢派與理氣派一吉一凶 → 兩條照列照算，另加一條說明（不計分）。
  const notes = [];
  for (const p of PALACES) {
    for (const cls of ['實', '虛']) {
      const forms = items.filter((i) => i.palace === p && i.school === '形勢' && i._cls === cls);
      const liqi = items.filter((i) => i.palace === p && i.school === '理氣' && i._cls === cls);
      for (const fi of forms) {
        const opp = liqi.filter((li) => (li.delta > 0) !== (fi.delta > 0));
        if (!opp.length) continue;
        notes.push({
          rule: 'schools-differ', school: '說明', palace: p, level: '注意', delta: 0,
          features: [...new Set([...fi.features, ...opp.flatMap((li) => li.features)])],
          title: `兩派看法不同（${PALACE_INFO[p].dir}方）`,
          text: [
            `形勢派認為${fi._brief}，玄空理氣認為${opp[0]._brief}。`,
            opp[1] ? `理氣上另一條是${opp[1]._brief}。` : '',
            `${where(p)}是${beastAt[p]}位（${BEAST_INFO[beastAt[p]].short}）。`,
            starSentence(p),
            '兩種說法各有依據，這裡兩條都列、各算各的分，不替你選邊。',
            '實際取捨請看現場的遠近、高低與水的清濁緩急。',
          ],
        });
      }
    }
  }
  for (const n of notes) add(n);

  // H3：二五宮（山向星或流年星）宜靜：fix 裡要動工的句子補註（流年二五「今年忌動土」、只有山向星二五「先擇日」；
  // Y3：兩種都有用合併註記 NO_BUILD_BOTH）
  for (const it of items) {
    if (it.fix && e25Of(it.palace)) it.fix = tagBuild(it.fix, noBuildTag(cells[it.palace].yearStar, period, cells[it.palace]));
    // Q1：會扣分或給建議的條目都要有 action（上面每一條都給了；這裡只是墊底，測試會擋墊底）
    if ((it.delta < 0 || it.fix) && !it.action) it.action = e25Of(it.palace) ? ACTION_FALLBACK.calm : ACTION_FALLBACK.plain;
  }

  // ---- 算分 ----
  const sum = items.reduce((s, i) => s + i.delta, 0);
  const raw = round1(START + sum);
  const score = round1(clamp(START + sum, 0, MAX));
  for (const b of BEASTS) beasts[b].delta = round1(beasts[b].delta);
  for (const i of items) { delete i._cls; delete i._brief; }

  return { score, max: MAX, start: START, raw, beasts, items, warnings };
}
