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

// 공용 토스트 (chasiToast 승격 — 백로그 'alert/confirm 대체' 1단계).
// opts: { isErr, actionLabel, onAction, duration } — actionLabel이 있으면 '되돌리기' 등 액션 버튼 표시.
// 주의: alert 대체 전용(비차단). confirm 대체는 비동기 전환이 필요한 별도 단계 — CLAUDE.md 백로그 참조.
let _uiToastEl = null;
export function uiToast(msg, opts = {}) {
  if (_uiToastEl) { _uiToastEl.remove(); _uiToastEl = null; }
  const t = document.createElement('div');
  t.className = 'ui-toast' + (opts.isErr ? ' err' : '');
  t.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  if (opts.actionLabel && opts.onAction) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ui-toast-action';
    b.textContent = opts.actionLabel;
    b.addEventListener('click', () => {
      t.remove();
      if (_uiToastEl === t) _uiToastEl = null;
      opts.onAction();
    });
    t.appendChild(b);
  }
  document.body.appendChild(t);
  _uiToastEl = t;
  const dur = opts.duration || (opts.actionLabel ? 6000 : 2800);
  setTimeout(() => { t.remove(); if (_uiToastEl === t) _uiToastEl = null; }, dur);
}

// 공용 컨펌 (native confirm 대체 — 백로그 'alert/confirm 대체' 2단계).
// Promise<boolean> 반환: 호출부는 `if (!(await uiConfirm('...'))) return;` 패턴으로 전환한다.
// 위임 핸들러(registerActions)는 async 함수를 그대로 받는다(반환 Promise는 무시됨) — 안전.
let _confirmEl = null;
export function uiConfirm(msg, opts = {}) {
  return new Promise(resolve => {
    if (_confirmEl) { _confirmEl.remove(); _confirmEl = null; } // 중첩 호출 방어
    const overlay = document.createElement('div');
    overlay.className = 'ui-confirm-overlay';
    const box = document.createElement('div');
    box.className = 'ui-confirm';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    const p = document.createElement('p');
    p.className = 'ui-confirm-msg';
    p.textContent = msg;
    const row = document.createElement('div');
    row.className = 'ui-confirm-btns';
    const done = val => {
      releaseFocus(overlay);
      overlay.remove();
      if (_confirmEl === overlay) _confirmEl = null;
      resolve(val);
    };
    const mk = (label, cls, val) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pbtn ' + cls;
      b.textContent = label;
      b.addEventListener('click', () => done(val));
      return b;
    };
    row.appendChild(mk(opts.cancelLabel || '취소', 'sec', false));
    row.appendChild(mk(opts.okLabel || '확인', 'pri', true));
    box.appendChild(p);
    box.appendChild(row);
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
    // Escape는 여기서 소비 — app.js의 문서 레벨 Escape 핸들러(모바일 드로어 등)로 전파 금지
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } });
    document.body.appendChild(overlay);
    _confirmEl = overlay;
    trapFocus(overlay); // 첫 포커스 = 취소 버튼 (파괴적 동작의 안전 기본값)
  });
}

export function setAccent(s) {
  const r = document.documentElement.style;
  r.setProperty('--accent', s.accent);
  r.setProperty('--accent-light', s.aLight);
  r.setProperty('--accent-dark', s.aDark);
}

// ── 이벤트 위임 (CSP 'unsafe-inline' 제거 전환용) ──────────────
// 동적 템플릿의 인라인 핸들러를 data-onclick/data-oninput/data-onchange 속성으로 대체.
// 사용: 템플릿에 data-onclick="rubric:generate" data-args='["인자"]'(JSON, esc() 필수),
//       모듈에서 registerActions('click', { 'rubric:generate': (el, e, ...args) => {...} })
const DELEGATED_ACTIONS = {
  click: {}, input: {}, change: {}, keydown: {}, blur: {},
  dragstart: {}, dragend: {}, dragover: {}, drop: {}, dragleave: {},
};
// blur는 버블되지 않으므로 캡처 단계에서 수신
const CAPTURE_TYPES = { blur: true };

export function registerActions(type, map) {
  Object.assign(DELEGATED_ACTIONS[type], map);
}

export function initDelegation(root) {
  Object.keys(DELEGATED_ACTIONS).forEach(type => {
    root.addEventListener(type, e => {
      const attr = 'data-on' + type;
      const el = e.target && e.target.closest ? e.target.closest('[' + attr + ']') : null;
      if (!el) return;
      const fn = DELEGATED_ACTIONS[type][el.getAttribute(attr)];
      if (!fn) return;
      let args = [];
      const raw = el.getAttribute('data-args');
      if (raw) { try { args = JSON.parse(raw); } catch (err) { args = []; } }
      fn(el, e, ...args);
    }, !!CAPTURE_TYPES[type]);
  });
}

// 인라인 오버라이드를 제거해 :root 기본값(브랜드 파랑)으로 복원.
// 과목 페이지를 다녀온 뒤 홈·비과목 페이지의 accent 오염 방지.
export function resetAccent() {
  const r = document.documentElement.style;
  r.removeProperty('--accent');
  r.removeProperty('--accent-light');
  r.removeProperty('--accent-dark');
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

// 도구 페이지 표준 헤더 — 눈썹 배지 + 제목 + 한 줄 설명 (규칙 9: 페이지 시작 표준)
export function pageHead(eyebrow, title, sub, fam = 'plan') {
  return `<div class="ov-head">
    <span class="ov-eyebrow" style="color:var(--${fam});background:var(--${fam}-soft)">${eyebrow}</span>
    <h2 class="ov-h2">${title}</h2>
    <p class="ov-sub">${sub}</p>
  </div>`;
}

// 생성형 도구의 빈 상태 — 사용 순서 3단계 안내
export function emptySteps(steps) {
  return `<div class="eval-empty"><div class="tool-steps">` +
    steps.map((s, i) =>
      `${i ? '<span class="tool-step-arrow">→</span>' : ''}<span class="tool-step"><span class="tool-step-num">${i + 1}</span>${s}</span>`
    ).join('') +
    `</div></div>`;
}

// 서식(HTML) 클립보드 복사 — 한글/워드 붙여넣기용.
// 선택-복사(동기, 클릭 제스처 안에서 확실, 서식+일반텍스트 동시 기록)를 우선하고
// 실패 시에만 ClipboardItem 폴백. 성공 여부를 반환하므로 호출부가 실패 안내를 담당.
export async function clipboardWriteHTML(html, plain) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(div);
  const plainText = plain || div.textContent || '';
  let ok = false;
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(div);
    sel.removeAllRanges();
    sel.addRange(range);
    ok = document.execCommand('copy');
    sel.removeAllRanges();
  } catch (e) { ok = false; }
  document.body.removeChild(div);
  if (ok) return true;
  try {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      })]);
      return true;
    }
  } catch (e) {}
  return false;
}

export function clipboardWriteText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = Object.assign(document.createElement('textarea'), {value:text, style:'position:fixed;opacity:0'});
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  });
}

export function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  trapFocus(m);
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  releaseFocus(m);
  m.style.display = 'none';
}

export function loadState(key, def) {
  try { const s = JSON.parse(localStorage.getItem(key)); if (s) return s; } catch(e) {}
  return def;
}

export function saveState(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
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
