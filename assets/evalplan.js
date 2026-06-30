import { esc, trapFocus, releaseFocus, loadState } from './utils.js';
import { NON_SUBJECT_TYPES } from './state.js';

// --- Eval Plan State ---
export let evalPlanSubtab = 'lesson';
export function setEvalPlanSubtab(v) { evalPlanSubtab = v; }

export const evalState = loadState('evalplan', { semester:1, subjectIdx:1, examCount:1, perfCount:3, items:[], generated:false });
let evalModalTargetIdx = null;
let evalModalTempSelected = new Set();
let evalModalSubjectIdx = 1;

// --- Eval Plan ---
function evalSubjects() {
  return SUBJECTS.filter(s => !NON_SUBJECT_TYPES.includes(s.type));
}

function evalSave() {  
  try { localStorage.setItem('evalplan', JSON.stringify(evalState)); } catch(e) {}
}

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
  const badgesHtml = item.linkedCodes.length    
    ? item.linkedCodes.map(c =>        
        `<span class="eval-badge">${esc(c)}<button class="eval-badge-rm" onclick="evalUnlinkCode(${i},'${c.replace(/'/g,"\\'")}'')" aria-label="${esc(c)} 연결 해제">×</button></span>`      
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
        <input class="eval-score-input" type="number" min="0" value="${sc}"          
          oninput="evalUpdateScoreChoice(${i},+this.value)">        
        <span class="eval-score-unit">점</span>      
      </div>      
      <div class="eval-score-field">        
        <span class="eval-score-label">논술형</span>        
        <input class="eval-score-input" type="number" min="0" value="${se}"          
          oninput="evalUpdateScoreEssay(${i},+this.value)">        
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
      oninput="evalUpdatePeriod(${i},this.value)"      
      placeholder="${periodPlaceholder}">  
  </div>`;  
  return `<div class="eval-card">    
    <div style="display:flex;align-items:center;gap:8px">      
      <span class="eval-card-type ${isExam?'exam':'perf'}">${isExam?'정기시험':'수행평가'}</span>      
      <span style="font-size:12px;color:var(--g400)">${esc(item.name)}</span>    
    </div>    
    <input class="eval-card-name" type="text" value="${esc(item.name)}"      
      oninput="evalUpdateName(${i},this.value)" placeholder="평가명 입력">    
    <div class="eval-ratio-row">      
      <input class="eval-ratio-input" type="number" min="0" max="100" value="${item.ratio}"        
        oninput="evalUpdateRatio(${i},+this.value)">      
      <span class="eval-ratio-label">%</span>      
      ${!isExam ? `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--g600);cursor:pointer;white-space:nowrap">        
        <input type="checkbox" ${item.isEssay?'checked':''} onchange="evalToggleEssay(${i},this.checked)" style="cursor:pointer">논술형</label>` : ''}      
      <button class="eval-link-btn" onclick="evalOpenModal(${i})">성취기준 연결 ＋</button>    
    </div>    
    ${scoreHtml}    
    <div class="eval-badges">${badgesHtml}</div>    
    <div>      
      <span class="eval-element-label">평가 요소</span>      
      <textarea class="eval-element-textarea" oninput="evalUpdateElements(${i},this.value)"        
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
    itemsHtml = `<div class="eval-empty">위 설정을 완료한 후 "평가 항목 생성" 버튼을 눌러주세요.</div>`;  
  } else if (!evalState.items.length) {    
    itemsHtml = `<div class="eval-empty">평가 항목이 없습니다. 시험 횟수 또는 수행평가 수를 1 이상으로 설정하세요.</div>`;  
  } else {    
    itemsHtml = `<div class="eval-cards">${evalState.items.map((it,i) => evalCardHtml(it,i)).join('')}</div>`;  
  }  
  return `<div class="eval-wrap">    
    <div class="eval-settings">      
      <div class="eval-settings-title">평가 설정</div>      
      <div class="eval-settings-row">        
        <div class="eval-field">          
          <span class="eval-label">학기</span>          
          <div class="eval-toggle-group">            
            <button class="eval-toggle${evalState.semester===1?' active':''}" onclick="evalSetSemester(1)" aria-pressed="${evalState.semester===1}">1학기</button>
            <button class="eval-toggle${evalState.semester===2?' active':''}" onclick="evalSetSemester(2)" aria-pressed="${evalState.semester===2}">2학기</button>
          </div>        
        </div>        
        <div class="eval-field">          
          <span class="eval-label">과목</span>          
          <select class="eval-select" onchange="evalSetSubject(+this.value)">${subjOpts}</select>        
        </div>      
      </div>      
      <div class="eval-settings-row">        
        <div class="eval-field">          
          <span class="eval-label">정기시험 횟수 (0~2)</span>          
          <input type="number" class="eval-number" min="0" max="2" value="${evalState.examCount}"            
            oninput="evalState.examCount=Math.max(0,Math.min(2,+this.value||0))">        
        </div>        
        <div class="eval-field">          
          <span class="eval-label">수행평가 개수 (1~5)</span>          
          <input type="number" class="eval-number" min="1" max="5" value="${evalState.perfCount}"            
            oninput="evalState.perfCount=Math.max(1,Math.min(5,+this.value||1))">        
        </div>        
        <div class="eval-field" style="flex-direction:row;gap:8px;align-items:center">          
          <button class="eval-gen-btn" onclick="evalGenItems()">평가 항목 생성</button>          
          <button class="pbtn pri" onclick="evalOpenPreview()"            
            ${!evalState.generated || !evalState.items.length ? 'disabled' : ''}>표 미리보기</button>          
          <button class="pbtn sec" onclick="evalReset()">초기화</button>        
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
  evalModalTargetIdx = i;  
  evalModalTempSelected = new Set(evalState.items[i].linkedCodes);  
  evalModalSubjectIdx = evalState.subjectIdx;  
  evalRenderModalBody();  
  const m = document.getElementById('evalModal');
  m.style.display = 'flex';
  trapFocus(m);
}
function evalCloseModal() {
  const m = document.getElementById('evalModal');
  releaseFocus(m);
  m.style.display = 'none';
  evalModalTargetIdx = null;
}
function evalConfirmModal() {  
  if (evalModalTargetIdx === null) return;  
  evalState.items[evalModalTargetIdx].linkedCodes = [...evalModalTempSelected];  
  evalSave(); evalCloseModal(); evalRerender();
}
function evalModalChangeSubject(idx) {  
  evalModalSubjectIdx = +idx;  
  evalRenderModalBody();
}
function evalRenderModalBody() {  
  const subj = SUBJECTS[evalModalSubjectIdx];  
  const subjs = evalSubjects();  
  document.getElementById('evalModalSubjSel').innerHTML = subjs.map(s => {    
    const idx = SUBJECTS.indexOf(s);    
    return `<option value="${idx}"${evalModalSubjectIdx===idx?' selected':''}>${esc(s.name)}</option>`;  
  }).join('');  
  let html = '';  
  if (subj && subj.domains) {    
    subj.domains.forEach((d, di) => {      
      html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">        
        <div class="eval-domain-label" style="margin-bottom:0">${esc(d.name)}</div>        
        <button class="pbtn sec" style="font-size:11px;padding:3px 10px;height:auto;flex-shrink:0"          
          onclick="evalSelectAllInDomain(${evalModalSubjectIdx},${di})">단원 모두 포함</button>      
      </div>`;      
      d.items.forEach(it => {        
        const chk = evalModalTempSelected.has(it.code);        
        html += `<div class="eval-std-item">          
          <input type="checkbox" class="eval-std-chk" ${chk?'checked':''}            
            onchange="evalToggleStd('${it.code.replace(/'/g,"\\'")}',this.checked)">          
          <span class="eval-std-code" style="background:${subj.aLight};color:${subj.accent}">${esc(it.code)}</span>          
          <span class="eval-std-text">${esc(it.text)}</span>        
        </div>`;      
      });    
    });  
  }  
  document.getElementById('evalModalBody').innerHTML = html;  
  document.getElementById('evalModalSelCount').textContent = evalModalTempSelected.size+'개 선택됨';
}
function evalToggleStd(code, checked) {  
  checked ? evalModalTempSelected.add(code) : evalModalTempSelected.delete(code);  
  document.getElementById('evalModalSelCount').textContent = evalModalTempSelected.size+'개 선택됨';
}
function evalSelectAllInDomain(subjIdx, domainIdx) {  
  const subj = SUBJECTS[subjIdx];  
  if (!subj || !subj.domains[domainIdx]) return;  
  subj.domains[domainIdx].items.forEach(it => evalModalTempSelected.add(it.code));  
  evalRenderModalBody();
}
function evalUpdateElements(i, val) {  evalState.items[i].elements = val; evalSave();}
function evalReset() {  
  if (!confirm('모든 입력값이 초기화됩니다. 계속할까요?')) return;  
  evalState = { semester:1, subjectIdx:1, examCount:1, perfCount:3, items:[], generated:false };  
  localStorage.removeItem('evalplan');  
  evalHideSummary();  
  evalRerender();
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
    .catch(() => alert('클립보드 복사에 실패했습니다.'));
}

export {
  renderEvalPlan, evalSubjects, evalHideSummary, evalShowSummary,
  evalSave, evalReset, evalRerender, evalOpenPreview, evalClosePreview
};
window.evalSetSemester = evalSetSemester;
window.evalSetSubject = evalSetSubject;
window.evalGenItems = evalGenItems;
window.evalUpdateName = evalUpdateName;
window.evalUpdateRatio = evalUpdateRatio;
window.evalUpdateScoreChoice = evalUpdateScoreChoice;
window.evalUpdateScoreEssay = evalUpdateScoreEssay;
window.evalUpdatePeriod = evalUpdatePeriod;
window.evalToggleEssay = evalToggleEssay;
window.evalUnlinkCode = evalUnlinkCode;
window.evalRerender = evalRerender;
window.evalOpenModal = evalOpenModal;
window.evalCloseModal = evalCloseModal;
window.evalConfirmModal = evalConfirmModal;
window.evalModalChangeSubject = evalModalChangeSubject;
window.evalToggleStd = evalToggleStd;
window.evalSelectAllInDomain = evalSelectAllInDomain;
window.evalUpdateElements = evalUpdateElements;
window.evalReset = evalReset;
window.evalOpenPreview = evalOpenPreview;
window.evalClosePreview = evalClosePreview;
window.evalCopyPreviewTable = evalCopyPreviewTable;
window.evalHideSummary = evalHideSummary;
window.evalShowSummary = evalShowSummary;