import { esc, trapFocus, releaseFocus, registerActions, clipboardWriteHTML, uiToast, getAchvKey } from './utils.js';
import { openStdPicker } from './stdpicker.js';

// ── 학기 단위 성취수준 세션 상태 (localStorage 미사용 — 새로고침하면 초기화) ──
let _semSubjId = '';      // 직전에 연 과목. 과목이 바뀌면 선택을 비운다.
let _semAccent = '';
let _semSelected = [];    // 선택된 성취기준 코드
let _semMode = 'join';    // 'join' | 'raw'

// ── 학기 단위 성취수준: 레벨 문장 병합 (순수 함수 — DOM 모름) ──
// 마지막 문장은 원문 그대로 두고, 앞 문장의 종결어미만 연결어미로 바꾼다.
// 어미는 '으며,' → '고,' 순으로 교대해 단조로움을 피한다.
// 규칙(있다./한다.) 밖 어미는 변환하지 않는다 — 데이터가 늘어도 문장이 깨지지 않게.
function achvToConnective(sentence, i) {
  const useEuMyeo = i % 2 === 0;
  const s = sentence.replace(/\s+$/, '');
  if (/있다\.$/.test(s)) return s.replace(/있다\.$/, useEuMyeo ? '있으며,' : '있고,');
  if (/한다\.$/.test(s)) return s.replace(/한다\.$/, useEuMyeo ? '하며,' : '하고,');
  return s;
}

function mergeLevelTexts(texts, mode = 'join') {
  const list = (texts || []).map(t => (t || '').trim()).filter(Boolean);
  if (!list.length) return '';
  if (mode === 'raw') return list.join(' ');
  return list.map((t, i) => (i === list.length - 1 ? t : achvToConnective(t, i))).join(' ');
}

function openAchvModal(domainName, accent) {
  const data = ACHIEVEMENTS[domainName];
  if (!data || !data.length) return;
  const gradeColors = { A:'var(--ok)', B:'var(--accent)', C:'var(--plan)', D:'var(--warn)', E:'var(--danger)' };
  let bodyHtml = '';
  data.forEach((std, si) => {
    bodyHtml += `<div class="achv-table-wrap">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="achv-table-code" style="color:${accent};margin-bottom:0">${esc(std.code)}</div>
      <button class="achv-copy-std" data-onclick="achv:copyStd" data-args="${esc(JSON.stringify([domainName, si]))}">복사</button>
    </div>
    <table class="achv-table">
      <tbody>`;
    ['A','B','C','D','E'].forEach(g => {
      const txt = std.levels[g] || '';
      bodyHtml += `<tr>
      <th style="color:${gradeColors[g]}">${g}</th>
      <td>${esc(txt)}</td>
    </tr>`;
    });
    bodyHtml += `</tbody></table></div>`;
  });
  let overlay = document.getElementById('achvOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'achv-overlay';
    overlay.id = 'achvOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeAchvModal(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="achv-modal" role="dialog" aria-modal="true" aria-labelledby="achvModalTitle">
      <div class="achv-modal-hd">
        <span class="achv-modal-title" id="achvModalTitle" style="color:${accent}">📊 ${esc(domainName)} — ABCDE 성취수준</span>
        <button class="cmp-close-btn" data-onclick="achv:close" aria-label="닫기">✕</button>
      </div>
      <div style="font-size:12px;color:var(--g500);padding:8px 12px;background:var(--g50);border-radius:7px;margin-bottom:14px;line-height:1.6">
        💡 성취기준별 <strong>복사</strong> 또는 <strong>전체 복사</strong> 후 한글 표에 붙여넣기 (HTML 형식으로 복사됨)
      </div>
      <div class="achv-modal-body">${bodyHtml}</div>
      <div class="achv-modal-ft">
        <button class="achv-copy-all pri" id="achvCopyAllBtn" data-onclick="achv:copyAll" data-args="${esc(JSON.stringify([domainName]))}">전체 복사</button>
        <button class="achv-copy-all sec" data-onclick="achv:close">닫기</button>
        <span id="achvCopyMsg" style="font-size:12px;color:var(--ok);display:none">✓ 복사됨</span>
      </div>
    </div>`;
  overlay.style.display = '';
  trapFocus(overlay.querySelector('.achv-modal'));
}

function closeAchvModal() {
  const el = document.getElementById('achvOverlay');
  if (el) { releaseFocus(el.querySelector('.achv-modal')); el.style.display = 'none'; }
}

function achvBuildHtml(rows) {
  return '<table><tbody>' +
    rows.map(({g, txt}) => `<tr><td>${g}</td><td>${txt}</td></tr>`).join('') +
    '</tbody></table>';
}

function achvBuildPlain(rows) {
  return rows.map(({g, txt}) => `${g}\t${txt}`).join('\n');
}

function achvClipWrite(html, plain, onDone) {
  clipboardWriteHTML(html, plain).then(ok => { if (ok) onDone(); else uiToast('복사에 실패했습니다.', { isErr: true }); });
}

function achvCopyAll(domainName) {
  const data = ACHIEVEMENTS[domainName];
  if (!data) return;
  const rows = [];
  data.forEach(std => {
    ['A','B','C','D','E'].forEach(g => rows.push({g, txt: std.levels[g]||''}));
  });
  achvClipWrite(achvBuildHtml(rows), achvBuildPlain(rows), () => {
    const btn = document.getElementById('achvCopyAllBtn');
    const msg = document.getElementById('achvCopyMsg');
    if (btn) btn.textContent = '✓ 복사됨';
    if (msg) msg.style.display = 'inline';
    setTimeout(() => {
      if (btn) btn.textContent = '전체 복사';
      if (msg) msg.style.display = 'none';
    }, 1800);
  });
}

function achvCopyStd(btn, domainName, idx) {
  const std = ACHIEVEMENTS[domainName]?.[idx];
  if (!std) return;
  const rows = ['A','B','C','D','E'].map(g => ({g, txt: std.levels[g]||''}));
  achvClipWrite(achvBuildHtml(rows), achvBuildPlain(rows), () => {
    btn.textContent = '✓';
    btn.classList.add('ok');
    setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('ok'); }, 1500);
  });
}

// ── 학기(과목) 단위 성취수준 — 모든 단원의 ABCDE를 레벨별로 재편성 ──
function collectSemesterRows(subjId) {
  const subj = SUBJECTS.find(s => s.id === subjId);
  if (!subj || !subj.domains) return null;
  const groups = { A: [], B: [], C: [], D: [], E: [] };
  let any = false;
  subj.domains.forEach(d => {
    const stds = ACHIEVEMENTS[getAchvKey(subjId, d.name)];
    if (!stds) return;
    stds.forEach(std => {
      ['A','B','C','D','E'].forEach(g => {
        const txt = std.levels[g] || '';
        if (txt) { groups[g].push({ code: std.code, txt }); any = true; }
      });
    });
  });
  return any ? { subj, groups } : null;
}

function achvBuildSemesterHtml(groups) {
  let rows = '';
  ['A','B','C','D','E'].forEach(g => {
    const items = groups[g];
    if (!items.length) return;
    items.forEach((r, i) => {
      rows += '<tr>' + (i === 0 ? `<td rowspan="${items.length}">${g}</td>` : '')
        + `<td>${r.code}</td><td>${r.txt}</td></tr>`;
    });
  });
  return '<table><tbody>' + rows + '</tbody></table>';
}

function achvBuildSemesterPlain(groups) {
  return ['A','B','C','D','E'].map(g => {
    const items = groups[g];
    if (!items.length) return null;
    return [`[${g}]`].concat(items.map(r => `${r.code} ${r.txt}`)).join('\n');
  }).filter(Boolean).join('\n\n');
}

function openSemesterAchvModal(subjId, accent) {
  const res = collectSemesterRows(subjId);
  if (!res) return;
  const { subj, groups } = res;
  const gradeColors = { A:'var(--ok)', B:'var(--accent)', C:'var(--plan)', D:'var(--warn)', E:'var(--danger)' };
  let bodyHtml = '';
  ['A','B','C','D','E'].forEach(g => {
    const items = groups[g];
    if (!items.length) return;
    bodyHtml += `<div class="achv-table-wrap">
    <div class="achv-table-code" style="color:${gradeColors[g]};margin-bottom:6px">${g} 수준 · ${items.length}개</div>
    <table class="achv-table"><tbody>`
      + items.map(r => `<tr>
      <th style="color:${accent};white-space:nowrap">${esc(r.code)}</th>
      <td>${esc(r.txt)}</td>
    </tr>`).join('')
      + `</tbody></table></div>`;
  });
  let overlay = document.getElementById('achvOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'achv-overlay';
    overlay.id = 'achvOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeAchvModal(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="achv-modal" role="dialog" aria-modal="true" aria-labelledby="achvModalTitle">
      <div class="achv-modal-hd">
        <span class="achv-modal-title" id="achvModalTitle" style="color:${accent}">📊 ${esc(subj.name)} — 학기 단위 성취수준</span>
        <button class="cmp-close-btn" data-onclick="achv:close" aria-label="닫기">✕</button>
      </div>
      <div style="font-size:12px;color:var(--g500);padding:8px 12px;background:var(--g50);border-radius:7px;margin-bottom:14px;line-height:1.6">
        💡 모든 단원의 성취수준을 <strong>레벨(A~E)별로</strong> 모았습니다. <strong>전체 복사</strong> 후 한글 표에 붙여넣기 (HTML 형식으로 복사됨)
      </div>
      <div class="achv-modal-body">${bodyHtml}</div>
      <div class="achv-modal-ft">
        <button class="achv-copy-all pri" id="achvCopyAllBtn" data-onclick="achv:copyAllSem" data-args="${esc(JSON.stringify([subjId]))}">전체 복사</button>
        <button class="achv-copy-all sec" data-onclick="achv:close">닫기</button>
        <span id="achvCopyMsg" style="font-size:12px;color:var(--ok);display:none">✓ 복사됨</span>
      </div>
    </div>`;
  overlay.style.display = '';
  trapFocus(overlay.querySelector('.achv-modal'));
}

function achvCopyAllSem(subjId) {
  const res = collectSemesterRows(subjId);
  if (!res) return;
  achvClipWrite(achvBuildSemesterHtml(res.groups), achvBuildSemesterPlain(res.groups), () => {
    const btn = document.getElementById('achvCopyAllBtn');
    const msg = document.getElementById('achvCopyMsg');
    if (btn) btn.textContent = '✓ 복사됨';
    if (msg) msg.style.display = 'inline';
    setTimeout(() => {
      if (btn) btn.textContent = '전체 복사';
      if (msg) msg.style.display = 'none';
    }, 1800);
  });
}

export { openAchvModal, closeAchvModal, achvCopyAll, achvCopyStd, openSemesterAchvModal, achvCopyAllSem };

export const __achvTest = { mergeLevelTexts };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'achv:close':   function() { closeAchvModal(); },
  'achv:copyAll': function(el, e, domainName) { achvCopyAll(domainName); },
  'achv:copyStd': function(el, e, domainName, si) { achvCopyStd(el, domainName, si); },
  'achv:copyAllSem': function(el, e, subjId) { achvCopyAllSem(subjId); },
});
