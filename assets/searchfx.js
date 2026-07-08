// --- 검색창 placeholder 타자 애니메이션 — app.js에서 분리 (2026-07-08 F2) ---
// app 상태(homeMode)는 isIdle 콜백으로 주입받아 순환 의존을 회피한다.
export function initTypedPlaceholder(input, isIdle) {
  const INTRO = '성취기준 코드나 키워드를 입력하세요';
  const EXAMPLES = [
    '알고리즘', '클래스와 인스턴스', '9정03', '12인기', '머신러닝',
    '정렬', '데이터 구조화', '피지컬 컴퓨팅', '12데과', '인공지능',
    '네트워크', '빅데이터', '디지털 윤리'
  ];
  let phase = 'intro', qi = 0, ci = 0, typing = true, timer = null;

  function tick() {
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
    if (isIdle()) { phase = 'examples'; ci = 0; typing = true; timer = setTimeout(tick, 800); }
  });
}
