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

let _affSubjId = 'middle';   // 세션 상태 — 새로고침하면 초기화

function affRowHtml(subj, r) {
  const values = r.values.map(v => `<div class="aff-val">${esc(v)}</div>`).join('');
  const codes = r.codes.map(c => `<span class="aff-code" style="background:${subj.aLight};color:${subj.accent}">${esc(c)}</span>`).join(' ');
  const assess = r.assess.map(a => `<div class="aff-assess"><b>${esc(a.method)}</b> — ${esc(a.desc)}</div>`).join('');
  return `<tr>
    <td class="aff-c-domain"><div class="aff-domain">${esc(r.domain)}</div>${values}</td>
    <td class="aff-c-code">${codes}</td>
    <td class="aff-c-assess">${assess}</td>
  </tr>`;
}

function renderAffective() {
  const subs = affectiveSubjects();
  const subj = SUBJECTS.find(s => s.id === _affSubjId) || SUBJECTS.find(s => s.id === subs[0].id);
  const rows = affectiveRows(subj.id) || [];
  const verified = (typeof AFFECTIVE_VERIFIED !== 'undefined') && AFFECTIVE_VERIFIED;
  const opts = subs.map(s => `<option value="${s.id}"${s.id === subj.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  const badge = verified ? '' : `<span class="aff-flag">검수 예정 — 예시 초안입니다</span>`;
  return `<div class="aff-wrap" style="max-width:1200px;margin:0 auto">
    <div class="aff-head">
      <div class="aff-title">정의적 영역 평가 예시 ${badge}</div>
      <div class="aff-tools">
        <select id="affSubjSel" class="eval-select" data-onchange="aff:subject" aria-label="과목 선택">${opts}</select>
        <button class="dl-btn" data-onclick="aff:copy" data-args="${esc(JSON.stringify([subj.id]))}">전체 복사</button>
      </div>
    </div>
    <p class="aff-sub">교육과정 가치·태도를 바탕으로 한 영역별 예시입니다. 표를 복사해 평가계획서에 붙여넣어 편집하세요.</p>
    <table class="aff-table">
      <thead><tr><th>정의적 영역</th><th>성취기준</th><th>평가내용</th></tr></thead>
      <tbody>${rows.map(r => affRowHtml(subj, r)).join('')}</tbody>
    </table>
  </div>`;
}

function affSetSubject(id) { _affSubjId = id; document.getElementById('main').innerHTML = renderAffective(); }

// 복사: 한글 표(HTML). CSS 변수가 해석 안 되므로 리터럴 hex(규칙 5 예외). 코드·평가내용 포함.
function affCopy(subjId) {
  const rows = affectiveRows(subjId) || [];
  const bodyHtml = rows.map(r => {
    const val = r.values.join(', ');
    const code = r.codes.join(' ');
    const ass = r.assess.map(a => `${a.method} — ${a.desc}`).join('\n');
    return `<tr><td>${esc(r.domain)}<br>${esc(val)}</td><td>${esc(code)}</td><td>${esc(ass).replace(/\n/g, '<br>')}</td></tr>`;
  }).join('');
  const html = `<table border="1" style="border-collapse:collapse"><thead><tr><td><b>정의적 영역</b></td><td><b>성취기준</b></td><td><b>평가내용</b></td></tr></thead><tbody>${bodyHtml}</tbody></table>`;
  const plain = rows.map(r => `${r.domain} (${r.values.join(', ')})\t${r.codes.join(' ')}\t${r.assess.map(a => a.method + ' — ' + a.desc).join(' / ')}`).join('\n');
  clipboardWriteHTML(html, plain).then(ok => uiToast(ok ? '표를 복사했습니다 — 한글에 붙여넣으세요' : '복사에 실패했습니다.', ok ? {} : { isErr: true }));
}

export { renderAffective };

registerActions('change', { 'aff:subject': function(el) { affSetSubject(el.value); } });
registerActions('click', { 'aff:copy': function(el, e, id) { affCopy(id); } });

export const __affTest = { affectiveSubjects, affectiveRows };
