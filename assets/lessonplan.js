import { esc, loadState, registerActions, pageHead, emptySteps, uiToast, uiConfirm, clipboardWriteHTML, clipboardWriteText } from './utils.js';
import { evalSubjects, evalPlanSubtab } from './evalplan.js';
import { LP_SEM_DEFAULTS } from './state.js';
import { openStdPicker } from './stdpicker.js';
import { collected } from './collect.js';

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
function lpDefaultState() {
  return { version:2, subjectIdx:1, semester:1, startMW:'3/1', endMW:'7/2', generated:false, rows:[] };
}
function lpNewRow(monthWeek = '') {
  return { monthWeek, kind:'lesson', domain:'', linkedCodes:[], content:'', methods:[], evalMethods:[] };
}

// --- Lesson Plan State ---
let lessonState = lpMigrate(loadState('jungle_lesson_plan', null));

function lpSave() {
  try { localStorage.setItem('jungle_lesson_plan', JSON.stringify(lessonState)); } catch(e) {}
}
// '3/1' 또는 '3월 1주' → {m, w}. 1~12월, 1~4주만 유효.
function lpParseWeek(str) {
  const t = String(str || '').trim().match(/^(\d{1,2})\s*(?:\/|월)\s*(\d)\s*주?$/);
  if (!t) return null;
  const m = +t[1], w = +t[2];
  return (m >= 1 && m <= 12 && w >= 1 && w <= 4) ? { m, w } : null;
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
function lpWeekError(val) {
  return lpParseWeek(val) ? '' : '1~12월, 1~4주로 입력하세요 (예: 3/1 = 3월 1주)';
}
function lpSetSubject(idx) {
  lessonState.subjectIdx = idx;
  lessonState.rows.forEach(r => { r.domain = ''; r.linkedCodes = []; });
  lpSave(); lpRerender();
}
function lpSetSemester(n) {
  lessonState.semester = n;
  const def = LP_SEM_DEFAULTS[n];
  lessonState.startMW = def.startMW;
  lessonState.endMW   = def.endMW;
  lpSave(); lpRerender();
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
  const plan = lpDistribute(items.length, lessonRows.length);
  lessonRows.forEach((r, k) => {
    const picked = plan[k].map(x => items[x]);
    r.linkedCodes = picked.map(it => it.code);
    r.domain = picked.length ? picked[0].domain : '';
  });
  lpSave(); lpRerender();
  uiToast(`성취기준 ${items.length}개를 수업 ${lessonRows.length}주에 나눠 넣었습니다.`);
}
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
  lessonState = lpDefaultState();
  try { localStorage.removeItem('jungle_lesson_plan'); } catch (e) {}
  lpRerender();
}
// 복사: 한글·워드용 HTML 표 + 엑셀용 탭 구분 텍스트를 함께 싣는다
const LP_COPY_HEAD = ['월/주', '단원명', '성취기준', '학습 내용', '수업방법', '평가방법'];
function lpCopyCells(r) {
  const isLesson = r.kind === 'lesson';
  return [
    lpFormatMW(r.monthWeek),
    isLesson ? r.domain : LP_KIND_LABEL[r.kind],
    isLesson ? r.linkedCodes.join(', ') : '',
    r.content || '',
    isLesson ? r.methods.join(', ') : '',
    isLesson ? r.evalMethods.join(', ') : '',
  ];
}
function lpCopyPlain() {
  const clean = s => String(s).replace(/\s*\n\s*/g, ' ').replace(/\t/g, ' ');
  return [LP_COPY_HEAD.join('\t'), ...lessonState.rows.map(r => lpCopyCells(r).map(clean).join('\t'))].join('\n');
}
function lpCopyHtml() {
  const td = 'border:1px solid #9CA3AF;padding:4px 6px;vertical-align:top';
  const head = LP_COPY_HEAD.map(h => `<th style="${td};background:#F3F4F6;font-weight:bold;text-align:center">${h}</th>`).join('');
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
  const ROM = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ'];
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
      ? `<div class="lp-domain-row"><select class="lp-select" data-onchange="lp:domain" data-args="${ai}" aria-label="${i + 1}행 단원">${domOpts}</select><button type="button" class="lp-fill-down" data-onclick="lp:fillDown" data-args="${ai}" title="아래 빈 행에 이 단원 적용" aria-label="${i + 1}행 단원을 아래 빈 행에 적용"${row.domain ? '' : ' disabled'}>↓</button></div>`
      : `<span class="lp-kind-tag">${LP_KIND_LABEL[row.kind]}</span>`;
    const stdCell = isLesson
      ? `${codesHtml}<button class="lp-add-std" data-onclick="lp:openModal" data-args="${ai}">+ 성취기준</button>`
      : `<span class="lp-na">${row.linkedCodes.length ? `성취기준 ${row.linkedCodes.length}개 보관 중 (수업으로 바꾸면 복원)` : '—'}</span>`;
    return `<tr data-row="${i}" class="${lpRowClass(row)}">
      <td><div class="lp-mw${mwBad ? ' bad' : ''}" contenteditable="true" role="textbox" aria-label="${i + 1}행 월/주 (예: 3/1)"${mwBad ? ' aria-invalid="true"' : ''} data-onblur="lp:mw" data-args="${ai}">${esc(lpFormatMW(row.monthWeek))}</div></td>
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
    <p class="lp-scroll-hint">← 옆으로 밀어 보기</p>
    <div class="lp-table-wrap scroll-fade">
    <table class="lp-table">
      <thead><tr>
        <th style="width:76px">월/주</th>
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
  const subjs = evalSubjects();
  const subjOpts = subjs.map(s => {
    const idx = SUBJECTS.indexOf(s);
    return `<option value="${idx}"${lessonState.subjectIdx===idx?' selected':''}>${esc(s.name)}</option>`;
  }).join('');
  const selSubj = SUBJECTS[lessonState.subjectIdx];
  const tableHtml = lessonState.generated
    ? renderLessonTable(selSubj)
    : emptySteps(['과목·주차 설정', '계획표 생성', '성취기준 배치 후 표 복사']);
  const weekField = (which, label, val) => {
    const err = lpWeekError(val);
    return `<div class="eval-field">
          <label class="eval-label" for="lpWeek_${which}">${label} <span class="lp-week-fmt">월/주</span></label>
          <input type="text" id="lpWeek_${which}" class="lp-week-input" value="${esc(val)}" placeholder="3월 1주 (예: 3/1)" inputmode="numeric" aria-invalid="${err ? 'true' : 'false'}" aria-describedby="lpWeekNote_${which}" data-oninput="lp:${which}MW">
          <span class="lp-week-note${err ? ' err' : ''}" id="lpWeekNote_${which}" aria-live="polite">${esc(err || lpFormatMW(val))}</span>
        </div>`;
  };
  return `<div class="eval-wrap">
    ${pageHead('수업/평가계획', '수업계획', '성취기준을 주차별로 배치해 학기 수업계획서를 만들고 표로 복사합니다.')}
    <div class="eval-settings">
      <div class="eval-settings-title">수업계획 설정</div>
      <div class="eval-settings-row lp-settings-row">
        <div class="eval-field">
          <span class="eval-label">과목</span>
          <select class="eval-select" data-onchange="lp:subject">${subjOpts}</select>
        </div>
        <div class="eval-field">
          <span class="eval-label">학기</span>
          <div class="eval-toggle-group">
            <button class="eval-toggle${lessonState.semester===1?' active':''}" data-onclick="lp:semester" data-args="[1]" aria-pressed="${lessonState.semester===1}">1학기</button>
            <button class="eval-toggle${lessonState.semester===2?' active':''}" data-onclick="lp:semester" data-args="[2]" aria-pressed="${lessonState.semester===2}">2학기</button>
          </div>
        </div>
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
export const __lpTest = { migrate: lpMigrate, parseWeek: lpParseWeek, formatMW: lpFormatMW, distribute: lpDistribute, copyPlain: lpCopyPlain, copyHtml: lpCopyHtml, state: () => lessonState, setState: s => { lessonState = lpMigrate(s); } };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'lp:semester':  function(el, e, n) { lpSetSemester(n); },
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
  'lp:subject':    function(el) { lpSetSubject(+el.value); },
  'lp:domain':     function(el, e, i) { lpSetDomain(i, el.value); },
  'lp:kind':       function(el, e, i) { lpSetKind(i, el.value); },
  'lp:multi':      function(el, e, i, field, value) { lpToggleMulti(i, field, value, el.checked); },
});
registerActions('blur', {
  'lp:mw': function(el, e, i) { lpUpdateMW(i, el); },
});
