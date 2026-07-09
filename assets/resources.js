import { esc, safeUrl, registerActions } from './utils.js';

// resources.js — 수업 사이트(fav) · 수업 도구(swrec) 렌더링
// 자료실 공통 문법: ov-head 표준 헤더 + rs-sec-hd 섹션 헤더 + rs-tile 이니셜/아이콘 타일

// 카테고리 색 패밀리 — 섹션 단위 custom prop(--rs-*)으로 주입, 토큰만 사용
const RS_FAMS = [
  /* 자료실=딥그린 계열 재정리(2026-07-10): 메뉴색과 겹치는 plan(수업·평가)·accent(전역)·ovr(퇴역) 제거 */
  { base: 'var(--brand)',  soft: 'var(--brand-soft)',  dark: 'var(--brand-dark)' },
  { base: 'var(--teal)',   soft: 'var(--teal-soft)',   dark: 'var(--teal-dark)' },
  { base: 'var(--warn)',   soft: 'var(--warn-soft)',   dark: 'var(--warn-dark)' },
  { base: 'var(--book)',   soft: 'var(--book-soft)',   dark: 'var(--book-dark)' },
  { base: 'var(--danger)', soft: 'var(--danger-soft)', dark: 'var(--danger-dark)' },
];
const famAt = i => RS_FAMS[i % RS_FAMS.length];
const famProps = f => `--rs-base:${f.base};--rs-soft:${f.soft};--rs-dark:${f.dark}`;
// 데이터의 카테고리명 앞 이모지는 렌더 시 제거 (아이콘은 stroke SVG 원칙)
const catLabel = raw => raw.replace(/^[^A-Za-z0-9가-힣]+/, '');

const ICO = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  monitor: ICO('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>'),
  laptop:  ICO('<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>'),
  tablet:  ICO('<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>'),
  image:   ICO('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  search:  ICO('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>'),
  wrench:  ICO('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  zap:     ICO('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  pencil:  ICO('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>'),
  video:   ICO('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>'),
  grid:    ICO('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  arrow:   ICO('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
};

// 페이지 표준 헤더 — 눈썹 배지 색은 data.js의 과목 accent를 그대로 사용
function rsHead(id, h2, sub) {
  const s = SUBJECTS.find(x => x.id === id) || {};
  return `<div class="ov-head">
    <span class="ov-eyebrow" style="color:${s.accent};background:${s.aLight}">${esc(s.name || '')}</span>
    <h2 class="ov-h2">${h2}</h2>
    <p class="ov-sub">${sub}</p>
  </div>`;
}

// ── 수업 사이트 ──────────────────────────────────────
function renderFav() {
  const chips = RECOMMENDED_SITES.map((cat, i) =>
    `<button class="rs-chip" data-onclick="rs:jump" data-args="${esc(JSON.stringify([i]))}">
      <span class="rs-chip-dot" style="background:${famAt(i).base}"></span>${esc(catLabel(cat.category))}</button>`
  ).join('');

  const cats = RECOMMENDED_SITES.map((cat, i) => {
    const f = famAt(i);
    const cards = cat.items.map(site => `
      <a class="fav-card" href="${safeUrl(site.url)}" target="_blank" rel="noopener noreferrer">
        <span class="rs-tile">${esc([...site.name.trim()][0])}</span>
        <span class="fav-card-body">
          <span class="fav-card-top">
            <span class="fav-card-name">${esc(site.name)}</span>
            <span class="fav-visit">방문 ${ICONS.arrow}</span>
          </span>
          <span class="fav-card-url">${esc(site.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span>
          <span class="fav-card-desc">${esc(site.desc)}</span>
        </span>
      </a>`).join('');
    return `<section class="fav-category" id="favSec${i}" style="${famProps(f)}">
      <div class="rs-sec-hd">
        <span class="rs-sec-title">${esc(catLabel(cat.category))}</span>
        <span class="rs-sec-cnt">${cat.items.length}</span>
      </div>
      <div class="fav-grid">${cards}</div>
    </section>`;
  }).join('');

  return `<div class="fav-wrap">
    ${rsHead('fav', '추천 사이트 모음', '정보 수업과 업무에 바로 쓰는 사이트만 골라 담았습니다.')}
    <div class="rs-chips">${chips}</div>
    ${cats}</div>`;
}

// ── 수업 도구 ────────────────────────────────────────
const SW_CAT_ICON = {
  '이미지': 'image', '이미지 뷰어': 'image', '검색': 'search', '유틸리티': 'wrench',
  '생산성': 'zap', '필기': 'pencil', '영상편집': 'video',
};
const OS_SECTIONS = [
  { key: 'windows', label: 'Windows', icon: 'monitor' },
  { key: 'mac',     label: 'Mac',     icon: 'laptop' },
  { key: 'ipad',    label: 'iPad',    icon: 'tablet' },
];

function renderSWRec() {
  const s = SUBJECTS.find(x => x.id === 'swrec') || {};
  const fam = `--rs-base:${s.accent};--rs-soft:${s.aLight};--rs-dark:${s.aDark}`;

  const chips = [`<button class="rs-chip active" data-onclick="rs:os" data-args="[null]">전체</button>`]
    .concat(OS_SECTIONS.map(os =>
      `<button class="rs-chip" data-onclick="rs:os" data-args="${esc(JSON.stringify([os.key]))}">${os.label}</button>`
    )).join('');

  const sections = OS_SECTIONS.map(os => {
    const items = SW_DATA[os.key] || [];
    if (!items.length) return '';
    const cards = items.map(sw => {
      const freeBadge = sw.free
        ? `<span class="sw-badge sw-badge-free">무료</span>`
        : `<span class="sw-badge sw-badge-paid">유료</span>`;
      const urlBtn  = sw.url     ? `<a class="sw-btn" href="${safeUrl(sw.url)}" target="_blank" rel="noopener noreferrer">공식 사이트</a>` : '';
      const blogBtn = sw.blogUrl ? `<a class="sw-btn sw-btn-blog" href="${safeUrl(sw.blogUrl)}" target="_blank" rel="noopener noreferrer">${ICONS.pencil} 직접 써본 후기</a>` : '';
      const btns = (urlBtn || blogBtn) ? `<div class="sw-card-btns">${urlBtn}${blogBtn}</div>` : '';
      return `<div class="fav-card sw-card">
        <span class="rs-tile">${ICONS[SW_CAT_ICON[sw.category] || 'grid']}</span>
        <span class="fav-card-body">
          <span class="sw-card-top">
            <span class="sw-card-name">${esc(sw.name)}</span>
            <span class="sw-badges"><span class="sw-badge sw-badge-cat">${esc(sw.category)}</span>${freeBadge}</span>
          </span>
          <span class="fav-card-desc">${esc(sw.desc)}</span>
          ${btns}
        </span>
      </div>`;
    }).join('');
    return `<section class="fav-category" data-os="${os.key}" style="${fam}">
      <div class="rs-sec-hd">
        ${ICONS[os.icon]}
        <span class="rs-sec-title">${os.label}</span>
        <span class="rs-sec-cnt">${items.length}</span>
      </div>
      <div class="fav-grid sw-grid">${cards}</div>
    </section>`;
  }).join('');

  return `<div class="fav-wrap">
    ${rsHead('swrec', '추천 소프트웨어', '정보 선생님들이 직접 써보고 추천하는 업무·수업용 소프트웨어입니다.')}
    <div class="rs-chips">${chips}</div>
    ${sections}</div>`;
}

registerActions('click', {
  'rs:jump': (el, e, i) => {
    const t = document.getElementById('favSec' + i);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'rs:os': (el, e, key) => {
    document.querySelectorAll('.rs-chip[data-onclick="rs:os"]').forEach(c => c.classList.toggle('active', c === el));
    document.querySelectorAll('.fav-category[data-os]').forEach(sec => {
      sec.style.display = (!key || sec.dataset.os === key) ? '' : 'none';
    });
  },
});

export { renderFav, renderSWRec };
