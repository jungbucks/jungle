# 정글(JunGLE) 유지보수 가이드

> 중장기 계획·모델별 작업 분배·배포 체크리스트는 **`ROADMAP.md`** 참조 (2026-07-08 수립, 6개월). 이 문서와 충돌하면 이 문서(CLAUDE.md)가 우선.

정보교사용 올인원 웹앱. **순수 정적 사이트** — 빌드 도구·프레임워크·npm 없음. 바닐라 JS(ES 모듈) + CSS 한 파일.
배포: GitHub Pages → 커스텀 도메인 **https://jgle.kr** (jungbucks.github.io/jungle에서 301). 저장소 폴더 전체가 곧 배포물이다.

## 절대 규칙 (수정 전에 읽을 것)

1. **모든 수정 후 `node tools/verify.mjs` 실행.** 4항목(임포트 정합성/문법/전체 그래프 로드/SW 프리캐시) 통과 못 하면 배포 금지. 상세는 `tools/README.md`.
2. **배포 전 `sw.js`의 `CACHE` 버전을 올린다** (`jungle-vNN`). 같은 배포 묶음이면 한 번만.
3. **파일을 추가/이름변경하면 두 곳을 갱신**: `sw.js`의 `ASSETS` 배열, 그리고 JS 모듈이면 `index.html`의 `<link rel="modulepreload">` 목록. 빠뜨리면 verify [4]가 잡거나, 로딩 워터폴이 부활한다.
4. **색상 hex 하드코딩 금지.** `:root`의 토큰만 사용 (아래 팔레트 표). **예외**: 클립보드 복사용 HTML을 생성하는 코드(`achv.js`, `rubric.js`의 `rubricBuildTableHTML`, `evalplan.js`의 표 미리보기 복사)는 한글/워드에 붙여넣는 용도라 **CSS 변수가 해석되지 않으므로 리터럴 hex를 유지**해야 한다. `data.js`의 과목별 색상 데이터도 그대로 둔다.
5. **13px 미만 텍스트 금지.** 12px는 배지·칩 전용 하한. 본문성 텍스트는 15px 이상. 사용자가 작은 글씨를 싫어한다.
6. **신규 코드에 인라인 이벤트 핸들러(onclick= 등) 금지.** `data-onclick`/`data-oninput`/`data-onchange` + `utils.js`의 `registerActions()`를 쓴다 (아래 '이벤트 위임' 참조).
7. **디자인 방향 (사용자 확정 — 2026-07-07 개정)**: 구글 패러디는 법적 리스크 사유로 **제거 완료**. 무지개 4색 워드마크·"행운을 믿어요" 문구 복원 금지. 브랜드: 'JunGLE'(Jun 소문자+GLE 대문자) 워드마크와 잎 로고마크(삭제 금지)는 `--brand` 딥 그린 단색. 메인 슬로건 "복잡해진 22개정 교육과정의 정글, 정글(JunGLE)과 탐험하자!" / 서브 카피 "정보교사를 위한 올인원 플랫폼". 밝고 캐주얼한 톤 유지. 새 아이콘은 이모지 대신 stroke SVG(lucide 계열).
8. **정보교과서에는 검정교과서가 없다.** "인정교과서"가 올바른 표현.
9. **페이지 시작 위치 표준 (2026-07-07 확정)**: 콘텐츠 상단 여백은 `.ov-head`의 `padding-top:8px`만 담당하고, **페이지 래퍼(cmp/sim/sguide/msub/ds-ai 등)는 top·좌우 패딩 0** (좌우는 `.main`의 20px만). 제목은 `.ov-h2`/`.dac-h2` 기본 스케일 사용, 인라인 font-size 오버라이드 금지. 새 페이지를 만들 때도 이 표준을 따를 것. (`.subtab-bar`는 `visibility:hidden`으로 모든 페이지에서 자리를 차지해 서브탭 유무와 무관하게 시작 위치가 같다 — display:none으로 바꾸지 말 것.)
10. **첫 페인트 = 최종 레이아웃.** index.html의 정적 셸(#tabs 탭 버튼, #main 홈 상단 버튼·태그라인·바로가기)은 renderTabs()/renderHome() 출력과 동일한 마크업이다 (해외 서버 지연 동안 레이아웃 점프 방지). **renderTabs/renderHome의 해당 마크업이나 탭 구성·과목명을 바꾸면 index.html 정적 셸도 반드시 같이 갱신할 것.** 데이터 필요한 카드 그리드만 `.skel-cell` 스켈레톤.

## 파일 구조

```
index.html      앱 셸: 정적 헤더(실물 탭)/히어로/검색/홈 상단(실물 버튼·카드)/모달 + modulepreload + CSP — 규칙 10 참조
sw.js           서비스워커: HTML network-first, JS/CSS stale-while-revalidate, 그 외 cache-first
manifest.json   PWA (아이콘: images/icon-192/512 + maskable 2종; jungle.png은 og:image 전용 3584×1184)
tools/verify.mjs 배포 전 검증기 (Node DOM 스텁 포함 — 새 DOM API 쓰면 스텁에도 추가)
assets/
  boot.js       classic script: SW 등록 + data.js 전역을 window에 브리지 (data.js 다음, app.js 전 로드)
  data.js       classic script: SUBJECTS·ACHIEVEMENTS 등 전체 데이터 (~1700줄)
  app.js        상태·해시 라우터·탭·검색·렌더 디스패치·init (~620줄 — F2 분해로 축소)
  home.js       홈 렌더+온보딩 (규칙 10: 마크업 변경 시 index.html 정적 셸 동기)
  collect.js    담은 성취기준 패널 (collected는 export let 라이브 바인딩 — app.js가 읽기만)
  backup.js     데이터 백업/복원 (BACKUP_KEYS 화이트리스트 — 새 localStorage 키 추가 시 갱신)
  searchfx.js   검색창 타자 애니메이션 (homeMode는 isIdle 콜백 주입 — 순환 의존 금지 패턴)
  utils.js      esc/safeUrl/클립보드/setAccent·resetAccent/registerActions·initDelegation
  state.js      파생 상수 (HOME_CARD_META 등)
  style.css     전체 스타일 (~1450줄), :root 토큰 + 다크모드
  overview.js(교육과정 5종) evalplan.js lessonplan.js rubric.js regexam.js gradecalc.js chasi.js
  simulator.js stdpicker.js(공용 성취기준 선택 모달) codevar.js aiidea.js gemini.js
  textbook.js appstore.js resources.js(수업 사이트+수업 도구) achv.js(성취수준 모달)
  fonts/PretendardVariable.woff2  셀프호스팅 가변폰트, 서브셋본 443KB (CDN 사용 금지 — CSP에 외부 origin 없음)
                  서브셋 범위: KS X 1001 한글 2350 + ASCII + 호환 자모 + 사이트 전체 사용 문자 (2026-07-07 기준).
                  범위 밖 희귀 한글은 시스템 폰트로 폴백됨. 원본(2.0MB)·재서브셋 스크립트(subset.mjs, npm subset-font 필요):
                  C:\Users\정벅\jungle-font-backup\ — data.js에 희귀 글자를 대량 추가했다면 재서브셋할 것.
```

렌더링 방식: 해시 라우팅(`#home`, `#high`, `#overview:map`, `#evalplan:rubric` …) → `render()`가 `#main.innerHTML` 교체. 상태는 모듈 스코프 변수 + localStorage.

## 색상·타이포 토큰 (style.css `:root`)

| 가족 | 용도 | 4단 |
|---|---|---|
| `--accent*` | 브랜드 파랑 (기본) | light / line / base / dark |
| `--brand` | 워드마크·잎 딥 그린 `#1B4D3E` (다크: `#34D399` 재매핑) | 단일 |
| `--plan*` | 수업·평가 도구 (보라) | soft / line / base / dark |
| `--book*` | 교과서 (초록) | 〃 |
| `--teal*` | 비교·차시 (틸) — 차시가 teal인 것은 그룹 구분 의도가 아니라 **초기 cyan 하드코딩 디자인을 묶음A 토큰 치환 때 보존한 역사적 경위** (같은 '계산기'인 성적 산출기는 plan 보라). 통일 여부는 백로그 8(사용자 결정) | 〃 |
| `--ovr*` | 교육과정 개요 (인디고) | 〃 |
| `--ok` `--danger*` `--warn*` | 시맨틱 | 〃 |
| `--fs-*` | 타이포 스케일 caption13/body15/body-lg16/title18/heading21/display | |

다크모드 슬레이트 hex(`#1E293B` 계열)는 토큰화 대상이 아니다. (구글 워드마크 4색 `.gl-*`는 2026-07-07 제거 — 지금은 `.gl-mark`가 `--brand` 단색.)

**accent 동적 시스템**: 과목 목록 페이지만 `setAccent(과목)`으로 `--accent*` 3종을 덮어쓰고, `render()` 첫머리의 `resetAccent()`가 매번 기본값으로 복원한다. 이 쌍을 깨면 홈 아이콘·포커스 색이 마지막 과목 색으로 오염된다 (실제 있었던 버그).

**다크모드**: `[data-theme="dark"]`가 `--g50~--g900`을 통째로 재매핑한다. 컴포넌트가 그레이 토큰만 쓰면 자동 대응됨. 흰 배경(`#fff`)을 쓴 컴포넌트만 개별 다크 규칙(`#1E293B` 배경 등)을 추가할 것. 다크 규칙에 `var(--g300)` 같은 걸 쓰면 값이 재매핑된 상태라는 걸 잊지 말 것.

## 이벤트 위임 (전환 완료 — 2026-07-06)

**인라인 핸들러는 전량 제거됐고 CSP는 `script-src 'self'`다 (unsafe-inline 없음).**
따라서 `onclick="..."` 같은 인라인 핸들러를 하나라도 넣으면 **CSP에 조용히 차단되어 동작하지 않는다.** 반드시 위임 패턴을 쓸 것:

```js
// 템플릿: 인자는 반드시 esc(JSON.stringify([...]))
'<button data-onclick="rubric:addRow" data-args="' + esc(JSON.stringify([code])) + '">'
// 모듈 하단: window.* 노출 대신
registerActions('click', { 'rubric:addRow': (el, e, code) => rubricAddRow(code) });
// input류는 el.value, checkbox는 el.checked. change는 select/checkbox용.
```

- 지원 타입: click / input / change / keydown / blur(캡처) / dragstart / dragend / dragover / drop / dragleave. 리스너는 `initDelegation(document.body)` 1회 설치.
- 이벤트당 `closest('[data-on타입]')` **한 요소만** 디스패치되므로, 중첩 클릭 영역(예: 도메인 헤더 안의 복사 버튼)은 자동으로 안쪽이 우선된다.
- index.html 정적 요소는 `app.js bindStaticHandlers()`의 addEventListener 바인딩.
- **남아 있는 window 전역은 딱 6개**: `stdPickerClose/Confirm/ChangeSubject`, `evalClosePreview/CopyPreviewTable` (bindStaticHandlers가 참조), `compareSelectSubtab` (overview.js가 순환 import 회피로 경유). 새 전역 노출 금지.
- 인라인 `<script>`도 금지 (CSP 차단). 새 스크립트는 외부 파일 + sw.js ASSETS + modulepreload 등록.
- CSP `connect-src`: self + generativelanguage.googleapis.com(Gemini) + date.nager.at(차시 공휴일 API). 새 외부 API를 쓰면 여기 추가해야 한다.

## 검증 방법 (이 환경 특이사항 포함)

- 이 PC: `git` 없음(PATH), `python`은 MS Store 스텁(실행 안 됨), 셸은 Windows PowerShell 5.1 (`&&` 없음). 로컬 서버는 Node로 띄운다 (scratchpad에 8~20줄짜리 http 서버 스크립트 작성).
- 스크린샷: Edge 헤드리스 `--headless=new --screenshot=... --window-size=W,H`. **주의: 창 최소폭(~500px) 때문에 좁은 뷰포트가 부정확** → 모바일 확인은 같은 출처에 임시 `__probe.html`을 만들어 `<iframe style="width:390px">`로 감싸 캡처/측정하고, 끝나면 반드시 삭제.
- 기능 테스트: 프로브 페이지에서 iframe 내부 DOM에 `.click()`/`dispatchEvent(new Event('input',{bubbles:true}))`를 날리고 localStorage·DOM 상태를 검사, 결과를 `<pre>`에 찍은 뒤 `--dump-dom`으로 수확한다. (rubric 전환 때 8개 테스트로 검증한 방식.)
- verify.mjs의 DOM 스텁은 최소 구현 — 코드에서 새 DOM API(`removeProperty` 같은)를 쓰면 스텁에도 추가해야 [3]이 통과한다.

## localStorage 키

`collected`(담은 성취기준) · `jungle_rubric` · `jungle_lesson_plan` · `jungle_evalplan` · `jungle_gradecalc`(내신 5등급 산출기: **반영비율·동점자 설정만** — 번호·점수는 개인정보 방침상 비영속, 탭 닫으면 소멸. 구버전에 저장된 학생행은 로드 시 자동 폐기) · `jungle_chasi` · `jungle_darkmode` · `jungle_visited` · `jungle_last_used` · Gemini API 키(gemini.js — 평문 저장이나 공용 PC 경고 + '저장된 키 삭제' 버튼 있음. 키는 URL 쿼리가 아닌 `x-goog-api-key` 헤더로 전송).

**백업/복원**: 푸터 버튼으로 위 키들을 JSON 내보내기/가져오기 (app.js `BACKUP_KEYS` — 새 키 추가 시 여기도 갱신, Gemini 키는 제외 유지).

**알려진 수용 리스크**: 클릭재킹 방어 없음 — `frame-ancestors`는 meta CSP에서 무시되고 GitHub Pages는 응답 헤더 설정 불가. 로그인·결제가 없어 실질 위험 낮음. framebuster JS는 프로브 iframe 검증 워크플로를 깨므로 넣지 말 것.

## 백로그 (우선순위 순)

0. **성적 산출기 v2 (버그 2건+설명+미리보기)** — 설계 완료(Fable, 2026-07-08), **`SPEC-gradecalc-v2.md` 그대로 구현할 것(Opus 위임)**. 핵심: 수행은 비율 곱하지 않고 그대로 합산 / 등급은 석차백분율이 아닌 누적인원(조견표 우선) 판정 — 현행 코드는 5명 입력 시 1등급 0명 버그
1. E-BOOK 링크 부패 점검 — textbook.js의 미래엔 URL은 JWT 토큰 만료됨(이미 지난 exp), 일부 http 링크 존재. verify에 링크 체커 추가 고려. **공개 전 처리 권장** (죽은 링크는 첫인상 훼손)
2. 다크모드 토글 UI 복원 — `toggleDarkMode()`는 있으나 호출하는 버튼이 어디에도 없음(사실상 접근 불가 기능). **`.dark-toggle` CSS는 사용자 지시로 유지해뒀음** — 버튼만 달면 됨.
3. 수업/평가계획 묶음 B — 수업계획·평가계획 설정 폼 그리드 통일(항목 순서·버튼 위치), 정기시험 툴바 정렬 + 빈 20행 시각 경량화(플레이스홀더 대비 낮추기)
4. 수업/평가계획 묶음 C — AI 2종(codevar·aiidea) API 키 입력 접이식: 키 저장 후엔 "키 등록됨 ✓ 변경/삭제" 한 줄로 접힘
5. (선택) 서브탭 8개 그룹핑 검토 — 수업/평가계획 IA 과밀의 장기 해법 (발견성 자체는 scrollIntoView+스크롤 섀도로 완화됨)
6. (선택) 시뮬레이터 예시 편성 프리셋 버튼 — 빈 상태 개선
7. (선택) CSP `img-src https:` → `'self' data:` 축소 — 현재 이미지는 전부 로컬. 단, 앱스토어 썸네일을 외부 URL로 받을 계획이면 유지
8. (선택·**사용자 결정 대기**) 도구 시그니처 색 정리 — 현재: 설계 문서 4종+성적 산출기=plan(보라), 차시=teal(역사적 경위, 팔레트 표 참조), AI 2종=ovr(인디고). 안: ⓐ 현상 유지 ⓑ 차시→plan 통일 ⓒ 계산기 2종(차시·성적)=teal로 묶어 3그룹(설계/계산기/AI) 색 인코딩 완성 — ROADMAP §3 그룹 구조와 정합해 ⓒ 권장. 결정만 나오면 Sonnet급 치환 작업

완료됨(2026-07-08, 성적 산출기 v2 설계 — Fable): 사용자 보고 4건(①수행이 비율 곱으로 반영되는 버그 → 수행은 만점=반영비율로 **무가공 합산**, 지필만 비율 곱 ②5명 입력 시 1등급 0명 → 석차백분율 직접 판정의 구조적 결함, **누적인원 경계(조견표 lookup 우선 + 반올림 공식 폴백)** 방식으로 재설계 ③중간석차·RANK.EQ 산출식 본문 설명 ④수강자수→등급별 인원 미리보기 신설)을 **`SPEC-gradecalc-v2.md`**로 설계 완료. ⚠️ N=5의 조견표 기대값(1/1/1/1/2)이 반올림 공식과 불일치(스펙 §2 표) — 사용자의 공식 조견표 복붙 대기, 받으면 GC_GRADE_TABLE에 입력. **구현은 Opus(백로그 0), 코드 미수정 상태.**

완료됨(2026-07-08, F1+F2 대수술 — Fable): **F1 confirm 전량 비동기 전환** — utils `uiConfirm(msg, {okLabel,cancelLabel})` 신설(Promise<boolean>, alertdialog, trapFocus, Escape는 stopPropagation으로 소비, 취소가 첫 포커스). confirm 7곳(evalplan·gradecalc×2·regexam·lessonplan·rubric·backup) → `async fn + await uiConfirm` 전환, alert 잔여 6곳 → uiToast. **native alert/confirm 0곳** — 신규 코드도 uiToast/uiConfirm만 쓸 것. 위임 핸들러는 async 함수 그대로 등록 가능(반환 Promise 무시됨). **F2 app.js 분해(896→622줄)** — home.js(렌더+온보딩)·collect.js(담기 패널, `collected`는 export let 라이브 바인딩)·backup.js·searchfx.js(타자 애니메이션, isIdle 콜백 주입) 4개 추출. 라우터·검색·렌더 디스패치는 의도적으로 app.js 유지(상태 결합이 깊어 분리 시 순환 import 위험 — 더 쪼개지 말 것). 검증: verify 4항목 + **헤드리스 Edge 프로브 12개 시나리오 전부 PASS**(홈/탭/서브탭/성적산출기/undo 토스트/uiConfirm 확인·취소/담기 패널/홈 복귀).

완료됨(2026-07-08, UI/UX 진단 후속 묶음): ① **데이터 백업/복원** — 푸터 "데이터 백업/백업 복원" 버튼(index.html 정적 + bindStaticHandlers). app.js `BACKUP_KEYS` 화이트리스트 7종을 JSON 파일로 내보내기/가져오기(가져오기는 형식 검증+confirm+`location.reload()`). Gemini 키는 보안상 제외, gradecalc 점수는 비영속이라 대상 아님. **새 localStorage 키를 만들면 BACKUP_KEYS에도 추가할 것.** ② **uiToast 공용화** — utils로 승격(role=status, isErr/actionLabel/onAction/duration 옵션, `.ui-toast` CSS), chasiToast는 래퍼로 위임. 초기화류에 "되돌리기" 액션 토스트(evalplan 스냅샷 복원, gradecalc는 confirm 제거하고 undo로 대체). ③ **evalReset 실버그 수정** — `export const evalState`에 재할당해 TypeError로 조용히 실패하던 것을 `Object.assign` 내용 교체로 수정 + 누락됐던 `evalSave()` 추가. ④ **서브탭 발견성** — renderTabs 끝에서 활성 서브탭 `scrollIntoView({inline:'center'})` + `.subtab-bar` 좌우 스크롤 섀도(local-attachment 배경 트릭, 라이트/다크 각각 — 배경색 바꾸면 덮개 그라데이션 색도 같이). ⑤ **검색 placeholder** — "성취기준 검색 (예: 알고리즘, 12정01-01)" (app.js+index.html 정적 셸 동기, 규칙 10). ⑥ **서브탭 화살표 키** — `data-onkeydown="app:subtabKey"` 3개 브랜치 공통, 좌우 순환+클릭+재렌더 후 포커스 복원. ⑦ **표 입력 aria-label** — gradecalc(행 맥락 "N번 1차 지필 점수", 응시 체크박스, 반영비율)·regexam(문항 주제/배점/난이도).

완료됨(2026-07-07, 성적 산출기 신규): 수업/평가계획 서브탭에 **내신 5등급제 성적 산출기**(`gradecalc.js`, key `gradecalc`, 라우팅·서브탭 order를 regexam↔chasi 사이에 삽입) 추가. 반영비율 3종(1차/2차 지필·수행), CSV 업로드/양식 내려받기(UTF-8 BOM), 직접 입력(＋학생 추가·행 삭제), 결시 처리(행별 응시 체크박스+열 헤더 '전체 응시' 일괄), 환산총점=Σ(점수×비율/100), 5등급 누적판정(10/34/66/90%). **동점자 처리 토글**(state.tieMode): 기본 `mid`=중간석차(석차+(동점자수−1)/2 백분율, NEIS 방식) / `eq`=RANK.EQ — 석차 **표기**는 항상 RANK.EQ, 백분율 판정만 모드 따름. 계산 시 confirm 점검 3종(비율 합≠100%·점수 0~100 범위 밖·학번 중복), 셀 이상치는 `.invalid`(빨강)·중복 학번은 `.dup`(노랑) 실시간 표시. 결과 내보내기: 클립보드 복사(탭 구분)+결과 CSV(`gcDownloadCsv` 공용). **입력(gc:cell/gc:ratio)은 재렌더 안 함(포커스 보존)** — 구조 변경(행 추가·삭제·CSV·전체응시·토글·계산)만 gcRerender. 결과는 비영속 module var(gcResults), 입력 바뀌면 gcClearResultDom로 낡은 결과 DOM 제거. gcMarkDups는 DOM 행 순서=state 순서 가정.
**개인정보 설계(2026-07-07 사용자 확정)**: 식별자는 학번이 아닌 **번호(1~N)** — "번호 생성" 버튼(인원수→1~N행 자동 생성, #gcFillN). 번호·점수는 **localStorage 저장 금지**(gcSave는 ratios·tieMode만 저장; 학생행 저장하는 코드 넣지 말 것), 탭 닫으면 소멸 + `beforeunload` 경고(SPA 내부 이동은 module var라 유지됨). 보관 경로는 CSV 파일. 표 위 방패 아이콘 안내문(.gc-privacy-note)이 이 방침을 설명 — 방침 바꾸면 문구도 갱신.
완료됨(2026-07-07, 보안·브랜드 마감): og:image(images/jungle.png) 딥 그린 브랜드로 재제작(3584×1184, 옛 무지개판은 jungle-font-backup에 백업. 재제작 방법: 브랜드 HTML을 헤드리스 --window-size=3584,1184로 캡처). Gemini 키 공용 PC 경고 + '저장된 키 삭제' 버튼(cv:delKey/ai:delKey, clearGeminiKey), 키 전송을 URL 쿼리 → x-goog-api-key 헤더로 전환.
완료됨(2026-07-07, 수업/평가계획 묶음A): 7개 도구 전부 ov-head 표준 헤더 적용 — 눈썹 색: 기본 5종=plan(보라), 차시=teal, AI 2종(codevar·aiidea)=**ovr(인디고, "수업/평가계획 · AI")**. utils에 `pageHead()`/`emptySteps()` 헬퍼 신설. 빈 상태는 3단계 안내(tool-steps). 이모지 전량 제거(차시 섹션 아이콘은 stroke SVG, 생성 버튼은 텍스트만 — 상태 갱신이 textContent라 아이콘 넣지 말 것). aiidea 하드코딩 sky hex(#0EA5E9 계열)·chasi 하드코딩 cyan hex → 토큰 치환. 차시 계산기는 데스크톱 2단(설정 좌/결과 우 sticky, `.chasi-cols`, 860px 이하 스택). chasi의 `color:.../font-size` 세미콜론 오타 수정.
남은 묶음: B(수업·평가계획 폼 그리드 통일, 정기시험 툴바·빈 행 경량화) / C(AI 2종 API 키 접이식).

완료됨(2026-07-07, 자료실 리디자인): 수업 도구·수업 사이트·앱스토어를 자료실 공통 문법으로 재구성 — ov-head 표준 헤더(눈썹=과목 accent), 이모지 전량 stroke SVG화, `rs-*` 공통 컴포넌트(rs-chip 필터/점프 칩, rs-sec-hd 섹션 헤더, rs-tile 이니셜·아이콘 타일; 색은 섹션의 `--rs-*` custom prop). 사이트=카테고리별 색 순환+이니셜 타일, 도구=OS 필터 칩+카테고리 아이콘 타일(SW_CAT_ICON 매핑 — 새 카테고리 추가 시 갱신), 앱스토어=썸네일 배지 오버레이+점선 등록 카드. `.astore-header` 그라데이션(옛 백로그 5번)·`.astore-submit`·`.fav-cat-title` 제거됨.
완료됨(2026-07-07, 브랜드): 구글 패러디 제거 — 워드마크·잎 `--brand` 단색화(.gl-j~e 6스팬 → .gl-mark 1스팬), '행운을 믿어요' → '랜덤 성취기준'(주사위 SVG), 히어로 슬로건·태그라인·메타 설명 교체.
완료됨(2026-07-07): 폰트 서브셋화(2.0MB→443KB, 원본은 jungle-font-backup에 백업). 죽은 CSS 정리 — `.bento-*` 전량(+state.js의 미사용 `HOME_CATEGORIES` export), `.msub-table` 계열(table/tbl-scroll/num/curri/org/grade/subj-name/ebook/year/publisher/collapse/collapse-hd)과 다크 규칙 제거. `.msub-wrap/tab/tabbar/heading/desc/cnt/subheading/sep/empty/collapse-arrow`는 textbook.js 현역이라 유지.
완료됨(2026-07-06): 교육과정 서브탭 공통 헤더(`.ov-head`)는 map·compare·simulator·guide(자체)·dsai(dac) 전부 적용. 시뮬레이터 터치 안내문구(`@media (hover:none)` 분기)·가로스크롤 힌트 적용.

## 배포 절차

1. `node tools/verify.mjs` ✅ → 2. `sw.js` CACHE 버전 업 → 3. 폴더 전체 업로드 (새 파일 누락 주의: fonts/, images/icon-*.png, boot.js 등) → 4. 배포 후 https://jgle.kr 에서 강력 새로고침으로 확인.

**부분 업로드 절대 금지.** 실제 사고(2026-07-07 발견): CSP 강화판 index.html과 위임 전환이 덜 끝난 rubric.js가 섞여 배포되어, 인라인 onclick 버튼(루브릭 복사)이 CSP에 조용히 차단됨 — 로컬에선 재현 안 되는 "버튼 무반응". JS·index.html·sw.js는 반드시 한 묶음으로 올릴 것.
