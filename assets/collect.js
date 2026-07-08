import { esc, clipboardWriteText, loadState, saveState, registerActions } from './utils.js';

// --- 담은 성취기준 (수집 패널) — app.js에서 분리 (2026-07-08 F2) ---
// collected는 export let 라이브 바인딩: app.js 렌더가 최신 값을 읽는다. 재할당은 이 모듈 안에서만.
export let collected = loadState('collected', []);
let panelOpen = false;

function saveCollected() {
  saveState('collected', collected);
}

function onCheck(chk) {
  const { code, text, sid } = chk.dataset;
  if (chk.checked) {
    if (!collected.some(c => c.code === code)) collected.push({ code, text, sid });
  } else {
    collected = collected.filter(c => c.code !== code);
  }
  saveCollected(); updatePanel();
}

function removeItem(code) {
  collected = collected.filter(c => c.code !== code);
  const chk = document.querySelector(`.card-chk[data-code="${CSS.escape(code)}"]`);
  if (chk) chk.checked = false;
  saveCollected(); updatePanel();
}

export function clearCollect() {
  collected = [];
  document.querySelectorAll('.card-chk').forEach(c => c.checked = false);
  saveCollected(); updatePanel();
}

export function copyAll() {
  if (!collected.length) return;
  const text = collected.map(c => c.code + ' ' + c.text).join('\n');
  const btn = document.getElementById('copyAllBtn');
  clipboardWriteText(text);
  btn.textContent = '복사됨!';
  setTimeout(() => btn.textContent = '전체 복사', 1400);
}

export function togglePanel() {
  panelOpen = !panelOpen;
  const panel = document.getElementById('collectPanel');
  panel.classList.toggle('open', panelOpen);
  panel.setAttribute('aria-hidden', !panelOpen);
  document.getElementById('fab').setAttribute('aria-expanded', panelOpen);
}

export function updatePanel() {
  const n = collected.length;
  document.getElementById('fabCnt').textContent = n;
  document.getElementById('panelCnt').textContent = n;
  document.getElementById('fab').classList.toggle('on', n > 0);
  const dlBtn = document.getElementById('downloadCollectedBtn');
  if (dlBtn) dlBtn.disabled = n === 0;
  if (n === 0 && panelOpen) { panelOpen = false; document.getElementById('collectPanel').classList.remove('open'); }
  const body = document.getElementById('panelBody');
  if (!n) {
    body.innerHTML = '<div style="text-align:center;padding:24px;color:#9CA3AF;font-size:13px">담은 성취기준이 없습니다.</div>';
    return;
  }
  body.innerHTML = collected.map(c => {
    const subj = SUBJECTS.find(s => s.id === c.sid) || SUBJECTS[0];
    return `<div class="p-item">
      <span class="p-item-code" style="background:${subj.aLight};color:${subj.accent}">${esc(c.code)}</span>
      <span class="p-item-text">${esc(c.text)}</span>
      <button class="p-item-rm" data-rm="${esc(c.code)}" aria-label="${esc(c.code)} 삭제">×</button>
    </div>`;
  }).join('');
}

export function downloadCollected() {
  if (!collected.length) return;
  const lines = [];
  SUBJECTS.filter(s => !['overview', 'evalplan'].includes(s.type)).forEach(subj => {
    const items = collected.filter(c => c.sid === subj.id);
    if (!items.length) return;
    if (lines.length) lines.push('');
    lines.push(`[${subj.name}]`);
    items.forEach(it => lines.push(`${it.code} ${it.text}`));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: '담은_성취기준.txt' });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// 패널 내부 삭제 버튼 (동적 항목 — 자체 위임. 모듈은 defer 실행이라 DOM 존재 보장)
document.getElementById('panelBody').addEventListener('click', e => {
  const btn = e.target.closest('.p-item-rm');
  if (btn) removeItem(btn.dataset.rm);
});

// 성취기준 카드 체크박스 (기존 마크업의 data-onchange="app:check" 이름 유지)
registerActions('change', {
  'app:check': function(el) { onCheck(el); },
});
