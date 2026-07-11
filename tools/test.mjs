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

const { __gcTest } = await import('../assets/gradecalc.js');
const { state, compute, gradeCums, newStudent } = __gcTest;

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

// ── 단독 실행 ───────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = runGradeTests();
  console.log('\n\x1b[1m계산 로직 단위 테스트 (gradecalc)\x1b[0m');
  if (r.fail === 0) {
    console.log(`   \x1b[32m✓\x1b[0m ${r.pass}건 전부 통과`);
    process.exit(0);
  } else {
    r.fails.forEach((f) => console.log('   \x1b[31m✗\x1b[0m ' + f));
    console.log(`\n \x1b[41m\x1b[37m ❌ ${r.fail}건 실패 / ${r.pass}건 통과 \x1b[0m`);
    process.exit(1);
  }
}
