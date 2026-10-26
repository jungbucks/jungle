import { esc, clipboardWriteText, registerActions } from './utils.js';

let hsGrid = { '1-1':[], '1-2':[], '2-1':[], '2-2':[], '3-1':[], '3-2':[] };
let hsDragId = null;
let hsMobSelId = null;

// 2022 개정: 선택 과목 기본 4학점, 1학점 범위에서 증감(3~5). 배치 카드마다 학점을 따로 가진다.
const CREDIT_CHOICES = [3, 4, 5];
function entryCredit(entry, s) {
  const c = +(entry && entry.credit);
  return CREDIT_CHOICES.includes(c) ? c : s.credit; // credit이 없던 옛 형태({id,mode}·문자열 id)는 과목 기본값
}
// 같은 학년 두 학기에 같은 과목 = 분반(집중이수) 1과목 → 학점은 한 번만 센다
function hsTotals() {
  const pairs = hsSameYearPairs();
  const counted = new Set();
  let total = 0; const yc = {1:0, 2:0, 3:0};
  HS_SEMS.forEach(sem => {
    (hsGrid[sem.key]||[]).forEach(entry => {
      const id = entry.id || entry;
      const s = HS_SUBJECTS.find(x => x.id === id);
      if (!s) return;
      const pKey = `${sem.yr}_${id}`;
      if (pairs.has(id) && pairs.get(id).has(sem.yr)) {
        if (counted.has(pKey)) return;
        counted.add(pKey);
      }
      const c = entryCredit(entry, s);
      total += c; yc[sem.yr] += c;
    });
  });
  return { total, yc };
}

function hsGridCells() {
  const pairs = hsSameYearPairs();  
  return HS_SEMS.map(sem => {    
    const items = hsGrid[sem.key];    
    const inner = items.length === 0      
      ? `<div class="sim-dz-hint">여기에 과목을<br>끌어다 놓으세요</div>`      
      : items.map((entry, idx) => {          
          const id = entry.id || entry;          
          const mode = entry.mode || 'solo';          
          const s = HS_SUBJECTS.find(x => x.id === id);          
          if (!s) return '';          
          const col = HS_TYPE_COLOR[s.type];          
          const borderLeft = mode === 'A'            
            ? `3px dashed ${col.c}`            
            : mode === 'B'            
            ? `3px double ${col.c}`            
            : `3px solid ${col.c}`;          
          const isSplit = pairs.has(id) && pairs.get(id).has(sem.yr);          
          let splitLabel = '';          
          if (isSplit) {            
            const tag = mode === 'A' ? 'A반 분반 운영' : mode === 'B' ? 'B반 분반 운영' : '분반 운영';            
            splitLabel = `<span class="sim-split-label">↔ ${tag} (${entryCredit(entry, s)}학점)</span>`;          
          }          
          const aCell = esc(JSON.stringify([sem.key, idx]));
          return `<div class="sim-placed-card" style="border-left:${borderLeft}" data-onclick="sim:cardNoop">
            <div class="sim-placed-row">
              <div class="sim-placed-info">
                <span class="sim-placed-name">${esc(s.name)}</span>
                <select class="sim-credit-select" data-onchange="sim:credit" data-args="${aCell}" aria-label="${esc(s.name)} 학점">
                  ${CREDIT_CHOICES.map(c => `<option value="${c}"${entryCredit(entry, s) === c ? ' selected' : ''}>${c}학점</option>`).join('')}
                </select>
              </div>
              <button class="sim-rm-btn" data-onclick="sim:remove" data-args="${aCell}" aria-label="${esc(s.name)} 제거">×</button>
            </div>
            <select class="sim-mode-select" data-onchange="sim:mode" data-args="${aCell}">
              <option value="solo"${mode==='solo'?' selected':''}>단독</option>
              <option value="A"${mode==='A'?' selected':''}>집중이수 A반</option>
              <option value="B"${mode==='B'?' selected':''}>집중이수 B반</option>
            </select>
            ${splitLabel}
          </div>`;
        }).join('');
    return `<td class="sim-td${sem.yb?' yb':''}">
      <div class="sim-dropzone" data-sem="${sem.key}"
        data-ondragover="sim:over" data-ondragleave="sim:leave"
        data-ondrop="sim:drop" data-onclick="sim:mobDrop" data-args="${esc(JSON.stringify([sem.key]))}">
        ${inner}
      </div>
    </td>`;
  }).join('');
}

function renderSimSummary() {
  const { total, yc } = hsTotals();
  return `<div class="sim-summary">    
    <span class="sim-sum-total">총 ${total}학점</span>    
    <div class="sum-sep"></div>    
    <span class="sim-sum-yr">1학년 <strong>${yc[1]}학점</strong></span>    
    <span class="sim-sum-yr">2학년 <strong>${yc[2]}학점</strong></span>    
    <span class="sim-sum-yr">3학년 <strong>${yc[3]}학점</strong></span>    
    <div class="sim-sum-actions">
      <button class="pbtn sec" data-onclick="sim:reset">초기화</button>
      <button class="pbtn pri" data-onclick="sim:copy">편성표 복사</button>
    </div>  </div>`;
}

function renderSimulator() {  
  const palHtml = HS_SUBJECTS.map(s => {    
    const col = HS_TYPE_COLOR[s.type];    
    const sel = hsMobSelId === s.id ? ' mob-sel' : '';    
    return `<div class="sim-pal-card${sel}" id="sp_${s.id}" draggable="true"
      data-ondragstart="sim:dragStart" data-ondragend="sim:dragEnd"
      data-onclick="sim:select" data-args="${esc(JSON.stringify([s.id]))}">
      <div class="sim-pal-name">${esc(s.name)}</div>      
      <div class="sim-pal-meta">        
        <span class="sim-type-badge" style="background:${col.l};color:${col.c}">${esc(s.type)}</span>        
        <span class="sim-pal-credit">${s.credit}학점${s.type === '전문교과' ? '*' : ''}</span>
      </div>    
    </div>`;  
  }).join('');  
  const thHtml = HS_SEMS.map(sem =>    
    `<th class="sim-th${sem.yb?' yb':''}">${sem.label}</th>`).join('');  
  return `<div class="sim-wrap">
    <div class="ov-head" style="padding-bottom:4px">
      <span class="ov-eyebrow">고교학점제</span>
      <h2 class="ov-h2">고교학점제 시뮬레이터</h2>
      <p class="ov-sub">정보교과 과목을 학기별로 배치해 편성안을 설계하고, 완성된 편성표를 복사하세요.</p>
    </div>
    <div class="sim-palette">
      <div class="sim-palette-title">과목 팔레트<span class="sim-palette-hint sim-hint-mouse">드래그 앤 드롭으로 아래 학기 셀에 배치하세요</span><span class="sim-palette-hint sim-hint-touch">과목 카드를 탭한 뒤, 원하는 학기 칸을 탭하면 배치돼요</span></div>
      <div class="sim-pal-scroll">${palHtml}</div>
      <p class="sim-credit-note">선택 과목은 기본 4학점이며 1학점 범위에서 늘리거나 줄일 수 있습니다(3~5학점). 배치한 카드에서 학점을 바꾸세요. <span>* 프로그래밍 등 전문교과의 학점은 시·도 교육감이 정합니다.</span></p>
    </div>
    <div class="sim-right">
      <div class="sim-scroll-hint">↔ 좌우로 밀면 6개 학기가 모두 보여요</div>
      <div class="sim-grid-wrap">
        <table class="sim-table">          
          <thead><tr>${thHtml}</tr></thead>          
          <tbody id="simBody"><tr>${hsGridCells()}</tr></tbody>        
        </table>      
      </div>      
      <div id="simSummary">${renderSimSummary()}</div>    
    </div>  </div>`;
}

function hsSameYearPairs() {  
  // Map<subjectId, Set<year>> — 동일 학년 양 학기에 모두 배치된 경우  
  const m = new Map();  
  [[1,'1-1','1-2'],[2,'2-1','2-2'],[3,'3-1','3-2']].forEach(([yr,s1,s2]) => {    
    const ids1 = new Set((hsGrid[s1]||[]).map(e => e.id||e));    
    const ids2 = new Set((hsGrid[s2]||[]).map(e => e.id||e));    
    ids1.forEach(id => {      
      if (ids2.has(id)) {        
        if (!m.has(id)) m.set(id, new Set());        
        m.get(id).add(yr);      
      }    
    });  
  });  
  return m;
}

function hsSetMode(sem, idx, mode) {  
  if (hsGrid[sem] && hsGrid[sem][idx]) {    
    hsGrid[sem][idx].mode = mode;    
    hsRefresh();  
  }
}

// 분반 짝(같은 학년 다른 학기의 같은 과목)은 한 과목이라 학점도 함께 바꾼다
function hsSetCredit(sem, idx, credit) {
  const c = +credit;
  if (!hsGrid[sem] || hsGrid[sem][idx] == null || !CREDIT_CHOICES.includes(c)) return;
  const toObj = (list, i) => { if (typeof list[i] !== 'object') list[i] = { id: list[i], mode: 'solo' }; return list[i]; };
  const entry = toObj(hsGrid[sem], idx);
  entry.credit = c;
  const [yr, half] = sem.split('-');
  const partner = hsGrid[yr + '-' + (half === '1' ? '2' : '1')] || [];
  partner.forEach((e, i) => { if ((e.id || e) === entry.id) toObj(partner, i).credit = c; });
  hsRefresh();
}

function hsRefresh() {  
  const body = document.getElementById('simBody');  
  if (body) body.innerHTML = `<tr>${hsGridCells()}</tr>`;  
  const sum = document.getElementById('simSummary');  
  if (sum) sum.innerHTML = renderSimSummary();
}

function hsDragStart(el, e) {
  hsDragId = el.id.replace(/^sp_/, '');
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setDragImage(el, e.offsetX || 0, e.offsetY || 0);
  el.classList.add('dragging');
}

function hsDragEnd(el) {
  el.classList.remove('dragging');
  hsDragId = null;
}

function hsDragOver(e, el) {  
  e.preventDefault();  
  e.dataTransfer.dropEffect = 'copy';  
  if (hsDragId) {    
    const col = HS_TYPE_COLOR[HS_SUBJECTS.find(x => x.id === hsDragId)?.type] || {};    
    if (col.c) { el.style.borderColor = col.c; el.style.background = col.l; }  
  }
}

function hsDragLeave(el) {  
  el.style.borderColor = 'transparent';  
  el.style.background = '';
}

function hsDrop(e, el) {  
  e.preventDefault();  
  hsDragLeave(el);  
  const sem = el.dataset.sem;  
  if (hsDragId && sem) { hsGrid[sem].push({id:hsDragId,mode:'solo',credit:HS_SUBJECTS.find(x => x.id === hsDragId)?.credit}); hsRefresh(); }  
  hsDragId = null;
}

function hsMobSelect(id) {  
  if (hsMobSelId === id) {    
    document.getElementById('sp_' + id)?.classList.remove('mob-sel');    
    hsMobSelId = null; return;  
  }  
  if (hsMobSelId) document.getElementById('sp_' + hsMobSelId)?.classList.remove('mob-sel');  
  hsMobSelId = id;  
  document.getElementById('sp_' + id)?.classList.add('mob-sel');
}

function hsMobDrop(sem) {  
  if (!hsMobSelId) return;  
  hsGrid[sem].push({id:hsMobSelId,mode:'solo',credit:HS_SUBJECTS.find(x => x.id === hsMobSelId)?.credit});  
  document.getElementById('sp_' + hsMobSelId)?.classList.remove('mob-sel');  
  hsMobSelId = null;  
  hsRefresh();
}

function hsRemove(sem, idx) {  
  hsGrid[sem].splice(idx, 1);  
  hsRefresh();
}

function hsReset() {  
  Object.keys(hsGrid).forEach(k => hsGrid[k] = []);  
  hsRefresh();
}

function hsCopyText() {
  const lines = [];
  HS_SEMS.forEach(sem => {
    (hsGrid[sem.key]||[]).forEach(entry => {
      const id = entry.id || entry;
      const mode = entry.mode || 'solo';
      const s = HS_SUBJECTS.find(x => x.id === id);
      if (!s) return;
      const modeLabel = mode === 'A' ? ' A반' : mode === 'B' ? ' B반' : '';
      lines.push(`[${sem.label}] ${s.name}${modeLabel}(${entryCredit(entry, s)}학점)`);
    });
  });
  const { total, yc } = hsTotals();
  if (lines.length) lines.push('');
  lines.push(`총 ${total}학점 (1학년 ${yc[1]} · 2학년 ${yc[2]} · 3학년 ${yc[3]})`);
  return lines.join('\n');
}

function hsCopy(btn) {
  clipboardWriteText(hsCopyText());
  const orig = btn.textContent;
  btn.textContent = '복사됨!'; setTimeout(() => btn.textContent = orig, 1500);
}

export { renderSimulator };
// 테스트 전용: 편성 상태 주입 + 합계·복사 텍스트 (tools/test.mjs)
export const __simTest = { setGrid(g) { Object.keys(hsGrid).forEach(k => hsGrid[k] = (g[k] || []).slice()); }, hsTotals, hsCopyText, hsSetCredit, grid: () => hsGrid };

// ── 이벤트 위임 등록 (인라인 핸들러 대체 — 드래그 이벤트 포함) ──
registerActions('click', {
  'sim:cardNoop': function(el, e) { e.stopPropagation(); }, // 배치 카드 클릭이 셀의 탭 배치로 번지지 않게
  'sim:remove':   function(el, e, sem, idx) { e.stopPropagation(); hsRemove(sem, idx); },
  'sim:mobDrop':  function(el, e, sem) { hsMobDrop(sem); },
  'sim:select':   function(el, e, id) { hsMobSelect(id); },
  'sim:reset':    function() { hsReset(); },
  'sim:copy':     function(el) { hsCopy(el); },
});
registerActions('change', {
  'sim:mode': function(el, e, sem, idx) { hsSetMode(sem, idx, el.value); },
  'sim:credit': function(el, e, sem, idx) { hsSetCredit(sem, idx, el.value); },
});
registerActions('dragstart', { 'sim:dragStart': function(el, e) { hsDragStart(el, e); } });
registerActions('dragend',   { 'sim:dragEnd':   function(el) { hsDragEnd(el); } });
registerActions('dragover',  { 'sim:over':      function(el, e) { hsDragOver(e, el); } });
registerActions('dragleave', { 'sim:leave':     function(el) { hsDragLeave(el); } });
registerActions('drop',      { 'sim:drop':      function(el, e) { hsDrop(e, el); } });
