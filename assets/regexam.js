import { esc, loadState, saveState, registerActions, pageHead, uiConfirm } from './utils.js';
import { openStdPicker } from './stdpicker.js';
import * as planCtx from './planctx.js';

// --- RegExam State ---
// 저장: jungle_regexam = { v:2, slots: { '<과목id>:<학기>': 출제 계획 } } — 예전 단일 객체는 지금 과목·학기 슬롯으로 옮긴다.
function regExamBlank() { return { rows: Array.from({length:20}, (_,i) => ({num:i+1, topic:'', stds:[], level:'중', score:0})), scoreH:4, scoreM:3, scoreL:2, examIdx:0 }; }
function regExamNormalize(s) {
  s.rows = (s.rows || []).map((r, i) => ({
    num: r.num || i+1,
    topic: r.topic || '',
    stds: r.stds || (r.std ? [r.std] : []),
    level: r.level || '중',
    score: r.score || 0
  }));
  if (!s.rows.length) s.rows = regExamBlank().rows;
  if (!('scoreH' in s)) { s.scoreH = 4; s.scoreM = 3; s.scoreL = 2; }
  if (typeof s.examIdx !== 'number') s.examIdx = 0;
  return s;
}
const regExamStore = planCtx.slotStore('jungle_regexam', { legacyToSlot: raw => [planCtx.legacyKey(raw), regExamNormalize(raw)] });
let regExamState = regExamNormalize(regExamStore.load() || regExamBlank());
planCtx.subscribe(() => { regExamState = regExamNormalize(regExamStore.load() || regExamBlank()); });
function regExamSave() { regExamStore.save(regExamState); }
// 평가계획의 정기시험 목록과 지금 고른 시험
function regExamExams() { return planCtx.consume('evalExams') || []; }
function regExamCurrent() { const ex = regExamExams(); return ex[regExamState.examIdx] || ex[0] || null; }
// 목표 총점: 평가계획에 선택형·논술형 배점을 넣었으면 그 합, 아니면 100점
function regExamTarget() {
  const ex = regExamCurrent();
  const t = ex ? (Number(ex.scoreChoice) || 0) + (Number(ex.scoreEssay) || 0) : 0;
  return t > 0 ? t : 100;
}
function regExamSetCount(n) {
  const cnt = Math.min(30, Math.max(15, parseInt(n) || 20));
  const cur = regExamState.rows;
  if (cnt > cur.length) {
    for (let i = cur.length; i < cnt; i++) cur.push({num:i+1, topic:'', stds:[], level:'중', score:0});
  } else {
    regExamState.rows = cur.slice(0, cnt);
  }
  regExamSave(); regExamRerender();
}
function regExamSetExam(i) { regExamState.examIdx = +i || 0; regExamSave(); regExamRerender(); }
function regExamSet(idx, field, val) {
  regExamState.rows[idx][field] = field === 'score' ? (parseFloat(val) || 0) : val;
  regExamSave();
  if (field === 'score') regExamUpdateTotal();
}
function regExamOpenModal(rowIdx) {
  const row = regExamState.rows[rowIdx];
  const ex = regExamCurrent();
  openStdPicker({
    title: '성취기준 선택',
    subjectIdx: planCtx.subjectIdx(),
    lockSubject: true,
    preselected: row.stds,
    selectAll: true,
    onlyCodes: ex && ex.linkedCodes.length ? ex.linkedCodes : null,
    onlyLabel: ex ? ex.name + ' 범위' : '',
    onConfirm: (codes) => {
      row.stds = codes;
      regExamSave();
      regExamRerender();
    }
  });
}
function regExamAddStd(idx) {
  regExamState.rows[idx].stds.push('');
  regExamSave(); regExamRerender();
}
function regExamSetStd(idx, si, val) {
  regExamState.rows[idx].stds[si] = val;
  regExamSave();
}
function regExamRemoveStd(idx, si) {
  regExamState.rows[idx].stds.splice(si, 1);
  regExamSave(); regExamRerender();
}
function regExamUpdateTotal() {
  const total = Math.round(regExamState.rows.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) * 10) / 10;
  const el = document.getElementById('regExamTotal');
  if (!el) return;
  el.textContent = total + '점';
  const target = regExamTarget();
  el.className = 'regexam-total-val' + (Math.abs(total - target) < 0.001 ? ' ok' : total > target ? ' over' : ' under');
}
function regExamAutoScore() {
  const base = { '상': parseFloat(regExamState.scoreH) || 4, '중': parseFloat(regExamState.scoreM) || 3, '하': parseFloat(regExamState.scoreL) || 2 };
  regExamState.rows.forEach(r => { r.score = base[r.level] ?? base['중']; });
  regExamSave(); regExamRerender();
}
async function regExamReset() {
  if (!(await uiConfirm('입력 내용을 모두 초기화할까요?'))) return;
  regExamState.rows = regExamBlank().rows;
  regExamSave(); regExamRerender();
}
function regExamRerender() {
  if (!document.getElementById('main').querySelector('.regexam-wrap')) return;
  document.getElementById('main').innerHTML = renderRegExam();
}
function renderRegExam() {
  const rows = regExamState.rows;
  const cnt  = rows.length;
  const total = Math.round(rows.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) * 10) / 10;
  const target = regExamTarget();
  const totalCls = 'regexam-total-val' + (Math.abs(total - target) < 0.001 ? ' ok' : total > target ? ' over' : ' under');
  const exams = regExamExams(), cur = regExamCurrent();
  const examBar = exams.length
    ? `<div class="regexam-exam-bar"><label class="regexam-cnt-label">어느 정기시험인가요?
        <select class="eval-select" data-onchange="rx:exam">${exams.map((e, i) => `<option value="${i}"${e === cur ? ' selected' : ''}>${esc(e.name)}${e.period ? ' · ' + esc(e.period) : ''}</option>`).join('')}</select></label>
        <span class="regexam-exam-meta">시험 범위 성취기준 ${cur.linkedCodes.length}개${(Number(cur.scoreChoice) || Number(cur.scoreEssay)) ? ` · 목표 총점 <strong>${target}점</strong> (선택형 ${Number(cur.scoreChoice) || 0} + 논술형 ${Number(cur.scoreEssay) || 0})` : ' · 평가계획에 배점을 넣으면 목표 총점으로 씁니다'}</span></div>`
    : '<p class="regexam-exam-bar regexam-exam-none">평가계획에 정기시험 항목이 없어 과목 전체 성취기준에서 고릅니다. 목표 총점은 100점입니다.</p>';

  const lvStats = { '상': {cnt:0, score:0}, '중': {cnt:0, score:0}, '하': {cnt:0, score:0} };
  rows.forEach(r => {
    const lv = r.level || '중';
    if (lvStats[lv]) { lvStats[lv].cnt++; lvStats[lv].score = Math.round((lvStats[lv].score + (parseFloat(r.score)||0)) * 10) / 10; }
  });
  const lvColors = { '상': '#dc2626', '중': '#2563eb', '하': '#16a34a' };
  const summaryHtml = ['상','중','하'].map(lv => {
    const st = lvStats[lv];
    return `<div class="regexam-sum-item">
      <span class="regexam-sum-badge" style="background:${lvColors[lv]}">${lv}</span>
      <span class="regexam-sum-cnt">${st.cnt}문항</span>
      <span class="regexam-sum-score">${st.score}점</span>
    </div>`;
  }).join('<div class="regexam-sum-sep"></div>');

  const rowsHtml = rows.map((r, i) => {
    const stds = r.stds || [];
    const badgesHtml = stds.map((s, si) =>
      `<span class="regexam-std-badge">${esc(s)}<button class="regexam-std-del" data-onclick="rx:rmStd" data-args="[${i},${si}]" aria-label="${esc(s)} 제거">×</button></span>`
    ).join('');
    return `<tr>
      <td class="regexam-num">${r.num}</td>
      <td><input class="regexam-topic-input" type="text" value="${esc(r.topic||'')}"
          placeholder="출제 주제" aria-label="${r.num}번 문항 출제 주제"
          data-onchange="rx:topic" data-args="[${i}]"></td>
      <td class="regexam-stds-cell">
        ${badgesHtml}
        <button class="regexam-std-add" data-onclick="rx:openModal" data-args="[${i}]">+ 성취기준 선택</button>
      </td>
      <td>
        <select class="regexam-level-sel" aria-label="${r.num}번 문항 난이도" data-onchange="rx:level" data-args="[${i}]">
          ${['상','중','하'].map(lv=>`<option${r.level===lv?' selected':''}>${lv}</option>`).join('')}
        </select>
      </td>
      <td><input class="regexam-score-input" type="number" min="0" max="100" step="0.5" value="${r.score||''}"
          placeholder="0" aria-label="${r.num}번 문항 배점"
          data-oninput="rx:score" data-args="[${i}]"></td>
    </tr>`;
  }).join('');

  return `<div class="regexam-wrap">
    ${pageHead('수업/평가계획', '정기시험 출제 계획', '문항별 출제 주제·성취기준·난이도·배점을 정리합니다.')}
    ${examBar}
    <div class="regexam-toolbar">
      <div class="regexam-toolbar-left">
        <label class="regexam-cnt-label">문항 수
          <select class="eval-select" data-onchange="rx:count">
            ${Array.from({length:16},(_,i)=>i+15).map(n=>`<option${n===cnt?' selected':''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="regexam-toolbar-right">
        <span class="regexam-score-preset-label">기준 배점</span>
        <label class="regexam-preset-item">상<input class="regexam-preset-input" type="number" min="0" step="0.5" value="${regExamState.scoreH}" data-oninput="rx:presetH"></label>
        <label class="regexam-preset-item">중<input class="regexam-preset-input" type="number" min="0" step="0.5" value="${regExamState.scoreM}" data-oninput="rx:presetM"></label>
        <label class="regexam-preset-item">하<input class="regexam-preset-input" type="number" min="0" step="0.5" value="${regExamState.scoreL}" data-oninput="rx:presetL"></label>
        <span class="regexam-total-label">총점 (목표 ${target}점)</span>
        <span id="regExamTotal" class="${totalCls}">${total}점</span>
        <button class="pbtn pri" data-onclick="rx:auto">배점 자동계산</button>
        <button class="pbtn sec" data-onclick="rx:reset">초기화</button>
      </div>
    </div>
    <p class="scroll-hint" aria-hidden="true">← 옆으로 밀어 보기</p>
    <div class="regexam-table-wrap scroll-fade">
      <table class="regexam-table">
        <colgroup><col style="width:48px"><col style="width:22%"><col><col style="width:64px"><col style="width:72px"></colgroup>
        <thead><tr>
          <th>번호</th><th>출제 주제</th><th>성취기준</th><th>난이도</th><th>배점(점)</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right;font-weight:700;padding:8px 12px">합계</td>
          <td id="regExamTotalFoot" style="font-weight:700;padding:8px 12px;text-align:center;color:${Math.abs(total-target)<0.001?'var(--ok)':total>target?'var(--danger)':'var(--warn)'}">${total}점</td>
        </tr></tfoot>
      </table>
    </div>
    <p class="regexam-hint${Math.abs(total-target)<0.001?'':' warn'}" role="status">${Math.abs(total-target)<0.001?'✓ 총점이 목표('+target+'점)와 같습니다.':total>target?'⚠ 총점이 목표 '+target+'점보다 '+Math.round((total-target)*10)/10+'점 많습니다.':'⚠ 총점이 목표 '+target+'점에 '+Math.round((target-total)*10)/10+'점 부족합니다.'}</p>
    <div class="regexam-summary">
      <span class="regexam-sum-title">난이도별 집계</span>
      ${summaryHtml}
    </div>
  </div>`;
}

export { renderRegExam };
export const __rxTest = { target: regExamTarget, current: regExamCurrent, state: () => regExamState };

function regExamSetPreset(field, v) { regExamState[field] = parseFloat(v) || 0; regExamSave(); }

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'rx:rmStd':     function(el, e, i, si) { regExamRemoveStd(i, si); },
  'rx:openModal': function(el, e, i) { regExamOpenModal(i); },
  'rx:auto':      function() { regExamAutoScore(); },
  'rx:reset':     function() { regExamReset(); },
});
registerActions('input', {
  'rx:score':   function(el, e, i) { regExamSet(i, 'score', el.value); },
  'rx:presetH': function(el) { regExamSetPreset('scoreH', el.value); },
  'rx:presetM': function(el) { regExamSetPreset('scoreM', el.value); },
  'rx:presetL': function(el) { regExamSetPreset('scoreL', el.value); },
});
registerActions('change', {
  'rx:topic': function(el, e, i) { regExamSet(i, 'topic', el.value); },
  'rx:level': function(el, e, i) { regExamSet(i, 'level', el.value); },
  'rx:count': function(el) { regExamSetCount(el.value); },
  'rx:exam':  function(el) { regExamSetExam(el.value); },
});
