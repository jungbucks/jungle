# 렌더 불변식 하네스 1단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정글의 화면을 데이터 조합마다 실제로 렌더해, 2026-08-07에 샜던 두 결함(모달 제목 키 노출·표 행 정렬 불일치)이 pre-commit에서 자동으로 걸리게 한다.

**Architecture:** `render.mjs`가 DOM 스텁 위에서 실제 렌더 함수를 호출해 "화면 카탈로그"(데이터 조합마다 한 장)를 만들고, `invariants.mjs`가 그 카탈로그를 읽어 규칙을 검사한다. `verify.mjs`는 둘을 붙여 판정만 한다. 의존은 한 방향이며 세 파일은 서로의 내부를 모른다.

**Tech Stack:** Node.js (의존성 없음), 기존 `tools/verify.mjs`의 DOM 스텁 패턴, 기존 `__xxxTest` export 관례.

## Global Constraints

- **의존성 추가 금지.** npm 패키지를 설치하지 않는다. 정글은 빌드도구·npm이 없는 순수 정적 SPA다.
- **`assets/` 아래 앱 코드의 동작을 바꾸지 않는다.** 이 계획에서 `assets/`에 허용되는 변경은 **테스트용 export 추가 한 줄**뿐이다(Task 3). 렌더 결과가 달라지면 안 된다.
- **속도 예산 1초.** `[6]`은 pre-commit에서 매번 돈다. `node tools/verify.mjs`의 체감 시간이 눈에 띄게 늘면 규칙이 아니라 렌더 범위를 줄인다.
- **한글 주석·한글 메시지.** 기존 `tools/*.mjs`와 같은 문체를 따른다.
- **색상 hex 하드코딩 금지**(CLAUDE.md 규칙 5). 이 계획의 파일들은 색을 다루지 않으므로 해당 없음.
- **커밋마다 `node tools/verify.mjs` 통과.** pre-commit 훅이 자동 강제한다. `--no-verify` 우회 금지.
- 파일 추가 시 `sw.js` ASSETS·`index.html` modulepreload 갱신이 필요한지 확인 — **`tools/`는 배포물이 아니므로 둘 다 해당 없다.** 캐시 버전(`CACHE`)도 올리지 않는다(사이트 파일이 안 바뀜).

## 스펙과 달라지는 점 (의도적)

스펙 `2026-08-08-update-workflow-design.md`의 "1단계 커버 범위"는 화면 5종을 적었으나, **1단계 규칙 3개가 실제로 필요로 하는 화면은 `achvModal`과 `evalPreview` 2종뿐이다.** 규칙이 읽지 않는 화면을 미리 만드는 것은 YAGNI 위반이므로 1단계는 2종만 만든다. 나머지 3종(`achvSemester`·`domainHeader`·`stdCard`)은 그것을 읽는 규칙과 함께 2단계에서 추가한다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `tools/render.mjs` (신규) | 환경 준비 + 화면 카탈로그 생성. 규칙을 모른다 |
| `tools/invariants.mjs` (신규) | 규칙 목록 + 규칙 자체 테스트. 렌더 방법을 모른다 |
| `tools/verify.mjs` (수정) | `[6]` 배선, 기존 링크 검사를 `[7]`로 이동 |
| `assets/evalplan.js` (수정) | `__evalTest`에 `evalPreviewTableHtml` 추가 (1줄) |
| `CLAUDE.md` (수정) | 규칙 1에 `[6]` 반영, "결함은 규칙으로 승격" 규칙 신설 |

---

### Task 1: 화면 카탈로그 — achv 모달 27장

**Files:**
- Create: `tools/render.mjs`

**Interfaces:**
- Consumes: `assets/utils.js`의 `getAchvKey(subjId, domainName)`, `assets/achv.js`의 `openAchvModal(domainName, accent, label)`
- Produces:
  - `renderAll(): Promise<Screen[]>` — `Screen = { id: string, kind: string, html: string, meta: object }`
  - `EXPECTED_MIN: Record<string, number>` — kind별 최소 장수. 예: `{ achvModal: 27 }`
  - `checkCounts(screens): string[]` — 최소 장수 미달 목록(빈 배열이면 정상)

- [ ] **Step 1: 실패하는 자체 실행 만들기**

`tools/render.mjs`를 만들고 **아직 구현하지 않은 채** 자체 실행부만 넣는다.

```js
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
export const EXPECTED_MIN = { achvModal: 27 };

export function checkCounts(screens) {
  const problems = [];
  for (const [kind, min] of Object.entries(EXPECTED_MIN)) {
    const n = screens.filter(s => s.kind === kind).length;
    if (n < min) problems.push(`${kind}: ${n}장 (최소 ${min}장이어야 함 — 렌더가 죽었을 수 있음)`);
  }
  return problems;
}

export async function renderAll() {
  return [];
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
```

- [ ] **Step 2: 실행해서 실패를 확인**

Run: `node tools/render.mjs`
Expected: `화면 카탈로그: (비어 있음)` 과 `✗ achvModal: 0장 (최소 27장이어야 함 …)`, 종료코드 1

- [ ] **Step 3: 환경 준비 구현**

`renderAll()` 위에 아래를 넣는다. `verify.mjs`가 먼저 전역을 깔아둔 경우(=`[3]` 이후 import)와 단독 실행 둘 다에서 동작해야 하므로 **전역은 없을 때만 만든다.**

```js
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
```

- [ ] **Step 4: achv 모달 27장 렌더 구현**

`renderAll()`을 아래로 교체한다.

```js
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
  return screens;
}
```

- [ ] **Step 5: 실행해서 통과 확인**

Run: `node tools/render.mjs`
Expected: `화면 카탈로그: achvModal 27장`, 종료코드 0

- [ ] **Step 6: 카탈로그가 진짜 내용을 담았는지 눈으로 1회 확인**

Run:
```bash
node -e "import('./tools/render.mjs').then(async m=>{const s=await m.renderAll();const x=s.find(x=>x.id==='achvModal/high/데이터');console.log(x.meta);console.log(x.html.slice(0,300));})"
```
Expected: `meta`에 `과목: '고등학교 정보'`, `단원: '데이터'`가 보이고, html에 `id="achvModalTitle"`과 `고등학교 정보 · 데이터`가 들어 있다.

- [ ] **Step 7: 커밋**

```bash
git add tools/render.mjs
git commit -m "feat(harness): 화면 카탈로그 — achv 모달을 단원 조합마다 실제 렌더"
```

---

### Task 2: 규칙 엔진 + achv 제목 규칙 2개

**Files:**
- Create: `tools/invariants.mjs`

**Interfaces:**
- Consumes: `tools/render.mjs`의 `renderAll()`, `checkCounts(screens)`
- Produces:
  - `RULES: Rule[]` — `Rule = { id, 왜, 대상, 검사(screen) => string|null, 가짜: {html, meta} }`
  - `runInvariants(screens): { checked: number, rules: number, violations: string[], selfFails: string[] }`

- [ ] **Step 1: 실패하는 규칙 자체 테스트부터 쓴다**

`tools/invariants.mjs`를 만든다. **규칙 배열은 비워 두고** 자체 테스트 골격만 먼저 넣는다.

```js
// ============================================================
//  정글 렌더 불변식 규칙
//  실행:  node tools/invariants.mjs   (위반 있으면 종료코드 1)
//
//  규칙 하나는 반드시 "가짜"(일부러 깨진 화면)를 함께 갖는다.
//  하네스는 매번 "이 규칙이 그 가짜를 실제로 잡는가"를 확인한다.
//  없으면 영원히 통과만 하는 죽은 규칙이 쌓이고, 그물이 있다는 착각만 남는다.
//
//  ⚠️ 이 파일은 렌더 방법을 모른다. 렌더는 tools/render.mjs에 있다.
// ============================================================
import { pathToFileURL } from 'node:url';
import { renderAll, checkCounts } from './render.mjs';

const 제목 = s => (s.html.match(/id="achvModalTitle"[^>]*>([^<]*)</) || [, ''])[1];

export const RULES = [];

export function runInvariants(screens) {
  const violations = [];
  const selfFails = [];

  // 1) 카탈로그가 비지 않았는가
  checkCounts(screens).forEach(p => violations.push(`[카탈로그] ${p}`));

  // 2) 규칙마다: 가짜를 잡는지 먼저 확인한 뒤 진짜 화면에 적용
  for (const r of RULES) {
    if (r.보류) continue;
    if (!r.가짜) { selfFails.push(`${r.id}: 가짜 화면이 없다 — 규칙이 살아 있는지 확인할 수 없다`); continue; }
    const fake = { kind: r.대상, id: `가짜/${r.id}`, ...r.가짜 };
    if (!r.검사(fake)) selfFails.push(`${r.id}: 가짜 화면을 못 잡았다 — 규칙이 죽었다`);

    for (const s of screens) {
      if (s.kind !== r.대상) continue;
      const why = r.검사(s);
      if (why) violations.push(`[${r.id}] ${s.id} — ${why}\n      ↳ ${r.왜}`);
    }
  }
  return { checked: screens.length, rules: RULES.filter(r => !r.보류).length, violations, selfFails };
}

// 자체 실행
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const screens = await renderAll();
  const r = runInvariants(screens);
  console.log(`화면 ${r.checked}장 × 규칙 ${r.rules}개`);
  r.selfFails.forEach(m => console.log('  ✗ [자체] ' + m));
  r.violations.forEach(m => console.log('  ✗ ' + m));
  if (!r.selfFails.length && !r.violations.length) console.log('  ✓ 위반 없음');
  process.exit(r.selfFails.length + r.violations.length ? 1 : 0);
}
```

- [ ] **Step 2: 실행해서 "규칙 0개"를 확인**

Run: `node tools/invariants.mjs`
Expected: `화면 27장 × 규칙 0개` / `✓ 위반 없음`, 종료코드 0
(규칙이 없으니 통과한다. 다음 단계에서 규칙을 넣는다.)

- [ ] **Step 3: 규칙 2개를 넣는다**

`export const RULES = [];` 를 아래로 교체한다.

```js
export const RULES = [
  {
    id: 'achv-title-no-internal-key',
    왜: '모달 제목은 사용자가 읽는 이름이다. ACHIEVEMENTS 조회 키(_고/_cs)가 새면 단원명과 어긋난다.',
    대상: 'achvModal',
    검사: s => {
      const t = 제목(s);
      return /_고|_cs/.test(t) ? `제목에 내부 키가 노출됐다: "${t}"` : null;
    },
    가짜: { html: '<span id="achvModalTitle">📊 데이터_고 — ABCDE 성취수준</span>', meta: { 단원: '데이터' } },
  },
  {
    id: 'modal-title-matches-unit',
    왜: '제목이 그 화면의 단원명을 담지 않으면 사용자는 다른 단원을 보고 있다고 오해한다.',
    대상: 'achvModal',
    검사: s => {
      const t = 제목(s);
      if (!t) return '제목 요소를 찾지 못했다';
      return t.includes(s.meta.단원) ? null : `제목 "${t}" 이 단원명 "${s.meta.단원}" 을 담지 않는다`;
    },
    가짜: { html: '<span id="achvModalTitle">📊 알고리즘 — ABCDE 성취수준</span>', meta: { 단원: '데이터' } },
  },
];
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `node tools/invariants.mjs`
Expected: `화면 27장 × 규칙 2개` / `✓ 위반 없음`, 종료코드 0

- [ ] **Step 5: 규칙이 진짜 살아 있는지 확인 (핵심)**

`assets/achv.js:63`의 `esc(label || domainName)` 을 잠시 `esc(domainName)` 으로 되돌린다(2026-08-07 결함 재현).

Run: `node tools/invariants.mjs`
Expected: **9건 위반** — `[achv-title-no-internal-key] achvModal/high/컴퓨팅 시스템 …` 등 고등학교 정보 5건 + 정보과학 4건. `modal-title-matches-unit`은 통과한다(`데이터_고`는 `데이터`를 포함하므로) — **두 규칙이 서로 다른 것을 지킨다는 증거다.**

되돌린 뒤:

Run: `git checkout assets/achv.js && node tools/invariants.mjs`
Expected: `✓ 위반 없음`

- [ ] **Step 6: 커밋**

```bash
git add tools/invariants.mjs
git commit -m "feat(harness): 렌더 불변식 규칙 엔진 + achv 제목 규칙 2개

규칙마다 일부러 깨진 가짜 화면을 붙여 규칙 자체를 매번 검증한다."
```

---

### Task 3: 평가계획 미리보기 화면 + 표 정렬 규칙

**Files:**
- Modify: `assets/evalplan.js:429` (`__evalTest` 에 1개 추가)
- Modify: `tools/render.mjs` (`EXPECTED_MIN`, `renderAll`)
- Modify: `tools/invariants.mjs` (`RULES` 에 1개 추가)

**Interfaces:**
- Consumes: `assets/evalplan.js`의 `evalState`(이미 export됨), `__evalTest.previewTableHtml`
- Produces: `kind: 'evalPreview'` 화면 2장. `meta = { 구성: string }`

- [ ] **Step 1: 실패하는 최소 장수 단언부터 건다**

`tools/render.mjs`의 `EXPECTED_MIN`을 바꾼다.

```js
export const EXPECTED_MIN = { achvModal: 27, evalPreview: 2 };
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node tools/render.mjs`
Expected: `✗ evalPreview: 0장 (최소 2장이어야 함 — 렌더가 죽었을 수 있음)`, 종료코드 1

- [ ] **Step 3: 표 생성 함수를 테스트용으로 연다**

`assets/evalplan.js` 맨 아래 `__evalTest` 를 찾아 `previewTableHtml` 을 추가한다. **다른 줄은 건드리지 않는다.**

변경 전:
```js
export const __evalTest = { ratioSum: evalRatioSum, essayRatio: evalEssayRatio, distribute: evalDistribute };
```
변경 후:
```js
export const __evalTest = { ratioSum: evalRatioSum, essayRatio: evalEssayRatio, distribute: evalDistribute, previewTableHtml: evalPreviewTableHtml };
```

- [ ] **Step 4: evalPreview 2장을 카탈로그에 넣는다**

`tools/render.mjs`의 `renderAll()` 안, `return screens;` 바로 앞에 넣는다.

```js
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

```

- [ ] **Step 5: 실행해서 통과 확인**

Run: `node tools/render.mjs`
Expected: `화면 카탈로그: achvModal 27장 · evalPreview 2장`, 종료코드 0

- [ ] **Step 6: 표 정렬 규칙을 넣는다**

`tools/invariants.mjs`의 `RULES` 배열 끝에 추가한다. 헬퍼는 `제목` 정의 아래에 둔다.

```js
// 평가계획 표: 라벨 칸은 배경색으로 구분된다(labelStyle에 background:var(--g50)).
// 나머지가 데이터 칸이며, 한 행의 데이터 칸은 정렬이 서로 같아야 한다.
const 행별정렬 = html => {
  const out = [];
  for (const row of html.match(/<tr>[\s\S]*?<\/tr>/g) || []) {
    const tds = [...row.matchAll(/<td\s+style="([^"]*)"/g)].map(m => m[1]);
    const 데이터칸 = tds.filter(st => !st.includes('background:var(--g50)'));
    if (데이터칸.length < 2) continue;
    out.push(데이터칸.map(st => (st.match(/text-align:\s*([a-z]+)/) || [, '(없음)'])[1]));
  }
  return out;
};
```

```js
  {
    id: 'table-row-align-consistent',
    왜: '한 행에서 어떤 칸만 정렬이 다르면 표가 어긋나 보인다. 2026-08-07 평가계획 표에서 정기시험 칸만 좌측이었다.',
    대상: 'evalPreview',
    검사: s => {
      for (const aligns of 행별정렬(s.html)) {
        const uniq = [...new Set(aligns)];
        if (uniq.length > 1) return `한 행의 데이터 칸 정렬이 섞였다: ${aligns.join(' / ')}`;
      }
      return null;
    },
    가짜: { html: '<tr><td style="background:var(--g50)">영역 만점</td>' +
                  '<td style="padding:10px">선택형 70점</td>' +
                  '<td style="padding:10px;text-align:center">30%</td></tr>', meta: {} },
  },
```

- [ ] **Step 7: 실행해서 통과 확인**

Run: `node tools/invariants.mjs`
Expected: `화면 29장 × 규칙 3개` / `✓ 위반 없음`, 종료코드 0

- [ ] **Step 8: 규칙이 진짜 살아 있는지 확인**

`assets/evalplan.js:340`에서 `'line-height:1.8;text-align:center'` 를 `'line-height:1.8'` 로 잠시 되돌린다(2026-08-07 결함 재현).

Run: `node tools/invariants.mjs`
Expected: `[table-row-align-consistent] evalPreview/정기시험1+수행3 — 한 행의 데이터 칸 정렬이 섞였다: (없음) / center / center / center` 형태로 **2장 모두 위반**

되돌린 뒤:

Run: `git checkout assets/evalplan.js && node tools/invariants.mjs`
Expected: `✓ 위반 없음`

⚠️ 되돌릴 때 Step 3의 `__evalTest` 변경까지 날아간다. `git checkout` 대신 해당 줄만 손으로 되돌리거나, 되돌린 뒤 Step 3을 다시 적용한다.

- [ ] **Step 9: 커밋**

```bash
git add assets/evalplan.js tools/render.mjs tools/invariants.mjs
git commit -m "feat(harness): 평가계획 미리보기 화면 + 표 행 정렬 규칙"
```

---

### Task 4: verify 배선 + 문서 갱신

**Files:**
- Modify: `tools/verify.mjs:6-12` (머리말 주석), `tools/verify.mjs:141-151` (링크를 `[7]`로), 그 사이에 `[6]` 삽입
- Modify: `CLAUDE.md` (규칙 1, 규칙 신설)
- Modify: `tools/README.md`

**Interfaces:**
- Consumes: `tools/render.mjs`의 `renderAll()`, `tools/invariants.mjs`의 `runInvariants(screens)`
- Produces: 없음 (최종 배선)

- [ ] **Step 1: verify.mjs 머리말 주석 갱신**

`tools/verify.mjs` 6~12행의 검사 목록에 두 줄을 더한다.

```js
//   [5] 계산 로직 단위 테스트 — gradecalc·chasi·evalplan 회귀 (tools/test.mjs)
//   [6] 렌더 불변식 — 화면을 데이터 조합마다 렌더해 규칙 검사 (tools/render.mjs + invariants.mjs)
//   [7] 외부 링크 생존 — --links 플래그 시에만
```

- [ ] **Step 2: `[6]` 단계를 삽입**

`// ── [6] 외부 링크 생존` 주석 블록 **바로 앞**에 넣는다.

```js
// ── [6] 렌더 불변식 ─────────────────────────────────────────
//  계산이 아니라 "화면에 무엇이 찍히는가"를 지킨다. 규칙은 tools/invariants.mjs.
head('[6] 렌더 불변식 (화면 카탈로그 × 규칙)');
try {
  const { renderAll } = await import(pathToFileURL(join(root, 'tools', 'render.mjs')).href);
  const { runInvariants } = await import(pathToFileURL(join(root, 'tools', 'invariants.mjs')).href);
  const screens = await renderAll();
  const r = runInvariants(screens);
  r.selfFails.forEach(m => fail('규칙 자체 검증 — ' + m));
  r.violations.forEach(m => fail(m));
  if (!r.selfFails.length && !r.violations.length) ok(`화면 ${r.checked}장 × 규칙 ${r.rules}개 — 위반 없음`);
} catch (e) {
  fail('렌더 불변식 실행 실패 — ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
}

```

- [ ] **Step 3: 링크 검사를 `[7]`로 바꾼다**

같은 파일에서 두 곳의 `[6]`을 `[7]`로 고친다.

```js
// ── [7] 외부 링크 생존 (--links 플래그 시에만) ──────────────
```
```js
  head('[7] 외부 링크 생존 (--links)');
```

- [ ] **Step 4: verify 전체 실행**

Run: `node tools/verify.mjs`
Expected: `[6] 렌더 불변식` 단계가 보이고 `✓ 화면 29장 × 규칙 3개 — 위반 없음`, 최종 `✅ 모든 검증 통과`

- [ ] **Step 5: 속도 예산 확인**

Run: `node -e "const t=Date.now();import('./tools/render.mjs').then(async m=>{await m.renderAll();console.log('렌더',Date.now()-t,'ms')})"`
Expected: 1000ms 미만. 넘으면 **규칙이 아니라 렌더 범위**를 줄인다(Global Constraints).

- [ ] **Step 6: CLAUDE.md 갱신**

「절대 규칙」1번의 괄호 안 항목 설명을 고친다.

변경 전: `5항목(import 정합성/문법/그래프 로드+init/SW 프리캐시 존재/**[5] 계산 단위 테스트 38건**)`
변경 후: `6항목(import 정합성/문법/그래프 로드+init/SW 프리캐시 존재/**[5] 계산 단위 테스트**/**[6] 렌더 불변식**)`

그리고 「절대 규칙」끝에 13번을 신설한다.

```markdown
13. **결함을 고치면 그 결함을 잡았을 규칙을 함께 추가한다** → `tools/invariants.mjs`. 규칙에는 한글 `왜`와 **일부러 깨진 `가짜` 화면**을 반드시 붙인다(가짜가 없으면 규칙이 죽어도 알 수 없다). 화면 종류를 새로 만들면 `tools/render.mjs`의 `EXPECTED_MIN`에 최소 장수를 등록한다. 이 순환이 없으면 규칙 수는 첫날 이후 늘지 않는다.
```

- [ ] **Step 7: tools/README.md 갱신**

`## 검사 항목` 표는 현재 1~4행만 있고 **`[5]`가 빠져 있다.** 5·6·7 세 행을 이어 붙인다(마지막 `| 4 | …` 행 바로 아래).

```markdown
| 5 | **계산 로직 단위 테스트** | gradecalc·chasi·evalplan·achv·affective의 순수 계산 회귀. 성적·차시 계산이 조용히 틀리는 것을 막는다. (`tools/test.mjs`) |
| 6 | **렌더 불변식** | 계산이 아니라 **화면에 무엇이 찍히는가**를 지킨다. 화면을 데이터 조합마다 렌더해 규칙을 건다. 2026-08-07 모달 제목·표 정렬 결함이 이 그물에 안 걸려서 만들었다. (`tools/render.mjs` + `tools/invariants.mjs`) |
| 7 | **외부 링크 생존** | `--links` 플래그 시에만. 네트워크 의존이라 기본 게이트에서 제외. (`tools/linkcheck.mjs`) |
```

그리고 표 아래에 한 줄 덧붙인다.

```markdown
> `[6]`의 규칙을 늘리는 법은 CLAUDE.md 절대 규칙 13번 참고. 규칙에는 한글 `왜`와 일부러 깨진 `가짜` 화면이 반드시 붙는다.
```

- [ ] **Step 8: 커밋**

```bash
git add tools/verify.mjs tools/README.md CLAUDE.md
git commit -m "feat(verify): [6] 렌더 불변식 배선 — 링크 검사는 [7]로

결함을 규칙으로 승격하는 순환을 CLAUDE.md 규칙 13으로 못 박음."
```

---

## 완료 판정

- `node tools/verify.mjs` 가 `[1]`~`[6]` 전부 통과
- `node tools/invariants.mjs` 단독 실행 통과 (화면 29장 × 규칙 3개)
- Task 2 Step 5 / Task 3 Step 8 에서 **2026-08-07 결함 두 건을 실제로 재현시켜 규칙이 잡는 것을 눈으로 확인**
- 렌더 1초 미만
- `assets/` 변경은 `__evalTest` 한 줄뿐 — 앱 동작 무변경

## 2단계로 미루는 것

`achvSemester`·`domainHeader`·`stdCard` 화면과 나머지 규칙 4개(`all-codes-rendered`·`copy-matches-screen`·`user-input-escaped`·`no-hardcoded-hex`), `INBOX.md`, 세션 훅 2개.
