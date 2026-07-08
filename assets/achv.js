import { esc, trapFocus, releaseFocus, registerActions, clipboardWriteHTML, uiToast } from './utils.js';

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

export { openAchvModal, closeAchvModal, achvCopyAll, achvCopyStd };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'achv:close':   function() { closeAchvModal(); },
  'achv:copyAll': function(el, e, domainName) { achvCopyAll(domainName); },
  'achv:copyStd': function(el, e, domainName, si) { achvCopyStd(el, domainName, si); },
});
