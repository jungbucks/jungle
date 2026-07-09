# 정글(JunGLE) — 하위 모델 개발 플레이북

> 정보 교사용 올인원 웹앱 · 배포 **https://jgle.kr** (GitHub Pages, git 저장소 있음) · 순수 정적 SPA(빌드도구·npm 없음, 바닐라 ES 모듈 + CSS 1파일).
> **이 문서가 진입점.** 깊은 이력/백로그는 `ROADMAP.md`, 디자인 규칙은 `DESIGN.md`, 애매할 때 판단은 `DECISIONS.md`, 옛 상세 규칙 원본은 `CLAUDE.archive.md`.
> 이 프로젝트는 최근 JS가 다수 파일로 분화됨. **아래 매핑 표를 믿되, 수정 전 실제 파일을 한 번 더 열어 확인**(추측 금지).

## 구조 (실측 2026-07-09)

- **로드 순서**(index.html 하단): `data.js`(classic) → `boot.js`(classic) → `app.js`(`type=module`). 나머지 assets/*.js는 app.js가 import하는 ES 모듈. modulepreload 목록(index.html 9~31행)이 프리로드 관리.
- **데이터**: 전부 `assets/data.js`(classic script, `const` 전역). ACHIEVEMENTS·SUBJECTS·HS_SUBJECTS·RECOMMENDED_SITES·SW_DATA·APPSTORE_APPS 등. `boot.js`가 이 전역들을 `window.*`로 브리지.
- **CSP**: `script-src 'self'`(인라인 전면 차단). connect-src = self + generativelanguage.googleapis.com(Gemini) + date.nager.at(공휴일).

## 기능 → 파일 매핑 (가장 중요 — "무엇을 고치려면 어디를 여는가")

| 고치려는 것 | 파일 |
|---|---|
| 성취기준·과목·사이트·앱 **데이터** | `assets/data.js` (+ 새 키는 boot.js 브리지 확인) |
| 홈 화면 렌더·온보딩 | `assets/home.js` (+ index.html 정적 셸, 규칙 10) |
| 라우터·탭·검색·init·디스패치 | `assets/app.js` |
| 교육과정 개요(지도·비교·안내·DS+AI) | `assets/overview.js` |
| 편성 시뮬레이터 | `assets/simulator.js` |
| 성취기준 다중선택 공용 모달 | `assets/stdpicker.js` |
| 담은 성취기준 패널 | `assets/collect.js` |
| 성취수준 모달 | `assets/achv.js` |
| 수업계획 / 평가계획 | `assets/lessonplan.js` / `assets/evalplan.js`(서브탭 상태 `evalPlanSubtab` 원천) |
| 루브릭 / 정기시험 출제 | `assets/rubric.js` / `assets/regexam.js` |
| 성적 산출기 / 차시 계산기 | `assets/gradecalc.js` / `assets/chasi.js` |
| 코드 변형 생성기 / AI 수업 아이디어 | `assets/codevar.js` / `assets/aiidea.js` |
| Gemini API 공용 | `assets/gemini.js` |
| 교과서 / 앱스토어 / 자료실(사이트·도구) | `assets/textbook.js` / `assets/appstore.js` / `assets/resources.js` |
| 백업·복원 | `assets/backup.js` (BACKUP_KEYS 화이트리스트) |
| 검색창 타자 애니메이션 | `assets/searchfx.js` |
| 공용 유틸(esc·클립보드·registerActions·uiToast·uiConfirm·setAccent) | `assets/utils.js` |
| 파생 상수 | `assets/state.js` |
| 데이터 전역 브리지 + SW 등록 | `assets/boot.js` |
| 스타일 전체 | `assets/style.css` |
| 캐시 전략·CSP·정적 셸 | `sw.js` / `index.html` |
| 배포 전 검증기 | `tools/verify.mjs` |

## 절대 규칙 (하위 모델이 자주 실수하는 곳)

1. **모든 수정 후 `node tools/verify.mjs`** — 4항목(import 정합성/문법/전체 그래프 로드+init/SW 프리캐시 파일 존재) 통과 못 하면 배포 금지. 새 DOM API를 쓰면 verify.mjs의 DOM 스텁에도 추가.
2. **배포 묶음마다 `sw.js`의 `CACHE = 'jungle-vNN'` +1** (한 묶음이면 한 번만).
3. **파일 추가/이름변경 시 두 곳 동시 갱신**: `sw.js`의 ASSETS 배열 + `index.html`의 modulepreload 목록. 빠뜨리면 verify가 잡거나 로딩 워터폴 부활.
4. **ACHIEVEMENTS 키 접미사 체계**: 고등 `_고`, 정보과학 `_cs`(utils.js `cid` 헬퍼가 `domainName+'_고'/'_cs'` 생성, 현재 line 252). 새 과목 추가 시 **키 충돌부터 확인**. 데이터는 data.js.
5. **색상 hex 하드코딩 금지 → `:root` 토큰만.** 예외: 클립보드로 한글(HWP)/워드에 붙여넣는 HTML을 만드는 코드(`achv.js`, `rubric.js`, `evalplan.js` 표 미리보기)는 CSS 변수가 해석 안 되므로 **리터럴 hex 유지**. data.js의 과목별 색 데이터도 그대로.
6. **복사 기능은 한글 붙여넣기 호환 최우선**: 탭 구분값(TSV)·빈 줄 제거, 필요 시 clipboardWriteHTML(스타일 인라인).
7. **13px 미만 텍스트 금지**(12px는 배지·칩 하한). 본문성은 15px+.
8. **인라인 이벤트 핸들러(onclick=) 금지** — CSP에 조용히 차단됨. `data-onclick`/`-oninput`/`-onchange` + utils `registerActions()` 위임. 인라인 `<script>`도 금지(외부 파일 + ASSETS + modulepreload 등록).
9. **첫 페인트 = 최종 레이아웃**(규칙 10): index.html 정적 셸(탭·홈 상단)이 renderTabs()/renderHome() 출력과 동일. **둘 중 하나 바꾸면 나머지도 반드시 동기**(레이아웃 점프 방지).
10. **브랜드**: 'JunGLE'(Jun 소문자+GLE 대문자)·잎 로고 = `--brand` 딥그린. 구글 패러디(무지개 4색·"행운을 믿어요") 복원 금지. 새 아이콘은 이모지 대신 stroke SVG(lucide 계열).
11. **용어**: 정보교과서에 검정교과서 없음 → "인정교과서"가 올바름.
12. **파일 임의 통합/재구성 금지.** 위 매핑의 분리 기준(도구 1개 = 파일 1개, 공용은 utils/state)을 따라 배치. app.js·evalplan.js는 상태 결합이 깊어 더 쪼개지 말 것.

## 작업 절차 (모든 기능 추가 시)

1. 매핑 표에서 대상 파일 찾고 → **실제 파일을 열어 확인**(추측 금지).
2. 변경 계획을 **3줄 이내로 요약해 사용자 확인**. 새 파일 vs 기존 확장 판단은 `DECISIONS.md`.
3. 구현은 **파일 단위 최소 diff**(사용자에게 코드 인라인으로 쏟지 말 것) → `node tools/verify.mjs` → 결과 보고.
4. 배포는 사용자 몫: **git commit/push**(저장소 있음) 또는 폴더 업로드. **부분 업로드 절대 금지**(JS·index.html·sw.js는 한 묶음 — 2026-07-07 부분배포 사고 전력).

## localStorage 키 (신규 추가 시 backup.js BACKUP_KEYS도 갱신)

`collected` · `jungle_rubric` · `jungle_lesson_plan` · `jungle_evalplan` · `jungle_gradecalc`(반영비율·동점자 설정만 — **학생 점수·번호는 비영속**) · `jungle_chasi` · `jungle_darkmode` · `jungle_visited` · `jungle_last_used` · Gemini 키(gemini.js, 평문+삭제버튼, 헤더 전송). Gemini 키는 백업 제외.

## 형제 프로젝트 (별도 폴더·별도 배포 — 정글 규칙 끌어오지 말 것)

- **코드 낙하**(`C:\Users\정벅\code-drop`): Python 타이핑 게임, 정글 임베드용. **구현 완료(2026-07-09)** — `index.html`(단일, ~36KB) + `snippets.js`(75문항). 순수 HTML/CSS/JS·오프라인 더블클릭. 헤드리스 프로브 20항목 PASS. 규칙·수치는 GAME_DESIGN.md·TECH_SPEC.md가 원본(수정 금지).
- **정보카츄**: 개인 교육자료 아카이브(다크 slate + 옐로우 톤). 위치·파일은 착수 시 사용자 확인. 팔레트는 `DESIGN.md` §2-1.
- 참고: `C:\Users\정벅\ml-lecture`(ML 특강, src→dist 빌드)·`C:\Users\정벅\markdown`(Obsidian 가이드)는 자체 CLAUDE.md 보유.

## 문서 상호 참조

- **CLAUDE.md**(이 문서): 구조·매핑·절대 규칙·절차 — 최우선 진입점.
- **DESIGN.md**: 고정 토큰(변경 금지) + 디자인 감각의 언어화. UI를 만들거나 바꾸기 전 필독.
- **DECISIONS.md**: 새 파일 vs 확장, storage 선택, 접근성 최소선, "물어볼 조건" 등 애매할 때의 판단 기준.
- **ROADMAP.md**: 6개월 계획·백로그·기술부채·완료 이력.
- **CLAUDE.archive.md**: 이 문서로 압축되기 전 상세 규칙·이력 원본(참고용).
