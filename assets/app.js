const HS_SUBTAB_ORDER = ['middle','high','ai','ds','sw','cs','prog'].map(id => SUBJECTS.findIndex(s => s.id === id));
const HS_SUBTAB_LABELS = ['중학교 정보', '고등학교 정보 (일반선택)', '인공지능 기초 (진로선택)', '데이터 과학 (진로선택)', '소프트웨어와 생활 (융합선택)', '정보과학 (과학계열 진로선택)', '프로그래밍 (전문교과)'];

// --- Simulator data ---
const HS_SUBJECTS = [
  { id:'s1', name:'정보',              type:'일반선택',         credit:3 },
  { id:'s2', name:'정보과학',          type:'과학계열 진로선택', credit:3 },
  { id:'s3', name:'데이터 과학',       type:'진로선택',         credit:3 },
  { id:'s4', name:'인공지능 기초',     type:'진로선택',         credit:3 },
  { id:'s5', name:'소프트웨어와 생활', type:'융합선택',         credit:3 },
  { id:'s6', name:'프로그래밍',        type:'전문교과',         credit:3 },
];
const HS_TYPE_COLOR = {
  '일반선택':         { c:'#3B82F6', l:'#EFF6FF' },
  '진로선택':         { c:'#8B5CF6', l:'#F5F3FF' },
  '과학계열 진로선택': { c:'#0D9488', l:'#CCFBF1' },
  '융합선택':         { c:'#EC4899', l:'#FDF2F8' },
  '전문교과':         { c:'#F59E0B', l:'#FFFBEB' },
};
const HS_SEMS = [
  { key:'1-1', label:'1학년 1학기', yr:1, yb:false },
  { key:'1-2', label:'1학년 2학기', yr:1, yb:false },
  { key:'2-1', label:'2학년 1학기', yr:2, yb:true  },
  { key:'2-2', label:'2학년 2학기', yr:2, yb:false },
  { key:'3-1', label:'3학년 1학기', yr:3, yb:true  },
  { key:'3-2', label:'3학년 2학기', yr:3, yb:false },
];

// --- Lesson Plan Data ---
const LP_METHODS = ['강의식', '협력학습', '프로젝트', '토의토론', '실습', '탐구학습', '기타'];
const LP_EVAL_METHODS = ['지필평가', '수행평가', '자기평가', '동료평가', '관찰평가'];

// --- State ---
let curIdx = 0;
let query = '';
let collected = JSON.parse(localStorage.getItem('collected') || '[]');
let collapsed = new Set();
let panelOpen = false;
let domainFilter = null;
let homeMode = true;
let hsGrid = { '1-1':[], '1-2':[], '2-1':[], '2-2':[], '3-1':[], '3-2':[] };
let hsDragId = null;
let hsMobSelId = null;

// --- Eval Plan State ---
let evalPlanSubtab = 'lesson';
let evalState = (function() {
  try { const s = JSON.parse(localStorage.getItem('evalplan')); if (s) return s; } catch(e) {}
  return { semester:1, subjectIdx:1, examCount:1, perfCount:3, items:[], generated:false };
})();
let evalModalTargetIdx = null;
let evalModalTempSelected = new Set();
let evalModalSubjectIdx = 1;

// --- Lesson Plan State ---
const LP_SEM_DEFAULTS = { 1:{startMW:'3/1',endMW:'7/2'}, 2:{startMW:'8/2',endMW:'1/2'} };
let lessonState = (function() {
  try {
    const s = JSON.parse(localStorage.getItem('jungle_lesson_plan'));
    if (s) {
      const def = LP_SEM_DEFAULTS[s.semester] || LP_SEM_DEFAULTS[1];
      if (!s.startMW) s.startMW = def.startMW;
      if (!s.endMW)   s.endMW   = def.endMW;
      return s;
    }
  } catch(e) {}
  return { subjectIdx:1, semester:1, startMW:'3/1', endMW:'7/2', generated:false, rows:[] };
})();
let lpModalTargetRow = null;
let lpModalTempSelected = new Set();
let lpModalSubjectIdx = 1;

// --- Helpers ---
function S() { return SUBJECTS[curIdx]; }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function hi(s, q) {
  if (!q) return esc(s);
  const r = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
  return esc(s).replace(r, m => `<mark>${m}</mark>`);
}
function setAccent(s) {
  const r = document.documentElement.style;
  r.setProperty('--accent', s.accent);
  r.setProperty('--accent-light', s.aLight);
  r.setProperty('--accent-dark', s.aDark);
}
function cid(code) { return code.replace(/[\[\]-]/g,'_'); }

// --- Domain filter ---
function renderDomainFilter() {
  const s = S();
  if (s.type === 'overview') return;
  const chips = ['전체', ...s.domains.map(d => d.name)];
  document.getElementById('domainFilter').innerHTML = chips.map(name => {
    const isAll = name === '전체';
    const active = isAll ? domainFilter === null : domainFilter === name;
    const activeStyle = active ? `background:${s.accent};border-color:${s.accent};color:#fff` : '';
    return `<button class="dchip${active?' active':''}" style="${activeStyle}"
      onclick="setDomainFilter(${isAll ? 'null' : `'${name.replace(/'/g,"\\'")}'`})">${name}</button>`;
  }).join('');
}
function setDomainFilter(name) {
  domainFilter = name;
  render();
}

// --- Tabs ---
function renderTabs() {
  const idxOf = id => SUBJECTS.findIndex(s => s.id === id);
  const isHS = !homeMode && HS_SUBTAB_ORDER.includes(curIdx);
  const mainItems = [
    {type:'subject', idx:idxOf('overview')},
    {type:'hsgroup'},
    {type:'subject', idx:idxOf('evalplan')},
    {type:'subject', idx:idxOf('textbook')},
    {type:'subject', idx:idxOf('simulator')},
    {type:'subject', idx:idxOf('wiki')},
  ];
  document.getElementById('tabs').innerHTML = mainItems.map(item => {
    if (item.type === 'subject') {
      const s = SUBJECTS[item.idx];
      const active = !homeMode && item.idx === curIdx;
      const styleStr = active ? `color:${s.accent};border-bottom-color:${s.accent}` : '';
      if (s.type === 'evalplan') {
        return `<button class="tab${active?' active':''}" data-text="${esc(s.name)} ▾" onclick="selectSubject(${item.idx})"
          style="${styleStr}">
          <span class="tab-inner">${esc(s.name)}<span style="font-size:10px;line-height:1">▾</span></span></button>`;
      }
      return `<button class="tab${active?' active':''}" data-text="${esc(s.name)}" onclick="selectSubject(${item.idx})"
        style="${styleStr}">
        ${s.name}</button>`;
    }
    const active = isHS;
    const accent = active ? SUBJECTS[curIdx].accent : '';
    return `<button class="tab${active?' active':''}" data-text="정보 성취기준 ▾" onclick="selectHSGroup()"
      style="${active?`color:${accent};border-bottom-color:${accent}`:''}">
      <span class="tab-inner">정보 성취기준<span style="font-size:10px;line-height:1">▾</span></span></button>`;
  }).join('');

  const subtabBar = document.getElementById('subtabBar');
  const isEvalPlan = !homeMode && S().type === 'evalplan';
  if (isHS) {
    document.getElementById('subtabBarInner').innerHTML = HS_SUBTAB_ORDER.map((idx, i) => {
      const s = SUBJECTS[idx];
      const active = curIdx === idx;
      return `<button class="subtab${active?' active':''}" data-text="${esc(HS_SUBTAB_LABELS[i])}" onclick="selectSubject(${idx})"
        style="${active?`color:${s.accent};border-bottom-color:${s.accent}`:''}">
        ${HS_SUBTAB_LABELS[i]}</button>`;
    }).join('');
    subtabBar.classList.add('visible');
  } else if (isEvalPlan) {
    const epAccent = S().accent;
    document.getElementById('subtabBarInner').innerHTML = [
      {key:'lesson', label:'수업계획'},
      {key:'eval',   label:'평가계획'}
    ].map(({key, label}) => {
      const active = evalPlanSubtab === key;
      return `<button class="subtab${active?' active':''}" data-text="${label}" onclick="lpSelectSubtab('${key}')"
        style="${active ? `color:${epAccent};border-bottom-color:${epAccent}` : ''}">
        ${label}</button>`;
    }).join('');
    subtabBar.classList.add('visible');
  } else {
    subtabBar.classList.remove('visible');
    document.getElementById('subtabBarInner').innerHTML = '';
  }
}

function selectHSGroup() {
  if (!HS_SUBTAB_ORDER.includes(curIdx)) selectSubject(HS_SUBTAB_ORDER[0]);
}

function updateSearchVisibility() {
  const t = S().type;
  const hideSearch = !homeMode && (t === 'overview' || t === 'simulator' || t === 'evalplan' || t === 'wiki' || t === 'textbook');
  const hideDomain = homeMode || t === 'overview' || t === 'simulator' || t === 'evalplan' || t === 'wiki' || t === 'textbook';
  const ss = document.getElementById('searchSection');
  ss.style.display = hideSearch ? 'none' : '';
  ss.classList.toggle('home-mode', homeMode);
  document.getElementById('searchInput').placeholder = homeMode
    ? '성취기준 코드 또는 내용을 검색하세요…'
    : '성취기준 코드 또는 내용 검색… (예: 알고리즘, 클래스, 9정03, 12인기)';
  document.getElementById('domainFilter').style.display = hideDomain ? 'none' : '';
  document.getElementById('jungleImg').style.display = homeMode ? '' : 'none';
}

function updateHeaderMode() {
  renderTabs();
}

function goHome() {
  homeMode = true;
  query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  updateHeaderMode();
  updateSearchVisibility();
  render();
}

function onHomeSearch(val) {
  query = val.trim();
  if (!query) return;
  homeMode = false;
  curIdx = 1;
  domainFilter = null;
  document.getElementById('searchInput').value = query;
  document.getElementById('searchClear').classList.add('on');
  updateHeaderMode();
  updateSearchVisibility();
  renderTabs();
  render();
}

function selectSubjectFromHome(idx) {
  homeMode = false;
  curIdx = idx; query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  updateHeaderMode();
  updateSearchVisibility();
  renderTabs(); render();
}

function selectSubject(i) {
  homeMode = false;
  curIdx = i; query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  updateHeaderMode();
  updateSearchVisibility();
  renderTabs(); render();
}

// --- Search ---
let _searchTimer = null;
document.getElementById('searchInput').addEventListener('input', e => {
  query = e.target.value.trim();
  domainFilter = null;
  document.getElementById('searchClear').classList.toggle('on', query.length > 0);
  if (homeMode && query) {
    homeMode = false;
    curIdx = 1;
    updateHeaderMode();
    updateSearchVisibility();
    const inp = e.target;
    const pos = inp.selectionEnd;
    requestAnimationFrame(() => { inp.focus(); inp.setSelectionRange(pos, pos); });
  }
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(render, 150);
});
function clearSearch() {
  query = ''; domainFilter = null;
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  render();
}

// --- Domain toggle ---
function toggleDomain(key) {
  collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key);
  const el = document.getElementById('d_'+cid(key));
  if (el) el.classList.toggle('collapsed');
}

// --- Global search ---
function renderGlobalSearch() {
  document.getElementById('domainFilter').innerHTML = '';
  const q = query.toLowerCase();
  const results = [];
  let totalVis = 0;

  SUBJECTS.filter(s => !['overview','simulator','evalplan'].includes(s.type)).forEach(subj => {
    const matchedDomains = [];
    subj.domains.forEach(d => {
      const items = d.items.filter(it => it.code.toLowerCase().includes(q) || it.text.toLowerCase().includes(q));
      if (items.length) { matchedDomains.push({name: d.name, items}); totalVis += items.length; }
    });
    if (matchedDomains.length) results.push({subj, domains: matchedDomains});
  });

  let html = `<div class="subject-meta">
    <span style="font-size:13px;color:var(--g600)">전체 과목에서 검색 중 &mdash; <strong style="color:var(--g900)">${totalVis}개</strong> 성취기준</span>
  </div>`;

  if (!results.length) {
    html += `<div class="no-res"><div class="no-res-icon">🔍</div>
      <div class="no-res-text">검색 결과가 없습니다</div>
      <div class="no-res-sub">"${esc(query)}"에 해당하는 성취기준이 없습니다</div></div>`;
  } else {
    results.forEach(({subj, domains}) => {
      html += `<div style="display:flex;align-items:center;gap:8px;margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid ${subj.aLight}">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${subj.accent};flex-shrink:0"></span>
        <span style="font-size:14px;font-weight:700;color:${subj.accent}">${esc(subj.name)}</span>
        <span style="font-size:12px;color:var(--g400)">${esc(subj.level)}</span>
      </div>`;
      domains.forEach(d => {
        const key = subj.id + '||' + d.name;
        const col = collapsed.has(key);
        html += `<div class="domain-section${col?' collapsed':''}" id="d_${cid(key)}">
          <div class="domain-header" onclick="toggleDomain('${key.replace(/'/g,"\\'")}')">
            <div class="domain-left">
              <span class="domain-dot" style="background:${subj.accent}"></span>
              <span class="domain-name">${esc(d.name)}</span>
              <span class="domain-cnt">${d.items.length}개</span>
            </div>
            ${(() => {
              const achvKey = subj.id === 'high' ? d.name + '_고'
                            : subj.id === 'cs'   ? d.name + '_cs'
                            : d.name;
              return ACHIEVEMENTS[achvKey]
                ? `<button class="achv-btn" onclick="event.stopPropagation();openAchvModal('${achvKey.replace(/'/g,"\\'")}','${subj.accent}')">ABCDE 성취수준</button>`
                : '';
            })()}
            <span class="toggle-icon">▾</span>
          </div>
          <div class="domain-body">`;
        d.items.forEach(it => {
          const isCol = collected.some(c => c.code === it.code);
          html += `<div class="std-card">
            <input type="checkbox" class="card-chk" data-code="${esc(it.code)}" data-text="${esc(it.text)}" data-sid="${subj.id}"
              ${isCol?'checked':''} onchange="onCheck(this)" style="accent-color:${subj.accent}">
            <div class="card-body">
              <span class="code-badge" style="background:${subj.aLight};color:${subj.accent}">${hi(it.code,query)}</span>
              <div class="std-text">${hi(it.text,query)}</div>
            </div>
            <div class="card-btns">
              <button class="cbtn" data-code="${esc(it.code)}" data-text="${esc(it.text)}" data-mode="full"
                onclick="doCopy(this)" onmouseenter="this.style.background='${subj.accent}';this.style.borderColor='${subj.accent}';this.style.color='#fff'"
                onmouseleave="if(!this.classList.contains('ok')){this.style.background='';this.style.borderColor='';this.style.color=''}">복사</button>
              <button class="cbtn sm" data-code="${esc(it.code)}" data-text="" data-mode="code"
                onclick="doCopy(this)" style="color:${subj.accent};border-color:${subj.aLight}"
                onmouseenter="this.style.background='${subj.accent}';this.style.borderColor='${subj.accent}';this.style.color='#fff'"
                onmouseleave="if(!this.classList.contains('ok')){this.style.background='';this.style.borderColor='';this.style.color='${subj.accent}'}">코드만</button>
            </div>
          </div>`;
        });
        html += `</div></div>`;
      });
    });
  }
  document.getElementById('main').innerHTML = html;
}

// --- Simulator ---
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
              <button class="sim-rm-btn" onclick="event.stopPropagation();hsRemove('${sem.key}',${idx})">×</button>
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
    </div>
  </div>`;
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
    </div>
  </div>`;
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

// --- Home screen ---
function renderHome() {
  const standardSubjects = SUBJECTS.filter(s => !['overview','simulator','evalplan'].includes(s.type));
  const btnHtml = standardSubjects.map(s => {
    const idx = SUBJECTS.indexOf(s);
    return `<button class="home-subj-btn" style="background:${s.aLight};color:${s.accent}"
      onclick="selectSubjectFromHome(${idx})">${esc(s.name)}</button>`;
  }).join('');
  return `<div class="home-wrap">
    <div class="home-sub">정보 교사를 위한 교과 성취기준 검색</div>
    <div class="home-subjects">${btnHtml}</div>
    <button class="home-ov-link" onclick="selectSubjectFromHome(0)">교육과정 구성 →</button>
  </div>`;
}

// --- Render ---
function render() {
  if (homeMode) {
    document.getElementById('main').innerHTML = renderHome();
    evalHideSummary();
    return;
  }
  const s = S();
  if (s.type === 'overview') {
    document.getElementById('main').innerHTML = renderOverview();
    return;
  }
  if (s.type === 'simulator') {
    document.getElementById('main').innerHTML = renderSimulator();
    evalHideSummary();
    return;
  }
  if (s.type === 'evalplan') {
    if (evalPlanSubtab === 'eval') {
      document.getElementById('main').innerHTML = renderEvalPlan();
      if (evalState.generated) evalShowSummary(); else evalHideSummary();
    } else {
      document.getElementById('main').innerHTML = renderLessonPlan();
      evalHideSummary();
    }
    return;
  }
  if (s.type === 'wiki') {
    document.getElementById('main').innerHTML = renderWiki();
    evalHideSummary();
    return;
  }
  if (s.type === 'textbook') {
    document.getElementById('main').innerHTML = renderTextbook();
    evalHideSummary();
    return;
  }
  evalHideSummary();
  if (query) { renderGlobalSearch(); return; }
  setAccent(s);
  renderDomainFilter();
  const q = query.toLowerCase();
  let totalAll = 0, totalVis = 0;

  const filtered = s.domains.map(d => {
    const domainMatch = domainFilter === null || d.name === domainFilter;
    if (domainMatch) totalAll += d.items.length;
    if (!domainMatch) return {...d, items: []};
    const items = d.items.filter(it => !q || it.code.toLowerCase().includes(q) || it.text.toLowerCase().includes(q));
    totalVis += items.length;
    return {...d, items};
  }).filter(d => d.items.length > 0);

  let html = `<div class="subject-meta">
    <span class="level-badge" style="background:${s.aLight};color:${s.accent}">${s.level}</span>
    <span class="count-info">${(q||domainFilter)?`<strong>${totalVis}</strong> / ${totalAll}개 성취기준`:`총 <strong>${totalAll}</strong>개 성취기준`}</span>
    <button class="dl-btn" onclick="downloadTxt()">⬇ 전체 저장 (.txt)</button>
  </div>`;

  if (!filtered.length) {
    html += `<div class="no-res"><div class="no-res-icon">🔍</div>
      <div class="no-res-text">검색 결과가 없습니다</div>
      <div class="no-res-sub">"${esc(query)}"에 해당하는 성취기준이 없습니다</div></div>`;
  } else {
    filtered.forEach(d => {
      const key = s.id + '||' + d.name;
      const col = collapsed.has(key);
      html += `<div class="domain-section${col?' collapsed':''}" id="d_${cid(key)}">
        <div class="domain-header" onclick="toggleDomain('${key.replace(/'/g,"\\'")}')">
          <div class="domain-left">
            <span class="domain-dot" style="background:${s.accent}"></span>
            <span class="domain-name">${esc(d.name)}</span>
            <span class="domain-cnt">${d.items.length}개</span>
          </div>
          ${(() => {
            const achvKey = s.id === 'high' ? d.name + '_고'
                          : s.id === 'cs'   ? d.name + '_cs'
                          : d.name;
            return ACHIEVEMENTS[achvKey]
              ? `<button class="achv-btn" onclick="event.stopPropagation();openAchvModal('${achvKey.replace(/'/g,"\\'")}','${s.accent}')">ABCDE 성취수준</button>`
              : '';
          })()}
          <span class="toggle-icon">▾</span>
        </div>
        <div class="domain-body">`;

      d.items.forEach(it => {
        const isCol = collected.some(c => c.code === it.code);
        html += `<div class="std-card">
          <input type="checkbox" class="card-chk" data-code="${esc(it.code)}" data-text="${esc(it.text)}" data-sid="${s.id}"
            ${isCol?'checked':''} onchange="onCheck(this)" style="accent-color:${s.accent}">
          <div class="card-body">
            <span class="code-badge" style="background:${s.aLight};color:${s.accent}">${hi(it.code,query)}</span>
            <div class="std-text">${hi(it.text,query)}</div>
          </div>
          <div class="card-btns">
            <button class="cbtn" data-code="${esc(it.code)}" data-text="${esc(it.text)}" data-mode="full"
              onclick="doCopy(this)" style="--h:${s.accent}" onmouseenter="this.style.background=this.dataset.h||'${s.accent}';this.style.borderColor=this.dataset.h||'${s.accent}';this.style.color='#fff'"
              onmouseleave="if(!this.classList.contains('ok')){this.style.background='';this.style.borderColor='';this.style.color=''}">복사</button>
            <button class="cbtn sm" data-code="${esc(it.code)}" data-text="" data-mode="code"
              onclick="doCopy(this)" style="color:${s.accent};border-color:${s.aLight}"
              onmouseenter="this.style.background='${s.accent}';this.style.borderColor='${s.accent}';this.style.color='#fff'"
              onmouseleave="if(!this.classList.contains('ok')){this.style.background='';this.style.borderColor='';this.style.color='${s.accent}'}">코드만</button>
          </div>
        </div>`;
      });

      html += `</div></div>`;
    });
  }

  document.getElementById('main').innerHTML = html;
}

// --- Copy ---
function doCopy(btn) {
  const text = btn.dataset.mode === 'code'
    ? btn.dataset.code
    : btn.dataset.code + ' ' + btn.dataset.text;
  navigator.clipboard.writeText(text).catch(() => {
    const ta = Object.assign(document.createElement('textarea'),{value:text,style:'position:fixed;opacity:0'});
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  });
  const orig = btn.textContent;
  btn.textContent = '복사됨!'; btn.classList.add('ok');
  btn.style.background = '#10B981'; btn.style.borderColor = '#10B981'; btn.style.color = '#fff';
  setTimeout(() => {
    btn.textContent = orig; btn.classList.remove('ok');
    btn.style.background = btn.style.borderColor = btn.style.color = '';
  }, 1400);
}

// --- Collect ---
function saveCollected() {
  localStorage.setItem('collected', JSON.stringify(collected));
}

function onCheck(chk) {
  const {code, text, sid} = chk.dataset;
  if (chk.checked) {
    if (!collected.some(c => c.code === code)) collected.push({code, text, sid});
  } else {
    collected = collected.filter(c => c.code !== code);
  }
  saveCollected(); updatePanel();
}

function removeItem(code) {
  collected = collected.filter(c => c.code !== code);
  const chk = document.querySelector(`.card-chk[data-code="${CSS.escape(code)}"]`);
  if (chk) chk.checked = false;
  saveCollected(); updatePanel();
}

function clearCollect() {
  collected = [];
  document.querySelectorAll('.card-chk').forEach(c => c.checked = false);
  saveCollected(); updatePanel();
}

function copyAll() {
  if (!collected.length) return;
  const text = collected.map(c => c.code + ' ' + c.text).join('\n');
  const btn = document.getElementById('copyAllBtn');
  navigator.clipboard.writeText(text).catch(() => {
    const ta = Object.assign(document.createElement('textarea'),{value:text,style:'position:fixed;opacity:0'});
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  });
  btn.textContent = '복사됨!';
  setTimeout(() => btn.textContent = '전체 복사', 1400);
}

function togglePanel() {
  panelOpen = !panelOpen;
  document.getElementById('collectPanel').classList.toggle('open', panelOpen);
}

function updatePanel() {
  const n = collected.length;
  document.getElementById('fabCnt').textContent = n;
  document.getElementById('panelCnt').textContent = n;
  document.getElementById('fab').classList.toggle('on', n > 0);
  const dlBtn = document.getElementById('downloadCollectedBtn');
  if (dlBtn) dlBtn.disabled = n === 0;
  if (n === 0 && panelOpen) { panelOpen = false; document.getElementById('collectPanel').classList.remove('open'); }

  const body = document.getElementById('panelBody');
  if (!n) {
    body.innerHTML = '<div style="text-align:center;padding:24px;color:#9CA3AF;font-size:13px">담은 성취기준이 없습니다.</div>';
    return;
  }
  body.innerHTML = collected.map(c => {
    const subj = SUBJECTS.find(s => s.id === c.sid) || SUBJECTS[0];
    return `<div class="p-item">
      <span class="p-item-code" style="background:${subj.aLight};color:${subj.accent}">${esc(c.code)}</span>
      <span class="p-item-text">${esc(c.text)}</span>
      <button class="p-item-rm" data-rm="${esc(c.code)}">×</button>
    </div>`;
  }).join('');
}

// --- Textbook ---
function renderTextbook() {
  const sid = id => SUBJECTS.find(s => s.id === id);
  const mid  = sid('middle');
  const high = sid('high');
  const ai   = sid('ai');
  const ds   = sid('ds');
  const sw   = sid('sw');

  function bookTable(s, rows='') {
    const bg = s.aDark;
    return `<div class="msub-tbl-scroll"><table class="msub-table">
    <thead><tr>
      <th class="msub-num" style="background:${bg}">번호</th>
      <th style="background:${bg}">출판사</th>
      <th style="background:${bg}">저자</th>
      <th class="msub-year" style="background:${bg}">발행연도</th>
      <th class="msub-ebook" style="background:${bg}">E-BOOK</th>
    </tr></thead><tbody>${rows}</tbody>
  </table></div>`;
  }

  function subheading(s, label) {
    return `<div class="msub-subheading" style="color:${s.aDark};background:${s.aLight};border-left-color:${s.accent}">${label}</div>`;
  }

  const highRows = `
      <tr><td class="msub-num">1</td><td class="msub-publisher">교학사</td><td>이영준 외 5명</td><td class="msub-year">2025</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">2</td><td class="msub-publisher">미래엔</td><td>안성진 외 6명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">3</td><td class="msub-publisher">도서출판길벗</td><td>김재현 외 4명</td><td class="msub-year">2025</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">4</td><td class="msub-publisher">금성출판사</td><td>김영일 외 4명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">5</td><td class="msub-publisher">교문사</td><td>정영식 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">6</td><td class="msub-publisher">비상교육</td><td>임희석 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">7</td><td class="msub-publisher">와이비엠</td><td>정재화 외 7명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">8</td><td class="msub-publisher">이오북스</td><td>김영식 외 7명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">9</td><td class="msub-publisher">천재교과서</td><td>김현철 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">10</td><td class="msub-publisher">씨마스</td><td>강신천 외 9명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">11</td><td class="msub-publisher">삼양미디어</td><td>정웅열 외 7명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>`;
  const aiRows = `
      <tr><td class="msub-num">1</td><td class="msub-publisher">웅보출판사</td><td>민무홍 외 3명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">2</td><td class="msub-publisher">금성출판사</td><td>김영일 외 3명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">3</td><td class="msub-publisher">도서출판길벗</td><td>김재현 외 4명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">4</td><td class="msub-publisher">미래엔</td><td>안성진 외 6명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">5</td><td class="msub-publisher">미래융합연구원</td><td>유두규 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">6</td><td class="msub-publisher">비상교육</td><td>임희석 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">7</td><td class="msub-publisher">삼양미디어</td><td>정웅열 외 6명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">8</td><td class="msub-publisher">씨마스</td><td>이지항 외 8명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">9</td><td class="msub-publisher">와이비엠</td><td>서인순 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">10</td><td class="msub-publisher">이오북스</td><td>김귀훈 외 7명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">11</td><td class="msub-publisher">천재교과서</td><td>김현철 외 4명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">12</td><td class="msub-publisher">플레이스터디</td><td>최현종 외 4명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>`;
  const dsRows = `
      <tr><td class="msub-num">1</td><td class="msub-publisher">씨마스</td><td>강신천 외 8명</td><td class="msub-year">2025</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">2</td><td class="msub-publisher">올드앤뉴</td><td>임부현 외 4명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">3</td><td class="msub-publisher">삼양미디어</td><td>정웅열 외 7명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">4</td><td class="msub-publisher">와이비엠</td><td>서인순 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">5</td><td class="msub-publisher">천재교과서</td><td>김현철 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>`;
  const swRows = `
      <tr><td class="msub-num">1</td><td class="msub-publisher">교학사</td><td>이영준 외 4명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">2</td><td class="msub-publisher">도서출판길벗</td><td>김재현 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">3</td><td class="msub-publisher">삼양미디어</td><td>서성원 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">4</td><td class="msub-publisher">이오북스</td><td>김귀훈 외 7명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">5</td><td class="msub-publisher">천재교과서</td><td>이준구 외 5명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>
      <tr><td class="msub-num">6</td><td class="msub-publisher">씨마스</td><td>조정원 외 9명</td><td class="msub-year">2024</td><td class="msub-ebook"></td></tr>`;
  const midGosiwaRows = `
      <tr><td class="msub-num">1</td><td class="msub-curri">2022</td><td class="msub-org">인천광역시교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">문제 해결과 프로그래밍</td></tr>
      <tr><td class="msub-num">2</td><td class="msub-curri">2022</td><td class="msub-org">경상남도교육청</td><td>정보</td><td class="msub-subj-name">피지컬 컴퓨팅</td></tr>
      <tr><td class="msub-num">3</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>정보</td><td class="msub-subj-name">인공지능과 미래사회(중)</td></tr>
      <tr><td class="msub-num">4</td><td class="msub-curri">2022</td><td class="msub-org">인천광역시교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">데이터 분석과 인공지능</td></tr>
      <tr><td class="msub-num">5</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>정보</td><td class="msub-subj-name">파이썬과 데이터 융합</td></tr>
      <tr><td class="msub-num">6</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>정보</td><td class="msub-subj-name">앱과 코딩</td></tr>
      <tr><td class="msub-num">7</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>정보</td><td class="msub-subj-name">슬기로운 디지털 생활</td></tr>
      <tr><td class="msub-num">8</td><td class="msub-curri">2022</td><td class="msub-org">전라남도교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">인공지능과 생활</td></tr>
      <tr><td class="msub-num">9</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>정보</td><td class="msub-subj-name">프로그래밍과 인공지능 로봇</td></tr>
      <tr><td class="msub-num">10</td><td class="msub-curri">2022</td><td class="msub-org">울산광역시교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">스마트한 인공지능 생활 1</td></tr>
      <tr><td class="msub-num">11</td><td class="msub-curri">2022</td><td class="msub-org">울산광역시교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">스마트한 인공지능 생활 2</td></tr>
      <tr><td class="msub-num">12</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>정보</td><td class="msub-subj-name">인공지능과 차세대 모빌리티</td></tr>
      <tr><td class="msub-num">13</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>정보</td><td class="msub-subj-name">디지털윤리</td></tr>
      <tr><td class="msub-num">14</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">타자(他者)와 평화 Ⅱ</td></tr>
      <tr><td class="msub-num">15</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">인공지능탐구</td></tr>
      <tr><td class="msub-num">16</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>과학/기술·가정/정보</td><td class="msub-subj-name">생활 공간 디자인</td></tr>`;
  const hsGosiwaRows = `
      <tr><td class="msub-num">1</td><td class="msub-curri">2022</td><td class="msub-org">광주광역시교육청</td><td>정보통신</td><td class="msub-subj-name">군대윤리</td></tr>
      <tr><td class="msub-num">2</td><td class="msub-curri">2022</td><td class="msub-org">광주광역시교육청</td><td>정보</td><td class="msub-subj-name">수리와 인공지능</td></tr>
      <tr><td class="msub-num">3</td><td class="msub-curri">2022</td><td class="msub-org">광주광역시교육청</td><td>보통 교과(진로선택)/정보</td><td class="msub-subj-name">정보 과제 연구</td></tr>
      <tr><td class="msub-num">4</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>보통 교과(정보)-진로선택</td><td class="msub-subj-name">인공지능과 미래사회</td></tr>
      <tr><td class="msub-num">5</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문 교과(정보-통신)</td><td class="msub-subj-name">프로그래밍(C++)</td></tr>
      <tr><td class="msub-num">6</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>정보-통신/전공일반</td><td class="msub-subj-name">서버 구축 및 운영</td></tr>
      <tr><td class="msub-num">7</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>정보-통신/전공일반</td><td class="msub-subj-name">웹 프로그래밍 실무</td></tr>
      <tr><td class="msub-num">8</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>정보-통신(전공실무)</td><td class="msub-subj-name">화면 디자인</td></tr>
      <tr><td class="msub-num">9</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공실무</td><td class="msub-subj-name">웹 애플리케이션 개발</td></tr>
      <tr><td class="msub-num">10</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공실무</td><td class="msub-subj-name">인공지능 활용 서비스 개발</td></tr>
      <tr><td class="msub-num">11</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공실무</td><td class="msub-subj-name">웹 응용 SW 프로그래밍 실무</td></tr>
      <tr><td class="msub-num">12</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공실무</td><td class="msub-subj-name">운영체제와 클라우드 인프라스트럭처 활용</td></tr>
      <tr><td class="msub-num">13</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공실무</td><td class="msub-subj-name">서버 응용 SW 엔지니어링 실무</td></tr>
      <tr><td class="msub-num">14</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공일반</td><td class="msub-subj-name">프로그래밍 JAVA 기초</td></tr>
      <tr><td class="msub-num">15</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과(정보-통신)-전공일반</td><td class="msub-subj-name">프로그래밍 JAVA 실무</td></tr>
      <tr><td class="msub-num">16</td><td class="msub-curri">2022</td><td class="msub-org">전라남도교육청</td><td>정보통신/전공실무</td><td class="msub-subj-name">응용SW엔지니어링</td></tr>
      <tr><td class="msub-num">17</td><td class="msub-curri">2022</td><td class="msub-org">전라남도교육청</td><td>정보-통신/전공실무</td><td class="msub-subj-name">인공지능과 사물인터넷</td></tr>
      <tr><td class="msub-num">18</td><td class="msub-curri">2022</td><td class="msub-org">대구광역시교육청</td><td>정보</td><td class="msub-subj-name">데이터과학머신러닝</td></tr>
      <tr><td class="msub-num">19</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>과학계열(정보)</td><td class="msub-subj-name">정보과학융합 탐구</td></tr>
      <tr><td class="msub-num">20</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>과학계열(정보)</td><td class="msub-subj-name">정보과학 과제연구</td></tr>
      <tr><td class="msub-num">21</td><td class="msub-curri">2022</td><td class="msub-org">강원특별자치도교육청</td><td>정보</td><td class="msub-subj-name">프로그래밍기초</td></tr>
      <tr><td class="msub-num">22</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">운영체제1</td></tr>
      <tr><td class="msub-num">23</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">운영체제2</td></tr>
      <tr><td class="msub-num">24</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">인공지능론1</td></tr>
      <tr><td class="msub-num">25</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">인공지능론2</td></tr>
      <tr><td class="msub-num">26</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">서버 프로그래밍</td></tr>
      <tr><td class="msub-num">27</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">인공지능 활용</td></tr>
      <tr><td class="msub-num">28</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">프론트엔드 프로그래밍</td></tr>
      <tr><td class="msub-num">29</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">알고리즘 실무1</td></tr>
      <tr><td class="msub-num">30</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">알고리즘 실무2</td></tr>
      <tr><td class="msub-num">31</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">컴퓨터과학 탐구I</td></tr>
      <tr><td class="msub-num">32</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">컴퓨터과학 탐구II</td></tr>
      <tr><td class="msub-num">33</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">프로젝트 실무I</td></tr>
      <tr><td class="msub-num">34</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">프로젝트 실무II</td></tr>
      <tr><td class="msub-num">35</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">딥러닝 실무</td></tr>
      <tr><td class="msub-num">36</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">빅데이터 실무</td></tr>
      <tr><td class="msub-num">37</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">서버 프로그래밍 실무</td></tr>
      <tr><td class="msub-num">38</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">프론트엔드 프로그래밍 실무</td></tr>
      <tr><td class="msub-num">39</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">웹 개발 입문</td></tr>
      <tr><td class="msub-num">40</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">인공지능 프로그래밍 입문</td></tr>
      <tr><td class="msub-num">41</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">앱 개발 프로그래밍</td></tr>
      <tr><td class="msub-num">42</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공일반(정보-통신)</td><td class="msub-subj-name">객체지향 프로그래밍(JAVA)</td></tr>
      <tr><td class="msub-num">43</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">소프트웨어 엔지니어링 실무</td></tr>
      <tr><td class="msub-num">44</td><td class="msub-curri">2022</td><td class="msub-org">인천광역시교육청</td><td>보통 교과(과학 계열)/정보/진로 선택</td><td class="msub-subj-name">데이터 시각화 프로그래밍</td></tr>
      <tr><td class="msub-num">45</td><td class="msub-curri">2022</td><td class="msub-org">대구광역시교육청</td><td>정보-통신</td><td class="msub-subj-name">디지털트윈</td></tr>
      <tr><td class="msub-num">46</td><td class="msub-curri">2022</td><td class="msub-org">광주광역시교육청</td><td>전문교과(전공실무)/정보-통신</td><td class="msub-subj-name">프로젝트 실무</td></tr>
      <tr><td class="msub-num">47</td><td class="msub-curri">2022</td><td class="msub-org">대구광역시교육청</td><td>정보-통신</td><td class="msub-subj-name">디지털트윈 구축</td></tr>
      <tr><td class="msub-num">48</td><td class="msub-curri">2022</td><td class="msub-org">대구광역시교육청</td><td>정보-통신</td><td class="msub-subj-name">스마트물류통합관리</td></tr>
      <tr><td class="msub-num">49</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">클라우드 컴퓨팅 이해</td></tr>
      <tr><td class="msub-num">50</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">클라우드 시스템 구성</td></tr>
      <tr><td class="msub-num">51</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">비즈니스 프로그래밍 기초</td></tr>
      <tr><td class="msub-num">52</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">비즈니스 프로그래밍 중급</td></tr>
      <tr><td class="msub-num">53</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">기업 프로세스 기초</td></tr>
      <tr><td class="msub-num">54</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">재무관리시스템</td></tr>
      <tr><td class="msub-num">55</td><td class="msub-curri">2022</td><td class="msub-org">충청남도교육청</td><td>전공실무-정보-통신</td><td class="msub-subj-name">물류관리시스템</td></tr>
      <tr><td class="msub-num">56</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과-정보-통신-전공실무</td><td class="msub-subj-name">디지털 자산의 이해와 보안</td></tr>
      <tr><td class="msub-num">57</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문교과-정보-통신-전공실무</td><td class="msub-subj-name">인공지능 프라이버시</td></tr>
      <tr><td class="msub-num">58</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">임베디드 리눅스 프로그래밍</td></tr>
      <tr><td class="msub-num">59</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">임베디드 시스템</td></tr>
      <tr><td class="msub-num">60</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">임베디드 실시간 운영체제</td></tr>
      <tr><td class="msub-num">61</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무(정보-통신)</td><td class="msub-subj-name">임베디드 프로젝트 실무</td></tr>
      <tr><td class="msub-num">62</td><td class="msub-curri">2022</td><td class="msub-org">대전광역시교육청</td><td>전문교과/전공실무/정보-통신</td><td class="msub-subj-name">바이오 건축설비</td></tr>
      <tr><td class="msub-num">63</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>정보</td><td class="msub-subj-name">AP 컴퓨터과학A I</td></tr>
      <tr><td class="msub-num">64</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>정보</td><td class="msub-subj-name">AP 컴퓨터과학A II</td></tr>
      <tr><td class="msub-num">65</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>정보</td><td class="msub-subj-name">AP 컴퓨터과학 원리 I</td></tr>
      <tr><td class="msub-num">66</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>정보</td><td class="msub-subj-name">AP 컴퓨터과학 원리 II</td></tr>
      <tr><td class="msub-num">67</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>전문교과/정보-통신 교과(군)/전공실무</td><td class="msub-subj-name">사물인터넷 이해와 활용</td></tr>
      <tr><td class="msub-num">68</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>전문교과/정보-통신 교과(군)/전공실무</td><td class="msub-subj-name">사물인터넷 프로젝트</td></tr>
      <tr><td class="msub-num">69</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>보통교과/정보교과(군)/진로선택</td><td class="msub-subj-name">데이터전문탐구I</td></tr>
      <tr><td class="msub-num">70</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>보통교과/정보교과(군)/진로선택</td><td class="msub-subj-name">데이터전문탐구II</td></tr>
      <tr><td class="msub-num">71</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>보통교과/기술·가정/정보 정보 교과(군)/진로선택</td><td class="msub-subj-name">IB 컴퓨터과학 SL I</td></tr>
      <tr><td class="msub-num">72</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>보통교과/기술·가정/정보 정보 교과(군)/진로선택</td><td class="msub-subj-name">IB 컴퓨터과학 SL II</td></tr>
      <tr><td class="msub-num">73</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>보통교과/기술·가정/정보 정보 교과(군)/진로선택</td><td class="msub-subj-name">IB 컴퓨터과학 HL I</td></tr>
      <tr><td class="msub-num">74</td><td class="msub-curri">2022</td><td class="msub-org">경기도교육청</td><td>보통교과/기술·가정/정보 정보 교과(군)/진로선택</td><td class="msub-subj-name">IB 컴퓨터과학 HL II</td></tr>
      <tr><td class="msub-num">75</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문 교과(정보-통신)-전공 일반</td><td class="msub-subj-name">인공지능 파이썬 실무</td></tr>
      <tr><td class="msub-num">76</td><td class="msub-curri">2022</td><td class="msub-org">서울특별시교육청</td><td>전문 교과(정보-통신)-전공 일반</td><td class="msub-subj-name">인공지능 파이썬 기초</td></tr>
      <tr><td class="msub-num">77</td><td class="msub-curri">2022</td><td class="msub-org">전라남도교육청</td><td>전문교과-정보-통신(전공실무)</td><td class="msub-subj-name">사무자동화기기운용</td></tr>
      <tr><td class="msub-num">78</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>기술·가정/정보</td><td class="msub-subj-name">인공지능 융합 프로젝트</td></tr>
      <tr><td class="msub-num">79</td><td class="msub-curri">2022</td><td class="msub-org">세종특별자치시교육청</td><td>보통교과/정보/진로선택</td><td class="msub-subj-name">시뮬레이션과 인공지능</td></tr>
      <tr><td class="msub-num">80</td><td class="msub-curri">2022</td><td class="msub-org">세종특별자치시교육청</td><td>보통교과/정보/진로선택</td><td class="msub-subj-name">인공지능과 소설의 만남</td></tr>
      <tr><td class="msub-num">81</td><td class="msub-curri">2022</td><td class="msub-org">세종특별자치시교육청</td><td>보통교과/정보/진로선택</td><td class="msub-subj-name">생성형 인공지능 프로젝트</td></tr>
      <tr><td class="msub-num">82</td><td class="msub-curri">2022</td><td class="msub-org">경상북도교육청</td><td>기술·가정/정보</td><td class="msub-subj-name">나와 지구를 위한 지속가능 스타일링</td></tr>`;

  function gosiwaTable(headBg, rows) {
    return `<div class="msub-tbl-scroll"><table class="msub-table">
    <thead><tr>
      <th class="msub-num" style="background:${headBg}">번호</th>
      <th style="background:${headBg}">교육과정</th>
      <th style="background:${headBg}">소속기관</th>
      <th style="background:${headBg}">관련교과</th>
      <th style="background:${headBg}">과목명</th>
    </tr></thead><tbody>${rows}</tbody>
  </table></div>`;
  }

  return `<div class="msub-wrap">

  <div class="msub-heading" style="color:${mid.accent}">중학교 정보 교과서 목록</div>
  <div class="msub-desc">2022 개정 교육과정 기준 검정 교과서 목록입니다.</div>
  ${bookTable(mid)}

  <hr class="msub-sep">

  <div class="msub-heading">고등학교 정보교과 교과서 목록</div>
  <div class="msub-desc">2022 개정 교육과정 기준 검정 교과서 목록입니다. 과목별로 구분되어 있습니다.</div>

  ${subheading(high, '정보')}
  ${bookTable(high, highRows)}

  ${subheading(ai, '인공지능기초')}
  ${bookTable(ai, aiRows)}

  ${subheading(ds, '데이터과학')}
  ${bookTable(ds, dsRows)}

  ${subheading(sw, '소프트웨어와 생활')}
  ${bookTable(sw, swRows)}

  <hr class="msub-sep">

  <details class="msub-collapse">
    <summary class="msub-collapse-hd" style="color:#D97706"><span class="msub-collapse-arrow">▶</span>중학교 고시외 과목 목록<span class="msub-cnt" style="background:#FEF3C7;color:#92400E">16개</span></summary>
    <div class="msub-desc">2022 개정 교육과정 기준, 지역 교육청별 승인 완료 과목입니다. 교과서 개발·채택 시 참고하세요.</div>
    ${gosiwaTable('#D97706', midGosiwaRows)}
  </details>

  <hr class="msub-sep">

  <details class="msub-collapse">
    <summary class="msub-collapse-hd" style="color:#4F46E5"><span class="msub-collapse-arrow">▶</span>고등학교 고시외 과목 목록<span class="msub-cnt" style="background:#EEF2FF;color:#3730A3">82개</span></summary>
    <div class="msub-desc">2022 개정 교육과정 기준, 지역 교육청별 승인 완료 과목입니다.</div>
    ${gosiwaTable('#4F46E5', hsGosiwaRows)}
  </details>

</div>`;
}

// --- Overview ---
function renderWiki() {
  const cats = RECOMMENDED_SITES.map(cat => {
    const cards = cat.items.map(site => `
      <a class="wiki-card" href="${site.url}" target="_blank" rel="noopener">
        <div class="wiki-card-name">${esc(site.name)}</div>
        <div class="wiki-card-url">${site.url.replace(/^https?:\/\//,'')}</div>
        <div class="wiki-card-desc">${esc(site.desc)}</div>
      </a>`).join('');
    return `<div class="wiki-category">
      <div class="wiki-cat-title">${cat.category}</div>
      <div class="wiki-grid">${cards}</div>
    </div>`;
  }).join('');
  return `<div class="wiki-wrap">
    <div style="text-align:center;margin-bottom:28px">
      <h2 style="font-size:20px;font-weight:800;color:var(--g900);letter-spacing:-.01em">정보 선생님들이 알면 좋은 사이트 모음ZIP</h2>
    </div>
    ${cats}</div>`;
}

function renderOverview() {
  return `
<div class="ov-wrap">
  <div class="ov-desc">
    정보 교과 교육과정은 그 범위를 확장해 가고 있는 학문적 정체성과 디지털 대전환 시대의 국가·사회적 요구사항 반영, 미래 사회 변화에 적극적으로 대응할 수 있는 역량을 강화하기 위한 방향으로 설계하였다. 2022 개정 교육과정 총론 주요사항에서 제시된 핵심역량 중 '지식정보처리', '창의적 사고', '협력적 소통', '공동체 역량'과 연계하여 '컴퓨팅 사고력', '디지털 문화 소양', '인공지능 소양'을 정보 교과의 역량으로 설정하였고, 하위 역량을 상위 역량이 포괄하는 형태로 구성하였다.
  </div>

  <div class="ov-diagram">
    <div class="ov-row">
      <div class="ov-row-label"><span class="ov-row-sublabel">(총론)</span>인간상</div>
      <div class="ov-row-content">
        <div class="ov-circles">
          <div class="ov-circle">자기주도적인<br>사람</div>
          <div class="ov-circle">창의적인<br>사람</div>
          <div class="ov-circle">교양 있는<br>사람</div>
          <div class="ov-circle">더불어<br>사는 사람</div>
        </div>
      </div>
    </div>
    <div class="ov-arrow-row"><div class="ov-arrow-spacer"></div><div class="ov-arrow"></div></div>
    <div class="ov-row">
      <div class="ov-row-label"><span class="ov-row-sublabel">(총론)</span>핵심역량</div>
      <div class="ov-row-content">
        <div class="ov-hex-section">
          <div class="ov-hex-row">
            <div class="ov-hex dim">자기관리</div>
            <div class="ov-hex dim">심미적 감성</div>
          </div>
          <div class="ov-hex-row">
            <div class="ov-hex hi">지식정보처리</div>
            <div class="ov-hex hi">창의적 사고</div>
            <div class="ov-hex hi">협력적 소통</div>
            <div class="ov-hex hi">공동체 역량</div>
          </div>
        </div>
      </div>
    </div>
    <div class="ov-arrow-row"><div class="ov-arrow-spacer"></div><div class="ov-arrow"></div></div>
    <div class="ov-row">
      <div class="ov-row-label"><span class="ov-row-sublabel">정보</span>교과 역량</div>
      <div class="ov-row-content">
        <div class="ov-comp-row">
          <div class="ov-comp">
            <div class="ov-comp-title">컴퓨팅 사고력</div>
            <ul class="ov-comp-list">
              <li>추상화 능력</li>
              <li>자동화 능력</li>
              <li>창의·융합 능력</li>
            </ul>
          </div>
          <div class="ov-comp">
            <div class="ov-comp-title">디지털 문화 소양</div>
            <ul class="ov-comp-list">
              <li>디지털 의사소통·협업 능력</li>
              <li>디지털 윤리의식</li>
              <li>디지털 기술 활용 능력</li>
            </ul>
          </div>
          <div class="ov-comp">
            <div class="ov-comp-title">인공지능 소양</div>
            <ul class="ov-comp-list">
              <li>인공지능 문제 해결력</li>
              <li>데이터 문해력</li>
              <li>인공지능 윤리의식</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="ov-section">
    <div class="ov-sec-head"><span class="ov-sec-dot"></span><span class="ov-sec-title">교과 역량 연계</span></div>
    <div class="ov-table-box">
      <table class="ov-table">
        <thead><tr><th>교과 역량</th><th>역량 정의</th><th>총론 핵심역량 연계</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="comp-badge cbadge-teal">컴퓨팅 사고력</span></td>
            <td>컴퓨팅을 활용한 문제 해결을 전제로 문제를 발견·분석하여 실생활과 다양한 학문 분야의 문제를 해결하는 데 새로운 방법론을 제시할 수 있는 능력</td>
            <td>지식정보처리, 창의적 사고</td>
          </tr>
          <tr>
            <td><span class="comp-badge cbadge-blue">인공지능 소양</span></td>
            <td>인간과 인공지능의 공존을 모색하는 사람 중심의 인공지능 윤리의식과 데이터에 대한 이해를 기반으로 인공지능을 통해 문제를 해결할 수 있는 능력</td>
            <td>지식정보처리, 창의적 사고, 협력적 소통, 공동체 역량</td>
          </tr>
          <tr>
            <td><span class="comp-badge cbadge-purple">디지털 문화 소양</span></td>
            <td>디지털 사회의 구성원으로서의 윤리의식과 시민성을 갖추고 디지털 기술을 기반으로 의사 소통하고 협업하는 능력</td>
            <td>협력적 소통, 공동체 역량</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="ov-section">
    <div class="ov-sec-head"><span class="ov-sec-dot"></span><span class="ov-sec-title">중학교 정보</span></div>
    <div class="ov-table-box" style="padding:16px 20px;font-size:14px;line-height:1.85;color:var(--g700)">
      정보 교과의 영역은 '컴퓨팅 시스템', '데이터', '알고리즘과 프로그래밍', '인공지능', '디지털 문화'로, 5개의 영역은 교과의 핵심역량과 목표를 달성하기 위한 형태로 제시되었다. 초등학교 5~6학년 실과(정보)는 '디지털 사회와 인공지능' 영역으로 구성되었고, 중학교 정보와 연계성을 갖도록 하였다. '컴퓨팅 시스템'을 구성하는 기본적인 요소에 대한 이해와 인공지능의 기초가 되는 '데이터'에 대한 문해력 형성을 기반으로 '알고리즘과 프로그래밍', '인공지능'을 통해 문제를 해결하도록 한다. 그리고 이러한 전 과정에서 '디지털 문화'를 누리는 사회의 구성원으로서 갖추어야 할 지식⋅이해, 과정⋅기능, 가치⋅태도가 함양될 수 있도록 하였다.
    </div>
  </div>

  <div class="ov-section">
    <div class="ov-sec-head"><span class="ov-sec-dot"></span><span class="ov-sec-title">고등학교 과목별 구성</span></div>
    <div class="ov-table-box">
      <table class="ov-table">
        <thead><tr><th>구분</th><th>과목명</th><th>내용 구성 방향</th></tr></thead>
        <tbody>
          <tr>
            <td>일반 선택</td>
            <td>정보</td>
            <td>중학교 '정보'와 동일한 영역으로 구성하여 일관성을 유지하면서, 진로 선택 과목의 기초 공통이 되도록 내용을 구성</td>
          </tr>
          <tr>
            <td rowspan="3" style="vertical-align:middle">진로 선택</td>
            <td>인공지능 기초</td>
            <td>컴퓨터과학, 데이터 과학, 정보시스템 분야의 지식으로 구성하여 해당 진로와 연계</td>
          </tr>
          <tr>
            <td>데이터 과학</td>
            <td>컴퓨터과학, 데이터 과학 분야의 기초 지식으로 구성하여 해당 진로와 연계</td>
          </tr>
          <tr>
            <td>정보과학</td>
            <td>컴퓨터과학과 소프트웨어 공학 분야에 관한 지식으로 구성하여 해당 진로와 연계</td>
          </tr>
          <tr>
            <td>융합 선택</td>
            <td>소프트웨어와 생활</td>
            <td>다양한 학문 분야와의 융합을 통해 문제 해결을 경험할 수 있는 프로젝트 형태로 각 영역을 구성</td>
          </tr>
          <tr>
            <td>전문교과</td>
            <td>프로그래밍</td>
            <td>프로그래밍 언어, 기초 문법, 프로그램 설계와 구현 전 과정을 다루며 산업 현장과 연계된 실무 중심으로 구성</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="ov-note">각 과목은 하나의 학문적 뿌리에서 분야와 지식의 깊이를 달리하여 병렬적으로 연계되면서도 각 과목을 통해 추구하는 능력이나 목표 역량은 차별성을 두었다.</p>
  </div>
</div>`;
}

// --- Download collected ---
function downloadCollected() {
  if (!collected.length) return;
  const lines = [];
  SUBJECTS.filter(s => !['overview','evalplan'].includes(s.type)).forEach((subj, gi) => {
    const items = collected.filter(c => c.sid === subj.id);
    if (!items.length) return;
    if (lines.length) lines.push('');
    lines.push(`[${subj.name}]`);
    items.forEach(it => lines.push(`${it.code} ${it.text}`));
  });
  const blob = new Blob([lines.join('\n')], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href: url, download: '담은_성취기준.txt'});
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// --- Download TXT ---
function downloadTxt() {
  const s = S();
  const lines = [];
  s.domains.forEach((d, i) => {
    if (i > 0) lines.push('');
    lines.push(`[${d.name}]`);
    d.items.forEach(it => lines.push(`${it.code} ${it.text}`));
  });
  const blob = new Blob([lines.join('\n')], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${s.name.replace(/\s/g,'_')}_성취기준.txt`
  });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// --- Eval Plan ---
function evalSubjects() {
  return SUBJECTS.filter(s => !['overview','simulator','evalplan','wiki','textbook'].includes(s.type));
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
        `<span class="eval-badge">${esc(c)}<button class="eval-badge-rm" onclick="evalUnlinkCode(${i},'${c.replace(/'/g,"\\'")}')">×</button></span>`
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
            <button class="eval-toggle${evalState.semester===1?' active':''}" onclick="evalSetSemester(1)">1학기</button>
            <button class="eval-toggle${evalState.semester===2?' active':''}" onclick="evalSetSemester(2)">2학기</button>
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

function evalUpdateName(i, val) {
  evalState.items[i].name = val; evalSave(); evalShowSummary();
}

function evalUpdateRatio(i, val) {
  evalState.items[i].ratio = isNaN(val)?0:val; evalSave(); evalShowSummary();
}

function evalUpdateScoreChoice(i, val) {
  evalState.items[i].scoreChoice = isNaN(val)?0:Math.max(0,val);
  evalSave(); evalShowSummary();
}

function evalUpdateScoreEssay(i, val) {
  evalState.items[i].scoreEssay = isNaN(val)?0:Math.max(0,val);
  evalSave(); evalShowSummary();
}

function evalUpdatePeriod(i, val) {
  evalState.items[i].period = val; evalSave();
}

function evalToggleEssay(i, checked) {
  evalState.items[i].isEssay = checked;
  evalSave(); evalShowSummary();
}

function evalUnlinkCode(i, code) {
  evalState.items[i].linkedCodes = evalState.items[i].linkedCodes.filter(c=>c!==code);
  evalSave(); evalRerender();
}

function evalRerender() {
  if (S().type !== 'evalplan' || evalPlanSubtab !== 'eval') return;
  document.getElementById('main').innerHTML = renderEvalPlan();
  if (evalState.generated) evalShowSummary(); else evalHideSummary();
}

function evalOpenModal(i) {
  evalModalTargetIdx = i;
  evalModalTempSelected = new Set(evalState.items[i].linkedCodes);
  evalModalSubjectIdx = evalState.subjectIdx;
  evalRenderModalBody();
  document.getElementById('evalModal').style.display = 'flex';
}

function evalCloseModal() {
  document.getElementById('evalModal').style.display = 'none';
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

function evalUpdateElements(i, val) {
  evalState.items[i].elements = val; evalSave();
}

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
  document.getElementById('evalPreviewModal').style.display = 'flex';
}

function evalClosePreview() {
  document.getElementById('evalPreviewModal').style.display = 'none';
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
      return it.ratio+'%';
    }), '100%'].join('\t'),
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

// ─── 수업계획 ────────────────────────────────────────────────────────────────

function lpSelectSubtab(key) {
  evalPlanSubtab = key;
  renderTabs();
  render();
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

function lpSetStartMW(val) {
  lessonState.startMW = val.trim();
  lpSave();
}

function lpSetEndMW(val) {
  lessonState.endMW = val.trim();
  lpSave();
}

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

function lpUpdateMW(i, val) {
  lessonState.rows[i].monthWeek = val;
  lpSave();
}

function lpSetDomain(i, val) {
  lessonState.rows[i].domain = val;
  lessonState.rows[i].linkedCodes = [];
  lpSave(); lpRerender();
}

function lpSetMethod(i, val) {
  lessonState.rows[i].method = val;
  lpSave();
}
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
  document.getElementById('lessonModal').style.display = 'flex';
  const dom = lessonState.rows[rowIdx].domain;
  if (dom) {
    requestAnimationFrame(() => {
      const el = document.querySelector('#lpModalBody [data-domain="' + dom + '"]');
      if (el) el.scrollIntoView({block:'start', behavior:'smooth'});
    });
  }
}

function lpCloseModal() {
  document.getElementById('lessonModal').style.display = 'none';
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
  if (S().type !== 'evalplan' || evalPlanSubtab !== 'lesson') return;
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
    const rowBg = row.evalMethod === '수행평가' ? '#fffde7' : '';
    const codesHtml = row.linkedCodes.map(c =>
      `<span class="lp-code-badge" style="background:${aLight};color:${accent}">${esc(c)}<button class="lp-code-del" onclick="lpUnlinkCode(${i},'${c.replace(/'/g,"\\'")}')">×</button></span>`
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
            <button class="eval-toggle${lessonState.semester===1?' active':''}" onclick="lpSetSemester(1)">1학기</button>
            <button class="eval-toggle${lessonState.semester===2?' active':''}" onclick="lpSetSemester(2)">2학기</button>
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

/* ── 성취수준 모달 ── */
function openAchvModal(domainName, accent) {
  const data = ACHIEVEMENTS[domainName];
  if (!data || !data.length) return;

  const gradeColors = { A:'#16A34A', B:'#2563EB', C:'#7C3AED', D:'#D97706', E:'#DC2626' };

  let bodyHtml = '';
  data.forEach((std, si) => {
    bodyHtml += `<div class="achv-table-wrap">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="achv-table-code" style="color:${accent};margin-bottom:0">${esc(std.code)}</div>
      <button class="achv-copy-std" onclick="achvCopyStd(this,'${domainName.replace(/'/g,"\\'")}',${si})">복사</button>
    </div>
    <table class="achv-table">
      <tbody>`;
    ['A','B','C','D','E'].forEach(g => {
      const txt = std.levels[g] || '';
      bodyHtml += `<tr>
      <th style="color:${gradeColors[g]}">${g}</th>
      <td>${esc(txt)}</td>
    </tr>`;
    });
    bodyHtml += `</tbody></table></div>`;
  });

  let overlay = document.getElementById('achvOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'achv-overlay';
    overlay.id = 'achvOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeAchvModal(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="achv-modal">
      <div class="achv-modal-hd">
        <span class="achv-modal-title" style="color:${accent}">📊 ${esc(domainName)} — ABCDE 성취수준</span>
        <button class="cmp-close-btn" onclick="closeAchvModal()">✕</button>
      </div>
      <div style="font-size:12px;color:var(--g500);padding:8px 12px;background:var(--g50);border-radius:7px;margin-bottom:14px;line-height:1.6">
        💡 성취기준별 <strong>복사</strong> 또는 <strong>전체 복사</strong> 후 한글 표에 붙여넣기 (HTML 형식으로 복사됨)
      </div>
      <div class="achv-modal-body">${bodyHtml}</div>
      <div class="achv-modal-ft">
        <button class="achv-copy-all pri" id="achvCopyAllBtn" onclick="achvCopyAll('${domainName.replace(/'/g,"\\'")}')">전체 복사</button>
        <button class="achv-copy-all sec" onclick="closeAchvModal()">닫기</button>
        <span id="achvCopyMsg" style="font-size:12px;color:#10B981;display:none">✓ 복사됨</span>
      </div>
    </div>`;

  overlay.style.display = '';
}

function closeAchvModal() {
  const el = document.getElementById('achvOverlay');
  if (el) el.style.display = 'none';
}

function achvBuildHtml(rows) {
  return '<table><tbody>' +
    rows.map(({g, txt}) => `<tr><td>${g}</td><td>${txt}</td></tr>`).join('') +
    '</tbody></table>';
}

function achvBuildPlain(rows) {
  return rows.map(({g, txt}) => `${g}\t${txt}`).join('\n');
}

function achvClipWrite(html, plain, onDone) {
  navigator.clipboard.write([new ClipboardItem({
    'text/html':  new Blob([html],  {type:'text/html'}),
    'text/plain': new Blob([plain], {type:'text/plain'})
  })]).then(onDone).catch(() => alert('복사 실패'));
}

function achvCopyAll(domainName) {
  const data = ACHIEVEMENTS[domainName];
  if (!data) return;
  const rows = [];
  data.forEach(std => {
    ['A','B','C','D','E'].forEach(g => rows.push({g, txt: std.levels[g]||''}));
  });
  achvClipWrite(achvBuildHtml(rows), achvBuildPlain(rows), () => {
    const btn = document.getElementById('achvCopyAllBtn');
    const msg = document.getElementById('achvCopyMsg');
    if (btn) { btn.textContent = '✓ 복사됨'; }
    if (msg) { msg.style.display = 'inline'; }
    setTimeout(() => {
      if (btn) btn.textContent = '전체 복사';
      if (msg) msg.style.display = 'none';
    }, 1800);
  });
}

function achvCopyStd(btn, domainName, idx) {
  const std = ACHIEVEMENTS[domainName]?.[idx];
  if (!std) return;
  const rows = ['A','B','C','D','E'].map(g => ({g, txt: std.levels[g]||''}));
  achvClipWrite(achvBuildHtml(rows), achvBuildPlain(rows), () => {
    btn.textContent = '✓';
    btn.classList.add('ok');
    setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('ok'); }, 1500);
  });
}

// --- Init ---
document.getElementById('panelBody').addEventListener('click', e => {
  const btn = e.target.closest('.p-item-rm');
  if (btn) removeItem(btn.dataset.rm);
});
updateHeaderMode(); updateSearchVisibility(); renderTabs(); render(); updatePanel();
