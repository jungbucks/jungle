// ============================================================
//  정글 계산 로직 단위 테스트 (test.mjs)
//  실행:  node tools/test.mjs      (단독 실행 시 종료코드 0/1)
//  통합:  verify.mjs 의 [5] 항목이 runGradeTests() 를 호출
//
//  대상: gradecalc.js 의 순수 계산 코어(__gcTest) — 등급 판정·환산 총점.
//  "틀리면 실무 사고"인 코드의 회귀 방지가 목적. 실제 앱 코드를 직접 호출한다
//  (로직 복제 금지 — 복제하면 테스트가 자기 사본만 검증하게 됨).
// ============================================================
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ── 브라우저 환경 최소 스텁 (verify.mjs 와 동일 패턴 — gradecalc/utils 로드용) ──
function node() {
  return {
    innerHTML: '', textContent: '', value: '', dataset: {}, children: [], offsetWidth: 0,
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, appendChild() {}, remove() {}, focus() {}, click() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
  };
}
if (!globalThis.document) {
  globalThis.document = {
    getElementById() { return node(); }, querySelector() { return null; },
    querySelectorAll() { return []; }, createElement() { return node(); },
    addEventListener() {}, body: node(),
    documentElement: { setAttribute() {}, style: { setProperty() {}, removeProperty() {} } },
  };
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = (cb) => { try { cb(); } catch (e) {} return 1; };
  globalThis.setTimeout = () => 0;
  globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
  globalThis.CSS = { escape: (s) => s };
  globalThis.scrollTo = () => {};
  try { Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText() { return Promise.resolve(); } } }, configurable: true }); } catch (e) {}
}

// data.js 전역(SUBJECTS 등)을 로드 — state.js/evalplan.js가 모듈 평가 시 참조.
// (verify.mjs가 먼저 로드한 경우 중복이지만 무해)
if (!globalThis.SUBJECTS) {
  try {
    const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
    const dataSrc = readFileSync(join(assetsDir, 'data.js'), 'utf8');
    const g = ['SUBJECTS', 'ACHIEVEMENTS', 'HS_SEMS', 'HS_SUBJECTS', 'HS_TYPE_COLOR', 'APPSTORE_APPS', 'RECOMMENDED_SITES', 'SW_DATA', 'LP_METHODS', 'LP_EVAL_METHODS', 'AFFECTIVE', 'AFFECTIVE_VERIFIED'];
    (0, eval)(dataSrc + '\n' + g.map(n => `try{globalThis.${n}=${n};}catch(e){}`).join(''));
  } catch (e) { console.error('data.js 로드 실패:', e.message); }
}

const { __gcTest } = await import('../assets/gradecalc.js');
const { state, compute, gradeCums, newStudent } = __gcTest;
const { __chasiTest } = await import('../assets/chasi.js');
const { __evalTest } = await import('../assets/evalplan.js');
const { __achvTest } = await import('../assets/achv.js');
const { __affTest } = await import('../assets/affective.js');
const { getAchvKey } = await import('../assets/utils.js');

// ── 테스트 헬퍼 ──────────────────────────────────────────────
function makeStudents(rows) {
  // rows: [sid, s1, s2, sp, a1?, a2?]
  return rows.map((t) => {
    const st = newStudent(t[0], t[1] ?? '', t[2] ?? '', t[3] ?? '');
    if (t.length > 4) st.a1 = t[4];
    if (t.length > 5) st.a2 = t[5];
    return st;
  });
}
function run(rows, ratios, tieMode) {
  state.students = makeStudents(rows);
  if (ratios) state.ratios = ratios;
  state.tieMode = tieMode || 'mid';
  return compute();
}
function gradesBySid(res) { const o = {}; res.rows.forEach((r) => { o[r.sid] = r.grade; }); return o; }
function counts(cums) { return cums.map((c, i) => c - (i ? cums[i - 1] : 0)); }

export function runGradeTests() {
  const snap = { students: state.students, ratios: state.ratios, tieMode: state.tieMode };
  let pass = 0; const fails = [];
  const eq = (name, got, want) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g === w) pass++; else fails.push(`${name}: got ${g} · want ${w}`);
  };

  // ── ① gcGradeCums 등급 경계 (누적 인원) — 소인원 분포 ──
  eq('cums N=1', gradeCums(1), [0, 0, 1, 1, 1]);          // 1명 → 3등급 1명
  eq('cums N=2', gradeCums(2), [0, 1, 1, 2, 2]);
  eq('cums N=3', gradeCums(3), [0, 1, 2, 3, 3]);
  eq('cums N=4', gradeCums(4), [0, 1, 3, 4, 4]);          // 문서 예: 2·3·3·4등급
  eq('cums N=5(조견표)', gradeCums(5), [1, 2, 3, 4, 5]);   // GC_GRADE_TABLE[5]
  eq('cums N=25', gradeCums(25), [3, 9, 17, 23, 25]);
  eq('분포 N=4 (등급별 인원)', counts(gradeCums(4)), [0, 1, 2, 1, 0]);
  eq('분포 N=25 (등급별 인원)', counts(gradeCums(25)), [3, 6, 8, 6, 2]); // 문서 예와 일치

  // ── ② 수행 무가공 합산 (v2 핵심 회귀 — 구버그: 수행에 비율 곱해 76) ──
  {
    const r = run([['1', '100', '100', '40']], { e1: 30, e2: 30, perf: 40 }, 'mid');
    eq('수행 무가공 100*.3+100*.3+40', r.rows[0].total, 100);
  }
  // ── ③ 결시 처리 (a1=false → 1차 0점) ──
  {
    const r = run([['1', '100', '100', '40', false, true]], { e1: 30, e2: 30, perf: 40 }, 'mid');
    eq('1차 결시', r.rows[0].total, 70); // 0 + 30 + 40
  }
  // ── ④ 5명 분포: 1등급이 반드시 존재 (구버그: 5명 시 1등급 0명) ──
  {
    const r = run([['A', '100'], ['B', '90'], ['C', '80'], ['D', '70'], ['E', '60']], { e1: 100, e2: 0, perf: 0 }, 'mid');
    eq('5명 등급(석차순)', r.rows.map((x) => x.grade), [1, 2, 3, 4, 5]);
  }
  // ── ⑤ 동점 경계: 중간석차 vs RANK.EQ 가 등급을 다르게 판정 ──
  {
    const rows = [['A', '100'], ['B', '100'], ['C', '90'], ['D', '80'], ['E', '70']];
    const ratios = { e1: 100, e2: 0, perf: 0 };
    eq('동점 top · RANK.EQ (전원 위 등급)', gradesBySid(run(rows, ratios, 'eq')), { A: 1, B: 1, C: 3, D: 4, E: 5 });
    eq('동점 top · 중간석차 (전원 아래 등급)', gradesBySid(run(rows, ratios, 'mid')), { A: 2, B: 2, C: 3, D: 4, E: 5 });
  }
  // ── ⑥ 반영 비율이 반영되는지 (1차만 100% → 총점=1차 점수) ──
  {
    const r = run([['1', '88', '0', '0']], { e1: 100, e2: 0, perf: 0 }, 'mid');
    eq('비율 100% 반영', r.rows[0].total, 88);
  }

  // 상태 복원 (모듈 싱글턴 — 다른 검사에 영향 주지 않도록)
  state.students = snap.students; state.ratios = snap.ratios; state.tieMode = snap.tieMode;
  return { pass, fail: fails.length, fails };
}

// ============================================================
//  chasi (차시 계산) — chasiCalc·chasiWeeklyAlerts
//  ※ Date+toISOString의 TZ 시프트는 제외일·루프가 동일하게 적용돼
//    total/주당시수는 TZ 불변. 테스트는 TZ 불변 값으로만 단언.
//  (2026-01-05=월 … 01-09=금, 01-10=토, 01-11=일)
// ============================================================
export function runChasiTests() {
  const { state, calc, alerts } = __chasiTest;
  const snap = JSON.stringify({ s: state.startDate, e: state.endDate, d: state.days, x: state.exceptions, sem: state.semester });
  let pass = 0; const fails = [];
  const eq = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) pass++; else fails.push(`${name}: got ${g} · want ${w}`); };
  const set = (s, e, d, x) => { state.startDate = s; state.endDate = e; state.days = d; state.exceptions = x || []; };

  // 주당 시수 = days 합
  set('2026-01-05', '2026-01-09', [1, 1, 0, 0, 0]); eq('주당시수 2', calc().weeklyHours, 2);
  set('2026-01-05', '2026-01-09', [2, 0, 2, 0, 0]); eq('주당시수 4(블록)', calc().weeklyHours, 4);
  // 한 주(월~금) 매일 1시수 → 5차시
  set('2026-01-05', '2026-01-09', [1, 1, 1, 1, 1]); eq('한 주 5일 → 5차시', calc().total, 5);
  // 블록타임 월·수 → 4차시
  set('2026-01-05', '2026-01-09', [2, 0, 2, 0, 0]); eq('월·수 블록 → 4차시', calc().total, 4);
  // 주말만 선택된 범위 → 0 (요일 스킵)
  set('2026-01-10', '2026-01-11', [1, 1, 1, 1, 1]); eq('주말 범위 → 0', calc().total, 0);
  // 예외일이 수업일(수요일) 제거 → 4차시
  set('2026-01-05', '2026-01-09', [1, 1, 1, 1, 1], [{ id: 1, label: '행사', start: '2026-01-07', end: '2026-01-07' }]);
  eq('수요일 제외 → 4차시', calc().total, 4);
  // 잘못된 범위·빈 요일 → 0
  set('2026-01-09', '2026-01-05', [1, 1, 1, 1, 1]); eq('시작>종료 → 0', calc().total, 0);
  set('2026-01-05', '2026-01-09', [0, 0, 0, 0, 0]); eq('요일 0 → 0', calc().total, 0);
  // 월별 합 = 총계 (TZ로 월 경계가 흔들려도 합은 total과 일치)
  set('2026-03-02', '2026-04-30', [1, 1, 1, 1, 1]);
  { const r = calc(); eq('월별 합 == 총계', r.monthly.reduce((s, m) => s + m.hours, 0), r.total); }
  // 주별 변동 경고: 예외 없으면 0, 수요일 제외면 1건(lost 1)
  set('2026-01-05', '2026-01-09', [1, 1, 1, 1, 1]); eq('경고 없음', alerts().length, 0);
  set('2026-01-05', '2026-01-09', [1, 1, 1, 1, 1], [{ id: 1, label: '행사', start: '2026-01-07', end: '2026-01-07' }]);
  { const a = alerts(); eq('경고 1건 lost=1', [a.length, a[0] && a[0].lost], [1, 1]); }

  const b = JSON.parse(snap); state.startDate = b.s; state.endDate = b.e; state.days = b.d; state.exceptions = b.x; state.semester = b.sem;
  return { pass, fail: fails.length, fails };
}

// ============================================================
//  evalplan (평가계획 비율) — 비율 합계·자동 분배·논술형 반영비율
// ============================================================
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

  // ── data.js 정합성: 모든 과목의 모든 도메인명이 ACHIEVEMENTS 키와 매칭되어야 한다 ──
  // 하나라도 어긋나면 그 단원이 학기 단위 성취수준·ABCDE 모달에서 통째로 누락된다
  // (2026-07-21 실사고: 소프트웨어와 생활 3개 단원의 " 영역" 접미사 불일치로 19개 중 7개만 반영).
  SUBJECTS.filter(s => s.domains && s.domains.length).forEach(s => {
    // 도메인이 하나도 매칭 안 되면 성취수준 미보유 과목(예: 프로그래밍 — 데이터 부재는 의도됨). 스킵.
    // 하나라도 매칭되면 성취수준을 가진 과목이므로 나머지도 전부 매칭돼야 한다(부분 불일치 = 오타).
    if (!s.domains.some(d => ACHIEVEMENTS[getAchvKey(s.id, d.name)])) return;
    s.domains.forEach(d => {
      eq(`도메인 키 매칭 ${s.id}/${d.name}`, !!ACHIEVEMENTS[getAchvKey(s.id, d.name)], true);
    });
  });

  return { pass, fail: fails.length, fails };
}

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
  eq('행 필드', Object.keys(rows[0]).sort(), ['assess', 'codes', 'domain', 'values']);
  eq('없는 과목 = null', affectiveRows('nope'), null);

  // 정합성: 모든 과목의 domain이 SUBJECTS에 실재, codes가 성취기준에 실재
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

export function runEvalTests() {
  const { ratioSum, essayRatio, distribute } = __evalTest;
  let pass = 0; const fails = [];
  const eq = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) pass++; else fails.push(`${name}: got ${g} · want ${w}`); };

  // 비율 합계
  eq('합계 100', ratioSum([{ ratio: 30 }, { ratio: 30 }, { ratio: 40 }]), 100);
  eq('합계 미달 90', ratioSum([{ ratio: 40 }, { ratio: 50 }]), 90);
  eq('빈/문자 무시', ratioSum([{ ratio: 50 }, { ratio: '' }, {}]), 50);
  // 자동 분배: 합이 항상 100, 앞쪽이 나머지 흡수
  eq('분배 3개 = [34,33,33]', distribute(3), [34, 33, 33]);
  eq('분배 4개 = [25,25,25,25]', distribute(4), [25, 25, 25, 25]);
  eq('분배 7개 합 100', distribute(7).reduce((s, x) => s + x, 0), 100);
  eq('분배 6개 = [17,17,17,17,16,16]', distribute(6), [17, 17, 17, 17, 16, 16]);
  eq('분배 0개 = []', distribute(0), []);
  // 논술형 반영비율: 정기시험은 논술 배점 비중 × 반영비율, 수행은 isEssay면 전액
  eq('시험 논술 절반', essayRatio([{ type: 'exam', ratio: 40, scoreChoice: 50, scoreEssay: 50 }]), 20);
  eq('시험 논술 0', essayRatio([{ type: 'exam', ratio: 40, scoreChoice: 100, scoreEssay: 0 }]), 0);
  eq('수행 논술형 전액', essayRatio([{ type: 'perf', ratio: 30, isEssay: true }]), 30);
  eq('수행 비논술 0', essayRatio([{ type: 'perf', ratio: 30, isEssay: false }]), 0);
  eq('혼합 20+30=50', essayRatio([{ type: 'exam', ratio: 40, scoreChoice: 50, scoreEssay: 50 }, { type: 'perf', ratio: 30, isEssay: true }]), 50);

  return { pass, fail: fails.length, fails };
}

// 전체 집계 (verify [5]가 호출)
export function runAllTests() {
  const parts = [['gradecalc', runGradeTests()], ['chasi', runChasiTests()], ['evalplan', runEvalTests()], ['achv', runAchvTests()], ['affective', runAffectiveTests()]];
  let pass = 0; const fails = [];
  for (const [name, r] of parts) { pass += r.pass; r.fails.forEach(f => fails.push(name + ' — ' + f)); }
  return { pass, fail: fails.length, fails, parts };
}

// ── 단독 실행 ───────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = runAllTests();
  console.log('\n\x1b[1m계산 로직 단위 테스트 (gradecalc · chasi · evalplan · achv · affective)\x1b[0m');
  r.parts.forEach(([name, p]) => console.log(`   ${p.fail === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}: ${p.pass}건 ${p.fail === 0 ? '통과' : `· ${p.fail}건 실패`}`));
  if (r.fail === 0) {
    console.log(`   \x1b[32m✓\x1b[0m 합계 ${r.pass}건 전부 통과`);
    process.exit(0);
  } else {
    r.fails.forEach((f) => console.log('   \x1b[31m✗\x1b[0m ' + f));
    console.log(`\n \x1b[41m\x1b[37m ❌ ${r.fail}건 실패 / ${r.pass}건 통과 \x1b[0m`);
    process.exit(1);
  }
}
