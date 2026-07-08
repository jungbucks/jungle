// --- 성취기준 다중 선택 공용 모달 (stdpicker) ---
// 여러 도구(수업계획·평가계획·루브릭·정기시험)가 공유하는 성취기준 선택기.
// 사용: openStdPicker({ title, subjectIdx, preselected, onConfirm })
//   onConfirm(codes, subjectIdx) — 확인 시 선택된 코드 배열(정렬됨)과 과목 인덱스를 콜백으로 전달
import { esc, openModal, closeModal, registerActions } from './utils.js';
import { evalSubjects } from './evalplan.js';

let _subjectIdx = 1;
let _selected = new Set();
let _onConfirm = null;
let _selectAll = false;        // 도메인별 "단원 모두 포함" 버튼 표시 여부
let _highlightDomain = '';     // 강조 + 자동 스크롤할 도메인명

export function openStdPicker({ title = '성취기준 선택', subjectIdx = 1, preselected = [], onConfirm, selectAll = false, highlightDomain = '' } = {}) {
  _subjectIdx = subjectIdx || 1;
  _selected = new Set((preselected || []).filter(Boolean));
  _onConfirm = onConfirm;
  _selectAll = !!selectAll;
  _highlightDomain = highlightDomain || '';
  const t = document.getElementById('stdPickerTitle');
  if (t) t.textContent = title;
  stdPickerRenderBody();
  openModal('stdPickerModal');
  if (_highlightDomain) {
    requestAnimationFrame(() => {
      const el = document.querySelector('#stdPickerModalBody [data-domain="' + _highlightDomain + '"]');
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
}

function stdPickerClose() {
  closeModal('stdPickerModal');
  _onConfirm = null;
}

function stdPickerConfirm() {
  const codes = [..._selected].sort((a, b) => {
    const na = parseInt(a) || 0, nb = parseInt(b) || 0;
    return na !== nb ? na - nb : a.localeCompare(b, 'ko');
  });
  const cb = _onConfirm;
  const subjIdx = _subjectIdx;
  closeModal('stdPickerModal');
  _onConfirm = null;
  if (cb) cb(codes, subjIdx);
}

function stdPickerChangeSubject(idx) {
  _subjectIdx = +idx;
  stdPickerRenderBody();
}

function stdPickerToggle(code, checked) {
  checked ? _selected.add(code) : _selected.delete(code);
  const el = document.getElementById('stdPickerSelCount');
  if (el) el.textContent = _selected.size + '개 선택됨';
}

// 도메인(단원) 내 전체 성취기준 선택
function stdPickerSelectAll(subjIdx, domainIdx) {
  const subj = SUBJECTS[subjIdx];
  if (!subj || !subj.domains[domainIdx]) return;
  subj.domains[domainIdx].items.forEach(it => _selected.add(it.code));
  stdPickerRenderBody();
}

function stdPickerRenderBody() {
  const subj = SUBJECTS[_subjectIdx];
  const subjs = evalSubjects();
  const selEl = document.getElementById('stdPickerSubjSel');
  if (selEl) selEl.innerHTML = subjs.map(s => {
    const idx = SUBJECTS.indexOf(s);
    return '<option value="' + idx + '"' + (_subjectIdx === idx ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  }).join('');
  let html = '';
  if (subj && subj.domains) {
    subj.domains.forEach(function(d, di) {
      const isHl = _highlightDomain && d.name === _highlightDomain;
      const header = _selectAll
        ? '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px"><div class="eval-domain-label" style="margin-bottom:0">' + esc(d.name) + '</div>'
          + '<button class="pbtn sec" style="font-size:12px;padding:3px 10px;height:auto;flex-shrink:0" data-onclick="sp:selectAll" data-args="' + esc(JSON.stringify([_subjectIdx, di])) + '">단원 모두 포함</button></div>'
        : '<div class="eval-domain-label">' + esc(d.name) + '</div>';
      html += '<div data-domain="' + esc(d.name) + '"' + (isHl ? ' style="background:var(--g50);border-radius:6px"' : '') + '>' + header;
      d.items.forEach(function(it) {
        const chk = _selected.has(it.code);
        html += '<div class="eval-std-item">'
          + '<input type="checkbox" class="eval-std-chk" ' + (chk ? 'checked' : '') + ' data-onchange="sp:toggle" data-args="' + esc(JSON.stringify([it.code])) + '">'
          + '<span class="eval-std-code" style="background:' + subj.aLight + ';color:' + subj.accent + '">' + esc(it.code) + '</span>'
          + '<span class="eval-std-text">' + esc(it.text) + '</span>'
          + '</div>';
      });
      html += '</div>';
    });
  }
  const bodyEl = document.getElementById('stdPickerModalBody');
  if (bodyEl) bodyEl.innerHTML = html;
  const cntEl = document.getElementById('stdPickerSelCount');
  if (cntEl) cntEl.textContent = _selected.size + '개 선택됨';
}

// index.html 정적 모달(app.js bindStaticHandlers)이 참조 — 유지
window.stdPickerClose = stdPickerClose;
window.stdPickerConfirm = stdPickerConfirm;
window.stdPickerChangeSubject = stdPickerChangeSubject;

// ── 이벤트 위임 등록 (동적 템플릿 인라인 핸들러 대체) ──
registerActions('click', {
  'sp:selectAll': function(el, e, subjectIdx, di) { stdPickerSelectAll(subjectIdx, di); },
});
registerActions('change', {
  'sp:toggle': function(el, e, code) { stdPickerToggle(code, el.checked); },
});
