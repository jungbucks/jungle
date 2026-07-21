# 정의적 영역 평가 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수업/평가계획에 "정의적 영역 평가" 서브탭을 신설해, 과목을 고르면 영역(단원)별 3열 표(정의적 영역/성취기준/평가내용)가 뜨고 한글 표로 복사된다.

**Architecture:** `data.js`에 재사용 가능한 `AFFECTIVE` 데이터를 신설하고, 순수 조회·조립 함수 + 정합성 테스트로 데이터를 방어한 뒤, 새 모듈 `affective.js`가 3열 표·과목 선택·복사를 렌더한다. 진입은 기존 `evalPlanSubtab` 서브탭 패턴을 그대로 따른다.

**Tech Stack:** 바닐라 ES 모듈, 빌드 없음. 테스트는 `tools/test.mjs`(node, DOM 스텁).

**설계 문서:** `docs/superpowers/specs/2026-07-22-affective-eval-design.md`

## Global Constraints

- **모든 수정 후 `node tools/verify.mjs`** — git pre-commit 훅이 강제. `--no-verify` 금지.
- **인라인 핸들러(`onclick=`) 금지** — `data-onclick` + `registerActions()` 위임만.
- **색 hex 하드코딩 금지 → `:root` 토큰만.** 예외: 클립보드용 한글 HTML 생성 코드는 리터럴 hex 유지(규칙 5).
- **13px 미만 텍스트 금지**(12px는 배지 하한). 본문성 15px+.
- **파일 추가 시 두 곳 동시 갱신**: `sw.js` ASSETS 배열 + `index.html` modulepreload (규칙 3).
- **배포 묶음마다 `sw.js` `CACHE = 'jungle-vNN'` +1** — 이 계획 전체가 한 묶음, **마지막 Task에서 한 번만**. 현재 `jungle-v38` → `jungle-v39`.
- **데이터 전역은 boot.js가 `window.*`로 브리지** — `AFFECTIVE` 추가 시 boot.js도 갱신(규칙: 새 키는 브리지 확인).
- **6과목 27영역**: middle 5 · high 5 · ai 4 · ds 4 · sw 5 · cs 4. 프로그래밍(prog) 제외.
- **정보과학(cs)은 `getAchvKey`가 `_cs` 접미사**를 붙인다 — 도메인명은 접미사 없이 적는다.
- **`AFFECTIVE_VERIFIED=false`로 시작** — 검수 전 배포 게이트. 탭에 "검수 예정" 배지.
- **`values`·`assess`는 교육부 고시 내용체계표 + 성취수준 텍스트를 교차 근거로 작성** — 근거 없이 지어내지 않는다. 최종 판단은 교사 검수.

---

### Task 1: 조회·조립 순수 함수 + 정합성 테스트

**Files:**
- Create: `assets/affective.js` (헬퍼만 먼저)
- Modify: `tools/test.mjs`

**Interfaces:**
- Produces: `affectiveSubjects() -> [{id,name}]` (AFFECTIVE 데이터 있는 과목), `affectiveRows(subjId) -> [{domain, values, codes, assess}] | null`, `__affTest = { affectiveSubjects, affectiveRows }`.

- [ ] **Step 1: 실패 테스트를 쓴다**

`tools/test.mjs`의 `runAchvTests` 함수 정의 **뒤**(다음 `export function` 앞)에 삽입:

```js
export function runAffectiveTests() {
  let pass = 0; const fails = [];
  const eq = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) pass++; else fails.push(`${name}: got ${g} · want ${w}`); };

  const { affectiveSubjects, affectiveRows } = __affTest;

  // 데이터 있는 과목만 노출
  const subs = affectiveSubjects();
  eq('과목 목록은 배열', Array.isArray(subs), true);
  eq('middle 포함', subs.some(s => s.id === 'middle'), true);
  eq('프로그래밍 제외', subs.some(s => s.id === 'prog'), false);

  // 조회
  const rows = affectiveRows('middle');
  eq('middle 행 존재', Array.isArray(rows) && rows.length > 0, true);
  eq('행 필드', Object.keys(rows[0]).sort(), ['assess','codes','domain','values']);
  eq('없는 과목 = null', affectiveRows('nope'), null);

  // 정합성: 모든 과목의 domain이 SUBJECTS에 실재, codes가 성취기준에 실재
  const getAchvKey = (id, name) => id === 'high' ? name + '_고' : id === 'cs' ? name + '_cs' : name;
  affectiveSubjects().forEach(s => {
    const subj = SUBJECTS.find(x => x.id === s.id);
    const domainNames = new Set(subj.domains.map(d => d.name));
    const allCodes = new Set(subj.domains.flatMap(d => d.items.map(it => it.code)));
    affectiveRows(s.id).forEach(r => {
      eq(`정합 ${s.id}/${r.domain} 도메인실재`, domainNames.has(r.domain), true);
      eq(`정합 ${s.id}/${r.domain} 성취수준키`, !!ACHIEVEMENTS[getAchvKey(s.id, r.domain)], true);
      (r.codes || []).forEach(c => eq(`정합 ${s.id}/${r.domain} 코드 ${c}`, allCodes.has(c), true));
      eq(`정합 ${s.id}/${r.domain} values 비지않음`, (r.values || []).length > 0, true);
      eq(`정합 ${s.id}/${r.domain} assess 비지않음`, (r.assess || []).length > 0, true);
    });
  });

  return { pass, fail: fails.length, fails };
}
```

`tools/test.mjs:57`(achv import 아래)에 추가:

```js
const { __affTest } = await import('../assets/affective.js');
```

`runAllTests`의 `parts` 배열에 추가:

```js
  const parts = [['gradecalc', runGradeTests()], ['chasi', runChasiTests()], ['evalplan', runEvalTests()], ['achv', runAchvTests()], ['affective', runAffectiveTests()]];
```

- [ ] **Step 2: 실패 확인**

Run: `node tools/test.mjs`
Expected: FAIL — `affective.js`가 없어 import 에러.

- [ ] **Step 3: affective.js 헬퍼 + 최소 데이터 1과목**

`assets/affective.js` 생성:

```js
import { esc, clipboardWriteHTML, uiToast, registerActions } from './utils.js';

// ── 조회·조립 (순수 — DOM 모름) ──
// AFFECTIVE는 data.js의 전역(boot.js가 window로 브리지). 데이터 있는 과목만 노출.
function affectiveSubjects() {
  if (typeof AFFECTIVE === 'undefined') return [];
  return Object.keys(AFFECTIVE)
    .map(id => SUBJECTS.find(s => s.id === id))
    .filter(Boolean)
    .map(s => ({ id: s.id, name: s.name }));
}

function affectiveRows(subjId) {
  if (typeof AFFECTIVE === 'undefined' || !AFFECTIVE[subjId]) return null;
  return AFFECTIVE[subjId];
}

export const __affTest = { affectiveSubjects, affectiveRows };
```

`assets/data.js` 맨 아래(SUBJECTS·ACHIEVEMENTS 정의 뒤, APPSTORE 근처면 됨)에 **중학교 정보 5영역 초안**을 추가한다. 아래는 구조 예시 — **실제 `values`·`assess` 문구는 교육부 고시 내용체계표(중학교 정보 가치·태도)와 성취수준 텍스트를 교차 근거로 작성**한다. 5영역 전부 채운다:

```js
const AFFECTIVE = {
  middle: [
    { domain: "컴퓨팅 시스템",
      values: ["컴퓨팅 시스템의 필요성과 가치 인식", "피지컬 컴퓨팅을 생활에 활용하려는 태도"],
      codes: ["[9정01-02]", "[9정01-03]"],
      assess: [
        { method: "관찰평가", desc: "피지컬 컴퓨팅 사례를 조사·발표할 때 시스템의 필요성과 가치를 근거로 설명하는지 관찰" },
        { method: "자기평가", desc: "생활 속 컴퓨팅 시스템을 찾아 활용 아이디어를 제안한 정도를 스스로 점검" }
      ] },
    { domain: "데이터",
      values: ["데이터의 가치 인식", "데이터 기반으로 판단하려는 태도"],
      codes: ["[9정02-01]", "[9정02-04]"],
      assess: [
        { method: "관찰평가", desc: "데이터를 수집·구조화하는 활동에서 근거를 들어 의미를 해석하는지 관찰" },
        { method: "동료평가", desc: "모둠 데이터 분석 과정에서 서로의 해석 근거를 평가" }
      ] },
    { domain: "알고리즘과 프로그래밍",
      values: ["문제 해결에 대한 자신감", "협력적으로 소프트웨어를 개발하려는 태도"],
      codes: ["[9정03-08]", "[9정03-09]"],
      assess: [
        { method: "관찰평가", desc: "실생활 문제를 프로그래밍으로 해결하는 과정에서 끈기 있게 디버깅하는지 관찰" },
        { method: "동료평가", desc: "협력 개발에서 역할 분담과 기여도를 상호 평가" }
      ] },
    { domain: "인공지능",
      values: ["인공지능 데이터 윤리 의식", "인공지능의 사회적 영향에 대한 성찰"],
      codes: ["[9정04-05]"],
      assess: [
        { method: "관찰평가", desc: "AI 학습 데이터 수집·활용의 윤리적 쟁점을 토론에서 균형 있게 다루는지 관찰" },
        { method: "자기평가", desc: "AI 활용 시 개인정보·편향 문제를 점검하는 태도를 스스로 평가" }
      ] },
    { domain: "디지털 문화",
      values: ["디지털 시민성", "정보보호·저작권 실천 의지"],
      codes: ["[9정05-02]", "[9정05-03]"],
      assess: [
        { method: "관찰평가", desc: "모둠 토론에서 개인정보·저작권 보호 관점을 근거로 들어 주장하는지 관찰" },
        { method: "자기평가", desc: "디지털 예절·정보보호 실천 체크리스트 5문항 자기점검" }
      ] }
  ]
};
const AFFECTIVE_VERIFIED = false;
```

`assets/boot.js`에 브리지 2줄 추가(`window.APPSTORE_APPS` 근처):

```js
window.AFFECTIVE = AFFECTIVE;
window.AFFECTIVE_VERIFIED = AFFECTIVE_VERIFIED;
```

- [ ] **Step 4: 통과 확인**

Run: `node tools/test.mjs`
Expected: PASS — `affective` 그룹 통과, 합계 증가.

- [ ] **Step 5: 커밋**

```bash
git add assets/affective.js assets/data.js assets/boot.js tools/test.mjs
git commit -m "feat(affective): 조회·조립 헬퍼 + 정합성 테스트 + 중학교 정보 5영역 초안"
```

---

### Task 2: 렌더 — 3열 표·과목 선택·복사

**Files:**
- Modify: `assets/affective.js`

**Interfaces:**
- Consumes: `affectiveSubjects`, `affectiveRows` (Task 1), `clipboardWriteHTML`·`uiToast`·`esc`·`registerActions` (utils)
- Produces: `renderAffective() -> string` (app.js가 호출), 모듈 상태 `_affSubjId`.

- [ ] **Step 1: 렌더 함수와 상태를 추가한다**

`assets/affective.js`의 `export const __affTest` **앞**에 삽입:

```js
let _affSubjId = 'middle';   // 세션 상태 — 새로고침하면 초기화

function affRowHtml(subj, r) {
  const values = r.values.map(v => `<div class="aff-val">${esc(v)}</div>`).join('');
  const codes = r.codes.map(c => `<span class="aff-code" style="background:${subj.aLight};color:${subj.accent}">${esc(c)}</span>`).join(' ');
  const assess = r.assess.map(a => `<div class="aff-assess"><b>${esc(a.method)}</b> — ${esc(a.desc)}</div>`).join('');
  return `<tr>
    <td class="aff-c-domain"><div class="aff-domain">${esc(r.domain)}</div>${values}</td>
    <td class="aff-c-code">${codes}</td>
    <td class="aff-c-assess">${assess}</td>
  </tr>`;
}

function renderAffective() {
  const subs = affectiveSubjects();
  const subj = SUBJECTS.find(s => s.id === _affSubjId) || SUBJECTS.find(s => s.id === subs[0].id);
  const rows = affectiveRows(subj.id) || [];
  const verified = (typeof AFFECTIVE_VERIFIED !== 'undefined') && AFFECTIVE_VERIFIED;
  const opts = subs.map(s => `<option value="${s.id}"${s.id === subj.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  const badge = verified ? '' : `<span class="aff-flag">검수 예정 — 예시 초안입니다</span>`;
  return `<div class="aff-wrap" style="max-width:1200px;margin:0 auto">
    <div class="aff-head">
      <div class="aff-title">정의적 영역 평가 예시 ${badge}</div>
      <div class="aff-tools">
        <select id="affSubjSel" class="eval-select" data-onchange="aff:subject" aria-label="과목 선택">${opts}</select>
        <button class="dl-btn" data-onclick="aff:copy" data-args="${esc(JSON.stringify([subj.id]))}">전체 복사</button>
      </div>
    </div>
    <p class="aff-sub">교육과정 가치·태도를 바탕으로 한 영역별 예시입니다. 표를 복사해 평가계획서에 붙여넣어 편집하세요.</p>
    <table class="aff-table">
      <thead><tr><th>정의적 영역</th><th>성취기준</th><th>평가내용</th></tr></thead>
      <tbody>${rows.map(r => affRowHtml(subj, r)).join('')}</tbody>
    </table>
  </div>`;
}

function affSetSubject(id) { _affSubjId = id; document.getElementById('main').innerHTML = renderAffective(); }

// 복사: 한글 표(HTML). CSS 변수가 해석 안 되므로 리터럴 hex(규칙 5 예외). 코드·평가내용 포함.
function affCopy(subjId) {
  const subj = SUBJECTS.find(s => s.id === subjId);
  const rows = affectiveRows(subjId) || [];
  const bodyHtml = rows.map(r => {
    const val = r.values.join(', ');
    const code = r.codes.join(' ');
    const ass = r.assess.map(a => `${a.method} — ${a.desc}`).join('\n');
    return `<tr><td>${esc(r.domain)}<br>${esc(val)}</td><td>${esc(code)}</td><td>${esc(ass).replace(/\n/g, '<br>')}</td></tr>`;
  }).join('');
  const html = `<table border="1" style="border-collapse:collapse"><thead><tr><td><b>정의적 영역</b></td><td><b>성취기준</b></td><td><b>평가내용</b></td></tr></thead><tbody>${bodyHtml}</tbody></table>`;
  const plain = rows.map(r => `${r.domain} (${r.values.join(', ')})\t${r.codes.join(' ')}\t${r.assess.map(a => a.method + ' — ' + a.desc).join(' / ')}`).join('\n');
  clipboardWriteHTML(html, plain).then(ok => uiToast(ok ? '표를 복사했습니다 — 한글에 붙여넣으세요' : '복사에 실패했습니다.', ok ? {} : { isErr: true }));
}
```

`export { renderAffective };`를 파일 하단(`__affTest` export 위)에 추가하고, 이벤트 등록을 맨 아래에 추가:

```js
export { renderAffective };

registerActions('change', { 'aff:subject': function(el) { affSetSubject(el.value); } });
registerActions('click', { 'aff:copy': function(el, e, id) { affCopy(id); } });
```

- [ ] **Step 2: 문법·로드 확인**

Run: `node tools/verify.mjs`
Expected: `[1] import/export 정합성`·`[2] 문법` 통과. (app.js가 아직 renderAffective를 안 부르므로 화면 미연결.)

- [ ] **Step 3: 커밋**

```bash
git add assets/affective.js
git commit -m "feat(affective): 3열 표·과목 선택·한글 표 복사 렌더"
```

---

### Task 3: 서브탭 신설 + 디스패치 연결

**Files:**
- Modify: `assets/app.js` (import, 서브탭 목록, 디스패치)

**Interfaces:**
- Consumes: `renderAffective` (Task 2)

- [ ] **Step 1: import 추가**

`assets/app.js`의 achv import 줄 아래에 삽입:

```js
import { renderAffective } from './affective.js';
```

- [ ] **Step 2: 서브탭 목록에 삽입**

`assets/app.js`의 evalplan 서브탭 배열에서 `{key:'eval', label:'평가계획'},` 줄 **바로 아래**에 추가:

```js
      {key:'affective', label:'정의적 영역 평가'},
```

- [ ] **Step 3: 디스패치 분기 추가**

`assets/app.js`의 `if (evalPlanSubtab === 'eval') { … }` 블록 바로 아래에 `else if` 추가:

```js
    } else if (evalPlanSubtab === 'affective') {
      document.getElementById('main').innerHTML = renderAffective();
```

(기존 `else if (evalPlanSubtab === 'rubric')` 앞에 들어가도록 순서 주의.)

- [ ] **Step 4: 검증**

Run: `node tools/verify.mjs`
Expected: 5항목 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add assets/app.js
git commit -m "feat(app): 정의적 영역 평가 서브탭 신설 + 디스패치 연결"
```

---

### Task 4: 스타일 + 파일 등록 + 캐시 + 프로브

**Files:**
- Modify: `assets/style.css`, `sw.js`, `index.html`

- [ ] **Step 1: 파일 등록 (규칙 3)**

`sw.js`의 ASSETS 배열에 `'./assets/affective.js',` 추가(다른 assets/*.js 옆).
`index.html`의 modulepreload 목록에 추가(achv.js 줄 근처):

```html
<link rel="modulepreload" href="assets/affective.js">
```

- [ ] **Step 2: 스타일 추가**

`assets/style.css`의 `.achv-para-src` 규칙군 뒤(또는 eval 관련 스타일 근처)에 추가:

```css
/* 정의적 영역 평가 표 */
.aff-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 8px 0 4px; }
.aff-title { font-size: 18px; font-weight: 700; color: var(--g900); }
.aff-flag { font-size: 12px; font-weight: 700; color: var(--warn-dark); background: var(--warn-soft); border-radius: 6px; padding: 2px 8px; margin-left: 8px; }
.aff-tools { display: flex; gap: 8px; align-items: center; }
.aff-sub { font-size: 13px; color: var(--g500); margin: 0 0 14px; line-height: 1.6; }
.aff-table { width: 100%; border-collapse: collapse; }
.aff-table th, .aff-table td { border: 1px solid var(--g200); padding: 10px 12px; text-align: left; vertical-align: top; }
.aff-table th { background: var(--g50); font-size: 13px; font-weight: 700; color: var(--g700); }
.aff-c-domain { width: 24%; } .aff-c-code { width: 20%; white-space: nowrap; }
.aff-domain { font-size: 15px; font-weight: 700; color: var(--g900); margin-bottom: 6px; }
.aff-val { font-size: 14px; color: var(--g700); line-height: 1.6; }
.aff-code { display: inline-block; font-size: 13px; font-weight: 700; padding: 2px 7px; border-radius: 5px; margin: 0 2px 2px 0; }
.aff-assess { font-size: 14px; color: var(--g700); line-height: 1.65; margin-bottom: 6px; }
.aff-assess:last-child { margin-bottom: 0; }
@media(max-width:640px){
  .aff-table, .aff-table thead, .aff-table tbody, .aff-table tr, .aff-table td { display: block; width: auto; }
  .aff-table thead { display: none; }
  .aff-table tr { border: 1px solid var(--g200); border-radius: 8px; margin-bottom: 10px; padding: 4px; }
  .aff-table td { border: none; border-bottom: 1px solid var(--g100); }
  .aff-table td:last-child { border-bottom: none; }
}
```

**토큰 확인**: `--warn-dark`·`--warn-soft`는 `style.css`에 존재(teacher-pay 아님, 정글 grep 확인 완료). 없으면 `--warn` 계열로 대체.

- [ ] **Step 3: 캐시 버전**

`sw.js:1` → `const CACHE = 'jungle-v39';`

- [ ] **Step 4: 검증 + 프로브**

Run: `node tools/verify.mjs`
Expected: 5항목 통과, `[4]`가 v39·affective.js 프리캐시 확인.

헤드리스 프로브(`msedge --headless=new --allow-file-access-from-files`)로 `#evalplan:affective` 진입 후 확인:
1. 서브탭에 "정의적 영역 평가"가 "평가계획" 다음에 있다
2. 표에 `<tr>` 5행(중학교 정보 5영역), 헤더 3열
3. 과목 셀렉트 변경 → 표 내용 바뀜
4. "검수 예정" 배지 노출(AFFECTIVE_VERIFIED=false)
5. 문서 가로 넘침 0 (360·768·1200px)

- [ ] **Step 5: 커밋**

```bash
git add assets/style.css sw.js index.html
git commit -m "style(affective): 3열 표 스타일(모바일 카드화) + 파일 등록 + 캐시 v39"
```

---

### Task 5: 나머지 5과목 데이터 초안 (고정보·AI·데과·SW·정보과학)

**Files:**
- Modify: `assets/data.js` (AFFECTIVE에 과목 추가)

**주의:** 이 Task는 **콘텐츠 작성**이라 조사가 필요하다. 각 과목마다 아래를 반복한다. 문구는 **교육부 고시 내용체계표(해당 과목 가치·태도) + 그 영역 성취수준 텍스트**를 교차 근거로 작성하고, 지어내지 않는다. codes는 그 과목 성취기준에서 고른다.

- [ ] **Step 1: high(고등학교 정보) 5영역 추가**

`AFFECTIVE`에 `high: [...]` 추가. 도메인: 컴퓨팅 시스템 / 데이터 / 알고리즘과 프로그래밍 / 인공지능 / 디지털 문화. codes는 `[12정…]`. 구조는 middle과 동일(domain·values·codes·assess).

- [ ] **Step 2: ai(인공지능 기초) 4영역 추가**

도메인: 인공지능의 이해 / 인공지능과 학습 / 인공지능의 사회적 영향 / 인공지능 프로젝트. 가치·태도는 AI 윤리·책임·편향 성찰 중심.

- [ ] **Step 3: ds(데이터 과학) 4영역 추가**

도메인: 데이터 과학의 이해 / 데이터 준비와 분석 / 데이터 모델링과 평가 / 데이터 과학 프로젝트. 데이터 가치·근거 기반 판단 중심.

- [ ] **Step 4: sw(소프트웨어와 생활) 5영역 추가**

도메인: 세상을 변화시키는 소프트웨어 / 창작을 지원하는 소프트웨어 / 현상을 분석하는 소프트웨어 / 모의 실험하는 소프트웨어 / 가치를 창출하는 소프트웨어. (**" 영역" 접미사 없이** — 방금 고친 키와 일치.)

- [ ] **Step 5: cs(정보과학) 4영역 추가**

도메인: 프로그래밍 / 데이터 구조 / 알고리즘 / 정보과학 프로젝트. codes는 `_cs` 성취기준(예: `[12정과…]`) — **도메인명엔 `_cs`를 붙이지 않는다**(getAchvKey가 자동으로 붙임).

- [ ] **Step 6: 정합성 통과 확인**

Run: `node tools/test.mjs`
Expected: `affective` 그룹이 6과목 27영역 전부 정합(도메인 실재·코드 실재·values/assess 비지 않음) 통과.

Run: `node tools/verify.mjs`
Expected: 5항목 전부 통과.

- [ ] **Step 7: 커밋**

```bash
git add assets/data.js
git commit -m "feat(affective): 나머지 5과목(고정보·AI·데과·SW·정보과학) 정의적 영역 초안"
```

---

## 완료 후

- **검수 게이트**: `AFFECTIVE_VERIFIED=false`라 "검수 예정" 배지가 뜬다. 교사가 `values`·`assess`
  전건 확인 후 `true`로 바꾸면 배지가 사라진다. **검수 전 배포 금지.**
- **푸시는 사용자 몫**(push = jgle.kr 라이브). 검수 전이면 푸시하지 않는다.
- 한글 붙여넣기 확인은 클립보드라 자동 검증 불가 — 사용자 몫.
- 후속: 교육과정 탭에 `AFFECTIVE.values` 재사용 노출(설계 §9).
