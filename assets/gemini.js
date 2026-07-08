// --- Gemini API 공용 헬퍼 (ES Module) ---
// codevar.js, aiidea.js 등 AI 기능이 공유하는 호출/키관리 로직

const GEMINI_MODEL = 'gemini-2.5-flash';
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
