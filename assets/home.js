import { esc, registerActions } from './utils.js';


// --- 홈 렌더 — app.js에서 분리 (2026-07-08 F2) ---
// 규칙 10: 이 마크업을 바꾸면 index.html 정적 홈 셸도 반드시 같이 갱신할 것.
// 버튼의 data-onclick 액션(app:subject/app:ovSubtab/app:focusSearch/app:lucky)은 app.js에 등록돼 있다.

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
    return `<button class="home-card" style="--hc-accent:${s.accent}" data-onclick="app:subject" data-args="[${idx}]">
      <span class="home-card-name"><span class="home-card-dot"></span>${esc(s.name)}</span>
    </button>`;
  }
  const ovCards = OV_SUBTABS.map(t =>
    `<button class="home-card" style="--hc-accent:var(--curr)" data-onclick="app:ovSubtab" data-args="${esc(JSON.stringify([t.key]))}">
      <span class="home-card-name"><span class="home-card-dot"></span>${esc(t.label)}</span>
    </button>`
  ).join('');
  return `
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
      <div class="home-card-grid">${['evalplan'].map(subCard).join('')}</div>
    </div>
    <div class="home-nav-section">
      <div class="home-nav-label">자료실</div>
      <div class="home-card-grid">${['textbook','fav','swrec','appstore'].map(subCard).join('')}</div>
    </div>
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
