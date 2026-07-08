import { esc, clipboardWriteText, registerActions } from './utils.js';

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
          const aCell = esc(JSON.stringify([sem.key, idx]));
          return `<div class="sim-placed-card" style="border-left:${borderLeft}" data-onclick="sim:cardNoop">
            <div class="sim-placed-row">
              <div class="sim-placed-info">
                <span class="sim-placed-name">${esc(s.name)}</span>
                <span class="sim-placed-credit">${s.credit}학점</span>
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
        <span class="sim-pal-credit">${s.credit}학점</span>      
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

function hsCopy(btn) {
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
  clipboardWriteText(lines.join('\n'));
  const orig = btn.textContent;
  btn.textContent = '복사됨!'; setTimeout(() => btn.textContent = orig, 1500);
}

export { renderSimulator };

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
});
registerActions('dragstart', { 'sim:dragStart': function(el, e) { hsDragStart(el, e); } });
registerActions('dragend',   { 'sim:dragEnd':   function(el) { hsDragEnd(el); } });
registerActions('dragover',  { 'sim:over':      function(el, e) { hsDragOver(e, el); } });
registerActions('dragleave', { 'sim:leave':     function(el) { hsDragLeave(el); } });
registerActions('drop',      { 'sim:drop':      function(el, e) { hsDrop(e, el); } });
