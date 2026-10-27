// --- 검색창 placeholder 타자 애니메이션 — app.js에서 분리 (2026-07-08 F2) ---
// app 상태(homeMode)는 isIdle 콜백으로 주입받아 순환 의존을 회피한다.
export function initTypedPlaceholder(input, isIdle) {
  // 검색 범위를 늘 밝힌다(2026-10): 예시도 '성취기준 검색 · ' 뒤에 타자된다
  const INTRO = '성취기준 검색 — 코드나 키워드를 입력하세요';
  const PREFIX = '성취기준 검색 · ';
  const EXAMPLES = [
    '알고리즘', '클래스와 인스턴스', '9정03', '12인기', '머신러닝',
    '정렬', '데이터 구조화', '피지컬 컴퓨팅', '12데과', '인공지능',
    '네트워크', '빅데이터', '디지털 윤리'
  ];
  let phase = 'intro', qi = 0, ci = 0, typing = true, timer = null;
  // 모션 줄이기(prefers-reduced-motion: reduce)면 타자 애니메이션 대신 고정 문구 — 설정이 바뀌면 바로 따른다
  const STATIC = '성취기준 검색 (예: 알고리즘, 12정01-01)';
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(RM && RM.matches);

  function tick() {
    if (reduced()) { if (isIdle() && document.activeElement !== input) input.placeholder = STATIC; return; }
    if (!isIdle() || document.activeElement === input) {
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
      input.placeholder = PREFIX + q.slice(0, ci) + '|';
      if (ci >= q.length) { typing = false; timer = setTimeout(tick, 1200); }
      else timer = setTimeout(tick, 90);
    } else {
      ci--;
      input.placeholder = PREFIX + (ci > 0 ? q.slice(0, ci) + '|' : '');
      if (ci <= 0) {
        typing = true;
        qi = (qi + 1) % EXAMPLES.length;
        timer = setTimeout(tick, 500);
      } else timer = setTimeout(tick, 40);
    }
  }

  if (reduced()) { if (isIdle()) input.placeholder = STATIC; } else timer = setTimeout(tick, 800);
  if (RM && RM.addEventListener) RM.addEventListener('change', () => {
    clearTimeout(timer);
    if (reduced()) { if (isIdle()) input.placeholder = STATIC; }
    else { phase = 'examples'; ci = 0; typing = true; timer = setTimeout(tick, 800); }
  });
  input.addEventListener('focus', () => {
    clearTimeout(timer);
    input.placeholder = '';
  });
  input.addEventListener('blur', () => {
    if (!isIdle()) return;
    if (reduced()) { input.placeholder = STATIC; return; }
    phase = 'examples'; ci = 0; typing = true; timer = setTimeout(tick, 800);
  });
}
