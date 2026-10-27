import { esc, registerActions, pageHead, emptySteps, uiToast, uiConfirm, clipboardWriteHTML, clipboardWriteText } from './utils.js';
import { evalPlanSubtab } from './evalplan.js';
import { LP_SEM_DEFAULTS } from './state.js';
import { openStdPicker } from './stdpicker.js';
import { collected } from './collect.js';
import * as planCtx from './planctx.js';

// 주차 행 유형 — 수업이 아닌 행은 성취기준을 받지 않고 자동 배분·담은 항목 채우기에서 빠진다
const LP_KINDS = [
  { key: 'lesson',   label: '수업' },
  { key: 'exam',     label: '정기시험' },
  { key: 'event',    label: '학교행사' },
  { key: 'vacation', label: '방학' },
];
const LP_KIND_LABEL = Object.fromEntries(LP_KINDS.map(k => [k.key, k.label]));
// 한글 붙여넣기용 HTML이라 CSS 변수 대신 리터럴 hex (CLAUDE.md 규칙 5 예외)
const LP_KIND_HEX = { exam: '#FEF2F2', event: '#F5F3FF', vacation: '#F3F4F6' };

// --- 저장 형식 마이그레이션 ---
// v1(~2026-10): 행 = {monthWeek, domain, linkedCodes, method:'', evalMethod:''}
// v2: 행 = {monthWeek, kind, domain, linkedCodes, content, methods:[], evalMethods:[]}
// 옛 문자열 값은 한 칸짜리 배열로 옮긴다. 모르는 필드는 그대로 둔다.
function lpMigrateRow(r) {
  const row = { ...(r || {}) };
  const toList = (list, single) => Array.isArray(list) ? list.filter(Boolean) : (single ? [single] : []);
  row.monthWeek = typeof row.monthWeek === 'string' ? row.monthWeek : '';
  row.kind = LP_KIND_LABEL[row.kind] ? row.kind : 'lesson';
  row.domain = row.domain || '';
  row.linkedCodes = Array.isArray(row.linkedCodes) ? row.linkedCodes : [];
  row.content = row.content || '';
  row.methods = toList(row.methods, row.method);
  row.evalMethods = toList(row.evalMethods, row.evalMethod);
  delete row.method; delete row.evalMethod;
  return row;
}
function lpMigrate(s) {
  if (!s || typeof s !== 'object') return lpDefaultState();
  const def = LP_SEM_DEFAULTS[s.semester] || LP_SEM_DEFAULTS[1];
  if (!s.semester) s.semester = 1;
  if (!s.startMW) s.startMW = def.startMW;
  if (!s.endMW)   s.endMW   = def.endMW;
  if (typeof s.subjectIdx !== 'number') s.subjectIdx = 1;
  s.rows = Array.isArray(s.rows) ? s.rows.map(lpMigrateRow) : [];
  s.version = 2;
  return s;
}
function lpDefaultState(semester = 1, subjectIdx = 1) {
  const def = LP_SEM_DEFAULTS[semester] || LP_SEM_DEFAULTS[1];
  return { version:2, subjectIdx, semester, startMW:def.startMW, endMW:def.endMW, generated:false, rows:[] };
}
function lpNewRow(monthWeek = '') {
  return { monthWeek, kind:'lesson', domain:'', linkedCodes:[], content:'', methods:[], evalMethods:[] };
}

// --- Lesson Plan State ---
// 저장: jungle_lesson_plan = { v:2, slots: { '<과목id>:<학기>': 수업계획 } } (planctx 슬롯 저장소)
// 예전 단일 객체(subjectIdx·semester 포함)는 그 과목·학기 슬롯으로 옮긴다.
const lpStore = planCtx.slotStore('jungle_lesson_plan', { legacyToSlot: raw => [planCtx.legacyKey(raw), lpMigrate(raw)] });
function lpLoadSlot() {
  const c = planCtx.get();
  const idx = planCtx.subjectIdx(c);
  const raw = lpStore.load();
  const s = raw ? lpMigrate(raw) : lpDefaultState(c.semester, idx);
  // 과목·학기는 컨텍스트가 원천 — 슬롯 안 값은 표시·호환용 사본
  s.subjectIdx = idx;
  s.semester = c.semester;
  return s;
}
let lessonState = lpLoadSlot();
planCtx.subscribe(() => { lessonState = lpLoadSlot(); });
planCtx.provide('lesson', () => lessonState);

function lpSave() { lpStore.save(lessonState); planCtx.touched(); }
// '3/1' 또는 '3월 1주' → {m, w}. 1~12월, 1~5주만 유효(달력 기준 5주차가 있는 달 — 차시 계산기 반영).
function lpParseWeek(str) {
  const t = String(str || '').trim().match(/^(\d{1,2})\s*(?:\/|월)\s*(\d)\s*주?$/);
  if (!t) return null;
  const m = +t[1], w = +t[2];
  return (m >= 1 && m <= 12 && w >= 1 && w <= 5) ? { m, w } : null;
}
function lpFormatMW(mw) {
  const p = lpParseWeek(mw);
  return p ? `${p.m}월 ${p.w}주` : (mw || '');
}
function lpGenWeeks(semester, startMW, endMW) {
  const s = lpParseWeek(startMW), e = lpParseWeek(endMW);
  // month sequence per semester (wraps Jan after Dec for semester 2)
  const seq = semester === 2
    ? [8,9,10,11,12,1,2,3,4,5,6,7]
    : [1,2,3,4,5,6,7,8,9,10,11,12];
  if (s && e) {
    const weeks = [];
    let on = false, done = false;
    for (const m of seq) {
      if (done) break;
      for (let w = 1; w <= 4; w++) {
        if (m === s.m && w === s.w) on = true;
        if (on) weeks.push(m + '/' + w);
        if (m === e.m && w === e.w) { done = true; break; }
      }
    }
    if (weeks.length) return weeks;
  }
  // fallback to hardcoded defaults
  const def = LP_SEM_DEFAULTS[semester] || LP_SEM_DEFAULTS[1];
  return lpGenWeeks(semester, def.startMW, def.endMW);
}
// 성취기준 n개를 수업 행 k개에 순서대로 고르게 나눈다.
// n ≥ k: 앞 행부터 floor 경계로 묶음(행마다 1개 이상). n < k: 한 성취기준이 여러 주에 걸친다.
function lpDistribute(n, k) {
  if (!k) return [];
  if (!n) return Array.from({ length: k }, () => []);
  if (n >= k) return Array.from({ length: k }, (_, r) => {
    const a = Math.floor(r * n / k), b = Math.floor((r + 1) * n / k);
    return Array.from({ length: b - a }, (_, j) => a + j);
  });
  return Array.from({ length: k }, (_, r) => [Math.floor(r * n / k)]);
}
// 단원 경계를 지키는 자동 배분 (2026-10 버그: 한 주에 다른 단원이 섞이는데 단원명은 첫 단원만 보였다)
// counts = 단원별 성취기준 수, k = 수업 주 수. 반환: 주마다 [{d: 단원 번호, i: 그 단원 안 성취기준 번호}]
// k ≥ 단원 수: 성취기준 수에 비례해 주를 나눈다(최대 잉여 방식, 단원마다 최소 1주) → 섞이지 않는다.
// k < 단원 수: 섞을 수밖에 없다 → 전체를 순서대로 나누고 mixed=true.
function lpPlanByDomain(counts, k) {
  const ds = counts.map((c, d) => ({ c, d })).filter(x => x.c > 0);
  const N = ds.reduce((a, x) => a + x.c, 0);
  if (!k || !N) return { weeks: Array.from({ length: k }, () => []), mixed: false };
  if (k < ds.length) {
    const flat = ds.flatMap(x => Array.from({ length: x.c }, (_, i) => ({ d: x.d, i })));
    return { weeks: lpDistribute(flat.length, k).map(ix => ix.map(j => flat[j])), mixed: true };
  }
  const quota = ds.map(x => k * x.c / N);
  const alloc = quota.map(q => Math.max(1, Math.floor(q)));
  let sum = alloc.reduce((a, b) => a + b, 0);
  const rem = i => quota[i] - Math.floor(quota[i]);
  while (sum < k) { // 남은 주는 소수부가 큰 단원부터
    const i = alloc.map((_, j) => j).sort((a, b) => rem(b) - rem(a) || ds[b].c - ds[a].c)[0];
    alloc[i]++; sum++; quota[i] = Math.floor(quota[i]); // 같은 단원에 두 번 몰리지 않게 소수부를 비운다
  }
  while (sum > k) { // 최소 1주 보장 때문에 넘친 만큼, 주를 가장 많이 받은 단원에서 뺀다
    const i = alloc.map((_, j) => j).filter(j => alloc[j] > 1).sort((a, b) => (alloc[b] / ds[b].c) - (alloc[a] / ds[a].c))[0];
    alloc[i]--; sum--;
  }
  const weeks = [];
  ds.forEach((x, j) => lpDistribute(x.c, alloc[j]).forEach(ix => weeks.push(ix.map(i => ({ d: x.d, i })))));
  return { weeks, mixed: false };
}
const ROMAN = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ'];
function lpWeekError(val) {
  return lpParseWeek(val) ? '' : '1~12월, 1~5주로 입력하세요 (예: 3/1 = 3월 1주)';
}
// 입력 중에는 다시 그리지 않고(포커스 유지) 옆의 안내·오류 문구만 바꾼다
function lpShowWeekNote(which, val) {
  const err = lpWeekError(val);
  const note = document.getElementById('lpWeekNote_' + which);
  const input = document.getElementById('lpWeek_' + which);
  if (note) { note.textContent = err || lpFormatMW(val); note.classList.toggle('err', !!err); }
  if (input) input.setAttribute('aria-invalid', err ? 'true' : 'false');
}
function lpSetStartMW(val) {  lessonState.startMW = val.trim();  lpSave(); lpShowWeekNote('start', val);}
function lpSetEndMW(val) {  lessonState.endMW = val.trim();  lpSave(); lpShowWeekNote('end', val);}
async function lpGenerate() {
  if (lpWeekError(lessonState.startMW) || lpWeekError(lessonState.endMW)) {
    uiToast('시작·종료 주차를 확인하세요 (예: 3/1 = 3월 1주).', { isErr: true });
    return;
  }
  if (lessonState.rows.some(lpRowHasData) &&
    !(await uiConfirm('계획표를 다시 만들면 지금 입력한 내용이 지워집니다. 계속할까요?', { okLabel: '다시 만들기' }))) return;
  const weeks = lpGenWeeks(lessonState.semester, lessonState.startMW, lessonState.endMW);
  lessonState.rows = weeks.map(mw => lpNewRow(mw));
  delete lessonState.chasiTotal; // 직접 만든 주차는 차시 계산기 기준이 아니다
  lessonState.generated = true;
  lpSave(); lpRerender();
}
function lpRowHasData(r) {
  return !!(r.domain || r.linkedCodes.length || r.content || r.methods.length || r.evalMethods.length || r.kind !== 'lesson');
}
function lpAddRow() {
  lessonState.rows.push(lpNewRow());
  lpSave(); lpRerender();
}
function lpDeleteRow(i) {
  lessonState.rows.splice(i, 1);
  lpSave(); lpRerender();
}
function lpUpdateMW(i, el) {
  const raw = el.textContent.trim();
  const p = lpParseWeek(raw);
  lessonState.rows[i].monthWeek = p ? p.m + '/' + p.w : raw;
  lpSave();
  el.textContent = lpFormatMW(lessonState.rows[i].monthWeek);
  el.classList.toggle('bad', !!raw && !p);
  el.setAttribute('aria-invalid', raw && !p ? 'true' : 'false');
}
function lpSetDomain(i, val) {
  lessonState.rows[i].domain = val;
  lessonState.rows[i].linkedCodes = [];
  delete lessonState.rows[i].mixedDomains;
  lpSave(); lpRerender();
}
function lpSetKind(i, val) {
  if (!LP_KIND_LABEL[val]) return;
  lessonState.rows[i].kind = val; // 단원·성취기준은 지우지 않는다 — '수업'으로 되돌리면 그대로 돌아온다
  lpSave(); lpRerender();
}
function lpSetContent(i, val) { lessonState.rows[i].content = val; lpSave(); }
// 다중 선택(수업방법·평가방법): 열린 드롭다운을 유지하려고 해당 칸만 갱신
function lpToggleMulti(i, field, value, on) {
  const row = lessonState.rows[i];
  if (!row || (field !== 'methods' && field !== 'evalMethods')) return;
  const set = new Set(row[field]);
  on ? set.add(value) : set.delete(value);
  const order = field === 'methods' ? LP_METHODS : LP_EVAL_METHODS;
  row[field] = order.filter(m => set.has(m));
  lpSave();
  const sum = document.getElementById(`lpSum_${field}_${i}`);
  if (sum) sum.textContent = row[field].join(', ') || '선택';
  if (field === 'evalMethods') {
    const tr = document.querySelector(`.lp-table tr[data-row="${i}"]`);
    if (tr) tr.className = lpRowClass(row);
  }
}
function lpRowClass(row) {
  if (row.kind !== 'lesson') return 'lp-row-' + row.kind;
  if (row.evalMethods.includes('지필평가')) return 'lp-row-paper';
  if (row.evalMethods.includes('수행평가')) return 'lp-row-perf';
  return '';
}
function lpUnlinkCode(i, code) {
  lessonState.rows[i].linkedCodes = lessonState.rows[i].linkedCodes.filter(c => c !== code);
  lpSave(); lpRerender();
}
// 이 행의 단원을 바로 아래 '단원이 빈 수업 행'들에 이어서 적용 (단원이 정해진 행을 만나면 멈춤)
function lpFillDown(i) {
  const src = lessonState.rows[i];
  if (!src || !src.domain) { uiToast('먼저 이 행의 단원을 고르세요.'); return; }
  let n = 0;
  for (let j = i + 1; j < lessonState.rows.length; j++) {
    const r = lessonState.rows[j];
    if (r.kind !== 'lesson') continue;
    if (r.domain) break;
    r.domain = src.domain; n++;
  }
  lpSave(); lpRerender();
  uiToast(n ? `아래 빈 행 ${n}개에 '${src.domain}' 단원을 적용했습니다.` : '아래에 단원이 빈 수업 행이 없습니다.');
}
function lpSubjectItems() {
  const subj = SUBJECTS[lessonState.subjectIdx];
  return subj && subj.domains ? subj.domains.flatMap(d => d.items.map(it => ({ code: it.code, domain: d.name }))) : [];
}
async function lpAutoDistribute() {
  const lessonRows = lessonState.rows.filter(r => r.kind === 'lesson');
  const items = lpSubjectItems();
  if (!lessonRows.length) { uiToast('성취기준을 받을 수업 행이 없습니다.', { isErr: true }); return; }
  if (!items.length) { uiToast('이 과목에는 성취기준이 없습니다.', { isErr: true }); return; }
  if (lessonRows.some(r => r.domain || r.linkedCodes.length) &&
    !(await uiConfirm(`수업 행 ${lessonRows.length}개의 단원·성취기준을 성취기준 ${items.length}개로 다시 배분합니다. 이미 넣은 단원·성취기준은 덮어씁니다(학습 내용·방법은 유지). 계속할까요?`, { okLabel: '덮어쓰기' }))) return;
  const domains = SUBJECTS[lessonState.subjectIdx].domains;
  const { weeks, mixed } = lpPlanByDomain(domains.map(d => d.items.length), lessonRows.length);
  lessonRows.forEach((r, k) => {
    const picked = weeks[k] || [];
    r.linkedCodes = picked.map(x => domains[x.d].items[x.i].code);
    const ds = [...new Set(picked.map(x => x.d))];
    r.domain = ds.length ? domains[ds[0]].name : '';
    // 주 수가 단원 수보다 적어 섞인 행만 모든 단원을 기록(단원명 칸에 'Ⅰ·Ⅱ' 표시)
    if (ds.length > 1) r.mixedDomains = ds.map(d => domains[d].name); else delete r.mixedDomains;
  });
  lpSave(); lpRerender();
  uiToast(mixed
    ? `수업 주(${lessonRows.length}주)가 단원 수(${domains.length}개)보다 적어 일부 주에 단원이 섞였습니다. 단원명 칸에 함께 표시했습니다.`
    : `성취기준 ${items.length}개를 단원별로 수업 ${lessonRows.length}주에 나눠 넣었습니다.`);
}
// 차시 계산기 → 수업계획 반영 (chasi.js가 consume('lessonApplyChasi', plan)으로 부른다)
// plan = { weeks: [{ mw:'4/3', hours, kind }], total }
async function lpApplyChasi(plan) {
  if (!plan || !plan.weeks || !plan.weeks.length) return false;
  if (lessonState.rows.some(lpRowHasData) &&
    !(await uiConfirm('지금 수업계획의 주차·단원·성취기준·학습 내용이 차시 계산기 기준 주차로 바뀝니다(기존 행은 지워집니다). 계속할까요?', { okLabel: '덮어쓰기' }))) return false;
  lessonState.rows = plan.weeks.map(w => Object.assign(lpNewRow(w.mw), { kind: w.kind, hours: w.hours }));
  lessonState.startMW = plan.weeks[0].mw;
  lessonState.endMW = plan.weeks[plan.weeks.length - 1].mw;
  lessonState.chasiTotal = plan.total;
  lessonState.generated = true;
  lpSave();
  return true;
}
planCtx.provide('lessonApplyChasi', lpApplyChasi);
function lpFillCollected() {
  const items = lpSubjectItems();
  const byCode = new Map(items.map(it => [it.code, it]));
  const mine = collected.filter(c => byCode.has(c.code));
  const others = collected.length - mine.length;
  if (!mine.length) {
    uiToast(collected.length ? '담은 성취기준 중 이 과목의 것이 없습니다. 과목을 확인하세요.' : '먼저 성취기준 화면에서 체크박스로 성취기준을 담으세요.', { isErr: true });
    return;
  }
  const already = new Set(lessonState.rows.flatMap(r => r.linkedCodes));
  const queue = mine.filter(c => !already.has(c.code));
  const empty = lessonState.rows.filter(r => r.kind === 'lesson' && !r.linkedCodes.length);
  let placed = 0;
  empty.forEach(r => {
    const c = queue.shift();
    if (!c) return;
    r.linkedCodes = [c.code];
    if (!r.domain) r.domain = byCode.get(c.code).domain;
    placed++;
  });
  lpSave(); lpRerender();
  const notes = [`${placed}개를 빈 주차에 넣었습니다.`];
  if (queue.length) notes.push(`빈 주차가 모자라 ${queue.length}개는 넣지 못했습니다.`);
  if (mine.length - placed - queue.length > 0) notes.push(`${mine.length - placed - queue.length}개는 이미 계획표에 있습니다.`);
  if (others) notes.push(`다른 과목 ${others}개는 건너뛰었습니다.`);
  uiToast(notes.join(' '));
}
function lpOpenModal(rowIdx) {
  const row = lessonState.rows[rowIdx];
  openStdPicker({
    title: '성취기준 연결',
    subjectIdx: lessonState.subjectIdx,
    lockSubject: true,
    preselected: row.linkedCodes,
    selectAll: true,
    highlightDomain: row.domain || '',
    onConfirm: (codes) => {
      row.linkedCodes = codes;
      lpSave();
      lpRerender();
    }
  });
}
async function lpReset() {
  if (!(await uiConfirm('수업계획이 초기화됩니다. 계속할까요?'))) return;
  lpStore.remove(); // 지금 과목·학기 슬롯만 지운다(다른 학기 계획은 그대로)
  lessonState = lpLoadSlot();
  lpRerender();
}
function lpDomainLabel(r) { return r.mixedDomains && r.mixedDomains.length > 1 ? r.mixedDomains.join('·') : r.domain; }
// 복사: 한글·워드용 HTML 표 + 엑셀용 탭 구분 텍스트를 함께 싣는다. 차시 계산기를 반영했으면 차시 열이 붙는다.
function lpCopyHead() {
  const hasHours = lessonState.rows.some(r => r.hours != null);
  return ['월/주', ...(hasHours ? ['차시'] : []), '단원명', '성취기준', '학습 내용', '수업방법', '평가방법'];
}
function lpCopyCells(r) {
  const isLesson = r.kind === 'lesson';
  const hasHours = lessonState.rows.some(x => x.hours != null);
  return [
    lpFormatMW(r.monthWeek),
    ...(hasHours ? [r.hours != null ? String(r.hours) : ''] : []),
    isLesson ? lpDomainLabel(r) : LP_KIND_LABEL[r.kind],
    isLesson ? r.linkedCodes.join(', ') : '',
    r.content || '',
    isLesson ? r.methods.join(', ') : '',
    isLesson ? r.evalMethods.join(', ') : '',
  ];
}
function lpCopyPlain() {
  const clean = s => String(s).replace(/\s*\n\s*/g, ' ').replace(/\t/g, ' ');
  return [lpCopyHead().join('\t'), ...lessonState.rows.map(r => lpCopyCells(r).map(clean).join('\t'))].join('\n');
}
function lpCopyHtml() {
  const td = 'border:1px solid #9CA3AF;padding:4px 6px;vertical-align:top';
  const head = lpCopyHead().map(h => `<th style="${td};background:#F3F4F6;font-weight:bold;text-align:center">${h}</th>`).join('');
  const body = lessonState.rows.map(r => {
    const bg = LP_KIND_HEX[r.kind] ? `;background:${LP_KIND_HEX[r.kind]}` : '';
    return '<tr>' + lpCopyCells(r).map((c, ci) =>
      `<td style="${td}${bg}${ci === 0 ? ';text-align:center;white-space:nowrap' : ''}">${esc(String(c)).replace(/\n/g, '<br>')}</td>`).join('') + '</tr>';
  }).join('');
  return `<table border="1" style="border-collapse:collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}
async function lpCopy() {
  if (!lessonState.generated || !lessonState.rows.length) return;
  const plain = lpCopyPlain();
  const ok = (await clipboardWriteHTML(lpCopyHtml(), plain)) || (await clipboardWriteText(plain));
  if (!ok) { uiToast('복사에 실패했습니다.', { isErr: true }); return; }
  const btn = document.querySelector('.lp-copy-btn');
  if (btn) { const t = btn.textContent; btn.textContent='복사됨!'; setTimeout(()=>btn.textContent=t, 1500); }
}
function lpRerender() {
  if (!document.getElementById('main').querySelector('.eval-wrap')) return;
  if (evalPlanSubtab !== 'lesson') return;
  document.getElementById('main').innerHTML = renderLessonPlan();
}
function lpMultiHtml(i, field, options, label) {
  const row = lessonState.rows[i];
  const disabled = row.kind !== 'lesson';
  const sel = new Set(row[field]);
  if (disabled) return `<span class="lp-na" aria-label="${label} 해당 없음">—</span>`;
  return `<details class="lp-multi">
    <summary aria-label="${label} 선택"><span id="lpSum_${field}_${i}">${esc(row[field].join(', ') || '선택')}</span></summary>
    <div class="lp-multi-list" role="group" aria-label="${label}">
      ${options.map(m => `<label><input type="checkbox"${sel.has(m) ? ' checked' : ''} data-onchange="lp:multi" data-args="${esc(JSON.stringify([i, field, m]))}">${esc(m)}</label>`).join('')}
    </div>
  </details>`;
}
function renderLessonTable(selSubj) {
  const domains = selSubj && selSubj.domains ? selSubj.domains : [];
  const accent  = selSubj ? selSubj.accent : 'var(--plan)';
  const aLight  = selSubj ? selSubj.aLight : 'var(--plan-soft)';
  const textOf = new Map(domains.flatMap(d => d.items.map(it => [it.code, it.text])));
  const ROM = ROMAN;
  const hasHours = lessonState.rows.some(r => r.hours != null);
  const romOf = name => { const di = domains.findIndex(d => d.name === name); return di < 0 ? '' : (ROM[di] || di + 1); };
  const rowsHtml = lessonState.rows.map((row, i) => {
    const isLesson = row.kind === 'lesson';
    const ai = esc(JSON.stringify([i]));
    const kindOpts = LP_KINDS.map(k => `<option value="${k.key}"${row.kind === k.key ? ' selected' : ''}>${k.label}</option>`).join('');
    const domOpts = `<option value="">단원 선택</option>` +
      domains.map((d, di) => `<option value="${esc(d.name)}"${row.domain===d.name?' selected':''}>${ROM[di]||di+1}. ${esc(d.name)}</option>`).join('');
    const codesHtml = row.linkedCodes.map(c =>
      `<span class="lp-code-badge" style="background:${aLight};color:${accent}" title="${esc(c + ' ' + (textOf.get(c) || ''))}">${esc(c)}<button class="lp-code-del" data-onclick="lp:unlink" data-args="${esc(JSON.stringify([i, c]))}" aria-label="${esc(c)} 제거">×</button></span>`
    ).join('');
    const mwBad = row.monthWeek && !lpParseWeek(row.monthWeek);
    const domainCell = isLesson
      ? `${row.mixedDomains && row.mixedDomains.length > 1 ? `<span class="lp-mixed" title="${esc(row.mixedDomains.join(' · '))}">${row.mixedDomains.map(romOf).join('·')} 단원 섞임</span>` : ''}<div class="lp-domain-row"><select class="lp-select" data-onchange="lp:domain" data-args="${ai}" aria-label="${i + 1}행 단원">${domOpts}</select><button type="button" class="lp-fill-down" data-onclick="lp:fillDown" data-args="${ai}" title="아래 빈 행에 이 단원 적용" aria-label="${i + 1}행 단원을 아래 빈 행에 적용"${row.domain ? '' : ' disabled'}>↓</button></div>`
      : `<span class="lp-kind-tag">${LP_KIND_LABEL[row.kind]}</span>`;
    const stdCell = isLesson
      ? `${codesHtml}<button class="lp-add-std" data-onclick="lp:openModal" data-args="${ai}">+ 성취기준</button>`
      : `<span class="lp-na">${row.linkedCodes.length ? `성취기준 ${row.linkedCodes.length}개 보관 중 (수업으로 바꾸면 복원)` : '—'}</span>`;
    return `<tr data-row="${i}" class="${lpRowClass(row)}">
      <td><div class="lp-mw${mwBad ? ' bad' : ''}" contenteditable="true" role="textbox" aria-label="${i + 1}행 월/주 (예: 3/1)"${mwBad ? ' aria-invalid="true"' : ''} data-onblur="lp:mw" data-args="${ai}">${esc(lpFormatMW(row.monthWeek))}</div></td>
      ${hasHours ? `<td class="lp-hours">${row.hours != null ? row.hours + '차시' : '—'}</td>` : ''}
      <td><select class="lp-select lp-kind-select" data-onchange="lp:kind" data-args="${ai}" aria-label="${i + 1}행 유형">${kindOpts}</select></td>
      <td>${domainCell}</td>
      <td class="lp-std-cell">${stdCell}</td>
      <td><textarea class="lp-content" rows="2" data-oninput="lp:content" data-args="${ai}" aria-label="${i + 1}행 학습 내용" placeholder="학습 내용">${esc(row.content)}</textarea></td>
      <td>${lpMultiHtml(i, 'methods', LP_METHODS, '수업방법')}</td>
      <td>${lpMultiHtml(i, 'evalMethods', LP_EVAL_METHODS, '평가방법')}</td>
      <td><button class="lp-del-row" data-onclick="lp:delRow" data-args="${ai}" aria-label="${i + 1}행 삭제">✕</button></td>
    </tr>`;
  }).join('');
  const nCollected = collected.length;
  return `<div class="lp-tools">
      <button class="pbtn sec" data-onclick="lp:auto" title="이 과목의 성취기준을 수업 주차 수에 맞게 순서대로 나눠 넣습니다">자동 배분</button>
      <button class="pbtn sec" data-onclick="lp:fillCollected"${nCollected ? '' : ' disabled'} title="담은 성취기준을 빈 수업 주차에 순서대로 넣습니다">담은 성취기준으로 채우기${nCollected ? ` (${nCollected})` : ''}</button>
      <span class="lp-legend"><i class="lp-row-exam"></i>정기시험 <i class="lp-row-event"></i>학교행사 <i class="lp-row-vacation"></i>방학 <i class="lp-row-perf"></i>수행평가</span>
    </div>
    <p class="scroll-hint" aria-hidden="true">← 옆으로 밀어 보기</p>
    <div class="lp-table-wrap scroll-fade">
    <table class="lp-table">
      <thead><tr>
        <th style="width:76px">월/주</th>
        ${hasHours ? '<th style="width:64px">차시</th>' : ''}
        <th style="width:108px">유형</th>
        <th style="width:196px">단원명</th>
        <th>성취기준</th>
        <th style="width:180px">학습 내용</th>
        <th style="width:120px">수업방법</th>
        <th style="width:120px">평가방법</th>
        <th style="width:34px"><span class="sr-only">삭제</span></th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </div>
    <button class="lp-add-row-btn" data-onclick="lp:addRow">+ 행 추가</button>`;
}
function renderLessonPlan() {
  const selSubj = SUBJECTS[lessonState.subjectIdx];
  const tableHtml = lessonState.generated
    ? renderLessonTable(selSubj)
    : emptySteps(['주차 설정(또는 차시 계산기에서 반영)', '계획표 생성', '성취기준 배치 후 표 복사']);
  const chasiNote = lessonState.chasiTotal != null
    ? `<p class="lp-chasi-total">총 <strong>${lessonState.chasiTotal}</strong>차시 <span>(차시 계산기 기준)</span></p>` : '';
  const weekField = (which, label, val) => {
    const err = lpWeekError(val);
    return `<div class="eval-field">
          <label class="eval-label" for="lpWeek_${which}">${label} <span class="lp-week-fmt">월/주</span></label>
          <input type="text" id="lpWeek_${which}" class="lp-week-input" value="${esc(val)}" placeholder="3월 1주 (예: 3/1)" inputmode="numeric" aria-invalid="${err ? 'true' : 'false'}" aria-describedby="lpWeekNote_${which}" data-oninput="lp:${which}MW">
          <span class="lp-week-note${err ? ' err' : ''}" id="lpWeekNote_${which}" aria-live="polite">${esc(err || lpFormatMW(val))}</span>
        </div>`;
  };
  return `<div class="eval-wrap plan-page">
    ${pageHead('수업/평가계획', '수업계획', '성취기준을 주차별로 배치해 학기 수업계획서를 만들고 표로 복사합니다.')}
    <div class="eval-settings">
      <div class="eval-settings-title">수업계획 설정 <span class="eval-settings-sub">과목·학기는 위 기준을 따릅니다</span></div>
      ${chasiNote}
      <div class="eval-settings-row lp-settings-row">
        ${weekField('start', '시작 주차', lessonState.startMW)}
        ${weekField('end', '종료 주차', lessonState.endMW)}
        <div class="eval-field" style="flex-direction:row;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="eval-gen-btn" data-onclick="lp:generate">계획표 생성</button>
          <button class="pbtn pri lp-copy-btn" data-onclick="lp:copy"${!lessonState.generated?' disabled':''}>표 복사</button>
          <button class="pbtn sec" data-onclick="lp:reset">초기화</button>
        </div>
      </div>
    </div>
    ${tableHtml}
  </div>`;
}

export { renderLessonPlan };
// 테스트 전용 (tools/test.mjs)
// 상태 점(서브탭): 없음 / 작성 중 / 완료(모든 수업 행에 성취기준 1개 이상)
function lpStatus(s = lessonState) {
  if (!s.generated || !s.rows.length) return 'none';
  const lessons = s.rows.filter(r => r.kind === 'lesson');
  return lessons.length && lessons.every(r => r.linkedCodes.length) ? 'done' : 'draft';
}
planCtx.provide('lessonStatus', () => lpStatus());
export const __lpTest = { status: lpStatus, planByDomain: lpPlanByDomain, applyChasi: lpApplyChasi, migrate: lpMigrate, parseWeek: lpParseWeek, formatMW: lpFormatMW, distribute: lpDistribute, copyPlain: lpCopyPlain, copyHtml: lpCopyHtml, state: () => lessonState, setState: s => { lessonState = lpMigrate(s); if (s) lpSave(); } };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'lp:generate':  function() { lpGenerate(); },
  'lp:copy':      function() { lpCopy(); },
  'lp:reset':     function() { lpReset(); },
  'lp:addRow':    function() { lpAddRow(); },
  'lp:delRow':    function(el, e, i) { lpDeleteRow(i); },
  'lp:openModal': function(el, e, i) { lpOpenModal(i); },
  'lp:unlink':    function(el, e, i, code) { lpUnlinkCode(i, code); },
  'lp:fillDown':  function(el, e, i) { lpFillDown(i); },
  'lp:auto':      function() { lpAutoDistribute(); },
  'lp:fillCollected': function() { lpFillCollected(); },
});
registerActions('input', {
  'lp:startMW': function(el) { lpSetStartMW(el.value); },
  'lp:endMW':   function(el) { lpSetEndMW(el.value); },
  'lp:content': function(el, e, i) { lpSetContent(i, el.value); },
});
registerActions('change', {
  'lp:domain':     function(el, e, i) { lpSetDomain(i, el.value); },
  'lp:kind':       function(el, e, i) { lpSetKind(i, el.value); },
  'lp:multi':      function(el, e, i, field, value) { lpToggleMulti(i, field, value, el.checked); },
});
registerActions('blur', {
  'lp:mw': function(el, e, i) { lpUpdateMW(i, el); },
});
