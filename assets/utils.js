// --- Shared Utilities (ES Module) ---

export function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function safeUrl(url) {
  return (typeof url === 'string' && /^https?:\/\//i.test(url)) ? esc(url) : '#';
}

export function hi(s, q) {
  if (!q) return esc(s);
  const r = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
  return esc(s).replace(r, m => `<mark>${m}</mark>`);
}

export function cid(code) { return code.replace(/[\[\]-]/g,'_'); }

export function announce(msg) {
  const r = document.getElementById('liveRegion');
  if (!r) return;
  r.textContent = '';
  requestAnimationFrame(() => { r.textContent = msg; });
}

export function setAccent(s) {
  const r = document.documentElement.style;
  r.setProperty('--accent', s.accent);
  r.setProperty('--accent-light', s.aLight);
  r.setProperty('--accent-dark', s.aDark);
}

let _lastFocused = null;
export function trapFocus(modalEl) {
  _lastFocused = document.activeElement;
  const sel = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(modalEl.querySelectorAll(sel));
  if (nodes.length) nodes[0].focus();
  modalEl._trap = function(e) {
    if (e.key !== 'Tab') return;
    const fi = nodes[0], la = nodes[nodes.length - 1];
    if (e.shiftKey ? document.activeElement === fi : document.activeElement === la) {
      e.preventDefault(); (e.shiftKey ? la : fi).focus();
    }
  };
  modalEl.addEventListener('keydown', modalEl._trap);
}

export function releaseFocus(modalEl) {
  if (modalEl && modalEl._trap) { modalEl.removeEventListener('keydown', modalEl._trap); delete modalEl._trap; }
  if (_lastFocused) { _lastFocused.focus(); _lastFocused = null; }
}

export function clipboardWriteText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = Object.assign(document.createElement('textarea'), {value:text, style:'position:fixed;opacity:0'});
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  });
}

export function loadState(key, def) {
  try { const s = JSON.parse(localStorage.getItem(key)); if (s) return s; } catch(e) {}
  return def;
}

export function getAchvKey(subjId, domainName) {
  return subjId === 'high' ? domainName + '_고' : subjId === 'cs' ? domainName + '_cs' : domainName;
}

export function findTextByCode(code) {
  for (const s of SUBJECTS) {
    if (!s.domains) continue;
    for (const d of s.domains)
      for (const it of d.items) if (it.code === code) return it.text;
  }
  return '';
}
