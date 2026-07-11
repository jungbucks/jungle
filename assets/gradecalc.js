import { esc, loadState, saveState, registerActions, pageHead, clipboardWriteText, uiToast, uiConfirm } from './utils.js';

// --- 내신 5등급제 성적 산출기 (상대평가) ---
// 개인정보 방침: 번호·점수(students)는 localStorage에 저장하지 않는다 — 메모리에만 존재, 탭 닫으면 소멸.
// 영속 대상은 반영비율·동점자 설정뿐. 보관은 CSV 내려받기(교사 본인 파일 관리)로 대체.
const gcState = (() => {
  const s = loadState('jungle_gradecalc', null);
  const st = { ratios: { e1: 30, e2: 30, perf: 40 }, tieMode: 'mid', students: [] };
  if (s) {
    if (s.ratios) st.ratios = s.ratios;
    if (s.tieMode) st.tieMode = s.tieMode;
    // 이전 버전이 저장해 둔 점수·명렬은 즉시 폐기(설정만 다시 저장)
    if (Array.isArray(s.students) && s.students.length)
      saveState('jungle_gradecalc', { ratios: st.ratios, tieMode: st.tieMode });
  }
  return st;
})();
let gcResults = null; // 계산 결과 캐시 (렌더링용, 저장 안 함)
let gcSeq = 0;

function gcSave() { saveState('jungle_gradecalc', { ratios: gcState.ratios, tieMode: gcState.tieMode }); }

// 점수가 입력된 채 탭을 닫거나 새로고침하면 소멸 — 실수 방지 경고 (SPA 내부 이동은 해당 없음)
window.addEventListener('beforeunload', (e) => {
  if (gcActiveStudents().length) { e.preventDefault(); e.returnValue = ''; }
});
function gcNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function gcNewStudent(sid = '', s1 = '', s2 = '', sp = '') {
  return { id: ++gcSeq, sid: String(sid), s1: String(s1), s2: String(s2), sp: String(sp), a1: true, a2: true };
}

// '계산하기' 시점의 실질 대상 = 학번 또는 점수가 하나라도 입력된 행
function gcActiveStudents() {
  return gcState.students.filter(st =>
    String(st.sid).trim() !== '' || st.s1 !== '' || st.s2 !== '' || st.sp !== '');
}

// 등급 판정은 석차백분율이 아니라 "등급별 누적인원 경계"로 한다 (소인원에서 1등급 0명이 되는 결함 방지).
// 조견표(GC_GRADE_TABLE)가 진실, 없는 N만 반올림 공식 폴백. 값 = 누적 상한 인원 [cum1..cum5].
// ※ 사용자의 공식 조견표를 받으면 여기에 채울 것 (등급별 인원 표로 받으면 누적으로 변환) — SPEC §6.
const GC_GRADE_TABLE = {
  5: [1, 2, 3, 4, 5], // 사용자 확인분 — 반올림 공식([1,2,3,5,5])과 다름
};
const GC_CUM_PCTS = [10, 34, 66, 90, 100];
function gcGradeCums(N) {
  const cums = GC_GRADE_TABLE[N]
    ? GC_GRADE_TABLE[N].slice()
    : GC_CUM_PCTS.map(p => Math.round(N * p / 100));
  cums[4] = N; // 5등급 누적은 항상 전원
  for (let k = 1; k < 5; k++) if (cums[k] < cums[k - 1]) cums[k] = cums[k - 1]; // 역전 방지
  return cums;
}

function gcCompute() {
  const { e1, e2 } = gcState.ratios;
  const r1 = gcNum(e1) / 100, r2 = gcNum(e2) / 100;
  const rows = gcActiveStudents().map(st => {
    // 지필만 비율을 곱한다. 수행은 만점=반영비율로 채점된 점수라 무가공 합산 (v2 수정).
    const v1 = st.a1 ? gcNum(st.s1) * r1 : 0;
    const v2 = st.a2 ? gcNum(st.s2) * r2 : 0;
    const total = v1 + v2 + gcNum(st.sp);
    return { sid: String(st.sid).trim() || '(번호 없음)', total: Math.round(total * 1e6) / 1e6 };
  });
  const N = rows.length;
  const cums = gcGradeCums(N);
  const useMid = gcState.tieMode !== 'eq';
  rows.forEach(r => {
    const higher = rows.filter(o => o.total > r.total).length;
    const ties = rows.filter(o => o.total === r.total).length;
    // 석차 표기는 RANK.EQ(동점자 같은 석차, 다음 석차 건너뜀)
    r.rank = higher + 1;
    r.ties = ties;
    // 유효 석차: 중간석차(NEIS) = 석차 + (동점자수-1)/2 / RANK.EQ = 석차 그대로
    const effRank = useMid ? higher + 1 + (ties - 1) / 2 : higher + 1;
    r.pct = N ? (effRank / N) * 100 : 0; // 표시용 — 판정에는 쓰지 않음
    r.grade = cums.findIndex(c => effRank <= c) + 1;
  });
  rows.sort((a, b) => a.rank - b.rank);
  return { rows, N };
}

// --- 입력 이상치 검사 ---
// 지필 두 열은 0~100, 수행 열만 0~반영비율(=만점) — 호출부가 max를 넘긴다 (v2)
function gcScoreInvalid(v, max = 100) {
  if (String(v).trim() === '') return false;
  const n = parseFloat(v);
  return isNaN(n) || n < 0 || n > max;
}
function gcPerfMax() { return gcNum(gcState.ratios.perf); }
function gcDupSids() {
  const seen = {}, dups = new Set();
  gcState.students.forEach(st => {
    const sid = String(st.sid).trim();
    if (!sid) return;
    if (seen[sid]) dups.add(sid); else seen[sid] = true;
  });
  return dups;
}
// 학번 타이핑 중 재렌더 없이 전 행의 중복 표시 갱신 (DOM 행 순서 = state 순서)
function gcMarkDups() {
  const dups = gcDupSids();
  document.querySelectorAll('.gc-sid-input').forEach((inp, i) => {
    const st = gcState.students[i];
    inp.classList.toggle('dup', !!st && dups.has(String(st.sid).trim()));
  });
}

// --- 이벤트 핸들러 ---
function gcSetRatio(key, val) {
  gcState.ratios[key] = val; gcSave(); gcClearResultDom(); gcUpdateRatioSum();
  if (key === 'perf') gcUpdatePerfMax(); // 수행 만점이 곧 이 비율 — 헤더·셀 검사 즉시 갱신 (재렌더 금지)
}
// 수행 열 헤더의 만점 표기와 각 행 수행 셀의 max·invalid를 DOM 순회로 갱신 (DOM 행 순서 = state 순서)
function gcUpdatePerfMax() {
  const max = gcPerfMax();
  const th = document.getElementById('gcPerfMaxLabel');
  if (th) th.textContent = `만점 ${max}점`;
  document.querySelectorAll('.gc-perf-input').forEach(inp => {
    inp.max = max;
    inp.classList.toggle('invalid', gcScoreInvalid(inp.value, max));
  });
}
function gcSetCell(i, key, val) { gcState.students[i][key] = val; gcClearResultDom(); }
function gcToggleAttend(i, key, checked) { gcState.students[i][key] = checked; gcClearResultDom(); }
function gcToggleAll(key, checked) {
  gcState.students.forEach(st => { st[key] = checked; });
  gcResults = null; gcRerender();
}
function gcAddStudent() { gcState.students.push(gcNewStudent()); gcResults = null; gcRerender(); }
function gcRemoveStudent(id) {
  gcState.students = gcState.students.filter(st => st.id !== id);
  gcResults = null; gcRerender();
}
// 번호 자동 채우기: 인원수 N → 1~N행 생성 (번호 체계라서 가능한 빠른 시작)
async function gcAutoFill() {
  const inp = document.getElementById('gcFillN');
  const raw = parseInt(inp && inp.value, 10);
  if (!raw || raw < 1) { uiToast('수강자수를 먼저 입력하세요.', { isErr: true }); return; }
  const n = Math.min(100, raw);
  if (gcState.students.length && !(await uiConfirm(`현재 표(${gcState.students.length}행)를 지우고 1~${n}번으로 새로 만들까요?`))) return;
  gcState.students = Array.from({ length: n }, (_, i) => gcNewStudent(String(i + 1)));
  gcResults = null; gcRerender();
}
function gcReset() {
  if (!gcState.students.length) return;
  // confirm 대신 되돌리기 토스트 — 메모리 전용 데이터라 즉시 복구 가능
  const stash = gcState.students;
  gcState.students = [];
  gcResults = null; gcRerender();
  uiToast('표를 비웠습니다.', { actionLabel: '되돌리기', onAction() {
    gcState.students = stash;
    gcResults = null; gcRerender();
  } });
}

async function gcCalculate() {
  if (!gcActiveStudents().length) {
    uiToast('계산할 데이터가 없습니다. 번호를 생성하거나 CSV를 업로드하세요.', { isErr: true });
    return;
  }
  // 계산 전 점검: 비율 합 · 점수 범위 · 학번 중복
  const warns = [];
  const { e1, e2, perf } = gcState.ratios;
  const sum = +(gcNum(e1) + gcNum(e2) + gcNum(perf)).toFixed(2);
  if (sum !== 100) warns.push(`반영 비율의 합이 100%가 아닙니다 (현재 ${sum}%)`);
  const act = gcActiveStudents();
  const badExam = act.reduce((n, st) => n + [st.s1, st.s2].filter(v => gcScoreInvalid(v)).length, 0);
  const pMax = gcPerfMax();
  const badPerf = act.reduce((n, st) => n + (gcScoreInvalid(st.sp, pMax) ? 1 : 0), 0);
  if (badExam) warns.push(`지필 점수 범위(0~100) 밖 입력이 ${badExam}건 있습니다 (빨간 칸 확인)`);
  if (badPerf) warns.push(`수행 점수가 만점(${pMax}점)을 넘거나 범위 밖인 입력이 ${badPerf}건 있습니다 (빨간 칸 확인)`);
  const dups = gcDupSids();
  if (dups.size) warns.push(`중복된 번호가 있습니다: ${[...dups].join(', ')}`);
  if (warns.length &&
    !(await uiConfirm(`다음 문제가 있습니다:\n· ${warns.join('\n· ')}\n\n결과가 의도와 다를 수 있습니다. 그래도 계산할까요?`, { okLabel: '계산' }))) return;
  gcResults = gcCompute();
  gcRerender();
  const el = document.getElementById('gcResult');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function gcSetTieMode(mode) {
  if (gcState.tieMode === mode) return;
  gcState.tieMode = mode;
  gcResults = null; gcSave(); gcRerender();
}

// --- 수강자수 → 등급별 인원 미리보기 (비영속 — gcSave 대상 아님) ---
let gcPreviewN = '';
function gcPreviewChipsHtml() {
  const n = Math.max(0, Math.min(100, parseInt(gcPreviewN, 10) || 0));
  if (!n) return '<span class="gc-preview-empty">수강자수를 입력하면 등급별 인원을 보여드려요.</span>';
  const cums = gcGradeCums(n);
  return cums.map((c, i) => {
    const cnt = c - (i ? cums[i - 1] : 0);
    return `<span class="gc-sum-chip" title="누적 ${c}명"><span class="gc-grade gc-grade-${i + 1}">${i + 1}등급</span> ${cnt}명</span>`;
  }).join('');
}
// 입력 즉시 칩만 교체 (재렌더 금지 — 포커스 보존 규칙). 판정과 같은 gcGradeCums 공유(단일 소스).
function gcUpdatePreviewChips() {
  const box = document.getElementById('gcPreviewChips');
  if (box) box.innerHTML = gcPreviewChipsHtml();
}

// 결과가 화면에 떠 있는 상태에서 입력을 바꾸면(재렌더 없이) 낡은 결과 제거
function gcClearResultDom() {
  if (!gcResults) return;
  gcResults = null;
  const el = document.getElementById('gcResult');
  if (el) el.remove();
}
function gcUpdateRatioSum() {
  const el = document.getElementById('gcRatioSum');
  if (!el) return;
  const { e1, e2, perf } = gcState.ratios;
  const sum = +(gcNum(e1) + gcNum(e2) + gcNum(perf)).toFixed(2);
  const ok = sum === 100;
  el.textContent = `합계 ${sum}%`;
  el.className = 'gc-ratio-sum ' + (ok ? 'ok' : 'warn');
}

// --- CSV / 내보내기 ---
function gcDownloadCsv(filename, lines) {
  // lines: 셀 배열의 배열. BOM 포함 UTF-8 → 엑셀 한글 호환
  const csv = '﻿' + lines.map(cells => cells.map(gcCsvCell).join(',')).join('\r\n') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function gcCsvDownload() {
  const src = gcActiveStudents().length ? gcActiveStudents() : gcState.students;
  const body = src.map(st => [st.sid, st.s1, st.s2, st.sp]);
  // 예시 행: 데이터가 전혀 없을 때만 안내용 샘플 제공
  const rows = body.length ? body : [['1', '', '', ''], ['2', '', '', '']];
  gcDownloadCsv('내신성적_입력양식.csv', [['번호', '1차점수', '2차점수', '수행점수(만점=반영비율)'], ...rows]);
}

function gcResultLines() {
  const { rows } = gcResults;
  return [
    ['석차', '번호', '환산 총점', '석차 백분율', '최종 등급'],
    ...rows.map(r => [r.rank, r.sid, +r.total.toFixed(3), r.pct.toFixed(2) + '%', r.grade + '등급'])
  ];
}

function gcResultCsvDownload() {
  if (!gcResults) return;
  gcDownloadCsv('내신성적_산출결과.csv', gcResultLines());
}

function gcCopyResult() {
  if (!gcResults) return;
  // 탭 구분 → 엑셀/한글 표에 바로 붙여넣기
  clipboardWriteText(gcResultLines().map(cells => cells.join('\t')).join('\n'));
  const btn = document.getElementById('gcCopyResBtn');
  if (btn) { btn.textContent = '✓ 복사됨'; setTimeout(() => { btn.textContent = '클립보드 복사'; }, 1500); }
}

function gcCsvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function gcParseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
  const out = [];
  lines.forEach((line, idx) => {
    const cells = gcSplitCsvLine(line);
    // 헤더 행 건너뛰기: 첫 줄이고 2번째 칸이 숫자가 아니면 헤더로 간주
    if (idx === 0 && cells.length > 1 && isNaN(parseFloat(cells[1]))) return;
    const [sid = '', s1 = '', s2 = '', sp = ''] = cells;
    if (sid.trim() === '' && s1.trim() === '' && s2.trim() === '' && sp.trim() === '') return;
    out.push(gcNewStudent(sid.trim(), s1.trim(), s2.trim(), sp.trim()));
  });
  return out;
}

function gcSplitCsvLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells.map(s => s.trim());
}

function gcCsvUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = gcParseCsv(String(reader.result));
      if (!parsed.length) { uiToast('CSV에서 읽을 수 있는 데이터가 없습니다 — 형식: 번호, 1차점수, 2차점수, 수행점수', { isErr: true }); return; }
      gcState.students = parsed;
      gcResults = null;
      gcRerender();
      uiToast(`CSV에서 ${parsed.length}행을 불러왔습니다.`);
    } catch (e) {
      uiToast('CSV 파일을 읽는 중 오류가 발생했습니다. 형식을 확인해 주세요.', { isErr: true });
    }
  };
  reader.onerror = () => uiToast('파일을 읽지 못했습니다.', { isErr: true });
  reader.readAsText(file, 'utf-8');
}

// --- 렌더 ---
function gcRerender() {
  if (!document.getElementById('main').querySelector('.gc-wrap')) return;
  document.getElementById('main').innerHTML = renderGradeCalc();
}

function gcRatioField(key, label) {
  const v = gcState.ratios[key];
  return `<div class="eval-field">
    <span class="eval-label">${label}</span>
    <div class="gc-ratio-input-wrap">
      <input type="number" class="eval-number" min="0" max="100" value="${esc(String(v))}"
        aria-label="${label} 반영 비율(%)" data-oninput="gc:ratio" data-args="${esc(JSON.stringify([key]))}">
      <span class="gc-pct">%</span>
    </div>
  </div>`;
}

function gcRowHtml(st, i, dups) {
  // 스크린리더용 행 맥락: 번호가 있으면 "N번", 없으면 "N행"
  const rowName = String(st.sid).trim() ? `${String(st.sid).trim()}번` : `${i + 1}행`;
  const CELL_LABEL = { s1: '1차 지필 점수', s2: '2차 지필 점수', sp: '수행평가 점수' };
  const cell = (key, val) => {
    const isPerf = key === 'sp';
    const max = isPerf ? gcPerfMax() : 100; // 수행 만점 = 반영비율
    return `<input type="number" class="gc-cell-input${isPerf ? ' gc-perf-input' : ''}${gcScoreInvalid(val, max) ? ' invalid' : ''}" min="0" max="${max}" value="${esc(String(val))}"
      aria-label="${esc(rowName)} ${CELL_LABEL[key]}" data-oninput="gc:cell" data-args="${esc(JSON.stringify([i, key]))}">`;
  };
  const sidDup = dups.has(String(st.sid).trim());
  const examCell = (scoreKey, atKey, sVal, checked) =>
    `<td class="gc-td-exam${checked ? '' : ' absent'}">
      <div class="gc-exam-cell">
        ${cell(scoreKey, sVal)}
        <label class="gc-attend" title="응시 여부">
          <input type="checkbox" ${checked ? 'checked' : ''} aria-label="${esc(rowName)} ${atKey === 'a1' ? '1차' : '2차'} 지필 응시 여부"
            data-onchange="gc:attend" data-args="${esc(JSON.stringify([i, atKey]))}">응시
        </label>
      </div>
    </td>`;
  return `<tr>
    <td class="gc-td-num">${i + 1}</td>
    <td class="gc-td-sid"><input type="text" class="gc-cell-input gc-sid-input${sidDup ? ' dup' : ''}" value="${esc(String(st.sid))}"
      placeholder="번호" aria-label="번호" data-oninput="gc:cell" data-args="${esc(JSON.stringify([i, 'sid']))}"></td>
    ${examCell('s1', 'a1', st.s1, st.a1)}
    ${examCell('s2', 'a2', st.s2, st.a2)}
    <td class="gc-td-perf">${cell('sp', st.sp)}</td>
    <td class="gc-td-del">
      <button class="gc-del-btn" data-onclick="gc:del" data-args="[${st.id}]" aria-label="행 삭제">✕</button>
    </td>
  </tr>`;
}

function gcAllAttend(key) { return gcState.students.length > 0 && gcState.students.every(st => st[key]); }

function gcTableHtml() {
  if (!gcState.students.length) {
    return `<div class="eval-empty">아직 데이터가 없습니다. <strong>번호 생성</strong>·<strong>＋ 행 추가</strong> 또는 CSV 업로드로 시작하세요.</div>`;
  }
  const dups = gcDupSids();
  const allHead = (key, label) =>
    `<label class="gc-attend gc-attend-all" title="이 시험 전체 응시/결시 일괄 선택">
      <input type="checkbox" ${gcAllAttend(key) ? 'checked' : ''}
        data-onchange="gc:allAttend" data-args="${esc(JSON.stringify([key]))}">전체 응시</label>`;
  return `<div class="gc-table-box">
    <table class="gc-table">
      <thead>
        <tr>
          <th class="gc-th-num">#</th>
          <th class="gc-th-sid">번호</th>
          <th class="gc-th-exam">1차 지필<div class="gc-th-sub">${allHead('a1')}</div></th>
          <th class="gc-th-exam">2차 지필<div class="gc-th-sub">${allHead('a2')}</div></th>
          <th class="gc-th-perf">수행평가<div class="gc-th-sub" id="gcPerfMaxLabel">만점 ${gcPerfMax()}점</div></th>
          <th class="gc-th-del"></th>
        </tr>
      </thead>
      <tbody>${gcState.students.map((st, i) => gcRowHtml(st, i, dups)).join('')}</tbody>
    </table>
  </div>`;
}

function gcResultHtml() {
  if (!gcResults) return '';
  const { rows, N } = gcResults;
  const gradeClass = g => `gc-grade gc-grade-${g}`;
  const body = rows.map(r => `<tr>
    <td class="gc-r-rank">${r.rank}${r.ties > 1 ? `<span class="gc-r-tie">공동 ${r.ties}명</span>` : ''}</td>
    <td>${esc(r.sid)}</td>
    <td class="gc-r-total">${(+r.total.toFixed(3)).toLocaleString('ko-KR', { maximumFractionDigits: 3 })}</td>
    <td class="gc-r-pct">${r.pct.toFixed(2)}%</td>
    <td><span class="${gradeClass(r.grade)}">${r.grade}등급</span></td>
  </tr>`).join('');
  // 등급별 인원 요약
  const counts = [1, 2, 3, 4, 5].map(g => rows.filter(r => r.grade === g).length);
  const summary = counts.map((c, i) =>
    `<span class="gc-sum-chip"><span class="${gradeClass(i + 1)}">${i + 1}등급</span> ${c}명</span>`).join('');
  const tieNote = gcState.tieMode === 'eq'
    ? '동점자는 같은 석차(RANK.EQ)의 백분율로 판정합니다.'
    : '동점자는 중간석차(석차 + (동점자수−1)÷2)의 백분율로 판정합니다 (NEIS·학업성적관리지침 방식).';
  return `<div id="gcResult" class="gc-result">
    <div class="gc-result-head">
      <h3 class="gc-result-title">산출 결과</h3>
      <span class="gc-result-n">전체 ${N}명</span>
      <span class="gc-toolbar-spacer"></span>
      <button id="gcCopyResBtn" class="pbtn sec" data-onclick="gc:copyRes">클립보드 복사</button>
      <button class="pbtn sec" data-onclick="gc:csvRes">결과 CSV 내려받기</button>
    </div>
    <div class="gc-sum-row">${summary}</div>
    <div class="gc-table-box">
      <table class="gc-table gc-result-table">
        <thead><tr>
          <th>석차</th><th>번호</th><th>환산 총점</th><th>석차 백분율</th><th>최종 등급</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="gc-note">등급은 석차백분율이 아니라 <strong>등급별 인원 경계</strong>로 판정합니다: 수강자수×누적비율(10/34/66/90/100%)을 반올림한 값(조견표 우선)이 그 등급까지의 누적 인원입니다. ${tieNote} 클립보드 복사는 탭 구분이라 엑셀·한글 표에 바로 붙여넣을 수 있습니다.</p>
  </div>`;
}

function renderGradeCalc() {
  const { e1, e2, perf } = gcState.ratios;
  const sum = +(gcNum(e1) + gcNum(e2) + gcNum(perf)).toFixed(2);
  const ok = sum === 100;
  return `<div class="gc-wrap">
    ${pageHead('수업/평가계획', '내신 5등급제 성적 산출기', '반영 비율과 지필·수행 점수로 환산 총점·석차·등급을 상대평가로 산출합니다.')}
    <div class="eval-settings">
      <div class="eval-settings-title">반영 비율 설정</div>
      <div class="eval-settings-row" style="align-items:flex-end">
        ${gcRatioField('e1', '1차 지필')}
        ${gcRatioField('e2', '2차 지필')}
        ${gcRatioField('perf', '수행평가')}
        <div class="eval-field" style="flex-direction:row;align-items:center;gap:6px">
          <span id="gcRatioSum" class="gc-ratio-sum ${ok ? 'ok' : 'warn'}">합계 ${sum}%</span>
        </div>
        <div class="eval-field">
          <span class="eval-label">동점자 처리</span>
          <div class="eval-toggle-group">
            <button class="eval-toggle${gcState.tieMode !== 'eq' ? ' active' : ''}" data-onclick="gc:tieMode" data-args='["mid"]'
              aria-pressed="${gcState.tieMode !== 'eq'}" title="석차 + (동점자수−1)÷2의 백분율로 판정 — NEIS·학업성적관리지침 방식">중간석차 (NEIS)</button>
            <button class="eval-toggle${gcState.tieMode === 'eq' ? ' active' : ''}" data-onclick="gc:tieMode" data-args='["eq"]'
              aria-pressed="${gcState.tieMode === 'eq'}" title="동점자에게 같은 석차의 백분율을 그대로 적용">RANK.EQ</button>
          </div>
        </div>
      </div>
      <p class="gc-hint">환산 총점 = 1차×비율 + 2차×비율 + 수행점수(그대로 합산). 지필은 100점 만점으로 입력하고, 수행은 반영비율이 곧 만점입니다(예: 수행 40% → 0~40점으로 입력). 세 비율의 합은 100%가 되어야 합니다. 동점자 처리 기본값은 실제 내신 산출과 같은 <strong>중간석차</strong> 방식입니다.</p>
      <details class="gc-explain">
        <summary>석차·등급 산출 방식 자세히 보기</summary>
        <div class="gc-explain-body">
          <p><strong>① 석차 표기 (RANK.EQ)</strong> — 엑셀 RANK.EQ 함수와 같습니다. 동점자는 모두 같은(가장 높은) 석차를 받고, 다음 석차는 동점자 수만큼 건너뜁니다. 예: 95, 90, 90, 85점 → 1위, 공동 2위(2명), 4위.</p>
          <p><strong>② 중간석차 (NEIS·학업성적관리지침)</strong> — 동점자들이 차지한 석차의 평균, 즉 <strong>석차 + (동점자수 − 1) ÷ 2</strong> 입니다. 위 예의 공동 2위는 중간석차 2.5가 되어 등급 판정용 유효 석차로 쓰입니다.</p>
          <p><strong>③ 등급 경계 (누적인원)</strong> — 수강자수 × 누적비율(10 / 34 / 66 / 90 / 100%)을 반올림한 값이 각 등급까지의 누적 인원입니다(공식 조견표가 있는 인원수는 조견표 우선). 유효 석차가 어느 구간에 들어가는지로 등급이 정해집니다. 예: 4명 → 2·3·3·4등급 각 1명씩(1·5등급 0명), 25명 → 1등급 3명 · 2등급 6명 · 3등급 8명 · 4등급 6명 · 5등급 2명.</p>
          <p><strong>④ 두 모드의 차이</strong> — 화면에 표시되는 석차는 항상 RANK.EQ이고, 등급 경계와 비교하는 <em>유효 석차</em>만 토글을 따릅니다. 중간석차 모드에서는 경계에 걸린 동점자 전원이 아래 등급으로, RANK.EQ 모드에서는 전원이 위 등급으로 갑니다(정원 초과 허용).</p>
        </div>
      </details>
    </div>

    <div class="eval-settings gc-preview">
      <div class="eval-settings-title">수강자수 → 등급별 인원 미리보기</div>
      <div class="gc-preview-row">
        <input type="number" id="gcFillN" class="eval-number" min="1" max="100" value="${esc(String(gcPreviewN))}"
          placeholder="예: 25" aria-label="수강자수" data-oninput="gc:previewN">
        <div id="gcPreviewChips" class="gc-preview-chips" aria-live="polite">${gcPreviewChipsHtml()}</div>
        <button class="pbtn sec" data-onclick="gc:fill">이 인원으로 번호 생성</button>
      </div>
    </div>

    <div class="gc-toolbar">
      <button class="pbtn sec" data-onclick="gc:add">＋ 행 추가</button>
      <label class="pbtn sec gc-upload-btn">CSV 업로드
        <input type="file" accept=".csv,text/csv" data-onchange="gc:csvUp" hidden>
      </label>
      <button class="pbtn sec" data-onclick="gc:csvDown">CSV 양식 내려받기</button>
      <span class="gc-toolbar-spacer"></span>
      <button class="pbtn sec" data-onclick="gc:reset">전체 초기화</button>
      <button class="pbtn pri gc-calc-btn" data-onclick="gc:calc">계산하기</button>
    </div>
    <p class="gc-privacy-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
      번호·점수는 <strong>저장되지 않고 이 탭에서만</strong> 유지됩니다(개인정보 보호). 보관하려면 CSV로 내려받으세요 — 반영 비율·동점자 설정만 저장됩니다.</p>

    ${gcTableHtml()}
    ${gcResultHtml()}
  </div>`;
}

export { renderGradeCalc };
// 테스트 전용 노출 (tools/test.mjs) — 순수 계산 코어 참조. 앱은 renderGradeCalc만 사용.
export const __gcTest = { state: gcState, compute: gcCompute, gradeCums: gcGradeCums, newStudent: gcNewStudent };

// ── 이벤트 위임 등록 ──
registerActions('click', {
  'gc:add':     function() { gcAddStudent(); },
  'gc:del':     function(el, e, id) { gcRemoveStudent(id); },
  'gc:reset':   function() { gcReset(); },
  'gc:calc':    function() { gcCalculate(); },
  'gc:csvDown': function() { gcCsvDownload(); },
  'gc:fill':    function() { gcAutoFill(); },
  'gc:tieMode': function(el, e, mode) { gcSetTieMode(mode); },
  'gc:copyRes': function() { gcCopyResult(); },
  'gc:csvRes':  function() { gcResultCsvDownload(); },
});
registerActions('input', {
  'gc:ratio': function(el, e, key) { gcSetRatio(key, el.value); },
  'gc:cell':  function(el, e, i, key) {
    gcSetCell(i, key, el.value);
    // 재렌더 없이(포커스 보존) 이상치 표시만 실시간 갱신 — 수행 열은 만점=반영비율
    if (key === 'sid') gcMarkDups();
    else el.classList.toggle('invalid', gcScoreInvalid(el.value, key === 'sp' ? gcPerfMax() : 100));
  },
  'gc:previewN': function(el) { gcPreviewN = el.value; gcUpdatePreviewChips(); },
});
registerActions('change', {
  'gc:attend':    function(el, e, i, key) { gcToggleAttend(i, key, el.checked); },
  'gc:allAttend': function(el, e, key) { gcToggleAll(key, el.checked); },
  'gc:csvUp':     function(el) { gcCsvUpload(el.files && el.files[0]); el.value = ''; },
});
