import { esc, loadState, registerActions, pageHead, emptySteps, uiToast, uiConfirm } from './utils.js';
import { evalSubjects, evalPlanSubtab } from './evalplan.js';
import { LP_SEM_DEFAULTS } from './state.js';
import { openStdPicker } from './stdpicker.js';

// --- Lesson Plan State ---
let lessonState = (() => {
  const s = loadState('jungle_lesson_plan', null);
  if (s) {
    const def = LP_SEM_DEFAULTS[s.semester] || LP_SEM_DEFAULTS[1];
    if (!s.startMW) s.startMW = def.startMW;
    if (!s.endMW)   s.endMW   = def.endMW;
    return s;
  }
  return { subjectIdx:1, semester:1, startMW:'3/1', endMW:'7/2', generated:false, rows:[] };
})();

function lpSave() {  
  try { localStorage.setItem('jungle_lesson_plan', JSON.stringify(lessonState)); } catch(e) {}
}
function lpParseWeek(str) {  
  const p = (str || '').trim().split('/');  
  const m = parseInt(p[0]), w = parseInt(p[1]);  
  return (!isNaN(m) && !isNaN(w) && w >= 1 && w <= 4) ? {m, w} : null;
}
function lpGenWeeks(semester, startMW, endMW) {  
  const s = lpParseWeek(startMW), e = lpParseWeek(endMW);  
  // month sequence per semester (wraps Jan after Dec for semester 2)  
  const seq = semester === 2    
    ? [8,9,10,11,12,1,2,3,4,5,6,7]    
    : [1,2,3,4,5,6,7,8,9,10,11,12];  
  if (s && e) {    
    const weeks = [];    
    let on = false, done = false;    
    for (const m of seq) {      
      if (done) break;      
      for (let w = 1; w <= 4; w++) {        
        if (m === s.m && w === s.w) on = true;        
        if (on) weeks.push(m + '/' + w);        
        if (m === e.m && w === e.w) { done = true; break; }      
      }    
    }    
    if (weeks.length) return weeks;  
  }  
  // fallback to hardcoded defaults  
  const def = LP_SEM_DEFAULTS[semester] || LP_SEM_DEFAULTS[1];  
  return lpGenWeeks(semester, def.startMW, def.endMW);
}
function lpSetSubject(idx) {  
  lessonState.subjectIdx = idx;  
  lessonState.rows.forEach(r => { r.domain = ''; r.linkedCodes = []; });  
  lpSave(); lpRerender();
}
function lpSetSemester(n) {  
  lessonState.semester = n;  
  const def = LP_SEM_DEFAULTS[n];  
  lessonState.startMW = def.startMW;  
  lessonState.endMW   = def.endMW;  
  lpSave(); lpRerender();
}
function lpSetStartMW(val) {  lessonState.startMW = val.trim();  lpSave();}
function lpSetEndMW(val) {  lessonState.endMW = val.trim();  lpSave();}
function lpGenerate() {  
  const weeks = lpGenWeeks(lessonState.semester, lessonState.startMW, lessonState.endMW);  
  lessonState.rows = weeks.map(mw => ({monthWeek:mw, domain:'', linkedCodes:[], method:'', evalMethod:''}));  
  lessonState.generated = true;  
  lpSave(); lpRerender();
}
function lpAddRow() {  
  lessonState.rows.push({monthWeek:'', domain:'', linkedCodes:[], method:'', evalMethod:''});  
  lpSave(); lpRerender();
}
function lpDeleteRow(i) {  
  lessonState.rows.splice(i, 1);  
  lpSave(); lpRerender();
}
function lpUpdateMW(i, val) {  lessonState.rows[i].monthWeek = val;  lpSave();}
function lpSetDomain(i, val) {  
  lessonState.rows[i].domain = val;  
  lessonState.rows[i].linkedCodes = [];  
  lpSave(); lpRerender();
}
function lpSetMethod(i, val) {  lessonState.rows[i].method = val;  lpSave();}
function lpSetEvalMethod(i, val) {  
  lessonState.rows[i].evalMethod = val;  
  lpSave();  
  const tbody = document.querySelector('.lp-table tbody');
  if (tbody) {
    const tr = tbody.querySelectorAll('tr')[i];
    if (tr) tr.style.background = val === '수행평가' ? 'var(--warn-soft)' : '';
  }
}
function lpUnlinkCode(i, code) {  
  lessonState.rows[i].linkedCodes = lessonState.rows[i].linkedCodes.filter(c => c !== code);  
  lpSave(); lpRerender();
}
function lpOpenModal(rowIdx) {
  const row = lessonState.rows[rowIdx];
  openStdPicker({
    title: '성취기준 연결',
    subjectIdx: lessonState.subjectIdx,
    preselected: row.linkedCodes,
    selectAll: true,
    highlightDomain: row.domain || '',
    onConfirm: (codes) => {
      row.linkedCodes = codes;
      lpSave();
      lpRerender();
    }
  });
}
async function lpReset() {
  if (!(await uiConfirm('수업계획이 초기화됩니다. 계속할까요?'))) return;
  lessonState = {subjectIdx:1, semester:1, generated:false, rows:[]};  
  localStorage.removeItem('jungle_lesson_plan');  
  lpRerender();
}
function lpCopy() {  
  if (!lessonState.generated || !lessonState.rows.length) return;  
  const header = ['월/주','단원명','성취기준','수업방법'].join('\t');  
  const rows = lessonState.rows.map(r =>    
    [r.monthWeek, r.domain, r.linkedCodes.join(', '), r.method].join('\t')  
  );  
  navigator.clipboard.writeText([header,...rows].join('\n')).then(() => {    
    const btn = document.querySelector('.lp-copy-btn');    
    if (btn) { const t = btn.textContent; btn.textContent='복사됨!'; setTimeout(()=>btn.textContent=t, 1500); }  
  }).catch(() => uiToast('복사에 실패했습니다.', { isErr: true }));
}
function lpRerender() {
  if (!document.getElementById('main').querySelector('.eval-wrap')) return;
  if (evalPlanSubtab !== 'lesson') return;
  document.getElementById('main').innerHTML = renderLessonPlan();
}
function renderLessonTable(selSubj) {
  const domains = selSubj && selSubj.domains ? selSubj.domains : [];
  const accent  = selSubj ? selSubj.accent : 'var(--plan)';
  const aLight  = selSubj ? selSubj.aLight : 'var(--plan-soft)';
  const rowsHtml = lessonState.rows.map((row, i) => {
    const ROM = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ'];
    const domOpts = `<option value="">단원 선택</option>` +
      domains.map((d, di) => `<option value="${esc(d.name)}"${row.domain===d.name?' selected':''}>${ROM[di]||di+1}. ${esc(d.name)}</option>`).join('');
    const mthOpts = `<option value="">선택</option>` +
      LP_METHODS.map(m => `<option value="${esc(m)}"${row.method===m?' selected':''}>${esc(m)}</option>`).join('');
    const evalOpts = `<option value="">선택 안 함</option>` +
      LP_EVAL_METHODS.map(m => `<option value="${esc(m)}"${row.evalMethod===m?' selected':''}>${esc(m)}</option>`).join('');
    const rowBg = row.evalMethod === '수행평가' ? 'var(--warn-soft)' : row.evalMethod === '지필평가' ? 'var(--danger-soft)' : '';
    const ai = esc(JSON.stringify([i]));
    const codesHtml = row.linkedCodes.map(c =>
      `<span class="lp-code-badge" style="background:${aLight};color:${accent}">${esc(c)}<button class="lp-code-del" data-onclick="lp:unlink" data-args="${esc(JSON.stringify([i, c]))}" aria-label="${esc(c)} 제거">×</button></span>`
    ).join('');
    return `<tr style="background:${rowBg}">
      <td><div class="lp-mw" contenteditable="true" data-onblur="lp:mw" data-args="${ai}">${esc(row.monthWeek)}</div></td>
      <td><select class="lp-select" data-onchange="lp:domain" data-args="${ai}">${domOpts}</select></td>
      <td class="lp-std-cell">${codesHtml}<button class="lp-add-std" data-onclick="lp:openModal" data-args="${ai}">+ 성취기준</button></td>
      <td><select class="lp-select" data-onchange="lp:method" data-args="${ai}">${mthOpts}</select></td>
      <td><select class="lp-select" data-onchange="lp:evalMethod" data-args="${ai}">${evalOpts}</select></td>
      <td><button class="lp-del-row" data-onclick="lp:delRow" data-args="${ai}">✕</button></td>
    </tr>`;
  }).join('');
  return `<div class="lp-table-wrap">
    <table class="lp-table">
      <thead><tr>
        <th style="width:68px">월/주</th>
        <th style="width:155px">단원명</th>
        <th>성취기준</th>
        <th style="width:110px">수업방법</th>
        <th style="width:110px">평가방법</th>
        <th style="width:34px"></th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <button class="lp-add-row-btn" data-onclick="lp:addRow">+ 행 추가</button>
  </div>`;
}
function renderLessonPlan() {  
  const subjs = evalSubjects();  
  const subjOpts = subjs.map(s => {    
    const idx = SUBJECTS.indexOf(s);    
    return `<option value="${idx}"${lessonState.subjectIdx===idx?' selected':''}>${esc(s.name)}</option>`;  
  }).join('');  
  const selSubj = SUBJECTS[lessonState.subjectIdx];  
  const tableHtml = lessonState.generated    
    ? renderLessonTable(selSubj)    
    : emptySteps(['과목·주차 설정', '계획표 생성', '성취기준 배치 후 표 복사']);
  return `<div class="eval-wrap">
    ${pageHead('수업/평가계획', '수업계획', '성취기준을 주차별로 배치해 학기 수업계획서를 만들고 표로 복사합니다.')}
    <div class="eval-settings">      
      <div class="eval-settings-title">수업계획 설정</div>      
      <div class="eval-settings-row">        
        <div class="eval-field">
          <span class="eval-label">과목</span>
          <select class="eval-select" data-onchange="lp:subject">${subjOpts}</select>
        </div>
        <div class="eval-field">
          <span class="eval-label">학기</span>
          <div class="eval-toggle-group">
            <button class="eval-toggle${lessonState.semester===1?' active':''}" data-onclick="lp:semester" data-args="[1]" aria-pressed="${lessonState.semester===1}">1학기</button>
            <button class="eval-toggle${lessonState.semester===2?' active':''}" data-onclick="lp:semester" data-args="[2]" aria-pressed="${lessonState.semester===2}">2학기</button>
          </div>
        </div>
        <div class="eval-field">
          <span class="eval-label">시작 주차</span>
          <input type="text" class="lp-week-input" value="${esc(lessonState.startMW)}" placeholder="예: 3/1" data-oninput="lp:startMW">
        </div>
        <div class="eval-field">
          <span class="eval-label">종료 주차</span>
          <input type="text" class="lp-week-input" value="${esc(lessonState.endMW)}" placeholder="예: 7/2" data-oninput="lp:endMW">
        </div>
        <div class="eval-field" style="flex-direction:row;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="eval-gen-btn" data-onclick="lp:generate">계획표 생성</button>
          <button class="pbtn pri lp-copy-btn" data-onclick="lp:copy"${!lessonState.generated?' disabled':''}>표 복사</button>
          <button class="pbtn sec" data-onclick="lp:reset">초기화</button>
        </div>
      </div>    
    </div>    
    ${tableHtml}  
  </div>`;
}

export { renderLessonPlan };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'lp:semester':  function(el, e, n) { lpSetSemester(n); },
  'lp:generate':  function() { lpGenerate(); },
  'lp:copy':      function() { lpCopy(); },
  'lp:reset':     function() { lpReset(); },
  'lp:addRow':    function() { lpAddRow(); },
  'lp:delRow':    function(el, e, i) { lpDeleteRow(i); },
  'lp:openModal': function(el, e, i) { lpOpenModal(i); },
  'lp:unlink':    function(el, e, i, code) { lpUnlinkCode(i, code); },
});
registerActions('input', {
  'lp:startMW': function(el) { lpSetStartMW(el.value); },
  'lp:endMW':   function(el) { lpSetEndMW(el.value); },
});
registerActions('change', {
  'lp:subject':    function(el) { lpSetSubject(+el.value); },
  'lp:domain':     function(el, e, i) { lpSetDomain(i, el.value); },
  'lp:method':     function(el, e, i) { lpSetMethod(i, el.value); },
  'lp:evalMethod': function(el, e, i) { lpSetEvalMethod(i, el.value); },
});
registerActions('blur', {
  'lp:mw': function(el, e, i) { lpUpdateMW(i, el.textContent.trim()); },
});