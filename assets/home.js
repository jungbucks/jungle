import { esc, registerActions } from './utils.js';
import { HOME_CARD_META } from './state.js';

// --- 홈 렌더 — app.js에서 분리 (2026-07-08 F2) ---
// 규칙 10: 이 마크업을 바꾸면 index.html 정적 홈 셸도 반드시 같이 갱신할 것.
// 버튼의 data-onclick 액션(app:subject/app:ovSubtab/app:focusSearch/app:lucky)은 app.js에 등록돼 있다.

function dismissOnboard() {
  try { localStorage.setItem('jungle_visited', '1'); } catch(e) {}
  const el = document.getElementById('onboardBanner');
  if (el) { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }
}

export function renderHome() {
  const OV_SUBTABS = [
    { key:'map',       label:'교육과정 한눈에 보기', desc:'이수 체계·영역 구조' },
    { key:'simulator', label:'고교학점제 시뮬레이터', desc:'학기별 과목 배치 설계' },
    { key:'compare',   label:'중·고 정보 교육과정 비교', desc:'성취기준·내용 요소 대조' },
    { key:'guide',     label:'고등학교 선택과목 가이드', desc:'과목별 특징·이수 흐름' },
    { key:'dsai',      label:'데이터 과학 vs 인공지능 기초', desc:'두 과목 심층 비교' },
  ];
  function subCard(id) {
    const idx = SUBJECTS.findIndex(s => s.id === id);
    if (idx < 0) return '';
    const s = SUBJECTS[idx];
    const meta = HOME_CARD_META[id] || {};
    const desc = s.level || meta.desc || '';
    return `<button class="home-card" style="--hc-accent:${s.accent}" data-onclick="app:subject" data-args="[${idx}]">
      <span class="home-card-name"><span class="home-card-dot"></span>${esc(s.name)}</span>
      ${desc ? `<span class="home-card-desc">${esc(desc)}</span>` : ''}
    </button>`;
  }
  const ovCards = OV_SUBTABS.map(t =>
    `<button class="home-card" style="--hc-accent:var(--curr)" data-onclick="app:ovSubtab" data-args="${esc(JSON.stringify([t.key]))}">
      <span class="home-card-name"><span class="home-card-dot"></span>${esc(t.label)}</span>
      <span class="home-card-desc">${esc(t.desc)}</span>
    </button>`
  ).join('');
  const onboardHtml = `<details class="home-help" id="onboardBanner"><summary><span>찾은 성취기준은 바로 복사하거나 담을 수 있어요.</span><span class="home-help-link">사용법 보기</span></summary><ul class="onboard-list"><li>검색창에 키워드나 코드를 입력하면 전 과목에서 찾아요.</li><li>결과의 복사 버튼을 누르거나 체크해서 여러 기준을 담아 보세요.</li><li>담은 기준은 수업·평가 계획에 활용할 수 있어요.</li></ul></details>`;
  const evalIdx = SUBJECTS.findIndex(s => s.id === 'evalplan');
  const textbookIdx = SUBJECTS.findIndex(s => s.id === 'textbook');
  const ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  };
  return `
  <div class="home-glrow">
    <span class="home-example-label">예시</span><button class="home-gl-btn home-example" data-onclick="app:exampleSearch" data-query="알고리즘">알고리즘</button><button class="home-gl-btn home-example" data-onclick="app:exampleSearch" data-query="인공지능">인공지능</button><button class="home-gl-btn home-example" data-onclick="app:exampleSearch" data-query="12정01-01">12정01-01</button>
    <button class="home-gl-btn" data-onclick="app:lucky"><svg class="gl-btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/></svg> 랜덤 성취기준</button>
  </div>
  <div class="home-tagline">정보교사를 위한 <strong>올인원 플랫폼</strong></div>
  ${onboardHtml}
  <div class="home-shortcuts home-shortcuts-below">
    <button class="home-sc-card" data-onclick="app:focusSearch">
      <span class="home-sc-ico" style="--sc-soft:var(--accent-light);--sc-color:var(--accent)">${ICONS.search}</span>
      <span class="home-sc-label">성취기준 검색</span>
    </button>
    <button class="home-sc-card" data-onclick="app:ovSubtab" data-args="[&quot;map&quot;]">
      <span class="home-sc-ico" style="--sc-soft:var(--curr-soft);--sc-color:var(--curr)">${ICONS.compass}</span>
      <span class="home-sc-label">교육과정 분석</span>
    </button>
    <button class="home-sc-card" data-onclick="app:subject" data-args="[${evalIdx}]">
      <span class="home-sc-ico" style="--sc-soft:var(--plan-soft);--sc-color:var(--plan)">${ICONS.clipboard}</span>
      <span class="home-sc-label">수업·평가 계획</span>
    </button>
    <button class="home-sc-card" data-onclick="app:subject" data-args="[${textbookIdx}]">
      <span class="home-sc-ico" style="--sc-soft:var(--book-soft);--sc-color:var(--book)">${ICONS.book}</span>
      <span class="home-sc-label">교과서·앱 정보</span>
    </button>
  </div>
  <div class="home-nav">
    <div class="home-nav-section">
      <div class="home-nav-label">성취기준</div>
      <div class="home-card-grid">${['middle','high','ai','ds','sw','cs','prog'].map(subCard).join('')}</div>
    </div>
    <div class="home-nav-section">
      <div class="home-nav-label">교육과정</div>
      <div class="home-card-grid">${ovCards}</div>
    </div>

    <div class="home-nav-section">
      <div class="home-nav-label">수업·평가 도구</div>
      <div class="home-card-grid">${['evalplan','textbook'].map(subCard).join('')}</div>
    </div>
    <div class="home-nav-section">
      <div class="home-nav-label">자료실</div>
      <div class="home-card-grid">${['fav','swrec','appstore'].map(subCard).join('')}</div>
    </div>
  </div>`;
}

registerActions('click', {
  'app:dismissOnboard': function() { dismissOnboard(); },
});
