// --- Gemini API 공용 헬퍼 (ES Module) ---
// codevar.js, aiidea.js 등 AI 기능이 공유하는 호출/키관리 로직

const GEMINI_MODEL = 'gemini-3.8-flash'; // 2.5는 2026-10부터 기존 사용자만 접근 가능 → 새 키도 되는 정식 Flash로
const KEY_STORAGE = 'jungle_gemini_api_key';
const KEY_LEGACY = 'gemini_api_key';

// 저장된 API 키 로드 (구 키 → 신 키 1회 마이그레이션 포함)
export function loadGeminiKey() {
  try {
    const v = localStorage.getItem(KEY_STORAGE) || localStorage.getItem(KEY_LEGACY) || '';
    if (!localStorage.getItem(KEY_STORAGE) && v) {
      localStorage.setItem(KEY_STORAGE, v);
      localStorage.removeItem(KEY_LEGACY);
    }
    return v;
  } catch(e) { return ''; }
}

// AI 도구 공용 키 입력 패널 — 코드 변형 생성기·AI 수업 아이디어가 같은 자리·같은 저장 키(jungle_gemini_api_key)를 쓴다
export function geminiKeyPanelHtml() {
  const k = loadGeminiKey().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<div class="eval-settings gemini-key-panel">
    <div class="codevar-apikey-label-row">
      <label class="eval-label" for="geminiKeyInput">Gemini API Key&nbsp;<span class="codevar-free-badge">무료</span> <span class="gemini-key-shared">AI 도구 두 개가 함께 씁니다</span></label>
      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="codevar-apilink">API 키가 없으신가요? →</a>
    </div>
    <input type="password" id="geminiKeyInput" class="codevar-apikey-input" placeholder="여기에 Gemini API 키를 붙여넣으세요 (자동 저장됨)" value="${k}" autocomplete="off" spellcheck="false">
    <div class="codevar-apikey-foot">
      <em class="codevar-apikey-privacy">API 키를 추가해 사용하셔도 '정글' 사이트에는 해당 정보가 전송되지 않습니다. <strong class="codevar-apikey-warn">공용 PC에서는 사용 후 저장된 키를 꼭 삭제하세요.</strong></em>
      <button type="button" class="codevar-key-del" data-onclick="gem:delKey">저장된 키 삭제</button>
    </div>
  </div>`;
}
// 생성 버튼을 누를 때 읽는다: 입력칸 값(있으면 저장) → 없으면 저장된 키
export function readGeminiKey() {
  const el = document.getElementById('geminiKeyInput');
  const v = el && el.value ? el.value.trim() : '';
  if (v) { saveGeminiKey(v); return v; }
  return loadGeminiKey();
}

export function saveGeminiKey(key) {
  try { localStorage.setItem(KEY_STORAGE, key); } catch(e) {}
}

// 공용 PC 대비 — 저장된 키를 완전히 제거 (구 키 포함)
export function clearGeminiKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
    localStorage.removeItem(KEY_LEGACY);
  } catch(e) {}
}

// JSON 응답을 요구하는 Gemini 호출. 파싱된 객체를 반환하고, 실패 시 사용자용 메시지로 throw.
export async function geminiGenerateJSON({ apiKey, systemPrompt, userPrompt, model = GEMINI_MODEL }) {
  // 키는 URL 쿼리 대신 헤더로 전송 — 프록시/보안장비 로그에 키가 남는 것을 방지
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${(errData && errData.error && errData.error.message) || res.statusText}`);
  }
  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.');
  try {
    return JSON.parse(text);
  } catch(e) {
    console.warn('Gemini raw response:', text);
    throw new Error('응답을 파싱할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
}
