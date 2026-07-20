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

// ── 학기 단위 성취수준: 선택된 성취기준 수집 ──
// stdpicker가 코드순으로 정렬해 넘기지만, 여기서는 단원 순회 순서를 따른다
// (같은 과목 안에서 두 순서는 일치한다).
function collectSelectedStds(subjId, codes) {
  const subj = SUBJECTS.find(s => s.id === subjId);
  if (!subj || !subj.domains) return null;
  const want = new Set(codes || []);
  const stds = [];
  subj.domains.forEach(d => {
    const arr = ACHIEVEMENTS[getAchvKey(subjId, d.name)];
    if (!arr) return;
    arr.forEach(std => { if (want.has(std.code)) stds.push(std); });
  });
  return { subj, stds };
}

// 레벨별로 한 문단씩 조립. codes는 화면에 표시할 출처 배지용(복사본에는 안 들어감).
function buildLevelParagraphs(stds, mode) {
  const out = {};
  ['A', 'B', 'C', 'D', 'E'].forEach(g => {
    const has = (stds || []).filter(s => ((s.levels && s.levels[g]) || '').trim());
    out[g] = {
      text: mergeLevelTexts(has.map(s => s.levels[g]), mode),
      codes: has.map(s => s.code),
    };
  });
  return out;
}

// 복사본은 레벨·문단 2열만. 출처 코드는 넣지 않는다(설계 §6).
// 한글 붙여넣기용 HTML이라 CSS 변수 대신 리터럴 hex를 쓴다(규칙 5 예외).
function achvBuildSemesterHtml(paras) {
  const rows = ['A','B','C','D','E']
    .filter(g => paras[g].text)
    .map(g => `<tr><td style="text-align:center;font-weight:bold">${g}</td><td>${paras[g].text}</td></tr>`)
    .join('');
  return '<table border="1" style="border-collapse:collapse"><tbody>' + rows + '</tbody></table>';
}

function achvBuildSemesterPlain(paras) {
  return ['A','B','C','D','E'].filter(g => paras[g].text).map(g => `${g}\t${paras[g].text}`).join('\n');
}

// 진입점: 성취기준 선택기를 먼저 연다. 확인하면 결과 모달로 넘어간다.
function openSemesterAchvPicker(subjId, accent) {
  closeAchvModal();   // 결과 모달이 떠 있으면 먼저 닫는다 (겹쳐 보이던 문제)
  // 과목이 바뀌면 이전 과목의 코드를 들고 있으면 안 된다 (조용히 틀린 결과 방지)
  if (subjId !== _semSubjId) { _semSelected = []; _semSubjId = subjId; }
  _semAccent = accent;
  const subjectIdx = SUBJECTS.findIndex(s => s.id === subjId);
  openStdPicker({
    title: '학기 단위 성취수준 — 성취기준 선택',
    hint: '성취기준을 선택하고 확인을 누르면 학기별 성취수준이 만들어집니다.',
    subjectIdx: subjectIdx < 0 ? 1 : subjectIdx,
    preselected: _semSelected,
    selectAll: true,
    onConfirm: (codes, subjIdx) => {
      const picked = SUBJECTS[subjIdx];
      if (picked && picked.id !== _semSubjId) { _semSubjId = picked.id; _semAccent = picked.accent; }
      _semSelected = codes;
      openSemesterAchvModal(_semSubjId, _semAccent, codes);
    },
  });
}

function openSemesterAchvModal(subjId, accent, codes) {
  const res = collectSelectedStds(subjId, codes);
  if (!res) return;
  const { subj, stds } = res;
  if (!stds.length) { uiToast('성취기준을 하나 이상 선택하세요.', { isErr: true }); openSemesterAchvPicker(subjId, accent); return; }
  _semSubjId = subjId; _semAccent = accent; _semSelected = codes;
  const paras = buildLevelParagraphs(stds, _semMode);
  // 성취수준 전용 색. 의미 토큰(--ok/--accent/--plan)은 과목 강조색과 값이 겹쳐
  // (예: --ok #10B981 = 고등학교 정보, --plan #7C3AED = 프로그래밍) 레벨이 과목색처럼 보였다.
  const gradeColors = { A:'var(--achv-a)', B:'var(--achv-b)', C:'var(--achv-c)', D:'var(--achv-d)', E:'var(--achv-e)' };
  let bodyHtml = '';
  ['A','B','C','D','E'].forEach(g => {
    const p = paras[g];
    if (!p.text) return;
    bodyHtml += `<div class="achv-para">
      <div class="achv-para-hd" style="color:${gradeColors[g]}">${g}</div>
      <p class="achv-para-tx">${esc(p.text)}</p>
      <div class="achv-para-src">${p.codes.map(c => `<span>${esc(c)}</span>`).join('')}</div>
    </div>`;
  });
  let overlay = document.getElementById('achvOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'achv-overlay';
    overlay.id = 'achvOverlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeAchvModal(); };
    document.body.appendChild(overlay);
  }
  const seg = (m, label) => `<button class="achv-seg${_semMode === m ? ' on' : ''}" data-onclick="achv:semMode" data-args="${esc(JSON.stringify([m]))}" aria-pressed="${_semMode === m}">${label}</button>`;
  overlay.innerHTML = `
    <div class="achv-modal" role="dialog" aria-modal="true" aria-labelledby="achvModalTitle">
      <div class="achv-modal-hd">
        <span class="achv-modal-title" id="achvModalTitle" style="color:${accent}">📊 ${esc(subj.name)} — 학기 단위 성취수준</span>
        <button class="cmp-close-btn" data-onclick="achv:close" aria-label="닫기">✕</button>
      </div>
      <div class="achv-seg-bar" role="group" aria-label="문장 연결 방식">
        ${seg('join', '연결어미로 잇기')}${seg('raw', '원문 그대로')}
        <span class="achv-seg-note">성취기준 ${stds.length}개</span>
      </div>
      <div class="achv-modal-body">${bodyHtml}</div>
      <div class="achv-modal-ft">
        <button class="achv-copy-all pri" id="achvCopyAllBtn" data-onclick="achv:copyAllSem">전체 복사</button>
        <button class="achv-copy-all sec" data-onclick="achv:semRepick">↩ 성취기준 다시 고르기</button>
        <button class="achv-copy-all sec" data-onclick="achv:close">닫기</button>
        <span id="achvCopyMsg" style="font-size:12px;color:var(--ok);display:none">✓ 복사됨</span>
      </div>
    </div>`;
  overlay.style.display = '';
  trapFocus(overlay.querySelector('.achv-modal'));
}

function achvCopyAllSem() {
  const res = collectSelectedStds(_semSubjId, _semSelected);
  if (!res || !res.stds.length) return;
  const paras = buildLevelParagraphs(res.stds, _semMode);   // 보이는 모드 그대로 복사
  achvClipWrite(achvBuildSemesterHtml(paras), achvBuildSemesterPlain(paras), () => {
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

function achvSetSemMode(mode) {
  if (mode !== 'join' && mode !== 'raw') return;
  _semMode = mode;
  openSemesterAchvModal(_semSubjId, _semAccent, _semSelected);   // 즉시 재렌더
}

export { openAchvModal, closeAchvModal, achvCopyAll, achvCopyStd, openSemesterAchvPicker, openSemesterAchvModal, achvCopyAllSem };

export const __achvTest = { mergeLevelTexts, collectSelectedStds, buildLevelParagraphs };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'achv:close':   function() { closeAchvModal(); },
  'achv:copyAll': function(el, e, domainName) { achvCopyAll(domainName); },
  'achv:copyStd': function(el, e, domainName, si) { achvCopyStd(el, domainName, si); },
  'achv:copyAllSem': function() { achvCopyAllSem(); },
  'achv:semMode':    function(el, e, mode) { achvSetSemMode(mode); },
  'achv:semRepick':  function() { openSemesterAchvPicker(_semSubjId, _semAccent); },
});
