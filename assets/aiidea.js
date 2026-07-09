import { esc, clipboardWriteText, loadState, registerActions } from './utils.js';
import { geminiGenerateJSON, loadGeminiKey, saveGeminiKey, clearGeminiKey } from './gemini.js';

const IDEA_ACCENT = ['#0EA5E9', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'];
const IDEA_LIGHT  = ['#F0F9FF', '#FFFBEB', '#ECFDF5', '#F5F3FF', '#FEF2F2'];
const TYPE_ICONS  = { '개인활동':'🧑', '모둠활동':'👥', '프로젝트':'🚀', '토의토론':'💬', '실습':'💻' };

let aiideaGrade = '중학교';
let aiideaTime  = '1차시';
let aiideaCount = 3;
let _aiideaResults = null;
let _collectedOpen = false;

function gradeBtn(g)  { return `<button class="codevar-lang-btn aiidea-opt-btn${aiideaGrade===g?' active':''}" data-opt="grade" data-value="${g}" data-onclick="ai:grade" data-args="${esc(JSON.stringify([g]))}">${g}</button>`; }
function timeBtn(t)   { return `<button class="codevar-lang-btn aiidea-opt-btn${aiideaTime===t?' active':''}" data-opt="time" data-value="${t}" data-onclick="ai:time" data-args="${esc(JSON.stringify([t]))}">${t}</button>`; }
function countBtn(n)  { return `<button class="codevar-lang-btn aiidea-opt-btn${aiideaCount===n?' active':''}" data-opt="count" data-value="${n}" data-onclick="ai:count" data-args="[${n}]">${n}개</button>`; }

function renderAiIdea() {
  const savedKey = loadGeminiKey();
  _collectedOpen = false;

  const skelCards = [0,1,2].map(() =>
    `<div class="aiidea-skel-card">
      <div class="aiidea-skel-bar"></div>
      <div class="aiidea-skel-body">
        <div class="aiidea-skel-hd"></div>
        <div class="aiidea-skel-line" style="width:70%"></div>
        <div class="aiidea-skel-line" style="width:55%"></div>
        <div class="aiidea-skel-line" style="width:80%"></div>
      </div>
    </div>`).join('');

  return `<div class="aiidea-wrap">
    <div class="ov-head">
      <span class="ov-eyebrow" style="color:var(--plan);background:var(--plan-soft)">수업/평가계획 · AI</span>
      <h2 class="ov-h2">AI 수업 아이디어</h2>
      <p class="ov-sub">성취기준 코드나 수업 주제를 입력하면 Gemini AI가 바로 수업에 적용할 수 있는 활동 아이디어를 제안합니다.</p>
    </div>
    <div class="eval-settings">

      <div class="eval-settings-row">
        <div class="eval-field">
          <span class="eval-label">대상</span>
          <div class="codevar-lang-group">
            ${['중학교','고등학교'].map(gradeBtn).join('')}
          </div>
        </div>
        <div class="eval-field">
          <span class="eval-label">수업 시수</span>
          <div class="codevar-lang-group">
            ${['1차시','2차시','3차시 이상'].map(timeBtn).join('')}
          </div>
        </div>
        <div class="eval-field">
          <span class="eval-label">아이디어 수</span>
          <div class="codevar-lang-group">
            ${[3,4,5].map(countBtn).join('')}
          </div>
        </div>
      </div>

      <div class="eval-settings-row">
        <div class="eval-field" style="flex:1;min-width:200px">
          <div class="codevar-apikey-label-row">
            <label class="eval-label" for="aiideaApiKey">Gemini API Key&nbsp;<span class="codevar-free-badge">무료</span></label>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="codevar-apilink">API 키가 없으신가요? →</a>
          </div>
          <input type="password" id="aiideaApiKey" class="codevar-apikey-input"
            placeholder="여기에 Gemini API 키를 붙여넣으세요 (자동 저장됨)"
            value="${esc(savedKey)}" autocomplete="off" spellcheck="false">
          <div class="codevar-apikey-foot">
            <em class="codevar-apikey-privacy">API 키를 추가해 사용하셔도 '정글' 사이트에는 해당 정보가 전송되지 않습니다. <strong class="codevar-apikey-warn">공용 PC에서는 사용 후 저장된 키를 꼭 삭제하세요.</strong></em>
            <button type="button" class="codevar-key-del" data-onclick="ai:delKey">저장된 키 삭제</button>
          </div>
        </div>
      </div>

      <div class="eval-settings-row">
        <div class="eval-field" style="width:100%">
          <div class="aiidea-topic-header">
            <label class="eval-label" for="aiideaTopic">성취기준 코드 또는 수업 주제</label>
            <button class="aiidea-collect-toggle" id="aiideaCollectToggle" data-onclick="ai:collected">
              담은 성취기준에서 불러오기 <span id="aiideaCollectArrow">▾</span>
            </button>
          </div>

          <div id="aiideaCollectedPanel" class="aiidea-collected-panel" style="display:none"></div>

          <textarea id="aiideaTopic" class="codevar-textarea" rows="5" spellcheck="false"
            placeholder="예시&#10;• 9정03-02 알고리즘의 이해와 표현&#10;• 변수와 자료형을 활용한 프로그래밍 입문&#10;• 피지컬 컴퓨팅을 활용한 IoT 체험 활동"></textarea>
        </div>
      </div>

      <div class="eval-settings-row" style="align-items:center;margin-bottom:0">
        <button id="aiideaBtn" class="aiidea-gen-btn" data-onclick="ai:generate">아이디어 생성</button>
        <span class="codevar-gen-hint" style="font-size:13px;color:var(--g400)">한 번의 API 호출로 생성합니다</span>
      </div>

    </div>

    <div id="aiideaError" class="codevar-error" style="display:none"></div>
    <div id="aiideaSkeleton" class="aiidea-skeleton" style="display:none">${skelCards}</div>
    <div id="aiideaResults" style="display:none">
      <div id="aiideaCards" class="aiidea-cards"></div>
    </div>
  </div>`;
}

// ── option button helpers ──────────────────────────────────────────────────
function aiideaSetGrade(v) {
  aiideaGrade = v;
  document.querySelectorAll('.aiidea-opt-btn[data-opt="grade"]').forEach(b =>
    b.classList.toggle('active', b.dataset.value === v));
}
function aiideaSetTime(v) {
  aiideaTime = v;
  document.querySelectorAll('.aiidea-opt-btn[data-opt="time"]').forEach(b =>
    b.classList.toggle('active', b.dataset.value === v));
}
function aiideaSetCount(v) {
  aiideaCount = v;
  document.querySelectorAll('.aiidea-opt-btn[data-opt="count"]').forEach(b =>
    b.classList.toggle('active', b.dataset.value === String(v)));
}

// ── collected standards picker ────────────────────────────────────────────
function aiideaToggleCollected() {
  _collectedOpen = !_collectedOpen;
  const panel = document.getElementById('aiideaCollectedPanel');
  const arrow = document.getElementById('aiideaCollectArrow');
  if (!panel) return;
  if (_collectedOpen) {
    panel.style.display = '';
    if (arrow) arrow.textContent = '▴';
    aiideaRenderCollectedPanel(panel);
  } else {
    panel.style.display = 'none';
    if (arrow) arrow.textContent = '▾';
  }
}

function aiideaRenderCollectedPanel(panel) {
  const collected = loadState('collected', []);
  if (!collected.length) {
    panel.innerHTML = `<div class="aiidea-collected-empty">담은 성취기준이 없습니다. 성취기준 검색에서 ☑ 체크해보세요.</div>`;
    return;
  }

  // group by subject
  const groups = {};
  collected.forEach(c => {
    if (!groups[c.sid]) groups[c.sid] = [];
    groups[c.sid].push(c);
  });

  const html = Object.entries(groups).map(([sid, items]) => {
    const subj = SUBJECTS.find(s => s.id === sid);
    const name = subj ? subj.name : sid;
    const accent = subj ? subj.accent : '#6B7280';
    const aLight = subj ? subj.aLight : '#F3F4F6';
    const chips = items.map(it =>
      `<button class="aiidea-std-pick"
        style="border-color:${accent}40;background:${aLight}"
        data-onclick="ai:pickStd" data-args="${esc(JSON.stringify([it.code, it.text]))}"
        title="${esc(it.text)}">
        <span class="aiidea-std-pick-code" style="color:${accent}">${esc(it.code)}</span>
        <span class="aiidea-std-pick-text">${esc(it.text.length > 30 ? it.text.slice(0,30)+'…' : it.text)}</span>
      </button>`
    ).join('');
    return `<div class="aiidea-collected-group">
      <div class="aiidea-collected-subj" style="color:${accent}">${esc(name)}</div>
      <div class="aiidea-collected-chips">${chips}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `<div class="aiidea-collected-inner">
    <div class="aiidea-collected-hint">클릭하면 입력창에 추가됩니다</div>
    ${html}
  </div>`;
}

function aiideaPickStd(code, text) {
  const ta = document.getElementById('aiideaTopic');
  if (!ta) return;
  const line = code + ' ' + text;
  ta.value = ta.value ? ta.value.trimEnd() + '\n' + line : line;
  ta.focus();
}

// ── generate ──────────────────────────────────────────────────────────────
async function aiideaGenerate() {
  const apiKeyEl = document.getElementById('aiideaApiKey');
  const topicEl  = document.getElementById('aiideaTopic');
  if (!apiKeyEl || !topicEl) return;

  const apiKey = apiKeyEl.value.trim();
  const topic  = topicEl.value.trim();

  if (!apiKey) { aiideaShowError('Gemini API 키를 입력해주세요.'); return; }
  if (!topic)  { aiideaShowError('성취기준 코드나 수업 주제를 입력해주세요.'); return; }

  saveGeminiKey(apiKey);

  aiideaSetLoading(true);
  aiideaHideError();
  document.getElementById('aiideaResults').style.display = 'none';

  const sysPrompt = `당신은 대한민국 정보 교과 전문 수업 설계 컨설턴트입니다.
교사가 제공하는 성취기준 또는 수업 주제를 바탕으로 실질적이고 창의적인 수업 활동 아이디어를 제안합니다.
각 아이디어는 교사가 바로 수업에 적용할 수 있을 만큼 구체적으로 작성하세요.
반드시 아래 JSON 스키마 형식으로만 응답하세요.`;

  const userPrompt = `성취기준 또는 수업 주제: ${topic}
대상: ${aiideaGrade}
수업 시수: ${aiideaTime}

위 내용을 바탕으로 수업 활동 아이디어 ${aiideaCount}가지를 제안해주세요.

다음 JSON 형식으로만 응답하세요:
{
  "ideas": [
    {
      "title": "활동 이름 (짧고 명확하게)",
      "type": "활동 유형 (개인활동/모둠활동/프로젝트/토의토론/실습 중 택1)",
      "description": "활동 설명 — 학생이 무엇을 어떻게 하는지 2~3문장으로",
      "materials": "필요한 도구나 자료 (없으면 '별도 준비물 없음')",
      "tips": "교사를 위한 수업 운영 팁 1~2문장"
    }
  ]
}`;

  try {
    const parsed = await geminiGenerateJSON({ apiKey, systemPrompt: sysPrompt, userPrompt });
    if (!parsed.ideas || !Array.isArray(parsed.ideas)) throw new Error('응답 형식이 올바르지 않습니다. 다시 시도해 주세요.');
    aiideaRenderCards(parsed.ideas);
  } catch(e) {
    aiideaShowError(e.message);
  } finally {
    aiideaSetLoading(false);
  }
}

function aiideaSetLoading(on) {
  const btn  = document.getElementById('aiideaBtn');
  const skel = document.getElementById('aiideaSkeleton');
  if (btn)  { btn.disabled = on; btn.textContent = on ? '생성 중...' : '아이디어 생성'; }
  if (skel) skel.style.display = on ? '' : 'none';
}
function aiideaShowError(msg) {
  const el = document.getElementById('aiideaError');
  if (el) { el.textContent = msg; el.style.display = ''; }
}
function aiideaHideError() {
  const el = document.getElementById('aiideaError');
  if (el) el.style.display = 'none';
}

// ── render result cards ───────────────────────────────────────────────────
function aiideaRenderCards(ideas) {
  _aiideaResults = ideas;
  const cardsEl   = document.getElementById('aiideaCards');
  const resultsEl = document.getElementById('aiideaResults');
  if (!cardsEl || !resultsEl) return;

  cardsEl.innerHTML = ideas.map((idea, i) => {
    const color = IDEA_ACCENT[i % IDEA_ACCENT.length];
    const light = IDEA_LIGHT[i % IDEA_LIGHT.length];
    const icon  = TYPE_ICONS[idea.type] || '💡';
    return `<div class="aiidea-card" style="border-top-color:${color}">
      <div class="aiidea-card-hd">
        <span class="aiidea-card-num" style="background:${color}">아이디어 ${i + 1}</span>
        <span class="aiidea-card-type" style="background:${light};color:${color}">${icon} ${esc(idea.type || '')}</span>
      </div>
      <div class="aiidea-card-title">${esc(idea.title)}</div>
      <div class="aiidea-card-section">
        <div class="aiidea-section-label">활동 설명</div>
        <div class="aiidea-section-body">${esc(idea.description)}</div>
      </div>
      <div class="aiidea-card-section">
        <div class="aiidea-section-label">🛠 필요 자료</div>
        <div class="aiidea-section-body">${esc(idea.materials)}</div>
      </div>
      <div class="aiidea-card-section aiidea-card-tips">
        <div class="aiidea-section-label">교사 팁</div>
        <div class="aiidea-section-body">${esc(idea.tips)}</div>
      </div>
      <div class="aiidea-card-footer">
        <button class="aiidea-copy-btn" data-onclick="ai:copyCard" data-args="[${i}]">복사</button>
      </div>
    </div>`;
  }).join('');

  resultsEl.style.display = '';
}

function aiideaCopyCard(i) {
  if (!_aiideaResults || !_aiideaResults[i]) return;
  const idea = _aiideaResults[i];
  const text = [
    `[${idea.type}] ${idea.title}`,
    '',
    `활동 설명\n${idea.description}`,
    '',
    `🛠 필요 자료\n${idea.materials}`,
    '',
    `교사 팁\n${idea.tips}`,
  ].join('\n');
  clipboardWriteText(text);
  const btn = document.querySelectorAll('.aiidea-copy-btn')[i];
  if (btn) { const orig = btn.textContent; btn.textContent = '복사됨!'; setTimeout(() => btn.textContent = orig, 1400); }
}

export { renderAiIdea };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'ai:grade':     function(el, e, g) { aiideaSetGrade(g); },
  'ai:time':      function(el, e, t) { aiideaSetTime(t); },
  'ai:count':     function(el, e, n) { aiideaSetCount(n); },
  'ai:generate':  function() { aiideaGenerate(); },
  'ai:copyCard':  function(el, e, i) { aiideaCopyCard(i); },
  'ai:delKey':    function(el) {
    clearGeminiKey();
    const inp = document.getElementById('aiideaApiKey');
    if (inp) inp.value = '';
    el.textContent = '삭제됨';
    setTimeout(function() { el.textContent = '저장된 키 삭제'; }, 1400);
  },
  'ai:collected': function() { aiideaToggleCollected(); },
  'ai:pickStd':   function(el, e, code, text) { aiideaPickStd(code, text); },
});
