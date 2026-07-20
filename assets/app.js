import { esc, safeUrl, hi, cid, announce, setAccent, resetAccent, initDelegation, registerActions, clipboardWriteText, getAchvKey, findTextByCode } from './utils.js';
import { HS_SUBTAB_ORDER, HS_SUBTAB_LABELS, NON_SUBJECT_TYPES, ALL_ITEMS, LP_SEM_DEFAULTS, HOME_CARD_META } from './state.js';
import { renderSimulator } from './simulator.js';
import { renderChasi } from './chasi.js';
import { renderEvalPlan, evalSubjects, evalHideSummary, evalShowSummary, evalPlanSubtab, evalState, setEvalPlanSubtab } from './evalplan.js';
import { renderLessonPlan } from './lessonplan.js';
import { renderRubric } from './rubric.js';
import { renderRegExam } from './regexam.js';
import { renderCodeVar } from './codevar.js';
import { renderGradeCalc } from './gradecalc.js';
import { renderAiIdea } from './aiidea.js';
import { renderTextbook } from './textbook.js';
import { renderAppStore } from './appstore.js';
import { renderFav, renderSWRec } from './resources.js';
import { dacInit, renderDsAiCompare, renderSubjectGuide, renderCompare, renderOverview } from './overview.js';
import { openAchvModal, closeAchvModal, achvCopyAll, achvCopyStd, openSemesterAchvPicker } from './achv.js';
import { renderHome } from './home.js';
import { collected, updatePanel, togglePanel, clearCollect, copyAll, downloadCollected } from './collect.js';
import { backupExport, backupImport } from './backup.js';
import { initTypedPlaceholder } from './searchfx.js';

// --- App State ---
let curIdx = 0;
let query = '';
let collapsed = new Set();
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
      data-onclick="app:domainFilter" data-args="${esc(JSON.stringify([isAll ? null : name]))}">${name}</button>`;
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
  const stdPickerModal = document.getElementById('stdPickerModal');
  if (stdPickerModal && stdPickerModal.style.display !== 'none') { stdPickerClose(); return; }
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
        return `<button class="tab${active?' active':''}" data-text="${esc(s.name)} ▾" data-onclick="app:subject" data-args="[${item.idx}]"
          style="${styleStr}" aria-current="${active ? 'page' : 'false'}">
          <span class="tab-inner">${esc(s.name)}<span style="font-size:10px;line-height:1">▾</span></span></button>`;
      }
      return `<button class="tab${active?' active':''}" data-text="${esc(s.name)}" data-onclick="app:subject" data-args="[${item.idx}]"
        style="${styleStr}" aria-current="${active ? 'page' : 'false'}">
        ${s.name}</button>`;
    }
    const active = isHS;
    const accent = active ? SUBJECTS[curIdx].accent : '';
    return `<button class="tab${active?' active':''}" data-text="성취기준 ▾" data-onclick="app:hsGroup"
      style="${active?`color:${accent};border-bottom-color:${accent}`:''}" aria-current="${active ? 'page' : 'false'}">
      <span class="tab-inner">성취기준<span style="font-size:10px;line-height:1">▾</span></span></button>`;
  }).join('');  
  const suggestBtn = `<button class="tab tab-suggest" data-onclick="app:suggest" aria-label="건의사항 남기기">💬 건의사항</button>`;
  document.getElementById('tabs').innerHTML = desktopItems + suggestBtn;

  const mobileMenu = document.getElementById('mobileNavMenu');
  if (mobileMenu) {
    mobileMenu.innerHTML = mainItems.map(item => {
      if (item.type === 'subject') {
        const s = SUBJECTS[item.idx];
        const active = !homeMode && item.idx === curIdx;
        const sty = active ? `color:${s.accent};background:${s.aLight};border-left-color:${s.accent}` : '';
        const label = (s.type === 'evalplan' || s.type === 'overview') ? `${esc(s.name)} ▾` : esc(s.name);
        return `<button class="nav-drawer-item${active?' active':''}" style="${sty}" aria-current="${active ? 'page' : 'false'}" data-onclick="app:subjectNav" data-args="[${item.idx}]">${label}</button>`;
      }
      const active = isHS;
      const sty = active ? `color:${SUBJECTS[curIdx].accent};background:${SUBJECTS[curIdx].aLight};border-left-color:${SUBJECTS[curIdx].accent}` : '';
      return `<button class="nav-drawer-item${active?' active':''}" style="${sty}" aria-current="${active ? 'page' : 'false'}" data-onclick="app:hsGroupNav">성취기준 ▾</button>`;
    }).join('') + `<button class="nav-drawer-item" data-onclick="app:suggest" style="margin-top:4px;border-top:1px solid var(--g100);color:var(--plan);font-weight:600">💬 건의사항</button>`;
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
      return `<button class="subtab${active ? ' active' : ''}" role="tab" aria-selected="${active}" data-text="${label}" data-onclick="app:ovSubtabSel" data-onkeydown="app:subtabKey" data-args="${esc(JSON.stringify([key]))}"
        style="${active ? `color:${ovAccent};border-bottom-color:${ovAccent}` : ''}">
        ${label}</button>`;
    }).join('');    
    subtabBar.classList.add('visible');  
  } else if (isHS) {    
    document.getElementById('subtabBarInner').innerHTML = HS_SUBTAB_ORDER.map((idx, i) => {      
      const s = SUBJECTS[idx];      
      const active = curIdx === idx;      
      return `<button class="subtab${active?' active':''}" role="tab" aria-selected="${active}" data-text="${esc(HS_SUBTAB_LABELS[i])}" data-onclick="app:subject" data-onkeydown="app:subtabKey" data-args="[${idx}]"
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
      {key:'grade',   label:'내신 5등급제 성적 산출기'},
      {key:'chasi',   label:'차시 계산기'},
      {key:'codevar', label:'코드 변형 생성기'},
      {key:'aiidea',  label:'AI 수업 아이디어'}
    ].map(({key, label}) => {      
      const active = evalPlanSubtab === key;      
      return `<button class="subtab${active?' active':''}" role="tab" aria-selected="${active}" data-text="${label}" data-onclick="app:epSubtab" data-onkeydown="app:subtabKey" data-args="${esc(JSON.stringify([key]))}"
        style="${active ? `color:${epAccent};border-bottom-color:${epAccent}` : ''}">
        ${label}</button>`;
    }).join('');    
    subtabBar.classList.add('visible');  
  } else {
    subtabBar.classList.remove('visible');
    document.getElementById('subtabBarInner').innerHTML = '';
  }
  // 모바일 가로 스크롤에서 활성 서브탭이 화면 밖일 수 있음(해시 직링크 진입 등) — 중앙으로
  const actSub = subtabBar.querySelector ? subtabBar.querySelector('.subtab.active') : null;
  if (actSub && actSub.scrollIntoView) actSub.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function selectHSGroup() {
  // homeMode 체크 필수: 홈에서 누르면 curIdx가 이전 HS 과목을 가리키고 있어도 다시 진입해야 함
  if (homeMode || !HS_SUBTAB_ORDER.includes(curIdx) || query)
    selectSubject(HS_SUBTAB_ORDER.includes(curIdx) ? curIdx : HS_SUBTAB_ORDER[0]);
}

function updateSearchVisibility() {  
  const t = S().type;  
  const hideSearch = !homeMode && NON_SUBJECT_TYPES.includes(t);
  const hideDomain = homeMode || NON_SUBJECT_TYPES.includes(t);  
  const ss = document.getElementById('searchSection');  
  ss.style.display = hideSearch ? 'none' : '';  
  ss.classList.toggle('home-mode', homeMode);  
  document.getElementById('searchInput').placeholder = '성취기준 검색 (예: 알고리즘, 12정01-01)';
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
  renderTabs(); updateSearchVisibility(); renderWithFade();
});

function goHome() {
  homeMode = true;
  query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  announce('홈');
  pushHash();
  renderTabs(); updateSearchVisibility(); renderWithFade();
}

function onHomeSearch(val) {
  query = val.trim();
  if (!query) return;
  homeMode = false; curIdx = 1; domainFilter = null;
  document.getElementById('searchInput').value = query;
  document.getElementById('searchClear').classList.add('on');
  renderTabs(); updateSearchVisibility(); renderWithFade();
}

function goToOverviewSubtab(key) {
  homeMode = false;
  curIdx = SUBJECTS.findIndex(s => s.id === 'overview');
  overviewSubtab = key;
  pushHash();
  renderTabs(); updateSearchVisibility(); renderWithFade();
}

function goToSimulator() {
  homeMode = false;
  curIdx = SUBJECTS.findIndex(s => s.id === 'overview');
  overviewSubtab = 'simulator';
  query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  try { localStorage.setItem('jungle_last_used', 'simulator'); } catch(e) {}
  pushHash();
  renderTabs(); updateSearchVisibility(); renderWithFade();
}

function selectSubject(i) {
  homeMode = false;
  curIdx = i; query = ''; domainFilter = null; collapsed.clear();
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('on');
  try { localStorage.setItem('jungle_last_used', SUBJECTS[i].id); } catch(e) {}
  announce(SUBJECTS[i].name);
  pushHash();
  renderTabs(); updateSearchVisibility(); renderWithFade();
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

// --- Empty state ---
function noResHtml(q) {
  const msgs = [
    { icon:'🤔', main:'성취기준이 이 키워드를 성취하지 못했습니다', sub:'검색어를 줄이거나 다른 키워드로 바꿔 보세요' },
    { icon:'😅', main:`"${esc(q)}"는 교육과정에 아직 편입 신청을 안 한 것 같아요`, sub:'비슷한 단어나 성취기준 코드로 찾아 보세요' },
    { icon:'🏫', main:'교육부도 처음 들어본 키워드인 것 같습니다', sub:'혹시 교과서 용어라면 다른 말로 검색해 보세요' },
    { icon:'✍️', main:'이 키워드로 새 교육과정을 만드실 계획인가요?', sub:'아직은 없으니 다른 검색어를 써 보세요' },
    { icon:'📋', main:'전국 성취기준을 다 뒤졌는데 없어요', sub:'철자를 확인하거나 핵심 단어만 입력해 보세요' },
  ];
  const idx = [...q].reduce((a, c) => a + c.charCodeAt(0), 0) % msgs.length;
  const { icon, main, sub } = msgs[idx];
  return `<div class="no-res"><div class="no-res-icon">${icon}</div><div class="no-res-text">${main}</div><div class="no-res-sub">${sub}</div></div>`;
}

// --- Shared markup: domain section + standard card (render / renderGlobalSearch 공용) ---
function stdCardHtml(subj, it, collectedSet) {
  const isCol = collectedSet.has(it.code);
  return `<div class="std-card">
    <input type="checkbox" class="card-chk" data-code="${esc(it.code)}" data-text="${esc(it.text)}" data-sid="${subj.id}"
      ${isCol?'checked':''} data-onchange="app:check" style="accent-color:${subj.accent}">
    <div class="card-body">
      <span class="code-badge" style="background:${subj.aLight};color:${subj.accent}">${hi(it.code,query)}</span>
      <div class="std-text">${hi(it.text,query)}</div>
    </div>
    <div class="card-btns">
      <button class="cbtn sm" data-code="${esc(it.code)}" data-text="" data-mode="code"
        style="--accent:${subj.accent};--alight:${subj.aLight};--adark:${subj.aDark}" data-onclick="app:copy">코드만</button>
      <button class="cbtn" data-code="${esc(it.code)}" data-text="${esc(it.text)}" data-mode="full"
        style="--accent:${subj.accent}" data-onclick="app:copy">복사</button>
    </div>
  </div>`;
}

function domainSectionHtml(subj, d, collectedSet) {
  const key = subj.id + '||' + d.name;
  const col = collapsed.has(key);
  const achvKey = getAchvKey(subj.id, d.name);
  const achvArgs = esc(JSON.stringify([achvKey, subj.accent]));
  const achvBtn = ACHIEVEMENTS[achvKey]
    ? `<span class="achv-btn" role="button" tabindex="0" data-onclick="app:achv" data-onkeydown="app:achv" data-args="${achvArgs}">ABCDE 성취수준</span>`
    : '';
  return `<div class="domain-section${col?' collapsed':''}" id="d_${cid(key)}">
    <button type="button" class="domain-header" data-key="${esc(key)}" data-onclick="app:toggleDomain" aria-expanded="${col?'false':'true'}" aria-controls="d_body_${cid(key)}">
      <div class="domain-left">
        <span class="domain-dot" style="background:${subj.accent}"></span>
        <span class="domain-name">${esc(d.name)}</span>
        <span class="domain-cnt">${d.items.length}개</span>
      </div>
      ${achvBtn}
      <span class="domain-copy-btn" role="button" tabindex="0" data-onclick="app:copyDomain" data-onkeydown="app:copyDomain" data-args="${esc(JSON.stringify(['d_' + cid(key)]))}">단원 모두 복사</span>
    </button>
    <div class="domain-body" id="d_body_${cid(key)}">${d.items.map(it => stdCardHtml(subj, it, collectedSet)).join('')}</div>
  </div>`;
}

// --- Global search ---
function renderGlobalSearch() {
  document.getElementById('domainFilter').innerHTML = '';
  const q = query.toLowerCase();
  const collectedSet = new Set(collected.map(c => c.code));
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
    html += noResHtml(query);
  } else {
    results.forEach(({subj, domains}) => {
      html += `<div style="display:flex;align-items:center;gap:8px;margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid ${subj.aLight}">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${subj.accent};flex-shrink:0"></span>
        <span style="font-size:14px;font-weight:700;color:${subj.accent}">${esc(subj.name)}</span>
        <span style="font-size:12px;color:var(--g400)">${esc(subj.level)}</span>
      </div>`;
      domains.forEach(d => { html += domainSectionHtml(subj, d, collectedSet); });
    });
  }
  document.getElementById('main').innerHTML = html;
}


function focusSearch() {
  const el = document.getElementById('searchInput');
  if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

// 🎲 "랜덤 성취기준" — 무작위 성취기준으로 점프
function luckyJump() {
  const codes = [];
  SUBJECTS.forEach(s => { if (Array.isArray(s.domains)) s.domains.forEach(d => d.items.forEach(it => codes.push(it.code))); });
  if (!codes.length) return;
  const code = codes[Math.floor(Math.random() * codes.length)];
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = code;
  announce(`랜덤 성취기준: ${code}`);
  onHomeSearch(code);
}

// 홈 렌더·온보딩 배너: home.js로 분리 (2026-07-08 F2)

// --- Render ---
function renderWithFade() {
  const el = document.getElementById('main');
  el.classList.remove('page-enter');
  void el.offsetWidth;
  render();
  el.classList.add('page-enter');
  window.scrollTo(0, 0); // 페이지 전환은 항상 최상단부터 (모든 내비게이션이 이 함수를 지나감)
}

function render() {
  evalHideSummary();
  resetAccent(); // 과목 페이지의 accent 오버라이드 복원 — 과목 목록 렌더 시에만 setAccent로 다시 칠함
  if (homeMode) { document.getElementById('main').innerHTML = renderHome(); return; }
  const s = S();
  if (s.type === 'overview') {
    if (overviewSubtab === 'simulator') {
      document.getElementById('main').innerHTML = renderSimulator();
    } else if (overviewSubtab === 'dsai') {
      document.getElementById('main').innerHTML = renderDsAiCompare();
      dacInit();
    } else {
      document.getElementById('main').innerHTML = overviewSubtab === 'compare' ? renderCompare(compareSubtab) : overviewSubtab === 'guide' ? renderSubjectGuide() : renderOverview();
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
    } else if (evalPlanSubtab === 'grade') {
      document.getElementById('main').innerHTML = renderGradeCalc();
    } else if (evalPlanSubtab === 'codevar') {
      document.getElementById('main').innerHTML = renderCodeVar();
    } else if (evalPlanSubtab === 'aiidea') {
      document.getElementById('main').innerHTML = renderAiIdea();
    } else {
      document.getElementById('main').innerHTML = renderLessonPlan();
    }
    return;
  }
  if (query) { renderGlobalSearch(); return; }
  setAccent(s);
  renderDomainFilter();
  const q = query.toLowerCase();
  const collectedSet = new Set(collected.map(c => c.code));
  let totalAll = 0, totalVis = 0;  
  const filtered = s.domains.map(d => {    
    const domainMatch = domainFilter === null || d.name === domainFilter;    
    if (domainMatch) totalAll += d.items.length;    
    if (!domainMatch) return {...d, items: []};    
    const items = d.items.filter(it => !q || it.code.toLowerCase().includes(q) || it.text.toLowerCase().includes(q));    
    totalVis += items.length;    
    return {...d, items};  
  }).filter(d => d.items.length > 0);  
  const hasAchv = s.domains.some(d => ACHIEVEMENTS[getAchvKey(s.id, d.name)]);
  let html = `<div class="subject-meta">
    <span class="level-badge" style="background:${s.aLight};color:${s.accent}">${s.level}</span>
    <span class="count-info">${(q||domainFilter)?`<strong>${totalVis}</strong> / ${totalAll}개 성취기준`:`총 <strong>${totalAll}</strong>개 성취기준`}</span>
    <span class="meta-actions">
      ${hasAchv ? `<button class="dl-btn" data-onclick="app:semAchv" data-args="${esc(JSON.stringify([s.id, s.accent]))}">📊 학기 단위 성취수준</button>` : ''}
      <button class="dl-btn" data-onclick="app:downloadTxt">⬇ 전체 저장 (.txt)</button>
    </span>
  </div>`;
  if (!filtered.length) {
    html += noResHtml(query || domainFilter || '');
  } else {
    filtered.forEach(d => { html += domainSectionHtml(s, d, collectedSet); });  
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
  btn.style.background = 'var(--ok)'; btn.style.borderColor = 'var(--ok)'; btn.style.color = '#fff';  
  setTimeout(() => {    
    btn.textContent = orig; btn.classList.remove('ok');    
    btn.style.background = btn.style.borderColor = btn.style.color = '';  
  }, 1400);
}

// --- Collect: collect.js로 분리 (2026-07-08 F2) — collected는 라이브 바인딩 import ---


function overviewSelectSubtab(key) {
  overviewSubtab = key;
  const OV_LABELS = { map:'교육과정 한눈에 보기', simulator:'고교학점제 시뮬레이터', compare:'중·고 정보 교육과정 비교', guide:'고등학교 선택과목 가이드', dsai:'인공지능 기초 VS 데이터 과학' };
  announce(OV_LABELS[key] || key);
  pushHash();
  renderTabs();
  renderWithFade();
}

function compareSelectSubtab(key) {  
  compareSubtab = key;  
  render();
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


// 검색창 타자 애니메이션 — searchfx.js로 분리 (homeMode는 isIdle 콜백으로 주입)
initTypedPlaceholder(document.getElementById('searchInput'), () => homeMode);

// --- Window registrations (for onclick handlers in dynamically generated HTML) ---
function lpSelectSubtab(key) {
  setEvalPlanSubtab(key);
  pushHash();
  renderTabs();
  renderWithFade();
}

function openSuggest() {
  window.open('https://naver.me/50BcPxbO', '_blank', 'noopener,noreferrer');
}
// 크로스 모듈 참조 (overview.js의 비교 토글 액션이 순환 import 회피를 위해 window 경유) — 유지
window.compareSelectSubtab = compareSelectSubtab;

// ── 이벤트 위임 등록 (동적 템플릿 인라인 핸들러 대체) ──
registerActions('click', {
  'app:domainFilter':   function(el, e, name) { setDomainFilter(name); },
  'app:subject':        function(el, e, idx) { selectSubject(idx); },
  'app:subjectNav':     function(el, e, idx) { selectSubject(idx); closeMobileNav(); },
  'app:hsGroup':        function() { selectHSGroup(); },
  'app:hsGroupNav':     function() { selectHSGroup(); closeMobileNav(); },
  'app:suggest':        function() { openSuggest(); },
  'app:ovSubtabSel':    function(el, e, key) { overviewSelectSubtab(key); },
  'app:ovSubtab':       function(el, e, key) { goToOverviewSubtab(key); },
  'app:epSubtab':       function(el, e, key) { lpSelectSubtab(key); },
  'app:copy':           function(el) { doCopy(el); },
  'app:toggleDomain':   function(el) { toggleDomain(el.dataset.key); },
  'app:copyDomain':     function(el, e, secId) { copyDomain(secId, el); },
  'app:achv':           function(el, e, key, accent) { openAchvModal(key, accent); },
  'app:semAchv':        function(el, e, subjId, accent) { openSemesterAchvPicker(subjId, accent); },
  'app:focusSearch':    function() { focusSearch(); },
  'app:lucky':          function() { luckyJump(); },
  'app:downloadTxt':    function() { downloadTxt(); },
});
registerActions('keydown', {
  'app:achv':       function(el, e, key, accent) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAchvModal(key, accent); } },
  'app:copyDomain': function(el, e, secId) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyDomain(secId, el); } },
  // role="tablist" 키보드 규약: 좌우 화살표로 서브탭 이동 (data-args는 무시)
  'app:subtabKey':  function(el, e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const tabs = Array.from(el.parentElement.querySelectorAll('.subtab'));
    const i = tabs.indexOf(el);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    if (!next) return;
    next.click(); // 클릭이 renderTabs를 다시 돌려 DOM이 교체됨 → 새 활성 탭에 포커스 복원
    const fresh = document.querySelector('#subtabBarInner .subtab.active');
    if (fresh) fresh.focus();
  },
});
// 체크박스(app:check)는 collect.js가, 백업/복원은 backup.js가 담당 (2026-07-08 F2)

// --- 정적 요소 이벤트 바인딩 (index.html 인라인 핸들러 대체 — CSP 강화 1단계) ---
function bindStaticHandlers() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  on('headerBrand', 'click', () => goHome());
  on('hamburger', 'click', () => toggleMobileNav());
  on('searchClear', 'click', () => clearSearch());
  on('fab', 'click', () => togglePanel());
  on('panelHeader', 'click', () => togglePanel());
  on('panelHeader', 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); } });
  on('panelActions', 'click', e => e.stopPropagation());
  on('clearCollectBtn', 'click', () => clearCollect());
  on('copyAllBtn', 'click', () => copyAll());
  on('downloadCollectedBtn', 'click', () => downloadCollected());
  on('panelCloseBtn', 'click', () => togglePanel());
  on('stdPickerModal', 'click', e => { if (e.target === e.currentTarget) window.stdPickerClose(); });
  on('stdPickerSubjSel', 'change', e => window.stdPickerChangeSubject(e.target.value));
  on('stdPickerCloseX', 'click', () => window.stdPickerClose());
  on('stdPickerCancelBtn', 'click', () => window.stdPickerClose());
  on('stdPickerConfirmBtn', 'click', () => window.stdPickerConfirm());
  on('evalPreviewModal', 'click', e => { if (e.target === e.currentTarget) window.evalClosePreview(); });
  on('evalPreviewCloseX', 'click', () => window.evalClosePreview());
  on('evalCopyBtn', 'click', () => window.evalCopyPreviewTable());
  on('evalPreviewCloseBtn', 'click', () => window.evalClosePreview());
  on('navOverlay', 'click', () => closeMobileNav());
  on('navDrawerClose', 'click', () => closeMobileNav());
  on('backupExportBtn', 'click', () => backupExport());
  on('backupImportBtn', 'click', () => { const f = document.getElementById('backupImportFile'); if (f) f.click(); });
  on('backupImportFile', 'change', e => { backupImport(e.target.files && e.target.files[0]); e.target.value = ''; });
}

// --- Init ---
if (location.hash && location.hash !== '#home') {
  hashDecode(location.hash);
}
bindStaticHandlers();
initDelegation(document.body);
renderTabs();
updateSearchVisibility();
render();
updatePanel();