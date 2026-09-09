// 실제 앱 이벤트 → CSV/클립보드/모달을 검증한다. 디스크·사용자 데이터는 쓰지 않는다.
import './test.mjs';
import assert from 'node:assert/strict';
import { initDelegation } from '../assets/utils.js';
import { __gcTest as gc } from '../assets/gradecalc.js';
import { __chasiTest as ch, renderChasi } from '../assets/chasi.js';
import { evalState, __evalTest as ep } from '../assets/evalplan.js';
import { openStdPicker } from '../assets/stdpicker.js';
import '../assets/lessonplan.js';
import '../assets/rubric.js';
import { renderAll } from './render.mjs';
import { runInvariants } from './invariants.mjs';

const events = {};
initDelegation({ addEventListener(type, fn) { events[type] = fn; } });
function fire(type, name, args = [], fields = {}) {
  const el = { ...fields, closest() { return this; },
    getAttribute(key) { return key === 'data-args' ? JSON.stringify(args) : name; } };
  events[type]({ target: el });
}
function node() {
  return { innerHTML: '', textContent: '', disabled: false, style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}, focus() {}, setAttribute() {} };
}
const originalGet = document.getElementById;
const nodes = new Map();
document.getElementById = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
const savedClipboard = navigator.clipboard;
let copied = '';
navigator.clipboard = { writeText(s) { copied = s; return Promise.resolve(); } };
const originalUrl = URL.createObjectURL;
let blob;
URL.createObjectURL = value => { blob = value; return 'blob:test'; };
const snapshot = { gc: structuredClone(gc.state), ch: structuredClone(ch.state), ep: structuredClone(evalState), tz: process.env.TZ };
let pass = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); pass++; } catch (e) { failures.push(`${name}: ${e.message}`); }
}
try {
  await test('CSV 저장/재입력은 응시 상태와 총점을 보존', async () => {
    gc.state.ratios = { e1: 30, e2: 30, perf: 40 };
    gc.state.students = [gc.newStudent('1', '100', '100', '40')];
    gc.state.students[0].a1 = false;
    assert.equal(gc.compute().rows[0].total, 70);
    fire('click', 'gc:csvDown');
    gc.state.students = gc.parseCsv(await blob.text());
    assert.equal(gc.compute().rows[0].total, 70);
    assert.equal(gc.state.students[0].a1, false);
  });
  await test('헤더 없는 소수 첫 행을 버리지 않음', () => {
    assert.deepEqual(gc.parseCsv('1,.5,80,30\n2,90,80,30').map(s => s.sid), ['1', '2']);
  });
  await test('추가 메모 열 때문에 첫 행을 버리지 않음', () => {
    assert.deepEqual(gc.parseCsv('1,80,80,30,memo\n2,90,80,30,memo').map(s => s.sid), ['1', '2']);
  });
  await test('기존 4열 양식은 헤더를 제외하고 기본 응시로 읽음', () => {
    const rows = gc.parseCsv('\uFEFF번호,1차점수,2차점수,수행점수(만점=반영비율)\r\n1,80,90,30');
    assert.equal(rows.length, 1); assert.equal(rows[0].sid, '1');
    assert.equal(rows[0].a1, true); assert.equal(rows[0].a2, true);
  });
  const item = (type, ratio) => ({ type, ratio, name: type, scoreChoice: 70, scoreEssay: 30, linkedCodes: [], elements: '', period: '' });
  for (const total of [70, 100, 110]) {
    await test(`평가계획 미리보기/복사 합계 ${total}%`, () => {
      evalState.items = [item('exam', 30), item('perf', total - 30)];
      const html = ep.previewTableHtml();
      const row = html.match(/<tbody>([\s\S]*?)<\/tr>/)[1];
      const last = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].at(-1)[1];
      assert.equal(last, `${total}%`);
      window.evalCopyPreviewTable();
      assert.equal(copied.split('\n')[1].split('\t').at(-1), `${total}%`);
      assert.equal(copied.split('\n')[2].split('\t').at(-1), `${total}%`);
    });
  }
  for (const tz of ['Asia/Seoul', 'UTC', 'America/New_York']) {
    await test(`월 경계 집계/제외일 경고 ${tz}`, () => {
      process.env.TZ = tz;
      Object.assign(ch.state, { startDate: '2026-09-01', endDate: '2026-09-01', days: [0,1,0,0,0], exceptions: [] });
      assert.deepEqual(ch.calc().monthly, [{ month: '2026-09', hours: 1 }]);
      ch.state.exceptions = [{ start: '2026-09-01', end: '2026-09-01', label: '행사' }];
      assert.equal(ch.calc().total, 0);
      assert.equal(ch.alerts().length, 1); assert.equal(ch.alerts()[0].lost, 1);
    });
  }
  await test('블록타임 표시도 시수 합계를 사용', () => {
    ch.state.days = [0,2,0,0,0];
    assert.equal(/주당 <strong>2<\/strong>시수/.test(renderChasi()), true);
  });
  const middle = SUBJECTS.findIndex(s => s.id === 'middle');
  const high = SUBJECTS.findIndex(s => s.id === 'high');
  const mc = SUBJECTS[middle].domains[0].items[0].code;
  const hc = SUBJECTS[high].domains[0].items[0].code;
  await test('과목 변경 시 이전 과목의 선택을 비움', () => {
    let result;
    openStdPicker({ subjectIdx: middle, preselected: [mc], onConfirm: codes => { result = codes; } });
    window.stdPickerChangeSubject(high);
    fire('change', 'sp:toggle', [hc], { checked: true });
    window.stdPickerConfirm(); assert.deepEqual(result, [hc]);
  });
  await test('평가계획 선택기는 계획 과목 고정', () => {
    evalState.subjectIdx = middle; evalState.items = [item('exam', 100)];
    fire('click', 'ev:openModal', [0]);
    window.stdPickerChangeSubject(high);
    fire('change', 'sp:toggle', [hc], { checked: true });
    window.stdPickerConfirm(); assert.deepEqual(evalState.items[0].linkedCodes, []);
    assert.equal(document.getElementById('stdPickerSubjSel').disabled, true);
  });
  await test('수업계획 복사는 평가방법 열을 포함', () => {
    fire('input', 'lp:startMW', [], { value: '9/1' });
    fire('input', 'lp:endMW', [], { value: '9/1' });
    fire('click', 'lp:generate');
    fire('change', 'lp:evalMethod', [0], { value: '수행평가' });
    fire('click', 'lp:copy');
    assert.equal(copied.split('\n')[0].split('\t').at(-1), '평가방법');
    assert.equal(copied.split('\n')[1].split('\t').at(-1), '수행평가');
  });
  await test('클래스가 추가된 행의 정렬 오류도 검출', async () => {
    const screens = await renderAll();
    for (const s of screens.filter(s => s.kind === 'evalPreview')) {
      s.html = s.html.replace(/<tr([^>]*)>(\s*<td[^>]*>영역 만점)/, '<tr$1 class="changed">$2')
        .replaceAll('line-height:1.8;text-align:center', 'line-height:1.8');
    }
    assert.ok(runInvariants(screens).violations.length >= 2);
  });

  await test('양쪽 미응시도 저장 후 보존하고 번호 쉼표를 복원', async () => {
    gc.state.students = [gc.newStudent('1,특수', '90', '80', '20')];
    gc.state.students[0].a1 = false; gc.state.students[0].a2 = false;
    fire('click', 'gc:csvDown');
    const rows = gc.parseCsv(await blob.text());
    assert.deepEqual([rows[0].sid, rows[0].a1, rows[0].a2], ['1,특수', false, false]);
  });
  await test('응시 열 순서가 바뀌어도 헤더 이름으로 읽음', () => {
    const rows = gc.parseCsv('번호,1차점수,2차점수,수행점수,2차응시,메모,1차응시\n1,90,80,20,0,메모,1');
    assert.deepEqual([rows[0].a1, rows[0].a2], [true, false]);
  });
  await test('잘못된 점수·응시 문자열을 조용히 변환하지 않음', () => {
    assert.throws(() => gc.parseCsv('1,80oops,90,30'), /숫자/);
    assert.throws(() => gc.parseCsv('번호,1차점수,2차점수,수행점수,1차응시\n1,80,90,30,maybe'), /응시/);
    assert.throws(() => gc.parseCsv('순위,번호,환산 총점,석차 백분율,예상 등급\n1,1,80,10%,1등급'), /산출결과/);
  });
  await test('수업계획과 루브릭도 과목 고정', () => {
    fire('change', 'lp:subject', [], { value: String(middle) });
    fire('click', 'lp:openModal', [0]);
    window.stdPickerChangeSubject(high);
    fire('change', 'sp:toggle', [hc], { checked: true });
    window.stdPickerConfirm();
    assert.deepEqual(JSON.parse(localStorage.getItem('jungle_lesson_plan')).rows[0].linkedCodes, []);
    fire('change', 'rubric:subject', [], { value: String(middle) });
    fire('click', 'rubric:openModal');
    window.stdPickerChangeSubject(high);
    fire('change', 'sp:toggle', [hc], { checked: true });
    window.stdPickerConfirm();
    assert.deepEqual(JSON.parse(localStorage.getItem('jungle_rubric')).selectedCodes, []);
  });
  await test('과목 전환 가능한 선택기는 잠금 상태를 이어받지 않음', () => {
    let chosen;
    openStdPicker({ subjectIdx: middle, preselected: [mc, hc], onConfirm: codes => { chosen = codes; } });
    assert.equal(document.getElementById('stdPickerSubjSel').disabled, false);
    window.stdPickerConfirm(); assert.deepEqual(chosen, [mc]);
  });
  await test('행/셀 속성 추가와 스타일 공백은 정상 표를 실패시키지 않음', async () => {
    const screens = await renderAll();
    for (const s of screens.filter(s => s.kind === 'evalPreview')) {
      s.html = s.html.replaceAll('<tr ', '<tr class="row" ').replaceAll('<td ', '<td class="cell" ')
        .replaceAll('background:var(--g50)', 'background: var(--g50)').replaceAll('text-align:center', 'text-align: center');
    }
    assert.deepEqual(runInvariants(screens).violations, []);
  });
  await test('필수 행 하나가 제거되면 실패', async () => {
    const screens = await renderAll();
    for (const s of screens.filter(s => s.kind === 'evalPreview'))
      s.html = s.html.replace(/<tr data-eval-row="score">[\s\S]*?<\/tr>/, '');
    assert.ok(runInvariants(screens).violations.length >= 2);
  });
  await test('한 행에서 셀 하나만 제거되어도 실패', async () => {
    const screens = await renderAll();
    for (const s of screens.filter(s => s.kind === 'evalPreview'))
      s.html = s.html.replace(/(<tr data-eval-row="score">)[\s\S]*?<\/td>/, '$1');
    assert.ok(runInvariants(screens).violations.length >= 2);
  });

  await test('계산과 다르게 해석되는 진법 표기는 거부', () => {
    for (const score of ['0x50', '0b1010', '0o12'])
      assert.throws(() => gc.parseCsv('1,' + score + ',0,0'), /숫자/);
    assert.equal(gc.parseCsv('1,8e1,.5,1.')[0].s1, '8e1');
  });
} finally {
  Object.assign(gc.state, snapshot.gc); Object.assign(ch.state, snapshot.ch); Object.assign(evalState, snapshot.ep);
  if (snapshot.tz === undefined) delete process.env.TZ; else process.env.TZ = snapshot.tz;
  document.getElementById = originalGet; navigator.clipboard = savedClipboard; URL.createObjectURL = originalUrl;
}
failures.forEach(f => console.error('FAIL ' + f));
console.log(`사용자 흐름 회귀: ${pass} 통과 / ${failures.length} 실패`);
process.exitCode = failures.length ? 1 : 0;
