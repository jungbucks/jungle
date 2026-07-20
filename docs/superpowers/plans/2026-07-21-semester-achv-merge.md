# 학기 단위 성취수준 문단 병합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 성취기준을 골라 체크하면 A~E 각 레벨이 한 문단으로 병합되어 평가계획서에 그대로 붙여넣을 수 있게 한다.

**Architecture:** 선택 UI는 기존 공용 모달 `stdpicker.js`를 재사용하고(신규 UI 없음), `achv.js`에 순수 함수 `mergeLevelTexts(texts, mode)`와 수집 함수를 신설해 결과 모달을 병합판으로 교체한다. 진입 버튼(`app.js`)은 결과가 아니라 선택기를 먼저 연다.

**Tech Stack:** 바닐라 ES 모듈, 빌드 도구 없음. 테스트는 `tools/test.mjs`(node, DOM 스텁).

**설계 문서:** `docs/superpowers/specs/2026-07-21-semester-achv-merge-design.md`

## Global Constraints

- **모든 수정 후 `node tools/verify.mjs`** — git pre-commit 훅이 강제한다. `--no-verify` 우회 금지.
- **인라인 이벤트 핸들러(`onclick=`) 금지** — CSP에 차단됨. `data-onclick` + `registerActions()` 위임만 사용.
- **색상 hex 하드코딩 금지 → `:root` 토큰만.** 예외: 클립보드로 한글에 붙여넣는 HTML 생성 코드는 CSS 변수가 해석되지 않으므로 리터럴 hex 유지.
- **13px 미만 텍스트 금지**(12px는 배지 하한). 본문성은 15px+.
- **배포 묶음마다 `sw.js`의 `CACHE = 'jungle-vNN'` +1** — 이 계획 전체가 한 묶음이므로 **마지막 Task에서 한 번만** 올린다. 현재 `jungle-v32` → `jungle-v33`.
- **파일 추가/이름변경 없음** — 따라서 `sw.js` ASSETS 배열과 `index.html` modulepreload 목록은 건드리지 않는다.
- 병합 어미 교대 순서는 **`으며,` → `고,` → 종결** 고정.
- 규칙(`있다.`/`한다.`) 밖 어미는 **변환하지 않고 원문 그대로** 이어 붙인다.

---

### Task 1: `mergeLevelTexts` 순수 함수

**Files:**
- Modify: `assets/achv.js` (파일 상단, `openAchvModal` 앞)
- Modify: `tools/test.mjs:171` 위 (새 `runAchvTests` 추가) 및 `runAllTests`
- Test: `tools/test.mjs`

**Interfaces:**
- Produces: `mergeLevelTexts(texts: string[], mode: 'join'|'raw') -> string`, `__achvTest = { mergeLevelTexts }` (achv.js에서 export)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tools/test.mjs`의 `export function runEvalTests() {` 바로 **앞**에 삽입:

```js
export function runAchvTests() {
  const { mergeLevelTexts } = __achvTest;
  let pass = 0; const fails = [];
  const eq = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) pass++; else fails.push(`${name}: got ${g} · want ${w}`); };

  // join: 마지막 문장만 종결형으로 남고, 앞 문장은 으며 → 고 순으로 교대
  eq('join 2개 (있다)',
    mergeLevelTexts(['가를 설명할 수 있다.', '나를 분석할 수 있다.'], 'join'),
    '가를 설명할 수 있으며, 나를 분석할 수 있다.');
  eq('join 3개 어미 교대',
    mergeLevelTexts(['가할 수 있다.', '나할 수 있다.', '다할 수 있다.'], 'join'),
    '가할 수 있으며, 나할 수 있고, 다할 수 있다.');
  eq('join 4개 어미 교대 반복',
    mergeLevelTexts(['가할 수 있다.', '나할 수 있다.', '다할 수 있다.', '라할 수 있다.'], 'join'),
    '가할 수 있으며, 나할 수 있고, 다할 수 있으며, 라할 수 있다.');
  // "한다." 종결 (컴퓨팅 시스템 영역 12건이 이 형태)
  eq('join 한다 종결',
    mergeLevelTexts(['시스템을 구성한다.', '시스템을 효과적으로 구성한다.'], 'join'),
    '시스템을 구성하며, 시스템을 효과적으로 구성한다.');
  eq('join 있다+한다 혼합',
    mergeLevelTexts(['가할 수 있다.', '나를 구성한다.', '다할 수 있다.'], 'join'),
    '가할 수 있으며, 나를 구성하고, 다할 수 있다.');
  // 규칙 밖 어미는 원문 보존 (데이터가 늘어도 문장이 깨지지 않게 하는 안전판)
  eq('join 규칙 밖 어미 원문 보존',
    mergeLevelTexts(['알 수 없음', '가할 수 있다.'], 'join'),
    '알 수 없음 가할 수 있다.');
  // 1개만 선택하면 연결이 일어나지 않는다
  eq('join 1개 = 원문', mergeLevelTexts(['가할 수 있다.'], 'join'), '가할 수 있다.');
  eq('raw 1개 = 원문', mergeLevelTexts(['가할 수 있다.'], 'raw'), '가할 수 있다.');
  // raw: 원문을 공백 1칸으로만 잇는다
  eq('raw 2개 공백 연결',
    mergeLevelTexts(['가할 수 있다.', '나할 수 있다.'], 'raw'),
    '가할 수 있다. 나할 수 있다.');
  // 빈 값·공백 처리
  eq('빈 배열 = 빈 문자열', mergeLevelTexts([], 'join'), '');
  eq('빈 문자열 항목 제거', mergeLevelTexts(['', '  ', '가할 수 있다.'], 'join'), '가할 수 있다.');
  eq('mode 생략 시 join', mergeLevelTexts(['가할 수 있다.', '나할 수 있다.']), '가할 수 있으며, 나할 수 있다.');

  return { pass, fail: fails.length, fails };
}
```

같은 파일 `tools/test.mjs:56` 아래 import 줄에 추가:

```js
const { __achvTest } = await import('../assets/achv.js');
```

`runAllTests()`의 `parts` 배열에 achv를 넣는다:

```js
  const parts = [['gradecalc', runGradeTests()], ['chasi', runChasiTests()], ['evalplan', runEvalTests()], ['achv', runAchvTests()]];
```

- [ ] **Step 2: 실패하는 것을 확인한다**

Run: `node tools/test.mjs`
Expected: FAIL — `__achvTest`가 아직 없으므로 `Cannot destructure property 'mergeLevelTexts' of 'undefined'` 류의 에러로 죽는다.

- [ ] **Step 3: 최소 구현**

`assets/achv.js`의 `import` 줄 바로 아래에 삽입:

```js
// ── 학기 단위 성취수준: 레벨 문장 병합 (순수 함수 — DOM 모름) ──
// 마지막 문장은 원문 그대로 두고, 앞 문장의 종결어미만 연결어미로 바꾼다.
// 어미는 '으며,' → '고,' 순으로 교대해 단조로움을 피한다.
// 규칙(있다./한다.) 밖 어미는 변환하지 않는다 — 데이터가 늘어도 문장이 깨지지 않게.
function achvToConnective(sentence, i) {
  const useEuMyeo = i % 2 === 0;
  const s = sentence.replace(/\s+$/, '');
  if (/있다\.$/.test(s)) return s.replace(/있다\.$/, useEuMyeo ? '있으며,' : '있고,');
  if (/한다\.$/.test(s)) return s.replace(/한다\.$/, useEuMyeo ? '하며,' : '하고,');
  return s;
}

function mergeLevelTexts(texts, mode = 'join') {
  const list = (texts || []).map(t => (t || '').trim()).filter(Boolean);
  if (!list.length) return '';
  if (mode === 'raw') return list.join(' ');
  return list.map((t, i) => (i === list.length - 1 ? t : achvToConnective(t, i))).join(' ');
}
```

`achv.js` 맨 아래 `export { ... }` 줄 **뒤**에 추가:

```js
export const __achvTest = { mergeLevelTexts };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node tools/test.mjs`
Expected: PASS — `achv: 12건 통과`, 합계 50건 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add assets/achv.js tools/test.mjs
git commit -m "feat(achv): 성취수준 레벨 문장 병합 순수 함수 + 단위 테스트 12건"
```

---

### Task 2: 선택된 성취기준 수집 · 레벨별 문단 조립

**Files:**
- Modify: `assets/achv.js` (기존 `collectSemesterRows` 교체)
- Modify: `tools/test.mjs` (`runAchvTests`에 케이스 추가)

**Interfaces:**
- Consumes: `mergeLevelTexts(texts, mode)` (Task 1)
- Produces: `collectSelectedStds(subjId: string, codes: string[]) -> { subj, stds } | null`, `buildLevelParagraphs(stds, mode) -> { A:{text,codes}, B:…, C:…, D:…, E:… }`. 둘 다 `__achvTest`에 추가 export.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`runAchvTests()`의 `return` 문 **앞**에 삽입:

```js
  // ── 실제 데이터로 수집·조립 (데이터가 바뀌면 잡히도록 실제 ACHIEVEMENTS 사용) ──
  const { collectSelectedStds, buildLevelParagraphs } = __achvTest;

  const picked = collectSelectedStds('middle', ['[9정03-01]', '[9정03-02]']);
  eq('수집 2건', picked.stds.length, 2);
  eq('수집 순서 = 코드순', picked.stds.map(s => s.code), ['[9정03-01]', '[9정03-02]']);
  eq('과목명', picked.subj.name, '중학교 정보');
  eq('없는 코드는 무시', collectSelectedStds('middle', ['[9정03-01]', '[9정99-99]']).stds.length, 1);
  eq('빈 선택', collectSelectedStds('middle', []).stds.length, 0);
  eq('없는 과목 = null', collectSelectedStds('nope', ['[9정03-01]']), null);

  // 고등학교는 getAchvKey가 '_고' 접미사를 붙여야 찾힌다 (키 접미사 회귀 방지)
  eq('고등 과목 수집', collectSelectedStds('high', ['[12정03-01]']).stds.length, 1);

  const paras = buildLevelParagraphs(picked.stds, 'join');
  eq('5개 레벨 모두 생성', Object.keys(paras), ['A', 'B', 'C', 'D', 'E']);
  eq('A 문단은 마지막만 종결형', /있다\.$/.test(paras.A.text), true);
  eq('A 문단에 연결어미 등장', paras.A.text.includes('있으며,'), true);
  eq('A 출처 코드 2건', paras.A.codes, ['[9정03-01]', '[9정03-02]']);
  eq('raw 모드는 연결어미 없음', buildLevelParagraphs(picked.stds, 'raw').A.text.includes('있으며,'), false);
  eq('빈 선택이면 빈 문단', buildLevelParagraphs([], 'join').A.text, '');
```

- [ ] **Step 2: 실패하는 것을 확인한다**

Run: `node tools/test.mjs`
Expected: FAIL — `Cannot destructure property 'collectSelectedStds'` (아직 export 안 됨).

- [ ] **Step 3: 구현 — 기존 `collectSemesterRows`를 교체**

`assets/achv.js`의 `collectSemesterRows` 함수 **전체를 삭제**하고 그 자리에 넣는다:

```js
// ── 학기 단위 성취수준: 선택된 성취기준 수집 ──
// stdpicker가 코드순으로 정렬해 넘기지만, 여기서는 단원 순회 순서를 따른다
// (같은 과목 안에서 두 순서는 일치한다).
function collectSelectedStds(subjId, codes) {
  const subj = SUBJECTS.find(s => s.id === subjId);
  if (!subj || !subj.domains) return null;
  const want = new Set(codes || []);
  const stds = [];
  subj.domains.forEach(d => {
    const arr = ACHIEVEMENTS[getAchvKey(subjId, d.name)];
    if (!arr) return;
    arr.forEach(std => { if (want.has(std.code)) stds.push(std); });
  });
  return { subj, stds };
}

// 레벨별로 한 문단씩 조립. codes는 화면에 표시할 출처 배지용(복사본에는 안 들어감).
function buildLevelParagraphs(stds, mode) {
  const out = {};
  ['A', 'B', 'C', 'D', 'E'].forEach(g => {
    const has = (stds || []).filter(s => ((s.levels && s.levels[g]) || '').trim());
    out[g] = {
      text: mergeLevelTexts(has.map(s => s.levels[g]), mode),
      codes: has.map(s => s.code),
    };
  });
  return out;
}
```

`__achvTest` export를 확장한다:

```js
export const __achvTest = { mergeLevelTexts, collectSelectedStds, buildLevelParagraphs };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node tools/test.mjs`
Expected: PASS — `achv: 25건 통과`, 합계 63건.

이 시점에 `achvBuildSemesterHtml`·`achvBuildSemesterPlain`·`openSemesterAchvModal`·`achvCopyAllSem`이 삭제된 `collectSemesterRows`를 참조해 깨져 있다. Task 3에서 교체하므로 **아직 `verify.mjs`는 통과하지 않는다.** 커밋은 Task 3 끝에서 함께 한다.

- [ ] **Step 5: 커밋하지 않고 Task 3으로 넘어간다**

pre-commit 훅이 verify를 강제하므로 여기서 커밋하면 실패한다. Task 3 완료 후 한 번에 커밋한다.

---

### Task 3: 결과 모달을 병합판으로 교체 (토글 · 왕복 · 복사)

**Files:**
- Modify: `assets/achv.js` (`achvBuildSemesterHtml`·`achvBuildSemesterPlain`·`openSemesterAchvModal`·`achvCopyAllSem` 교체, 모듈 상태 2개 추가, `registerActions` 확장)

**Interfaces:**
- Consumes: `collectSelectedStds`, `buildLevelParagraphs` (Task 2), `openStdPicker` (stdpicker.js), `clipboardWriteHTML`·`uiToast` (utils.js)
- Produces: `openSemesterAchvModal(subjId: string, accent: string, codes: string[])` — **시그니처가 바뀐다**(3번째 인자 신설). Task 4의 `app.js`가 이 시그니처에 의존한다.

- [ ] **Step 1: import에 `openStdPicker`를 추가한다**

`assets/achv.js` 1행을 다음 2줄로 교체:

```js
import { esc, trapFocus, releaseFocus, registerActions, clipboardWriteHTML, uiToast, getAchvKey } from './utils.js';
import { openStdPicker } from './stdpicker.js';
```

- [ ] **Step 2: 모듈 상태를 추가한다**

`mergeLevelTexts` 함수 정의 **앞**에 삽입:

```js
// ── 학기 단위 성취수준 세션 상태 (localStorage 미사용 — 새로고침하면 초기화) ──
let _semSubjId = '';      // 직전에 연 과목. 과목이 바뀌면 선택을 비운다.
let _semAccent = '';
let _semSelected = [];    // 선택된 성취기준 코드
let _semMode = 'join';    // 'join' | 'raw'
```

- [ ] **Step 3: 진입 함수를 새로 쓴다 (선택기 → 결과)**

`openSemesterAchvModal` 함수 **전체를 삭제**하고 그 자리에 넣는다:

```js
// 진입점: 성취기준 선택기를 먼저 연다. 확인하면 결과 모달로 넘어간다.
function openSemesterAchvPicker(subjId, accent) {
  // 과목이 바뀌면 이전 과목의 코드를 들고 있으면 안 된다 (조용히 틀린 결과 방지)
  if (subjId !== _semSubjId) { _semSelected = []; _semSubjId = subjId; }
  _semAccent = accent;
  const subjectIdx = SUBJECTS.findIndex(s => s.id === subjId);
  openStdPicker({
    title: '학기 단위 성취수준 — 성취기준 선택',
    subjectIdx: subjectIdx < 0 ? 1 : subjectIdx,
    preselected: _semSelected,
    selectAll: true,
    onConfirm: (codes, subjIdx) => {
      const picked = SUBJECTS[subjIdx];
      if (picked && picked.id !== _semSubjId) { _semSubjId = picked.id; _semAccent = picked.accent; }
      _semSelected = codes;
      openSemesterAchvModal(_semSubjId, _semAccent, codes);
    },
  });
}

function openSemesterAchvModal(subjId, accent, codes) {
  const res = collectSelectedStds(subjId, codes);
  if (!res) return;
  const { subj, stds } = res;
  if (!stds.length) { uiToast('성취기준을 하나 이상 선택하세요.', { isErr: true }); openSemesterAchvPicker(subjId, accent); return; }
  _semSubjId = subjId; _semAccent = accent; _semSelected = codes;
  const paras = buildLevelParagraphs(stds, _semMode);
  const gradeColors = { A:'var(--ok)', B:'var(--accent)', C:'var(--plan)', D:'var(--warn)', E:'var(--danger)' };
  let bodyHtml = '';
  ['A','B','C','D','E'].forEach(g => {
    const p = paras[g];
    if (!p.text) return;
    bodyHtml += `<div class="achv-para">
      <div class="achv-para-hd" style="color:${gradeColors[g]}">${g}</div>
      <p class="achv-para-tx">${esc(p.text)}</p>
      <div class="achv-para-src">${p.codes.map(c => `<span style="color:${accent}">${esc(c)}</span>`).join('')}</div>
    </div>`;
  });
  let overlay = document.getElementById('achvOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'achv-overlay';
    overlay.id = 'achvOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeAchvModal(); };
    document.body.appendChild(overlay);
  }
  const seg = (m, label) => `<button class="achv-seg${_semMode === m ? ' on' : ''}" data-onclick="achv:semMode" data-args="${esc(JSON.stringify([m]))}" aria-pressed="${_semMode === m}">${label}</button>`;
  overlay.innerHTML = `
    <div class="achv-modal" role="dialog" aria-modal="true" aria-labelledby="achvModalTitle">
      <div class="achv-modal-hd">
        <span class="achv-modal-title" id="achvModalTitle" style="color:${accent}">📊 ${esc(subj.name)} — 학기 단위 성취수준</span>
        <button class="cmp-close-btn" data-onclick="achv:close" aria-label="닫기">✕</button>
      </div>
      <div class="achv-seg-bar" role="group" aria-label="문장 연결 방식">
        ${seg('join', '연결어미로 잇기')}${seg('raw', '원문 그대로')}
        <span class="achv-seg-note">성취기준 ${stds.length}개</span>
      </div>
      <div class="achv-modal-body">${bodyHtml}</div>
      <div class="achv-modal-ft">
        <button class="achv-copy-all pri" id="achvCopyAllBtn" data-onclick="achv:copyAllSem">전체 복사</button>
        <button class="achv-copy-all sec" data-onclick="achv:semRepick">↩ 성취기준 다시 고르기</button>
        <button class="achv-copy-all sec" data-onclick="achv:close">닫기</button>
        <span id="achvCopyMsg" style="font-size:12px;color:var(--ok);display:none">✓ 복사됨</span>
      </div>
    </div>`;
  overlay.style.display = '';
  trapFocus(overlay.querySelector('.achv-modal'));
}
```

- [ ] **Step 4: 복사 함수를 교체한다**

`achvBuildSemesterHtml`·`achvBuildSemesterPlain`·`achvCopyAllSem` **세 함수 전체를 삭제**하고 그 자리에 넣는다:

```js
// 복사본은 레벨·문단 2열만. 출처 코드는 넣지 않는다(설계 §6).
// 한글 붙여넣기용 HTML이라 CSS 변수 대신 리터럴 hex를 쓴다(규칙 5 예외).
function achvBuildSemesterHtml(paras) {
  const rows = ['A','B','C','D','E']
    .filter(g => paras[g].text)
    .map(g => `<tr><td style="text-align:center;font-weight:bold">${g}</td><td>${paras[g].text}</td></tr>`)
    .join('');
  return '<table border="1" style="border-collapse:collapse"><tbody>' + rows + '</tbody></table>';
}

function achvBuildSemesterPlain(paras) {
  return ['A','B','C','D','E'].filter(g => paras[g].text).map(g => `${g}\t${paras[g].text}`).join('\n');
}

function achvCopyAllSem() {
  const res = collectSelectedStds(_semSubjId, _semSelected);
  if (!res || !res.stds.length) return;
  const paras = buildLevelParagraphs(res.stds, _semMode);   // 보이는 모드 그대로 복사
  achvClipWrite(achvBuildSemesterHtml(paras), achvBuildSemesterPlain(paras), () => {
    const btn = document.getElementById('achvCopyAllBtn');
    const msg = document.getElementById('achvCopyMsg');
    if (btn) btn.textContent = '✓ 복사됨';
    if (msg) msg.style.display = 'inline';
    setTimeout(() => {
      if (btn) btn.textContent = '전체 복사';
      if (msg) msg.style.display = 'none';
    }, 1800);
  });
}

function achvSetSemMode(mode) {
  if (mode !== 'join' && mode !== 'raw') return;
  _semMode = mode;
  openSemesterAchvModal(_semSubjId, _semAccent, _semSelected);   // 즉시 재렌더
}
```

- [ ] **Step 5: export와 이벤트 등록을 갱신한다**

`export { ... }` 줄을 교체:

```js
export { openAchvModal, closeAchvModal, achvCopyAll, achvCopyStd, openSemesterAchvPicker, openSemesterAchvModal, achvCopyAllSem };
```

`registerActions('click', { ... })` 블록의 `'achv:copyAllSem'` 줄을 교체하고 2개를 추가:

```js
  'achv:copyAllSem': function() { achvCopyAllSem(); },
  'achv:semMode':    function(el, e, mode) { achvSetSemMode(mode); },
  'achv:semRepick':  function() { openSemesterAchvPicker(_semSubjId, _semAccent); },
```

- [ ] **Step 6: 검증**

Run: `node tools/verify.mjs`
Expected: `[1] import/export 정합성` 통과 — 단, `app.js`가 아직 `openSemesterAchvModal`을 2인자로 부르므로 **[3] 그래프 로드는 통과하지만 동작은 미완**이다. Task 4에서 마무리한다.

Run: `node tools/test.mjs`
Expected: PASS — 합계 63건.

- [ ] **Step 7: 커밋 (Task 2 + Task 3 함께)**

```bash
git add assets/achv.js tools/test.mjs
git commit -m "feat(achv): 학기 단위 성취수준을 선택 기반 문단 병합으로 교체

- collectSemesterRows(전 단원 나열) → collectSelectedStds + buildLevelParagraphs
- 결과 모달에 join/raw 토글, 성취기준 다시 고르기 왕복 버튼 추가
- 복사본은 레벨·문단 2열(코드 제외), 보이는 모드 그대로 복사
- 과목이 바뀌면 선택을 비워 잘못된 결과를 막음"
```

---

### Task 4: 진입점을 선택기로 연결

**Files:**
- Modify: `assets/app.js:16` (import), `assets/app.js:611` (핸들러)

**Interfaces:**
- Consumes: `openSemesterAchvPicker(subjId, accent)` (Task 3)

- [ ] **Step 1: import를 바꾼다**

`assets/app.js:16`을 교체:

```js
import { openAchvModal, closeAchvModal, achvCopyAll, achvCopyStd, openSemesterAchvPicker } from './achv.js';
```

- [ ] **Step 2: 핸들러를 바꾼다**

`assets/app.js:611`의 `'app:semAchv'` 줄을 교체:

```js
  'app:semAchv':        function(el, e, subjId, accent) { openSemesterAchvPicker(subjId, accent); },
```

버튼 마크업(`app.js:503`)은 **그대로 둔다** — 라벨과 `data-args`가 이미 맞다.

- [ ] **Step 3: 검증**

Run: `node tools/verify.mjs`
Expected: 5항목 전부 통과 — `✅ 모든 검증 통과 — 배포 안전`

- [ ] **Step 4: 커밋**

```bash
git add assets/app.js
git commit -m "feat(app): 학기 단위 성취수준 버튼이 성취기준 선택기를 먼저 열도록"
```

---

### Task 5: 스타일 · 캐시 버전 · 헤드리스 프로브

**Files:**
- Modify: `assets/style.css` (`.achv-copy-std` 규칙 뒤에 추가)
- Modify: `sw.js:1`

- [ ] **Step 1: 스타일을 추가한다**

`assets/style.css`의 `.achv-copy-std` 관련 규칙들 **뒤**에 추가:

```css
/* 학기 단위 성취수준 — 모드 토글 */
.achv-seg-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.achv-seg {
  background: var(--g50); border: 1px solid var(--g200); color: var(--g500);
  border-radius: 7px; padding: 6px 12px; font-size: 13px; font-weight: 500;
  font-family: inherit; cursor: pointer; transition: background .15s, color .15s, border-color .15s;
}
.achv-seg:hover { background: var(--g100); }
.achv-seg.on { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.achv-seg-note { font-size: 13px; color: var(--g500); margin-left: auto; }

/* 학기 단위 성취수준 — 레벨별 문단 */
.achv-para { padding: 14px 0; border-bottom: 1px solid var(--g100); }
.achv-para:last-child { border-bottom: none; }
.achv-para-hd { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
.achv-para-tx { font-size: 15px; line-height: 1.75; color: var(--g900); margin: 0; word-break: keep-all; }
.achv-para-src { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-size: 12px; }
```

**토큰 확인 완료(2026-07-21):** `--g50/100/200/500/900`은 `style.css:26-28`에 있고,
`style.css:1326` 이하 다크모드 블록이 같은 이름을 덮어쓴다. 따라서 위 스타일은
다크모드에서 **자동으로 따라간다** — 별도 다크 규칙을 추가하지 말 것.

- [ ] **Step 2: 캐시 버전을 올린다**

`sw.js:1`을 교체:

```js
const CACHE = 'jungle-v33';
```

- [ ] **Step 3: 검증**

Run: `node tools/verify.mjs`
Expected: 5항목 전부 통과. `[4] 서비스워커 프리캐시`가 `jungle-v33`으로 표시된다.

- [ ] **Step 4: 헤드리스 프로브로 실제 동작을 확인한다**

`msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=20000` 로 `index.html`을 열고 확인할 것:

1. 교육과정 → 중학교 정보 → `📊 학기 단위 성취수준` 클릭 → **stdpicker 모달이 열린다**(결과가 바로 뜨지 않는다)
2. 성취기준 2개 체크 → 확인 → **A~E 5문단이 보인다**
3. A 문단이 `있으며,`를 포함하고 `있다.`로 끝난다
4. `원문 그대로` 클릭 → 같은 문단에서 `있으며,`가 사라진다
5. `↩ 성취기준 다시 고르기` 클릭 → **직전 체크 2개가 복원된 채** 선택기가 열린다
6. 과목을 고등학교 정보로 바꿔 확인 → 선택이 비워진 채 열린다

- [ ] **Step 5: 커밋**

```bash
git add assets/style.css sw.js
git commit -m "style(achv): 학기 단위 성취수준 토글·문단 스타일 + 캐시 v33"
```

---

## 완료 후

- 푸시는 **사용자 몫**(push = jgle.kr 라이브 배포).
- 한글 붙여넣기 확인은 클립보드 HTML이라 자동 검증이 불가 — 사용자가 직접 확인해야 한다.
- `docs/superpowers/specs/2026-07-21-semester-achv-merge-design.md` §10에 적힌 대로, **정의적 영역 평가 탭**은 별건이다.
