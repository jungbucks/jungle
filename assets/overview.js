import { esc, registerActions } from './utils.js';
import { CORE_ELEMENTS } from './state.js';

function dacInit() {
  const acc = document.querySelector('#ds-ai-compare .dac-acc');
  if (!acc) return;
  acc.addEventListener('click', function(e) {
    const head = e.target.closest('.dac-head');
    if (!head) return;
    const item = head.closest('.dac-item');
    const opening = !item.classList.contains('open');
    item.classList.toggle('open');
    head.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });
}

function renderDsAiCompare() {
  return `<div id="ds-ai-compare">
  <header>
    <span class="dac-eyebrow">선택과목 비교</span>
    <h2 class="dac-h2">데이터 과학 vs 인공지능 기초</h2>
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
    { level:'입문',    score:2.0, pct:40,  color:'#74a4ec', bg:'#f1f6ff', border:'#e0eafc', name:'고등학교 정보',     desc:'정보의 기초 개념과 디지털 소양을 다루는 입문 과목으로 부담이 적습니다.' },
    { level:'입문',    score:2.0, pct:40,  color:'#6b86e8', bg:'#eef2ff', border:'#dde3fb', name:'소프트웨어와 생활', desc:'일상 속 소프트웨어 활용 중심의 교양형 과목으로 진입 장벽이 낮습니다.' },
    { level:'기초',    score:2.5, pct:50,  color:'#7a6ae6', bg:'#efedff', border:'#e0dcfb', name:'프로그래밍',         desc:'기본 코딩 문법과 알고리즘 입문을 배우며 실습 비중이 늘어납니다.' },
    { level:'중급',    score:3.0, pct:60,  color:'#9a55d8', bg:'#f4ecfd', border:'#e8dcf8', name:'데이터 과학',       desc:'데이터 수집·분석·시각화를 다루며 통계적 사고와 도구 활용이 필요합니다.' },
    { level:'고급',    score:4.0, pct:80,  color:'#c0399f', bg:'#f9eaf6', border:'#f1d8ee', name:'인공지능 기초',     desc:'AI 원리와 머신러닝 개념을 배우며 수학적·논리적 이해가 요구됩니다.' },
    { level:'최고난도', score:5.0, pct:100, color:'#d61e54', bg:'#fce7ec', border:'#f7cdd7', name:'정보과학',          desc:'고난도 알고리즘과 자료구조를 깊이 다루며 탄탄한 프로그래밍 실력이 필수입니다.' },
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
      <h2 class="dac-h2">고등학교 선택과목 가이드</h2>
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

function renderCompare(compareSubtab = 'standards') {
  const mid  = SUBJECTS.find(s => s.id === 'middle');
  const high = SUBJECTS.find(s => s.id === 'high');
  const TOGGLE_BTNS = [
    { key: 'standards', label: '성취기준별 비교' },
    { key: 'elements',  label: '핵심요소별 비교' },
  ];
  const toggleHtml = `<div class="ov-head">
    <span class="ov-eyebrow">중·고 비교</span>
    <h2 class="ov-h2">중·고 정보 교육과정 비교</h2>
    <p class="ov-sub">같은 영역을 중학교 정보·고등학교 정보의 성취기준과 핵심요소로 나란히 대조합니다.</p>
  </div>
  <div class="cmp-toggle">
    ${TOGGLE_BTNS.map(({ key, label }) => `
      <button class="cmp-toggle-btn${compareSubtab === key ? ' active' : ''}"
        data-onclick="ov:cmpSubtab" data-args="${esc(JSON.stringify([key]))}">${label}</button>`).join('')}
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
        </div>
      </div>`;
    });
    return `<div class="cmp-wrap">${toggleHtml}${body}</div>`;
  }
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
  <div class="ov-head">
    <span class="ov-eyebrow">교육과정 체계</span>
    <h2 class="ov-h2">정보과 교육과정 한눈에 보기</h2>
    <p class="ov-sub">총론 인간상부터 정보 교과 역량까지, 2022 개정 교육과정의 위계를 한 화면에 정리했습니다.</p>
  </div>
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
            <td><span class="ov-subj-badge" style="background:var(--sbj-info);color:var(--sbj-info-ink)">정보</span></td>
            <td>중학교 '정보'와 동일한 영역으로 구성하여 일관성을 유지하면서, 진로선택 과목의 기초 공통이 되도록 내용을 구성</td>
          </tr>
          <tr>
            <td rowspan="3" class="ov-cat-cell" style="vertical-align:middle">진로선택</td>
            <td><span class="ov-subj-badge" style="background:var(--sbj-ai);color:var(--sbj-ai-ink)">인공지능 기초</span></td>
            <td>컴퓨터과학, 데이터 과학, 정보시스템 분야의 지식으로 구성하여 해당 진로와 연계</td>
          </tr>
          <tr>
            <td><span class="ov-subj-badge" style="background:var(--sbj-ds);color:var(--sbj-ds-ink)">데이터 과학</span></td>
            <td>컴퓨터과학, 데이터 과학 분야의 기초 지식으로 구성하여 해당 진로와 연계</td>
          </tr>
          <tr>
            <td><span class="ov-subj-badge" style="background:var(--sbj-cs);color:var(--sbj-cs-ink)">정보과학</span></td>
            <td>컴퓨터과학과 소프트웨어 공학 분야에 관한 지식으로 구성하여 해당 진로와 연계</td>
          </tr>
          <tr>
            <td class="ov-cat-cell">융합선택</td>
            <td><span class="ov-subj-badge" style="background:var(--sbj-sw);color:var(--sbj-sw-ink)">소프트웨어와 생활</span></td>
            <td>다양한 학문 분야와의 융합을 통해 문제 해결을 경험할 수 있는 프로젝트 형태로 각 영역을 구성</td>
          </tr>
          <tr>
            <td class="ov-cat-cell">전문교과</td>
            <td><span class="ov-subj-badge" style="background:var(--sbj-pg);color:var(--sbj-pg-ink)">프로그래밍</span></td>
            <td>프로그래밍 언어, 기초 문법, 프로그램 설계와 구현 전 과정을 다루며 산업 현장과 연계된 실무 중심으로 구성</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="ov-note">각 과목은 하나의 학문적 뿌리에서 분야와 지식의 깊이를 달리하여 병렬적으로 연계되면서도 각 과목을 통해 추구하는 능력이나 목표 역량은 차별성을 두었다.</p>
  </div></div>`;
}

export { dacInit, renderDsAiCompare, renderSubjectGuide, renderCompare, renderOverview };

// ── 이벤트 위임 등록 — compareSelectSubtab은 app.js 소유(순환 import 회피 위해 window 경유)
registerActions('click', {
  'ov:cmpSubtab': function(el, e, key) { window.compareSelectSubtab(key); },
});
