import { esc, loadState, findTextByCode, registerActions, clipboardWriteHTML, pageHead, emptySteps, uiToast, uiConfirm } from './utils.js';
import { evalSubjects, evalPlanSubtab } from './evalplan.js';
import { ALL_ITEMS } from './state.js';
import { openStdPicker } from './stdpicker.js';

// --- Rubric State ---
let rubricState = (() => {
  const s = loadState('jungle_rubric', null);
  if (s) {
    if (!('task' in s))       s.task = '';
    if (!('semester' in s))   s.semester = 1;
    if (!('rubricRows' in s)) s.rubricRows = [];
    return s;
  }
  return { subjectIdx:1, selectedCodes:[], evalName:'', task:'', semester:1, totalScore:'', baseScore:'', generated:false, rubricRows:[] };
})();
function rubricChangeSubject(idx) {
  rubricState.subjectIdx = idx;
  rubricSave();
  rubricRerender();
}
function rubricSave() {
  try { localStorage.setItem('jungle_rubric', JSON.stringify(rubricState)); } catch(e) {}
}
function rubricRerender() {
  if (!document.getElementById('main').querySelector('.eval-wrap')) return;
  if (evalPlanSubtab !== 'rubric') return;
  document.getElementById('main').innerHTML = renderRubric();
}
async function rubricReset() {
  if (!(await uiConfirm('루브릭 설정이 초기화됩니다. 계속할까요?'))) return;
  rubricState = { subjectIdx:1, selectedCodes:[], evalName:'', task:'', semester:1, totalScore:'', baseScore:'', generated:false, rubricRows:[] };
  localStorage.removeItem('jungle_rubric');
  rubricRerender();
}
function rubricOpenModal() {
  openStdPicker({
    title: '성취기준 선택',
    subjectIdx: rubricState.subjectIdx,
    preselected: rubricState.selectedCodes,
    selectAll: true,
    onConfirm: (codes) => {
      rubricState.selectedCodes = codes;
      rubricSave();
      rubricRerender();
    }
  });
}
function rubricSetEvalName(v)  { rubricState.evalName = v; rubricSave(); }
function rubricSetTotal(v)     { rubricState.totalScore = v; rubricSave(); rubricRerender(); }
function rubricSetBase(v)      { rubricState.baseScore = v; rubricSave(); rubricRerender(); }
function rubricSetTask(v)      { rubricState.task = v; rubricSave(); }
function rubricSetSemester(v)  { rubricState.semester = parseInt(v); rubricSave(); rubricRerender(); }
function rubricAddRow(code) {
  const entry = (rubricState.rubricRows || []).find(function(r) { return r.code === code; });
  if (entry) { entry.rows.push({ score: '', text: '' }); rubricSave(); rubricRerender(); }
}
function rubricRemoveRow(code, idx) {
  const entry = (rubricState.rubricRows || []).find(function(r) { return r.code === code; });
  if (entry && entry.rows.length > 1) { entry.rows.splice(idx, 1); rubricSave(); rubricRerender(); }
}
function rubricSetRowScore(code, idx, v) {
  const entry = (rubricState.rubricRows || []).find(function(r) { return r.code === code; });
  if (entry && entry.rows[idx] !== undefined) { entry.rows[idx].score = v; rubricSave(); }
}
function rubricSetRowText(code, idx, v) {
  const entry = (rubricState.rubricRows || []).find(function(r) { return r.code === code; });
  if (entry && entry.rows[idx] !== undefined) { entry.rows[idx].text = v; rubricSave(); }
}
function rubricSetBaseText(code, v) {
  const entry = (rubricState.rubricRows || []).find(function(r) { return r.code === code; });
  if (entry) { entry.baseText = v; rubricSave(); }
}
function rubricGenerate() {
  if (!rubricState.selectedCodes.length) { uiToast('성취기준을 먼저 선택해주세요.', { isErr: true }); return; }
  if (!rubricState.totalScore) { uiToast('영역만점을 입력해주세요.', { isErr: true }); return; }
  const existingMap = {};
  (rubricState.rubricRows || []).forEach(function(r) { existingMap[r.code] = r; });
  rubricState.rubricRows = rubricState.selectedCodes.map(function(code) {
    return existingMap[code] || { code: code, baseText: '답안을 작성하였으나 수행 조건을 만족하지 못함.', rows: [{ score: '', text: '' }] };
  });
  rubricState.generated = true;
  rubricSave();
  rubricRerender();
}
function rubricRemoveCode(code) {
  rubricState.selectedCodes = rubricState.selectedCodes.filter(function(c) { return c !== code; });
  rubricState.rubricRows = (rubricState.rubricRows || []).filter(function(r) { return r.code !== code; });
  rubricSave();
  rubricRerender();
}
async function rubricCopyHTML(html, btnId, label) {
  if (!html) return;
  const btn = document.getElementById(btnId);
  const ok = await clipboardWriteHTML(html);
  if (ok) {
    if (btn) { btn.textContent = '복사됨!'; setTimeout(function() { btn.textContent = label; }, 1500); }
  } else {
    uiToast('복사에 실패했습니다. 브라우저 권한을 확인해주세요.', { isErr: true });
  }
}
function rubricCopyTable1() { rubricCopyHTML(rubricBuildTableHTML('table1'), 'rubricCopyBtn1', '① 성취수준표 복사'); }
function rubricCopyTable2() { rubricCopyHTML(rubricBuildTableHTML('table2'), 'rubricCopyBtn2', '② 채점 루브릭 복사'); }

function rubricBuildTableHTML(target) {
  const codes = rubricState.selectedCodes;
  if (!codes.length) return '';
  const LEVELS = ['A','B','C','D','E'];
  const total = parseInt(rubricState.totalScore) || 0;
  const base  = parseInt(rubricState.baseScore)  || 0;
  const CS = 'border:1px solid #000;padding:6px 8px;font-family:\'Pretendard\',\'맑은 고딕\',sans-serif;font-size:10pt;vertical-align:top';
  const TH = 'border:1px solid #000;padding:6px 8px;font-family:\'Pretendard\',\'맑은 고딕\',sans-serif;font-size:10pt;background:#f5f5f5;font-weight:700;text-align:center;vertical-align:middle';
  const CC = CS + ';text-align:center;vertical-align:middle;font-weight:600';
  const HF = 'font-weight:700;margin-right:6px';

  // 표1
  const t1head = '<tr><td colspan="3" style="' + CS + ';background:#f9f9f9">'
    + '<span style="' + HF + '">평가 영역명</span>' + esc(rubricState.evalName)
    + '&nbsp;&nbsp;<span style="' + HF + '">영역만점</span>' + total + '점'
    + '&nbsp;&nbsp;<span style="' + HF + '">학기</span>' + rubricState.semester + '학기'
    + '</td></tr>'
    + '<tr><td colspan="3" style="' + CS + ';background:#f9f9f9">'
    + '<span style="' + HF + '">수행과제</span>' + esc(rubricState.task)
    + '</td></tr>'
    + '<tr><th style="' + TH + ';width:22%">성취기준</th><th style="' + TH + ';width:4%">등급</th><th style="' + TH + '">성취기준별 성취수준</th></tr>';
  const t1body = codes.map(function(code) {
    const lvls = (ALL_ITEMS[code] || {}).levels || {};
    const txt = findTextByCode(code);
    return LEVELS.map(function(lv, li) {
      const cc = li === 0
        ? '<td rowspan="5" style="' + CC + ';word-break:keep-all;min-width:110px">'
          + esc(code) + (txt ? '<br><span style="font-weight:400;font-size:10.5pt">' + esc(txt) + '</span>' : '') + '</td>'
        : '';
      return '<tr>' + cc
        + '<td style="' + TH + ';width:4%">' + lv + '</td>'
        + '<td style="' + CS + '">' + esc(lvls[lv] || '') + '</td></tr>';
    }).join('');
  }).join('');
  const table1 = '<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-family:\'Pretendard\',\'맑은 고딕\',sans-serif;margin-bottom:20pt">'
    + '<colgroup><col style="width:22%"><col style="width:4%"><col></colgroup>'
    + '<tbody>' + t1head + t1body + '</tbody></table>';

  // 표2
  const rr = rubricState.rubricRows || [];
  const allScores = [];
  rr.forEach(function(e) { e.rows.forEach(function(r) { const s=parseInt(r.score); if (!isNaN(s)) allScores.push(s); }); });
  allScores.sort(function(a,b){ return b-a; });

  const t2body = rr.map(function(entry) {
    const txt = findTextByCode(entry.code);
    const maxS = entry.rows.reduce(function(m,r){ return Math.max(m,parseInt(r.score)||0); },0);
    const label = esc(txt || entry.code) + (maxS > 0 ? '(' + maxS + '점)' : '');
    const span = entry.rows.length + 1;
    const rowsHtml = entry.rows.map(function(row, ri) {
      const cc = ri === 0 ? '<td rowspan="' + span + '" style="' + CC + ';vertical-align:middle;min-width:120px">' + label + '</td>' : '';
      return '<tr>' + cc
        + '<td style="' + CS + ';text-align:center">' + esc(String(row.score)) + (row.score !== '' ? '점' : '') + '</td>'
        + '<td style="' + CS + '">' + esc(row.text) + '</td></tr>';
    }).join('');
    const baseRow = '<tr>'
      + '<td style="' + CS + ';text-align:center;background:#FEF9C3;font-weight:700">' + base + '점</td>'
      + '<td style="' + CS + ';background:#FEF9C3">' + esc(entry.baseText || '') + '</td></tr>';
    return rowsHtml + baseRow;
  }).join('');
  const footerScores = allScores.map(function(s){ return s + '점'; }).join('  ');
  const t2foot = '<tr><td style="' + TH + '">합산 배점</td>'
    + '<td colspan="2" style="' + CS + ';font-size:9pt">'
    + footerScores + (base ? '&nbsp;&nbsp;기본점수: ' + base + '점' : '')
    + '</td></tr>';
  const table2 = '<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-family:\'Pretendard\',\'맑은 고딕\',sans-serif">'
    + '<colgroup><col style="width:22%"><col style="width:10%"><col></colgroup>'
    + '<thead><tr>'
    + '<th style="' + TH + '">평가요소</th>'
    + '<th style="' + TH + '">배점</th>'
    + '<th style="' + TH + '">수행수준 (채점기준)</th>'
    + '</tr></thead><tbody>' + t2body + '</tbody>'
    + '<tfoot>' + t2foot + '</tfoot></table>';

  if (target === 'table1') return table1;
  if (target === 'table2') return table2;
  return table1 + table2;
}

// ── 정기시험 출제 계획 ──────────────────────────────────────

function renderRubric() {
  const codes  = rubricState.selectedCodes;
  const LEVELS = ['A','B','C','D','E'];
  const subj   = SUBJECTS[rubricState.subjectIdx] || SUBJECTS[1];
  const accent = subj.accent;
  const aLight = subj.aLight;

  const selectedBadges = codes.length
    ? codes.map(function(c) {
        return '<span class="lp-code-badge" style="background:' + aLight + ';color:' + accent + '">' + esc(c)
          + '<button class="lp-code-del" data-onclick="rubric:removeCode" data-args="' + esc(JSON.stringify([c])) + '" aria-label="' + esc(c) + ' 제거">×</button></span>';
      }).join('')
    : '<span class="eval-std-empty-hint">선택된 성취기준이 없습니다</span>';

  const subjs = evalSubjects();
  const subjOpts = subjs.map(function(s) {
    const idx = SUBJECTS.indexOf(s);
    return '<option value="' + idx + '"' + (rubricState.subjectIdx === idx ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  }).join('');

  const settingsHtml = '<div class="eval-settings">'
    + '<div class="eval-settings-title">루브릭 설정</div>'
    + '<div class="eval-settings-row">'
    + '<div class="eval-field"><span class="eval-label">과목</span>'
    + '<select class="eval-select" data-onchange="rubric:subject">' + subjOpts + '</select></div>'
    + '<div class="eval-field"><span class="eval-label">성취기준</span>'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<button class="pbtn sec" data-onclick="rubric:openModal">+ 선택</button>'
    + '<div style="display:flex;flex-wrap:wrap;gap:4px">' + selectedBadges + '</div>'
    + '</div></div>'
    + '</div>'
    + '<div class="eval-settings-row">'
    + '<div class="eval-field"><span class="eval-label">평가 영역명</span>'
    + '<input class="eval-input-text" type="text" value="' + esc(rubricState.evalName) + '" data-oninput="rubric:evalName" placeholder="예: 알고리즘 설계 프로젝트"></div>'
    + '<div class="eval-field"><span class="eval-label">학기</span>'
    + '<div class="eval-toggle-group">'
    + '<button class="eval-toggle' + (rubricState.semester===1?' active':'') + '" data-onclick="rubric:semester" data-args="[1]" aria-pressed="' + (rubricState.semester===1) + '"'
    + (rubricState.semester===1?' style="background:var(--plan);color:#fff"':'') + '>1학기</button>'
    + '<button class="eval-toggle' + (rubricState.semester===2?' active':'') + '" data-onclick="rubric:semester" data-args="[2]" aria-pressed="' + (rubricState.semester===2) + '"'
    + (rubricState.semester===2?' style="background:var(--plan);color:#fff"':'') + '>2학기</button>'
    + '</div></div>'
    + '<div class="eval-field"><span class="eval-label">영역만점</span>'
    + '<input class="eval-number" type="number" min="1" value="' + esc(String(rubricState.totalScore)) + '" data-oninput="rubric:total" placeholder="예: 20"></div>'
    + '<div class="eval-field"><span class="eval-label">기본점수</span>'
    + '<input class="eval-number" type="number" min="0" value="' + esc(String(rubricState.baseScore)) + '" data-oninput="rubric:base" placeholder="예: 5"></div>'
    + '</div>'
    + '<div class="eval-settings-row">'
    + '<div class="eval-field" style="flex:1"><span class="eval-label">수행과제</span>'
    + '<textarea class="eval-element-textarea" style="height:56px" data-oninput="rubric:task" placeholder="수행과제를 입력하세요">' + esc(rubricState.task) + '</textarea></div>'
    + '</div>'
    + '<div class="eval-settings-row">'
    + '<button class="eval-gen-btn" data-onclick="rubric:generate">루브릭 생성</button>'
    + '<button class="pbtn sec" data-onclick="rubric:reset" style="margin-left:8px">초기화</button>'
    + '</div>'
    + '</div>';

  let contentSection;
  if (!rubricState.generated || !codes.length) {
    contentSection = codes.length
      ? '<div class="eval-empty">영역만점을 입력하고 "루브릭 생성" 버튼을 눌러주세요.</div>'
      : emptySteps(['성취기준 선택', '루브릭 생성', '채점기준 작성 후 표 복사']);
  } else {
    const total = parseInt(rubricState.totalScore) || 0;
    const base  = parseInt(rubricState.baseScore)  || 0;

    // ── 표1: 성취기준별 성취수준표 ──
    const t1rows = codes.map(function(code) {
      const lvls = (ALL_ITEMS[code] || {}).levels || {};
      const txt = findTextByCode(code);
      return LEVELS.map(function(lv, li) {
        const cc = li === 0
          ? '<td class="rubric-code-cell" rowspan="5" style="background:' + aLight + ';color:' + accent
            + ';vertical-align:middle;word-break:keep-all;min-width:120px;font-size:12px;padding:8px">'
            + '<strong>' + esc(code) + '</strong>'
            + (txt ? '<br><span style="font-weight:400;font-size:14px;color:var(--g700)">' + esc(txt) + '</span>' : '')
            + '</td>'
          : '';
        return '<tr>' + cc
          + '<td class="rubric-th-grade" style="font-weight:700;background:' + aLight + ';color:' + accent + '">' + lv + '</td>'
          + '<td class="rubric-level-cell">' + esc(lvls[lv] || '') + '</td></tr>';
      }).join('');
    }).join('');

    const table1 = '<div class="rubric-table-wrap">'
      + '<div class="rubric-table-title">① 성취기준별 성취수준표</div>'
      + '<table class="rubric-table">'
      + '<colgroup><col style="width:22%"><col style="width:4%"><col></colgroup>'
      + '<tbody>'
      + '<tr><td colspan="3" style="border:1px solid #d1d5db;padding:6px 10px;background:#f9fafb">'
      + '<span style="font-weight:700;margin-right:8px">평가 영역명</span>' + esc(rubricState.evalName)
      + '&emsp;<span style="font-weight:700;margin-right:8px">영역만점</span>' + total + '점'
      + '&emsp;<span style="font-weight:700;margin-right:8px">학기</span>' + rubricState.semester + '학기'
      + '</td></tr>'
      + '<tr><td colspan="3" style="border:1px solid #d1d5db;padding:6px 10px;background:#f9fafb">'
      + '<span style="font-weight:700;margin-right:8px">수행과제</span>' + esc(rubricState.task)
      + '</td></tr>'
      + '<tr>'
      + '<th class="rubric-th-code" style="background:' + accent + ';color:#fff">성취기준</th>'
      + '<th class="rubric-th-grade" style="background:' + accent + ';color:#fff">등급</th>'
      + '<th class="rubric-th-level" style="background:' + accent + ';color:#fff">성취기준별 성취수준</th>'
      + '</tr>'
      + t1rows
      + '</tbody></table></div>';

    // ── 표2: 세부 채점 루브릭 ──
    const rr = rubricState.rubricRows || [];
    const allScores = [];
    rr.forEach(function(e) {
      e.rows.forEach(function(r) { const s=parseInt(r.score); if(!isNaN(s)) allScores.push(s); });
    });
    allScores.sort(function(a,b){ return b-a; });

    const t2rows = rr.map(function(entry) {
      const txt = findTextByCode(entry.code);
      const maxS = entry.rows.reduce(function(m,r){ return Math.max(m, parseInt(r.score)||0); }, 0);
      const aCode = esc(JSON.stringify([entry.code]));
      const label = (txt || entry.code) + (maxS > 0 ? '(' + maxS + '점)' : '');
      const span = entry.rows.length + 1;

      const rowsHtml = entry.rows.map(function(row, ri) {
        const aRow = esc(JSON.stringify([entry.code, ri]));
        const first = ri === 0
          ? '<td class="rubric-eval-cell" rowspan="' + span + '">'
            + '<div style="font-weight:600;font-size:13px;margin-bottom:6px">' + esc(label) + '</div>'
            + '<button class="lp-add-std" data-onclick="rubric:addRow" data-args="' + aCode + '">+ 행 추가</button>'
            + '</td>'
          : '';
        return '<tr>' + first
          + '<td style="border:1px solid #d1d5db;padding:4px 6px;text-align:center;white-space:nowrap;vertical-align:middle">'
          + '<input type="number" class="rubric-score-input" min="0" value="' + esc(String(row.score))
          + '" data-oninput="rubric:rowScore" data-args="' + aRow + '" style="width:52px">점'
          + '</td>'
          + '<td style="border:1px solid #d1d5db;padding:4px 6px;vertical-align:middle">'
          + '<div style="display:flex;align-items:center;gap:4px">'
          + '<input type="text" class="rubric-text-input" value="' + esc(String(row.text))
          + '" data-oninput="rubric:rowText" data-args="' + aRow + '" placeholder="채점기준을 입력하세요" style="flex:1;min-width:0">'
          + (entry.rows.length > 1 ? '<button class="lp-code-del" data-onclick="rubric:removeRow" data-args="' + aRow + '" aria-label="' + (ri+1) + '번 행 삭제" style="color:var(--danger);flex-shrink:0">×</button>' : '')
          + '</div></td></tr>';
      }).join('');

      const baseRow = '<tr class="rubric-base-row">'
        + '<td style="border:1px solid #d1d5db;padding:4px 6px;text-align:center;vertical-align:middle;white-space:nowrap">'
        + '<strong>' + base + '점</strong><br><span style="font-size:10px;color:var(--warn-dark)">(기본점수)</span>'
        + '</td>'
        + '<td style="border:1px solid #d1d5db;padding:4px 6px;vertical-align:middle">'
        + '<input type="text" class="rubric-text-input" value="' + esc(entry.baseText || '')
        + '" data-oninput="rubric:baseText" data-args="' + aCode + '" style="width:100%">'
        + '</td></tr>';
      return rowsHtml + baseRow;
    }).join('');

    const footerStr = allScores.map(function(s){ return s+'점'; }).join('  ');
    const footer = '<tr style="background:#f3f4f6;font-weight:600">'
      + '<td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center">합산 배점</td>'
      + '<td colspan="2" style="border:1px solid #d1d5db;padding:6px 10px;font-size:12px">'
      + footerStr
      + (base ? '&emsp;<span style="background:#FEF9C3;border-radius:4px;padding:2px 8px">기본점수: ' + base + '점</span>' : '')
      + '</td></tr>';

    const table2 = '<div class="rubric-table-wrap">'
      + '<div class="rubric-table-title">② 세부 채점 루브릭</div>'
      + '<table class="rubric-table">'
      + '<colgroup><col style="width:22%"><col style="width:10%"><col></colgroup>'
      + '<thead><tr>'
      + '<th class="rubric-th-code" style="background:' + accent + ';color:#fff">평가요소</th>'
      + '<th class="rubric-th-grade" style="background:' + accent + ';color:#fff">배점</th>'
      + '<th class="rubric-th-level" style="background:' + accent + ';color:#fff">수행수준 (채점기준)</th>'
      + '</tr></thead>'
      + '<tbody>' + t2rows + '</tbody>'
      + '<tfoot>' + footer + '</tfoot>'
      + '</table></div>';

    const t1block = '<div class="rubric-table-block">'
      + table1
      + '<div class="rubric-block-actions">'
      + '<button class="pbtn pri" id="rubricCopyBtn1" data-onclick="rubric:copy1">① 성취수준표 복사</button>'
      + '</div>'
      + '</div>';
    const t2block = '<div class="rubric-table-block">'
      + table2
      + '<div class="rubric-block-actions">'
      + '<button class="pbtn pri" id="rubricCopyBtn2" data-onclick="rubric:copy2">② 채점 루브릭 복사</button>'
      + '</div>'
      + '</div>';
    contentSection = '<div class="rubric-preview-area">'
      + '<div class="rubric-preview-cols">' + t1block + t2block + '</div>'
      + '</div>';
  }

  return '<div class="eval-wrap">'
    + pageHead('수업/평가계획', '수행평가 루브릭 설계', '성취기준별 성취수준표와 세부 채점 루브릭을 만들어 한글/워드로 복사합니다.')
    + settingsHtml + contentSection + '</div>';
}

export { renderRubric };

// ── 이벤트 위임 등록 (인라인 핸들러 대체 — window 전역 노출 불필요) ──
registerActions('click', {
  'rubric:openModal':  function() { rubricOpenModal(); },
  'rubric:semester':   function(el, e, v) { rubricSetSemester(v); },
  'rubric:generate':   function() { rubricGenerate(); },
  'rubric:reset':      function() { rubricReset(); },
  'rubric:removeCode': function(el, e, code) { rubricRemoveCode(code); },
  'rubric:addRow':     function(el, e, code) { rubricAddRow(code); },
  'rubric:removeRow':  function(el, e, code, idx) { rubricRemoveRow(code, idx); },
  'rubric:copy1':      function() { rubricCopyTable1(); },
  'rubric:copy2':      function() { rubricCopyTable2(); },
});
registerActions('input', {
  'rubric:evalName': function(el) { rubricSetEvalName(el.value); },
  'rubric:total':    function(el) { rubricSetTotal(el.value); },
  'rubric:base':     function(el) { rubricSetBase(el.value); },
  'rubric:task':     function(el) { rubricSetTask(el.value); },
  'rubric:rowScore': function(el, e, code, idx) { rubricSetRowScore(code, idx, el.value); },
  'rubric:rowText':  function(el, e, code, idx) { rubricSetRowText(code, idx, el.value); },
  'rubric:baseText': function(el, e, code) { rubricSetBaseText(code, el.value); },
});
registerActions('change', {
  'rubric:subject': function(el) { rubricChangeSubject(+el.value); },
});