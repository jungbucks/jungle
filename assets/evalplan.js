import { esc, trapFocus, releaseFocus, loadState, saveState, registerActions, pageHead, emptySteps, uiToast, uiConfirm } from './utils.js';
import { NON_SUBJECT_TYPES } from './state.js';
import { openStdPicker } from './stdpicker.js';

// --- Eval Plan State ---
export let evalPlanSubtab = 'lesson';
export function setEvalPlanSubtab(v) { evalPlanSubtab = v; }

export const evalState = (() => {
  const migrated = loadState('evalplan', null);
  if (migrated) { saveState('jungle_evalplan', migrated); try { localStorage.removeItem('evalplan'); } catch(e) {} }
  return loadState('jungle_evalplan', { semester:1, subjectIdx:1, examCount:1, perfCount:3, items:[], generated:false });
})();

// --- Eval Plan ---
function evalSubjects() {
  return SUBJECTS.filter(s => !NON_SUBJECT_TYPES.includes(s.type));
}

function evalSave() { saveState('jungle_evalplan', evalState); }

function evalHideSummary() {  
  const p = document.getElementById('evalSumPanel');  
  if (p) p.classList.remove('visible');
}

function evalShowSummary() {  
  const p = document.getElementById('evalSumPanel');  
  if (!p) return;  
  p.innerHTML = evalSummaryHtml();  
  p.classList.add('visible');
}

function evalAllCodes() {  
  const subj = SUBJECTS[evalState.subjectIdx];  
  if (!subj || !subj.domains) return [];  
  return subj.domains.flatMap(d => d.items.map(it => it.code));
}

function evalLinkedSet() {  
  const s = new Set();  
  evalState.items.forEach(it => it.linkedCodes.forEach(c => s.add(c)));  
  return s;
}

function evalSummaryHtml() {  
  const total = evalState.items.reduce((s, it) => s + (Number(it.ratio)||0), 0);  
  const all = evalAllCodes();  
  const linked = evalLinkedSet();  
  const uncov = all.filter(c => !linked.has(c));  
  const ok = total === 100;  
  let essayRatio = 0;  
  evalState.items.forEach(it => {    
    if (it.type === 'exam') {      
      const sc = Number(it.scoreChoice)||0, se = Number(it.scoreEssay)||0, tot = sc + se;      
      if (tot > 0) essayRatio += (Number(it.ratio)||0) * (se / tot);    
    } else if (it.isEssay) {      
      essayRatio += Number(it.ratio)||0;    
    }  
  });  
  const hasExam = evalState.items.some(it => it.type === 'exam');  
  let uncovHtml = '';  
  if (uncov.length) {    
    uncovHtml = `<div class="sum-sep"></div>      
      <div class="eval-sum-uncov">미연결 성취기준:        
        ${uncov.map(c => `<span class="eval-sum-uncov-badge">${esc(c)}</span>`).join('')}      
      </div>`;  
  }  
  return `<div class="eval-sum-inner">    
    <span class="eval-sum-ratio ${ok?'ok':'warn'}">비율 합계 ${total}%${ok?'':total>100?' ▲초과':' ▼미달'}</span>    
    <div class="sum-sep"></div>    
    <span class="eval-sum-cov">성취기준 커버리지 <strong>${linked.size} / ${all.length}개</strong></span>    
    ${hasExam ? `<div class="sum-sep"></div><span class="eval-sum-cov">논술형 반영비율 <strong>${essayRatio.toFixed(1)}%</strong></span>` : ''}    
    ${uncovHtml}  
  </div>`;
}

function evalCardHtml(item, i) {
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
    const warn = tot > 100;
    scoreHtml = `<div class="eval-score-row">
      <div class="eval-score-field">
        <span class="eval-score-label">선택형</span>
        <input class="eval-score-input" type="number" min="0" value="${sc}" data-oninput="ev:scoreChoice" data-args="${ai}">
        <span class="eval-score-unit">점</span>
      </div>
      <div class="eval-score-field">
        <span class="eval-score-label">논술형</span>
        <input class="eval-score-input" type="number" min="0" value="${se}" data-oninput="ev:scoreEssay" data-args="${ai}">
        <span class="eval-score-unit">점</span>
      </div>
      <span class="eval-score-sum${warn?' warn':''}">합계 <strong>${tot}</strong>점${warn?' ⚠':''}</span>
    </div>`;
  }
  const examPlaceholders = ['예) 4월 4주', '예) 6월 5주'];
  const examIdx = isExam ? evalState.items.slice(0, i).filter(it => it.type === 'exam').length : 0;
  const periodPlaceholder = isExam ? (examPlaceholders[examIdx] || '예) 4월 4주') : '예) 5월 2주';
  const periodHtml = `<div class="eval-period-row">
    <span class="eval-period-label">평가 시기</span>
    <input class="eval-period-input" type="text" value="${esc(item.period||'')}"
      data-oninput="ev:period" data-args="${ai}"
      placeholder="${periodPlaceholder}">
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
  const subjs = evalSubjects();  
  const subjOpts = subjs.map(s => {    
    const idx = SUBJECTS.indexOf(s);    
    return `<option value="${idx}"${evalState.subjectIdx===idx?' selected':''}>${esc(s.name)}</option>`;  
  }).join('');  
  const selSubj = SUBJECTS[evalState.subjectIdx];  
  let itemsHtml;  
  if (!evalState.generated) {    
    itemsHtml = emptySteps(['학기·과목 설정', '평가 항목 생성', '비율·만점 입력 후 표 미리보기']);
  } else if (!evalState.items.length) {    
    itemsHtml = `<div class="eval-empty">평가 항목이 없습니다. 시험 횟수 또는 수행평가 수를 1 이상으로 설정하세요.</div>`;  
  } else {    
    itemsHtml = `<div class="eval-cards">${evalState.items.map((it,i) => evalCardHtml(it,i)).join('')}</div>`;  
  }  
  return `<div class="eval-wrap">
    ${pageHead('수업/평가계획', '평가계획', '정기시험·수행평가 구성과 반영 비율을 설계해 표로 미리봅니다.')}
    <div class="eval-settings">
      <div class="eval-settings-title">평가 설정</div>
      <div class="eval-settings-row">        
        <div class="eval-field">          
          <span class="eval-label">학기</span>          
          <div class="eval-toggle-group">            
            <button class="eval-toggle${evalState.semester===1?' active':''}" data-onclick="ev:semester" data-args="[1]" aria-pressed="${evalState.semester===1}">1학기</button>
            <button class="eval-toggle${evalState.semester===2?' active':''}" data-onclick="ev:semester" data-args="[2]" aria-pressed="${evalState.semester===2}">2학기</button>
          </div>        
        </div>        
        <div class="eval-field">          
          <span class="eval-label">과목</span>          
          <select class="eval-select" data-onchange="ev:subject">${subjOpts}</select>
        </div>      
      </div>      
      <div class="eval-settings-row">        
        <div class="eval-field">          
          <span class="eval-label">정기시험 횟수 (0~2)</span>          
          <input type="number" class="eval-number" min="0" max="2" value="${evalState.examCount}" data-oninput="ev:examCount">
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
    ${itemsHtml}  
  </div>`;
}

function evalSetSemester(n) { evalState.semester=n; evalSave(); evalRerender(); }
function evalSetSubject(idx) {  
  evalState.subjectIdx = idx;  
  evalState.items.forEach(it => it.linkedCodes = []);  
  evalSave(); evalRerender();
}
function evalGenItems() {  
  const ec = evalState.examCount;  
  const pc = evalState.perfCount;  
  const items = [];  
  for (let i=0;i<ec;i++) items.push({type:'exam', name: ec===1 ? '2차 정기시험' : `${i+1}차 정기시험`, ratio:0, linkedCodes:[], scoreChoice:0, scoreEssay:0, elements:'', period:''});  
  for (let i=0;i<pc;i++) items.push({type:'perf', name:`수행평가 ${i+1}`, ratio:0, linkedCodes:[], elements:'', period:'', isEssay:false});  
  if (items.length) {    
    const base = Math.floor(100/items.length);    
    const rem = 100 - base*items.length;    
    items.forEach((it,i) => { it.ratio = base + (i<rem?1:0); });  
  }  
  evalState.items = items;  
  evalState.generated = true;  
  evalSave(); evalRerender();
}
function evalUpdateName(i, val) {  evalState.items[i].name = val; evalSave(); evalShowSummary();}
function evalUpdateRatio(i, val) {  evalState.items[i].ratio = isNaN(val)?0:val; evalSave(); evalShowSummary();}
function evalUpdateScoreChoice(i, val) {  
  evalState.items[i].scoreChoice = isNaN(val)?0:Math.max(0,val);  
  evalSave(); evalShowSummary();
}
function evalUpdateScoreEssay(i, val) {  
  evalState.items[i].scoreEssay = isNaN(val)?0:Math.max(0,val);  
  evalSave(); evalShowSummary();
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
  Object.assign(evalState, { semester:1, subjectIdx:1, examCount:1, perfCount:3, items:[], generated:false });
  evalSave();
  localStorage.removeItem('evalplan');
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
  let rows = `<tr>    
    <td ${labelStyle}>반영비율</td>    
    ${items.map(it => `<td ${tdStyle('text-align:center')}><strong>${it.ratio}%</strong></td>`).join('')}    
    <td ${tdStyle('text-align:center;font-weight:700')}>100%</td>  
  </tr>`;  
  // Row: 영역 만점(반영비율)  
  rows += `<tr>    
    <td ${labelStyle}>영역 만점<br>(반영비율)</td>    
    ${examItems.map(it => {      
      const sc = Number(it.scoreChoice)||0, se = Number(it.scoreEssay)||0;      
      const tot = sc + se, ratio = Number(it.ratio)||0;      
      const scPct = tot > 0 ? (sc/tot*ratio).toFixed(1) : 0;      
      const sePct = tot > 0 ? (se/tot*ratio).toFixed(1) : 0;      
      return `<td ${tdStyle('line-height:1.8')}>선택형 ${sc}점(${scPct}%)<br>논술형 ${se}점(${sePct}%)</td>`;    
    }).join('')}    
    ${perfItems.map(it => `<td ${tdStyle('text-align:center')}>${it.ratio}%</td>`).join('')}    
    <td ${tdStyle('text-align:center;font-weight:700')}>100%</td>  
  </tr>`;  
  // Row: 논술형 평가 반영비율  
  rows += `<tr>    
    <td ${labelStyle}>논술형 평가<br>반영비율</td>    
    ${examItems.map(it => `<td ${tdStyle('text-align:center')}>${essayContrib(it).toFixed(1)}%</td>`).join('')}    
    ${perfItems.map(it => it.isEssay      
      ? `<td ${tdStyle('text-align:center;font-weight:600')}>${Number(it.ratio)||0}%</td>`      
      : `<td ${tdStyle('text-align:center;color:var(--g300)')}>-</td>`).join('')}    
    <td ${tdStyle('text-align:center;font-weight:700')}>${totalEssay.toFixed(1)}%</td>  
  </tr>`;  
  // Row: 성취기준  
  rows += `<tr>    
    <td ${labelStyle}>성취기준</td>    
    ${items.map(it => `<td ${tdStyle()}>` +      
      (it.linkedCodes.length        
        ? it.linkedCodes.map(c => `<span class="code-badge" style="background:${aLight};color:${accent};margin:1px 2px;display:inline-block">${esc(c)}</span>`).join(' ')        
        : `<span style="color:var(--g300)">-</span>`) +      
      `</td>`).join('')}    
    <td ${tdStyle()}></td>  
  </tr>`;  
  // Row: 평가 요소  
  rows += `<tr>    
    <td ${labelStyle}>평가 요소</td>    
    ${items.map(it => {      
      const txt = (it.elements||'').trim();      
      return `<td ${tdStyle('white-space:pre-wrap')}>${txt ? esc(txt) : `<span style="color:var(--g300)">-</span>`}</td>`;    
    }).join('')}    
    <td ${tdStyle()}></td>  
  </tr>`;  
  // Row: 평가 시기  
  rows += `<tr>    
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
    ['반영비율', ...items.map(it => it.ratio+'%'), '100%'].join('\t'),    
    ['영역 만점(반영비율)', ...items.map(it => {      
      if (it.type === 'exam') {        
        const sc=Number(it.scoreChoice)||0, se=Number(it.scoreEssay)||0;        
        const tot=sc+se, ratio=Number(it.ratio)||0;        
        const scP = tot>0?(sc/tot*ratio).toFixed(1):0;        
        const seP = tot>0?(se/tot*ratio).toFixed(1):0;        
        return `선택형 ${sc}점(${scP}%) / 논술형 ${se}점(${seP}%)`;      
      }      
      return it.ratio+'%';    }), '100%'].join('\t'),    
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
// index.html 정적 모달 버튼(app.js bindStaticHandlers)이 참조 — 유지
window.evalClosePreview = evalClosePreview;
window.evalCopyPreviewTable = evalCopyPreviewTable;

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'ev:semester':  function(el, e, n) { evalSetSemester(n); },
  'ev:generate':  function() { evalGenItems(); },
  'ev:preview':   function() { evalOpenPreview(); },
  'ev:reset':     function() { evalReset(); },
  'ev:openModal': function(el, e, i) { evalOpenModal(i); },
  'ev:unlink':    function(el, e, i, code) { evalUnlinkCode(i, code); },
});
registerActions('input', {
  'ev:name':        function(el, e, i) { evalUpdateName(i, el.value); },
  'ev:ratio':       function(el, e, i) { evalUpdateRatio(i, +el.value); },
  'ev:scoreChoice': function(el, e, i) { evalUpdateScoreChoice(i, +el.value); },
  'ev:scoreEssay':  function(el, e, i) { evalUpdateScoreEssay(i, +el.value); },
  'ev:period':      function(el, e, i) { evalUpdatePeriod(i, el.value); },
  'ev:elements':    function(el, e, i) { evalUpdateElements(i, el.value); },
  'ev:examCount':   function(el) { evalState.examCount = Math.max(0, Math.min(2, +el.value||0)); },
  'ev:perfCount':   function(el) { evalState.perfCount = Math.max(1, Math.min(5, +el.value||1)); },
});
registerActions('change', {
  'ev:subject': function(el) { evalSetSubject(+el.value); },
  'ev:essay':   function(el, e, i) { evalToggleEssay(i, el.checked); },
});