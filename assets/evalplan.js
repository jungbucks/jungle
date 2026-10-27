import { esc, trapFocus, releaseFocus, loadState, saveState, registerActions, pageHead, emptySteps, uiToast, uiConfirm } from './utils.js';
import { NON_SUBJECT_TYPES } from './state.js';
import { openStdPicker } from './stdpicker.js';
import * as planCtx from './planctx.js';

// --- Eval Plan State ---
export let evalPlanSubtab = 'lesson';
export function setEvalPlanSubtab(v) { evalPlanSubtab = v; }

// 저장: jungle_evalplan = { v:2, slots: { '<과목id>:<학기>': 평가계획 } } (planctx 슬롯 저장소).
// 예전 단일 객체(subjectIdx·semester 포함)는 그 과목·학기 슬롯으로 옮긴다. 아주 옛 키 'evalplan'도 먼저 흡수.
(() => {
  const migrated = loadState('evalplan', null);
  if (migrated) { if (!loadState('jungle_evalplan', null)) saveState('jungle_evalplan', migrated); try { localStorage.removeItem('evalplan'); } catch(e) {} }
})();
const evalStore = planCtx.slotStore('jungle_evalplan', { legacyToSlot: raw => [planCtx.legacyKey(raw), raw] });
function evalDefault() { return { examCount:1, perfCount:3, items:[], generated:false, examKind:'final', sumOpen:false }; }
// evalState는 export const — 슬롯이 바뀌면 같은 객체의 내용만 갈아끼운다(다른 모듈·테스트가 참조)
export const evalState = {};
function evalLoadSlot() {
  const cx = planCtx.get();
  Object.keys(evalState).forEach(k => delete evalState[k]);
  Object.assign(evalState, evalDefault(), evalStore.load() || {});
  evalState.items = (evalState.items || []).map(it => ({ elements: '', period: '', ...it, linkedCodes: Array.isArray(it.linkedCodes) ? it.linkedCodes : [] }));
  evalState.subjectIdx = planCtx.subjectIdx(cx);
  evalState.semester = cx.semester;
}
let evalImport = null; // 수업계획 가져오기 미리보기 후보
evalLoadSlot();
planCtx.subscribe(() => { evalLoadSlot(); evalImport = null; });
planCtx.provide('evalExams', () => evalState.items.filter(it => it.type === 'exam'));
planCtx.provide('evalPerfs', () => evalState.items.filter(it => it.type === 'perf'));

// --- Eval Plan ---
function evalSubjects() {
  return SUBJECTS.filter(s => !NON_SUBJECT_TYPES.includes(s.type));
}

function evalSave() { evalStore.save(JSON.parse(JSON.stringify(evalState))); planCtx.touched(); }

// --- 순수 계산 헬퍼 (앱·tools/test.mjs 공용 — 로직 단일 소스) ---
function evalRatioSum(items) { return items.reduce((s, it) => s + (Number(it.ratio) || 0), 0); }
function evalEssayRatio(items) {
  let r = 0;
  items.forEach(it => {
    if (it.type === 'exam') {
      const sc = Number(it.scoreChoice) || 0, se = Number(it.scoreEssay) || 0, tot = sc + se;
      if (tot > 0) r += (Number(it.ratio) || 0) * (se / tot);
    } else if (it.isEssay) {
      r += Number(it.ratio) || 0;
    }
  });
  return r;
}
// n개 항목에 100%를 고르게 분배(합=100 보장): 앞쪽 항목이 나머지 1%씩 더 가짐
function evalDistribute(n) {
  if (!n) return [];
  const base = Math.floor(100 / n), rem = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

// --- 수업계획 → 평가계획 가져오기 (순수 — DOM 모름) ---
// 정기시험: 연속된 '정기시험' 행 묶음마다 하나. 평가 시기 = 그 주, 성취기준 후보 = 직전 시험 다음 주 ~ 이 시험 직전 주의 성취기준.
// 수행평가: 평가방법에 '수행평가'가 체크된 수업 행을 단원끼리 묶음. 평가 시기 = 그 행들의 주차 범위.
function evalExamNames(n, kind) {
  if (n === 1) return [kind === 'mid' ? '1차 정기시험(중간)' : '2차 정기시험(기말)'];
  if (n === 2) return ['1차 정기시험(중간)', '2차 정기시험(기말)'];
  return Array.from({ length: n }, (_, i) => (i + 1) + '차 정기시험');
}
function evalCandidatesFromLesson(lesson, examKind = 'final') {
  if (!lesson || !lesson.rows || !lesson.rows.length) return null;
  const rows = lesson.rows, F = planCtx.formatMW;
  const uniq = a => [...new Set(a)];
  const range = (a, b) => a === b ? F(a) : F(a) + ' ~ ' + F(b);
  const exams = [];
  let from = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== 'exam') continue;
    let j = i;
    while (rows[j + 1] && rows[j + 1].kind === 'exam') j++;
    const codes = uniq(rows.slice(from, i).filter(x => x.kind === 'lesson').flatMap(x => x.linkedCodes));
    exams.push({ type: 'exam', period: range(rows[i].monthWeek, rows[j].monthWeek), linkedCodes: codes });
    from = j + 1; i = j;
  }
  evalExamNames(exams.length, examKind).forEach((n, k) => { exams[k].name = n; });
  const groups = new Map();
  rows.forEach(x => {
    if (x.kind !== 'lesson' || !(x.evalMethods || []).includes('수행평가')) return;
    const key = x.domain || '단원 미지정';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  });
  const perfs = [...groups.entries()].map(([dom, xs], k) => ({
    type: 'perf', name: '수행평가 ' + (k + 1) + ' — ' + dom,
    period: range(xs[0].monthWeek, xs[xs.length - 1].monthWeek),
    linkedCodes: uniq(xs.flatMap(x => x.linkedCodes)),
  }));
  return [...exams, ...perfs];
}
function evalOpenImport() {
  const lesson = planCtx.consume('lesson');
  const cands = evalCandidatesFromLesson(lesson && lesson.generated ? lesson : null, evalState.examKind);
  if (!cands) { uiToast('이 과목·학기의 수업계획이 아직 없습니다. 수업계획을 먼저 만드세요.', { isErr: true }); return; }
  if (!cands.length) { uiToast("수업계획에 '정기시험' 주나 평가방법 '수행평가'가 체크된 주가 없습니다.", { isErr: true }); return; }
  evalImport = cands.map(cd => ({ ...cd, pick: true }));
  evalRerender();
  const p = document.getElementById('evalImportBox'); if (p) p.focus();
}
async function evalApplyImport() {
  const picked = (evalImport || []).filter(x => x.pick);
  if (!picked.length) { uiToast('적용할 항목을 하나 이상 고르세요.', { isErr: true }); return; }
  if (evalState.items.length && !(await uiConfirm('지금 평가 항목 ' + evalState.items.length + '개를 가져온 항목 ' + picked.length + '개로 바꿉니다. 계속할까요?', { okLabel: '바꾸기' }))) return;
  const ratios = evalDistribute(picked.length);
  evalState.items = picked.map((x, i) => x.type === 'exam'
    ? { type: 'exam', name: x.name, ratio: ratios[i], linkedCodes: x.linkedCodes, scoreChoice: '', scoreEssay: '', elements: '', period: x.period }
    : { type: 'perf', name: x.name, ratio: ratios[i], linkedCodes: x.linkedCodes, elements: '', period: x.period, isEssay: false });
  evalState.examCount = picked.filter(x => x.type === 'exam').length;
  evalState.perfCount = picked.filter(x => x.type === 'perf').length;
  evalState.generated = true;
  evalImport = null;
  evalSave(); evalRerender();
  uiToast('수업계획에서 ' + picked.length + '개 항목을 가져왔습니다. 반영 비율은 고르게 나눴으니 조정하세요.');
}
function evalImportHtml() {
  if (!evalImport) return '';
  const row = (x, i) => '<li><label><input type="checkbox"' + (x.pick ? ' checked' : '') + ' data-onchange="ev:importPick" data-args="' + esc(JSON.stringify([i])) + '">'
    + '<span class="eval-card-type ' + x.type + '">' + (x.type === 'exam' ? '정기시험' : '수행평가') + '</span>'
    + '<strong>' + esc(x.name) + '</strong></label>'
    + '<span class="eval-import-meta">' + esc(x.period) + ' · 성취기준 ' + x.linkedCodes.length + '개' + (x.linkedCodes.length ? ' (' + esc(x.linkedCodes.slice(0, 4).join(', ')) + (x.linkedCodes.length > 4 ? ' 외' : '') + ')' : '') + '</span></li>';
  return '<div class="eval-import" id="evalImportBox" tabindex="-1" role="region" aria-label="수업계획에서 가져오기 미리보기">'
    + '<div class="eval-import-title">수업계획에서 가져올 항목 <span>체크한 항목만 적용됩니다</span></div>'
    + '<ul class="eval-import-list">' + evalImport.map(row).join('') + '</ul>'
    + '<div class="eval-import-btns"><button class="pbtn pri" data-onclick="ev:importApply">적용</button><button class="pbtn sec" data-onclick="ev:importCancel">취소</button></div></div>';
}
// 같은 과목·학기 수업계획의 주차 목록(평가 시기 드롭다운용)
function evalWeekOptions() {
  const lesson = planCtx.consume('lesson');
  if (!lesson || !lesson.generated) return [];
  return [...new Set(lesson.rows.map(x => planCtx.formatMW(x.monthWeek)).filter(Boolean))];
}

let evalSumPop = null; // 팝오버를 연 미연결 성취기준 코드
function evalHideSummary() {
  const p = document.getElementById('evalSumPanel');
  if (p) p.classList.remove('visible');
  const m = document.getElementById('main');
  if (m) m.style.paddingBottom = '';
}

// 패널이 본문 마지막 카드를 가리지 않게 본문 아래에 패널 높이만큼 여백을 준다
function evalShowSummary() {
  const p = document.getElementById('evalSumPanel');
  if (!p) return;
  p.innerHTML = evalSummaryHtml();
  p.classList.add('visible');
  if (!p._keyBound) {
    p._keyBound = true;
    p.addEventListener('keydown', e => { if (e.key === 'Escape' && evalSumPop) { e.stopPropagation(); const code = evalSumPop; evalSumPop = null; evalShowSummary(); p.querySelector('[data-code="' + code + '"]')?.focus(); } });
  }
  const m = document.getElementById('main');
  if (m && p.offsetHeight) m.style.paddingBottom = (p.offsetHeight + 24) + 'px';
}

// 커버리지 분모: 같은 과목·학기 수업계획에 배치된 성취기준(학기 기준). 수업계획이 없으면 학년 전체.
function evalCoverageBase() {
  const lesson = planCtx.consume('lesson');
  const placed = lesson && lesson.generated
    ? [...new Set(lesson.rows.filter(r => r.kind === 'lesson').flatMap(r => r.linkedCodes))] : [];
  if (placed.length) return { codes: placed, semester: true };
  const subj = SUBJECTS[evalState.subjectIdx];
  return { codes: subj && subj.domains ? subj.domains.flatMap(d => d.items.map(it => it.code)) : [], semester: false };
}
function evalAllCodes() { return evalCoverageBase().codes; }
// 상태 점(서브탭): 없음 / 작성 중 / 완료(비율 합 100% + 커버리지 100%)
function evalStatus() {
  if (!evalState.generated || !evalState.items.length) return 'none';
  const linked = evalLinkedSet();
  const all = evalAllCodes();
  return evalRatioSum(evalState.items) === 100 && all.length && all.every(c => linked.has(c)) ? 'done' : 'draft';
}
planCtx.provide('evalStatus', evalStatus);

function evalLinkedSet() {  
  const s = new Set();  
  evalState.items.forEach(it => it.linkedCodes.forEach(c => s.add(c)));  
  return s;
}

function evalSummaryHtml() {
  const total = evalRatioSum(evalState.items);
  const base = evalCoverageBase();
  const all = base.codes;
  const linked = evalLinkedSet();
  const uncov = all.filter(c => !linked.has(c));
  const covered = all.length - uncov.length;
  const ok = total === 100;
  const essayRatio = evalEssayRatio(evalState.items);
  // 처음엔 중립색: 아직 어떤 항목에도 성취기준을 연결하지 않았으면 미연결을 빨갛게 몰아세우지 않는다
  const started = evalState.items.some(it => it.linkedCodes.length);
  const open = !!evalState.sumOpen && uncov.length > 0;
  const baseNote = base.semester ? '학기 기준 · 수업계획에 배치된 성취기준' : '학년 전체 기준 · 수업계획을 만들면 학기 기준으로 계산';
  const chips = open ? `<div class="eval-sum-uncov${started ? '' : ' neutral'}" id="evalSumChips">
      ${uncov.map(cd => `<span class="eval-sum-chip-wrap"><button type="button" class="eval-sum-uncov-badge" data-code="${esc(cd)}" data-onclick="ev:sumChip" data-args="${esc(JSON.stringify([cd]))}" aria-haspopup="menu" aria-expanded="${evalSumPop === cd}" title="${esc(cd)} — 연결할 평가 항목 고르기">${esc(cd)}</button>${evalSumPop === cd ? evalSumPopHtml(cd) : ''}</span>`).join('')}
    </div>` : '';
  return `<div class="eval-sum-inner">
    <span class="eval-sum-line">
      <span class="eval-sum-ratio ${ok ? 'ok' : started || total ? 'warn' : ''}">비율 합계 ${total}%${ok ? '' : total > 100 ? ' ▲초과' : ' ▼미달'}</span>
      <span class="eval-sum-dot">·</span>
      <span class="eval-sum-cov">커버리지 <strong>${covered}/${all.length}</strong> <span class="eval-sum-base">(${baseNote})</span></span>
      <span class="eval-sum-dot">·</span>
      <span class="eval-sum-cov">논술형 <strong>${essayRatio.toFixed(1)}%</strong></span>
      ${uncov.length ? `<span class="eval-sum-dot">·</span><button type="button" class="eval-sum-toggle${started ? ' warn' : ''}" data-onclick="ev:sumToggle" aria-expanded="${open}" aria-controls="evalSumChips">미연결 ${uncov.length}개 ${open ? '▾' : '▸'}</button>` : '<span class="eval-sum-dot">·</span><span class="eval-sum-ok">모든 성취기준 연결됨</span>'}
    </span>
    ${chips}
  </div>`;
}
function evalSumPopHtml(code) {
  return '<div class="eval-sum-pop" role="menu" aria-label="' + esc(code) + '을(를) 연결할 평가 항목">'
    + evalState.items.map((it, i) => '<button type="button" role="menuitem" data-onclick="ev:sumLink" data-args="' + esc(JSON.stringify([code, i])) + '">' + esc(it.name || ('항목 ' + (i + 1))) + '</button>').join('')
    + '</div>';
}
function evalSumLink(code, i) {
  const it = evalState.items[i];
  if (!it) return;
  if (!it.linkedCodes.includes(code)) it.linkedCodes.push(code);
  evalSumPop = null;
  evalSave();
  evalRerender();
  uiToast(code + ' → ' + (it.name || '항목') + '에 연결했습니다.');
}

function evalScoreSumText(tot) { return '합계 <strong>' + tot + '</strong>점' + (tot !== 100 ? ' · 100점이 되도록 입력' : ''); }
function evalRefreshScoreSum(i) {
  const it = evalState.items[i], el = document.getElementById('evalScoreSum_' + i);
  if (!it || !el) return;
  const tot = (Number(it.scoreChoice) || 0) + (Number(it.scoreEssay) || 0);
  el.innerHTML = evalScoreSumText(tot);
  el.classList.toggle('warn', tot !== 100);
}
function evalCardHtml(item, i, weeks = []) {
  const isExam = item.type === 'exam';
  const ai = esc(JSON.stringify([i]));
  const badgesHtml = item.linkedCodes.length
    ? item.linkedCodes.map(c =>
        `<span class="eval-badge">${esc(c)}<button class="eval-badge-rm" data-onclick="ev:unlink" data-args="${esc(JSON.stringify([i, c]))}" aria-label="${esc(c)} 연결 해제">×</button></span>`
      ).join('')
    : `<span style="font-size:12px;color:var(--g300)">연결된 성취기준 없음</span>`;
  let scoreHtml = '';
  if (isExam) {
    const sc = Number(item.scoreChoice)||0;
    const se = Number(item.scoreEssay)||0;
    const tot = sc + se;
    const warn = tot !== 100;
    const val = v => (v === '' || v == null) ? '' : v;
    scoreHtml = `<div class="eval-score-row">
      <div class="eval-score-field">
        <span class="eval-score-label">선택형</span>
        <input class="eval-score-input" type="number" min="0" value="${val(item.scoreChoice)}" placeholder="예) 70" aria-label="${esc(item.name)} 선택형 배점" data-oninput="ev:scoreChoice" data-args="${ai}">
        <span class="eval-score-unit">점</span>
      </div>
      <div class="eval-score-field">
        <span class="eval-score-label">논술형</span>
        <input class="eval-score-input" type="number" min="0" value="${val(item.scoreEssay)}" placeholder="예) 30" aria-label="${esc(item.name)} 논술형 배점" data-oninput="ev:scoreEssay" data-args="${ai}">
        <span class="eval-score-unit">점</span>
      </div>
      <span class="eval-score-sum${warn?' warn':''}" id="evalScoreSum_${i}" role="status">${evalScoreSumText(tot)}</span>
    </div>`;
  }
  const examPlaceholders = ['예) 4월 4주', '예) 6월 5주'];
  const examIdx = isExam ? evalState.items.slice(0, i).filter(it => it.type === 'exam').length : 0;
  const periodPlaceholder = isExam ? (examPlaceholders[examIdx] || '예) 4월 4주') : '예) 5월 2주';
  const periodHtml = `<div class="eval-period-row">
    <span class="eval-period-label">평가 시기</span>
    <input class="eval-period-input" id="evalPeriod_${i}" type="text" value="${esc(item.period||'')}"
      data-oninput="ev:period" data-args="${ai}"
      placeholder="${periodPlaceholder}" aria-label="${esc(item.name)} 평가 시기">
    ${weeks.length ? `<select class="eval-period-pick" data-onchange="ev:periodPick" data-args="${ai}" aria-label="${esc(item.name)} 평가 시기를 수업계획 주차에서 고르기"><option value="">수업계획 주차</option>${weeks.map(w => `<option>${esc(w)}</option>`).join('')}</select>` : ''}
  </div>`;
  return `<div class="eval-card">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="eval-card-type ${isExam?'exam':'perf'}">${isExam?'정기시험':'수행평가'}</span>
      <span style="font-size:12px;color:var(--g400)">${esc(item.name)}</span>
    </div>
    <input class="eval-card-name" type="text" value="${esc(item.name)}"
      data-oninput="ev:name" data-args="${ai}" placeholder="평가명 입력">
    <div class="eval-ratio-row">
      <input class="eval-ratio-input" type="number" min="0" max="100" value="${item.ratio}"
        data-oninput="ev:ratio" data-args="${ai}">
      <span class="eval-ratio-label">%</span>
      ${!isExam ? `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--g600);cursor:pointer;white-space:nowrap">
        <input type="checkbox" ${item.isEssay?'checked':''} data-onchange="ev:essay" data-args="${ai}" style="cursor:pointer">논술형</label>` : ''}
      <button class="eval-link-btn" data-onclick="ev:openModal" data-args="${ai}">성취기준 연결 ＋</button>
    </div>
    ${scoreHtml}
    <div class="eval-badges">${badgesHtml}</div>
    <div>
      <span class="eval-element-label">평가 요소</span>
      <textarea class="eval-element-textarea" data-oninput="ev:elements" data-args="${ai}"
        placeholder="예) 기계학습 원리 이해하기">${esc(item.elements||'')}</textarea>
    </div>
    ${periodHtml}
  </div>`;
}

function renderEvalPlan() {  
  const selSubj = SUBJECTS[evalState.subjectIdx];  
  let itemsHtml;  
  if (!evalState.generated) {    
    itemsHtml = emptySteps(['수업계획에서 가져오기 또는 횟수 설정', '평가 항목 생성', '비율·만점 입력 후 표 미리보기']);
  } else if (!evalState.items.length) {    
    itemsHtml = `<div class="eval-empty">평가 항목이 없습니다. 시험 횟수 또는 수행평가 수를 1 이상으로 설정하세요.</div>`;  
  } else {    
    itemsHtml = `<div class="eval-cards">${evalState.items.map((it,i) => evalCardHtml(it,i,evalWeekOptions())).join('')}</div>`;  
  }  
  return `<div class="eval-wrap plan-page">
    ${pageHead('수업/평가계획', '평가계획', '정기시험·수행평가 구성과 반영 비율을 설계해 표로 미리봅니다.')}
    <div class="eval-settings">
      <div class="eval-settings-title">평가 설정 <span class="eval-settings-sub">과목·학기는 위 기준을 따릅니다</span></div>
      <div class="eval-settings-row eval-import-row">
        <button class="pbtn sec" data-onclick="ev:importOpen">수업계획에서 가져오기</button>
        <span class="eval-import-hint">같은 과목·학기 수업계획의 정기시험 주·수행평가 주를 평가 항목 후보로 만듭니다</span>
      </div>
      <div class="eval-settings-row">
        <div class="eval-field">
          <span class="eval-label">정기시험 횟수 (0~2)</span>          
          <input type="number" class="eval-number" min="0" max="2" value="${evalState.examCount}" data-oninput="ev:examCount">
        </div>
        <div class="eval-field" id="evalExamKindField"${evalState.examCount === 1 ? '' : ' hidden'}>
          <span class="eval-label">어느 시험인가요?</span>
          <div class="eval-toggle-group" role="group" aria-label="정기시험 1회일 때 시험 종류">
            <button class="eval-toggle${evalState.examKind === 'mid' ? ' active' : ''}" aria-pressed="${evalState.examKind === 'mid'}" data-onclick="ev:examKind" data-args='["mid"]'>1차(중간)</button>
            <button class="eval-toggle${evalState.examKind !== 'mid' ? ' active' : ''}" aria-pressed="${evalState.examKind !== 'mid'}" data-onclick="ev:examKind" data-args='["final"]'>2차(기말)</button>
          </div>
        </div>        
        <div class="eval-field">          
          <span class="eval-label">수행평가 개수 (1~5)</span>          
          <input type="number" class="eval-number" min="1" max="5" value="${evalState.perfCount}" data-oninput="ev:perfCount">
        </div>        
        <div class="eval-field" style="flex-direction:row;gap:8px;align-items:center">          
          <button class="eval-gen-btn" data-onclick="ev:generate">평가 항목 생성</button>
          <button class="pbtn pri" data-onclick="ev:preview"
            ${!evalState.generated || !evalState.items.length ? 'disabled' : ''}>표 미리보기</button>
          <button class="pbtn sec" data-onclick="ev:reset">초기화</button>
        </div>      
      </div>    
    </div>    
    ${evalImportHtml()}
    ${itemsHtml}  
  </div>`;
}

// 시험 1회일 때 중간/기말 선택 — 기본 이름 그대로인 단일 시험 항목은 이름도 따라 바꾼다
function evalSetExamKind(kind) {
  evalState.examKind = kind === 'mid' ? 'mid' : 'final';
  const exams = evalState.items.filter(it => it.type === 'exam');
  const defaults = ['1차 정기시험(중간)', '2차 정기시험(기말)', '2차 정기시험', '1차 정기시험'];
  if (exams.length === 1 && defaults.includes(exams[0].name)) exams[0].name = evalExamNames(1, evalState.examKind)[0];
  evalSave(); evalRerender();
}
function evalGenItems() {  
  const ec = evalState.examCount;  
  const pc = evalState.perfCount;  
  const items = [];  
  const examNames = evalExamNames(ec, evalState.examKind);
  for (let i=0;i<ec;i++) items.push({type:'exam', name: examNames[i], ratio:0, linkedCodes:[], scoreChoice:'', scoreEssay:'', elements:'', period:''});  
  for (let i=0;i<pc;i++) items.push({type:'perf', name:`수행평가 ${i+1}`, ratio:0, linkedCodes:[], elements:'', period:'', isEssay:false});  
  if (items.length) {
    const r = evalDistribute(items.length);
    items.forEach((it, i) => { it.ratio = r[i]; });
  }
  evalState.items = items;
  evalState.generated = true;  
  evalSave(); evalRerender();
}
function evalUpdateName(i, val) {  evalState.items[i].name = val; evalSave(); evalShowSummary();}
function evalUpdateRatio(i, val) {  evalState.items[i].ratio = isNaN(val)?0:val; evalSave(); evalShowSummary();}
function evalScoreValue(raw) { if (String(raw).trim() === '') return ''; const n = +raw; return isNaN(n) ? '' : Math.max(0, n); }
function evalUpdateScoreChoice(i, raw) {
  evalState.items[i].scoreChoice = evalScoreValue(raw);
  evalSave(); evalShowSummary(); evalRefreshScoreSum(i);
}
function evalUpdateScoreEssay(i, raw) {
  evalState.items[i].scoreEssay = evalScoreValue(raw);
  evalSave(); evalShowSummary(); evalRefreshScoreSum(i);
}
function evalUpdatePeriod(i, val) {  evalState.items[i].period = val; evalSave();}
function evalToggleEssay(i, checked) {  
  evalState.items[i].isEssay = checked;  
  evalSave(); evalShowSummary();
}
function evalUnlinkCode(i, code) {  
  evalState.items[i].linkedCodes = evalState.items[i].linkedCodes.filter(c=>c!==code);  
  evalSave(); evalRerender();
}
function evalRerender() {
  if (!document.getElementById('main').querySelector('.eval-wrap')) return;
  if (evalPlanSubtab !== 'eval') return;
  document.getElementById('main').innerHTML = renderEvalPlan();
  if (evalState.generated) evalShowSummary(); else evalHideSummary();
}
function evalOpenModal(i) {
  const item = evalState.items[i];
  openStdPicker({
    title: '성취기준 연결',
    subjectIdx: evalState.subjectIdx,
    lockSubject: true,
    preselected: item.linkedCodes,
    selectAll: true,
    onConfirm: (codes) => {
      item.linkedCodes = codes;
      evalSave();
      evalRerender();
    }
  });
}
function evalUpdateElements(i, val) {  evalState.items[i].elements = val; evalSave();}
async function evalReset() {
  if (!(await uiConfirm('모든 입력값이 초기화됩니다. 계속할까요?'))) return;
  const stash = JSON.parse(JSON.stringify(evalState)); // 되돌리기용 스냅샷
  // evalState는 export const — 재할당은 TypeError로 조용히 실패했음(버그 수정 2026-07-08). 내용 교체 + 저장.
  const keep = { subjectIdx: evalState.subjectIdx, semester: evalState.semester };
  Object.keys(evalState).forEach(k => delete evalState[k]);
  Object.assign(evalState, evalDefault(), keep);
  evalSave();
  evalHideSummary();
  evalRerender();
  uiToast('평가계획을 초기화했습니다.', { actionLabel: '되돌리기', onAction() {
    Object.assign(evalState, stash);
    evalSave();
    evalRerender();
    if (evalState.generated) evalShowSummary();
  } });
}
function evalOpenPreview() {  
  if (!evalState.generated || !evalState.items.length) return;  
  document.getElementById('evalPreviewBody').innerHTML = evalPreviewTableHtml();  
  const m = document.getElementById('evalPreviewModal');
  m.style.display = 'flex';
  trapFocus(m);
}
function evalClosePreview() {
  const m = document.getElementById('evalPreviewModal');
  releaseFocus(m);
  m.style.display = 'none';
}
function evalPreviewTableHtml() {  
  const items = evalState.items;  
  const examItems = items.filter(it => it.type === 'exam');  
  const perfItems = items.filter(it => it.type === 'perf');  
  const ec = examItems.length;  
  const pc = perfItems.length;  
  const subj = SUBJECTS[evalState.subjectIdx];  
  const accent = subj ? subj.accent : '#7C3AED';  
  const aLight = subj ? subj.aLight : '#F5F3FF';  
  const essayContrib = it => {    
    const sc = Number(it.scoreChoice)||0, se = Number(it.scoreEssay)||0, tot = sc + se;    
    return tot > 0 ? (Number(it.ratio)||0) * (se / tot) : 0;  
  };  
  const totalEssay = examItems.reduce((s, it) => s + essayContrib(it), 0)                   
                   + perfItems.reduce((s, it) => s + (it.isEssay ? (Number(it.ratio)||0) : 0), 0);  
  const thStyle = (extra='') => `style="background:var(--g100);padding:10px 14px;font-weight:600;color:var(--g700);border-bottom:2px solid var(--g200);text-align:center;${extra}"`;  
  const tdStyle = (extra='') => `style="padding:10px 14px;border-bottom:1px solid var(--g100);color:var(--g700);vertical-align:top;font-size:12px;${extra}"`;  
  const labelStyle = `style="padding:10px 14px;border-bottom:1px solid var(--g100);background:var(--g50);font-weight:600;font-size:12px;color:var(--g700);white-space:nowrap;vertical-align:middle"`;  
  
  // Header row 1  
  let thead = `<tr>    
    <th rowspan="2" ${thStyle('vertical-align:middle;text-align:left')}>내용</th>    
    ${ec > 0 ? `<th colspan="${ec}" ${thStyle('color:#2563EB;background:#EFF6FF')}>정기시험</th>` : ''}    
    <th colspan="${pc}" ${thStyle('color:#7C3AED;background:#F5F3FF')}>수행평가</th>    
    <th rowspan="2" ${thStyle('vertical-align:middle')}>합계</th>  
  </tr>`;  
  // Header row 2 (item names)  
  thead += `<tr>    
    ${examItems.map(it => `<th ${thStyle('color:#2563EB;background:#EFF6FF')}>${esc(it.name)}</th>`).join('')}    
    ${perfItems.map(it => `<th ${thStyle('color:#7C3AED;background:#F5F3FF')}>${esc(it.name)}</th>`).join('')}  
  </tr>`;  
  // Row: 반영비율  
  let rows = `<tr data-eval-row="ratio">
    <td ${labelStyle}>반영비율</td>    
    ${items.map(it => `<td ${tdStyle('text-align:center')}><strong>${it.ratio}%</strong></td>`).join('')}    
    <td ${tdStyle('text-align:center;font-weight:700')}>${evalRatioSum(items)}%</td>
  </tr>`;  
  // Row: 영역 만점(반영비율)  
  rows += `<tr data-eval-row="score">
    <td ${labelStyle}>영역 만점<br>(반영비율)</td>    
    ${examItems.map(it => {      
      const sc = Number(it.scoreChoice)||0, se = Number(it.scoreEssay)||0;      
      const tot = sc + se, ratio = Number(it.ratio)||0;      
      const scPct = tot > 0 ? (sc/tot*ratio).toFixed(1) : 0;      
      const sePct = tot > 0 ? (se/tot*ratio).toFixed(1) : 0;      
      return `<td ${tdStyle('line-height:1.8;text-align:center')}>선택형 ${sc}점(${scPct}%)<br>논술형 ${se}점(${sePct}%)</td>`;
    }).join('')}    
    ${perfItems.map(it => `<td ${tdStyle('text-align:center')}>${it.ratio}%</td>`).join('')}    
    <td ${tdStyle('text-align:center;font-weight:700')}>${evalRatioSum(items)}%</td>
  </tr>`;  
  // Row: 논술형 평가 반영비율  
  rows += `<tr data-eval-row="essay">
    <td ${labelStyle}>논술형 평가<br>반영비율</td>    
    ${examItems.map(it => `<td ${tdStyle('text-align:center')}>${essayContrib(it).toFixed(1)}%</td>`).join('')}    
    ${perfItems.map(it => it.isEssay      
      ? `<td ${tdStyle('text-align:center;font-weight:600')}>${Number(it.ratio)||0}%</td>`      
      : `<td ${tdStyle('text-align:center;color:var(--g300)')}>-</td>`).join('')}    
    <td ${tdStyle('text-align:center;font-weight:700')}>${totalEssay.toFixed(1)}%</td>  
  </tr>`;  
  // Row: 성취기준  
  rows += `<tr data-eval-row="standards">
    <td ${labelStyle}>성취기준</td>    
    ${items.map(it => `<td ${tdStyle()}>` +      
      (it.linkedCodes.length        
        ? it.linkedCodes.map(c => `<span class="code-badge" style="background:${aLight};color:${accent};margin:1px 2px;display:inline-block">${esc(c)}</span>`).join(' ')        
        : `<span style="color:var(--g300)">-</span>`) +      
      `</td>`).join('')}    
    <td ${tdStyle()}></td>  
  </tr>`;  
  // Row: 평가 요소  
  rows += `<tr data-eval-row="elements">
    <td ${labelStyle}>평가 요소</td>    
    ${items.map(it => {      
      const txt = (it.elements||'').trim();      
      return `<td ${tdStyle('white-space:pre-wrap')}>${txt ? esc(txt) : `<span style="color:var(--g300)">-</span>`}</td>`;    
    }).join('')}    
    <td ${tdStyle()}></td>  
  </tr>`;  
  // Row: 평가 시기  
  rows += `<tr data-eval-row="period">
    <td ${labelStyle}>평가 시기</td>    
    ${items.map(it => {      
      const txt = (it.period||'').trim();      
      return `<td ${tdStyle()}>${txt ? esc(txt) : `<span style="color:var(--g300)">-</span>`}</td>`;    
    }).join('')}    
    <td ${tdStyle()}></td>  
  </tr>`;  
  return `<div class="ov-table-box"><table class="ov-table"    
    style="width:100%;border-collapse:collapse;font-size:13px">    
    <thead>${thead}</thead>    
    <tbody>${rows}</tbody>  
  </table></div>`;
}

function evalCopyPreviewTable() {  
  const items = evalState.items;  
  const examItems = items.filter(it => it.type === 'exam');  
  const essayContrib = it => {    
    const sc = Number(it.scoreChoice)||0, se = Number(it.scoreEssay)||0, tot = sc+se;    
    return tot > 0 ? (Number(it.ratio)||0)*(se/tot) : 0;  
  };  
  const perfItems = items.filter(it => it.type === 'perf');  
  const totalEssay = examItems.reduce((s,it) => s+essayContrib(it), 0)                   
                   + perfItems.reduce((s,it) => s+(it.isEssay?(Number(it.ratio)||0):0), 0);  
  const lines = [    
    ['내용', ...items.map(it => it.name), '합계'].join('\t'),    
    ['반영비율', ...items.map(it => it.ratio+'%'), evalRatioSum(items)+'%'].join('\t'),
    ['영역 만점(반영비율)', ...items.map(it => {      
      if (it.type === 'exam') {        
        const sc=Number(it.scoreChoice)||0, se=Number(it.scoreEssay)||0;        
        const tot=sc+se, ratio=Number(it.ratio)||0;        
        const scP = tot>0?(sc/tot*ratio).toFixed(1):0;        
        const seP = tot>0?(se/tot*ratio).toFixed(1):0;        
        return `선택형 ${sc}점(${scP}%) / 논술형 ${se}점(${seP}%)`;      
      }      
      return it.ratio+'%';    }), evalRatioSum(items)+'%'].join('\t'),
    ['논술형 평가 반영비율', ...items.map(it => it.type==='exam' ? essayContrib(it).toFixed(1)+'%' : (it.isEssay ? (Number(it.ratio)||0)+'%' : '-')), totalEssay.toFixed(1)+'%'].join('\t'),    
    ['성취기준', ...items.map(it => it.linkedCodes.join(', ')||'-'), ''].join('\t'),    
    ['평가 요소', ...items.map(it => (it.elements||'').replace(/\n/g,' / ')||'-'), ''].join('\t'),    
    ['평가 시기', ...items.map(it => (it.period||'')||'-'), ''].join('\t'),  
  ];  
  navigator.clipboard.writeText(lines.join('\n'))    
    .then(() => {      
      const btn = document.getElementById('evalCopyBtn');      
      if (btn) { btn.textContent='✓ 복사됨'; setTimeout(()=>btn.textContent='클립보드 복사', 1500); }    
    })    
    .catch(() => uiToast('클립보드 복사에 실패했습니다.', { isErr: true }));
}

export {
  renderEvalPlan, evalSubjects, evalHideSummary, evalShowSummary,
  evalReset, evalOpenPreview, evalClosePreview
};
// 테스트 전용 노출 (tools/test.mjs) — 순수 계산 코어. 앱 렌더는 위 함수만 사용.
export const __evalTest = { coverageBase: evalCoverageBase, summaryHtml: () => evalSummaryHtml(), status: evalStatus, candidates: evalCandidatesFromLesson, examNames: evalExamNames, reload: evalLoadSlot, ratioSum: evalRatioSum, essayRatio: evalEssayRatio, distribute: evalDistribute, previewTableHtml: evalPreviewTableHtml };
// index.html 정적 모달 버튼(app.js bindStaticHandlers)이 참조 — 유지
window.evalClosePreview = evalClosePreview;
window.evalCopyPreviewTable = evalCopyPreviewTable;

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'ev:importOpen':   function() { evalOpenImport(); },
  'ev:examKind':     function(el, e, kind) { evalSetExamKind(kind); },
  'ev:sumToggle':    function() { evalState.sumOpen = !evalState.sumOpen; evalSumPop = null; evalSave(); evalShowSummary(); document.querySelector('#evalSumPanel .eval-sum-toggle')?.focus(); },
  'ev:sumChip':      function(el, e, code) { evalSumPop = evalSumPop === code ? null : code; evalShowSummary(); document.querySelector('#evalSumPanel .eval-sum-pop [role=menuitem]')?.focus(); },
  'ev:sumLink':      function(el, e, code, i) { evalSumLink(code, i); },
  'ev:importApply':  function() { evalApplyImport(); },
  'ev:importCancel': function() { evalImport = null; evalRerender(); },
  'ev:generate':  function() { evalGenItems(); },
  'ev:preview':   function() { evalOpenPreview(); },
  'ev:reset':     function() { evalReset(); },
  'ev:openModal': function(el, e, i) { evalOpenModal(i); },
  'ev:unlink':    function(el, e, i, code) { evalUnlinkCode(i, code); },
});
registerActions('input', {
  'ev:name':        function(el, e, i) { evalUpdateName(i, el.value); },
  'ev:ratio':       function(el, e, i) { evalUpdateRatio(i, +el.value); },
  'ev:scoreChoice': function(el, e, i) { evalUpdateScoreChoice(i, el.value); },
  'ev:scoreEssay':  function(el, e, i) { evalUpdateScoreEssay(i, el.value); },
  'ev:period':      function(el, e, i) { evalUpdatePeriod(i, el.value); },
  'ev:elements':    function(el, e, i) { evalUpdateElements(i, el.value); },
  'ev:examCount':   function(el) { evalState.examCount = Math.max(0, Math.min(2, +el.value||0)); evalSave(); const f = document.getElementById('evalExamKindField'); if (f) f.hidden = evalState.examCount !== 1; },
  'ev:perfCount':   function(el) { evalState.perfCount = Math.max(1, Math.min(5, +el.value||1)); },
});
registerActions('change', {
  'ev:importPick': function(el, e, i) { if (evalImport && evalImport[i]) evalImport[i].pick = el.checked; },
  'ev:periodPick': function(el, e, i) { if (!el.value) return; evalUpdatePeriod(i, el.value); const inp = document.getElementById('evalPeriod_' + i); if (inp) inp.value = el.value; el.value = ''; },
  'ev:essay':   function(el, e, i) { evalToggleEssay(i, el.checked); },
});