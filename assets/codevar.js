import { esc, clipboardWriteText, registerActions } from './utils.js';
import { geminiGenerateJSON, loadGeminiKey, saveGeminiKey, clearGeminiKey } from './gemini.js';

// --- Code Variation Generator ---
let codevarLang = 'Python';
let codevarMode = 'variation'; // 'variation' | 'problem'
let _codevarResults = null;

const CODEVAR_ACCENT = ['#7C3AED', '#0891B2', '#059669'];
const CODEVAR_LIGHT  = ['#F5F3FF', '#ECFEFF', '#ECFDF5'];
const CODEVAR_TYPES  = [
  { name:'값 변경',        desc:'리터럴·범위·반복 횟수 등 숫자를 의미 있는 다른 값으로 교체' },
  { name:'로직 구조 변경', desc:'for↔while, if-else↔삼항, 반복↔재귀, 함수 분리/통합' },
  { name:'복합 변형',      desc:'값 변경 + 로직 구조 변경 동시 적용' },
];

function renderCodeVar() {
  const savedKey = loadGeminiKey();
  const isVar = codevarMode === 'variation';

  const typeChips = CODEVAR_TYPES.map((t, i) =>
    `<div class="codevar-type-chip" style="border-color:${CODEVAR_ACCENT[i]}20;background:${CODEVAR_LIGHT[i]}">
      <span class="codevar-type-num" style="background:${CODEVAR_ACCENT[i]}">${i + 1}</span>
      <div class="codevar-type-info">
        <div class="codevar-type-name" style="color:${CODEVAR_ACCENT[i]}">${t.name}</div>
        <div class="codevar-type-desc">${t.desc}</div>
      </div>
    </div>`
  ).join('');

  const problemInfo =
    `<div class="codevar-problem-info">
      <span class="codevar-pi-chip">문제 3개 생성</span>
      <span class="codevar-pi-chip">예시 정답 코드 포함</span>
      <span class="codevar-pi-chip">난이도 순 배열</span>
    </div>`;

  const skelCards = [0, 1, 2].map(() =>
    `<div class="codevar-skel-card">
      <div class="codevar-skel-bar"></div>
      <div class="codevar-skel-body">
        <div class="codevar-skel-hd"></div>
        <div class="codevar-skel-line" style="width:72%"></div>
        <div class="codevar-skel-line" style="width:50%"></div>
        <div class="codevar-skel-code"></div>
      </div>
    </div>`
  ).join('');

  return `<div class="codevar-wrap">
    <div class="ov-head">
      <span class="ov-eyebrow" style="color:var(--plan);background:var(--plan-soft)">수업/평가계획 · AI</span>
      <h2 class="ov-h2">코드 변형 생성기</h2>
      <p class="ov-sub" id="codevarIntroSub">${isVar
        ? '소스 코드를 붙여넣으면 Gemini AI가 수행평가·시험 출제용 변형 3가지를 자동 생성합니다.'
        : '만들고 싶은 문제를 설명하면 Gemini AI가 예시 정답 코드가 포함된 문제 3개를 생성합니다.'
      }</p>
    </div>
    <div class="eval-settings">
      <div id="codevarTypeRow" class="codevar-type-row" style="${isVar ? '' : 'display:none'}">${typeChips}</div>
      <div id="codevarProblemInfo" style="${isVar ? 'display:none' : ''}">${problemInfo}</div>
      <div class="eval-settings-row">
        <div class="eval-field">
          <span class="eval-label">언어</span>
          <div class="codevar-lang-group">
            <button class="codevar-lang-btn${codevarLang === 'Python' ? ' active' : ''}" data-onclick="cv:lang" data-args="[&quot;Python&quot;]">Python</button>
            <button class="codevar-lang-btn${codevarLang === 'C' ? ' active' : ''}" data-onclick="cv:lang" data-args="[&quot;C&quot;]">C</button>
          </div>
        </div>
        <div class="eval-field">
          <span class="eval-label">모드</span>
          <div class="codevar-lang-group">
            <button class="codevar-mode-btn codevar-lang-btn${isVar ? ' active' : ''}" data-mode="variation" data-onclick="cv:mode" data-args="[&quot;variation&quot;]">코드 변형</button>
            <button class="codevar-mode-btn codevar-lang-btn${!isVar ? ' active' : ''}" data-mode="problem" data-onclick="cv:mode" data-args="[&quot;problem&quot;]">문제 생성</button>
          </div>
        </div>
        <div class="eval-field" style="flex:1;min-width:200px">
          <div class="codevar-apikey-label-row">
            <label class="eval-label" for="codevarApiKey">Gemini API Key&nbsp;<span class="codevar-free-badge">무료</span></label>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="codevar-apilink">API 키가 없으신가요? →</a>
          </div>
          <input type="password" id="codevarApiKey" class="codevar-apikey-input" placeholder="여기에 Gemini API 키를 붙여넣으세요 (자동 저장됨)" value="${esc(savedKey)}" autocomplete="off" spellcheck="false">
          <div class="codevar-apikey-foot">
            <em class="codevar-apikey-privacy">API 키를 추가해 사용하셔도 '정글' 사이트에는 해당 정보가 전송되지 않습니다. <strong class="codevar-apikey-warn">공용 PC에서는 사용 후 저장된 키를 꼭 삭제하세요.</strong></em>
            <button type="button" class="codevar-key-del" data-onclick="cv:delKey">저장된 키 삭제</button>
          </div>
        </div>
      </div>
      <div class="eval-settings-row">
        <div class="eval-field" style="width:100%">
          <label class="eval-label" for="codevarSource" id="codevarSourceLabel">${isVar ? '소스 코드' : '문제 요구사항'}</label>
          <textarea id="codevarSource" class="codevar-textarea" spellcheck="false" rows="14"
            placeholder="${isVar
              ? codevarLang + ' 코드를 여기에 붙여넣으세요...'
              : '어떤 문제를 만들고 싶은지 설명해주세요.\n\n예시:\n• 중학교 수준의 for문으로 구구단 출력하기\n• 리스트를 활용한 최댓값 찾기 (함수 포함)\n• 재귀함수로 팩토리얼 계산하기'
            }"></textarea>
        </div>
      </div>
      <div class="eval-settings-row" style="align-items:center;margin-bottom:0">
        <button id="codevarBtn" class="codevar-gen-btn" data-onclick="cv:generate">${isVar ? '변형 생성' : '문제 생성'}</button>
        <span class="codevar-gen-hint" style="font-size:13px;color:var(--g400)">${isVar ? '3가지 변형을 한 번의 API 호출로 생성합니다' : '3개의 문제를 한 번의 API 호출로 생성합니다'}</span>
      </div>
    </div>
    <div id="codevarError" class="codevar-error" style="display:none"></div>
    <div id="codevarSkeleton" class="codevar-skeleton" style="display:none">${skelCards}</div>
    <div id="codevarResults" style="display:none">
      <div class="codevar-cards" id="codevarCards"></div>
    </div>
  </div>`;
}

function codevarSetLang(lang) {
  codevarLang = lang;
  document.querySelectorAll('.codevar-lang-btn').forEach(b => {
    if (!b.classList.contains('codevar-mode-btn')) {
      b.classList.toggle('active', b.textContent.trim() === lang);
    }
  });
  const ta = document.getElementById('codevarSource');
  if (ta && codevarMode === 'variation') ta.placeholder = lang + ' 코드를 여기에 붙여넣으세요...';
}

function codevarSetMode(mode) {
  codevarMode = mode;
  const isVar = mode === 'variation';
  document.querySelectorAll('.codevar-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const introSub = document.getElementById('codevarIntroSub');
  if (introSub) introSub.textContent = isVar
    ? '소스 코드를 붙여넣으면 Gemini AI가 수행평가·시험 출제용 변형 3가지를 자동 생성합니다.'
    : '만들고 싶은 문제를 설명하면 Gemini AI가 예시 정답 코드가 포함된 문제 3개를 생성합니다.';
  const typeRow = document.getElementById('codevarTypeRow');
  if (typeRow) typeRow.style.display = isVar ? '' : 'none';
  const probInfo = document.getElementById('codevarProblemInfo');
  if (probInfo) probInfo.style.display = isVar ? 'none' : '';
  const label = document.getElementById('codevarSourceLabel');
  if (label) label.textContent = isVar ? '소스 코드' : '문제 요구사항';
  const ta = document.getElementById('codevarSource');
  if (ta) {
    ta.value = '';
    ta.placeholder = isVar
      ? codevarLang + ' 코드를 여기에 붙여넣으세요...'
      : '어떤 문제를 만들고 싶은지 설명해주세요.\n\n예시:\n• 중학교 수준의 for문으로 구구단 출력하기\n• 리스트를 활용한 최댓값 찾기 (함수 포함)\n• 재귀함수로 팩토리얼 계산하기';
  }
  const btn = document.getElementById('codevarBtn');
  if (btn && !btn.disabled) btn.textContent = isVar ? '변형 생성' : '문제 생성';
  const hint = document.querySelector('.codevar-gen-hint');
  if (hint) hint.textContent = isVar ? '3가지 변형을 한 번의 API 호출로 생성합니다' : '3개의 문제를 한 번의 API 호출로 생성합니다';
  document.getElementById('codevarResults').style.display = 'none';
  codevarHideError();
}

async function codevarGenerate() {
  const apiKeyEl = document.getElementById('codevarApiKey');
  const sourceEl = document.getElementById('codevarSource');
  if (!apiKeyEl || !sourceEl) return;

  const apiKey = apiKeyEl.value.trim();
  const source = sourceEl.value.trim();
  const isVar = codevarMode === 'variation';

  if (!apiKey) { codevarShowError('API 키를 입력해주세요.'); return; }
  if (!source) { codevarShowError(isVar ? '소스 코드를 입력해주세요.' : '문제 요구사항을 입력해주세요.'); return; }

  saveGeminiKey(apiKey);

  codevarSetLoading(true);
  codevarHideError();
  document.getElementById('codevarResults').style.display = 'none';

  const sysPrompt = isVar
    ? `당신은 정보 교과 수행평가 및 정기시험 문제를 만드는 전문가입니다.
교사가 제공한 소스 코드를 분석하고, 지정된 변형 방식에 따라 변형된 코드를 생성합니다.
혹시 오타가 있거나 논리적 오류 등이 있으면 적절한 형태로 수정합니다.
반드시 아래 JSON 스키마 형식으로만 응답하세요.`
    : `당신은 정보 교과 수행평가 및 정기시험 문제를 만드는 전문가입니다.
교사가 요청하는 주제와 조건에 맞는 프로그래밍 문제를 생성합니다.
문제 설명은 학생이 읽고 바로 이해할 수 있도록 명확하게 작성하고, 예시 정답 코드는 교육적으로 간결하게 작성합니다.
반드시 아래 JSON 스키마 형식으로만 응답하세요.`;

  const userPrompt = isVar
    ? `다음 ${codevarLang} 코드의 변형 3가지를 생성해주세요.

[원본 코드]
${source}

[변형 규칙]
- 변형1 (값 변경): 코드의 논리 구조는 유지하되, 숫자 리터럴·범위·임계값·반복 횟수 등을 의미 있게 다른 값으로 교체하세요.
- 변형2 (로직 구조 변경): 값은 그대로 두되, 제어 구조를 변경하세요. 예: for↔while, if-else↔삼항연산자, 반복↔재귀, 함수 분리/통합 등.
- 변형3 (복합 변형): 값 변경과 로직 구조 변경을 동시에 적용하세요.

다음 JSON 형식으로만 응답하세요:
{
  "variations": [
    { "title": "변형 1 — 값 변경", "description": "어떤 값을 어떻게 바꿨는지 한 문장", "code": "변형된 전체 소스코드" },
    { "title": "변형 2 — 로직 구조 변경", "description": "어떤 구조를 어떻게 바꿨는지 한 문장", "code": "변형된 전체 소스코드" },
    { "title": "변형 3 — 복합 변형", "description": "값과 구조를 어떻게 바꿨는지 한 문장", "code": "변형된 전체 소스코드" }
  ]
}`
    : `다음 요구사항에 맞는 ${codevarLang} 프로그래밍 문제 3개를 생성해주세요.

[요구사항]
${source}

[생성 규칙]
- 3개의 문제는 쉬운 것부터 어려운 순서로 배치해주세요.
- 문제 설명에는 입력/출력 예시를 포함해주세요.
- 예시 정답 코드는 교육 목적에 맞게 간결하게 작성해주세요.

다음 JSON 형식으로만 응답하세요:
{
  "problems": [
    { "title": "문제 제목", "description": "학생에게 제시할 문제 설명 (입력·출력 예시 포함)", "code": "예시 정답 코드" },
    { "title": "문제 제목", "description": "학생에게 제시할 문제 설명 (입력·출력 예시 포함)", "code": "예시 정답 코드" },
    { "title": "문제 제목", "description": "학생에게 제시할 문제 설명 (입력·출력 예시 포함)", "code": "예시 정답 코드" }
  ]
}`;

  try {
    const parsed = await geminiGenerateJSON({ apiKey, systemPrompt: sysPrompt, userPrompt });
    if (isVar) {
      if (!parsed.variations || !Array.isArray(parsed.variations)) throw new Error('응답 형식이 올바르지 않습니다. 다시 시도해 주세요.');
      codevarRenderCards(parsed.variations, 'variation');
    } else {
      if (!parsed.problems || !Array.isArray(parsed.problems)) throw new Error('응답 형식이 올바르지 않습니다. 다시 시도해 주세요.');
      codevarRenderCards(parsed.problems, 'problem');
    }
  } catch(e) {
    codevarShowError(e.message);
  } finally {
    codevarSetLoading(false);
  }
}

function codevarSetLoading(on) {
  const btn = document.getElementById('codevarBtn');
  const isVar = codevarMode === 'variation';
  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? '생성 중...' : (isVar ? '변형 생성' : '문제 생성');
  }
  const skel = document.getElementById('codevarSkeleton');
  if (skel) skel.style.display = on ? '' : 'none';
}

function codevarShowError(msg) {
  const el = document.getElementById('codevarError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
}

function codevarHideError() {
  const el = document.getElementById('codevarError');
  if (el) el.style.display = 'none';
}

function codevarRenderCards(items, mode) {
  const resultsEl = document.getElementById('codevarResults');
  const cardsEl   = document.getElementById('codevarCards');
  if (!resultsEl || !cardsEl) return;
  _codevarResults = items;
  const isVar = mode === 'variation';
  cardsEl.innerHTML = items.map((v, i) => {
    const color = CODEVAR_ACCENT[i] || '#6B7280';
    const light = CODEVAR_LIGHT[i]  || '#F9FAFB';
    const badge = isVar ? `변형 ${i + 1}` : `문제 ${i + 1}`;
    const descLabel = isVar ? '' : `<div class="codevar-card-desc-label">문제 설명</div>`;
    const codeLabel = isVar ? '' : `<div class="codevar-card-desc-label" style="padding:8px 20px 0;background:#1e1e2e;color:#6c7086;font-size:12px;font-weight:600;font-family:monospace">예시 정답</div>`;
    return `<div class="codevar-card">
      <div class="codevar-card-bar" style="background:${color}"></div>
      <div class="codevar-card-hd">
        <span class="codevar-num-badge" style="background:${light};color:${color}">${badge}</span>
        <span class="codevar-card-title">${esc(v.title || '')}</span>
      </div>
      ${descLabel}
      <div class="codevar-card-desc" style="${!isVar ? 'white-space:pre-wrap' : ''}">${esc(v.description || '')}</div>
      <div class="codevar-code-wrap">
        ${codeLabel}
        <div class="codevar-code-hd">
          <span class="codevar-code-lang">${codevarLang}</span>
          <button class="codevar-copy-btn" data-onclick="cv:copy" data-args="[${i}]">복사</button>
        </div>
        <pre class="codevar-pre"><code>${esc(v.code || '')}</code></pre>
      </div>
    </div>`;
  }).join('');
  resultsEl.style.display = '';
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function codevarCopy(btn, idx) {
  if (!_codevarResults || !_codevarResults[idx]) return;
  clipboardWriteText(_codevarResults[idx].code);
  const orig = btn.textContent;
  btn.textContent = '복사됨!';
  btn.classList.add('ok');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 1400);
}

export { renderCodeVar };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'cv:lang':     function(el, e, lang) { codevarSetLang(lang); },
  'cv:mode':     function(el, e, mode) { codevarSetMode(mode); },
  'cv:generate': function() { codevarGenerate(); },
  'cv:copy':     function(el, e, i) { codevarCopy(el, i); },
  'cv:delKey':   function(el) {
    clearGeminiKey();
    const inp = document.getElementById('codevarApiKey');
    if (inp) inp.value = '';
    el.textContent = '삭제됨';
    setTimeout(function() { el.textContent = '저장된 키 삭제'; }, 1400);
  },
});
