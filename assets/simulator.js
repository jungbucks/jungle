import { esc } from './utils.js';

let hsGrid = { '1-1':[], '1-2':[], '2-1':[], '2-2':[], '3-1':[], '3-2':[] };
let hsDragId = null;
let hsMobSelId = null;

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
            splitLabel = `<span class="sim-split-label">↔ ${tag} (${s.credit}학점)</span>`;          
          }          
          return `<div class="sim-placed-card" style="border-left:${borderLeft}" onclick="event.stopPropagation()">            
            <div class="sim-placed-row">              
              <div class="sim-placed-info">                
                <span class="sim-placed-name">${esc(s.name)}</span>                
                <span class="sim-placed-credit">${s.credit}학점</span>              
              </div>              
              <button class="sim-rm-btn" onclick="event.stopPropagation();hsRemove('${sem.key}',${idx})" aria-label="${esc(s.name)} 제거">×</button>            
            </div>            
            <select class="sim-mode-select" onchange="event.stopPropagation();hsSetMode('${sem.key}',${idx},this.value)">              
              <option value="solo"${mode==='solo'?' selected':''}>단독</option>              
              <option value="A"${mode==='A'?' selected':''}>집중이수 A반</option>              
              <option value="B"${mode==='B'?' selected':''}>집중이수 B반</option>            
            </select>            
            ${splitLabel}          
          </div>`;        
        }).join('');    
    return `<td class="sim-td${sem.yb?' yb':''}">      
      <div class="sim-dropzone" data-sem="${sem.key}"        
        ondragover="hsDragOver(event,this)" ondragleave="hsDragLeave(this)"        
        ondrop="hsDrop(event,this)" onclick="hsMobDrop('${sem.key}')">        
        ${inner}      
      </div>    
    </td>`;  
  }).join('');
}

function renderSimSummary() {  
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
        if (!counted.has(pKey)) { counted.add(pKey); total += s.credit; yc[sem.yr] += s.credit; }      
      } else {        
        total += s.credit; yc[sem.yr] += s.credit;      
      }    
    });  
  });  
  return `<div class="sim-summary">    
    <span class="sim-sum-total">총 ${total}학점</span>    
    <div class="sum-sep"></div>    
    <span class="sim-sum-yr">1학년 <strong>${yc[1]}학점</strong></span>    
    <span class="sim-sum-yr">2학년 <strong>${yc[2]}학점</strong></span>    
    <span class="sim-sum-yr">3학년 <strong>${yc[3]}학점</strong></span>    
    <div class="sim-sum-actions">      
      <button class="pbtn sec" onclick="hsReset()">초기화</button>      
      <button class="pbtn pri" onclick="hsCopy(event)">편성표 복사</button>    
    </div>  </div>`;
}

function renderSimulator() {  
  const palHtml = HS_SUBJECTS.map(s => {    
    const col = HS_TYPE_COLOR[s.type];    
    const sel = hsMobSelId === s.id ? ' mob-sel' : '';    
    return `<div class="sim-pal-card${sel}" id="sp_${s.id}" draggable="true"      
      ondragstart="hsDragStart(event,'${s.id}')" ondragend="hsDragEnd(event)"      
      onclick="hsMobSelect('${s.id}')">      
      <div class="sim-pal-name">${esc(s.name)}</div>      
      <div class="sim-pal-meta">        
        <span class="sim-type-badge" style="background:${col.l};color:${col.c}">${esc(s.type)}</span>        
        <span class="sim-pal-credit">${s.credit}학점</span>      
      </div>    
    </div>`;  
  }).join('');  
  const thHtml = HS_SEMS.map(sem =>    
    `<th class="sim-th${sem.yb?' yb':''}">${sem.label}</th>`).join('');  
  return `<div class="sim-wrap">    
    <div class="sim-palette">      
      <div class="sim-palette-title">과목 팔레트<span class="sim-palette-hint">드래그 앤 드롭으로 아래 학기 셀에 배치하세요</span></div>      
      <div class="sim-pal-scroll">${palHtml}</div>    
    </div>    
    <div class="sim-right">      
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

function hsRefresh() {  
  const body = document.getElementById('simBody');  
  if (body) body.innerHTML = `<tr>${hsGridCells()}</tr>`;  
  const sum = document.getElementById('simSummary');  
  if (sum) sum.innerHTML = renderSimSummary();
}

function hsDragStart(e, id) {  
  hsDragId = id;  
  e.dataTransfer.effectAllowed = 'copy';  
  e.dataTransfer.setDragImage(e.currentTarget, e.offsetX || 0, e.offsetY || 0);  
  e.currentTarget.classList.add('dragging');
}

function hsDragEnd(e) {  
  e.currentTarget.classList.remove('dragging');  
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
  if (hsDragId && sem) { hsGrid[sem].push({id:hsDragId,mode:'solo'}); hsRefresh(); }  
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
  hsGrid[sem].push({id:hsMobSelId,mode:'solo'});  
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

function hsCopy(e) {
  const pairs = hsSameYearPairs();
  const counted = new Set();
  const lines = [];
  let total = 0;
  HS_SEMS.forEach(sem => {
    (hsGrid[sem.key]||[]).forEach(entry => {
      const id = entry.id || entry;
      const mode = entry.mode || 'solo';
      const s = HS_SUBJECTS.find(x => x.id === id);
      if (!s) return;
      const modeLabel = mode === 'A' ? ' A반' : mode === 'B' ? ' B반' : '';
      lines.push(`[${sem.label}] ${s.name}${modeLabel}(${s.credit})`);
      const pKey = `${sem.yr}_${id}`;
      if (pairs.has(id) && pairs.get(id).has(sem.yr)) {
        if (!counted.has(pKey)) { counted.add(pKey); total += s.credit; }
      } else {
        total += s.credit;
      }
    });
  });
  if (lines.length) lines.push('');
  lines.push(`총 ${total}학점`);
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = e.target; const orig = btn.textContent;
    btn.textContent = '복사됨!'; setTimeout(() => btn.textContent = orig, 1500);
  });
}

export { renderSimulator };
window.hsDragStart = hsDragStart;
window.hsDragEnd = hsDragEnd;
window.hsDragOver = hsDragOver;
window.hsDragLeave = hsDragLeave;
window.hsDrop = hsDrop;
window.hsMobSelect = hsMobSelect;
window.hsMobDrop = hsMobDrop;
window.hsRemove = hsRemove;
window.hsReset = hsReset;
window.hsCopy = hsCopy;
window.hsSetMode = hsSetMode;
