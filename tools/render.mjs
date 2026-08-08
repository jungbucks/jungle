// ============================================================
//  정글 화면 카탈로그 — 화면을 데이터 조합마다 실제로 렌더한다
//  실행:  node tools/render.mjs      (요약 출력, 최소 장수 미달이면 종료코드 1)
//  verify.mjs [6]이 이 모듈을 import 해 쓴다.
//
//  ⚠️ 이 파일은 "규칙"을 모른다. 규칙은 tools/invariants.mjs에 있다.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');

// kind별 최소 장수 — 렌더가 조용히 죽어 "위반 0건"으로 통과하는 것을 막는다
export const EXPECTED_MIN = { achvModal: 27, evalPreview: 2 };

export function checkCounts(screens) {
  const problems = [];
  for (const [kind, min] of Object.entries(EXPECTED_MIN)) {
    const n = screens.filter(s => s.kind === kind).length;
    if (n < min) problems.push(`${kind}: ${n}장 (최소 ${min}장이어야 함 — 렌더가 죽었을 수 있음)`);
  }
  return problems;
}

// ── 브라우저 환경 준비 (없을 때만 만든다 — verify.mjs가 먼저 깔았을 수 있다) ──
function leaf() {
  return {
    innerHTML: '', textContent: '', value: '', placeholder: '', selectionEnd: 0,
    style: { setProperty() {}, removeProperty() {} }, dataset: {}, children: [], offsetWidth: 0,
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    focus() {}, scrollIntoView() {}, setSelectionRange() {}, click() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
  };
}

// innerHTML 대입을 붙잡는 노드. trapFocus가 querySelector 결과에 접근하므로 leaf를 준다.
function captureNode() {
  const n = leaf();
  let html = '';
  Object.defineProperty(n, 'innerHTML', { get: () => html, set: v => { html = String(v); } });
  n.querySelector = () => leaf();
  return n;
}

function ensureGlobals() {
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.document) {
    globalThis.document = {
      getElementById() { return leaf(); }, querySelector() { return null; },
      querySelectorAll() { return []; }, createElement() { return leaf(); },
      addEventListener() {}, body: leaf(),
      documentElement: { setAttribute() {}, style: { setProperty() {}, removeProperty() {} } },
    };
  }
  if (!globalThis.location) globalThis.location = { hash: '', origin: 'http://localhost' };
  if (!globalThis.history) globalThis.history = { replaceState() {}, pushState() {} };
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (cb) => { try { cb(); } catch (e) {} return 1; };
  if (!globalThis.localStorage) globalThis.localStorage = {
    _d: {}, getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
  };
  if (!globalThis.CSS) globalThis.CSS = { escape: (s) => s };
  if (!globalThis.SUBJECTS) {
    const src = readFileSync(join(assetsDir, 'data.js'), 'utf8');
    const names = ['SUBJECTS', 'ACHIEVEMENTS', 'HS_SEMS', 'HS_SUBJECTS', 'HS_TYPE_COLOR', 'APPSTORE_APPS',
      'RECOMMENDED_SITES', 'SW_DATA', 'LP_METHODS', 'LP_EVAL_METHODS', 'AFFECTIVE', 'AFFECTIVE_VERIFIED', 'ACHV_EXPL'];
    (0, eval)(src + '\n' + names.map(n => `try{globalThis.${n}=${n};}catch(e){}`).join(''));
  }
}

// 화면 하나를 잡아낸다: document.getElementById(id)를 capture로 바꿨다가 되돌린다
function capture(id, fn) {
  const doc = globalThis.document;
  const orig = doc.getElementById;
  const node = captureNode();
  doc.getElementById = (x) => (x === id ? node : leaf());
  try { fn(); } finally { doc.getElementById = orig; }
  return node.innerHTML;
}

export async function renderAll() {
  ensureGlobals();
  const screens = [];

  const { getAchvKey } = await import(pathToFileURL(join(assetsDir, 'utils.js')).href);
  const { openAchvModal } = await import(pathToFileURL(join(assetsDir, 'achv.js')).href);

  for (const subj of globalThis.SUBJECTS) {
    for (const d of (subj.domains || [])) {
      const key = getAchvKey(subj.id, d.name);
      const data = globalThis.ACHIEVEMENTS[key];
      if (!data) continue;
      // app.js domainSectionHtml과 같은 인자로 부른다 (표시 라벨 = "과목 · 단원명")
      const html = capture('achvOverlay', () => openAchvModal(key, subj.accent, subj.name + ' · ' + d.name));
      screens.push({
        id: `achvModal/${subj.id}/${d.name}`,
        kind: 'achvModal',
        html,
        meta: { 과목: subj.name, 단원: d.name, 코드: data.map(x => x.code) },
      });
    }
  }
  // ── 평가계획 미리보기 표 ── 상태 의존 화면이라 __evalTest로 상태를 주입해 렌더한다
  const ep = await import(pathToFileURL(join(assetsDir, 'evalplan.js')).href);
  const 항목 = (type, name, ratio, extra = {}) => ({
    type, name, ratio, scoreChoice: 0, scoreEssay: 0, isEssay: false,
    linkedCodes: [], elements: '', period: '', ...extra,
  });
  const 구성들 = [
    { 이름: '정기시험1+수행3', items: [
      항목('exam', '1학기 지필', 40, { scoreChoice: 70, scoreEssay: 30 }),
      항목('perf', '프로젝트', 30), 항목('perf', '실습', 20), 항목('perf', '서술형', 10, { isEssay: true }),
    ] },
    { 이름: '정기시험2+수행2', items: [
      항목('exam', '중간', 30, { scoreChoice: 80, scoreEssay: 20 }),
      항목('exam', '기말', 30, { scoreChoice: 60, scoreEssay: 40 }),
      항목('perf', '포트폴리오', 25), 항목('perf', '발표', 15),
    ] },
  ];
  for (const c of 구성들) {
    ep.evalState.subjectIdx = 1;
    ep.evalState.generated = true;
    ep.evalState.items = c.items;
    screens.push({
      id: `evalPreview/${c.이름}`,
      kind: 'evalPreview',
      html: ep.__evalTest.previewTableHtml(),
      meta: { 구성: c.이름 },
    });
  }

  return screens;
}

// 자체 실행
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const screens = await renderAll();
  const byKind = {};
  screens.forEach(s => { byKind[s.kind] = (byKind[s.kind] || 0) + 1; });
  console.log('화면 카탈로그: ' + (Object.entries(byKind).map(([k, n]) => `${k} ${n}장`).join(' · ') || '(비어 있음)'));
  const problems = checkCounts(screens);
  problems.forEach(p => console.log('  ✗ ' + p));
  process.exit(problems.length ? 1 : 0);
}
