import { esc, loadState, saveState, registerActions } from './utils.js';
import { NON_SUBJECT_TYPES } from './state.js';

// --- 수업/평가계획 공통 컨텍스트 (2026-10) ---
// { year, semester, subjectId } 하나를 수업계획·평가계획·루브릭·정기시험·차시·정의적 영역이 함께 읽는다.
// 각 도구의 저장 데이터는 (subjectId, semester) 슬롯별로 따로 둔다 → 1학기와 2학기 계획이 서로 덮어쓰지 않는다.
// 도구 사이 데이터는 실시간 동기화하지 않고 "가져오기"로만 옮긴다(교사가 고친 값을 함부로 덮지 않기 위해).
const KEY = 'jungle_plan_ctx';
const subscribers = [];

function planSubjects() { return SUBJECTS.filter(s => !NON_SUBJECT_TYPES.includes(s.type) && s.domains && s.domains.length); }

// 첫 실행: 기존 수업계획 → 평가계획 → 차시 계산기 순으로 과목·학기·학년도를 읽어 초기값으로 쓴다
function initialCtx() {
  const lp = loadState('jungle_lesson_plan', null);
  const ep = loadState('jungle_evalplan', null);
  const ch = loadState('jungle_chasi', null);
  const fromOld = s => (s && !s.slots && typeof s.subjectIdx === 'number' && SUBJECTS[s.subjectIdx]) ? s : null;
  const src = fromOld(lp) || fromOld(ep);
  const subj = src ? SUBJECTS[src.subjectIdx] : SUBJECTS.find(s => s.id === 'middle');
  const year = (ch && +ch.year) || new Date().getFullYear();
  return { year, semester: src && src.semester === 2 ? 2 : 1, subjectId: subj ? subj.id : 'middle' };
}
function sane(c) {
  const ok = c && planSubjects().some(s => s.id === c.subjectId);
  return {
    year: (c && +c.year) || new Date().getFullYear(),
    semester: c && +c.semester === 2 ? 2 : 1,
    subjectId: ok ? c.subjectId : (planSubjects()[0] || {}).id || 'middle',
  };
}
let ctx = sane(loadState(KEY, null) || initialCtx());
saveState(KEY, ctx);

export function get() { return { ...ctx }; }
export function set(patch) {
  const next = sane({ ...ctx, ...patch });
  if (next.year === ctx.year && next.semester === ctx.semester && next.subjectId === ctx.subjectId) return;
  const prev = ctx;
  ctx = next;
  saveState(KEY, ctx);
  subscribers.forEach(fn => { try { fn(ctx, prev); } catch (e) { console.error(e); } });
}
export function subscribe(fn) { subscribers.push(fn); }
export function slotKey(c = ctx) { return c.subjectId + ':' + c.semester; }
export function subjectIdx(c = ctx) { return SUBJECTS.findIndex(s => s.id === c.subjectId); }
export function subject(c = ctx) { return SUBJECTS[subjectIdx(c)]; }

// --- 슬롯 저장소 ---
// 저장 형식: { v: 2, slots: { 'middle:1': {...}, 'high:2': {...} } }
// legacyToSlot(raw) → [slotKey, data] : 슬롯 이전 형식(과목·학기를 품은 단일 객체)을 해당 슬롯으로 옮긴다.
export function slotStore(storageKey, { legacyToSlot } = {}) {
  let doc = loadState(storageKey, null);
  if (!doc || typeof doc !== 'object' || !doc.slots) {
    const slots = {};
    if (doc && typeof doc === 'object' && legacyToSlot) {
      const moved = legacyToSlot(doc);
      if (moved) slots[moved[0]] = moved[1];
    }
    doc = { v: 2, slots };
    saveState(storageKey, doc);
  }
  return {
    load(key = slotKey()) { const d = doc.slots[key]; return d ? JSON.parse(JSON.stringify(d)) : null; },
    save(data, key = slotKey()) { doc.slots[key] = data; saveState(storageKey, doc); },
    remove(key = slotKey()) { delete doc.slots[key]; saveState(storageKey, doc); },
    keys() { return Object.keys(doc.slots); },
  };
}
// 예전 단일 객체의 subjectIdx·semester → 슬롯 키
export function legacyKey(s) {
  const subj = SUBJECTS[typeof s.subjectIdx === 'number' ? s.subjectIdx : -1];
  return (subj ? subj.id : ctx.subjectId) + ':' + (s.semester === 2 ? 2 : 1);
}

// 주차 표기 공용: '4/3' → '4월 3주' (수업계획·평가계획·정기시험이 같은 말을 쓰게)
export function formatMW(mw) {
  const t = String(mw || '').trim().match(/^(\d{1,2})\s*(?:\/|월)\s*(\d)\s*주?$/);
  return t ? `${+t[1]}월 ${+t[2]}주` : String(mw || '');
}

// --- 도구 사이 데이터 제공자 (순환 import 없이 서로 읽기) ---
// 예: lessonplan이 provide('lesson', () => 현재 슬롯 수업계획) → evalplan이 consume('lesson')
const providers = {};
export function provide(name, fn) { providers[name] = fn; }
export function consume(name, ...args) { return providers[name] ? providers[name](...args) : null; }

// --- 컨텍스트 바 (서브탭 아래, #main 밖 정적 자리 #planCtxBar) ---
let editing = false;
export function ctxBarHtml() {
  const s = subject();
  const label = `${ctx.year}학년도 · ${ctx.semester}학기 · ${esc(s ? s.name : '')}`;
  if (!editing) {
    return `<div class="ctx-bar-inner"><span class="ctx-bar-label">수업·평가 기준</span><strong class="ctx-bar-value">${label}</strong>
      <button type="button" class="ctx-bar-btn" data-onclick="ctx:edit" aria-expanded="false">변경</button>
      <span class="ctx-bar-note">모든 계획 도구가 이 과목·학기를 함께 씁니다</span></div>`;
  }
  const y0 = new Date().getFullYear();
  const years = [...new Set([y0 - 1, y0, y0 + 1, ctx.year])].sort();
  return `<div class="ctx-bar-inner ctx-bar-edit" role="group" aria-label="수업·평가 기준 변경">
    <label class="ctx-field">학년도 <select class="eval-select" data-onchange="ctx:year">${years.map(y => `<option value="${y}"${y === ctx.year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <span class="ctx-field">학기 <span class="eval-toggle-group">${[1, 2].map(n => `<button type="button" class="eval-toggle${ctx.semester === n ? ' active' : ''}" aria-pressed="${ctx.semester === n}" data-onclick="ctx:semester" data-args="[${n}]">${n}학기</button>`).join('')}</span></span>
    <label class="ctx-field">과목 <select class="eval-select" data-onchange="ctx:subject">${planSubjects().map(s => `<option value="${s.id}"${s.id === ctx.subjectId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <button type="button" class="pbtn pri" data-onclick="ctx:done">완료</button>
  </div>`;
}
export function renderCtxBar(show) {
  const el = document.getElementById('planCtxBar');
  if (!el) return;
  el.hidden = !show;
  if (show) el.innerHTML = ctxBarHtml();
}
function refreshBar() { renderCtxBar(true); }

registerActions('click', {
  'ctx:edit': () => { editing = true; refreshBar(); const f = document.querySelector('#planCtxBar select'); if (f) f.focus(); },
  'ctx:done': () => { editing = false; refreshBar(); const b = document.querySelector('#planCtxBar .ctx-bar-btn'); if (b) b.focus(); },
  'ctx:semester': (el, e, n) => { set({ semester: n }); refreshBar(); refocus(`[data-onclick="ctx:semester"][data-args="[${n}]"]`); },
});
// 값을 바꾸면 바를 다시 그리므로, 방금 만진 컨트롤로 포커스를 되돌린다
function refocus(sel) { const f = document.querySelector('#planCtxBar ' + sel); if (f) f.focus(); }
registerActions('change', {
  'ctx:year': el => { set({ year: +el.value }); refreshBar(); refocus('[data-onchange="ctx:year"]'); },
  'ctx:subject': el => { set({ subjectId: el.value }); refreshBar(); refocus('[data-onchange="ctx:subject"]'); },
});

export const __ctxTest = { reset(c) { ctx = sane(c); saveState(KEY, ctx); }, initialCtx };
