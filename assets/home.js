import { esc, registerActions } from './utils.js';
import { NAV, STANDARDS_IDS, HOME_CARD_META, PLAN_TOOLS, PLAN_FLOW, AI_TOOLS } from './state.js';


// --- 홈 렌더 — app.js에서 분리 (2026-07-08 F2) ---
// 규칙 10: 이 마크업을 바꾸면 index.html 정적 홈 셸도 반드시 같이 갱신할 것.
// 버튼의 data-onclick 액션(app:subject/app:ovSubtab/app:focusSearch/app:lucky)은 app.js에 등록돼 있다.

// 교육과정 하위 화면(홈 카드용) — 순서는 app.js 서브탭과 같다
const OV_SUBTABS = [
  { key:'map',       label:'교육과정 한눈에 보기', desc:'이수 체계·영역 구조' },
  { key:'simulator', label:'고교학점제 시뮬레이터', desc:'학기별 과목 배치 설계' },
  { key:'compare',   label:'중·고 정보 교육과정 비교', desc:'성취기준·내용 요소 대조' },
  { key:'guide',     label:'고등학교 선택과목 가이드', desc:'과목별 특징·이수 흐름' },
  { key:'dsai',      label:'데이터 과학 vs 인공지능 기초', desc:'두 과목 심층 비교' },
];

// 섹션 순서·이름 = state.js NAV (상단 메뉴·드로어와 같은 원천)
export function renderHome() {
  function subCard(id) {
    const idx = SUBJECTS.findIndex(s => s.id === id);
    if (idx < 0) return '';
    const s = SUBJECTS[idx];
    return `<button class="home-card" style="--hc-accent:${s.accent}" data-onclick="app:subject" data-args="[${idx}]">
      <span class="home-card-name"><span class="home-card-dot"></span>${esc(s.name)}</span>
      ${HOME_CARD_META[id] ? `<span class="home-card-desc">${esc(HOME_CARD_META[id].desc)}</span>` : ''}
    </button>`;
  }
  const ovCards = () => OV_SUBTABS.map(t =>
    `<button class="home-card" style="--hc-accent:var(--curr)" data-onclick="app:ovSubtab" data-args="${esc(JSON.stringify([t.key]))}">
      <span class="home-card-name"><span class="home-card-dot"></span>${esc(t.label)}</span>
      <span class="home-card-desc">${esc(t.desc)}</span>
    </button>`
  ).join('');
  // 하위 도구 카드: 수업/평가계획은 업무 흐름 순서(차시 → … → 5등급), 번호로 순서를 보인다
  const toolCard = (accent, action, key, label, desc, step) =>
    `<button class="home-card" style="--hc-accent:${accent}" data-onclick="${action}" data-args="${esc(JSON.stringify([key]))}">
      <span class="home-card-name">${step ? `<span class="home-card-step" aria-hidden="true">${step}</span>` : '<span class="home-card-dot"></span>'}${esc(label)}</span>
      <span class="home-card-desc">${esc(desc)}</span>
    </button>`;
  const planCards = () => PLAN_FLOW.map((k, i) => toolCard('var(--plan)', 'app:epSubtabNav', k, PLAN_TOOLS[k].label, PLAN_TOOLS[k].desc, i + 1)).join('');
  const aiCards = () => AI_TOOLS.map(t => toolCard('var(--ovr)', 'app:aiGo', t.key, t.label, t.desc)).join('');
  const section = (label, cards) => `
    <div class="home-nav-section">
      <div class="home-nav-label">${esc(label)}</div>
      <div class="home-card-grid">${cards}</div>
    </div>`;
  const nameOf = id => (SUBJECTS.find(s => s.id === id) || {}).name || '';
  return `
  <div class="home-nav">${NAV.map(n =>
    n.kind === 'standards' ? section(n.label, STANDARDS_IDS.map(subCard).join(''))
    : n.kind === 'library' ? section(n.label, n.ids.map(subCard).join(''))
    : n.id === 'overview' ? section(nameOf('overview'), ovCards())
    : n.id === 'evalplan' ? section(nameOf('evalplan'), planCards())
    : n.id === 'aitools' ? section(nameOf('aitools'), aiCards())
    : section(nameOf(n.id), subCard(n.id))).join('')}
  </div>`;
}

registerActions('click', {
  'home:openGuide': function() { document.getElementById('homeGuide').showModal(); },
  'home:closeGuide': function() { document.getElementById('homeGuide').close(); },
  'home:startSearch': function() {
    document.getElementById('homeGuide').close();
    document.getElementById('searchInput').focus();
  },
});
