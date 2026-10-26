import { esc, clipboardWriteHTML, uiToast, registerActions, pageHead } from './utils.js';
import * as planCtx from './planctx.js';

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

// 과목은 수업/평가계획 공통 컨텍스트를 따른다(2026-10 — 예전엔 세션 상태의 개별 선택)

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
  const subj = planCtx.subject();
  const rows = (subj && affectiveRows(subj.id)) || [];
  const verified = (typeof AFFECTIVE_VERIFIED !== 'undefined') && AFFECTIVE_VERIFIED;
  // 초안 표시는 상단 배너 한 곳에서만 — 본문은 일반 글자색(흐린 회색이면 비활성 화면처럼 보였다)
  const banner = verified ? '' : '<div class="aff-banner" role="note"><strong>검수 예정 · 예시 초안</strong> 교육과정 가치·태도를 바탕으로 만든 예시입니다. 학교 사정에 맞게 고쳐 쓰세요.</div>';
  const head = pageHead('수업/평가계획', '정의적 영역 평가', '교육과정 가치·태도를 영역별 평가 예시로 정리했습니다. 표를 복사해 평가계획서에 붙여넣으세요.');
  if (!rows.length) {
    return '<div class="aff-wrap">' + head + banner
      + '<div class="eval-empty">' + esc(subj ? subj.name : '이 과목') + '의 정의적 영역 예시는 아직 없습니다. 예시가 있는 과목: '
      + subs.map(s => esc(s.name)).join(', ') + ' — 위 기준에서 과목을 바꿔 보세요.</div></div>';
  }
  return '<div class="aff-wrap">' + head + banner
    + '<div class="aff-tools"><span class="aff-subj">' + esc(subj.name) + ' · 영역 ' + rows.length + '개</span>'
    + '<button class="dl-btn" data-onclick="aff:copy" data-args="' + esc(JSON.stringify([subj.id])) + '">전체 복사</button></div>'
    + '<table class="aff-table">'
    + '<thead><tr><th>정의적 영역</th><th>성취기준</th><th>평가내용</th></tr></thead>'
    + '<tbody>' + rows.map(r => affRowHtml(subj, r)).join('') + '</tbody>'
    + '</table></div>';
}


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

registerActions('click', { 'aff:copy': function(el, e, id) { affCopy(id); } });

export const __affTest = { affectiveSubjects, affectiveRows };
