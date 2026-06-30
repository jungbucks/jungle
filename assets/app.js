import { esc, safeUrl, hi, cid, announce, setAccent, trapFocus, releaseFocus, clipboardWriteText, loadState, getAchvKey, findTextByCode } from './utils.js';
import { HS_SUBTAB_ORDER, HS_SUBTAB_LABELS, HOME_CARD_META, HOME_CATEGORIES, NON_SUBJECT_TYPES, ALL_ITEMS, LP_SEM_DEFAULTS, CORE_ELEMENTS } from './state.js';
import { renderSimulator } from './simulator.js';
import { renderChasi } from './chasi.js';
import { renderEvalPlan, evalSubjects, evalHideSummary, evalShowSummary, evalPlanSubtab, evalState, setEvalPlanSubtab } from './evalplan.js';
import { renderLessonPlan } from './lessonplan.js';
import { renderRubric } from './rubric.js';
import { renderRegExam } from './regexam.js';
import { renderCodeVar } from './codevar.js';
import { renderTextbook } from './textbook.js';

// --- App State ---
let curIdx = 0;
let query = '';
let collected = (() => { try { return JSON.parse(localStorage.getItem('collected') || '[]'); } catch(e) { return []; } })();
let collapsed = new Set();
let panelOpen = false;
let domainFilter = null;
let homeMode = true;
let overviewSubtab = 'map';
let compareSubtab = 'standards';
let isDark = (() => { try { return localStorage.getItem('jungle_darkmode') === '1'; } catch(e) { return false; } })();
if (isDark) document.documentElement.setAttribute('data-theme', 'dark');

// --- Helpers ---
function S() { return SUBJECTS[curIdx]; }

// --- Domain filter ---
function renderDomainFilter() {  
  const s = S();  
  if (s.type === 'overview') return;  
  const chips = ['전체', ...s.domains.map(d => d.name)];  
  document.getElementById('domainFilter').innerHTML = chips.map(name => {    
    const isAll = name === '전체';    
    const active = isAll ? domainFilter === null : domainFilter === name;    
    const activeStyle = active ? `background:${s.accent};border-color:${s.accent};color:#fff` : '';    
    return `<button class="dchip${active?' active':''}" style="${activeStyle}" aria-pressed="${active}"
      onclick="setDomainFilter(${isAll ? 'null' : `'${name.replace(/'/g,"\\'")}'`})">${name}</button>`;  
  }).join('');
}
function setDomainFilter(name) {
  domainFilter = name;
  announce(name ? `${name} 필터` : '전체 성취기준');
  render();
}

// --- Mobile Nav ---
function toggleMobileNav() {  
  const open = document.getElementById('navDrawer').classList.toggle('open');  
  document.getElementById('navOverlay').classList.toggle('open', open);  
  document.getElementById('hamburger').classList.toggle('open', open);  
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeMobileNav() {  
  document.getElementById('navDrawer').classList.remove('open');  
  document.getElementById('navOverlay').classList.remove('open');  
  document.getElementById('hamburger').classList.remove('open');  
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e) {  
  if (e.key !== 'Escape') return;  
  const rubricModal = document.getElementById('rubricModal');  
  if (rubricModal && rubricModal.style.display !== 'none') { rubricCloseModal(); return; }  
  const lessonModal = document.getElementById('lessonModal');  
  if (lessonModal && lessonModal.style.display !== 'none') { lpCloseModal(); return; }  
  const evalModal = document.getElementById('evalModal');  
  if (evalModal && evalModal.style.display !== 'none') { evalCloseModal(); return; }  
  const evalPreviewModal = document.getElementById('evalPreviewModal');  
  if (evalPreviewModal && evalPreviewModal.style.display !== 'none') { evalClosePreview(); return; }  
  if (document.getElementById('navDrawer').classList.contains('open')) closeMobileNav();
});

// --- Tabs ---
function renderTabs() {  
  const idxOf = id => SUBJECTS.findIndex(s => s.id === id);  
  const isHS = !homeMode && HS_SUBTAB_ORDER.includes(curIdx);  
  const mainItems = [
    {type:'subject', idx:idxOf('overview')},
    {type:'hsgroup'},
    {type:'subject', idx:idxOf('evalplan')},
    {type:'subject', idx:idxOf('textbook')},
    {type:'subject', idx:idxOf('swrec')},
    {type:'subject', idx:idxOf('fav')},
    {type:'subject', idx:idxOf('appstore')},
  ];  
  const desktopItems = mainItems.map(item => {    
    if (item.type === 'subject') {      
      const s = SUBJECTS[item.idx];      
      const active = !homeMode && item.idx === curIdx;      
      const styleStr = active ? `color:${s.accent};border-bottom-color:${s.accent}` : '';      
      if (s.type === 'evalplan' || s.type === 'overview') {
        return `<button class="tab${active?' active':''}" data-text="${esc(s.name)} ▾" onclick="selectSubject(${item.idx})"
          style="${styleStr}" aria-current="${active ? 'page' : 'false'}">
          <span class="tab-inner">${esc(s.name)}<span style="font-size:10px;line-height:1">▾</span></span></button>`;
      }
      return `<button class="tab${active?' active':''}" data-text="${esc(s.name)}" onclick="selectSubject(${item.idx})"
        style="${styleStr}" aria-current="${active ? 'page' : 'false'}">
        ${s.name}</button>`;
    }
    const active = isHS;
    const accent = active ? SUBJECTS[curIdx].accent : '';
    return `<button class="tab${active?' active':''}" data-text="정보 성취기준 ▾" onclick="selectHSGroup()"
      style="${active?`color:${accent};border-bottom-color:${accent}`:''}" aria-current="${active ? 'page' : 'false'}">
      <span class="tab-inner">정보 성취기준<span style="font-size:10px;line-height:1">▾</span></span></button>`;  
  }).join('');  
  const darkBtn = `<button class="dark-toggle" onclick="toggleDarkMode()" aria-label="${isDark ? '라이트모드로 전환' : '다크모드로 전환'}">${isDark ? '☀️' : '🌙'} ${isDark ? '라이트' : '다크'}</button>`;
  document.getElementById('tabs').innerHTML = desktopItems + darkBtn;

  const mobileMenu = document.getElementById('mobileNavMenu');
  if (mobileMenu) {
    mobileMenu.innerHTML = mainItems.map(item => {      
      if (item.type === 'subject') {        
        const s = SUBJECTS[item.idx];        
        const active = !homeMode && item.idx === curIdx;        
        const sty = active ? `color:${s.accent};background:${s.aLight};border-left-color:${s.accent}` : '';        
        const label = (s.type === 'evalplan' || s.type === 'overview') ? `${esc(s.name)} ▾` : esc(s.name);        
        return `<button class="nav-drawer-item${active?' active':''}" style="${sty}" aria-current="${active ? 'page' : 'false'}" onclick="selectSubject(${item.idx});closeMobileNav()">${label}</button>`;
      }
      const active = isHS;
      const sty = active ? `color:${SUBJECTS[curIdx].accent};background:${SUBJECTS[curIdx].aLight};border-left-color:${SUBJECTS[curIdx].accent}` : '';
      return `<button class="nav-drawer-item${active?' active':''}" style="${sty}" aria-current="${active ? 'page' : 'false'}" onclick="selectHSGroup();closeMobileNav()">정보 성취기준 ▾</button>`;
    }).join('') + `<button class="nav-drawer-item" onclick="toggleDarkMode();closeMobileNav()" style="margin-top:4px;border-top:1px solid var(--g100)">${isDark ? '☀️ 라이트모드' : '🌙 다크모드'}</button>`;
  }
  
  const subtabBar = document.getElementById('subtabBar');  
  const isOverview = !homeMode && S().type === 'overview';  
  const isEvalPlan = !homeMode && S().type === 'evalplan';  
  if (isOverview) {    
    const ovAccent = S().accent;    
    document.getElementById('subtabBarInner').innerHTML = [      
      { key: 'map',       label: '교육과정 한눈에 보기' },
      { key: 'simulator', label: '고교학점제 시뮬레이터' },
      { key: 'compare',   label: '중·고 정보 교육과정 비교' },
      { key: 'guide',     label: '고등학교 선택과목 가이드' },
      { key: 'dsai',      label: '인공지능 기초 VS 데이터 과학' }
    ].map(({ key, label }) => {      
      const active = overviewSubtab === key;      
      return `<button class="subtab${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-text="${label}" onclick="overviewSelectSubtab('${key}')"
        style="${active ? `color:${ovAccent};border-bottom-color:${ovAccent}` : ''}">
        ${label}</button>`;
    }).join('');    
    subtabBar.classList.add('visible');  
  } else if (isHS) {    
    document.getElementById('subtabBarInner').innerHTML = HS_SUBTAB_ORDER.map((idx, i) => {      
      const s = SUBJECTS[idx];      
      const active = curIdx === idx;      
      return `<button class="subtab${active?' active':''}" role="tab" aria-selected="${active}" data-text="${esc(HS_SUBTAB_LABELS[i])}" onclick="selectSubject(${idx})"
        style="${active?`color:${s.accent};border-bottom-color:${s.accent}`:''}">
        ${HS_SUBTAB_LABELS[i]}</button>`;
    }).join('');    
    subtabBar.classList.add('visible');  
  } else if (isEvalPlan) {    
    const epAccent = S().accent;    
    document.getElementById('subtabBarInner').innerHTML = [      
      {key:'lesson',  label:'수업계획'},
      {key:'eval',    label:'평가계획'},
      {key:'rubric',  label:'수행평가 루브릭 설계'},
      {key:'regexam',   label:'정기시험 출제 계획'},
      {key:'chasi',   label:'차시 계산기'},
      {key:'codevar', label:'코드 변형 생성기'}
    ].map(({key, label}) => {      
      const active = evalPlanSubtab === key;      
      return `<button class="subtab${active?' active':''}" role="tab" aria-selected="${active}" data-text="${label}" onclick="lpSelectSubtab('${key}')"
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
  const hideSearch = !homeMode && NON_SUBJECT_TYPES.includes(t);
  const hideDomain = homeMode || NON_SUBJECT_TYPES.includes(t);  
  const ss = document.getElementById('searchSection');  
  ss.style.display = hideSearch ? 'none' : '';  
  ss.classList.toggle('home-mode', homeMode);  
  document.getElementById('searchInput').placeholder = '';  
  document.getElementById('domainFilter').style.display = hideDomain ? 'none' : '';  
  document.getElementById('jungleImg').style.display = homeMode ? '' : 'none';
}

// --- Dark Mode ---
function toggleDarkMode() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  try { localStorage.setItem('jungle_darkmode', isDark ? '1' : '0'); } catch(e) {}
  renderTabs();
}

// --- URL Hash State ---
function hashEncode() {
  if (homeMode) return '#home';
  const id = SUBJECTS[curIdx] ? SUBJECTS[curIdx].id : 'home';
  if (id === 'overview') return '#overview:' + overviewSubtab;
  if (id === 'evalplan') return '#evalplan:' + evalPlanSubtab;
  return '#' + id;
}

function hashDecode(hash) {
  if (!hash || hash === '#' || hash === '#home') { homeMode = true; return; }
  const raw = hash.slice(1);
  const [base, sub] = raw.split(':');
  const idx = SUBJECTS.findIndex(s => s.id === base);
  if (idx < 0) { homeMode = true; return; }
  homeMode = false;
  curIdx = idx;
  if (base === 'overview' && sub) overviewSubtab = sub;
  if (base === 'evalplan' && sub) setEvalPlanSubtab(sub);
}

function pushHash() {
  const h = hashEncode();
  if (location.hash !== h) history.replaceState(null, '', h);
}

window.addEventListener('popstate', () => {
  hashDecode(location.hash);
  renderTabs(); updateSearchVisibility(); render();
});

function goHome() {
  homeMode = true;
  query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  announce('홈');
  pushHash();
  renderTabs(); updateSearchVisibility(); render();
}

function onHomeSearch(val) {
  query = val.trim();
  if (!query) return;
  homeMode = false; curIdx = 1; domainFilter = null;
  document.getElementById('searchInput').value = query;
  document.getElementById('searchClear').classList.add('on');
  renderTabs(); updateSearchVisibility(); render();
}

function selectSubjectFromHome(idx) { selectSubject(idx); }

function goToSimulator() {
  homeMode = false;
  curIdx = SUBJECTS.findIndex(s => s.id === 'overview');
  overviewSubtab = 'simulator';
  query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  try { localStorage.setItem('jungle_last_used', 'simulator'); } catch(e) {}
  pushHash();
  renderTabs(); updateSearchVisibility(); render();
}

function selectSubject(i) {
  homeMode = false;
  curIdx = i; query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  try { localStorage.setItem('jungle_last_used', SUBJECTS[i].id); } catch(e) {}
  announce(SUBJECTS[i].name);
  pushHash();
  renderTabs(); updateSearchVisibility(); render();
}

// --- Search ---
let _searchTimer = null;
document.getElementById('searchInput').addEventListener('input', e => {  
  query = e.target.value.trim();  
  domainFilter = null;  
  document.getElementById('searchClear').classList.toggle('on', query.length > 0);  
  if (homeMode && query) {
    homeMode = false; curIdx = 1;
    renderTabs(); updateSearchVisibility();    
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
  const el = document.getElementById('d_' + cid(key));
  if (!el) return;
  el.classList.toggle('collapsed');
  const btn = el.querySelector('.domain-header');
  if (btn) btn.setAttribute('aria-expanded', collapsed.has(key) ? 'false' : 'true');
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
          <button type="button" class="domain-header" data-key="${esc(key)}" onclick="toggleDomain(this.dataset.key)" aria-expanded="${col?'false':'true'}" aria-controls="d_body_${cid(key)}">
            <div class="domain-left">
              <span class="domain-dot" style="background:${subj.accent}"></span>
              <span class="domain-name">${esc(d.name)}</span>
              <span class="domain-cnt">${d.items.length}개</span>
            </div>
            ${(() => {
              const achvKey = getAchvKey(subj.id, d.name);
              return ACHIEVEMENTS[achvKey]
                ? `<span class="achv-btn" role="button" tabindex="0" onclick="event.stopPropagation();openAchvModal('${achvKey.replace(/'/g,"\\'")}','${subj.accent}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();openAchvModal('${achvKey.replace(/'/g,"\\'")}','${subj.accent}')}">ABCDE 성취수준</span>`
                : '';
            })()}
            <span class="domain-copy-btn" role="button" tabindex="0" onclick="event.stopPropagation();copyDomain('d_${cid(key)}',this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();copyDomain('d_${cid(key)}',this)}">단원 모두 복사</span>
          </button>
          <div class="domain-body" id="d_body_${cid(key)}">`;        
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


function renderHome() {
  let lastUsedId = '';
  try { lastUsedId = localStorage.getItem('jungle_last_used') || ''; } catch(e) {}

  function makeCard(id) {
    const idx = SUBJECTS.findIndex(s => s.id === id);
    if (idx < 0) return '';
    const s = SUBJECTS[idx];
    const meta = HOME_CARD_META[id] || { label:'', desc:'' };
    const tagsHtml = meta.tags
      ? `<div class="bento-card-tags">${meta.tags.map(t => `<span class="bento-card-tag">${esc(t)}</span>`).join('')}</div>`
      : '';
    const recentBadge = lastUsedId === id
      ? `<span class="bento-card-recent">최근 사용</span>`
      : '';
    const clickFn = id === 'simulator' ? 'goToSimulator()' : `selectSubjectFromHome(${idx})`;
    return `<button class="bento-card" onclick="${clickFn}" aria-label="${esc(s.name)}: ${esc(meta.desc)}">
      <div class="bento-card-stripe" style="background:${s.accent}"></div>
      <div class="bento-card-body">
        <div class="bento-card-label-row">
          <div class="bento-card-label" style="color:${s.accent}">${esc(meta.label)}</div>
          ${recentBadge}
        </div>
        <div class="bento-card-name">${esc(s.name)}</div>
        <div class="bento-card-desc">${esc(meta.desc)}</div>
        ${tagsHtml}
      </div>
    </button>`;
  }
  return `<div class="bento-wrap">${HOME_CATEGORIES.map(cat =>
    `<div class="bento-section">
      <h2 class="bento-section-label">${esc(cat.label)}</h2>
      <div class="bento-grid${cat.gridClass ? ' ' + cat.gridClass : ''}">${cat.ids.map(makeCard).join('')}</div>
    </div>`
  ).join('')}</div>`;
}

// --- Render ---
function render() {
  evalHideSummary();
  if (homeMode) { document.getElementById('main').innerHTML = renderHome(); return; }
  const s = S();
  if (s.type === 'overview') {
    if (overviewSubtab === 'simulator') {
      document.getElementById('main').innerHTML = renderSimulator();
    } else if (overviewSubtab === 'dsai') {
      document.getElementById('main').innerHTML = renderDsAiCompare();
      dacInit();
    } else {
      document.getElementById('main').innerHTML = overviewSubtab === 'compare' ? renderCompare() : overviewSubtab === 'guide' ? renderSubjectGuide() : renderOverview();
    }
    return;
  }
  if (s.type === 'fav')       { document.getElementById('main').innerHTML = renderFav(); return; }
  if (s.type === 'swrec')      { document.getElementById('main').innerHTML = renderSWRec(); return; }
  if (s.type === 'textbook')   { document.getElementById('main').innerHTML = renderTextbook(); return; }
  if (s.type === 'appstore')   { document.getElementById('main').innerHTML = renderAppStore(); return; }
  if (s.type === 'chasi')      { document.getElementById('main').innerHTML = renderChasi(); return; }
  if (s.type === 'evalplan') {
    if (evalPlanSubtab === 'eval') {
      document.getElementById('main').innerHTML = renderEvalPlan();
      if (evalState.generated) evalShowSummary();
    } else if (evalPlanSubtab === 'rubric') {
      document.getElementById('main').innerHTML = renderRubric();
    } else if (evalPlanSubtab === 'chasi') {
      document.getElementById('main').innerHTML = renderChasi();
    } else if (evalPlanSubtab === 'regexam') {
      document.getElementById('main').innerHTML = renderRegExam();
    } else if (evalPlanSubtab === 'codevar') {
      document.getElementById('main').innerHTML = renderCodeVar();
    } else {
      document.getElementById('main').innerHTML = renderLessonPlan();
    }
    return;
  }
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
        <button type="button" class="domain-header" data-key="${esc(key)}" onclick="toggleDomain(this.dataset.key)" aria-expanded="${col?'false':'true'}" aria-controls="d_body_${cid(key)}">
          <div class="domain-left">
            <span class="domain-dot" style="background:${s.accent}"></span>
            <span class="domain-name">${esc(d.name)}</span>
            <span class="domain-cnt">${d.items.length}개</span>
          </div>
          ${(() => {
            const achvKey = getAchvKey(s.id, d.name);
            return ACHIEVEMENTS[achvKey]
              ? `<span class="achv-btn" role="button" tabindex="0" onclick="event.stopPropagation();openAchvModal('${achvKey.replace(/'/g,"\\'")}','${s.accent}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();openAchvModal('${achvKey.replace(/'/g,"\\'")}','${s.accent}')}">ABCDE 성취수준</span>`
              : '';
          })()}
          <span class="domain-copy-btn" role="button" tabindex="0" onclick="event.stopPropagation();copyDomain('d_${cid(key)}',this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();copyDomain('d_${cid(key)}',this)}">단원 모두 복사</span>
        </button>
        <div class="domain-body" id="d_body_${cid(key)}">`;
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
          </div>        </div>`;      
      });      
      html += `</div></div>`;    
    });  
  }  
  document.getElementById('main').innerHTML = html;
}

// --- Copy ---
function copyDomain(sectionId, el) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const cards = section.querySelectorAll('.card-chk');
  if (!cards.length) return;
  const text = Array.from(cards).map(c => c.dataset.code + ' ' + c.dataset.text).join('\n');
  clipboardWriteText(text);
  const orig = el.textContent;
  el.textContent = '복사됨!'; el.classList.add('ok');
  setTimeout(() => { el.textContent = orig; el.classList.remove('ok'); }, 1400);
}

function doCopy(btn) {  
  const text = btn.dataset.mode === 'code'    
    ? btn.dataset.code    
    : btn.dataset.code + ' ' + btn.dataset.text;  
  clipboardWriteText(text);  
  const orig = btn.textContent;  
  btn.textContent = '복사됨!'; btn.classList.add('ok'); announce('복사됨');  
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
  clipboardWriteText(text);  
  btn.textContent = '복사됨!';  
  setTimeout(() => btn.textContent = '전체 복사', 1400);
}

function togglePanel() {
  panelOpen = !panelOpen;
  const panel = document.getElementById('collectPanel');
  panel.classList.toggle('open', panelOpen);
  panel.setAttribute('aria-hidden', !panelOpen);
  document.getElementById('fab').setAttribute('aria-expanded', panelOpen);
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
      <button class="p-item-rm" data-rm="${esc(c.code)}" aria-label="${esc(c.code)} 삭제">×</button>
    </div>`;  
  }).join('');
}


// --- App Store ---
function renderAppStore() {
  const TYPE_META = {
    webapp:    { label: '웹앱',       color: '#7C3AED', bg: '#F5F3FF' },
    extension: { label: '확장프로그램', color: '#0891B2', bg: '#ECFEFF' },
    desktop:   { label: '데스크탑앱',  color: '#059669', bg: '#ECFDF5' },
    mobile:    { label: '모바일앱',    color: '#D97706', bg: '#FFFBEB' },
    other:     { label: '기타',        color: '#6B7280', bg: '#F3F4F6' },
  };

  const header = `<div class="astore-header">
    <div class="astore-header-inner">
      <div class="astore-logo">🏪</div>
      <div>
        <div class="astore-title">정보교사 앱스토어</div>
        <div class="astore-subtitle">정보 선생님들이 직접 만든 웹앱·프로그램 모음</div>
      </div>
    </div>
  </div>`;

  let body;
  if (!APPSTORE_APPS.length) {
    body = `<div class="astore-empty">
      <div class="astore-empty-icon">📭</div>
      <div class="astore-empty-title">아직 등록된 앱이 없습니다</div>
      <div class="astore-empty-desc">정보 선생님이 만든 웹앱이나 프로그램을<br>이곳에 소개해드릴 예정입니다.</div>
    </div>`;
  } else {
    const cards = APPSTORE_APPS.map(app => {
      const tm = TYPE_META[app.type] || TYPE_META.other;
      const thumbHtml = app.thumb
        ? `<img class="astore-thumb" src="${app.thumb}" alt="${esc(app.name)}" loading="lazy">`
        : `<div class="astore-thumb-placeholder"><span style="font-size:36px">📦</span></div>`;
      const authorHtml = app.authorUrl
        ? `<a class="astore-card-author" href="${safeUrl(app.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(app.author)}</a>`
        : `<span class="astore-card-author">${esc(app.author)}</span>`;
      const tags = (app.tags || []).map(t =>
        `<span class="astore-tag">${esc(t)}</span>`).join('');
      return `<div class="astore-card">
        ${thumbHtml}
        <div class="astore-card-body">
          <div class="astore-card-name-row">
            <div class="astore-card-name">${esc(app.name)}</div>
            <span class="astore-type-badge" style="background:${tm.bg};color:${tm.color}">${tm.label}</span>
          </div>
          <div class="astore-card-meta">제작자: ${authorHtml}</div>
          <div class="astore-card-desc">${esc(app.desc)}</div>
          ${tags ? `<div class="astore-card-tags">${tags}</div>` : ''}
          <div class="astore-card-footer">
            <a class="astore-card-btn" href="${safeUrl(app.url)}" target="_blank" rel="noopener noreferrer">열기 →</a>
          </div>
        </div>
      </div>`;
    }).join('');
    body = `<div class="astore-grid">${cards}</div>`;
  }

  const submit = `<div class="astore-submit">
    <div class="astore-submit-icon">📬</div>
    <div class="astore-submit-text">
      <div class="astore-submit-title">앱 등록 신청</div>
      <div class="astore-submit-desc">직접 만든 웹앱이나 프로그램을 이곳에 소개하고 싶으신가요?<br>아래 채널로 문의해 주세요.</div>
    </div>
    <div class="astore-submit-links">
      <a class="astore-submit-btn" href="https://www.instagram.com/jungbucks" target="_blank" rel="noopener">Instagram @jungbucks</a>
      <a class="astore-submit-btn" href="http://blog.naver.com/kachu_t" target="_blank" rel="noopener">네이버 블로그</a>
    </div>
  </div>`;

  return `<div class="astore-wrap">${header}${body}${submit}</div>`;
}

// --- Overview ---
function renderFav() {  
  const cats = RECOMMENDED_SITES.map(cat => {    
    const cards = cat.items.map(site => `      
      <a class="fav-card" href="${safeUrl(site.url)}" target="_blank" rel="noopener noreferrer">
        <div class="fav-card-name">${esc(site.name)}</div>
        <div class="fav-card-url">${esc(site.url.replace(/^https?:\/\//,''))}</div>
        <div class="fav-card-desc">${esc(site.desc)}</div>
      </a>`).join('');    
    return `<div class="fav-category">      
      <div class="fav-cat-title">${cat.category}</div>      
      <div class="fav-grid">${cards}</div>    
    </div>`;  
  }).join('');  
  return `<div class="fav-wrap">
    <div class="astore-header">
      <div class="astore-header-inner">
        <div class="astore-logo" style="font-size:24px">🌐</div>
        <div>
          <div class="astore-title">추천 사이트 모음</div>
          <div class="astore-subtitle">정보 선생님들이 알면 좋은 사이트 모음ZIP</div>
        </div>
      </div>
    </div>
    ${cats}</div>`;
}

function renderSWRec() {  
  const osSections = [    
    { key:'windows', label:'🖥️ Windows' },    
    { key:'mac',     label:'🍎 Mac' },    
    { key:'ipad',    label:'📱 iPad' },  
  ];  
  const sections = osSections.map(os => {    
    const items = SW_DATA[os.key] || [];    
    if (!items.length) return '';    
    const cards = items.map(sw => {      
      const freeBadge = sw.free        
        ? `<span class="sw-badge sw-badge-free">무료</span>`        
        : `<span class="sw-badge sw-badge-paid">유료</span>`;      
      const catBadge = `<span class="sw-badge sw-badge-cat">${esc(sw.category)}</span>`;      
      const urlBtn = sw.url ? `<a class="sw-btn" href="${safeUrl(sw.url)}" target="_blank" rel="noopener noreferrer">공식 사이트</a>` : '';
      const blogBtn = sw.blogUrl ? `<a class="sw-btn sw-btn-blog" href="${safeUrl(sw.blogUrl)}" target="_blank" rel="noopener noreferrer">블로그에서 자세히 보기</a>` : '';
      const btns = (urlBtn || blogBtn) ? `<div class="sw-card-btns">${urlBtn}${blogBtn}</div>` : '';      
      return `<div class="fav-card sw-card">        
        <div class="sw-card-top">          
          <span class="sw-card-name">${esc(sw.name)}</span>          
          <div class="sw-badges">${catBadge}${freeBadge}</div>        
        </div>        
        <div class="fav-card-desc">${esc(sw.desc)}</div>        
        ${btns}      
      </div>`;    
    }).join('');    
    return `<div class="fav-category">      
      <div class="fav-cat-title">${os.label}</div>      
      <div class="fav-grid sw-grid">${cards}</div>    
    </div>`;  
  }).join('');  
  return `<div class="fav-wrap">
    <div class="astore-header">
      <div class="astore-header-inner">
        <div class="astore-logo" style="font-size:24px">🖥️</div>
        <div>
          <div class="astore-title">추천 소프트웨어</div>
          <div class="astore-subtitle">정보 선생님들이 써보고 직접 추천하는 다양한 업무, 수업용 소프트웨어</div>
        </div>
      </div>
    </div>
    ${sections}</div>`;
}

function overviewSelectSubtab(key) {
  overviewSubtab = key;
  const OV_LABELS = { map:'교육과정 한눈에 보기', simulator:'고교학점제 시뮬레이터', compare:'중·고 정보 교육과정 비교', guide:'고등학교 선택과목 가이드', dsai:'인공지능 기초 VS 데이터 과학' };
  announce(OV_LABELS[key] || key);
  pushHash();
  renderTabs();
  render();
}

function compareSelectSubtab(key) {  
  compareSubtab = key;  
  render();
}

function dacInit() {
  const root = document.getElementById('ds-ai-compare');
  if (!root) return;
  root.querySelectorAll('.dac-head').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const item = btn.closest('.dac-item');
      const opening = !item.classList.contains('open');
      item.classList.toggle('open');
      btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    });
  });
}

function renderDsAiCompare() {
  return `<div id="ds-ai-compare">
  <header>
    <span class="dac-eyebrow">선택과목 비교</span>
    <h2 class="dac-h2" style="font-size:clamp(24px,4vw,32px);">데이터 과학 vs 인공지능 기초</h2>
    <p class="dac-sub">두 과목은 닮았지만 향하는 곳이 다릅니다. 무엇이 같고 무엇이 다른지 한눈에 비교했습니다.</p>
  </header>

  <section class="dac-block" style="margin-top:24px;">
    <div class="dac-defs">
      <div class="dac-def is-ds">
        <div class="tag"><span class="dot dot-ds"></span>데이터 과학</div>
        <div class="line">데이터로 세상을 읽는 법</div>
      </div>
      <div class="dac-def is-ai">
        <div class="tag"><span class="dot dot-ai"></span>인공지능 기초</div>
        <div class="line">데이터로 기계를 가르치는 법</div>
      </div>
    </div>
  </section>

  <section class="dac-block">
    <span class="dac-eyebrow">핵심 차이</span>
    <h3 class="dac-h2">관점별 비교</h3>
    <p class="dac-sub">같은 데이터를 다루지만 목적과 결과물이 다릅니다.</p>
    <div class="dac-table">
      <div class="dac-trow head">
        <div class="dac-th metric">관점</div>
        <div class="dac-th ds-col"><span class="dot dot-ds"></span>데이터 과학</div>
        <div class="dac-th"><span class="dot dot-ai"></span>인공지능 기초</div>
      </div>
      <div class="dac-trow">
        <div class="dac-tc metric">중심 질문</div>
        <div class="dac-tc ds" data-label="데이터 과학">데이터에서 의미를 찾는다</div>
        <div class="dac-tc ai" data-label="인공지능 기초">데이터로 모델을 학습시킨다</div>
      </div>
      <div class="dac-trow">
        <div class="dac-tc metric">수학 비중</div>
        <div class="dac-tc ds" data-label="데이터 과학">통계·회귀 중심</div>
        <div class="dac-tc ai" data-label="인공지능 기초">기계학습·신경망 중심</div>
      </div>
      <div class="dac-trow">
        <div class="dac-tc metric">결과물</div>
        <div class="dac-tc ds" data-label="데이터 과학">분석 보고서·시각화</div>
        <div class="dac-tc ai" data-label="인공지능 기초">동작하는 AI 모델</div>
      </div>
      <div class="dac-trow">
        <div class="dac-tc metric">코딩 비중</div>
        <div class="dac-tc ds" data-label="데이터 과학">분석 도구 활용</div>
        <div class="dac-tc ai" data-label="인공지능 기초">학습·구현 직접 수행</div>
      </div>
    </div>
  </section>

  <section class="dac-block">
    <span class="dac-eyebrow">성취기준 비교</span>
    <h3 class="dac-h2">교육과정 기준으로 본 차이</h3>
    <p class="dac-sub">항목을 눌러 각 과목의 성취기준과 목적 차이를 확인하세요.</p>
    <div class="dac-acc">
      <div class="dac-item">
        <button class="dac-head" type="button" aria-expanded="false">
          <span class="dac-num">①</span>
          <span class="dac-title">데이터 처리</span>
          <svg class="dac-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="dac-panel"><div class="dac-panel-inner"><div class="dac-body">
          <div class="dac-pair">
            <div class="dac-card is-ds">
              <div class="who"><span class="dot dot-ds"></span>데이터 과학</div>
              <div class="desc"><span class="dac-code">12데과02-02</span>이상치·결측치·정규화 → 데이터 품질 확보 목적</div>
            </div>
            <div class="dac-card is-ai">
              <div class="who"><span class="dot dot-ai"></span>인공지능 기초</div>
              <div class="desc"><span class="dac-code">12인기02-02</span>동일 개념 → 기계학습 투입 준비 목적</div>
            </div>
          </div>
          <div class="dac-summary"><span class="lbl">한 줄 요약</span>같은 개념, 다른 목적</div>
        </div></div></div>
      </div>
      <div class="dac-item">
        <button class="dac-head" type="button" aria-expanded="false">
          <span class="dac-num">②</span>
          <span class="dac-title">데이터 수집</span>
          <svg class="dac-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="dac-panel"><div class="dac-panel-inner"><div class="dac-body">
          <div class="dac-pair">
            <div class="dac-card is-ds">
              <div class="who"><span class="dot dot-ds"></span>데이터 과학</div>
              <div class="desc"><span class="dac-code">12데과02-01</span>편향 방지에 집중</div>
            </div>
            <div class="dac-card is-ai">
              <div class="who"><span class="dot dot-ai"></span>인공지능 기초</div>
              <div class="desc"><span class="dac-code">12인기02-01</span>기계학습에 적합한 데이터 선정에 집중</div>
            </div>
          </div>
          <div class="dac-summary"><span class="lbl">한 줄 요약</span>데이터 과학이 수집 단계를 더 깊이 다룸</div>
        </div></div></div>
      </div>
      <div class="dac-item">
        <button class="dac-head" type="button" aria-expanded="false">
          <span class="dac-num">③</span>
          <span class="dac-title">분석·모델링</span>
          <svg class="dac-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="dac-panel"><div class="dac-panel-inner"><div class="dac-body">
          <div class="dac-pair">
            <div class="dac-card is-ds">
              <div class="who"><span class="dot dot-ds"></span>데이터 과학</div>
              <div class="desc"><span class="dac-code">12데과03</span>통계 모델 vs 기계학습 모델 비교·해석</div>
            </div>
            <div class="dac-card is-ai">
              <div class="who"><span class="dot dot-ai"></span>인공지능 기초</div>
              <div class="desc"><span class="dac-code">12인기02-03~04</span>모델 선정 후 직접 학습·성능 평가</div>
            </div>
          </div>
          <div class="dac-summary"><span class="lbl">한 줄 요약</span>데이터 과학은 이해, 인공지능 기초는 구현</div>
        </div></div></div>
      </div>
      <div class="dac-item">
        <button class="dac-head" type="button" aria-expanded="false">
          <span class="dac-num">④</span>
          <span class="dac-title">AI 심화 <span style="font-weight:600;color:var(--g500);font-size:13px;">· 인공지능 기초 고유 영역</span></span>
          <svg class="dac-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="dac-panel"><div class="dac-panel-inner"><div class="dac-body">
          <div class="dac-pair">
            <div class="dac-card is-ai">
              <div class="who"><span class="dot dot-ai"></span>인공지능 기초</div>
              <div class="desc"><span class="dac-code">12인기01</span>탐색·지식표현·추론 (전통적 AI)</div>
            </div>
            <div class="dac-card is-ai">
              <div class="who"><span class="dot dot-ai"></span>인공지능 기초</div>
              <div class="desc"><span class="dac-code">12인기02-05~06</span>딥러닝·컴퓨터비전·음성인식·자연어처리</div>
            </div>
          </div>
          <div class="dac-summary"><span class="lbl">한 줄 요약</span>데이터 과학은 딥러닝을 다루지 않음</div>
        </div></div></div>
      </div>
      <div class="dac-item">
        <button class="dac-head" type="button" aria-expanded="false">
          <span class="dac-num">⑤</span>
          <span class="dac-title">윤리</span>
          <svg class="dac-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="dac-panel"><div class="dac-panel-inner"><div class="dac-body">
          <div class="dac-pair">
            <div class="dac-card is-ds">
              <div class="who"><span class="dot dot-ds"></span>데이터 과학</div>
              <div class="desc"><span class="dac-code">12데과04-05</span>데이터 활용 결과의 윤리</div>
            </div>
            <div class="dac-card is-ai">
              <div class="who"><span class="dot dot-ai"></span>인공지능 기초</div>
              <div class="desc"><span class="dac-code">12인기03-04</span>AI 존재 자체의 윤리적 딜레마</div>
            </div>
          </div>
          <div class="dac-summary"><span class="lbl">한 줄 요약</span>둘 다 윤리를 다루지만 결이 다름</div>
        </div></div></div>
      </div>
    </div>
  </section>

  <section class="dac-block">
    <span class="dac-eyebrow">수강 권장 흐름</span>
    <h3 class="dac-h2">이 순서를 추천합니다</h3>
    <p class="dac-sub">기초 → 분석 → 구현으로 이어지는 자연스러운 흐름입니다.</p>
    <div class="dac-flow">
      <div class="dac-step">
        <div class="order">STEP 1</div>
        <div class="name">고등학교 정보</div>
      </div>
      <div class="dac-arrow">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </div>
      <div class="dac-step hl">
        <div class="order">STEP 2 · 선행</div>
        <div class="name">데이터 과학</div>
      </div>
      <div class="dac-arrow">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </div>
      <div class="dac-step hl">
        <div class="order">STEP 3</div>
        <div class="name">인공지능 기초</div>
      </div>
    </div>
    <div class="dac-flow-note">
      <strong>데이터 과학이 선행인 이유 —</strong> 데이터 과학의 전처리·정규화 개념이 인공지능 기초의 학습 데이터 준비로 직결됩니다.
    </div>
  </section>

  <section class="dac-block">
    <span class="dac-eyebrow">학생 유형</span>
    <h3 class="dac-h2">나에게 맞는 과목은?</h3>
    <p class="dac-sub">관심사와 강점에 따라 어떤 과목이 잘 맞는지 확인해 보세요.</p>
    <div class="dac-types">
      <div class="dac-type is-ds">
        <div class="dac-ico">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <div class="t-name">데이터 과학이 맞는 학생</div>
        <div class="t-desc">수학·통계를 좋아하고 데이터를 분석·해석하는 데 흥미가 있는 학생.</div>
      </div>
      <div class="dac-type is-ai">
        <div class="dac-ico">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"></rect><path d="M12 8V5a2 2 0 1 0-2 2"></path><line x1="9" y1="14" x2="9" y2="14"></line><line x1="15" y1="14" x2="15" y2="14"></line></svg>
        </div>
        <div class="t-name">인공지능 기초가 맞는 학생</div>
        <div class="t-desc">AI를 직접 만들어보고 싶은 학생. 코딩 경험이 있으면 더 유리합니다.</div>
      </div>
      <div class="dac-together">
        <div class="dac-ico">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div>
          <div class="t-name">함께 수강하면</div>
          <div class="t-desc">데이터 준비 → 모델 학습까지, AI 파이프라인 전체를 직접 경험할 수 있습니다.</div>
        </div>
      </div>
    </div>
  </section>
</div>`;
}

function renderSubjectGuide() {
  const cards = [
    { level:'입문', score:2.0, pct:40, color:'#74a4ec', bg:'#f1f6ff', border:'#e0eafc', name:'고등학교 정보', desc:'정보의 기초 개념과 디지털 소양을 다루는 입문 과목으로 부담이 적습니다.' },
    { level:'입문', score:2.0, pct:40, color:'#6b86e8', bg:'#eef2ff', border:'#dde3fb', name:'소프트웨어와 생활', desc:'일상 속 소프트웨어 활용 중심의 교양형 과목으로 진입 장벽이 낮습니다.' },
    { level:'기초', score:2.5, pct:50, color:'#7a6ae6', bg:'#efedff', border:'#e0dcfb', name:'프로그래밍', desc:'기본 코딩 문법과 알고리즘 입문을 배우며 실습 비중이 늘어납니다.' },
    { level:'중급', score:3.0, pct:60, color:'#9a55d8', bg:'#f4ecfd', border:'#e8dcf8', name:'데이터 과학', desc:'데이터 수집·분석·시각화를 다루며 통계적 사고와 도구 활용이 필요합니다.' },
    { level:'고급', score:4.0, pct:80, color:'#c0399f', bg:'#f9eaf6', border:'#f1d8ee', name:'인공지능 기초', desc:'AI 원리와 머신러닝 개념을 배우며 수학적·논리적 이해가 요구됩니다.' },
    { level:'최고난도', score:5.0, pct:100, color:'#d61e54', bg:'#fce7ec', border:'#f7cdd7', name:'정보과학', desc:'고난도 알고리즘과 자료구조를 깊이 다루며 탄탄한 프로그래밍 실력이 필수입니다.' },
  ];
  const steps = [
    { step:1, color:'#74a4ec', bg:'#f1f6ff', label:'고등학교 정보' },
    { step:2, color:'#7a6ae6', bg:'#eef0ff', label:'소프트웨어와 생활 · 프로그래밍' },
    { step:3, color:'#9a55d8', bg:'#f4ecfd', label:'데이터 과학' },
    { step:4, color:'#c0399f', bg:'#f9eaf6', label:'인공지능 기초' },
    { step:5, color:'#d61e54', bg:'#fce7ec', label:'정보과학' },
  ];
  const cardsHtml = cards.map(c => `
    <div class="sguide-card" style="background:${c.bg};border-color:${c.border};border-top-color:${c.color}">
      <div class="sguide-card-top">
        <span class="sguide-level" style="color:${c.color}">${c.level}</span>
        <span class="sguide-score-badge" style="color:${c.color};background:${c.border}">난이도 ${c.score.toFixed(1)}</span>
      </div>
      <h3 class="sguide-card-name">${c.name}</h3>
      <div class="sguide-stars">
        <div class="sguide-stars-bg">★★★★★
          <div class="sguide-stars-fill" style="color:${c.color};width:${c.pct}%">★★★★★</div>
        </div>
        <span class="sguide-stars-num" style="color:${c.color}">${c.score.toFixed(1)}</span>
      </div>
      <p class="sguide-card-desc">${c.desc}</p>
    </div>`).join('');
  const stepsHtml = steps.map((s, i) => `
    <div class="sguide-step-item">
      <div class="sguide-step-box" style="background:${s.bg};border-color:${s.color}">
        <div class="sguide-step-label" style="color:${s.color}">STEP ${s.step}</div>
        <div class="sguide-step-name">${s.label}</div>
      </div>
      ${i < steps.length - 1 ? '<div class="sguide-step-arrow">→</div>' : ''}
    </div>`).join('');
  return `<div class="sguide-wrap" style="--dac-accent:#2563EB;--dac-soft:#EFF6FF">
    <header>
      <span class="dac-eyebrow">선택과목 가이드</span>
      <h2 class="dac-h2" style="font-size:clamp(24px,4vw,32px);">고등학교 선택과목 가이드</h2>
      <p class="dac-sub">6개 과목의 성취기준 분석을 통한 (주관적) 난이도 순 정리 · 색이 진할수록 난이도 높음</p>
    </header>
    <div class="sguide-grid">${cardsHtml}</div>
    <div class="sguide-flow-section">
      <span class="dac-eyebrow">수강 순서</span>
      <h2 class="dac-h2">수강 권장 순서</h2>
      <p class="dac-sub" style="margin-bottom:20px">선생님 학교 사정 및 교육관, 학생 수요에 따라 얼마든지 달라질 수 있습니다. <span style="color:var(--g400)">(단순 참고용, 정해진 룰 아님)</span></p>
      <div class="sguide-steps">${stepsHtml}</div>
    </div>
  </div>`;
}

function renderCompare() {
  const mid  = SUBJECTS.find(s => s.id === 'middle');  
  const high = SUBJECTS.find(s => s.id === 'high');  
  const TOGGLE_BTNS = [    
    { key: 'standards', label: '성취기준별 비교' },    
    { key: 'elements',  label: '핵심요소별 비교' }  
  ];  
  const toggleHtml = `<div class="cmp-toggle">    
    ${TOGGLE_BTNS.map(({ key, label }) => `      
      <button class="cmp-toggle-btn${compareSubtab === key ? ' active' : ''}"        
        onclick="compareSelectSubtab('${key}')">${label}</button>`).join('')}  
  </div>`;  
  if (compareSubtab === 'standards') {    
    const domains = mid.domains.map(d => d.name);    
    let body = '';    
    domains.forEach(domainName => {      
      const mItems = (mid.domains.find(d => d.name === domainName) || { items: [] }).items;      
      const hItems = (high.domains.find(d => d.name === domainName) || { items: [] }).items;      
      body += `<div class="cmp-domain-block">        
        <div class="cmp-domain-title">          
          <span class="cmp-domain-dot"></span>${esc(domainName)}        
        </div>        
        <div class="cmp-cols">          
          <div class="cmp-col" style="border-top:3px solid ${mid.accent}">            
            <div class="cmp-col-hd" style="background:${mid.aLight};color:${mid.aDark}">              
              중학교 정보              
              <span class="cmp-col-cnt" style="background:${mid.accent}">총 ${mItems.length}개</span>            
            </div>            
            <div class="cmp-col-body">              
              ${mItems.length ? mItems.map(it => `                
                <div class="cmp-std-item">                  
                  <span class="code-badge" style="background:${mid.aLight};color:${mid.accent};flex-shrink:0">${esc(it.code)}</span>                  
                  <span class="cmp-std-text">${esc(it.text)}</span>                
                </div>`).join('') : `<div class="cmp-empty">해당 없음</div>`}            
            </div>          
          </div>          
          <div class="cmp-col" style="border-top:3px solid ${high.accent}">            
            <div class="cmp-col-hd" style="background:${high.aLight};color:${high.aDark}">              
              고등학교 정보              
              <span class="cmp-col-cnt" style="background:${high.accent}">총 ${hItems.length}개</span>            
            </div>            
            <div class="cmp-col-body">              
              ${hItems.length ? hItems.map(it => `                
                <div class="cmp-std-item">                  
                  <span class="code-badge" style="background:${high.aLight};color:${high.accent};flex-shrink:0">${esc(it.code)}</span>                  
                  <span class="cmp-std-text">${esc(it.text)}</span>                
                </div>`).join('') : `<div class="cmp-empty">해당 없음</div>`}            
            </div>          
          </div>        
        </div>      </div>`;    
    });    
    return `<div class="cmp-wrap">${toggleHtml}${body}</div>`;  
  }  
  // 핵심요소별 (CORE_ELEMENTS는 파일 상단 상수 참조)
  const elemItem = (e, accent) =>
    `<div class="cmp-elem-item"><span class="cmp-elem-dot" style="background:${accent}"></span>${esc(e)}</div>`;
  let body = '';
  CORE_ELEMENTS.forEach(({ domain, mid: mElems, high: hElems }) => {
    body += `<div class="cmp-domain-block">
      <div class="cmp-domain-title"><span class="cmp-domain-dot"></span>${esc(domain)}</div>
      <div class="cmp-cols">
        <div class="cmp-col" style="border-top:3px solid ${mid.accent}">
          <div class="cmp-col-hd" style="background:${mid.aLight};color:${mid.aDark}">
            중학교 정보 <span class="cmp-col-cnt" style="background:${mid.accent}">${mElems.length}개</span>
          </div>
          <div class="cmp-col-body">${mElems.map(e => elemItem(e, mid.accent)).join('')}</div>
        </div>
        <div class="cmp-col" style="border-top:3px solid ${high.accent}">
          <div class="cmp-col-hd" style="background:${high.aLight};color:${high.aDark}">
            고등학교 정보 <span class="cmp-col-cnt" style="background:${high.accent}">${hElems.length}개</span>
          </div>
          <div class="cmp-col-body">${hElems.map(e => elemItem(e, high.accent)).join('')}</div>
        </div>
      </div>
    </div>`;
  });
  return `<div class="cmp-wrap">${toggleHtml}${body}</div>`;
}

function renderOverview() {  
  return `<div class="ov-wrap">  
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
        <thead><tr><th style="width:76px">구분</th><th style="width:160px">과목명</th><th>내용 구성 방향</th></tr></thead>        
        <tbody>          
          <tr>            
            <td class="ov-cat-cell">일반선택</td>            
            <td><span class="ov-subj-badge" style="background:#ECFDF5;border-left-color:#10B981">정보</span></td>            
            <td>중학교 '정보'와 동일한 영역으로 구성하여 일관성을 유지하면서, 진로선택 과목의 기초 공통이 되도록 내용을 구성</td>          
          </tr>          
          <tr>            
            <td rowspan="3" class="ov-cat-cell" style="vertical-align:middle">진로선택</td>            
            <td><span class="ov-subj-badge" style="background:#F5F3FF;border-left-color:#8B5CF6">인공지능 기초</span></td>            
            <td>컴퓨터과학, 데이터 과학, 정보시스템 분야의 지식으로 구성하여 해당 진로와 연계</td>          
          </tr>          
          <tr>            
            <td><span class="ov-subj-badge" style="background:#FFFBEB;border-left-color:#F59E0B">데이터 과학</span></td>            
            <td>컴퓨터과학, 데이터 과학 분야의 기초 지식으로 구성하여 해당 진로와 연계</td>          
          </tr>          
          <tr>            
            <td><span class="ov-subj-badge" style="background:#F0F9FF;border-left-color:#0EA5E9">정보과학</span></td>            
            <td>컴퓨터과학과 소프트웨어 공학 분야에 관한 지식으로 구성하여 해당 진로와 연계</td>          
          </tr>          
          <tr>            
            <td class="ov-cat-cell">융합선택</td>            
            <td><span class="ov-subj-badge" style="background:#FDF2F8;border-left-color:#EC4899">소프트웨어와 생활</span></td>            
            <td>다양한 학문 분야와의 융합을 통해 문제 해결을 경험할 수 있는 프로젝트 형태로 각 영역을 구성</td>          
          </tr>          
          <tr>            
            <td class="ov-cat-cell">전문교과</td>            
            <td><span class="ov-subj-badge" style="background:#FFF7ED;border-left-color:#F97316">프로그래밍</span></td>            
            <td>프로그래밍 언어, 기초 문법, 프로그램 설계와 구현 전 과정을 다루며 산업 현장과 연계된 실무 중심으로 구성</td>          
          </tr>        
        </tbody>      
      </table>    
    </div>    
    <p class="ov-note">각 과목은 하나의 학문적 뿌리에서 분야와 지식의 깊이를 달리하여 병렬적으로 연계되면서도 각 과목을 통해 추구하는 능력이나 목표 역량은 차별성을 두었다.</p>  
  </div></div>`;
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
    <div class="achv-modal" role="dialog" aria-modal="true" aria-labelledby="achvModalTitle">
      <div class="achv-modal-hd">
        <span class="achv-modal-title" id="achvModalTitle" style="color:${accent}">📊 ${esc(domainName)} — ABCDE 성취수준</span>
        <button class="cmp-close-btn" onclick="closeAchvModal()" aria-label="닫기">✕</button>
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
  trapFocus(overlay.querySelector('.achv-modal'));
}
function closeAchvModal() {
  const el = document.getElementById('achvOverlay');
  if (el) { releaseFocus(el.querySelector('.achv-modal')); el.style.display = 'none'; }
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

// 검색창 타자 애니메이션
(function() {
  const INTRO = '성취기준 코드나 키워드를 입력하세요';
  const EXAMPLES = [
    '알고리즘', '클래스와 인스턴스', '9정03', '12인기', '머신러닝',
    '정렬', '데이터 구조화', '피지컬 컴퓨팅', '12데과', '인공지능',
    '네트워크', '빅데이터', '디지털 윤리'
  ];
  const input = document.getElementById('searchInput');
  let phase = 'intro', qi = 0, ci = 0, typing = true, timer = null;

  function tick() {
    if (!homeMode || document.activeElement === input) {
      timer = setTimeout(tick, 300); return;
    }
    if (phase === 'intro') {
      ci++;
      input.placeholder = INTRO.slice(0, ci) + '|';
      if (ci >= INTRO.length) {
        phase = 'pause';
        timer = setTimeout(tick, 2000);
      } else {
        timer = setTimeout(tick, 55);
      }
      return;
    }
    if (phase === 'pause') {
      phase = 'erase_intro';
      timer = setTimeout(tick, 50);
      return;
    }
    if (phase === 'erase_intro') {
      ci--;
      input.placeholder = ci > 0 ? INTRO.slice(0, ci) + '|' : '';
      if (ci <= 0) { phase = 'examples'; qi = 0; typing = true; timer = setTimeout(tick, 500); }
      else timer = setTimeout(tick, 30);
      return;
    }
    // examples 단계
    const q = EXAMPLES[qi];
    if (typing) {
      ci++;
      input.placeholder = q.slice(0, ci) + '|';
      if (ci >= q.length) { typing = false; timer = setTimeout(tick, 1200); }
      else timer = setTimeout(tick, 90);
    } else {
      ci--;
      input.placeholder = ci > 0 ? q.slice(0, ci) + '|' : '';
      if (ci <= 0) {
        typing = true;
        qi = (qi + 1) % EXAMPLES.length;
        timer = setTimeout(tick, 500);
      } else timer = setTimeout(tick, 40);
    }
  }

  timer = setTimeout(tick, 800);
  input.addEventListener('focus', () => {
    clearTimeout(timer);
    input.placeholder = '';
  });
  input.addEventListener('blur', () => {
    if (homeMode) { phase = 'examples'; ci = 0; typing = true; timer = setTimeout(tick, 800); }
  });
}());

// --- Window registrations (for onclick handlers in dynamically generated HTML) ---
window.render = render;
window.renderTabs = renderTabs;
window.pushHash = pushHash;
window.toggleDarkMode = toggleDarkMode;
window.goHome = goHome;
window.goToSimulator = goToSimulator;
window.selectSubject = selectSubject;
window.selectSubjectFromHome = selectSubjectFromHome;
window.onHomeSearch = onHomeSearch;
window.clearSearch = clearSearch;
window.setDomainFilter = setDomainFilter;
window.toggleDomain = toggleDomain;
window.togglePanel = togglePanel;
window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;
window.copyDomain = copyDomain;
window.doCopy = doCopy;
window.copyAll = copyAll;
window.clearCollect = clearCollect;
window.downloadCollected = downloadCollected;
window.downloadTxt = downloadTxt;
window.onCheck = onCheck;
window.removeItem = removeItem;
window.overviewSelectSubtab = overviewSelectSubtab;
window.compareSelectSubtab = compareSelectSubtab;
window.openAchvModal = openAchvModal;
window.closeAchvModal = closeAchvModal;
window.achvCopyAll = achvCopyAll;
window.achvCopyStd = achvCopyStd;
window.selectHSGroup = selectHSGroup;

// --- Init ---
if (location.hash && location.hash !== '#home') {
  hashDecode(location.hash);
}
renderTabs();
updateSearchVisibility();
render();
updatePanel();