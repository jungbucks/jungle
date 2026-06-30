import { esc, trapFocus, releaseFocus, loadState } from './utils.js';
import { evalSubjects, setEvalPlanSubtab, evalPlanSubtab } from './evalplan.js';
import { LP_SEM_DEFAULTS } from './state.js';

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
let lpModalTargetRow = null;
let lpModalTempSelected = new Set();
let lpModalSubjectIdx = 1;

function lpSelectSubtab(key) {
  setEvalPlanSubtab(key);
  if (typeof window.pushHash === 'function') window.pushHash();
  window.renderTabs();
  window.render();
}
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
    if (tr) tr.style.background = val === '수행평가' ? '#fffde7' : '';  
  }
}
function lpUnlinkCode(i, code) {  
  lessonState.rows[i].linkedCodes = lessonState.rows[i].linkedCodes.filter(c => c !== code);  
  lpSave(); lpRerender();
}
function lpOpenModal(rowIdx) {  
  lpModalTargetRow = rowIdx;  
  lpModalTempSelected = new Set(lessonState.rows[rowIdx].linkedCodes);  
  lpModalSubjectIdx = lessonState.subjectIdx;  
  lpRenderModalBody();  
  const m = document.getElementById('lessonModal');
  m.style.display = 'flex';
  trapFocus(m);
  const dom = lessonState.rows[rowIdx].domain;  
  if (dom) {    
    requestAnimationFrame(() => {      
      const el = document.querySelector('#lpModalBody [data-domain="' + dom + '"]');      
      if (el) el.scrollIntoView({block:'start', behavior:'smooth'});    
    });  
  }
}
function lpCloseModal() {
  const m = document.getElementById('lessonModal');
  releaseFocus(m);
  m.style.display = 'none';
  lpModalTargetRow = null;
}
function lpConfirmModal() {  
  if (lpModalTargetRow === null) return;  
  lessonState.rows[lpModalTargetRow].linkedCodes = [...lpModalTempSelected];  
  lpSave(); lpCloseModal(); lpRerender();
}
function lpModalChangeSubject(idx) {  
  lpModalSubjectIdx = +idx;  
  lpRenderModalBody();
}
// 단일 따옴표 이스케이프 문자 버그 수정 (\ 추가)
function lpToggleStd(code, checked) {  
  checked ? lpModalTempSelected.add(code) : lpModalTempSelected.delete(code);  
  document.getElementById('lpModalSelCount').textContent = lpModalTempSelected.size + '개 선택됨';
}
function lpSelectAllInDomain(subjIdx, domainIdx) {  
  const subj = SUBJECTS[subjIdx];  
  if (!subj || !subj.domains[domainIdx]) return;  
  subj.domains[domainIdx].items.forEach(it => lpModalTempSelected.add(it.code));  
  lpRenderModalBody();
}
function lpRenderModalBody() {  
  const subj = SUBJECTS[lpModalSubjectIdx];  
  const subjs = evalSubjects();  
  document.getElementById('lpModalSubjSel').innerHTML = subjs.map(s => {    
    const idx = SUBJECTS.indexOf(s);    
    return `<option value="${idx}"${lpModalSubjectIdx===idx?' selected':''}>${esc(s.name)}</option>`;  
  }).join('');  
  const selectedDomain = lpModalTargetRow !== null ? lessonState.rows[lpModalTargetRow].domain : '';  
  let html = '';  
  if (subj && subj.domains) {    
    subj.domains.forEach((d, di) => {      
      const isSelDom = d.name === selectedDomain;      
      html += `<div data-domain="${esc(d.name)}"${isSelDom?' style="background:var(--g50);border-radius:6px"':''}>        
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">          
          <div class="eval-domain-label" style="margin-bottom:0">${esc(d.name)}</div>          
          <button class="pbtn sec" style="font-size:11px;padding:3px 10px;height:auto;flex-shrink:0"            
            onclick="lpSelectAllInDomain(${lpModalSubjectIdx},${di})">단원 모두 포함</button>        
        </div>`;      
      d.items.forEach(it => {        
        const chk = lpModalTempSelected.has(it.code);        
        html += `<div class="eval-std-item">          
          <input type="checkbox" class="eval-std-chk" ${chk?'checked':''}            
            onchange="lpToggleStd('${it.code.replace(/'/g,"\\'")}',this.checked)">          
          <span class="eval-std-code" style="background:${subj.aLight};color:${subj.accent}">${esc(it.code)}</span>          
          <span class="eval-std-text">${esc(it.text)}</span>        
        </div>`;      
      });      
      html += `</div>`;    
    });  
  }  
  document.getElementById('lpModalBody').innerHTML = html;  
  document.getElementById('lpModalSelCount').textContent = lpModalTempSelected.size + '개 선택됨';
}
function lpReset() {  
  if (!confirm('수업계획이 초기화됩니다. 계속할까요?')) return;  
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
  }).catch(() => alert('복사에 실패했습니다.'));
}
function lpRerender() {
  if (!document.getElementById('main').querySelector('.eval-wrap')) return;
  if (evalPlanSubtab !== 'lesson') return;
  document.getElementById('main').innerHTML = renderLessonPlan();
}
function renderLessonTable(selSubj) {  
  const domains = selSubj && selSubj.domains ? selSubj.domains : [];  
  const accent  = selSubj ? selSubj.accent : '#7C3AED';  
  const aLight  = selSubj ? selSubj.aLight : '#F5F3FF';  
  const rowsHtml = lessonState.rows.map((row, i) => {    
    const ROM = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ'];    
    const domOpts = `<option value="">단원 선택</option>` +      
      domains.map((d, di) => `<option value="${esc(d.name)}"${row.domain===d.name?' selected':''}>${ROM[di]||di+1}. ${esc(d.name)}</option>`).join('');    
    const mthOpts = `<option value="">선택</option>` +      
      LP_METHODS.map(m => `<option value="${esc(m)}"${row.method===m?' selected':''}>${esc(m)}</option>`).join('');    
    const evalOpts = `<option value="">선택 안 함</option>` +      
      LP_EVAL_METHODS.map(m => `<option value="${esc(m)}"${row.evalMethod===m?' selected':''}>${esc(m)}</option>`).join('');    
    const rowBg = row.evalMethod === '수행평가' ? '#fffde7' : row.evalMethod === '지필평가' ? '#fee2e2' : '';    
    const codesHtml = row.linkedCodes.map(c =>      
      `<span class="lp-code-badge" style="background:${aLight};color:${accent}">${esc(c)}<button class="lp-code-del" onclick="lpUnlinkCode(${i},'${c.replace(/'/g,"\\'")}'')" aria-label="${esc(c)} 제거">×</button></span>`    
    ).join('');    
    return `<tr style="background:${rowBg}">      
      <td><div class="lp-mw" contenteditable="true" onblur="lpUpdateMW(${i},this.textContent.trim())">${esc(row.monthWeek)}</div></td>      
      <td><select class="lp-select" onchange="lpSetDomain(${i},this.value)">${domOpts}</select></td>      
      <td class="lp-std-cell">${codesHtml}<button class="lp-add-std" onclick="lpOpenModal(${i})">+ 성취기준</button></td>      
      <td><select class="lp-select" onchange="lpSetMethod(${i},this.value)">${mthOpts}</select></td>      
      <td><select class="lp-select" onchange="lpSetEvalMethod(${i},this.value)">${evalOpts}</select></td>      
      <td><button class="lp-del-row" onclick="lpDeleteRow(${i})">✕</button></td>    
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
    <button class="lp-add-row-btn" onclick="lpAddRow()">+ 행 추가</button>  
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
    : `<div class="eval-empty">위 설정을 완료한 후 "계획표 생성" 버튼을 눌러주세요.</div>`;  
  return `<div class="eval-wrap">    
    <div class="eval-settings">      
      <div class="eval-settings-title">수업계획 설정</div>      
      <div class="eval-settings-row">        
        <div class="eval-field">          
          <span class="eval-label">과목</span>          
          <select class="eval-select" onchange="lpSetSubject(+this.value)">${subjOpts}</select>        
        </div>        
        <div class="eval-field">          
          <span class="eval-label">학기</span>          
          <div class="eval-toggle-group">            
            <button class="eval-toggle${lessonState.semester===1?' active':''}" onclick="lpSetSemester(1)" aria-pressed="${lessonState.semester===1}">1학기</button>
            <button class="eval-toggle${lessonState.semester===2?' active':''}" onclick="lpSetSemester(2)" aria-pressed="${lessonState.semester===2}">2학기</button>
          </div>        
        </div>        
        <div class="eval-field">          
          <span class="eval-label">시작 주차</span>          
          <input type="text" class="lp-week-input" value="${esc(lessonState.startMW)}" placeholder="예: 3/1"            
            onchange="lpSetStartMW(this.value)" oninput="lpSetStartMW(this.value)">        
        </div>        
        <div class="eval-field">          
          <span class="eval-label">종료 주차</span>          
          <input type="text" class="lp-week-input" value="${esc(lessonState.endMW)}" placeholder="예: 7/2"            
            onchange="lpSetEndMW(this.value)" oninput="lpSetEndMW(this.value)">        
        </div>        
        <div class="eval-field" style="flex-direction:row;gap:8px;align-items:center;flex-wrap:wrap">          
          <button class="eval-gen-btn" onclick="lpGenerate()">계획표 생성</button>          
          <button class="pbtn pri lp-copy-btn" onclick="lpCopy()"${!lessonState.generated?' disabled':''}>표 복사</button>          
          <button class="pbtn sec" onclick="lpReset()">초기화</button>        
        </div>      
      </div>    
    </div>    
    ${tableHtml}  
  </div>`;
}

export { renderLessonPlan };
window.lpSelectSubtab = lpSelectSubtab;
window.lpSave = lpSave;
window.lpSetSubject = lpSetSubject;
window.lpSetSemester = lpSetSemester;
window.lpSetStartMW = lpSetStartMW;
window.lpSetEndMW = lpSetEndMW;
window.lpGenerate = lpGenerate;
window.lpAddRow = lpAddRow;
window.lpDeleteRow = lpDeleteRow;
window.lpUpdateMW = lpUpdateMW;
window.lpSetDomain = lpSetDomain;
window.lpSetMethod = lpSetMethod;
window.lpSetEvalMethod = lpSetEvalMethod;
window.lpUnlinkCode = lpUnlinkCode;
window.lpOpenModal = lpOpenModal;
window.lpCloseModal = lpCloseModal;
window.lpConfirmModal = lpConfirmModal;
window.lpModalChangeSubject = lpModalChangeSubject;
window.lpToggleStd = lpToggleStd;
window.lpSelectAllInDomain = lpSelectAllInDomain;
window.lpReset = lpReset;
window.lpCopy = lpCopy;