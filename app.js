// 陽宅堪輿：畫面（五步驟：羅盤定位 → 房屋資料 → 內局格局 → 外局 → 報告）
//
// 規矩：
//   - 不連網、不存資料：不發任何網路請求、不用任何瀏覽器儲存，資料只在這一頁的記憶體裡。
//   - 使用者輸入與報告文字一律用 textContent（或 createTextNode）放進畫面；
//     唯一用 innerHTML 的是羅盤 SVG（compassMarkup 產生的固定字串，只吃數字）。
//   - 任何輸入改變都不會自動產生報告；報告產生後再改輸入，會提示「資料已改，請重新產生報告」。
//   - 計算全部交給 engine/report.mjs 的 analyze()，這支只負責收資料與畫畫面。
//   - 報告畫面一律照 report.sections（段落）與 report.remedies（化解清單）畫，不直接拿各模組的 items 來畫。
//   - 交運（10/04 稽核 D1）：盤依入住或大修那年的運起，星的旺衰依現在的運看；飛星圖標題兩個運都寫。
//   - 計分卡「未填」（V1）：以中間值計的項目一行（不含入住年）、入住年另一行、大門以向宮計再一行。
//   - 化解清單（V2）：併入同方位上一條的那幾條，第一行寫「已併入同方位的上一條」，不留空白。
import { compassMarkup } from './compass-view.mjs?v=981ddbf2';
import { analyze, demoInput } from './engine/report.mjs?v=981ddbf2';
import { ROOM_TYPES } from './engine/rooms.mjs?v=981ddbf2';
import { EXT_TYPES, beastPalaces } from './engine/exterior.mjs?v=981ddbf2';
import {
  mountOptions, describeFacing, PALACE_INFO, PALACES, ALL_PALACES, norm, palaceAt,
} from './engine/compass.mjs?v=981ddbf2';
import { PERIOD_NAMES, periodRange, periodOf, STAR_NAMES } from './engine/xuankong.mjs?v=981ddbf2';
// 比較新的匯出（PRISON_TEXT、qiOf）用整包讀：萬一改名也只是退回畫面自己的寫法，不會整頁載不起來
import * as XK from './engine/xuankong.mjs?v=981ddbf2';
import * as BZ from './engine/bazhai.mjs?v=981ddbf2';
// Z2：waterOk（這一宮能不能放水）用整包讀，引擎沒有這個匯出時畫面照舊
import * as RP from './engine/report.mjs?v=981ddbf2';
import { solarYearByLichun } from './engine/ming.mjs?v=981ddbf2';

/* ------------------------------------------------------------------ */
/* 常數                                                                 */
/* ------------------------------------------------------------------ */

const ROOM_KEYS = Object.keys(ROOM_TYPES);
const EXT_KEYS = Object.keys(EXT_TYPES);
const MOUNT_OPTS = mountOptions();
const MAX_PEOPLE = 6;
const OTHER_LABELS = ['配偶', '長輩', '小孩', '其他'];
const STEP_NAMES = { 1: '羅盤定位', 2: '房屋資料', 3: '內局格局', 4: '外局', 5: '報告' };
// 九宮格外圈 8 格：畫面角度 0°、45°…315°（從正上方順時針）→ [列, 欄]
const SLOT = [[0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0], [0, 0]];
const LEVEL_CLASS = { 吉: 'good', 凶: 'bad', 注意: 'warn', 平: 'flat' };
const GRADE_CLASS = { 上吉: 'good', 吉: 'good', 中平: 'flat', 欠佳: 'warn', 凶: 'bad' };
const BEAST_SIDE = { 朱雀: '前', 玄武: '後', 青龍: '左', 白虎: '右' };
const SOURCE_TEXT = { 指定: '手動指定元運', 入住年: '依入住年起盤', 今年: '沒填入住年，暫用今年推算', 預設: '暫以九運計' };
// 飛星圖標題「盤：八運（入住）」括號裡的字
const SOURCE_SHORT = { 指定: '手動指定', 入住年: '入住', 今年: '暫用今年', 預設: '預設' };
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WUTI_VALUES = ['none', 'self'];
// 入囚的說明（引擎有 PRISON_TEXT 就用引擎的）
const PRISON_FALLBACK = {
  mountain: '山星入囚：當運的山星飛進中宮，傳統認為人丁健康的旺氣被困住。',
  facing: '向星入囚：當運的向星飛進中宮，傳統認為財氣被困住。',
};
const PRISON_TIP = '可以先做：中宮保持開闊、明亮，少堆雜物。';
// X9：中宮的山星、向星或流年星有二黑、五黃（不當運）時宜靜，不寫明亮
const PRISON_TIP_25 = '可以先做：中宮保持開闊、安靜，少堆雜物。';
/** X9：這一宮的山星、向星或流年星有沒有不當運的二黑、五黃（跟引擎 is25 同一個判斷） */
function has25At(c, cur) {
  const is25 = (s) => (s === 5 && cur !== 5) || (s === 2 && cur !== 2);
  return !!c && [c.m, c.f, c.yearStar].some((s) => is25(Number(s)));
}
/** X9：入囚的說明遇到中宮二五，拿掉「有水可以囚不住」的「有水」 */
function prisonTextFor(t, c25) {
  const s = String(t || '');
  if (!c25) return s;
  return s.replace(/、天井或有水/g, '或天井').replace(/(?:或|、)?有水/g, '');
}
const EXT_GROUPS = [
  { title: '山（實）：當「山」看', test: (t) => t.form === '實' },
  { title: '水：真水與道路（虛水）', test: (t) => t.form === '真水' || t.form === '虛水' },
  { title: '空曠（虛）', test: (t) => t.form === '虛' },
  { title: '形煞', test: (t) => !!t.sha },
];
// 計分卡「未填」那一塊（V1）：入住年另起一行（報告沒給 periodNote 時照 LINE 的寫法），大門以向宮計再一行
const PERIOD_NOTE_FALLBACK = { 今年: '入住年未填，以今年推算元運', 預設: '入住年未填，元運暫以九運計' };
const DOOR_FACING_TEXT = '九宮沒填大門，大門以向宮計。';
const DOOR_CENTER_TEXT = '大門填在中宮無法定方位，大門以向宮計。';
// 化解清單（V2）：被併進同一方位另一條的，第一行寫這句，不留空白
const MERGED_TEXT = {
  prev: '已併入同方位的上一條',       // 同一宮前面已經有一條（併入的那一條排在前面）
  other: '已併入同方位的另一條',      // 報告標了併入，但同一宮前面沒有別條
  wholePrev: '已併入上一條全宅的化解',
  wholeOther: '已併入另一條全宅的化解',
};
const NO_ACTION = '照本段後面的化解通則調整';
const NO_SENSOR = '這台裝置沒有指南針，請用手機或實體羅盤量好再輸入度數';
const SENSOR_WAIT_MS = 3000;

/* ------------------------------------------------------------------ */
/* 小工具                                                               */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const round1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => String(Math.round((Number(n) || 0) * 10) / 10);
const bare = (s) => String(s || '').replace(/[，。、；：（）「」\s]/g, '');
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function today() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

/** 現在所屬的元運（以立春換年；引擎算不出來就退回西元年） */
function currentPeriod() {
  const t = today();
  let y = t.y;
  try {
    const sy = solarYearByLichun(t.y, t.m, t.d);
    if (Number.isInteger(sy)) y = sy;
  } catch { /* 退回西元年 */ }
  return periodOf(y);
}

/** 格局吉凶的短評：不用「損丁、損財」這類斷語（D9），括號改逗號 */
function flatLuck(s) {
  return String(s || '')
    .replace(/損丁/g, '不利人丁').replace(/損財/g, '不利財運')
    .replace(/（([^（）]+)）/g, '，$1');
}

// 青囊奧語「山上龍神不下水，水裡龍神不上山」：
// 下水＝當運山星跑到向方（不利人丁）；上山＝當運向星跑到坐方（不利財運）
const PATTERN_LUCK = { 下水: '不利人丁', 上山: '不利財運' };

/** 格局短評：下水一定寫「不利人丁」、上山一定寫「不利財運」（引擎的字樣放反也會被改正） */
function patternLuck(pattern, luck) {
  let s = flatLuck(luck);
  const want = PATTERN_LUCK[pattern];
  if (!want) return s;
  const wrong = want === '不利人丁' ? '不利財運' : '不利人丁';
  s = s.split(wrong).join(want);
  if (!s.includes(want)) s = s ? `${s}，${want}` : `欠佳，${want}`;
  return s;
}

/** 格局名稱：舊版的「其他」一律叫「令星不到」 */
function patternName(p) {
  const s = String(p || '');
  return s === '其他' || /待判/.test(s) ? '令星不到' : s;
}

/**
 * 建立元素。字串一律變成文字節點（不會被當成 HTML），所以報告文字、使用者輸入都安全。
 * props：class、style（物件）、on…（事件）、其他照 setAttribute。
 */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false || kid === '') continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function opt(value, text, selected = false) {
  const o = h('option', { value }, text);
  if (selected) o.selected = true;
  return o;
}

function cellName(p) { return p === '中' ? '中宮' : `${PALACE_INFO[p].dir}・${p}`; }
function dirOf(p) { return p === '中' ? '中宮' : `${PALACE_INFO[p].dir}方`; }
function palaceLabel(p) { return p === '中' ? '中宮（房子正中央）' : `${PALACE_INFO[p].dir}方（${p}宮）`; }
function blankText(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/* ------------------------------------------------------------------ */
/* 狀態（只在記憶體）                                                     */
/* ------------------------------------------------------------------ */

let pid = 0;
function newPerson(label) {
  pid += 1;
  return { id: pid, label, year: '', month: '', day: '', gender: '', bedPalace: '', bedHead: '' };
}
const emptyMap = (list) => Object.fromEntries(list.map((p) => [p, []]));

function freshState() {
  return {
    facingDeg: null,
    moveInYear: '',
    period: 'auto',
    floor: '',
    totalFloors: '',
    people: [newPerson('戶主')],
    rooms: emptyMap(ALL_PALACES),
    stoveMouth: '',
    exterior: emptyMap(PALACES),
    bazhaiMode: 'sit',
    tigua: 'auto',
    wuTi: 'none',       // 替卦遇五黃：'none' 五黃無替（預設）｜'self' 取本山替星（另一派）
  };
}

let S = freshState();
const ui = {
  step: 1,
  orient: 'door',     // 'door' 大門在下｜'north' 北在上
  roomSel: null,      // 第 3 步展開中的宮
  extSel: null,       // 第 4 步展開中的宮
  report: null,       // 最近一次的報告
  dirty: false,       // 報告產生後有沒有再改過輸入
  board: 'active',    // 飛星圖：'active' 主盤｜'other' 參考盤
  sensor: null,
};

const hasDeg = () => S.facingDeg !== null && Number.isFinite(S.facingDeg);

/** 報告產生後再改輸入：顯示「資料已改」 */
function changed() {
  if (ui.report && !ui.dirty) {
    ui.dirty = true;
    updateStale();
  }
}

/* ------------------------------------------------------------------ */
/* 九宮格方向：預設「大門在下」（向宮在下中），可切「北在上」                */
/* ------------------------------------------------------------------ */

/** 回傳 3×3 的宮名陣列。deg 為 null 或北在上時不旋轉；以 45° 為一格旋轉 */
function gridLayout(deg, orient = ui.orient) {
  let rot = 0;
  if (orient === 'door' && deg !== null && deg !== undefined && Number.isFinite(Number(deg))) {
    const fp = describeFacing(Number(deg)).facingPalace;
    rot = norm(PALACE_INFO[fp].deg - 180);
  }
  const g = [[null, null, null], [null, '中', null], [null, null, null]];
  SLOT.forEach(([r, c], k) => { g[r][c] = palaceAt(k * 45 + rot); });
  return g;
}

function orientText(deg) {
  if (deg === null || deg === undefined) return '還沒有大門朝向的度數，暫時北在上；第 1 步填好度數後就能改成大門在下。';
  const cx = describeFacing(deg);
  if (ui.orient === 'north') return '目前北在上，跟一般地圖相同。';
  return `目前大門在下：下方是向（${PALACE_INFO[cx.facingPalace].dir}），上方是坐（${PALACE_INFO[cx.sittingPalace].dir}），跟拿著平面圖從大門走進去的方向一致。`;
}
const orientBtnText = () => (ui.orient === 'door' ? '改成北在上' : '改成大門在下');

function renderOrient() {
  const deg = hasDeg() ? S.facingDeg : null;
  const text = orientText(deg);
  $('#orient-note').textContent = text;
  for (const el of $$('.orient-note-copy')) el.textContent = text;
  for (const b of [$('#btn-orient'), ...$$('.btn-orient-alt')]) {
    b.textContent = orientBtnText();
    b.disabled = !hasDeg();
  }
}

function toggleOrient() {
  ui.orient = ui.orient === 'door' ? 'north' : 'door';
  renderOrient();
  renderRoomGrid();
  renderExtGrid();
  renderChart();
}

/* ------------------------------------------------------------------ */
/* 步驟 1：羅盤                                                          */
/* ------------------------------------------------------------------ */

function setDeg(v, { fromInput = false } = {}) {
  let d = null;
  if (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) {
    d = round1(norm(Number(v)));
    if (d >= 360) d = 0;
  }
  const isNew = d !== S.facingDeg;
  S.facingDeg = d;
  if (!fromInput) $('#deg-input').value = d === null ? '' : d.toFixed(1);
  renderCompass();
  if (isNew) changed();
}

function renderCompass() {
  // compassMarkup 只吃數字、回傳固定的 SVG 字串，可以用 innerHTML
  $('#compass-svg').innerHTML = compassMarkup(hasDeg() ? S.facingDeg : null);
  renderFacingNote();
  const ms = $('#mount-select');
  if (!hasDeg()) ms.value = '';
  else {
    const cx = describeFacing(S.facingDeg);
    const o = MOUNT_OPTS.find((m) => m.mount === cx.facing.mount);
    ms.value = o ? String(o.deg) : '';
  }
  renderOrient();
}

function renderFacingNote() {
  const box = $('#facing-note');
  box.replaceChildren();
  box.classList.remove('is-danger', 'is-jian');
  if (!hasDeg()) {
    box.append(h('p', { class: 'fn-empty' }, '還沒有度數：輸入度數、選 24 山，或用手機指南針量。'));
    return;
  }
  const cx = describeFacing(S.facingDeg);
  const f = cx.facing;
  const off = f.abs.toFixed(1);
  box.append(
    h('p', { class: 'fn-name' }, cx.fullName),
    h('p', { class: 'fn-plain' }, `${cx.plain}｜${cx.name}｜向 ${cx.facingDeg.toFixed(1)}°、坐 ${cx.sittingDeg.toFixed(1)}°`),
  );
  if (cx.kind === '正向') {
    box.append(h('p', { class: 'fn-kind' }, `正向：距${f.mount}山中線 ${off}°，玄空用下卦起盤。`));
  } else if (cx.kind === '兼向') {
    box.classList.add('is-jian');
    box.append(h('p', { class: 'fn-kind' }, `兼向：偏離${f.mount}山中線 ${off}°（往${f.towards}），玄空用替卦起盤，下卦也會一起列出。`));
  } else {
    box.classList.add('is-danger');
    const kong = cx.kongwang === '大空亡' ? '大空亡（跨兩卦，又叫出卦）' : '小空亡（同一卦的兩山之間）';
    box.append(
      h('p', { class: 'fn-warn' }, '騎線空亡，建議重新量；量不準時兩個山向都看。'),
      h('p', { class: 'fn-kind' }, `偏離${f.mount}山中線 ${off}°，落在${f.mount}、${f.towards}兩山交界，屬${kong}。`),
    );
    const pair = [f.mount, f.towards].map((m) => MOUNT_OPTS.find((o) => o.mount === m)).filter(Boolean);
    box.append(h('div', { class: 'btn-row fn-pair' }, pair.map((o) => h('button', {
      type: 'button', class: 'btn btn-mini', 'data-deg': String(o.deg), onclick: () => setDeg(o.deg),
    }, `改看${o.mount}山（${o.deg}°）`))));
  }
}

/* ---- 手機指南針 ---- */

function sensorMsg(text, bad = false) {
  const el = $('#sensor-msg');
  el.textContent = text || '';
  el.classList.toggle('is-bad', !!bad);
}

// 每次開始或停止都加一；等權限回來時若號碼已經變了（連按兩下、或已離開第 1 步），就不再掛監聽
let sensorSeq = 0;

async function startSensor() {
  stopSensor();
  const token = ++sensorSeq;
  const DOE = window.DeviceOrientationEvent;
  if (typeof DOE === 'undefined') {
    sensorMsg(NO_SENSOR, true);
    return;
  }
  // iOS 13 以後（以及新版 Chromium）要先問權限（必須在按下按鈕的當下呼叫）
  if (typeof DOE.requestPermission === 'function') {
    let res = 'denied';
    sensorMsg('正在取得指南針權限…');
    try { res = await DOE.requestPermission(); } catch { res = 'denied'; }
    if (token !== sensorSeq) return;
    if (res !== 'granted') {
      sensorMsg(`${NO_SENSOR}（沒有取得指南針權限）`, true);
      return;
    }
  }
  const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  const s = { type, x: 0, y: 0, n: 0, last: null, timer: 0, frame: 0, handler: null };
  s.handler = (e) => {
    let hd = null;
    if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
      hd = e.webkitCompassHeading;                    // iOS：手機上緣指的方位
    } else if ((e.absolute === true || type === 'deviceorientationabsolute')
      && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
      hd = 360 - e.alpha;                             // 絕對方位事件才準；相對的不採用
    }
    if (hd === null) return;
    const r = (norm(hd) * Math.PI) / 180;
    // 用向量做平滑，避免在 359°／0° 之間來回跳
    s.x = s.n ? s.x * 0.75 + Math.cos(r) * 0.25 : Math.cos(r);
    s.y = s.n ? s.y * 0.75 + Math.sin(r) * 0.25 : Math.sin(r);
    s.n += 1;
    let v = round1(norm((Math.atan2(s.y, s.x) * 180) / Math.PI));
    if (v >= 360) v = 0;
    s.last = v;
    if (!s.frame) s.frame = requestAnimationFrame(() => { s.frame = 0; showSensorReading(); });
  };
  window.addEventListener(type, s.handler);
  ui.sensor = s;
  $('#sensor-panel').hidden = false;
  $('#sensor-value').textContent = '等待讀數…';
  $('#sensor-mount').textContent = '';
  $('#btn-sensor-lock').disabled = true;
  sensorMsg('手機直拿、放平，上緣對準門外，等數字穩定再按「鎖定這個度數」。');
  s.timer = setTimeout(() => {
    if (ui.sensor === s && s.last === null) {
      stopSensor();
      sensorMsg(NO_SENSOR, true);
    }
  }, SENSOR_WAIT_MS);
}

function showSensorReading() {
  const s = ui.sensor;
  if (!s || s.last === null) return;
  const cx = describeFacing(s.last);
  $('#sensor-value').textContent = `${s.last.toFixed(1)}°`;
  $('#sensor-mount').textContent = `${cx.fullName}（${cx.plain}）${cx.kongwang ? '・騎線' : ''}`;
  $('#btn-sensor-lock').disabled = false;
}

function stopSensor() {
  sensorSeq += 1;
  const s = ui.sensor;
  if (s) {
    window.removeEventListener(s.type, s.handler);
    clearTimeout(s.timer);
    if (s.frame) cancelAnimationFrame(s.frame);
  }
  ui.sensor = null;
  const panel = $('#sensor-panel');
  if (panel) panel.hidden = true;
}

function lockSensor() {
  const s = ui.sensor;
  if (!s || s.last === null) return;
  const v = s.last;
  stopSensor();
  setDeg(v);
  sensorMsg(`已鎖定 ${v.toFixed(1)}°。要重量就再按一次「用手機指南針量」。`);
}

/* ------------------------------------------------------------------ */
/* 步驟 2：房屋資料                                                      */
/* ------------------------------------------------------------------ */

function rangeText(p) {
  const r = periodRange(p);
  return p <= 3 ? `${r.start}–${r.end}、${r.start + 180}–${r.end + 180}` : `${r.start}–${r.end}`;
}

function validYear(v) {
  const n = Number(blankText(v));
  return blankText(v) !== '' && Number.isInteger(n) && n >= 1864 && n <= 2200 ? n : null;
}

/** 盤運跟現在的運不同時，補一句「盤照舊、旺衰看現在」 */
function changedText(p) {
  const cur = currentPeriod();
  return p === cur
    ? `現在也是${CN[cur]}運。`
    : `現在已入${CN[cur]}運：盤仍用${CN[p]}運起，星的旺衰改看${CN[cur]}運。`;
}

function renderPeriodNote() {
  const note = $('#period-note');
  if (S.period !== 'auto') {
    const p = Number(S.period);
    const y = validYear(S.moveInYear);
    let t = `手動指定：${PERIOD_NAMES[p]}（${rangeText(p)}），以這一運起盤。`;
    if (y && periodOf(y) !== p) t += `入住年 ${y} 屬${PERIOD_NAMES[periodOf(y)]}，請確認是不是有大修換運。`;
    note.textContent = t + changedText(p);
    return;
  }
  const y = validYear(S.moveInYear);
  if (y) {
    const p = periodOf(y);
    note.textContent = `自動：依入住年 ${y} → ${PERIOD_NAMES[p]}（${rangeText(p)}）。${changedText(p)}`;
  } else {
    const ty = today().y;
    const p = periodOf(ty);
    note.textContent = blankText(S.moveInYear)
      ? `入住年要填 4 位數的西元年；目前暫用今年 ${ty} → ${PERIOD_NAMES[p]}。`
      : `自動：還沒填入住年，暫用今年 ${ty} → ${PERIOD_NAMES[p]}（${rangeText(p)}）；舊房子請補填。`;
  }
}

function renderModeList() {
  for (const li of $$('.mode-list li')) li.classList.toggle('is-current', li.dataset.mode === S.bazhaiMode);
}

/** 畫面上的稱呼（重複的加編號：小孩、小孩2） */
function personLabels() {
  const count = {};
  return S.people.map((p, i) => {
    const base = i === 0 ? '戶主' : (OTHER_LABELS.includes(p.label) ? p.label : '其他');
    count[base] = (count[base] || 0) + 1;
    return count[base] > 1 ? `${base}${count[base]}` : base;
  });
}

function renderPeople() {
  const list = $('#people-list');
  list.replaceChildren();
  S.people.forEach((p, i) => {
    const labelSel = h('select', { id: `p-label-${i}`, class: 'p-label', 'data-field': 'label', 'aria-label': `第 ${i + 1} 位的稱呼` });
    if (i === 0) {
      labelSel.append(opt('戶主', '戶主', true));
      labelSel.disabled = true;
    } else {
      for (const l of OTHER_LABELS) labelSel.append(opt(l, l, p.label === l));
    }
    const gender = h('select', { id: `p-gender-${i}`, class: 'p-gender', 'data-field': 'gender' },
      opt('', '請選', !p.gender), opt('M', '男', p.gender === 'M'), opt('F', '女', p.gender === 'F'));
    const num = (field, id, ph, min, max, label, cls = '') => h('label', { class: `p-field ${cls}`, for: id },
      h('span', { class: 'p-field-label' }, label),
      h('input', {
        id, class: `p-${field}`, 'data-field': field, type: 'number', inputmode: 'numeric',
        min: String(min), max: String(max), step: '1', placeholder: ph, value: blankText(p[field]), autocomplete: 'off',
      }));
    const row = h('div', { class: 'person', 'data-idx': String(i) },
      h('div', { class: 'person-head' },
        h('span', { class: 'person-no' }, String(i + 1)),
        h('label', { class: 'sr-only', for: `p-label-${i}` }, '稱呼'),
        labelSel,
        i === 0 ? h('span', { class: 'person-note' }, '第一位固定是戶主') : null,
        (i > 0 || S.people.length > 1) ? h('button', {
          type: 'button', class: 'btn btn-mini btn-del', 'data-del': String(i), 'aria-label': `刪除第 ${i + 1} 位`,
        }, '刪除') : null),
      h('div', { class: 'person-fields' },
        num('year', `p-year-${i}`, '例：1980', 1900, 2099, '出生年（西元）', 'p-wide'),
        h('label', { class: 'p-field', for: `p-gender-${i}` }, h('span', { class: 'p-field-label' }, '性別'), gender),
        num('month', `p-month-${i}`, '選填', 1, 12, '出生月'),
        num('day', `p-day-${i}`, '選填', 1, 31, '出生日')));
    list.append(row);
  });
  const add = $('#btn-add-person');
  add.disabled = S.people.length >= MAX_PEOPLE;
  add.textContent = S.people.length >= MAX_PEOPLE ? `已經 ${MAX_PEOPLE} 位（上限）` : '新增一位居住者';
}

function onPeopleInput(e) {
  const row = e.target.closest('.person');
  const field = e.target.dataset.field;
  if (!row || !field) return;
  const i = Number(row.dataset.idx);
  if (!S.people[i]) return;
  S.people[i][field] = e.target.value;
  if (field === 'label') renderBedList();
  changed();
}

function addPerson() {
  if (S.people.length >= MAX_PEOPLE) return;
  const used = S.people.map((p) => p.label);
  S.people.push(newPerson(used.includes('配偶') ? '小孩' : '配偶'));
  renderPeople();
  renderBedList();
  $('#people-msg').textContent = `已新增第 ${S.people.length} 位。`;
  const y = $(`#p-year-${S.people.length - 1}`);
  if (y) y.focus();
  changed();
}

function deletePerson(i) {
  if (!S.people[i]) return;
  S.people.splice(i, 1);
  let msg = `已刪除第 ${i + 1} 位。`;
  if (!S.people.length) S.people.push(newPerson('戶主'));
  if (i === 0) {
    S.people[0].label = '戶主';
    msg += '原本的第 2 位改成戶主。';
  }
  renderPeople();
  renderBedList();
  $('#people-msg').textContent = msg;
  changed();
}

/* ------------------------------------------------------------------ */
/* 步驟 3：內局九宮                                                      */
/* ------------------------------------------------------------------ */

function renderRoomGrid() {
  const grid = $('#grid-rooms');
  grid.replaceChildren();
  const deg = hasDeg() ? S.facingDeg : null;
  const cx = deg === null ? null : describeFacing(deg);
  for (const row of gridLayout(deg)) {
    for (const p of row) {
      const rooms = S.rooms[p] || [];
      const tags = [];
      if (cx && p === cx.facingPalace) tags.push(h('span', { class: 'g-tag tag-face' }, '向'));
      if (cx && p === cx.sittingPalace) tags.push(h('span', { class: 'g-tag tag-sit' }, '坐'));
      const label = `${palaceLabel(p)}${rooms.length ? `，已放：${rooms.join('、')}` : '，還沒放房間'}`;
      grid.append(h('button', {
        type: 'button',
        class: `g-cell${p === '中' ? ' is-center' : ''}${ui.roomSel === p ? ' is-open' : ''}${rooms.length ? ' has-items' : ''}`,
        'data-palace': p,
        'aria-expanded': ui.roomSel === p ? 'true' : 'false',
        'aria-controls': 'room-picker',
        'aria-label': label,
        onclick: () => openRoomPicker(p),
      },
      h('span', { class: 'g-head' }, h('span', { class: 'g-name' }, cellName(p)), tags),
      rooms.length
        ? h('span', { class: 'g-items' }, rooms.map((r) => h('span', { class: 'g-room' },
          h('b', { class: 'g-icon', 'aria-hidden': 'true' }, ROOM_TYPES[r].icon), r)))
        : h('span', { class: 'g-empty' }, '點這裡加房間')));
    }
  }
}

function openRoomPicker(p) {
  ui.roomSel = ui.roomSel === p ? null : p;
  $('#room-hint').textContent = '';
  renderRoomGrid();
  renderRoomPicker();
  if (ui.roomSel) {
    const box = $('#room-picker');
    box.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
}

function renderRoomPicker() {
  const p = ui.roomSel;
  const box = $('#room-picker');
  if (!p) { box.hidden = true; return; }
  box.hidden = false;
  $('#room-picker-title').textContent = `${palaceLabel(p)}有哪些房間？（可複選）`;
  const chips = $('#room-chips');
  chips.replaceChildren();
  for (const k of ROOM_KEYS) {
    const t = ROOM_TYPES[k];
    const on = S.rooms[p].includes(k);
    const elsewhere = t.single && !on ? ALL_PALACES.find((q) => q !== p && S.rooms[q].includes(k)) : null;
    chips.append(h('button', {
      type: 'button', class: `chip${on ? ' is-on' : ''}`, 'data-room': k, 'aria-pressed': on ? 'true' : 'false',
      onclick: () => toggleRoom(p, k),
    },
    h('b', { class: 'chip-icon', 'aria-hidden': 'true' }, t.icon), t.label,
    elsewhere ? h('small', { class: 'chip-where' }, `（目前在${dirOf(elsewhere)}）`) : null));
  }
}

function toggleRoom(p, k) {
  const t = ROOM_TYPES[k];
  let hint = '';
  if (S.rooms[p].includes(k)) {
    S.rooms[p] = S.rooms[p].filter((x) => x !== k);
  } else {
    if (t.single) {
      for (const q of ALL_PALACES) {
        if (q !== p && S.rooms[q].includes(k)) {
          S.rooms[q] = S.rooms[q].filter((x) => x !== k);
          hint = `${t.label}只能有一個，已從${palaceLabel(q)}移到${palaceLabel(p)}。`;
        }
      }
    }
    S.rooms[p] = [...S.rooms[p], k].sort((a, b) => ROOM_KEYS.indexOf(a) - ROOM_KEYS.indexOf(b));
    if (k === '大門' && p === '中') hint = '大門放在中宮無法判斷方位，報告會改用向宮當大門。';
  }
  $('#room-hint').textContent = hint;
  renderRoomGrid();
  renderRoomPicker();
  const again = $(`#room-chips [data-room="${CSS.escape(k)}"]`);
  if (again) again.focus({ preventScroll: true });
  changed();
}

function renderStoveMouth() {
  const sel = $('#stove-mouth');
  sel.replaceChildren(opt('', '不知道', !S.stoveMouth),
    ...PALACES.map((p) => opt(p, `${PALACE_INFO[p].dir}（${p}）`, S.stoveMouth === p)));
}

function renderBedList() {
  const box = $('#bed-list');
  box.replaceChildren();
  const labels = personLabels();
  box.append(h('h4', { class: 'sub-title' }, '每位居住者的床位'));
  S.people.forEach((p, i) => {
    const bp = h('select', { id: `bed-palace-${i}`, class: 'bed-palace', 'data-field': 'bedPalace' },
      opt('', '不知道', !p.bedPalace),
      ...ALL_PALACES.map((q) => opt(q, q === '中' ? '中宮' : `${PALACE_INFO[q].dir}（${q}宮）`, p.bedPalace === q)));
    const bh = h('select', { id: `bed-head-${i}`, class: 'bed-head', 'data-field': 'bedHead' },
      opt('', '不知道', !p.bedHead),
      ...PALACES.map((q) => opt(q, `${PALACE_INFO[q].dir}（${q}）`, p.bedHead === q)));
    box.append(h('div', { class: 'bed-row', 'data-idx': String(i) },
      h('span', { class: 'bed-who' }, labels[i]),
      h('label', { class: 'p-field', for: `bed-palace-${i}` }, h('span', { class: 'p-field-label' }, '床在哪一宮'), bp),
      h('label', { class: 'p-field', for: `bed-head-${i}` }, h('span', { class: 'p-field-label' }, '床頭朝向'), bh)));
  });
}

function onBedInput(e) {
  const row = e.target.closest('.bed-row');
  const field = e.target.dataset.field;
  if (!row || !field) return;
  const i = Number(row.dataset.idx);
  if (!S.people[i]) return;
  S.people[i][field] = e.target.value;
  changed();
}

/* ------------------------------------------------------------------ */
/* 步驟 4：外局                                                          */
/* ------------------------------------------------------------------ */

function beastMap(deg) {
  if (deg === null || deg === undefined) return {};
  const b = beastPalaces(deg);
  return Object.fromEntries(Object.entries(b).map(([beast, p]) => [p, beast]));
}

function renderExtGrid() {
  const grid = $('#grid-ext');
  grid.replaceChildren();
  const deg = hasDeg() ? S.facingDeg : null;
  const beasts = beastMap(deg);
  for (const row of gridLayout(deg)) {
    for (const p of row) {
      if (p === '中') {
        grid.append(h('div', { class: 'g-cell is-center is-home' }, h('span', { class: 'g-home' }, '本宅')));
        continue;
      }
      const items = S.exterior[p] || [];
      const beast = beasts[p];
      const labels = items.map((k) => EXT_TYPES[k].label);
      grid.append(h('button', {
        type: 'button',
        class: `g-cell${ui.extSel === p ? ' is-open' : ''}${items.length ? ' has-items' : ''}`,
        'data-palace': p,
        'aria-expanded': ui.extSel === p ? 'true' : 'false',
        'aria-controls': 'ext-picker',
        'aria-label': `${palaceLabel(p)}${beast ? `，${beast}（${BEAST_SIDE[beast]}）` : ''}${labels.length ? `，已標：${labels.join('、')}` : '，還沒標'}`,
        onclick: () => openExtPicker(p),
      },
      h('span', { class: 'g-head' }, h('span', { class: 'g-name' }, cellName(p)),
        beast ? h('span', { class: `g-tag tag-beast beast-${BEAST_SIDE[beast]}` }, `${beast}・${BEAST_SIDE[beast]}`) : null),
      labels.length
        ? h('span', { class: 'g-items' }, labels.map((l, j) => h('span', {
          class: `g-ext${EXT_TYPES[items[j]].sha ? ' is-sha' : ''}`,
        }, l)))
        : h('span', { class: 'g-empty' }, '點這裡標外局')));
    }
  }
}

function openExtPicker(p) {
  ui.extSel = ui.extSel === p ? null : p;
  renderExtGrid();
  renderExtPicker();
  if (ui.extSel) $('#ext-picker').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function renderExtPicker() {
  const p = ui.extSel;
  const box = $('#ext-picker');
  if (!p) { box.hidden = true; return; }
  box.hidden = false;
  const beast = beastMap(hasDeg() ? S.facingDeg : null)[p];
  $('#ext-picker-title').textContent = `${palaceLabel(p)}${beast ? `・${beast}（${BEAST_SIDE[beast]}方）` : ''}看得到什麼？可複選`;
  const wrap = $('#ext-chips');
  wrap.replaceChildren();
  for (const g of EXT_GROUPS) {
    const keys = EXT_KEYS.filter((k) => g.test(EXT_TYPES[k]));
    if (!keys.length) continue;
    wrap.append(h('div', { class: 'chip-group' },
      h('p', { class: 'chip-group-title' }, g.title),
      h('div', { class: 'chips' }, keys.map((k) => {
        const on = S.exterior[p].includes(k);
        return h('button', {
          type: 'button', class: `chip${on ? ' is-on' : ''}${EXT_TYPES[k].sha ? ' is-sha' : ''}`,
          'data-ext': k, 'aria-pressed': on ? 'true' : 'false', onclick: () => toggleExt(p, k),
        }, EXT_TYPES[k].label);
      }))));
  }
}

function toggleExt(p, k) {
  if (S.exterior[p].includes(k)) S.exterior[p] = S.exterior[p].filter((x) => x !== k);
  else S.exterior[p] = [...S.exterior[p], k].sort((a, b) => EXT_KEYS.indexOf(a) - EXT_KEYS.indexOf(b));
  renderExtGrid();
  renderExtPicker();
  const again = $(`#ext-chips [data-ext="${CSS.escape(k)}"]`);
  if (again) again.focus({ preventScroll: true });
  changed();
}

/* ------------------------------------------------------------------ */
/* 組輸入、產生報告                                                       */
/* ------------------------------------------------------------------ */

function buildInput() {
  const labels = personLabels();
  const filled = (p) => blankText(p.year) !== '' || p.gender || p.month !== '' || p.bedPalace || p.bedHead;
  let people = [];
  if (S.people.some(filled)) {
    // 第一位固定是戶主：就算沒填完也要放第一位，其他人才不會被當成戶主
    people = S.people
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i === 0 || filled(p))
      .map(({ p, i }) => ({
        label: labels[i],
        year: blankText(p.year) === '' ? null : blankText(p.year),
        month: blankText(p.month) === '' ? null : blankText(p.month),
        day: blankText(p.day) === '' ? null : blankText(p.day),
        gender: p.gender || null,
        bedPalace: p.bedPalace || null,
        bedHead: p.bedHead || null,
      }));
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  return {
    facingDeg: S.facingDeg,
    period: S.period === 'auto' ? null : Number(S.period),
    moveInYear: blankText(S.moveInYear) === '' ? null : blankText(S.moveInYear),
    floor: blankText(S.floor) === '' ? null : blankText(S.floor),
    totalFloors: blankText(S.totalFloors) === '' ? null : blankText(S.totalFloors),
    date: today(),
    people,
    rooms: clone(S.rooms),
    stoveMouth: S.stoveMouth || null,
    exterior: clone(S.exterior),
    options: { bazhaiMode: S.bazhaiMode, tigua: S.tigua, wuTi: WUTI_VALUES.includes(S.wuTi) ? S.wuTi : 'none' },
  };
}

function generate() {
  const msg = $('#analyze-msg');
  msg.replaceChildren();
  if (!hasDeg()) {
    msg.append(
      h('p', { class: 'msg-bad' }, '還沒有大門朝向的度數，請先回第 1 步量好或輸入度數。'),
      h('button', { type: 'button', class: 'btn btn-line', onclick: () => { goStep(1); $('#deg-input').focus(); } }, '回第 1 步'),
    );
    return false;
  }
  let rep = null;
  try { rep = analyze(buildInput()); } catch { rep = null; }
  if (!rep || !rep.score) {
    msg.append(h('p', { class: 'msg-bad' }, '報告沒有產生出來，請檢查填的資料後再試一次。'));
    return false;
  }
  ui.report = rep;
  ui.dirty = false;
  ui.board = 'active';
  renderReport();
  return true;
}

function updateStale() {
  const stale = !!(ui.report && ui.dirty);
  $('#stale-note').hidden = !stale;
  $('#report').classList.toggle('is-stale', stale);
  $('#btn-analyze').textContent = ui.report ? '重新產生報告' : '產生報告';
  const s5 = $('#stepper [data-step="5"]');
  if (s5) s5.classList.toggle('is-stale', stale);
}

/* ------------------------------------------------------------------ */
/* 報告畫面                                                              */
/* ------------------------------------------------------------------ */

function renderReport() {
  const r = ui.report;
  const root = $('#report');
  root.replaceChildren();
  if (!r) {
    root.hidden = true;
    document.body.classList.remove('has-report');
    updateStale();
    return;
  }
  root.hidden = false;
  document.body.classList.add('has-report');
  const sections = Array.isArray(r.sections) ? r.sections : [];
  // warningCard、tocNav 可能是 null；append(null) 會塞進「null」字樣，所以先濾掉
  root.append(...[
    reportHead(r),
    scoreCard(r),
    highlightCard(r),
    warningCard(r),
    h('section', { class: 'card chart-card', id: 'chart-card', 'aria-label': '九宮飛星圖' }),
    tocNav(sections),
    ...sections.map((s) => sectionCard(s, r)),
    lineCard(r),
  ].filter(Boolean));
  $('#line-text').value = String(r.lineText || '');
  renderChart();
  updateStale();
}

/** 盤運與現在的運：{ build, cur, changed, src }（舊版報告沒有 curPeriod 時，現在＝盤運） */
function periodsOf(r) {
  const cx = r.compass || {};
  const xk = r.xuankong || {};
  const build = Number(cx.period) || null;
  const cur = Number(xk.curPeriod ?? cx.curPeriod) || build;
  const changed = typeof xk.changed === 'boolean' ? xk.changed : (!!build && !!cur && build !== cur);
  return { build, cur, changed, src: SOURCE_SHORT[cx.periodSource] || '入住' };
}

/** 「盤：八運（入住）／現在：九運」 */
function periodTitle(r) {
  const { build, cur, src } = periodsOf(r);
  if (!build) return '';
  return `盤：${CN[build]}運（${src}）／現在：${CN[cur] || CN[build]}運`;
}

/** 玄空格局一句：現在的格局（交運時另寫入住時的格局） */
function patternLine(r) {
  const xk = r.xuankong || {};
  if (!xk.pattern) return '';
  const { build, cur, changed } = periodsOf(r);
  const name = patternName(xk.pattern);
  const luck = patternLuck(name, (xk.patternInfo && xk.patternInfo.luck) || '');
  const now = `${name}${luck ? `（${luck}）` : ''}`;
  if (!changed) return `玄空：${xk.activeName || ''}盤，${now}`;
  const bPat = patternName(xk.buildPattern || (xk.buildFit && xk.buildFit.pattern) || '');
  return `玄空：${xk.activeName || ''}盤，現在${CN[cur]}運是${now}${bPat ? `；入住時${CN[build]}運是${bPat}` : ''}`;
}

/**
 * 報告頁首：坐向、元運、交運（盤 X 運／現在 Y 運）、格局、八宅。
 * 坐向是預設值（compass.tentative）時，另起一行琥珀色「坐向暫定，請實際量測」（U4）。
 */
function reportHead(r) {
  const cx = r.compass || {};
  const xk = r.xuankong || {};
  const t = today();
  const meta = (text) => h('p', { class: 'report-meta' }, text);
  const rows = [];
  if (cx.fullName) {
    rows.push(meta(`${cx.fullName}（${cx.plain}，向 ${fmt(cx.facingDeg)}°${cx.tentative ? '・暫定' : ''}）`));
  }
  if (cx.tentative) {
    rows.push(h('p', { id: 'head-tentative', class: 'report-tentative', role: 'note' },
      h('b', {}, '坐向暫定，請實際量測'),
      '：這份報告的大門度數不是實際量到的，站在大門內朝外量好後，再產生一次報告。'));
  }
  if (cx.periodName) {
    const pr = cx.periodRange || {};
    rows.push(meta(`${cx.periodName}（${pr.start}–${pr.end}）・${SOURCE_TEXT[cx.periodSource] || ''}${xk.activeName ? `・玄空用${xk.activeName}盤` : ''}`));
  }
  const pt = periodTitle(r);
  if (pt) {
    const { changed } = periodsOf(r);
    rows.push(h('p', { id: 'head-period', class: `report-period${changed ? ' is-changed' : ''}` },
      h('span', { class: 'head-period-main' }, pt),
      changed ? h('span', { class: 'head-period-tag' }, '已交運，還沒換天心') : null));
  }
  const pl = patternLine(r);
  if (pl) rows.push(h('p', { id: 'head-pattern', class: 'report-meta' }, pl));
  if (r.bazhai && r.bazhai.house) rows.push(meta(`八宅：${r.bazhai.house.label}・${r.bazhai.mode === 'door' ? '門上起伏位' : '坐山立極'}`));
  return h('header', { class: 'card report-head' },
    h('h3', { class: 'report-title' }, '陽宅堪輿報告'),
    rows,
    h('p', { class: 'report-meta report-date' }, `產生日期：${t.y}/${t.m}/${t.d}　由 中信房屋 阿良 製作`));
}

/**
 * 計分卡「未填」那一塊要寫什麼（V1）：
 *   mid    以中間值計的項目＝r.missing 濾掉「入住年」（入住年不是以中間值計），也濾掉講大門的（另起一行）；
 *   period r.periodNote（入住年沒填時元運怎麼推）；舊版報告沒有 periodNote、missing 卻有入住年時，照 LINE 的寫法補；
 *   door   九宮沒填大門（或大門填在中宮）→ 大門以向宮計：看 r.input.doorSource（'向宮'｜'中宮'），或 r.missing 裡有提到大門。
 */
function missingInfo(r) {
  const raw = Array.isArray(r.missing) ? r.missing.map(blankText).filter(Boolean) : [];
  const isDoor = (x) => /大門/.test(x);
  const mid = raw.filter((x) => x !== '入住年' && !isDoor(x));
  const cx = r.compass || {};
  let period = blankText(r.periodNote);
  if (!period && raw.includes('入住年')) period = PERIOD_NOTE_FALLBACK[cx.periodSource] || PERIOD_NOTE_FALLBACK.今年;
  const inp = r.input || {};
  // G9：引擎的 doorSource 多了「中宮」（大門填在中宮，以向宮計），也算大門以向宮計
  const doorFromFacing = inp.doorSource === '向宮' || inp.doorSource === '中宮' || raw.some(isDoor);
  const doorInCenter = inp.doorSource === '中宮' || !!(inp.rooms && Array.isArray(inp.rooms['中']) && inp.rooms['中'].includes('大門'));
  return { mid, period, door: doorFromFacing ? (doorInCenter ? DOOR_CENTER_TEXT : DOOR_FACING_TEXT) : '' };
}

/** 計分卡「未填」那一塊：三行各自一行（中間值、入住年、大門），都沒有就不畫 */
function missingBlock(r) {
  const { mid, period, door } = missingInfo(r);
  if (!mid.length && !period && !door) return null;
  const dot = (s) => (/[。！？]$/.test(s) ? s : `${s}。`);
  return h('div', { id: 'score-missing', class: 'score-missing', role: 'note' },
    mid.length ? h('p', { id: 'score-missing-mid', class: 'sm-line' }, `未填、以中間值計：${mid.join('、')}。`) : null,
    period ? h('p', { id: 'score-period-note', class: 'sm-line' }, dot(period)) : null,
    door ? h('p', { id: 'score-door', class: 'sm-line' }, door) : null);
}

function scoreCard(r) {
  const sc = r.score || { total: 0, parts: [] };
  const gcls = GRADE_CLASS[sc.grade] || 'flat';
  const bad =Number.isInteger(sc.badPalaces) && sc.badPalaces > 0 ? `目前凶 ${sc.badPalaces} 宮，見「九宮逐宮」一段。` : '';
  return h('section', { class: 'card score-card', 'aria-label': '總分' },
    h('div', { class: 'score-main' },
      h('p', { id: 'score-total', class: `score-total grade-${gcls}` },
        h('span', { class: 'score-num' }, String(sc.total)), h('span', { class: 'score-unit' }, '分')),
      h('div', { class: 'score-side' },
        h('p', { id: 'score-grade', class: `score-grade grade-${gcls}` }, sc.gradeLabel || sc.grade || ''),
        h('p', { class: 'score-text' }, sc.gradeText || ''))),
    h('ul', { class: 'bars' }, (sc.parts || []).map((p) => {
      const pct = p.max ? Math.max(0, Math.min(100, (Number(p.score) / p.max) * 100)) : 0;
      return h('li', { class: 'bar', 'data-part': p.id },
        h('span', { class: 'bar-label' }, p.label),
        h('span', { class: 'bar-track', 'aria-hidden': 'true' }, h('span', { class: 'bar-fill', style: { width: `${pct}%` } })),
        h('span', { class: 'bar-val' }, `${fmt(p.score)}／${p.max}`));
    })),
    h('p', { id: 'score-note', class: 'score-note' }, `${sc.note || '九宮逐宮吉凶另列，不計入總分。'}${bad}`),
    missingBlock(r),
    h('p', { class: 'hint' }, '分數是依固定規則加減的參考值，不是機率；不同門派的結論可能不同。'));
}

/**
 * 三優三注意（F2）：用引擎標好「看法不同」的版本 highlights.marked（跟 LINE 那兩段同一套標記）；
 * 舊版引擎沒有 marked 才退回 highlights.good／bad。
 */
function highlightCard(r) {
  const hl = r.highlights || { good: [], bad: [] };
  const mk = hl.marked && Array.isArray(hl.marked.good) && Array.isArray(hl.marked.bad) ? hl.marked : null;
  const col = (cls, title, list, empty) => h('div', { class: `hl-col ${cls}` },
    h('h3', { class: 'card-title' }, title),
    list && list.length ? h('ol', { class: 'hl-list' }, list.map((t) => h('li', {}, t))) : h('p', { class: 'hint' }, empty));
  return h('section', { class: 'card hl-card', 'aria-label': '三優三注意' },
    col('hl-good', '三個優點', mk ? mk.good : hl.good, '目前沒有明顯的加分項目。'),
    col('hl-bad', '三個要注意', mk ? mk.bad : hl.bad, '目前沒有明顯的扣分項目。'));
}

function warningCard(r) {
  const list = Array.isArray(r.warnings) ? r.warnings : [];
  if (!list.length && !r.error) return null;
  return h('section', { class: 'card warn-card', 'aria-label': '資料提醒' },
    h('h3', { class: 'card-title' }, '資料提醒'),
    r.error ? h('p', { class: 'msg-bad' }, '計算時發生錯誤，報告內容不完整；請檢查填的資料後再產生一次。') : null,
    list.length ? h('ul', { class: 'plain-list' }, list.map((w) => h('li', {}, w))) : null);
}

const qiClass = (q) => (q === '旺氣' || q === '生氣' ? 'up' : q === '死氣' || q === '煞氣' ? 'down' : 'mid');

/**
 * 大門那一宮「門：游年X」（U6、D6）：門上起伏位時，宮的游年是門卦排的，大門本身以坐山論。
 * 引擎有 cells[p].doorYounian 就用；沒有時，門上起伏位退回 bazhai.door.star（大門以坐山卦的游年判）。
 */
function doorYounianOf(r, p) {
  if (p === '中') return null;
  const c = (r.cells || {})[p] || {};
  if (c.doorYounian) return String(c.doorYounian);
  const bz = r.bazhai || {};
  if (bz.mode !== 'door' || !c.isDoor) return null;
  if (bz.door && bz.door.palace === p && bz.door.star) return String(bz.door.star);
  return bz.doorStars && bz.doorStars[p] ? String(bz.doorStars[p]) : null;
}

function younianLuck(star, info) {
  const y = BZ.YOUNIAN && BZ.YOUNIAN[star];
  return (y && y.luck) || (info && info.luck) || '';
}

function renderChart() {
  const card = $('#chart-card');
  const r = ui.report;
  if (!card || !r) return;
  card.replaceChildren();
  const xk = r.xuankong || {};
  const cells = r.cells || {};
  const cx = r.compass || {};
  if (!xk.active || !Object.keys(cells).length) {
    card.append(h('h3', { class: 'card-title' }, '九宮飛星圖'), h('p', { class: 'hint' }, '這份報告沒有飛星盤的資料。'));
    return;
  }
  const other = xk.useTi ? xk.main : xk.ti;
  const otherName = xk.useTi ? '下卦' : '替卦';
  const showOther = ui.board === 'other' && !!other;
  const boardName = showOther ? otherName : (xk.activeName || '');
  const board = showOther ? other : xk.active;
  const deg = Number.isFinite(Number(cx.facingDeg)) ? Number(cx.facingDeg) : null;
  const { build, cur, changed } = periodsOf(r);
  // 山向星的旺衰一律用現在的運（主盤的 cells 已經是；參考盤自己重判）
  const qiNow = (star, given) => {
    if (!showOther && given) return given;
    if (typeof XK.qiOf === 'function' && star && cur) {
      try { return XK.qiOf(star, cur); } catch { /* 退回盤上的值 */ }
    }
    return given || '';
  };
  // 入囚：令星（現在的運）飛進中宮。主盤以報告的 prison 為準，參考盤自己看中宮的星
  const center = (board && board.mountain && board.facing)
    ? { m: board.mountain['中'], f: board.facing['中'] }
    : { m: (cells['中'] || {}).m, f: (cells['中'] || {}).f };
  const prison = (!showOther && xk.prison)
    ? { mountain: !!xk.prison.mountain, facing: !!xk.prison.facing }
    : { mountain: !!cur && center.m === cur, facing: !!cur && center.f === cur };
  const prisonKeys = ['mountain', 'facing'].filter((k) => prison[k]);
  const prisonWho = prisonKeys.map((k) => (k === 'mountain' ? '山星' : '向星')).join('、');

  card.append(
    h('h3', { class: 'card-title chart-title' },
      h('span', { class: 'chart-title-main' }, `九宮飛星圖・${boardName}盤`),
      build ? h('span', { id: 'chart-period', class: 'chart-period' }, periodTitle(r)) : null),
    h('p', { class: 'chart-sub' }, `${cx.name || ''}・${cx.periodName || ''}`
      + `${!showOther && xk.pattern ? `・${changed ? `現在${CN[cur]}運：` : ''}${patternName(xk.pattern)}` : ''}`
      + `${showOther ? '・參考盤（底色只標在主盤）' : ''}`),
  );
  if (changed) {
    const bPat = patternName(xk.buildPattern || (xk.buildFit && xk.buildFit.pattern) || '');
    card.append(h('div', { id: 'chart-changed', class: 'chart-alert', role: 'note' },
      h('p', { class: 'chart-alert-title' }, `交運提醒：盤是${CN[build]}運起的，現在已入${CN[cur]}運`),
      h('p', {}, `還沒有換天心，所以盤照舊，星的旺衰、格局分改以${CN[cur]}運來看。`
        + `${bPat ? `入住時是${bPat}，` : ''}現在是${patternName(xk.pattern)}。`),
      h('p', {}, '換天心是大修、換大門或翻新屋頂，讓新運之氣進來，改用新運起盤。')));
  }
  const bar = h('div', { class: 'chart-bar no-print' });
  if (other) {
    const seg = (key, text) => h('button', {
      type: 'button', class: `seg-btn${ui.board === key ? ' is-on' : ''}`, 'aria-pressed': ui.board === key ? 'true' : 'false',
      onclick: () => { ui.board = key; renderChart(); },
    }, text);
    bar.append(h('div', { class: 'seg', role: 'group', 'aria-label': '切換飛星盤' },
      seg('active', `${xk.activeName}盤（主）`), seg('other', `${otherName}盤（參考）`)));
  }
  bar.append(h('button', { type: 'button', class: 'btn btn-line btn-mini btn-orient-alt', onclick: toggleOrient }, orientBtnText()));
  card.append(bar, h('p', { class: 'hint chart-orient' }, orientText(deg)));

  const grid = h('div', { id: 'chart-grid', class: 'nine chart-grid', role: 'group', 'aria-label': `${boardName}盤九宮飛星` });
  let doorYnShown = false;
  for (const row of gridLayout(deg)) {
    for (const p of row) {
      const c = cells[p] || {};
      const s = showOther ? (other.cells && other.cells[p]) || {} : c;
      const mQi = qiNow(s.m, s.mQi);
      const fQi = qiNow(s.f, s.fQi);
      const luck = !showOther && c.luck ? LEVEL_CLASS[c.luck] || 'flat' : 'none';
      const isPrison = p === '中' && prisonKeys.length > 0;
      const tags = [];
      if (c.isFace) tags.push(h('span', { class: 'fc-tag tag-face' }, '向'));
      if (c.isSit) tags.push(h('span', { class: 'fc-tag tag-sit' }, '坐'));
      if (c.isDoor) tags.push(h('span', { class: 'fc-tag tag-door' }, '門'));
      if (c.beast) tags.push(h('span', { class: 'fc-tag tag-beast' }, c.beast));
      const yn = p !== '中' && c.younian ? c.younian : null;
      const dyn = doorYounianOf(r, p);
      if (dyn) doorYnShown = true;
      const aria = [
        palaceLabel(p),
        `山星${STAR_NAMES[s.m] || ''}（${mQi}）`,
        `向星${STAR_NAMES[s.f] || ''}（${fQi}）`,
        `運星${STAR_NAMES[s.yun] || ''}`,
        isPrison ? `${prisonWho}入囚` : '',
        c.yearStar ? `今年年星${STAR_NAMES[c.yearStar]}` : '',
        yn ? `游年${yn}` : '',
        dyn ? `門：游年${dyn}` : '',
        c.rooms && c.rooms.length ? `房間：${c.rooms.join('、')}` : '',
        !showOther && c.luck ? `評為${c.luck}` : '',
      ].filter(Boolean).join('，');
      grid.append(h('div', {
        class: `fc-cell luck-${luck}${p === '中' ? ' is-center' : ''}${isPrison ? ' is-prison' : ''}`,
        'data-palace': p, role: 'img', 'aria-label': aria,
      },
      h('div', { class: 'fc-top' },
        h('span', { class: 'fc-name' }, cellName(p)),
        isPrison ? h('span', { class: 'fc-prison', title: `${prisonWho}入囚（${CN[cur]}運的令星飛進中宮）` }, '囚') : null,
        c.yearStar ? h('span', {
          class: 'fc-year', title: `今年年星 ${STAR_NAMES[c.yearStar]}${c.monthStar ? `、本月月星 ${STAR_NAMES[c.monthStar]}` : ''}`,
        }, `年${c.yearStar}`) : null),
      h('div', { class: 'fc-stars' },
        h('span', { class: `fc-m qi-${qiClass(mQi)}${isPrison && prison.mountain ? ' is-jailed' : ''}`, title: `山星 ${STAR_NAMES[s.m] || ''}（${mQi}）` }, String(s.m ?? '')),
        h('span', { class: `fc-f qi-${qiClass(fQi)}${isPrison && prison.facing ? ' is-jailed' : ''}`, title: `向星 ${STAR_NAMES[s.f] || ''}（${fQi}）` }, String(s.f ?? ''))),
      h('div', { class: 'fc-yun', title: `運星 ${STAR_NAMES[s.yun] || ''}` }, String(s.yun ?? '')),
      isPrison ? h('div', { class: 'fc-prison-text' }, `${prisonWho}入囚`) : null,
      yn ? h('div', { class: `fc-yn yn-${c.younianInfo && c.younianInfo.luck === '吉' ? 'good' : 'bad'}` },
        h('small', {}, '游年'), yn) : null,
      dyn ? h('div', {
        class: `fc-door-yn yn-${{ 吉: 'good', 凶: 'bad' }[younianLuck(dyn, c.doorYounianInfo)] || 'flat'}`,
        title: '門上起伏位：大門吉凶以坐山卦的游年判',
      }, `門：游年${dyn}`) : null,
      c.rooms && c.rooms.length ? h('div', { class: 'fc-rooms' }, c.rooms.join('、')) : null,
      tags.length ? h('div', { class: 'fc-tags' }, tags) : null));
    }
  }
  card.append(grid);
  if (prisonKeys.length) {
    const pt = XK.PRISON_TEXT || PRISON_FALLBACK;
    // X9：依中宮的山向星與流年星選說明句；有二五時寫「保持開闊、安靜」，「有水可以囚不住」拿掉「有水」
    const c0 = cells['中'] || {};
    const c25 = has25At({ m: center.m, f: center.f, yearStar: c0.yearStar }, cur);
    // Z2：中宮不能放水（二五、山星當運＝山星入囚、廁所水、凶宮失令）時，「有水可以囚不住」也拿掉「有水」
    let dryCenter = c25 || (!!cur && center.m === cur);
    if (!dryCenter && !showOther && typeof RP.waterOk === 'function') {
      try { dryCenter = !RP.waterOk('中', r); } catch { /* 引擎沒有就只看二五與山星 */ }
    }
    card.append(h('div', { id: 'chart-prison', class: 'chart-prison', role: 'note' },
      h('p', { class: 'chart-prison-title' },
        h('span', { class: 'fc-prison', 'aria-hidden': 'true' }, '囚'),
        `中宮的「囚」：${CN[cur]}運的令星${STAR_NAMES[cur] || ''}飛進中宮，叫「入囚」${showOther ? '（參考盤）' : ''}。`),
      prisonKeys.map((k) => h('p', {}, prisonTextFor(pt[k] || PRISON_FALLBACK[k], dryCenter))),
      h('p', {}, c25 ? PRISON_TIP_25 : PRISON_TIP)));
  }
  card.append(h('ul', { class: 'legend' },
    h('li', {}, h('b', {}, '左上大字'), '山星，管人丁健康；', h('b', {}, '右上大字'), '向星，管財；', h('b', {}, '中下'), '運星。'),
    h('li', {}, h('b', {}, '右上小字「年」'), '是今年的流年年星；', h('b', {}, '「游年」'), '那一行是八宅的游年星，跟玄空的星分開看。'),
    doorYnShown ? h('li', { class: 'legend-door' }, h('b', {}, '「門：游年」'),
      '只標在大門那一宮：門上起伏位時各宮游年依門卦排，大門本身的吉凶仍以坐山卦的游年判。') : null,
    h('li', {}, `星的顏色依現在的${CN[cur] || ''}運看：朱紅＝生旺（旺氣或生氣）、灰＝死氣或煞氣、墨色＝其他。`),
    h('li', {}, '底色：綠＝山星向星都生旺；紅＝含五黃，或山星向星都屬死氣、煞氣；米色＝其他（旺衰互見，或兩星都失令、凶性較輕）。')));
}

function tocNav(sections) {
  if (!sections.length) return null;
  return h('nav', { class: 'toc no-print', 'aria-label': '報告段落' },
    sections.map((s) => h('button', {
      type: 'button', class: 'toc-btn',
      onclick: () => {
        const el = document.getElementById(`sec-${s.id}`);
        if (el) el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
      },
    }, s.title)));
}

/**
 * avoid 可能是字串或字串陣列，一律變成一段文字。
 * 前面固定標「避免：」，所以每一句句首的「避免」拿掉，不寫成「避免：避免…」。
 */
function avoidText(a) {
  const list = (Array.isArray(a) ? a : [a])
    .map((x) => blankText(x).replace(/^避免[：:，、\s]*/, ''))
    .filter(Boolean);
  return list.map((x) => (/[。！？]$/.test(x) ? x : `${x}。`)).join('');
}

/** 「避免：…」一行（淡色，U1） */
function avoidLine(cls, a) {
  const t = avoidText(a);
  return t ? h('p', { class: `${cls} avoid-line` }, h('span', { class: 'avoid-label' }, '避免：'), t) : null;
}

/**
 * 段落項目清單。opts.summary：沒有宮位的項目畫成摘要列（九宮段第一條「九宮：凶 N 宮、吉 M 宮」，U2），
 * 不帶 data-palace，不會被當成某一宮。
 */
function itemList(items, opts = {}) {
  return h('ul', { class: 'items' }, items.map((it) => {
    const lv = LEVEL_CLASS[it.level] || 'flat';
    const summary = !!opts.summary && !it.palace;
    return h('li', {
      class: `item lv-${lv}${summary ? ' is-summary' : ''}`,
      'data-palace': summary ? null : (it.palace || null),
      'data-summary': summary ? 'true' : null,
    },
    h('div', { class: 'item-head' },
      h('span', { class: 'lv-badge' }, it.level || '平'),
      h('h4', { class: 'item-title' }, it.title || '')),
    it.text ? h('p', { class: 'item-text' }, it.text) : null,
    it.fix ? h('p', { class: 'item-fix' }, h('b', {}, '可以怎麼調：'), it.fix) : null,
    avoidLine('item-avoid', it.avoid));
  }));
}

/** 宮位鍵：沒有宮位（null、undefined、''）的一律算「全宅」 */
const palaceKey = (p) => (p && (PALACE_INFO[p] || p === '中') ? p : '全宅');

/**
 * 化解段的某一條，是不是已經畫在化解清單（remedies）裡（U5）。
 * 宮位要相同（全宅條目 palace 是 null，段落項目沒有 palace，兩邊都算「全宅」），而且：
 *   - 標題含這條化解的問題（problem 或 problems 任一），或
 *   - 帶 delta（引擎目前每條化解都帶 delta，化解通則不帶）。
 * 對不上的（化解通則等）才照段落列；不會因為有全宅條目就整段重列。
 */
function coveredByRemedy(it, rem) {
  if (!it) return false;
  const key = palaceKey(it.palace);
  const title = bare(it.title);
  const hasDelta = typeof it.delta === 'number' && Number.isFinite(it.delta);
  return rem.some((e) => {
    if (!e || palaceKey(e.palace) !== key) return false;
    if (hasDelta) return true;
    const probs = [e.problem, ...(Array.isArray(e.problems) ? e.problems : [])].map(bare).filter(Boolean);
    return !!title && probs.some((p) => title.includes(p));
  });
}

function remedyLevel(delta) {
  const d = Number(delta);
  if (!Number.isFinite(d)) return { cls: 'flat', text: '平' };
  if (d < -0.5) return { cls: 'bad', text: '凶' };
  if (d < 0) return { cls: 'warn', text: '注意' };
  return { cls: 'flat', text: '平' };
}

/** 報告有沒有標「這條已併進別條」（V2）：merged、mergedInto、mergedWith 任一個有值就算 */
const isMergedRemedy = (e) => !!(e && (e.merged || e.mergedInto || e.mergedWith));

/**
 * 化解清單每一條的第一行（V2）：
 *   - 報告標了併入，或 action 是空的而同一宮（全宅也算一組）前面已經有一條 → 「已併入同方位的上一條」；
 *   - action 是空的、也不是併入 → 寫通用的一句（NO_ACTION），不留空白；
 *     Z1：粗體動作一律用引擎查表給的 action，不再從做法、細項的句子裡挑（做法、細項照樣列在下面）；
 *   - 其他照 action。
 * 回 { merged, text }；text 一定不是空字串。
 */
function remedyFirstLine(list, i) {
  const e = list[i] || {};
  const action = blankText(e.action);
  const key = palaceKey(e.palace);
  const hasPrev = list.slice(0, i).some((x) => x && palaceKey(x.palace) === key);
  if (isMergedRemedy(e) || (!action && hasPrev)) {
    const t = key === '全宅'
      ? (hasPrev ? MERGED_TEXT.wholePrev : MERGED_TEXT.wholeOther)
      : (hasPrev ? MERGED_TEXT.prev : MERGED_TEXT.other);
    return { merged: true, text: t };
  }
  if (action) return { merged: false, text: action.replace(/。$/, '') };
  return { merged: false, text: NO_ACTION };
}

function remedyList(list) {
  return h('ol', { id: 'remedy-list', class: 'remedy-list' }, list.map((e, i) => {
    const lv = remedyLevel(e.delta);
    const head = remedyFirstLine(list, i);
    const action = head.merged ? '' : head.text;
    // 做法那一句跟第一行的動作一樣時不重複列
    const method = e.method && bare(e.method) !== bare(action) ? e.method : '';
    const items = (Array.isArray(e.items) ? e.items : [])
      .filter((x) => x && bare(x) !== bare(e.method) && bare(x) !== bare(action));
    return h('li', {
      class: `remedy lv-${lv.cls}${e.structural ? ' is-structural' : ''}${head.merged ? ' is-merged' : ''}`,
      'data-palace': e.palace || '全宅',
      'data-merged': head.merged ? 'true' : null,
    },
    head.merged
      ? h('p', { class: 'rem-action is-merged' }, head.text)
      : h('p', { class: 'rem-action' }, h('b', {}, head.text)),
    h('div', { class: 'rem-head' },
      h('span', { class: 'rem-dir' }, e.palace && (PALACE_INFO[e.palace] || e.palace === '中') ? palaceLabel(e.palace) : (e.dir || '全宅')),
      h('span', { class: 'lv-badge' }, lv.text)),
    h('h4', { class: 'rem-problem' }, e.problem || ''),
    method ? h('p', { class: 'rem-method' }, method) : null,
    items.length ? h('ul', { class: 'rem-items' }, items.map((x) => h('li', {}, x))) : null,
    avoidLine('rem-avoid', e.avoid),
    e.structural ? h('p', { class: 'hint rem-note' }, '這一條屬盤局結構，不放進 LINE 的化解重點。') : null);
  }));
}

function sectionCard(s, r) {
  const card = h('section', { class: `card sec sec-${s.id}`, id: `sec-${s.id}`, 'aria-labelledby': `sec-h-${s.id}` },
    h('h3', { class: 'card-title', id: `sec-h-${s.id}` }, s.title || ''),
    s.intro ? h('p', { class: 'sec-intro' }, s.intro) : null);
  const items = Array.isArray(s.items) ? s.items : [];
  const rem = Array.isArray(r.remedies) ? r.remedies : [];
  // 化解段：一律用 remedies 的結構化清單（動作、問題、做法、逐項物品、要避開的）；
  // 段落裡逐條對應化解的項目（帶 delta）不再重列，其餘（化解通則等）照段落列
  if (s.id === 'remedies' && rem.length) {
    card.append(h('p', { class: 'hint' }, '依宮位排列；粗體是可以先做的動作。先調格局與動線，再考慮擺放物品。'), remedyList(rem));
    const extra = items.filter((it) => !coveredByRemedy(it, rem));
    if (extra.length) card.append(itemList(extra));
  } else if (s.id === 'palaces' && items.length) {
    // 九宮段：沒有宮位的總結（凶 N 宮、吉 M 宮）放最前面當摘要列，其餘逐宮
    const head = items.filter((it) => !it.palace);
    const rest = items.filter((it) => it.palace);
    card.append(itemList([...head, ...rest], { summary: true }));
  } else if (items.length) {
    card.append(itemList(items));
  } else {
    card.append(h('p', { class: 'hint' }, '這一段沒有項目。'));
  }
  return card;
}

function lineCard(r) {
  return h('section', { class: 'card line-card', 'aria-label': 'LINE 文字與操作' },
    h('h3', { class: 'card-title' }, '貼到 LINE 的文字'),
    h('p', { class: 'hint' }, '純文字摘要，不含出生年與人名。'),
    h('label', { class: 'sr-only', for: 'line-text' }, 'LINE 文字'),
    h('textarea', { id: 'line-text', class: 'line-text', readonly: true, rows: '14', spellcheck: 'false' }),
    h('div', { class: 'btn-row report-actions' },
      h('button', { id: 'btn-copy-line', type: 'button', class: 'btn btn-primary', onclick: copyLine }, '複製 LINE 文字'),
      h('button', { id: 'btn-print', type: 'button', class: 'btn btn-line', onclick: () => window.print() }, '列印報告'),
      h('button', { id: 'btn-reset', type: 'button', class: 'btn btn-line btn-danger', onclick: resetAll }, '清空重來')),
    h('p', { id: 'copy-msg', class: 'hint copy-msg', role: 'status' }));
}

async function copyLine() {
  const ta = $('#line-text');
  const msg = $('#copy-msg');
  if (!ta) return;
  const text = ta.value;
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('沒有剪貼簿');
    await navigator.clipboard.writeText(text);
    msg.textContent = '已複製，可以貼到 LINE。';
  } catch {
    // 退回：選取全部文字，讓使用者自己複製
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = typeof document.execCommand === 'function' && document.execCommand('copy'); } catch { ok = false; }
    msg.textContent = ok ? '已複製，可以貼到 LINE。' : '已選取全部文字，請按 Ctrl+C 複製（手機長按選「拷貝」）。';
  }
}

/* ------------------------------------------------------------------ */
/* 示範、清空、把狀態寫回畫面                                              */
/* ------------------------------------------------------------------ */

function stateFromInput(d) {
  const s = freshState();
  s.facingDeg = Number.isFinite(Number(d.facingDeg)) ? round1(norm(Number(d.facingDeg))) : null;
  s.moveInYear = d.moveInYear ?? '';
  s.period = d.period ? String(d.period) : 'auto';
  s.floor = d.floor ?? '';
  s.totalFloors = d.totalFloors ?? '';
  const people = (Array.isArray(d.people) ? d.people : []).slice(0, MAX_PEOPLE).map((p, i) => ({
    ...newPerson(i === 0 ? '戶主' : (OTHER_LABELS.includes(p.label) ? p.label : '其他')),
    year: p.year ?? '',
    month: p.month ?? '',
    day: p.day ?? '',
    gender: p.gender === 'M' || p.gender === 'F' ? p.gender : '',
    bedPalace: p.bedPalace || '',
    bedHead: p.bedHead || '',
  }));
  s.people = people.length ? people : [newPerson('戶主')];
  for (const p of ALL_PALACES) s.rooms[p] = [...((d.rooms && d.rooms[p]) || [])].filter((k) => ROOM_TYPES[k]);
  for (const p of PALACES) s.exterior[p] = [...((d.exterior && d.exterior[p]) || [])].filter((k) => EXT_TYPES[k]);
  s.stoveMouth = d.stoveMouth || '';
  s.bazhaiMode = d.options && d.options.bazhaiMode === 'door' ? 'door' : 'sit';
  s.tigua = d.options && ['on', 'off'].includes(d.options.tigua) ? d.options.tigua : 'auto';
  s.wuTi = d.options && WUTI_VALUES.includes(d.options.wuTi) ? d.options.wuTi : 'none';
  return s;
}

/** 把 S 整份寫回所有欄位 */
function fillForm() {
  $('#deg-input').value = hasDeg() ? S.facingDeg.toFixed(1) : '';
  $('#movein-year').value = blankText(S.moveInYear);
  $('#period-select').value = S.period;
  $('#floor').value = blankText(S.floor);
  $('#total-floors').value = blankText(S.totalFloors);
  $('#bazhai-mode').value = S.bazhaiMode;
  $('#tigua-select').value = S.tigua;
  $('#wuti-select').value = S.wuTi;
  renderStoveMouth();
  renderCompass();
  renderPeriodNote();
  renderModeList();
  renderPeople();
  renderBedList();
  renderRoomGrid();
  renderRoomPicker();
  renderExtGrid();
  renderExtPicker();
  $('#people-msg').textContent = '';
  $('#room-hint').textContent = '';
}

function loadDemo() {
  stopSensor();
  S = stateFromInput(demoInput(today()));
  ui.roomSel = null;
  ui.extSel = null;
  fillForm();
  sensorMsg('');
  if (generate()) goStep(5);
}

function resetAll() {
  stopSensor();
  S = freshState();
  ui.report = null;
  ui.dirty = false;
  ui.roomSel = null;
  ui.extSel = null;
  ui.board = 'active';
  fillForm();
  renderReport();
  $('#analyze-msg').replaceChildren();
  sensorMsg('');
  goStep(1);
  $('#facing-note').prepend(h('p', { class: 'fn-reset' }, '已清空，從第 1 步重新開始。'));
}

/* ------------------------------------------------------------------ */
/* 步驟切換                                                              */
/* ------------------------------------------------------------------ */

function goStep(n, { focus = true } = {}) {
  const step = Math.min(5, Math.max(1, Number(n) || 1));
  if (step !== 1) stopSensor();
  ui.step = step;
  for (const sec of $$('.step')) sec.hidden = Number(sec.dataset.step) !== step;
  for (const b of $$('#stepper button')) {
    const k = Number(b.dataset.step);
    if (k === step) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
    b.classList.toggle('is-done', k < step);
  }
  $('#btn-prev').hidden = step === 1;
  $('#btn-prev').textContent = step > 1 ? `上一步：${STEP_NAMES[step - 1]}` : '上一步';
  $('#btn-next').hidden = step === 5;
  $('#btn-next').textContent = step < 5 ? `下一步：${STEP_NAMES[step + 1]}` : '下一步';
  if (step === 3) { renderRoomGrid(); renderRoomPicker(); renderBedList(); }
  if (step === 4) { renderExtGrid(); renderExtPicker(); }
  renderOrient();
  const nav = $('.stepper-wrap');
  const top = nav ? nav.getBoundingClientRect().top + window.scrollY : 0;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' });
  if (focus) {
    const head = $(`#h-step-${step}`);
    if (head) {
      head.setAttribute('tabindex', '-1');
      head.focus({ preventScroll: true });
    }
  }
}

/* ------------------------------------------------------------------ */
/* 啟動                                                                  */
/* ------------------------------------------------------------------ */

function init() {
  // 24 山下拉
  $('#mount-select').append(opt('', '選 24 山…'),
    ...MOUNT_OPTS.map((o) => opt(String(o.deg), `${o.mount}山　${o.deg}°（${o.palace}宮・${PALACE_INFO[o.palace].dir}・${o.yinyang}）`)));
  // 元運下拉
  $('#period-select').append(opt('auto', '自動（依入住年）'),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => opt(String(p), `${PERIOD_NAMES[p]}（${rangeText(p)}）`)));

  // 步驟列、上一步下一步
  for (const b of $$('#stepper button')) b.addEventListener('click', () => goStep(Number(b.dataset.step)));
  $('#btn-prev').addEventListener('click', () => goStep(ui.step - 1));
  $('#btn-next').addEventListener('click', () => goStep(ui.step + 1));
  $('#btn-demo').addEventListener('click', loadDemo);

  // 步驟 1
  const degInput = $('#deg-input');
  degInput.addEventListener('input', () => setDeg(degInput.value, { fromInput: true }));
  degInput.addEventListener('change', () => {
    if (hasDeg()) degInput.value = S.facingDeg.toFixed(1);
  });
  for (const b of $$('.btn-fine')) {
    b.addEventListener('click', () => setDeg((hasDeg() ? S.facingDeg : 0) + Number(b.dataset.fine)));
  }
  $('#mount-select').addEventListener('change', (e) => {
    if (e.target.value !== '') setDeg(Number(e.target.value));
  });
  $('#btn-sensor').addEventListener('click', startSensor);
  $('#btn-sensor-lock').addEventListener('click', lockSensor);
  $('#btn-sensor-stop').addEventListener('click', () => { stopSensor(); sensorMsg('已停止讀取指南針。'); });

  // 步驟 2
  $('#movein-year').addEventListener('input', (e) => { S.moveInYear = e.target.value; renderPeriodNote(); changed(); });
  $('#period-select').addEventListener('change', (e) => { S.period = e.target.value; renderPeriodNote(); changed(); });
  $('#floor').addEventListener('input', (e) => { S.floor = e.target.value; changed(); });
  $('#total-floors').addEventListener('input', (e) => { S.totalFloors = e.target.value; changed(); });
  $('#bazhai-mode').addEventListener('change', (e) => { S.bazhaiMode = e.target.value === 'door' ? 'door' : 'sit'; renderModeList(); changed(); });
  $('#tigua-select').addEventListener('change', (e) => { S.tigua = e.target.value; changed(); });
  $('#wuti-select').addEventListener('change', (e) => {
    S.wuTi = WUTI_VALUES.includes(e.target.value) ? e.target.value : 'none';
    changed();
  });
  const pl = $('#people-list');
  pl.addEventListener('input', onPeopleInput);
  pl.addEventListener('change', onPeopleInput);
  pl.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) deletePerson(Number(del.dataset.del));
  });
  $('#btn-add-person').addEventListener('click', addPerson);

  // 步驟 3
  $('#btn-orient').addEventListener('click', toggleOrient);
  $('#btn-room-done').addEventListener('click', () => { ui.roomSel = null; renderRoomGrid(); renderRoomPicker(); });
  $('#stove-mouth').addEventListener('change', (e) => { S.stoveMouth = e.target.value; changed(); });
  $('#bed-list').addEventListener('change', onBedInput);

  // 步驟 4
  for (const b of $$('#step-4 .btn-orient-alt')) b.addEventListener('click', toggleOrient);
  $('#btn-ext-done').addEventListener('click', () => { ui.extSel = null; renderExtGrid(); renderExtPicker(); });

  // 步驟 5
  $('#btn-analyze').addEventListener('click', () => {
    if (generate()) {
      const rep = $('#report');
      rep.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  });

  // Esc 收起選單
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui.roomSel) { const p = ui.roomSel; ui.roomSel = null; renderRoomGrid(); renderRoomPicker(); focusCell('#grid-rooms', p); }
    if (ui.extSel) { const p = ui.extSel; ui.extSel = null; renderExtGrid(); renderExtPicker(); focusCell('#grid-ext', p); }
  });

  fillForm();
  goStep(1, { focus: false });
}

function focusCell(gridSel, p) {
  const el = $(`${gridSel} [data-palace="${CSS.escape(p)}"]`);
  if (el) el.focus();
}

init();
