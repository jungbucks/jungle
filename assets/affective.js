import { esc, clipboardWriteHTML, uiToast, registerActions } from './utils.js';

// ── 조회·조립 (순수 — DOM 모름) ──
// AFFECTIVE는 data.js의 전역(boot.js가 window로 브리지). 데이터 있는 과목만 노출.
function affectiveSubjects() {
  if (typeof AFFECTIVE === 'undefined') return [];
  return Object.keys(AFFECTIVE)
    .map(id => SUBJECTS.find(s => s.id === id))
    .filter(Boolean)
    .map(s => ({ id: s.id, name: s.name }));
}

function affectiveRows(subjId) {
  if (typeof AFFECTIVE === 'undefined' || !AFFECTIVE[subjId]) return null;
  return AFFECTIVE[subjId];
}

export const __affTest = { affectiveSubjects, affectiveRows };
