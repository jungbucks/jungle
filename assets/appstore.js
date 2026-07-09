import { esc, safeUrl } from './utils.js';

// appstore.js — 정보교사 앱스토어 렌더링
// 스토어 문법: 썸네일 위 타입 배지 오버레이 + 제작자 아바타 + 그리드 안의 점선 '등록 신청' 카드

function renderAppStore() {
  const TYPE_META = {
    webapp:    { label: '웹앱',        color: 'var(--brand)' },
    extension: { label: '확장프로그램', color: 'var(--teal)' },
    desktop:   { label: '데스크탑앱',   color: 'var(--book)' },
    mobile:    { label: '모바일앱',     color: 'var(--warn)' },
    other:     { label: '기타',        color: 'var(--g500)' },
  };
  const ICO = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const plusIco = ICO('<path d="M5 12h14"/><path d="M12 5v14"/>');
  const packageIco = ICO('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>');
  const inboxIco = ICO('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>');

  const s = SUBJECTS.find(x => x.id === 'appstore') || {};
  const header = `<div class="ov-head">
    <span class="ov-eyebrow" style="color:${s.accent};background:${s.aLight}">${esc(s.name || '')}</span>
    <h2 class="ov-h2">정보교사 앱스토어</h2>
    <p class="ov-sub">정보 선생님들이 직접 만든 웹앱·프로그램 모음입니다.</p>
  </div>`;

  // 그리드 마지막 자리: 점선 '앱 등록 신청' 카드 — 빈 상태가 곧 초대장
  const addCard = `<div class="astore-card astore-add-card">
    <div class="astore-add-ico">${plusIco}</div>
    <div class="astore-add-title">앱 등록 신청</div>
    <div class="astore-add-desc">직접 만든 웹앱이나 프로그램을 이곳에 소개하고 싶으신가요?</div>
    <div class="astore-add-links">
      <a class="astore-add-link" href="https://www.instagram.com/jungbucks" target="_blank" rel="noopener">Instagram @jungbucks</a>
      <a class="astore-add-link" href="http://blog.naver.com/kachu_t" target="_blank" rel="noopener">네이버 블로그</a>
    </div>
  </div>`;

  let body;
  if (!APPSTORE_APPS.length) {
    body = `<div class="astore-empty">
      <div class="astore-empty-icon">${inboxIco}</div>
      <div class="astore-empty-title">아직 등록된 앱이 없습니다</div>
      <div class="astore-empty-desc">정보 선생님이 만든 웹앱이나 프로그램을<br>이곳에 소개해드릴 예정입니다.</div>
    </div>${`<div class="astore-grid">${addCard}</div>`}`;
  } else {
    const cards = APPSTORE_APPS.map(app => {
      const tm = TYPE_META[app.type] || TYPE_META.other;
      const thumbHtml = app.thumb
        ? `<img class="astore-thumb" src="${app.thumb}" alt="${esc(app.name)}" loading="lazy">`
        : `<div class="astore-thumb-placeholder">${packageIco}</div>`;
      const authorHtml = app.authorUrl
        ? `<a class="astore-card-author" href="${safeUrl(app.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(app.author)}</a>`
        : `<span class="astore-card-author">${esc(app.author)}</span>`;
      const tags = (app.tags || []).map(t => `<span class="astore-tag">${esc(t)}</span>`).join('');
      return `<div class="astore-card">
        <div class="astore-thumb-wrap">
          ${thumbHtml}
          <span class="astore-type-badge" style="color:${tm.color}">${tm.label}</span>
        </div>
        <div class="astore-card-body">
          <div class="astore-card-name">${esc(app.name)}</div>
          <div class="astore-card-meta"><span class="astore-avatar">${esc([...app.author.trim()][0])}</span>${authorHtml}</div>
          <div class="astore-card-desc">${esc(app.desc)}</div>
          ${tags ? `<div class="astore-card-tags">${tags}</div>` : ''}
          <div class="astore-card-footer">
            <a class="astore-card-btn" href="${safeUrl(app.url)}" target="_blank" rel="noopener noreferrer">열기 →</a>
          </div>
        </div>
      </div>`;
    }).join('');
    body = `<div class="astore-grid">${cards}${addCard}</div>`;
  }

  return `<div class="astore-wrap">${header}${body}</div>`;
}

export { renderAppStore };
